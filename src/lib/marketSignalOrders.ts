import type { PrivateAuthSession } from "@/lib/privateAuth";
import { getTradingFunctionTicket } from "@/lib/binanceSync";

export type OrderKind = "market" | "limit" | "conditional";
export const orderKinds: OrderKind[] = ["market", "limit", "conditional"];
export const orderLabels: Record<OrderKind, string> = { market: "市价开仓", limit: "回踩限价开仓", conditional: "条件限价开仓" };
export const isAnalysisId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);
const mode = (value: unknown): value is "live" | "demo" => value === "live" || value === "demo";
const sealed = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,1500}\.[A-Za-z0-9_-]{43}$/.test(value);
export const isOrderPermit = sealed;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const number = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const decimal = (value: unknown): value is string => typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value);
const kind = (value: unknown): value is OrderKind => value === "market" || value === "limit" || value === "conditional";
export interface OrderOption { kind: OrderKind; price: string; triggerPrice?: string; stopLossPrice: string; takeProfitPrice: string; risk: number; notional: number }
export interface OrderPreview {
  mode: "live" | "demo"; symbol: "BTCUSDT"; analysisId: string; direction: "long" | "short"; quantity: string;
  stop: number; target: number; riskCap: number; markPrice: string; expiresAt: number;
  submission: { state: "blocked"; code: "ORDER_PROTECTION_UNAVAILABLE"; reason: string };
  options: OrderOption[]; unavailable: Partial<Record<OrderKind, string>>;
}
export interface OrderStatus {
  mode: "live" | "demo"; analysisId: string; state: "not_recorded" | "accepted" | "rejected" | "unknown";
  kind?: OrderKind; clientId?: string; exchangeStatus?: string; childStatus?: string; executedQty?: string; avgPrice?: string;
  exchangeCode?: number; reason?: string; lookupUnavailable?: boolean; reconciliationRequired?: boolean;
}
type OrderRequest = { action: "preview"; permit: string } | { action: "status"; analysisId: string };

async function orderRequest(session: PrivateAuthSession, input: OrderRequest, signal?: AbortSignal): Promise<unknown> {
  const ticket = await getTradingFunctionTicket(session, signal, { action: input.action });
  const url = new URL("/trade/api/signal/orders", ticket.url.origin);
  let response: Response;
  try {
    response = await fetch(url.href, {
      method: "POST", credentials: "omit", cache: "no-store", redirect: "error",
      headers: { "X-JWT-Token": `Bearer ${ticket.token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.any([AbortSignal.timeout(35_000), ...(signal ? [signal] : [])]),
    });
  } catch {
    throw new Error("交易计划接口连接中断，请重试。");
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = record(payload) && record(payload.error) ? payload.error : {};
    const message = typeof error.message === "string" ? error.message : `订单请求失败（HTTP ${response.status}）`;
    const requestId = record(payload) && typeof payload.requestId === "string" ? `。请求编号 ${payload.requestId}` : "";
    throw new Error(message + requestId);
  }
  return payload;
}
export async function previewOrders(session: PrivateAuthSession, analysisId: string, permit: string, signal: AbortSignal): Promise<OrderPreview> {
  const value = await orderRequest(session, { action: "preview", permit }, signal);
  if (!record(value) || value.symbol !== "BTCUSDT" || value.analysisId !== analysisId || !mode(value.mode) ||
    (value.direction !== "long" && value.direction !== "short") || !decimal(value.quantity) || !decimal(value.markPrice) ||
    ![value.stop, value.target, value.riskCap, value.expiresAt].every(number) ||
    !record(value.submission) || value.submission.state !== "blocked" || value.submission.code !== "ORDER_PROTECTION_UNAVAILABLE" ||
    typeof value.submission.reason !== "string" || !value.submission.reason ||
    !Array.isArray(value.options) || value.options.length > 3 ||
    !value.options.every(option => record(option) && kind(option.kind) && decimal(option.price) && decimal(option.stopLossPrice) && decimal(option.takeProfitPrice) &&
      Number(option.stopLossPrice) === value.stop && Number(option.takeProfitPrice) === value.target &&
      number(option.risk) && number(option.notional) && (option.kind === "conditional" ? decimal(option.triggerPrice) : option.triggerPrice === undefined)) ||
    !record(value.unavailable) || Object.values(value.unavailable).some(message => typeof message !== "string")) {
    throw new Error("订单草稿格式无效。");
  }
  return value as unknown as OrderPreview;
}
export async function fetchOrderStatus(session: PrivateAuthSession, analysisId: string): Promise<OrderStatus> {
  const value = await orderRequest(session, { action: "status", analysisId });
  if (!record(value) || value.analysisId !== analysisId || !mode(value.mode) ||
    !["not_recorded", "accepted", "rejected", "unknown"].includes(String(value.state)) ||
    (value.state !== "not_recorded" && (!kind(value.kind) || typeof value.clientId !== "string"))) {
    throw new Error("订单状态响应不完整，请重新查单。");
  }
  return value as unknown as OrderStatus;
}
