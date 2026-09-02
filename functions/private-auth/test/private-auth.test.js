import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { __test, createHandler } from "../index.js";

const NOW = 1_787_932_800;
const SESSION_KEY = Buffer.alloc(32, 7).toString("base64url");
const PUBLIC_KEY = Buffer.alloc(77, 9).toString("base64url");
const CREDENTIAL_ID = Buffer.from("owner-credential").toString("base64url");

function createEnv(overrides = {}) {
  return {
    WEBAUTHN_ORIGIN: "https://yanxiao.me",
    WEBAUTHN_RP_ID: "yanxiao.me",
    WEBAUTHN_CREDENTIAL_ID: CREDENTIAL_ID,
    WEBAUTHN_PUBLIC_KEY: PUBLIC_KEY,
    SESSION_CURRENT_KEY: SESSION_KEY,
    SESSION_VERSION: "1",
    CDN_AUTH_KEY: "PrivateCdnKey123456",
    CDN_ORIGIN_VERIFY_KEY: "origin-verification-key-with-32-bytes",
    CDN_URL_TTL_SECONDS: "3600",
    ...overrides,
  };
}

function request({ method, path, cookie, csrf, body, origin = "https://yanxiao.me", gateway = true }) {
  const headers = {};
  if (origin) headers.origin = origin;
  if (gateway) headers["x-origin-verify"] = "origin-verification-key-with-32-bytes";
  if (cookie) headers.cookie = cookie;
  if (csrf) headers["x-csrf-token"] = csrf;
  if (body) headers["content-type"] = "application/json";
  return {
    requestContext: { http: { method, path } },
    rawPath: path,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };
}

function responseJson(response) {
  return JSON.parse(response.body);
}

function cookiePair(setCookie) {
  return setCookie.split(";", 1)[0];
}

test("encrypts tokens and accepts the previous rotation key", () => {
  const currentKey = Buffer.alloc(32, 1);
  const previousKey = Buffer.alloc(32, 2);
  const token = __test.encryptToken(
    { kind: "session", exp: NOW + 60 },
    previousKey,
    (size) => Buffer.alloc(size, 3),
  );

  assert.deepEqual(
    __test.decryptToken(token, [currentKey, previousKey]),
    { kind: "session", exp: NOW + 60 },
  );
  assert.equal(__test.decryptToken(`${token}tampered`, [previousKey]), null);
});

test("creates an Alibaba Cloud CDN type-A signature for the exact resource path", () => {
  const config = __test.loadConfig(createEnv());
  const path = "/private/english-learning/6minuteenglish/example/audio.mp3";
  const rand = "ab".repeat(16);
  const expectedDigest = createHash("md5")
    .update(`${path}-${NOW}-${rand}-0-${config.cdnAuthKey}`)
    .digest("hex");

  assert.equal(
    __test.signCdnPath(path, config, NOW, () => Buffer.from(rand, "hex")),
    `https://yanxiao.me${path}?auth_key=${NOW}-${rand}-0-${expectedDigest}`,
  );
});

test("signs a private catalog and validated named resource paths", () => {
  const config = __test.loadConfig(createEnv());
  const randomBytesImpl = (size) => Buffer.alloc(size, 6);
  const catalog = __test.signedResources(
    { resource: "catalog" },
    config,
    NOW,
    randomBytesImpl,
  );
  assert.match(catalog.catalog, /\/private\/index\.json\?auth_key=/);

  const resources = __test.signedResources({
    paths: {
      index: "/private/english-learning/6minuteenglish/index.json",
      audio: "/private/english-learning/6minuteenglish/example/audio.mp3",
    },
  }, config, NOW, randomBytesImpl);
  assert.deepEqual(Object.keys(resources), ["index", "audio"]);
  assert.match(resources.audio, /\/example\/audio\.mp3\?auth_key=/);
});

test("rejects unsafe or excessive private resource paths", () => {
  const config = __test.loadConfig(createEnv());
  const sign = (paths) => __test.signedResources(
    { paths },
    config,
    NOW,
    () => Buffer.alloc(16, 4),
  );
  assert.throws(() => sign({ file: "/private/../functions/private-auth.zip" }), /path is invalid/);
  assert.throws(() => sign({ file: "/private/%2e%2e/functions/private-auth.zip" }), /path is invalid/);
  assert.throws(() => sign({ file: "/functions/private-auth.zip" }), /path is invalid/);
  assert.throws(() => sign({ "bad.name": "/private/content/file.txt" }), /name is invalid/);
  assert.throws(() => sign(Object.fromEntries(
    Array.from({ length: 13 }, (_, index) => [`file${index}`, `/private/content/file${index}.txt`]),
  )), /1 to 12/);
});

