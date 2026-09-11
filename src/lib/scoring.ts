// Core scoring engine for the KPI scorecard.
//
// Score bands (fixed across the whole app):
//   Poor              0   - 2.4
//   Improvement Needed 2.5 - 2.9
//   Meet              3.0 - 3.4
//   Good              3.5 - 3.9
//   Very Good         4.0 - 4.5
//   Excellent         4.6 - 5.0

export type Band =
  | "POOR"
  | "IMPROVEMENT_NEEDED"
  | "MEET"
  | "GOOD"
  | "VERY_GOOD"
  | "EXCELLENT";

export const BAND_BOUNDS: Record<Band, { lo: number; hi: number; label: string }> = {
  POOR: { lo: 0, hi: 2.4, label: "Poor" },
  IMPROVEMENT_NEEDED: { lo: 2.5, hi: 2.9, label: "Improvement Needed" },
  MEET: { lo: 3.0, hi: 3.4, label: "Meet" },
  GOOD: { lo: 3.5, hi: 3.9, label: "Good" },
  VERY_GOOD: { lo: 4.0, hi: 4.5, label: "Very Good" },
  EXCELLENT: { lo: 4.6, hi: 5.0, label: "Excellent" },
};

export function bandForScore(score: number): Band {
  if (score >= BAND_BOUNDS.EXCELLENT.lo) return "EXCELLENT";
  if (score >= BAND_BOUNDS.VERY_GOOD.lo) return "VERY_GOOD";
  if (score >= BAND_BOUNDS.GOOD.lo) return "GOOD";
  if (score >= BAND_BOUNDS.MEET.lo) return "MEET";
  if (score >= BAND_BOUNDS.IMPROVEMENT_NEEDED.lo) return "IMPROVEMENT_NEEDED";
  return "POOR";
}

export type Direction = "HIGHER_BETTER" | "LOWER_BETTER";

export type FixedTargetConfig = {
  poorThreshold: number;
  meetTarget: number;
  goodThreshold: number;
  veryGoodThreshold: number;
  excellentThreshold: number;
};

export type RangeTargetConfig = {
  poor: [number, number];
  improvementNeeded: [number, number];
  meet: [number, number];
  good: [number, number];
  veryGood: [number, number];
  excellent: [number, number];
};

export type MonthTargetConfig = {
  targetMonth: string; // "YYYY-MM"
};

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Fixed numeric target.
 *
 * Bands sit at consecutive thresholds along the value axis (ascending for
 * HIGHER_BETTER, descending for LOWER_BETTER):
 *   poorThreshold < meetTarget < goodThreshold < veryGoodThreshold < excellentThreshold
 *
 * Meet is a single exact point (score 3.4). Any value strictly between
 * poorThreshold and meetTarget is "Improvement Needed" and flat-scores the
 * top of that band (2.9) — it does not get skipped or interpolated. Only
 * the Poor band (below poorThreshold) gets proportional credit, scaled
 * against poorThreshold. Above meetTarget, the value snaps to the top of
 * whichever band (Good/Very Good/Excellent) it falls into; beyond
 * excellentThreshold the score is capped at 5.0 with no further credit.
 */
export function scoreFixedTarget(
  actual: number,
  config: FixedTargetConfig,
  direction: Direction
): number {
  const { poorThreshold, meetTarget, goodThreshold, veryGoodThreshold, excellentThreshold } =
    config;

  // Normalize so the math below can always assume "higher is better".
  const sign = direction === "HIGHER_BETTER" ? 1 : -1;
  const a = actual * sign;
  const pT = poorThreshold * sign;
  const mT = meetTarget * sign;
  const gT = goodThreshold * sign;
  const vgT = veryGoodThreshold * sign;
  const eT = excellentThreshold * sign;

  if (a < pT) {
    // Proportional credit toward the top of the Poor band.
    if (pT <= 0) return 0;
    const ratio = a <= 0 ? 0 : a / pT;
    return clamp(ratio, 0, 1) * BAND_BOUNDS.POOR.hi;
  }
  if (a < mT) return BAND_BOUNDS.IMPROVEMENT_NEEDED.hi;
  if (a === mT) return BAND_BOUNDS.MEET.hi;
  if (a < gT) return BAND_BOUNDS.MEET.hi;
  if (a < vgT) return BAND_BOUNDS.GOOD.hi;
  if (a < eT) return BAND_BOUNDS.VERY_GOOD.hi;
  return BAND_BOUNDS.EXCELLENT.hi;
}

/**
 * Range numeric target: every band has its own explicit [min, max] value
 * range. The score interpolates linearly within the band whose range
 * contains the actual value, scaled between that band's score bounds. The
 * "better" edge of the band's value range (per direction) maps to the top
 * of the band's score range.
 */
