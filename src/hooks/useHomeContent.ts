import { useEffect, useMemo, useState } from "react";

import { buildHomeContent } from "@/lib/homeContent";
import { notes } from "@/lib/notes";
import { getPublicContent, type PublishingEntry } from "@/lib/publishing";

// Do not select a temporary text-only feature while public image content is still loading.
// Keep the same public snapshot for the header search and the homepage.
export function useHomeContent(enabled: boolean) {
  const [published, setPublished] = useState<PublishingEntry[] | null>(null);

  useEffect(() => {
    if (!enabled || published !== null) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      // An unavailable public snapshot must not leave the homepage in loading state.
      setPublished((current) => current ?? []);
      controller.abort();
    }, 10_000);

    getPublicContent(controller.signal)
      .then((entries) => {
        if (!controller.signal.aborted) {
          setPublished(Array.isArray(entries) ? entries : []);
        }
      })
      .catch(() => {
        // Keep local notes usable when public OSS content cannot be fetched.
        if (!controller.signal.aborted) setPublished([]);
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [enabled, published]);

  return useMemo(() => ({
    items: buildHomeContent(notes, published ?? []),
    ready: published !== null,
  }), [published]);
}
