import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const compile = value => ts.transpileModule(value, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const dataModule = value => `data:text/javascript;base64,${Buffer.from(value).toString("base64")}`;
const trading = compile(await readFile(new URL("../src/lib/trading.ts", import.meta.url), "utf8"))
  .replace('"@/lib/privateAuthApi"', JSON.stringify(dataModule('export const PRIVATE_AUTH_API_BASE="https://www.yanxiao.me/api/private-auth";')))
  .replace('"@/lib/privateAuthEvents"', JSON.stringify(dataModule('export function notifyPrivateAuthInvalidated(){globalThis.invalidations++}')));
const api = compile(await readFile(new URL("../src/lib/binanceTrades.ts", import.meta.url), "utf8"))
  .replace('"@/lib/trading"', JSON.stringify(dataModule(trading)));
const { listBinanceFills, previewBinanceTrade, importBinanceTrade } = await import(dataModule(api));
const { calculateTradingStatistics } = await import(dataModule(compile(await readFile(new URL("../src/lib/tradingStatistics.ts", import.meta.url), "utf8"))));
const session = { csrfToken: "owner-csrf" };
const selection = { symbol: "BTCUSDT", startDate: "2026-11-01", endDate: "2026-11-18", recordIds: ["98765432109876543210"],
  createId: "create-id", direction: "long", completeHistory: false };

test("private read, preview and import all use Beijing session and CSRF instead of the Seoul JWT", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  await listBinanceFills(session, { symbol: "BTCUSDT", startDate: selection.startDate, endDate: selection.endDate, page: 2 });
  await previewBinanceTrade(session, selection);
  await importBinanceTrade(session, selection);
  assert.deepEqual(calls.map(c => c.url), ["list", "preview", "import"].map(s => `https://www.yanxiao.me/api/private-auth/trading/binance/${s}`));
  for (const call of calls) {
    assert.equal(call.options.method, "POST");
    assert.equal(call.options.credentials, "include");
    assert.equal(call.options.cache, "no-store");
    assert.equal(call.options.headers["X-CSRF-Token"], "owner-csrf");
    assert.equal(call.options.headers["X-JWT-Token"], undefined);
  }
  assert.equal(JSON.parse(calls[2].options.body).recordIds[0], "98765432109876543210");
});

test("import conflicts are shown without retry and do not log out a valid session", async t => {
  let count = 0;
  globalThis.invalidations = 0;
  t.mock.method(globalThis, "fetch", async () => { count++; return new Response(JSON.stringify({ code: "ALREADY_IMPORTED", message: "已经关联其他日志" }), { status: 409 }); });
  await assert.rejects(importBinanceTrade(session, selection), e => e.code === "ALREADY_IMPORTED" && e.message === "已经关联其他日志");
  assert.equal(count, 1);
  assert.equal(globalThis.invalidations, 0);
});

test("unconfirmed histories and unknown fees never become performance samples", () => {
  const base = { status: "closed", plan: { recordType: "live", currency: "USDT" },
    executions: [{ action: "entry", price: 100, quantity: 1 }, { action: "exit", price: 102, quantity: 1 }],
    metrics: { realizedPnl: 2, realizedR: 2, remaining: 0, feesComplete: true, historyComplete: true } };
  const trades = [base, { ...base, metrics: { ...base.metrics, historyComplete: false } },
    { ...base, metrics: { ...base.metrics, feesComplete: false } }, { ...base, status: "incomplete" }];
  const stats = calculateTradingStatistics(trades, "USDT");
  assert.equal(stats.samples, 1);
  assert.equal(stats.totalPnl, 2);
  assert.equal(stats.excluded, 2);
});
