import { createPrivateResourceContentStore, normalizePrivateRoot } from "./index.js";
import { drainSignalReviews, signalHistoryRoot } from "./market-signal-review.js";

const TIMER_NAME = "market-research-review-v4";
const TIMER_MESSAGE = "drain-market-signal-reviews";
const log = data => console.log(JSON.stringify(data));

export function createReviewTimer({ env = process.env, createStore = createPrivateResourceContentStore, drain = drainSignalReviews, logger = log } = {}) {
  return async (event, context) => {
    let parsed;
    try { parsed = JSON.parse(event.toString()); } catch { throw new Error("INVALID_REVIEW_TIMER_EVENT"); }
    if (parsed?.triggerName !== TIMER_NAME || parsed?.payload !== TIMER_MESSAGE || !Number.isFinite(Date.parse(parsed?.triggerTime))) {
      throw new Error("INVALID_REVIEW_TIMER_EVENT");
    }
    const credentials = context?.credentials;
    if (!credentials?.accessKeyId || !credentials?.accessKeySecret || !credentials?.securityToken) throw new Error("REVIEW_ROLE_REQUIRED");
    try {
      const root = signalHistoryRoot(normalizePrivateRoot(env.PRIVATE_RESOURCE_ROOT));
      const store = await createStore({ env, credentials, clientOptions: { timeout: 5_000, retryMax: 0 } });
      const results = await drain({ store, root, signal: AbortSignal.timeout(45_000), log: logger });
      logger({ event: "market_review_timer_completed", ...results });
      return results;
    } catch {
      logger({ event: "market_review_timer_failed", code: "REVIEW_QUEUE_OR_CONFIGURATION_FAILED" });
      throw new Error("REVIEW_QUEUE_OR_CONFIGURATION_FAILED");
    }
  };
}

export const handler = createReviewTimer();
