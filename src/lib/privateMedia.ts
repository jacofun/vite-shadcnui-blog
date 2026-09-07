export interface PrivateMediaSource {
  url: string;
  expiresAt: number;
}

export const PRIVATE_MEDIA_REFRESH_GUARD_SECONDS = 30;

export function isPrivateMediaSourceExpiring(
  source: PrivateMediaSource | null | undefined,
  now = Date.now(),
): boolean {
  if (!source) return true;
  return source.expiresAt * 1000 - now <= PRIVATE_MEDIA_REFRESH_GUARD_SECONDS * 1000;
}
