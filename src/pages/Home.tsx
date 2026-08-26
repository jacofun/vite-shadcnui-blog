import type { JSX } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  Code2,
  Heart,
  LineChart,
  Sparkles,
  Terminal,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const noteTracks = [
  {
    icon: Code2,
    index: "01",
    title: "工程与架构",
    description: "记录企业级 Java、云原生、平台工程与系统设计中的实践和判断。",
    tags: ["Java", "Cloud Native", "Architecture"],
    tone: "from-cyan-400/20 to-blue-500/5",
  },
  {
    icon: LineChart,
    index: "02",
    title: "金融市场",
    description: "整理市场机制、交易观察与风险管理，保留分析过程中的证据链。",
    tags: ["Markets", "Trading", "Risk"],
    tone: "from-violet-400/20 to-fuchsia-500/5",
  },
  {
    icon: BrainCircuit,
    index: "03",
    title: "学习与思考",
    description: "沉淀语言学习、工程管理以及人工智能时代的持续思考。",
    tags: ["Learning", "AI", "Management"],
    tone: "from-amber-300/20 to-orange-500/5",
  },
];

export default function Home(): JSX.Element {
  return (
    <>
      <Helmet>
        <title>彦骁的笔记</title>
        <meta
          name="description"
          content="彦骁的个人数字花园，记录技术、金融市场与持续学习。"
        />
        <meta property="og:title" content="彦骁的笔记" />
        <meta
          property="og:description"
          content="记录技术、金融市场与持续学习。"
        />
      </Helmet>

      <main className="relative min-h-screen overflow-hidden bg-[#070a12] text-slate-100">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.045)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="pointer-events-none absolute -left-40 top-10 size-[32rem] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute -right-40 top-64 size-[36rem] rounded-full bg-violet-500/10 blur-[140px]" />

        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-6 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between border-b border-white/10 pb-5">
            <a className="flex items-center gap-3" href="#top" aria-label="返回顶部">
              <span className="flex size-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10">
                <Terminal className="size-4 text-cyan-300" />
              </span>
              <span className="text-sm font-semibold tracking-[0.16em] text-white">
                YANXIAO.LOG
              </span>
            </a>
            <nav className="hidden items-center gap-8 text-sm text-slate-400 sm:flex">
              <a className="transition hover:text-white" href="#notes">
                笔记
              </a>
              <a className="transition hover:text-white" href="#about">
                关于
              </a>
              <Link className="transition hover:text-white" to="/wedding">
                纪念
              </Link>
            </nav>
          </header>

          <section
            className="flex min-h-[680px] flex-col justify-center py-24 sm:min-h-[720px]"
            id="top"
          >
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.7 }}
            >
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1.5 text-xs tracking-wide text-cyan-200">
                <span className="size-1.5 animate-pulse rounded-full bg-cyan-300" />
                DIGITAL GARDEN · 持续生长
              </div>

              <p className="mb-5 font-mono text-sm tracking-[0.22em] text-slate-500">
                HELLO, WORLD. I AM YANXIAO.
              </p>
              <h1 className="max-w-4xl text-5xl font-semibold leading-[1.08] tracking-[-0.05em] text-white sm:text-7xl lg:text-8xl">
                彦骁的
                <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                  笔记
                </span>
              </h1>
              <p className="mt-8 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
                记录技术实践、金融市场与持续学习。
                <br className="hidden sm:block" />
                把零散经验整理成可以反复调用的知识。
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <a
                  className="group inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-100"
                  href="#notes"
                >
                  浏览笔记方向
                  <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
                <a
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:bg-white/[0.08]"
                  href="#about"
                >
                  了解我
                </a>
              </div>
            </motion.div>
          </section>

          <section className="scroll-mt-8 py-20" id="notes">
            <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="mb-3 font-mono text-xs tracking-[0.22em] text-cyan-300">
                  KNOWLEDGE STREAMS
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  笔记方向
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-slate-500">
                页面仍在建设中，内容将按主题逐步整理并开放。
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {noteTracks.map((track, index) => {
                const Icon = track.icon;
                return (
                  <motion.article
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-6 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.055]"
                    initial={{ opacity: 0, y: 20 }}
                    key={track.title}
                    transition={{ delay: index * 0.1, duration: 0.5 }}
                    viewport={{ once: true, margin: "-80px" }}
                    whileInView={{ opacity: 1, y: 0 }}
                  >
                    <div
                      className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${track.tone} opacity-60`}
                    />
                    <div className="relative">
                      <div className="mb-14 flex items-center justify-between">
                        <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                          <Icon className="size-5 text-slate-200" />
                        </span>
                        <span className="font-mono text-xs text-slate-600">
                          {track.index}
                        </span>
                      </div>
                      <h3 className="text-xl font-semibold text-white">
                        {track.title}
                      </h3>
                      <p className="mt-3 min-h-20 text-sm leading-6 text-slate-400">
                        {track.description}
                      </p>
                      <div className="mt-6 flex flex-wrap gap-2">
                        {track.tags.map((tag) => (
                          <span
                            className="rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] tracking-wide text-slate-500"
                            key={tag}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </section>

          <section className="scroll-mt-8 py-20" id="about">
            <div className="grid gap-10 rounded-3xl border border-white/10 bg-white/[0.035] p-7 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
              <div>
                <div className="mb-5 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 to-violet-500 text-slate-950">
                  <Sparkles className="size-5" />
                </div>
                <p className="font-mono text-xs tracking-[0.22em] text-violet-300">
                  ABOUT THIS SPACE
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                  一个持续迭代的数字花园
                </h2>
                <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                  我从事企业级应用开发与工程管理，也长期关注金融市场。
                  这里用于整理工作实践、学习记录和形成中的观点，让知识脱离短期记忆，进入可以检索和复用的系统。
                </p>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#090d17] p-6">
                <div>
                  <div className="flex items-center gap-2 font-mono text-xs tracking-[0.16em] text-slate-500">
                    <BookOpen className="size-4" />
                    ARCHIVE / MEMORY
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-white">
                    一份被保留的邀请
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    婚礼邀请函作为过往页面保留在这里，记录一段重要的人生时刻。
                  </p>
                </div>
                <Link
                  className="group mt-10 flex items-center justify-between rounded-xl border border-rose-300/15 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-100 transition hover:border-rose-300/30 hover:bg-rose-300/[0.1]"
                  to="/wedding"
                >
                  <span className="flex items-center gap-2">
                    <Heart className="size-4" />
                    查看婚礼邀请函
                  </span>
                  <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
