import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const notesDir = path.join(root, "src/content/notes");
const publicDir = path.join(root, "public");
const generatedDir = path.join(root, ".generated");
const siteUrl = "https://yanxiao.me";

function escapeXml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function parseFrontMatter(source, fallbackSlug) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") return null;
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end === -1) return null;

  const data = {};
  let currentList = null;
  for (const line of lines.slice(1, end)) {
    const listItem = line.match(/^\s*-\s+(.+)$/);
    if (listItem && currentList) {
      data[currentList] ??= [];
      data[currentList].push(listItem[1].trim());
      continue;
    }

    const field = line.match(/^([\w-]+):\s*(.*)$/);
    if (!field) continue;
    const [, key, raw] = field;
    const value = raw.trim().replace(/^["']|["']$/g, "");
    if (value) {
      data[key] = value;
      currentList = null;
    } else {
      data[key] = [];
      currentList = key;
    }
  }

  if (data.draft === "true") return null;
  return {
    title: data.title ?? fallbackSlug,
    slug: data.slug ?? fallbackSlug,
    summary: data.summary ?? data.excerpt ?? "",
    date: data.date ?? "",
    updated: data.updated ?? data.date ?? "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    content: lines.slice(end + 1).join("\n").trim(),
  };
}

function canonicalRoute(route) {
  if (route === "/") return "/";
  return `${route.replace(/\/+$/, "")}/`;
}

await mkdir(publicDir, { recursive: true });
await mkdir(generatedDir, { recursive: true });

const filenames = (await readdir(notesDir)).filter((name) => name.endsWith(".md"));
const notes = [];
for (const filename of filenames) {
  const source = await readFile(path.join(notesDir, filename), "utf8");
  const note = parseFrontMatter(source, filename.replace(/\.md$/, ""));
  if (note) notes.push(note);
}
notes.sort((a, b) => new Date(b.updated || b.date) - new Date(a.updated || a.date));

const rssItems = notes
  .map((note) => {
    const link = `${siteUrl}${canonicalRoute(`/notes/${encodeURIComponent(note.slug)}`)}`;
    const published = new Date(`${note.date || note.updated}T00:00:00+08:00`).toUTCString();
    return `    <item>\n      <title>${escapeXml(note.title)}</title>\n      <link>${escapeXml(link)}</link>\n      <guid isPermaLink="true">${escapeXml(link)}</guid>\n      <pubDate>${published}</pubDate>\n      <description>${escapeXml(note.summary)}</description>\n${note.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`).join("\n")}\n    </item>`;
  })
  .join("\n");

const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>彦骁的笔记</title>\n    <link>${siteUrl}/</link>\n    <description>技术、AI、金融市场，以及一些值得长期留下来的记录。</description>\n    <language>zh-cn</language>\n    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />\n${rssItems}\n  </channel>\n</rss>\n`;

const publicRoutes = [
  "/",
  "/notes",
  "/fragments",
  "/about",
  "/now",
  "/timeline",
  "/wedding",
  ...notes.map((note) => `/notes/${note.slug}`),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicRoutes
  .map((route) => {
    const note = notes.find((item) => route === `/notes/${item.slug}`);
    const lastmod = note?.updated || note?.date || new Date().toISOString().slice(0, 10);
    return `  <url>\n    <loc>${escapeXml(`${siteUrl}${canonicalRoute(route)}`)}</loc>\n    <lastmod>${escapeXml(lastmod)}</lastmod>\n  </url>`;
  })
  .join("\n")}\n</urlset>\n`;

const robots = `User-agent: *\nAllow: /\nDisallow: /auth\nDisallow: /resources\nDisallow: /private/\nSitemap: ${siteUrl}/sitemap.xml\n`;

const assistantContext = {
  schemaVersion: 1,
  home: {
    path: "/",
    title: "彦骁的笔记",
    summary: "技术、AI、金融市场，以及一些值得长期留下来的记录。",
    content: [
      "这是 yanxiao.me 的首页，记录彦骁在技术、AI、金融市场和日常生活中的思考。",
      "首页最近更新的文章如下：",
      ...notes.slice(0, 8).map((note) =>
        `- ${note.title}（${note.updated || note.date}，${note.tags.join("、") || "未分类"}）：${note.summary}`),
    ].join("\n"),
  },
  notes: notes.map((note) => ({
    path: `/notes/${note.slug}`,
    title: note.title,
    summary: note.summary,
    content: note.content,
  })),
};

const routeShells = [
  "/notes",
  "/fragments",
  "/about",
  "/now",
  "/timeline",
  "/wedding",
  "/auth",
  "/resources",
  "/resources/clipboard",
  "/resources/new",
  "/resources/upload",
  "/learning/english",
  ...notes.map((note) => `/notes/${note.slug}`),
];

await writeFile(path.join(publicDir, "feed.xml"), rss, "utf8");
await writeFile(path.join(publicDir, "sitemap.xml"), sitemap, "utf8");
await writeFile(path.join(publicDir, "robots.txt"), robots, "utf8");
await writeFile(path.join(publicDir, "ai-assistant-context.json"), `${JSON.stringify(assistantContext)}\n`, "utf8");
await writeFile(path.join(generatedDir, "route-shells.txt"), `${routeShells.join("\n")}\n`, "utf8");

console.log(
  `Generated feed.xml (${notes.length} notes), sitemap.xml, robots.txt, AI assistant context and ${routeShells.length} route shells`,
);
