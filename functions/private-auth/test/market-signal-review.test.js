import test from "node:test";
import assert from "node:assert/strict";
import { validResearchV4 } from "../market-research-contract.js";
import { handleMarketSignalHistory } from "../market-signal-history.js";
import { createReviewTimer } from "../market-signal-review-timer.js";
import {
  MINUTE, drainSignalReviews, enqueueSignalReviews, evaluateSignal, loadMarkCandles,
  parseMarkCandles, reviewBounds, reviewDue, signalHistoryRoot,
} from "../market-signal-review.js";

const AT = Date.UTC(2026, 10, 19);
const ID = "bea1cf13-c725-4786-a06c-ec6d42ea890c";
const root = signalHistoryRoot("/private");
const periods = { "4h": 240 * MINUTE, "1h": 60 * MINUTE, "15m": 15 * MINUTE };
const makeZone = (kind, lower, upper) => ({
  id: `1h:${kind}:${AT - 5 * periods["1h"]}`, interval: "1h", kind, lower, upper, status: "active", touches: 1, pivotCount: 1,
  firstPivotTime: AT - 5 * periods["1h"], lastTouchTime: AT - 5 * periods["1h"], confirmedAt: AT - 2 * periods["1h"],
  breakTime: null, breakRvol20: null, lastRetestTime: null, lastRetestRvol20: null, closesBeyondBreak: null, atrAtConfirmation: 3, reactions: [],
});
const support = makeZone("support", 99, 101);
const targetZone = makeZone("resistance", 110, 112);
const farZone = { ...makeZone("resistance", 130, 132), firstPivotTime: AT - 4 * periods["1h"], id: `1h:resistance:${AT - 4 * periods["1h"]}`,
  lastTouchTime: AT - 4 * periods["1h"] };

function analysis(completedAt = AT + 500, id = ID) {
  const zones = [support, targetZone, farZone];
  const targets = [targetZone, farZone].map(zone => ({ zoneId: zone.id, price: zone.lower + 0.5, reason: "确认结构" }));
  const targetAssessment = targets.map(target => ({ zoneId: target.zoneId, price: target.price, distance: target.price - 101,
    distancePct: (target.price / 101 - 1) * 100, atr14Multiple: (target.price - 101) / 3, rewardRisk: (target.price - 101) / 3,
    obstacles: [], historical: { interval: "1h", samples: 12, bars: 4, favorableMovePct: { p50: 2, p75: 3, p90: 5 } }, comparison: "above_p90",
  }));
  return {
    schemaVersion: 4, analysisId: id, symbol: "BTCUSDT", style: "trend", status: "candidate", requestId: "request", codeVersion: "commit",
    model: { name: "kimi-k3.1-pro", promptVersion: "market-research-v4" },
    market: { asOf: AT, tickSize: 0.1, chart: Object.entries(periods).map(([interval, period]) => ({
      interval, candles: Array.from({ length: 200 }, (_, i) => [AT - (200 - i) * period, 100, 102, 98, 100, 10, 4]),
    })), latestQuote: { time: completedAt, price: 100 }, warnings: [] },
    timing: { completedAt, validUntil: completedAt + 30_000, totalMs: 500, marketMs: 200, modelMs: 200, verificationMs: 100 },
    opportunity: { title: "候选", summary: "等待确认", status: "candidate", validForSeconds: 30, direction: "long", triggerVerified: false, priceReference: "markPrice",
      entry: { min: 99, max: 101 }, stopLoss: 98, targets, rewardRisk: targetAssessment.map(row => ({ target: row.price, ratio: row.rewardRisk })),
      evidence: [], counterarguments: [], triggerConditions: [], invalidationConditions: [], expiredReasons: [] },
    research: { marketRegime: "trend", scenario: "continuation", researchHorizon: 4,
      timeframeAnalysis: { "4h": "背景", "1h": "结构", "15m": "量价" }, entryZoneId: support.id, stopZoneId: support.id, riskFactors: [],
      priceZones: zones, targetAssessment,
      ruleAssessment: { trendAlignment: "up", structure: { confirmedZones: 3, repeatedZones: 0, activeSupport: 1, activeResistance: 2, clarity: "developing" },
        volumePrice: { supportingBars: 2, opposingBars: 0 }, invalidation: { zoneId: support.id, riskDistance: 3, riskAtr14: 1 },
        targetSpace: targetAssessment.map(row => ({ zoneId: row.zoneId, obstacleCount: 0, historicalComparison: row.comparison })),
        riskReward: targetAssessment.map(row => ({ zoneId: row.zoneId, rewardRisk: row.rewardRisk })) },
    },
  };
}

