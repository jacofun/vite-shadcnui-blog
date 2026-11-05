import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPublicContent, type PublishingEntry } from "@/lib/publishing";
export default function PublishedContent({ type, limit = 100 }: { type?: "article" | "moment"; limit?: number }) {
  const [entries, setEntries] = useState<PublishingEntry[]>([]);
  useEffect(() => { const controller = new AbortController(); getPublicContent(controller.signal).then(setEntries).catch(() => { /* Existing static content remains available. */ }); return () => controller.abort(); }, []);
  const selected = entries.filter(e => !type || e.type === type).slice(0, limit);
  if (!selected.length) return null;
  return <div className="divide-y divide-white/10">{selected.map(entry => <Link className="flex min-w-0 items-center gap-5 py-5" key={entry.id} to={`/journal/${entry.id}`}>
    {entry.media?.find(m => m.kind === "image") && <img className="h-20 w-24 shrink-0 rounded-lg object-cover" src={entry.media.find(m => m.kind === "image")!.url} alt="" loading="lazy" />}
    <div className="min-w-0"><h3 className="break-words text-lg text-slate-200">{entry.title}</h3>{entry.summary && <p className="mt-2 line-clamp-2 text-sm text-slate-400">{entry.summary}</p>}<p className="mt-2 text-xs text-slate-500">{entry.type === "article" ? "文章" : "影像碎片"} · {entry.publishedAt?.slice(0, 10)}</p></div>
  </Link>)}</div>;
}
