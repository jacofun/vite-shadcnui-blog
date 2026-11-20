import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { lazy, Suspense, type JSX } from "react";
import type { MarketSignalResult, SignalStatus } from "@/lib/marketSignal";
import { formatPrice } from "@/lib/trading";
import MarketResearchDetail from "./market-research-detail";
import { researchPrice } from "@/lib/marketSignalDisplay";
import { formatSignalDate, statusText } from "@/lib/marketSignalHistory";

const MarketSignalChart = lazy(() => import("./market-signal-chart"));
const decisionStatus: Record<SignalStatus, string> = { candidate: "候选机会", watch: "继续观察", none: "暂无机会", expired: "已过期" };

function Reasons({ title, items }: { title: string; items: string[] }): JSX.Element | null {
  if (!items.length) return null;
  return <div className="min-w-0"><h4 className="text-sm font-medium text-slate-200">{title}</h4>
    <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-7 text-slate-400">{items.map((item, i) => <li key={i} className="break-words">{item}</li>)}</ul>
  </div>;
}

type Props = { result: MarketSignalResult; status: SignalStatus; archived?: boolean; compact?: boolean; view?: "summary" | "chart" | "details" | "all" };

export default function MarketOpportunityResult({ result, status, archived = false, compact = false, view = "all" }: Props): JSX.Element {
  const { opportunity } = result;
  const decision = result.schemaVersion === 4 ? result.decision : undefined;
  const summaryInReasons = decision?.reasons.some(reason => reason.message === opportunity.summary);
  const price = result.schemaVersion === 4 ? researchPrice : formatPrice;
  const direction = opportunity.direction === "long" ? "做多" : opportunity.direction === "short" ? "做空" : "观望";
  return <div className={archived ? "space-y-5 border-t border-white/10 pt-4" : "space-y-5"}>
    {(view === "all" || view === "summary") && <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span role="status" className={`rounded-md px-2 py-1 text-xs font-medium ${status === "expired" ? "bg-amber-300/10 text-amber-200" : "bg-violet-300/10 text-violet-200"}`}>{archived ? `当时状态 · ${statusText[status]}` : statusText[status]}</span>
          <span className="text-xs font-medium text-slate-400">{result.symbol}</span>
        </div>
        <p className="text-xs text-slate-400">{formatSignalDate(result.timing.completedAt)} · {(result.timing.totalMs / 1000).toFixed(1)} 秒</p>
      </div>
      <h3 className="text-lg font-semibold text-white">{opportunity.title}</h3>
      {decision && <div className="space-y-2 border-l-2 border-violet-300/40 pl-3 text-sm">
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          <div><dt className="text-xs text-slate-400">Kimi 原始结论</dt>
            <dd className="mt-0.5 font-medium text-slate-100">{decisionStatus[decision.modelStatus]}{decision.modelDirection === "long" ? " · 偏多" : decision.modelDirection === "short" ? " · 偏空" : ""}</dd></div>
          <div><dt className="text-xs text-slate-400">分析完成时的状态</dt>
            <dd className="mt-0.5 font-medium text-slate-100">{decisionStatus[result.status]}</dd></div>
        </dl>
        <Reasons title="判定原因" items={decision.reasons.map(reason => reason.message)} />
        {summaryInReasons && decision.modelSummary !== opportunity.summary &&
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer">查看模型原始摘要</summary>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{decision.modelSummary}</p>
          </details>}
      </div>}
      <dl className={`grid grid-cols-2 gap-x-4 gap-y-3 border-y border-white/10 py-3 sm:grid-cols-6 ${compact ? "lg:grid-cols-3" : ""}`}>
        {[
          { label: "方向", value: direction, color: opportunity.direction === "long" ? "text-emerald-200" : opportunity.direction === "short" ? "text-rose-200" : "text-slate-100" },
          { label: "候选入场区间", value: opportunity.entry ? `${price(opportunity.entry.min)} – ${price(opportunity.entry.max)}` : "—", span: true },
          { label: "止损参考", value: opportunity.stopLoss === null ? "—" : price(opportunity.stopLoss), color: "text-rose-200" },
          { label: "首个目标", value: opportunity.targets[0] ? price(opportunity.targets[0].price) : "—", color: "text-emerald-200" },
          { label: "分析后标记价", value: price(result.market.latestQuote.price) },
        ].map(item => <div key={item.label} className={`min-w-0 ${item.span ? "sm:col-span-2" : ""}`}>
          <dt className="text-xs text-slate-400">{item.label}</dt>
          <dd className={`mt-1 break-words text-sm font-semibold tabular-nums sm:text-base ${item.color ?? "text-slate-100"}`}>{item.value}</dd>
        </div>)}
      </dl>
      {archived && result.schemaVersion === 1 && <p className="text-xs text-slate-400">原结果有效至 {formatSignalDate(result.timing.validUntil)}</p>}
      {!archived && status === "expired" && <p className="text-sm leading-6 text-amber-200">价位已过期，请重新分析。{!decision && opportunity.expiredReasons.join(" ")}</p>}
      {!summaryInReasons && <p className={`whitespace-pre-wrap break-words text-sm leading-6 text-slate-300 ${view === "summary" ? "line-clamp-2" : ""}`}>{opportunity.summary}</p>}
    </div>}
    {(view === "all" || view === "chart") && result.market.chart &&
      <Suspense fallback={<p role="status" className="py-4 text-sm text-slate-400">正在加载行情图…</p>}>
        <MarketSignalChart key={result.analysisId} result={result} />
      </Suspense>}
    {(view === "all" || view === "details") && <>
      {view === "details" && <div><h3 className="text-lg font-semibold text-white">{opportunity.title}</h3>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">{opportunity.summary}</p>
      </div>}
      {result.schemaVersion === 4 && <MarketResearchDetail research={result.research} validUntil={result.timing.validUntil} validForSeconds={opportunity.validForSeconds} />}
      {opportunity.targets.length > 0 && <div><h4 className="text-sm font-medium text-slate-200">目标价位</h4><div className="mt-2 grid gap-3 sm:grid-cols-3">
        {opportunity.targets.map((target, i) => <div key={i} className="border-t border-white/10 pt-2"><p className="text-sm text-violet-200">目标 {i + 1} · {price(target.price)}</p><p className="mt-1 text-xs text-slate-400">盈亏比 {opportunity.rewardRisk[i]?.ratio?.toFixed(2) ?? "—"} : 1</p><p className="mt-1 break-words text-xs leading-6 text-slate-400">{target.reason}</p></div>)}
      </div><p className="mt-2 text-xs leading-6 text-slate-500">盈亏比按入场区间不利端计算，未计手续费、滑点及资金费。</p></div>}
      <div className="grid gap-5 sm:grid-cols-2"><Reasons title="触发条件 · 尚未自动确认" items={opportunity.triggerConditions} /><Reasons title="失效条件" items={opportunity.invalidationConditions} /></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div><h4 className="flex items-center gap-1.5 text-sm font-medium text-emerald-200"><ArrowUpRight className="size-4" />支持证据</h4><ul className="mt-2 space-y-2">{opportunity.evidence.map((item, i) => <li key={i} className="break-words text-sm leading-7 text-slate-400"><span className="mr-2 font-mono text-xs text-slate-500">{item.metric}</span>{item.reason}</li>)}</ul></div>
        <div><h4 className="flex items-center gap-1.5 text-sm font-medium text-amber-200"><ArrowDownRight className="size-4" />反对理由</h4><ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-7 text-slate-400">{opportunity.counterarguments.map((item, i) => <li key={i} className="break-words">{item}</li>)}</ul></div>
      </div>
      <Reasons title="行情提示" items={result.market.warnings} />
      {archived && !decision && <Reasons title="分析时已过期的原因" items={opportunity.expiredReasons} />}
      <details className="border-t border-white/10 pt-3 text-xs text-slate-400"><summary className="cursor-pointer">调用详情 · {result.model.name}</summary>
        <dl className="mt-3 grid gap-2 break-all leading-6 sm:grid-cols-2"><div><dt>请求编号</dt><dd>{result.requestId}</dd></div><div><dt>分析编号</dt><dd>{result.analysisId}</dd></div><div><dt>各阶段耗时</dt><dd>行情 {result.timing.marketMs} ms / 模型 {result.timing.modelMs} ms / 核价 {result.timing.verificationMs} ms</dd></div><div><dt>代码版本</dt><dd>{result.codeVersion}</dd></div>{result.model.promptVersion && <div><dt>提示词版本</dt><dd>{result.model.promptVersion}</dd></div>}</dl>
      </details>
    </>}
  </div>;
}
