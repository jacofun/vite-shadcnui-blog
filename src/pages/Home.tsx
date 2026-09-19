import type { JSX } from "react";
import { ArrowRight } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import PublicAiAssistant from "@/components/common/PublicAiAssistant";
import HomeCommandCenter from "@/components/home/HomeCommandCenter";
import { formatNoteDate, notes } from "@/lib/notes";

export default function Home(): JSX.Element {
  const recentNotes = notes.slice(0, 5);

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

      <main className="min-h-screen bg-[#070a12] text-slate-100">
        <section className="border-b border-white/[0.07]">
          <div className="mx-auto max-w-6xl px-6 py-14 sm:px-8 sm:py-20 lg:px-10">
            <p className="font-mono text-[10px] tracking-[0.2em] text-slate-600 sm:text-[11px]">
              YANXIAO.ME / PERSONAL NOTES
            </p>
            <h1 className="mt-4 text-[2.65rem] font-semibold leading-none tracking-[-0.055em] text-white sm:text-6xl">
              彦骁的笔记
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base sm:leading-8">
              技术、AI、金融市场，以及一些值得长期留下来的记录。
            </p>

            <PublicAiAssistant
              launcher={(controls) => <HomeCommandCenter {...controls} />}
              pagePath="/notes"
            />
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-6 pb-20 sm:px-8 lg:px-10">
          <section className="py-10 sm:py-12">
            <div className="flex items-center justify-between gap-5 pb-5">
              <div className="flex items-baseline gap-3">
                <h2 className="text-lg font-medium text-white sm:text-xl">最近更新</h2>
                <span className="font-mono text-[10px] text-slate-700">RECENT</span>
              </div>
              <Link className="inline-flex items-center gap-2 text-xs text-slate-500 transition hover:text-cyan-300 sm:text-sm" to="/notes">
                全部笔记
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-white/[0.07] border-y border-white/[0.08]">
              {recentNotes.map((note, index) => (
                <Link
                  className="group grid min-w-0 gap-2 py-5 transition sm:grid-cols-[108px_minmax(0,1fr)_auto] sm:items-center sm:gap-6"
                  key={note.slug}
                  to={`/notes/${note.slug}`}
                >
                  <div className="flex items-center gap-3 font-mono text-[10px] text-slate-600 sm:block sm:text-xs">
                    <time>{formatNoteDate(note.updated)}</time>
                    {index === 0 && <span className="text-cyan-300 sm:mt-1 sm:block sm:text-[9px]">LATEST</span>}
                  </div>
                  <h3 className="min-w-0 break-words text-base font-medium leading-6 text-slate-300 transition [overflow-wrap:anywhere] group-hover:text-cyan-100 sm:text-lg">
                    {note.title}
                  </h3>
                  <div className="flex items-center gap-3 text-[11px] text-slate-600 sm:justify-end sm:text-xs">
                    <span>{note.category}</span>
                    <span aria-hidden="true" className="size-0.5 rounded-full bg-slate-700" />
                    <span>{note.readingMinutes} min</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1 group-hover:text-cyan-300" />
                  </div>
                </Link>
              ))}
            </div>

            <Link
              className="group mt-8 flex items-center justify-between gap-6 py-4 text-sm transition"
              to="/fragments"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-300 transition group-hover:text-white">碎片记录</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">照片、声音，以及不需要单独成文的内容。</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 text-xs text-slate-600 transition group-hover:text-cyan-300">
                查看
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
