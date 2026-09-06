import { Check, Copy, Link2, X } from "lucide-react";
import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { headingId } from "@/lib/markdown";

type MarkdownRendererProps = { content: string };

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textFromNode(node.props.children);
  return "";
}

function revealKind(element: HTMLElement): string {
  if (/^H[1-4]$/.test(element.tagName)) return "heading";
  if (element.tagName === "BLOCKQUOTE") return "quote";
  if (element.tagName === "BUTTON" && element.querySelector("img")) return "media";
  if (element.tagName === "DIV" && (element.querySelector("pre") || element.querySelector("table"))) return "panel";
  return "text";
}

function CodeBlock({ children }: { children: ReactNode }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const child = Children.toArray(children)[0];
  const codeElement = isValidElement<{ className?: string; children?: ReactNode }>(child) ? child : null;
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
        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-600">{language}</span>
        <button className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-white/5 hover:text-slate-200" onClick={copyCode} type="button">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 text-sm leading-7 text-slate-300">{children}</pre>
    </div>
  );
}

const headingClass = "group scroll-mt-28 font-semibold tracking-tight text-white";

function HeadingWithCopy({ children, level }: { children: ReactNode; level: 1 | 2 | 3 | 4 }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const text = textFromNode(children);
  const id = headingId(text);
  const className =
    level === 1
      ? `${headingClass} mt-12 text-3xl`
      : level === 2
        ? `${headingClass} mt-14 border-t border-white/10 pt-10 text-2xl`
        : level === 3
          ? `${headingClass} mt-10 text-xl`
          : `${headingClass} mt-8 text-lg`;

  const copyAnchor = async () => {
    const routeHash = window.location.hash.split("?")[0];
    const url = `${window.location.origin}${window.location.pathname}${routeHash}?section=${encodeURIComponent(id)}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const content = (
    <>
      {children}
      <button
        aria-label={`复制“${text}”标题链接`}
        className="ml-2 inline-flex align-middle text-slate-700 opacity-0 transition hover:text-cyan-300 group-hover:opacity-100 focus:opacity-100"
        onClick={copyAnchor}
        title={copied ? "已复制" : "复制标题链接"}
        type="button"
      >
        {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
      </button>
    </>
  );

  if (level === 1) return <h1 className={className} id={id}>{content}</h1>;
  if (level === 2) return <h2 className={className} data-note-heading id={id}>{content}</h2>;
  if (level === 3) return <h3 className={className} data-note-heading id={id}>{content}</h3>;
  return <h4 className={className} id={id}>{content}</h4>;
}

function MarkdownImage({ alt, src }: { alt?: string; src?: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  if (!src) return <></>;

  return (
    <>
      <button className="my-8 block max-w-full cursor-zoom-in" onClick={() => setOpen(true)} type="button">
        <img alt={alt ?? ""} className="max-h-[32rem] w-auto max-w-full rounded-2xl border border-white/10 object-contain" loading="lazy" src={src} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => setOpen(false)} role="presentation">
          <button aria-label="关闭图片预览" className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-xl border border-white/15 bg-black/50 text-white" onClick={() => setOpen(false)} type="button">
            <X className="size-5" />
          </button>
          <img alt={alt ?? ""} className="max-h-[92vh] max-w-[96vw] object-contain" onClick={(event) => event.stopPropagation()} src={src} />
        </div>
      )}
    </>
  );
}

const components: Components = {
  h1: ({ children }) => <HeadingWithCopy level={1}>{children}</HeadingWithCopy>,
  h2: ({ children }) => <HeadingWithCopy level={2}>{children}</HeadingWithCopy>,
  h3: ({ children }) => <HeadingWithCopy level={3}>{children}</HeadingWithCopy>,
  h4: ({ children }) => <HeadingWithCopy level={4}>{children}</HeadingWithCopy>,
  p: ({ children }) => <p className="my-6 text-[15px] leading-8 text-slate-300">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
  em: ({ children }) => <em className="text-slate-200">{children}</em>,
  del: ({ children }) => <del className="text-slate-500 decoration-slate-500">{children}</del>,
  a: ({ children, href }) => {
    const external = typeof href === "string" && /^https?:\/\//.test(href);
    const anchor = typeof href === "string" && href.startsWith("#") ? href.slice(1) : null;
    return (
      <a
        className="text-cyan-300 underline decoration-cyan-300/30 underline-offset-4 transition hover:text-cyan-200"
        href={anchor ? undefined : href}
        onClick={anchor ? (event) => {
          event.preventDefault();
          document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
        } : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        target={external ? "_blank" : undefined}
      >
        {children}
      </a>
    );
  },
  blockquote: ({ children }) => <blockquote className="my-7 border-l-2 border-violet-400 bg-violet-400/[0.06] px-5 py-4 text-sm leading-7 text-slate-300 [&>p]:my-0">{children}</blockquote>,
  ul: ({ children }) => <ul className="my-6 list-disc space-y-2 pl-6 text-[15px] leading-7 text-slate-300">{children}</ul>,
  ol: ({ children }) => <ol className="my-6 list-decimal space-y-2 pl-6 text-[15px] leading-7 text-slate-300">{children}</ol>,
  li: ({ children }) => <li className="pl-1 [&>p]:my-0">{children}</li>,
  hr: () => <hr className="my-10 border-white/10" />,
  code: ({ children, className }) => className?.startsWith("language-") ? <code className={className}>{children}</code> : <code className="rounded-md border border-cyan-300/10 bg-cyan-300/[0.07] px-1.5 py-0.5 font-mono text-[0.88em] text-cyan-200">{children}</code>,
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  table: ({ children }) => <div className="my-8 w-full overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]"><table className="min-w-full border-collapse text-sm text-slate-300">{children}</table></div>,
  thead: ({ children }) => <thead className="bg-white/[0.045] text-slate-100">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-white/[0.06] last:border-b-0">{children}</tr>,
  th: ({ children, style }) => <th className="whitespace-nowrap border-b border-white/10 px-4 py-3 font-semibold" scope="col" style={style}>{children}</th>,
  td: ({ children, style }) => <td className="whitespace-nowrap px-4 py-3" style={style}>{children}</td>,
  input: ({ type, checked, disabled }) => <input checked={checked} className="mr-2 accent-cyan-300" disabled={disabled} readOnly type={type} />,
  img: ({ alt, src }) => <MarkdownImage alt={alt} src={typeof src === "string" ? src : undefined} />,
};

export default function MarkdownRenderer({ content }: MarkdownRendererProps): JSX.Element {
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;

    const elements = Array.from(root.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
    if (elements.length === 0) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const viewportRevealLine = window.innerHeight * 0.9;

    for (const element of elements) {
      element.dataset.noteRevealKind = revealKind(element);
      element.dataset.noteReveal = reduceMotion || element.getBoundingClientRect().top <= viewportRevealLine
        ? "visible"
        : "pending";
    }

    if (reduceMotion || !("IntersectionObserver" in window)) {
      for (const element of elements) element.dataset.noteReveal = "visible";
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const target = entry.target as HTMLElement;
        target.dataset.noteReveal = "visible";
        observer.unobserve(target);
      }
    }, {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.08,
    });

    for (const element of elements) {
      if (element.dataset.noteReveal !== "visible") observer.observe(element);
    }

    return () => observer.disconnect();
  }, [content]);

  return (
    <div className="note-content" ref={contentRef}>
      <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
