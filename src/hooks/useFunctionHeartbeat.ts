import { useEffect } from "react";

const INTERVAL_MS = 60_000;
const TIMEOUT_MS = 10_000;

/** One foreground heartbeat for the app, independent of routes and auth sessions. */
export function useFunctionHeartbeat(): void {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    function pause(): void {
      clearTimeout(timer);
      controller?.abort();
      controller = undefined;
    }

    function canRun(): boolean {
      return !stopped && document.visibilityState === "visible" && navigator.onLine;
    }

    async function ping(): Promise<void> {
      if (!canRun() || controller) return;
      const current = new AbortController();
      controller = current;
      const timeout = setTimeout(() => current.abort(), TIMEOUT_MS);
      try {
        await fetch("/api/private-auth/health", {
          method: "POST",
          credentials: "omit",
          cache: "no-store",
          signal: current.signal,
        });
      } catch {
        // A best-effort heartbeat must not interrupt browsing or trigger auth UI.
      } finally {
        clearTimeout(timeout);
        if (controller === current) {
          controller = undefined;
          if (canRun()) timer = setTimeout(() => void ping(), INTERVAL_MS);
        }
      }
    }

    function resume(): void {
      pause();
      if (canRun()) void ping();
    }

    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    window.addEventListener("offline", pause);
    window.addEventListener("pagehide", pause);
    window.addEventListener("pageshow", resume);
    void ping();

    return () => {
      stopped = true;
      pause();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", pause);
      window.removeEventListener("pagehide", pause);
      window.removeEventListener("pageshow", resume);
    };
  }, []);
}
