import { useEffect, useState } from "react";

import {
  getPrivateAuthSession,
  PrivateAuthApiError,
  type PrivateAuthSession,
} from "@/lib/privateAuth";

interface PrivateLearningSessionState {
  error: string | null;
  isLoading: boolean;
  session: PrivateAuthSession | null;
  status: "ready" | "signed-out" | "forbidden" | "error" | "loading";
}

export function usePrivateLearningSession(): PrivateLearningSessionState {
  const [state, setState] = useState<PrivateLearningSessionState>({
    error: null,
    isLoading: true,
    session: null,
    status: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();
    getPrivateAuthSession(controller.signal)
      .then((session) => {
        const hasAccess = session.user.permissions.includes("english-learning");
        setState({
          error: null,
          isLoading: false,
          session,
          status: hasAccess ? "ready" : "forbidden",
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof PrivateAuthApiError && error.status === 401) {
          setState({ error: null, isLoading: false, session: null, status: "signed-out" });
          return;
        }
        setState({
          error: error instanceof Error ? error.message : "认证状态读取失败",
          isLoading: false,
          session: null,
          status: "error",
        });
      });

    return () => controller.abort();
  }, []);

  return state;
}
