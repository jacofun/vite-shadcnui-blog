import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import test from "node:test";
import { isoCBOR } from "@simplewebauthn/server/helpers";
import { administer, createHandler, createOssEventStore, createRegistryStore } from "../index.js";

const START = 1_787_932_800;
const env = {
  AUTH_STORE: "oss", WEBAUTHN_ORIGIN: "https://yanxiao.me", WEBAUTHN_RP_ID: "yanxiao.me",
  SESSION_CURRENT_KEY: Buffer.alloc(32, 7).toString("base64url"),
  CDN_AUTH_KEY: "PrivateCdnKey123456", CDN_ORIGIN_VERIFY_KEY: "origin-verification-key-with-32-bytes",
};
const digest = (value) => createHash("sha256").update(value).digest();
const json = (response) => JSON.parse(response.body);
const cookie = (response) => response.headers["set-cookie"].split(";", 1)[0];
const credential = (id = randomBytes(24).toString("base64url")) => ({ id, type: "public-key", response: {} });

function memoryStore() {
  let row = null;
  let conflicts = 0;
  let dropRegistration = false;
  const store = createRegistryStore({
    async readRow() { return structuredClone(row); },
    async compareAndSwap(revision, state) {
      if (conflicts) { conflicts -= 1; return false; }
      if ((row?.revision ?? null) !== revision) return false;
      const lostReply = dropRegistration && Object.keys(state.credentials).length > Object.keys(row?.state.credentials || {}).length;
      row = { revision: randomBytes(8).toString("hex"), state: structuredClone(state) };
      if (lostReply) { dropRegistration = false; throw new Error("Simulated committed write with lost response"); }
      return true;
    },
  });
  return { store, conflict: (count) => { conflicts = count; }, dropRegistration: () => { dropRegistration = true; } };
}

function harness({ real = false, storage = memoryStore() } = {}) {
  let time = START;
  let fail = false;
  const store = storage.store;
  const handler = createHandler({
    env, store, now: () => time,
    ...(!real ? {
      generateRegistrationOptionsImpl: async (options) => ({ challenge: randomBytes(32).toString("base64url"), user: { id: Buffer.from(options.userID).toString("base64url") } }),
      generateAuthenticationOptionsImpl: async (options) => {
        assert.equal(options.userVerification, "required");
        return { challenge: randomBytes(32).toString("base64url"), ...options };
      },
      verifyRegistrationResponseImpl: async (options) => {
        assert.equal(options.expectedOrigin, env.WEBAUTHN_ORIGIN);
        assert.equal(options.expectedRPID, env.WEBAUTHN_RP_ID);
        assert.equal(options.requireUserVerification, true);
        return { verified: !fail, registrationInfo: { userVerified: !fail,
          credential: { id: options.response.id, publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ["internal"] },
          credentialDeviceType: "multiDevice", credentialBackedUp: true } };
      },
      verifyAuthenticationResponseImpl: async () => ({ verified: !fail, authenticationInfo: { userVerified: !fail, newCounter: 0 } }),
    } : {}),
  });
  const call = (path, { body = {}, cookies = [], csrf, method = "POST", origin = env.WEBAUTHN_ORIGIN, gateway = true, ip } = {}) => handler({
    rawPath: `/api/private-auth/${path}`, requestContext: { http: { method, sourceIp: ip } },
    headers: { origin, ...(gateway ? { "x-origin-verify": env.CDN_ORIGIN_VERIFY_KEY } : {}),
      cookie: cookies.join("; "), "x-csrf-token": csrf },
    body: JSON.stringify(body),
  });
  const admin = (command, options = {}) => administer({ store, command, nowSeconds: time, ...options });
  const start = async (invite, extras = {}) => {
    const response = await call("register/options", { body: { invitationToken: invite.invitationToken,
      displayName: "Learner", credentialName: "Phone", ...extras } });
    assert.equal(response.statusCode, 200, response.body);
    return { cookies: [cookie(response)], options: json(response).publicKey };
  };
  const register = async (invite, cred = credential()) => {
    const request = await start(invite);
    const response = await call("register/verify", { cookies: request.cookies, body: { credential: cred } });
    assert.equal(response.statusCode, 200, response.body);
    return { cred, response, cookies: [cookie(response)], csrf: json(response).csrfToken, user: json(response).user };
  };
  return { store, call, admin, start, register, advance: (seconds) => { time += seconds; }, fail: (value) => { fail = value; } };
}