test("completes challenge, passkey verification, session lookup and resource signing", async () => {
  const env = createEnv();
  const handler = createHandler({
    env,
    now: () => NOW,
    randomBytesImpl: (size) => Buffer.alloc(size, 5),
    generateAuthenticationOptionsImpl: async () => ({
      challenge: "test-challenge",
      timeout: 60_000,
      rpId: "yanxiao.me",
      allowCredentials: [{ id: CREDENTIAL_ID, type: "public-key" }],
      userVerification: "required",
    }),
    verifyAuthenticationResponseImpl: async (options) => {
      assert.equal(options.expectedChallenge, "test-challenge");
      assert.equal(options.expectedOrigin, "https://yanxiao.me");
      assert.equal(options.expectedRPID, "yanxiao.me");
      assert.equal(options.credential.id, CREDENTIAL_ID);
      return {
        verified: true,
        authenticationInfo: { userVerified: true, newCounter: 0 },
      };
    },
  });

  const challengeResponse = await handler(request({
    method: "POST",
    path: "/api/private-auth/challenge",
    body: {},
  }));
  assert.equal(challengeResponse.statusCode, 200);
  assert.equal(responseJson(challengeResponse).publicKey.challenge, "test-challenge");
  const challengeCookie = cookiePair(challengeResponse.headers["set-cookie"]);

  const verifyResponse = await handler(request({
    method: "POST",
    path: "/api/private-auth/verify",
    cookie: challengeCookie,
    body: { response: { id: CREDENTIAL_ID, type: "public-key", response: {} } },
  }));
  assert.equal(verifyResponse.statusCode, 200);
  const verifyBody = responseJson(verifyResponse);
  assert.equal(verifyBody.authenticated, true);
  assert.equal(verifyBody.expiresAt, NOW + 2_592_000);
  const sessionCookie = cookiePair(verifyResponse.headers["set-cookie"]);

  const sessionResponse = await handler(request({
    method: "GET",
    path: "/api/private-auth/session",
    cookie: sessionCookie,
    origin: null,
  }));
  assert.equal(sessionResponse.statusCode, 200);
  assert.equal(responseJson(sessionResponse).csrfToken, verifyBody.csrfToken);

  const signResponse = await handler(request({
    method: "POST",
    path: "/api/private-auth/sign",
    cookie: sessionCookie,
    csrf: verifyBody.csrfToken,
    body: { episodeId: "260827-how-do-we-describe-smells" },
  }));
  assert.equal(signResponse.statusCode, 200);
  const signBody = responseJson(signResponse);
  assert.equal(signBody.expiresAt, NOW + 3600);
  assert.match(signBody.resources.audio, /audio\.mp3\?auth_key=/);
  assert.match(signBody.resources.transcriptText, /transcript\.txt\?auth_key=/);
  assert.equal(Object.keys(signBody.resources).length, 4);
});

test("rejects direct origin access, invalid CSRF and arbitrary episode paths", async () => {
  const handler = createHandler({
    env: createEnv(),
    now: () => NOW,
    randomBytesImpl: (size) => Buffer.alloc(size, 8),
    generateAuthenticationOptionsImpl: async () => ({ challenge: "challenge" }),
  });

  const directResponse = await handler(request({
    method: "POST",
    path: "/challenge",
    body: {},
    gateway: false,
  }));
  assert.equal(directResponse.statusCode, 403);

  const challengeResponse = await handler(request({
    method: "POST",
    path: "/challenge",
    body: {},
  }));
  const encryptedChallenge = cookiePair(challengeResponse.headers["set-cookie"]);

  const fakeHandler = createHandler({
    env: createEnv(),
    now: () => NOW,
    randomBytesImpl: (size) => Buffer.alloc(size, 8),
    verifyAuthenticationResponseImpl: async () => ({
      verified: true,
      authenticationInfo: { userVerified: true },
    }),
  });
  const verifyResponse = await fakeHandler(request({
    method: "POST",
    path: "/verify",
    cookie: encryptedChallenge,
    body: { id: CREDENTIAL_ID, type: "public-key", response: {} },
  }));
  const sessionCookie = cookiePair(verifyResponse.headers["set-cookie"]);
  const csrfToken = responseJson(verifyResponse).csrfToken;

  const csrfResponse = await fakeHandler(request({
    method: "POST",
    path: "/sign",
    cookie: sessionCookie,
    csrf: "wrong-token",
    body: { resource: "index" },
  }));
  assert.equal(csrfResponse.statusCode, 403);

  const traversalResponse = await fakeHandler(request({
    method: "POST",
    path: "/sign",
    cookie: sessionCookie,
    csrf: csrfToken,
    body: { episodeId: "../another-path" },
  }));
  assert.equal(traversalResponse.statusCode, 400);
});

