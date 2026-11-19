import { Activity, Clock3, History, LoaderCircle, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";
import type { PrivateAuthSession } from "@/lib/privateAuth";
import { analyzeMarketOpportunity, type MarketSignalResult, type SignalStyle } from "@/lib/marketSignal";
import { saveMarketSignal } from "@/lib/marketSignalHistory";
import MarketOpportunityResult from "./market-opportunity-result";
import MarketSignalHistory from "./market-signal-history";
import MarketSignalOrders from "./market-signal-orders";
import MarketDemoOrder from "./market-demo-order";

const inputClass = "min-w-0 rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-300/60 disabled:opacity-60";
export default function MarketOpportunityPanel({ session, onClose }: { session: PrivateAuthSession; onClose: () => void }): JSX.Element {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [style, setStyle] = useState<SignalStyle>("trend");
  const [busy, setBusy] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<MarketSignalResult | null>(null);
  const [archiveState, setArchiveState] = useState<"saving" | "saved" | "failed" | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const archiveId = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, [session]);
  useEffect(() => {
    if (!busy && !result) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [busy, result]);
  async function archive(next: MarketSignalResult) {
    archiveId.current = next.analysisId;
    setArchiveState("saving");
    try {
      await saveMarketSignal(session, next);
      if (archiveId.current === next.analysisId) setArchiveState("saved");
      setHistoryRevision(value => value + 1);
    } catch {
      if (archiveId.current === next.analysisId) setArchiveState("failed");
    }
  }
  async function analyze() {
    if (request.current) return;
    const value = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,24}USDT$/.test(value)) { setError("请输入 USDT 合约交易对，例如 BTCUSDT。"); return; }
    const controller = new AbortController();
    request.current = controller;
    archiveId.current = null;
    setArchiveState(null);
    setSymbol(value); setError(""); setMessage(""); setResult(null); setBusy(true); setStartedAt(Date.now()); setNow(Date.now());
    try {
      const next = await analyzeMarketOpportunity(session, { symbol: value, style }, controller.signal);
      if (!controller.signal.aborted) {
        setResult(next);
        setNow(Date.now());
        if (next.market.chart) void archive(next);
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "分析失败，请查看函数日志。");
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }
  function cancel() {
    const controller = request.current;
    request.current = null; controller?.abort(); setBusy(false); setMessage("已取消等待，可重新发起分析。");
  }
  const status = result && (result.status === "expired" || result.opportunity.direction !== null && now >= result.timing.validUntil) ? "expired" : result?.status;
  return <section id="market-opportunity" aria-labelledby="market-opportunity-heading" aria-busy={busy}
    className="mt-7 rounded-2xl border border-violet-300/20 bg-gradient-to-br from-violet-400/[0.08] to-slate-950 p-5 sm:p-7">
    <div className="flex items-start justify-between gap-4">
      <div><h2 id="market-opportunity-heading" className="flex items-center gap-2 text-xl font-semibold text-violet-100"><Sparkles className="size-5 text-violet-300" />分析交易机会</h2>
        <p className="mt-2 text-sm leading-7 text-slate-400">结合 4 小时、1 小时和 15 分钟的量价走势，给出候选价位、触发条件及反对理由。</p></div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" aria-expanded={showHistory} aria-controls={showHistory ? "market-signal-history" : undefined}
          onClick={() => setShowHistory(value => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2 py-2 text-xs text-slate-300 hover:bg-white/5 sm:px-3">
          <History className="size-4" />分析历史
        </button>
        <button type="button" onClick={onClose} aria-label="关闭交易机会分析" className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"><X className="size-4" /></button>
      </div>
    </div>
    <form className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={event => { event.preventDefault(); void analyze(); }}>
      <label className="flex min-w-0 flex-1 flex-col gap-2 text-xs text-slate-400">合约交易对
        <input aria-label="分析合约交易对" className={inputClass} value={symbol} maxLength={28} disabled={busy} autoCapitalize="characters" spellCheck={false} onChange={event => setSymbol(event.target.value)} />
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-2 text-xs text-slate-400">分析风格
        <select aria-label="分析风格" className={inputClass} value={style} disabled={busy} onChange={event => setStyle(event.target.value as SignalStyle)}>
          <option value="trend">顺势交易</option><option value="reversal">反转交易</option><option value="neutral">综合判断</option>
        </select>
      </label>
      <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-violet-200 disabled:cursor-wait disabled:opacity-60">
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Activity className="size-4" />}{busy ? "正在分析…" : "开始分析"}
      </button>
      {busy && <button type="button" onClick={cancel} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5">取消等待</button>}
    </form>
    <p className="mt-3 text-xs leading-6 text-slate-500">仅分析服务端允许的交易对。结果供人工研判，触发条件须自行确认；不会自动下单。</p>
    {busy && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-violet-200"><Clock3 className="size-4" />正在获取行情并调用模型，已等待 {Math.max(0, Math.floor((now - startedAt) / 1000))} 秒，请保持页面打开。</p>}
    {message && <p role="status" className="mt-4 text-sm text-slate-400">{message}</p>}
    {error && <p role="alert" className="mt-4 break-words rounded-xl border border-rose-400/25 bg-rose-400/[0.06] p-4 text-sm leading-7 text-rose-200">{error}</p>}
    {result && status && <>
      {!result.market.chart && <p role="status" className="mt-4 text-xs text-slate-400">当前信号接口未提供图表数据，本次结果未归档。</p>}
      {archiveState === "saving" && <p role="status" className="mt-4 text-xs text-slate-400">正在保存本次分析…</p>}
      {archiveState === "saved" && <p role="status" className="mt-4 text-xs text-emerald-300">已保存到分析历史</p>}
      {archiveState === "failed" && <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 text-sm text-amber-200">
        <span>本次分析尚未保存。</span><button type="button" className="rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/5" onClick={() => void archive(result)}>重试保存</button>
      </div>}
      <MarketOpportunityResult result={result} status={status} />
    </>}
    {session.user.role === "owner" && <>
      <MarketSignalOrders key={session.user.id} session={session} now={now}
        analysisId={result?.analysisId} permit={result?.orderPermit} validUntil={result?.timing.validUntil} />
      <MarketDemoOrder key={`demo-${session.user.id}`} session={session} />
    </>}
    {showHistory && <MarketSignalHistory session={session} revision={historyRevision} />}
  </section>;
}