function markCandles(result, hours) {
  const { observedFrom, observedUntil } = reviewBounds(result.timing.completedAt, hours);
  return Array.from({ length: (observedUntil - observedFrom) / MINUTE }, (_, i) =>
    [observedFrom + i * MINUTE, 100, i === 5 ? 112 : 105, i === 5 ? 95 : 100, 102]);
}

function fakeStore() {
  const objects = new Map();
  const store = {
    objects, pages: 0, reads: [],
    async putJsonOnce(path, value) {
      if (objects.has(path) && JSON.stringify(objects.get(path)) !== JSON.stringify(value)) {
        throw Object.assign(new Error("conflict"), { statusCode: 409, code: "RESOURCE_EXISTS" });
      }
      objects.set(path, structuredClone(value));
    },
    async readJson(path, { missing } = {}) {
      store.reads.push(path);
      return structuredClone(objects.has(path) ? objects.get(path) : missing);
    },
    async listJsonPaths(prefix, { cursor, limit }) {
      store.pages++;
      const paths = [...objects.keys()].filter(path => path.startsWith(prefix) && (!cursor || path > cursor)).sort();
      return { paths: paths.slice(0, limit), nextCursor: paths.length > limit ? paths[limit - 1] : null };
    },
    async deletePaths(paths) { for (const path of paths) objects.delete(path); },
  };
  return store;
}
const history = (store, route, body = {}, user = { role: "owner" }) =>
  handleMarketSignalHistory({ route: `trading/signals/${route}`, body, user, config: { privateRoot: "/private" }, contentStore: store, now: AT + MINUTE });

test("mark price review uses full UTC minutes, measures both extrema and records first target intersection only", () => {
  const result = analysis();
  const bars = markCandles(result, 4);
  const actual = evaluateSignal(result, 4, bars);
  assert.equal(actual.status, "completed");
  assert.equal(actual.priceSource, "markPrice");
  assert.equal(actual.referencePrice, 100);
  assert.equal(actual.observedFrom, AT + MINUTE);
  assert.equal(actual.observedUntil, AT + 4 * 60 * MINUTE);
  assert.equal(actual.candles.length, 239);
  assert.equal(actual.endPrice, 102);
  assert.equal(actual.high, 112);
  assert.equal(actual.low, 95);
  assert.equal(actual.directionAligned, true);
  assert.ok(Math.abs(actual.mfePct - 12) < 1e-10);
  assert.ok(Math.abs(actual.maePct - 5) < 1e-10);
  assert.deepEqual(actual.targets.map(t => [t.touched, t.firstTouchMinute]), [[true, AT + 6 * MINUTE], [false, null]]);
  // The same minute includes both the stop price and target band. No execution order is inferred.
  for (const key of ["profit", "outcome", "stopFirst", "entryFilled", "winner"]) assert.equal(Object.hasOwn(actual, key), false);
  result.opportunity.direction = "short";
  assert.equal(evaluateSignal(result, 4, bars).directionAligned, false);
  assert.ok(Math.abs(evaluateSignal(result, 4, bars).mfePct - 5) < 1e-10);
  result.opportunity.direction = null; result.opportunity.targets = [];
  assert.equal(evaluateSignal(result, 4, bars).mfePct, null);
});

test("closed mark-price endpoint is fixed, bounded and rejects missing, duplicated and malformed candles", async () => {
  const result = analysis(AT);
  const bars = markCandles(result, 24);
  const raw = bars.map(([ts, ...prices]) => [ts, ...prices.map(String), "0", ts + MINUTE - 1]);
  assert.equal(bars.length, 1440);
  const bounds = reviewBounds(AT, 24);
  assert.deepEqual(parseMarkCandles(raw, bounds), bars);
  assert.throws(() => parseMarkCandles(raw.slice(1), bounds), { code: "DATA_GAP" });
  const duplicate = raw.slice(); duplicate[1] = duplicate[0];
  assert.throws(() => parseMarkCandles(duplicate, bounds), { code: "DATA_GAP" });
  const bad = structuredClone(raw); bad[0][2] = "NaN";
  assert.throws(() => parseMarkCandles(bad, bounds), { code: "INVALID_MARKET_DATA" });
  await loadMarkCandles(result, 24, { fetchImpl: async (url, request) => {
    assert.equal(url.origin, "https://fapi.binance.com");
    assert.equal(url.pathname, "/fapi/v1/markPriceKlines");
    assert.equal(url.searchParams.get("interval"), "1m");
    assert.equal(url.searchParams.get("startTime"), String(AT));
    assert.equal(url.searchParams.get("endTime"), String(bounds.observedUntil - 1));
    assert.equal(url.searchParams.get("limit"), "1440");
    assert.equal(request.redirect, "error");
    assert.equal(request.headers, undefined);
    return new Response(JSON.stringify(raw));
  } });
  await assert.rejects(loadMarkCandles(result, 24, { fetchImpl: async () => new Response("hidden upstream", { status: 429 }) }), { code: "MARKET_RATE_LIMITED" });
  await assert.rejects(loadMarkCandles(result, 24, { fetchImpl: async () => new Response("x".repeat(600_000)) }), { code: "INVALID_MARKET_DATA" });
});

