import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const notesDir = path.join(root, "src/content/notes");
const publicDir = path.join(root, "public");
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
  };
}

await mkdir(publicDir, { recursive: true });
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
    const link = `${siteUrl}/#/notes/${encodeURIComponent(note.slug)}`;
    const published = new Date(`${note.date || note.updated}T00:00:00+08:00`).toUTCString();
    return `    <item>\n      <title>${escapeXml(note.title)}</title>\n      <link>${escapeXml(link)}</link>\n      <guid isPermaLink="true">${escapeXml(link)}</guid>\n      <pubDate>${published}</pubDate>\n      <description>${escapeXml(note.summary)}</description>\n${note.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`).join("\n")}\n    </item>`;
  })
  .join("\n");

const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>彦骁的笔记</title>\n    <link>${siteUrl}/</link>\n    <description>技术、AI、金融市场，以及一些值得长期留下来的记录。</description>\n    <language>zh-cn</language>\n    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />\n${rssItems}\n  </channel>\n</rss>\n`;

// The site currently uses HashRouter. Fragment routes are not useful sitemap URLs,
// so only the canonical document URL is declared here instead of publishing false paths.
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${siteUrl}/</loc>\n    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n  </url>\n</urlset>\n`;

const robots = `User-agent: *\nAllow: /\nDisallow: /private/\nSitemap: ${siteUrl}/sitemap.xml\n`;

await writeFile(path.join(publicDir, "feed.xml"), rss, "utf8");
await writeFile(path.join(publicDir, "sitemap.xml"), sitemap, "utf8");
await writeFile(path.join(publicDir, "robots.txt"), robots, "utf8");

console.log(`Generated feed.xml (${notes.length} notes), sitemap.xml and robots.txt`);
