import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/binanceSync.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replace('"@/lib/privateAuthApi"', '"data:text/javascript,export const PRIVATE_AUTH_API_BASE = %22https://www.yanxiao.me/api/private-auth%22"')
  .replace('"@/lib/privateAuthEvents"', '"data:text/javascript,export function notifyPrivateAuthInvalidated() {globalThis.invalidations++}"');
const { syncBinanceRecords } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const session = { csrfToken: "csrf-only-for-beijing" };
const ticket = () => ({ token: "short-lived-jwt", syncUrl: "https://yanxiao.me/trade/api", expiresAt: Math.floor(Date.now() / 1000) + 120 });
const result = { status: "completed", requestId: "request-id", newRecords: { trades: 2, income: 3 } };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });

function setup(t, responder) {
  const calls = [];
  globalThis.invalidations = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url: String(url), options });
    return responder(calls.length, options);
  });
  return calls;
}

test("browser gets a CSRF-protected ticket then calls Seoul proxy without site credentials", async t => {
  const calls = setup(t, n => response(n === 1 ? ticket() : result));
  assert.deepEqual(await syncBinanceRecords(session), result);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://www.yanxiao.me/api/private-auth/trading/binance/token");
  assert.equal(calls[0].options.credentials, "include");
  assert.equal(calls[0].options.headers["X-CSRF-Token"], session.csrfToken);
  assert.equal(calls[1].url, "https://yanxiao.me/trade/api");
  assert.equal(calls[1].options.credentials, "omit");
  assert.equal(calls[1].options.redirect, "error");
  assert.equal(calls[1].options.headers["X-JWT-Token"], "Bearer short-lived-jwt");
  assert.equal(calls[1].options.headers.Authorization, undefined);
  assert.equal(calls[1].options.headers["X-CSRF-Token"], undefined);
  assert.deepEqual(JSON.parse(calls[1].options.body), { action: "sync" });
});

test("logged-out sessions, wrong destinations and expired tickets never reach Seoul", async t => {
  let payload = { message: "登录已过期" }, status = 401;
  const calls = setup(t, () => response(payload, status));
  await assert.rejects(syncBinanceRecords(session), /登录已过期/);
  assert.equal(globalThis.invalidations, 1);
  status = 200;
  for (const delta of [{ syncUrl: "https://evil.test/trade/api" },
    { syncUrl: "https://yanxiao.me.evil.test/trade/api" }, { syncUrl: "http://yanxiao.me/trade/api" },
    { syncUrl: "https://yanxiao.me:444/trade/api" }, { syncUrl: "https://user:password@yanxiao.me/trade/api" },
    { syncUrl: "https://yanxiao.me/api/private-auth" }, { syncUrl: "https://yanxiao.me/trade/api?token=bad" }, { expiresAt: 1 }, { token: null }]) {
    payload = { ...ticket(), ...delta };
    const count = calls.length;
    await assert.rejects(syncBinanceRecords(session));
    assert.equal(calls.length, count + 1);
  }
});

test("sync auth errors preserve site login; interrupted calls and incomplete results are never retried", async t => {
  let failure = "auth";
  const calls = setup(t, (n) => {
    if (n % 2 === 1) return response(ticket());
    if (failure === "network") throw new TypeError("Failed to fetch");
    if (failure === "partial") return response({ status: "running" });
    return response({ error: { message: "同步凭证已过期" } }, 401);
  });
  await assert.rejects(syncBinanceRecords(session), /同步凭证已过期/);
  assert.equal(globalThis.invalidations, 0);
  failure = "network";
  await assert.rejects(syncBinanceRecords(session), /云端任务仍会继续/);
  failure = "partial";
  await assert.rejects(syncBinanceRecords(session), /完整同步结果/);
  assert.equal(calls.length, 6);
});


test("sync destination can use either trusted domain independently of the Beijing API", async t => {
  let syncUrl = "https://yanxiao.me/trade/api";
  const calls = setup(t, n => response(n % 2 === 1 ? { ...ticket(), syncUrl } : result));
  await syncBinanceRecords(session);
  assert.equal(calls[0].url, "https://www.yanxiao.me/api/private-auth/trading/binance/token");
  assert.equal(calls[1].url, "https://yanxiao.me/trade/api");
  syncUrl = "https://www.yanxiao.me/trade/api";
  await syncBinanceRecords(session);
  assert.equal(calls[3].url, syncUrl);
});
