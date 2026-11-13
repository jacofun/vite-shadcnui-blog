import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { annotateTradingTimes, normalizeTradingAiProposal, parseTradingNarrative } from "../trading-ai.js";
import { applyAiTradingNarrative } from "../trading-ai-store.js";
import { handleTrading } from "../trading.js";

const user = { id: "owner", role: "owner", permissions: [] };
const config = { privateRoot: "/private" };
const nowSeconds = Date.parse("2026-11-13T08:30:00Z") / 1000;
const id = suffix => "000000000000000000000000000000" + suffix;

class Store {
  records = new Map();
  async readJson(path, { missing } = {}) { return structuredClone(this.records.get(path) ?? missing); }
  async updateJson(path, options, update) {
    const existing = await this.readJson(path, { missing: options.missing });
    assert.ok(options.validate(existing));
    const result = update(existing);
    if (result) this.records.set(path, structuredClone(result));
    return result;
  }
}
function harness() {
  const contentStore = new Store();
  const apply = (body, target = user) => applyAiTradingNarrative({
    body, user: target, config, contentStore, nowSeconds, randomBytesImpl: randomBytes,
  });
  const trade = (route, body) => handleTrading({
    route: "trading/" + route, body, user, config, contentStore, nowSeconds, randomBytesImpl: randomBytes,
  });
  return { apply, trade };
}
const proposal = overrides => normalizeTradingAiProposal({
  phase: "mixed", summary: "趋势下跌，先开空后止盈",
  plan: { symbol: "BTCUSDT", direction: "short", strategy: "趋势", plannedRisk: 1,
    entry: 71500, stop: 72500, target: 69500 },
  executions: [
    { action: "entry", at: "2026-11-12T08:00:00Z", price: 71500, quantity: 0.001, fee: null, quantityMode: "explicit" },
    { action: "exit", at: "2026-11-12T08:30:00Z", price: 69500, quantity: null, fee: null, quantityMode: "all" },
  ],
  events: [{ kind: "stop_moved", at: "2026-11-12T08:20:00Z", summary: "曾考虑移动至保本" }],
  review: { expectation: "yes", discipline: "unknown", score: null, outcome: "达到计划止盈", learning: "", replay: "", emotions: [], mistakes: [] },
  missing: [], warnings: [],
  ...overrides,
});
const body = (p = proposal(), suffix = "01") => ({
  createId: id("10"), noteId: id(suffix), raw: "昨天16点开空，随后平仓", referenceAt: "2026-11-13T08:30:00Z",
  timezone: "Asia/Shanghai", proposal: p,
});

test("Chinese relative dates and explicit times use selected timezone", () => {
  const parsed = annotateTradingTimes("昨天晚上10点30分开仓，前天凌晨1:20观察，今天下午3点复盘", Date.parse("2026-11-13T08:30:00Z"));
  assert.deepEqual(parsed.mentions.map(m => m.resolved), [
    "2026-11-12T22:30:00+08:00", "2026-11-11T01:20:00+08:00", "2026-11-13T15:00:00+08:00",
  ]);
  assert.equal(annotateTradingTimes("昨天晚上", Date.parse("2026-11-13T08:30:00Z")).mentions[0].resolved, "2026-11-12");
  assert.equal(annotateTradingTimes("今天上午9点", Date.parse("2026-11-13T08:30:00Z"), "Asia/Tokyo").mentions[0].resolved, "2026-11-13T09:00:00+09:00");
});

test("AI proposal only keeps explicitly supplied numeric fields", () => {
  const parsed = normalizeTradingAiProposal({ phase: "execution",
    plan: { symbol: "btcusdt", direction: "short", entry: "71500", stop: 72500 },
    executions: [{ action: "exit", price: 69500, at: null, quantity: null, quantityMode: "all" }],
    review: { score: 10, discipline: "unknown" },
  });
  assert.equal(parsed.plan.symbol, "BTCUSDT");
  assert.equal(parsed.plan.entry, undefined);
  assert.equal(parsed.plan.stop, 72500);
  assert.equal(parsed.executions[0].at, null);
  assert.equal(parsed.review.score, null);
});

test("model parsing supplies trusted time annotation and strips unsupported fields", async () => {
  let sent;
  const fetchImpl = async (_url, options) => {
    sent = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
      phase: "plan", summary: "准备开空", plan: { symbol: "BTCUSDT", direction: "short", madeUp: "ignored" },
      executions: [], events: [], review: null, missing: [], warnings: [],
    }) } }] }) };
  };
  const value = await parseTradingNarrative({
    body: { text: "昨天晚上10点30分计划做空", timezone: "Asia/Shanghai" },
    trade: null, nowSeconds,
    modelConfig: { apiKey: "test-key", endpoint: "https://model.example/v1/chat/completions", model: "qwen-test", timeoutMs: 2000 },
    fetchImpl,
  });
  assert.match(sent.messages[1].content, /2026-11-12T22:30:00\+08:00/);
  assert.equal(value.proposal.plan.madeUp, undefined);
});

test("AI apply saves retrospective plan, actual fills, summary, timeline and review atomically", async () => {
  const { apply, trade } = harness();
  const applied = await apply(body());
  assert.equal(applied.trade.status, "closed");
  assert.equal(applied.trade.metrics.realizedPnl, 2);
  assert.equal(applied.trade.metrics.realizedR, 2);
  assert.equal(applied.trade.metrics.feesComplete, false);
  assert.equal(applied.trade.planHistory[0].origin, "retrospective_ai_record");
  assert.equal(applied.applied.executions, 2);
  assert.equal(applied.trade.timeline.length, 1);
  assert.equal(applied.trade.notes[0].raw, "昨天16点开空，随后平仓");
  assert.equal(applied.trade.review.score, null);
  const replay = await apply(body(), user);
  assert.equal(replay.applied.duplicate, true);
  assert.equal((await trade("get", { id: id("10") })).trade.executions.length, 2);
});

test("unknown execution times are preserved as notes but not booked as fills", async () => {
  const { apply } = harness();
  const p = proposal({ executions: [{ action: "entry", at: null, price: 70000, quantity: 0.001, quantityMode: "explicit" }] });
  const result = await apply(body(p));
  assert.equal(result.trade.executions.length, 0);
  assert.equal(result.trade.status, "planned");
  assert.ok(result.missing.some(x => x.includes("时间")));
});

test("AI cannot overwrite a previously confirmed plan", async () => {
  const { apply } = harness();
  const initial = await apply(body(proposal({ executions: [], plan: { symbol: "BTCUSDT", direction: "short", strategy: "趋势", thesis: "顺势做空", trigger: "跌破关键位", invalidation: "结构反转", entry: 71500, stop: 72500, plannedRisk: 1 } }), "01"));
  assert.equal(initial.trade.status, "planned");
  const original = initial.trade.plan.entry;
  const changed = await apply({
    ...body(proposal({ executions: [], plan: { entry: 80000, direction: "long" } }), "02"),
    id: id("10"), revision: initial.trade.revision,
  });
  assert.equal(changed.trade.plan.entry, original);
  assert.equal(changed.trade.notes.length, 2);
});

test("stale revision and non-owner writes fail closed", async () => {
  const { apply } = harness();
  const initial = await apply(body(proposal({ executions: [] })));
  await assert.rejects(apply({ ...body(proposal({ executions: [] }), "03"), id: id("10"), revision: initial.trade.revision - 1 }),
    e => e.code === "STALE_REVISION");
  await assert.rejects(apply(body(), { id: "member", role: "member" }), e => e.statusCode === 403);
});
