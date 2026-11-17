import type { PrivateAuthSession } from "@/lib/privateAuth";
import { PRIVATE_AUTH_API_BASE } from "@/lib/privateAuthApi";
import { notifyPrivateAuthInvalidated } from "@/lib/privateAuthEvents";

const SYNC_ORIGINS = new Set(["https://yanxiao.me", "https://www.yanxiao.me"]);

export interface BinanceSyncResult {
  status: "completed";
  requestId: string;
  newRecords: { trades: number; income: number };
}

export async function syncBinanceRecords(session: PrivateAuthSession): Promise<BinanceSyncResult> {
  const ticketResponse = await fetch(`${PRIVATE_AUTH_API_BASE}/trading/binance/token`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": session.csrfToken, Accept: "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(20_000),
  });
  if (ticketResponse.status === 401) notifyPrivateAuthInvalidated();
  const ticket = await ticketResponse.json().catch(() => null);
  if (!ticketResponse.ok) throw new Error(ticket?.message || "获取同步凭证失败，请重新登录后重试");
  if (typeof ticket?.token !== "string" || typeof ticket.syncUrl !== "string" ||
    !Number.isSafeInteger(ticket.expiresAt) || ticket.expiresAt * 1000 <= Date.now()) {
    throw new Error("同步凭证格式无效");
  }
  const url = new URL(ticket.syncUrl);
  if (url.protocol !== "https:" || !SYNC_ORIGINS.has(url.origin) ||
    url.username || url.password || url.search || url.hash || url.pathname !== "/trade/api") throw new Error("同步地址必须为 yanxiao.me 或 www.yanxiao.me 的 /trade/api HTTPS 地址");

  // A single foreground request. The short JWT stays in this call's memory.
  // Do not automatically retry: an interrupted response can still mean FC is running.
  let response: Response;
  try {
    response = await fetch(url.href, {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers: { Authorization: `Bearer ${ticket.token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ action: "sync" }),
      signal: AbortSignal.timeout(310_000),
    });
  } catch {
    throw new Error("同步连接中断或超时，云端任务仍会继续；请先查看首尔函数日志与 OSS 运行报告，再重新同步");
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || "同步请求失败，请检查首尔函数鉴权与 CDN 配置");
  if (payload?.status !== "completed" || typeof payload.requestId !== "string" ||
    !Number.isSafeInteger(payload.newRecords?.trades) || payload.newRecords.trades < 0 ||
    !Number.isSafeInteger(payload.newRecords?.income) || payload.newRecords.income < 0) {
    throw new Error("未收到完整同步结果，请检查 OSS 运行报告");
  }
  return payload as BinanceSyncResult;
}
