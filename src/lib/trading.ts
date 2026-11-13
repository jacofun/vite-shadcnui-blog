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
  expectation: "yes" | "partial" | "no" | "unknown";
  discipline: "full" | "partial" | "violated" | "unknown";
  score: number | null;
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
  feesComplete?: boolean;
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
  notes?: TradeAiNote[];
  timeline?: TradeAiTimelineEvent[];
  review?: TradeReview;
  skip?: { kind: "abandoned" | "missed"; reason: string; at: string };
  metrics: TradeMetrics;
}

export interface TradeAiNote {
  id: string;
  raw: string;
  summary: string;
  phase: "plan" | "execution" | "review" | "mixed" | "note";
  referenceAt: string;
  timezone: string;
  createdAt: string;
  missing: string[];
  warnings: string[];
}
export interface TradeAiTimelineEvent {
  id: string;
  noteId: string;
  type: string;
  at: string | null;
  summary: string;
  recordedAt: string;
}
export interface TradeAiProposal {
  phase: TradeAiNote["phase"];
  summary: string;
  plan: Partial<TradePlan>;
  executions: Array<{
    action: "entry" | "exit";
    at: string | null;
    price: number | null;
    quantity: number | null;
    quantityMode: "explicit" | "all" | "half" | "unknown";
    fee: number | null;
    note: string;
  }>;
  events: Array<{ kind: string; at: string | null; summary: string }>;
  review: Omit<TradeReview, "updatedAt"> | null;
  missing: string[];
  warnings: string[];
}
export interface TradeAiParseResponse {
  proposal: TradeAiProposal;
  referenceAt: string;
  timezone: string;
  mentions: Array<{ original: string; resolved: string }>;
  model: string;
}

export interface ImageTicket {
  imageId: string;
  path: string;
  contentType: string;
  expiresAt: number;
  uploadUrl: string;
}

export class TradingApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "TradingApiError";
    this.status = status;
    this.code = code;
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
export const skipTrade = (session: PrivateAuthSession, trade: Trade, kind: "abandoned" | "missed", reason: string) =>
  tradingRequest<{ trade: Trade }>(session, "skip", { id: trade.id, revision: trade.revision, kind, reason });
export const reviewTrade = (session: PrivateAuthSession, trade: Trade, review: Omit<TradeReview, "updatedAt">) =>
  tradingRequest<{ trade: Trade }>(session, "review", { id: trade.id, revision: trade.revision, review });
export const initTradeImage = (session: PrivateAuthSession, trade: Trade, params: { contentType: string; bytes: number; phase: TradePhase; caption: string }) =>
  tradingRequest<ImageTicket>(session, "image/init", { id: trade.id, revision: trade.revision, ...params });
export const completeTradeImage = (session: PrivateAuthSession, trade: Trade, imageId: string) =>
  tradingRequest<{ trade: Trade }>(session, "image/complete", { id: trade.id, revision: trade.revision, imageId });


export const parseTradingNarrative = (
  session: PrivateAuthSession,
  text: string,
  timezone: string,
  id?: string,
) => tradingRequest<TradeAiParseResponse>(session, "ai/parse", { text, timezone, ...(id ? { id } : {}) });

export const applyTradingNarrative = (
  session: PrivateAuthSession,
  input: {
    id?: string;
    revision?: number;
    createId: string;
    noteId: string;
    raw: string;
    referenceAt: string;
    timezone: string;
    proposal: TradeAiProposal;
    defaultRisk?: number;
  },
) => tradingRequest<{ trade: Trade; applied: { executions: number; events: number; duplicate: boolean }; missing: string[] }>(
  session, "ai/apply", input,
);

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
