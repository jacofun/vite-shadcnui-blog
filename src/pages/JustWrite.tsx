import { ArrowLeft, ArrowRight, BookOpen, LoaderCircle, PenLine, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState, type JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams } from "react-router-dom";

import PrivateResourceAccessState from "@/components/resources/PrivateResourceAccessState";
import { usePrivateResourceSession } from "@/hooks/usePrivateResourceSession";
import { deleteJustWrite, listJustWrite, saveJustWrite, teachJustWrite, type JustWriteEntry, type JustWriteReview, type PrivateAuthSession } from "@/lib/privateAuth";

const base = "/resources/just-write";

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateLabel(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date(year, month - 1, day));
}

function Frame({ children }: { children: React.ReactNode }): JSX.Element {
  return <>
    <Helmet><title>Just Write · 私人资源</title><meta content="noindex,nofollow" name="robots" /></Helmet>
    <main className="min-h-[calc(100svh-4rem)] bg-[#070a12] px-5 py-10 text-slate-100 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-3xl">{children}</div>
    </main>
  </>;
}

function OwnerGate({ children }: { children: (session: PrivateAuthSession) => JSX.Element }): JSX.Element {
  const access = usePrivateResourceSession();
  if (access.status !== "ready") return <PrivateResourceAccessState error={access.error} status={access.status} />;
  if (access.session?.user.role !== "owner") return <PrivateResourceAccessState error={null} status="forbidden" />;
  return children(access.session);
}

export default function JustWrite(): JSX.Element {
  return <OwnerGate>{(session) => <EntryList session={session} />}</OwnerGate>;
}

function EntryList({ session }: { session: PrivateAuthSession }): JSX.Element {
  const [entries, setEntries] = useState<JustWriteEntry[] | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    listJustWrite(session, controller.signal).then(({ entries: loaded }) => setEntries(loaded))
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "读取失败"); });
    return () => controller.abort();
  }, [session]);

  async function remove(entry: JustWriteEntry): Promise<void> {
    if (!window.confirm("确定删除这条记录吗？删除后无法恢复。")) return;
    setDeleting(entry.id);
    setError("");
    try {
      await deleteJustWrite(session, entry.id);
      setEntries((current) => current?.filter((item) => item.id !== entry.id) ?? null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "删除失败");
    } finally {
      setDeleting(null);
    }
  }

  const dates = [...new Set(entries?.map((entry) => entry.date) ?? [])];
  return <Frame>
    <Link className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-emerald-200" to="/resources"><ArrowLeft className="size-4" />返回私人资源</Link>
    <header className="mt-10 flex flex-wrap items-end justify-between gap-5">
      <div>
        <div className="flex items-center gap-2 font-mono text-xs tracking-[0.18em] text-emerald-300"><PenLine className="size-4" />A SPACE TO WRITE</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Just Write</h1>
        <p className="mt-4 text-sm leading-7 text-slate-400">写下生活里的片段。一天可以写很多次，想到什么就写什么。</p>
      </div>
      <Link className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200" to={`${base}/write`}><Plus className="size-4" />write</Link>
    </header>
    {error && <p className="mt-7 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-200" role="alert">{error}</p>}
    {entries === null && !error && <p className="mt-12 flex items-center gap-2 text-sm text-slate-400"><LoaderCircle className="size-4 animate-spin" />正在读取记录…</p>}
    {entries?.length === 0 && <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center"><BookOpen className="mx-auto size-7 text-emerald-300" /><p className="mt-4 text-lg text-white">从今天开始写一点。</p><p className="mt-2 text-sm text-slate-400">几句话，也是一条值得留下的记录。</p></div>}
    <div className="mt-11 space-y-10">
      {dates.map((date) => <section key={date}>
        <h2 className="mb-4 font-mono text-xs tracking-wider text-emerald-300">{dateLabel(date)}</h2>
        <div className="space-y-3">{entries?.filter((entry) => entry.date === date).map((entry) => <article className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-emerald-300/25" key={entry.id}>
          <Link className="block" to={`${base}/${entry.id}`}><p className="line-clamp-3 whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-200">{entry.text}</p><span className="mt-4 inline-flex items-center gap-1 text-xs text-emerald-300">继续写 / 修改 <ArrowRight className="size-3" /></span></Link>
          <div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-3 text-xs text-slate-500"><span>{new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(entry.createdAt))}{entry.review ? " · 有 AI 建议" : ""}</span><button aria-label="删除这条记录" className="rounded-lg p-2 transition hover:bg-rose-300/10 hover:text-rose-200 disabled:opacity-40" disabled={deleting === entry.id} onClick={() => void remove(entry)} type="button">{deleting === entry.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}</button></div>
        </article>)}</div>
      </section>)}
    </div>
  </Frame>;
}

export function JustWriteEditor(): JSX.Element {
  return <OwnerGate>{(session) => <Editor session={session} />}</OwnerGate>;
}

