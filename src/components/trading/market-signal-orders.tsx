import { useEffect, useRef, useState } from "react";
import type { PrivateAuthSession } from "@/lib/privateAuth";
import {
  fetchOrderStatus, isAnalysisId, isOrderPermit, orderKinds, orderLabels, previewOrders,
  type OrderPreview, type OrderStatus,
} from "@/lib/marketSignalOrders";

const button = "rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";
const format = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 });
const stateLabels = { not_recorded: "暂未查到提交记录", accepted: "币安已受理", rejected: "未下单或币安拒绝", unknown: "提交结果待核对" };
const exchangeLabels: Record<string, string> = {
  NEW: "等待成交或触发", TRIGGERING: "正在触发", TRIGGERED: "条件已触发", FINISHED: "条件委托已结束",
  FILLED: "已全部成交", PARTIALLY_FILLED: "部分成交", CANCELED: "已撤销", EXPIRED: "已失效", REJECTED: "已拒绝",
};
const exchangeLabel = (status: string) => exchangeLabels[status] ? `${exchangeLabels[status]}（${status}）` : status;
function storedId(key: string) {
  try {
    const id = localStorage.getItem(key);
    return isAnalysisId(id) ? id : "";
  } catch { return ""; }
}
type Props = { session: PrivateAuthSession; analysisId?: string; permit?: string; validUntil?: number; now: number };

