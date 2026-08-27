import {
  useEffect,
  useMemo,
  useState,
  type JSX,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronUp,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";

import MarkdownRenderer from "@/components/notes/MarkdownRenderer";
import { extractMarkdownHeadings } from "@/lib/markdown";
import {
  formatNoteDate,
  getNoteBySlug,
  notes,
} from "@/lib/notes";
import NotFound from "@/pages/NotFound";

export default function NoteDetail(): JSX.Element {
  const { slug = "" } = useParams();
  const note = getNoteBySlug(slug);
  const [progress, setProgress] = useState(0);
  const [activeHeading, setActiveHeading] = useState("");

  const headings = useMemo(
    () => (note ? extractMarkdownHeadings(note.content) : []),
    [note],
  );

  useEffect(() => {
    window.scrollTo({ top: 0 });

    const updateProgress = () => {
      const available =
        document.documentElement.scrollHeight - window.innerHeight;
      setProgress(available > 0 ? (window.scrollY / available) * 100 : 0);
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    return () => window.removeEventListener("scroll", updateProgress);
  }, [slug]);

  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-note-heading]"),
    );

    if (!elements.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) {
          setActiveHeading(visible.target.id);
        }
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [note]);

  if (!note) {
    return <NotFound />;
  }

  const noteIndex = notes.findIndex((item) => item.slug === note.slug);
  const previousNote = notes[noteIndex + 1];
  const nextNote = notes[noteIndex - 1];

  return (
    <>
      <Helmet>
        <title>{note.title} · 彦骁的笔记</title>
        <meta content={note.summary} name="description" />
      </Helmet>

      <main className="min-h-screen bg-[#070a12] text-slate-100">
        <div
          className="fixed left-0 top-0 z-[60] h-0.5 bg-gradient-to-r from-cyan-300 to-violet-400 transition-[width]"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
        <div className="mx-auto grid max-w-6xl gap-14 px-6 pb-24 pt-12 sm:px-8 lg:grid-cols-[minmax(0,760px)_220px] lg:px-10">
          <article>
            <Link
              className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-cyan-300"
              to="/notes"
            >
              <ArrowLeft className="size-4" />
              返回全部笔记
            </Link>

            <header className="border-b border-white/10 pb-10 pt-10">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>{note.category}</span>
                <span className="size-1 rounded-full bg-slate-700" />
                <time>{formatNoteDate(note.updated)}</time>
                <span>{note.readingMinutes} 分钟阅读</span>
              </div>
              <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
                {note.title}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">
                {note.summary}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {note.tags.map((tag) => (
                  <span
                    className="rounded-md border border-white/10 px-2.5 py-1 font-mono text-[11px] text-slate-500"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </header>

            <MarkdownRenderer content={note.content} />

            <nav className="mt-16 grid gap-4 border-t border-white/10 pt-8 sm:grid-cols-2">
              {previousNote ? (
                <Link
                  className="group rounded-xl border border-white/10 p-4 transition hover:border-white/20 hover:bg-white/[0.03]"
                  to={`/notes/${previousNote.slug}`}
                >
                  <span className="text-xs text-slate-600">上一篇</span>
                  <span className="mt-2 flex items-center gap-2 text-sm text-slate-300 group-hover:text-cyan-200">
                    <ArrowLeft className="size-4" />
                    {previousNote.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {nextNote && (
                <Link
                  className="group rounded-xl border border-white/10 p-4 text-right transition hover:border-white/20 hover:bg-white/[0.03]"
                  to={`/notes/${nextNote.slug}`}
                >
                  <span className="text-xs text-slate-600">下一篇</span>
                  <span className="mt-2 flex items-center justify-end gap-2 text-sm text-slate-300 group-hover:text-cyan-200">
                    {nextNote.title}
                    <ArrowRight className="size-4" />
                  </span>
                </Link>
              )}
            </nav>
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <p className="mb-4 font-mono text-[11px] tracking-[0.16em] text-slate-600">
                ON THIS PAGE
              </p>
              <nav className="space-y-1 border-l border-white/10">
                {headings.map((heading) => (
                  <a
                    className={`block py-1.5 text-xs leading-5 transition ${
                      heading.level === 3 ? "pl-6" : "pl-4"
                    } ${
                      activeHeading === heading.id
                        ? "border-l border-cyan-300 text-cyan-300"
                        : "text-slate-600 hover:text-slate-300"
                    }`}
                    href={`#${heading.id}`}
                    key={heading.id}
                  >
                    {heading.text}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        </div>

        {progress > 25 && (
          <button
            aria-label="返回顶部"
            className="fixed bottom-6 right-6 flex size-10 items-center justify-center rounded-xl border border-white/10 bg-[#0d1220]/90 text-slate-500 shadow-xl backdrop-blur transition hover:border-white/20 hover:text-white"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            type="button"
          >
            <ChevronUp className="size-4" />
          </button>
        )}
      </main>
    </>
  );
}