export function scoreRangeTarget(
  actual: number,
  config: RangeTargetConfig,
  direction: Direction
): number {
  const bands: { range: [number, number]; band: Band }[] = [
    { range: config.poor, band: "POOR" },
    { range: config.improvementNeeded, band: "IMPROVEMENT_NEEDED" },
    { range: config.meet, band: "MEET" },
    { range: config.good, band: "GOOD" },
    { range: config.veryGood, band: "VERY_GOOD" },
    { range: config.excellent, band: "EXCELLENT" },
  ];

  // Order bands from worst to best along the value axis according to direction.
  const ordered = direction === "HIGHER_BETTER" ? bands : [...bands].reverse();

  for (let i = 0; i < ordered.length; i++) {
    const { range, band } = ordered[i];
    const lo = Math.min(range[0], range[1]);
    const hi = Math.max(range[0], range[1]);
    const isLast = i === ordered.length - 1;
    const isFirst = i === 0;

    const inRange =
      (isFirst && actual <= hi) ||
      (isLast && actual >= lo) ||
      (actual >= lo && actual <= hi);

    if (!inRange) continue;

    const { lo: sLo, hi: sHi } = BAND_BOUNDS[band];
    if (hi === lo) return sHi;
    const posFraction = clamp((actual - lo) / (hi - lo), 0, 1);
    // Within a band, the edge closer to the "better" neighbor band scores sHi.
    const betterEdgeIsHi = direction === "HIGHER_BETTER";
    const score = betterEdgeIsHi ? sLo + posFraction * (sHi - sLo) : sHi - posFraction * (sHi - sLo);
    return clamp(score, 0, 5);
  }

  // Outside every configured range: clamp to the nearest extreme.
  const worst = ordered[0];
  const best = ordered[ordered.length - 1];
  const worstLo = Math.min(worst.range[0], worst.range[1]);
  const worstHi = Math.max(worst.range[0], worst.range[1]);
  const bestLo = Math.min(best.range[0], best.range[1]);
  const bestHi = Math.max(best.range[0], best.range[1]);
  if (actual < worstLo || actual < worstHi) {
    return direction === "HIGHER_BETTER" ? 0 : 5;
  }
  if (actual > bestHi || actual > bestLo) {
    return direction === "HIGHER_BETTER" ? 5 : 0;
  }
  return 0;
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

function parsePeriod(period: string): { year: number; month: number } {
  const [y, m] = period.split("-").map(Number);
  return { year: y, month: m };
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 };
}

/**
 * Month-of-completion target. The Meet target is a specific month; scoring
 * within a month is scaled by day-of-month (day 1 = top of that band's
 * score, last day of the month = bottom of that band's score). Completion
 * one/two/three months earlier than target lands in Good/Very
 * Good/Excellent's month respectively; up to one/two months late lands in
 * Improvement Needed/Poor's month; later than that scores 0.
 */
export function scoreMonthCompletion(
  completionDate: Date,
  config: MonthTargetConfig
): number {
  const target = parsePeriod(config.targetMonth);
  const completionYear = completionDate.getFullYear();
  const completionMonth = completionDate.getMonth() + 1;
  const day = completionDate.getDate();

  const bandOffsets: { delta: number; band: Band }[] = [
    { delta: -3, band: "EXCELLENT" },
    { delta: -2, band: "VERY_GOOD" },
    { delta: -1, band: "GOOD" },
    { delta: 0, band: "MEET" },
    { delta: 1, band: "IMPROVEMENT_NEEDED" },
    { delta: 2, band: "POOR" },
  ];

  for (const { delta, band } of bandOffsets) {
    const { year, month } = shiftMonth(target.year, target.month, delta);
    if (year === completionYear && month === completionMonth) {
      const { lo, hi } = BAND_BOUNDS[band];
      const dim = daysInMonth(year, month);
      if (dim <= 1) return hi;
      const fraction = clamp((day - 1) / (dim - 1), 0, 1);
      return hi - fraction * (hi - lo);
    }
  }

  // More than 3 months early: still capped at Excellent's top (no extra credit).
  const monthsFromTarget =
    (completionYear - target.year) * 12 + (completionMonth - target.month);
  if (monthsFromTarget < -3) return BAND_BOUNDS.EXCELLENT.hi;

  // More than 2 months late.
  return 0;
}

export type LeafMetricType = "PERCENTAGE" | "DOLLAR" | "QUANTITY" | "DAYS" | "MONTH_COMPLETION";
export type TargetMode = "FIXED" | "RANGE";

export function scoreLeafKpi(params: {
  metricType: LeafMetricType;
  direction: Direction | null;
  targetMode: TargetMode | null;
  targetConfig: FixedTargetConfig | RangeTargetConfig | MonthTargetConfig;
  value: number | null;
  completionDate: Date | null;
}): number | null {
  const { metricType, direction, targetMode, targetConfig, value, completionDate } = params;

  if (metricType === "MONTH_COMPLETION") {
    if (!completionDate) return null;
    return roundScore(scoreMonthCompletion(completionDate, targetConfig as MonthTargetConfig));
  }

  if (value === null || value === undefined) return null;
  if (!direction || !targetMode) return null;

  if (targetMode === "FIXED") {
    return roundScore(scoreFixedTarget(value, targetConfig as FixedTargetConfig, direction));
  }
  return roundScore(scoreRangeTarget(value, targetConfig as RangeTargetConfig, direction));
}

export function roundScore(score: number): number {
  return Math.round(clamp(score, 0, 5) * 100) / 100;
}

/** Weighted rollup of a set of child scores (each 0-5, with a relative weight). */
export function rollupScores(children: { score: number | null; weight: number }[]): number | null {
  const usable = children.filter((c) => c.score !== null && c.weight > 0);
  if (usable.length === 0) return null;
  const totalWeight = usable.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight <= 0) return null;
  const weighted = usable.reduce((sum, c) => sum + (c.score as number) * c.weight, 0);
  return roundScore(weighted / totalWeight);
}
