import { ArrowRight, Clipboard, FolderLock, FolderPlus, Headphones, LogOut, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";
import { useEffect, useState, type JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";

import PrivateResourceAccessState from "@/components/resources/PrivateResourceAccessState";
import PrivateLoadingProgress from "@/components/resources/PrivateLoadingProgress";
import { usePrivateResourceSession } from "@/hooks/usePrivateResourceSession";
import { usePrivateAuth } from "@/hooks/usePrivateAuth";
import { logoutPrivateAuth } from "@/lib/privateAuth";
import {
  loadPrivateResourceCatalog,
  type PrivateResourceCatalog,
} from "@/lib/privateResources";

export default function PrivateResources(): JSX.Element {
  const auth = usePrivateAuth();
  const access = usePrivateResourceSession();
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<PrivateResourceCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

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

  async function logout(): Promise<void> {
    if (!access.session || loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutPrivateAuth(access.session);
      auth.clearSession();
      navigate("/auth", { replace: true });
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "退出登录失败");
      setLoggingOut(false);
    }
  }

  return (
    <>
      <Helmet>
        <title>私人资源 · 彦骁的笔记</title>
        <meta content="仅限授权账户访问的私人资源合集。" name="description" />
        <meta content="noindex,nofollow" name="robots" />
      </Helmet>

      <main className="min-h-[calc(100svh-4rem)] bg-[#070a12] px-6 py-12 text-slate-100 sm:px-8 sm:py-16 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <header className="relative max-w-3xl">
            <div className="flex items-center gap-2 font-mono text-xs tracking-[0.18em] text-cyan-300">
              <ShieldCheck className="size-4" />
              PRIVATE RESOURCES
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">私人资源</h1>
            <p className="mt-5 text-base leading-8 text-slate-400">集中保存个人学习资料、内容合集与其他非公开资源。</p>
            <div className="mt-7 flex flex-wrap gap-3">
              {canUpload && <Link className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] px-4 py-2.5 text-sm font-medium text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.12]" to="/resources/upload"><UploadCloud className="size-4" />上传资源</Link>}
              {access.session?.user.role === "owner" && <Link className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.07]" to="/resources/new"><FolderPlus className="size-4" />新建合集</Link>}
              <Link className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.07]" to="/resources/clipboard"><Clipboard className="size-4" />文本剪贴板</Link>
              <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:border-rose-300/20 hover:text-rose-300 disabled:opacity-50" disabled={loggingOut} onClick={() => void logout()} type="button">{loggingOut ? <RefreshCw className="size-4 animate-spin" /> : <LogOut className="size-4" />}退出登录</button>
            </div>
          </header>

          <PrivateLoadingProgress className="mt-14 max-w-xl" failed={Boolean(error)} label="正在读取资源目录" loading={!catalog && !error} />

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
