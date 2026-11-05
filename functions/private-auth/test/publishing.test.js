import assert from "node:assert/strict";
import test from "node:test";
import { handlePublishing } from "../publishing.js";
import { __test, createHandler } from "../index.js";
const NOW = 1787932800;
const key = Buffer.alloc(32, 7);
function fixture() {
  let doc;
  const objects = new Map();
  const contentTypes = new Map();
  const contentStore = {
    async syncPublished() {},
    async readJson(_path, { missing } = {}) { return structuredClone(doc ?? missing); },
    async updateJson(_path, { missing, validate, afterWrite }, change) { const current = structuredClone(doc ?? missing); assert.ok(validate(current)); doc = structuredClone(change(current)); if (afterWrite) await afterWrite(doc); return structuredClone(doc); },
    signUpload(path, file) { contentTypes.set(path, file.contentType); return `https://upload.example/${path}`; },
    async stat(path) { const item = objects.get(path); if (!item) throw new Error("missing upload"); return { bytes: item.length, contentType: contentTypes.get(path) }; },
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

test("HTTP publishing preserves validation errors and hides unexpected storage failures", async () => {
  const { contentStore } = fixture();
  const env = { WEBAUTHN_ORIGIN: "https://yanxiao.me", WEBAUTHN_RP_ID: "yanxiao.me",
    WEBAUTHN_CREDENTIAL_ID: Buffer.from("owner").toString("base64url"),
    WEBAUTHN_PUBLIC_KEY: Buffer.alloc(77, 9).toString("base64url"),
    SESSION_CURRENT_KEY: key.toString("base64url"), CDN_AUTH_KEY: "PrivateCdnKey123456", SESSION_VERSION: "1" };
  const session = __test.encryptToken({ kind: "session", sub: "owner", version: "1", csrf: "test-csrf", iat: NOW, exp: NOW + 3600 }, key);
  const handler = createHandler({ env, contentStore, now: () => NOW });
  const request = (operation, body) => handler({ method: "POST", path: `/api/private-auth/publishing/${operation}`,
    headers: { origin: env.WEBAUTHN_ORIGIN, cookie: `__Secure-private_auth=${session}`, "x-csrf-token": "test-csrf" },
    body: JSON.stringify(body) });
  for (const body of [{ name: "clip.exe", bytes: 1024 }, { name: "clip.constructor", bytes: 1024 }, { name: "clip.mp4", bytes: 1024 * 1024 * 1024 + 1 }]) {
    const result = await request("upload-init", body);
    assert.equal(result.statusCode, 400, result.body);
    assert.equal(JSON.parse(result.body).code, "INVALID_MEDIA");
    assert.doesNotMatch(JSON.parse(result.body).message, /service is unavailable/);
  }
  const invalidToken = await request("upload-complete", { uploadToken: "expired-or-invalid" });
  assert.equal(invalidToken.statusCode, 400, invalidToken.body);
  assert.equal(JSON.parse(invalidToken.body).code, "INVALID_UPLOAD_TOKEN");
  const upload = await request("upload-init", { name: "clip.mp4", bytes: 24 });
  assert.equal(upload.statusCode, 200, upload.body);
  contentStore.signUpload = () => { throw new Error("internal storage details must stay private"); };
  const unavailable = await request("upload-init", { name: "clip.mp4", bytes: 24 });
  assert.equal(unavailable.statusCode, 500);
  assert.deepEqual(JSON.parse(unavailable.body), { code: "INTERNAL_ERROR", message: "Private authentication service is unavailable" });
});

test("mainstream video containers accept uppercase extensions and verify the uploaded container", async () => {
  const bmff = Buffer.from("000000186674797069736f6d0000000069736f6d6d703432", "hex");
  const ebml = type => Buffer.concat([Buffer.from("1a45dfa3a3428280", "hex").subarray(0, 7), Buffer.from([0x80 | type.length]), Buffer.from(type)]);
  const packetStream = size => { const bytes = Buffer.alloc(size * 3); for (let i = 0; i < 3; i++) bytes[i * size + (size === 192 ? 4 : 0)] = 0x47; return bytes; };
  const cases = [
    ...["mp4", "m4v", "mov", "f4v", "3gp", "3g2"].map(extension => [extension, bmff]),
    ["webm", ebml("webm")], ["mkv", ebml("matroska")],
    ["avi", Buffer.from("524946462000000041564920", "hex")],
    ...["wmv", "asf"].map(extension => [extension, Buffer.from("3026b2758e66cf11a6d900aa0062ce6c", "hex")]),
    ["flv", Buffer.from("464c5601050000000900000000", "hex")],
    ...["mpg", "mpeg", "mpe", "m2v", "vob"].map(extension => [extension, Buffer.from("000001ba4400040004010000", "hex")]),
    ["ts", packetStream(188)], ["mts", packetStream(192)], ["m2ts", packetStream(192)],
    ["ogv", Buffer.from("4f6767530002000000000000", "hex")],
    ...["rm", "rmvb"].map(extension => [extension, Buffer.concat([Buffer.from(".RMF"), Buffer.alloc(14)])]),
  ];
  const { call, objects } = fixture();
  const { uploadFormats } = await call("publishing/list");
  assert.deepEqual(uploadFormats.filter(f => f.kind === "video").map(f => f.extension).sort(), cases.map(([ext]) => ext).sort());
  for (const [extension, bytes] of cases) {
    const upload = await call("publishing/upload-init", { name: `clip.${extension.toUpperCase()}`, bytes: bytes.length });
    const path = upload.files.file.path;
    objects.set(path, Buffer.alloc(bytes.length));
    await assert.rejects(call("publishing/upload-complete", { uploadToken: upload.uploadToken }), { code: "INVALID_MEDIA" }, extension);
    objects.set(path, bytes);
    const { asset } = await call("publishing/upload-complete", { uploadToken: upload.uploadToken });
    assert.equal(asset.kind, "video", extension);
    assert.equal(asset.format, extension);
    assert.equal(asset.contentType, uploadFormats.find(f => f.extension === extension).contentType);
  }
  assert.equal((await call("publishing/list")).assets.length, cases.length);
  assert.equal((await call("public/content")).entries.length, 0);
});

test("legacy MOV headers are accepted but renaming unrelated files does not bypass container checks", async () => {
  const { call, objects, contentStore } = fixture();
  const bytes = Buffer.from("0000000877696465000000106d6461740000000000000000", "hex");
  const upload = await call("publishing/upload-init", { name: "camera.mov", bytes: bytes.length });
  objects.set(upload.files.file.path, bytes);
  const { asset } = await call("publishing/upload-complete", { uploadToken: upload.uploadToken });
  assert.equal(asset.format, "mov");
  contentStore.stat = async () => ({ bytes: bytes.length, contentType: "text/html" });
  await assert.rejects(call("publishing/upload-complete", { uploadToken: upload.uploadToken }), { code: "INVALID_MEDIA" });
  for (const name of ["renamed.avi", "renamed.webm", "renamed.mp4"]) {
    const renamed = await call("publishing/upload-init", { name, bytes: bytes.length });
    contentStore.stat = async () => ({ bytes: bytes.length });
    objects.set(renamed.files.file.path, bytes);
    await assert.rejects(call("publishing/upload-complete", { uploadToken: renamed.uploadToken }), { code: "INVALID_MEDIA" });
  }
});

test("drafts do not sync public OSS; failed publication can be repaired from authoritative snapshots", async () => {
  const { call, contentStore } = fixture();
  const snapshots = [];
  contentStore.syncPublished = async doc => { snapshots.push(structuredClone(doc)); throw new Error("public OSS unavailable"); };
  const { entry } = await call("publishing/save", draft);
  assert.equal(snapshots.length, 0);
  await assert.rejects(call("publishing/publish", { id: entry.id, version: entry.version }), { code: "PUBLIC_SYNC_PENDING", statusCode: 409 });
  const saved = (await call("publishing/list")).entries[0];
  assert.equal(saved.published.body, draft.body);
  await call("publishing/save", { ...saved, body: "Later private changes" });
  contentStore.syncPublished = async doc => snapshots.push(structuredClone(doc));
  await call("publishing/sync-public");
  assert.equal(snapshots.at(-1).entries[0].published.body, draft.body);
  assert.equal(snapshots.at(-1).entries[0].body, "Later private changes");
  await assert.rejects(call("publishing/sync-public", {}, { user: { role: "member" } }), { statusCode: 403 });
});
