import {
  Children,
  isValidElement,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { Check, Copy } from "lucide-react";

import { headingId } from "@/lib/markdown";

type MarkdownRendererProps = {
  content: string;
};

type TableAlignment = "left" | "center" | "right" | null;

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; language: string; code: string }
  | { type: "quote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][]; alignments: TableAlignment[] }
  | { type: "rule" };

function parseTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function parseTableAlignment(cell: string): TableAlignment {
  const value = cell.trim();
  const left = value.startsWith(":");
  const right = value.endsWith(":");

  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return null;
}

function isTableSeparator(line: string): boolean {
  if (!line.includes("|")) return false;
  const cells = parseTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function startsTable(lines: string[], index: number): boolean {
  return index + 1 < lines.length && lines[index].includes("|") && isTableSeparator(lines[index + 1]);
}

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      blocks.push({
        type: "code",
        language,
        code: codeLines.join("\n"),
      });
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);

    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2],
      });
      index += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];

      while (index < lines.length && lines[index].startsWith("> ")) {
        quoteLines.push(lines[index].slice(2));
        index += 1;
      }

      blocks.push({ type: "quote", text: quoteLines.join(" ") });
      continue;
    }

    if (startsTable(lines, index)) {
      const headers = parseTableRow(line);
      const separatorCells = parseTableRow(lines[index + 1]);
      const alignments = headers.map((_, columnIndex) =>
        parseTableAlignment(separatorCells[columnIndex] ?? "---"),
      );
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
        const cells = parseTableRow(lines[index]);
        rows.push(headers.map((_, columnIndex) => cells[columnIndex] ?? ""));
        index += 1;
      }

      blocks.push({ type: "table", headers, rows, alignments });
      continue;
    }

    const unorderedItem = line.match(/^[-*]\s+(.+)$/);
    const orderedItem = line.match(/^\d+\.\s+(.+)$/);

    if (unorderedItem || orderedItem) {
      const ordered = Boolean(orderedItem);
      const items: string[] = [];

      while (index < lines.length) {
        const item = ordered
          ? lines[index].match(/^\d+\.\s+(.+)$/)
          : lines[index].match(/^[-*]\s+(.+)$/);

        if (!item) {
          break;
        }

        items.push(item[1]);
        index += 1;
      }

      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraphLines = [line.trim()];
    index += 1;

    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,4})\s+/.test(lines[index]) &&
      !lines[index].startsWith("```") &&
      !lines[index].startsWith("> ") &&
      !/^[-*]\s+/.test(lines[index]) &&
      !/^\d+\.\s+/.test(lines[index]) &&
      !/^---+$/.test(lines[index].trim()) &&
      !startsTable(lines, index)
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const tokenPattern =
    /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

  return text.split(tokenPattern).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          className="rounded-md border border-cyan-300/10 bg-cyan-300/[0.07] px-1.5 py-0.5 font-mono text-[0.88em] text-cyan-200"
          key={index}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong className="font-semibold text-slate-100" key={index}>
          {part.slice(2, -2)}
        </strong>
      );
    }

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

    if (link) {
      const href = /^(https?:\/\/|\/|#)/.test(link[2]) ? link[2] : "#";
      const external = /^https?:\/\//.test(href);

      return (
        <a
          className="text-cyan-300 underline decoration-cyan-300/30 underline-offset-4 transition hover:text-cyan-200"
          href={href}
          key={index}
          rel={external ? "noopener noreferrer" : undefined}
          target={external ? "_blank" : undefined}
        >
          {link[1]}
        </a>
      );
    }

    return part;
  });
}

function CodeBlock({
  code,
  language,
}: {
  code: string;
  language: string;
}): JSX.Element {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-white/10 bg-[#05070d]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-600">
          {language || "text"}
        </span>
        <button
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
          onClick={copyCode}
          type="button"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 text-sm leading-7 text-slate-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function TableBlock({
  alignments,
  headers,
  rows,
}: {
  alignments: TableAlignment[];
  headers: string[];
  rows: string[][];
}): JSX.Element {
  const alignmentClass = (alignment: TableAlignment) => {
    if (alignment === "center") return "text-center";
    if (alignment === "right") return "text-right";
    return "text-left";
  };

  return (
    <div className="my-8 w-full overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
      <table className="min-w-full border-collapse text-sm text-slate-300">
        <thead className="bg-white/[0.045] text-slate-100">
          <tr>
            {headers.map((header, columnIndex) => (
              <th
                className={`whitespace-nowrap border-b border-white/10 px-4 py-3 font-semibold ${alignmentClass(alignments[columnIndex])}`}
                key={columnIndex}
                scope="col"
              >
                {renderInline(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr className="border-b border-white/[0.06] last:border-b-0" key={rowIndex}>
              {row.map((cell, columnIndex) => (
                <td
                  className={`whitespace-nowrap px-4 py-3 ${alignmentClass(alignments[columnIndex])}`}
                  key={columnIndex}
                >
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MarkdownRenderer({
  content,
}: MarkdownRendererProps): JSX.Element {
  const blocks = parseBlocks(content);

  return (
    <div className="note-content">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const id = headingId(block.text);
          const contentNode = renderInline(block.text);
          const className =
            "group scroll-mt-28 font-semibold tracking-tight text-white";

          if (block.level === 1) {
            return (
              <h1 className={`${className} mt-12 text-3xl`} id={id} key={index}>
                {contentNode}
              </h1>
            );
          }

          if (block.level === 2) {
            return (
              <h2
                className={`${className} mt-14 border-t border-white/10 pt-10 text-2xl`}
                data-note-heading
                id={id}
                key={index}
              >
                {contentNode}
              </h2>
            );
          }

          return (
            <h3
              className={`${className} mt-10 text-xl`}
              data-note-heading
              id={id}
              key={index}
            >
              {contentNode}
            </h3>
          );
        }

        if (block.type === "code") {
          return (
            <CodeBlock
              code={block.code}
              key={index}
              language={block.language}
            />
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote
              className="my-7 border-l-2 border-violet-400 bg-violet-400/[0.06] px-5 py-4 text-sm leading-7 text-slate-300"
              key={index}
            >
              {renderInline(block.text)}
            </blockquote>
          );
        }

        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";

          return (
            <List
              className={`my-6 space-y-2 pl-6 text-[15px] leading-7 text-slate-300 ${
                block.ordered ? "list-decimal" : "list-disc"
              }`}
              key={index}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </List>
          );
        }

        if (block.type === "table") {
          return (
            <TableBlock
              alignments={block.alignments}
              headers={block.headers}
              key={index}
              rows={block.rows}
            />
          );
        }

        if (block.type === "rule") {
          return <hr className="my-10 border-white/10" key={index} />;
        }

        const children = renderInline(block.text);

        return (
          <p className="my-6 text-[15px] leading-8 text-slate-300" key={index}>
            {Children.map(children, (child) =>
              isValidElement(child) ? child : child,
            )}
          </p>
        );
      })}
    </div>
  );
}
