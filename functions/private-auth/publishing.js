import { randomBytes } from "node:crypto";

export class PublishingError extends Error {
  constructor(statusCode, code, message) { super(message); Object.assign(this, { statusCode, code }); }
}
const fail = (status, code, message) => { throw new PublishingError(status, code, message); };
const empty = () => ({ schemaVersion: 1, entries: [], assets: [] });
const valid = (d) => d?.schemaVersion === 1 && Array.isArray(d.entries) && Array.isArray(d.assets);
const formats = {
  jpg: ["image/jpeg", "image"], jpeg: ["image/jpeg", "image"], png: ["image/png", "image"], webp: ["image/webp", "image"],
  mp4: ["video/mp4", "video"], m4v: ["video/mp4", "video"], mov: ["video/quicktime", "video"],
  f4v: ["video/mp4", "video"], "3gp": ["video/3gpp", "video"], "3g2": ["video/3gpp2", "video"],
  webm: ["video/webm", "video"], mkv: ["video/x-matroska", "video"],
  avi: ["video/x-msvideo", "video"], wmv: ["video/x-ms-wmv", "video"], asf: ["video/x-ms-asf", "video"],
  flv: ["video/x-flv", "video"], mpg: ["video/mpeg", "video"], mpeg: ["video/mpeg", "video"],
  mpe: ["video/mpeg", "video"], m2v: ["video/mpeg", "video"], vob: ["video/mpeg", "video"],
  ts: ["video/mp2t", "video"], mts: ["video/mp2t", "video"], m2ts: ["video/mp2t", "video"],
  ogv: ["video/ogg", "video"], rm: ["application/vnd.rn-realmedia", "video"], rmvb: ["application/vnd.rn-realmedia-vbr", "video"],
};
const uploadFormats = Object.entries(formats).map(([extension, [contentType, kind]]) => ({
  extension, contentType, kind, maxBytes: (kind === "image" ? 20 : 1024) * 1024 * 1024,
}));
function text(value, max, required = false) {
  if (typeof value !== "string" || value.length > max || value.includes("\0") || (required && !value.trim())) fail(400, "INVALID_CONTENT", "内容为空或超过长度限制");
  return value;
}
function magic(format, bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12) return false;
  if (format === "jpg" || format === "jpeg") return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (format === "png") return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (format === "webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (["mp4", "m4v", "mov", "f4v", "3gp", "3g2"].includes(format)) {
    // ISO BMFF/QuickTime boxes, including older MOV files without an ftyp box.
    for (let offset = 0; offset + 12 <= bytes.length;) {
      const size = bytes.readUInt32BE(offset);
      const type = bytes.toString("ascii", offset + 4, offset + 8);
      if (size !== 0 && size !== 1 && size < 8) return false;
      if (type === "ftyp") return size >= 16 && bytes.length >= offset + 16;
      if (format === "mov" && ["moov", "mdat"].includes(type)) return true;
      if (!["free", "skip", "wide"].includes(type) || size < 8) return false;
      offset += size;
    }
    return false;
  }
  if (format === "webm" || format === "mkv") {
    if (bytes.readUInt32BE(0) !== 0x1a45dfa3) return false;
    // EBML DocType (0x4282) is in the initial header; exclude unrelated EBML files.
    const docType = format === "webm" ? "webm" : "matroska";
    return bytes.subarray(0, 1024).includes(Buffer.concat([Buffer.from([0x42, 0x82, 0x80 | docType.length]), Buffer.from(docType)]));
  }
  if (format === "avi") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "AVI ";
  if (format === "wmv" || format === "asf") return bytes.subarray(0, 16).equals(Buffer.from("3026b2758e66cf11a6d900aa0062ce6c", "hex"));
  if (format === "flv") return bytes.toString("ascii", 0, 3) === "FLV" && bytes[3] === 1 && bytes.readUInt32BE(5) >= 9;
  if (["mpg", "mpeg", "mpe", "m2v", "vob"].includes(format)) return [0x000001ba, 0x000001b3].includes(bytes.readUInt32BE(0));
  if (["ts", "mts", "m2ts"].includes(format)) {
    // MPEG-TS uses 188-byte packets; cameras also emit 192/204-byte variants.
    return [188, 192, 204].some(size => {
      for (let offset = 0; offset < size && offset + 2 * size < bytes.length; offset++) {
        if ([0, 1, 2].every(index => bytes[offset + index * size] === 0x47)) return true;
      }
      return false;
    });
  }
  if (format === "ogv") return bytes.toString("ascii", 0, 4) === "OggS" && bytes[4] === 0;
  if (format === "rm" || format === "rmvb") return bytes.length >= 18 && bytes.toString("ascii", 0, 4) === ".RMF";
  return false;
}

