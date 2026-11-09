const MAX_TRADES = 300;
const MAX_EXECUTIONS = 150;
const MAX_ATTACHMENTS = 20;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ID = /^[a-f0-9-]{16,40}$/i;
const MARKETS = ["cn", "hk", "us", "crypto", "other"];
const DIRECTIONS = ["long", "short"];
const RECORD_TYPES = ["live", "paper", "observation"];
const ACTIONS = ["entry", "exit"];
const IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export class TradeError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
const invalid = (field) => { throw new TradeError(400, "INVALID_TRADE", field + " is invalid"); };
const text = (value, limit = 1200) => {
  if (typeof value !== "string" || value.length > limit) invalid("text");
  return value.trim();
};
const choice = (value, options, field) => {
  if (!options.includes(value)) invalid(field);
  return value;
};
const number = (value, field, allowZero = false) => {
  if (value === null || value === "" || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || (allowZero ? value < 0 : value <= 0) || value > 1e13) invalid(field);
  return value;
};
const date = (value, field) => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || value.length > 32) invalid(field);
  return new Date(value).toISOString();
};
const tags = (input) => {
  if (!Array.isArray(input) || input.length > 12) invalid("tags");
  return [...new Set(input.map((tag) => text(tag, 32)).filter(Boolean))];
};
function planFrom(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid("plan");
  return {
    symbol: text(input.symbol ?? "", 40).toUpperCase(),
    name: text(input.name ?? "", 80),
    market: choice(input.market ?? "cn", MARKETS, "market"),
    direction: choice(input.direction ?? "long", DIRECTIONS, "direction"),
    recordType: choice(input.recordType ?? "live", RECORD_TYPES, "recordType"),
    strategy: text(input.strategy ?? "反转", 60),
    timeframe: text(input.timeframe ?? "日线", 32),
    account: text(input.account ?? "", 60),
    currency: text(input.currency ?? "CNY", 12).toUpperCase(),
    setupAt: date(input.setupAt ?? new Date().toISOString(), "setupAt"),
    trend: choice(input.trend ?? "range", ["up", "down", "range"], "trend"),
    signals: tags(input.signals ?? []),
    thesis: text(input.thesis ?? "", 3000),
    trigger: text(input.trigger ?? "", 1800),
    invalidation: text(input.invalidation ?? "", 1800),
    entry: number(input.entry, "entry"),
    stop: number(input.stop, "stop"),
    target: number(input.target, "target"),
    plannedQuantity: number(input.plannedQuantity, "plannedQuantity"),
    plannedRisk: number(input.plannedRisk, "plannedRisk"),
    stopReason: text(input.stopReason ?? "", 400),
    holdingPeriod: text(input.holdingPeriod ?? "", 60),
  };
}
function confirmable(plan) {
  if (!plan.symbol || !plan.strategy || !plan.thesis || !plan.trigger || !plan.invalidation) {
    throw new TradeError(400, "INCOMPLETE_PLAN", "请填写标的、策略、交易逻辑、触发条件及失效条件");
  }
  if (plan.recordType !== "observation") {
    if (plan.entry === null || plan.stop === null) {
      throw new TradeError(400, "INCOMPLETE_PLAN", "实际或模拟交易须填写入场价和止损价");
    }
    if (plan.direction === "long" ? plan.stop >= plan.entry : plan.stop <= plan.entry) {
      throw new TradeError(400, "INVALID_STOP", "止损价必须位于交易方向的不利一侧");
    }
  }
  if (plan.target !== null && plan.entry !== null &&
      (plan.direction === "long" ? plan.target <= plan.entry : plan.target >= plan.entry)) {
    throw new TradeError(400, "INVALID_TARGET", "目标价必须位于交易方向的有利一侧");
  }
}
const emptyDocument = () => ({ schemaVersion: 1, entries: [] });
function validDocument(document) {
  return document?.schemaVersion === 1 && Array.isArray(document.entries) && document.entries.length <= MAX_TRADES &&
    document.entries.every((trade) => typeof trade.id === "string" && ID.test(trade.id) &&
      Number.isSafeInteger(trade.revision) && trade.revision >= 1 &&
      trade.plan && Array.isArray(trade.planHistory) && Array.isArray(trade.executions) &&
      Array.isArray(trade.attachments) && Array.isArray(trade.events));
}
const demandId = (id) => { if (typeof id !== "string" || !ID.test(id)) invalid("id"); return id; };
function getTrade(document, id) {
  const trade = document.entries.find((item) => item.id === demandId(id));
  if (!trade) throw new TradeError(404, "TRADE_NOT_FOUND", "交易记录不存在");
  return trade;
}
function requireRevision(trade, revision) {
  if (trade.revision !== revision) throw new TradeError(409, "STALE_REVISION", "记录已被其他操作修改，请刷新后重试");
}
function executionFrom(input) {
  if (!input || typeof input !== "object") invalid("execution");
  return {
    id: demandId(input.id),
    action: choice(input.action, ACTIONS, "action"),
    at: date(input.at, "execution.at"),
    price: number(input.price, "execution.price"),
    quantity: number(input.quantity, "execution.quantity"),
    fee: number(input.fee ?? 0, "execution.fee", true),
    note: text(input.note ?? "", 500),
  };
}
export function calculateTrade(trade) {
  let remaining = 0;
  let basis = 0;
  let realized = 0;
  let entries = 0;
  const multiplier = trade.plan.direction === "long" ? 1 : -1;
  for (const execution of trade.executions) {
    if (execution.action === "entry") {
      basis = ((basis * remaining) + (execution.price * execution.quantity) +
        (multiplier * execution.fee)) / (remaining + execution.quantity);
      remaining += execution.quantity;
      entries += 1;
    } else {
      if (!entries || execution.quantity > remaining + 1e-8) {
        throw new TradeError(400, "INVALID_POSITION", "平仓数量不能大于当前持仓");
      }
      realized += multiplier * (execution.price - basis) * execution.quantity - execution.fee;
      remaining = Math.max(0, remaining - execution.quantity);
      if (remaining < 1e-8) { remaining = 0; basis = 0; }
    }
  }
  const risk = trade.planHistory[0]?.plan.plannedRisk ??
    ((trade.planHistory[0]?.plan.plannedQuantity ?? 0) *
      Math.abs((trade.planHistory[0]?.plan.entry ?? 0) - (trade.planHistory[0]?.plan.stop ?? 0)));
  const realizedPnl = Math.round(realized * 1e8) / 1e8;
  return {
    remaining, averageEntry: remaining ? basis : null,
    realizedPnl,
    initialRisk: risk || null, realizedR: entries > 0 && risk > 0 ? realizedPnl / risk : null,
    status: trade.status === "draft" || trade.status === "skipped" ? trade.status :
      entries === 0 ? "planned" : remaining > 0 ? "open" : "closed",
  };
}
function withMetrics(trade) { return { ...trade, metrics: calculateTrade(trade) }; }
const nowIso = (nowSeconds) => new Date(nowSeconds * 1000).toISOString();
const recordEvent = (trade, type, at, previous = null) => {
  if (trade.events.length >= 300) throw new TradeError(409, "HISTORY_FULL", "修改历史已达上限");
  trade.events.push({ type, at, ...(previous === null ? {} : { previous }) });
  trade.updatedAt = at;
  trade.revision += 1;
};
const tradingPath = (root) => root + "/.trading/owner/entries.json";

