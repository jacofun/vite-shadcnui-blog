import { lazy, StrictMode, Suspense, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import App from "./App.tsx";
import LegacyEnglishEpisodeRedirect from "./components/routing/LegacyEnglishEpisodeRedirect.tsx";
import PrivateLoadingProgress from "./components/resources/PrivateLoadingProgress.tsx";
import { PrivateAuthProvider } from "./contexts/PrivateAuthContext.tsx";
import "./index.css";
import Home from "./pages/Home.tsx";

const NoteDetail = lazy(() => import("./pages/NoteDetail.tsx"));
const Notes = lazy(() => import("./pages/Notes.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const PrivateAuth = lazy(() => import("./pages/PrivateAuth.tsx"));
const PrivateClipboard = lazy(() => import("./pages/PrivateClipboard.tsx"));
const PrivateResources = lazy(() => import("./pages/PrivateResources.tsx"));
const PrivateResourceCollection = lazy(() => import("./pages/PrivateResourceCollection.tsx"));
const PrivateResourceItem = lazy(() => import("./pages/PrivateResourceItem.tsx"));
const PrivateResourceUpload = lazy(() => import("./pages/PrivateResourceUpload.tsx"));
const PrivateResourceCreateCollection = lazy(() => import("./pages/PrivateResourceCreateCollection.tsx"));
const WeddingInvitation = lazy(
  () => import("./pages/WeddingInvitation.tsx"),
);

const routeFallback = (
  <main className="min-h-screen bg-[#070a12] text-slate-100">
    <div className="mx-auto flex min-h-[55vh] max-w-6xl items-center px-6 sm:px-8 lg:px-10">
      <div aria-live="polite" className="w-full max-w-xl space-y-3">
        <p className="font-mono text-xs tracking-[0.18em] text-cyan-300">
          YANXIAO.ME
        </p>
        <PrivateLoadingProgress label="正在载入页面" loading />
      </div>
    </div>
  </main>
);

function lazyPage(element: ReactElement): ReactElement {
  return <Suspense fallback={routeFallback}>{element}</Suspense>;
}

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: "notes", element: lazyPage(<Notes />) },
      { path: "notes/:slug", element: lazyPage(<NoteDetail />) },
      { path: "auth", element: lazyPage(<PrivateAuth />) },
      { path: "resources", element: lazyPage(<PrivateResources />) },
      { path: "resources/clipboard", element: lazyPage(<PrivateClipboard />) },
      { path: "resources/new", element: lazyPage(<PrivateResourceCreateCollection />) },
      { path: "resources/upload", element: lazyPage(<PrivateResourceUpload />) },
      { path: "resources/:collectionId", element: lazyPage(<PrivateResourceCollection />) },
      { path: "resources/:collectionId/:itemId", element: lazyPage(<PrivateResourceItem />) },
      { path: "learning/english", element: <Navigate replace to="/resources/6minuteenglish" /> },
      { path: "learning/english/:itemId", element: <LegacyEnglishEpisodeRedirect /> },
      { path: "wedding", element: lazyPage(<WeddingInvitation />) },
      { path: "*", element: lazyPage(<NotFound />) },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <PrivateAuthProvider>
        <RouterProvider router={router} />
      </PrivateAuthProvider>
    </HelmetProvider>
  </StrictMode>,
);
