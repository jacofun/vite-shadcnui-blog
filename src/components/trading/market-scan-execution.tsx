import { useEffect, useState } from "react";
import { fetchScanExecution, type ScanExecution } from "@/lib/marketScanner";
import type { PrivateAuthSession } from "@/lib/privateAuth";

const states: Record<ScanExecution["state"], string> = {
  blocked: "未提交开仓委托", rejected: "币安拒绝委托", unfilled: "委托已提交，未成交",
  filled: "开仓已成交", partially_filled: "开仓部分成交", unknown: "执行结果待确认", unavailable: "暂无执行回报",
};
const reasons: Record<string, string> = {
  auto_execution_disabled: "本次扫描未启用自动下单。", ORDER_EXECUTION_DISABLED: "下单总开关未开启。",
  ORDER_DRAFT_EXPIRED: "候选方案或委托报价已过期。", ORDER_RECOVERY_NOT_READY: "订单保护恢复任务未就绪。",
  ORDER_RULE_CHANGED: "订单未通过提交前的价格、风险或交易所规则复核。", ORDER_QUOTE_CHANGED: "最新盘口未通过报价复核。",
  entry_unknown: "提交后未收到可确认的回报。请按客户端订单号核对币安记录。", entry_never_reserved: "执行流程未完成开仓登记。",
  EXPIRED: "IOC 限价单未能立即撮合，交易所结束了委托。", EXPIRED_IN_MATCH: "委托在撮合阶段结束。",
  CANCELED: "委托已撤销。", CANCELLED: "委托已撤销。",
};
const exchangeReasons: Record<number, string> = {
  [-2019]: "保证金不足。", [-4164]: "委托名义金额低于交易所最低要求。", [-4061]: "委托方向与账户持仓模式不符。",
  [-1111]: "委托参数精度超出交易所限制。", [-1021]: "委托请求时间戳超出允许范围。", [-2015]: "币安 API 密钥、IP 白名单或权限校验失败。",
};
const protectionLabels = { pending: "待确认", active: "已生效", attention: "需核对", closed: "已结束", not_required: "无需保护" };

export default function MarketScanExecution({ session, analysisId, scanId }: { session: PrivateAuthSession; analysisId: string; scanId: string }) {
  const [execution, setExecution] = useState<ScanExecution | "failed" | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetchScanExecution(session, analysisId, scanId, AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]))
      .then(value => { if (!controller.signal.aborted) setExecution(value); })
      .catch(() => { if (!controller.signal.aborted) setExecution("failed"); });
    return () => controller.abort();
  }, [session, analysisId, scanId, retry]);
  const title = execution === "failed" ? "执行回报读取失败" : execution ? states[execution.state] : "正在读取执行回报…";
  const filled = execution && execution !== "failed" && (execution.state === "filled" || execution.state === "partially_filled");
  const retryable = execution === "failed" || execution?.state === "unknown" || execution?.state === "unavailable";
  const message = execution && execution !== "failed" && (
    (execution.exchangeCode ? exchangeReasons[execution.exchangeCode] : undefined) ?? execution.message ??
    (execution.reasonCode ? reasons[execution.reasonCode] : undefined) ??
    (execution.state === "unavailable" ? "这条分析尚无可读的执行记录。候选机会只表示分析通过。" :
      execution.state === "unknown" ? "尚未确认是否成交。" : undefined));
  return <section aria-label="自动开仓结果" className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <h4 className="font-medium text-slate-200">自动开仓结果</h4>
      <span className={filled ? "text-emerald-200" : "text-amber-200"}>{title}</span>
      {retryable && <button type="button" className="text-xs text-cyan-200 underline-offset-2 hover:underline"
        onClick={() => { setExecution(null); setRetry(value => value + 1); }}>刷新执行回报</button>}
    </div>
    {execution && execution !== "failed" && <>
      {message && <p className="break-words text-xs leading-6 text-slate-300">{message}</p>}
      <ul className="flex list-none flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        {execution.executedQty !== undefined && <li>成交量 {execution.executedQty}{execution.requestedQty ? ` / ${execution.requestedQty}` : ""} BTC</li>}
        {execution.protection && <li>保护单 {protectionLabels[execution.protection]}</li>}
        {execution.exchangeStatus && <li>币安状态 {execution.exchangeStatus}</li>}
        {execution.exchangeCode !== undefined && <li>币安错误码 {execution.exchangeCode}</li>}
        {execution.reasonCode && <li className="break-all">原因码 {execution.reasonCode}</li>}
        {execution.clientId && <li className="break-all">客户端订单号 {execution.clientId}</li>}
      </ul>
    </>}
  </section>;
}
