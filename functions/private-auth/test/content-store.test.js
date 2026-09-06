import assert from "node:assert/strict";
import test from "node:test";

import { createPrivateResourceContentStore } from "../index.js";

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
    context: { credentials: { accessKeyId: "test-id", accessKeySecret: "test-secret" } },
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

test("private index updates serialize concurrent publishers without losing changes", async () => {
  const client = fakeOssClient();
  const store = await createPrivateResourceContentStore({
    env: contentEnv(),
    context: { credentials: { accessKeyId: "test-id", accessKeySecret: "test-secret" } },
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
