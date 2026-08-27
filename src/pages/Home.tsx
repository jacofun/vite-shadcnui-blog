import type { JSX } from "react";
import {
  ArrowRight,
  BookOpen,
  Code2,
  LineChart,
  Sparkles,
  Terminal,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import { openTerminal } from "@/lib/terminal";
import { formatNoteDate, noteCategories, notes } from "@/lib/notes";

const categoryDetails = {
  工程与架构: {
    icon: Code2,
    description: "Java、云原生、平台工程与系统设计。",
    color: "cyan",
  },
  金融市场: {
    icon: LineChart,
    description: "市场机制、交易观察与风险管理。",
    color: "violet",
  },
  学习与思考: {
    icon: BookOpen,
    description: "语言学习、工程管理与阶段性思考。",
    color: "amber",
  },
} as const;

export default function Home(): JSX.Element {
  const recentNotes = notes.slice(0, 4);

  return (
    <>
      <Helmet>
        <title>彦骁的笔记</title>
        <meta
          content="技术、金融市场和学习记录。"
          name="description"
        />
      </Helmet>

      <main className="relative min-h-screen overflow-x-clip bg-[#070a12] text-slate-100">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_circle_at_18%_12%,rgba(34,211,238,0.09),transparent_68%)]" />
        <div className="pointer-events-none absolute -right-48 top-32 size-[34rem] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.08)_0%,rgba(139,92,246,0)_68%)]" />

        <div className="relative mx-auto max-w-6xl px-6 pb-24 sm:px-8 lg:px-10">
          <section className="grid min-h-[620px] items-center gap-16 py-24 lg:grid-cols-[1fr_340px]">
            <div>
              <p className="mb-5 font-mono text-xs tracking-[0.2em] text-cyan-300">
                YANXIAO.ME / NOTES
              </p>
              <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.05em] text-white sm:text-7xl">
                {"彦骁的"}
                <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400 bg-clip-text text-transparent">
                  笔记
                </span>
              </h1>
              <p className="mt-7 text-xl text-slate-300">
                技术、金融市场和学习记录
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  className="group inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-100"
                  to="/notes"
                >
                  浏览全部笔记
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <button
                  aria-haspopup="dialog"
                  className="group inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-5 py-3 text-sm font-medium text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-300/[0.14]"
                  onClick={openTerminal}
                  type="button"
                >
                  <Terminal className="size-4 transition group-hover:scale-110" />
                  进入终端
                  <span className="hidden border-l border-cyan-200/20 pl-2 font-mono text-[10px] tracking-wide text-cyan-200/65 sm:inline">
                    Ctrl + `
                  </span>
                </button>
              </div>
            </div>

            <div className="terminal-preview-float relative hidden min-h-[350px] lg:block">
              <div className="pointer-events-none absolute inset-x-4 top-10 h-64 rounded-full bg-[radial-gradient(ellipse,rgba(34,211,238,0.09)_0%,rgba(34,211,238,0)_70%)]" />
              <button
                aria-haspopup="dialog"
                aria-label="打开终端"
                className="group relative mx-auto block w-full max-w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e19]/90 p-px text-left shadow-[0_22px_70px_rgba(0,0,0,0.34)] outline-none transition hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-[0_24px_80px_rgba(8,145,178,0.16)] focus-visible:ring-2 focus-visible:ring-cyan-300/70"
                onClick={openTerminal}
                type="button"
              >
                <div className="relative overflow-hidden rounded-[15px] bg-[#080c15]">
                  <div className="flex h-10 items-center justify-between border-b border-white/[0.08] bg-white/[0.025] px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-rose-300/75" />
                      <span className="size-2 rounded-full bg-amber-200/75" />
                      <span className="size-2 rounded-full bg-emerald-300/75" />
                    </div>
                    <span className="font-mono text-[10px] tracking-[0.16em] text-slate-500">
                      YANXIAO / TERMINAL
                    </span>
                    <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" />
                  </div>

                  <div className="space-y-5 px-5 py-6 font-mono text-xs leading-6">
                    <p className="text-slate-300">
                      <span className="text-cyan-300">visitor@yanxiao</span>
                      <span className="text-violet-300">:~</span>
                      <span className="text-slate-500">$</span>
                      <span className="ml-2 text-white">help</span>
                    </p>
                    <div className="space-y-2 border-l border-cyan-300/20 pl-3 text-slate-500">
                      <p>
                        <span className="mr-3 text-cyan-200">notes</span>
                        浏览笔记
                      </p>
                      <p>
                        <span className="mr-3 text-violet-200">wedding</span>
                        纪念入口
                      </p>
                      <p>
                        <span className="mr-3 text-slate-300">explore</span>
                        更多命令
                      </p>
                    </div>
                    <p className="text-slate-600">
                      click to explore
                      <span className="ml-1 inline-block h-3 w-1.5 bg-cyan-300/90 align-[-2px] animate-pulse" />
                    </p>
                  </div>

                  <div className="grid grid-cols-2 border-t border-white/[0.08] bg-white/[0.018] font-mono text-[10px] tracking-[0.12em] text-slate-600">
                    <span className="px-4 py-3">MODE / PUBLIC</span>
                    <span className="border-l border-white/[0.08] px-4 py-3 text-right text-cyan-300/65">
                      READY
                    </span>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent opacity-0 transition group-hover:opacity-100" />
                </div>
              </button>
            </div>
          </section>

          <section className="py-20">
            <div className="mb-9 flex items-end justify-between gap-4">
              <div>
                <p className="mb-2 font-mono text-xs tracking-[0.18em] text-slate-600">
                  RECENT NOTES
                </p>
                <h2 className="text-3xl font-semibold text-white">最近更新</h2>
              </div>
              <Link
                className="hidden items-center gap-2 text-sm text-slate-500 transition hover:text-cyan-300 sm:flex"
                to="/notes"
              >
                查看全部
                <ArrowRight className="size-4" />
              </Link>
            </div>

            <div className="divide-y divide-white/10 border-y border-white/10">
              {recentNotes.map((note) => (
                <div key={note.slug}>
                  <Link
                    className="group grid gap-3 py-6 transition sm:grid-cols-[110px_1fr_auto] sm:items-center"
                    to={`/notes/${note.slug}`}
                  >
                    <time className="font-mono text-xs text-slate-600">
                      {formatNoteDate(note.updated)}
                    </time>
                    <div>
                      <h3 className="font-medium text-slate-200 transition group-hover:text-cyan-200">
                        {note.title}
                      </h3>
                      <p className="mt-1 line-clamp-1 text-sm text-slate-600">
                        {note.summary}
                      </p>
                    </div>
                    <span className="flex items-center gap-2 text-xs text-slate-600">
                      {note.category}
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section className="py-20">
            <div className="mb-9">
              <p className="mb-2 font-mono text-xs tracking-[0.18em] text-slate-600">
                CATEGORIES
              </p>
              <h2 className="text-3xl font-semibold text-white">笔记分类</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {noteCategories.map((category) => {
                const detail =
                  categoryDetails[category as keyof typeof categoryDetails];
                const Icon = detail?.icon ?? Sparkles;
                const count = notes.filter(
                  (note) => note.category === category,
                ).length;

                return (
                  <Link
                    className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/20 hover:bg-white/[0.055]"
                    key={category}
                    to={`/notes?category=${encodeURIComponent(category)}`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                        <Icon className="size-5 text-slate-300" />
                      </span>
                      <span className="font-mono text-xs text-slate-600">
                        {String(count).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="mt-9 text-lg font-medium text-white">
                      {category}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {detail?.description ?? "持续整理中的笔记。"}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