export async function handleTrading({ route, body, user, config, contentStore, nowSeconds, randomBytesImpl }) {
  if (user.role !== "owner") throw new TradeError(403, "MISSING_PERMISSION", "交易日志仅限站点所有者");
  if (!contentStore) throw new TradeError(503, "CONTENT_STORE_UNAVAILABLE", "交易存储不可用");
  const path = tradingPath(config.privateRoot);
  if (route === "trading/list" || route === "trading/get") {
    const document = await contentStore.readJson(path, { missing: emptyDocument() });
    if (!validDocument(document)) throw new TradeError(503, "INVALID_TRADE_INDEX", "交易日志数据校验失败");
    if (route === "trading/get") return { trade: withMetrics(getTrade(document, body.id)) };
    return { entries: document.entries.map(withMetrics).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
  }
  const at = nowIso(nowSeconds);
  let output;
  if (route === "trading/image/complete") {
    const document = await contentStore.readJson(path, { missing: emptyDocument() });
    if (!validDocument(document)) throw new TradeError(503, "INVALID_TRADE_INDEX", "交易日志数据校验失败");
    const trade = getTrade(document, body.id);
    const pending = trade.pendingImages?.find((image) => image.id === body.imageId);
    if (!pending) {
      const existing = trade.attachments.find((image) => image.id === body.imageId);
      if (existing) return { trade: withMetrics(trade) };
      throw new TradeError(404, "IMAGE_NOT_FOUND", "上传任务不存在");
    }
    if (pending.expiresAt < nowSeconds) throw new TradeError(410, "IMAGE_EXPIRED", "上传任务已过期");
    const meta = await contentStore.stat(pending.path);
    if (meta.bytes !== pending.bytes || meta.contentType.split(";")[0] !== pending.contentType) {
      throw new TradeError(400, "INVALID_IMAGE", "上传图片元信息与声明不一致");
    }
    const bytes = await contentStore.readPrefix(pending.path, 16);
    const png = pending.contentType === "image/png" && Buffer.from(bytes).subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpg = pending.contentType === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = pending.contentType === "image/webp" && Buffer.from(bytes).toString("ascii", 0, 4) === "RIFF" &&
      Buffer.from(bytes).toString("ascii", 8, 12) === "WEBP";
    if (!png && !jpg && !webp) throw new TradeError(400, "INVALID_IMAGE", "图片文件格式校验失败");
  }
  await contentStore.updateJson(path, { missing: emptyDocument(), validate: validDocument }, (document) => {
    if (route === "trading/save" && body.revision === undefined) {
      const plan = planFrom(body.plan);
      const id = body.id === undefined ? randomBytesImpl(16).toString("hex") : demandId(body.id);
      const previous = document.entries.find((entry) => entry.id === id);
      if (previous) {
        if (previous.status === "draft" && JSON.stringify(previous.plan) === JSON.stringify(plan)) {
          output = withMetrics(previous);
          return document;
        }
        throw new TradeError(409, "TRADE_CONFLICT", "此交易编号已被使用");
      }
      if (document.entries.length >= MAX_TRADES) throw new TradeError(409, "TRADE_LIMIT", "交易记录已达上限");
      const trade = { id, revision: 1, status: "draft", createdAt: at, updatedAt: at,
        plan, planHistory: [], executions: [], attachments: [], pendingImages: [], events: [{ type: "created", at }] };
      document.entries.push(trade);
      output = withMetrics(trade);
      return document;
    }
    const trade = getTrade(document, body.id);
    if (route === "trading/save") {
      requireRevision(trade, body.revision);
      if (trade.status !== "draft") throw new TradeError(409, "PLAN_LOCKED", "原计划已确认，请使用计划修订");
      const previous = trade.plan;
      trade.plan = planFrom(body.plan);
      recordEvent(trade, "draft_updated", at, previous);
    } else if (route === "trading/confirm" || route === "trading/revise") {
      requireRevision(trade, body.revision);
      if (route === "trading/confirm" && trade.status !== "draft") throw new TradeError(409, "PLAN_LOCKED", "计划已经确认");
      if (route === "trading/revise" && (trade.status === "draft" || trade.status === "skipped" || trade.status === "closed"))
        throw new TradeError(409, "INVALID_STATE", "当前状态不允许修订计划");
      const next = route === "trading/revise" ? planFrom(body.plan) : trade.plan;
      if (trade.executions.length &&
          (next.direction !== trade.plan.direction || next.symbol !== trade.plan.symbol ||
           next.recordType !== trade.plan.recordType)) {
        throw new TradeError(409, "IMMUTABLE_INSTRUMENT", "存在成交后不允许修改标的、方向或账户类型");
      }
      confirmable(next);
      if (trade.planHistory.length >= 30) throw new TradeError(409, "HISTORY_FULL", "计划修订次数已达上限");
      trade.plan = next;
      trade.planHistory.push({ version: trade.planHistory.length + 1, confirmedAt: at, plan: structuredClone(next) });
      if (trade.status === "draft") trade.status = "planned";
      recordEvent(trade, route === "trading/confirm" ? "plan_confirmed" : "plan_revised", at);
    } else if (route === "trading/execution/add" || route === "trading/execution/update") {
      const execution = executionFrom(body.execution);
      const found = trade.executions.findIndex((item) => item.id === execution.id);
      if (route === "trading/execution/add" && found >= 0) {
        if (JSON.stringify(trade.executions[found]) !== JSON.stringify(execution)) {
          throw new TradeError(409, "EXECUTION_CONFLICT", "成交编号已经存在");
        }
        output = withMetrics(trade);
        return document;
      }
      requireRevision(trade, body.revision);
      if (trade.status === "draft" || trade.status === "skipped" || trade.plan.recordType === "observation") {
        throw new TradeError(409, "INVALID_STATE", "当前交易不能添加成交");
      }
      if (trade.status === "closed" && route === "trading/execution/add" && execution.action === "entry") {
        throw new TradeError(409, "TRADE_CLOSED", "交易已经平仓，请创建新交易案例");
      }
      if (route === "trading/execution/add") {
        if (trade.executions.length >= MAX_EXECUTIONS) throw new TradeError(409, "EXECUTION_LIMIT", "成交笔数已达上限");
        trade.executions.push(execution);
        trade.executions.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
        calculateTrade(trade);
        if (trade.review) delete trade.review;
        recordEvent(trade, "execution_added", at);
      } else {
        if (found < 0) throw new TradeError(404, "EXECUTION_NOT_FOUND", "成交记录不存在");
        const previous = trade.executions[found];
        trade.executions[found] = execution;
        trade.executions.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
        calculateTrade(trade);
        if (trade.review) delete trade.review;
        recordEvent(trade, "execution_updated", at, previous);
      }
      trade.status = calculateTrade(trade).status;
    } else if (route === "trading/skip") {
      requireRevision(trade, body.revision);
      if (trade.status !== "planned" || trade.executions.length) throw new TradeError(409, "INVALID_STATE", "只有未成交的已确认计划才能终止");
      trade.status = "skipped";
      recordEvent(trade, "skipped", at);
    } else if (route === "trading/review") {
      requireRevision(trade, body.revision);
      if (!["closed", "skipped"].includes(trade.status)) throw new TradeError(409, "INVALID_STATE", "仅已平仓或未成交的机会可以复盘");
      const input = body.review;
      if (!input || typeof input !== "object") invalid("review");
      const review = {
        expectation: choice(input.expectation, ["yes", "partial", "no"], "expectation"),
        discipline: choice(input.discipline, ["full", "partial", "violated"], "discipline"),
        score: input.score,
        emotions: tags(input.emotions ?? []),
        mistakes: tags(input.mistakes ?? []),
        outcome: text(input.outcome ?? "", 4000),
        learning: text(input.learning ?? "", 4000),
        replay: text(input.replay ?? "", 3000),
        updatedAt: at,
      };
      if (!Number.isInteger(review.score) || review.score < 1 || review.score > 5) invalid("score");
      recordEvent(trade, "review_saved", at, trade.review ?? null);
      trade.review = review;
    } else if (route === "trading/image/init") {
      requireRevision(trade, body.revision);
      if (trade.attachments.length + (trade.pendingImages?.length ?? 0) >= MAX_ATTACHMENTS) {
        throw new TradeError(409, "IMAGE_LIMIT", "图片数量已达上限");
      }
      const type = choice(body.contentType, Object.keys(IMAGE_TYPES), "contentType");
      const bytes = body.bytes;
      if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_IMAGE_BYTES) invalid("bytes");
      const phase = choice(body.phase, ["plan", "execution", "review"], "phase");
      const imageId = randomBytesImpl(16).toString("hex");
      const imagePath = config.privateRoot + "/trading/screenshots/" + trade.id + "/" + imageId + "." + IMAGE_TYPES[type];
      trade.pendingImages = (trade.pendingImages ?? []).filter((image) => image.expiresAt >= nowSeconds);
      trade.pendingImages.push({ id: imageId, path: imagePath, bytes, contentType: type, phase,
        caption: text(body.caption ?? "", 200), expiresAt: nowSeconds + 900 });
      recordEvent(trade, "image_reserved", at);
      output = { imageId, path: imagePath, contentType: type, expiresAt: nowSeconds + 900,
        uploadUrl: contentStore.signUpload(imagePath, { contentType: type }) };
      return document;
    } else if (route === "trading/image/complete") {
      requireRevision(trade, body.revision);
      const index = (trade.pendingImages ?? []).findIndex((image) => image.id === body.imageId);
      if (index < 0) throw new TradeError(404, "IMAGE_NOT_FOUND", "上传任务不存在");
      const [image] = trade.pendingImages.splice(index, 1);
      trade.attachments.push({ id: image.id, path: image.path, contentType: image.contentType,
        phase: image.phase, caption: image.caption, createdAt: at });
      recordEvent(trade, "image_added", at);
    } else {
      throw new TradeError(404, "NOT_FOUND", "交易日志接口不存在");
    }
    output = output ?? withMetrics(trade);
    return document;
  });
  return route === "trading/image/init" ? output : { trade: output };
}
