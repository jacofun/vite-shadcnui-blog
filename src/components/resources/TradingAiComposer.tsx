import { useRef, useState, type JSX } from "react";
import { Check, ChevronDown, ChevronUp, LoaderCircle, MessageSquareText, Send, Sparkles, Clock3 } from "lucide-react";

import type { PrivateAuthSession } from "@/lib/privateAuth";
import {
  applyTradingNarrative, formatPrice, parseTradingNarrative,
  type Trade, type TradeAiParseResponse,
} from "@/lib/trading";

interface Props {
  session: PrivateAuthSession;
  trade: Trade | null;
  onApplied: (trade: Trade) => void;
}

function datetime(value: string | null | undefined, timezone = "Asia/Shanghai"): string {
  if (!value) return "时间未提供";
  return new Date(value).toLocaleString("zh-CN", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

const phaseLabels: Record<string, string> = {
  plan: "交易计划", execution: "执行过程", review: "交易复盘", mixed: "完整交易", note: "行情观察",
};
const textBox = "w-full resize-y rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60";

export default function TradingAiComposer({ session, trade, onApplied }: Props): JSX.Element {
  const [raw, setRaw] = useState("");
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [pending, setPending] = useState<{ raw: string; parsed: TradeAiParseResponse; noteId: string } | null>(null);
  const [busy, setBusy] = useState<"parse" | "apply" | "">("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const createId = useRef(crypto.randomUUID());

  async function parse(): Promise<void> {
    if (!raw.trim() || busy) return;
    setBusy("parse"); setError(""); setSuccess(""); setPending(null);
    try {
      const parsed = await parseTradingNarrative(session, raw.trim(), timezone, trade?.id);
      setPending({ raw: raw.trim(), parsed, noteId: crypto.randomUUID() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI解析失败");
    } finally {
      setBusy("");
    }
  }

  async function apply(): Promise<void> {
    if (!pending || busy) return;
    setBusy("apply"); setError("");
    try {
      const result = await applyTradingNarrative(session, {
        id: trade?.id, revision: trade?.revision,
        createId: createId.current, noteId: pending.noteId, raw: pending.raw,
        referenceAt: pending.parsed.referenceAt,
        timezone: pending.parsed.timezone, proposal: pending.parsed.proposal,
        defaultRisk: 1,
      });
      onApplied(result.trade);
      setSuccess([
        "原文与AI摘要已保存",
        result.applied.executions ? "记录成交" + result.applied.executions + "笔" : "",
        result.applied.events ? "记录事件" + result.applied.events + "条" : "",
        result.missing.length ? "部分数据等待补充：" + result.missing.join("；") : "",
      ].filter(Boolean).join(" · "));
      setRaw(""); setPending(null); setShowHistory(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试；重复提交不会重复创建成交");
    } finally {
      setBusy("");
    }
  }
  const proposal = pending?.parsed.proposal;
  const notes = trade?.notes ?? [];
  const timeline = trade?.timeline ?? [];

  return (
    <section className="mt-7 space-y-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.035] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-cyan-300" />
        <h2 className="text-lg font-semibold">AI 自然语言交易日志</h2>
      </div>
      <p className="text-sm leading-7 text-slate-400">
        直接描述交易计划、实际成交、移动止损和复盘感受。AI整理后确认写入；未提供的成交价格、数量或时间不会自动编造。
      </p>
      <textarea
        aria-label="自然语言交易记录"
        className={textBox} rows={5} maxLength={5000}
        placeholder="例如：昨天晚上10点20分我在71500开空BTCUSDT，数量0.001 BTC。此前4小时均线空头排列，70000附近存在多头强平区……"
        value={raw}
        onChange={e => { setRaw(e.target.value); setPending(null); setError(""); }}
        disabled={Boolean(busy)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-400">
          交易时区
          <select aria-label="交易时间时区" value={timezone} onChange={e => { setTimezone(e.target.value); setPending(null); }}
            className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-slate-200">
            <option value="Asia/Shanghai">北京时间</option>
            <option value="Asia/Tokyo">东京时间</option>
            <option value="UTC">UTC</option>
          </select>
        </label>
        <button type="button" disabled={!raw.trim() || Boolean(busy)} onClick={() => void parse()}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40">
          {busy === "parse" ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
          AI整理记录
        </button>
      </div>
      {error && <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-400/[0.08] p-3 text-sm text-rose-200">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-300/[0.06] p-3 text-sm text-emerald-200">{success}</p>}
      {pending && proposal && <div className="space-y-4 rounded-xl border border-cyan-300/20 bg-slate-950/60 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-medium text-white">AI整理预览</h3>
          <span className="rounded-full border border-cyan-300/20 px-2.5 py-1 text-xs text-cyan-200">{phaseLabels[proposal.phase]}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{proposal.summary || "本次描述已解析，请检查下方提取信息。"}</p>
        {Object.keys(proposal.plan).length > 0 && <div className="rounded-xl bg-white/[0.04] p-3">
          <h4 className="mb-3 text-xs font-semibold text-cyan-300">识别的交易计划信息</h4>
          <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
            {Object.entries({
              "交易品种": proposal.plan.symbol,
              "方向": proposal.plan.direction === "long" ? "做多" : proposal.plan.direction === "short" ? "做空" : undefined,
              "策略": proposal.plan.strategy, "周期": proposal.plan.timeframe,
              "入场价": proposal.plan.entry, "止损价": proposal.plan.stop,
              "目标价": proposal.plan.target, "计划数量": proposal.plan.plannedQuantity,
              "风险金额": proposal.plan.plannedRisk,
            }).filter(([, value]) => value !== undefined && value !== "").map(([label, value]) =>
              <p key={label}><span className="text-slate-500">{label}：</span>{String(value)}</p>)}
          </div>
          {(proposal.plan.thesis || proposal.plan.trigger || proposal.plan.invalidation) &&
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
              {[proposal.plan.thesis, proposal.plan.trigger, proposal.plan.invalidation].filter(Boolean).join("\n")}
            </p>}
          {trade && trade.status !== "draft" && <p className="mt-3 text-xs text-amber-200">已确认计划不会被AI自动覆盖，新增的计划描述只作为补充记录。</p>}
        </div>}
        {proposal.executions.length > 0 && <div className="space-y-2">
          <h4 className="text-xs font-semibold text-cyan-300">识别的实际成交</h4>
          {proposal.executions.map((e, i) => <div key={i} className="rounded-lg border border-white/10 p-3 text-sm">
            {e.action === "entry" ? "开仓" : "平仓"} · {e.price == null ? "价格未知" : formatPrice(e.price)}
            {" · "}{e.quantity != null ? formatPrice(e.quantity) : e.quantityMode === "all" ? "当前全部仓位" : e.quantityMode === "half" ? "当前仓位一半" : "数量未知"}
            {" · "}{datetime(e.at, pending.parsed.timezone)}
            {e.fee === null && <span className="ml-2 text-xs text-amber-200">手续费未知</span>}
          </div>)}
        </div>}
        {proposal.events.length > 0 && <div className="space-y-2">
          <h4 className="text-xs font-semibold text-cyan-300">持仓过程与事件</h4>
          {proposal.events.map((e, i) => <p className="text-sm text-slate-300" key={i}>
            {e.at ? datetime(e.at, pending.parsed.timezone) + " · " : ""}{e.summary}
          </p>)}
        </div>}
        {proposal.review && <div className="rounded-xl bg-white/[0.04] p-3">
          <h4 className="text-xs font-semibold text-cyan-300">AI复盘总结</h4>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
            {[proposal.review.outcome, proposal.review.learning, proposal.review.replay].filter(Boolean).join("\n")}
          </p>
        </div>}
        {pending.parsed.mentions.length > 0 && <div className="flex flex-wrap gap-2">
          {pending.parsed.mentions.map((m, i) => <span key={i} className="rounded-lg bg-white/[0.05] px-2 py-1 text-xs text-slate-300">
            <Clock3 className="mr-1 inline size-3" />{m.original} → {m.resolved}
          </span>)}
        </div>}
        {[...proposal.missing, ...proposal.warnings].length > 0 && <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.04] p-3 text-sm leading-6 text-amber-100">
          {[...proposal.missing, ...proposal.warnings].map((m, i) => <p key={i}>· {m}</p>)}
        </div>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" disabled={Boolean(busy)} onClick={() => setPending(null)}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300">修改原文</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void apply()}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
            {busy === "apply" ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
            确认并写入日志
          </button>
        </div>
      </div>}
      {trade && <div className="border-t border-white/10 pt-4">
        <button type="button" className="flex w-full items-center justify-between text-sm text-slate-300"
          onClick={() => setShowHistory(v => !v)}>
          <span className="flex items-center gap-2"><MessageSquareText className="size-4" />自然语言记录与事件（{notes.length}条）</span>
          {showHistory ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {showHistory && <div className="mt-4 space-y-3">
          {notes.length === 0 && <p className="text-sm text-slate-500">尚无自然语言记录。原有表单数据仍然保留。</p>}
          {[...notes].reverse().map(note => <article key={note.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs text-cyan-300">{phaseLabels[note.phase]} · {datetime(note.createdAt, note.timezone)}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{note.summary}</p>
            <details className="mt-3 text-xs text-slate-400">
              <summary className="cursor-pointer">查看原始描述</summary>
              <p className="mt-2 whitespace-pre-wrap leading-6">{note.raw}</p>
            </details>
            {note.missing.length > 0 && <p className="mt-2 text-xs leading-6 text-amber-200">待补充：{note.missing.join("；")}</p>}
          </article>)}
          {timeline.length > 0 && <div className="rounded-xl border border-white/10 p-4">
            <h4 className="mb-3 text-sm font-medium">持仓事件时间轴</h4>
            {[...timeline].sort((a, b) => (a.at || a.recordedAt).localeCompare(b.at || b.recordedAt)).map(e =>
              <p className="mt-2 text-xs leading-6 text-slate-300" key={e.id}>
                <span className="text-slate-500">{datetime(e.at || e.recordedAt, timezone)} · </span>{e.summary}
              </p>)}
          </div>}
        </div>}
      </div>}
    </section>
  );
}
