import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "sonner";

import App from "./App.tsx";
import "./index.css";
import Home from "./pages/Home.tsx";
import NoteDetail from "./pages/NoteDetail.tsx";
import Notes from "./pages/Notes.tsx";
import NotFound from "./pages/NotFound.tsx";
import WeddingInvitation from "./pages/WeddingInvitation.tsx";

const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: "notes", element: <Notes /> },
      { path: "notes/:slug", element: <NoteDetail /> },
      { path: "wedding", element: <WeddingInvitation /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" />
    </HelmetProvider>
  </StrictMode>,
);
