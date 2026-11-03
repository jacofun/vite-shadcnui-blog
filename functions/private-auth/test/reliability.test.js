import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { __test, createHandler, createPrivateResourceContentStore } from "../index.js";

const NOW = 1_787_932_800;
const key = Buffer.alloc(32, 7);
const user = { id: "owner", role: "owner", permissions: [] };

async function fixture() {
  const objects = new Map();
  const client = {
    async put(path, bytes, options = {}) {
      if (options.headers?.["x-oss-forbid-overwrite"] === "true" && objects.has(path)) {
        throw Object.assign(new Error("exists"), { code: "FileAlreadyExists", status: 409 });
      }
      objects.set(path, Buffer.from(bytes));
    },
    async get(path) {
      if (!objects.has(path)) throw Object.assign(new Error("missing"), { code: "NoSuchKey", status: 404 });
      return { content: Buffer.from(objects.get(path)) };
    },
    async delete(path) { objects.delete(path); },
    async getObjectMeta(path) {
      const { content } = await this.get(path);
      return { contentLength: content.length, contentType: "", etag: "same-object" };
    },
  };
  const contentStore = await createPrivateResourceContentStore({
    env: { OSS_CONTENT_BUCKET: "test", OSS_CONTENT_REGION: "cn-beijing", OSS_CONTENT_ENDPOINT: "https://oss.example.com" },
    client, publicClient: client, credentials: { accessKeyId: "test-id", accessKeySecret: "test-secret" },
  });
  return { objects, contentStore };
}

test("upload completion survives a lost response and a failed index publication across seconds", async () => {
  for (const type of ["files", "audio-transcript"]) {
    const { contentStore, objects } = await fixture();
    const basePath = "/private/collections/example";
    const files = type === "files"
      ? { file: { path: `${basePath}/items/sample/file.pdf`, bytes: 20, contentType: "application/pdf" } }
      : { audio: { path: `${basePath}/sample/audio.mp3`, bytes: 20, contentType: "audio/mpeg" },
        transcriptText: { path: `${basePath}/sample/transcript.txt`, bytes: 200, contentType: "text/plain" } };
    for (const file of Object.values(files)) objects.set(file.path.slice(1), Buffer.alloc(file.bytes, 65));
    const payload = { kind: "resource-upload", sub: user.id, iat: NOW, exp: NOW + 900,
      collection: { collectionId: "example", type, basePath, indexPath: `${basePath}/index.json` }, files,
      ...(type === "files" ? { item: { itemId: "sample", title: "Sample", format: "pdf" } }
        : { episode: { episodeId: "sample", title: "Sample", recommendedDate: "2026-09-01" } }),
    };
    const args = { route: "uploads/complete", user, config: { currentSessionKey: key },
      body: { uploadToken: __test.encryptToken(payload, key) }, contentStore, nowSeconds: NOW + 2 };
    const originalUpdate = contentStore.updateJson.bind(contentStore);
    let failOnce = true;
    contentStore.updateJson = async (...values) => {
      if (values[0] === payload.collection.indexPath && failOnce) {
        failOnce = false;
        throw new Error("simulated index outage after metadata was written");
      }
      return originalUpdate(...values);
    };
    await assert.rejects(__test.handlePrivateResourceUpload(args), /simulated index outage/);
    assert.equal((await __test.handlePrivateResourceUpload({ ...args, nowSeconds: NOW + 5 })).published, true);
    assert.equal((await __test.handlePrivateResourceUpload({ ...args, nowSeconds: NOW + 9 })).published, true);
    const index = await contentStore.readJson(payload.collection.indexPath);
    assert.equal((index.items ?? index.episodes).length, 1);
    const metadataPath = type === "files" ? `${basePath}/items/sample/metadata.json` : `${basePath}/sample/metadata.json`;
    const metadata = await contentStore.readJson(metadataPath);
    await contentStore.putJson(metadataPath, { ...metadata, title: "Conflicting content" });
    await assert.rejects(__test.handlePrivateResourceUpload({ ...args, nowSeconds: NOW + 10 }), { code: "RESOURCE_EXISTS" });
  }
});

const grading = { contentScore: 12, organizationScore: 6, grammarScore: 6, expressionScore: 6,
  summary: "Clear retelling.", contentFeedback: [], languageIssues: [], targetExpressionFeedback: [],
  priorityImprovements: ["Add one example."], revisedRetelling: "A clear retelling of the episode." };

async function assessmentFixture() {
  const f = await fixture();
  const prefix = "/private/english-learning/6minuteenglish/sample";
  await f.contentStore.putJson(`${prefix}/metadata.json`, { schemaVersion: 1, episodeId: "sample", title: "Sample" });
  f.objects.set(`${prefix.slice(1)}/transcript.txt`, Buffer.from("A sufficiently long transcript about shared vocabulary and how it helps people communicate. ".repeat(3)));
  const args = { route: "assessment/grade", user, nowSeconds: NOW,
    config: { privatePrefix: "/private/english-learning/6minuteenglish" }, contentStore: f.contentStore,
    env: { DASHSCOPE_API_KEY: "test-key", DASHSCOPE_BASE_URL: "https://dashscope.example/v1" },
    body: { episodeId: "sample", attemptId: "attempt-1234567890", retelling: "People use shared words to explain their experiences and communicate with each other. The episode describes how vocabulary helps people understand different smells and how they can learn useful expressions through regular practice." },
    fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(grading) } }] }) }),
  };
  const userKey = createHash("sha256").update(user.id).digest("hex").slice(0, 32);
  return { ...f, args, attemptPath: `fc/english-assessment/${userKey}/sample/${args.body.attemptId}.json` };
}

