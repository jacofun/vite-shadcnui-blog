import { DECIMAL_SCALE as SCALE, parseDecimal, formatDecimal } from "./trading-decimal.js";
import { createHash } from "node:crypto";
import { TradeError, planFrom, emptyDocument, validDocument, getTrade, requireRevision, calculateTrade, recordEvent } from "./trading.js";

const fail = (code, message, status = 400) => { throw new TradeError(status, code, message); };
const symbolPattern = /^[A-Z0-9_]{2,40}$/;
const idPattern = /^\d{1,40}$/;
const tradeIdPattern = /^[a-f0-9-]{16,40}$/i;
const documentPath = config => `${config.privateRoot}/.trading/owner/entries.json`;
export function decimal(value) {
  try { return parseDecimal(value); }
  catch { fail("INVALID_BINANCE_DATA", "成交金额格式无效", 503); }
}
export const decimalString = formatDecimal;
const numeric = value => {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > 1e13) fail("INVALID_BINANCE_DATA", "成交数值超出日志支持范围", 503);
  return n;
};

export async function createBinanceSource({ env, credentials, SDK, client }) {
  const prefix = env.BINANCE_DATA_OSS_PREFIX?.trim() || "fc/binance-sync/owner";
  if (prefix.length > 200 || !prefix.split("/").every(p => /^[A-Za-z0-9_-]+$/.test(p))) fail("BINANCE_DATA_CONFIG", "BINANCE_DATA_OSS_PREFIX 配置无效", 503);
  const bucket = env.BINANCE_DATA_OSS_BUCKET?.trim() || env.OSS_CONTENT_BUCKET;
  const region = env.BINANCE_DATA_OSS_REGION?.trim() || env.OSS_CONTENT_REGION;
  const endpoint = env.BINANCE_DATA_OSS_ENDPOINT?.trim() || env.OSS_CONTENT_ENDPOINT;
  if (!bucket || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) || !/^oss-[a-z0-9-]+$/.test(region || "")) fail("BINANCE_DATA_CONFIG", "请配置北京函数的币安数据 Bucket 和地域", 503);
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error();
  } catch { fail("BINANCE_DATA_CONFIG", "币安数据 OSS 端点必须为 HTTPS 根地址", 503); }
  const OSS = SDK || (client ? null : (await import("ali-oss")).default);
  const oss = client || new OSS({ bucket, region, endpoint, ...credentials, secure: true, timeout: 15000 });
  return {
    async read(path) {
      if (path !== "state.json" && !/^usdm\/trades\/[A-Z0-9_]{2,40}\/\d{4}-\d{2}\.json$/.test(path)) fail("INVALID_BINANCE_PATH", "数据路径无效");
      try {
        const result = await oss.get(`${prefix}/${path}`);
        const bytes = Buffer.from(result.content);
        if (bytes.length > 24 * 1024 * 1024) fail("BINANCE_DATA_TOO_LARGE", "单月成交数据过大，请联系维护者分片", 413);
        return JSON.parse(bytes.toString("utf8"));
      } catch (error) {
        if (error?.code === "NoSuchKey") return null;
        if (error instanceof TradeError) throw error;
        fail("BINANCE_DATA_UNAVAILABLE", "读取币安数据失败，请核对北京函数的 OSS 配置及读取权限", 503);
      }
    },
  };
}

