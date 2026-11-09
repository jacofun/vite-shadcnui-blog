import { notifyPrivateAuthInvalidated } from "@/lib/privateAuthEvents";
import { PRIVATE_AUTH_API_BASE } from "@/lib/privateAuthApi";
import type { PrivateAuthSession } from "@/lib/privateAuth";

export type Market = "cn" | "hk" | "us" | "crypto" | "other";
export type TradeDirection = "long" | "short";
export type TradeRecordType = "live" | "paper" | "observation";
export type TradeStatus = "draft" | "planned" | "open" | "closed" | "skipped";
export type TradePhase = "plan" | "execution" | "review";

export interface TradePlan {
  symbol: string;
  name: string;
  market: Market;
  direction: TradeDirection;
  recordType: TradeRecordType;
  strategy: string;
  timeframe: string;
  account: string;
  currency: string;
  setupAt: string;
  trend: "up" | "down" | "range";
  signals: string[];
  thesis: string;
  trigger: string;
  invalidation: string;
  entry: number | null;
  stop: number | null;
  target: number | null;
  plannedQuantity: number | null;
  plannedRisk: number | null;
  stopReason: string;
  holdingPeriod: string;
}
export interface TradeExecution {
  id: string;
  action: "entry" | "exit";
  at: string;
  price: number;
  quantity: number;
  fee: number;
  note: string;
}
export interface TradeReview {
  expectation: "yes" | "partial" | "no";
  discipline: "full" | "partial" | "violated";
  score: number;
  emotions: string[];
  mistakes: string[];
  outcome: string;
  learning: string;
  replay: string;
  updatedAt?: string;
}
export interface TradeAttachment {
  id: string;
  path: string;
  contentType: string;
  phase: TradePhase;
  caption: string;
  createdAt: string;
}
export interface TradeMetrics {
  remaining: number;
  averageEntry: number | null;
  realizedPnl: number;
  initialRisk: number | null;
  realizedR: number | null;
  status: TradeStatus;
}
export interface Trade {
  id: string;
  revision: number;
  status: TradeStatus;
  createdAt: string;
  updatedAt: string;
  plan: TradePlan;
  planHistory: Array<{ version: number; confirmedAt: string; plan: TradePlan }>;
  executions: TradeExecution[];
  attachments: TradeAttachment[];
  events: Array<{ type: string; at: string; previous?: unknown }>;
  review?: TradeReview;
  metrics: TradeMetrics;
}
export interface ImageTicket {
  imageId: string;
  path: string;
  contentType: string;
  expiresAt: number;
  uploadUrl: string;
}

export class TradingApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "TradingApiError";
  }
}
async function tradingRequest<T>(session: PrivateAuthSession, path: string, body: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${PRIVATE_AUTH_API_BASE}/trading/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": session.csrfToken },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify(body),
    signal,
  });
  if (response.status === 401) notifyPrivateAuthInvalidated();
  const payload = await response.json().catch(() => null) as (T & { code?: string; message?: string }) | null;
  if (!response.ok) {
    throw new TradingApiError(response.status, payload?.code ?? "REQUEST_FAILED", payload?.message ?? "交易日志请求失败");
  }
  if (!payload) throw new TradingApiError(response.status, "INVALID_RESPONSE", "服务未返回有效 JSON");
  return payload;
}
export const listTrades = (session: PrivateAuthSession, signal?: AbortSignal) =>
  tradingRequest<{ entries: Trade[] }>(session, "list", {}, signal);
export const getTrade = (session: PrivateAuthSession, id: string, signal?: AbortSignal) =>
  tradingRequest<{ trade: Trade }>(session, "get", { id }, signal);
export const saveTrade = (session: PrivateAuthSession, plan: TradePlan, previous?: Trade, createId?: string) =>
  tradingRequest<{ trade: Trade }>(session, "save", { plan, ...(previous ? { id: previous.id, revision: previous.revision } : { id: createId ?? crypto.randomUUID() }) });
export const confirmTrade = (session: PrivateAuthSession, trade: Trade) =>
  tradingRequest<{ trade: Trade }>(session, "confirm", { id: trade.id, revision: trade.revision });
export const reviseTrade = (session: PrivateAuthSession, trade: Trade, plan: TradePlan) =>
  tradingRequest<{ trade: Trade }>(session, "revise", { id: trade.id, revision: trade.revision, plan });
export const addTradeExecution = (session: PrivateAuthSession, trade: Trade, execution: TradeExecution, edit = false) =>
  tradingRequest<{ trade: Trade }>(session, edit ? "execution/update" : "execution/add",
    { id: trade.id, revision: trade.revision, execution });
export const skipTrade = (session: PrivateAuthSession, trade: Trade) =>
  tradingRequest<{ trade: Trade }>(session, "skip", { id: trade.id, revision: trade.revision });
export const reviewTrade = (session: PrivateAuthSession, trade: Trade, review: Omit<TradeReview, "updatedAt">) =>
  tradingRequest<{ trade: Trade }>(session, "review", { id: trade.id, revision: trade.revision, review });
export const initTradeImage = (session: PrivateAuthSession, trade: Trade, params: { contentType: string; bytes: number; phase: TradePhase; caption: string }) =>
  tradingRequest<ImageTicket>(session, "image/init", { id: trade.id, revision: trade.revision, ...params });
export const completeTradeImage = (session: PrivateAuthSession, trade: Trade, imageId: string) =>
  tradingRequest<{ trade: Trade }>(session, "image/complete", { id: trade.id, revision: trade.revision, imageId });

export function createDraftPlan(): TradePlan {
  return {
    symbol: "", name: "", market: "cn", direction: "long", recordType: "live",
    strategy: "反转", timeframe: "日线", account: "", currency: "CNY",
    setupAt: new Date().toISOString(), trend: "range", signals: [],
    thesis: "", trigger: "", invalidation: "", entry: null, stop: null,
    target: null, plannedQuantity: null, plannedRisk: null,
    stopReason: "", holdingPeriod: "",
  };
}
export const formatPrice = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 8 }).format(n);
export function riskReward(plan: TradePlan): number | null {
  if (plan.entry == null || plan.stop == null || plan.target == null) return null;
  const risk = (plan.direction === "long" ? 1 : -1) * (plan.entry - plan.stop);
  const reward = (plan.direction === "long" ? 1 : -1) * (plan.target - plan.entry);
  return risk > 0 && reward > 0 ? reward / risk : null;
}