test("owner uploads private resource files before the collection index is published", async () => {
  const uploaded = new Map();
  let savedMetadata;
  let savedIndex = { schemaVersion: 1, updatedAt: null, episodes: [] };
  const contentStore = {
    async readJson(path, options) {
      if (path === "/private/index.json") {
        return {
          schemaVersion: 1,
          collections: [{
            collectionId: "6minuteenglish",
            type: "audio-transcript",
            basePath: "/private/english-learning/6minuteenglish",
            indexPath: "/private/english-learning/6minuteenglish/index.json",
          }],
        };
      }
      return options?.missing;
    },
    signUpload(path, file) {
      return `https://private-content.example/${path}?type=${encodeURIComponent(file.contentType)}`;
    },
    async stat(path) {
      const value = uploaded.get(path);
      if (!value) throw Object.assign(new Error("missing"), { code: "NoSuchKey", status: 404 });
      return value;
    },
    async readText(path) {
      assert.match(path, /transcript\.txt$/);
      return "A complete transcript for upload verification. ".repeat(4);
    },
    async putJsonOnce(path, value) {
      assert.match(path, /metadata\.json$/);
      savedMetadata = value;
    },
    async updateIndex(path, change) {
      assert.equal(path, "/private/english-learning/6minuteenglish/index.json");
      savedIndex = change(structuredClone(savedIndex));
      return savedIndex;
    },
  };
  const handler = createHandler({
    env: createEnv(),
    contentStore,
    now: () => NOW,
    randomBytesImpl: (size) => Buffer.alloc(size, 11),
    generateAuthenticationOptionsImpl: async () => ({ challenge: "upload-challenge" }),
    verifyAuthenticationResponseImpl: async () => ({
      verified: true,
      authenticationInfo: { userVerified: true, newCounter: 0 },
    }),
  });
  const challenge = await handler(request({ method: "POST", path: "/challenge", body: {} }));
  const verified = await handler(request({
    method: "POST",
    path: "/verify",
    cookie: cookiePair(challenge.headers["set-cookie"]),
    body: { id: CREDENTIAL_ID, type: "public-key", response: {} },
  }));
  const session = cookiePair(verified.headers["set-cookie"]);
  const csrf = responseJson(verified).csrfToken;
  const initialized = await handler(request({
    method: "POST",
    path: "/uploads/init",
    cookie: session,
    csrf,
    body: {
      collectionId: "6minuteenglish",
      itemId: "uploaded-episode",
      title: "Uploaded episode",
      publishedAt: "2026-08-30",
      recommendedDate: "2026-09-02",
      sourcePage: "https://www.bbc.co.uk/learningenglish/example",
      reason: "Upload integration test",
      difficulty: "B1-B2",
      tags: ["test"],
      files: {
        audio: { contentType: "audio/mpeg", bytes: 200_000 },
        transcriptText: { contentType: "text/plain", bytes: 180 },
        transcriptPdf: { contentType: "application/pdf", bytes: 2_000 },
      },
    },
  }));
  assert.equal(initialized.statusCode, 200, initialized.body);
  const upload = responseJson(initialized);
  assert.equal(upload.itemId, "uploaded-episode");
  assert.deepEqual(upload.files.audio.headers, {
    "Content-Type": "audio/mpeg",
    "x-oss-forbid-overwrite": "true",
  });

  const incomplete = await handler(request({
    method: "POST", path: "/uploads/complete", cookie: session, csrf,
    body: { uploadToken: upload.uploadToken },
  }));
  assert.equal(incomplete.statusCode, 409);

  uploaded.set(upload.files.audio.path, { bytes: 200_000, etag: "audio", contentType: "audio/mpeg" });
  uploaded.set(upload.files.transcriptText.path, { bytes: 180, etag: "text", contentType: "text/plain" });
  uploaded.set(upload.files.transcriptPdf.path, { bytes: 2_000, etag: "pdf", contentType: "application/pdf" });
  const completed = await handler(request({
    method: "POST", path: "/uploads/complete", cookie: session, csrf,
    body: { uploadToken: upload.uploadToken },
  }));
  assert.equal(completed.statusCode, 200, completed.body);
  assert.equal(responseJson(completed).published, true);
  assert.equal(savedMetadata.resources.audio.etag, "audio");
  assert.equal(savedIndex.episodes[0].episodeId, "uploaded-episode");
});
