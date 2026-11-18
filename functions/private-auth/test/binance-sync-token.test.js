import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";
import { issueBinanceSyncToken } from "../binance-sync-token.js";
import { __test, createHandler } from "../index.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const env = { BINANCE_SYNC_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }) };
const nowSeconds = 1800000000;
const user = { id: "owner", role: "owner" };

test("tickets use RS256, unique IDs and only the sync scope for 120 seconds", () => {
  const first = issueBinanceSyncToken({ user, env, nowSeconds });
  const second = issueBinanceSyncToken({ user, env, nowSeconds });
  const [header, payload, signature] = first.token.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url")), { alg: "RS256", typ: "JWT", kid: "trade-sync-v1" });
  const claims = JSON.parse(Buffer.from(payload, "base64url"));
  assert.equal(first.syncUrl, "https://yanxiao.me/trade/api/sync");
  assert.equal(claims.exp - claims.iat, 120);
  assert.equal(claims.scope, "trading:sync");
  assert.equal(claims.aud, "binance-trade-sync");
  assert.equal(claims.iss, "https://www.yanxiao.me");
  assert.equal(verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url")), true);
  assert.notEqual(first.token, second.token);
  assert.equal(JSON.stringify(first).includes("PRIVATE KEY"), false);
});

test("only owners can obtain tickets and invalid signing settings fail closed", () => {
  assert.throws(() => issueBinanceSyncToken({ user: { id: "member", role: "member" }, env, nowSeconds }), { code: "MISSING_PERMISSION" });
  for (const delta of [{ BINANCE_SYNC_PRIVATE_KEY: "" }, { BINANCE_SYNC_PRIVATE_KEY: "invalid" },
    { BINANCE_SYNC_URL: "http://example.com" }, { BINANCE_SYNC_KEY_ID: "bad key" },
    { BINANCE_SYNC_URL: "https://user:pass@example.com" },
  ]) assert.throws(() => issueBinanceSyncToken({ user, env: { ...env, ...delta }, nowSeconds }), { code: "BINANCE_SYNC_UNAVAILABLE" });
  assert.ok(issueBinanceSyncToken({ user, nowSeconds, env: { ...env, BINANCE_SYNC_PRIVATE_KEY: env.BINANCE_SYNC_PRIVATE_KEY.replace(/\n/g, "\\n") } }).token);
});

test("legacy environment sessions still require cookie, CSRF and origin for tickets", async () => {
  const runtimeEnv = { ...env, WEBAUTHN_ORIGIN: "https://yanxiao.me", WEBAUTHN_RP_ID: "yanxiao.me",
    SESSION_CURRENT_KEY: Buffer.alloc(32, 7).toString("base64url"), CDN_AUTH_KEY: "PrivateCdnKey123456",
    WEBAUTHN_CREDENTIAL_ID: "credential", WEBAUTHN_PUBLIC_KEY: Buffer.alloc(77, 9).toString("base64url") };
  const config = __test.loadConfig(runtimeEnv);
  const cookie = `${config.cookieName}=${__test.encryptToken({ kind: "session", sub: "owner", version: "1", csrf: "csrf-test", exp: nowSeconds + 300 }, config.currentSessionKey, size => Buffer.alloc(size, 1))}`;
  const handler = createHandler({ env: runtimeEnv, now: () => nowSeconds });
  const input = { method: "POST", path: "/api/private-auth/trading/binance/token", headers: {
    origin: runtimeEnv.WEBAUTHN_ORIGIN, cookie, "x-csrf-token": "csrf-test" }, body: "{}" };
  const good = await handler(input);
  assert.equal(good.statusCode, 200, good.body);
  assert.equal((await handler({ ...input, headers: { ...input.headers, cookie: "" } })).statusCode, 401);
  assert.equal((await handler({ ...input, headers: { ...input.headers, "x-csrf-token": "wrong" } })).statusCode, 403);
  const unconfigured = createHandler({ env: { ...runtimeEnv, BINANCE_SYNC_PRIVATE_KEY: "" }, now: () => nowSeconds });
  assert.equal((await unconfigured(input)).statusCode, 503);
  assert.equal((await unconfigured({ ...input, method: "GET", path: "/session" })).statusCode, 200);
});


test("sync URL override is independent of JWT issuer and audience", () => {
  for (const syncUrl of ["https://yanxiao.me/trade/api/sync", "https://www.yanxiao.me/trade/api/sync"]) {
    const ticket = issueBinanceSyncToken({ user, env: { ...env, BINANCE_SYNC_URL: syncUrl }, nowSeconds });
    assert.equal(ticket.syncUrl, syncUrl);
    const claims = JSON.parse(Buffer.from(ticket.token.split(".")[1], "base64url"));
    assert.equal(claims.iss, "https://www.yanxiao.me");
    assert.equal(claims.aud, "binance-trade-sync");
  }
});
