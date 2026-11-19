import type { SignalResearch } from "@/lib/marketSignal";
import { researchPrice, zoneKind, zoneRange } from "@/lib/marketSignalDisplay";
import { formatSignalDate } from "@/lib/marketSignalHistory";

const regimes = { trend: "趋势", range: "震荡", transition: "结构转换" };
const scenarios = { continuation: "趋势延续", reversal: "反转", none: "暂无明确方向" };
const alignments = { up: "多周期向上", down: "多周期向下", mixed: "方向不完全一致", conflict: "方向冲突" };
const structure = { defined: "支阻清晰", developing: "结构发展中", limited: "结构证据有限" };
const statuses = { active: "未突破", broken: "已突破", retested: "突破后回测" };
const comparisons = { within_p50: "不超过 P50", p50_to_p75: "P50 至 P75", p75_to_p90: "P75 至 P90", above_p90: "高于 P90" };

export default function MarketResearchDetail({ research, validUntil, validForSeconds }: { research: SignalResearch; validUntil: number; validForSeconds?: number }) {
  const { ruleAssessment, priceZones } = research;
  const zones = new Map(priceZones.map(zone => [zone.id, zone]));
  const label = (id: string) => {
    const zone = zones.get(id);
    return zone && `${zone.interval} ${zoneKind(zone)} ${zoneRange(zone)}`;
  };
  return <div className="space-y-3">
    <div className="grid gap-2 sm:grid-cols-3">
      <div className="rounded-xl border border-white/10 p-3">
        <p className="text-xs text-slate-400">市场状态</p><p className="mt-1 text-sm text-slate-100">{regimes[research.marketRegime]} · {scenarios[research.scenario]}</p>
      </div>
      <div className="rounded-xl border border-white/10 p-3">
        <p className="text-xs text-slate-400">研究观察窗口</p><p className="mt-1 text-sm text-slate-100">{research.researchHorizon} 小时 · 用于观察后续行情</p>
      </div>
      <div className="rounded-xl border border-white/10 p-3">
        <p className="text-xs text-slate-400">短期机会有效期</p><p className="mt-1 text-sm text-slate-100">{validForSeconds} 秒 · 最晚至 {formatSignalDate(validUntil)}</p>
      </div>
    </div>
    <details className="rounded-xl border border-white/10 p-3">
      <summary className="cursor-pointer text-sm text-slate-200">三周期分析与规则检查</summary>
      <dl className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
        {(["4h", "1h", "15m"] as const).map(interval => <div key={interval}><dt className="text-xs font-medium text-violet-200">{interval}</dt><dd className="break-words">{research.timeframeAnalysis[interval]}</dd></div>)}
      </dl>
      <p className="mt-3 text-xs leading-6 text-slate-400">{alignments[ruleAssessment.trendAlignment]} · {structure[ruleAssessment.structure.clarity]} · {ruleAssessment.structure.confirmedZones} 个确认区间 · 有效支撑 {ruleAssessment.structure.activeSupport} / 阻力 {ruleAssessment.structure.activeResistance} · {ruleAssessment.structure.repeatedZones} 个有效区间多次触达
        {ruleAssessment.volumePrice && ` · 近期 1h / 15m 量价支持 ${ruleAssessment.volumePrice.supportingBars} 根，反向 ${ruleAssessment.volumePrice.opposingBars} 根`}</p>
      {ruleAssessment.invalidation && <p className="text-xs leading-6 text-slate-400">失效区域 {label(ruleAssessment.invalidation.zoneId)} · 止损距离 {ruleAssessment.invalidation.riskAtr14?.toFixed(2) ?? "—"} 倍 1h ATR14</p>}
      {research.riskFactors.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-6 text-amber-200">{research.riskFactors.map((risk, i) => <li key={i}>{risk}</li>)}</ul>}
    </details>
    {priceZones.length > 0 && <details className="rounded-xl border border-white/10 p-3">
      <summary className="cursor-pointer text-sm text-slate-200">支撑与阻力区域 · {priceZones.length}</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {priceZones.map(zone => <div key={zone.id} className="rounded-lg border border-white/10 p-2.5 text-xs leading-5 text-slate-400">
          <p className="text-slate-200">{label(zone.id)} · {statuses[zone.status]}</p>
          <p>{zone.pivotCount} 个确认摆动点 · {zone.touches} 次触达 · 最近 {formatSignalDate(zone.lastTouchTime)}</p>
          {zone.breakRvol20 !== null && <p>最近突破的量比 {zone.breakRvol20.toFixed(2)} · 连续收在区外 {zone.closesBeyondBreak ?? 0} 根</p>}
          {zone.lastRetestTime !== null && <p>最近回测 {formatSignalDate(zone.lastRetestTime)} · 量比 {zone.lastRetestRvol20?.toFixed(2) ?? "—"}</p>}
          {zone.reactions.map(row => <p key={row.time}>{formatSignalDate(row.time)} · CLV {row.closeClv?.toFixed(2) ?? "—"} · 量比 {row.rvol20?.toFixed(2) ?? "—"} · 反应 {row.moveAtr?.toFixed(2) ?? "—"} ATR</p>)}
        </div>)}
      </div>
    </details>}
    {research.targetAssessment.length > 0 && <details className="rounded-xl border border-white/10 p-3">
      <summary className="cursor-pointer text-sm text-slate-200">目标距离与历史波动</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {research.targetAssessment.map((target, i) => <div key={i} className="rounded-lg border border-white/10 p-2.5 text-xs leading-6 text-slate-400">
          <p className="text-violet-200">目标 {i + 1} 来自 {label(target.zoneId)}</p>
          <p>距离 {researchPrice(target.distance)}（{target.distancePct.toFixed(2)}%）· {target.atr14Multiple?.toFixed(2) ?? "—"} 倍 1h ATR14 · {target.rewardRisk.toFixed(2)}R</p>
          {target.comparison && <p>{research.researchHorizon} 小时历史有利波动 {comparisons[target.comparison]}（{target.historical?.samples} 组）</p>}
          {target.historical?.favorableMovePct && <p>P50 {target.historical.favorableMovePct.p50.toFixed(2)}% · P75 {target.historical.favorableMovePct.p75.toFixed(2)}% · P90 {target.historical.favorableMovePct.p90.toFixed(2)}%</p>}
          <p>沿途区域 {target.obstacles.length ? target.obstacles.map(label).join("；") : "无"}</p>
        </div>)}
      </div>
      <p className="mt-2 text-xs leading-6 text-slate-500">历史分位数基于 1 小时成交 K 线的不重叠窗口，描述同期曾出现的价格波动。</p>
    </details>}
  </div>;
}
