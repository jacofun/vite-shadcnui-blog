import assert from "node:assert/strict";
import test from "node:test";
import { handlePublishing } from "../publishing.js";
import { __test, createHandler } from "../index.js";
const NOW = 1787932800;
const key = Buffer.alloc(32, 7);
function fixture() {
  let doc;
  const objects = new Map();
  const contentStore = {
    async readJson(_path, { missing } = {}) { return structuredClone(doc ?? missing); },
    async updateJson(_path, { missing, validate }, change) { const current = structuredClone(doc ?? missing); assert.ok(validate(current)); doc = structuredClone(change(current)); return structuredClone(doc); },
    signUpload(path) { return `https://upload.example/${path}`; },
    async stat(path) { const item = objects.get(path); if (!item) throw new Error("missing upload"); return { bytes: item.length, contentType: path.endsWith(".mp4") ? "video/mp4" : "image/png" }; },
    async readPrefix(path) { return objects.get(path); },
  };
  const args = { user: { id: "owner", role: "owner" }, config: { privateRoot: "/private", currentSessionKey: key }, contentStore, nowSeconds: NOW,
    encryptToken: __test.encryptToken, decryptToken: __test.decryptToken, signPath: path => `https://cdn.example${path}?signed=yes` };
  return { objects, contentStore, args, call: (route, body = {}, extra = {}) => handlePublishing({ ...args, route, body, ...extra }) };
}
const draft = { type: "article", title: "A text-only article", body: "Private draft text", assetIds: [] };

test("text-only drafts stay private; publish snapshots survive later edits and can be withdrawn", async () => {
  const { call } = fixture();
  let { entry } = await call("publishing/save", draft);
  assert.equal((await call("public/content")).entries.length, 0);
  ({ entry } = await call("publishing/publish", { id: entry.id, version: entry.version }));
  assert.equal((await call("public/content")).entries[0].body, draft.body);
  ({ entry } = await call("publishing/save", { ...entry, body: "Unpublished revision" }));
  assert.equal((await call("public/content")).entries[0].body, draft.body);
  ({ entry } = await call("publishing/publish", { id: entry.id, version: entry.version }));
  assert.equal((await call("public/content")).entries[0].body, "Unpublished revision");
  await call("publishing/unpublish", { id: entry.id, version: entry.version });
  assert.deepEqual((await call("public/content")).entries, []);
});

test("publishing is owner-only and stale editor versions cannot overwrite newer drafts", async () => {
  const { call } = fixture();
  for (const role of ["member", undefined]) {
    await assert.rejects(call("publishing/list", {}, { user: role ? { role, permissions: ["private-resources-write"] } : undefined }), { statusCode: 403 });
  }
  const { entry } = await call("publishing/save", draft);
  await assert.rejects(call("publishing/save", { ...entry, version: 0 }), { code: "CONTENT_CHANGED" });
  await assert.rejects(call("publishing/publish", { id: entry.id, version: 0 }), { code: "CONTENT_CHANGED" });
  await assert.rejects(call("publishing/save", { ...draft, assetIds: ["/private/existing-secret.pdf"] }), { code: "INVALID_MEDIA" });
});

test("media upload verifies bytes and magic, stays private until selected for publication, and completes idempotently", async () => {
  const { call, objects } = fixture();
  const bytes = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
  const upload = await call("publishing/upload-init", { name: "photo.png", bytes: bytes.length });
  const path = upload.files.file.path;
  objects.set(path, Buffer.alloc(bytes.length));
  await assert.rejects(call("publishing/upload-complete", { uploadToken: upload.uploadToken }), { code: "INVALID_MEDIA" });
  objects.set(path, bytes);
  const { asset } = await call("publishing/upload-complete", { uploadToken: upload.uploadToken });
  await call("publishing/upload-complete", { uploadToken: upload.uploadToken });
  assert.equal((await call("publishing/list")).assets.length, 1);
  assert.deepEqual((await call("public/content")).entries, []);
  let { entry } = await call("publishing/save", { ...draft, assetIds: [asset.id] });
  ({ entry } = await call("publishing/publish", { id: entry.id, version: entry.version }));
  const published = (await call("public/content")).entries[0];
  assert.equal(published.media[0].kind, "image");
  assert.match(published.media[0].url, /signed=yes/);
  assert.equal(published.version, undefined);
  assert.equal(published.published, undefined);
});

