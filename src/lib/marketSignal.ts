import type { PrivateAuthSession } from "@/lib/privateAuth";
import { validResearchV4 } from "../../functions/private-auth/market-research-contract.js";
import { getTradingFunctionTicket } from "@/lib/binanceSync";

export type SignalStyle = "trend" | "reversal" | "neutral";
export type SignalStatus = "candidate" | "watch" | "none" | "expired";
export type SignalInterval = "4h" | "1h" | "15m";
export type SignalCandle = [openTimeMs: number, open: number, high: number, low: number, close: number, volume: number, takerBuyVolume: number];
export interface SignalChartFrame { interval: SignalInterval; candles: SignalCandle[] }
export type ResearchHours = 4 | 12 | 24;
export interface SignalPriceZone {
  id: string; interval: SignalInterval; kind: "support" | "resistance"; status: "active" | "broken" | "retested";
  lower: number; upper: number; touches: number; lastTouchTime: number; firstPivotTime: number; confirmedAt: number;
  pivotCount: number; breakTime: number | null; lastRetestTime: number | null; lastRetestRvol20: number | null; breakRvol20: number | null; closesBeyondBreak: number | null; atrAtConfirmation: number;
  reactions: { time: number; closeClv: number | null; rvol20: number | null; moveAtr: number | null }[];
}
type Comparison = "within_p50" | "p50_to_p75" | "p75_to_p90" | "above_p90";
export interface SignalResearch {
  marketRegime: "trend" | "range" | "transition";
  scenario: "continuation" | "reversal" | "none";
  researchHorizon: ResearchHours;
  timeframeAnalysis: Record<SignalInterval, string>;
  priceZones: SignalPriceZone[];
  entryZoneId: string | null;
  stopZoneId: string | null;
  riskFactors: string[];
  targetAssessment: { price: number; zoneId: string; distance: number; distancePct: number; atr14Multiple: number | null;
    obstacles: string[]; rewardRisk: number; historical: { interval: "1h"; samples: number; bars: number; favorableMovePct: { p50: number; p75: number; p90: number } | null } | null;
    comparison: Comparison | null }[];
  ruleAssessment: {
    trendAlignment: "up" | "down" | "mixed" | "conflict";
    structure: { confirmedZones: number; repeatedZones: number; activeSupport: number; activeResistance: number; clarity: "defined" | "developing" | "limited" };
    volumePrice: { supportingBars: number; opposingBars: number } | null;
    invalidation: { zoneId: string; riskDistance: number; riskAtr14: number | null } | null;
  };
}
interface BaseSignalResult {
  requestId: string;
  analysisId: string;
  codeVersion: string;
  symbol: string;
  style: SignalStyle;
  status: SignalStatus;
  opportunity: {
    status: SignalStatus; title: string; summary: string; direction: "long" | "short" | null;
    entry: { min: number; max: number } | null; stopLoss: number | null;
    targets: { price: number; reason: string; zoneId?: string }[];
    validForSeconds?: number;
    rewardRisk: { target: number; ratio: number | null }[];
    triggerConditions: string[]; invalidationConditions: string[];
    evidence: { metric: string; reason: string }[]; counterarguments: string[];
    expiredReasons: string[]; triggerVerified: false; priceReference: "markPrice";
  };
  market: { asOf?: number; tickSize?: number; chart?: SignalChartFrame[]; latestQuote: { price: number; time: number }; warnings: string[] };
  timing: { completedAt: number; validUntil: number; totalMs: number; marketMs: number; modelMs: number; verificationMs: number };
  model: { name: string; promptVersion?: string };
}

