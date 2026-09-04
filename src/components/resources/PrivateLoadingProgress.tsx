import { useEffect, useState, type JSX } from "react";

import { cn } from "@/lib/utils";

const EXPECTED_LOADING_TIME_MS = 8_000;
const UPDATE_INTERVAL_MS = 200;
const COUNTDOWN_UPDATE_INTERVAL_MS = 100;
const COMPLETION_DELAY_MS = 260;
const RING_RADIUS = 38;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

type LoadingVariant = "bar" | "countdown";

export default function PrivateLoadingProgress({
  className,
  failed = false,
  label,
  loading,
  variant = "bar",
}: {
  className?: string;
  failed?: boolean;
  label: string;
  loading: boolean;
  variant?: LoadingVariant;
}): JSX.Element | null {
  const [visible, setVisible] = useState(loading);
  const [progress, setProgress] = useState(0);
  const [remainingMs, setRemainingMs] = useState(EXPECTED_LOADING_TIME_MS);
  const [overdue, setOverdue] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (failed) {
        setVisible(false);
        return;
      }
      setProgress(100);
      setRemainingMs(0);
      setOverdue(false);
      const completionTimer = window.setTimeout(() => setVisible(false), COMPLETION_DELAY_MS);
      return () => window.clearTimeout(completionTimer);
    }

    setVisible(true);
    setProgress(0);
    setRemainingMs(EXPECTED_LOADING_TIME_MS);
    setOverdue(false);
    const startedAt = performance.now();
    const curvePower = 1.45 + Math.random() * 0.7;

    const update = () => {
      const elapsed = performance.now() - startedAt;
      const ratio = Math.min(elapsed / EXPECTED_LOADING_TIME_MS, 1);
      const target = ratio === 1
        ? 99
        : 99 * (1 - Math.pow(1 - ratio, curvePower)) + Math.random() * 1.8;
      setProgress((current) => Math.min(99, Math.max(current, target)));
      setRemainingMs(Math.max(0, EXPECTED_LOADING_TIME_MS - elapsed));
      if (ratio === 1) setOverdue(true);
    };

    update();
    const progressTimer = window.setInterval(
      update,
      variant === "countdown" ? COUNTDOWN_UPDATE_INTERVAL_MS : UPDATE_INTERVAL_MS,
    );
    const overdueTimer = window.setTimeout(() => {
      setProgress(99);
      setRemainingMs(0);
      setOverdue(true);
    }, EXPECTED_LOADING_TIME_MS);
    return () => {
      window.clearInterval(progressTimer);
      window.clearTimeout(overdueTimer);
    };
  }, [failed, loading, variant]);

  if (!visible) return null;

  const roundedProgress = Math.round(progress);

  if (variant === "countdown") {
    const remainingRatio = Math.min(1, Math.max(0, remainingMs / EXPECTED_LOADING_TIME_MS));
    const remainingSeconds = Math.ceil(remainingMs / 1_000);
    const dashOffset = RING_CIRCUMFERENCE * (1 - remainingRatio);

    return (
      <div aria-live="polite" className={cn("flex w-full flex-col items-center text-center", className)}>
        <span className="text-xs text-slate-400">{progress === 100 ? "加载完成" : label}</span>
        <div className="relative mt-4 size-24" aria-label={label} role="status">
          <svg aria-hidden="true" className="size-24 -rotate-90" viewBox="0 0 96 96">
            <circle
              className="stroke-white/[0.07]"
              cx="48"
              cy="48"
              fill="none"
              r={RING_RADIUS}
              strokeWidth="5"
            />
            <circle
              className="stroke-cyan-300 transition-[stroke-dashoffset] duration-100 ease-linear"
              cx="48"
              cy="48"
              fill="none"
              r={RING_RADIUS}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeWidth="5"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono text-2xl font-medium tabular-nums text-cyan-200">
            {remainingSeconds}
          </span>
        </div>
        {overdue && (
          <p className="mt-4 text-xs leading-6 text-amber-200/80">加载时间超过预期，仍在等待服务响应…</p>
        )}
      </div>
    );
  }

  return (
    <div aria-live="polite" className={cn("w-full", className)}>
      <div className="flex items-center justify-between gap-4 text-xs">
        <span className="text-slate-400">{progress === 100 ? "加载完成" : label}</span>
        <span className="font-mono tabular-nums text-cyan-300">{roundedProgress}%</span>
      </div>
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={roundedProgress}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-cyan-300 to-sky-300 shadow-[0_0_14px_rgba(34,211,238,0.35)] transition-[width] duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      {overdue && (
        <p className="mt-3 text-xs leading-6 text-amber-200/80">加载时间超过预期，仍在等待服务响应…</p>
      )}
    </div>
  );
}