test("uninitialized persistent mode fails closed and never falls back to env credentials", async () => {
  const h = harness();
  assert.equal((await h.call("challenge")).statusCode, 503);
  await h.admin("bootstrap");
  await assert.rejects(h.admin("bootstrap"), /already initialized/);
  const response = await h.call("challenge");
  assert.equal(response.statusCode, 200);
  assert.equal(json(response).publicKey.allowCredentials, undefined);
});

test("owner bootstrap and member invitations enforce server-side roles and grants", async () => {
  const h = harness();
  const bootstrap = await h.admin("bootstrap");
  assert.match(bootstrap.invitationToken, /^[A-Za-z0-9_-]{16}$/);
  assert.equal(bootstrap.invitationToken.length, 16);
  const owner = await h.register(bootstrap);
  assert.equal(owner.user.role, "owner");
  assert.equal((await h.call("sign", { ...owner, body: { resource: "index" } })).statusCode, 200);
  const invite = await h.admin("invite");
  assert.equal(invite.invitationToken.length, 16);
  const step = await h.start(invite, { role: "owner", permissions: ["english-learning"] });
  const res = await h.call("register/verify", { cookies: step.cookies, body: { credential: credential(), role: "owner" } });
  assert.equal(json(res).user.role, "member");
  assert.deepEqual(json(res).user.permissions, []);
  assert.equal((await h.call("sign", { cookies: [cookie(res)], csrf: json(res).csrfToken, body: { resource: "index" } })).statusCode, 403);
  assert.equal((await h.call("register/options", { body: { invitationToken: invite.invitationToken, displayName: "again" } })).statusCode, 403);
  assert.equal((await h.call("register/options", { body: { invitationToken: randomBytes(32).toString("base64url"), displayName: "old format" } })).statusCode, 403);
  assert.equal(JSON.stringify(await h.store.read()).includes(invite.invitationToken), false);
});

test("same registration response is idempotent under retries and CAS conflicts", async () => {
  const storage = memoryStore();
  const h = harness({ storage });
  const invite = await h.admin("bootstrap");
  const step = await h.start(invite);
  storage.conflict(2);
  const input = { cookies: step.cookies, body: { credential: credential() } };
  const results = await Promise.all([h.call("register/verify", input), h.call("register/verify", input)]);
  assert.deepEqual(results.map((r) => r.statusCode), [200, 200]);
  assert.deepEqual(json(results[0]), json(results[1]));
  const state = await h.store.read();
  assert.equal(Object.keys(state.users).length, 1);
  assert.equal(Object.keys(state.credentials).length, 1);
  assert.equal(Object.keys(state.sessions).length, 1);
  assert.equal((await h.call("register/verify", { cookies: step.cookies, body: { credential: credential() } })).statusCode, 409);
  const logout = await h.call("logout", { cookies: [cookie(results[0])], csrf: json(results[0]).csrfToken });
  assert.equal(logout.statusCode, 200);
  assert.equal((await h.call("register/verify", input)).statusCode, 401, "completion replay cannot resurrect a logged-out session");
});

test("different concurrent registrations cannot consume one invitation twice", async () => {
  const h = harness();
  const invite = await h.admin("bootstrap");
  const steps = await Promise.all([h.start(invite), h.start(invite)]);
  const res = await Promise.all(steps.map((step) => h.call("register/verify", { cookies: step.cookies, body: { credential: credential() } })));
  assert.deepEqual(res.map((r) => r.statusCode).sort(), [200, 403]);
  assert.equal(Object.keys((await h.store.read()).users).length, 1);
});

test("lost successful write response can be recovered by the exact registration retry", async () => {
  const storage = memoryStore();
  const h = harness({ storage });
  const step = await h.start(await h.admin("bootstrap"));
  const input = { cookies: step.cookies, body: { credential: credential() } };
  storage.dropRegistration();
  assert.equal((await h.call("register/verify", input)).statusCode, 500);
  const retried = await h.call("register/verify", input);
  assert.equal(retried.statusCode, 200);
  assert.equal(Object.keys((await h.store.read()).users).length, 1);
});

test("a credential already owned by another account rolls back the new account and invite consumption", async () => {
  const h = harness();
  const owner = await h.register(await h.admin("bootstrap"));
  const invite = await h.admin("invite");
  const step = await h.start(invite);
  const failed = await h.call("register/verify", { cookies: step.cookies, body: { credential: owner.cred } });
  assert.equal(failed.statusCode, 409);
  assert.equal(Object.keys((await h.store.read()).users).length, 1);
  assert.equal((await h.store.read()).invites[invite.invitationHash].used, false);
  await h.register(invite);
});

