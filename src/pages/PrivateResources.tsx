import { ArrowRight, FolderLock, Headphones, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";
import { useEffect, useState, type JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import PrivateResourceAccessState from "@/components/resources/PrivateResourceAccessState";
import { usePrivateResourceSession } from "@/hooks/usePrivateResourceSession";
import {
  loadPrivateResourceCatalog,
  type PrivateResourceCatalog,
} from "@/lib/privateResources";

export default function PrivateResources(): JSX.Element {
  const access = usePrivateResourceSession();
  const [catalog, setCatalog] = useState<PrivateResourceCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (access.status !== "ready" || !access.session) return;
    const controller = new AbortController();
    loadPrivateResourceCatalog(access.session, controller.signal)
      .then(setCatalog)
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "私人资源目录读取失败");
      });
    return () => controller.abort();
  }, [access.session, access.status]);

  if (access.status !== "ready") {
    return <PrivateResourceAccessState error={access.error} status={access.status} />;
  }

  const canUpload = access.session?.user.role === "owner" ||
    access.session?.user.permissions.includes("private-resources-write") === true;

  return (
    <>
      <Helmet>
        <title>私人资源 · 彦骁的笔记</title>
        <meta content="仅限授权账户访问的私人资源合集。" name="description" />
        <meta content="noindex,nofollow" name="robots" />
      </Helmet>

      <main className="min-h-[calc(100svh-4rem)] bg-[#070a12] px-6 py-12 text-slate-100 sm:px-8 sm:py-16 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <header className="max-w-3xl">
            <div className="flex items-center gap-2 font-mono text-xs tracking-[0.18em] text-cyan-300">
              <ShieldCheck className="size-4" />
              PRIVATE RESOURCES
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">私人资源</h1>
            <p className="mt-5 text-base leading-8 text-slate-400">集中保存个人学习资料、内容合集与其他非公开资源。</p>
            {canUpload && (
              <Link className="mt-7 inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] px-4 py-2.5 text-sm font-medium text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.12]" to="/resources/upload">
                <UploadCloud className="size-4" />上传资源
              </Link>
            )}
          </header>

          {!catalog && !error && (
            <div aria-live="polite" className="mt-14 flex items-center gap-3 text-sm text-slate-500">
              <RefreshCw className="size-4 animate-spin text-cyan-300" />
              正在读取资源目录…
            </div>
          )}

          {error && (
            <div className="mt-12 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-5 text-sm text-rose-100">{error}</div>
          )}

          {catalog && catalog.collections.length === 0 && (
            <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-sm text-slate-400">暂时还没有私人资源。</div>
          )}

          {catalog && catalog.collections.length > 0 && (
            <section aria-label="私人资源合集" className="mt-12 grid gap-5 md:grid-cols-2">
              {catalog.collections.map((collection) => {
                const Icon = collection.type === "audio-transcript" ? Headphones : FolderLock;
                return (
                  <Link
                    className="group rounded-3xl border border-white/10 bg-white/[0.035] p-6 transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.055]"
                    key={collection.collectionId}
                    to={`/resources/${collection.collectionId}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex size-11 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.08]">
                        <Icon className="size-5 text-cyan-300" />
                      </div>
                      <ArrowRight className="size-4 text-slate-600 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
                    </div>
                    <h2 className="mt-6 text-xl font-semibold text-white">{collection.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-400">{collection.description}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {collection.tags.map((tag) => (
                        <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-xs text-slate-500" key={tag}>{tag}</span>
                      ))}
                    </div>
                  </Link>
                );
              })}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
