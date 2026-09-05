import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import AiDisclaimer from "./components/common/AiDisclaimer";
import Footer from "./components/common/Footer";
import SiteHeader from "./components/common/SiteHeader";

function App() {
  const { pathname } = useLocation();
  const [readingProgress, setReadingProgress] = useState(0);
  const showHeader = !pathname.startsWith("/wedding");
  const showAiDisclaimer =
    showHeader && (pathname === "/" || pathname.startsWith("/notes"));
  const showFooter =
    !pathname.startsWith("/auth") && !pathname.startsWith("/resources");
  const showReadingProgress = /^\/notes\/[^/]+$/.test(pathname);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  useEffect(() => {
    if (!showReadingProgress) {
      setReadingProgress(0);
      return;
    }

    const updateProgress = () => {
      const available =
        document.documentElement.scrollHeight - window.innerHeight;
      const next = available > 0 ? (window.scrollY / available) * 100 : 0;
      setReadingProgress(Math.min(100, Math.max(0, next)));
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
      {showHeader && (
        <div className="sticky top-0 z-[110]">
          <SiteHeader />
          {showAiDisclaimer && <AiDisclaimer />}
          {showReadingProgress && (
            <div
              aria-hidden="true"
              className="absolute bottom-0 left-0 z-[120] h-0.5 w-full origin-left bg-gradient-to-r from-cyan-300 to-violet-400"
              style={{ transform: `scaleX(${readingProgress / 100})` }}
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
