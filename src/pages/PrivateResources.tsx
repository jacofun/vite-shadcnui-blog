import { ArrowRight, BookOpenText, Clipboard, FilePenLine, FolderLock, FolderPlus, Headphones, LogOut, PenLine, Play, RefreshCw, ShieldCheck, UploadCloud, Video } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";

import PrivateResourceAccessState from "@/components/resources/PrivateResourceAccessState";
import PrivateLoadingProgress from "@/components/resources/PrivateLoadingProgress";
import { usePrivateResourceSession } from "@/hooks/usePrivateResourceSession";
import { usePrivateAuth } from "@/hooks/usePrivateAuth";
import { logoutPrivateAuth } from "@/lib/privateAuth";
import {
  formatPrivatePlaybackTime,
  listPrivatePlaybackStates,
  type PrivatePlaybackEntry,
} from "@/lib/privatePlayback";
import {
  loadPrivateResourceCatalog,
  type PrivateResourceCatalog,
} from "@/lib/privateResources";

export default function PrivateResources(): JSX.Element {
  const auth = usePrivateAuth();
  const access = usePrivateResourceSession();
  const navigate = useNavigate();
  const loadedUserId = useRef<string | null>(null);
  const [catalog, setCatalog] = useState<PrivateResourceCatalog | null>(null);
  const [continueEntry, setContinueEntry] = useState<PrivatePlaybackEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (access.status !== "ready") return;
    setContinueEntry(listPrivatePlaybackStates()[0] ?? null);
  }, [access.status]);

  useEffect(() => {
    if (access.status !== "ready" || !access.session) return;
    const controller = new AbortController();
    const userId = access.session.user.id;
    const sameUser = loadedUserId.current === userId;

    if (!sameUser) {
      loadedUserId.current = userId;
      setCatalog(null);
    }
    setRefreshing(true);
    setError(null);
    setCatalogError(false);

    loadPrivateResourceCatalog(access.session, controller.signal, { force: loadRevision > 0 })
      .then(setCatalog)
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogError(true);
        setError(loadError instanceof Error ? loadError.message : "私人资源目录读取失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
      });

    return () => controller.abort();
  }, [access.session, access.status, loadRevision]);

  if (access.status !== "ready") {
    return <PrivateResourceAccessState error={access.error} status={access.status} />;
  }

  const isOwner = access.session?.user.role === "owner";
  const canUpload = isOwner ||
    access.session?.user.permissions.includes("private-resources-write") === true;
  const quickActions = [
    ...(isOwner ? [
      { to: "/resources/trading", title: "交易日志", description: "记录判断、成交和复盘", icon: BookOpenText,
        tone: "border-sky-300/20 from-sky-400/[0.12] to-sky-400/[0.025] hover:border-sky-300/45 hover:from-sky-400/[0.18]",
        iconTone: "bg-sky-300/15 text-sky-200", arrowTone: "text-sky-200/80" },
      { to: "/resources/just-write", title: "Just Write", description: "用英语写下今天的想法", icon: PenLine,
        tone: "border-emerald-300/20 from-emerald-400/[0.12] to-emerald-400/[0.025] hover:border-emerald-300/45 hover:from-emerald-400/[0.18]",
        iconTone: "bg-emerald-300/15 text-emerald-200", arrowTone: "text-emerald-200/80" },
      { to: "/resources/publish", title: "内容发布", description: "编辑文章，管理公开内容", icon: FilePenLine,
        tone: "border-violet-300/20 from-violet-400/[0.12] to-violet-400/[0.025] hover:border-violet-300/45 hover:from-violet-400/[0.18]",
        iconTone: "bg-violet-300/15 text-violet-200", arrowTone: "text-violet-200/80" },
    ] : []),
    ...(canUpload ? [
      { to: "/resources/upload", title: "上传资源", description: "上传文件、音频与视频", icon: UploadCloud,
        tone: "border-cyan-300/20 from-cyan-400/[0.12] to-cyan-400/[0.025] hover:border-cyan-300/45 hover:from-cyan-400/[0.18]",
        iconTone: "bg-cyan-300/15 text-cyan-200", arrowTone: "text-cyan-200/80" },
    ] : []),
    ...(isOwner ? [
      { to: "/resources/new", title: "新建合集", description: "分类整理私人资源", icon: FolderPlus,
        tone: "border-amber-300/20 from-amber-400/[0.12] to-amber-400/[0.025] hover:border-amber-300/45 hover:from-amber-400/[0.18]",
        iconTone: "bg-amber-300/15 text-amber-200", arrowTone: "text-amber-200/80" },
    ] : []),
    { to: "/resources/clipboard", title: "文本剪贴板", description: "保存和整理临时文本", icon: Clipboard,
      tone: "border-fuchsia-300/20 from-fuchsia-400/[0.12] to-fuchsia-400/[0.025] hover:border-fuchsia-300/45 hover:from-fuchsia-400/[0.18]",
      iconTone: "bg-fuchsia-300/15 text-fuchsia-200", arrowTone: "text-fuchsia-200/80" },
  ];
  const roleLabel = access.session?.user.role === "owner" ? "站点所有者" : "受邀成员";
  const continueParts = continueEntry?.route.split("/").filter(Boolean) ?? [];
  const continueCollectionId = continueParts[1] ?? "";
  const continueItemId = continueParts[2] ?? "";
  const continueCollection = catalog?.collections.find((item) => item.collectionId === continueCollectionId);
  const continueTitle = continueEntry?.state.title || (continueItemId ? `${continueCollection?.title ?? "私人资源"} · ${continueItemId}` : "继续播放");
  const continueProgress = continueEntry?.state.duration
    ? Math.min(100, Math.max(0, (continueEntry.state.position / continueEntry.state.duration) * 100))
    : null;

  async function logout(): Promise<void> {
    if (!access.session || loggingOut) return;
    setLoggingOut(true);
    setError(null);
    setCatalogError(false);
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

      <main className="min-h-[calc(100svh-var(--site-header-height))] bg-[#070a12] px-6 py-12 text-slate-100 sm:px-8 sm:py-16 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <header className="relative max-w-3xl">
              <div className="flex items-center gap-2 font-mono text-xs tracking-[0.18em] text-cyan-300">
                <ShieldCheck className="size-4" />
                PRIVATE RESOURCES
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">私人资源</h1>
              <p className="mt-5 text-base leading-8 text-slate-400">集中保存个人学习资料、内容合集与其他非公开资源。</p>

              {access.session && (
                <section aria-label="当前用户" className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 lg:hidden">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">{access.session.user.displayName}</p>
                    <p className="mt-1 text-xs text-slate-500">{roleLabel}</p>
                  </div>
                  <button className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-400 transition hover:border-rose-300/20 hover:text-rose-300 disabled:opacity-50" disabled={loggingOut} onClick={() => void logout()} type="button">
                    {loggingOut ? <RefreshCw className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
                    退出登录
                  </button>
                </section>
              )}

            </header>

            {access.session && (
              <aside aria-label="当前用户" className="hidden rounded-2xl border border-white/10 bg-white/[0.025] p-5 lg:block">
                <p className="font-mono text-[10px] tracking-[0.18em] text-slate-600">SIGNED IN</p>
                <p className="mt-3 truncate text-base font-medium text-white">{access.session.user.displayName}</p>
                <p className="mt-1 text-xs text-slate-500">{roleLabel}</p>
                <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-medium text-slate-400 transition hover:border-rose-300/20 hover:bg-rose-300/[0.04] hover:text-rose-300 disabled:opacity-50" disabled={loggingOut} onClick={() => void logout()} type="button">
                  {loggingOut ? <RefreshCw className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
                  退出登录
                </button>
              </aside>
            )}
          </div>

          <section aria-label="私人资源快捷功能" className="mt-10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-white">快捷功能</h2>
              <span className="text-xs text-slate-500">根据账户权限显示</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
              {quickActions.map(({ to, title, description, icon: Icon, tone, iconTone, arrowTone }) => (
                <Link
                  key={to}
                  to={to}
                  className={`group flex min-h-[122px] items-center gap-4 rounded-2xl border bg-gradient-to-br p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/75 motion-reduce:transform-none ${tone}`}
                >
                  <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${iconTone}`}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-white">{title}</span>
                    <span className="mt-1.5 block text-xs leading-5 text-slate-400">{description}</span>
                  </span>
                  <ArrowRight aria-hidden="true" className={`size-4 shrink-0 transition-transform group-hover:translate-x-1 motion-reduce:transform-none ${arrowTone}`} />
                </Link>
              ))}
            </div>
          </section>

          {continueEntry && (
            <section aria-label="继续播放" className="mt-12 max-w-3xl">
              <div className="mb-3 flex items-center justify-between gap-4">
                <p className="font-mono text-[10px] tracking-[0.18em] text-slate-600">CONTINUE PLAYING</p>
                <span className="text-[11px] text-slate-600">{formatPrivatePlaybackTime(continueEntry.state.position)}</span>
              </div>
              <Link
                className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-300/25 hover:bg-white/[0.055]"
                to={`${continueEntry.route}?continue=1`}
              >
                <div className="flex items-center gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/[0.09] text-cyan-200 transition group-hover:bg-cyan-300/[0.14]">
                    {continueEntry.state.mediaKind === "video" ? <Video className="size-5" /> : <Headphones className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-white">{continueTitle}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {continueCollection?.title ?? "私人资源"}
                      {continueEntry.state.duration ? ` · ${formatPrivatePlaybackTime(continueEntry.state.position)} / ${formatPrivatePlaybackTime(continueEntry.state.duration)}` : ` · 已播放到 ${formatPrivatePlaybackTime(continueEntry.state.position)}`}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-2 text-xs text-cyan-200">
                    <Play className="size-3.5 fill-current" />
                    <span className="hidden sm:inline">继续</span>
                  </span>
                </div>
                {continueProgress !== null && (
                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-sky-400" style={{ width: `${continueProgress}%` }} />
                  </div>
                )}
              </Link>
            </section>
          )}

          <PrivateLoadingProgress className="mt-14 max-w-xl" failed={catalogError && !catalog} label={catalog ? "正在刷新资源目录" : "正在读取资源目录"} loading={refreshing} />

          {error && (
            <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-5 text-sm text-rose-100">
              <span>{catalog ? `刷新失败：${error}，当前仍显示上次成功读取的内容。` : error}</span>
              {catalogError && (
                <button className="inline-flex items-center gap-2 rounded-xl border border-rose-200/20 px-4 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-100/10" onClick={() => setLoadRevision((value) => value + 1)} type="button">
                  <RefreshCw className="size-3.5" />重新加载
                </button>
              )}
            </div>
          )}

          {catalog && catalog.collections.length === 0 && (
            <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-sm text-slate-400">暂时还没有私人资源。</div>
          )}

          {catalog && catalog.collections.length > 0 && (
            <section aria-label="私人资源合集" className="mt-12 grid gap-5 md:grid-cols-2">
              {catalog.collections.map((collection) => {
                const Icon = collection.type === "audio-transcript" ? Headphones : FolderLock;
                return (
                  <Link className="group rounded-3xl border border-white/10 bg-white/[0.035] p-6 transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.055]" key={collection.collectionId} to={`/resources/${collection.collectionId}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex size-11 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.08]"><Icon className="size-5 text-cyan-300" /></div>
                      <ArrowRight className="size-4 text-slate-600 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
                    </div>
                    <h2 className="mt-6 text-xl font-semibold text-white">{collection.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-400">{collection.description}</p>
                    <div className="mt-5 flex flex-wrap gap-2">{collection.tags.map((tag) => <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-xs text-slate-500" key={tag}>{tag}</span>)}</div>
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
