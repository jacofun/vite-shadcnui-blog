import { useEffect, useState } from "react";
import type { PrivateAuthSession } from "@/lib/privateAuth";
import { fetchMarketScans, type DeterministicScanRecord, type LegacyScanRecord, type ScanPage } from "@/lib/marketScanner";
import { MarketSignalArchiveDetail } from "./market-signal-history";

const date = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
const statuses = { passed: "通过初筛", watch: "待下一根确认", filtered: "已过滤", none: "无触发", error: "扫描失败" };
const trends: Record<string, string> = { up: "上行", down: "下行", flat: "中性" };
const checkLabels: Record<string, string> = {
  close_cross: "收盘穿越关键区", rvol20: "相对成交量 ≥", trend_4h: "4h 趋势一致",
  distance_atr: "距区间边缘 ≤", room_atr: "距下个反向区 ≥", wick_reclaim: "盘中穿越后收回", next_close: "下一根收盘确认",
};
const display = (value: string | number | null) =>
  value === null ? "—" : typeof value === "number" ? number.format(value) : trends[value] ?? value;
const cell = "border-t border-white/10 px-3 py-3 align-top";
const autoStatuses = { disabled: "未启用", pending: "等待结果", duplicate: "重复信号", daily_limit: "达到当日上限",
  episode: "同轮已分析", reserved_quota: "普通额度用完", busy: "分析服务忙", stale: "信号已过时" };
const opportunityStatuses = { candidate: "候选机会", watch: "继续观察", none: "暂无机会", expired: "已过期" };
const m1Reasons: Record<string, string> = {
  continuation: "顺势延续", reversal: "反转信号", style_setup_missing: "形态条件未满足",
  near_zone: "接近有效区域", no_near_zone: "附近无有效区域",
  rvol_sufficient: "相对成交量达标", rvol_unavailable: "相对成交量缺失", rvol_below_minimum: "相对成交量未达标",
  trends_aligned: "三个周期趋势同向", trends_partially_aligned: "两个周期趋势同向", atr_in_range: "ATR 在阈值内",
  atr_unavailable: "ATR 缺失", atr_out_of_range: "ATR 超出阈值", missing_analysis_frames: "分析周期数据缺失",
};

function ScanTime({ value }: { value: number | null }) {
  return value === null ? <span className="text-slate-400">—</span> :
    <time dateTime={new Date(value).toISOString()}>{date.format(value)}</time>;
}

function ScanDetails({ row }: { row: LegacyScanRecord }) {
  if (row.status === "error") return <span className="text-amber-200">
    {row.errorCode === "SCAN_CANDLE_NOT_READY" ? "本次 15m K 线尚未发布" : row.errorCode}
  </span>;
  return <details>
    <summary className="cursor-pointer text-cyan-200">筛选过程</summary>
    <div className="mt-2 space-y-3">
      {row.movement && <div>
        <p className="font-medium text-slate-200">1m 行情 · <ScanTime value={row.movement.closedAt} /></p>
        {row.movement.windows.map(window => <p key={window.minutes} className="mt-1 text-slate-400">
          {window.minutes}m {window.changePct > 0 ? "+" : ""}{display(window.changePct)}%
          {window.thresholdPct !== null && <> · 普通门槛 {display(window.thresholdPct)}%</>}
          {" · 严重门槛 "}{display(window.severeAtPct)}%
          {window.volumeRatio !== null && <> · 量比 {display(window.volumeRatio)}</>}
        </p>)}
      </div>}
      {row.movementErrorCode && <p className="text-amber-200">1m 数据异常 · {row.movementErrorCode}</p>}
      {row.structureErrorCode && <p className="text-amber-200">15m 结构读取失败 · {row.structureErrorCode}</p>}
      {row.rules.map(rule => <div key={rule.kind}>
        <p className="font-medium text-slate-200">
          {rule.kind === "breakout" ? "顺势突破" : "假突破回收"} · {statuses[rule.status]}
          {rule.direction ? (rule.direction === "long" ? " · 多向" : " · 空向") : ""}
        </p>
        {rule.zone && <p className="mt-1 text-slate-400">1h 关键区 {display(rule.zone.lower)}–{display(rule.zone.upper)}</p>}
        <ul className="mt-1 space-y-1 text-slate-400">
          {rule.checks.map(check => <li key={check.code}>
            <span className={check.passed === true ? "text-emerald-300" : check.passed === false ? "text-amber-200" : "text-slate-400"}>
              {check.passed === true ? "通过" : check.passed === false ? "未通过" : "待确认或数据不足"}
            </span>
            {" · "}{checkLabels[check.code] ?? check.code}
            {check.expected !== null && <> {display(check.expected)}{check.code.endsWith("_atr") ? " ATR" : ""}，实测 {display(check.value)}</>}
          </li>)}
        </ul>
      </div>)}
    </div>
  </details>;
}

