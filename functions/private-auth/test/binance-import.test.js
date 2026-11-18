import { applyAiTradingNarrative } from "../trading-ai-store.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createBinanceSource, handleBinanceImport } from "../binance-import.js";
import { handleTrading } from "../trading.js";
import { __test, createHandler } from "../index.js";

const binding = "a".repeat(64);
const nowSeconds = Date.parse("2026-11-18T00:00:00Z") / 1000;
const config = { privateRoot: "/private" };
const owner = { role: "owner" };
const createId = "00000000000000000000000000000001";
const secondId = "00000000000000000000000000000002";
const ids = ["98765432109876543210", "98765432109876543211", "98765432109876543212"];
const makeRow = (index, extra = {}) => ({ symbol: "BTCUSDT", id: ids[index], orderId: String(1000 + index),
  time: Date.parse(`2026-11-02T0${index}:00:00Z`), side: index ? "SELL" : "BUY", positionSide: "BOTH",
  price: ["10000", "11000", "9000"][index], qty: index ? "0.001" : "0.002", commission: ["0.02", "0.011", "0.009"][index],
  commissionAsset: "USDT", realizedPnl: ["0", "1", "-1"][index], ...extra });
class MemoryStore {
  records = new Map();
  queue = Promise.resolve();
  async readJson(path, options = {}) { return structuredClone(this.records.get(path) ?? options.missing); }
  async updateJson(path, options, change) {
    const job = this.queue.then(async () => {
      const doc = await this.readJson(path, { missing: options.missing });
      assert.ok(options.validate(doc));
      const next = change(doc);
      this.records.set(path, structuredClone(next));
    });
    this.queue = job.catch(() => {});
    await job;
  }
}
function harness(rows = [makeRow(0), makeRow(1), makeRow(2)]) {
  const contentStore = new MemoryStore();
  const reads = [];
  const source = { async read(path) {
    reads.push(path);
    if (path === "state.json") return { schemaVersion: 1, product: "usdm", binding,
      cursors: { trades: { BTCUSDT: nowSeconds * 1000 }, income: nowSeconds * 1000 }, updatedAt: new Date(nowSeconds * 1000).toISOString() };
    const month = path.match(/(\d{4}-\d{2})\.json$/)?.[1];
    const records = rows.filter(r => new Date(r.time).toISOString().slice(0, 7) === month);
    return records.length ? { schemaVersion: 1, product: "usdm", kind: "trades", binding, symbol: "BTCUSDT", month, records } : null;
  } };
  const base = { symbol: "BTCUSDT", startDate: "2026-11-01", endDate: "2026-11-18", direction: "long",
    completeHistory: true, recordIds: ids, createId };
  const call = (route, body = {}, user = owner) => handleBinanceImport({ route: `trading/binance/${route}`, body: { ...base, ...body },
    user, source, contentStore, config, nowSeconds });
  return { source, contentStore, reads, base, call };
}

test("source reader has fixed prefix and only GetObject; errors do not become empty data", async () => {
  const keys = [];
  const env = { OSS_CONTENT_BUCKET: "private-trades", OSS_CONTENT_REGION: "oss-cn-beijing", OSS_CONTENT_ENDPOINT: "https://oss-cn-beijing-internal.aliyuncs.com" };
  const client = { async get(path) { keys.push(path); throw Object.assign(new Error("private-sdk-body"), { code: "AccessDenied" }); } };
  const source = await createBinanceSource({ env, client, credentials: {} });
  await assert.rejects(source.read("../private/file"), { code: "INVALID_BINANCE_PATH" });
  await assert.rejects(source.read("state.json"), e => e.code === "BINANCE_DATA_UNAVAILABLE" && !e.message.includes("private-sdk-body"));
  assert.deepEqual(keys, ["fc/binance-sync/owner/state.json"]);
  client.get = async () => { throw Object.assign(new Error(), { code: "NoSuchKey" }); };
  assert.equal(await source.read("state.json"), null);
  await assert.rejects(createBinanceSource({ env: { ...env, BINANCE_DATA_OSS_PREFIX: "../bad" }, client }), { code: "BINANCE_DATA_CONFIG" });
});

