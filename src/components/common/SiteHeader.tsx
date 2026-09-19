import { useEffect, useRef, useState, type JSX } from "react";
import { ChevronDown, Heart, Menu, Search } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { prefetchPrimaryPublicRoutes, prefetchPublicRoute } from "@/lib/routePrefetch";

const primaryNavigation = [
  { label: "首页", to: "/" },
  { label: "笔记", to: "/notes" },
  { label: "碎片", to: "/fragments" },
  { label: "现在", to: "/now" },
  { label: "关于", to: "/about" },
] as const;

const secondaryNavigation = [
  { label: "资源", to: "/resources" },
  { label: "婚礼纪念", to: "/wedding", wedding: true },
] as const;

const navigation = [...primaryNavigation, ...secondaryNavigation] as const;

function isNavigationActive(pathname: string, to: string): boolean {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

export default function SiteHeader(): JSX.Element {
  const location = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const timer = window.setTimeout(prefetchPrimaryPublicRoutes, 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        setMoreMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen && !moreMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        setMobileMenuOpen(false);
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mobileMenuOpen, moreMenuOpen]);

  const preloadProps = (to: string) => ({
    onFocus: () => prefetchPublicRoute(to),
    onMouseEnter: () => prefetchPublicRoute(to),
    onTouchStart: () => prefetchPublicRoute(to),
  });
  const moreMenuActive = secondaryNavigation.some((item) => isNavigationActive(location.pathname, item.to));

  return (
    <header
      className="relative border-b border-white/10 bg-[#070a12]/95 lg:bg-[#070a12]/85 lg:backdrop-blur-xl"
      data-site-header
      ref={headerRef}
    >
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-8 lg:px-10">
        <Link className="text-sm font-semibold tracking-[0.16em] text-white transition hover:text-cyan-100" to="/">
          <span className="hidden min-[360px]:inline">YANXIAO.ME</span>
          <span className="min-[360px]:hidden">YX</span>
        </Link>

        <nav aria-label="主导航" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-5 md:flex lg:gap-7">
          {primaryNavigation.map((item) => {
            const isActive = isNavigationActive(location.pathname, item.to);
            return (
              <Link
                {...preloadProps(item.to)}
                aria-current={isActive ? "page" : undefined}
                className={`relative inline-flex items-center gap-1.5 py-2 text-sm transition after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:transition-transform ${
                  isActive
                      ? "text-slate-100 after:scale-x-100 after:bg-cyan-300/70"
                      : "text-slate-400 hover:text-slate-200 after:scale-x-0 after:bg-cyan-300/70"
                }`}
                key={item.to}
                to={item.to}
              >
                {item.label}
              </Link>
            );
          })}

          <div className="relative">
            <button
              aria-expanded={moreMenuOpen}
              className={`inline-flex items-center gap-1 py-2 text-sm transition ${moreMenuActive || moreMenuOpen ? "text-slate-100" : "text-slate-400 hover:text-slate-200"}`}
              onClick={() => setMoreMenuOpen((open) => !open)}
              type="button"
            >
              更多
              <ChevronDown className={`size-3.5 transition-transform ${moreMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {moreMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] w-44 rounded-xl border border-white/10 bg-[#0a0e18]/98 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
                {secondaryNavigation.map((item) => {
                  const isActive = isNavigationActive(location.pathname, item.to);
                  const isWedding = "wedding" in item && item.wedding;
                  return (
                    <Link
                      {...preloadProps(item.to)}
                      className={`flex min-h-10 items-center justify-between rounded-lg px-3 text-sm transition ${isActive ? "bg-white/[0.05] text-white" : isWedding ? "text-rose-300/80 hover:bg-rose-300/[0.06] hover:text-rose-200" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"}`}
                      key={item.to}
                      to={item.to}
                    >
                      {item.label}
                      {isWedding && <Heart className="size-3.5" />}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        <Link
          aria-label="搜索笔记"
          className="hidden size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/[0.05] hover:text-cyan-300 md:flex"
          to="/notes"
        >
          <Search className="size-4" />
        </Link>

        <button
          aria-controls="mobile-navigation"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "收起导航菜单" : "展开导航菜单"}
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
                  {...preloadProps(item.to)}
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
  );
}
