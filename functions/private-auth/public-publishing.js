// Public materialization runs only on publish/sync, never on visitor requests.
export async function createPublicPublisher({ env, source, client }) {
  if (!env.PUBLISHING_PUBLIC_BUCKET || !env.PUBLISHING_PUBLIC_REGION) return null;
  const prefix = (env.PUBLISHING_PUBLIC_PREFIX || "published").replace(/^\/+|\/+$/g, "");
  const urlPrefix = "published";
  if (!/^[a-zA-Z0-9/_-]+$/.test(prefix) || prefix.split("/").includes("..")) throw new Error("Invalid publishing prefix");
  const origin = new URL(env.PUBLISHING_PUBLIC_ORIGIN || "https://yanxiao.me");
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("Invalid publishing origin");
  if (!client) {
    const OSS = (await import("ali-oss")).default;
    const region = env.PUBLISHING_PUBLIC_REGION.startsWith("oss-") ? env.PUBLISHING_PUBLIC_REGION : `oss-${env.PUBLISHING_PUBLIC_REGION}`;
    client = new OSS({ bucket: env.PUBLISHING_PUBLIC_BUCKET, region,
      secure: true, accessKeyId: env.PUBLISHING_PUBLIC_ACCESS_KEY_ID, accessKeySecret: env.PUBLISHING_PUBLIC_ACCESS_KEY_SECRET });
  }
  const key = name => `${prefix}/${name}`;
  const url = name => `${origin.origin}/${urlPrefix}/${name}`;
  const missing = error => error?.code === "NoSuchKey" || error?.status === 404;
  return async doc => {
    let previous = { entries: [] };
    try { previous = JSON.parse((await client.get(key("content.json"))).content.toString("utf8")); }
    catch (error) { if (!missing(error)) throw error; }
    const selected = new Map();
    const entries = doc.entries.filter(entry => entry.published).map(entry => {
      const p = entry.published;
      const media = p.assetIds.map(id => doc.assets.find(asset => asset.id === id)).filter(Boolean).map(asset => {
        if (!/^[a-f0-9]{32}$/.test(asset.id) || !/^[a-z0-9]+$/.test(asset.format)) throw new Error("Invalid public media identity");
        selected.set(asset.id, asset);
        return { id: asset.id, name: asset.name, kind: asset.kind, url: url(`media/${asset.id}.${asset.format}`) };
      });
      // Explicit whitelist: never serialize drafts, private paths or upload tokens.
      return { id: entry.id, type: p.type, title: p.title, summary: p.summary, body: p.body, publishedAt: p.publishedAt, media };
    }).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    for (const asset of selected.values()) {
      const destination = key(`media/${asset.id}.${asset.format}`);
      let exists = false;
      try { const result = await client.head(destination); exists = Number(result.res.headers["content-length"]) === asset.bytes; }
      catch (error) { if (!missing(error)) throw error; }
      if (!exists) {
        const result = await source.getStream(asset.path.replace(/^\//, ""), { timeout: 600_000 });
        try { await client.putStream(destination, result.stream, { mime: asset.contentType, contentLength: asset.bytes, timeout: 600_000,
          headers: { "Cache-Control": "public,max-age=60,must-revalidate" } }); }
        finally { result.stream.destroy(); }
      }
    }
    const retained = new Set(entries.flatMap(entry => entry.media.map(asset => asset.url)));
    for (const asset of (previous.entries || []).flatMap(entry => entry.media || [])) {
      const oldUrl = new URL(asset.url);
      if (!retained.has(asset.url) && oldUrl.origin === origin.origin && /^\/published\/media\/[a-f0-9]{32}\.[a-z0-9]+$/.test(oldUrl.pathname)) {
        try { await client.delete(key(oldUrl.pathname.slice(`/${urlPrefix}/`.length))); } catch (error) { if (!missing(error)) throw error; }
      }
    }
    // Replace only after uploads/removals succeed, so failures remain retryable.
    await client.put(key("content.json"), Buffer.from(JSON.stringify({ schemaVersion: 1, entries })), {
      mime: "application/json; charset=utf-8", headers: { "Cache-Control": "no-cache,max-age=0,must-revalidate" },
    });
    return { entries: entries.length, media: selected.size };
  };
}
