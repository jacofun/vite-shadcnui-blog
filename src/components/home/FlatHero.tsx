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

const flatHeroCss = `
.flat-hero {
  touch-action: pan-y;
  background: #070a12;
}

.flat-stage {
  opacity: var(--flat-scroll-opacity);
  transform: translate3d(0, var(--flat-scroll-y), 0);
  will-change: transform, opacity;
}

.flat-grid {
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.032) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.032) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: linear-gradient(to bottom, transparent 0%, black 18%, black 72%, transparent 100%);
  opacity: 0.5;
  transform: translate3d(calc(var(--flat-touch-x) * 0.45), 0, 0);
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.flat-copy,
.flat-meta,
.flat-nav,
.flat-footer-mark {
  transform: translate3d(calc(var(--flat-touch-x) * 0.12), 0, 0);
  transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.flat-title-accent {
  background-size: 170% 100%;
  background-position: 0% 50%;
}

.flat-accent-line {
  height: 1px;
  width: min(86vw, 920px);
  background: linear-gradient(90deg, transparent, rgb(103 232 249 / 0.32) 28%, rgb(148 163 184 / 0.11) 62%, transparent);
  transform: translate3d(calc(var(--flat-touch-x) + var(--flat-line-shift)), 0, 0);
  transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.flat-accent-line::after {
  content: "";
  position: absolute;
  top: -1px;
  left: 0;
  width: 42px;
  height: 3px;
  background: linear-gradient(90deg, transparent, rgb(103 232 249 / 0.78), transparent);
  opacity: 0.72;
}

.flat-accent-line-a {
  left: -18vw;
  top: 33%;
}

.flat-accent-line-b {
  right: -26vw;
  top: 68%;
  opacity: 0.55;
  transform: translate3d(calc(0px - var(--flat-touch-x) - var(--flat-line-shift)), 0, 0);
}

.flat-primary-link,
.flat-nav-link {
  -webkit-tap-highlight-color: transparent;
  transition: color 180ms ease, transform 180ms ease;
}

.flat-primary-link {
  position: relative;
  padding-bottom: 5px;
}

.flat-primary-link::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 1px;
  background: rgb(103 232 249 / 0.55);
  transform-origin: left;
  transform: scaleX(0.34);
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.flat-primary-link:hover::after,
.flat-primary-link:focus-visible::after {
  transform: scaleX(1);
}

.flat-nav-link:hover,
.flat-nav-link:focus-visible {
  color: rgb(165 243 252);
  outline: none;
}

.flat-nav-link:active,
.flat-primary-link:active {
  transform: translateY(1px);
}

.flat-signal-dot {
  box-shadow: 0 0 8px rgb(34 211 238 / 0.55);
}

@keyframes flat-title-flow {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes flat-line-scan {
  from { transform: translateX(-42px); opacity: 0; }
  12% { opacity: 0.8; }
  88% { opacity: 0.8; }
  to { transform: translateX(min(86vw, 920px)); opacity: 0; }
}

@keyframes flat-dot-pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}

@media (max-width: 639px) {
  .flat-stage {
    min-height: min(76svh, 690px);
  }

  .flat-meta {
    margin-bottom: clamp(2.25rem, 7svh, 4.25rem);
  }

  .flat-accent-line-a {
    top: 30%;
  }

  .flat-accent-line-b {
    top: 72%;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .flat-title-accent {
    animation: flat-title-flow 8s ease-in-out infinite;
  }

  .flat-accent-line::after {
    animation: flat-line-scan 6.5s linear infinite;
  }

  .flat-accent-line-b::after {
    animation-delay: -3.1s;
  }

  .flat-signal-dot {
    animation: flat-dot-pulse 2.6s ease-in-out infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .flat-stage,
  .flat-grid,
  .flat-copy,
  .flat-meta,
  .flat-nav,
  .flat-footer-mark,
  .flat-accent-line {
    transform: none !important;
    opacity: 1 !important;
    transition: none !important;
  }

  .flat-title-accent,
  .flat-accent-line::after,
  .flat-signal-dot {
    animation: none !important;
  }
}
`;

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
  };

  const resetField = () => {
    heroRef.current?.style.setProperty("--flat-touch-x", "0px");
  };

  const style: FlatHeroStyle = {
    "--flat-touch-x": "0px",
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
      <style>{flatHeroCss}</style>
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
