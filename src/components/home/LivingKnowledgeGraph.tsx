import {
  useEffect,
  useRef,
  type CSSProperties,
  type JSX,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { LockKeyhole, Terminal } from "lucide-react";
import { Link } from "react-router-dom";

import { openTerminal } from "@/lib/terminal";

type GraphStyle = CSSProperties & Record<`--${string}`, string | number>;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function LivingKnowledgeGraph(): JSX.Element {
  const heroRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return undefined;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updateScroll = () => {
      frameRef.current = null;
      if (reduceMotion.matches) {
        hero.style.setProperty("--living-scroll-y", "0px");
        hero.style.setProperty("--living-scroll-scale", "1");
        hero.style.setProperty("--living-scroll-opacity", "1");
        return;
      }

      const rect = hero.getBoundingClientRect();
      const travel = Math.max(Math.min(hero.offsetHeight * 0.78, 760), 420);
      const progress = clamp(-rect.top / travel, 0, 1);
      hero.style.setProperty("--living-scroll-y", `${(-34 * progress).toFixed(2)}px`);
      hero.style.setProperty("--living-scroll-scale", (1 - progress * 0.075).toFixed(4));
      hero.style.setProperty("--living-scroll-opacity", (1 - progress * 0.72).toFixed(4));
      hero.style.setProperty("--living-scroll-blur", `${(progress * 1.4).toFixed(2)}px`);
    };

    const scheduleScroll = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(updateScroll);
    };

    updateScroll();
    window.addEventListener("scroll", scheduleScroll, { passive: true });
    window.addEventListener("resize", scheduleScroll, { passive: true });
    reduceMotion.addEventListener("change", updateScroll);

    return () => {
      window.removeEventListener("scroll", scheduleScroll);
      window.removeEventListener("resize", scheduleScroll);
      reduceMotion.removeEventListener("change", updateScroll);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const moveField = (event: ReactPointerEvent<HTMLElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const nx = clamp(((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2, -1, 1);
    const ny = clamp(((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2, -1, 1);
    const strength = event.pointerType === "touch" ? 13 : 9;

    event.currentTarget.style.setProperty("--field-x", `${(nx * strength).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--field-y", `${(ny * strength).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--field-x-reverse", `${(-nx * strength * 0.78).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--field-y-reverse", `${(-ny * strength * 0.72).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--field-glow-x", `${(((nx + 1) / 2) * 100).toFixed(1)}%`);
    event.currentTarget.style.setProperty("--field-glow-y", `${(((ny + 1) / 2) * 100).toFixed(1)}%`);
    event.currentTarget.style.setProperty("--field-glow-opacity", event.pointerType === "touch" ? "1" : "0.86");
  };

  const resetField = () => {
    const hero = heroRef.current;
    if (!hero) return;
    hero.style.setProperty("--field-x", "0px");
    hero.style.setProperty("--field-y", "0px");
    hero.style.setProperty("--field-x-reverse", "0px");
    hero.style.setProperty("--field-y-reverse", "0px");
    hero.style.setProperty("--field-glow-opacity", "0.48");
  };

  const graphStyle: GraphStyle = {
    "--field-x": "0px",
    "--field-y": "0px",
    "--field-x-reverse": "0px",
    "--field-y-reverse": "0px",
    "--field-glow-x": "50%",
    "--field-glow-y": "42%",
    "--field-glow-opacity": "0.48",
    "--living-scroll-y": "0px",
    "--living-scroll-scale": "1",
    "--living-scroll-opacity": "1",
    "--living-scroll-blur": "0px",
  };

  return (
    <section
      className="living-hero relative isolate flex min-h-[calc(100svh-3.5rem)] flex-col overflow-hidden border-b border-white/[0.07] pt-6 sm:min-h-[760px] sm:pt-10 lg:min-h-[820px]"
      onPointerCancel={resetField}
      onPointerLeave={resetField}
      onPointerMove={moveField}
      onPointerUp={resetField}
      ref={heroRef}
      style={graphStyle}
    >
      <div aria-hidden="true" className="living-grid pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="living-field-glow pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="living-noise pointer-events-none absolute inset-0" />

      <div className="living-hero-stage relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-8 lg:px-10">
        <div className="living-hero-meta flex items-center justify-between px-1 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-600 sm:text-xs">
          <span>YANXIAO.ME</span>
          <span className="flex items-center gap-2">
            <span className="living-status-dot size-1.5 rounded-full bg-cyan-300" />
            LIVING NOTES
          </span>
        </div>

        <div className="living-graph-shell relative mx-auto mt-4 flex w-full max-w-[430px] flex-1 items-center justify-center sm:mt-0 sm:max-w-[620px] lg:max-w-[720px]">
          <div aria-hidden="true" className="living-orbit living-orbit-outer absolute left-1/2 top-1/2 aspect-square w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/[0.08]" />
          <div aria-hidden="true" className="living-orbit living-orbit-mid absolute left-1/2 top-1/2 aspect-square w-[66%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-200/[0.1]" />
          <div aria-hidden="true" className="living-orbit living-orbit-inner absolute left-1/2 top-1/2 aspect-square w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.08]" />

          <svg aria-hidden="true" className="living-links absolute inset-[8%] h-[84%] w-[84%] overflow-visible" viewBox="0 0 100 100">
            <defs>
              <radialGradient id="livingNodeGlow">
                <stop offset="0" stopColor="rgb(103 232 249)" stopOpacity="0.9" />
                <stop offset="1" stopColor="rgb(103 232 249)" stopOpacity="0" />
              </radialGradient>
            </defs>
            <g className="living-link-base" fill="none" stroke="currentColor" strokeWidth="0.32">
              <path d="M50 50 L19 20" />
              <path d="M50 50 L77 18" />
              <path d="M50 50 L88 56" />
              <path d="M50 50 L67 86" />
              <path d="M50 50 L20 78" />
              <path d="M50 50 L10 49" />
            </g>
            <g className="living-link-signal" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="0.75">
              <path d="M50 50 L19 20" />
              <path d="M50 50 L77 18" />
              <path d="M50 50 L88 56" />
              <path d="M50 50 L67 86" />
              <path d="M50 50 L20 78" />
              <path d="M50 50 L10 49" />
            </g>
            <circle className="living-core-pulse" cx="50" cy="50" fill="url(#livingNodeGlow)" r="5.4" />
          </svg>

          <div className="living-core absolute left-1/2 top-1/2 z-20 flex aspect-square w-[46%] -translate-x-1/2 -translate-y-1/2 items-center justify-center sm:w-[42%]">
            <div aria-hidden="true" className="living-core-halo absolute inset-[-14%] rounded-full" />
            <div className="living-core-surface relative flex size-full flex-col items-center justify-center overflow-hidden rounded-full border border-white/[0.14] bg-[#080d18]/90 px-4 text-center shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl">
              <div aria-hidden="true" className="living-core-scan absolute inset-0" />
              <span className="relative font-mono text-[8px] tracking-[0.24em] text-cyan-200/70 sm:text-[10px]">PERSONAL SYSTEM</span>
              <h1 className="relative mt-2 text-[clamp(2.15rem,10vw,4.9rem)] font-semibold leading-[0.92] tracking-[-0.07em] text-white">
                彦骁的
                <span className="living-core-title block bg-gradient-to-r from-cyan-200 via-sky-200 to-violet-300 bg-clip-text text-transparent">笔记</span>
              </h1>
              <span className="relative mt-3 font-mono text-[8px] tracking-[0.18em] text-slate-600 sm:text-[10px]">TECH · AI · MARKET · LIFE</span>
            </div>
          </div>

          <Link aria-label="浏览笔记" className="living-node living-node-a" to="/notes">
            <span className="living-node-dot" />
            <span className="living-node-label">NOTES</span>
            <span className="living-node-caption">阅读</span>
          </Link>

          <Link aria-label="查看现在" className="living-node living-node-b" to="/now">
            <span className="living-node-dot" />
            <span className="living-node-label">NOW</span>
            <span className="living-node-caption">此刻</span>
          </Link>

          <Link aria-label="查看时间轴" className="living-node living-node-c" to="/timeline">
            <span className="living-node-dot" />
            <span className="living-node-label">TIMELINE</span>
            <span className="living-node-caption">轨迹</span>
          </Link>

          <Link aria-label="关于本站" className="living-node living-node-d" to="/about">
            <span className="living-node-dot" />
            <span className="living-node-label">ABOUT</span>
            <span className="living-node-caption">关于</span>
          </Link>

          <Link aria-label="进入私人资源" className="living-node living-node-e" to="/resources">
            <LockKeyhole className="living-node-icon" />
            <span className="living-node-label">PRIVATE</span>
            <span className="living-node-caption">资源</span>
          </Link>

          <button aria-haspopup="dialog" aria-label="打开终端" className="living-node living-node-f" onClick={openTerminal} type="button">
            <Terminal className="living-node-icon" />
            <span className="living-node-label">TERM</span>
            <span className="living-node-caption">终端</span>
          </button>

          <span aria-hidden="true" className="living-topic living-topic-tech">TECH</span>
          <span aria-hidden="true" className="living-topic living-topic-ai">AI</span>
          <span aria-hidden="true" className="living-topic living-topic-market">MARKET</span>
        </div>

        <div className="living-hero-copy mx-auto w-full max-w-2xl pb-6 text-center sm:pb-10">
          <p className="mx-auto max-w-xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7">
            技术、AI、金融市场，以及一些值得长期留下来的记录。
          </p>
          <div className="mt-4 flex items-center justify-center gap-3 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-700 sm:text-[10px]">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-cyan-300/30" />
            <span>touch · explore · scroll</span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-violet-300/30" />
          </div>
        </div>
      </div>
    </section>
  );
}
