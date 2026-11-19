import { REVIEW_WINDOWS, SYMBOL, UUID } from "./market-research-contract.js";

export const MINUTE = 60_000;
const GRACE = 2 * MINUTE;
const RETRY_MINUTES = [5, 15, 60, 240];
const PAGE_SIZE = 8;
const MAX_JOBS = 24;
const MAX_BYTES = 512 * 1024;
const TERMINAL_CODES = new Set(["STALE_REFERENCE", "RECORD_MISSING", "DATA_GAP", "INVALID_MARKET_DATA", "MARKET_RATE_LIMITED", "MARKET_HTTP_ERROR", "MARKET_TIMEOUT"]);
const reviewError = code => Object.assign(new Error(code), { code });
const stamp = value => String(value).padStart(13, "0");

export const signalHistoryRoot = privateRoot => `${privateRoot}/.trading/owner/market-signals`;
const queuePrefix = root => `${root}/review-queue/`;
const resultPath = (root, id, hours) => `${root}/reviews/${id}/${hours}h.json`;
const summaryPath = (root, id, hours) => `${root}/review-index/${id}/${hours}h.json`;
const queuePath = (root, id, hours, due, attempt) => `${queuePrefix(root)}${stamp(due)}-${id}-${hours}h-${attempt}.json`;
const queuePattern = /^(\d{13})-([a-f0-9-]{36})-(4|12|24)h-([0-4])\.json$/;

export const reviewDue = (completedAt, hours) => completedAt + hours * 60 * MINUTE + GRACE;

export async function enqueueSignalReviews(store, root, result) {
  const receipt = `${root}/review-enqueued/${result.analysisId}.json`;
  if (await store.readJson(receipt, { missing: null })) return;
  for (const hours of REVIEW_WINDOWS) {
    if (await store.readJson(summaryPath(root, result.analysisId, hours), { missing: null })) continue;
    // Key contains all job information. Each retry uses a new due key.
    await store.putJsonOnce(queuePath(root, result.analysisId, hours, reviewDue(result.timing.completedAt, hours), 0), {});
  }
  await store.putJsonOnce(receipt, { schemaVersion: 1 });
}

export async function readReviewWindows(store, root, id, completedAt, withChart = false) {
  return Promise.all(REVIEW_WINDOWS.map(async hours => {
    const path = withChart ? resultPath(root, id, hours) : summaryPath(root, id, hours);
    return await store.readJson(path, { missing: null }) ?? { hours, status: "pending", dueAt: reviewDue(completedAt, hours) };
  }));
}

export function reviewBounds(completedAt, hours) {
  const end = completedAt + hours * 60 * MINUTE;
  return { observedFrom: Math.ceil(completedAt / MINUTE) * MINUTE, observedUntil: Math.floor(end / MINUTE) * MINUTE };
}

function price(value) {
  if (typeof value !== "string" && typeof value !== "number") return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : NaN;
}

export function parseMarkCandles(raw, { observedFrom, observedUntil }) {
  const count = (observedUntil - observedFrom) / MINUTE;
  if (!Array.isArray(raw) || raw.length > 1440) throw reviewError("INVALID_MARKET_DATA");
  if (raw.length !== count) throw reviewError("DATA_GAP");
  return raw.map((row, i) => {
    if (!Array.isArray(row) || row.length < 7) throw reviewError("INVALID_MARKET_DATA");
    const openTime = row[0];
    if (openTime !== observedFrom + i * MINUTE || row[6] !== openTime + MINUTE - 1) throw reviewError("DATA_GAP");
    const [open, high, low, close] = row.slice(1, 5).map(price);
    if (![open, high, low, close].every(Number.isFinite) || low > Math.min(open, close) || high < Math.max(open, close)) {
      throw reviewError("INVALID_MARKET_DATA");
    }
    return [openTime, open, high, low, close];
  });
}

