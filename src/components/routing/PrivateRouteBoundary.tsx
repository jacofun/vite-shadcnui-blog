import type { JSX } from "react";
import { Outlet } from "react-router-dom";

import PrivatePerformanceObserver from "@/components/resources/PrivatePerformanceObserver";
import { PrivateAuthProvider } from "@/contexts/PrivateAuthContext";

export default function PrivateRouteBoundary(): JSX.Element {
  return (
    <PrivateAuthProvider>
      <PrivatePerformanceObserver />
      <Outlet />
    </PrivateAuthProvider>
  );
}
