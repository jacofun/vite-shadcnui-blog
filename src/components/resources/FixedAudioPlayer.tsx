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
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type PointerEvent as ReactPointerEvent,
} from "react";

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
  expandable?: boolean;
}

interface PlayerDragState {
  pointerId: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocityY: number;
  startOffset: number;
  maxOffset: number;
  wasExpanded: boolean;
}

const MEDIA_READY_TIMEOUT_MS = 8_000;
const PLAYER_DRAG_THRESHOLD_PX = 80;
const PLAYER_DRAG_VELOCITY_THRESHOLD = 0.55;
const PLAYER_TAP_SLOP_PX = 6;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

const expandedPlayButtonStyles = {
  width: "min(50vw, 220px)",
  height: "min(50vw, 220px)",
  "--media-control-height": "min(50vw, 220px)",
  "--media-button-icon-width": "42%",
  "--media-button-icon-height": "42%",
} as CSSProperties;

const expandedSeekButtonStyles = {
  "--media-control-height": "64px",
  "--media-button-icon-width": "34px",
  "--media-button-icon-height": "34px",
} as CSSProperties;

const expandablePlayerCss = `
@keyframes private-audio-play-breathe {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgb(103 232 249 / 0.04);
  }
  50% {
    transform: scale(1.015);
    box-shadow: 0 0 0 10px rgb(103 232 249 / 0.055);
  }
}

.private-audio-expanded-play.is-playing {
  animation: private-audio-play-breathe 3.4s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .private-audio-expanded-play.is-playing {
    animation: none;
  }
}
`;

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

