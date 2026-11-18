import { useEffect, useRef, useState } from "react";
import type { MarketSignalResult } from "@/lib/marketSignal";
import { formatSignalDate, getMarketSignal, listMarketSignals, statusText, type SavedSignalSummary } from "@/lib/marketSignalHistory";
import type { PrivateAuthSession } from "@/lib/privateAuth";
import MarketOpportunityResult from "./market-opportunity-result";

const actionClass = "rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-60";

export default function MarketSignalHistory({ session, revision }: { session: PrivateAuthSession; revision: number }) {
  const [entries, setEntries] = useState<SavedSignalSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [listBusy, setListBusy] = useState(true);
  const [detail, setDetail] = useState<MarketSignalResult | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [listError, setListError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const listRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    setListBusy(true);
    setListError("");
    void listMarketSignals(session, undefined, AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]))
      .then(page => { if (!controller.signal.aborted) { setEntries(page.entries); setCursor(page.nextCursor); } })
      .catch(() => { if (!controller.signal.aborted) setListError("加载分析历史失败。"); })
      .finally(() => { if (!controller.signal.aborted) setListBusy(false); });
    return () => { listRequest.current?.abort(); };
  }, [session, revision, refresh]);

  useEffect(() => () => { detailRequest.current?.abort(); }, [session]);

  async function loadMore() {
    if (!cursor || listBusy) return;
    const controller = new AbortController();
    listRequest.current = controller;
    setListBusy(true);
    setListError("");
    try {
      const page = await listMarketSignals(session, cursor, AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]));
      if (!controller.signal.aborted) {
        setEntries(previous => [...previous, ...page.entries.filter(item => !previous.some(existing => existing.analysisId === item.analysisId))]);
        setCursor(page.nextCursor);
      }
    } catch {
      if (!controller.signal.aborted) setListError("加载更多记录失败。");
    } finally {
      if (!controller.signal.aborted) setListBusy(false);
    }
  }

  async function open(analysisId: string) {
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    setDetail(null);
    setDetailError("");
    setDetailId(analysisId);
    try {
      const result = await getMarketSignal(session, analysisId, AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]));
      if (!controller.signal.aborted) setDetail(result);
    } catch {
      if (!controller.signal.aborted) setDetailError("读取这条分析记录失败。");
    }
  }

  return <section id="market-signal-history" aria-label="分析历史" className="mt-6 space-y-3 border-t border-white/10 pt-5">
    <h3 className="text-base font-medium text-slate-100">分析历史</h3>
    {listBusy && <p role="status" className="text-sm text-slate-400">正在加载记录…</p>}
    {listError && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-amber-200">
      {listError}<button type="button" className={actionClass} onClick={() => setRefresh(value => value + 1)}>重新加载</button>
    </div>}
    {!listBusy && !entries.length && !listError && <p className="text-sm text-slate-400">暂无已保存的分析。</p>}
    <ul className="space-y-2">
      {entries.map(entry => <li key={entry.analysisId}>
        <button type="button" onClick={() => void open(entry.analysisId)} aria-pressed={detailId === entry.analysisId}
          className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-3 text-left text-sm hover:bg-white/5 aria-pressed:border-violet-300/35">
          <span className="min-w-0 break-words text-slate-100">{entry.symbol} · {entry.title}</span>
          <span className="text-xs text-slate-400">{formatSignalDate(entry.completedAt)} · {statusText[entry.status]}</span>
        </button>
      </li>)}
    </ul>
    {cursor && <button type="button" disabled={listBusy} onClick={() => void loadMore()} className={actionClass}>加载更多</button>}
    {detailId && !detail && !detailError && <p role="status" className="text-sm text-slate-400">正在读取分析详情…</p>}
    {detailError && <p role="alert" className="text-sm text-amber-200">{detailError}</p>}
    {detail && <MarketOpportunityResult result={detail} status={detail.status} archived />}
  </section>;
}
