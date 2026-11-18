import { validResult, type MarketSignalResult, type SignalStatus } from "@/lib/marketSignal";
import type { PrivateAuthSession } from "@/lib/privateAuth";
import { tradingRequest } from "@/lib/trading";

export interface SavedSignalSummary {
  analysisId: string;
  symbol: string;
  status: SignalStatus;
  completedAt: number;
  title: string;
}

export async function saveMarketSignal(session: PrivateAuthSession, result: MarketSignalResult) {
  const saved = await tradingRequest<{ analysisId: string }>(session, "signals/save", { result }, AbortSignal.timeout(20_000));
  if (saved.analysisId !== result.analysisId) throw new Error("未收到本次分析的保存确认。");
}

export const listMarketSignals = (session: PrivateAuthSession, cursor?: string, signal?: AbortSignal) =>
  tradingRequest<{ entries: SavedSignalSummary[]; nextCursor: string | null }>(session, "signals/list", cursor ? { cursor } : {}, signal);

export async function getMarketSignal(session: PrivateAuthSession, analysisId: string, signal?: AbortSignal) {
  const { result } = await tradingRequest<{ result: unknown }>(session, "signals/get", { analysisId }, signal);
  if (!validResult(result) || result.analysisId !== analysisId || !result.market.chart) throw new Error("这条分析记录的行情数据不完整。");
  return result;
}

export const statusText: Record<SignalStatus, string> = { candidate: "候选机会 · 待确认触发条件", watch: "继续观察", none: "暂无机会", expired: "结果已过期 · 请重新分析" };

export const formatSignalDate = (time: number) => new Date(time).toLocaleString("zh-CN", { hour12: false });