test("only the operator can replace a lost bootstrap invitation, and never after enrollment", async () => {
  const h = harness();
  const first = await h.admin("bootstrap");
  const replacement = await h.admin("reissue-bootstrap");
  assert.equal(replacement.userId, first.userId);
  assert.equal((await h.call("register/options", { body: { invitationToken: first.invitationToken, displayName: "Owner" } })).statusCode, 403);
  const owner = await h.register(replacement);
  assert.equal(owner.user.role, "owner");
  await assert.rejects(h.admin("reissue-bootstrap"), /already enrolled/);
  assert.equal((await h.call("admin/bootstrap")).statusCode, 404);
});

test("trusted legacy import retains owner keys without enabling environment fallback", async () => {
  const h = harness();
  const id = randomBytes(24).toString("base64url");
  await h.admin("import-owner", { credentials: [{ id, publicKey: Buffer.from([1, 2, 3]).toString("base64url"), counter: 0 }] });
  const step = await h.call("challenge");
  const res = await h.call("verify", { cookies: [cookie(step)], body: { response: credential(id) } });
  assert.equal(res.statusCode, 200);
  assert.equal(json(res).user.id, "owner");
  assert.equal(json(res).user.role, "owner");
  await assert.rejects(h.admin("import-owner", { credentials: [] }), /already initialized/);
});

test("failed proof, expired challenge, revoked invite and wrong action cannot register", async () => {
  const h = harness();
  const invite = await h.admin("bootstrap");
  const step = await h.start(invite);
  h.fail(true);
  assert.equal((await h.call("register/verify", { cookies: step.cookies, body: { credential: credential() } })).statusCode, 401);
  assert.equal(Object.keys((await h.store.read()).users).length, 0);
  h.fail(false);
  assert.equal((await h.call("verify", { cookies: step.cookies, body: { credential: credential() } })).statusCode, 401);
  await h.admin("revoke-invite", { invitationHash: invite.invitationHash });
  assert.equal((await h.call("register/verify", { cookies: step.cookies, body: { credential: credential() } })).statusCode, 403);
  const next = await h.start(await h.admin("invite"));
  h.advance(301);
  assert.equal((await h.call("register/verify", { cookies: next.cookies, body: { credential: credential() } })).statusCode, 401);
});

test("Passkey management requires own account, CSRF and recent authentication", async () => {
  const h = harness();
  const owner = await h.register(await h.admin("bootstrap"));
  const member = await h.register(await h.admin("invite"));
  assert.equal((await h.call("passkeys/remove", { ...owner, body: { credentialId: member.cred.id } })).statusCode, 404);
  assert.equal((await h.call("passkeys/remove", { ...owner, body: { credentialId: owner.cred.id } })).statusCode, 409);
  assert.equal((await h.call("passkeys/options", { ...owner, csrf: "wrong" })).statusCode, 403);
  assert.equal((await h.call("passkeys/options", { ...owner, origin: "https://evil.example" })).statusCode, 403);
  assert.equal((await h.call("challenge", { gateway: false })).statusCode, 403);
  h.advance(301);
  assert.equal((await h.call("passkeys/options", owner)).statusCode, 403);
  const reauth = await h.call("reauth/challenge", owner);
  assert.equal(reauth.statusCode, 200);
  const reauthInput = { ...owner, cookies: [...owner.cookies, cookie(reauth)], body: { credential: member.cred } };
  assert.equal((await h.call("reauth/verify", reauthInput)).statusCode, 401);
  reauthInput.body.credential = owner.cred;
  assert.equal((await h.call("reauth/verify", reauthInput)).statusCode, 200);
  const add = await h.call("passkeys/options", { ...owner, body: { credentialName: "Backup" } });
  assert.equal(add.statusCode, 200);
  assert.match(cookie(add), /_challenge=/, "challenge must not replace the authenticated cookie");
  const backup = credential();
  const added = await h.call("passkeys/verify", { ...owner, cookies: [...owner.cookies, cookie(add)], body: { credential: backup } });
  assert.equal(added.statusCode, 200);
  const listed = await h.call("passkeys", { ...owner, method: "GET" });
  assert.equal(json(listed).credentials.length, 2);
  assert.equal(listed.body.includes("publicKey"), false);
  assert.equal((await h.call("passkeys/rename", { ...owner, body: { credentialId: backup.id, name: "USB key" } })).statusCode, 200);
  const removed = await h.call("passkeys/remove", { ...owner, body: { credentialId: owner.cred.id } });
  assert.equal(removed.statusCode, 200);
  assert.equal((await h.call("session", { ...owner, method: "GET" })).statusCode, 401);
});