test("expired, foreign, unsupported and oversized uploads are rejected", async () => {
  const { call } = fixture();
  for (const name of ["bad.svg", "bad.html", "bad.exe"]) await assert.rejects(call("publishing/upload-init", { name, bytes: 10 }), { code: "INVALID_MEDIA" });
  await assert.rejects(call("publishing/upload-init", { name: "big.jpg", bytes: 21 * 1024 * 1024 }), { code: "INVALID_MEDIA" });
  const upload = await call("publishing/upload-init", { name: "photo.png", bytes: 12 });
  await assert.rejects(call("publishing/upload-complete", { uploadToken: upload.uploadToken }, { nowSeconds: NOW + 901 }), { code: "INVALID_UPLOAD_TOKEN" });
  await assert.rejects(call("publishing/upload-complete", { uploadToken: upload.uploadToken }, { user: { id: "other", role: "owner" } }), { code: "INVALID_UPLOAD_TOKEN" });
});

test("HTTP public reads need no login while publishing requires both login and CSRF", async () => {
  const { contentStore } = fixture();
  const handler = createHandler({ env: { WEBAUTHN_ORIGIN: "https://yanxiao.me", WEBAUTHN_RP_ID: "yanxiao.me", WEBAUTHN_CREDENTIAL_ID: Buffer.from("owner").toString("base64url"), WEBAUTHN_PUBLIC_KEY: Buffer.alloc(77,9).toString("base64url"), SESSION_CURRENT_KEY: key.toString("base64url"), CDN_AUTH_KEY: "PrivateCdnKey123456", SESSION_VERSION: "1" }, contentStore, now: () => NOW,
    generateAuthenticationOptionsImpl: async () => ({ challenge: "test" }), verifyAuthenticationResponseImpl: async () => ({ verified: true, authenticationInfo: { userVerified: true } }) });
  const request = (route, body = {}, cookie, csrf) => ({ method: "POST", path: `/api/private-auth/${route}`, headers: { origin: "https://yanxiao.me", ...(cookie ? { cookie } : {}), ...(csrf ? { "x-csrf-token": csrf } : {}) }, body: JSON.stringify(body) });
  assert.equal((await handler({ method: "GET", path: "/api/private-auth/public/content" })).statusCode, 200);
  assert.equal((await handler(request("publishing/save", draft))).statusCode, 401);
  const challenge = await handler(request("challenge"));
  const verified = await handler(request("verify", { id: Buffer.from("owner").toString("base64url"), type: "public-key", response: {} }, challenge.headers["set-cookie"].split(";")[0]));
  assert.equal(verified.statusCode, 200, verified.body);
  const cookie = verified.headers["set-cookie"].split(";")[0];
  assert.equal((await handler(request("publishing/save", draft, cookie))).statusCode, 403);
  const saved = await handler(request("publishing/save", draft, cookie, JSON.parse(verified.body).csrfToken));
  assert.equal(saved.statusCode, 200, saved.body);
});


test("MP4 upload is verified and published as video, with unselected media excluded", async () => {
  const { call, objects } = fixture();
  const bytes = Buffer.from([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0,105,115,111,109,109,112,52,50]);
  const upload = await call("publishing/upload-init", { name: "clip.mp4", bytes: bytes.length });
  assert.equal(upload.files.file.headers["Content-Type"], "video/mp4");
  objects.set(upload.files.file.path, bytes);
  const { asset } = await call("publishing/upload-complete", { uploadToken: upload.uploadToken });
  const unrelated = await call("publishing/upload-init", { name: "private.png", bytes: 12 });
  objects.set(unrelated.files.file.path, Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]));
  await call("publishing/upload-complete", { uploadToken: unrelated.uploadToken });
  let { entry } = await call("publishing/save", { ...draft, type: "moment", assetIds: [asset.id] });
  await call("publishing/publish", { id: entry.id, version: entry.version });
  const result = (await call("public/content")).entries[0];
  assert.equal(result.media.length, 1);
  assert.equal(result.media[0].kind, "video");
  assert.equal(result.media[0].name, "clip.mp4");
});
