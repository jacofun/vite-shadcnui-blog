import { ArrowLeft, ArrowRight, BookOpenText, Filter, Plus, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState, type JSX } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

import PrivateResourceAccessState from "@/components/resources/PrivateResourceAccessState";
import { usePrivateResourceSession } from "@/hooks/usePrivateResourceSession";
import { formatPrice, listTrades, type Trade, type TradeStatus } from "@/lib/trading";

const statusLabels: Record<TradeStatus, string> = {
  draft: "草稿", planned: "待入场", open: "持仓中", closed: "已平仓", skipped: "未成交",
};
function Journal({ session }: { session: NonNullable<ReturnType<typeof usePrivateResourceSession>["session"]> }): JSX.Element {
  const [entries, setEntries] = useState<Trade[]>([]);
  const [filter, setFilter] = useState<"all" | TradeStatus>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    listTrades(session, controller.signal)
      .then((result) => { setEntries(result.entries); setError(""); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "读取失败"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session, refresh]);
  const filtered = useMemo(() => entries.filter((entry) =>
    (filter === "all" || entry.status === filter) &&
    [entry.plan.symbol, entry.plan.name, entry.plan.strategy, ...(entry.notes ?? []).map(n => n.summary)].some((v) => v.toLowerCase().includes(search.toLowerCase().trim())),
  ), [entries, filter, search]);
  const finished = entries.filter((e) => e.status === "closed" && e.plan.recordType === "live");
  const reviewed = entries.filter((e) => e.review);
  const withR = finished.filter((e) => e.metrics.realizedR !== null);
  const meanR = withR.length ? withR.reduce((sum, t) => sum + (t.metrics.realizedR ?? 0), 0) / withR.length : null;
  return (
    <main className="min-h-[calc(100svh-var(--site-header-height))] bg-[#070a12] px-5 py-10 text-slate-100 sm:px-8 sm:py-16">
      <Helmet><title>交易日志 · 私人资源</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <div className="mx-auto max-w-6xl">
        <Link className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-200" to="/resources"><ArrowLeft className="size-4" />返回私人资源</Link>
        <header className="mt-9 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">PRIVATE / TRADING JOURNAL</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">交易日志</h1>
            <p className="mt-4 text-sm leading-7 text-slate-400">记录交易前的判断、实际成交与事后复盘。收益与执行纪律分别评价。</p>
          </div>
          <Link className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-200" to="/resources/trading/new"><Plus className="size-4" />新建交易</Link>
        </header>
        <div className="mt-9 grid gap-3 sm:grid-cols-3">
          {[
            { label: "全部案例", value: String(entries.length), hint: "包括草稿和观察机会" },
            { label: "已完成复盘", value: String(reviewed.length), hint: "已填写执行与经验评价" },
            { label: "实盘平均已实现 R", value: meanR === null ? "—" : `${meanR >= 0 ? "+" : ""}${meanR.toFixed(2)}R`, hint: `${withR.length} 笔已平仓且有初始风险的记录` },
          ].map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-xs text-slate-400">{item.label}</p><p className="mt-3 text-3xl font-semibold tabular-nums">{item.value}</p>
            <p className="mt-2 text-xs text-slate-500">{item.hint}</p>
          </div>)}
        </div>
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">交易记录</h2>
            <button aria-label="刷新交易记录" className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white" onClick={() => { setLoading(true); setRefresh((v) => v + 1); }}><RefreshCw className="size-4" /></button>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input aria-label="搜索标的或策略" className="w-full flex-1 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm outline-none focus:border-cyan-300/40" placeholder="搜索标的、名称或策略…" value={search} onChange={(event) => setSearch(event.target.value)} />
            <label className="flex items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-slate-300"><Filter className="size-4" />
              <select aria-label="按状态筛选" className="bg-transparent py-3 outline-none" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
                <option className="bg-slate-900" value="all">全部状态</option>
                {Object.entries(statusLabels).map(([value, label]) => <option className="bg-slate-900" key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          {error && <p role="alert" className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/[0.06] p-4 text-sm text-rose-200">{error}</p>}
          {loading && <p className="mt-8 text-sm text-slate-400">正在读取交易记录…</p>}
          {!loading && !error && filtered.length === 0 && <div className="mt-5 rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center">
            <BookOpenText className="mx-auto size-8 text-slate-500" /><p className="mt-4 text-sm text-slate-300">{entries.length ? "没有符合条件的记录" : "还没有交易记录"}</p>
            <p className="mt-2 text-xs text-slate-500">从一份交易计划开始，保存当时的判断。</p>
          </div>}
          <div className="mt-5 space-y-3">
            {!loading && filtered.map((trade) => <Link key={trade.id} to={`/resources/trading/${trade.id}`} className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-300/30">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3"><h3 className="text-lg font-semibold">{trade.plan.symbol || "未填写标的"}</h3>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-400">{statusLabels[trade.status]}</span>
                  {trade.review && <span className="text-xs text-emerald-300">已复盘</span>}
                </div>
                <p className="mt-2 text-sm text-slate-400">{[trade.plan.name, trade.plan.strategy, trade.plan.direction === "long" ? "做多" : "做空"].filter(Boolean).join(" · ")}</p>
                {(trade.notes ?? []).length > 0 && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">{trade.notes?.at(-1)?.summary}</p>}
                {trade.metrics.feesComplete === false && <p className="mt-1 text-xs text-amber-200">部分手续费待核实</p>
                <p className="mt-2 text-xs text-slate-500">{new Date(trade.updatedAt).toLocaleString("zh-CN")}</p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{trade.metrics.realizedR === null ? "—" : `${trade.metrics.realizedR >= 0 ? "+" : ""}${formatPrice(trade.metrics.realizedR)}R`}</p>
                  <p className="mt-1 text-xs text-slate-500">已实现 R</p>
                </div>
                <ArrowRight className="size-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
              </div>
            </Link>)}
          </div>
        </section>
      </div>
    </main>
  );
}
export default function TradingJournal(): JSX.Element {
  const access = usePrivateResourceSession();
  if (access.status !== "ready") return <PrivateResourceAccessState error={access.error} status={access.status} />;
  if (access.session?.user.role !== "owner") return <PrivateResourceAccessState error={null} status="forbidden" />;
  return <Journal session={access.session} />;
}