async function readMarketBody(response) {
  if (!response.body) throw reviewError("INVALID_MARKET_DATA");
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        throw reviewError("INVALID_MARKET_DATA");
      }
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks, length).toString("utf8")); }
    catch { throw reviewError("INVALID_MARKET_DATA"); }
  } finally {
    reader.releaseLock();
  }
}

export async function loadMarkCandles(result, hours, { fetchImpl = fetch, signal } = {}) {
  if (!SYMBOL.test(result.symbol) || !REVIEW_WINDOWS.includes(hours)) throw reviewError("INVALID_MARKET_DATA");
  const bounds = reviewBounds(result.timing.completedAt, hours);
  const url = new URL("https://fapi.binance.com/fapi/v1/markPriceKlines");
  url.search = new URLSearchParams({
    symbol: result.symbol, interval: "1m", startTime: String(bounds.observedFrom),
    endTime: String(bounds.observedUntil - 1), limit: String((bounds.observedUntil - bounds.observedFrom) / MINUTE),
  }).toString();
  try {
    const response = await fetchImpl(url, { redirect: "error", cache: "no-store",
      signal: AbortSignal.any([AbortSignal.timeout(8_000), ...(signal ? [signal] : [])]) });
    if (!response.ok) {
      await response.body?.cancel();
      if ([418, 429].includes(response.status)) throw reviewError("MARKET_RATE_LIMITED");
      throw reviewError("MARKET_HTTP_ERROR");
    }
    return parseMarkCandles(await readMarketBody(response), bounds);
  } catch (error) {
    if (TERMINAL_CODES.has(error?.code)) throw error;
    throw reviewError("MARKET_TIMEOUT");
  }
}

function baseReview(result, hours) {
  return { schemaVersion: 1, analysisId: result.analysisId, hours, priceSource: "markPrice",
    referencePrice: result.market.latestQuote.price, referenceTime: result.market.latestQuote.time,
    dueAt: reviewDue(result.timing.completedAt, hours), ...reviewBounds(result.timing.completedAt, hours) };
}

export function evaluateSignal(result, hours, candles) {
  const review = baseReview(result, hours);
  const { direction } = result.opportunity;
  if (review.referenceTime < result.timing.completedAt - 15_000 || review.referenceTime > result.timing.completedAt + 2_000) {
    throw reviewError("STALE_REFERENCE");
  }
  const count = (review.observedUntil - review.observedFrom) / MINUTE;
  if (candles.length !== count || candles.some((row, i) => row[0] !== review.observedFrom + i * MINUTE)) throw reviewError("DATA_GAP");
  const endPrice = candles.at(-1)[4];
  const high = Math.max(...candles.map(row => row[2]));
  const low = Math.min(...candles.map(row => row[3]));
  const up = (high / review.referencePrice - 1) * 100;
  const down = (1 - low / review.referencePrice) * 100;
  const zones = new Map(result.research.priceZones.map(zone => [zone.id, zone]));
  const targets = result.opportunity.targets.map(target => {
    const zone = zones.get(target.zoneId);
    const first = candles.find(row => row[2] >= zone.lower && row[3] <= zone.upper);
    return { zoneId: zone.id, lower: zone.lower, upper: zone.upper, touched: !!first, firstTouchMinute: first?.[0] ?? null };
  });
  return {
    ...review, status: "completed", endPrice, high, low, targets,
    mfePct: direction ? Math.max(0, direction === "long" ? up : down) : null,
    maePct: direction ? Math.max(0, direction === "long" ? down : up) : null,
    directionAligned: direction ? (direction === "long" ? endPrice > review.referencePrice : endPrice < review.referencePrice) : null,
    candles,
  };
}

