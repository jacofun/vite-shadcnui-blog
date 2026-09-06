export const publicPageImports = {
  about: () => import("@/pages/About.tsx"),
  notes: () => import("@/pages/Notes.tsx"),
  noteDetail: () => import("@/pages/NoteDetail.tsx"),
  now: () => import("@/pages/Now.tsx"),
  timeline: () => import("@/pages/Timeline.tsx"),
  wedding: () => import("@/pages/WeddingInvitation.tsx"),
  notFound: () => import("@/pages/NotFound.tsx"),
} as const;

const prefetched = new Set<string>();

function importerForPath(pathname: string): (() => Promise<unknown>) | undefined {
  if (pathname === "/about") return publicPageImports.about;
  if (pathname === "/notes") return publicPageImports.notes;
  if (pathname.startsWith("/notes/")) return publicPageImports.noteDetail;
  if (pathname === "/now") return publicPageImports.now;
  if (pathname === "/timeline") return publicPageImports.timeline;
  if (pathname === "/wedding") return publicPageImports.wedding;
  return undefined;
}

export function prefetchPublicRoute(pathname: string): void {
  const importer = importerForPath(pathname);
  if (!importer || prefetched.has(pathname)) return;

  prefetched.add(pathname);
  void importer().catch(() => {
    prefetched.delete(pathname);
  });
}

export function prefetchPrimaryPublicRoutes(): void {
  ["/notes", "/about", "/now", "/timeline"].forEach(prefetchPublicRoute);
}
