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
};

export type Note = NoteMeta & {
  content: string;
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

  if (lines[0]?.trim() !== "---") {
    return { attributes: {}, content: source };
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );

  if (closingIndex === -1) {
    return { attributes: {}, content: source };
  }

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

    if (!field) {
      continue;
    }

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

function createNote(path: string, source: string): Note {
  const { attributes, content } = parseFrontMatter(source);
  const fileSlug = path.split("/").pop()?.replace(/\.md$/, "") ?? "untitled";
  const value = (key: string, fallback = "") =>
    typeof attributes[key] === "string" ? attributes[key] : fallback;

  return {
    title: value("title", fileSlug),
    slug: value("slug", fileSlug),
    summary: value("summary"),
    date: value("date"),
    updated: value("updated", value("date")),
    category: value("category", "未分类"),
    tags: Array.isArray(attributes.tags) ? attributes.tags : [],
    draft: value("draft") === "true",
    readingMinutes: calculateReadingMinutes(content),
    content,
  };
}

export const notes = Object.entries(noteModules)
  .map(([path, source]) => createNote(path, source))
  .filter((note) => !note.draft)
  .sort(
    (left, right) =>
      new Date(right.updated).getTime() - new Date(left.updated).getTime(),
  );

export const noteCategories = Array.from(
  new Set(notes.map((note) => note.category)),
);

export function getNoteBySlug(slug: string): Note | undefined {
  return notes.find((note) => note.slug === slug);
}

export function formatNoteDate(date: string): string {
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(`${date}T00:00:00`));
}
