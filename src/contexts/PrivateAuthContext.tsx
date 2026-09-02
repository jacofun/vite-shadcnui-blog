import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from "react";

import {
  PrivateAuthContext,
  type PrivateAuthContextValue,
  type PrivateAuthStatus,
} from "@/contexts/privateAuthContextValue";
import {
  getPrivateAuthSession,
  PrivateAuthApiError,
  type PrivateAuthSession,
} from "@/lib/privateAuth";
import { PRIVATE_AUTH_INVALIDATED_EVENT } from "@/lib/privateAuthEvents";

const PRIVATE_AUTH_CHANNEL = "private-auth";
let sessionRequest: Promise<PrivateAuthSession | null> | null = null;

function fetchSession(): Promise<PrivateAuthSession | null> {
  if (!sessionRequest) {
    sessionRequest = getPrivateAuthSession()
      .catch((error: unknown) => {
        if (error instanceof PrivateAuthApiError && error.status === 401) return null;
        throw error;
      })
      .finally(() => {
        sessionRequest = null;
      });
  }
  return sessionRequest;
}

export function PrivateAuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [session, setSession] = useState<PrivateAuthSession | null>(null);
  const [status, setStatus] = useState<PrivateAuthStatus>("idle");
  const [error, setError] = useState<unknown>(null);
  const sessionRef = useRef<PrivateAuthSession | null>(null);
  const statusRef = useRef<PrivateAuthStatus>("idle");
  const channelRef = useRef<BroadcastChannel | null>(null);

  const updateSession = useCallback((nextSession: PrivateAuthSession | null) => {
    sessionRef.current = nextSession;
    statusRef.current = nextSession ? "authenticated" : "signed-out";
    setSession(nextSession);
    setStatus(statusRef.current);
    setError(null);
  }, []);

  const clearSession = useCallback(() => {
    updateSession(null);
    channelRef.current?.postMessage({ type: "signed-out" });
  }, [updateSession]);

  const setAuthenticatedSession = useCallback((nextSession: PrivateAuthSession) => {
    updateSession(nextSession);
  }, [updateSession]);

  const ensureSession = useCallback(async (force = false): Promise<PrivateAuthSession | null> => {
    const currentSession = sessionRef.current;
    if (!force && currentSession && currentSession.expiresAt > Date.now()) return currentSession;
    if (!force && statusRef.current === "signed-out") return null;

    statusRef.current = "loading";
    setStatus("loading");
    setError(null);
    try {
      const nextSession = await fetchSession();
      updateSession(nextSession);
      return nextSession;
    } catch (sessionError) {
      sessionRef.current = null;
      statusRef.current = "error";
      setSession(null);
      setStatus("error");
      setError(sessionError);
      throw sessionError;
    }
  }, [updateSession]);

  useEffect(() => {
    const invalidate = () => updateSession(null);
    window.addEventListener(PRIVATE_AUTH_INVALIDATED_EVENT, invalidate);

    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(PRIVATE_AUTH_CHANNEL);
      channelRef.current = channel;
      channel.addEventListener("message", (event: MessageEvent) => {
        if (event.data?.type === "signed-out") updateSession(null);
      });
    }

    return () => {
      window.removeEventListener(PRIVATE_AUTH_INVALIDATED_EVENT, invalidate);
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [updateSession]);

  useEffect(() => {
    if (!session) return;
    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) {
      sessionRef.current = null;
      statusRef.current = "idle";
      setSession(null);
      setStatus("idle");
      return;
    }
    const timeout = window.setTimeout(() => {
      sessionRef.current = null;
      statusRef.current = "idle";
      setSession(null);
      setStatus("idle");
    }, Math.min(remaining, 2_147_483_647));
    return () => window.clearTimeout(timeout);
  }, [session]);

  const value = useMemo<PrivateAuthContextValue>(() => ({
    clearSession,
    ensureSession,
    error,
    session,
    setAuthenticatedSession,
    status,
  }), [clearSession, ensureSession, error, session, setAuthenticatedSession, status]);

  return <PrivateAuthContext.Provider value={value}>{children}</PrivateAuthContext.Provider>;
}
