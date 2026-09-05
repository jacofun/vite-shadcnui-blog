import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
} from "react";
import { Heart, Menu } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { terminalOpenEvent } from "@/lib/terminal";

const TerminalDialog = lazy(
  () => import("@/components/terminal/TerminalDialog"),
);

const navigation = [
  { label: "首页", to: "/" },
  { label: "笔记", to: "/notes" },
  { label: "资源", to: "/resources" },
  { label: "关于", to: "/about" },
  { label: "婚礼纪念", to: "/wedding", wedding: true },
] as const;

const terminalOpenStorageKey = "yanxiao-terminal-open";

function readStoredTerminalOpen(): boolean {
  try {
    return window.sessionStorage.getItem(terminalOpenStorageKey) === "true";
  } catch {
    return false;
  }
}

function isNavigationActive(pathname: string, to: string): boolean {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

export default function SiteHeader(): JSX.Element {
  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(readStoredTerminalOpen);
  const [hasTerminalMounted, setHasTerminalMounted] = useState(isTerminalOpen);

  const updateTerminalOpen = useCallback((open: boolean) => {
    if (open) {
      setHasTerminalMounted(true);
    }

    setIsTerminalOpen(open);

    try {
      window.sessionStorage.setItem(terminalOpenStorageKey, String(open));
    } catch {
      // The terminal remains usable when session storage is unavailable.
    }
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.code === "Backquote") {
        event.preventDefault();
        setIsTerminalOpen((value) => {
          const nextValue = !value;
          if (nextValue) setHasTerminalMounted(true);

          try {
            window.sessionStorage.setItem(
              terminalOpenStorageKey,
              String(nextValue),
            );
          } catch {
            // The shortcut remains usable when session storage is unavailable.
          }

          return nextValue;
        });
      }

      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    const handleTerminalOpen = () => updateTerminalOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener(terminalOpenEvent, handleTerminalOpen);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(terminalOpenEvent, handleTerminalOpen);
    };
  }, [updateTerminalOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mobileMenuOpen]);

  return (
    <>
      <header
        className="relative border-b border-white/10 bg-[#070a12]/95 lg:bg-[#070a12]/85 lg:backdrop-blur-xl"
        data-site-header
        ref={headerRef}
      >
        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-8 lg:px-10">
          <Link
            className="text-sm font-semibold tracking-[0.16em] text-white transition hover:text-cyan-100"
            to="/"
          >
            <span className="hidden min-[360px]:inline">YANXIAO.ME</span>
            <span className="min-[360px]:hidden">YX</span>
          </Link>

          <nav
            aria-label="主导航"
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex"
          >
            {navigation.map((item) => {
              const isActive = isNavigationActive(location.pathname, item.to);
              const isWedding = "wedding" in item && item.wedding;

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={`relative inline-flex items-center gap-1.5 py-2 text-sm transition after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:transition-transform ${
                    isWedding
                      ? isActive
                        ? "text-rose-200 after:scale-x-100 after:bg-rose-300/70"
                        : "text-rose-300/80 hover:text-rose-200 after:scale-x-0 after:bg-rose-300/70"
                      : isActive
                        ? "text-slate-100 after:scale-x-100 after:bg-cyan-300/70"
                        : "text-slate-400 hover:text-slate-200 after:scale-x-0 after:bg-cyan-300/70"
                  }`}
                  key={item.to}
                  to={item.to}
                >
                  {item.label}
                  {isWedding && <Heart className="size-3.5" />}
                </Link>
              );
            })}
          </nav>

          <button
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "收起导航菜单" : "展开导航菜单"}
            aria-controls="mobile-navigation"
            className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white md:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            type="button"
          >
            <Menu className="size-5" />
          </button>

          {mobileMenuOpen && (
            <nav
              aria-label="移动端主导航"
              className="absolute right-6 top-[calc(100%+0.5rem)] z-20 w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e18]/98 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl sm:right-8 md:hidden"
              id="mobile-navigation"
            >
              {navigation.map((item) => {
                const isActive = isNavigationActive(location.pathname, item.to);
                const isWedding = "wedding" in item && item.wedding;

                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={`relative flex min-h-11 items-center justify-between rounded-xl px-4 py-2.5 text-sm transition after:absolute after:inset-x-4 after:bottom-1 after:h-px ${
                      isWedding
                        ? isActive
                          ? "bg-rose-300/[0.06] text-rose-200 after:bg-rose-300/70"
                          : "text-rose-300/80 hover:bg-rose-300/[0.06] hover:text-rose-200 after:bg-transparent"
                        : isActive
                          ? "bg-white/[0.05] text-slate-100 after:bg-cyan-300/70"
                          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 after:bg-transparent"
                    }`}
                    key={item.to}
                    to={item.to}
                  >
                    <span>{item.label}</span>
                    {isWedding && <Heart className="size-3.5" />}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </header>

      {hasTerminalMounted && (
        <Suspense fallback={null}>
          <TerminalDialog
            onOpenChange={updateTerminalOpen}
            open={isTerminalOpen}
          />
        </Suspense>
      )}
    </>
  );
}