test("Beijing date filters read UTC adjacent months and keep large IDs as strings", async () => {
  const first = makeRow(0, { time: Date.parse("2026-10-31T16:00:00Z") });
  const outside = makeRow(1, { time: Date.parse("2026-10-31T15:59:59Z") });
  const { call, reads } = harness([first, outside, makeRow(2)]);
  const list = await call("list", { startDate: "2026-11-01", endDate: "2026-11-01" });
  assert.equal(list.total, 1);
  assert.equal(list.records[0].id, ids[0]);
  assert.ok(reads.includes("usdm/trades/BTCUSDT/2026-10.json"));
  assert.ok(reads.includes("usdm/trades/BTCUSDT/2026-11.json"));
  await assert.rejects(call("list", { startDate: "2026-02-30" }), { code: "INVALID_DATE_RANGE" });
  await assert.rejects(call("list", { symbol: "../../private" }), { code: "INVALID_SYMBOL" });
});

test("preview uses original rows and importing is idempotent without trusting browser amounts", async () => {
  const { call, contentStore } = harness();
  const preview = await call("preview", { price: 1, realizedPnl: "9999" });
  assert.equal(preview.preview.entryAverage, "10000");
  assert.equal(preview.preview.netPnl, "-0.04");
  const imported = await call("import", { plannedRisk: 1 });
  assert.equal(imported.trade.status, "closed");
  assert.equal(imported.trade.metrics.realizedPnl, -0.04);
  assert.equal(imported.trade.metrics.realizedR, -0.04);
  assert.equal(imported.trade.executions[0].source.tradeId, ids[0]);
  assert.equal((await call("import")).duplicate, true);
  const doc = await contentStore.readJson("/private/.trading/owner/entries.json");
  assert.equal(doc.entries.length, 1);
  await assert.rejects(call("import", { createId: secondId }), { code: "ALREADY_IMPORTED" });
  assert.equal((await call("list")).records[0].importedTradeId, createId);
});

test("partial histories remain incomplete; later opening fills repair the starting position", async () => {
  const { call } = harness();
  const partial = await call("import", { recordIds: [ids[1], ids[2]], completeHistory: false });
  assert.equal(partial.trade.status, "incomplete");
  assert.equal(partial.trade.metrics.historyComplete, false);
  assert.equal(partial.trade.metrics.positionKnown, false);
  assert.equal(partial.trade.metrics.realizedR, null);
  const filled = await call("import", { targetId: createId, revision: partial.trade.revision, recordIds: [ids[0]] });
  assert.equal(filled.trade.status, "closed");
  assert.equal(filled.trade.metrics.realizedPnl, -0.04);
  assert.equal(filled.trade.metrics.initialRisk, null);
  assert.equal(filled.trade.metrics.realizedR, null);
  assert.equal((await call("import", { targetId: createId, revision: 1 })).duplicate, true);
});

test("an open trade can receive partial and final exits with revision checks", async () => {
  const { call } = harness();
  const open = await call("import", { recordIds: [ids[0]] });
  assert.equal(open.trade.status, "open");
  await assert.rejects(call("import", { targetId: createId, revision: 99, recordIds: [ids[1]] }), { code: "STALE_REVISION" });
  const reduced = await call("import", { targetId: createId, revision: open.trade.revision, recordIds: [ids[1]] });
  assert.equal(reduced.trade.status, "open");
  assert.equal(reduced.trade.metrics.remaining, 0.001);
  const closed = await call("import", { targetId: createId, revision: reduced.trade.revision, recordIds: [ids[2]] });
  assert.equal(closed.trade.status, "closed");
  assert.equal(closed.trade.executions.length, 3);
});

test("foreign commission asset is preserved and not silently converted to zero fees", async () => {
  const { call } = harness([makeRow(0, { commissionAsset: "BNB", commission: "0.00001" }), makeRow(1), makeRow(2)]);
  const result = await call("import");
  assert.equal(result.trade.metrics.feesComplete, false);
  assert.equal(result.trade.executions[0].source.commissionAsset, "BNB");
  assert.equal(result.trade.metrics.realizedR, null);
});

test("selection must match stored records, single position side and consistent direction", async () => {
  const { call } = harness();
  await assert.rejects(call("preview", { recordIds: ["111"] }), { code: "SELECTION_CHANGED" });
  await assert.rejects(call("preview", { recordIds: [ids[0], ids[0]] }), { code: "INVALID_SELECTION" });
  await assert.rejects(call("preview", { recordIds: [ids[1]] }), { code: "INCOMPLETE_SELECTION" });
  const hedge = harness([makeRow(0, { positionSide: "LONG" }), makeRow(1, { positionSide: "SHORT" })]);
  await assert.rejects(hedge.call("preview", { recordIds: ids.slice(0, 2) }), { code: "MIXED_POSITION" });
  await assert.rejects(hedge.call("preview", { recordIds: [ids[0]], direction: "short" }), { code: "MIXED_POSITION" });
});

