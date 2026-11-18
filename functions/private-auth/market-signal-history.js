import { TradeError } from "./trading.js";

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const SYMBOL = /^[A-Z0-9]{3,24}USDT$/;
const STATUSES = ["candidate", "watch", "none", "expired"];
const PERIOD_MS = { "4h": 14_400_000, "1h": 3_600_000, "15m": 900_000 };
const MAX_TIMESTAMP = 9_999_999_999_999;
const isTime = (value) => Number.isSafeInteger(value) && value > 0 && value <= MAX_TIMESTAMP;
const isText = (value) => typeof value === "string" && value.length > 0 && value.length <= 1000;
const positive = (value) => Number.isFinite(value) && value > 0;
const invalid = () => { throw new TradeError(400, "INVALID_SIGNAL_HISTORY", "分析结果或行情快照不完整。"); };

function validChart(frames, asOf) {
  return Array.isArray(frames) && frames.length === 3 && Object.keys(PERIOD_MS).every(interval => {
    const candles = frames.find(frame => frame?.interval === interval)?.candles;
    const period = PERIOD_MS[interval];
    if (!Array.isArray(candles) || candles.length < 60 || candles.length > 200) return false;
    const lastOpen = Math.floor(asOf / period) * period - period;
    return candles.every((row, index) => {
      if (!Array.isArray(row) || row.length !== 7) return false;
      const [time, open, high, low, close, volume, takerBuy] = row;
      return time === lastOpen - (candles.length - 1 - index) * period && isTime(time) &&
        [open, high, low, close].every(positive) && low <= Math.min(open, close) && high >= Math.max(open, close) &&
        Number.isFinite(volume) && Number.isFinite(takerBuy) && volume >= 0 && takerBuy >= 0 && takerBuy <= volume + 1e-8;
    });
  });
}

const strings = (values) => Array.isArray(values) && values.length <= 20 && values.every(isText);
function validateResult(result) {
  const { analysisId, symbol, status, style, market, opportunity, timing, model } = result || {};
  if (result?.schemaVersion !== 1 || typeof analysisId !== "string" || !UUID.test(analysisId) ||
      typeof symbol !== "string" || !SYMBOL.test(symbol) || !STATUSES.includes(status) ||
      !["trend", "reversal", "neutral"].includes(style) || !isText(result.requestId) || !isText(result.codeVersion) ||
      !isText(model?.name) || !isText(model?.promptVersion) || !isTime(market?.asOf) || !positive(market?.latestQuote?.price) ||
      !isTime(market?.latestQuote?.time) || !strings(market.warnings) || !isTime(timing?.completedAt) || !isTime(timing?.validUntil) ||
      ![timing.totalMs, timing.marketMs, timing.modelMs, timing.verificationMs].every(value => Number.isFinite(value) && value >= 0) ||
      !isText(opportunity?.title) || !isText(opportunity?.summary) || opportunity.status !== status ||
      !["long", "short", null].includes(opportunity.direction) || opportunity.triggerVerified !== false || opportunity.priceReference !== "markPrice" ||
      ![opportunity.triggerConditions, opportunity.invalidationConditions, opportunity.counterarguments, opportunity.expiredReasons].every(strings) ||
      !Array.isArray(opportunity.evidence) || opportunity.evidence.length > 8 || !opportunity.evidence.every(e => isText(e?.metric) && isText(e?.reason)) ||
      !Array.isArray(opportunity.targets) || opportunity.targets.length > 3 || !opportunity.targets.every(t => positive(t?.price) && isText(t?.reason)) ||
      !Array.isArray(opportunity.rewardRisk) || opportunity.rewardRisk.length !== opportunity.targets.length ||
      !opportunity.rewardRisk.every(r => positive(r?.target) && (r.ratio === null || Number.isFinite(r.ratio) && r.ratio >= 0)) ||
      !validChart(market.chart, market.asOf)) invalid();
  const { direction, entry, stopLoss, targets } = opportunity;
  if (direction === null) {
    if (entry !== null || stopLoss !== null || targets.length || !["none", "expired"].includes(status)) invalid();
  } else if (!positive(entry?.min) || !positive(entry?.max) || entry.min > entry.max || !positive(stopLoss) || !targets.length || status === "none") invalid();
}

export async function handleMarketSignalHistory({ route, body, user, config, contentStore }) {
  if (user.role !== "owner") throw new TradeError(403, "MISSING_PERMISSION", "分析历史仅限站点所有者。");
  if (!contentStore) throw new TradeError(503, "CONTENT_STORE_UNAVAILABLE", "分析历史存储暂不可用。");
  const root = `${config.privateRoot}/.trading/owner/market-signals`;
  if (route === "trading/signals/save") {
    const { result } = body;
    validateResult(result);
    const { analysisId, symbol, status, style, opportunity, timing } = result;
    const completedAt = timing.completedAt;
    const inverseTime = String(MAX_TIMESTAMP - completedAt).padStart(13, "0");
    // Both objects are immutable. Retrying after a partial write completes the listing entry.
    await contentStore.putJsonOnce(`${root}/records/${analysisId}.json`, result);
    await contentStore.putJsonOnce(`${root}/index/${inverseTime}-${analysisId}.json`, {
      analysisId, symbol, status, style, completedAt, title: opportunity.title,
    });
    return { analysisId };
  }
  if (route === "trading/signals/get") {
    if (typeof body.analysisId !== "string" || !UUID.test(body.analysisId)) invalid();
    const result = await contentStore.readJson(`${root}/records/${body.analysisId}.json`, { missing: null });
    if (!result) throw new TradeError(404, "SIGNAL_NOT_FOUND", "分析记录不存在。");
    return { result };
  }
  if (route === "trading/signals/list") {
    const { cursor } = body;
    if (cursor !== undefined && (typeof cursor !== "string" || !cursor.length || cursor.length > 2048)) invalid();
    const { paths, nextCursor } = await contentStore.listJsonPaths(`${root}/index/`, { cursor, limit: 12 });
    const entries = await Promise.all(paths.map(path => contentStore.readJson(path)));
    return { entries, nextCursor };
  }
  throw new TradeError(404, "NOT_FOUND", "分析历史接口不存在。");
}
