import { useEffect, useState, type JSX } from "react";
import { AlertTriangle } from "lucide-react";

const ACKNOWLEDGEMENT_KEY = "yanxiao-ai-disclaimer-acknowledged";

export default function AiDisclaimer(): JSX.Element | null {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(ACKNOWLEDGEMENT_KEY) === "true") {
      return;
    }

    const timer = window.setTimeout(() => setIsVisible(true), 1000);

    return () => window.clearTimeout(timer);
  }, []);

  const acknowledge = () => {
    window.localStorage.setItem(ACKNOWLEDGEMENT_KEY, "true");
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <aside
      aria-label="AI 内容提示"
      className="ai-disclaimer-enter fixed inset-x-0 top-16 z-[80] border-b border-amber-300/25 bg-[#16130b]/95 shadow-[0_12px_40px_rgba(0,0,0,0.3)] lg:bg-[#16130b]/90 lg:backdrop-blur-xl"
      role="status"
    >
      <div className="mx-auto flex min-h-11 max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-2 text-[11px] leading-5 text-amber-100/75">
          <AlertTriangle className="size-3.5 shrink-0 text-amber-300" />
          <p>
            本站部分内容由 AI 生成或辅助整理，信息可能有误，请注意甄别。
          </p>
        </div>
        <button
          className="shrink-0 rounded-lg border border-amber-200/20 bg-amber-100/10 px-3 py-1.5 text-[11px] font-medium text-amber-100 transition hover:border-amber-200/35 hover:bg-amber-100/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
          onClick={acknowledge}
          type="button"
        >
          我知道了
        </button>
      </div>
    </aside>
  );
}
