import { useRef, type JSX, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowRight, LockKeyhole, Terminal } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import { formatNoteDate, notes } from "@/lib/notes";
import { openTerminal } from "@/lib/terminal";

export default function Home(): JSX.Element {
  const recentNotes = notes.slice(0, 4);
  const heroRef = useRef<HTMLElement | null>(null);

  const moveHeroGlow = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
    const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
    event.currentTarget.style.setProperty("--hero-pointer-x", `${x.toFixed(2)}%`);
    event.currentTarget.style.setProperty("--hero-pointer-y", `${y.toFixed(2)}%`);
    event.currentTarget.style.setProperty("--hero-pointer-opacity", "1");
  };

  const resetHeroGlow = () => {
    heroRef.current?.style.setProperty("--hero-pointer-opacity", "0.62");
  };

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
        <div className="home-grid-drift pointer-events-none absolute -inset-14 bg-[linear-gradient(rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="home-ambient-glow home-ambient-glow-cyan pointer-events-none absolute inset-0 bg-[radial-gradient(520px_circle_at_18%_12%,rgba(34,211,238,0.09),transparent_68%)]" />
        <div className="home-ambient-glow home-ambient-glow-violet pointer-events-none absolute -right-48 top-32 size-[34rem] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.08)_0%,rgba(139,92,246,0)_68%)]" />

        <div className="relative mx-auto max-w-6xl px-6 pb-24 sm:px-8 lg:px-10">
          <section
            className="home-hero relative grid min-h-[620px] items-center gap-16 py-24 lg:grid-cols-[1fr_320px]"
            onPointerLeave={resetHeroGlow}
            onPointerMove={moveHeroGlow}
            ref={heroRef}
          >
            <div className="home-pointer-glow pointer-events-none absolute -inset-x-[18vw] inset-y-0 -z-10" />
            <div>
              <p className="mb-5 font-mono text-xs tracking-[0.2em] text-cyan-300">YANXIAO.ME / NOTES</p>
              <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.05em] text-white sm:text-7xl">
                彦骁的
                <span className="home-title-gradient bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400 bg-clip-text text-transparent">笔记</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-slate-400 sm:text-xl">
                技术、AI、金融市场，以及一些值得长期留下来的记录。
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link className="group inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-100" to="/notes">
                  浏览全部笔记
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-violet-300/30 hover:bg-violet-300/[0.08] hover:text-violet-100" to="/resources">
                  <LockKeyhole className="size-4" />
                  私人资源
                </Link>
                <button aria-haspopup="dialog" className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] px-5 py-3 text-sm text-cyan-100 transition hover:bg-cyan-300/[0.1]" onClick={openTerminal} type="button">
                  <Terminal className="size-4" />
                  终端
                </button>
              </div>

              <nav className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600" aria-label="更多页面">
                <Link className="transition hover:text-cyan-300" to="/now">现在</Link>
                <Link className="transition hover:text-cyan-300" to="/timeline">时间轴</Link>
                <Link className="transition hover:text-cyan-300" to="/about">关于</Link>
              </nav>
            </div>

            <div className="terminal-preview-float relative hidden lg:block">
              <div className="pointer-events-none absolute inset-x-4 top-10 h-64 rounded-full bg-[radial-gradient(ellipse,rgba(34,211,238,0.09)_0%,rgba(34,211,238,0)_70%)]" />
              <button aria-haspopup="dialog" aria-label="打开终端" className="group relative mx-auto block w-full max-w-[310px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e19]/90 p-px text-left shadow-[0_22px_70px_rgba(0,0,0,0.34)] outline-none transition hover:-translate-y-1 hover:border-cyan-300/35 focus-visible:ring-2 focus-visible:ring-cyan-300/70" onClick={openTerminal} type="button">
                <div className="relative overflow-hidden rounded-[15px] bg-[#080c15]">
                  <div className="flex h-10 items-center justify-between border-b border-white/[0.08] bg-white/[0.025] px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-rose-300/75" />
                      <span className="size-2 rounded-full bg-amber-200/75" />
                      <span className="size-2 rounded-full bg-emerald-300/75" />
                    </div>
                    <span className="font-mono text-[10px] tracking-[0.16em] text-slate-500">YANXIAO / TERMINAL</span>
                  </div>
                  <div className="space-y-4 px-5 py-6 font-mono text-xs leading-6">
                    <p className="text-slate-300"><span className="text-cyan-300">visitor@yanxiao</span><span className="text-violet-300">:~</span><span className="text-slate-500">$</span><span className="ml-2 text-white">help</span></p>
                    <div className="space-y-2 border-l border-cyan-300/20 pl-3 text-slate-500">
                      <p><span className="mr-3 text-cyan-200">notes</span>浏览笔记</p>
                      <p><span className="mr-3 text-violet-200">wedding</span>纪念入口</p>
                      <p><span className="mr-3 text-slate-300">explore</span>更多命令</p>
                    </div>
                    <p className="text-slate-600">click to explore<span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-cyan-300/90 align-[-2px]" /></p>
                  </div>
                </div>
              </button>
            </div>
          </section>

          <section className="border-t border-white/10 py-16">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="mb-2 font-mono text-xs tracking-[0.18em] text-slate-600">RECENT NOTES</p>
                <h2 className="text-2xl font-semibold text-white sm:text-3xl">最近更新</h2>
              </div>
              <Link className="hidden items-center gap-2 text-sm text-slate-500 transition hover:text-cyan-300 sm:flex" to="/notes">查看全部<ArrowRight className="size-4" /></Link>
            </div>

            <div className="divide-y divide-white/10 border-y border-white/10">
              {recentNotes.map((note) => (
                <Link className="group grid gap-3 py-6 transition sm:grid-cols-[110px_1fr_auto] sm:items-center" key={note.slug} to={`/notes/${note.slug}`}>
                  <time className="font-mono text-xs text-slate-600">{formatNoteDate(note.updated)}</time>
                  <div>
                    <h3 className="font-medium text-slate-200 transition group-hover:text-cyan-200">{note.title}</h3>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-600">{note.summary}</p>
                  </div>
                  <span className="flex items-center gap-2 text-xs text-slate-600">{note.readingMinutes} min<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" /></span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
