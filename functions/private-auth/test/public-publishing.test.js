import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { createPublicPublisher } from "../public-publishing.js";

function fixture() {
  const objects = new Map(), copied = [], headers = new Map();
  const missing = () => Object.assign(new Error("missing"), { code: "NoSuchKey" });
  const source = { async getStream(path) { copied.push(path); return { stream: Readable.from([Buffer.from("image")]) }; } };
  const client = {
    async get(path) { if (!objects.has(path)) throw missing(); return { content: objects.get(path) }; },
    async head(path) { if (!objects.has(path)) throw missing(); return { res: { headers: { "content-length": objects.get(path).length } } }; },
    async putStream(path, stream, options) { const chunks = []; for await (const chunk of stream) chunks.push(chunk); objects.set(path, Buffer.concat(chunks)); headers.set(path, options); },
    async put(path, content, options) { objects.set(path, content); headers.set(path, options); },
    async delete(path) { objects.delete(path); },
  };
  const env = { PUBLISHING_PUBLIC_BUCKET: "website", PUBLISHING_PUBLIC_REGION: "oss-cn-beijing", PUBLISHING_PUBLIC_PREFIX: "site/published" };
  const a = { id: "a".repeat(32), format: "jpg", kind: "image", name: "photo.jpg", path: "/private/secret/photo.jpg", bytes: 5, contentType: "image/jpeg" };
  const b = { ...a, id: "b".repeat(32), path: "/private/unselected.jpg" };
  const p = { title: "Published", summary: "Summary", body: "Public body", type: "moment", publishedAt: "2026-11-05T00:00:00Z", assetIds: [a.id] };
  const doc = { schemaVersion: 1, entries: [{ id: "c".repeat(32), title: "Unpublished changes", body: "SECRET DRAFT", published: p }, { id: "d".repeat(32), body: "SECRET DRAFT", published: null }], assets: [a, b] };
  return { objects, copied, headers, source, client, env, doc, a };
}

test("public OSS contains only publication snapshots and selected originals, with stable unsigned URLs", async () => {
  const f = fixture(), sync = await createPublicPublisher(f);
  await sync(f.doc);
  const text = f.objects.get("site/published/content.json").toString();
  assert.doesNotMatch(text, /SECRET|private\/|assetIds|auth_key|Unpublished/);
  const data = JSON.parse(text);
  assert.equal(data.entries.length, 1);
  assert.equal(data.entries[0].title, "Published");
  assert.equal(data.entries[0].media[0].url, `https://yanxiao.me/published/media/${f.a.id}.jpg`);
  assert.deepEqual(f.copied, ["private/secret/photo.jpg"]);
  assert.match(f.headers.get("site/published/content.json").headers["Cache-Control"], /no-cache/);
  await sync(f.doc);
  assert.equal(f.copied.length, 1, "unchanged originals are reused");
  f.doc.entries[0].published = null;
  await sync(f.doc);
  assert.deepEqual(JSON.parse(f.objects.get("site/published/content.json")).entries, []);
  assert.equal(f.objects.has(`site/published/media/${f.a.id}.jpg`), false);
});

test("failed media copy leaves the existing public response intact and can be retried", async () => {
  const f = fixture();
  f.objects.set("site/published/content.json", Buffer.from('{"entries":[]}'));
  const original = f.client.putStream;
  f.client.putStream = async () => { throw new Error("destination unavailable"); };
  const sync = await createPublicPublisher(f);
  await assert.rejects(sync(f.doc), /destination unavailable/);
  assert.equal(f.objects.get("site/published/content.json").toString(), '{"entries":[]}');
  f.client.putStream = original;
  await sync(f.doc);
  assert.equal(JSON.parse(f.objects.get("site/published/content.json")).entries.length, 1);
});

test("withdrawing one entry retains originals still referenced by another publication", async () => {
  const f = fixture(), sync = await createPublicPublisher(f);
  f.doc.entries.push({ id: "e".repeat(32), published: structuredClone(f.doc.entries[0].published) });
  await sync(f.doc);
  f.doc.entries[0].published = null;
  await sync(f.doc);
  assert.equal(f.objects.has(`site/published/media/${f.a.id}.jpg`), true);
});
