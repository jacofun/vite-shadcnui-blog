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

interface CompactLayoutMetrics {
  height: number;
  progressTop: number;
  progressHeight: number;
  controlsTop: number;
  controlsHeight: number;
  safeBottom: number;
}

interface ViewportSize {
  height: number;
  width: number;
}

const MEDIA_READY_TIMEOUT_MS = 8_000;
const PLAYER_DRAG_THRESHOLD_PX = 56;
const PLAYER_DRAG_VELOCITY_THRESHOLD = 0.5;
const PLAYER_TAP_SLOP_PX = 6;
const PLAYER_SETTLE_MS = 300;
const TOUCH_CLICK_SUPPRESS_MS = 700;

const DEFAULT_VIEWPORT: ViewportSize = {
  height: 720,
  width: 390,
};

const DEFAULT_COMPACT_METRICS: CompactLayoutMetrics = {
  height: 190,
  progressTop: 92,
  progressHeight: 38,
  controlsTop: 128,
  controlsHeight: 56,
  safeBottom: 8,
};

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

.private-audio-sheet-play.is-playing {
  animation: private-audio-play-breathe 3.4s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .private-audio-sheet-play.is-playing {
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

function getViewportSize(): ViewportSize {
  if (typeof window === "undefined") return DEFAULT_VIEWPORT;
  const viewport = window.visualViewport;
  return {
    height: Math.max(320, Math.round(viewport?.height ?? window.innerHeight)),
    width: Math.max(280, Math.round(viewport?.width ?? window.innerWidth)),
  };
}

function findTouch(touches: TouchList, identifier: number): Touch | null {
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches.item(index);
    if (touch?.identifier === identifier) return touch;
  }
  return null;
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
  const lastTouchEndRef = useRef(0);
  const settleTimerRef = useRef<number | null>(null);
  const settlingRef = useRef(false);
  const gestureZoneRef = useRef<HTMLButtonElement | null>(null);
  const compactMeasureRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [settling, setSettling] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [viewport, setViewport] = useState<ViewportSize>(() => getViewportSize());
  const [compactMetrics, setCompactMetrics] = useState<CompactLayoutMetrics>(DEFAULT_COMPACT_METRICS);

  const {
    dismissResume,
    prepareRestart,
    prepareResume,
    resumeState,
    suppressNextMetadataRestore,
  } = usePrivatePlayback(audioRef);

  sourceRef.current = source;

  const beginSettle = useCallback((nextExpanded: boolean): void => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
    }

    settlingRef.current = true;
    setSettling(true);
    setExpanded(nextExpanded);
    setDragOffset(null);

    settleTimerRef.current = window.setTimeout(() => {
      settlingRef.current = false;
      setSettling(false);
      setViewport(getViewportSize());
      settleTimerRef.current = null;
    }, PLAYER_SETTLE_MS + 40);
  }, []);

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

    const measure = () => {
      const container = compactMeasureRef.current;
      const progress = progressRef.current;
      const controls = controlsRef.current;
      if (!container || !progress || !controls) return;

      const computed = window.getComputedStyle(container);
      const next: CompactLayoutMetrics = {
        height: Math.max(150, Math.ceil(container.getBoundingClientRect().height)),
        progressTop: progress.offsetTop,
        progressHeight: Math.ceil(progress.getBoundingClientRect().height),
        controlsTop: controls.offsetTop,
        controlsHeight: Math.ceil(controls.getBoundingClientRect().height),
        safeBottom: Math.max(0, Number.parseFloat(computed.paddingBottom) || 0),
      };

      setCompactMetrics((current) => {
        const unchanged =
          current.height === next.height &&
          current.progressTop === next.progressTop &&
          current.progressHeight === next.progressHeight &&
          current.controlsTop === next.controlsTop &&
          current.controlsHeight === next.controlsHeight &&
          current.safeBottom === next.safeBottom;
        return unchanged ? current : next;
      });
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    if (compactMeasureRef.current) observer.observe(compactMeasureRef.current);
    return () => observer.disconnect();
  }, [expandable, playbackError, refreshing, resumeState]);

  useEffect(() => {
    if (!expandable) return;

    let frame = 0;
    const updateViewport = () => {
      if (dragRef.current || settlingRef.current) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setViewport(getViewportSize()));
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
    };
  }, [expandable]);

  useEffect(() => {
    if (!expandable || !expanded) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        beginSettle(false);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [beginSettle, expandable, expanded]);

  useEffect(() => {
    if (!expandable || !expanded || settling || dragging) return;

    const root = document.documentElement;
    const body = document.body;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const previous = {
      rootOverflow: root.style.overflow,
      rootOverscrollBehavior: root.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
    };

    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = `-${scrollX}px`;
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      root.style.overflow = previous.rootOverflow;
      root.style.overscrollBehavior = previous.rootOverscrollBehavior;
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscrollBehavior;
      body.style.position = previous.bodyPosition;
      body.style.top = previous.bodyTop;
      body.style.left = previous.bodyLeft;
      body.style.right = previous.bodyRight;
      body.style.width = previous.bodyWidth;
      window.scrollTo({ top: scrollY, left: scrollX, behavior: "auto" });
    };
  }, [dragging, expandable, expanded, settling]);

  useEffect(() => () => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
    }
  }, []);

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

  const startDrag = useCallback((clientY: number, timeStamp: number, pointerId: number): void => {
    if (!expandable || dragRef.current) return;

    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    settlingRef.current = false;
    setSettling(false);

    const nextViewport = getViewportSize();
    const travel = Math.max(1, nextViewport.height - compactMetrics.height);

    dragRef.current = {
      pointerId,
      startY: clientY,
      lastY: clientY,
      lastTime: timeStamp,
      velocityY: 0,
      travel,
      wasExpanded: expanded,
    };

    ignoreGestureClickRef.current = false;
    setDragging(true);
    setViewport(nextViewport);
    setDragOffset(expanded ? 0 : travel);
  }, [compactMetrics.height, expandable, expanded]);

  const moveDrag = useCallback((clientY: number, timeStamp: number, pointerId: number): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== pointerId) return;

    const deltaY = clientY - drag.startY;
    const startOffset = drag.wasExpanded ? 0 : drag.travel;
    const nextOffset = clamp(startOffset + deltaY, 0, drag.travel);
    const elapsed = Math.max(1, timeStamp - drag.lastTime);

    drag.velocityY = (clientY - drag.lastY) / elapsed;
    drag.lastY = clientY;
    drag.lastTime = timeStamp;
    setDragOffset(nextOffset);
  }, []);

  const finishDragAt = useCallback((
    clientY: number,
    cancelled: boolean,
    toggleOnTap: boolean,
  ): void => {
    const drag = dragRef.current;
    if (!drag) return;

    const deltaY = clientY - drag.startY;
    const moved = Math.abs(deltaY) > PLAYER_TAP_SLOP_PX;
    dragRef.current = null;
    setDragging(false);

    if (cancelled) {
      beginSettle(drag.wasExpanded);
      return;
    }

    if (!moved) {
      if (toggleOnTap) beginSettle(!drag.wasExpanded);
      else setDragOffset(null);
      return;
    }

    const shouldExpand = drag.wasExpanded
      ? !(deltaY > PLAYER_DRAG_THRESHOLD_PX || drag.velocityY > PLAYER_DRAG_VELOCITY_THRESHOLD)
      : deltaY < -PLAYER_DRAG_THRESHOLD_PX || drag.velocityY < -PLAYER_DRAG_VELOCITY_THRESHOLD;
    beginSettle(shouldExpand);
  }, [beginSettle]);

  useEffect(() => {
    if (!expandable) return;
    const zone = gestureZoneRef.current;
    if (!zone) return;

    let activeTouchId: number | null = null;

    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || dragRef.current) return;
      const touch = event.touches.item(0);
      if (!touch) return;
      activeTouchId = touch.identifier;
      startDrag(touch.clientY, event.timeStamp, touch.identifier);
    };

    const touchMove = (event: TouchEvent) => {
      if (activeTouchId === null) return;
      const touch = findTouch(event.touches, activeTouchId);
      if (!touch) return;
      if (event.cancelable) event.preventDefault();
      moveDrag(touch.clientY, event.timeStamp, activeTouchId);
    };

    const touchEnd = (event: TouchEvent) => {
      if (activeTouchId === null) return;
      const touch = findTouch(event.changedTouches, activeTouchId);
      if (!touch) return;
      if (event.cancelable) event.preventDefault();
      lastTouchEndRef.current = performance.now();
      finishDragAt(touch.clientY, false, true);
      activeTouchId = null;
    };

    const touchCancel = (event: TouchEvent) => {
      if (activeTouchId === null) return;
      const touch = findTouch(event.changedTouches, activeTouchId);
      const clientY = touch?.clientY ?? dragRef.current?.lastY ?? 0;
      lastTouchEndRef.current = performance.now();
      finishDragAt(clientY, true, false);
      activeTouchId = null;
    };

    zone.addEventListener("touchstart", touchStart, { passive: false });
    zone.addEventListener("touchmove", touchMove, { passive: false });
    zone.addEventListener("touchend", touchEnd, { passive: false });
    zone.addEventListener("touchcancel", touchCancel, { passive: false });

    return () => {
      zone.removeEventListener("touchstart", touchStart);
      zone.removeEventListener("touchmove", touchMove);
      zone.removeEventListener("touchend", touchEnd);
      zone.removeEventListener("touchcancel", touchCancel);
    };
  }, [expandable, finishDragAt, moveDrag, startDrag]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "touch") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    startDrag(event.clientY, event.timeStamp, event.pointerId);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "touch") return;
    moveDrag(event.clientY, event.timeStamp, event.pointerId);
  };

  const finishPointerDrag = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    if (event.pointerType === "touch") return;
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const moved = Math.abs(event.clientY - drag.startY) > PLAYER_TAP_SLOP_PX;
    ignoreGestureClickRef.current = moved;
    finishDragAt(event.clientY, cancelled, false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleGestureClick = () => {
    if (performance.now() - lastTouchEndRef.current < TOUCH_CLICK_SUPPRESS_MS) return;
    if (ignoreGestureClickRef.current) {
      ignoreGestureClickRef.current = false;
      return;
    }
    beginSettle(!expanded);
  };

  const renderGestureZone = () => (
    <button
      aria-label={expanded ? "收起播放器" : "展开播放器"}
      className="flex h-16 w-full touch-none select-none items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/40"
      onClick={handleGestureClick}
      onPointerCancel={(event) => finishPointerDrag(event, true)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerDrag}
      ref={gestureZoneRef}
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

  const travel = dragRef.current?.travel ?? Math.max(1, viewport.height - compactMetrics.height);
  const activeOffset = dragOffset ?? (expanded ? 0 : travel);
  const progress = clamp(1 - activeOffset / travel, 0, 1);

  const expandedPlaySize = clamp(viewport.width * 0.38, 124, 168);
  const expandedSeekSize = 56;
  const playSize = 48 + (expandedPlaySize - 48) * progress;
  const seekSize = 44 + (expandedSeekSize - 44) * progress;

  const progressTargetTop = Math.max(
    compactMetrics.progressTop,
    viewport.height - compactMetrics.safeBottom - compactMetrics.progressHeight - 26,
  );
  const controlsTargetTop = Math.max(
    compactMetrics.controlsTop,
    Math.min(
      viewport.height * 0.48 - compactMetrics.controlsHeight / 2,
      progressTargetTop - expandedPlaySize - 38,
    ),
  );

  const progressShift = (progressTargetTop - compactMetrics.progressTop) * progress;
  const controlsShift = (controlsTargetTop - compactMetrics.controlsTop) * progress;
  const expandedControlDistance = expandedPlaySize / 2 + expandedSeekSize / 2 + 16;
  const expandedBackCenter = Math.max(64, viewport.width / 2 - expandedControlDistance);
  const expandedForwardCenter = Math.min(viewport.width - 64, viewport.width / 2 + expandedControlDistance);
  const compactBackCenter = viewport.width * 0.25;
  const compactForwardCenter = viewport.width * 0.75;
  const backPosition = compactBackCenter + (expandedBackCenter - compactBackCenter) * progress;
  const forwardPosition = compactForwardCenter + (expandedForwardCenter - compactForwardCenter) * progress;
  const titleSize = 12 + 8 * progress;

  const sheetClassName = [
    "fixed inset-x-0 bottom-0 z-[120] block overflow-hidden border-t border-white/10 bg-[#080c15]",
    "shadow-[0_-24px_70px_rgba(0,0,0,0.48)]",
    settling ? "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none" : "",
  ].join(" ");

  const movingClassName = settling
    ? "transition-[transform,font-size] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
    : "";
  const controlClassName = settling
    ? "transition-[width,height,left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
    : "";

  return (
    <MediaController
      audio
      aria-label="6 Minute English 音频播放器"
      className={sheetClassName}
      style={{
        ...mediaStyles,
        height: `${viewport.height}px`,
        overscrollBehavior: "none",
        transform: `translate3d(0, ${activeOffset}px, 0)`,
      }}
    >
      <style>{expandablePlayerCss}</style>
      <audio preload="metadata" ref={audioRef} slot="media" src={source.url} />

      <div
        className="relative mx-auto max-w-6xl px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-10"
        ref={compactMeasureRef}
      >
        {renderGestureZone()}

        <div className="px-2 pb-1 text-center">
          <p
            className={`truncate font-medium text-slate-300 ${movingClassName}`}
            style={{ fontSize: `${titleSize}px`, lineHeight: `${18 + 10 * progress}px` }}
          >
            {title}
          </p>
        </div>

        {renderPlaybackNotice() && (
          <div className="px-2 pb-2 text-center text-[11px]">{renderPlaybackNotice()}</div>
        )}

        {resumeState && !refreshing && (
          <div className="px-2 pb-2">
            {renderResumePrompt("w-full justify-center")}
          </div>
        )}

        <div
          className={movingClassName}
          ref={progressRef}
          style={{ transform: `translate3d(0, ${progressShift}px, 0)` }}
        >
          <MediaControlBar className="flex w-full items-center px-1">
            <MediaTimeDisplay showDuration />
            <MediaTimeRange />
          </MediaControlBar>
        </div>

        <div
          className={`relative min-h-14 px-1 ${movingClassName}`}
          ref={controlsRef}
          style={{ transform: `translate3d(0, ${controlsShift}px, 0)` }}
        >
          <div className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center">
            <MediaPlaybackRateButton aria-label="调整播放速度" noTooltip />
          </div>

          <MediaSeekBackwardButton
            aria-label="后退 10 秒"
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.025] text-slate-200 ${controlClassName}`}
            noTooltip
            seekOffset={10}
            style={{
              left: `${backPosition}px`,
              width: `${seekSize}px`,
              height: `${seekSize}px`,
              "--media-control-height": `${seekSize}px`,
              "--media-button-icon-width": `${Math.round(24 + 8 * progress)}px`,
              "--media-button-icon-height": `${Math.round(24 + 8 * progress)}px`,
            } as CSSProperties}
          />

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <MediaPlayButton
              aria-label="播放或暂停"
              className={`private-audio-sheet-play rounded-full border border-cyan-200/10 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/16 ${controlClassName} ${isPlaying ? "is-playing" : ""}`}
              noTooltip
              style={{
                width: `${playSize}px`,
                height: `${playSize}px`,
                "--media-control-height": `${playSize}px`,
                "--media-button-icon-width": `${Math.round(playSize * 0.42)}px`,
                "--media-button-icon-height": `${Math.round(playSize * 0.42)}px`,
              } as CSSProperties}
            />
          </div>

          <MediaSeekForwardButton
            aria-label="前进 10 秒"
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.025] text-slate-200 ${controlClassName}`}
            noTooltip
            seekOffset={10}
            style={{
              left: `${forwardPosition}px`,
              width: `${seekSize}px`,
              height: `${seekSize}px`,
              "--media-control-height": `${seekSize}px`,
              "--media-button-icon-width": `${Math.round(24 + 8 * progress)}px`,
              "--media-button-icon-height": `${Math.round(24 + 8 * progress)}px`,
            } as CSSProperties}
          />

          <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center">
            <MediaMuteButton aria-label="静音" noTooltip />
            <MediaVolumeRange className="hidden w-24 sm:inline-flex" />
          </div>
        </div>
      </div>
    </MediaController>
  );
}
