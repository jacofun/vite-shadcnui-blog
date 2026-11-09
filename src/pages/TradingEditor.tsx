import { ArrowLeft, Camera, CheckCircle2, ChevronRight, FilePenLine, LoaderCircle, Plus, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";

import PrivateResourceAccessState from "@/components/resources/PrivateResourceAccessState";
import { usePrivateResourceSession } from "@/hooks/usePrivateResourceSession";
import { signPrivateResourcePaths, type PrivateAuthSession } from "@/lib/privateAuth";
import { uploadPrivateResourceFile } from "@/lib/privateResourceUpload";
import {
  addTradeExecution, completeTradeImage, confirmTrade, createDraftPlan, formatPrice,
  getTrade, initTradeImage, reviseTrade, reviewTrade, riskReward, saveTrade, skipTrade,
  type Trade, type TradeExecution, type TradePhase, type TradePlan, type TradeReview,
} from "@/lib/trading";

const field = "mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.045] px-3.5 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-60";
const inputSection = "rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6";
type Tab = "plan" | "execution" | "review";
type UiOption = { label: string; value: string };
const markets: UiOption[] = [
  { label: "A股", value: "cn" }, { label: "港股", value: "hk" }, { label: "美股", value: "us" },
  { label: "加密货币", value: "crypto" }, { label: "其他", value: "other" },
];
const signalOptions = ["缩量下跌", "放量上涨", "长下影线", "均线拐头", "颈线支撑", "背离", "结构突破", "回踩确认"];
const mistakeOptions = ["提前入场", "扩大止损", "过早止盈", "冲动追单", "过度交易", "仓位过大", "未按计划减仓"];
const emotionOptions = ["冷静", "恐惧", "贪婪", "急躁", "犹豫", "自信"];
const statusLabels = { draft: "草稿", planned: "等待入场", open: "持仓中", closed: "已平仓", skipped: "未成交" };
const newExecution = (): TradeExecution => ({
  id: crypto.randomUUID(), action: "entry", at: new Date().toISOString(), price: 0, quantity: 0, fee: 0, note: "",
});
const newReview = (): Omit<TradeReview, "updatedAt"> => ({
  expectation: "partial", discipline: "full", score: 3, emotions: [], mistakes: [], outcome: "", learning: "", replay: "",
});
function localDatetime(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function readDatetime(value: string): string {
  return new Date(value).toISOString();
}
function InputField({ title, children, hint }: { title: string; children: ReactNode; hint?: string }): JSX.Element {
  return <label className="block min-w-0"><span className="text-xs font-medium text-slate-300">{title}</span>{children}{hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}</label>;
}
function Select({ value, options, onChange, disabled }: { value: string; options: UiOption[]; onChange: (value: string) => void; disabled?: boolean }): JSX.Element {
  return <select className={field} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)}>
    {options.map((option) => <option className="bg-slate-900" key={option.value} value={option.value}>{option.label}</option>)}
  </select>;
}
function TagChoices({ values, options, onChange, disabled }: { values: string[]; options: string[]; onChange: (values: string[]) => void; disabled?: boolean }): JSX.Element {
  return <div className="mt-3 flex flex-wrap gap-2">{options.map((option) => <button key={option} type="button" disabled={disabled}
    aria-pressed={values.includes(option)}
    onClick={() => onChange(values.includes(option) ? values.filter((v) => v !== option) : [...values, option])}
    className={`rounded-full border px-3 py-2 text-xs transition disabled:opacity-50 ${values.includes(option) ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-200" : "border-white/10 text-slate-400 hover:border-white/25"}`}>
    {option}
  </button>)}</div>;
}
function Editor({ session }: { session: PrivateAuthSession }): JSX.Element {
  const { tradeId } = useParams();
  const navigate = useNavigate();
  const initial = useMemo(createDraftPlan, []);
  const [plan, setPlan] = useState<TradePlan>(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(Boolean(tradeId));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<Tab>("plan");
  const [execution, setExecution] = useState<TradeExecution>(newExecution);
  const [editExecution, setEditExecution] = useState(false);
  const [review, setReview] = useState<Omit<TradeReview, "updatedAt">>(newReview);
  const [image, setImage] = useState<File | null>(null);
  const [phase, setPhase] = useState<TradePhase>("plan");
  const [caption, setCaption] = useState("");
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const allowedToLeave = useRef(false);
  const createId = useRef(crypto.randomUUID());
  const dirty = JSON.stringify(plan) !== baseline;
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && !allowedToLeave.current && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("交易计划尚未保存，确定离开吗？")) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!tradeId) return;
    const controller = new AbortController();
    getTrade(session, tradeId, controller.signal).then(({ trade: loaded }) => {
      setTrade(loaded); setPlan(loaded.plan); setBaseline(JSON.stringify(loaded.plan));
      if (loaded.review) setReview(loaded.review);
      if (loaded.status === "open" || loaded.status === "closed") setTab("execution");
      if (loaded.status === "closed" && loaded.review) setTab("review");
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "加载失败");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session, tradeId]);
  useEffect(() => {
    if (!trade?.attachments.length) return;
    const controller = new AbortController();
    async function signImages(): Promise<void> {
      if (!trade) return;
      const result: Record<string, string> = {};
      const items = trade.attachments;
      for (let offset = 0; offset < items.length; offset += 12) {
        if (controller.signal.aborted) return;
        const part = items.slice(offset, offset + 12);
        const keys = Object.fromEntries(part.map((image, i) => [`img${i}`, image.path]));
        const response = await signPrivateResourcePaths(session, keys, controller.signal);
        part.forEach((image, i) => { result[image.id] = response.resources[`img${i}`]; });
      }
      if (!controller.signal.aborted) setImageUrls(result);
    }
    void signImages().catch(() => { if (!controller.signal.aborted) setMessage("部分图片暂时无法加载，请刷新后重试"); });
    return () => controller.abort();
  }, [session, trade?.attachments]);
  const planLocked = Boolean(trade && ["closed", "skipped"].includes(trade.status));
  const validExpectancy = riskReward(plan);
  const canExecute = trade && !["draft", "skipped"].includes(trade.status) && trade.plan.recordType !== "observation";
  function change<K extends keyof TradePlan>(key: K, value: TradePlan[K]): void {
    setPlan((current) => ({ ...current, [key]: value }));
    setMessage("");
  }
  function numeric(key: "entry" | "stop" | "target" | "plannedRisk" | "plannedQuantity", value: string): void {
    change(key, value.trim() === "" ? null : Number(value));
  }
  async function run(action: string, operation: () => Promise<Trade | null>): Promise<void> {
    if (busy) return;
    setBusy(action); setError(""); setMessage("");
    try {
      const updated = await operation();
      if (updated) setTrade(updated);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "操作失败");
    } finally { setBusy(""); }
  }
  function resetFromTrade(updated: Trade): void {
    setTrade(updated); setPlan(updated.plan); setBaseline(JSON.stringify(updated.plan));
  }
  async function savePlan(): Promise<void> {
    await run("save", async () => {
      const result = trade ? await saveTrade(session, plan, trade) : await saveTrade(session, plan, undefined, createId.current);
      resetFromTrade(result.trade);
      setMessage("草稿已保存");
      if (!trade) {
        allowedToLeave.current = true;
        navigate(`/resources/trading/${result.trade.id}`, { replace: true });
      }
      return result.trade;
    });
  }
  async function submitPlan(): Promise<void> {
    if (!trade || dirty) { setError("请先保存当前交易计划"); return; }
    await run("confirm", async () => {
      const result = trade.status === "draft" ? await confirmTrade(session, trade) : await reviseTrade(session, trade, plan);
      resetFromTrade(result.trade);
      setMessage("交易计划已确认，原始版本已经留存");
      return result.trade;
    });
  }
  async function saveRevision(): Promise<void> {
    if (!trade || !dirty) return;
    await run("revision", async () => {
      const result = await reviseTrade(session, trade, plan);
      resetFromTrade(result.trade);
      setMessage("已保存计划修订，原版本仍然保留");
      return result.trade;
    });
  }
  async function addExecution(): Promise<void> {
    if (!trade) return;
    if (!(execution.price > 0 && execution.quantity > 0) || execution.fee < 0) {
      setError("成交价格和数量必须大于零，手续费不能为负数"); return;
    }
    await run("execution", async () => {
      const result = await addTradeExecution(session, trade, execution, editExecution);
      setExecution(newExecution()); setEditExecution(false);
      setMessage(editExecution ? "成交更正已记录历史" : "成交已记录");
      return result.trade;
    });
  }
  async function saveReview(): Promise<void> {
    if (!trade) return;
    await run("review", async () => {
      const result = await reviewTrade(session, trade, review);
      setMessage("复盘已保存");
      return result.trade;
    });
  }
  async function uploadImage(): Promise<void> {
    if (!trade || !image) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
      setError("仅支持 JPG、PNG、WebP 图片"); return;
    }
    if (image.size > 6 * 1024 * 1024) { setError("图片不得超过 6 MB"); return; }
    await run("upload", async () => {
      const ticket = await initTradeImage(session, trade, { bytes: image.size, contentType: image.type, phase, caption });
      const fresh = (await getTrade(session, trade.id)).trade;
      await uploadPrivateResourceFile(image, {
        path: ticket.path, uploadUrl: ticket.uploadUrl,
        headers: { "Content-Type": ticket.contentType, "x-oss-forbid-overwrite": "true" },
      }, () => undefined);
      const result = await completeTradeImage(session, fresh, ticket.imageId);
      setImage(null); setCaption(""); setMessage("截图已保存到私人资源");
      return result.trade;
    });
  }
  const actionsDisabled = Boolean(busy) || loading;
  return (
    <main className="min-h-[calc(100svh-var(--site-header-height))] bg-[#070a12] px-5 py-10 text-slate-100 sm:px-8 sm:py-14">
      <Helmet><title>{trade ? "编辑交易" : "新增交易"} · 交易日志</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <div className="mx-auto max-w-5xl">
        <Link className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-200" to="/resources/trading"><ArrowLeft className="size-4" />返回交易日志</Link>
        <header className="mt-8 flex flex-wrap items-start justify-between gap-5">
          <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">TRADING JOURNAL / {trade?.id.slice(0, 8) ?? "NEW"}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{trade?.plan.symbol || "新增交易记录"}</h1>
            <p className="mt-3 text-sm text-slate-400">{trade ? `${statusLabels[trade.status]} · 修订号 ${trade.revision}` : "从记录交易前计划开始，成交和复盘可以稍后补充。"}</p>
          </div>
          {trade && <div className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-right">
            <p className="text-xs text-slate-500">已实现盈亏 · {trade.plan.currency}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatPrice(trade.metrics.realizedPnl)}</p>
            <p className="text-xs text-slate-400">{trade.metrics.realizedR === null ? "暂无可计算 R" : `${formatPrice(trade.metrics.realizedR)}R`}</p>
          </div>}
        </header>
        <div className="mt-7 grid grid-cols-3 gap-2">
          {([{ id: "plan", label: "01 交易计划" }, { id: "execution", label: "02 交易执行" }, { id: "review", label: "03 复盘总结" }] as const).map((item) =>
            <button key={item.id} type="button" disabled={!trade && item.id !== "plan"} onClick={() => setTab(item.id)}
              className={`rounded-xl border p-3 text-xs font-medium transition sm:text-sm ${tab === item.id ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200" : "border-white/10 text-slate-400 hover:border-white/20"}`}>
              {item.label}
            </button>)}
        </div>
        {error && <p role="alert" className="mt-6 rounded-xl border border-rose-400/25 bg-rose-400/[0.07] p-4 text-sm text-rose-200">{error}</p>}
        {message && <p role="status" className="mt-6 rounded-xl border border-emerald-300/25 bg-emerald-300/[0.07] p-4 text-sm text-emerald-200">{message}</p>}
        {loading && <p className="mt-8 text-sm text-slate-400"><LoaderCircle className="mr-2 inline size-4 animate-spin" />正在读取交易记录…</p>}
        {!loading && tab === "plan" && <div className="mt-6 space-y-5">
          <section className={inputSection}>
            <h2 className="text-lg font-semibold">基本信息</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InputField title="交易代码 *"><input className={field} disabled={planLocked} maxLength={40} placeholder="BTCUSDT / 512480.SH" value={plan.symbol} onChange={(e) => change("symbol", e.target.value)} /></InputField>
              <InputField title="标的名称"><input className={field} disabled={planLocked} maxLength={80} placeholder="可选" value={plan.name} onChange={(e) => change("name", e.target.value)} /></InputField>
              <InputField title="市场"><Select disabled={planLocked} value={plan.market} options={markets} onChange={(v) => change("market", v as TradePlan["market"])} /></InputField>
              <InputField title="交易方向"><Select disabled={planLocked} value={plan.direction} options={[{ label: "做多", value: "long" }, { label: "做空", value: "short" }]} onChange={(v) => change("direction", v as TradePlan["direction"])} /></InputField>
              <InputField title="记录类型"><Select disabled={planLocked} value={plan.recordType} options={[{ label: "实盘", value: "live" }, { label: "模拟", value: "paper" }, { label: "仅观察", value: "observation" }]} onChange={(v) => change("recordType", v as TradePlan["recordType"])} /></InputField>
              <InputField title="交易策略"><Select disabled={planLocked} value={plan.strategy} options={["反转", "趋势", "突破", "区间", "其他", plan.strategy].filter((s, i, arr) => arr.indexOf(s) === i).map((s) => ({ label: s, value: s }))} onChange={(v) => change("strategy", v)} /></InputField>
              <InputField title="交易周期"><Select disabled={planLocked} value={plan.timeframe} options={["15分钟", "1小时", "4小时", "日线", "周线", "月线"].map((s) => ({ label: s, value: s }))} onChange={(v) => change("timeframe", v)} /></InputField>
              <InputField title="分析时间"><input className={field} disabled={planLocked} type="datetime-local" value={localDatetime(plan.setupAt)} onChange={(e) => { if (e.target.value) change("setupAt", readDatetime(e.target.value)); }} /></InputField>
              <InputField title="交易账户（别名）"><input className={field} disabled={planLocked} value={plan.account} maxLength={60} onChange={(e) => change("account", e.target.value)} placeholder="例如：主要账户" /></InputField>
            </div>
          </section>
          <section className={inputSection}>
            <h2 className="text-lg font-semibold">行情分析与交易逻辑</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <InputField title="大级别趋势"><Select disabled={planLocked} value={plan.trend} options={[{ label: "上升", value: "up" }, { label: "下降", value: "down" }, { label: "震荡", value: "range" }]} onChange={(v) => change("trend", v as TradePlan["trend"])} /></InputField>
              <InputField title="预期持仓周期"><input disabled={planLocked} className={field} maxLength={60} placeholder="日内 / 波段 / 中长线" value={plan.holdingPeriod} onChange={(e) => change("holdingPeriod", e.target.value)} /></InputField>
            </div>
            <p className="mt-5 text-xs font-medium text-slate-300">行情结构及观察信号</p>
            <TagChoices values={plan.signals} options={signalOptions} disabled={planLocked} onChange={(v) => change("signals", v)} />
            <div className="mt-5 space-y-4">
              {([
                { key: "thesis", title: "交易逻辑 *", placeholder: "为什么关注这个标的和当前位置？" },
                { key: "trigger", title: "入场触发条件 *", placeholder: "出现什么信号才可以执行？" },
                { key: "invalidation", title: "判断失效条件 *", placeholder: "什么情况下应承认原判断失效？" },
              ] as const).map((item) => <InputField key={item.key} title={item.title}>
                <textarea rows={3} disabled={planLocked} maxLength={item.key === "thesis" ? 3000 : 1800} className={field} placeholder={item.placeholder} value={plan[item.key]} onChange={(e) => change(item.key, e.target.value)} />
              </InputField>)}
            </div>
          </section>
          <section className={inputSection}>
            <h2 className="text-lg font-semibold">交易与风险计划</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {([
                { key: "entry", label: "计划入场价", placeholder: "0.00" },
                { key: "stop", label: "计划止损价", placeholder: "0.00" },
                { key: "target", label: "目标价", placeholder: "可选" },
                { key: "plannedQuantity", label: "计划数量", placeholder: "可选" },
                { key: "plannedRisk", label: "初始风险金额", placeholder: "可选" },
              ] as const).map((item) => <InputField key={item.key} title={item.label}>
                <input type="number" step="any" min="0" disabled={planLocked} className={field} placeholder={item.placeholder}
                  value={plan[item.key] ?? ""} onChange={(e) => numeric(item.key, e.target.value)} />
              </InputField>)}
              <InputField title="结算币种"><input maxLength={12} disabled={planLocked} className={field} value={plan.currency} onChange={(e) => change("currency", e.target.value)} placeholder="CNY / USD / USDT" /></InputField>
            </div>
            <InputField title="止损依据"><textarea disabled={planLocked} maxLength={400} rows={2} className={field} placeholder="结构低点 / 波动率 / 固定百分比" value={plan.stopReason} onChange={(e) => change("stopReason", e.target.value)} /></InputField>
            <div className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
              <p className="text-xs text-slate-400">预期风险收益比</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{validExpectancy === null ? "—" : `1 : ${validExpectancy.toFixed(2)}`}</p>
              <p className="mt-1 text-xs leading-6 text-slate-500">仅按计划价计算；已实现 R 使用首次确认的初始计划风险。多币种与合约乘数暂不自动换算。</p>
            </div>
          </section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">{trade?.planHistory.length ? `已有 ${trade.planHistory.length} 个已确认计划版本，历史不可覆盖。` : "确认计划后会保存不可覆盖的初始快照。"}</p>
            <div className="flex flex-wrap gap-2">
              {(!trade || trade.status === "draft") && <button disabled={actionsDisabled} type="button" onClick={() => void savePlan()} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm hover:border-cyan-300/40 disabled:opacity-50"><Save className="size-4" />保存草稿</button>}
              {trade?.status === "draft" && <button disabled={actionsDisabled || dirty} onClick={() => void submitPlan()} type="button" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"><ShieldCheck className="size-4" />确认交易计划</button>}
              {trade && ["planned", "open"].includes(trade.status) && dirty && <button disabled={actionsDisabled} type="button" onClick={() => void saveRevision()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"><FilePenLine className="size-4" />保存修订版本</button>}
              {trade?.status === "planned" && <button disabled={actionsDisabled || dirty} onClick={() => { if (window.confirm("确定将此机会标记为未成交吗？")) void run("skip", async () => (await skipTrade(session, trade)).trade); }} type="button" className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 disabled:opacity-50">放弃/错过机会</button>}
              {trade && trade.status !== "draft" && <button type="button" onClick={() => setTab("execution")} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm">查看执行<ChevronRight className="size-4" /></button>}
            </div>
          </div>
        </div>}
        {!loading && tab === "execution" && <section className={`mt-6 ${inputSection}`}>
          <h2 className="text-lg font-semibold">交易执行时间轴</h2>
          {!canExecute && <p className="mt-4 text-sm text-slate-400">请先确认交易计划。仅观察记录不允许新增成交。</p>}
          {trade && <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: "当前持仓数量", value: formatPrice(trade.metrics.remaining) },
              { label: "持仓均价（含入场费用）", value: formatPrice(trade.metrics.averageEntry) },
              { label: "已实现盈亏", value: formatPrice(trade.metrics.realizedPnl) + " " + trade.plan.currency },
            ].map((item) => <div className="rounded-xl bg-white/[0.04] p-4" key={item.label}><p className="text-xs text-slate-500">{item.label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{item.value}</p></div>)}
          </div>}
          <div className="mt-5 space-y-3">{trade?.executions.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-4">
            <div><p className="text-sm font-medium">{item.action === "entry" ? "开仓" : "平仓"} · {formatPrice(item.quantity)} @ {formatPrice(item.price)}</p>
              <p className="mt-1 text-xs text-slate-500">{new Date(item.at).toLocaleString("zh-CN")} · 手续费 {formatPrice(item.fee)} · {item.note || "无备注"}</p></div>
            <button disabled={actionsDisabled} onClick={() => { setExecution(item); setEditExecution(true); }} className="text-xs text-cyan-300 disabled:opacity-50">更正</button>
          </div>)}</div>
          {canExecute && <div className="mt-6 border-t border-white/10 pt-6">
            <h3 className="font-medium">{editExecution ? "更正成交（保留原版本）" : "新增成交"}</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <InputField title="操作"><Select value={execution.action} options={[{ label: "开仓 / 加仓", value: "entry" }, { label: "平仓 / 减仓", value: "exit" }]} onChange={(v) => setExecution((p) => ({ ...p, action: v as TradeExecution["action"] }))} /></InputField>
              <InputField title="成交时间"><input type="datetime-local" className={field} value={localDatetime(execution.at)} onChange={(e) => { if (e.target.value) setExecution((p) => ({ ...p, at: readDatetime(e.target.value) })); }} /></InputField>
              {([{ key: "price", label: "成交价" }, { key: "quantity", label: "成交数量" }, { key: "fee", label: "手续费" }] as const).map((item) =>
                <InputField title={item.label} key={item.key}><input type="number" min="0" step="any" className={field} value={execution[item.key]} onChange={(e) => setExecution((p) => ({ ...p, [item.key]: Number(e.target.value) }))} /></InputField>)}
              <InputField title="操作原因"><input maxLength={500} className={field} placeholder="计划入场 / 计划止盈 / 临时加仓" value={execution.note} onChange={(e) => setExecution((p) => ({ ...p, note: e.target.value }))} /></InputField>
            </div>
            <div className="mt-5 flex gap-2">
              <button disabled={actionsDisabled} type="button" onClick={() => void addExecution()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"><Plus className="size-4" />{editExecution ? "保存更正" : "追加成交"}</button>
              {editExecution && <button type="button" onClick={() => { setExecution(newExecution()); setEditExecution(false); }} className="rounded-xl border border-white/10 px-4 py-3 text-sm">取消</button>}
            </div>
          </div>}
          {trade?.status === "closed" && <button type="button" onClick={() => setTab("review")} className="mt-5 inline-flex items-center gap-2 text-sm text-cyan-200">已平仓，前往复盘<ChevronRight className="size-4" /></button>}
        </section>}
        {!loading && tab === "review" && <section className={`mt-6 ${inputSection}`}>
          <h2 className="text-lg font-semibold">交易复盘</h2>
          {trade && <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white/[0.04] p-4"><p className="text-xs text-cyan-300">首次确认的计划</p><p className="mt-2 text-sm">入场价 {formatPrice(trade.planHistory[0]?.plan.entry)}</p><p className="mt-1 text-sm">止损价 {formatPrice(trade.planHistory[0]?.plan.stop)}</p><p className="mt-1 text-sm">目标价 {formatPrice(trade.planHistory[0]?.plan.target)}</p>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-400">{trade.planHistory[0]?.plan.trigger || "尚未确认计划"}</p></div>
            <div className="rounded-xl bg-white/[0.04] p-4"><p className="text-xs text-cyan-300">实际成交结果</p><p className="mt-2 text-sm">已实现盈亏 {formatPrice(trade.metrics.realizedPnl)} {trade.plan.currency}</p><p className="mt-1 text-sm">R 倍数 {formatPrice(trade.metrics.realizedR)}</p><p className="mt-1 text-sm">成交记录 {trade.executions.length} 条</p></div>
          </div>}
          {!trade || !["closed", "skipped"].includes(trade.status) ? <p className="mt-5 text-sm text-slate-400">交易全部平仓或标记为未成交后，可以填写最终复盘。</p> :
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <InputField title="是否符合预期"><Select value={review.expectation} onChange={(v) => setReview((r) => ({ ...r, expectation: v as TradeReview["expectation"] }))} options={[{ label: "符合", value: "yes" }, { label: "部分符合", value: "partial" }, { label: "不符合", value: "no" }]} /></InputField>
                <InputField title="计划执行纪律"><Select value={review.discipline} onChange={(v) => setReview((r) => ({ ...r, discipline: v as TradeReview["discipline"] }))} options={[{ label: "完全遵守", value: "full" }, { label: "部分偏离", value: "partial" }, { label: "明显违反", value: "violated" }]} /></InputField>
                <InputField title="执行评分（1～5）"><Select value={String(review.score)} onChange={(v) => setReview((r) => ({ ...r, score: Number(v) }))} options={[1,2,3,4,5].map((v) => ({ label: String(v), value: String(v) }))} /></InputField>
              </div>
              <div><p className="text-xs font-medium text-slate-300">情绪状态</p><TagChoices values={review.emotions} options={emotionOptions} onChange={(v) => setReview((r) => ({ ...r, emotions: v }))} /></div>
              <div><p className="text-xs font-medium text-slate-300">错误归因</p><TagChoices values={review.mistakes} options={mistakeOptions} onChange={(v) => setReview((r) => ({ ...r, mistakes: v }))} /></div>
              {([{ key: "outcome", title: "实际发生了什么？" }, { key: "learning", title: "经验与改进" }, { key: "replay", title: "如果重新面对当时的信息，我会如何决策？" }] as const).map((item) =>
                <InputField key={item.key} title={item.title}><textarea rows={3} maxLength={4000} className={field} value={review[item.key]} onChange={(e) => setReview((r) => ({ ...r, [item.key]: e.target.value }))} /></InputField>)}
              <button type="button" disabled={actionsDisabled} onClick={() => void saveReview()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"><CheckCircle2 className="size-4" />保存复盘</button>
            </div>}
        </section>}
        {!loading && trade && <section className={`mt-5 ${inputSection}`}>
          <div className="flex items-center gap-2"><Camera className="size-5 text-cyan-300" /><h2 className="text-lg font-semibold">行情截图</h2></div>
          <p className="mt-2 text-xs leading-6 text-slate-500">上传交易时刻的图表或复盘截图，存入私有 OSS；最多 20 张，每张不超过 6 MB。</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trade.attachments.map((item) => <figure key={item.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              {imageUrls[item.id] ? <a href={imageUrls[item.id]} target="_blank" rel="noreferrer"><img alt={item.caption || "行情截图"} src={imageUrls[item.id]} loading="lazy" className="aspect-video w-full object-cover" /></a> :
                <div className="flex aspect-video items-center justify-center text-xs text-slate-500">读取图片中…</div>}
              <figcaption className="px-3 py-3 text-xs text-slate-400">{item.phase === "plan" ? "交易计划" : item.phase === "execution" ? "交易执行" : "复盘"} · {item.caption || "未添加备注"}</figcaption>
            </figure>)}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <InputField title="图片阶段"><Select value={phase} onChange={(v) => setPhase(v as TradePhase)} options={[{ label: "交易前", value: "plan" }, { label: "交易中", value: "execution" }, { label: "交易后", value: "review" }]} /></InputField>
            <InputField title="图片备注"><input className={field} maxLength={200} placeholder="例如：周线颈线支撑" value={caption} onChange={(e) => setCaption(e.target.value)} /></InputField>
            <InputField title="选择图片"><input type="file" accept="image/jpeg,image/png,image/webp" className={field} onChange={(e) => setImage(e.target.files?.[0] ?? null)} /></InputField>
          </div>
          <button type="button" disabled={actionsDisabled || !image || trade.attachments.length >= 20} onClick={() => void uploadImage()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 px-4 py-3 text-sm text-cyan-200 disabled:opacity-40">
            {busy === "upload" ? <RotateCcw className="size-4 animate-spin" /> : <Camera className="size-4" />}上传截图
          </button>
        </section>}
        {trade && <p className="mt-6 text-xs leading-6 text-slate-500">计划首次确认后保留原版，后续修订和成交通知写入历史。该模块仅供私人交易记录与复盘使用。</p>}
      </div>
    </main>
  );
}
export default function TradingEditor(): JSX.Element {
  const access = usePrivateResourceSession();
  if (access.status !== "ready") return <PrivateResourceAccessState error={access.error} status={access.status} />;
  if (access.session?.user.role !== "owner") return <PrivateResourceAccessState error={null} status="forbidden" />;
  return <Editor key={window.location.pathname} session={access.session} />;
}
