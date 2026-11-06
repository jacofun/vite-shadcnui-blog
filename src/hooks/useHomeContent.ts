import { useEffect, useMemo, useState } from "react";

import { buildHomeContent } from "@/lib/homeContent";
import { notes } from "@/lib/notes";
import { getPublicContent, type PublishingEntry } from "@/lib/publishing";

// Share the same public snapshots between the header search and homepage.
export function useHomeContent(enabled: boolean) {
  const [published, setPublished] = useState<PublishingEntry[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    getPublicContent(controller.signal)
      .then((entries) => {
        if (!controller.signal.aborted) {
          setPublished(Array.isArray(entries) ? entries : []);
        }
      })
      .catch(() => {
        // Local notes remain searchable when the public snapshot is unavailable.
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [enabled]);

  return useMemo(() => buildHomeContent(notes, published), [published]);
}
