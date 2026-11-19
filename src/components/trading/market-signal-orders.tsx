import { useEffect, useRef, useState } from "react";
import type { PrivateAuthSession } from "@/lib/privateAuth";
import {
  fetchOrderStatus, isAnalysisId, isOrderPermit, orderKinds, orderLabels, previewOrders,
  type OrderOption, type OrderPreview, type OrderStatus,
} from "@/lib/marketSignalOrders";

const button = "rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";
const format = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 });
const stateLabels = { not_recorded: "暂未查到提交记录", accepted: "币安已受理", rejected: "未下单或币安拒绝", unknown: "提交结果待核对" };
const protectionLabels = { pending: "待确认开仓或保护单", active: "止盈和止损均已挂出", attention: "保护单未齐，需立即核对",
  closed: "持仓已结束，剩余保护单已清理", not_required: "无开仓成交，无需挂保护单" };
const exchangeLabels: Record<string, string> = {
  NEW: "等待成交或触发", TRIGGERING: "正在触发", TRIGGERED: "条件已触发", FINISHED: "条件委托已结束",
  FILLED: "已全部成交", PARTIALLY_FILLED: "部分成交", CANCELED: "已撤销", EXPIRED: "已失效", REJECTED: "已拒绝",
};
const chooseLabels = { market: "选择市价方案", limit: "选择回踩限价方案", conditional: "选择条件限价方案" };
const exchangeLabel = (status: string) => exchangeLabels[status] ? `${exchangeLabels[status]}（${status}）` : status;
function storedId(key: string) {
  try {
    const id = localStorage.getItem(key);
    return isAnalysisId(id) ? id : "";
  } catch { return ""; }
}
type Props = { session: PrivateAuthSession; analysisId?: string; permit?: string; validUntil?: number; now: number; testMode?: boolean; sideBySide?: boolean };