test("concurrent attempts cannot associate one fill with two different journals", async () => {
  const { call, contentStore } = harness();
  const results = await Promise.allSettled([call("import"), call("import", { createId: secondId })]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(results.find(r => r.status === "rejected").reason.code, "ALREADY_IMPORTED");
  assert.equal((await contentStore.readJson("/private/.trading/owner/entries.json")).entries.length, 1);
});

test("linked executions cannot be overwritten through manual journal routes", async () => {
  const { call, contentStore } = harness();
  const { trade } = await call("import");
  await assert.rejects(handleTrading({ route: "trading/execution/update", user: owner, config, contentStore, nowSeconds,
    body: { id: trade.id, revision: trade.revision, execution: { ...trade.executions[0], price: 1 } } }), { code: "BINANCE_EXECUTION_READ_ONLY" });
});

test("owner, session, CSRF and origin are checked before reading Binance OSS", async () => {
  const h = harness();
  await assert.rejects(h.call("list", {}, { role: "member" }), { code: "MISSING_PERMISSION" });
  const env = { WEBAUTHN_ORIGIN: "https://yanxiao.me", WEBAUTHN_RP_ID: "yanxiao.me",
    SESSION_CURRENT_KEY: Buffer.alloc(32, 7).toString("base64url"), CDN_AUTH_KEY: "PrivateCdnKey123456",
    WEBAUTHN_CREDENTIAL_ID: "credential", WEBAUTHN_PUBLIC_KEY: Buffer.alloc(77, 9).toString("base64url") };
  const c = __test.loadConfig(env);
  const cookie = `${c.cookieName}=${__test.encryptToken({ kind: "session", sub: "owner", version: "1", csrf: "csrf-test", exp: nowSeconds + 300 }, c.currentSessionKey, size => Buffer.alloc(size, 1))}`;
  const handler = createHandler({ env, now: () => nowSeconds, contentStore: h.contentStore, binanceSource: h.source });
  const input = { method: "POST", path: "/api/private-auth/trading/binance/list", headers: { origin: env.WEBAUTHN_ORIGIN, cookie, "x-csrf-token": "csrf-test" }, body: JSON.stringify(h.base) };
  assert.equal((await handler({ ...input, headers: { ...input.headers, cookie: "" } })).statusCode, 401);
  assert.equal((await handler({ ...input, headers: { ...input.headers, "x-csrf-token": "wrong" } })).statusCode, 403);
  assert.equal((await handler({ ...input, headers: { ...input.headers, origin: "https://evil.test" } })).statusCode, 403);
  assert.equal(h.reads.length, 0);
  const good = await handler(input);
  assert.equal(good.statusCode, 200, good.body);
  assert.equal(JSON.parse(good.body).records.length, 3);
});


test("AI notes supplement risk but never duplicate linked exchange executions", async () => {
  const { call, contentStore } = harness();
  const { trade } = await call("import");
  const result = await applyAiTradingNarrative({ user: owner, config, contentStore, nowSeconds,
    body: { id: trade.id, revision: trade.revision, noteId: secondId, raw: "这笔初始风险是 1 USDT，我平了剩余仓位。",
      referenceAt: new Date(nowSeconds * 1000).toISOString(), timezone: "Asia/Shanghai",
      proposal: { phase: "execution", summary: "补充风险和执行说明", plan: { plannedRisk: 1 },
        executions: [{ action: "exit", at: "2026-11-02T03:00:00Z", price: 9000, quantity: 0.001, quantityMode: "explicit", fee: 0.009, note: "平仓" }],
        events: [], review: null, missing: [], warnings: [] } },
  });
  assert.equal(result.trade.executions.length, 3);
  assert.equal(result.trade.plan.plannedRisk, 1);
  assert.equal(result.trade.metrics.realizedR, -0.04);
  assert.match(result.trade.notes[0].warnings[0], /不重复新增成交/);
});

test("short positions and fills sharing a timestamp retain exact exchange ordering", async () => {
  const timestamp = Date.parse("2026-11-02T00:00:00Z");
  const { call } = harness([makeRow(2, { time: timestamp, side: "BUY", positionSide: "SHORT", price: "11000" }),
    makeRow(1, { time: timestamp, side: "BUY", positionSide: "SHORT", price: "9000" }),
    makeRow(0, { time: timestamp, side: "SELL", positionSide: "SHORT" })]);
  const result = await call("import", { direction: "short" });
  assert.deepEqual(result.trade.executions.map(e => e.source.tradeId), ids);
  assert.deepEqual(result.trade.executions.map(e => e.action), ["entry", "exit", "exit"]);
  assert.equal(result.trade.status, "closed");
  assert.equal(result.trade.metrics.realizedPnl, -0.04);
});