export async function handlePublishing({ route, body = {}, user, config, contentStore, nowSeconds, encryptToken, decryptToken, signPath }) {
  const root = `${config.privateRoot}/.publishing`;
  const path = `${root}/index.json`;
  const url = (asset) => signPath(asset.path, config, nowSeconds);
  const present = (entry, assets) => ({ ...entry, media: entry.assetIds.map(id => assets.find(a => a.id === id)).filter(Boolean).map(a => ({ id: a.id, kind: a.kind, url: url(a), name: a.name })) });
  if (route === "public/content") {
    const doc = await contentStore.readJson(path, { missing: empty() });
    if (!valid(doc)) fail(503, "INVALID_CONTENT_STORE", "内容暂时不可用");
    return { entries: doc.entries.filter(e => e.published).map(e => present({ ...e.published, id: e.id }, doc.assets)).sort((a,b) => b.publishedAt.localeCompare(a.publishedAt)) };
  }
  if (user?.role !== "owner") fail(403, "MISSING_PERMISSION", "仅站点所有者可以发布内容");
  if (route === "publishing/list") {
    const doc = await contentStore.readJson(path, { missing: empty() });
    if (!valid(doc)) fail(503, "INVALID_CONTENT_STORE", "内容暂时不可用");
    return { entries: doc.entries, assets: doc.assets.map(a => ({ ...a, url: url(a) })), uploadFormats };
  }
  if (route === "publishing/upload-init") {
    const name = text(body.name, 255, true).trim();
    const format = name.split(".").pop().toLowerCase();
    if (!Object.hasOwn(formats, format)) fail(400, "INVALID_MEDIA", "不支持此文件格式，请查看上传区域的支持格式列表");
    const [contentType, kind] = formats[format];
    if (!Number.isSafeInteger(body.bytes) || body.bytes < 1 || body.bytes > (kind === "image" ? 20 : 1024) * 1024 * 1024) fail(400, "INVALID_MEDIA", "图片上限 20MB，视频上限 1GB");
    const id = randomBytes(16).toString("hex");
    const file = { id, name, format, kind, contentType, bytes: body.bytes, path: `${root}/media/${id}.${format}`, uploadedAt: new Date(nowSeconds * 1000).toISOString() };
    const payload = { kind: "publishing-upload", sub: user.id, exp: nowSeconds + 900, file };
    return { uploadToken: encryptToken(payload, config.currentSessionKey), files: { file: { path: file.path, uploadUrl: contentStore.signUpload(file.path, file), headers: { "Content-Type": contentType, "x-oss-forbid-overwrite": "true" } } } };
  }
  if (route === "publishing/upload-complete") {
    const token = decryptToken(body.uploadToken, [config.currentSessionKey, config.previousSessionKey]);
    if (!token || token.kind !== "publishing-upload" || token.sub !== user.id || token.exp <= nowSeconds || !token.file?.path.startsWith(`${root}/media/`)) fail(400, "INVALID_UPLOAD_TOKEN", "上传凭证无效或已过期");
    const file = token.file;
    const meta = await contentStore.stat(file.path);
    if (meta.bytes !== file.bytes || (meta.contentType && meta.contentType.split(";")[0] !== file.contentType) || !magic(file.format, await contentStore.readPrefix(file.path))) fail(409, "INVALID_MEDIA", "文件内容与上传声明不一致");
    await contentStore.updateJson(path, { missing: empty(), validate: valid }, doc => {
      if (!doc.assets.some(a => a.id === file.id)) {
        if (doc.assets.length >= 500) fail(409, "MEDIA_FULL", "素材数量已达到上限");
        doc.assets.unshift(file);
      }
      return doc;
    });
    return { asset: { ...file, url: url(file) } };
  }
  const timestamp = new Date(nowSeconds * 1000).toISOString();
  let result;
  await contentStore.updateJson(path, { missing: empty(), validate: valid }, doc => {
    let entry = body.id ? doc.entries.find(e => e.id === body.id) : null;
    if (body.id && !entry) fail(404, "NOT_FOUND", "内容不存在");
    if (entry && body.version !== entry.version) fail(409, "CONTENT_CHANGED", "内容已在其他页面修改，请重新读取后编辑");
    if (route === "publishing/save") {
      if (!["article", "moment"].includes(body.type)) fail(400, "INVALID_CONTENT", "内容类型无效");
      const assetIds = body.assetIds ?? [];
      if (!Array.isArray(assetIds) || assetIds.length > 12 || new Set(assetIds).size !== assetIds.length || assetIds.some(id => !doc.assets.some(a => a.id === id))) fail(400, "INVALID_MEDIA", "请选择已上传的素材，最多 12 项");
      const draft = { title: text(body.title, 200, true).trim(), summary: text(body.summary ?? "", 500), body: text(body.body ?? "", 30000), type: body.type, assetIds };
      if (!entry) {
        if (doc.entries.length >= 100) fail(409, "CONTENT_FULL", "内容数量已达到上限");
        entry = { id: randomBytes(16).toString("hex"), version: 0, published: null }; doc.entries.unshift(entry);
      }
      Object.assign(entry, draft, { updatedAt: timestamp, version: entry.version + 1 });
    } else {
      if (!entry) fail(404, "NOT_FOUND", "请先保存草稿");
      if (route === "publishing/publish") entry.published = { title: entry.title, summary: entry.summary, body: entry.body, type: entry.type, assetIds: [...entry.assetIds], publishedAt: timestamp };
      else if (route === "publishing/unpublish") entry.published = null;
      else fail(404, "NOT_FOUND", "操作不存在");
      entry.version += 1;
    }
    result = entry;
    return doc;
  });
  return { entry: result };
}
