import { useEffect, useState } from "react";
import type { PrivateAuthSession } from "@/lib/privateAuth";
import { fetchMarketScans, type ScanPage, type ScanRecord } from "@/lib/marketScanner";
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
  busy: "分析服务忙", stale: "信号已过时" };

function ScanTime({ value }: { value: number | null }) {
  return value === null ? <span className="text-slate-400">—</span> :
    <time dateTime={new Date(value).toISOString()}>{date.format(value)}</time>;
}

function ScanDetails({ row }: { row: ScanRecord }) {
  if (row.status === "error") return <span className="text-amber-200">{row.errorCode}</span>;
  return <details>
    <summary className="cursor-pointer text-cyan-200">筛选过程</summary>
    <div className="mt-2 space-y-3">
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

export default function MarketScannerTable({ session }: { session: PrivateAuthSession }) {
  const [query, setQuery] = useState<{ before?: string }>({});
  const [result, setResult] = useState<{ query: typeof query; page?: ScanPage; error?: string }>();
  const [analysisId, setAnalysisId] = useState<string | null>(null);
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
    <p className="mt-2 text-sm text-slate-400">BTCUSDT · 每次触发取最新已收盘 15m K 线 · 北京时间</p>
    {pending && <p role="status" className="mt-4 text-sm text-slate-300">正在读取自动扫描记录…</p>}
    {error && <p role="alert" className="mt-4 text-sm text-amber-200">{error}</p>}
    {page && <>
      <p className="mt-4 text-xs text-slate-400">{date.format(page.from)} 至 {date.format(page.to)}，共 {page.records.length} 条</p>
      {page.records.length === 0 ? <p className="mt-4 text-sm text-slate-300">此时段暂无扫描记录。</p> :
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[54rem] text-left text-sm text-slate-300" aria-label="BTCUSDT 扫描结果和筛选过程">
            <thead className="text-xs text-slate-400"><tr>
              {["扫描时间", "K 线收盘时间", "结果", "自动分析", "收盘价", "量比", "4h 趋势", "筛选过程"].map(label =>
                <th key={label} scope="col" className="px-3 py-2 font-medium">{label}</th>)}
            </tr></thead>
            <tbody>{page.records.map(row => <tr key={row.id}>
              <td className={`${cell} whitespace-nowrap`}><ScanTime value={row.scannedAt} /></td>
              <td className={`${cell} whitespace-nowrap`}><ScanTime value={row.candleClosedAt} /></td>
              <td className={`${cell} whitespace-nowrap ${row.status === "passed" ? "text-emerald-300" : ""}`}>{statuses[row.status]}</td>
              <td className={`${cell} whitespace-nowrap text-xs leading-5`}>
                {!row.autoAnalysis ? "—" : row.autoAnalysis.status === "completed" ?
                  <button type="button" className="text-cyan-200 underline-offset-2 hover:underline" onClick={() => {
                    if (row.autoAnalysis?.status === "completed") setAnalysisId(row.autoAnalysis.analysisId);
                  }}>查看分析</button> : row.autoAnalysis.status === "failed" ?
                    <details className="text-amber-200">
                      <summary className="cursor-pointer">分析失败</summary>
                      <div>{row.autoAnalysis.stage} · {row.autoAnalysis.errorCode}</div>
                      <div className="font-mono whitespace-normal break-all">请求编号 {row.id}</div>
                    </details> : autoStatuses[row.autoAnalysis.status]}
              </td>
              <td className={cell}>{row.status === "error" ? "—" : display(row.close)}</td>
              <td className={cell}>{row.status === "error" ? "—" : display(row.rvol20)}</td>
              <td className={cell}>{row.status === "error" ? "—" : trends[row.trend4h]}</td>
              <td className={`${cell} min-w-48 text-xs leading-5`}><ScanDetails row={row} /></td>
            </tr>)}</tbody>
          </table>
        </div>}
      {page.next !== null && <button type="button" className="mt-4 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 hover:text-white"
        onClick={() => setQuery({ before: page.next ?? undefined })}>查看更早时段</button>}
    </>}
    {analysisId && <div className="mt-5 space-y-4 border-t border-white/10 pt-4">
      <button type="button" onClick={() => setAnalysisId(null)} className="text-sm text-slate-300 underline-offset-2 hover:underline">收起分析</button>
      <MarketSignalArchiveDetail key={analysisId} analysisId={analysisId} session={session} />
    </div>}
  </section>;
}
