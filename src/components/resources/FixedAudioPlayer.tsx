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
  travel: number;
  wasExpanded: boolean;
}

const MEDIA_READY_TIMEOUT_MS = 8_000;
const PLAYER_DRAG_THRESHOLD_PX = 56;
const PLAYER_DRAG_VELOCITY_THRESHOLD = 0.5;
const PLAYER_TAP_SLOP_PX = 6;
const DEFAULT_GESTURE_TRAVEL_PX = 640;

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

function getGestureTravel(): number {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  return Math.max(320, Math.round(viewportHeight * 0.78));
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
  const dragRef = useRef<PlayerDragState | null>(null);
  const ignoreGestureClickRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [gestureTravel, setGestureTravel] = useState(DEFAULT_GESTURE_TRAVEL_PX);
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
    if (!expandable || !expanded) return;

    const root = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      rootOverflow: root.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
    };

    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      root.style.overflow = previous.rootOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.left = previous.bodyLeft;
      body.style.right = previous.bodyRight;
      body.style.width = previous.bodyWidth;
      window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
    };
  }, [expandable, expanded]);

  useEffect(() => {
    if (!expandable || !expanded) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
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

  const renderPlaybackNotice = () => {
    if (refreshing) return <span className="text-cyan-300">正在恢复播放…</span>;
    if (playbackError) return <span className="text-rose-300">{playbackError}</span>;
    return null;
  };

  const renderResumePrompt = (className = "") => {
    if (!resumeState || refreshing) return null;
    return (
      <PrivatePlaybackResumePrompt
        className={className}
        onDismiss={dismissResume}
        onRestart={() => void restart()}
        onResume={() => void resume()}
        position={resumeState.position}
      />
    );
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!expandable || (event.pointerType === "mouse" && event.button !== 0)) return;

    const travel = getGestureTravel();
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocityY: 0,
      travel,
      wasExpanded: expanded,
    };
    ignoreGestureClickRef.current = false;
    setGestureTravel(travel);
    setDragging(true);
    setDragOffset(expanded ? 0 : travel);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaY = event.clientY - drag.startY;
    const startOffset = drag.wasExpanded ? 0 : drag.travel;
    const nextOffset = clamp(startOffset + deltaY, 0, drag.travel);
    const elapsed = Math.max(1, event.timeStamp - drag.lastTime);
    drag.velocityY = (event.clientY - drag.lastY) / elapsed;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    setDragOffset(nextOffset);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaY = event.clientY - drag.startY;
    const moved = Math.abs(deltaY) > PLAYER_TAP_SLOP_PX;
    ignoreGestureClickRef.current = moved;

    if (!cancelled && moved) {
      const shouldExpand = drag.wasExpanded
        ? !(deltaY > PLAYER_DRAG_THRESHOLD_PX || drag.velocityY > PLAYER_DRAG_VELOCITY_THRESHOLD)
        : deltaY < -PLAYER_DRAG_THRESHOLD_PX || drag.velocityY < -PLAYER_DRAG_VELOCITY_THRESHOLD;
      setExpanded(shouldExpand);
    }

    setDragging(false);
    setDragOffset(null);
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleGestureClick = () => {
    if (ignoreGestureClickRef.current) {
      ignoreGestureClickRef.current = false;
      return;
    }
    setExpanded((current) => !current);
  };

  const renderGestureZone = (mode: "expand" | "collapse") => (
    <button
      aria-label={mode === "collapse" ? "收起播放器" : "展开播放器"}
      className={`${mode === "collapse" ? "h-[72px]" : "h-14"} flex w-full touch-none select-none items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/40`}
      onClick={handleGestureClick}
      onPointerCancel={(event) => finishDrag(event, true)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      style={{ touchAction: "none" }}
      type="button"
    >
      <span className="h-1 w-11 rounded-full bg-slate-500/70 transition-colors hover:bg-slate-400" />
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
            <div className="flex shrink-0 items-center gap-2 text-[11px]">
              {renderPlaybackNotice()}
              {renderResumePrompt()}
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

  const activeOffset = dragOffset ?? (expanded ? 0 : gestureTravel);
  const dragProgress = gestureTravel > 0 ? clamp(1 - activeOffset / gestureTravel, 0, 1) : 0;
  const compactOpacity = clamp(1 - dragProgress * 1.35, 0, 1);
  const expandedOpacity = clamp((dragProgress - 0.04) / 0.96, 0, 1);
  const expandedTransform = `translate3d(0, ${activeOffset}px, 0)`;

  return (
    <MediaController
      audio
      aria-label="6 Minute English 音频播放器"
      className="fixed inset-0 z-[120] block"
      style={{ ...mediaStyles, background: "transparent", pointerEvents: "none" }}
    >
      <style>{expandablePlayerCss}</style>
      <audio preload="metadata" ref={audioRef} slot="media" src={source.url} />

      <div
        aria-hidden={expanded && !dragging}
        className={`fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#080c15]/98 shadow-[0_-18px_50px_rgba(0,0,0,0.38)] backdrop-blur-xl ${dragging ? "" : "transition-opacity duration-200"} ${expanded && !dragging ? "pointer-events-none" : "pointer-events-auto"}`}
        style={{ opacity: compactOpacity }}
      >
        <div className="mx-auto max-w-6xl px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-10">
          {renderGestureZone("expand")}
          <div className="px-2 pb-1">
            <p className="truncate text-xs font-medium text-slate-400">{title}</p>
          </div>
          {renderPlaybackNotice() && (
            <div className="px-2 pb-2 text-[11px]">{renderPlaybackNotice()}</div>
          )}
          {resumeState && !refreshing && (
            <div className="px-2 pb-2">
              {renderResumePrompt("w-full justify-center sm:justify-end")}
            </div>
          )}
          <MediaControlBar className="flex w-full items-center px-1">
            <MediaTimeDisplay showDuration />
            <MediaTimeRange />
          </MediaControlBar>
          <div className="relative min-h-14 px-1 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="absolute left-0 top-1/2 flex min-w-0 -translate-y-1/2 justify-start sm:static sm:translate-y-0">
              <MediaPlaybackRateButton aria-label="调整播放速度" noTooltip />
            </div>
            <div className="contents sm:flex sm:items-center sm:justify-center sm:gap-2">
              <MediaSeekBackwardButton
                aria-label="后退 10 秒"
                className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:static sm:translate-x-0 sm:translate-y-0"
                noTooltip
                seekOffset={10}
              />
              <MediaPlayButton
                aria-label="播放或暂停"
                className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/10 text-cyan-100 transition hover:bg-cyan-300/20 sm:static sm:translate-x-0 sm:translate-y-0"
                noTooltip
                style={playButtonStyles}
              />
              <MediaSeekForwardButton
                aria-label="前进 10 秒"
                className="absolute left-3/4 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:static sm:translate-x-0 sm:translate-y-0"
                noTooltip
                seekOffset={10}
              />
            </div>
            <div className="absolute right-0 top-1/2 flex min-w-0 -translate-y-1/2 items-center justify-end sm:static sm:translate-y-0">
              <MediaMuteButton aria-label="静音" noTooltip />
              <MediaVolumeRange className="hidden sm:inline-flex" />
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden={!expanded && !dragging}
        className={`fixed inset-0 flex flex-col bg-[#080c15] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] shadow-[0_-24px_70px_rgba(0,0,0,0.48)] sm:px-8 ${expanded || dragging ? "pointer-events-auto" : "pointer-events-none"} ${dragging ? "" : "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"}`}
        style={{ opacity: expandedOpacity, transform: expandedTransform }}
      >
        {renderGestureZone("collapse")}

        <div className="mx-auto w-full max-w-3xl text-center">
          <p className="font-mono text-[10px] tracking-[0.2em] text-cyan-300/80">6 MINUTE ENGLISH</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-xl font-semibold leading-7 text-white sm:text-2xl">{title}</h2>
          {renderPlaybackNotice() && (
            <div className="mt-3 text-[11px]">{renderPlaybackNotice()}</div>
          )}
          {resumeState && !refreshing && (
            <div className="mt-4 flex justify-center">
              {renderResumePrompt("justify-center")}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center py-5">
          <div className="grid w-full max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-8">
            <MediaSeekBackwardButton
              aria-label="后退 10 秒"
              className="size-16 justify-self-center rounded-full bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
              noTooltip
              seekOffset={10}
              style={expandedSeekButtonStyles}
            />
            <MediaPlayButton
              aria-label="播放或暂停"
              className={`private-audio-expanded-play justify-self-center rounded-full border border-cyan-200/10 bg-cyan-300/10 text-cyan-100 transition-colors hover:bg-cyan-300/16 ${isPlaying ? "is-playing" : ""}`}
              noTooltip
              style={expandedPlayButtonStyles}
            />
            <MediaSeekForwardButton
              aria-label="前进 10 秒"
              className="size-16 justify-self-center rounded-full bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
              noTooltip
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
              <MediaPlaybackRateButton aria-label="调整播放速度" noTooltip />
              <MediaMuteButton aria-label="静音" noTooltip />
              <MediaVolumeRange className="hidden w-24 sm:inline-flex" />
            </div>
          </div>
        </div>
      </div>
    </MediaController>
  );
}
