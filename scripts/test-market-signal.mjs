import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const data = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const ticketSource = compile(await readFile(new URL("../src/lib/binanceSync.ts", import.meta.url), "utf8"))
  .replace('"@/lib/privateAuthApi"', JSON.stringify(data('export const PRIVATE_AUTH_API_BASE = "https://www.yanxiao.me/api/private-auth"')))
  .replace('"@/lib/privateAuthEvents"', JSON.stringify(data('export function notifyPrivateAuthInvalidated() {globalThis.invalidations++}')));
const researchContract = await readFile(new URL("../functions/private-auth/market-research-contract.js", import.meta.url), "utf8");
const source = compile(await readFile(new URL("../src/lib/marketSignal.ts", import.meta.url), "utf8"))
  .replace('"@/lib/binanceSync"', JSON.stringify(data(ticketSource)))
  .replace('"../../functions/private-auth/market-research-contract.js"', JSON.stringify(data(researchContract)));
const { analyzeMarketOpportunity, validResult } = await import(data(source));
const ordersSource = compile(await readFile(new URL("../src/lib/marketSignalOrders.ts", import.meta.url), "utf8"))
  .replace('"@/lib/binanceSync"', JSON.stringify(data(ticketSource)));
const { previewOrders, fetchOrderStatus } = await import(data(ordersSource));
const session = { csrfToken: "csrf-for-beijing-only" };
const input = { symbol: "BTCUSDT", style: "reversal" };
const ticket = () => ({ token: "shared-sync-ticket", syncUrl: "https://yanxiao.me/trade/api/sync", expiresAt: Math.floor(Date.now() / 1000) + 120 });
const result = () => ({
  schemaVersion: 1, requestId: "request-id", analysisId: "analysis-id", codeVersion: "commit", symbol: "BTCUSDT", style: "reversal", status: "none",
  opportunity: { status: "none", title: "暂无机会", summary: "等待结构确认", direction: null, entry: null, stopLoss: null, targets: [], rewardRisk: [],
    triggerConditions: [], invalidationConditions: [], evidence: [], counterarguments: [], expiredReasons: [], triggerVerified: false, priceReference: "markPrice" },
  market: { latestQuote: { price: 10000, time: Date.now() }, warnings: [] },
  timing: { completedAt: Date.now(), validUntil: Date.now() + 30000, totalMs: 500, marketMs: 100, modelMs: 300, verificationMs: 100 }, model: { name: "configured-model" },
});
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
function setup(t, responder) {
  const calls = []; globalThis.invalidations = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => { calls.push({ url: String(url), options }); return responder(calls.length, options); });
  return calls;
}

test("analysis reuses the sync ticket route, trusted origin and shared JWT without sending site credentials", async t => {
  const payload = result();
  const calls = setup(t, n => response(n === 1 ? ticket() : payload));
  assert.deepEqual(await analyzeMarketOpportunity(session, input), payload);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://www.yanxiao.me/api/private-auth/trading/binance/token");
  assert.equal(calls[0].options.credentials, "include");
  assert.equal(calls[0].options.headers["X-CSRF-Token"], session.csrfToken);
  assert.equal(calls[1].url, "https://yanxiao.me/trade/api/signal/analyze");
  assert.equal(calls[1].options.headers["X-JWT-Token"], "Bearer shared-sync-ticket");
  assert.equal(calls[1].options.headers.Authorization, undefined);
  assert.equal(calls[1].options.headers["X-CSRF-Token"], undefined);
  assert.equal(calls[1].options.credentials, "omit");
  assert.equal(calls[1].options.redirect, "error");
  assert.equal(calls[1].options.cache, "no-store");
  assert.deepEqual(JSON.parse(calls[1].options.body), input);
});

test("untrusted ticket destinations, expired tickets and logged-out sessions never reach analysis", async t => {
  let payload = ticket(), status = 200;
  const calls = setup(t, () => response(payload, status));
  for (const delta of [{ syncUrl: "https://evil.test/trade/api/sync" }, { expiresAt: 1 }, { token: null }]) {
    payload = { ...ticket(), ...delta }; const count = calls.length;
    await assert.rejects(analyzeMarketOpportunity(session, input)); assert.equal(calls.length, count + 1);
  }
  status = 401; payload = { message: "登录已过期" };
  await assert.rejects(analyzeMarketOpportunity(session, input), /登录已过期/);
  assert.equal(globalThis.invalidations, 1);
});

