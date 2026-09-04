import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { administer, createHandler, createRegistryStore } from "../index.js";

const START = 1_788_480_000;
const SESSION_KEY = Buffer.alloc(32, 7).toString("base64url");
const CREDENTIAL_ID = randomBytes(24).toString("base64url");
const PUBLIC_KEY = Buffer.from([1, 2, 3, 4]).toString("base64url");
const env = {
  AUTH_STORE: "oss",
  WEBAUTHN_ORIGIN: "https://yanxiao.me",
  WEBAUTHN_RP_ID: "yanxiao.me",
  SESSION_CURRENT_KEY: SESSION_KEY,
  CDN_AUTH_KEY: "PrivateCdnKey123456",
  CDN_ORIGIN_VERIFY_KEY: "origin-verification-key-with-32-bytes",
};

function memoryStore() {
  let row = null;
  return createRegistryStore({
    async readRow() {
      return structuredClone(row);
    },
    async compareAndSwap(revision, state) {
      if ((row?.revision ?? null) !== revision) return false;
      row = {
        revision: randomBytes(8).toString("hex"),
        state: structuredClone(state),
      };
      return true;
    },
  });
}

function json(response) {
  return JSON.parse(response.body);
}

function cookie(response) {
  return response.headers["set-cookie"].split(";", 1)[0];
}

function createHarness() {
  let now = START;
  const store = memoryStore();
  const handler = createHandler({
    env,
    store,
    now: () => now,
    generateAuthenticationOptionsImpl: async (options) => ({
      challenge: randomBytes(32).toString("base64url"),
      ...options,
    }),
    verifyAuthenticationResponseImpl: async () => ({
      verified: true,
      authenticationInfo: { userVerified: true, newCounter: 0 },
    }),
  });

  const call = (path, {
    body = {},
    cookies = [],
    csrf,
    method = "POST",
    origin = env.WEBAUTHN_ORIGIN,
    gateway = true,
  } = {}) => handler({
    rawPath: `/api/private-auth/${path}`,
    requestContext: { http: { method, sourceIp: "203.0.113.8" } },
    headers: {
      ...(origin ? { origin } : {}),
      ...(gateway ? { "x-origin-verify": env.CDN_ORIGIN_VERIFY_KEY } : {}),
      ...(cookies.length ? { cookie: cookies.join("; ") } : {}),
      ...(csrf ? { "x-csrf-token": csrf } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return {
    store,
    call,
    advance(seconds) {
      now += seconds;
    },
  };
}

test("cross-browser authorization requires the device secret and expires after one minute", async () => {
  const h = createHarness();
  await administer({
    store: h.store,
    command: "import-owner",
    displayName: "Owner",
    credentials: [{ id: CREDENTIAL_ID, publicKey: PUBLIC_KEY, counter: 0 }],
    nowSeconds: START,
  });

  const started = await h.call("challenge", {
    body: { deviceAuthorization: true },
  });
  assert.equal(started.statusCode, 200, started.body);
  const authorization = json(started);
  assert.equal(authorization.status, "pending");
  assert.equal(authorization.expiresAt, START + 60);
  assert.notEqual(authorization.approvalToken, authorization.deviceToken);

  const approvalCannotRedeem = await h.call("verify", {
    body: { deviceToken: authorization.approvalToken },
  });
  assert.equal(approvalCannotRedeem.statusCode, 404);

  const pending = await h.call("verify", {
    body: { deviceToken: authorization.deviceToken },
  });
  assert.equal(pending.statusCode, 200);
  assert.equal(json(pending).status, "pending");

  const loginChallenge = await h.call("challenge");
  assert.equal(loginChallenge.statusCode, 200, loginChallenge.body);
  const approved = await h.call("verify", {
    cookies: [cookie(loginChallenge)],
    body: {
      credential: { id: CREDENTIAL_ID, type: "public-key", response: {} },
      approvalToken: authorization.approvalToken,
    },
  });
  assert.equal(approved.statusCode, 200, approved.body);
  assert.equal(json(approved).authenticated, true);

  const completed = await h.call("verify", {
    body: { deviceToken: authorization.deviceToken },
  });
  assert.equal(completed.statusCode, 200, completed.body);
  assert.equal(json(completed).authenticated, true);
  assert.equal(json(completed).user.id, "owner");

  const wechatSession = await h.call("session", {
    method: "GET",
    cookies: [cookie(completed)],
    origin: null,
  });
  assert.equal(wechatSession.statusCode, 200, wechatSession.body);
  assert.equal(json(wechatSession).user.id, "owner");

  const retried = await h.call("verify", {
    body: { deviceToken: authorization.deviceToken },
  });
  assert.equal(retried.statusCode, 200, retried.body);
  assert.equal(json(retried).csrfToken, json(completed).csrfToken);

  const expiring = json(await h.call("challenge", {
    body: { deviceAuthorization: true },
  }));
  h.advance(61);
  const expired = await h.call("verify", {
    body: { deviceToken: expiring.deviceToken },
  });
  assert.equal(expired.statusCode, 410);
  assert.equal(json(expired).code, "DEVICE_AUTHORIZATION_EXPIRED");
});

test("device authorization endpoints still enforce CDN gateway and same-origin requests", async () => {
  const h = createHarness();
  await administer({
    store: h.store,
    command: "import-owner",
    credentials: [{ id: CREDENTIAL_ID, publicKey: PUBLIC_KEY, counter: 0 }],
    nowSeconds: START,
  });

  const direct = await h.call("challenge", {
    body: { deviceAuthorization: true },
    gateway: false,
  });
  assert.equal(direct.statusCode, 403);

  const crossOrigin = await h.call("challenge", {
    body: { deviceAuthorization: true },
    origin: "https://evil.example",
  });
  assert.equal(crossOrigin.statusCode, 403);
});
