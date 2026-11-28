import { useEffect, useRef, useState } from "react";
import { describeMarketSignalReadError, formatSignalDate, getMarketSignal, listMarketSignals, statusText, type SavedSignalSummary } from "@/lib/marketSignalHistory";
import type { PrivateAuthSession } from "@/lib/privateAuth";
import MarketResearchReview from "./market-research-review";
import MarketOpportunityResult from "./market-opportunity-result";
import MarketScanExecution from "./market-scan-execution";

const actionClass = "rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-60";

export function MarketSignalArchiveDetail({ session, analysisId, scanId }: { session: PrivateAuthSession; analysisId: string; scanId?: string }) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getMarketSignal>> | null>(null);
  const [detailError, setDetailError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    const controller = new AbortController();
    void getMarketSignal(session, analysisId, AbortSignal.any([controller.signal, AbortSignal.timeout(32_000)]), scanId)
      .then(result => { if (!controller.signal.aborted) setDetail(result); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setDetailError(describeMarketSignalReadError(error)); });
    return () => controller.abort();
  }, [session, analysisId, scanId, attempt]);
  return <>
    <h3 ref={heading} tabIndex={-1} className="scroll-mt-24 text-base font-semibold text-white">分析记录详情</h3>
    {!detail && !detailError && <p role="status" className="text-sm text-slate-400">正在读取分析详情…</p>}
    {detailError && <div role="alert" className="flex flex-wrap items-center gap-2 break-words text-sm text-amber-200">
      <span>{detailError}</span>
      <button type="button" className={actionClass} onClick={() => { setDetailError(""); setAttempt(value => value + 1); }}>重新读取</button>
    </div>}
    {detail && <>
      {scanId && detail.result.schemaVersion === 4 && detail.result.decisionSource === "deterministic" &&
        (detail.result.status === "candidate" || detail.result.status === "watch" &&
          detail.result.decision?.reasons.some(reason => reason.code === "quote_outside_entry")) &&
        <MarketScanExecution key={analysisId} session={session} analysisId={analysisId} scanId={scanId} />}
      <MarketOpportunityResult result={detail.result} status={detail.result.status} archived />
      {detail.reviewUnavailable && <p className="text-sm text-slate-400">分析已载入。复盘数据暂时无法读取。</p>}
      {detail.result.schemaVersion === 4 && detail.reviews &&
        <MarketResearchReview reviews={detail.reviews} preferred={detail.result.research.researchHorizon} />}
    </>}
  </>;
}

export default function MarketSignalHistory({ session, revision }: { session: PrivateAuthSession; revision: number }) {
  const [entries, setEntries] = useState<SavedSignalSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [listBusy, setListBusy] = useState(true);
  const [selection, setSelection] = useState<{ id: string; revision: number }>();
  const detailId = selection?.id;
  const [listError, setListError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const listRequest = useRef<AbortController | null>(null);

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

  return <section id="market-signal-history" aria-label="分析历史"
    className={detailId ? "grid gap-5 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]" : "space-y-2"}>
    <div className={detailId ? "min-w-0 space-y-2 lg:border-r lg:border-white/10 lg:pr-4" : "space-y-2"}>
      <h3 className="text-base font-semibold text-white">分析历史</h3>
      {listBusy && <p role="status" className="text-sm text-slate-400">正在加载记录…</p>}
      {listError && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-amber-200">
        {listError}<button type="button" className={actionClass} onClick={() => setRefresh(value => value + 1)}>重新加载</button>
      </div>}
      {!listBusy && !entries.length && !listError && <p className="text-sm text-slate-400">暂无已保存的分析。</p>}
      <ul className="divide-y divide-white/10">
        {entries.map(entry => <li key={entry.analysisId}>
          <button type="button" onClick={() => setSelection(previous => ({ id: entry.analysisId, revision: (previous?.revision ?? 0) + 1 }))} aria-pressed={detailId === entry.analysisId}
            className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md px-2 py-2.5 text-left text-sm hover:bg-white/5 aria-pressed:bg-violet-300/10">
            <span className="min-w-0 break-words text-slate-100">{entry.symbol} · {entry.title}</span>
            <span className="text-xs text-slate-400">{formatSignalDate(entry.completedAt)} · {statusText[entry.status]}{entry.schemaVersion === 4 ? ` · ${entry.direction === "long" ? "做多" : entry.direction === "short" ? "做空" : "观望"}` : ""}{entry.source === "auto_scan" ? " · 自动扫描" : ""}</span>
            {entry.reviews && <span className="flex w-full flex-wrap gap-x-3 text-xs text-slate-400">
              {entry.reviews.map(review => <span key={review.hours}>{review.hours}h · {review.status === "pending" ? "待评估" : review.status === "insufficient" ? "数据不足" :
                review.targets.length ? `触达 ${review.targets.filter(target => target.touched).length}/${review.targets.length}` : "已评估"}</span>)}
            </span>}
          </button>
        </li>)}
      </ul>
      {cursor && <button type="button" disabled={listBusy} onClick={() => void loadMore()} className={actionClass}>加载更多</button>}
    </div>
    {detailId && <div className="order-first min-w-0 space-y-4 lg:order-none">
      <MarketSignalArchiveDetail key={selection.revision} analysisId={detailId} session={session} />
    </div>}
  </section>;
}
