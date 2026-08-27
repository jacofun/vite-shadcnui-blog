import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import AiDisclaimer from "./components/common/AiDisclaimer";
import Footer from "./components/common/Footer";
import SiteHeader from "./components/common/SiteHeader";

function App() {
  const { pathname } = useLocation();
  const showAiDisclaimer =
    pathname === "/" || pathname.startsWith("/notes");

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#070a12]">
      {showAiDisclaimer && <AiDisclaimer />}
      <SiteHeader />
      <Outlet />
      <Footer />
    </div>
  );
}

export default App;
