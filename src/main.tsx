import { lazy, StrictMode, Suspense, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import App from "./App.tsx";
import AppErrorBoundary from "./components/common/AppErrorBoundary.tsx";
import RouteLoading from "./components/common/RouteLoading.tsx";
import LegacyEnglishEpisodeRedirect from "./components/routing/LegacyEnglishEpisodeRedirect.tsx";
import { publicPageImports } from "./lib/routePrefetch.ts";
import "./index.css";
import Home from "./pages/Home.tsx";

function restoreCleanRoute(): void {
  const url = new URL(window.location.href);
  const fallbackPath = url.searchParams.get("__spa");

  if (fallbackPath?.startsWith("/")) {
    window.history.replaceState(null, "", fallbackPath);
    return;
  }

  if (url.hash.startsWith("#/")) {
    const legacyPath = url.hash.slice(1);
    window.history.replaceState(null, "", legacyPath);
  }
}

restoreCleanRoute();

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  window.location.reload();
});

const About = lazy(publicPageImports.about);
const Fragments = lazy(publicPageImports.fragments);
const NoteDetail = lazy(publicPageImports.noteDetail);
const Notes = lazy(publicPageImports.notes);
const Now = lazy(publicPageImports.now);
const Timeline = lazy(publicPageImports.timeline);
const NotFound = lazy(publicPageImports.notFound);
const PrivateRouteBoundary = lazy(
  () => import("./components/routing/PrivateRouteBoundary.tsx"),
);
const PrivateAuth = lazy(() => import("./pages/PrivateAuth.tsx"));
const PrivateClipboard = lazy(() => import("./pages/PrivateClipboard.tsx"));
const PrivateResources = lazy(() => import("./pages/PrivateResources.tsx"));
const PrivateResourceCollection = lazy(() => import("./pages/PrivateResourceCollection.tsx"));
const PrivateResourceItem = lazy(() => import("./pages/PrivateResourceItem.tsx"));
const PrivateResourceUpload = lazy(() => import("./pages/PrivateResourceUpload.tsx"));
const PrivateResourceCreateCollection = lazy(() => import("./pages/PrivateResourceCreateCollection.tsx"));
const WeddingInvitation = lazy(publicPageImports.wedding);

const routeFallback = <RouteLoading />;

function lazyPage(element: ReactElement): ReactElement {
  return <Suspense fallback={routeFallback}>{element}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: "about", element: lazyPage(<About />) },
      { path: "fragments", element: lazyPage(<Fragments />) },
      { path: "now", element: lazyPage(<Now />) },
      { path: "timeline", element: lazyPage(<Timeline />) },
      { path: "notes", element: lazyPage(<Notes />) },
      { path: "notes/:slug", element: lazyPage(<NoteDetail />) },
      {
        element: lazyPage(<PrivateRouteBoundary />),
        children: [
          { path: "auth", element: lazyPage(<PrivateAuth />) },
          { path: "resources", element: lazyPage(<PrivateResources />) },
          { path: "resources/clipboard", element: lazyPage(<PrivateClipboard />) },
          { path: "resources/new", element: lazyPage(<PrivateResourceCreateCollection />) },
          { path: "resources/upload", element: lazyPage(<PrivateResourceUpload />) },
          { path: "resources/:collectionId", element: lazyPage(<PrivateResourceCollection />) },
          { path: "resources/:collectionId/:itemId", element: lazyPage(<PrivateResourceItem />) },
        ],
      },
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
      <AppErrorBoundary>
        <RouterProvider router={router} />
      </AppErrorBoundary>
    </HelmetProvider>
  </StrictMode>,
);
