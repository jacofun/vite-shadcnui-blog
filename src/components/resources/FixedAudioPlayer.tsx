import {
  MediaControlBar,
  MediaController,
  MediaMuteButton,
  MediaPlaybackRateButton,
  MediaPlayButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from "media-chrome/react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type JSX } from "react";

import PrivatePlaybackResumePrompt from "@/components/resources/PrivatePlaybackResumePrompt";
import { usePrivatePlayback } from "@/hooks/usePrivatePlayback";
import {
  isPrivateMediaSourceExpiring,
  type PrivateMediaSource,
} from "@/lib/privateMedia";

interface Props {
  source: PrivateMediaSource;
  title: string;
  refreshSource: (force?: boolean) => Promise<PrivateMediaSource>;
}

const MEDIA_READY_TIMEOUT_MS = 8_000;

const mediaStyles = {
  "--media-background-color": "transparent",
  "--media-control-background": "transparent",
  "--media-control-hover-background": "rgba(255, 255, 255, 0.08)",
  "--media-primary-color": "rgb(226 232 240)",
  "--media-secondary-color": "rgb(8 12 21)",
  "--media-time-range-buffered-color": "rgba(148, 163, 184, 0.28)",
  "--media-range-track-background": "rgba(148, 163, 184, 0.22)",
  "--media-range-bar-color": "rgb(103 232 249)",
} as CSSProperties;

const playButtonStyles = {
  "--media-control-height": "32px",
  "--media-button-icon-width": "32px",
  "--media-button-icon-height": "32px",
} as CSSProperties;

function waitForMetadata(audio: HTMLAudioElement): Promise<void> {
  if (audio.readyState >= 1) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error("媒体地址刷新后加载超时")), MEDIA_READY_TIMEOUT_MS);
    const loaded = () => finish();
    const failed = () => finish(new Error("媒体地址刷新后仍无法加载"));
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      audio.removeEventListener("loadedmetadata", loaded);
      audio.removeEventListener("error", failed);
      if (error) reject(error);
      else resolve();
    };
    audio.addEventListener("loadedmetadata", loaded, { once: true });
    audio.addEventListener("error", failed, { once: true });
  });
}