export default function FixedAudioPlayer({
  source,
  title,
  refreshSource,
  expandable = false,
}: Props): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceRef = useRef(source);
  const refreshingRef = useRef(false);
  const playIntentRef = useRef(false);
  const consecutiveRecoveryAttemptsRef = useRef(0);
  const sheetRef = useRef<HTMLElement | null>(null);
  const collapsedPanelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<PlayerDragState | null>(null);
  const ignoreHandleClickRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [dragProgress, setDragProgress] = useState(0);
  const [collapsedHeight, setCollapsedHeight] = useState(156);
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
      setIsPlaying(true);
    };
    const pause = () => {
      setIsPlaying(false);
      if (!refreshingRef.current) playIntentRef.current = false;
    };
    const ended = () => {
      setIsPlaying(false);
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

  useEffect(() => {
    if (!expandable) return;
    const panel = collapsedPanelRef.current;
    if (!panel) return;

    const updateHeight = () => {
      const nextHeight = Math.ceil(panel.getBoundingClientRect().height);
      if (nextHeight > 0) setCollapsedHeight(nextHeight);
    };

    updateHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [expandable]);

  useEffect(() => {
    if (!expandable || !expanded) return;
    const root = document.documentElement;
    const body = document.body;
    const rootOverflow = root.style.overflow;
    const bodyOverflow = body.style.overflow;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      root.style.overflow = rootOverflow;
      body.style.overflow = bodyOverflow;
    };
  }, [expandable, expanded]);

  useEffect(() => {
    if (!expandable || !expanded) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setExpanded(false);
      setDragProgress(0);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [expandable, expanded]);

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

  const renderPlaybackStatus = () => (
    <div className="flex shrink-0 items-center gap-2 text-[11px]">
      {refreshing && <span className="text-cyan-300">正在恢复播放…</span>}
      {!refreshing && playbackError && (
        <span className="max-w-44 truncate text-rose-300 sm:max-w-none">{playbackError}</span>
      )}
      {resumeState && !refreshing && (
        <PrivatePlaybackResumePrompt
          onDismiss={dismissResume}
          onRestart={() => void restart()}
          onResume={() => void resume()}
          position={resumeState.position}
        />
      )}
    </div>
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!expandable || (event.pointerType === "mouse" && event.button !== 0)) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const sheetHeight = sheet.getBoundingClientRect().height;
    const maxOffset = Math.max(0, sheetHeight - collapsedHeight);
    const startOffset = dragOffset ?? (expanded ? 0 : maxOffset);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocityY: 0,
      startOffset,
      maxOffset,
      wasExpanded: expanded,
    };
    ignoreHandleClickRef.current = false;
    setDragging(true);
    setDragOffset(startOffset);
    setDragProgress(maxOffset > 0 ? clamp(1 - startOffset / maxOffset, 0, 1) : 1);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - drag.startY;
    const nextOffset = clamp(drag.startOffset + deltaY, 0, drag.maxOffset);
    const elapsed = Math.max(1, event.timeStamp - drag.lastTime);
    drag.velocityY = (event.clientY - drag.lastY) / elapsed;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    setDragOffset(nextOffset);
    setDragProgress(drag.maxOffset > 0 ? clamp(1 - nextOffset / drag.maxOffset, 0, 1) : 1);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - drag.startY;
    const moved = Math.abs(deltaY) > PLAYER_TAP_SLOP_PX;
    ignoreHandleClickRef.current = moved;

    if (!cancelled && moved) {
      const shouldExpand = drag.wasExpanded
        ? !(deltaY > PLAYER_DRAG_THRESHOLD_PX || drag.velocityY > PLAYER_DRAG_VELOCITY_THRESHOLD)
        : deltaY < -PLAYER_DRAG_THRESHOLD_PX || drag.velocityY < -PLAYER_DRAG_VELOCITY_THRESHOLD;
      setExpanded(shouldExpand);
      setDragProgress(shouldExpand ? 1 : 0);
    } else {
      setDragProgress(drag.wasExpanded ? 1 : 0);
    }

    setDragging(false);
    setDragOffset(null);
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleClick = () => {
    if (ignoreHandleClickRef.current) {
      ignoreHandleClickRef.current = false;
      return;
    }
    setExpanded((current) => {
      const next = !current;
      setDragProgress(next ? 1 : 0);
      return next;
    });
  };

  const renderDragHandle = () => (
    <button
      aria-label={expanded ? "收起播放器" : "展开播放器"}
      className="mx-auto flex h-7 w-20 touch-none items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
      onClick={handleClick}
      onPointerCancel={(event) => finishDrag(event, true)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      style={{ touchAction: "none" }}
      type="button"
    >
      <span className="h-1 w-10 rounded-full bg-slate-500/70 transition-colors hover:bg-slate-400" />
    </button>
  );

  if (!expandable) {
    return (
      <aside
        aria-label="资源音频播放器"
        className="fixed inset-x-0 bottom-0 z-[100] border-t border-white/10 bg-[#080c15]/95 shadow-[0_-18px_50px_rgba(0,0,0,0.38)] backdrop-blur-xl"
      >
        <div className="mx-auto max-w-6xl px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center justify-between gap-3 px-2 pb-1">
            <p className="truncate text-xs font-medium text-slate-400">{title}</p>
            {renderPlaybackStatus()}
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

  const sheetTransform = dragOffset !== null
    ? `translate3d(0, ${dragOffset}px, 0)`
    : expanded
      ? "translate3d(0, 0, 0)"
      : `translate3d(0, calc(100dvh - ${collapsedHeight}px), 0)`;
  const collapsedOpacity = clamp(1 - dragProgress * 1.35, 0, 1);
  const expandedOpacity = clamp((dragProgress - 0.18) / 0.82, 0, 1);

  return (
    <aside
      aria-label="6 Minute English 音频播放器"
      className={`fixed inset-x-0 top-0 z-[120] h-[100dvh] overflow-hidden border-t border-white/10 bg-[#080c15] shadow-[0_-24px_70px_rgba(0,0,0,0.48)] ${dragging ? "" : "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"}`}
      ref={sheetRef}
      style={{ transform: sheetTransform }}
    >
      <style>{expandablePlayerCss}</style>
      <MediaController audio className="relative block h-full w-full bg-[#080c15]" style={mediaStyles}>
        <audio preload="metadata" ref={audioRef} slot="media" src={source.url} />

        <div
          aria-hidden={expanded}
          className={`absolute inset-x-0 top-0 bg-[#080c15]/98 backdrop-blur-xl transition-opacity duration-200 ${expanded ? "pointer-events-none" : "pointer-events-auto"}`}
          ref={collapsedPanelRef}
          style={{ opacity: collapsedOpacity }}
        >
          <div className="mx-auto max-w-6xl px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 sm:px-8 lg:px-10">
            {renderDragHandle()}
            <div className="flex min-w-0 items-center justify-between gap-3 px-2 pb-1">
              <p className="truncate text-xs font-medium text-slate-400">{title}</p>
              {renderPlaybackStatus()}
            </div>
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
          </div>
        </div>

        <div
          aria-hidden={!expanded}
          className={`absolute inset-0 flex flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] transition-opacity duration-200 sm:px-8 ${expanded ? "pointer-events-auto" : "pointer-events-none"}`}
          style={{ opacity: expandedOpacity }}
        >
          {renderDragHandle()}
          <div className="mx-auto mt-3 w-full max-w-3xl text-center">
            <p className="font-mono text-[10px] tracking-[0.2em] text-cyan-300/80">6 MINUTE ENGLISH</p>
            <h2 className="mx-auto mt-3 max-w-2xl text-xl font-semibold leading-7 text-white sm:text-2xl">{title}</h2>
            <div className="mt-3 flex justify-center">{renderPlaybackStatus()}</div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center py-5">
            <div className="grid w-full max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-8">
              <MediaSeekBackwardButton
                aria-label="后退 10 秒"
                className="size-16 justify-self-center rounded-full bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
                seekOffset={10}
                style={expandedSeekButtonStyles}
              />
              <MediaPlayButton
                aria-label="播放或暂停"
                className={`private-audio-expanded-play justify-self-center rounded-full border border-cyan-200/10 bg-cyan-300/10 text-cyan-100 transition-colors hover:bg-cyan-300/16 ${isPlaying ? "is-playing" : ""}`}
                style={expandedPlayButtonStyles}
              />
              <MediaSeekForwardButton
                aria-label="前进 10 秒"
                className="size-16 justify-self-center rounded-full bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
                seekOffset={10}
                style={expandedSeekButtonStyles}
              />
            </div>
          </div>

          <div className="mx-auto w-full max-w-3xl pb-1">
            <MediaTimeRange className="w-full" />
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
              <MediaTimeDisplay showDuration />
              <div className="flex items-center gap-1">
                <MediaPlaybackRateButton aria-label="调整播放速度" />
                <MediaMuteButton aria-label="静音" />
                <MediaVolumeRange className="hidden w-24 sm:inline-flex" />
              </div>
            </div>
          </div>
        </div>
      </MediaController>
    </aside>
  );
}