export type MarketSignalResult = BaseSignalResult & (
  { schemaVersion: 1; research?: never } | { schemaVersion: 4; research: SignalResearch }
);

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 1000;
const number = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const price = (v: unknown): v is number => number(v) && v > 0;
const texts = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 20 && v.every(text);
const signalIntervals = ["4h", "1h", "15m"] as const;
function validChart(value: unknown): value is SignalChartFrame[] {
  return Array.isArray(value) && value.length === signalIntervals.length && signalIntervals.every(interval => {
    const candles: unknown = value.find(frame => record(frame) && frame.interval === interval)?.candles;
    if (!Array.isArray(candles) || candles.length < 60 || candles.length > 200) return false;
    let previous = 0;
    for (const row of candles) {
      if (!Array.isArray(row) || row.length !== 7) return false;
      const [time, open, high, low, close, volume, takerBuy] = row;
      if (!Number.isSafeInteger(time) || time <= previous || ![open, high, low, close].every(price) ||
          low > Math.min(open, close) || high < Math.max(open, close) || !number(volume) || !number(takerBuy) ||
          volume < 0 || takerBuy < 0 || takerBuy > volume + 1e-8) return false;
      previous = time;
    }
    return true;
  });
}
export function validResult(value: unknown): value is MarketSignalResult {
  if (!record(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 4) || !text(value.requestId) || !text(value.analysisId) || !text(value.codeVersion) ||
    !text(value.symbol) || !["trend", "reversal", "neutral"].includes(String(value.style)) ||
    !["candidate", "watch", "none", "expired"].includes(String(value.status))) return false;
  const { opportunity: p, market, timing, model } = value;
  if (!record(p) || p.status !== value.status || !text(p.title) || !text(p.summary) ||
    !["long", "short", null].includes(p.direction as string | null) || p.triggerVerified !== false || p.priceReference !== "markPrice" ||
    !(p.entry === null || record(p.entry) && price(p.entry.min) && price(p.entry.max) && p.entry.min <= p.entry.max) ||
    !(p.stopLoss === null || price(p.stopLoss)) ||
    !Array.isArray(p.targets) || p.targets.length > 3 || !p.targets.every(t => record(t) && price(t.price) && text(t.reason)) ||
    !Array.isArray(p.rewardRisk) || p.rewardRisk.length !== p.targets.length || !p.rewardRisk.every(t => record(t) && price(t.target) && (t.ratio === null || number(t.ratio) && t.ratio >= 0)) ||
    !Array.isArray(p.evidence) || p.evidence.length > 8 || !p.evidence.every(e => record(e) && text(e.metric) && text(e.reason)) ||
    ![p.triggerConditions, p.invalidationConditions, p.counterarguments, p.expiredReasons].every(texts)) return false;
  if (p.direction === null && (p.entry !== null || p.stopLoss !== null || p.targets.length)) return false;
  if (p.direction === null && (value.status === "candidate" || value.schemaVersion === 1 && value.status === "watch")) return false;
  if (p.direction !== null && (value.status === "none" || p.entry === null || p.stopLoss === null || !p.targets.length)) return false;
  return record(market) && record(market.latestQuote) && price(market.latestQuote.price) && number(market.latestQuote.time) && texts(market.warnings) &&
    (market.chart === undefined || number(market.asOf) && validChart(market.chart)) &&
    record(timing) && [timing.completedAt, timing.validUntil, timing.totalMs, timing.marketMs, timing.modelMs, timing.verificationMs].every(number) &&
    record(model) && text(model.name) && (value.schemaVersion === 1 || validResearchV4(value));
}

export async function analyzeMarketOpportunity(session: PrivateAuthSession, input: { symbol: string; style: SignalStyle }, signal?: AbortSignal): Promise<MarketSignalResult> {
  const ticket = await getTradingFunctionTicket(session, signal);
  // Only replace the path after validating the ticket's trusted HTTPS origin.
  const url = new URL("/trade/api/signal/analyze", ticket.url.origin);
  let response: Response;
  try {
    response = await fetch(url.href, {
      method: "POST", credentials: "omit", cache: "no-store", redirect: "error",
      headers: { "X-JWT-Token": `Bearer ${ticket.token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.any([AbortSignal.timeout(115_000), ...(signal ? [signal] : [])]),
    });
  } catch {
    if (signal?.aborted) throw new DOMException("分析已取消", "AbortError");
    throw new Error("分析连接中断或超时，请检查交易信号函数及 CDN 回源超时设置。本次没有自动重试。");
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = record(payload) ? payload : {};
    const error = record(body.error) ? body.error : body;
    const message = error.message ?? body.Message;
    const code = error.code ?? body.Code;
    const requestId = body.requestId ?? body.RequestId;
    throw new Error(`${text(message) ? message : "分析请求失败"}${text(code) ? `（${code}）` : `（HTTP ${response.status}）`}${text(requestId) ? `；请求编号：${requestId}` : ""}`);
  }
  if (!validResult(payload) || payload.symbol !== input.symbol || payload.style !== input.style) {
    throw new Error("交易信号函数未返回完整的分析结果，请检查 CDN 路由及函数日志。");
  }
  return payload;
}