export default function MarketSignalOrders({ session, analysisId, permit, validUntil = 0, now, testMode = false, sideBySide = false }: Props) {
  const storageKey = `market-signal:${testMode ? "last-demo-order" : "last-order"}:${session.user.id}`;
  const [lastAttempt, setLastAttempt] = useState(() => storedId(storageKey));
  const [queryId, setQueryId] = useState<string>();
  const [retry, refresh] = useState(0);
  const [previewResult, setPreviewResult] = useState<{ id: string; revision: number; value?: OrderPreview; error?: string }>();
  const [choice, setChoice] = useState<OrderOption>();
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState<"status" | "submit">();
  const [status, setStatus] = useState<OrderStatus>();
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const confirmation = useRef<HTMLHeadingElement>(null);
  const fresh = now < validUntil;
  const eligible = isAnalysisId(analysisId) && isOrderPermit(permit);
  const previewResponse = previewResult?.id === analysisId && previewResult?.revision === retry ? previewResult : undefined;
  const preview = previewResponse?.value;
  const draftOpen = fresh && !!preview && now < preview.expiresAt;
  const alreadyAttempted = !!analysisId && lastAttempt === analysisId;
  const showCountdown = fresh && !!preview?.options.length;
  const canRefresh = fresh && (!!previewResponse && !draftOpen || preview?.options.length === 0);
  const selected = draftOpen && !alreadyAttempted && preview?.submission.state === "enabled" && choice?.draft
    ? preview.options.find(option => option.draft === choice.draft) : undefined;

  useEffect(() => { confirmation.current?.focus(); }, [selected?.draft]);

  useEffect(() => {
    if (!eligible || !fresh || alreadyAttempted) return;
    const controller = new AbortController();
    void previewOrders(session, analysisId, permit, controller.signal, testMode ? "demo" : undefined).then(
      value => { if (!controller.signal.aborted) setPreviewResult({ id: analysisId, revision: retry, value }); },
      failure => {
        if (!controller.signal.aborted) setPreviewResult({ id: analysisId, revision: retry,
          error: failure instanceof Error ? failure.message : "获取订单草稿失败。" });
      },
    );
    return () => controller.abort();
  }, [session, analysisId, permit, fresh, retry, eligible, alreadyAttempted, testMode]);

  async function requestOrder(id: string, draft?: string) {
    if (!isAnalysisId(id) || inFlight.current) return;
    inFlight.current = true;
    setError(""); setStatus(undefined); setBusy(draft ? "submit" : "status");
    if (draft) {
      setLastAttempt(id); setQueryId(undefined);
      setChoice(undefined); setAcknowledged(false);
      try { localStorage.setItem(storageKey, id); } catch { /* current page can still query */ }
    }
    try { setStatus(await fetchOrderStatus(session, id, draft)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "未收到订单状态，请查单。"); }
    finally { inFlight.current = false; setBusy(undefined); }
  }

  if (!eligible && !lastAttempt) return null;
  const heading = testMode ? "测试草稿与查单" : "交易计划与查单";
  return <section className={`mt-4 space-y-3 border-t border-white/10 pt-3 sm:mt-5 sm:pt-4 ${sideBySide ? "lg:mt-0 lg:border-t-0 lg:pt-0" : ""}`} aria-label={heading}>
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 className="text-base font-semibold text-white">{heading}</h3>
      {fresh && preview && !alreadyAttempted && <p className="text-xs text-slate-400">
        <strong className={preview.mode === "live" ? "text-amber-200" : "text-sky-200"}>{preview.mode === "live" ? "实盘" : "测试网"}</strong>
        {" · "}{preview.symbol}{" · "}{preview.direction === "long" ? "开多" : "开空"}{" · "}{preview.quantity} BTC
      </p>}
    </div>
    {eligible && !alreadyAttempted && <>
      {!fresh && <p role="status" className="text-sm text-amber-200">{testMode ? "测试计划已过期，请重新生成。" : "研究机会已过期，请重新分析。"}</p>}
      {fresh && !previewResponse && <p role="status" className="text-sm text-sky-200">正在核对委托草稿…</p>}
      {fresh && previewResponse?.error && <p role="alert" className="text-sm text-amber-200">{previewResponse.error}</p>}
      {fresh && preview && <>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-white/10 pb-3 sm:grid-cols-4">
          {[
            { label: "止损", value: preview.stop, color: "text-rose-200" },
            { label: "止盈", value: preview.target, color: "text-emerald-200" },
            { label: "标记价", value: preview.markPrice, color: "text-slate-100" },
            { label: "计划价差风险上限", value: `${format.format(preview.riskCap)} USDT`, color: "text-slate-100" },
          ].map(item => <div key={item.label} className="min-w-0">
            <dt className="text-xs text-slate-400">{item.label}</dt>
            <dd className={`mt-1 break-words text-sm font-semibold tabular-nums ${item.color}`}>{item.value}</dd>
          </div>)}
        </dl>
        {preview.submission.state === "blocked" && <p role="status" className="text-sm leading-6 text-amber-200">{preview.submission.reason}</p>}
        <ul className="divide-y divide-white/10" aria-label="委托方案">
          {orderKinds.map(kind => {
            const option = preview.options.find(value => value.kind === kind);
            if (!option) return <li key={kind} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
              <h4 className="text-sm font-medium text-slate-300">{orderLabels[kind]}</h4>
              <p className="text-xs leading-5 text-slate-400">{preview.unavailable[kind]}</p>
            </li>;
            const chosen = selected?.draft === option.draft && !!option.draft;
            return <li key={kind} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1.3fr)_auto] ${chosen ? "bg-sky-400/[0.06]" : ""}`}>
              <h4 className="col-start-1 row-start-1 text-sm font-medium text-slate-100">{orderLabels[kind]}</h4>
              <p className="col-start-1 row-start-2 min-w-0 break-words text-xs leading-5 text-slate-400 sm:col-start-2 sm:row-start-1">
                <span className="font-medium tabular-nums text-slate-100">{option.price}</span>
                {" "}{kind === "market" ? "盘口参考" : "限价"}
                {option.triggerPrice && <span className="block">标记价 {preview.direction === "long" ? "≥" : "≤"} {option.triggerPrice} 触发</span>}
              </p>
              <p className="col-start-1 row-start-3 text-xs leading-5 text-slate-400 sm:col-start-3 sm:row-start-1">
                名义 {format.format(option.notional)} USDT<span className="sm:hidden"> · </span><span className="sm:block">风险 {format.format(option.risk)} USDT</span>
              </p>
              <div className="col-start-2 row-span-3 row-start-1 justify-self-end sm:col-start-4 sm:row-span-1">
                {preview.submission.state === "enabled" && option.draft
                  ? <button type="button" className={`${button} whitespace-nowrap text-xs aria-pressed:border-sky-300/55 aria-pressed:text-sky-200`}
                      disabled={!draftOpen || !!busy} aria-label={chooseLabels[kind]} aria-pressed={chosen}
                      onClick={() => { setChoice(option); setAcknowledged(false); }}>{chosen ? "已选择" : "选择"}</button>
                  : <span className="whitespace-nowrap text-xs text-slate-400">仅供预览</span>}
              </div>
            </li>;
          })}
        </ul>
      </>}
      {(showCountdown || canRefresh) && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
        {showCountdown && preview && <p className="text-xs text-slate-400">
          {draftOpen ? `草稿剩余 ${Math.max(0, Math.ceil((preview.expiresAt - now) / 1000))} 秒` : "草稿已过期"}
        </p>}
        {canRefresh &&
          <button type="button" className={`${button} ml-auto`} disabled={!!busy} onClick={() => refresh(value => value + 1)}>刷新委托草稿</button>}
      </div>}
      {selected?.draft && preview && analysisId && <div className="space-y-2 border-l-2 border-amber-300/55 py-1 pl-3">
        <h4 ref={confirmation} tabIndex={-1} className="scroll-mt-24 text-sm font-semibold text-amber-100">确认{preview.mode === "live" ? "实盘" : "测试网"}委托</h4>
        <p className="text-sm leading-6 text-slate-200">
          {orderLabels[selected.kind]} · {preview.direction === "long" ? "开多" : "开空"} {preview.quantity} BTC · 入场 {selected.price}
          {selected.triggerPrice && ` · 标记价触发 ${selected.triggerPrice}`} · 止盈 {selected.takeProfitPrice} · 止损 {selected.stopLossPrice}
        </p>
        {selected.kind !== "market" && <p className="text-xs leading-6 text-slate-400">约 {selected.entryWaitingSeconds} 秒后开始撤销未成交委托。</p>}
        <label className="flex items-start gap-2 text-xs leading-6 text-amber-100">
          <input aria-label="确认顺序开仓风险" className="mt-1.5 size-4 shrink-0 accent-amber-300" type="checkbox" checked={acknowledged}
            onChange={event => setAcknowledged(event.target.checked)} />
          <span>我确认以上价格。{selected.kind !== "market" && "挂单后由定时任务检查成交和撤单，部分成交时尝试撤销剩余委托。"}
            开仓与保护单分开提交，成交后存在保护单未生效的间隔。保护单以标记价格触发，平掉该方向持仓。流程期间避免在该账户另行操作 BTCUSDT。</span>
        </label>
        <button type="button" disabled={!acknowledged || !!busy} className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          onClick={() => { if (selected.draft && Date.now() < preview.expiresAt) void requestOrder(analysisId, selected.draft); }}>
          {selected.kind === "market" ? (testMode ? "确认测试网开仓并设置止盈止损" : "确认开仓并设置止盈止损") :
            preview.mode === "live" ? "确认提交实盘挂单" : "确认提交测试网挂单"}</button>
      </div>}
    </>}
    {lastAttempt && <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void requestOrder(queryId ?? lastAttempt); }}>
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-slate-400 sm:max-w-sm">{testMode ? "查单用测试编号" : "查单用分析编号"}
        <input className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-xs text-white" maxLength={36} spellCheck={false}
          value={queryId ?? lastAttempt} onChange={event => setQueryId(event.target.value.trim())} />
      </label>
      <button className={button} disabled={!!busy || !isAnalysisId(queryId ?? lastAttempt)}>查询订单</button>
    </form>}
    {busy && <p className="text-sm text-sky-200" role="status">{busy === "submit" ? "正在提交开仓委托…" : "正在查询委托…"}</p>}
    {error && <p role="alert" className="break-words text-sm text-amber-200">{error}</p>}
    {status && <div role="status" className="space-y-2 break-words border-y border-white/10 py-3 text-xs leading-5 text-slate-400">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <strong className="text-sm text-slate-100">{stateLabels[status.state]}</strong>
        {status.kind && <span>{orderLabels[status.kind]}</span>}
        {status.exchangeStatus && <span>{exchangeLabel(status.exchangeStatus)}</span>}
        {status.protection && <span className={status.protection.state === "attention" ? "text-amber-200" :
          status.protection.state === "active" ? "text-emerald-200" : "text-slate-300"}>{protectionLabels[status.protection.state]}</span>}
      </div>
      {(status.executedQty !== undefined || status.protection) && <dl className="grid grid-cols-2 gap-x-4 gap-y-2 py-1 sm:grid-cols-4">
        {status.executedQty !== undefined && <div><dt>实际成交</dt><dd className="font-semibold tabular-nums text-slate-100">{status.executedQty} BTC</dd></div>}
        {Number(status.avgPrice) > 0 && <div><dt>成交均价</dt><dd className="font-semibold tabular-nums text-slate-100">{status.avgPrice}</dd></div>}
        {status.protection && <>
          <div><dt>止损 · {status.protection.stop.exchangeStatus ?? "未确认"}</dt><dd className="font-semibold tabular-nums text-rose-200">{status.protection.stop.price}</dd></div>
          <div><dt>止盈 · {status.protection.target.exchangeStatus ?? "未确认"}</dt><dd className="font-semibold tabular-nums text-emerald-200">{status.protection.target.price}</dd></div>
        </>}
      </dl>}
      {status.childStatus && <p>触发生成的委托 · {exchangeLabel(status.childStatus)}</p>}
      {status.entryExpiresAt && status.protection?.state === "pending" &&
        <p>定时任务将检查等待成交或撤单状态，可在{status.mode === "live" ? "币安实盘" : "币安测试网"}查看当前挂单。</p>}
      {status.clientId && <p>币安客户端订单编号 {status.clientId}</p>}
      {status.exchangeCode !== undefined && <p>币安返回码 {status.exchangeCode}</p>}
      {status.reason && <p>提交检查 {status.reason}</p>}
      {(status.lookupUnavailable || status.reconciliationRequired || status.state === "unknown" || status.state === "not_recorded") &&
        <p className="text-amber-200">如刚提交过，先刷新查单或在币安核对订单和持仓，避免重复操作。</p>}
    </div>}
  </section>;
}
