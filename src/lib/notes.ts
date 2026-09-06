export type NoteMeta = {
  title: string;
  slug: string;
  summary: string;
  date: string;
  updated: string;
  category: string;
  tags: string[];
  draft: boolean;
  readingMinutes: number;
  series?: string;
  seriesOrder?: number;
  aiAssisted: boolean;
  aiSummary?: string;
};

export type Note = NoteMeta & {
  content: string;
  searchText: string;
};

const noteModules = import.meta.glob<string>("/src/content/notes/*.md", {
  eager: true,
  import: "default",
  query: "?raw",
});

function parseFrontMatter(source: string): {
  attributes: Record<string, string | string[]>;
  content: string;
} {
  const lines = source.replace(/\r\n/g, "\n").split("\n");

  if (lines[0]?.trim() !== "---") return { attributes: {}, content: source };

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  if (closingIndex === -1) return { attributes: {}, content: source };

  const attributes: Record<string, string | string[]> = {};
  let currentListKey: string | null = null;

  for (const line of lines.slice(1, closingIndex)) {
    const listItem = line.match(/^\s*-\s+(.+)$/);
    if (listItem && currentListKey) {
      const currentValue = attributes[currentListKey];
      attributes[currentListKey] = [
        ...(Array.isArray(currentValue) ? currentValue : []),
        listItem[1].trim(),
      ];
      continue;
    }

    const field = line.match(/^([\w-]+):\s*(.*)$/);
    if (!field) continue;

    const [, key, rawValue] = field;
    const value = rawValue.trim().replace(/^["']|["']$/g, "");
    if (value) {
      attributes[key] = value;
      currentListKey = null;
    } else {
      attributes[key] = [];
      currentListKey = key;
    }
  }

  return {
    attributes,
    content: lines.slice(closingIndex + 1).join("\n").trim(),
  };
}

function calculateReadingMinutes(content: string): number {
  const chineseCharacters = content.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latinWords = content
    .replace(/[\u3400-\u9fff]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(chineseCharacters / 350 + latinWords / 180));
}

function normalizeSearchText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function createNote(path: string, source: string): Note {
  const { attributes, content } = parseFrontMatter(source);
  const fileSlug = path.split("/").pop()?.replace(/\.md$/, "") ?? "untitled";
  const value = (key: string, fallback = "") =>
    typeof attributes[key] === "string" ? attributes[key] : fallback;
  const tags = Array.isArray(attributes.tags) ? attributes.tags : [];
  const seriesOrderValue = Number(value("seriesOrder"));

  const meta = {
    title: value("title", fileSlug),
    slug: value("slug", fileSlug),
    summary: value("summary"),
    date: value("date"),
    updated: value("updated", value("date")),
    category: value("category", "未分类"),
    tags,
    draft: value("draft") === "true",
    readingMinutes: calculateReadingMinutes(content),
    series: value("series") || undefined,
    seriesOrder: Number.isFinite(seriesOrderValue) && seriesOrderValue > 0 ? seriesOrderValue : undefined,
    aiAssisted: value("aiAssisted") === "true",
    aiSummary: value("aiSummary") || undefined,
  } satisfies NoteMeta;

  return {
    ...meta,
    content,
    searchText: normalizeSearchText(
      [meta.title, meta.summary, meta.category, ...meta.tags, content].join(" "),
    ),
  };
}

export const notes = Object.entries(noteModules)
  .map(([path, source]) => createNote(path, source))
  .filter((note) => !note.draft)
  .sort(
    (left, right) =>
      new Date(right.updated).getTime() - new Date(left.updated).getTime(),
  );

export const noteCategories = Array.from(new Set(notes.map((note) => note.category)));
export const noteTags = Array.from(new Set(notes.flatMap((note) => note.tags))).sort((a, b) =>
  a.localeCompare(b, "zh-CN"),
);

export function getNoteBySlug(slug: string): Note | undefined {
  return notes.find((note) => note.slug === slug);
}

export function getSeriesNotes(series: string): Note[] {
  return notes
    .filter((note) => note.series === series)
    .sort((left, right) => (left.seriesOrder ?? 0) - (right.seriesOrder ?? 0));
}

export function getRelatedNotes(note: Note, limit = 3): Note[] {
  return notes
    .filter((candidate) => candidate.slug !== note.slug)
    .map((candidate) => {
      const sharedTags = candidate.tags.filter((tag) => note.tags.includes(tag)).length;
      const categoryScore = candidate.category === note.category ? 2 : 0;
      const seriesScore = note.series && candidate.series === note.series ? 4 : 0;
      return { candidate, score: sharedTags * 2 + categoryScore + seriesScore };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

export function formatNoteDate(date: string): string {
  if (!date) return "";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(`${date}T00:00:00`));
}
