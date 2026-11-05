import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import MarkdownRenderer from "@/components/notes/MarkdownRenderer";
import PublishingVideo from "@/components/common/PublishingVideo";
import { getPublicContent, type PublishingEntry } from "@/lib/publishing";
export default function PublicJournal() {
  const { entryId } = useParams();
  const [entries, setEntries] = useState<PublishingEntry[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { const controller = new AbortController(); getPublicContent(controller.signal).then(setEntries).catch(e => { if (!controller.signal.aborted) setError(e.message); }); return () => controller.abort(); }, [entryId]);
  const entry = entries?.find(e => e.id === entryId);
  return <main className="min-h-screen bg-[#070a12] px-5 py-12 text-slate-100"><Helmet><title>{entry?.title ?? "最新发布"} · 彦骁的笔记</title>{entry && <meta name="description" content={entry.summary} />}</Helmet><div className="mx-auto max-w-3xl"><Link className="text-sm text-cyan-200" to={entryId ? "/journal" : "/"}>← {entryId ? "最新发布" : "首页"}</Link>
    {error ? <p className="mt-8 text-rose-200" role="alert">{error}</p> : !entries ? <p className="mt-8">正在读取…</p> : entryId ? entry ? <article className="mt-10 space-y-7"><h1 className="break-words text-3xl leading-snug">{entry.title}</h1><p className="text-sm text-slate-400">{entry.publishedAt?.slice(0, 10)}</p>{entry.summary && <p className="text-lg leading-8 text-slate-300">{entry.summary}</p>}<MarkdownRenderer content={entry.body} />{entry.media?.map(asset => asset.kind === "image" ? <img key={asset.id} className="max-h-[800px] w-full object-contain" src={asset.url} alt={asset.name} loading="lazy" /> : <PublishingVideo key={asset.id} src={asset.url} name={asset.name} />)}</article> : <p className="mt-10">这篇内容尚未发布或已撤下。</p> : <><h1 className="mt-10 text-3xl">最新发布</h1>{entries.length === 0 && <p className="mt-8 text-slate-400">还没有公开内容。</p>}{entries.map(e => <Link key={e.id} className="mt-7 block border-b border-white/10 pb-7" to={`/journal/${e.id}`}><h2 className="text-xl">{e.title}</h2><p className="mt-2 text-slate-400">{e.summary}</p></Link>)}</>}
  </div></main>;
}
