export const PRIVATE_AUTH_INVALIDATED_EVENT = "private-auth:invalidated";

export function notifyPrivateAuthInvalidated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PRIVATE_AUTH_INVALIDATED_EVENT));
  }
}
