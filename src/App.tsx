import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import AiDisclaimer from "./components/common/AiDisclaimer";
import Footer from "./components/common/Footer";
import SiteHeader from "./components/common/SiteHeader";

function App() {
  const { pathname } = useLocation();
  const [readingProgress, setReadingProgress] = useState(0);
  const [routePending, setRoutePending] = useState(false);
  const showHeader = !pathname.startsWith("/wedding");
  const showAiDisclaimer =
    showHeader && (pathname === "/" || pathname.startsWith("/notes"));
  const showFooter =
    !pathname.startsWith("/auth") && !pathname.startsWith("/resources");
  const showReadingProgress = /^\/notes\/[^/]+$/.test(pathname);

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

      const nextRoute = url.hash.startsWith("#/") ? url.hash.slice(1) : null;
      if (!nextRoute || nextRoute === pathname) return;

      setRoutePending(true);
    };

    document.addEventListener("click", handleNavigationIntent, true);
    return () => document.removeEventListener("click", handleNavigationIntent, true);
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
    <div className="min-h-screen bg-[#070a12]">
      {routePending && (
        <div
          aria-label="正在加载页面"
          aria-live="polite"
          className="fixed inset-x-0 top-0 z-[200] h-0.5 overflow-hidden bg-white/5"
          role="progressbar"
        >
          <div className="h-full w-1/3 animate-[route-loading_1s_ease-in-out_infinite] bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400" />
        </div>
      )}
      {showHeader && (
        <div className="sticky top-0 z-[110]">
          <SiteHeader />
          {showAiDisclaimer && <AiDisclaimer />}
          {showReadingProgress && (
            <div
              aria-hidden="true"
              className="absolute bottom-0 left-0 z-[120] h-0.5 w-full origin-left bg-gradient-to-r from-cyan-300 to-violet-400"
              style={{ transform: `scaleX(${readingProgress})` }}
            />
          )}
        </div>
      )}
      <Outlet />
      {showFooter && <Footer />}
    </div>
  );
}

export default App;
