import { Check, Copy } from "lucide-react";
import {
  Children,
  isValidElement,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { headingId } from "@/lib/markdown";

type MarkdownRendererProps = {
  content: string;
};

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textFromNode(node.props.children);
  }
  return "";
}

function CodeBlock({ children }: { children: ReactNode }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const child = Children.toArray(children)[0];
  const codeElement = isValidElement<{ className?: string; children?: ReactNode }>(child)
    ? child
    : null;
  const language = codeElement?.props.className?.match(/language-([^\s]+)/)?.[1] ?? "text";
  const code = textFromNode(codeElement?.props.children ?? children).replace(/\n$/, "");

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-white/10 bg-[#05070d]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-600">
          {language}
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
      <pre className="overflow-x-auto p-5 text-sm leading-7 text-slate-300">{children}</pre>
    </div>
  );
}

const headingClass = "group scroll-mt-28 font-semibold tracking-tight text-white";

const components: Components = {
  h1: ({ children }) => (
    <h1 className={`${headingClass} mt-12 text-3xl`} id={headingId(textFromNode(children))}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      className={`${headingClass} mt-14 border-t border-white/10 pt-10 text-2xl`}
      data-note-heading
      id={headingId(textFromNode(children))}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      className={`${headingClass} mt-10 text-xl`}
      data-note-heading
      id={headingId(textFromNode(children))}
    >
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className={`${headingClass} mt-8 text-lg`} id={headingId(textFromNode(children))}>
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="my-6 text-[15px] leading-8 text-slate-300">{children}</p>
  ),
  strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
  em: ({ children }) => <em className="text-slate-200">{children}</em>,
  del: ({ children }) => <del className="text-slate-500 decoration-slate-500">{children}</del>,
  a: ({ children, href }) => {
    const external = typeof href === "string" && /^https?:\/\//.test(href);
    return (
      <a
        className="text-cyan-300 underline decoration-cyan-300/30 underline-offset-4 transition hover:text-cyan-200"
        href={href}
        rel={external ? "noopener noreferrer" : undefined}
        target={external ? "_blank" : undefined}
      >
        {children}
      </a>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="my-7 border-l-2 border-violet-400 bg-violet-400/[0.06] px-5 py-4 text-sm leading-7 text-slate-300 [&>p]:my-0">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => (
    <ul className="my-6 list-disc space-y-2 pl-6 text-[15px] leading-7 text-slate-300">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-6 list-decimal space-y-2 pl-6 text-[15px] leading-7 text-slate-300">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-1 [&>p]:my-0">{children}</li>,
  hr: () => <hr className="my-10 border-white/10" />,
  code: ({ children, className }) => {
    if (className?.startsWith("language-")) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="rounded-md border border-cyan-300/10 bg-cyan-300/[0.07] px-1.5 py-0.5 font-mono text-[0.88em] text-cyan-200">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  table: ({ children }) => (
    <div className="my-8 w-full overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
      <table className="min-w-full border-collapse text-sm text-slate-300">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/[0.045] text-slate-100">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-white/[0.06] last:border-b-0">{children}</tr>,
  th: ({ children, style }) => (
    <th
      className="whitespace-nowrap border-b border-white/10 px-4 py-3 font-semibold"
      scope="col"
      style={style}
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td className="whitespace-nowrap px-4 py-3" style={style}>
      {children}
    </td>
  ),
  input: ({ type, checked, disabled }) => (
    <input
      checked={checked}
      className="mr-2 accent-cyan-300"
      disabled={disabled}
      readOnly
      type={type}
    />
  ),
  img: ({ alt, src }) => (
    <img
      alt={alt ?? ""}
      className="my-8 max-h-[32rem] w-auto max-w-full rounded-2xl border border-white/10 object-contain"
      loading="lazy"
      src={src}
    />
  ),
};

export default function MarkdownRenderer({ content }: MarkdownRendererProps): JSX.Element {
  return (
    <div className="note-content">
      <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