export default function MarketSignalOrders({ session, analysisId, permit, validUntil = 0, now }: Props) {
  const storageKey = `market-signal:last-order:${session.user.id}`;
  const [lastAttempt] = useState(() => storedId(storageKey));
  const [queryId, setQueryId] = useState<string>();
  const [retry, refresh] = useState(0);
  const [previewResult, setPreviewResult] = useState<{ id: string; revision: number; value?: OrderPreview; error?: string }>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<OrderStatus>();
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const fresh = now < validUntil;
  const eligible = isAnalysisId(analysisId) && isOrderPermit(permit);
  const previewResponse = previewResult?.id === analysisId && previewResult?.revision === retry ? previewResult : undefined;
  const preview = previewResponse?.value;
  const draftOpen = fresh && !!preview && now < preview.expiresAt;
  const alreadyAttempted = !!analysisId && lastAttempt === analysisId;

  useEffect(() => {
    if (!eligible || !fresh || alreadyAttempted) return;
    const controller = new AbortController();
    void previewOrders(session, analysisId, permit, controller.signal).then(
      value => { if (!controller.signal.aborted) setPreviewResult({ id: analysisId, revision: retry, value }); },
      failure => {
        if (!controller.signal.aborted) setPreviewResult({ id: analysisId, revision: retry,
          error: failure instanceof Error ? failure.message : "获取订单草稿失败。" });
      },
    );
    return () => controller.abort();
  }, [session, analysisId, permit, fresh, retry, eligible, alreadyAttempted]);

  async function requestOrder(id: string) {
    if (!isAnalysisId(id) || inFlight.current) return;
    inFlight.current = true;
    setError(""); setStatus(undefined); setBusy(true);
    try { setStatus(await fetchOrderStatus(session, id)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "未收到订单状态，请查单。"); }
    finally { inFlight.current = false; setBusy(false); }
  }

  if (!eligible && !lastAttempt) return null;
  return <section className="mt-4 space-y-3 rounded-xl border border-sky-400/25 bg-sky-400/[0.05] p-4" aria-label="交易计划与查单">
    <div>
      <h3 className="font-semibold text-sky-100">交易计划与查单</h3>
      {eligible && <p className="mt-1 text-xs leading-6 text-slate-400">每张草稿包含入场参考价、止盈和止损。当前仅可预览交易计划。</p>}
    </div>
    {eligible && !alreadyAttempted && <>
      {!fresh && <p role="status" className="text-sm text-amber-200">研究机会已过期，请重新分析。</p>}
      {fresh && !previewResponse && <p role="status" className="text-sm text-sky-200">正在核对委托草稿…</p>}
      {fresh && previewResponse?.error && <p role="alert" className="text-sm text-amber-200">{previewResponse.error}</p>}
      {fresh && (!draftOpen && previewResponse || preview?.options.length === 0) &&
        <button type="button" className={button} disabled={!!busy} onClick={() => refresh(value => value + 1)}>刷新委托草稿</button>}
      {fresh && preview && <>
        <p className="text-sm text-slate-200">
          <strong className={preview.mode === "live" ? "text-amber-200" : "text-sky-200"}>{preview.mode === "live" ? "实盘" : "测试网"}</strong>
          {" · BTCUSDT · "}{preview.direction === "long" ? "开多" : "开空"}{" · "}{preview.quantity} BTC
        </p>
        <p role="status" className="text-sm leading-6 text-amber-200">{preview.submission.reason}</p>
        <p className="text-xs leading-6 text-slate-400">
          标记价 {preview.markPrice} · 计划价差风险上限 {format.format(preview.riskCap)} USDT
        </p>
        {preview.options.length > 0 && <p className="text-xs text-slate-400">{draftOpen ? `草稿剩余 ${Math.max(0, Math.ceil((preview.expiresAt - now) / 1000))} 秒` : "草稿已过期"}</p>}
        <div className="grid gap-2 md:grid-cols-3">
          {orderKinds.map(kind => {
            const option = preview.options.find(value => value.kind === kind);
            if (!option) return <div key={kind} className="rounded-lg border border-white/10 p-3 text-xs leading-5 text-slate-400">
              <h4 className="mb-1 font-medium text-slate-300">{orderLabels[kind]}</h4>{preview.unavailable[kind]}
            </div>;
            return <div key={kind} className="rounded-lg border border-sky-300/20 p-3 text-sm text-slate-200">
              <h4 className="font-medium text-sky-100">{orderLabels[kind]}</h4>
              <p className="mt-1 text-xs leading-6">
                {kind === "market" ? "盘口参考价 " : "入场限价 "}{option.price}
                {option.triggerPrice && <> · 标记价{preview.direction === "long" ? " ≥ " : " ≤ "}{option.triggerPrice}触发</>}
                <br />止盈 {option.takeProfitPrice} · 止损 {option.stopLossPrice}
                <br />名义金额约 {format.format(option.notional)} USDT
                <br />至止损价差约 {format.format(option.risk)} USDT
              </p>
            </div>;
          })}
        </div>
      </>}
    </>}
    {lastAttempt && <form className="flex flex-wrap items-center gap-2" onSubmit={event => { event.preventDefault(); void requestOrder(queryId ?? lastAttempt); }}>
      <label className="flex min-w-52 flex-1 flex-col gap-1 text-xs text-slate-400">查单用分析编号
        <input className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-xs text-white" maxLength={36} spellCheck={false}
          value={queryId ?? lastAttempt} onChange={event => setQueryId(event.target.value.trim())} />
      </label>
      <button className={`${button} self-end`} disabled={!!busy || !isAnalysisId(queryId ?? lastAttempt)}>查询订单</button>
    </form>}
    {busy && <p className="text-sm text-sky-200" role="status">正在查询委托…</p>}
    {error && <p role="alert" className="break-words text-sm text-amber-200">{error}</p>}
    {status && <div role="status" className="space-y-1 break-words text-xs leading-6 text-slate-200">
      <p><strong>{stateLabels[status.state]}</strong>{status.kind ? ` · ${orderLabels[status.kind]}` : ""}{status.exchangeStatus ? ` · ${exchangeLabel(status.exchangeStatus)}` : ""}</p>
      {status.childStatus && <p>触发生成的委托 · {exchangeLabel(status.childStatus)}</p>}
      {status.clientId && <p>币安客户端订单编号 {status.clientId}</p>}
      {status.executedQty !== undefined && <p>实际成交 {status.executedQty} BTC{Number(status.avgPrice) > 0 ? ` · 均价 ${status.avgPrice}` : ""}</p>}
      {status.exchangeCode !== undefined && <p>币安返回码 {status.exchangeCode}</p>}
      {status.reason && <p>提交检查 {status.reason}</p>}
      {(status.lookupUnavailable || status.reconciliationRequired || status.state === "unknown" || status.state === "not_recorded") &&
        <p className="text-amber-200">如刚提交过，先刷新查单或在币安核对订单和持仓，避免重复操作。</p>}
    </div>}
  </section>;
}
