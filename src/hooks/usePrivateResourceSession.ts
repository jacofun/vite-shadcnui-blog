import { useEffect, useState } from "react";

import {
  getPrivateAuthSession,
  PrivateAuthApiError,
  type PrivateAuthSession,
} from "@/lib/privateAuth";

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
  const [state, setState] = useState<PrivateResourceSessionState>({
    error: null,
    session: null,
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();
    getPrivateAuthSession(controller.signal)
      .then((session) => {
        setState({
          error: null,
          session,
          status: hasPrivateResourceAccess(session) ? "ready" : "forbidden",
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof PrivateAuthApiError && error.status === 401) {
          setState({ error: null, session: null, status: "signed-out" });
          return;
        }
        setState({
          error: error instanceof Error ? error.message : "认证状态读取失败",
          session: null,
          status: "error",
        });
      });

    return () => controller.abort();
  }, []);

  return state;
}
