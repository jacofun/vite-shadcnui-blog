import { useEffect, type JSX } from "react";

import { isPrivatePerformanceEnabled, logPrivatePerformance } from "@/lib/privatePerformance";

function resourceLabel(name: string): string | null {
  try {
    const url = new URL(name, window.location.origin);
    if (url.pathname.startsWith("/api/private-auth/")) {
      return `auth ${url.pathname.slice("/api/private-auth/".length) || "request"}`;
    }
    if (url.pathname.startsWith("/private/")) {
      return `resource ${url.pathname.split("/").slice(-2).join("/")}`;
    }
  } catch {
    return null;
  }
  return null;
}

export default function PrivatePerformanceObserver(): JSX.Element | null {
  useEffect(() => {
    if (!isPrivatePerformanceEnabled() || typeof PerformanceObserver === "undefined") return;

    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation) {
      logPrivatePerformance("page navigation", navigation.duration, {
        domInteractive: Math.round(navigation.domInteractive),
        responseEnd: Math.round(navigation.responseEnd),
      });
    }

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry instanceof PerformanceResourceTiming)) continue;
        const label = resourceLabel(entry.name);
        if (!label) continue;
        logPrivatePerformance(label, entry.duration, {
          transferBytes: entry.transferSize,
          responseStart: Math.round(entry.responseStart - entry.startTime),
        });
      }
    });

    try {
      observer.observe({ type: "resource", buffered: true });
    } catch {
      return;
    }
    return () => observer.disconnect();
  }, []);

  return null;
}
