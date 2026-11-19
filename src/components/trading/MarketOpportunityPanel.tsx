import { Activity, ChartCandlestick, Clock3, FlaskConical, History, ListChecks, LoaderCircle, Sparkles, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type JSX, type KeyboardEvent } from "react";
import type { PrivateAuthSession } from "@/lib/privateAuth";
import { analyzeMarketOpportunity, type MarketSignalResult, type SignalStyle } from "@/lib/marketSignal";
import { isOrderPermit } from "@/lib/marketSignalOrders";
import { saveMarketSignal } from "@/lib/marketSignalHistory";
import MarketOpportunityResult from "./market-opportunity-result";
import MarketSignalHistory from "./market-signal-history";
import MarketSignalOrders from "./market-signal-orders";
import MarketDemoOrder from "./market-demo-order";

const tabs = [
  { id: "analysis", label: "分析与下单", icon: Activity },
  { id: "chart", label: "行情图", icon: ChartCandlestick },
  { id: "details", label: "研究详情", icon: ListChecks },
  { id: "history", label: "分析历史", icon: History },
  { id: "demo", label: "测试网", icon: FlaskConical },
] as const;

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
  const [view, setView] = useState<typeof tabs[number]["id"]>("analysis");
  const tabGroup = useId();
  const archiveId = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const orders = useRef<HTMLDivElement>(null);
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
  const owner = session.user.role === "owner";
  const hasPlan = owner && isOrderPermit(result?.orderPermit);
  const navigation = tabs.filter(tab => tab.id !== "demo" || owner).map(tab => ({
    ...tab,
    disabled: tab.id === "chart" ? !result?.market.chart : tab.id === "details" && !result,
  }));
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const enabled = navigation.filter(tab => !tab.disabled);
    const index = enabled.findIndex(tab => tab.id === view);
    const next = event.key === "Home" ? enabled[0] : event.key === "End" ? enabled.at(-1) :
      enabled[(index + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length];
    if (next) {
      setView(next.id);
      document.getElementById(`${tabGroup}-${next.id}-tab`)?.focus();
    }
  }

  return <section id="market-opportunity" aria-labelledby="market-opportunity-heading"
    className="mt-7 rounded-2xl border border-slate-700/60 bg-slate-900/70">
    <div className="flex items-start justify-between gap-3 px-3 pb-3 pt-4 sm:px-5 sm:pt-5">
      <div className="min-w-0">
        <h2 id="market-opportunity-heading" className="flex items-center gap-2 text-base font-semibold text-white sm:text-lg">
          <Sparkles className="size-4 shrink-0 text-violet-300" aria-hidden="true" />分析交易机会
        </h2>
        <p className="ml-6 mt-1 text-xs text-slate-400">4 小时、1 小时、15 分钟行情</p>
      </div>
      <button type="button" onClick={onClose} aria-label="关闭交易机会分析"
        className="shrink-0 rounded-md p-2 text-slate-400 hover:bg-white/5 hover:text-white"><X className="size-4" /></button>
    </div>
    <div className="flex flex-wrap gap-x-1 border-b border-white/10 px-2 sm:gap-x-3 sm:px-5" role="tablist" aria-label="交易机会视图" onKeyDown={navigate}>
      {navigation.map(({ id, label, icon: Icon, disabled }) => <button key={id} id={`${tabGroup}-${id}-tab`}
        type="button" role="tab" aria-selected={view === id} aria-controls={`${tabGroup}-${id}`}
        tabIndex={view === id ? 0 : -1} disabled={disabled} onClick={() => setView(id)}
        className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-1.5 text-xs font-medium text-slate-400 hover:text-slate-100 focus-visible:outline focus-visible:outline-violet-300 aria-selected:border-violet-300 aria-selected:text-violet-100 disabled:text-slate-500 sm:px-3 sm:text-sm">
        <Icon className="hidden size-4 sm:block" aria-hidden="true" />{label}
      </button>)}
    </div>
    <div className="p-3 sm:p-5">
      <div id={`${tabGroup}-analysis`} role="tabpanel" aria-labelledby={`${tabGroup}-analysis-tab`} hidden={view !== "analysis"}>
        <div aria-busy={busy}>
          <form className="grid grid-cols-2 items-end gap-x-3 gap-y-2 sm:flex" onSubmit={event => { event.preventDefault(); void analyze(); }}>
            <label className="flex min-w-0 flex-col gap-1.5 text-xs text-slate-400 sm:w-36">合约交易对
              <input aria-label="分析合约交易对" className={inputClass} value={symbol} maxLength={28} disabled={busy}
                autoCapitalize="characters" spellCheck={false} onChange={event => setSymbol(event.target.value)} />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-xs text-slate-400 sm:w-40">分析风格
              <select aria-label="分析风格" className={inputClass} value={style} disabled={busy} onChange={event => setStyle(event.target.value as SignalStyle)}>
                <option value="trend">顺势交易</option><option value="reversal">反转交易</option><option value="neutral">综合判断</option>
              </select>
            </label>
            <button type="submit" disabled={busy} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-violet-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-violet-200 disabled:cursor-wait disabled:opacity-60 ${busy ? "" : "col-span-2"}`}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Activity className="size-4" />}{busy ? "正在分析…" : "开始分析"}
            </button>
            {busy && <button type="button" onClick={cancel} className="min-h-10 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">取消等待</button>}
          </form>
          {busy && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-violet-200"><Clock3 className="size-4" />正在获取行情并调用模型，已等待 {Math.max(0, Math.floor((now - startedAt) / 1000))} 秒。</p>}
          {message && <p role="status" className="mt-3 text-sm text-slate-400">{message}</p>}
          {error && <p role="alert" className="mt-3 break-words border-l-2 border-rose-400/55 pl-3 text-sm leading-6 text-rose-200">{error}</p>}
        </div>
        {hasPlan && <div className="mt-2 flex justify-end lg:hidden">
          <button type="button" className="rounded-md px-2 py-1.5 text-xs font-medium text-sky-200 hover:bg-white/5"
            onClick={() => orders.current?.focus()}>查看委托方案 ↓</button>
        </div>}
        <div className={`${result ? "mt-3 border-t border-white/10 pt-3" : ""} ${hasPlan ? "lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6" : ""}`}>
          {result && status && <div className="min-w-0 space-y-2">
            <MarketOpportunityResult result={result} status={status} view="summary" compact={hasPlan} />
            {!result.market.chart && <p role="status" className="text-xs text-slate-400">当前信号接口未提供图表数据，本次结果未归档。</p>}
            {archiveState === "saving" && <p role="status" className="text-xs text-slate-400">正在保存本次分析…</p>}
            {archiveState === "saved" && <p role="status" className="text-xs text-emerald-300">已保存到分析历史</p>}
            {archiveState === "failed" && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-amber-200">
              <span>本次分析尚未保存。</span><button type="button" className="rounded-md px-2 py-1 underline hover:bg-white/5" onClick={() => void archive(result)}>重试保存</button>
            </div>}
          </div>}
          {owner && <div ref={orders} tabIndex={-1} className={`min-w-0 scroll-mt-24 ${hasPlan ? "lg:border-l lg:border-white/10 lg:pl-5" : ""}`}>
            <MarketSignalOrders key={session.user.id} session={session} now={now} sideBySide={hasPlan}
              analysisId={result?.analysisId} permit={result?.orderPermit} validUntil={result?.timing.validUntil} />
          </div>}
        </div>
      </div>
      <div id={`${tabGroup}-chart`} role="tabpanel" aria-labelledby={`${tabGroup}-chart-tab`} hidden={view !== "chart"} tabIndex={0}>
        {view === "chart" && result && status && <MarketOpportunityResult result={result} status={status} view="chart" />}
      </div>
      <div id={`${tabGroup}-details`} role="tabpanel" aria-labelledby={`${tabGroup}-details-tab`} hidden={view !== "details"} tabIndex={0}>
        {view === "details" && result && status && <MarketOpportunityResult result={result} status={status} view="details" />}
      </div>
      <div id={`${tabGroup}-history`} role="tabpanel" aria-labelledby={`${tabGroup}-history-tab`} hidden={view !== "history"}>
        {view === "history" && <MarketSignalHistory session={session} revision={historyRevision} />}
      </div>
      {owner && <div id={`${tabGroup}-demo`} role="tabpanel" aria-labelledby={`${tabGroup}-demo-tab`} hidden={view !== "demo"}>
        <MarketDemoOrder key={session.user.id} session={session} />
      </div>}
    </div>
  </section>;
}