test("only owners can archive V4, schema is checked, and partial writes can be repaired by repeating save", async () => {
  const store = fakeStore();
  const result = analysis();
  assert.equal(validResearchV4(result), true);
  await assert.rejects(history(store, "save", { result }, { role: "guest" }), { code: "MISSING_PERMISSION" });
  await assert.rejects(history(store, "get", { analysisId: ID }, { role: "guest" }), { code: "MISSING_PERMISSION" });
  await assert.rejects(history(store, "list", {}, { role: "guest" }), { code: "MISSING_PERMISSION" });
  assert.equal(store.objects.size, 0);
  const invalid = structuredClone(result);
  invalid.opportunity.targets[0].zoneId = "unsupported";
  await assert.rejects(history(store, "save", { result: invalid }), { code: "INVALID_SIGNAL_HISTORY" });
  const put = store.putJsonOnce;
  let fail = true;
  store.putJsonOnce = async (path, data) => {
    if (fail && path.includes("/review-queue/") && path.includes("-12h-")) { fail = false; throw new Error("interrupted queue write"); }
    return put(path, data);
  };
  await assert.rejects(history(store, "save", { result }), /interrupted/);
  assert.equal((await history(store, "list")).entries.length, 0);
  await history(store, "save", { result });
  await history(store, "save", { result });
  assert.equal(store.objects.size, 6);
  const entry = (await history(store, "list")).entries[0];
  assert.equal(entry.direction, "long");
  assert.deepEqual(entry.reviews.map(r => r.status), ["pending", "pending", "pending"]);
  assert.deepEqual((await history(store, "get", { analysisId: ID })).result, result);
  assert.ok(!JSON.stringify(entry).includes("candles"));
});

test("a revised V4 prompt and decision trace can be saved, listed and loaded through analysis history", async () => {
  const store = fakeStore();
  const result = analysis();
  result.status = "watch";
  result.model.promptVersion = "market-research-v4-volume-timing-v5";
  result.decision = { modelStatus: "candidate", modelDirection: "short", modelSummary: "空头候选",
    reasons: [{ code: "entry_missing", message: "模型未提供入场区间。" }] };
  Object.assign(result.opportunity, { status: "watch", direction: null, entry: null, stopLoss: null, targets: [], rewardRisk: [] });
  Object.assign(result.research, { scenario: "none", entryZoneId: null, stopZoneId: null, targetAssessment: [] });
  Object.assign(result.research.ruleAssessment, { volumePrice: null, invalidation: null, targetSpace: [], riskReward: [] });
  assert.deepEqual(await history(store, "save", { result }), { analysisId: ID });
  const { entries } = await history(store, "list");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].status, "watch");
  assert.equal(entries[0].direction, null);
  const detail = await history(store, "get", { analysisId: ID });
  assert.deepEqual(detail.result, result);
  assert.deepEqual(detail.reviews.map(r => r.status), ["pending", "pending", "pending"]);
});

test("timer drains only due windows, reports to separate objects and repairs report/index/cleanup failures without refetch", async () => {
  const store = fakeStore();
  const result = analysis();
  await history(store, "save", { result });
  const due = reviewDue(result.timing.completedAt, 4);
  let requests = 0;
  const getCandles = async (source, hours) => { requests++; return markCandles(source, hours); };
  assert.deepEqual(await drainSignalReviews({ store, root, now: due - 1, getCandles }), { completed: 0, insufficient: 0, retried: 0, failed: 0 });
  const put = store.putJsonOnce;
  let fail = true;
  store.putJsonOnce = async (path, value) => {
    if (fail && path.includes("/review-index/")) { fail = false; throw new Error("index unavailable"); }
    return put(path, value);
  };
  assert.equal((await drainSignalReviews({ store, root, now: due, getCandles })).failed, 1);
  assert.equal(requests, 1);
  const del = store.deletePaths;
  fail = true;
  store.putJsonOnce = put;
  store.deletePaths = async paths => { if (fail) { fail = false; throw new Error("cleanup unavailable"); } return del(paths); };
  assert.equal((await drainSignalReviews({ store, root, now: due, getCandles })).failed, 1);
  assert.equal((await drainSignalReviews({ store, root, now: due, getCandles })).completed, 1);
  assert.equal((await drainSignalReviews({ store, root, now: due, getCandles })).completed, 0);
  assert.equal(requests, 1);
  await history(store, "save", { result });
  const detail = await history(store, "get", { analysisId: ID });
  assert.deepEqual(detail.result, result);
  assert.deepEqual(detail.reviews.map(r => r.status), ["completed", "pending", "pending"]);
  const entry = (await history(store, "list")).entries[0];
  assert.deepEqual(entry.reviews[0].targets.map(t => t.touched), [true, false]);
  assert.equal(entry.reviews[0].candles, undefined);
  for (const hours of [12, 24]) {
    const now = reviewDue(result.timing.completedAt, hours);
    assert.equal((await drainSignalReviews({ store, root, now, getCandles })).completed, 1);
  }
  const complete = await history(store, "get", { analysisId: ID });
  assert.deepEqual(complete.reviews.map(r => r.candles.length), [239, 719, 1439]);
  assert.equal(requests, 3);
});

