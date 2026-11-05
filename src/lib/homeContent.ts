import { calculateReadingMinutes, type Note } from "@/lib/notes";
import type { PublishingEntry } from "@/lib/publishing";

export interface HomeMedia {
  kind: "image" | "video";
  url: string;
  alt: string;
}
export interface HomeContent {
  key: string;
  href: string;
  title: string;
  summary: string;
  category: string;
  date: string;
  readingMinutes?: number;
  media: HomeMedia[];
  searchText: string;
}

function imageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return (
    /^https:\/\//i.test(value) ||
    (value.startsWith("/") && !value.startsWith("//"))
  );
}

export function buildHomeContent(
  notes: Note[],
  entries: PublishingEntry[],
): HomeContent[] {
  const local: HomeContent[] = notes.map((note) => ({
    key: `note:${note.slug}`,
    href: `/notes/${note.slug}`,
    title: note.title,
    summary: note.summary,
    category: note.category,
    date: note.updated || note.date,
    readingMinutes: note.readingMinutes,
    searchText: note.searchText,
    media: imageUrl(note.cover)
      ? [{ kind: "image", url: note.cover, alt: note.coverAlt || note.title }]
      : [],
  }));
  // The anonymous API supplies publication snapshots. Drafts are never requested here.
  const published: HomeContent[] = entries
    .filter(
      (entry) =>
        entry &&
        typeof entry.id === "string" &&
        /^[a-f0-9]{32}$/.test(entry.id) &&
        typeof entry.title === "string" &&
        entry.title.trim() &&
        typeof entry.body === "string" &&
        typeof entry.summary === "string" &&
        typeof entry.publishedAt === "string" &&
        Number.isFinite(Date.parse(entry.publishedAt)) &&
        (entry.type === "article" || entry.type === "moment"),
    )
    .map((entry) => ({
      key: `journal:${entry.id}`,
      href: `/journal/${entry.id}`,
      title: entry.title,
      summary: entry.summary,
      category: entry.type === "article" ? "笔记" : "影像碎片",
      date: entry.publishedAt!,
      readingMinutes:
        entry.type === "article"
          ? calculateReadingMinutes(entry.body)
          : undefined,
      searchText: [entry.title, entry.summary, entry.body]
        .join(" ")
        .toLowerCase(),
      media: Array.isArray(entry.media)
        ? entry.media
            .filter(
              (asset) =>
                asset &&
                (asset.kind === "image" || asset.kind === "video") &&
                imageUrl(asset.url),
            )
            .map((asset) => ({
              kind: asset.kind,
              url: asset.url,
              alt: asset.name || entry.title,
            }))
        : [],
    }));
  return [...published, ...local].sort(
    (a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0),
  );
}

export function selectHomeContent(
  items: HomeContent[],
  preferredHref?: string,
  limit = 2,
) {
  const featured =
    items.find((item) => item.href === preferredHref) ||
    items.find((item) => item.media.length > 0) ||
    items[0];
  return {
    featured,
    selected: items
      .filter((item) => item.key !== featured?.key)
      .slice(0, limit),
  };
}
