import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import AiDisclaimer from "./components/common/AiDisclaimer";
import Footer from "./components/common/Footer";
import SiteHeader from "./components/common/SiteHeader";
import { useFunctionHeartbeat } from "./hooks/useFunctionHeartbeat";
import { ROUTE_NAVIGATION_CANCELLED_EVENT } from "./lib/routePrefetch";

function App() {
  const { pathname } = useLocation();
  useFunctionHeartbeat(pathname.startsWith("/resources") || pathname.startsWith("/auth"));
  const [readingProgress, setReadingProgress] = useState(0);
  const [routePending, setRoutePending] = useState(false);
  const isWedding = pathname.startsWith("/wedding");
  const isHome = pathname === "/";
  const showHeader = !isWedding && !isHome;
  const showAiDisclaimer =
    showHeader && pathname.startsWith("/notes");
  const showFooter =
    !pathname.startsWith("/auth") && !pathname.startsWith("/resources");
  const showReadingProgress = /^\/notes\/[^/]+\/?$/.test(pathname);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    setRoutePending(false);
  }, [pathname]);

  useEffect(() => {
    const handleNavigationIntent = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const nextPath = url.pathname.replace(/\/$/, "") || "/";
      const currentPath = pathname.replace(/\/$/, "") || "/";
      if (nextPath === currentPath && url.search === window.location.search) return;

      setRoutePending(true);
    };

    const handleNavigationCancelled = () => setRoutePending(false);
    document.addEventListener("click", handleNavigationIntent, true);
    window.addEventListener(ROUTE_NAVIGATION_CANCELLED_EVENT, handleNavigationCancelled);
    return () => {
      document.removeEventListener("click", handleNavigationIntent, true);
      window.removeEventListener(ROUTE_NAVIGATION_CANCELLED_EVENT, handleNavigationCancelled);
    };
  }, [pathname]);

  useEffect(() => {
    if (!showReadingProgress) {
      setReadingProgress(0);
      return;
    }

    const updateProgress = () => {
      const available =
        document.documentElement.scrollHeight - window.innerHeight;
      const next = available > 0 ? window.scrollY / available : 0;
      const clamped = Math.min(1, Math.max(0, next));
      const viewportWidth = document.documentElement.clientWidth;
      const aligned =
        viewportWidth > 0
          ? Math.round(viewportWidth * clamped) / viewportWidth
          : clamped;
      setReadingProgress(aligned);
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [showReadingProgress, pathname]);

  return (
    <div className={`min-h-screen ${isWedding ? "bg-[#fff1ec]" : isHome ? "bg-[#0b1014]" : "bg-[#070a12]"}`}>
      {showHeader && (
        <div className="sticky top-0 z-[110]">
          <SiteHeader />
          {showAiDisclaimer && <AiDisclaimer />}
          {routePending && (
            <div
              aria-label="正在加载页面"
              aria-live="polite"
              className="absolute bottom-0 left-0 z-[130] h-0.5 w-full overflow-hidden bg-white/5"
              role="progressbar"
            >
              <div className="h-full w-1/3 animate-[route-loading_1s_ease-in-out_infinite] bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400" />
            </div>
          )}
          {showReadingProgress && !routePending && (
            <div
              aria-hidden="true"
              className="absolute bottom-0 left-0 z-[120] h-0.5 w-full origin-left bg-gradient-to-r from-cyan-300 to-violet-400"
              style={{ transform: `scaleX(${readingProgress})` }}
            />
          )}
        </div>
      )}
      {!showHeader && routePending && (
        <div
          aria-label="正在加载页面"
          aria-live="polite"
          className="fixed inset-x-0 top-0 z-[200] h-0.5 overflow-hidden bg-white/5"
          role="progressbar"
        >
          <div className="h-full w-1/3 animate-[route-loading_1s_ease-in-out_infinite] bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400" />
        </div>
      )}
      <Outlet />
      {showFooter && <Footer compact={isHome} />}
    </div>
  );
}

export default App;
