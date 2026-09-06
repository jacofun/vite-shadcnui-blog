import {
  useEffect,
  useRef,
  type CSSProperties,
  type JSX,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ArrowRight, LockKeyhole, Terminal } from "lucide-react";
import { Link } from "react-router-dom";

import { openTerminal } from "@/lib/terminal";

type FlatHeroStyle = CSSProperties & Record<`--${string}`, string | number>;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function FlatHero(): JSX.Element {
  const heroRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updateScroll = () => {
      frameRef.current = null;
      if (reducedMotion.matches) {
        hero.style.setProperty("--flat-scroll-y", "0px");
        hero.style.setProperty("--flat-scroll-opacity", "1");
        hero.style.setProperty("--flat-line-shift", "0px");
        return;
      }

      const rect = hero.getBoundingClientRect();
      const travel = Math.max(Math.min(hero.offsetHeight * 0.8, 620), 360);
      const progress = clamp(-rect.top / travel, 0, 1);
      hero.style.setProperty("--flat-scroll-y", `${(-24 * progress).toFixed(2)}px`);
      hero.style.setProperty("--flat-scroll-opacity", (1 - progress * 0.42).toFixed(4));
      hero.style.setProperty("--flat-line-shift", `${(34 * progress).toFixed(2)}px`);
    };

    const scheduleScroll = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(updateScroll);
    };

    updateScroll();
    window.addEventListener("scroll", scheduleScroll, { passive: true });
    window.addEventListener("resize", scheduleScroll, { passive: true });
    reducedMotion.addEventListener("change", updateScroll);

    return () => {
      window.removeEventListener("scroll", scheduleScroll);
      window.removeEventListener("resize", scheduleScroll);
      reducedMotion.removeEventListener("change", updateScroll);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const moveField = (event: ReactPointerEvent<HTMLElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const nx = clamp(((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2, -1, 1);
    const strength = event.pointerType === "touch" ? 12 : 8;
    event.currentTarget.style.setProperty("--flat-touch-x", `${(nx * strength).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--flat-touch-progress", ((nx + 1) / 2).toFixed(4));
  };

  const resetField = () => {
    const hero = heroRef.current;
    if (!hero) return;
    hero.style.setProperty("--flat-touch-x", "0px");
    hero.style.setProperty("--flat-touch-progress", "0.5");
  };

  const style: FlatHeroStyle = {
    "--flat-touch-x": "0px",
    "--flat-touch-progress": "0.5",
    "--flat-scroll-y": "0px",
    "--flat-scroll-opacity": "1",
    "--flat-line-shift": "0px",
  };

  return (
    <section
      className="flat-hero relative isolate overflow-hidden border-b border-white/[0.08]"
      onPointerCancel={resetField}
      onPointerLeave={resetField}
      onPointerMove={moveField}
      onPointerUp={resetField}
      ref={heroRef}
      style={style}
    >
      <div aria-hidden="true" className="flat-grid pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="flat-accent-line flat-accent-line-a pointer-events-none absolute" />
      <div aria-hidden="true" className="flat-accent-line flat-accent-line-b pointer-events-none absolute" />

      <div className="flat-stage relative mx-auto flex min-h-[72svh] w-full max-w-6xl flex-col justify-center px-6 pb-12 pt-16 sm:min-h-[680px] sm:px-8 sm:pb-16 lg:px-10">
        <div className="flat-meta mb-10 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600 sm:text-[10px]">
          <span>YANXIAO.ME / NOTES</span>
          <span>EST. 2018</span>
        </div>

        <div className="flat-copy max-w-4xl">
          <p className="mb-4 text-xs font-medium tracking-[0.22em] text-cyan-300/80 sm:text-sm">PERSONAL NOTES</p>
          <h1 className="flat-title text-[clamp(4rem,20vw,8.5rem)] font-semibold leading-[0.82] tracking-[-0.075em] text-white sm:text-[clamp(5.5rem,12vw,9rem)]">
            <span className="block">彦骁的</span>
            <span className="flat-title-accent block bg-gradient-to-r from-cyan-200 via-sky-200 to-violet-300 bg-clip-text text-transparent">笔记</span>
          </h1>

          <div className="mt-8 grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <p className="max-w-xl text-sm leading-7 text-slate-400 sm:text-base sm:leading-8">
              技术、AI、金融市场，以及一些值得长期留下来的记录。
            </p>

            <Link className="flat-primary-link inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-100" to="/notes">
              浏览全部笔记
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <nav aria-label="首页快捷入口" className="flat-nav mt-12 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-white/[0.08] pt-5 text-xs text-slate-500 sm:mt-14 sm:text-sm">
          <Link className="flat-nav-link" to="/now">现在</Link>
          <Link className="flat-nav-link" to="/timeline">时间轴</Link>
          <Link className="flat-nav-link" to="/about">关于</Link>
          <Link className="flat-nav-link inline-flex items-center gap-1.5" to="/resources">
            <LockKeyhole className="size-3.5" />
            私人资源
          </Link>
          <button className="flat-nav-link inline-flex items-center gap-1.5" onClick={openTerminal} type="button">
            <Terminal className="size-3.5" />
            终端
          </button>
        </nav>

        <div aria-hidden="true" className="flat-footer-mark mt-8 flex items-center gap-3 font-mono text-[8px] uppercase tracking-[0.18em] text-slate-700 sm:text-[9px]">
          <span className="flat-signal-dot size-1 rounded-full bg-cyan-300" />
          <span>scroll to continue</span>
        </div>
      </div>
    </section>
  );
}