async function dueJobs(store, root, now, log) {
  const jobs = [];
  let cursor;
  let pages = 0;
  do {
    const page = await store.listJsonPaths(queuePrefix(root), { cursor, limit: PAGE_SIZE });
    pages++;
    for (const path of page.paths) {
      const match = queuePattern.exec(path.slice(queuePrefix(root).length));
      if (!match || !UUID.test(match[2])) {
        log({ event: "market_review_queue_failed", code: "INVALID_QUEUE_KEY" });
        continue;
      }
      const due = Number(match[1]);
      if (due > now || jobs.length >= MAX_JOBS) return jobs;
      jobs.push({ path, due, id: match[2], hours: Number(match[3]), attempt: Number(match[4]) });
    }
    if (page.nextCursor && page.nextCursor === cursor) throw reviewError("INVALID_QUEUE_CURSOR");
    cursor = page.nextCursor;
  } while (cursor && jobs.length < MAX_JOBS && pages < 6);
  return jobs;
}

async function processReview(store, root, job, { getCandles, signal, log }) {
  const { id, hours, attempt, due, path } = job;
  const report = resultPath(root, id, hours);
  let review = await store.readJson(report, { missing: null });
  if (!review) {
    const source = await store.readJson(`${root}/records/${id}.json`, { missing: null });
    const validSource = source?.schemaVersion === 4 && source.analysisId === id;
    try {
      if (!validSource) throw reviewError("RECORD_MISSING");
      if (due < reviewDue(source.timing.completedAt, hours)) throw reviewError("INVALID_QUEUE_KEY");
      if (source.market.latestQuote.time < source.timing.completedAt - 15_000 || source.market.latestQuote.time > source.timing.completedAt + 2_000) {
        throw reviewError("STALE_REFERENCE");
      }
      review = evaluateSignal(source, hours, await getCandles(source, hours, { signal }));
    } catch (error) {
      if (signal?.aborted || !TERMINAL_CODES.has(error?.code)) throw error;
      const code = error.code;
      const delay = RETRY_MINUTES[attempt];
      log({ event: "market_review_fetch_failed", analysisId: id, hours, attempt, code });
      if (delay && code !== "STALE_REFERENCE") {
        await store.putJsonOnce(queuePath(root, id, hours, due + delay * MINUTE, attempt + 1), {});
        await store.deletePaths([path]);
        return code === "MARKET_RATE_LIMITED" ? "rate_limited" : "retried";
      }
      review = { ...(validSource ? baseReview(source, hours) : { schemaVersion: 1, analysisId: id, hours, dueAt: due }),
        status: "insufficient", code };
    }
    try {
      await store.putJsonOnce(report, review);
    } catch (error) {
      if (error?.status !== 409 && error?.statusCode !== 409 && error?.code !== "RESOURCE_EXISTS") throw error;
      // An overlapping invocation already published a report. Use its version.
      review = await store.readJson(report);
    }
  }
  const summary = {
    schemaVersion: review.schemaVersion, analysisId: id, hours, dueAt: review.dueAt, status: review.status,
    ...(review.status === "completed" ? { targets: review.targets.map(target => ({ zoneId: target.zoneId, touched: target.touched })) } : { code: review.code }),
  };
  await store.putJsonOnce(summaryPath(root, id, hours), summary);
  await store.deletePaths([path]);
  return review.code === "MARKET_RATE_LIMITED" ? "rate_limited_terminal" : review.status;
}

export async function drainSignalReviews({ store, root, now = Date.now(), signal, getCandles = loadMarkCandles, log = () => {} }) {
  const results = { completed: 0, insufficient: 0, retried: 0, failed: 0 };
  for (const job of await dueJobs(store, root, now, log)) {
    if (signal?.aborted) break;
    try {
      const outcome = await processReview(store, root, job, { getCandles, signal, log });
      if (outcome === "rate_limited") {
        results.retried++;
        break;
      }
      if (outcome === "rate_limited_terminal") {
        results.insufficient++;
        break;
      }
      results[outcome]++;
    } catch (error) {
      results.failed++;
      const code = TERMINAL_CODES.has(error?.code) ? error.code : error?.code === "INVALID_QUEUE_KEY" ? "INVALID_QUEUE_KEY" : "REVIEW_STORAGE_OR_TASK_FAILED";
      log({ event: "market_review_job_failed", analysisId: job.id, hours: job.hours, attempt: job.attempt, code });
    }
  }
  return results;
}
