import type { JSX, MouseEvent } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Code2,
  Heart,
  LineChart,
  Sparkles,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import SiteHeader from "@/components/common/SiteHeader";
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
  const prefersReducedMotion = useReducedMotion();
  const pointerX = useMotionValue(-300);
  const pointerY = useMotionValue(-300);
  const smoothX = useSpring(pointerX, { stiffness: 120, damping: 24 });
  const smoothY = useSpring(pointerY, { stiffness: 120, damping: 24 });
  const spotlight = useMotionTemplate`radial-gradient(520px circle at ${smoothX}px ${smoothY}px, rgba(34, 211, 238, 0.10), transparent 68%)`;

  const handlePointerMove = (event: MouseEvent<HTMLElement>) => {
    if (prefersReducedMotion) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set(event.clientX - bounds.left);
    pointerY.set(event.clientY - bounds.top);
  };

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

      <main
        className="relative min-h-screen overflow-x-clip bg-[#070a12] text-slate-100"
        onMouseMove={handlePointerMove}
      >
        <SiteHeader />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ background: spotlight }}
        />
        <div className="pointer-events-none absolute -right-48 top-32 size-[34rem] rounded-full bg-violet-500/[0.08] blur-[130px]" />

        <div className="relative mx-auto max-w-6xl px-6 pb-24 sm:px-8 lg:px-10">
          <section className="grid min-h-[620px] items-center gap-16 py-24 lg:grid-cols-[1fr_340px]">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 22 }}
              transition={{ duration: 0.65 }}
            >
              <p className="mb-5 font-mono text-xs tracking-[0.2em] text-cyan-300">
                YANXIAO.ME / NOTES
              </p>
              <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.05em] text-white sm:text-7xl">
                彦骁的笔记
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
                <Link
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm text-slate-200 transition hover:border-white/30 hover:bg-white/[0.08]"
                  to="/wedding"
                >
                  <Heart className="size-4 text-rose-300" />
                  婚礼纪念
                </Link>
              </div>
            </motion.div>

            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="relative hidden aspect-square lg:block"
              initial={{ opacity: 0, scale: 0.92 }}
              transition={{ delay: 0.15, duration: 0.7 }}
            >
              <motion.div
                animate={
                  prefersReducedMotion ? undefined : { rotate: 360 }
                }
                className="absolute inset-8 rounded-full border border-dashed border-cyan-300/20"
                transition={{
                  duration: 28,
                  ease: "linear",
                  repeat: Infinity,
                }}
              />
              <motion.div
                animate={
                  prefersReducedMotion ? undefined : { rotate: -360 }
                }
                className="absolute inset-20 rounded-full border border-violet-300/20"
                transition={{
                  duration: 20,
                  ease: "linear",
                  repeat: Infinity,
                }}
              />
              <div className="absolute inset-[34%] rounded-full bg-gradient-to-br from-cyan-300 to-violet-500 shadow-[0_0_90px_rgba(34,211,238,0.25)]" />
              <div className="absolute left-1/2 top-6 h-8 w-px bg-gradient-to-b from-cyan-300 to-transparent" />
              <div className="absolute bottom-12 right-10 size-2 rounded-full bg-violet-300 shadow-[0_0_18px_rgba(196,181,253,0.9)]" />
            </motion.div>
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
              {recentNotes.map((note, index) => (
                <motion.div
                  initial={{ opacity: 0, x: -14 }}
                  key={note.slug}
                  transition={{ delay: index * 0.06 }}
                  viewport={{ once: true }}
                  whileInView={{ opacity: 1, x: 0 }}
                >
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
                </motion.div>
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
