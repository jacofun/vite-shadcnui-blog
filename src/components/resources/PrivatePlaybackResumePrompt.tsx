import { X } from "lucide-react";
import type { JSX } from "react";

import { formatPrivatePlaybackTime } from "@/lib/privatePlayback";

interface Props {
  position: number;
  onResume: () => void;
  onRestart: () => void;
  onDismiss: () => void;
  className?: string;
}

export default function PrivatePlaybackResumePrompt({
  position,
  onResume,
  onRestart,
  onDismiss,
  className = "",
}: Props): JSX.Element {
  return (
    <div className={`flex min-w-0 items-center gap-2 text-[11px] ${className}`}>
      <span className="hidden text-slate-500 sm:inline">上次播放到 {formatPrivatePlaybackTime(position)}</span>
      <button
        className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] px-2.5 py-1 text-cyan-200 transition hover:bg-cyan-300/[0.14]"
        onClick={onResume}
        type="button"
      >
        继续
      </button>
      <button
        className="rounded-lg border border-white/10 px-2.5 py-1 text-slate-400 transition hover:text-slate-200"
        onClick={onRestart}
        type="button"
      >
        从头
      </button>
      <button
        aria-label="关闭续播提示"
        className="grid size-7 place-items-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
        onClick={onDismiss}
        title="暂时忽略"
        type="button"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