function Editor({ session }: { session: PrivateAuthSession }): JSX.Element {
  const { entryId } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<JustWriteEntry | null>(null);
  const [date, setDate] = useState(today);
  const [text, setText] = useState("");
  const [review, setReview] = useState<JustWriteReview | null>(null);
  const [reviewedText, setReviewedText] = useState("");
  const [loading, setLoading] = useState(Boolean(entryId));
  const [busy, setBusy] = useState<"done" | "teach" | null>(null);
  const [error, setError] = useState("");
  const dirty = text !== (entry?.text ?? "") || Boolean(entry && date !== entry.date);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!entryId) return;
    const controller = new AbortController();
    listJustWrite(session, controller.signal).then(({ entries }) => {
      const match = entries.find((item) => item.id === entryId);
      if (!match) throw new Error("这条记录不存在或已删除");
      setEntry(match);
      setDate(match.date);
      setText(match.text);
      setReview(match.review ?? null);
      setReviewedText(match.review ? match.text : "");
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "读取失败");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [entryId, session]);

  async function done(): Promise<void> {
    if (!text.trim() || busy) return;
    setBusy("done"); setError("");
    try {
      await saveJustWrite(session, { id: entry?.id, date, text, review: reviewedText === text ? review : null });
      navigate(base);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "保存失败");
    } finally {
      setBusy(null);
    }
  }

  async function teach(): Promise<void> {
    if (!text.trim() || busy) return;
    setBusy("teach"); setError("");
    try {
      const snapshot = text;
      const result = await teachJustWrite(session, snapshot);
      setReview(result.review);
      setReviewedText(snapshot);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "AI 建议获取失败，请稍后重试");
    } finally {
      setBusy(null);
    }
  }

  return <Frame>
    <Link className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-emerald-200" onClick={(event) => { if (dirty && !window.confirm("当前内容尚未保存，确定离开吗？")) event.preventDefault(); }} to={base}><ArrowLeft className="size-4" />返回 Just Write</Link>
    <header className="mt-10"><div className="flex items-center gap-2 font-mono text-xs tracking-[0.18em] text-emerald-300"><PenLine className="size-4" />JUST WRITE</div><h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">How today went</h1><p className="mt-3 text-sm leading-7 text-slate-400">不用写得完美，先把想说的话写下来。</p></header>
    {loading ? <p className="mt-10 flex items-center gap-2 text-sm text-slate-400"><LoaderCircle className="size-4 animate-spin" />正在读取…</p> : (!entryId || entry) && <div className="mt-8">
      <label className="block text-xs text-slate-400" htmlFor="just-write-date">日期</label>
      <input className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-100 [color-scheme:dark]" id="just-write-date" max="9999-12-31" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
      <label className="mt-6 block text-xs text-slate-400" htmlFor="just-write-text">今天想写什么？</label>
      <textarea autoFocus className="mt-2 min-h-[45svh] w-full resize-y rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-base leading-8 text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-300/40" id="just-write-text" maxLength={8000} onChange={(event) => { setText(event.target.value); setReview(null); setReviewedText(""); }} placeholder="Today, I..." value={text} />
      <p className="mt-2 text-right text-xs text-slate-600">{text.length} / 8000</p>
      {review && reviewedText === text && <section aria-label="AI 写作建议" className="mt-8 space-y-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.045] p-5 sm:p-7">
        <div><h2 className="flex items-center gap-2 text-lg font-medium text-emerald-200"><Sparkles className="size-5" />Teach me</h2><p className="mt-2 text-xs text-slate-400">这些只是建议，原文仍由你决定。</p></div>
        {review.improvements.length > 0 ? <div><h3 className="text-sm font-medium text-white">可以这样说</h3><div className="mt-3 space-y-4">{review.improvements.map((item, index) => <div className="rounded-xl bg-black/20 p-4 text-sm leading-7" key={index}><p className="break-words text-slate-500 line-through">{item.original}</p><p className="break-words text-emerald-200">{item.suggestion}</p><p className="mt-1 break-words text-slate-400">{item.reason}</p></div>)}</div></div> : <p className="text-sm text-slate-300">这段表达已经很自然，可以保持原样。</p>}
        <div><h3 className="text-sm font-medium text-white">轻微润色</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">{review.lightRevision}</p></div>
        <div><h3 className="text-sm font-medium text-white">值得带走的表达</h3><div className="mt-3 space-y-3">{review.expressions.map((item, index) => <div className="rounded-xl bg-black/20 p-4 text-sm leading-7" key={index}><p className="font-medium text-emerald-200">{item.phrase}</p><p className="text-slate-300">{item.meaning}</p><p className="break-words text-slate-500">{item.example}</p></div>)}</div></div>
      </section>}
      <div className="sticky bottom-0 -mx-5 mt-8 flex flex-wrap justify-end gap-3 border-t border-white/10 bg-[#070a12]/95 px-5 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        <button className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/25 px-5 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-300/10 disabled:opacity-40" disabled={!text.trim() || Boolean(busy)} onClick={() => void teach()} type="button">{busy === "teach" ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}teach me</button>
        <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:opacity-40" disabled={!text.trim() || !date || Boolean(busy)} onClick={() => void done()} type="button">{busy === "done" && <LoaderCircle className="size-4 animate-spin" />}done</button>
      </div>
    </div>}
    {error && <p className="mt-5 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-200" role="alert">{error}</p>}
  </Frame>;
}
