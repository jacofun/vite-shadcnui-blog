import type { JSX } from "react";
import { AlertTriangle } from "lucide-react";

export default function AiDisclaimer(): JSX.Element {
  return (
    <div className="relative z-20 border-b border-amber-300/15 bg-amber-300/[0.055]">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-6 py-2 text-[11px] leading-5 text-amber-100/70 sm:px-8 lg:px-10">
        <AlertTriangle className="size-3.5 shrink-0 text-amber-300/80" />
        <p>
          本站部分内容由 AI 生成或辅助整理，信息可能有误，请注意甄别。
        </p>
      </div>
    </div>
  );
}