test("native FC errors preserve code and request ID without invalidating the website session or retrying", async t => {
  const calls = setup(t, n => response(n === 1 ? ticket() : { Code: "JWTTokenIsInvalid", Message: "invalid or expired jwt", RequestId: "fc-id" }, n === 1 ? 200 : 400));
  await assert.rejects(analyzeMarketOpportunity(session, input), /JWTTokenIsInvalid.*fc-id/);
  assert.equal(calls.length, 2); assert.equal(globalThis.invalidations, 0);
});

test("incomplete, mismatched or HTML-success responses cannot be rendered as an opportunity", async t => {
  let payload;
  const calls = setup(t, n => response(n % 2 === 1 ? ticket() : payload));
  for (const delta of [{ market: null }, { symbol: "ETHUSDT" }, { style: "trend" }, { opportunity: {} }, { timing: {} }, { status: "success" }]) {
    payload = { ...result(), ...delta };
    await assert.rejects(analyzeMarketOpportunity(session, input), /完整的分析结果/);
  }
  assert.equal(calls.length, 12);
});

test("connection failures and cancellation do not retry or save partial results", async t => {
  const calls = setup(t, n => { if (n === 1) return response(ticket()); throw new TypeError("failed to fetch"); });
  await assert.rejects(analyzeMarketOpportunity(session, input), /没有自动重试/);
  assert.equal(calls.length, 2);
});

test("caller cancellation is propagated to both the ticket request and analysis request", async t => {
  const controller = new AbortController();
  const calls = setup(t, (n, options) => {
    if (n === 1) return response(ticket());
    controller.abort(); assert.equal(options.signal.aborted, true); throw new DOMException("aborted", "AbortError");
  });
  await assert.rejects(analyzeMarketOpportunity(session, input, controller.signal), { name: "AbortError" });
  assert.equal(calls.length, 2);
});

test("candidate, watch and expired analyses retain complete price and evidence details", async t => {
  let payload;
  setup(t, n => response(n % 2 === 1 ? ticket() : payload));
  for (const status of ["candidate", "watch", "expired"]) {
    payload = result(); payload.status = status;
    Object.assign(payload.opportunity, { status, direction: "long", entry: { min: 9990, max: 10010 }, stopLoss: 9900,
      targets: [{ price: 10200, reason: "前高" }], rewardRisk: [{ target: 10200, ratio: 1.73 }],
      evidence: [{ metric: "1h.ema20", reason: "趋势" }], triggerConditions: ["回踩确认"], invalidationConditions: ["跌破结构"], counterarguments: ["量能不足"] });
    if (status === "expired") payload.opportunity.expiredReasons = ["分析期间价格偏移超过阈值"];
    const actual = await analyzeMarketOpportunity(session, input);
    assert.equal(actual.status, status); assert.equal(actual.opportunity.triggerVerified, false);
    assert.deepEqual(actual.opportunity.entry, { min: 9990, max: 10010 });
  }
});


test("V4 accepts a watch without a plan and validates version, full chart and research horizons", () => {
  const payload = result();
  const at = Math.floor(Date.now() / 14_400_000) * 14_400_000;
  Object.assign(payload, { schemaVersion: 4, status: "watch" });
  Object.assign(payload.opportunity, { status: "watch", validForSeconds: 30 });
  Object.assign(payload.model, { promptVersion: "market-research-v4" });
  Object.assign(payload.market, { asOf: at, tickSize: 0.1,
    chart: Object.entries({ "4h": 14_400_000, "1h": 3_600_000, "15m": 900_000 }).map(([interval, period]) => ({
      interval, candles: Array.from({ length: 200 }, (_, i) => [at - (200 - i) * period, 100, 102, 98, 100, 10, 4]),
    })),
  });
  payload.research = { marketRegime: "transition", scenario: "none", researchHorizon: 24, entryZoneId: null, stopZoneId: null,
    timeframeAnalysis: { "4h": "背景", "1h": "结构", "15m": "量价" }, priceZones: [], riskFactors: ["周期冲突"], targetAssessment: [],
    ruleAssessment: { trendAlignment: "conflict", structure: { confirmedZones: 0, repeatedZones: 0, activeSupport: 0, activeResistance: 0, clarity: "limited" },
      volumePrice: null, invalidation: null, targetSpace: [], riskReward: [] },
  };
  assert.equal(validResult(payload), true);
  assert.equal(validResult({ ...payload, research: { ...payload.research, researchHorizon: 3 } }), false);
  assert.equal(validResult({ ...payload, market: { ...payload.market, chart: [] } }), false);
  assert.equal(validResult({ ...payload, schemaVersion: 5 }), false);
  assert.equal(validResult(result()), true);
});

