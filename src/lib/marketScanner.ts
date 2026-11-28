import type { PrivateAuthSession } from "@/lib/privateAuth";
import { getTradingFunctionTicket } from "@/lib/binanceSync";
import type { SignalStatus } from "@/lib/marketSignal";

type Decision = "passed" | "watch" | "filtered" | "none";
export interface ScanCheck { code: string; passed: boolean | null; value: number | string | null; expected: number | string | null }
export interface ScanRule {
  kind: "breakout" | "reclaim"; status: Decision; direction: "long" | "short" | null;
  zone: { id: string; lower: number; upper: number } | null; checks: ScanCheck[];
}
export type ScanAutoAnalysis =
  { status: "disabled" | "pending" | "duplicate" | "episode" | "reserved_quota" | "daily_limit" | "busy" | "stale" } |
  { status: "failed"; stage: string; errorCode: string } |
  { status: "completed"; analysisId: string };
interface MovementWindow {
  minutes: number; changePct: number; baselinePct: number | null; thresholdPct: number | null;
  severeAtPct: number; severity: "none" | "normal" | "severe"; volumeRatio: number | null;
}
interface Movement { closedAt: number; close: number; windows: MovementWindow[] }
type ScanTimes = { id: string; time: number; scannedAt: number | null; candleClosedAt: number | null; symbol: "BTCUSDT" };
export type LegacyScanRecord = ScanTimes & { kind?: never;
  rulesVersion: "v1" | "v2"; autoAnalysis?: ScanAutoAnalysis; movement?: Movement;
  trigger?: { kind: "movement" | "structure"; eventAt: number; direction: "long" | "short"; severe: boolean };
  movementErrorCode?: string; structureErrorCode?: string } & (
  { status: "error"; errorCode: string } |
  { status: Decision; close: number; rvol20: number | null; trend4h: "up" | "down" | "flat" | null; rules: ScanRule[] }
);
export type DeterministicScanRecord = ScanTimes & {
  kind: "deterministic"; candleClosedAt: number; candleInterval?: "5m" | "15m"; status: "triggered" | "no_trigger" | "daily_limit";
  m1?: { score: number; reasons: string[] }; close?: number; rvol20?: number | null; trend4h?: "up" | "down" | "flat";
  analysisId?: string; opportunityStatus?: SignalStatus; decisionReason?: string; exportAnalysisId?: string;
};
export const maxSelectedScans = 100;
export const maxScanExportRange = 7 * 24 * 60 * 60 * 1000;
export type ScanExportRequest = { analysisIds: string[] } | { from: number; to: number };
interface ScanExportResult { exportId: string; count: number; skippedCount: number; url: string }
const executionStates = ["blocked", "rejected", "unfilled", "filled", "partially_filled", "unknown", "unavailable"] as const;
export interface ScanExecution {
  state: (typeof executionStates)[number];
  reasonCode?: string; message?: string; clientId?: string; exchangeStatus?: string; exchangeCode?: number;
  executedQty?: string; requestedQty?: string; protection?: "pending" | "active" | "attention" | "closed" | "not_required";
}
export type ScanRecord = LegacyScanRecord | DeterministicScanRecord;
export interface ScanPage { records: ScanRecord[]; from: number; to: number; next: string | null }
const period = 900000;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const time = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value < 8640000000000000;
const idFormat = /^[a-z0-9-]{1,60}$/;
const analysisIdFormat = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const cursorFormat = /^\d{13}:[a-z0-9-]{0,60}$/;
const scalar = (value: unknown) => value === null || finite(value) || typeof value === "string" && value.length <= 80;
const decision = (value: unknown) => value === "passed" || value === "watch" || value === "filtered" || value === "none";
function validAutoAnalysis(value: unknown) {
  if (!object(value) || typeof value.status !== "string") return false;
  if (value.status === "completed") return typeof value.analysisId === "string" && analysisIdFormat.test(value.analysisId);
  if (value.status === "failed") return typeof value.stage === "string" && /^[a-z_]{1,40}$/.test(value.stage) &&
    typeof value.errorCode === "string" && /^[A-Z0-9_]{1,80}$/.test(value.errorCode);
  return ["disabled", "pending", "duplicate", "episode", "reserved_quota", "daily_limit", "busy", "stale"].includes(value.status);
}
function validRule(value: unknown) {
  return object(value) && (value.kind === "breakout" || value.kind === "reclaim") && decision(value.status) &&
    (value.direction === null || value.direction === "long" || value.direction === "short") &&
    (value.zone === null || object(value.zone) && typeof value.zone.id === "string" && value.zone.id.length <= 100 &&
      finite(value.zone.lower) && finite(value.zone.upper) && value.zone.lower > 0 && value.zone.lower <= value.zone.upper) &&
    Array.isArray(value.checks) && value.checks.length <= 8 && value.checks.every(check => object(check) &&
      typeof check.code === "string" && check.code.length <= 50 && (check.passed === null || typeof check.passed === "boolean") &&
      scalar(check.value) && scalar(check.expected));
}
function validLegacyRow(value: unknown): value is LegacyScanRecord {
  if (!object(value) || typeof value.id !== "string" || !idFormat.test(value.id) || !time(value.time) ||
    value.kind !== undefined || !(value.scannedAt === null || value.scannedAt === value.time) || value.symbol !== "BTCUSDT" ||
    (value.rulesVersion !== "v1" && value.rulesVersion !== "v2") ||
    !(value.candleClosedAt === null || time(value.candleClosedAt) && value.candleClosedAt % period === 0)) return false;
  if (value.status === "error") return typeof value.errorCode === "string" && /^[A-Z_]{1,80}$/.test(value.errorCode);
  const movement = value.movement;
  const trigger = value.trigger;
  const fresh = value.rulesVersion === "v2";
  const nonnegative = (n: unknown) => n === null || (finite(n) && n >= 0);
  if (movement !== undefined && (!fresh || !object(movement) || !time(movement.closedAt) || movement.closedAt % 60000 !== 0 ||
    !finite(movement.close) || movement.close <= 0 || !Array.isArray(movement.windows) || movement.windows.length !== 2 ||
    !movement.windows.every((row, i) => object(row) && row.minutes === (i === 0 ? 5 : 15) && finite(row.changePct) &&
      nonnegative(row.baselinePct) && nonnegative(row.thresholdPct) && finite(row.severeAtPct) && row.severeAtPct > 0 &&
      nonnegative(row.volumeRatio) && ["none", "normal", "severe"].includes(String(row.severity))))) return false;
  if (trigger !== undefined && (!fresh || value.status !== "passed" || !object(trigger) || !time(trigger.eventAt) ||
    !["long", "short"].includes(String(trigger.direction)) || typeof trigger.severe !== "boolean" ||
    (trigger.kind === "movement" ? !object(movement) || trigger.eventAt !== movement.closedAt :
      trigger.kind !== "structure" || trigger.eventAt !== value.candleClosedAt || trigger.severe))) return false;
  if (fresh && value.status === "passed" && trigger === undefined) return false;
  if (![value.movementErrorCode, value.structureErrorCode].every(code => code === undefined ||
    typeof code === "string" && /^[A-Z_]{1,80}$/.test(code))) return false;
  return decision(value.status) && (value.candleClosedAt !== null || (fresh && movement !== undefined)) && finite(value.close) && value.close > 0 &&
    (value.autoAnalysis === undefined || value.status === "passed" && validAutoAnalysis(value.autoAnalysis)) &&
    (value.rvol20 === null || finite(value.rvol20) && value.rvol20 >= 0) &&
    (value.trend4h === "up" || value.trend4h === "down" || value.trend4h === "flat" || (fresh && value.trend4h === null)) &&
    Array.isArray(value.rules) && (value.rules.length === 2 || (fresh && value.rules.length === 0)) && value.rules.every(validRule);
}

