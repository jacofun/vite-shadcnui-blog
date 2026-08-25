// hooks/useWalineLike.ts
import { useCallback, useEffect, useMemo, useState } from "react";

type Reactions = Record<string, number>;

export function useWalineLike(opts: { serverURL: string; path?: string; key?: string; emoji?: string }) {
  const {
    serverURL,
    path = (typeof window !== "undefined" ? location.pathname : "/"),
    key = "heart",
    emoji = "❤️",
  } = opts;

  const storageKey = useMemo(() => `waline-like:${path}:${key}`, [path, key]);
  const [likedCount, setlikedCount] = useState<number>(0);
  const [liked, setLiked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        const url = new URL("/api/article", serverURL);
        url.searchParams.set("path", path);
        url.searchParams.set("type", "reaction0");
        const res = await fetch(url.toString(), { method: "GET" });
        const data = (await res.json()) as Reactions;
        let val = 0;
        if (Array.isArray(data.data) && data.data.length > 0) {
          const first = data.data[0];
          val = typeof first.reaction0 === "number" ? first.reaction0 : 0;
        }

        setlikedCount(val);
      } catch {
        // 忽略网络错误，保持 0
      } finally {
        setLoading(false);
        if (!aborted) setLiked(Boolean(localStorage.getItem(storageKey)));
      }
    })();

    return () => {
      aborted = true;
    };
  }, [serverURL, path, storageKey, key, emoji]);

  const like = useCallback(async () => {
    setLiked(true);
    setlikedCount((count) => count + 1);
    let val = 0;

    try {
      const url = new URL("/api/article", serverURL);
      const body = {
        path,
        type: "reaction0",
      };
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as Reactions;
      if (Array.isArray(data.data) && data.data.length > 0) {
        const first = data.data[0];
        val = typeof first.reaction0 === "number" ? first.reaction0 : 0;
      }
      setlikedCount(val);
    } catch {
      setLiked(false);
      setlikedCount((count) => Math.max(0, count - 1));
    } finally {
      setLoading(false);
    }
  }, [serverURL, path]);

  return { likedCount, liked, loading, like };
}
