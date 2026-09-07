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
import { useEffect, useRef, useState, type CSSProperties, type JSX } from "react";

import {
  isPrivateMediaSourceExpiring,
  type PrivateMediaSource,
} from "@/lib/privateMedia";

interface Props {
  source: PrivateMediaSource;
  title: string;
  refreshSource: (force?: boolean) => Promise<PrivateMediaSource>;
}

interface SavedPlaybackState {
  playbackRate: number;
  position: number;
  updatedAt: number;
}

const PLAYBACK_STORAGE_PREFIX = "yanxiao:private-playback:v1:";
const RESUME_MIN_SECONDS = 10;
const RESUME_END_GUARD_SECONDS = 10;
const SAVE_INTERVAL_MS = 4_000;
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

function playbackStorageKey(): string {
  const route = typeof window === "undefined" ? "private-resource" : window.location.pathname;
  return `${PLAYBACK_STORAGE_PREFIX}${route}`;
}

function readPlaybackState(key: string): SavedPlaybackState | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SavedPlaybackState>;
    if (
      typeof value.position !== "number" || !Number.isFinite(value.position) || value.position < 0 ||
      typeof value.playbackRate !== "number" || !Number.isFinite(value.playbackRate) || value.playbackRate < 0.5 || value.playbackRate > 3
    ) {
      return null;
    }
    return {
      position: value.position,
      playbackRate: value.playbackRate,
      updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

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
  const lastSavedAt = useRef(0);
  const sourceRef = useRef(source);
  const refreshingRef = useRef(false);
  const playIntentRef = useRef(false);
  const consecutiveRecoveryAttemptsRef = useRef(0);
  const [resumePosition, setResumePosition] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const storageKey = playbackStorageKey();

  sourceRef.current = source;

  const refreshMedia = async (force: boolean, resumeAfterRefresh: boolean): Promise<void> => {
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
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const save = (force = false) => {
      if (!Number.isFinite(audio.currentTime) || audio.currentTime < RESUME_MIN_SECONDS || audio.ended) return;
      const now = Date.now();
      if (!force && now - lastSavedAt.current < SAVE_INTERVAL_MS) return;
      lastSavedAt.current = now;
      try {
        const value: SavedPlaybackState = {
          position: audio.currentTime,
          playbackRate: audio.playbackRate,
          updatedAt: now,
        };
        window.localStorage.setItem(storageKey, JSON.stringify(value));
      } catch {
        // Playback persistence is a convenience only; player operation must not depend on storage.
      }
    };

    const loaded = () => {
      if (refreshingRef.current) return;
      const saved = readPlaybackState(storageKey);
      if (!saved) {
        setResumePosition(null);
        return;
      }
      audio.playbackRate = saved.playbackRate;
      if (
        saved.position >= RESUME_MIN_SECONDS &&
        Number.isFinite(audio.duration) &&
        saved.position <= Math.max(0, audio.duration - RESUME_END_GUARD_SECONDS)
      ) {
        setResumePosition(saved.position);
      } else {
        setResumePosition(null);
      }
    };
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
    const timeUpdate = () => save(false);
    const pause = () => {
      save(true);
      if (!refreshingRef.current) playIntentRef.current = false;
    };
    const rateChange = () => save(true);
    const ended = () => {
      playIntentRef.current = false;
      setResumePosition(null);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Ignore storage failures.
      }
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

    audio.addEventListener("loadedmetadata", loaded);
    audio.addEventListener("play", play);
    audio.addEventListener("playing", playing);
    audio.addEventListener("timeupdate", timeUpdate);
    audio.addEventListener("pause", pause);
    audio.addEventListener("ratechange", rateChange);
    audio.addEventListener("ended", ended);
    audio.addEventListener("error", mediaError);
    document.addEventListener("visibilitychange", visibility);
    if (audio.readyState >= 1) loaded();

    return () => {
      save(true);
      audio.removeEventListener("loadedmetadata", loaded);
      audio.removeEventListener("play", play);
      audio.removeEventListener("playing", playing);
      audio.removeEventListener("timeupdate", timeUpdate);
      audio.removeEventListener("pause", pause);
      audio.removeEventListener("ratechange", rateChange);
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("error", mediaError);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [storageKey]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || audio.currentSrc === source.url || audio.src === source.url) return;
    const position = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const rate = audio.playbackRate;
    const shouldResume = !audio.paused;
    refreshingRef.current = true;
    audio.src = source.url;
    audio.load();
    void waitForMetadata(audio).then(async () => {
      audio.playbackRate = rate;
      if (position > 0) audio.currentTime = position;
      if (shouldResume) await audio.play();
    }).catch(() => undefined).finally(() => {
      refreshingRef.current = false;
    });
  }, [source.url]);

  const resume = async () => {
    const audio = audioRef.current;
    if (!audio || resumePosition === null) return;
    if (isPrivateMediaSourceExpiring(sourceRef.current)) {
      audio.currentTime = resumePosition;
      setResumePosition(null);
      playIntentRef.current = true;
      await refreshMedia(false, true);
      return;
    }
    audio.currentTime = resumePosition;
    setResumePosition(null);
    try {
      await audio.play();
    } catch {
      // The normal player controls remain available if autoplay is rejected.
    }
  };

  const restart = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setResumePosition(null);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore storage failures.
    }
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
            {resumePosition !== null && !refreshing && (
              <>
                <span className="hidden text-slate-500 sm:inline">上次播放到 {formatTime(resumePosition)}</span>
                <button className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] px-2.5 py-1 text-cyan-200 transition hover:bg-cyan-300/[0.14]" onClick={() => void resume()} type="button">继续</button>
                <button className="rounded-lg border border-white/10 px-2.5 py-1 text-slate-400 transition hover:text-slate-200" onClick={() => void restart()} type="button">从头</button>
              </>
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
