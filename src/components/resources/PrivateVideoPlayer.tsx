import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type JSX } from "react";

import {
  isPrivateMediaSourceExpiring,
  type PrivateMediaSource,
} from "@/lib/privateMedia";

interface Props {
  source: PrivateMediaSource;
  refreshSource: (force?: boolean) => Promise<PrivateMediaSource>;
}

const MEDIA_READY_TIMEOUT_MS = 8_000;

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error("视频地址刷新后加载超时")), MEDIA_READY_TIMEOUT_MS);
    const loaded = () => finish();
    const failed = () => finish(new Error("视频地址刷新后仍无法加载"));
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", loaded);
      video.removeEventListener("error", failed);
      if (error) reject(error);
      else resolve();
    };
    video.addEventListener("loadedmetadata", loaded, { once: true });
    video.addEventListener("error", failed, { once: true });
  });
}

export default function PrivateVideoPlayer({ source, refreshSource }: Props): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sourceRef = useRef(source);
  const refreshingRef = useRef(false);
  const playIntentRef = useRef(false);
  const consecutiveRecoveryAttemptsRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  sourceRef.current = source;

  const refreshMedia = useCallback(async (force: boolean, resumeAfterRefresh: boolean) => {
    const video = videoRef.current;
    if (!video || refreshingRef.current) return;

    const position = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const shouldResume = resumeAfterRefresh || !video.paused || playIntentRef.current;
    refreshingRef.current = true;
    setRefreshing(true);
    setError(null);
    if (!video.paused) video.pause();

    try {
      const nextSource = await refreshSource(force);
      sourceRef.current = nextSource;
      if (video.currentSrc !== nextSource.url && video.src !== nextSource.url) {
        video.src = nextSource.url;
        video.load();
        await waitForMetadata(video);
      }
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.min(position, Math.max(0, video.duration - 0.25));
      } else if (position > 0) {
        video.currentTime = position;
      }
      if (shouldResume) await video.play();
    } catch (refreshError) {
      playIntentRef.current = false;
      setError(refreshError instanceof Error ? refreshError.message : "视频地址恢复失败");
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [refreshSource]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const play = () => {
      playIntentRef.current = true;
      if (!refreshingRef.current && isPrivateMediaSourceExpiring(sourceRef.current)) {
        void refreshMedia(false, true);
      }
    };
    const playing = () => {
      consecutiveRecoveryAttemptsRef.current = 0;
      setError(null);
    };
    const pause = () => {
      if (!refreshingRef.current) playIntentRef.current = false;
    };
    const mediaError = () => {
      if (refreshingRef.current) return;
      if (consecutiveRecoveryAttemptsRef.current >= 1) {
        setError("视频仍无法播放，请重新进入私人资源后再试。");
        return;
      }
      consecutiveRecoveryAttemptsRef.current += 1;
      void refreshMedia(true, playIntentRef.current);
    };
    const visibility = () => {
      if (
        document.visibilityState === "visible" &&
        !refreshingRef.current &&
        isPrivateMediaSourceExpiring(sourceRef.current)
      ) {
        void refreshMedia(false, !video.paused);
      }
    };

    video.addEventListener("play", play);
    video.addEventListener("playing", playing);
    video.addEventListener("pause", pause);
    video.addEventListener("error", mediaError);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      video.removeEventListener("play", play);
      video.removeEventListener("playing", playing);
      video.removeEventListener("pause", pause);
      video.removeEventListener("error", mediaError);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [refreshMedia]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || video.currentSrc === source.url || video.src === source.url) return;
    const position = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const shouldResume = !video.paused;
    refreshingRef.current = true;
    video.src = source.url;
    video.load();
    void waitForMetadata(video).then(async () => {
      if (position > 0) video.currentTime = position;
      if (shouldResume) await video.play();
    }).catch(() => undefined).finally(() => {
      refreshingRef.current = false;
    });
  }, [source.url]);

  return (
    <div className="space-y-3">
      {refreshing && <p className="flex items-center gap-2 text-sm text-cyan-300"><RefreshCw className="size-4 animate-spin" />正在恢复播放…</p>}
      {!refreshing && error && <p className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-100">{error}</p>}
      <video
        className="aspect-video w-full rounded-2xl bg-black"
        controls
        controlsList="nodownload"
        onContextMenu={(event) => event.preventDefault()}
        playsInline
        preload="metadata"
        ref={videoRef}
        src={source.url}
      />
    </div>
  );
}
