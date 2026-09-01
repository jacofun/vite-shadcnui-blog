import { ArrowLeft, CalendarDays, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState, type JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";

import FixedAudioPlayer from "@/components/resources/FixedAudioPlayer";
import PrivateResourceAccessState from "@/components/resources/PrivateResourceAccessState";
import { usePrivateResourceSession } from "@/hooks/usePrivateResourceSession";
import {
  signLegacyPrivateLearningEpisode,
  signPrivateResourcePaths,
} from "@/lib/privateAuth";
import {
  fetchPrivateLearningEpisode,
  fetchPrivateLearningTranscript,
  type PrivateLearningEpisode,
} from "@/lib/privateLearning";
import {
  loadPrivateResourceCatalog,
  privateResourceItemPath,
  usesLegacyPrivateAuth,
  type PrivateResourceCollection,
} from "@/lib/privateResources";

const itemIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

export default function PrivateResourceItem(): JSX.Element {
  const { collectionId = "", itemId = "" } = useParams();
  const access = usePrivateResourceSession();
  const [collection, setCollection] = useState<PrivateResourceCollection | null>(null);
  const [episode, setEpisode] = useState<PrivateLearningEpisode | null>(null);
  const [transcript, setTranscript] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transcriptSections = useMemo(
    () => transcript.split(/\n{2,}/).map((section) => section.trim()).filter(Boolean),
    [transcript],
  );

  useEffect(() => {
    if (access.status !== "ready" || !access.session || !itemIdPattern.test(itemId)) return;
    const controller = new AbortController();
    setIsLoading(true);
    loadPrivateResourceCatalog(access.session, controller.signal)
      .then(async (catalog) => {
        const selected = catalog.collections.find((item) => item.collectionId === collectionId);
        if (!selected) throw new Error("资源合集不存在");
        if (selected.type !== "audio-transcript") throw new Error(`暂不支持 ${selected.type} 类型的资源`);
        setCollection(selected);
        try {
          return await signPrivateResourcePaths(access.session!, {
            audio: privateResourceItemPath(selected, itemId, "audio.mp3"),
            metadata: privateResourceItemPath(selected, itemId, "metadata.json"),
            transcriptText: privateResourceItemPath(selected, itemId, "transcript.txt"),
          }, controller.signal);
        } catch (signError) {
          if (!usesLegacyPrivateAuth(signError) || selected.collectionId !== "6minuteenglish") throw signError;
          return signLegacyPrivateLearningEpisode(access.session!, itemId, controller.signal);
        }
      })
      .then(async (signed) => {
        const { audio, metadata, transcriptText } = signed.resources;
        if (!audio || !metadata || !transcriptText) throw new Error("认证服务返回的资源地址不完整");
        const [episodeMetadata, transcriptContent] = await Promise.all([
          fetchPrivateLearningEpisode(metadata, controller.signal),
          fetchPrivateLearningTranscript(transcriptText, controller.signal),
        ]);
        setEpisode(episodeMetadata);
        setTranscript(transcriptContent);
        setAudioUrl(audio);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "私人资源读取失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [access.session, access.status, collectionId, itemId]);

  if (access.status !== "ready") return <PrivateResourceAccessState error={access.error} status={access.status} />;
  const invalidItem = !itemIdPattern.test(itemId);
  const collectionPath = collection ? `/resources/${collection.collectionId}` : "/resources";

  return (
    <>
      <Helmet>
        <title>{episode ? `${episode.title} · ${collection?.title ?? "私人资源"}` : "私人资源 · 彦骁的笔记"}</title>
        <meta content="noindex,nofollow" name="robots" />
      </Helmet>
      <main className="min-h-[calc(100svh-4rem)] bg-[#070a12] px-6 pb-48 pt-10 text-slate-100 sm:px-8 sm:pb-48 sm:pt-14 lg:px-10">
        <article className="mx-auto max-w-3xl">
          <Link className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-cyan-300" to={collectionPath}>
            <ArrowLeft className="size-4" />返回{collection?.title ?? "私人资源"}
          </Link>
          {isLoading && <div aria-live="polite" className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-slate-500"><RefreshCw className="size-4 animate-spin text-cyan-300" />正在读取资源…</div>}
          {(error || invalidItem) && <div className="mt-10 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-5 text-sm text-rose-100">{invalidItem ? "资源标识无效。" : error}</div>}
          {episode && (
            <>
              <header className="mt-9 border-b border-white/10 pb-9">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.07] px-2.5 py-1 text-cyan-200">{episode.difficulty}</span>
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />推荐于 {episode.recommendedDate.replaceAll("-", ".")}</span>
                </div>
                <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-5xl">{episode.title}</h1>
                <p className="mt-6 text-base leading-8 text-slate-400">{episode.reason}</p>
                <div className="mt-5 flex flex-wrap gap-2">{episode.tags.map((tag) => <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-xs text-slate-500" key={tag}>{tag}</span>)}</div>
                <a className="mt-6 inline-flex items-center gap-2 text-xs text-slate-500 transition hover:text-cyan-300" href={episode.sourcePage} rel="noreferrer" target="_blank">BBC 官方节目页 <ExternalLink className="size-3.5" /></a>
              </header>
              <section aria-labelledby="transcript-title" className="pt-10">
                <p className="font-mono text-xs tracking-[0.18em] text-cyan-300">TRANSCRIPT</p>
                <h2 className="mt-3 text-2xl font-semibold text-white" id="transcript-title">节目文本</h2>
                <div className="mt-8 space-y-6 text-[15px] leading-8 text-slate-300 sm:text-base">
                  {transcriptSections.map((section, index) => <p className="whitespace-pre-wrap" key={`${index}-${section.slice(0, 24)}`}>{section}</p>)}
                </div>
              </section>
            </>
          )}
        </article>
      </main>
      {episode && audioUrl && <FixedAudioPlayer audioUrl={audioUrl} title={episode.title} />}
    </>
  );
}