test("disable, permission change and recovery revoke old sessions and credentials", async () => {
  const h = harness();
  const owner = await h.register(await h.admin("bootstrap"));
  await h.admin("disable", { userId: owner.user.id });
  assert.equal((await h.call("sign", { ...owner, body: { resource: "index" } })).statusCode, 401);
  await h.admin("enable", { userId: owner.user.id });
  assert.equal((await h.call("session", { ...owner, method: "GET" })).statusCode, 401);
  const recovery = await h.admin("recover", { userId: owner.user.id });
  assert.equal(Object.keys((await h.store.read()).credentials).length, 0);
  const recovered = await h.register(recovery);
  assert.equal(recovered.user.id, owner.user.id);
  assert.equal(recovered.user.role, "owner");
  const login = await h.call("challenge");
  assert.equal((await h.call("verify", { cookies: [cookie(login)], body: { credential: owner.cred } })).statusCode, 401);
  await h.admin("permissions", { userId: owner.user.id, permissions: [] });
  assert.equal((await h.call("sign", { ...recovered, body: { resource: "index" } })).statusCode, 401);
});

test("rate limiting persists across handler instances and expires", async () => {
  const storage = memoryStore();
  const h = harness({ storage });
  await h.admin("bootstrap");
  for (let i = 0; i < 20; i += 1) assert.equal((await h.call("challenge", { ip: "192.0.2.1" })).statusCode, 200);
  const h2 = harness({ storage });
  assert.equal((await h2.call("challenge", { ip: "192.0.2.1" })).statusCode, 429);
  h2.advance(301);
  assert.equal((await h2.call("challenge", { ip: "192.0.2.1" })).statusCode, 200);
});

test("OSS event adapter serializes appends, uses snapshots and propagates ambiguous failures", async () => {
  const objects = new Map();
  let conflict = true;
  let ambiguous = false;
  let rangeReads = 0;
  const missing = () => Object.assign(new Error("missing"), { code: "NoSuchKey", status: 404 });
  const client = {
    async getObjectMeta(name) {
      if (!objects.has(name)) throw missing();
      return { res: { headers: { "content-length": String(objects.get(name).length) } } };
    },
    async get(name, options = {}) {
      if (!objects.has(name)) throw missing();
      let content = objects.get(name);
      const range = options.headers?.Range;
      if (range) {
        rangeReads += 1;
        const start = Number(/^bytes=([0-9]+)-$/.exec(range)[1]);
        content = content.subarray(start);
      }
      return { content };
    },
    async append(name, body, options) {
      assert.match(options.headers["Content-Type"], /^(application\/x-ndjson|text\/plain; charset=utf-8)$/);
      if (conflict) {
        conflict = false;
        throw Object.assign(new Error("conflict"), { code: "PositionNotEqualToLength", status: 409 });
      }
      const current = objects.get(name) || Buffer.alloc(0);
      if (Number(options.position) !== current.length) {
        throw Object.assign(new Error("conflict"), { code: "PositionNotEqualToLength", status: 409 });
      }
      const next = Buffer.concat([current, Buffer.from(body)]);
      objects.set(name, next);
      if (ambiguous) {
        ambiguous = false;
        throw new Error("timeout after committed append");
      }
      return { nextAppendPosition: String(next.length) };
    },
    async put(name, body) {
      objects.set(name, Buffer.from(body));
      return {};
    },
  };
  const store = await createOssEventStore({ env: {
    OSS_AUTH_BUCKET: "private-auth-bucket", OSS_AUTH_REGION: "oss-cn-hangzhou",
    OSS_AUTH_ENDPOINT: "https://oss-cn-hangzhou-internal.aliyuncs.com",
    OSS_AUTH_SNAPSHOT_INTERVAL: "10",
  }, client });
  await administer({ store, command: "bootstrap", nowSeconds: START });
  for (let index = 0; index < 9; index += 1) {
    await administer({ store, command: "invite", nowSeconds: START });
  }
  assert.ok(objects.has("fc/private-auth/snapshots/snapshot-latest.json"));
  await administer({ store, command: "invite", nowSeconds: START });
  const before = await store.read();
  assert.equal(Object.keys(before.invites).length, 11);
  assert.ok(rangeReads > 0, "events after a snapshot must use a Range read");

  objects.set("fc/private-auth/snapshots/snapshot-latest.json", Buffer.from("corrupt"));
  assert.equal(Object.keys((await store.read()).invites).length, 11, "a bad cache snapshot must fall back to the log");

  ambiguous = true;
  await assert.rejects(administer({ store, command: "invite", nowSeconds: START }), /timeout after committed append/);
  assert.equal(Object.keys((await store.read()).invites).length, 12, "an acknowledged append remains authoritative");

  for (let index = 0; index < 20; index += 1) {
    assert.equal(await store.takeRateLimit("192.0.2.20", START), true);
  }
  assert.equal(await store.takeRateLimit("192.0.2.20", START), false);
  assert.ok([...objects.keys()].every((name) => !name.includes("192.0.2.20")), "rate objects must hash source IPs");
});

