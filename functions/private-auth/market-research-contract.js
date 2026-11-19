export const REVIEW_WINDOWS = [4, 12, 24];
export const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
export const SYMBOL = /^[A-Z0-9]{3,24}USDT$/;
const INTERVALS = ["4h", "1h", "15m"];
const positive = value => Number.isFinite(value) && value > 0;
const nonnegative = value => Number.isFinite(value) && value >= 0;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const text = value => typeof value === "string" && value.length > 0 && value.length <= 600;
const nullable = (value, check) => value === null || check(value);
const bounded = (value, max, check) => Array.isArray(value) && value.length <= max && value.every(check);
const time = value => Number.isSafeInteger(value) && value > 0 && value < 9_999_999_999_999;
const alignments = ["up", "down", "mixed", "conflict"];
const comparisons = ["within_p50", "p50_to_p75", "p75_to_p90", "above_p90"];

function validZone(zone, at) {
  return zone && INTERVALS.includes(zone.interval) && ["support", "resistance"].includes(zone.kind) &&
    time(zone.firstPivotTime) && zone.id === `${zone.interval}:${zone.kind}:${zone.firstPivotTime}` &&
    positive(zone.lower) && positive(zone.upper) && zone.lower <= zone.upper &&
    ["active", "broken", "retested"].includes(zone.status) && integer(zone.touches) && zone.touches >= 1 &&
    integer(zone.pivotCount) && zone.pivotCount >= 1 && zone.pivotCount <= zone.touches &&
    time(zone.lastTouchTime) && zone.lastTouchTime >= zone.firstPivotTime && zone.lastTouchTime <= at &&
    time(zone.confirmedAt) && zone.confirmedAt > zone.firstPivotTime && zone.confirmedAt <= at &&
    nullable(zone.breakTime, value => time(value) && value <= at) && nullable(zone.breakRvol20, nonnegative) &&
    nullable(zone.lastRetestTime, value => time(value) && value <= at) && nullable(zone.lastRetestRvol20, nonnegative) &&
    nullable(zone.closesBeyondBreak, integer) && positive(zone.atrAtConfirmation) &&
    bounded(zone.reactions, 4, row => row && time(row.time) && row.time <= at &&
      nullable(row.closeClv, v => Number.isFinite(v) && Math.abs(v) <= 1.000000001) &&
      nullable(row.rvol20, nonnegative) && nullable(row.moveAtr, Number.isFinite));
}

function validDistribution(distribution, hours) {
  if (distribution === null) return true;
  const quantiles = distribution?.favorableMovePct;
  return distribution && integer(distribution.samples) && distribution.interval === "1h" && distribution.bars === hours &&
    (distribution.samples === 0 ? quantiles === null :
      quantiles && nonnegative(quantiles.p50) && quantiles.p50 <= quantiles.p75 && quantiles.p75 <= quantiles.p90 && Number.isFinite(quantiles.p90));
}

export function validResearchV4(result) {
  const { research, opportunity, market, timing, model } = result;
  if (!research || !opportunity || !market || !timing || !model || model.promptVersion !== "market-research-v4" ||
      !time(market.asOf) || !time(timing.completedAt) || !time(market.latestQuote?.time) ||
      timing.completedAt < market.asOf - 30_000 ||
      !positive(market.tickSize) || !market.chart ||
      !["trend", "range", "transition"].includes(research.marketRegime) ||
      !["continuation", "reversal", "none"].includes(research.scenario) ||
      !REVIEW_WINDOWS.includes(research.researchHorizon) ||
      !Number.isSafeInteger(opportunity.validForSeconds) || opportunity.validForSeconds < 30 || opportunity.validForSeconds > 300 ||
      !INTERVALS.every(interval => text(research.timeframeAnalysis?.[interval])) || !bounded(research.riskFactors, 8, text) ||
      !bounded(research.priceZones, 36, zone => validZone(zone, market.asOf))) return false;
  const zones = new Map(research.priceZones.map(zone => [zone.id, zone]));
  if (zones.size !== research.priceZones.length) return false;
  const rule = research.ruleAssessment;
  if (!rule || !alignments.includes(rule.trendAlignment) || rule.structure?.confirmedZones !== zones.size ||
      !integer(rule.structure?.repeatedZones) || rule.structure.repeatedZones > zones.size ||
      !integer(rule.structure?.activeSupport) || !integer(rule.structure?.activeResistance) ||
      rule.structure.activeSupport + rule.structure.activeResistance > zones.size ||
      !["defined", "developing", "limited"].includes(rule.structure.clarity) ||
      !nullable(rule.volumePrice, value => value && integer(value.supportingBars) && integer(value.opposingBars)) ||
      !nullable(rule.invalidation, value => value && zones.has(value.zoneId) && positive(value.riskDistance) && nullable(value.riskAtr14, positive))) return false;

  const targets = opportunity.targets;
  if (!Array.isArray(targets) || !bounded(research.targetAssessment, 3, row => row && zones.has(row.zoneId) &&
      positive(row.price) && positive(row.distance) && positive(row.distancePct) &&
      nullable(row.atr14Multiple, positive) && positive(row.rewardRisk) &&
      bounded(row.obstacles, 36, id => zones.has(id)) && validDistribution(row.historical, research.researchHorizon) &&
      nullable(row.comparison, comparison => comparisons.includes(comparison))) || research.targetAssessment.length !== targets.length ||
      !bounded(rule.targetSpace, 3, row => row && zones.has(row.zoneId) && integer(row.obstacleCount) &&
        nullable(row.historicalComparison, comparison => comparisons.includes(comparison))) || rule.targetSpace.length !== targets.length ||
      !bounded(rule.riskReward, 3, row => row && zones.has(row.zoneId) && positive(row.rewardRisk)) || rule.riskReward.length !== targets.length) return false;

  if (opportunity.direction === null) return research.scenario === "none" && research.entryZoneId === null && research.stopZoneId === null &&
    rule.invalidation === null && rule.volumePrice === null && !targets.length;
  const entryZone = zones.get(research.entryZoneId);
  const stopZone = zones.get(research.stopZoneId);
  const entry = opportunity.entry;
  const long = opportunity.direction === "long";
  if (research.scenario === "none" || !entry || !entryZone || !stopZone || entryZone.status === "broken" || stopZone.status === "broken" ||
      !rule.volumePrice || rule.invalidation?.zoneId !== stopZone.id || entry.min < entryZone.lower || entry.max > entryZone.upper ||
      (long ? opportunity.stopLoss >= Math.min(entry.min, stopZone.lower) : opportunity.stopLoss <= Math.max(entry.max, stopZone.upper))) return false;
  return targets.every((target, i) => {
    const zone = zones.get(target.zoneId);
    const assessment = research.targetAssessment[i];
    const previous = targets[i - 1]?.price ?? (long ? entry.max : entry.min);
    return zone && zone.status !== "broken" && target.price >= zone.lower && target.price <= zone.upper &&
      (long ? target.price > previous : target.price < previous) &&
      assessment.price === target.price && assessment.zoneId === zone.id &&
      rule.targetSpace[i].zoneId === zone.id && rule.riskReward[i].zoneId === zone.id;
  });
}
