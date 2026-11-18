import { useEffect, useMemo, useState, type JSX } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, PackagePlus, RefreshCw } from "lucide-react";
import type { PrivateAuthSession } from "@/lib/privateAuth";
import type { Trade } from "@/lib/trading";
import { importBinanceTrade, listBinanceFills, previewBinanceTrade, type BinanceFill, type BinanceList, type BinancePreview, type BinanceSelection } from "@/lib/binanceTrades";

const field = "w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-300/50";
const button = "inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-200 transition hover:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-40";
const date = (value: number) => new Date(value + 8 * 3600000).toISOString().slice(0, 10);
const time = (value: number) => new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
const status = { incomplete: "待补全", open: "持仓中", closed: "已平仓" };

export default function BinanceTradePicker({ session, entries, refresh, initialTarget, onImported }: {
  session: PrivateAuthSession; entries: Trade[]; refresh: number; initialTarget?: string; onImported: (trade: Trade) => void;
}): JSX.Element {
  const navigate = useNavigate();
  const [symbol, setSymbol] = useState(() => entries.find(t => t.id === initialTarget)?.plan.symbol || "");
  const [startDate, setStartDate] = useState(() => date(Date.now() - 29 * 86400000));
  const [endDate, setEndDate] = useState(() => date(Date.now()));
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<BinanceList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Map<string, BinanceFill>>(new Map());
  const [direction, setDirection] = useState<"long" | "short">(() => entries.find(t => t.id === initialTarget)?.plan.direction || "long");
  const [targetId, setTargetId] = useState(initialTarget || "");
  const [completeHistory, setCompleteHistory] = useState(false);
  const [risk, setRisk] = useState("");
  const [busy, setBusy] = useState("");
  const [createId] = useState(() => crypto.randomUUID());
  const [preview, setPreview] = useState<{ value: BinancePreview; key: string } | null>(null);
  const target = entries.find(t => t.id === targetId);
  const targets = entries.filter(t => t.binance && ["open", "incomplete"].includes(t.status) && t.plan.symbol === symbol);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    listBinanceFills(session, { symbol, startDate, endDate, page }, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setData(result); setError("");
        if (!symbol && result.symbols.length) setSymbol(result.symbols[0]);
      })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "读取成交失败"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session, symbol, startDate, endDate, page, refresh, reload]);
  const input: BinanceSelection = useMemo(() => ({ symbol, startDate, endDate, direction, completeHistory, createId,
    recordIds: [...selected.keys()].sort(), ...(targetId ? { targetId, revision: target?.revision } : { plannedRisk: risk ? Number(risk) : null }),
  }), [symbol, startDate, endDate, direction, completeHistory, createId, selected, targetId, target?.revision, risk]);
  const signature = JSON.stringify(input);
  const shownPreview = preview?.key === signature ? preview.value : null;
  function resetSelection() { setSelected(new Map()); setCompleteHistory(false); setPreview(null); setPage(1); }
  function toggle(row: BinanceFill) {
    if (row.importedTradeId && row.importedTradeId !== targetId) return;
    setCompleteHistory(false);
    setSelected(previous => {
      const next = new Map(previous);
      if (next.has(row.id)) next.delete(row.id);
      else if (next.size < 150) next.set(row.id, row);
      return next;
    });
    if (selected.size === 0 && row.positionSide !== "BOTH") setDirection(row.positionSide === "LONG" ? "long" : "short");
  }
  async function showPreview() {
    setBusy("preview"); setError("");
    try { const result = await previewBinanceTrade(session, input); setPreview({ value: result.preview, key: signature }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "预览失败"); }
    finally { setBusy(""); }
  }
  async function save() {
    if (!shownPreview || busy) return;
    setBusy("save"); setError("");
    try {
      const result = await importBinanceTrade(session, input);
      onImported(result.trade);
      navigate(`/resources/trading/${result.trade.id}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "保存失败，可保留选择后重试"); }
    finally { setBusy(""); }
  }
  const eligible = data?.records.filter(r => !r.importedTradeId || r.importedTradeId === targetId) || [];
  const allSelected = eligible.length > 0 && eligible.every(r => selected.has(r.id));
  return <section className="mt-7 space-y-5" aria-label="币安实盘成交打包">
    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.04] p-5">
      <h2 className="text-lg font-semibold text-emerald-100">把实际成交组成一笔交易</h2>
      <p className="mt-2 text-sm leading-7 text-slate-400">勾选同一次交易的开仓、加仓、减仓和平仓成交，确认多空及完整性后，直接进入三个问题写日志。</p>
      <p className="mt-2 text-xs leading-6 text-slate-500">成交原件保留在私有 OSS。金额来自后端读取的原始记录；每条成交只关联一笔日志。所有时间按北京时间显示。</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="space-y-2 text-xs text-slate-400">交易对<select aria-label="币安交易对" className={field} value={symbol} disabled={!!busy} onChange={e => { setSymbol(e.target.value); setTargetId(""); resetSelection(); }}>
        {!data?.symbols.length && <option value="">尚无已同步交易对</option>}{data?.symbols.map(s => <option key={s}>{s}</option>)}
      </select></label>
      <label className="space-y-2 text-xs text-slate-400">开始日期<input aria-label="成交开始日期" type="date" className={field} value={startDate} disabled={!!busy} onChange={e => { setStartDate(e.target.value); resetSelection(); }} /></label>
      <label className="space-y-2 text-xs text-slate-400">结束日期<input aria-label="成交结束日期" type="date" className={field} value={endDate} disabled={!!busy} onChange={e => { setEndDate(e.target.value); resetSelection(); }} /></label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
      <p>{data?.syncedThrough ? `成交同步至 ${time(data.syncedThrough)}` : "先点击上方同步按钮获取成交"} · 最多查询 93 天，历史月份可自行选择</p>
      <button className={button} disabled={loading || !!busy} onClick={() => setReload(v => v + 1)}><RefreshCw className="size-4" />刷新成交</button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/[0.06] p-4 text-sm text-rose-200">{error}</p>}
    {loading && <p role="status" className="flex items-center gap-2 py-8 text-sm text-slate-400"><LoaderCircle className="size-4 animate-spin" />正在读取私有成交…</p>}
    {!loading && !error && !data?.records.length && <p className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-400">{data?.symbols.length ? "这个时间范围内还没有成交记录。" : "尚未找到同步数据；已同步成功时，请核对北京网站函数的读取 Bucket 和目录。"}</p>}
    {!loading && !error && !!data?.records.length && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={allSelected} disabled={!!busy} onChange={() => { setCompleteHistory(false); setSelected(previous => {
          const next = new Map(previous);
          for (const row of eligible) { if (allSelected) next.delete(row.id); else if (next.size < 150) next.set(row.id, row); }
          return next;
        }); }} />勾选本页可用成交</label>
        <span className="text-xs text-slate-400">已选 {selected.size} / 150 条 · 跨页选择保留</span>
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-white/10 md:block">
        <table className="w-full text-left text-xs"><thead className="bg-white/5 text-slate-400"><tr>{["选择", "时间", "买卖 / 持仓", "价格 / 数量", "手续费", "已实现盈亏", "关联"].map(h => <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>{data.records.map(row => <tr key={row.id} className={`border-t border-white/5 ${selected.has(row.id) ? "bg-cyan-300/5" : ""}`}>
            <td className="px-4 py-4"><input aria-label={`选择成交 ${row.id}`} type="checkbox" checked={selected.has(row.id)} disabled={!!busy || !!row.importedTradeId && row.importedTradeId !== targetId} onChange={() => toggle(row)} /></td>
            <td className="whitespace-nowrap px-4 py-4">{time(row.time)}<p className="mt-1 text-[10px] text-slate-500">成交 {row.id}</p></td>
            <td className="px-4 py-4"><span className={row.side === "BUY" ? "text-emerald-300" : "text-rose-300"}>{row.side === "BUY" ? "买入" : "卖出"}</span><p className="mt-1 text-slate-500">{row.positionSide === "BOTH" ? "单向持仓" : row.positionSide === "LONG" ? "多头" : "空头"}</p></td>
            <td className="px-4 py-4 tabular-nums">{row.price}<p className="mt-1 text-slate-500">{row.qty}</p></td>
            <td className="whitespace-nowrap px-4 py-4 tabular-nums">{row.commission} {row.commissionAsset}</td>
            <td className={`px-4 py-4 tabular-nums ${Number(row.realizedPnl) > 0 ? "text-emerald-300" : Number(row.realizedPnl) < 0 ? "text-rose-300" : "text-slate-400"}`}>{row.realizedPnl}</td>
            <td className="whitespace-nowrap px-4 py-4">{row.importedTradeId ? <Link className="text-cyan-300" to={`/resources/trading/${row.importedTradeId}`}>查看日志</Link> : <span className="text-slate-500">未关联</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">{data.records.map(row => <div key={row.id} className={`rounded-2xl border p-4 ${selected.has(row.id) ? "border-cyan-300/40 bg-cyan-300/5" : "border-white/10 bg-white/[0.025]"}`}>
        <label className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-3"><input aria-label={`选择成交 ${row.id}`} type="checkbox" checked={selected.has(row.id)} disabled={!!busy || !!row.importedTradeId && row.importedTradeId !== targetId} onChange={() => toggle(row)} />{row.side === "BUY" ? "买入" : "卖出"} · {row.positionSide}</span><span className="text-xs text-slate-400">{time(row.time)}</span></label>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-500">价格 / 数量</dt><dd className="mt-1 tabular-nums">{row.price} / {row.qty}</dd></div><div><dt className="text-slate-500">手续费</dt><dd className="mt-1">{row.commission} {row.commissionAsset}</dd></div><div><dt className="text-slate-500">已实现盈亏</dt><dd className="mt-1">{row.realizedPnl}</dd></div><div><dt className="text-slate-500">关联</dt><dd className="mt-1">{row.importedTradeId ? <Link className="text-cyan-300" to={`/resources/trading/${row.importedTradeId}`}>查看日志</Link> : "未关联"}</dd></div></dl>
      </div>)}</div>
      <div className="flex items-center justify-between gap-3"><button className={button} disabled={page <= 1 || !!busy} onClick={() => setPage(p => p - 1)}><ArrowLeft className="size-4" />上一页</button><span className="text-xs text-slate-400">第 {page} / {data.pages} 页 · {data.total} 条</span><button className={button} disabled={page >= data.pages || !!busy} onClick={() => setPage(p => p + 1)}>下一页<ArrowRight className="size-4" /></button></div>
    </>}
    <div className="rounded-2xl border border-cyan-300/20 bg-slate-900/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">已选 {selected.size} 条成交</h3><button className="text-xs text-slate-400 hover:text-white" disabled={!!busy} onClick={() => { setSelected(new Map()); setCompleteHistory(false); }}>清空选择</button></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-xs text-slate-400">保存到<select aria-label="打包目标日志" className={field} disabled={!!busy} value={targetId} onChange={e => { setTargetId(e.target.value); setSelected(previous => new Map([...previous].filter(([, row]) => !row.importedTradeId || row.importedTradeId === e.target.value))); setCompleteHistory(false); const t = entries.find(v => v.id === e.target.value); if (t) setDirection(t.plan.direction); }}>
          <option value="">新建一笔交易日志</option>{targets.map(t => <option key={t.id} value={t.id}>{t.plan.symbol} · {t.plan.direction === "long" ? "做多" : "做空"} · {t.status === "incomplete" ? "待补全" : "持仓中"} · {time(Date.parse(t.createdAt))}</option>)}
        </select></label>
        <label className="space-y-2 text-xs text-slate-400">交易方向<select aria-label="打包交易方向" className={field} disabled={!!busy || !!targetId} value={direction} onChange={e => setDirection(e.target.value as "long" | "short")}><option value="long">做多：买入开仓，卖出平仓</option><option value="short">做空：卖出开仓，买入平仓</option></select></label>
        {!targetId && <label className="space-y-2 text-xs text-slate-400">初始风险金额（可稍后补充）<input aria-label="打包交易初始风险" type="number" min="0" step="any" className={field} placeholder="例如 1，单位为结算币种" value={risk} disabled={!!busy} onChange={e => setRisk(e.target.value)} /></label>}
      </div>
      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-4 text-sm leading-6 text-slate-300"><input className="mt-1" type="checkbox" checked={completeHistory} disabled={!!busy} onChange={e => setCompleteHistory(e.target.checked)} /><span>我已核对：从这笔交易开仓开始，至今发生的成交均已选齐（可以尚未平仓）。<span className="mt-1 block text-xs text-slate-500">未确认时保存为“待补全”；只有完整、已平仓且手续费已知的记录才计入胜率。</span></span></label>
      <button className={`${button} mt-5 w-full sm:w-auto`} disabled={!selected.size || !!busy || !!targetId && !target} onClick={() => void showPreview()}>{busy === "preview" ? <LoaderCircle className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}预览打包结果</button>
      {shownPreview && <div className="mt-6 border-t border-white/10 pt-5">
        <div className="flex flex-wrap items-center gap-3"><h4 className="font-semibold">{shownPreview.symbol} · {shownPreview.direction === "long" ? "做多" : "做空"}</h4><span className="rounded-full border border-white/15 px-3 py-1 text-xs text-cyan-200">{status[shownPreview.status]}</span></div>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">{[
          ["开仓数量 / 均价", `${shownPreview.entryQuantity} / ${shownPreview.entryAverage ?? "待补全"}`],
          ["平仓数量 / 均价", `${shownPreview.exitQuantity} / ${shownPreview.exitAverage ?? "—"}`],
          ["剩余数量", shownPreview.remaining ?? "起始持仓未知"],
          ["币安已实现盈亏", `${shownPreview.exchangeRealizedPnl} ${shownPreview.currency}`],
          ["已计入手续费", `${shownPreview.knownFees} ${shownPreview.currency}`],
          [shownPreview.feesComplete ? "成交净盈亏" : "暂计盈亏（费用未齐）", `${shownPreview.netPnl} ${shownPreview.currency}`],
        ].map(([title, value]) => <div key={title}><dt className="text-xs text-slate-500">{title}</dt><dd className="mt-2 break-all tabular-nums">{value}</dd></div>)}</dl>
        <p className="mt-4 text-xs leading-6 text-slate-400">本次新增 {shownPreview.added} 条，日志共 {shownPreview.executions} 条。成交损益不含资金费；未统一币种的手续费不换算，也不视为零。</p>
        {!shownPreview.positionKnown && <p className="mt-2 text-xs text-amber-200">所选成交缺少起始开仓或存在反手，请补充核对；当前保存为待补全。</p>}
        <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50 sm:w-auto" disabled={!!busy} onClick={() => void save()}>{busy === "save" ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{targetId ? "补充成交并写日志" : "确认打包并写日志"}</button>
      </div>}
    </div>
  </section>;
}
