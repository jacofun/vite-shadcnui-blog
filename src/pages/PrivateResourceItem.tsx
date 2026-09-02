import { ArrowLeft, CalendarDays, ExternalLink, File, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState, type JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";

import FixedAudioPlayer from "@/components/resources/FixedAudioPlayer";
import FlvVideoPlayer from "@/components/resources/FlvVideoPlayer";
import PrivateResourceAccessState from "@/components/resources/PrivateResourceAccessState";
import { usePrivateResourceSession } from "@/hooks/usePrivateResourceSession";
import { signLegacyPrivateLearningEpisode, signPrivateResourcePaths } from "@/lib/privateAuth";
import { fetchPrivateFileItem, formatFileBytes, type PrivateFileItem } from "@/lib/privateFiles";
import { fetchPrivateLearningEpisode, fetchPrivateLearningTranscript, type PrivateLearningEpisode } from "@/lib/privateLearning";
import { loadPrivateResourceCatalog, privateResourceItemPath, usesLegacyPrivateAuth, type PrivateResourceCollection } from "@/lib/privateResources";

const itemIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

export default function PrivateResourceItem(): JSX.Element {
  const { collectionId = "", itemId = "" } = useParams();
  const access = usePrivateResourceSession();
  const [collection, setCollection] = useState<PrivateResourceCollection | null>(null);
  const [episode, setEpisode] = useState<PrivateLearningEpisode | null>(null);
  const [file, setFile] = useState<PrivateFileItem | null>(null);
  const [transcript, setTranscript] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transcriptSections = useMemo(() => transcript.split(/\n{2,}/).map((section) => section.trim()).filter(Boolean), [transcript]);

  useEffect(() => {
    if (access.status !== "ready" || !access.session || !itemIdPattern.test(itemId)) return;
    const controller = new AbortController();
    const session = access.session;
    setIsLoading(true);
    setError(null);
    loadPrivateResourceCatalog(session, controller.signal).then(async (catalog) => {
      const selected = catalog.collections.find((item) => item.collectionId === collectionId);
      if (!selected) throw new Error("资源合集不存在");
      setCollection(selected);
      if (selected.type === "files") {
        const metadataPath = `${selected.basePath}/items/${itemId}/metadata.json`;
        const signedMetadata = await signPrivateResourcePaths(session, { metadata: metadataPath }, controller.signal);
        const metadataUrl = signedMetadata.resources.metadata;
        if (!metadataUrl) throw new Error("认证服务未返回文件信息地址");
        const metadata = await fetchPrivateFileItem(metadataUrl, controller.signal);
        setFile(metadata);
        if (metadata.mediaType !== "file") {
          const signedFile = await signPrivateResourcePaths(session, { file: metadata.objectPath }, controller.signal);
          if (!signedFile.resources.file) throw new Error("认证服务未返回媒体地址");
          setMediaUrl(signedFile.resources.file);
        }
        return;
      }
      if (selected.type !== "audio-transcript") throw new Error(`暂不支持 ${selected.type} 类型的资源`);
      let signed;
      try {
        signed = await signPrivateResourcePaths(session, {
          audio: privateResourceItemPath(selected, itemId, "audio.mp3"),
          metadata: privateResourceItemPath(selected, itemId, "metadata.json"),
          transcriptText: privateResourceItemPath(selected, itemId, "transcript.txt"),
        }, controller.signal);
      } catch (signError) {
        if (!usesLegacyPrivateAuth(signError) || selected.collectionId !== "6minuteenglish") throw signError;
        signed = await signLegacyPrivateLearningEpisode(session, itemId, controller.signal);
      }
      const { audio, metadata, transcriptText } = signed.resources;
      if (!audio || !metadata || !transcriptText) throw new Error("认证服务返回的资源地址不完整");
      const [episodeMetadata, transcriptContent] = await Promise.all([
        fetchPrivateLearningEpisode(metadata, controller.signal),
        fetchPrivateLearningTranscript(transcriptText, controller.signal),
      ]);
      setEpisode(episodeMetadata);
      setTranscript(transcriptContent);
      setMediaUrl(audio);
    }).catch((loadError: unknown) => {
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "私人资源读取失败");
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    return () => controller.abort();
  }, [access.session, access.status, collectionId, itemId]);

  if (access.status !== "ready") return <PrivateResourceAccessState error={access.error} status={access.status} />;
  const invalidItem = !itemIdPattern.test(itemId);
  const collectionPath = collection ? `/resources/${collection.collectionId}` : "/resources";
  const title = file?.originalName || episode?.title;

  return (
    <>
      <Helmet><title>{title ? `${title} · ${collection?.title ?? "私人资源"}` : "私人资源 · 彦骁的笔记"}</title><meta content="noindex,nofollow" name="robots" /></Helmet>
      <main className={`min-h-[calc(100svh-4rem)] bg-[#070a12] px-6 pt-10 text-slate-100 sm:px-8 sm:pt-14 lg:px-10 ${episode || file?.format === "mp3" ? "pb-48" : "pb-20"}`}>
        <article className="mx-auto max-w-3xl">
          <Link className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-cyan-300" to={collectionPath}><ArrowLeft className="size-4" />返回{collection?.title ?? "私人资源"}</Link>
          {isLoading && <div className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-slate-500"><RefreshCw className="size-4 animate-spin text-cyan-300" />正在读取资源…</div>}
          {(error || invalidItem) && <div className="mt-10 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-5 text-sm text-rose-100">{invalidItem ? "资源标识无效。" : error}</div>}
          {file && <>
            <header className="mt-9 border-b border-white/10 pb-9">
              <p className="font-mono text-xs tracking-[0.18em] text-cyan-300">PRIVATE FILE</p>
              <h1 className="mt-4 break-words text-3xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">{file.originalName}</h1>
              <p className="mt-5 text-sm text-slate-500">{file.format.toUpperCase()} · {formatFileBytes(file.bytes)} · {new Date(file.uploadedAt).toLocaleString()}</p>
            </header>
            <section className="mt-9">
              {file.format === "mp3" && mediaUrl && <FixedAudioPlayer audioUrl={mediaUrl} title={file.originalName} />}
              {file.format === "mp4" && mediaUrl && <video className="aspect-video w-full rounded-2xl bg-black" controls controlsList="nodownload" onContextMenu={(event) => event.preventDefault()} playsInline src={mediaUrl} />}
              {file.format === "flv" && mediaUrl && <FlvVideoPlayer src={mediaUrl} />}
              {file.mediaType === "file" && <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400"><File className="size-6 text-cyan-300" />该文件已安全保存；按当前设计不提供打开或下载入口。</div>}
            </section>
          </>}
          {episode && <><header className="mt-9 border-b border-white/10 pb-9"><div className="flex flex-wrap items-center gap-3 text-xs text-slate-500"><span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.07] px-2.5 py-1 text-cyan-200">{episode.difficulty}</span><span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />推荐于 {episode.recommendedDate.replaceAll("-", ".")}</span></div><h1 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-5xl">{episode.title}</h1><p className="mt-6 leading-8 text-slate-400">{episode.reason}</p>{episode.sourcePage && <a className="mt-6 inline-flex items-center gap-2 text-xs text-slate-500 hover:text-cyan-300" href={episode.sourcePage} rel="noreferrer" target="_blank">资源来源 <ExternalLink className="size-3.5" /></a>}</header><section className="pt-10"><p className="font-mono text-xs tracking-[0.18em] text-cyan-300">TRANSCRIPT</p><h2 className="mt-3 text-2xl font-semibold text-white">节目文本</h2><div className="mt-8 space-y-6 text-[15px] leading-8 text-slate-300">{transcriptSections.map((section, index) => <p className="whitespace-pre-wrap" key={`${index}-${section.slice(0, 24)}`}>{section}</p>)}</div></section></>}
        </article>
      </main>
      {episode && mediaUrl && <FixedAudioPlayer audioUrl={mediaUrl} title={episode.title} />}
    </>
  );
}
