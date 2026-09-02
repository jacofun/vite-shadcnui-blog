import { createContext } from "react";

import type { PrivateAuthSession } from "@/lib/privateAuth";

export type PrivateAuthStatus = "idle" | "loading" | "authenticated" | "signed-out" | "error";

export interface PrivateAuthContextValue {
  clearSession: () => void;
  ensureSession: (force?: boolean) => Promise<PrivateAuthSession | null>;
  error: unknown;
  session: PrivateAuthSession | null;
  setAuthenticatedSession: (session: PrivateAuthSession) => void;
  status: PrivateAuthStatus;
}

export const PrivateAuthContext = createContext<PrivateAuthContextValue | null>(null);