function DeterministicRow({ row, openAnalysis }: { row: DeterministicScanRecord; openAnalysis: (analysisId: string) => void }) {
  const label = row.status === "no_trigger" ? "M1 未触发" : "M1 已触发";
  const analysisId = row.analysisId;
  return <tr>
    <td className={`${cell} whitespace-nowrap`}><ScanTime value={row.scannedAt} /></td>
    <td className={`${cell} whitespace-nowrap`}><ScanTime value={row.candleClosedAt} /> <span className="text-xs text-slate-400">{row.candleInterval ?? "15m"}</span></td>
    <td className={`${cell} whitespace-nowrap ${row.status !== "no_trigger" ? "text-emerald-300" : ""}`}>{label}
      {row.m1 && <span className="ml-1 text-xs text-slate-400">{row.m1.score} 分</span>}
    </td>
    <td className={`${cell} min-w-40 text-xs leading-5`}>
      {analysisId && row.opportunityStatus ? <button type="button" className="text-cyan-200 underline-offset-2 hover:underline"
        onClick={() => openAnalysis(analysisId)}>{opportunityStatuses[row.opportunityStatus]} · 查看分析</button> :
        row.status === "daily_limit" ? autoStatuses.daily_limit : row.status === "triggered" ? "暂无关联归档" : "—"}
      {row.decisionReason && <p className="mt-1 max-w-60 break-words text-amber-200/90">{row.decisionReason}</p>}
    </td>
    <td className={cell}>{display(row.close ?? null)}</td>
    <td className={cell}>{display(row.rvol20 ?? null)}</td>
    <td className={cell}>{display(row.trend4h ?? null)}</td>
    <td className={`${cell} min-w-48 text-xs leading-5`}>
      {row.m1 ? <details>
        <summary className="cursor-pointer text-cyan-200">M1 评估</summary>
        <ul className="mt-1 space-y-1 text-slate-400">
          {row.m1.reasons.map(reason => <li key={reason}>{m1Reasons[reason] ?? reason}</li>)}
        </ul>
      </details> : "—"}
    </td>
  </tr>;
}

