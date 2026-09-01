import { ArrowLeft, ArrowRight, CalendarDays, RefreshCw } from "lucide-react";
import { useEffect, useState, type JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";

import PrivateResourceAccessState from "@/components/resources/PrivateResourceAccessState";
import { usePrivateResourceSession } from "@/hooks/usePrivateResourceSession";
import {
  signLegacyPrivateLearningIndex,
  signPrivateResourcePaths,
} from "@/lib/privateAuth";
import {
  fetchPrivateLearningIndex,
  type PrivateLearningIndex,
} from "@/lib/privateLearning";
import {
  loadPrivateResourceCatalog,
  usesLegacyPrivateAuth,
  type PrivateResourceCollection as ResourceCollection,
} from "@/lib/privateResources";

function displayDate(value: string): string {
  return value.replaceAll("-", ".");
}

export default function PrivateResourceCollection(): JSX.Element {
  const { collectionId = "" } = useParams();
  const access = usePrivateResourceSession();
  const [collection, setCollection] = useState<ResourceCollection | null>(null);
  const [index, setIndex] = useState<PrivateLearningIndex | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (access.status !== "ready" || !access.session) return;
    const controller = new AbortController();
    setIsLoading(true);
    loadPrivateResourceCatalog(access.session, controller.signal)
      .then(async (catalog) => {
        const selected = catalog.collections.find((item) => item.collectionId === collectionId);
        if (!selected) throw new Error("资源合集不存在");
        setCollection(selected);
        if (selected.type !== "audio-transcript") {
          throw new Error(`暂不支持 ${selected.type} 类型的资源合集`);
        }
        try {
          const signed = await signPrivateResourcePaths(
            access.session!,
            { index: selected.indexPath },
            controller.signal,
          );
          if (!signed.resources.index) throw new Error("认证服务未返回资源索引地址");
          return fetchPrivateLearningIndex(signed.resources.index, controller.signal);
        } catch (signError) {
          if (!usesLegacyPrivateAuth(signError) || selected.collectionId !== "6minuteenglish") throw signError;
          const legacy = await signLegacyPrivateLearningIndex(access.session!, controller.signal);
          if (!legacy.resources.index) throw new Error("认证服务未返回课程索引地址");
          return fetchPrivateLearningIndex(legacy.resources.index, controller.signal);
        }
      })
      .then(setIndex)
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "资源合集读取失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [access.session, access.status, collectionId]);

  if (access.status !== "ready") {
    return <PrivateResourceAccessState error={access.error} status={access.status} />;
  }

  return (
    <>
      <Helmet>
        <title>{collection ? `${collection.title} · 私人资源` : "私人资源 · 彦骁的笔记"}</title>
        <meta content="noindex,nofollow" name="robots" />
      </Helmet>
      <main className="min-h-[calc(100dvh-4rem)] bg-[#070a12] px-6 py-12 text-slate-100 sm:px-8 sm:py-16 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <Link className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-cyan-300" to="/resources">
            <ArrowLeft className="size-4" />全部私人资源
          </Link>
          {collection && (
            <header className="mt-8 max-w-3xl">
              <p className="font-mono text-xs tracking-[0.18em] text-cyan-300">PRIVATE COLLECTION</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{collection.title}</h1>
              <p className="mt-5 text-base leading-8 text-slate-400">{collection.description}</p>
            </header>
          )}
          {isLoading && (
            <div aria-live="polite" className="mt-14 flex items-center gap-3 text-sm text-slate-500">
              <RefreshCw className="size-4 animate-spin text-cyan-300" />正在读取合集…
            </div>
          )}
          {error && <div className="mt-12 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-5 text-sm text-rose-100">{error}</div>}
          {index && index.episodes.length === 0 && <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-sm text-slate-400">这个合集暂时没有内容。</div>}
          {collection && index && index.episodes.length > 0 && (
            <section aria-label={`${collection.title} 内容列表`} className="mt-12 grid gap-5 md:grid-cols-2">
              {index.episodes.map((episode, position) => (
                <Link className="group rounded-3xl border border-white/10 bg-white/[0.035] p-6 transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.055]" key={episode.episodeId} to={`/resources/${collection.collectionId}/${episode.episodeId}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="font-mono text-cyan-300">#{String(index.episodes.length - position).padStart(2, "0")}</span>
                      <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{displayDate(episode.recommendedDate)}</span>
                    </div>
                    <ArrowRight className="size-4 text-slate-600 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold leading-snug text-white">{episode.title}</h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-400">{episode.reason}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.07] px-2.5 py-1 text-xs text-cyan-200">{episode.difficulty}</span>
                    {episode.tags.slice(0, 4).map((tag) => <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-xs text-slate-500" key={tag}>{tag}</span>)}
                  </div>
                </Link>
              ))}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