test("concurrent grading of one attempt calls the model once and replays completed SSE", async () => {
  const { args } = await assessmentFixture();
  let started;
  let finish;
  const ready = new Promise((resolve) => { started = resolve; });
  const response = new Promise((resolve) => { finish = resolve; });
  let modelCalls = 0;
  const first = __test.handleEnglishAssessment({ ...args, fetchImpl: async () => {
    modelCalls += 1; started(); return response;
  } });
  await ready;
  await assert.rejects(__test.handleEnglishAssessment(args), { code: "ASSESSMENT_IN_PROGRESS" });
  finish(await args.fetchImpl());
  const result = await first;
  assert.equal(modelCalls, 1);
  const replay = await __test.handleEnglishAssessment({ ...args, stream: true, fetchImpl: () => assert.fail("must not call model on replay") });
  let events = "";
  for await (const event of replay) events += event;
  assert.match(events, /event: result/);
  assert.match(events, /event: done/);
  assert.equal(result.grading.totalScore, 30);
});

test("abandoned grading can be retried after its lease; stale workers cannot overwrite it", async () => {
  const { args, contentStore, attemptPath } = await assessmentFixture();
  const contentHash = createHash("sha256").update(args.body.retelling).digest("hex");
  const legacy = { schemaVersion: 1, status: "grading", contentHash, submittedAt: new Date((NOW - 121) * 1000).toISOString() };
  await contentStore.putJson(attemptPath, legacy);
  const result = await __test.handleEnglishAssessment(args);
  assert.equal(result.status, "completed");
  await assert.rejects(__test.writeAssessmentAttempt(contentStore, attemptPath, { claimId: "old-worker" }, { ...legacy, status: "failed" }), { code: "ASSESSMENT_SUPERSEDED" });
  assert.equal((await contentStore.readJson(attemptPath)).status, "completed");
});

test("failed model requests mark attempts retryable instead of leaving grading stuck", async () => {
  const { args, contentStore, attemptPath } = await assessmentFixture();
  await assert.rejects(__test.handleEnglishAssessment({ ...args, fetchImpl: async () => { throw new Error("offline"); } }), { code: "ASSESSMENT_MODEL_ERROR" });
  assert.equal((await contentStore.readJson(attemptPath)).status, "failed");
  assert.equal((await __test.handleEnglishAssessment(args)).status, "completed");
});

test("persistent AI quota enforces concurrent requests, minute reset, daily cap and subject isolation", async () => {
  const { contentStore } = await fixture();
  const args = { contentStore, scope: "test", subject: "client-a", nowSeconds: NOW, minuteLimit: 2, dailyLimit: 3 };
  const results = await Promise.allSettled(Array.from({ length: 3 }, () => __test.consumeAiRequestQuota(args)));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
  assert.equal(results.find((r) => r.status === "rejected").reason.code, "AI_RATE_LIMITED");
  await __test.consumeAiRequestQuota({ ...args, nowSeconds: NOW + 60 });
  await assert.rejects(__test.consumeAiRequestQuota({ ...args, nowSeconds: NOW + 120 }), { code: "AI_RATE_LIMITED" });
  await __test.consumeAiRequestQuota({ ...args, subject: "client-b" });
  await __test.consumeAiRequestQuota({ ...args, nowSeconds: NOW + 86400 });
});

test("public AI rate limits run before any context or model fetch and survive handler recreation", async () => {
  const { contentStore } = await fixture();
  const env = { WEBAUTHN_ORIGIN: "https://yanxiao.me", WEBAUTHN_RP_ID: "yanxiao.me",
    WEBAUTHN_CREDENTIAL_ID: Buffer.from("key").toString("base64url"), WEBAUTHN_PUBLIC_KEY: Buffer.alloc(77, 9).toString("base64url"),
    SESSION_CURRENT_KEY: key.toString("base64url"), SESSION_VERSION: "1", CDN_AUTH_KEY: "PrivateCdnKey123456",
    DASHSCOPE_API_KEY: "test-key", DASHSCOPE_BASE_URL: "https://dashscope.example/v1", PUBLIC_ASSISTANT_MODEL: "public-test",
    PUBLIC_AI_GLOBAL_DAILY_LIMIT: "1" };
  let calls = 0;
  const makeHandler = () => createHandler({ env, contentStore, now: () => NOW, fetchImpl: async () => { calls += 1; throw new Error("offline"); } });
  const request = { method: "POST", path: "/public/assistant/ask", headers: { origin: env.WEBAUTHN_ORIGIN },
    sourceIp: "192.0.2.1", body: JSON.stringify({ question: "What is this?", pagePath: "/notes" }) };
  assert.equal((await makeHandler()(request)).statusCode, 502);
  const before = calls;
  const limited = await makeHandler()(request);
  assert.equal(limited.statusCode, 429);
  assert.equal(JSON.parse(limited.body).code, "AI_RATE_LIMITED");
  assert.equal(calls, before);
});