test("pagination drains due jobs and bounded retries yield an explicit insufficient outcome", async () => {
  const store = fakeStore();
  const result = analysis();
  for (let i = 0; i < 10; i++) {
    await history(store, "save", { result: { ...result, analysisId: ID.slice(0, -2) + String(i).padStart(2, "0") } });
  }
  const due = reviewDue(result.timing.completedAt, 4);
  const getCandles = async () => { throw Object.assign(new Error("sensitive upstream"), { code: "DATA_GAP" }); };
  const events = [];
  const run = now => drainSignalReviews({ store, root, now, getCandles, log: value => events.push(value) });
  assert.equal((await run(due)).retried, 10);
  assert.ok(store.pages >= 2);
  assert.equal((await run(due + 4 * MINUTE)).retried, 0);
  await history(store, "save", { result: { ...result, analysisId: ID.slice(0, -2) + "00" } });
  assert.equal((await run(due + 4 * MINUTE)).retried, 0);
  let next = due;
  for (const delay of [5, 15, 60]) {
    next += delay * MINUTE;
    assert.equal((await run(next)).retried, 10);
  }
  next += 240 * MINUTE;
  assert.equal((await run(next)).insufficient, 10);
  assert.ok(!JSON.stringify(events).includes("sensitive"));
  const detail = await history(store, "get", { analysisId: ID.slice(0, -2) + "00" });
  assert.equal(detail.reviews[0].code, "DATA_GAP");
  assert.equal(detail.reviews[0].candles, undefined);
});

test("duplicate timer invocations preserve one result and a stale reference cannot produce conclusions", async () => {
  const store = fakeStore();
  const result = analysis();
  await history(store, "save", { result });
  let requests = 0;
  const now = reviewDue(result.timing.completedAt, 4);
  const getCandles = async (source, hours) => {
    const rows = markCandles(source, hours);
    rows.at(-1)[4] += ++requests / 10;
    return rows;
  };
  await Promise.all([drainSignalReviews({ store, root, now, getCandles }), drainSignalReviews({ store, root, now, getCandles })]);
  assert.equal([...store.objects.keys()].filter(path => path.includes("/reviews/")).length, 1);
  assert.equal([...store.objects.keys()].filter(path => path.includes("/review-index/")).length, 1);
  result.market.latestQuote.time -= 30_000;
  assert.throws(() => evaluateSignal(result, 4, markCandles(result, 4)), { code: "STALE_REFERENCE" });
  await enqueueSignalReviews(store, root, result);
  assert.equal([...store.objects.keys()].filter(path => path.includes("/review-queue/")).length, 2);
});

test("FC timer rejects browser-shaped events and requires temporary execution-role credentials", async () => {
  let calls = 0;
  const credentials = { accessKeyId: "test", accessKeySecret: "test", securityToken: "sts" };
  const timer = createReviewTimer({ env: { PRIVATE_RESOURCE_ROOT: "/custom" }, logger: () => {},
    createStore: async args => { assert.deepEqual(args.credentials, credentials); assert.equal(args.clientOptions.retryMax, 0); return "store"; },
    drain: async args => { calls++; assert.equal(args.store, "store"); assert.equal(args.root, signalHistoryRoot("/custom")); return { completed: 1 }; },
  });
  const event = Buffer.from(JSON.stringify({ triggerName: "market-research-review-v4", payload: "drain-market-signal-reviews", triggerTime: new Date(AT).toISOString() }));
  await assert.rejects(timer(Buffer.from('{"httpMethod":"POST"}'), { credentials }), /INVALID_REVIEW_TIMER_EVENT/);
  await assert.rejects(timer(event, { credentials: { ...credentials, securityToken: "" } }), /REVIEW_ROLE_REQUIRED/);
  assert.equal(calls, 0);
  assert.deepEqual(await timer(event, { credentials }), { completed: 1 });
  assert.equal(calls, 1);
});
