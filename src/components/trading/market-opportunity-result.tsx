import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { lazy, Suspense, type JSX } from "react";
import type { MarketSignalResult, SignalStatus } from "@/lib/marketSignal";
import { formatPrice } from "@/lib/trading";
import { formatSignalDate, statusText } from "@/lib/marketSignalHistory";

const MarketSignalChart = lazy(() => import("./market-signal-chart"));

function Reasons({ title, items }: { title: string; items: string[] }): JSX.Element | null {
  if (!items.length) return null;
  return <div className="min-w-0"><h4 className="text-sm font-medium text-slate-200">{title}</h4>
    <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-7 text-slate-400">{items.map((item, i) => <li key={i} className="break-words">{item}</li>)}</ul>
  </div>;
}

export default function MarketOpportunityResult({ result, status, archived = false }: { result: MarketSignalResult; status: SignalStatus; archived?: boolean }): JSX.Element {
  const { opportunity } = result;
  return <div className="mt-6 space-y-5 border-t border-white/10 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span role="status" className={`rounded-full border px-3 py-1.5 text-xs ${status === "expired" ? "border-amber-300/25 bg-amber-300/10 text-amber-200" : "border-violet-300/25 bg-violet-300/10 text-violet-200"}`}>{archived ? `当时状态 · ${statusText[status]}` : statusText[status]}</span>
        <p className="text-xs text-slate-500">{result.symbol} · {formatSignalDate(result.timing.completedAt)} 完成 · 耗时 {(result.timing.totalMs / 1000).toFixed(1)} 秒</p>
      </div>
      <div><h3 className="text-lg font-semibold text-white">{opportunity.title}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">{opportunity.summary}</p></div>
      {archived && <p className="text-xs text-slate-400">原结果有效至 {formatSignalDate(result.timing.validUntil)}</p>}
      {!archived && status === "expired" && <p className="rounded-xl bg-amber-300/5 p-3 text-sm leading-7 text-amber-200">下列价位是本次分析的历史结果，请重新分析后再判断。{opportunity.expiredReasons.join(" ")}</p>}
      {result.market.chart && <Suspense fallback={<p role="status" className="rounded-xl border border-white/10 p-4 text-sm text-slate-400">正在加载行情图…</p>}>
        <MarketSignalChart key={result.analysisId} result={result} />
      </Suspense>}
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
      {archived && <Reasons title="分析时已过期的原因" items={opportunity.expiredReasons} />}
      <details className="rounded-xl border border-white/10 p-4 text-xs text-slate-500"><summary className="cursor-pointer text-slate-400">调用详情 · {result.model.name}</summary>
        <dl className="mt-3 grid gap-2 break-all leading-6 sm:grid-cols-2"><div><dt>请求编号</dt><dd>{result.requestId}</dd></div><div><dt>分析编号</dt><dd>{result.analysisId}</dd></div><div><dt>各阶段耗时</dt><dd>行情 {result.timing.marketMs} ms / 模型 {result.timing.modelMs} ms / 核价 {result.timing.verificationMs} ms</dd></div><div><dt>代码版本</dt><dd>{result.codeVersion}</dd></div>{result.model.promptVersion && <div><dt>提示词版本</dt><dd>{result.model.promptVersion}</dd></div>}</dl>
      </details>
  </div>;
}
