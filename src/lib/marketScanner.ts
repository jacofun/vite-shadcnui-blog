import type { PrivateAuthSession } from "@/lib/privateAuth";
import { getTradingFunctionTicket } from "@/lib/binanceSync";

type Decision = "passed" | "watch" | "filtered" | "none";
export interface ScanCheck { code: string; passed: boolean | null; value: number | string | null; expected: number | string | null }
export interface ScanRule {
  kind: "breakout" | "reclaim"; status: Decision; direction: "long" | "short" | null;
  zone: { id: string; lower: number; upper: number } | null; checks: ScanCheck[];
}
export type ScanAutoAnalysis =
  { status: "disabled" | "pending" | "duplicate" | "daily_limit" | "busy" | "stale" } |
  { status: "failed"; stage: string; errorCode: string } |
  { status: "completed"; analysisId: string };
export type ScanRecord = { id: string; time: number; scannedAt: number | null; candleClosedAt: number | null; symbol: "BTCUSDT"; rulesVersion: "v1"; autoAnalysis?: ScanAutoAnalysis } & (
  { status: "error"; errorCode: string } |
  { status: Decision; close: number; rvol20: number | null; trend4h: "up" | "down" | "flat"; rules: ScanRule[] }
);
export interface ScanPage { records: ScanRecord[]; from: number; to: number; next: string | null }
const period = 900000;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const time = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value < 8640000000000000;
const idFormat = /^[a-z0-9-]{1,60}$/;
const cursorFormat = /^\d{13}:[a-z0-9-]{0,60}$/;
const scalar = (value: unknown) => value === null || finite(value) || typeof value === "string" && value.length <= 80;
const decision = (value: unknown) => value === "passed" || value === "watch" || value === "filtered" || value === "none";
function validAutoAnalysis(value: unknown) {
  if (!object(value) || typeof value.status !== "string") return false;
  if (value.status === "completed") return typeof value.analysisId === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value.analysisId);
  if (value.status === "failed") return typeof value.stage === "string" && /^[a-z_]{1,40}$/.test(value.stage) &&
    typeof value.errorCode === "string" && /^[A-Z0-9_]{1,80}$/.test(value.errorCode);
  return ["disabled", "pending", "duplicate", "daily_limit", "busy", "stale"].includes(value.status);
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
function validRow(value: unknown): value is ScanRecord {
  if (!object(value) || typeof value.id !== "string" || !idFormat.test(value.id) || !time(value.time) ||
    !(value.scannedAt === null || value.scannedAt === value.time) || value.symbol !== "BTCUSDT" || value.rulesVersion !== "v1" ||
    !(value.candleClosedAt === null || time(value.candleClosedAt) && value.candleClosedAt % period === 0)) return false;
  if (value.status === "error") return typeof value.errorCode === "string" && /^[A-Z_]{1,80}$/.test(value.errorCode);
  return decision(value.status) && value.candleClosedAt !== null && finite(value.close) && value.close > 0 &&
    (value.autoAnalysis === undefined || value.status === "passed" && validAutoAnalysis(value.autoAnalysis)) &&
    (value.rvol20 === null || finite(value.rvol20) && value.rvol20 >= 0) &&
    (value.trend4h === "up" || value.trend4h === "down" || value.trend4h === "flat") &&
    Array.isArray(value.rules) && value.rules.length === 2 && value.rules.every(validRule);
}

export async function fetchMarketScans(session: PrivateAuthSession, before: string | undefined, signal: AbortSignal): Promise<ScanPage> {
  const ticket = await getTradingFunctionTicket(session, signal);
  const url = new URL("/trade/api/signal/scans", ticket.url.origin);
  const response = await fetch(url.href, {
    method: "POST", credentials: "omit", cache: "no-store", redirect: "error",
    headers: { "X-JWT-Token": `Bearer ${ticket.token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(before === undefined ? { version: 2 } : { version: 2, before }), signal: AbortSignal.any([AbortSignal.timeout(22000), signal]),
  });
  const payload: unknown = await response.json().catch(() => null);
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
