import { validResult, type MarketSignalResult, type SignalStatus, type ResearchHours } from "@/lib/marketSignal";
import type { PrivateAuthSession } from "@/lib/privateAuth";
import { tradingRequest } from "@/lib/trading";

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
  direction?: "long" | "short" | null;
  reviews?: ReviewSummary[];
}

export async function saveMarketSignal(session: PrivateAuthSession, result: MarketSignalResult) {
  const saved = await tradingRequest<{ analysisId: string }>(session, "signals/save", { result }, AbortSignal.timeout(20_000));
  if (saved.analysisId !== result.analysisId) throw new Error("未收到本次分析的保存确认。");
}

export const listMarketSignals = (session: PrivateAuthSession, cursor?: string, signal?: AbortSignal) =>
  tradingRequest<{ entries: SavedSignalSummary[]; nextCursor: string | null }>(session, "signals/list", cursor ? { cursor } : {}, signal);

export async function getMarketSignal(session: PrivateAuthSession, analysisId: string, signal?: AbortSignal) {
  const { result, reviews } = await tradingRequest<{ result: unknown; reviews?: SignalReview[] }>(session, "signals/get", { analysisId }, signal);
  if (!validResult(result) || result.analysisId !== analysisId || !result.market.chart) throw new Error("这条分析记录的行情数据不完整。");
  return { result, reviews };
}

export const statusText: Record<SignalStatus, string> = { candidate: "候选机会 · 待确认触发条件", watch: "继续观察", none: "暂无机会", expired: "结果已过期 · 请重新分析" };

export const formatSignalDate = (time: number) => new Date(time).toLocaleString("zh-CN", { hour12: false });