function dateStart(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("INVALID_DATE_RANGE", "请选择起止日期");
  const utc = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== value) fail("INVALID_DATE_RANGE", "日期无效");
  return utc - 8 * 3600000;
}
function rangeFrom(body) {
  const start = dateStart(body.startDate);
  const end = dateStart(body.endDate) + 86400000;
  if (end <= start || end - start > 93 * 86400000) fail("INVALID_DATE_RANGE", "每次查询最多 93 天，结束日期不能早于开始日期");
  return { start, end };
}
function normalizeRow(row, symbol, month) {
  if (!row || row.symbol !== symbol || !idPattern.test(row.id) || typeof row.id !== "string" ||
    typeof row.orderId !== "string" || !idPattern.test(row.orderId) || !Number.isSafeInteger(row.time) ||
    !["BUY", "SELL"].includes(row.side) || !["BOTH", "LONG", "SHORT"].includes(row.positionSide) ||
    new Date(row.time).toISOString().slice(0, 7) !== month || typeof row.commissionAsset !== "string") fail("INVALID_BINANCE_DATA", "成交分区中的记录无效", 503);
  if (decimal(row.price) <= 0n || decimal(row.qty) <= 0n) fail("INVALID_BINANCE_DATA", "成交价格和数量必须为正", 503);
  decimal(row.commission); decimal(row.realizedPnl);
  return { id: row.id, orderId: row.orderId, time: row.time, symbol, side: row.side,
    positionSide: row.positionSide, price: row.price, qty: row.qty, commission: row.commission,
    commissionAsset: row.commissionAsset, realizedPnl: row.realizedPnl, maker: row.maker === true };
}
function compareRows(a, b) {
  return a.time - b.time || (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);
}
async function readRows(source, body, state) {
  const { start, end } = rangeFrom(body);
  const symbol = body.symbol;
  if (typeof symbol !== "string" || !symbolPattern.test(symbol) || !Object.hasOwn(state.cursors.trades, symbol)) fail("INVALID_SYMBOL", "请选择已同步的交易对");
  const rows = [];
  const seen = new Set();
  for (const date = new Date(start); date.getTime() < end; date.setUTCFullYear(date.getUTCFullYear(), date.getUTCMonth() + 1, 1), date.setUTCHours(0, 0, 0, 0)) {
    const month = date.toISOString().slice(0, 7);
    const part = await source.read(`usdm/trades/${symbol}/${month}.json`);
    if (!part) continue;
    if (part.schemaVersion !== 1 || part.product !== "usdm" || part.kind !== "trades" || part.binding !== state.binding ||
      part.month !== month || part.symbol !== symbol || !Array.isArray(part.records) || part.records.length > 50000) fail("INVALID_BINANCE_DATA", "成交分区结构或账户绑定不一致", 503);
    for (const value of part.records) {
      const row = normalizeRow(value, symbol, month);
      if (seen.has(row.id)) fail("INVALID_BINANCE_DATA", "成交分区存在重复编号", 503);
      seen.add(row.id);
      if (row.time >= start && row.time < end) rows.push(row);
    }
  }
  return rows.sort(compareRows);
}
async function sourceState(source) {
  const state = await source.read("state.json");
  if (!state) return null;
  if (state.schemaVersion !== 1 || state.product !== "usdm" || !/^[a-f0-9]{64}$/.test(state.binding || "") ||
      !state.cursors?.trades || Array.isArray(state.cursors.trades) || typeof state.cursors.trades !== "object" ||
      Object.keys(state.cursors.trades).some(s => !symbolPattern.test(s))) fail("INVALID_BINANCE_DATA", "同步状态文件无效", 503);
  return state;
}
function references(document, binding, symbol) {
  const result = new Map();
  for (const trade of document.entries) {
    if (trade.binance?.binding !== binding || trade.binance.symbol !== symbol) continue;
    for (const id of trade.binance.recordIds || []) {
      if (result.has(id) && result.get(id) !== trade.id) fail("INVALID_TRADE_INDEX", "日志存在重复成交关联，请先核查", 503);
      result.set(id, trade.id);
    }
  }
  return result;
}
function prepare(rows, body, binding, target, nowSeconds) {
  if (!["long", "short"].includes(body.direction)) fail("INVALID_DIRECTION", "请选择做多或做空");
  const symbol = rows[0].symbol;
  const side = rows[0].positionSide;
  if (rows.some(r => r.positionSide !== side) || side === "LONG" && body.direction !== "long" || side === "SHORT" && body.direction !== "short") fail("MIXED_POSITION", "一笔交易须属于同一持仓方向；请核对多空选择");
  const currency = /USDT(?:_|$)/.test(symbol) ? "USDT" : /USDC(?:_|$)/.test(symbol) ? "USDC" : null;
  if (!currency) fail("UNSUPPORTED_SETTLEMENT", "目前支持 USDT 或 USDC 结算的 U 本位合约");
  if (target && (!target.binance || target.binance.binding !== binding || target.binance.symbol !== symbol ||
      target.binance.positionSide !== side || target.plan.direction !== body.direction || !["open", "incomplete"].includes(target.status))) fail("INCOMPATIBLE_TRADE", "只能补充同账户、同交易对和方向的待补全或持仓中币安日志", 409);
  const additions = rows.filter(r => !target?.binance.recordIds.includes(r.id));
  const executions = additions.map(r => {
    const feeKnown = r.commissionAsset === currency && decimal(r.commission) >= 0n;
    return { id: createHash("sha256").update(`${binding}:${symbol}:${r.id}`).digest("hex").slice(0, 32),
      action: (r.side === "BUY") === (body.direction === "long") ? "entry" : "exit",
      at: new Date(r.time).toISOString(), price: numeric(r.price), quantity: numeric(r.qty),
      fee: feeKnown ? numeric(r.commission) : 0, feeKnown, note: `币安成交 · 订单 ${r.orderId}`,
      source: { kind: "binance", tradeId: r.id, orderId: r.orderId, quantity: r.qty,
        price: r.price, realizedPnl: r.realizedPnl, commission: r.commission, commissionAsset: r.commissionAsset } };
  });
  const combined = [...(target?.executions || []), ...executions].sort((a, b) => a.at.localeCompare(b.at) ||
    (BigInt(a.source.tradeId) < BigInt(b.source.tradeId) ? -1 : 1));
  if (combined.length > 150) fail("EXECUTION_LIMIT", "一笔日志最多关联 150 条成交，请缩小范围", 409);
  let balance = 0n, invalidStart = false, entryQty = 0n, exitQty = 0n, entryValue = 0n, exitValue = 0n, pnl = 0n, fees = 0n;
  for (const e of combined) {
    const qty = decimal(e.source.quantity);
    balance += e.action === "entry" ? qty : -qty;
    if (balance < 0n) invalidStart = true;
    if (e.action === "entry") { entryQty += qty; entryValue += decimal(e.source.price) * qty / SCALE; }
    else { exitQty += qty; exitValue += decimal(e.source.price) * qty / SCALE; }
    pnl += decimal(e.source.realizedPnl);
    if (e.feeKnown) fees += decimal(e.source.commission);
  }
  if (body.completeHistory !== undefined && typeof body.completeHistory !== "boolean") fail("INVALID_CONFIRMATION", "完整性确认无效");
  const complete = body.completeHistory === true;
  if (complete && invalidStart) fail("INCOMPLETE_SELECTION", "平仓早于开仓或数量超出已选开仓，请补齐成交或取消完整性确认");
  const plannedRisk = body.plannedRisk === undefined || body.plannedRisk === null ? null : body.plannedRisk;
  if (plannedRisk !== null && (typeof plannedRisk !== "number" || !Number.isFinite(plannedRisk) || plannedRisk <= 0 || plannedRisk > 1e13)) fail("INVALID_RISK", "初始风险金额无效");
  const now = new Date(nowSeconds * 1000).toISOString();
  const plan = target?.plan || planFrom({ symbol, market: "crypto", direction: body.direction, recordType: "live",
    strategy: "", timeframe: "", account: "Binance USDⓈ-M", currency, setupAt: combined[0].at,
    entry: null, plannedQuantity: null, plannedRisk });
  const trade = target ? structuredClone(target) : { revision: 1, status: "incomplete", createdAt: now, updatedAt: now,
    plan, planHistory: [{ version: 1, confirmedAt: now, origin: "retrospective_binance_record", plan: structuredClone(plan) }],
    attachments: [], pendingImages: [], events: [{ type: "binance_imported", at: now }], notes: [], timeline: [] };
  trade.executions = combined;
  trade.binance = { binding, symbol, positionSide: side, recordIds: combined.map(e => e.source.tradeId),
    completeHistory: complete, positionKnown: !invalidStart, remaining: decimalString(balance), importedAt: now };
  trade.status = !complete || invalidStart ? "incomplete" : balance > 0n ? "open" : "closed";
  const preview = { symbol, direction: body.direction, currency, selected: rows.length, added: additions.length,
    executions: combined.length, entryQuantity: decimalString(entryQty), exitQuantity: decimalString(exitQty),
    entryAverage: entryQty ? decimalString(entryValue * SCALE / entryQty) : null,
    exitAverage: exitQty ? decimalString(exitValue * SCALE / exitQty) : null,
    remaining: !invalidStart ? decimalString(balance) : null, exchangeRealizedPnl: decimalString(pnl),
    knownFees: decimalString(fees), netPnl: decimalString(pnl - fees),
    feesComplete: combined.every(e => e.feeKnown), positionKnown: !invalidStart, status: trade.status };
  return { trade, preview };
}

