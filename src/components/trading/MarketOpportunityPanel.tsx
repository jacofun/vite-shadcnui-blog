import { Activity, ArrowDownRight, ArrowUpRight, Clock3, LoaderCircle, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";
import type { PrivateAuthSession } from "@/lib/privateAuth";
import { analyzeMarketOpportunity, type MarketSignalResult, type SignalStatus, type SignalStyle } from "@/lib/marketSignal";
import { formatPrice } from "@/lib/trading";

const statusText: Record<SignalStatus, string> = { candidate: "候选机会 · 待确认触发条件", watch: "继续观察", none: "暂无机会", expired: "结果已过期 · 请重新分析" };
const inputClass = "min-w-0 rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-300/60 disabled:opacity-60";
const time = (value: number) => new Date(value).toLocaleTimeString("zh-CN", { hour12: false });

function Reasons({ title, items }: { title: string; items: string[] }): JSX.Element | null {
  if (!items.length) return null;
  return <div className="min-w-0"><h4 className="text-sm font-medium text-slate-200">{title}</h4>
    <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-7 text-slate-400">{items.map((item, i) => <li key={i} className="break-words">{item}</li>)}</ul>
  </div>;
}

export default function MarketOpportunityPanel({ session, onClose }: { session: PrivateAuthSession; onClose: () => void }): JSX.Element {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [style, setStyle] = useState<SignalStyle>("trend");
  const [busy, setBusy] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<MarketSignalResult | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, [session]);
  useEffect(() => {
    if (!busy && !result) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [busy, result]);
  async function analyze() {
    if (request.current) return;
    const value = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,24}USDT$/.test(value)) { setError("请输入 USDT 合约交易对，例如 BTCUSDT。"); return; }
    const controller = new AbortController();
    request.current = controller;
    setSymbol(value); setError(""); setMessage(""); setResult(null); setBusy(true); setStartedAt(Date.now()); setNow(Date.now());
    try {
      const next = await analyzeMarketOpportunity(session, { symbol: value, style }, controller.signal);
      if (!controller.signal.aborted) { setResult(next); setNow(Date.now()); }
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
  const status = result && (result.status === "expired" || now >= result.timing.validUntil) ? "expired" : result?.status;
  const opportunity = result?.opportunity;
  return <section id="market-opportunity" aria-labelledby="market-opportunity-heading" aria-busy={busy}
    className="mt-7 rounded-2xl border border-violet-300/20 bg-gradient-to-br from-violet-400/[0.08] to-slate-950 p-5 sm:p-7">
    <div className="flex items-start justify-between gap-4">
      <div><h2 id="market-opportunity-heading" className="flex items-center gap-2 text-xl font-semibold text-violet-100"><Sparkles className="size-5 text-violet-300" />分析交易机会</h2>
        <p className="mt-2 text-sm leading-7 text-slate-400">综合 1 小时、4 小时与日线行情，给出候选价位、触发条件及反对理由。</p></div>
      <button type="button" onClick={onClose} aria-label="关闭交易机会分析" className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"><X className="size-4" /></button>
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
    {result && opportunity && status && <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span role="status" className={`rounded-full border px-3 py-1.5 text-xs ${status === "expired" ? "border-amber-300/25 bg-amber-300/10 text-amber-200" : "border-violet-300/25 bg-violet-300/10 text-violet-200"}`}>{statusText[status]}</span>
        <p className="text-xs text-slate-500">{result.symbol} · {time(result.timing.completedAt)} 完成 · 耗时 {(result.timing.totalMs / 1000).toFixed(1)} 秒</p>
      </div>
      <div><h3 className="text-lg font-semibold text-white">{opportunity.title}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">{opportunity.summary}</p></div>
      {status === "expired" && <p className="rounded-xl bg-amber-300/5 p-3 text-sm leading-7 text-amber-200">下列价位是本次分析的历史结果，请重新分析后再判断。{opportunity.expiredReasons.join(" ")}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "方向", value: opportunity.direction === "long" ? "做多" : opportunity.direction === "short" ? "做空" : "观望" },
          { label: "候选入场区间", value: opportunity.entry ? `${formatPrice(opportunity.entry.min)} – ${formatPrice(opportunity.entry.max)}` : "—" },
          { label: "止损参考", value: opportunity.stopLoss === null ? "—" : formatPrice(opportunity.stopLoss) },
          { label: "分析后标记价格", value: formatPrice(result.market.latestQuote.price) },
        ].map(item => <div key={item.label} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.025] p-4"><p className="text-xs text-slate-500">{item.label}</p><p className="mt-2 break-words text-base font-semibold tabular-nums text-slate-200">{item.value}</p></div>)}
      </div>
      {opportunity.targets.length > 0 && <div><h4 className="text-sm font-medium text-slate-200">目标价位</h4><div className="mt-3 grid gap-3 sm:grid-cols-3">
        {opportunity.targets.map((target, i) => <div key={i} className="rounded-xl border border-white/10 p-4"><p className="text-sm text-violet-200">目标 {i + 1} · {formatPrice(target.price)}</p><p className="mt-2 text-xs text-slate-400">盈亏比 {opportunity.rewardRisk[i]?.ratio?.toFixed(2) ?? "—"} : 1</p><p className="mt-2 break-words text-xs leading-6 text-slate-500">{target.reason}</p></div>)}
      </div><p className="mt-2 text-xs leading-6 text-slate-500">盈亏比按入场区间不利端计算，未计手续费、滑点及资金费。</p></div>}
      <div className="grid gap-5 sm:grid-cols-2"><Reasons title="触发条件 · 尚未自动确认" items={opportunity.triggerConditions} /><Reasons title="失效条件" items={opportunity.invalidationConditions} /></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div><h4 className="flex items-center gap-1.5 text-sm font-medium text-emerald-200"><ArrowUpRight className="size-4" />支持证据</h4><ul className="mt-2 space-y-2">{opportunity.evidence.map((item, i) => <li key={i} className="break-words text-sm leading-7 text-slate-400"><span className="mr-2 font-mono text-xs text-slate-500">{item.metric}</span>{item.reason}</li>)}</ul></div>
        <div><h4 className="flex items-center gap-1.5 text-sm font-medium text-amber-200"><ArrowDownRight className="size-4" />反对理由</h4><ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-7 text-slate-400">{opportunity.counterarguments.map((item, i) => <li key={i} className="break-words">{item}</li>)}</ul></div>
      </div>
      <Reasons title="行情提示" items={result.market.warnings} />
      <details className="rounded-xl border border-white/10 p-4 text-xs text-slate-500"><summary className="cursor-pointer text-slate-400">调用详情 · {result.model.name}</summary>
        <dl className="mt-3 grid gap-2 break-all leading-6 sm:grid-cols-2"><div><dt>请求编号</dt><dd>{result.requestId}</dd></div><div><dt>分析编号</dt><dd>{result.analysisId}</dd></div><div><dt>各阶段耗时</dt><dd>行情 {result.timing.marketMs} ms / 模型 {result.timing.modelMs} ms / 核价 {result.timing.verificationMs} ms</dd></div><div><dt>代码版本</dt><dd>{result.codeVersion}</dd></div></dl>
      </details>
    </div>}
  </section>;
}