export default function MarketScannerTable({ session }: { session: PrivateAuthSession }) {
  const [query, setQuery] = useState<{ before?: string }>({});
  const [result, setResult] = useState<{ query: typeof query; page?: ScanPage; error?: string }>();
  const [analysis, setAnalysis] = useState<{ analysisId: string; scanId: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchMarketScans(session, query.before, controller.signal).then(page => {
      if (!controller.signal.aborted) setResult({ query, page });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ query, error: error instanceof Error ? error.message : "扫描记录读取失败。" });
    });
    return () => controller.abort();
  }, [session, query]);
  const pending = result?.query !== query;
  const page = pending ? undefined : result.page;
  const error = pending ? undefined : result.error;
  return <section className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5" aria-label="自动扫描记录">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold text-white">自动扫描记录</h2>
      <button type="button" className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 hover:text-white disabled:opacity-50"
        onClick={() => setQuery({})} disabled={pending}>刷新最新记录</button>
    </div>
    <p className="mt-2 text-sm text-slate-400">BTCUSDT · 收盘评估 · 北京时间</p>
    {pending && <p role="status" className="mt-4 text-sm text-slate-300">正在读取自动扫描记录…</p>}
    {error && <p role="alert" className="mt-4 text-sm text-amber-200">{error}</p>}
    {page && <>
      <p className="mt-4 text-xs text-slate-400">{date.format(page.from)} 至 {date.format(page.to)}，共 {page.records.length} 条</p>
      {page.records.length === 0 ? <p className="mt-4 text-sm text-slate-300">此时段暂无扫描记录。</p> :
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[54rem] text-left text-sm text-slate-300" aria-label="BTCUSDT 扫描结果和筛选过程">
            <thead className="text-xs text-slate-400"><tr>
              {["运行时间", "K 线收盘时间", "结果", "自动分析", "收盘价", "量比", "4h 趋势", "评估详情"].map(label =>
                <th key={label} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">{label}</th>)}
            </tr></thead>
            <tbody>{page.records.map(row => row.kind === "deterministic" ?
              <DeterministicRow key={row.id} row={row} openAnalysis={analysisId => setAnalysis({ analysisId, scanId: row.id })} /> :
              <tr key={row.id}>
              <td className={`${cell} whitespace-nowrap`}><ScanTime value={row.scannedAt} /></td>
              <td className={`${cell} whitespace-nowrap`}>
                <ScanTime value={row.candleClosedAt ?? row.movement?.closedAt ?? null} />
                {row.rulesVersion === "v2" && row.status !== "error" && <span className="ml-1 text-xs text-slate-400">{row.candleClosedAt === null ? "1m" : "15m"}</span>}
              </td>
              <td className={`${cell} whitespace-nowrap ${row.status === "passed" ? "text-emerald-300" : ""}`}>
                {row.trigger?.kind === "movement" ? row.trigger.severe ? "严重异动" : "普通异动" :
                  row.trigger?.kind === "structure" ? "结构事件" : statuses[row.status]}
              </td>
              <td className={`${cell} whitespace-nowrap text-xs leading-5`}>
                {!row.autoAnalysis ? "—" : row.autoAnalysis.status === "completed" ?
                  <button type="button" className="text-cyan-200 underline-offset-2 hover:underline" onClick={() => {
                    if (row.autoAnalysis?.status === "completed") setAnalysis({ analysisId: row.autoAnalysis.analysisId, scanId: row.id });
                  }}>查看分析</button> : row.autoAnalysis.status === "failed" ?
                    <details className="text-amber-200">
                      <summary className="cursor-pointer">分析失败</summary>
                      <div>{row.autoAnalysis.stage} · {row.autoAnalysis.errorCode}</div>
                      <div className="font-mono whitespace-normal break-all">请求编号 {row.id}</div>
                    </details> : autoStatuses[row.autoAnalysis.status]}
              </td>
              <td className={cell}>{row.status === "error" ? "—" : display(row.close)}</td>
              <td className={cell}>{row.status === "error" ? "—" : display(row.rvol20)}</td>
              <td className={cell}>{row.status === "error" || row.trend4h === null ? "—" : trends[row.trend4h]}</td>
              <td className={`${cell} min-w-48 text-xs leading-5`}><ScanDetails row={row} /></td>
            </tr>)}</tbody>
          </table>
        </div>}
      {page.next !== null && <button type="button" className="mt-4 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 hover:text-white"
        onClick={() => setQuery({ before: page.next ?? undefined })}>查看更早时段</button>}
    </>}
    {analysis && <div className="mt-5 space-y-4 border-t border-white/10 pt-4">
      <button type="button" onClick={() => setAnalysis(null)} className="text-sm text-slate-300 underline-offset-2 hover:underline">收起分析</button>
      <MarketSignalArchiveDetail key={analysis.analysisId} {...analysis} session={session} />
    </div>}
  </section>;
}