function validRow(value: unknown): value is ScanRecord {
  if (!object(value) || value.kind !== "deterministic") return validLegacyRow(value);
  const { id, symbol, candleClosedAt, candleInterval, scannedAt, status, m1, close, rvol20, trend4h, analysisId, opportunityStatus } = value;
  const duration = candleInterval === "5m" ? 300000 : period;
  return typeof id === "string" && idFormat.test(id) && symbol === "BTCUSDT" && time(value.time) &&
    (candleInterval === undefined || candleInterval === "15m" || candleInterval === "5m") &&
    time(candleClosedAt) && candleClosedAt % duration === 0 && candleClosedAt <= value.time && value.time < candleClosedAt + duration &&
    (scannedAt === value.time || scannedAt === null && value.time === candleClosedAt) &&
    (status === "triggered" || status === "no_trigger" || status === "daily_limit") &&
    (m1 === undefined || object(m1) && finite(m1.score) && m1.score >= 0 && m1.score <= 100 &&
      Array.isArray(m1.reasons) && m1.reasons.length <= 16 && m1.reasons.every(reason => typeof reason === "string" && /^[a-z_]{1,60}$/.test(reason))) &&
    (close === undefined || finite(close) && close > 0) &&
    (rvol20 === undefined || rvol20 === null || finite(rvol20) && rvol20 >= 0) &&
    (trend4h === undefined || trend4h === "up" || trend4h === "down" || trend4h === "flat") &&
    (value.exportAnalysisId === undefined || typeof value.exportAnalysisId === "string" && analysisIdFormat.test(value.exportAnalysisId) &&
      analysisIdFormat.test(id) && scannedAt !== null && (analysisId === undefined || value.exportAnalysisId === analysisId)) &&
    (value.decisionReason === undefined || typeof value.decisionReason === "string" && value.decisionReason.length <= 240 && analysisId !== undefined) &&
    (analysisId === undefined ? opportunityStatus === undefined : status === "triggered" && typeof analysisId === "string" &&
      analysisIdFormat.test(analysisId) && analysisIdFormat.test(id) && (opportunityStatus === "candidate" ||
        opportunityStatus === "watch" || opportunityStatus === "none" || opportunityStatus === "expired"));
}

