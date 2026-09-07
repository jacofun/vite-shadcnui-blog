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

interface PendingRestore {
  position: number;
  shouldResume: boolean;
}

export default function FlvVideoPlayer({ source, refreshSource }: Props): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sourceRef = useRef(source);
  const pendingRestoreRef = useRef<PendingRestore | null>(null);
  const refreshingRef = useRef(false);
  const playIntentRef = useRef(false);
  const consecutiveRecoveryAttemptsRef = useRef(0);
  const [activeSource, setActiveSource] = useState(source);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      pendingRestoreRef.current = { position, shouldResume };
      if (activeSource.url === nextSource.url) {
        pendingRestoreRef.current = null;
        refreshingRef.current = false;
        setRefreshing(false);
        if (shouldResume) await video.play();
        return;
      }
      setActiveSource(nextSource);
    } catch (refreshError) {
      pendingRestoreRef.current = null;
      playIntentRef.current = false;
      refreshingRef.current = false;
      setRefreshing(false);
      setError(refreshError instanceof Error ? refreshError.message : "FLV 播放地址恢复失败");
    }
  }, [activeSource.url, refreshSource]);

  useEffect(() => {
    if (source.url !== activeSource.url) setActiveSource(source);
  }, [activeSource.url, source]);

  useEffect(() => {
    let disposed = false;
    let player: { destroy: () => void } | null = null;
    const video = videoRef.current;
    if (!video) return;

    setError(null);
    setLoading(true);

    const loadedMetadata = () => {
      const pending = pendingRestoreRef.current;
      if (!pending) return;
      pendingRestoreRef.current = null;
      if (pending.position > 0) video.currentTime = pending.position;
      if (pending.shouldResume) {
        void video.play().catch(() => {
          setError("播放地址已恢复，请再次点击播放。");
        });
      }
      refreshingRef.current = false;
      setRefreshing(false);
    };
    const play = () => {
      playIntentRef.current = true;
      if (!refreshingRef.current && isPrivateMediaSourceExpiring(sourceRef.current)) {
        void refreshMedia(false, true);
      }
    };
    const playing = () => {
      consecutiveRecoveryAttemptsRef.current = 0;
      refreshingRef.current = false;
      setRefreshing(false);
      setError(null);
    };
    const pause = () => {
      if (!refreshingRef.current) playIntentRef.current = false;
    };

    video.addEventListener("loadedmetadata", loadedMetadata);
    video.addEventListener("play", play);
    video.addEventListener("playing", playing);
    video.addEventListener("pause", pause);

    void import("mpegts.js").then((module) => {
      if (disposed || !videoRef.current) return;
      const mpegts = module.default;
      if (!mpegts.isSupported()) {
        setError("当前浏览器不支持 FLV 的 MSE 播放，请使用最新版 Chrome、Edge 或 Safari。");
        setLoading(false);
        refreshingRef.current = false;
        setRefreshing(false);
        return;
      }
      const instance = mpegts.createPlayer({ type: "flv", url: activeSource.url, isLive: false });
      instance.attachMediaElement(videoRef.current);
      instance.on(mpegts.Events.ERROR, () => {
        if (disposed) return;
        if (refreshingRef.current) {
          pendingRestoreRef.current = null;
          refreshingRef.current = false;
          setRefreshing(false);
          setError("FLV 播放地址恢复后仍无法加载。");
          return;
        }
        if (consecutiveRecoveryAttemptsRef.current >= 1) {
          setError("FLV 仍无法播放，请重新进入私人资源后再试。");
          return;
        }
        consecutiveRecoveryAttemptsRef.current += 1;
        void refreshMedia(true, playIntentRef.current);
      });
      instance.load();
      player = instance;
      setLoading(false);
    }).catch(() => {
      if (!disposed) {
        setError("FLV 播放器加载失败。");
        setLoading(false);
        refreshingRef.current = false;
        setRefreshing(false);
      }
    });

    return () => {
      disposed = true;
      video.removeEventListener("loadedmetadata", loadedMetadata);
      video.removeEventListener("play", play);
      video.removeEventListener("playing", playing);
      video.removeEventListener("pause", pause);
      player?.destroy();
    };
  }, [activeSource.url, refreshMedia]);

  useEffect(() => {
    const visibility = () => {
      const video = videoRef.current;
      if (
        document.visibilityState === "visible" &&
        video &&
        !refreshingRef.current &&
        isPrivateMediaSourceExpiring(sourceRef.current)
      ) {
        void refreshMedia(false, !video.paused);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [refreshMedia]);

  return (
    <div className="space-y-3">
      {(loading || refreshing) && <p className="flex items-center gap-2 text-sm text-slate-500"><RefreshCw className="size-4 animate-spin" />{refreshing ? "正在恢复播放…" : "正在加载 FLV 播放器…"}</p>}
      {error && <p className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-100">{error}</p>}
      <video className="aspect-video w-full rounded-2xl bg-black" controls controlsList="nodownload" onContextMenu={(event) => event.preventDefault()} playsInline ref={videoRef} />
    </div>
  );
}
