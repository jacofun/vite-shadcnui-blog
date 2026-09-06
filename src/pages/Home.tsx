import type { JSX } from "react";
import { ArrowRight } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import LivingKnowledgeGraph from "@/components/home/LivingKnowledgeGraph";
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
        <LivingKnowledgeGraph />

        <div className="relative mx-auto max-w-6xl px-6 pb-24 sm:px-8 lg:px-10">
          <section className="py-16 sm:py-20">
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

            <div className="divide-y divide-white/10 border-y border-white/10">
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
          </section>
        </div>
      </main>
    </>
  );
}
