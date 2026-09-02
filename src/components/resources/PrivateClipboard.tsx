import { Check, Clipboard, Copy, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent, type JSX } from "react";

import {
  deletePrivateClipboardEntry,
  getPrivateClipboard,
  savePrivateClipboardText,
  type PrivateAuthSession,
  type PrivateClipboardEntry,
} from "@/lib/privateAuth";

export default function PrivateClipboard({
  canWrite,
  session,
}: {
  canWrite: boolean;
  session: PrivateAuthSession;
}): JSX.Element {
  const [entries, setEntries] = useState<PrivateClipboardEntry[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getPrivateClipboard(session, controller.signal)
      .then((clipboard) => setEntries(clipboard.entries))
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "剪贴板读取失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [session]);

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await savePrivateClipboardText(session, text.trim());
      setEntries((current) => [result.entry, ...current]);
      setText("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "文本保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function copy(entry: PrivateClipboardEntry): Promise<void> {
    try {
      await navigator.clipboard.writeText(entry.text);
      setCopiedId(entry.id);
      window.setTimeout(() => setCopiedId((current) => current === entry.id ? null : current), 1500);
    } catch {
      setError("浏览器未允许写入系统剪贴板");
    }
  }

  async function remove(entry: PrivateClipboardEntry): Promise<void> {
    if (!window.confirm("确定删除这条剪贴板文本吗？")) return;
    setError(null);
    try {
      await deletePrivateClipboardEntry(session, entry.id);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "文本删除失败");
    }
  }

  return (
    <section className="mt-12" aria-labelledby="private-clipboard-title">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.08]"><Clipboard className="size-5 text-cyan-300" /></span>
        <div><p className="font-mono text-[11px] tracking-[0.16em] text-cyan-300">PRIVATE CLIPBOARD</p><h2 className="mt-1 text-xl font-semibold text-white" id="private-clipboard-title">文本剪贴板</h2></div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">文本保存在私人 OSS，可在已授权设备之间复制使用。</p>

      {canWrite && <form className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4" onSubmit={save}>
        <textarea className="min-h-28 w-full resize-y bg-transparent text-sm leading-7 text-slate-200 outline-none placeholder:text-slate-600" maxLength={20000} onChange={(event) => setText(event.target.value)} placeholder="输入需要跨设备使用的文本…" value={text} />
        <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3"><span className="text-xs text-slate-600">{text.length} / 20000</span><button className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3.5 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50" disabled={!text.trim() || saving} type="submit">{saving ? <RefreshCw className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}保存文本</button></div>
      </form>}

      {error && <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-4 text-sm text-rose-100">{error}</div>}
      {loading && <div className="mt-5 flex items-center gap-2 text-sm text-slate-500"><RefreshCw className="size-4 animate-spin text-cyan-300" />正在读取剪贴板…</div>}
      {!loading && entries.length === 0 && <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-sm text-slate-500">剪贴板中还没有文本。</div>}
      {entries.length > 0 && <div className="mt-5 grid min-w-0 gap-3">
        {entries.map((entry) => <article className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4" key={entry.id}>
          <p className="max-h-36 overflow-auto whitespace-pre-wrap break-all text-sm leading-7 text-slate-300">{entry.text}</p>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3"><time className="truncate text-xs text-slate-600">{new Date(entry.createdAt).toLocaleString()}</time><div className="flex shrink-0 items-center gap-2"><button aria-label="复制文本" className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:text-cyan-300" onClick={() => void copy(entry)} type="button">{copiedId === entry.id ? <Check className="size-4" /> : <Copy className="size-4" />}</button>{canWrite && <button aria-label="删除文本" className="rounded-lg border border-rose-300/15 p-2 text-slate-500 transition hover:bg-rose-300/[0.08] hover:text-rose-300" onClick={() => void remove(entry)} type="button"><Trash2 className="size-4" /></button>}</div></div>
        </article>)}
      </div>}
    </section>
  );
}
