import type { JSX } from "react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface CountdownTimerProps {
  targetDate: Date;
  className?: string;
}

type TimeParts = {
  totalMilliseconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getTimeParts(targetTimestamp: number): TimeParts {
  const diff = Math.max(0, targetTimestamp - Date.now());
  const totalSeconds = Math.floor(diff / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    totalMilliseconds: diff,
    days,
    hours,
    minutes,
    seconds,
  };
}

export default function CountdownTimer({
  targetDate,
  className,
}: CountdownTimerProps): JSX.Element {
  const targetTimestamp = targetDate.getTime();
  const [timeLeft, setTimeLeft] = useState<TimeParts>(() =>
    getTimeParts(targetTimestamp)
  );

  useEffect(() => {
    let intervalId: number;

    const update = () => {
      const next = getTimeParts(targetTimestamp);
      setTimeLeft(next);

      if (next.totalMilliseconds === 0) {
        window.clearInterval(intervalId);
      }
    };

    intervalId = window.setInterval(update, 1000);
    update();

    return () => window.clearInterval(intervalId);
  }, [targetTimestamp]);

  const segments = [
    { label: "天", value: timeLeft.days.toString() },
    { label: "时", value: timeLeft.hours.toString().padStart(2, "0") },
    { label: "分", value: timeLeft.minutes.toString().padStart(2, "0") },
    { label: "秒", value: timeLeft.seconds.toString().padStart(2, "0") },
  ];

  return (
    <div className={cn("flex flex-col items-center gap-2 text-center", className)}>
      <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
        距离仪式开始还有
      </p>
      <div className="flex flex-wrap items-baseline justify-center gap-x-6 gap-y-2 font-mono text-foreground md:flex-nowrap">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-baseline gap-2">
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.1, ease: "easeIn" }}
              key={segment.value}
              className="text-base font-semibold tabular-nums">
              {segment.value}
            </motion.span>
            <span className="text-xs text-muted-foreground">
              {segment.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

