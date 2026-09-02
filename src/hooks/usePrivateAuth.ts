import { useContext } from "react";

import {
  PrivateAuthContext,
  type PrivateAuthContextValue,
} from "@/contexts/privateAuthContextValue";

export function usePrivateAuth(): PrivateAuthContextValue {
  const value = useContext(PrivateAuthContext);
  if (!value) throw new Error("usePrivateAuth must be used within PrivateAuthProvider");
  return value;
}