export async function handleBinanceImport({ route, body, user, source, config, contentStore, nowSeconds }) {
  if (user?.role !== "owner") fail("MISSING_PERMISSION", "币安成交仅限站点所有者", 403);
  const state = await sourceState(source);
  const document = await contentStore.readJson(documentPath(config), { missing: emptyDocument() });
  if (!validDocument(document)) fail("INVALID_TRADE_INDEX", "交易日志数据校验失败", 503);
  if (route === "trading/binance/list") {
    const symbols = state ? Object.keys(state.cursors.trades).sort() : [];
    if (!state || !symbols.length) return { symbols, records: [], total: 0, page: 1, pages: 0, updatedAt: state?.updatedAt ?? null, syncedThrough: null };
    if (!body.symbol) return { symbols, records: [], total: 0, page: 1, pages: 0, updatedAt: state.updatedAt, syncedThrough: null };
    const rows = await readRows(source, body, state);
    const page = body.page ?? 1, pageSize = 50;
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) fail("INVALID_PAGE", "页码无效");
    const refs = references(document, state.binding, body.symbol);
    return { symbols, updatedAt: state.updatedAt, syncedThrough: state.cursors.trades[body.symbol],
      total: rows.length, page, pages: Math.ceil(rows.length / pageSize),
      records: rows.reverse().slice((page - 1) * pageSize, page * pageSize).map(r => ({ ...r, importedTradeId: refs.get(r.id) ?? null })) };
  }
  if (!state) fail("BINANCE_NOT_SYNCED", "请先完成币安数据同步", 409);
  if (!["trading/binance/preview", "trading/binance/import"].includes(route)) fail("NOT_FOUND", "接口不存在", 404);
  if (!Array.isArray(body.recordIds) || body.recordIds.length < 1 || body.recordIds.length > 150 ||
    body.recordIds.some(id => typeof id !== "string" || !idPattern.test(id)) || new Set(body.recordIds).size !== body.recordIds.length) fail("INVALID_SELECTION", "请选择 1～150 条不同成交");
  const allRows = await readRows(source, body, state);
  const selected = new Set(body.recordIds);
  const rows = allRows.filter(r => selected.has(r.id));
  if (rows.length !== selected.size) fail("SELECTION_CHANGED", "部分成交已不在查询范围，请刷新并重新选择", 409);
  function checkedTarget(doc) {
    const target = body.targetId ? getTrade(doc, body.targetId) : null;
    const refs = references(doc, state.binding, body.symbol);
    if (rows.some(r => refs.has(r.id) && refs.get(r.id) !== (target?.id || body.createId))) fail("ALREADY_IMPORTED", "所选成交已关联其他日志，请打开对应日志或移除重复选择", 409);
    return target;
  }
  if (route === "trading/binance/preview") return { preview: prepare(rows, body, state.binding, checkedTarget(document), nowSeconds).preview };
  if (!body.targetId && (typeof body.createId !== "string" || !tradeIdPattern.test(body.createId))) fail("INVALID_ID", "交易创建编号无效");
  let result;
  await contentStore.updateJson(documentPath(config), { missing: emptyDocument(), validate: validDocument }, doc => {
    let target = checkedTarget(doc);
    const retry = !body.targetId && doc.entries.find(t => t.id === body.createId);
    if (retry) {
      if (!retry.binance || retry.binance.binding !== state.binding || retry.binance.symbol !== body.symbol ||
        rows.some(r => !retry.binance.recordIds.includes(r.id))) fail("TRADE_CONFLICT", "交易创建编号已被使用", 409);
      result = { trade: { ...retry, metrics: calculateTrade(retry) }, duplicate: true, added: 0 };
      return doc;
    }
    if (target && rows.every(r => target.binance?.recordIds.includes(r.id)) && target.binance.completeHistory === (body.completeHistory === true)) {
      result = { trade: { ...target, metrics: calculateTrade(target) }, duplicate: true, added: 0 };
      return doc;
    }
    if (target) requireRevision(target, body.revision);
    else if (doc.entries.length >= 300) fail("TRADE_LIMIT", "交易日志容量达到上限", 409);
    const prepared = prepare(rows, body, state.binding, target, nowSeconds);
    const trade = prepared.trade;
    if (target) {
      recordEvent(trade, "binance_executions_added", new Date(nowSeconds * 1000).toISOString(), { added: prepared.preview.added });
      if (trade.review) delete trade.review;
      doc.entries[doc.entries.findIndex(t => t.id === trade.id)] = trade;
    } else { trade.id = body.createId; doc.entries.push(trade); }
    result = { trade: { ...trade, metrics: calculateTrade(trade) }, duplicate: false, added: prepared.preview.added };
    return doc;
  });
  return result;
}
