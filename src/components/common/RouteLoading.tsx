import { LoaderCircle } from "lucide-react";
import { useEffect, useState, type JSX } from "react";

const ROUTE_LOADING_DELAY_MS = 180;

export default function RouteLoading(): JSX.Element {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), ROUTE_LOADING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="min-h-[calc(100svh-4rem)] bg-[#070a12] text-slate-100"
    >
      {visible && (
        <div className="mx-auto flex min-h-[45vh] max-w-6xl items-center px-6 sm:px-8 lg:px-10">
          <div className="inline-flex items-center gap-3 text-sm text-slate-500">
            <LoaderCircle className="size-4 animate-spin text-cyan-300" />
            正在载入页面
          </div>
        </div>
      )}
    </main>
  );
}