export function parseBeijingScanTime(value: string): number {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? Date.parse(`${value}:00+08:00`) : NaN;
}

export async function exportMarketScans(session: PrivateAuthSession, input: ScanExportRequest, signal: AbortSignal): Promise<ScanExportResult> {
  const { token, url } = await getTradingFunctionTicket(session, signal);
  const response = await fetch(new URL("/trade/api/signal/scans", url.origin), {
    method: "POST", credentials: "omit", cache: "no-store", redirect: "error", signal,
    headers: { "X-JWT-Token": `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action: "export", ...input }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = object(payload) && object(payload.error) ? payload.error : {};
    const text = error.code === "INVALID_SCAN_CURSOR" ? "扫描导出接口尚未部署。" :
      typeof error.message === "string" ? error.message : `扫描导出失败（HTTP ${response.status}）`;
    throw new Error(text);
  }
  if (!object(payload)) throw new Error("导出清单回执格式无效。");
  const { exportId, count, skippedCount, url: link } = payload;
  const download = typeof link === "string" ? URL.parse(link) : null;
  if (typeof exportId !== "string" || !analysisIdFormat.test(exportId) || !finite(count) || !Number.isSafeInteger(count) || count < 1 ||
    !finite(skippedCount) || !Number.isSafeInteger(skippedCount) || skippedCount < 0 || !download ||
    download.origin !== "https://static.yanxiao.me" || download.username || download.password || download.search || download.hash ||
    !download.pathname.endsWith(`/.trading/owner/market-signals/records/trade-results/v1/exports/${exportId}.json`)) {
    throw new Error("导出清单回执格式无效。");
  }
  return { exportId, count, skippedCount, url: download.href };
}

export async function fetchScanExecution(session: PrivateAuthSession, analysisId: string, scanId: string, signal: AbortSignal): Promise<ScanExecution> {
  const { token, url } = await getTradingFunctionTicket(session, signal);
  const response = await fetch(new URL("/trade/api/signal/scans", url.origin), {
    method: "POST", credentials: "omit", cache: "no-store", redirect: "error", signal,
    headers: { "X-JWT-Token": `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ action: "execution", analysisId, scanId }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (response.status === 400 && object(payload) && object(payload.error) && payload.error.code === "INVALID_SCAN_CURSOR") return { state: "unavailable" };
  if (!response.ok || !object(payload) || !validExecution(payload.execution)) throw new Error("暂时无法读取自动开仓结果。");
  return payload.execution;
}

function validExecution(value: unknown): value is ScanExecution {
  if (!object(value) || !executionStates.some(state => value.state === state)) return false;
  const matches = (field: unknown, re: RegExp) => field === undefined || typeof field === "string" && re.test(field);
  const qty = /^\d{1,16}(?:\.\d{1,12})?$/;
  return matches(value.reasonCode, /^[a-zA-Z_]{1,80}$/) && matches(value.clientId, /^mse[a-f0-9]{30}$/) &&
    matches(value.exchangeStatus, /^[A-Z_]{2,32}$/) && matches(value.protection, /^(pending|active|attention|closed|not_required)$/) &&
    matches(value.executedQty, qty) && matches(value.requestedQty, qty) &&
    (value.message === undefined || typeof value.message === "string" && value.message.length <= 240) &&
    (value.exchangeCode === undefined || finite(value.exchangeCode) && Number.isSafeInteger(value.exchangeCode) && value.exchangeCode < 0);
}

export async function fetchMarketScans(session: PrivateAuthSession, before: string | undefined, signal: AbortSignal): Promise<ScanPage> {
  const ticket = await getTradingFunctionTicket(session, signal);
  const url = new URL("/trade/api/signal/scans", ticket.url.origin);
  const deadline = AbortSignal.any([AbortSignal.timeout(22000), signal]);
  const request = (version: number) => fetch(url.href, {
    method: "POST", credentials: "omit", cache: "no-store", redirect: "error",
    headers: { "X-JWT-Token": `Bearer ${ticket.token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(before === undefined ? { version } : { version, before }), signal: deadline,
  });
  let version = 5;
  let response = await request(version);
  let payload: unknown = await response.json().catch(() => null);
  while (version > 2 && response.status === 400 && object(payload) && object(payload.error) && payload.error.code === "INVALID_SCAN_CURSOR") {
    version--;
    response = await request(version);
    payload = await response.json().catch(() => null);
  }
  if (!response.ok) {
    const error = object(payload) && object(payload.error) ? payload.error : {};
    const requestId = object(payload) && typeof payload.requestId === "string" ? `（请求编号 ${payload.requestId}）` : "";
    throw new Error((typeof error.message === "string" ? error.message : `扫描记录读取失败（HTTP ${response.status}）`) + requestId);
  }
  if (!object(payload) || !time(payload.from) || !time(payload.to) || payload.from > payload.to ||
    !(payload.next === null || typeof payload.next === "string" && cursorFormat.test(payload.next) && payload.next !== before) || !Array.isArray(payload.records) || payload.records.length > 16 ||
    !payload.records.every(validRow)) throw new Error("扫描记录格式无效。");
  const { records, from, to, next } = payload;
  if (records.some((record, i) => record.time < from || record.time > to || i > 0 &&
    (record.time > records[i - 1].time || record.time === records[i - 1].time && record.id >= records[i - 1].id))) {
    throw new Error("扫描记录时段无效。");
  }
  return { records, from, to, next };
}
