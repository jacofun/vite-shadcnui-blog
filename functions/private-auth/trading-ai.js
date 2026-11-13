const ZONES = { "Asia/Shanghai": "+08:00", "Asia/Tokyo": "+09:00", UTC: "+00:00" };
export class TradingAiError extends Error {
  constructor(statusCode, code, message) { super(message); Object.assign(this, { statusCode, code }); }
}
const string = (v, n = 1200) => typeof v === "string" ? v.trim().slice(0, n) : "";
const number = (v) => typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
const date = (v) => typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
const pick = (v, choices) => choices.includes(v) ? v : null;
const strings = (v) => Array.isArray(v) ? [...new Set(v.filter(x => typeof x === "string").map(x => string(x, 100)).filter(Boolean))].slice(0, 12) : [];
function hour(text) {
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text);
  const digits = "零一二三四五六七八九";
  if (text === "十") return 10;
  const p = text.split("十");
  if (p.length === 2) {
    const a = p[0] ? digits.indexOf(p[0]) : 1;
    const b = p[1] ? digits.indexOf(p[1]) : 0;
    if (a > 0 && b >= 0) return a * 10 + b;
  }
  return text.length === 1 && digits.indexOf(text) >= 0 ? digits.indexOf(text) : null;
}
export function annotateTradingTimes(text, now, zone = "Asia/Shanghai") {
  if (!Object.hasOwn(ZONES, zone)) zone = "Asia/Shanghai";
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  const p = Object.fromEntries(fmt.formatToParts(new Date(now)).map(x => [x.type, x.value]));
  const midnight = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day));
  const expression = /(大前天|前天|昨天|今天)(?:的)?\s*(凌晨|早上|上午|中午|下午|傍晚|晚上|夜里)?\s*(?:(\d{1,2}|[零一二三四五六七八九十]{1,3})[点时](?:(\d{1,2})分?)?|(\d{1,2}):(\d{2}))?/g;
  const mentions = [];
  const annotated = text.replace(expression, (original, day, period, h1, m1, h2, m2) => {
    const shift = { 今天: 0, 昨天: -1, 前天: -2, 大前天: -3 }[day];
    const ymd = new Date(midnight + shift * 86400000).toISOString().slice(0, 10);
    let h = hour(h1 || h2);
    const m = Number(m1 || m2 || 0);
    let resolved = ymd;
    if (h !== null && h < 24 && m < 60) {
      if (["下午", "傍晚", "晚上", "夜里"].includes(period) && h < 12) h += 12;
      if (period === "中午" && h < 11) h += 12;
      if (period === "凌晨" && h === 12) h = 0;
      resolved += "T" + String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":00" + ZONES[zone];
    }
    mentions.push({ original: original.trim(), resolved });
    return original + " [日期校准:" + resolved + "]";
  });
  return { annotated, mentions, timezone: zone };
}
export function normalizeTradingAiProposal(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TradingAiError(502, "TRADING_AI_INVALID", "模型未返回有效结构");
  const source = value.plan && typeof value.plan === "object" ? value.plan : {};
  const plan = {};
  for (const key of ["symbol", "name", "strategy", "timeframe", "thesis", "trigger", "invalidation", "stopReason", "holdingPeriod", "account"]) {
    if (string(source[key])) plan[key] = string(source[key], 1800);
  }
  if (plan.symbol) plan.symbol = plan.symbol.toUpperCase();
  for (const key of ["entry", "stop", "target", "plannedQuantity", "plannedRisk"]) if (number(source[key])) plan[key] = number(source[key]);
  for (const [key, list] of Object.entries({ direction: ["long", "short"], trend: ["up", "down", "range"], recordType: ["live", "paper", "observation"] })) {
    if (pick(source[key], list)) plan[key] = source[key];
  }
  if (Array.isArray(source.signals)) plan.signals = strings(source.signals);
  if (date(source.setupAt)) plan.setupAt = date(source.setupAt);
  const executions = Array.isArray(value.executions) ? value.executions.slice(0, 12).flatMap(e =>
    e && pick(e.action, ["entry", "exit"]) ? [{
      action: e.action, at: date(e.at), price: number(e.price), quantity: number(e.quantity),
      quantityMode: pick(e.quantityMode, ["explicit", "all", "half", "unknown"]) || "unknown",
      fee: typeof e.fee === "number" && Number.isFinite(e.fee) && e.fee >= 0 ? e.fee : null,
      note: string(e.note, 500),
    }] : []) : [];
  const events = Array.isArray(value.events) ? value.events.slice(0, 16).flatMap(e =>
    e && string(e.summary) ? [{ kind: pick(e.kind, ["stop_moved", "target_moved", "emotion", "market", "other"]) || "other",
      at: date(e.at), summary: string(e.summary, 600) }] : []) : [];
  const r = value.review && typeof value.review === "object" ? value.review : null;
  const review = r ? {
    expectation: pick(r.expectation, ["yes", "partial", "no", "unknown"]) || "unknown",
    discipline: pick(r.discipline, ["full", "partial", "violated", "unknown"]) || "unknown",
    score: Number.isInteger(r.score) && r.score >= 1 && r.score <= 5 ? r.score : null,
    emotions: strings(r.emotions), mistakes: strings(r.mistakes),
    outcome: string(r.outcome, 3000), learning: string(r.learning, 3000), replay: string(r.replay, 3000),
  } : null;
  return { phase: pick(value.phase, ["plan", "execution", "review", "mixed", "note"]) || "note",
    summary: string(value.summary, 2000), plan, executions, events, review,
    missing: strings(value.missing), warnings: strings(value.warnings) };
}
const SYSTEM = [
  "你是私人交易日志的事实提取器。仅从用户原话和已有记录提取事实，不得编造任何价格、时间、数量、费用、止盈止损、情绪或行情。",
  "只输出JSON对象，不要Markdown。所有自然语言内容用简体中文。",
  "JSON顶层字段严格为phase,summary,plan,executions,events,review,missing,warnings。phase可为plan/execution/review/mixed/note。",
  "plan是已知字段组成的对象，可用字段symbol,name,strategy,timeframe,thesis,trigger,invalidation,stopReason,holdingPeriod,account,direction,trend,recordType,signals,entry,stop,target,plannedQuantity,plannedRisk,setupAt。未提供的字段省略；setupAt若无确定时间则省略。",
  "direction只可long/short，trend只可up/down/range，recordType只可live/paper/observation。",
  "executions是实际成交事件数组，每项包含action(entry/exit),at(ISO8601或null),price(数字或null),quantity(数字或null),quantityMode(explicit/all/half/unknown),fee(数字或null),note。计划入场不等于实际成交；全部平仓quantityMode=all，平半仓为half。",
  "events是非成交事件数组，每项kind(stop_moved/target_moved/emotion/market/other),at(ISO8601或null),summary。",
  "review为null或对象，字段expectation(yes/partial/no/unknown),discipline(full/partial/violated/unknown),score(1到5或null),emotions,mistakes,outcome,learning,replay。没有证据不得评分或者断言纪律违规。",
  "missing和warnings是字符串数组。描述是回忆时不可冒充事前确认的计划。系统标注的[日期校准]为权威参考，没有具体时分就不要补造。",
].join("\n");
export async function parseTradingNarrative({ body, trade, nowSeconds, modelConfig, fetchImpl, signal }) {
  const raw = string(body?.text, 5001);
  if (!raw || raw.length > 5000) throw new TradingAiError(400, "TRADING_AI_INPUT", "请输入不超过5000字的交易描述");
  const referenceAt = new Date(nowSeconds * 1000).toISOString();
  const times = annotateTradingTimes(raw, nowSeconds * 1000, body?.timezone);
  const context = trade ? { status: trade.status, plan: trade.plan, originalPlan: trade.planHistory?.[0]?.plan || null,
    executions: trade.executions?.slice(-30), notes: trade.notes?.slice(-6), metrics: trade.metrics } : null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), modelConfig.timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetchImpl(modelConfig.endpoint, {
      method: "POST",
      headers: { Authorization: "Bearer " + modelConfig.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelConfig.model, enable_thinking: false, temperature: 0,
        response_format: { type: "json_object" }, max_tokens: 2400,
        messages: [{ role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify({ referenceAt, timezone: times.timezone, currentTrade: context, text: times.annotated }) }] }),
      signal: controller.signal,
    });
    if (!response.ok) throw new TradingAiError(502, "TRADING_AI_UPSTREAM", "AI处理交易记录失败");
    const data = await response.json();
    const output = data?.choices?.[0]?.message?.content;
    if (typeof output !== "string" || output.length > 30000) throw new TradingAiError(502, "TRADING_AI_INVALID", "模型输出格式无效");
    let parsed;
    try { parsed = JSON.parse(output); } catch { throw new TradingAiError(502, "TRADING_AI_INVALID", "模型返回的JSON格式无效"); }
    return { proposal: normalizeTradingAiProposal(parsed), referenceAt, timezone: times.timezone, mentions: times.mentions, model: modelConfig.model };
  } catch (e) {
    if (e?.name === "AbortError") throw new TradingAiError(504, "TRADING_AI_TIMEOUT", "交易日志AI处理超时");
    if (e instanceof TradingAiError) throw e;
    throw new TradingAiError(502, "TRADING_AI_UPSTREAM", "交易日志AI暂时不可用");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
