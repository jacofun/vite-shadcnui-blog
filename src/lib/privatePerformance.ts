const PRIVATE_PERF_KEY = "yanxiao:private-perf";

export function isPrivatePerformanceEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return false;

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("perf") === "1") {
      window.localStorage.setItem(PRIVATE_PERF_KEY, "1");
      return true;
    }
    if (params.get("perf") === "0") {
      window.localStorage.removeItem(PRIVATE_PERF_KEY);
      return false;
    }
    return window.localStorage.getItem(PRIVATE_PERF_KEY) === "1";
  } catch {
    return false;
  }
}

export function logPrivatePerformance(
  label: string,
  durationMs: number,
  detail?: Record<string, string | number | boolean>,
): void {
  if (!isPrivatePerformanceEnabled()) return;
  console.debug(
    `[private-perf] ${label} ${Math.round(durationMs)}ms`,
    detail ?? {},
  );
}
