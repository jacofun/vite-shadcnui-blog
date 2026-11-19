import { useEffect, useRef, useState } from "react";
import { createDemoOrderPlan, type DemoOrderPlan } from "@/lib/marketSignalOrders";
import type { PrivateAuthSession } from "@/lib/privateAuth";
import MarketSignalOrders from "./market-signal-orders";

export default function MarketDemoOrder({ session }: { session: PrivateAuthSession }) {
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<DemoOrderPlan>();
  const [now, setNow] = useState(Date.now);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => { pending.current?.abort(); }, [session]);
  useEffect(() => {
    if (!plan) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [plan]);

  async function generate() {
    if (pending.current && !pending.current.signal.aborted) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setPlan(undefined);
    setError("");
    try {
      const next = await createDemoOrderPlan(session, direction, controller.signal);
      if (!controller.signal.aborted) { setNow(Date.now()); setPlan(next); }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "生成测试草稿失败。");
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }

  return <section aria-label="测试网订单验证">
    <h3 className="text-base font-semibold text-white">测试网订单验证</h3>
    <p className="mt-1 text-xs leading-6 text-slate-400">使用 Binance Demo 的 BTCUSDT 行情，确认后提交测试网订单。</p>
    <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void generate(); }}>
      <label className="flex flex-col gap-1 text-xs text-slate-400">测试方向
        <select className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white" value={direction} disabled={busy}
          onChange={event => setDirection(event.target.value === "short" ? "short" : "long")}>
          <option value="long">开多</option><option value="short">开空</option>
        </select>
      </label>
      <button type="submit" className="rounded-lg border border-sky-300/30 px-3 py-2 text-sm text-sky-100 hover:bg-white/10 disabled:opacity-50"
        disabled={busy}>{busy ? "正在生成…" : "生成测试草稿"}</button>
    </form>
    {error && <p role="alert" className="mt-3 break-words text-sm text-amber-200">{error}</p>}
    <MarketSignalOrders testMode session={session} now={now} analysisId={plan?.analysisId} permit={plan?.orderPermit} validUntil={plan?.validUntil} />
  </section>;
}
