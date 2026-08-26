export type MarkdownHeading = {
  id: string;
  level: number;
  text: string;
};

export function headingId(text: string): string {
  return text
    .replace(/[*_`]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\u3400-\u9fff\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function extractMarkdownHeadings(
  content: string,
): MarkdownHeading[] {
  return content
    .split("\n")
    .map((line) => line.match(/^(#{2,3})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      id: headingId(match[2]),
      level: match[1].length,
      text: match[2].replace(/[*_`]/g, ""),
    }));
}
