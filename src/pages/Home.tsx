import type { JSX } from "react";
import { ArrowRight } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import FlatHero from "@/components/home/FlatHero";
import { formatNoteDate, notes } from "@/lib/notes";

export default function Home(): JSX.Element {
  const recentNotes = notes.slice(0, 4);

  return (
    <>
      <Helmet>
        <title>彦骁的笔记</title>
        <meta content="技术、AI、金融市场，以及一些值得长期留下来的记录。" name="description" />
        <link href="https://yanxiao.me/" rel="canonical" />
        <meta content="彦骁的笔记" property="og:title" />
        <meta content="技术、AI、金融市场，以及一些值得长期留下来的记录。" property="og:description" />
        <meta content="https://yanxiao.me/" property="og:url" />
        <meta content="website" property="og:type" />
      </Helmet>

      <main className="relative min-h-screen overflow-x-clip bg-[#070a12] text-slate-100">
        <FlatHero />

        <div className="relative mx-auto max-w-6xl px-6 pb-24 sm:px-8 lg:px-10">
          <section className="py-14 sm:py-20">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="mb-2 font-mono text-xs tracking-[0.18em] text-slate-600">RECENT NOTES</p>
                <h2 className="text-2xl font-semibold text-white sm:text-3xl">最近更新</h2>
              </div>
              <Link className="hidden items-center gap-2 text-sm text-slate-500 transition hover:text-cyan-300 sm:flex" to="/notes">
                查看全部
                <ArrowRight className="size-4" />
              </Link>
            </div>

            <div
              aria-label="最近更新文章"
              className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-3 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:hidden"
            >
              {recentNotes.map((note, index) => (
                <Link
                  className="group flex min-h-[246px] min-w-[82%] snap-start flex-col border border-white/10 bg-[#0a0e17] p-5 transition active:scale-[0.99]"
                  key={note.slug}
                  to={`/notes/${note.slug}`}
                >
                  <div className="flex items-start justify-between gap-4 font-mono text-[10px] tracking-[0.14em] text-slate-600">
                    <time>{formatNoteDate(note.updated)}</time>
                    <span>{String(index + 1).padStart(2, "0")} / {String(recentNotes.length).padStart(2, "0")}</span>
                  </div>

                  <div className="mt-9 flex-1">
                    <h3 className="text-[1.35rem] font-medium leading-[1.35] tracking-[-0.025em] text-slate-100">
                      {note.title}
                    </h3>
                    <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-500">{note.summary}</p>
                  </div>

                  <div className="mt-8 flex items-center justify-between border-t border-white/[0.08] pt-4">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600">{note.readingMinutes} min read</span>
                    <span className="flex items-center gap-2 text-xs text-slate-400">
                      阅读
                      <ArrowRight className="size-3.5" />
                    </span>
                  </div>
                </Link>
              ))}
              <div aria-hidden="true" className="w-2 shrink-0" />
            </div>

            <div className="hidden divide-y divide-white/10 border-y border-white/10 sm:block">
              {recentNotes.map((note) => (
                <Link className="group grid gap-3 py-6 transition sm:grid-cols-[110px_1fr_auto] sm:items-center" key={note.slug} to={`/notes/${note.slug}`}>
                  <time className="font-mono text-xs text-slate-600">{formatNoteDate(note.updated)}</time>
                  <div>
                    <h3 className="font-medium text-slate-200 transition group-hover:text-cyan-200">{note.title}</h3>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-600">{note.summary}</p>
                  </div>
                  <span className="flex items-center gap-2 text-xs text-slate-600">
                    {note.readingMinutes} min
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </div>

            <Link
              className="group mt-10 flex items-center justify-between gap-6 border-y border-white/[0.08] py-5 transition hover:border-cyan-300/20"
              to="/fragments"
            >
              <div>
                <p className="font-mono text-[10px] tracking-[0.18em] text-slate-600">FRAGMENTS</p>
                <p className="mt-2 text-sm text-slate-400 transition group-hover:text-slate-200">照片、截图、声音，还有一些没必要单独写成文章的东西。</p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-cyan-300" />
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
