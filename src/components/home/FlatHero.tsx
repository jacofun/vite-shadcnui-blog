import {
  useEffect,
  useRef,
  type CSSProperties,
  type JSX,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ArrowRight, FolderLock } from "lucide-react";
import { Link } from "react-router-dom";

type FlatHeroStyle = CSSProperties & Record<`--${string}`, string | number>;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const titleCharacters = ["彦", "骁", "的", "笔", "记"] as const;

const flatHeroCss = `
.flat-hero {
  touch-action: pan-y;
  background:
    radial-gradient(80% 55% at 84% 42%, rgb(34 211 238 / 0.045), transparent 72%),
    #070a12;
}

.flat-stage {
  opacity: var(--flat-scroll-opacity);
  transform: translate3d(0, var(--flat-scroll-y), 0);
  will-change: transform, opacity;
}

.flat-grid {
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.026) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.026) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: linear-gradient(to bottom, transparent 0%, black 22%, black 68%, transparent 100%);
  opacity: 0.45;
  transform: translate3d(calc(var(--flat-touch-x) * 0.32), 0, 0);
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.flat-copy,
.flat-bottom-row {
  transform: translate3d(calc(var(--flat-touch-x) * 0.08), 0, 0);
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.flat-ghost-word {
  right: -0.12em;
  top: 46%;
  font-size: clamp(7rem, 34vw, 20rem);
  font-weight: 700;
  line-height: 0.7;
  letter-spacing: -0.08em;
  color: transparent;
  -webkit-text-stroke: 1px rgb(148 163 184 / 0.075);
  opacity: 0.9;
  transform: translate3d(calc(var(--flat-touch-x) * -0.55 + var(--flat-ghost-shift)), -50%, 0);
  user-select: none;
  white-space: nowrap;
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.flat-signal {
  left: -12vw;
  top: 48%;
  width: 124vw;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgb(148 163 184 / 0.04) 12%,
    rgb(103 232 249 / 0.18) 47%,
    rgb(167 139 250 / 0.12) 66%,
    transparent 100%
  );
  transform: translate3d(calc(var(--flat-touch-x) + var(--flat-line-shift)), 0, 0);
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.flat-signal::before,
.flat-signal::after {
  content: "";
  position: absolute;
  top: -1px;
  height: 3px;
  border-radius: 999px;
  opacity: 0;
}

.flat-signal::before {
  left: 7%;
  width: 72px;
  background: linear-gradient(90deg, transparent, rgb(103 232 249 / 0.9), transparent);
}

.flat-signal::after {
  left: 42%;
  width: 46px;
  background: linear-gradient(90deg, transparent, rgb(196 181 253 / 0.72), transparent);
}

.flat-title-char,
.flat-title-glyph {
  display: inline-block;
}

.flat-title-char:nth-child(1) {
  --flat-char-delay: 40ms;
  --flat-char-phase: -0.2s;
}

.flat-title-char:nth-child(2) {
  --flat-char-delay: 110ms;
  --flat-char-phase: -1.1s;
}

.flat-title-char:nth-child(3) {
  --flat-char-delay: 180ms;
  --flat-char-phase: -2s;
}

.flat-title-char:nth-child(4) {
  --flat-char-delay: 250ms;
  --flat-char-phase: -2.9s;
}

.flat-title-char:nth-child(5) {
  --flat-char-delay: 320ms;
  --flat-char-phase: -3.8s;
}

.flat-title-accent {
  background-size: 180% 100%;
  background-position: 0% 50%;
}

.flat-primary-link,
.flat-secondary-link {
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    color 180ms ease,
    transform 180ms ease;
}

.flat-primary-link:hover,
.flat-primary-link:focus-visible {
  background: rgb(207 250 254);
  outline: none;
}

.flat-secondary-link {
  border: 1px solid rgb(148 163 184 / 0.18);
  background: rgb(255 255 255 / 0.025);
  color: rgb(203 213 225);
}

.flat-secondary-link:hover,
.flat-secondary-link:focus-visible {
  border-color: rgb(103 232 249 / 0.28);
  background: rgb(103 232 249 / 0.06);
  color: rgb(207 250 254);
  outline: none;
}

.flat-primary-link:active,
.flat-secondary-link:active {
  transform: translateY(1px) scale(0.985);
}

.flat-topic {
  position: relative;
}

.flat-topic + .flat-topic::before {
  content: "/";
  position: absolute;
  left: -0.8rem;
  color: rgb(51 65 85 / 0.9);
}

@keyframes flat-title-flow {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes flat-title-reveal {
  from {
    opacity: 0;
    filter: blur(5px);
  }
  to {
    opacity: 1;
    filter: blur(0);
  }
}

@keyframes flat-title-drift {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, -2px, 0); }
}

@keyframes flat-signal-run {
  0% { transform: translateX(-90px); opacity: 0; }
  10% { opacity: 0.9; }
  84% { opacity: 0.9; }
  100% { transform: translateX(112vw); opacity: 0; }
}

@keyframes flat-ghost-breathe {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

@media (max-width: 639px) {
  .flat-stage {
    min-height: min(66svh, 610px);
  }

  .flat-ghost-word {
    top: 47%;
    font-size: clamp(7rem, 39vw, 10rem);
  }

  .flat-signal {
    top: 49%;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .flat-title-char {
    animation: flat-title-reveal 680ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--flat-char-delay);
  }

  .flat-title-glyph {
    animation: flat-title-drift 5.8s ease-in-out infinite;
    animation-delay: var(--flat-char-phase);
  }

  .flat-title-accent {
    animation-name: flat-title-drift, flat-title-flow;
    animation-duration: 5.8s, 7.5s;
    animation-timing-function: ease-in-out, ease-in-out;
    animation-iteration-count: infinite, infinite;
    animation-delay: var(--flat-char-phase), 0s;
  }

  .flat-signal::before {
    animation: flat-signal-run 6.8s linear infinite;
  }

  .flat-signal::after {
    animation: flat-signal-run 9.2s linear -4.1s infinite;
  }

  .flat-ghost-word {
    animation: flat-ghost-breathe 8s ease-in-out infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .flat-stage,
  .flat-grid,
  .flat-copy,
  .flat-bottom-row,
  .flat-ghost-word,
  .flat-signal,
  .flat-title-char,
  .flat-title-glyph {
    transform: none !important;
    opacity: 1 !important;
    filter: none !important;
    transition: none !important;
  }

  .flat-title-char,
  .flat-title-glyph,
  .flat-title-accent,
  .flat-signal::before,
  .flat-signal::after,
  .flat-ghost-word {
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
        hero.style.setProperty("--flat-ghost-shift", "0px");
        return;
      }

      const rect = hero.getBoundingClientRect();
      const travel = Math.max(Math.min(hero.offsetHeight * 0.82, 560), 320);
      const progress = clamp(-rect.top / travel, 0, 1);
      hero.style.setProperty("--flat-scroll-y", `${(-18 * progress).toFixed(2)}px`);
      hero.style.setProperty("--flat-scroll-opacity", (1 - progress * 0.34).toFixed(4));
      hero.style.setProperty("--flat-line-shift", `${(42 * progress).toFixed(2)}px`);
      hero.style.setProperty("--flat-ghost-shift", `${(-26 * progress).toFixed(2)}px`);
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
    const strength = event.pointerType === "touch" ? 9 : 6;
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
    "--flat-ghost-shift": "0px",
  };

  return (
    <section
      className="flat-hero relative isolate overflow-hidden border-b border-white/[0.07]"
      onPointerCancel={resetField}
      onPointerLeave={resetField}
      onPointerMove={moveField}
      onPointerUp={resetField}
      ref={heroRef}
      style={style}
    >
      <style>{flatHeroCss}</style>
      <div aria-hidden="true" className="flat-grid pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="flat-ghost-word pointer-events-none absolute font-sans">NOTES</div>
      <div aria-hidden="true" className="flat-signal pointer-events-none absolute" />

      <div className="flat-stage relative mx-auto flex min-h-[62svh] w-full max-w-6xl flex-col justify-center px-6 pb-10 pt-14 sm:min-h-[620px] sm:px-8 sm:pb-14 lg:px-10">
        <div className="flat-copy relative z-10 max-w-3xl">
          <h1 className="flat-title whitespace-nowrap text-[clamp(2.65rem,12vw,4.4rem)] font-semibold leading-[0.94] tracking-[-0.06em] text-white sm:text-[clamp(4rem,7vw,6.2rem)]">
            {titleCharacters.map((character, index) => (
              <span className="flat-title-char" key={`${character}-${index}`}>
                <span
                  className={
                    index >= 3
                      ? "flat-title-glyph flat-title-accent bg-gradient-to-r from-cyan-200 via-sky-200 to-violet-300 bg-clip-text text-transparent"
                      : "flat-title-glyph"
                  }
                >
                  {character}
                </span>
              </span>
            ))}
          </h1>

          <p className="mt-6 max-w-lg text-sm leading-7 text-slate-400 sm:mt-7 sm:text-base sm:leading-8">
            技术、AI、金融市场，以及一些值得长期留下来的记录。
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-8">
            <Link className="flat-primary-link inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-950" to="/notes">
              浏览全部笔记
              <ArrowRight className="size-4" />
            </Link>
            <Link className="flat-secondary-link inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium" to="/resources">
              <FolderLock className="size-4" />
              私人资源
            </Link>
          </div>
        </div>

        <div className="flat-bottom-row relative z-10 mt-14 flex items-end justify-between gap-6 border-t border-white/[0.07] pt-4 sm:mt-20">
          <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[8px] uppercase tracking-[0.18em] text-slate-700 sm:text-[9px]">
            <span className="flat-topic">TECH</span>
            <span className="flat-topic">AI</span>
            <span className="flat-topic">MARKET</span>
            <span className="flat-topic">LIFE</span>
          </div>
          <span className="hidden font-mono text-[8px] uppercase tracking-[0.18em] text-slate-800 sm:inline">SCROLL / 01</span>
        </div>
      </div>
    </section>
  );
}
