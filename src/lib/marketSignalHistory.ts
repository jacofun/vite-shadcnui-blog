import { validResult, type MarketSignalResult, type SignalStatus, type ResearchHours } from "@/lib/marketSignal";
import { getTradingFunctionTicket } from "@/lib/binanceSync";
import type { PrivateAuthSession } from "@/lib/privateAuth";
import { TradingApiError, tradingRequest } from "@/lib/trading";

type ReviewTarget = { zoneId: string; touched: boolean };
type ReviewPending = { hours: ResearchHours; status: "pending"; dueAt: number };
type ReviewInsufficient = { hours: ResearchHours; status: "insufficient"; dueAt: number; code: string };
export type ReviewSummary = ReviewPending | ReviewInsufficient | { hours: ResearchHours; status: "completed"; dueAt: number; targets: ReviewTarget[] };
export type SignalReview = ReviewPending | ReviewInsufficient | {
  hours: ResearchHours; status: "completed"; dueAt: number; referencePrice: number; referenceTime: number;
  observedFrom: number; observedUntil: number; endPrice: number; high: number; low: number;
  mfePct: number | null; maePct: number | null; directionAligned: boolean | null;
  targets: (ReviewTarget & { lower: number; upper: number; firstTouchMinute: number | null })[];
  candles: [time: number, open: number, high: number, low: number, close: number][];
};
export interface SavedSignalSummary {
  analysisId: string;
  symbol: string;
  status: SignalStatus;
  completedAt: number;
  title: string;
  schemaVersion?: 4;
  source?: "auto_scan";
  direction?: "long" | "short" | null;
  reviews?: ReviewSummary[];
}

export async function saveMarketSignal(session: PrivateAuthSession, result: MarketSignalResult) {
  const record = { ...result };
  delete record.orderPermit;
  const saved = await tradingRequest<{ analysisId: string }>(session, "signals/save", { result: record }, AbortSignal.timeout(20_000));
  if (saved.analysisId !== result.analysisId) throw new Error("未收到本次分析的保存确认。");
}

export const listMarketSignals = (session: PrivateAuthSession, cursor?: string, signal?: AbortSignal) =>
  tradingRequest<{ entries: SavedSignalSummary[]; nextCursor: string | null }>(session, "signals/list", cursor ? { cursor } : {}, signal);

type ArchiveResponse = { result: unknown; reviews?: SignalReview[]; reviewUnavailable?: boolean; requestId?: string };

async function readScanArchive(session: PrivateAuthSession, analysisId: string, scanId: string, signal?: AbortSignal): Promise<ArchiveResponse> {
  const { token, url } = await getTradingFunctionTicket(session, signal);
  const response = await fetch(new URL("/trade/api/signal/scans", url.origin), {
    method: "POST", credentials: "omit", cache: "no-store", redirect: "error",
    headers: { "X-JWT-Token": `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action: "analysis", analysisId, scanId }), signal,
  });
  const payload = await response.json().catch(() => null);
  const requestId = payload?.requestId ?? payload?.RequestId;
  if (!response.ok) {
    throw new TradingApiError(response.status, payload?.error?.code ?? payload?.Code ?? "SIGNAL_ARCHIVE_UNAVAILABLE", "", requestId);
  }
  if (payload?.result?.schemaVersion !== 4 || payload.result.requestId !== scanId) {
    throw new TradingApiError(502, "SIGNAL_ARCHIVE_INVALID", "", requestId);
  }
  return { result: payload?.result, requestId, reviewUnavailable: true };
}

export async function getMarketSignal(session: PrivateAuthSession, analysisId: string, signal?: AbortSignal, scanId?: string) {
  let archive: ArchiveResponse;
  const primarySignal = AbortSignal.any([AbortSignal.timeout(12_000), ...(signal ? [signal] : [])]);
  try {
    archive = await tradingRequest<ArchiveResponse>(session, "signals/get", { analysisId }, primarySignal);
  } catch (error) {
    signal?.throwIfAborted();
    const storageFailure = error instanceof TradingApiError &&
      (error.code === "SIGNAL_NOT_FOUND" || error.status >= 500 && error.code !== "SIGNAL_ARCHIVE_INVALID");
    if (!scanId || !(storageFailure || primarySignal.aborted || error instanceof TypeError)) throw error;
    archive = await readScanArchive(session, analysisId, scanId, signal);
  }
  const { result, reviews, reviewUnavailable, requestId } = archive;
  if (!validResult(result) || result.analysisId !== analysisId || !result.market.chart) {
    throw new TradingApiError(502, "SIGNAL_ARCHIVE_INVALID", "", requestId);
  }
  return { result, reviews, reviewUnavailable };
}

export function describeMarketSignalReadError(error: unknown) {
  if (error instanceof TradingApiError) {
    const message = error.code === "SIGNAL_NOT_FOUND" ? "未找到这条分析归档。" :
      error.code === "SIGNAL_ARCHIVE_INVALID" || error.code === "INVALID_RESPONSE" ? "这条分析记录的数据不完整或格式无效。" :
      error.status === 401 ? "登录已过期或凭证无效，请重新登录后重试。" :
      error.status === 403 ? "当前会话没有读取该分析记录的权限。" : "分析归档暂不可读，请重试。";
    const code = typeof error.code === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(error.code) ? error.code : `HTTP ${error.status}`;
    const id = typeof error.requestId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(error.requestId) ? ` · 请求编号 ${error.requestId}` : "";
    return `${message}（${code}${id}）`;
  }
  if (error instanceof DOMException && error.name === "TimeoutError") return "读取分析记录超时，请重试。";
  if (error instanceof TypeError) return "读取分析记录时连接中断，请重试。";
  return "分析归档暂不可读，请重试。";
}

export const statusText: Record<SignalStatus, string> = { candidate: "候选机会 · 待确认触发条件", watch: "继续观察", none: "暂无机会", expired: "结果已过期 · 请重新分析" };

export const formatSignalDate = (time: number) => new Date(time).toLocaleString("zh-CN", { hour12: false });
