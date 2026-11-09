import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { handleTrading } from "../trading.js";

const user = { id: "owner", role: "owner", permissions: [] };
const config = { privateRoot: "/private" };
const tick = 1_783_000_000;
const originalPlan = {
  symbol: "BTCUSDT", name: "Bitcoin", market: "crypto", direction: "long",
  recordType: "paper", strategy: "反转", timeframe: "日线", account: "paper",
  currency: "USDT", setupAt: "2026-11-09T08:00:00.000Z", trend: "down",
  signals: ["颈线支撑", "缩量下跌"], thesis: "支撑位试仓，等待确认",
  trigger: "收回支撑且放量", invalidation: "有效跌破支撑", entry: 100, stop: 95,
  target: 112, plannedQuantity: 10, plannedRisk: 50, stopReason: "结构止损", holdingPeriod: "波段",
};
class MemoryStore {
  records = new Map();
  async readJson(path, options = {}) {
    return structuredClone(this.records.get(path) ?? options.missing);
  }
  async updateJson(path, options, change) {
    const current = await this.readJson(path, { missing: options.missing });
    assert.ok(options.validate(current), "stored document must be valid");
    const changed = change(current);
    if (changed) this.records.set(path, structuredClone(changed));
    return changed;
  }
  signUpload(path) { return "https://upload.test/" + path; }
  async stat() { return { bytes: 15, contentType: "image/png" }; }
  async readPrefix() { return Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0]); }
}
function harness() {
  const contentStore = new MemoryStore();
  const request = (route, body = {}, target = user) =>
    handleTrading({ route: "trading/" + route, body, user: target, config, contentStore, nowSeconds: tick, randomBytesImpl: randomBytes });
  return { contentStore, request };
}
const id = (suffix) => "000000000000000000000000000000" + suffix;
async function create(request, plan = originalPlan, requestId = id("01")) {
  return (await request("save", { id: requestId, plan })).trade;
}
async function confirm(request, trade) {
  return (await request("confirm", { id: trade.id, revision: trade.revision })).trade;
}
async function execution(request, trade, { id: eid, action, price, quantity, fee = 0, at = "2026-11-09T09:00:00.000Z" }) {
  return (await request("execution/add", { id: trade.id, revision: trade.revision,
    execution: { id: eid, action, at, price, quantity, fee, note: "" } })).trade;
}
test("only owner can read or write trading journal", async () => {
  const { request } = harness();
  await assert.rejects(request("list", {}, { id: "member", role: "member", permissions: ["private-resources"] }),
    (error) => error.statusCode === 403);
  await assert.rejects(request("save", { plan: originalPlan }, { id: "member", role: "member" }),
    (error) => error.statusCode === 403);
});
test("create/save retry is idempotent and plan confirmation is immutable", async () => {
  const { request } = harness();
  let trade = await create(request);
  assert.equal(trade.status, "draft");
  const same = await create(request);
  assert.equal(same.id, trade.id);
  assert.equal((await request("list")).entries.length, 1);
  trade = await confirm(request, trade);
  assert.equal(trade.status, "planned");
  assert.equal(trade.planHistory.length, 1);
  await assert.rejects(request("save", { id: trade.id, revision: trade.revision, plan: { ...originalPlan, thesis: "后见之明" } }),
    (error) => error.code === "PLAN_LOCKED");
  await assert.rejects(request("revise", { id: trade.id, revision: trade.revision - 1, plan: originalPlan }),
    (error) => error.code === "STALE_REVISION");
  const revision = (await request("revise", { id: trade.id, revision: trade.revision, plan: { ...originalPlan, thesis: "确认后补充的分析" } })).trade;
  assert.equal(revision.planHistory.length, 2);
  assert.equal(revision.planHistory[0].plan.thesis, originalPlan.thesis);
  assert.equal(revision.planHistory[1].plan.thesis, "确认后补充的分析");
});
test("multiple entries and partial exits compute net realized PnL and preserve review", async () => {
  const { request } = harness();
  let trade = await confirm(request, await create(request));
  trade = await execution(request, trade, { id: id("02"), action: "entry", price: 100, quantity: 3, fee: 0 });
  trade = await execution(request, trade, { id: id("03"), action: "entry", price: 102, quantity: 7, fee: 0 });
  assert.equal(trade.metrics.remaining, 10);
  assert.equal(trade.metrics.averageEntry, 101.4);
  trade = await execution(request, trade, { id: id("04"), action: "exit", price: 108, quantity: 5, fee: 1 });
  assert.equal(trade.status, "open");
  assert.ok(Math.abs(trade.metrics.realizedPnl - 32) < 1e-8);
  trade = await execution(request, trade, { id: id("05"), action: "exit", price: 105, quantity: 5, fee: 1, at: "2026-11-09T10:00:00.000Z" });
  assert.equal(trade.status, "closed");
  assert.equal(trade.metrics.remaining, 0);
  assert.ok(Math.abs(trade.metrics.realizedPnl - 49) < 1e-8);
  assert.equal(trade.metrics.realizedR, 49 / 50);
  const review = { expectation: "partial", discipline: "full", score: 4, emotions: ["冷静"],
    mistakes: [], outcome: "分批止盈", learning: "继续观察", replay: "仍按计划执行" };
  trade = (await request("review", { id: trade.id, revision: trade.revision, review })).trade;
  assert.equal(trade.review.score, 4);
  assert.equal((await request("get", { id: trade.id })).trade.review.score, 4);
});
test("rejected oversized exit does not persist state", async () => {
  const { request } = harness();
  let trade = await confirm(request, await create(request));
  trade = await execution(request, trade, { id: id("06"), action: "entry", price: 100, quantity: 5 });
  await assert.rejects(execution(request, trade, { id: id("07"), action: "exit", price: 110, quantity: 6 }),
    (error) => error.code === "INVALID_POSITION");
  assert.equal((await request("get", { id: trade.id })).trade.executions.length, 1);
});
test("duplicate execution after a lost response replays original result", async () => {
  const { request } = harness();
  const trade = await confirm(request, await create(request));
  const body = { id: trade.id, revision: trade.revision, execution: {
    id: id("08"), action: "entry", price: 100, quantity: 2, fee: 0, at: "2026-11-09T09:00:00.000Z", note: "",
  } };
  const first = await request("execution/add", body);
  const second = await request("execution/add", body);
  assert.equal(second.trade.revision, first.trade.revision);
  assert.equal(second.trade.executions.length, 1);
});
test("unexecuted opportunity can be skipped and reviewed, observation cannot execute", async () => {
  const { request } = harness();
  let trade = await confirm(request, await create(request, { ...originalPlan, recordType: "observation", entry: null, stop: null }));
  await assert.rejects(execution(request, trade, { id: id("09"), action: "entry", price: 100, quantity: 1 }),
    (error) => error.code === "INVALID_STATE");
  trade = (await request("skip", { id: trade.id, revision: trade.revision })).trade;
  assert.equal(trade.status, "skipped");
  assert.equal(trade.metrics.realizedR, null);
});
test("image tickets use dedicated private paths and validate uploaded image", async () => {
  const { request } = harness();
  const trade = await create(request);
  const ticket = await request("image/init", { id: trade.id, revision: trade.revision,
    bytes: 15, contentType: "image/png", phase: "plan", caption: "交易前截图" });
  assert.ok(ticket.path.startsWith("/private/trading/screenshots/"));
  const fresh = (await request("get", { id: trade.id })).trade;
  const response = await request("image/complete", { id: trade.id, revision: fresh.revision, imageId: ticket.imageId });
  assert.equal(response.trade.attachments.length, 1);
});