export default function FixedAudioPlayer({ source, title, refreshSource }: Props): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceRef = useRef(source);
  const refreshingRef = useRef(false);
  const playIntentRef = useRef(false);
  const consecutiveRecoveryAttemptsRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const {
    dismissResume,
    prepareRestart,
    prepareResume,
    resumeState,
    suppressNextMetadataRestore,
  } = usePrivatePlayback(audioRef);

  sourceRef.current = source;

  const refreshMedia = useCallback(async (force: boolean, resumeAfterRefresh: boolean): Promise<void> => {
    const audio = audioRef.current;
    if (!audio || refreshingRef.current) return;

    const position = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const rate = audio.playbackRate;
    const shouldResume = resumeAfterRefresh || !audio.paused || playIntentRef.current;
    refreshingRef.current = true;
    setRefreshing(true);
    setPlaybackError(null);

    if (!audio.paused) audio.pause();

    try {
      const nextSource = await refreshSource(force);
      sourceRef.current = nextSource;
      if (audio.currentSrc !== nextSource.url && audio.src !== nextSource.url) {
        suppressNextMetadataRestore();
        audio.src = nextSource.url;
        audio.load();
        await waitForMetadata(audio);
      }
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = Math.min(position, Math.max(0, audio.duration - 0.25));
      } else if (position > 0) {
        audio.currentTime = position;
      }
      audio.playbackRate = rate;
      if (shouldResume) await audio.play();
    } catch (error) {
      playIntentRef.current = false;
      setPlaybackError(error instanceof Error ? error.message : "播放地址恢复失败");
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [refreshSource, suppressNextMetadataRestore]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const play = () => {
      playIntentRef.current = true;
      if (!refreshingRef.current && isPrivateMediaSourceExpiring(sourceRef.current)) {
        void refreshMedia(false, true);
      }
    };
    const playing = () => {
      consecutiveRecoveryAttemptsRef.current = 0;
      setPlaybackError(null);
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
        setPlaybackError("媒体仍无法播放，请重新进入私人资源后再试。");
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
        void refreshMedia(false, !audio.paused);
      }
    };

    audio.addEventListener("play", play);
    audio.addEventListener("playing", playing);
    audio.addEventListener("pause", pause);
    audio.addEventListener("ended", ended);
    audio.addEventListener("error", mediaError);
    document.addEventListener("visibilitychange", visibility);

    return () => {
      audio.removeEventListener("play", play);
      audio.removeEventListener("playing", playing);
      audio.removeEventListener("pause", pause);
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("error", mediaError);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [refreshMedia]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || audio.currentSrc === source.url || audio.src === source.url) return;
    const position = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const rate = audio.playbackRate;
    const shouldResume = !audio.paused;
    refreshingRef.current = true;
    suppressNextMetadataRestore();
    audio.src = source.url;
    audio.load();
    void waitForMetadata(audio).then(async () => {
      audio.playbackRate = rate;
      if (position > 0) audio.currentTime = position;
      if (shouldResume) await audio.play();
    }).catch(() => undefined).finally(() => {
      refreshingRef.current = false;
    });
  }, [source.url, suppressNextMetadataRestore]);

  const resume = async () => {
    const audio = audioRef.current;
    if (!audio || !prepareResume()) return;
    if (isPrivateMediaSourceExpiring(sourceRef.current)) {
      playIntentRef.current = true;
      await refreshMedia(false, true);
      return;
    }
    try {
      await audio.play();
    } catch {
      // The normal player controls remain available if autoplay is rejected.
    }
  };

  const restart = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    prepareRestart();
    if (isPrivateMediaSourceExpiring(sourceRef.current)) {
      playIntentRef.current = true;
      await refreshMedia(false, true);
      return;
    }
    try {
      await audio.play();
    } catch {
      // The normal player controls remain available if autoplay is rejected.
    }
  };

  return (
    <aside
      aria-label="资源音频播放器"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-white/10 bg-[#080c15]/95 shadow-[0_-18px_50px_rgba(0,0,0,0.38)] backdrop-blur-xl"
    >
      <div className="mx-auto max-w-6xl px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center justify-between gap-3 px-2 pb-1">
          <p className="truncate text-xs font-medium text-slate-400">{title}</p>
          <div className="flex shrink-0 items-center gap-2 text-[11px]">
            {refreshing && <span className="text-cyan-300">正在恢复播放…</span>}
            {!refreshing && playbackError && <span className="max-w-44 truncate text-rose-300 sm:max-w-none">{playbackError}</span>}
            {resumeState && !refreshing && (
              <PrivatePlaybackResumePrompt
                onDismiss={dismissResume}
                onRestart={() => void restart()}
                onResume={() => void resume()}
                position={resumeState.position}
              />
            )}
          </div>
        </div>
        <MediaController audio className="block w-full overflow-hidden rounded-xl bg-white/[0.035]" style={mediaStyles}>
          <audio preload="metadata" ref={audioRef} slot="media" src={source.url} />
          <MediaControlBar className="flex w-full items-center px-1">
            <MediaTimeDisplay showDuration />
            <MediaTimeRange />
          </MediaControlBar>
          <div className="relative min-h-14 px-1 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="absolute left-0 top-1/2 flex min-w-0 -translate-y-1/2 justify-start sm:static sm:translate-y-0">
              <MediaPlaybackRateButton aria-label="调整播放速度" />
            </div>
            <div className="contents sm:flex sm:items-center sm:justify-center sm:gap-2">
              <MediaSeekBackwardButton
                aria-label="后退 10 秒"
                className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:static sm:translate-x-0 sm:translate-y-0"
                seekOffset={10}
              />
              <MediaPlayButton
                aria-label="播放或暂停"
                className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/10 text-cyan-100 transition hover:bg-cyan-300/20 sm:static sm:translate-x-0 sm:translate-y-0"
                style={playButtonStyles}
              />
              <MediaSeekForwardButton
                aria-label="前进 10 秒"
                className="absolute left-3/4 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:static sm:translate-x-0 sm:translate-y-0"
                seekOffset={10}
              />
            </div>
            <div className="absolute right-0 top-1/2 flex min-w-0 -translate-y-1/2 items-center justify-end sm:static sm:translate-y-0">
              <MediaMuteButton aria-label="静音" />
              <MediaVolumeRange className="hidden sm:inline-flex" />
            </div>
          </div>
        </MediaController>
      </div>
    </aside>
  );
}
