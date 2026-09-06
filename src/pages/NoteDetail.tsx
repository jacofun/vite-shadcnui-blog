import { useEffect, useMemo, useState, type JSX } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";

import MarkdownRenderer from "@/components/notes/MarkdownRenderer";
import { extractMarkdownHeadings } from "@/lib/markdown";
import {
  formatNoteDate,
  getNoteBySlug,
  getRelatedNotes,
  getSeriesNotes,
  notes,
} from "@/lib/notes";
import NotFound from "@/pages/NotFound";

export default function NoteDetail(): JSX.Element {
  const { slug = "" } = useParams();
  const note = getNoteBySlug(slug);
  const [progress, setProgress] = useState(0);
  const [activeHeading, setActiveHeading] = useState("");
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  const headings = useMemo(
    () => (note ? extractMarkdownHeadings(note.content) : []),
    [note],
  );
  const relatedNotes = useMemo(() => (note ? getRelatedNotes(note) : []), [note]);
  const seriesNotes = useMemo(
    () => (note?.series ? getSeriesNotes(note.series) : []),
    [note],
  );

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setMobileTocOpen(false);

    const updateProgress = () => {
      const available = document.documentElement.scrollHeight - window.innerHeight;
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
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveHeading(visible.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [note]);

  if (!note) return <NotFound />;

  const noteIndex = notes.findIndex((item) => item.slug === note.slug);
  const previousNote = notes[noteIndex + 1];
  const nextNote = notes[noteIndex - 1];
  const seriesIndex = seriesNotes.findIndex((item) => item.slug === note.slug);
  const canonicalUrl = `https://yanxiao.me/#/notes/${note.slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: note.title,
    description: note.summary,
    datePublished: note.date,
    dateModified: note.updated,
    mainEntityOfPage: canonicalUrl,
    author: { "@type": "Person", name: "彦骁" },
    publisher: { "@type": "Person", name: "彦骁" },
    keywords: note.tags.join(","),
  };

  const scrollToHeading = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveHeading(id);
    setMobileTocOpen(false);
  };

  return (
    <>
      <Helmet>
        <title>{note.title} · 彦骁的笔记</title>
        <meta content={note.summary} name="description" />
        <meta content="article" property="og:type" />
        <meta content={note.title} property="og:title" />
        <meta content={note.summary} property="og:description" />
        <meta content={canonicalUrl} property="og:url" />
        <meta content={note.date} property="article:published_time" />
        <meta content={note.updated} property="article:modified_time" />
        <link href={canonicalUrl} rel="canonical" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>

      <main className="min-h-screen bg-[#070a12] text-slate-100">
        <div className="mx-auto grid max-w-6xl gap-14 px-6 pb-24 pt-12 sm:px-8 lg:grid-cols-[minmax(0,760px)_220px] lg:px-10">
          <article>
            <Link className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-cyan-300" to="/notes">
              <ArrowLeft className="size-4" />
              返回全部笔记
            </Link>

            <header className="border-b border-white/10 pb-10 pt-10">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>{note.category}</span>
                <span className="size-1 rounded-full bg-slate-700" />
                <time>{formatNoteDate(note.updated)}</time>
                <span>{note.readingMinutes} 分钟阅读</span>
                {note.series && <span>{note.series} · {seriesIndex + 1}/{seriesNotes.length}</span>}
              </div>
              <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">{note.title}</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">{note.summary}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {note.tags.map((tag) => (
                  <Link
                    className="rounded-md border border-white/10 px-2.5 py-1 font-mono text-[11px] text-slate-500 transition hover:border-cyan-300/20 hover:text-cyan-200"
                    key={tag}
                    to={`/notes?tag=${encodeURIComponent(tag)}`}
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </header>

            {note.aiSummary && (
              <section className="mt-8 rounded-2xl border border-violet-300/15 bg-violet-300/[0.055] p-5">
                <div className="flex items-center gap-2 text-xs font-medium text-violet-200">
                  <Sparkles className="size-4" />
                  快速理解
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-300">{note.aiSummary}</p>
              </section>
            )}

            {headings.length > 0 && (
              <div className="mt-7 lg:hidden">
                <button
                  aria-expanded={mobileTocOpen}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-slate-400"
                  onClick={() => setMobileTocOpen((open) => !open)}
                  type="button"
                >
                  本文目录
                  <ChevronDown className={`size-4 transition ${mobileTocOpen ? "rotate-180" : ""}`} />
                </button>
                {mobileTocOpen && (
                  <nav className="mt-2 rounded-xl border border-white/10 bg-[#090d17] p-3">
                    {headings.map((heading) => (
                      <button
                        className={`block w-full rounded-lg py-2 text-left text-xs leading-5 transition hover:bg-white/[0.03] hover:text-slate-200 ${heading.level === 3 ? "pl-6" : "pl-3"} ${activeHeading === heading.id ? "text-cyan-300" : "text-slate-500"}`}
                        key={heading.id}
                        onClick={() => scrollToHeading(heading.id)}
                        type="button"
                      >
                        {heading.text}
                      </button>
                    ))}
                  </nav>
                )}
              </div>
            )}

            {note.series && seriesNotes.length > 1 && (
              <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <p className="font-mono text-[10px] tracking-[0.16em] text-slate-600">SERIES</p>
                <h2 className="mt-2 text-sm font-medium text-slate-200">{note.series}</h2>
                <div className="mt-3 space-y-1">
                  {seriesNotes.map((item, index) => (
                    <Link
                      className={`flex gap-3 rounded-lg px-2 py-2 text-xs transition hover:bg-white/[0.035] ${item.slug === note.slug ? "text-cyan-300" : "text-slate-500 hover:text-slate-200"}`}
                      key={item.slug}
                      to={`/notes/${item.slug}`}
                    >
                      <span className="font-mono text-slate-700">{String(index + 1).padStart(2, "0")}</span>
                      <span>{item.title}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <MarkdownRenderer content={note.content} />

            {note.aiAssisted && (
              <section className="mt-14 border-t border-white/10 pt-7 text-xs leading-6 text-slate-600">
                <p className="font-medium text-slate-500">AI 参与说明</p>
                <p className="mt-2">
                  本文由作者确定主题、观点和最终内容，AI 参与资料整理、文字编辑或技术实现，最终内容由作者审阅。
                </p>
              </section>
            )}

            {relatedNotes.length > 0 && (
              <section className="mt-14 border-t border-white/10 pt-8">
                <p className="font-mono text-[10px] tracking-[0.16em] text-slate-600">RELATED NOTES</p>
                <h2 className="mt-2 text-lg font-medium text-white">继续阅读</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {relatedNotes.map((item) => (
                    <Link className="rounded-xl border border-white/10 p-4 transition hover:border-cyan-300/20 hover:bg-white/[0.03]" key={item.slug} to={`/notes/${item.slug}`}>
                      <p className="text-sm text-slate-300">{item.title}</p>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{item.summary}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <nav className="mt-16 grid gap-4 border-t border-white/10 pt-8 sm:grid-cols-2">
              {previousNote ? (
                <Link className="group rounded-xl border border-white/10 p-4 transition hover:border-white/20 hover:bg-white/[0.03]" to={`/notes/${previousNote.slug}`}>
                  <span className="text-xs text-slate-600">上一篇</span>
                  <span className="mt-2 flex items-center gap-2 text-sm text-slate-300 group-hover:text-cyan-200"><ArrowLeft className="size-4" />{previousNote.title}</span>
                </Link>
              ) : <span />}
              {nextNote && (
                <Link className="group rounded-xl border border-white/10 p-4 text-right transition hover:border-white/20 hover:bg-white/[0.03]" to={`/notes/${nextNote.slug}`}>
                  <span className="text-xs text-slate-600">下一篇</span>
                  <span className="mt-2 flex items-center justify-end gap-2 text-sm text-slate-300 group-hover:text-cyan-200">{nextNote.title}<ArrowRight className="size-4" /></span>
                </Link>
              )}
            </nav>
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <p className="mb-4 font-mono text-[11px] tracking-[0.16em] text-slate-600">ON THIS PAGE</p>
              <nav className="space-y-1 border-l border-white/10">
                {headings.map((heading) => (
                  <button
                    className={`block w-full py-1.5 text-left text-xs leading-5 transition ${heading.level === 3 ? "pl-6" : "pl-4"} ${activeHeading === heading.id ? "border-l border-cyan-300 text-cyan-300" : "text-slate-600 hover:text-slate-300"}`}
                    key={heading.id}
                    onClick={() => scrollToHeading(heading.id)}
                    type="button"
                  >
                    {heading.text}
                  </button>
                ))}
              </nav>
            </div>
          </aside>
        </div>

        {progress > 25 && (
          <button aria-label="返回顶部" className="fixed bottom-6 right-6 flex size-10 items-center justify-center rounded-xl border border-white/10 bg-[#0d1220]/90 text-slate-500 shadow-xl backdrop-blur transition hover:border-white/20 hover:text-white" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} type="button">
            <ChevronUp className="size-4" />
          </button>
        )}
      </main>
    </>
  );
}
