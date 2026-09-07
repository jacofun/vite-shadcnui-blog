export interface PrivatePlaybackState {
  position: number;
  duration?: number;
  playbackRate: number;
  updatedAt: number;
}

const PLAYBACK_STORAGE_PREFIX = "yanxiao:private-playback:v1:";
const PLAYBACK_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000;
export const PRIVATE_PLAYBACK_MIN_SECONDS = 8;
export const PRIVATE_PLAYBACK_END_GUARD_SECONDS = 12;

export function privatePlaybackStorageKey(): string {
  const route = typeof window === "undefined" ? "private-resource" : window.location.pathname;
  return `${PLAYBACK_STORAGE_PREFIX}${route}`;
}

function isValidPlaybackRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0.5 && value <= 3;
}

export function readPrivatePlaybackState(
  key: string,
  duration?: number,
): PrivatePlaybackState | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const value = JSON.parse(raw) as Partial<PrivatePlaybackState>;
    if (
      typeof value.position !== "number" ||
      !Number.isFinite(value.position) ||
      value.position < PRIVATE_PLAYBACK_MIN_SECONDS ||
      !isValidPlaybackRate(value.playbackRate) ||
      typeof value.updatedAt !== "number" ||
      !Number.isFinite(value.updatedAt) ||
      Date.now() - value.updatedAt > PLAYBACK_MAX_AGE_MS
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    const effectiveDuration =
      typeof duration === "number" && Number.isFinite(duration) && duration > 0
        ? duration
        : typeof value.duration === "number" && Number.isFinite(value.duration) && value.duration > 0
          ? value.duration
          : undefined;

    if (
      effectiveDuration !== undefined &&
      value.position > Math.max(0, effectiveDuration - PRIVATE_PLAYBACK_END_GUARD_SECONDS)
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    return {
      position: value.position,
      duration: effectiveDuration,
      playbackRate: value.playbackRate,
      updatedAt: value.updatedAt,
    };
  } catch {
    return null;
  }
}

export function writePrivatePlaybackState(
  key: string,
  media: Pick<HTMLMediaElement, "currentTime" | "duration" | "ended" | "playbackRate">,
): void {
  try {
    if (media.ended || !Number.isFinite(media.currentTime)) return;

    if (media.currentTime < PRIVATE_PLAYBACK_MIN_SECONDS) {
      window.localStorage.removeItem(key);
      return;
    }

    const duration = Number.isFinite(media.duration) && media.duration > 0 ? media.duration : undefined;
    if (
      duration !== undefined &&
      media.currentTime > Math.max(0, duration - PRIVATE_PLAYBACK_END_GUARD_SECONDS)
    ) {
      window.localStorage.removeItem(key);
      return;
    }

    const value: PrivatePlaybackState = {
      position: media.currentTime,
      duration,
      playbackRate: isValidPlaybackRate(media.playbackRate) ? media.playbackRate : 1,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Playback persistence is a convenience only; media playback must not depend on storage.
  }
}

export function clearPrivatePlaybackState(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

export function formatPrivatePlaybackTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