// Synthetic authenticator exercises the actual WebAuthn cryptographic verifier.
// No browser, private cloud credentials or network are used in these tests.
function authenticator() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const id = randomBytes(32);
  const cose = isoCBOR.encode(new Map([[1, 2], [3, -7], [-1, 1],
    [-2, new Uint8Array(Buffer.from(jwk.x, "base64url"))], [-3, new Uint8Array(Buffer.from(jwk.y, "base64url"))]]));
  const base = (type, challenge, origin) => Buffer.from(JSON.stringify({ type, challenge, origin }));
  return {
    id: id.toString("base64url"),
    register(options, { origin = env.WEBAUTHN_ORIGIN, uv = true } = {}) {
      const length = Buffer.alloc(2); length.writeUInt16BE(id.length);
      const authData = Buffer.concat([digest(env.WEBAUTHN_RP_ID), Buffer.from([uv ? 0x45 : 0x41]), Buffer.alloc(4),
        Buffer.alloc(16), length, id, Buffer.from(cose)]);
      return { id: id.toString("base64url"), rawId: id.toString("base64url"), type: "public-key", clientExtensionResults: {},
        response: { clientDataJSON: base("webauthn.create", options.challenge, origin).toString("base64url"),
          attestationObject: Buffer.from(isoCBOR.encode(new Map([["fmt", "none"], ["attStmt", new Map()],
            ["authData", new Uint8Array(authData)]]))).toString("base64url"), transports: ["internal"] } };
    },
    login(options, userId, { counter = 1, origin = env.WEBAUTHN_ORIGIN, corrupt = false } = {}) {
      const count = Buffer.alloc(4); count.writeUInt32BE(counter);
      const authData = Buffer.concat([digest(env.WEBAUTHN_RP_ID), Buffer.from([0x05]), count]);
      const clientData = base("webauthn.get", options.challenge, origin);
      const signature = sign("sha256", Buffer.concat([authData, digest(clientData)]), privateKey);
      if (corrupt) signature[signature.length - 1] ^= 1;
      return { id: id.toString("base64url"), rawId: id.toString("base64url"), type: "public-key", clientExtensionResults: {},
        response: { clientDataJSON: clientData.toString("base64url"), authenticatorData: authData.toString("base64url"),
          signature: signature.toString("base64url"), userHandle: Buffer.from(userId).toString("base64url") } };
    },
  };
}

test("real WebAuthn registration and login reject wrong origin, missing UV, bad signature and stale counter", async () => {
  const h = harness({ real: true });
  const invite = await h.admin("bootstrap");
  const step = await h.start(invite);
  const key = authenticator();
  for (const invalid of [{ origin: "https://evil.example" }, { uv: false }]) {
    assert.equal((await h.call("register/verify", { cookies: step.cookies, body: { credential: key.register(step.options, invalid) } })).statusCode, 401);
  }
  const registered = await h.call("register/verify", { cookies: step.cookies, body: { credential: key.register(step.options) } });
  assert.equal(registered.statusCode, 200, registered.body);
  const userId = json(registered).user.id;
  const login = await h.call("challenge");
  const input = { cookies: [cookie(login)], body: { credential: key.login(json(login).publicKey, userId, { corrupt: true }) } };
  assert.equal((await h.call("verify", input)).statusCode, 401);
  input.body.credential = key.login(json(login).publicKey, userId);
  assert.equal((await h.call("verify", input)).statusCode, 200);
  const next = await h.call("challenge");
  assert.equal((await h.call("verify", { cookies: [cookie(next)], body: { credential: key.login(json(next).publicKey, userId) } })).statusCode, 401);
});
