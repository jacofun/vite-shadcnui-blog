import assert from "node:assert/strict";
import test from "node:test";

import { createPrivateResourceContentStore } from "../index.js";
import { handleMarketSignalHistory } from "../market-signal-history.js";

function fakeOssClient() {
  const objects = new Map();
  return {
    objects,
    async put(name, content, options = {}) {
      if (options.headers?.["x-oss-forbid-overwrite"] === "true" && objects.has(name)) {
        throw Object.assign(new Error("exists"), { code: "FileAlreadyExists", status: 409 });
      }
      objects.set(name, Buffer.from(content));
      return {};
    },
    async get(name) {
      const content = objects.get(name);
      if (!content) {
        throw Object.assign(new Error("missing"), { code: "NoSuchKey", status: 404 });
      }
      return { content };
    },
    async delete(name) {
      objects.delete(name);
      return {};
    },
    signatureUrl(name) {
      return `https://upload.example/${name}`;
    },
  };
}

function contentEnv() {
  return {
    OSS_CONTENT_BUCKET: "private-test",
    OSS_CONTENT_REGION: "cn-beijing",
    OSS_CONTENT_ENDPOINT: "https://oss-internal.example.com",
    OSS_CONTENT_PUBLIC_ENDPOINT: "https://oss-public.example.com",
  };
}

test("private content metadata publication is idempotent and rejects conflicting rewrites", async () => {
  const client = fakeOssClient();
  const store = await createPrivateResourceContentStore({
    env: contentEnv(),
    credentials: { accessKeyId: "test-id", accessKeySecret: "test-secret" },
    client,
    publicClient: client,
  });

  const path = "/private/items/example/metadata.json";
  await store.putJsonOnce(path, { schemaVersion: 1, value: "same" });
  await store.putJsonOnce(path, { schemaVersion: 1, value: "same" });
  await assert.rejects(
    store.putJsonOnce(path, { schemaVersion: 1, value: "different" }),
    /Resource metadata already exists/,
  );
});

test("signal history stores one immutable snapshot and paginates summaries without reading charts", async () => {
  const client = fakeOssClient();
  let failIndex = true;
  const put = client.put;
  client.put = async (name, content, options) => {
    if (name.includes("/index/") && failIndex) { failIndex = false; throw new Error("write interrupted"); }
    return put(name, content, options);
  };
  client.listV2 = async ({ prefix, "max-keys": limit, continuationToken }) => {
    assert.equal(prefix, "private/.trading/owner/market-signals/index/");
    assert.equal(limit, 12);
    const keys = [...client.objects.keys()].filter(key => key.startsWith(prefix) && (!continuationToken || key > continuationToken)).sort();
    return { objects: keys.slice(0, 1).map(name => ({ name })), isTruncated: keys.length > 1, nextContinuationToken: keys[0] };
  };
  const contentStore = await createPrivateResourceContentStore({ env: contentEnv(), credentials: { accessKeyId: "test", accessKeySecret: "test" }, client, publicClient: client });
  const call = (route, body = {}) => handleMarketSignalHistory({ route: `trading/signals/${route}`, body,
    user: { role: "owner" }, config: { privateRoot: "/private" }, contentStore });
  const at = Date.UTC(2026, 10, 19);
  const result = {
    schemaVersion: 1, analysisId: "bea1cf13-c725-4786-a06c-ec6d42ea890c", requestId: "request", codeVersion: "commit",
    symbol: "BTCUSDT", status: "none", style: "neutral", model: { name: "kimi-k3.1-pro", promptVersion: "market-research-v3" },
    opportunity: { status: "none", title: "暂无机会", summary: "量能不足", direction: null, entry: null, stopLoss: null, targets: [],
      rewardRisk: [], evidence: [], triggerConditions: [], invalidationConditions: [], counterarguments: [], expiredReasons: [], triggerVerified: false, priceReference: "markPrice" },
    market: { asOf: at, latestQuote: { price: 9980, time: at + 500 }, warnings: [], chart: Object.entries({ "4h": 14_400_000, "1h": 3_600_000, "15m": 900_000 }).map(([interval, period]) => ({
      interval, candles: Array.from({ length: 200 }, (_, i) => [at - period * (200 - i), 9990, 10000, 9950, 9980, 50, 20]),
    })) },
    timing: { completedAt: at + 500, validUntil: at + 30_000, totalMs: 500, marketMs: 200, modelMs: 200, verificationMs: 100 },
  };
  const bad = structuredClone(result);
  bad.market.chart[0].candles[199][0] = at;
  await assert.rejects(call("save", { result: bad }), { code: "INVALID_SIGNAL_HISTORY" });
  await assert.rejects(call("save", { result }), /write interrupted/);
  assert.equal(client.objects.size, 1);
  assert.deepEqual(await call("save", { result }), { analysisId: result.analysisId });
  await call("save", { result });
  await assert.rejects(call("save", { result: { ...result, symbol: "ETHUSDT" } }), { code: "RESOURCE_EXISTS" });
  assert.equal(client.objects.size, 2);
  const newer = { ...result, analysisId: "9dfd9c18-050e-4923-b58f-60b8421bb08c", timing: { ...result.timing, completedAt: at + 1000 } };
  await call("save", { result: newer });
  const first = await call("list");
  assert.deepEqual(first.entries.map(e => e.analysisId), [newer.analysisId]);
  assert.equal(first.entries[0].market, undefined);
  const second = await call("list", { cursor: first.nextCursor });
  assert.deepEqual(second.entries.map(e => e.analysisId), [result.analysisId]);
  assert.equal(second.nextCursor, null);
  assert.deepEqual((await call("get", { analysisId: result.analysisId })).result, result);
});

test("private content store can overwrite server-owned assessment results", async () => {
  const client = fakeOssClient();
  const store = await createPrivateResourceContentStore({
    env: contentEnv(),
    credentials: { accessKeyId: "test-id", accessKeySecret: "test-secret" },
    client,
    publicClient: client,
  });

  const path = "fc/english-assessment/user/episode/latest.json";
  await store.putJson(path, { status: "grading" });
  await store.putJson(path, { status: "completed", score: 32 });
  assert.deepEqual(await store.readJson(path), { status: "completed", score: 32 });
});

test("private index updates serialize concurrent publishers without losing changes", async () => {
  const client = fakeOssClient();
  const store = await createPrivateResourceContentStore({
    env: contentEnv(),
    credentials: { accessKeyId: "test-id", accessKeySecret: "test-secret" },
    client,
    publicClient: client,
  });

  const path = "/private/collections/example/index.json";
  const options = {
    missing: { schemaVersion: 1, items: [] },
    validate: (value) => value?.schemaVersion === 1 && Array.isArray(value.items),
  };

  await Promise.all([
    store.updateJson(path, options, (index) => {
      index.items.push({ itemId: "a" });
      return index;
    }),
    store.updateJson(path, options, (index) => {
      index.items.push({ itemId: "b" });
      return index;
    }),
  ]);

  const saved = await store.readJson(path);
  assert.deepEqual(saved.items.map((item) => item.itemId).sort(), ["a", "b"]);
  assert.equal(client.objects.has("private/collections/example/index.json.upload-lock"), false);
});
