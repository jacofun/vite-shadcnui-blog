import type { JSX } from "react";
import { ArrowRight } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import FlatHero from "@/components/home/FlatHero";
import { formatNoteDate, notes } from "@/lib/notes";

export default function Home(): JSX.Element {
  const recentNotes = notes.slice(0, 4);
  const [latestNote, ...otherRecentNotes] = recentNotes;

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
          <section className="py-10 sm:py-14">
            <div className="mb-7 flex items-end justify-between gap-4 sm:mb-9">
              <div>
                <p className="mb-2 bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text font-mono text-[11px] tracking-[0.2em] text-transparent sm:text-xs">
                  RECENTLY UPDATED
                </p>
                <h2 className="text-3xl font-semibold tracking-[-0.025em] text-white sm:text-4xl">最近更新</h2>
                <div className="mt-4 h-px w-16 bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400" />
              </div>
              <Link className="flex items-center gap-2 pb-1 text-sm text-slate-300 transition hover:text-cyan-300" to="/notes">
                查看全部
                <ArrowRight className="size-4" />
              </Link>
            </div>

            {latestNote && (
              <Link
                className="group relative block overflow-hidden border-y border-white/10 py-8 sm:py-10"
                to={`/notes/${latestNote.slug}`}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-cyan-300 via-sky-400 to-violet-400"
                />
                <span
                  aria-hidden="true"
                  className="absolute -left-20 top-1/2 h-52 w-52 -translate-y-1/2 rounded-full bg-cyan-400/[0.055] blur-3xl transition duration-500 group-hover:bg-cyan-400/[0.09]"
                />

                <div className="relative pl-5 sm:pl-7">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500 sm:text-xs">
                    <span className="text-cyan-300">Latest / 最新发布</span>
                    <span aria-hidden="true" className="text-slate-700">·</span>
                    <time>{formatNoteDate(latestNote.updated)}</time>
                    <span aria-hidden="true" className="text-slate-700">·</span>
                    <span>{latestNote.category}</span>
                  </div>

                  <div className="mt-5 grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <div>
                      <h3 className="max-w-4xl text-[1.75rem] font-semibold leading-[1.25] tracking-[-0.035em] text-white transition group-hover:text-cyan-100 sm:text-4xl sm:leading-[1.2]">
                        {latestNote.title}
                      </h3>
                      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base sm:leading-8">
                        {latestNote.summary}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-6 lg:justify-end">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-600 sm:text-xs">
                        {latestNote.readingMinutes} min read
                      </span>
                      <span className="flex items-center gap-2 text-sm text-slate-200 transition group-hover:text-cyan-300">
                        阅读全文
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {otherRecentNotes.length > 0 && (
              <div aria-label="其他最近更新文章" className="divide-y divide-white/[0.08] border-b border-white/10">
                {otherRecentNotes.map((note) => (
                  <Link
                    className="group grid gap-3 py-6 transition sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-center sm:gap-5"
                    key={note.slug}
                    to={`/notes/${note.slug}`}
                  >
                    <time className="font-mono text-[11px] text-slate-600 sm:text-xs">{formatNoteDate(note.updated)}</time>
                    <div>
                      <h3 className="text-lg font-medium leading-snug text-slate-200 transition group-hover:text-cyan-200">
                        {note.title}
                      </h3>
                      <p className="mt-2 line-clamp-1 text-sm leading-6 text-slate-600">{note.summary}</p>
                    </div>
                    <span className="flex items-center gap-2 text-xs text-slate-600">
                      {note.readingMinutes} min
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                ))}
              </div>
            )}

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
