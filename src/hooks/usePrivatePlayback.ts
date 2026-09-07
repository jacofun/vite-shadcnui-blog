import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import {
  PRIVATE_PLAYBACK_MIN_SECONDS,
  clearPrivatePlaybackState,
  privatePlaybackStorageKey,
  readPrivatePlaybackState,
  writePrivatePlaybackState,
  type PrivatePlaybackState,
} from "@/lib/privatePlayback";

const SAVE_INTERVAL_MS = 5_000;

interface PrivatePlaybackController {
  resumeState: PrivatePlaybackState | null;
  dismissResume: () => void;
  prepareResume: () => PrivatePlaybackState | null;
  prepareRestart: () => void;
  clearPlayback: () => void;
  suppressNextMetadataRestore: () => void;
}

function currentPlaybackTitle(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.title.split(" · ")[0]?.trim() || undefined;
}

function consumeContinueIntent(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get("continue") !== "1") return false;
  url.searchParams.delete("continue");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  return true;
}

export function usePrivatePlayback<T extends HTMLMediaElement>(
  mediaRef: RefObject<T | null>,
): PrivatePlaybackController {
  const storageKey = privatePlaybackStorageKey();
  const lastSavedAtRef = useRef(0);
  const resumeStateRef = useRef<PrivatePlaybackState | null>(null);
  const dismissedRef = useRef(false);
  const suppressNextMetadataRef = useRef(false);
  const [resumeState, setResumeState] = useState<PrivatePlaybackState | null>(null);

  const updateResumeState = useCallback((nextState: PrivatePlaybackState | null) => {
    resumeStateRef.current = nextState;
    setResumeState(nextState);
  }, []);

  const dismissResume = useCallback(() => {
    dismissedRef.current = true;
    updateResumeState(null);
  }, [updateResumeState]);

  const clearPlayback = useCallback(() => {
    clearPrivatePlaybackState(storageKey);
    dismissedRef.current = true;
    updateResumeState(null);
  }, [storageKey, updateResumeState]);

  const prepareResume = useCallback((): PrivatePlaybackState | null => {
    const media = mediaRef.current;
    const saved = resumeStateRef.current;
    if (!media || !saved) return null;

    dismissedRef.current = true;
    updateResumeState(null);
    media.playbackRate = saved.playbackRate;
    media.currentTime = saved.position;
    return saved;
  }, [mediaRef, updateResumeState]);

  const prepareRestart = useCallback(() => {
    const media = mediaRef.current;
    clearPrivatePlaybackState(storageKey);
    dismissedRef.current = true;
    updateResumeState(null);
    if (media) media.currentTime = 0;
  }, [mediaRef, storageKey, updateResumeState]);

  const suppressNextMetadataRestore = useCallback(() => {
    suppressNextMetadataRef.current = true;
  }, []);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const save = (force = false) => {
      const now = Date.now();
      if (!force && now - lastSavedAtRef.current < SAVE_INTERVAL_MS) return;
      lastSavedAtRef.current = now;
      writePrivatePlaybackState(storageKey, media, {
        title: currentPlaybackTitle(),
        mediaKind: media.tagName === "VIDEO" ? "video" : "audio",
      });
    };

    const loadedMetadata = () => {
      if (suppressNextMetadataRef.current) {
        suppressNextMetadataRef.current = false;
        return;
      }
      if (dismissedRef.current) return;

      const saved = readPrivatePlaybackState(storageKey, media.duration);
      if (!saved) {
        updateResumeState(null);
        return;
      }

      media.playbackRate = saved.playbackRate;
      if (consumeContinueIntent()) {
        dismissedRef.current = true;
        updateResumeState(null);
        media.currentTime = saved.position;
        void media.play().catch(() => undefined);
        return;
      }

      updateResumeState(saved);
    };

    const play = () => {
      if (media.currentTime < PRIVATE_PLAYBACK_MIN_SECONDS) {
        clearPrivatePlaybackState(storageKey);
        dismissedRef.current = true;
        updateResumeState(null);
      }
    };
    const timeUpdate = () => save(false);
    const pause = () => save(true);
    const rateChange = () => save(true);
    const ended = () => {
      clearPrivatePlaybackState(storageKey);
      dismissedRef.current = true;
      updateResumeState(null);
    };

    media.addEventListener("loadedmetadata", loadedMetadata);
    media.addEventListener("play", play);
    media.addEventListener("timeupdate", timeUpdate);
    media.addEventListener("pause", pause);
    media.addEventListener("ratechange", rateChange);
    media.addEventListener("ended", ended);

    if (media.readyState >= 1) loadedMetadata();

    return () => {
      save(true);
      media.removeEventListener("loadedmetadata", loadedMetadata);
      media.removeEventListener("play", play);
      media.removeEventListener("timeupdate", timeUpdate);
      media.removeEventListener("pause", pause);
      media.removeEventListener("ratechange", rateChange);
      media.removeEventListener("ended", ended);
    };
  }, [mediaRef, storageKey, updateResumeState]);

  return {
    resumeState,
    dismissResume,
    prepareResume,
    prepareRestart,
    clearPlayback,
    suppressNextMetadataRestore,
  };
}
