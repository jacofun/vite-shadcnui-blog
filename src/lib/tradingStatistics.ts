import type { Trade } from "@/lib/trading";

/**
 * Only closed live trades with fully known fees enter performance statistics.
 * The price-based return uses entry notional as its denominator, not margin or
 * account equity; leveraged/account return needs independently recorded capital.
 */
export function calculateTradingStatistics(trades: Trade[], currency: string) {
  const closed = trades.filter(t => t.status === "closed" && t.plan.recordType === "live");
  const eligible = closed.filter(t => t.plan.currency === currency &&
    t.metrics.feesComplete !== false &&
    t.executions.some(e => e.action === "entry") &&
    t.executions.some(e => e.action === "exit") &&
    Number.isFinite(t.metrics.realizedPnl) &&
    t.metrics.remaining < 1e-8);
  const winners = eligible.filter(t => t.metrics.realizedPnl > 0);
  const losers = eligible.filter(t => t.metrics.realizedPnl < 0);
  const totalPnl = eligible.reduce((sum, t) => sum + t.metrics.realizedPnl, 0);
  const grossProfit = winners.reduce((sum, t) => sum + t.metrics.realizedPnl, 0);
  const grossLoss = -losers.reduce((sum, t) => sum + t.metrics.realizedPnl, 0);
  const entryNotional = eligible.reduce((sum, t) => sum + t.executions
    .filter(e => e.action === "entry").reduce((sub, e) => sub + e.price * e.quantity, 0), 0);
  const withR = eligible.filter(t => t.metrics.realizedR !== null && Number.isFinite(t.metrics.realizedR));
  return {
    currency, closed: closed.filter(t => t.plan.currency === currency).length,
    samples: eligible.length, excluded: closed.filter(t => t.plan.currency === currency).length - eligible.length,
    wins: winners.length, losses: losers.length, flat: eligible.length - winners.length - losers.length,
    winRate: eligible.length ? winners.length / eligible.length : null,
    totalPnl, grossProfit, grossLoss,
    averageWin: winners.length ? grossProfit / winners.length : null,
    averageLoss: losers.length ? grossLoss / losers.length : null,
    payoffRatio: losers.length && winners.length ? (grossProfit / winners.length) / (grossLoss / losers.length) : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    turnoverReturn: entryNotional > 0 ? totalPnl / entryNotional : null,
    meanR: withR.length ? withR.reduce((sum, t) => sum + (t.metrics.realizedR ?? 0), 0) / withR.length : null,
    rSamples: withR.length,
  };
}
