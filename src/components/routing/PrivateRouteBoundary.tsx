import type { JSX } from "react";
import { Outlet } from "react-router-dom";

import { PrivateAuthProvider } from "@/contexts/PrivateAuthContext";

export default function PrivateRouteBoundary(): JSX.Element {
  return (
    <PrivateAuthProvider>
      <Outlet />
    </PrivateAuthProvider>
  );
}
