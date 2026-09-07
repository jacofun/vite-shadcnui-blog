import {
  MediaControlBar,
  MediaController,
  MediaFullscreenButton,
  MediaMuteButton,
  MediaPlaybackRateButton,
  MediaPlayButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from "media-chrome/react";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type JSX } from "react";

import PrivatePlaybackResumePrompt from "@/components/resources/PrivatePlaybackResumePrompt";
import { usePrivatePlayback } from "@/hooks/usePrivatePlayback";
import {
  isPrivateMediaSourceExpiring,
  type PrivateMediaSource,
} from "@/lib/privateMedia";

interface Props {
  source: PrivateMediaSource;
  refreshSource: (force?: boolean) => Promise<PrivateMediaSource>;
}

const MEDIA_READY_TIMEOUT_MS = 8_000;

const controllerStyles = {
  "--media-background-color": "transparent",
  "--media-control-background": "transparent",
  "--media-control-hover-background": "rgba(255, 255, 255, 0.10)",
  "--media-primary-color": "rgb(241 245 249)",
  "--media-secondary-color": "rgb(8 12 21)",
  "--media-time-range-buffered-color": "rgba(148, 163, 184, 0.30)",
  "--media-range-track-background": "rgba(226, 232, 240, 0.22)",
  "--media-range-bar-color": "rgb(103 232 249)",
} as CSSProperties;

const playButtonStyles = {
  "--media-control-height": "42px",
  "--media-button-icon-width": "28px",
  "--media-button-icon-height": "28px",
} as CSSProperties;

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
  const {
    dismissResume,
    prepareRestart,
    prepareResume,
    resumeState,
    suppressNextMetadataRestore,
  } = usePrivatePlayback(videoRef);

  sourceRef.current = source;

  const refreshMedia = useCallback(async (force: boolean, resumeAfterRefresh: boolean) => {
    const video = videoRef.current;
    if (!video || refreshingRef.current) return;

    const position = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const rate = video.playbackRate;
    const shouldResume = resumeAfterRefresh || !video.paused || playIntentRef.current;
    refreshingRef.current = true;
    setRefreshing(true);
    setError(null);
    if (!video.paused) video.pause();

    try {
      const nextSource = await refreshSource(force);
      sourceRef.current = nextSource;
      if (video.currentSrc !== nextSource.url && video.src !== nextSource.url) {
        suppressNextMetadataRestore();
        video.src = nextSource.url;
        video.load();
        await waitForMetadata(video);
      }
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.min(position, Math.max(0, video.duration - 0.25));
      } else if (position > 0) {
        video.currentTime = position;
      }
      video.playbackRate = rate;
      if (shouldResume) await video.play();
    } catch (refreshError) {
      playIntentRef.current = false;
      setError(refreshError instanceof Error ? refreshError.message : "视频地址恢复失败");
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [refreshSource, suppressNextMetadataRestore]);

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
    const ended = () => {
      playIntentRef.current = false;
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
    video.addEventListener("ended", ended);
    video.addEventListener("error", mediaError);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      video.removeEventListener("play", play);
      video.removeEventListener("playing", playing);
      video.removeEventListener("pause", pause);
      video.removeEventListener("ended", ended);
      video.removeEventListener("error", mediaError);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [refreshMedia]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || video.currentSrc === source.url || video.src === source.url) return;
    const position = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const rate = video.playbackRate;
    const shouldResume = !video.paused;
    refreshingRef.current = true;
    suppressNextMetadataRestore();
    video.src = source.url;
    video.load();
    void waitForMetadata(video).then(async () => {
      video.playbackRate = rate;
      if (position > 0) video.currentTime = position;
      if (shouldResume) await video.play();
    }).catch(() => undefined).finally(() => {
      refreshingRef.current = false;
    });
  }, [source.url, suppressNextMetadataRestore]);

  const resume = async () => {
    const video = videoRef.current;
    if (!video || !prepareResume()) return;
    if (isPrivateMediaSourceExpiring(sourceRef.current)) {
      playIntentRef.current = true;
      await refreshMedia(false, true);
      return;
    }
    try {
      await video.play();
    } catch {
      // Media Chrome controls remain available if programmatic playback is rejected.
    }
  };

  const restart = async () => {
    const video = videoRef.current;
    if (!video) return;
    prepareRestart();
    if (isPrivateMediaSourceExpiring(sourceRef.current)) {
      playIntentRef.current = true;
      await refreshMedia(false, true);
      return;
    }
    try {
      await video.play();
    } catch {
      // Media Chrome controls remain available if programmatic playback is rejected.
    }
  };

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video || refreshingRef.current) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    if (isPrivateMediaSourceExpiring(sourceRef.current)) {
      playIntentRef.current = true;
      await refreshMedia(false, true);
      return;
    }
    try {
      await video.play();
    } catch {
      // The visible control bar remains the fallback on browsers requiring an explicit control tap.
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex min-h-7 items-center justify-end">
        {refreshing && <p className="flex items-center gap-2 text-xs text-cyan-300"><RefreshCw className="size-3.5 animate-spin" />正在恢复播放…</p>}
        {!refreshing && error && <p className="rounded-lg border border-rose-300/20 bg-rose-300/[0.06] px-3 py-1.5 text-xs text-rose-100">{error}</p>}
        {resumeState && !refreshing && !error && (
          <PrivatePlaybackResumePrompt
            className="justify-end"
            onDismiss={dismissResume}
            onRestart={() => void restart()}
            onResume={() => void resume()}
            position={resumeState.position}
          />
        )}
      </div>

      <MediaController
        className="relative block aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_24px_70px_rgba(0,0,0,0.32)]"
        style={controllerStyles}
      >
        <video
          className="h-full w-full bg-black object-contain"
          controlsList="nodownload"
          onClick={() => void togglePlayback()}
          onContextMenu={(event) => event.preventDefault()}
          playsInline
          preload="metadata"
          ref={videoRef}
          slot="media"
          src={source.url}
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/90 via-black/55 to-transparent" />

        <MediaControlBar className="absolute inset-x-0 bottom-11 z-10 flex h-8 items-center bg-transparent px-3">
          <MediaTimeRange aria-label="视频进度" />
        </MediaControlBar>

        <MediaControlBar className="absolute inset-x-0 bottom-0 z-10 flex h-12 items-center bg-black/20 px-1.5 backdrop-blur-sm sm:px-2">
          <MediaSeekBackwardButton aria-label="后退 10 秒" seekOffset={10} />
          <MediaPlayButton aria-label="播放或暂停" style={playButtonStyles} />
          <MediaSeekForwardButton aria-label="前进 10 秒" seekOffset={10} />
          <MediaTimeDisplay className="hidden sm:inline-flex" showDuration />
          <div className="flex-1" />
          <MediaPlaybackRateButton aria-label="调整播放速度" />
          <MediaMuteButton aria-label="静音" />
          <MediaVolumeRange className="hidden w-24 sm:inline-flex" />
          <MediaFullscreenButton aria-label="全屏" />
        </MediaControlBar>
      </MediaController>
    </div>
  );
}
