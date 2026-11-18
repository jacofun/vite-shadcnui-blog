import type { PrivateAuthSession } from "@/lib/privateAuth";
import { getTradingFunctionTicket } from "@/lib/binanceSync";

export type SignalStyle = "trend" | "reversal" | "neutral";
export type SignalStatus = "candidate" | "watch" | "none" | "expired";
export interface MarketSignalResult {
  schemaVersion: 1;
  requestId: string;
  analysisId: string;
  codeVersion: string;
  symbol: string;
  style: SignalStyle;
  status: SignalStatus;
  opportunity: {
    status: SignalStatus; title: string; summary: string; direction: "long" | "short" | null;
    entry: { min: number; max: number } | null; stopLoss: number | null;
    targets: { price: number; reason: string }[];
    rewardRisk: { target: number; ratio: number | null }[];
    triggerConditions: string[]; invalidationConditions: string[];
    evidence: { metric: string; reason: string }[]; counterarguments: string[];
    expiredReasons: string[]; triggerVerified: false; priceReference: "markPrice";
  };
  market: { latestQuote: { price: number; time: number }; warnings: string[] };
  timing: { completedAt: number; validUntil: number; totalMs: number; marketMs: number; modelMs: number; verificationMs: number };
  model: { name: string };
}

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 1000;
const number = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const price = (v: unknown): v is number => number(v) && v > 0;
const texts = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 20 && v.every(text);
function validResult(value: unknown): value is MarketSignalResult {
  if (!record(value) || value.schemaVersion !== 1 || !text(value.requestId) || !text(value.analysisId) || !text(value.codeVersion) ||
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
  if (value.status !== "none" && value.status !== "expired" && (p.direction === null || p.entry === null || p.stopLoss === null || !p.targets.length)) return false;
  return record(market) && record(market.latestQuote) && price(market.latestQuote.price) && number(market.latestQuote.time) && texts(market.warnings) &&
    record(timing) && [timing.completedAt, timing.validUntil, timing.totalMs, timing.marketMs, timing.modelMs, timing.verificationMs].every(number) &&
    record(model) && text(model.name);
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