test("only read-only order previews with both matching protective prices are rendered", async t => {
  const permit = `preview.${"a".repeat(43)}`;
  const analysisId = "00000000-0000-0000-0000-000000000001";
  const option = { kind: "market", price: "10000", risk: 0.1, notional: 10, stopLossPrice: "9900", takeProfitPrice: "10200" };
  const valid = { mode: "demo", symbol: "BTCUSDT", analysisId, direction: "long", quantity: "0.001",
    stop: 9900, target: 10200, riskCap: 1, markPrice: "10000", expiresAt: Date.now() + 30000,
    options: [option], unavailable: {}, submission: { state: "blocked", reason: "仅可预览。" } };
  let payload = valid;
  const calls = setup(t, n => response(n % 2 === 1 ? ticket() : payload));
  const preview = () => previewOrders(session, analysisId, permit, new AbortController().signal);
  assert.deepEqual(await preview(), valid);
  assert.equal(calls[0].url, "https://www.yanxiao.me/api/private-auth/trading/binance/order-token");
  assert.deepEqual(JSON.parse(calls[0].options.body), { action: "preview" });
  assert.deepEqual(JSON.parse(calls[1].options.body), { action: "preview", permit });
  for (const patch of [{ submission: undefined }, { options: [{ ...option, takeProfitPrice: undefined }] },
    { options: [{ ...option, stopLossPrice: "9000" }] }]) {
    payload = { ...valid, ...patch };
    await assert.rejects(preview(), /订单草稿格式无效/);
  }
});

test("protected confirmation uses its own ticket and accepts distinct stop and target status", async t => {
  const draft = `selected.${"a".repeat(43)}`;
  const analysisId = "00000000-0000-0000-0000-000000000001";
  const outcome = { mode: "demo", analysisId, state: "accepted", kind: "market", clientId: "entry",
    executedQty: "0.001", exchangeStatus: "FILLED", protection: { state: "attention",
      stop: { price: "9900", clientId: "stop", exchangeStatus: "NEW" },
      target: { price: "10200", clientId: "target", exchangeStatus: null } } };
  const calls = setup(t, n => response(n === 1 ? ticket() : outcome));
  assert.deepEqual(await fetchOrderStatus(session, analysisId, draft), outcome);
  assert.deepEqual(JSON.parse(calls[0].options.body), { action: "submit", draft });
  assert.deepEqual(JSON.parse(calls[1].options.body), { action: "submit", draft });
  assert.equal(calls[1].options.credentials, "omit");
  assert.equal(calls.length, 2);
});

const scannerSource = compile(await readFile(new URL("../src/lib/marketScanner.ts", import.meta.url), "utf8"))
  .replace('"@/lib/binanceSync"', JSON.stringify(data(ticketSource)));
const { fetchMarketScans } = await import(data(scannerSource));

test("scanner reads only its own route and preserves two scans of the same candle", async t => {
  const signal = new AbortController().signal;
  const slot = 1800000000000;
  const row = { id: "run-2", time: slot + 200, scannedAt: slot + 200, candleClosedAt: slot,
    symbol: "BTCUSDT", rulesVersion: "v1", status: "error", errorCode: "BINANCE_RATE_LIMITED" };
  const next = `${slot - 900000}:`;
  let payload = { records: [row, { ...row, id: "run-1", time: slot + 100, scannedAt: slot + 100 }],
    from: slot - 900000, to: slot + 500, next };
  const calls = setup(t, n => response(n % 2 === 1 ? ticket() : payload));
  assert.deepEqual(await fetchMarketScans(session, undefined, signal), payload);
  assert.equal(calls[0].url, "https://www.yanxiao.me/api/private-auth/trading/binance/token");
  assert.equal(calls[1].url, "https://yanxiao.me/trade/api/signal/scans");
  assert.equal(calls[1].options.credentials, "omit");
  assert.deepEqual(JSON.parse(calls[1].options.body), { version: 2 });
  payload = { ...payload, next: null, records: [{ ...row, time: slot + 900000, scannedAt: slot + 900000 }] };
  await assert.rejects(fetchMarketScans(session, next, signal), /扫描记录时段无效/);
  assert.deepEqual(JSON.parse(calls[3].options.body), { version: 2, before: next });
});
