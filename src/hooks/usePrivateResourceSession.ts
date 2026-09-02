import { useEffect } from "react";

import { usePrivateAuth } from "@/hooks/usePrivateAuth";
import type { PrivateAuthSession } from "@/lib/privateAuth";

interface PrivateResourceSessionState {
  error: string | null;
  session: PrivateAuthSession | null;
  status: "ready" | "signed-out" | "forbidden" | "error" | "loading";
}

function hasPrivateResourceAccess(session: PrivateAuthSession): boolean {
  return session.user.role === "owner" ||
    session.user.permissions.some((permission) =>
      permission === "private-resources" || permission === "english-learning");
}

export function usePrivateResourceSession(): PrivateResourceSessionState {
  const { ensureSession, error, session, status } = usePrivateAuth();

  useEffect(() => {
    if (status === "idle") {
      void ensureSession().catch(() => undefined);
    }
  }, [ensureSession, status]);

  if (status === "idle" || status === "loading") {
    return { error: null, session: null, status: "loading" };
  }
  if (status === "signed-out") {
    return { error: null, session: null, status: "signed-out" };
  }
  if (status === "error") {
    return {
      error: error instanceof Error ? error.message : "认证状态读取失败",
      session: null,
      status: "error",
    };
  }
  if (!session || !hasPrivateResourceAccess(session)) {
    return { error: null, session, status: "forbidden" };
  }
  return { error: null, session, status: "ready" };
}
