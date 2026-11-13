import {
  TradeError, planFrom, confirmable, emptyDocument, validDocument, getTrade,
  requireRevision, executionFrom, calculateTrade, recordEvent,
} from "./trading.js";
import { normalizeTradingAiProposal } from "./trading-ai.js";

const ID = /^[a-f0-9-]{16,40}$/i;
const isId = (value) => typeof value === "string" && ID.test(value);
const metrics = (trade) => ({ ...trade, metrics: calculateTrade(trade) });
const error = (code, message, status = 400) => { throw new TradeError(status, code, message); };
const iso = (value) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;

export async function applyAiTradingNarrative({ body, user, config, contentStore, nowSeconds, randomBytesImpl }) {
  if (user.role !== "owner") error("MISSING_PERMISSION", "仅所有者可保存交易记录", 403);
  if (!contentStore) error("CONTENT_STORE_UNAVAILABLE", "交易存储不可用", 503);
  if (!isId(body?.noteId) || typeof body.raw !== "string" || !body.raw.trim() || body.raw.length > 5000) {
    error("INVALID_AI_NOTE", "交易原文或编号无效");
  }
  const proposal = normalizeTradingAiProposal(body.proposal);
  const now = new Date(nowSeconds * 1000).toISOString();
  const referenceAt = iso(body.referenceAt) || now;
  const timezone = ["Asia/Shanghai", "Asia/Tokyo", "UTC"].includes(body.timezone) ? body.timezone : "Asia/Shanghai";
  const path = config.privateRoot + "/.trading/owner/entries.json";
  let result;
  await contentStore.updateJson(path, { missing: emptyDocument(), validate: validDocument }, document => {
    const existing = body.id ? getTrade(document, body.id) :
      (isId(body.createId) ? document.entries.find(t => t.id === body.createId) : null);
    if (existing?.notes?.some(n => n.id === body.noteId)) {
      result = { trade: metrics(existing), applied: { executions: 0, events: 0, duplicate: true }, missing: [] };
      return document;
    }
    if (existing && !body.id) error("TRADE_CONFLICT", "交易创建编号已存在，请刷新记录", 409);
    if (existing) requireRevision(existing, body.revision);
    let trade = existing;
    const isRetroactive = proposal.executions.length > 0;
    if (!trade) {
      if (!proposal.plan.symbol || !proposal.plan.direction) {
        error("INCOMPLETE_AI_PLAN", "新交易请明确品种和做多、做空方向");
      }
      const id = body.createId;
      if (!isId(id)) error("INVALID_ID", "交易创建编号无效");
      if (document.entries.some(t => t.id === id)) error("TRADE_CONFLICT", "交易编号已存在", 409);
      if (document.entries.length >= 300) error("TRADE_LIMIT", "交易日志容量达到上限", 409);
      const crypto = proposal.plan.symbol.endsWith("USDT");
      const initialPlan = {
        symbol: proposal.plan.symbol, market: crypto ? "crypto" : "other",
        direction: proposal.plan.direction, recordType: "live",
        strategy: "", timeframe: "", trend: "range", currency: crypto ? "USDT" : "USD",
        setupAt: referenceAt, ...proposal.plan,
      };
      if (!isRetroactive && !initialPlan.plannedRisk && typeof body.defaultRisk === "number" &&
          body.defaultRisk > 0 && body.defaultRisk <= 10000) {
        initialPlan.plannedRisk = body.defaultRisk;
      }
      trade = {
        id, revision: 1, status: "draft", createdAt: now, updatedAt: now,
        plan: planFrom(initialPlan), planHistory: [], executions: [],
        attachments: [], pendingImages: [], events: [{ type: "created", at: now }],
        notes: [], timeline: [],
      };
      document.entries.push(trade);
    } else if (trade.status === "draft" && Object.keys(proposal.plan).length) {
      trade.plan = planFrom({ ...trade.plan, ...proposal.plan });
      recordEvent(trade, "ai_draft_updated", now);
    }
    let blockedPlanChanges = false;
    if (existing && existing.status !== "draft" && Object.keys(proposal.plan).length) {
      const retrospective = trade.planHistory[0]?.origin === "retrospective_ai_record";
      const supplement = { ...trade.plan };
      let supplemented = false;
      for (const [key, value] of Object.entries(proposal.plan)) {
        if (JSON.stringify(trade.plan[key]) === JSON.stringify(value)) continue;
        const oldValue = trade.plan[key];
        const blank = oldValue === null || oldValue === undefined || oldValue === "" ||
          (Array.isArray(oldValue) && oldValue.length === 0);
        if (retrospective && blank && key !== "direction" && key !== "symbol") {
          supplement[key] = value;
          supplemented = true;
        } else {
          blockedPlanChanges = true;
        }
      }
      if (supplemented) {
        if (trade.planHistory.length >= 30) error("HISTORY_FULL", "计划修订数量达到上限", 409);
        trade.plan = planFrom(supplement);
        trade.planHistory.push({ version: trade.planHistory.length + 1, confirmedAt: now,
          plan: structuredClone(trade.plan), origin: "retrospective_ai_supplement" });
        recordEvent(trade, "retrospective_plan_supplemented", now);
      }
    }
    if (trade.plan.entry && trade.plan.stop &&
        (trade.plan.direction === "long" ? trade.plan.stop >= trade.plan.entry : trade.plan.stop <= trade.plan.entry)) {
      error("INVALID_STOP", "止损位置与交易方向不符");
    }
    if (trade.status === "draft") {
      if (isRetroactive) {
        trade.status = "planned";
        trade.planHistory.push({ version: 1, confirmedAt: now, plan: structuredClone(trade.plan),
          origin: "retrospective_ai_record" });
        recordEvent(trade, "retrospective_plan_recorded", now);
      } else {
        try {
          confirmable(trade.plan);
          trade.status = "planned";
          trade.planHistory.push({ version: 1, confirmedAt: now, plan: structuredClone(trade.plan),
            origin: "ai_narrative_recorded_now" });
          recordEvent(trade, "ai_plan_confirmed", now);
        } catch (e) {
          if (!(e instanceof TradeError && e.code === "INCOMPLETE_PLAN")) throw e;
        }
      }
    }
    trade.notes ??= [];
    trade.timeline ??= [];
    if (trade.notes.length >= 300) error("AI_NOTE_LIMIT", "当前交易的自然语言记录已达到容量上限", 409);
    const note = {
      id: body.noteId, raw: body.raw.trim(), summary: proposal.summary,
      phase: proposal.phase, referenceAt, timezone, createdAt: now,
      missing: [...proposal.missing], warnings: [...proposal.warnings],
    };
    trade.notes.push(note);
    let addedExecutions = 0;
    let addedEvents = 0;
    const missing = [];
    for (const proposed of proposal.executions) {
      if (trade.status === "draft" || trade.status === "skipped" || trade.plan.recordType === "observation") {
        missing.push("需先补充可确认的交易计划，已保留成交原文");
        break;
      }
      const remaining = calculateTrade(trade).remaining;
      const qty = proposed.quantity ?? (proposed.action === "exit" && proposed.quantityMode === "all" ? remaining :
        proposed.action === "exit" && proposed.quantityMode === "half" ? remaining / 2 : null);
      if (!proposed.at || !proposed.price || !qty) {
        missing.push("某笔实际成交缺少明确的时间、价格或数量，暂未计入盈亏");
        continue;
      }
      if (proposed.action === "entry" && trade.status === "closed") {
        missing.push("已平仓交易不能再次开仓");
        continue;
      }
      if (proposed.action === "exit" && qty > remaining + 1e-8) {
        missing.push("有一笔平仓数量超过已登记持仓，未计入盈亏");
        continue;
      }
      if (trade.executions.some(e => e.action === proposed.action && e.at === proposed.at &&
          Math.abs(e.price - proposed.price) < 1e-8 && Math.abs(e.quantity - qty) < 1e-8)) {
        missing.push("同一时间、价格与数量的成交已经存在，本次未重复计入");
        continue;
      }
      if (trade.executions.length >= 150) error("EXECUTION_LIMIT", "成交笔数达到上限", 409);
      const execution = executionFrom({
        id: randomBytesImpl(16).toString("hex"),
        action: proposed.action, at: proposed.at, price: proposed.price,
        quantity: qty, fee: proposed.fee ?? 0,
        note: [proposed.note, proposed.fee === null ? "手续费待核实" : ""].filter(Boolean).join("；"),
      });
      execution.feeKnown = proposed.fee !== null;
      trade.executions.push(execution);
      trade.executions.sort((a, b) => a.at.localeCompare(b.at));
      calculateTrade(trade);
      trade.status = calculateTrade(trade).status;
      if (trade.review) delete trade.review;
      addedExecutions++;
    }
    for (const event of proposal.events) {
      if (trade.timeline.length >= 500) error("TIMELINE_LIMIT", "交易事件数达到上限", 409);
      trade.timeline.push({
        id: randomBytesImpl(16).toString("hex"), noteId: body.noteId,
        type: event.kind, at: event.at, summary: event.summary, recordedAt: now,
      });
      addedEvents++;
    }
    if (proposal.review && ["closed", "skipped"].includes(trade.status)) {
      const review = proposal.review;
      if (review.outcome || review.learning || review.replay || review.emotions.length || review.mistakes.length) {
        trade.review = { ...review, updatedAt: now, sourceNoteId: body.noteId };
      }
    } else if (proposal.review) {
      missing.push("尚未结束交易，复盘描述已保存到自然语言记录");
    }
    if (blockedPlanChanges) {
      missing.push("已确认的原计划不可覆盖；与原计划冲突的内容已保留在原始记录中");
    }
    note.missing = [...new Set([...note.missing, ...missing])].slice(0, 20);
    recordEvent(trade, "ai_narrative_saved", now);
    result = { trade: metrics(trade), applied: { executions: addedExecutions, events: addedEvents, duplicate: false },
      missing: note.missing };
    return document;
  });
  return result;
}
