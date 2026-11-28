import { useRef, useState } from "react";
import { exportMarketScans, maxScanExportRange, maxSelectedScans, parseBeijingScanTime, type ScanExportRequest } from "@/lib/marketScanner";
import type { PrivateAuthSession } from "@/lib/privateAuth";

const button = "rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 hover:bg-white/5 disabled:opacity-50";
const field = "w-full min-w-0 rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-slate-200 [color-scheme:dark]";
type ExportResult = Awaited<ReturnType<typeof exportMarketScans>>;

export default function MarketScanExport({ session, selected, clear }: { session: PrivateAuthSession; selected: string[]; clear: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ExportResult | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const linkField = useRef<HTMLInputElement>(null);

  async function exportScans(input: ScanExportRequest) {
    setBusy(true);
    setError("");
    setResult(null);
    setCopyStatus("");
    try {
      setResult(await exportMarketScans(session, input, AbortSignal.timeout(60_000)));
    } catch (error) {
      setError(error instanceof DOMException && error.name === "TimeoutError" ? "导出超时，请缩短时间区间后重试。" :
        error instanceof Error ? error.message : "无法生成分析清单。");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("已复制链接。");
    } catch {
      linkField.current?.focus();
      linkField.current?.select();
      setCopyStatus("链接已选中，可手动复制。");
    }
  }

  return <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p aria-live="polite" className="mr-auto text-sm text-slate-300">已选 {selected.length} / {maxSelectedScans} 条 · 翻页保留</p>
      <button type="button" className={button} disabled={!selected.length || busy}
        onClick={() => void exportScans({ analysisIds: selected })}>导出勾选项</button>
      {!!selected.length && <button type="button" className={button} disabled={busy} onClick={clear}>清空选择</button>}
    </div>
    <details className="border-t border-white/10 pt-3 text-sm text-slate-300">
      <summary className="cursor-pointer text-cyan-200">按时间区间导出</summary>
      <form className="mt-3 space-y-3" onSubmit={event => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const from = parseBeijingScanTime(String(values.get("from") ?? ""));
        const to = parseBeijingScanTime(String(values.get("to") ?? ""));
        if (!Number.isFinite(from) || !Number.isFinite(to) || from > to || to > Date.now() || to - from > maxScanExportRange) {
          setError("请选择起止时间，结束时间不晚于现在，区间不超过 7 天。");
          return;
        }
        void exportScans({ from, to });
      }}>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="min-w-0 space-y-1 text-xs">开始时间（北京时间）
            <input className={field} type="datetime-local" name="from" required />
          </label>
          <label className="min-w-0 space-y-1 text-xs">结束时间（北京时间）
            <input className={field} type="datetime-local" name="to" required />
          </label>
        </div>
        <p className="text-xs leading-5 text-slate-400">按 K 线收盘时间选取区间内的决策记录，含 M1 未触发，单次最多 7 天。</p>
        <button type="submit" className={button} disabled={busy}>导出该区间</button>
      </form>
    </details>
    {busy && <p role="status" className="text-sm text-slate-300">正在生成分析清单…</p>}
    {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
    {result && <div className="space-y-2 border-t border-white/10 pt-3">
      <p role="status" className="text-sm text-emerald-200">已导出 {result.count} 条
        {result.skippedCount > 0 && `，另有 ${result.skippedCount} 条无可用决策日志`}。</p>
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <input ref={linkField} className={field} aria-label="分析清单链接" readOnly value={result.url} />
        <button type="button" className={`${button} shrink-0`} onClick={() => void copyLink(result.url)}>复制链接</button>
        <a className={`${button} shrink-0`} href={result.url} target="_blank" rel="noreferrer">打开清单</a>
      </div>
      {copyStatus && <p role="status" className="text-xs text-slate-300">{copyStatus}</p>}
    </div>}
  </div>;
}
