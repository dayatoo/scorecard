// Core scoring engine for the KPI scorecard.
//
// Pure module: no database, no React, no dates-from-`now`. Everything it needs
// arrives as arguments, so every rule below is directly unit-testable (see
// scoring.test.ts).
//
// Score bands. Note the deliberate gaps between them — a band's top and the
// next band's bottom are one decimal step apart, which is exactly why every
// score is rounded to 1dp before it leaves this module: a rounded score can
// then only ever land *inside* a band, never in a gap.

export type Band =
  | "POOR"
  | "IMPROVEMENT_NEEDED"
  | "MEET"
  | "GOOD"
  | "VERY_GOOD"
  | "EXCELLENT";

export const BANDS: Band[] = [
  "POOR",
  "IMPROVEMENT_NEEDED",
  "MEET",
  "GOOD",
  "VERY_GOOD",
  "EXCELLENT",
];

export const BAND_BOUNDS: Record<Band, { lo: number; hi: number; label: string }> = {
  POOR: { lo: 0, hi: 2.4, label: "Poor" },
  IMPROVEMENT_NEEDED: { lo: 2.5, hi: 2.9, label: "Improvement Needed" },
  MEET: { lo: 3.0, hi: 3.4, label: "Meet" },
  GOOD: { lo: 3.5, hi: 3.9, label: "Good" },
  VERY_GOOD: { lo: 4.0, hi: 4.5, label: "Very Good" },
  EXCELLENT: { lo: 4.6, hi: 5.0, label: "Excellent" },
};

export const MAX_SCORE = 5;

export function bandForScore(score: number): Band {
  if (score >= BAND_BOUNDS.EXCELLENT.lo) return "EXCELLENT";
  if (score >= BAND_BOUNDS.VERY_GOOD.lo) return "VERY_GOOD";
  if (score >= BAND_BOUNDS.GOOD.lo) return "GOOD";
  if (score >= BAND_BOUNDS.MEET.lo) return "MEET";
  if (score >= BAND_BOUNDS.IMPROVEMENT_NEEDED.lo) return "IMPROVEMENT_NEEDED";
  return "POOR";
}

export function bandLabel(band: Band): string {
  return BAND_BOUNDS[band].label;
}

export type Direction = "HIGHER_BETTER" | "LOWER_BETTER";
export type MetricType =
  | "PERCENTAGE"
  | "DOLLAR"
  | "QUANTITY"
  | "DAYS"
  | "MONTH_COMPLETION";
export type TargetMode = "FIXED" | "RANGE";
export type ValueBasis = "ACTUAL" | "ESTIMATE";

/** One number per band. Targets step by 1 unit in practice. */
export type FixedTargetConfig = Record<Band, number>;

/** An explicit [min, max] value window per band. */
export type RangeTargetConfig = Record<Band, [number, number]>;

export type MonthTargetConfig = { targetMonth: string };

export type TargetConfig = FixedTargetConfig | RangeTargetConfig | MonthTargetConfig;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * The only exit from this module. Clamps to 0..5 and rounds to 1 decimal
 * place, so every score the app ever shows sits inside a band.
 */
export function roundScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.round(clamp(score, 0, MAX_SCORE) * 10) / 10;
}

// --------------------------------------------------------------------------
// Fixed numeric targets
// --------------------------------------------------------------------------

/**
 * Fixed target: one number per band, ordered by direction. The score is the
 * **top** of the highest band whose target the value reaches — meeting the
 * Meet target scores 3.4, reaching the Good target scores 3.9, and so on.
 *
 * Below the Poor target nothing has been "met", so the score scales
 * proportionally into the Poor band rather than dropping straight to zero:
 * `2.4 x (actual / poorTarget)` when higher is better, and the reciprocal when
 * lower is better (an overrun of twice the Poor target scores 1.2).
 *
 * Beyond the Excellent target there is no further credit: 5.0 is the cap.
 */
export function scoreFixedTarget(
  actual: number,
  config: FixedTargetConfig,
  direction: Direction
): number {
  // Normalise so the comparisons below can always assume higher is better.
  const sign = direction === "HIGHER_BETTER" ? 1 : -1;
  const a = actual * sign;

  // Walk from the best band down; the first target reached wins.
  for (let i = BANDS.length - 1; i >= 1; i--) {
    const band = BANDS[i];
    if (a >= config[band] * sign) return BAND_BOUNDS[band].hi;
  }

  // Short of even the Poor target: proportional credit within the Poor band.
  const poorTarget = config.POOR;
  if (direction === "HIGHER_BETTER") {
    if (poorTarget <= 0) return actual >= poorTarget ? BAND_BOUNDS.POOR.hi : 0;
    return clamp(actual / poorTarget, 0, 1) * BAND_BOUNDS.POOR.hi;
  }
  // Lower is better, and `actual` overshot the Poor ceiling.
  if (actual <= 0) return BAND_BOUNDS.POOR.hi;
  if (poorTarget < 0) return 0;
  return clamp(poorTarget / actual, 0, 1) * BAND_BOUNDS.POOR.hi;
}

// --------------------------------------------------------------------------
// Range numeric targets
// --------------------------------------------------------------------------

/**
 * Range target: each band owns an explicit [min, max] window of values. The
 * score interpolates linearly between that window and the band's own score
 * range, so a value halfway through the Good window scores halfway between 3.5
 * and 3.9. The edge of the window nearest the *better* neighbouring band maps
 * to the top of the band's score range.
 *
 * Values falling outside every configured window clamp to 0 or 5 according to
 * which end they fell off.
 */
export function scoreRangeTarget(
  actual: number,
  config: RangeTargetConfig,
  direction: Direction
): number {
  // Order the bands by where their windows sit on the value axis, lowest
  // value first. For "lower is better" that puts Excellent at the start.
  const ordered = direction === "HIGHER_BETTER" ? BANDS : [...BANDS].reverse();

  for (let i = 0; i < ordered.length; i++) {
    const band = ordered[i];
    const [a, b] = config[band];
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);

    // The outermost windows are open-ended, so a value past either end of the
    // scale still belongs to that end's band rather than falling through.
    const isLowest = i === 0;
    const isHighest = i === ordered.length - 1;
    const inWindow =
      (isLowest && actual <= hi) ||
      (isHighest && actual >= lo) ||
      (actual >= lo && actual <= hi);
    if (!inWindow) continue;

    const { lo: scoreLo, hi: scoreHi } = BAND_BOUNDS[band];
    if (hi === lo) return scoreHi;

    const position = clamp((actual - lo) / (hi - lo), 0, 1);
    return direction === "HIGHER_BETTER"
      ? scoreLo + position * (scoreHi - scoreLo)
      : scoreHi - position * (scoreHi - scoreLo);
  }

  // Unreachable for a well-formed config, but stay defined if the windows
  // leave a gap: fall back to whichever end of the scale the value is nearer.
  const lowestWindow = config[ordered[0]];
  const lowestEdge = Math.max(lowestWindow[0], lowestWindow[1]);
  const belowScale = actual < lowestEdge;
  const worstEnd = direction === "HIGHER_BETTER" ? belowScale : !belowScale;
  return worstEnd ? 0 : MAX_SCORE;
}

// --------------------------------------------------------------------------
// Period arithmetic ("YYYY-MM")
// --------------------------------------------------------------------------

export function parsePeriod(period: string): { year: number; month: number } {
  const [year, month] = period.split("-").map(Number);
  return { year, month };
}

export function formatPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function shiftPeriod(period: string, deltaMonths: number): string {
  const { year, month } = parsePeriod(period);
  const total = year * 12 + (month - 1) + deltaMonths;
  return formatPeriod(Math.floor(total / 12), (((total % 12) + 12) % 12) + 1);
}

/** Whole months from `from` to `to`; negative when `to` is earlier. */
export function monthsBetween(from: string, to: string): number {
  const a = parsePeriod(from);
  const b = parsePeriod(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function lastDayOfPeriod(period: string): Date {
  const { year, month } = parsePeriod(period);
  return new Date(Date.UTC(year, month - 1, daysInMonth(year, month)));
}

export function periodOfDate(date: Date): string {
  return formatPeriod(date.getUTCFullYear(), date.getUTCMonth() + 1);
}

// --------------------------------------------------------------------------
// Month-of-completion targets
// --------------------------------------------------------------------------

// How many months early/late maps to which band. Finishing in the target month
// is a Meet; each month early climbs a band, each month late drops one.
const COMPLETION_LADDER: { delta: number; band: Band }[] = [
  { delta: -3, band: "EXCELLENT" },
  { delta: -2, band: "VERY_GOOD" },
  { delta: -1, band: "GOOD" },
  { delta: 0, band: "MEET" },
  { delta: 1, band: "IMPROVEMENT_NEEDED" },
  { delta: 2, band: "POOR" },
];

/**
 * Month-of-completion target. Within the landing month the score scales by day
 * — day 1 scores the top of that band, the last day of the month the bottom.
 * With a target of October 2026: 1 Oct scores 3.4 and 31 Oct scores 3.0.
 *
 * Finishing more than three months early is capped at 5.0; more than two months
 * late scores 0.
 */
export function scoreMonthCompletion(
  completionDate: Date,
  config: MonthTargetConfig
): number {
  const completionPeriod = periodOfDate(completionDate);
  const delta = monthsBetween(config.targetMonth, completionPeriod);

  if (delta < -3) return MAX_SCORE;
  const rung = COMPLETION_LADDER.find((r) => r.delta === delta);
  if (!rung) return 0; // more than two months late

  const { lo, hi } = BAND_BOUNDS[rung.band];
  const { year, month } = parsePeriod(completionPeriod);
  const total = daysInMonth(year, month);
  if (total <= 1) return hi;

  const position = clamp((completionDate.getUTCDate() - 1) / (total - 1), 0, 1);
  return hi - position * (hi - lo);
}

// --------------------------------------------------------------------------
// Deadlines on non-time-based KPIs
// --------------------------------------------------------------------------

// Cap applied once a deadline has passed, by how many months late the
// scorecard period is. These are the tops of exactly the bands the completion
// ladder assigns to being one and two months late, so the app has a single
// notion of lateness rather than two competing ones.
const LATENESS_CAPS: Record<number, number> = {
  1: BAND_BOUNDS.IMPROVEMENT_NEEDED.hi, // 2.9
  2: BAND_BOUNDS.POOR.hi, // 2.4
};

export function latenessCap(monthsLate: number): number | null {
  if (monthsLate <= 0) return null; // on time — no cap
  if (monthsLate >= 3) return 0;
  return LATENESS_CAPS[monthsLate];
}

export type DeadlineOutcome = {
  score: number;
  /** The score before any deadline rule was applied, for explaining the cap. */
  rawScore: number;
  monthsLate: number;
  /** The cap in force, or null when the KPI is not yet late. */
  cap: number | null;
  /** True when the score was frozen at its deadline-month value. */
  frozen: boolean;
};

/**
 * Applies a KPI's deadline to a score already computed from its value.
 *
 * - Not past the deadline: the raw score stands.
 * - `scoreFinalAfterDeadline`: the score freezes at whatever it was in the
 *   deadline month. Later achievement is still recorded, it just no longer
 *   moves the score.
 * - Otherwise later achievement still earns partial credit, capped by how late
 *   it is. Because it is a cap rather than a replacement it can only ever
 *   lower a score, so a KPI already sitting below the cap is left alone.
 */
export function applyDeadline(params: {
  rawScore: number;
  period: string;
  deadlineMonth: string | null;
  scoreFinalAfterDeadline: boolean;
  /** The score as computed for the deadline month itself. */
  scoreAtDeadline?: number | null;
}): DeadlineOutcome {
  const { rawScore, period, deadlineMonth, scoreFinalAfterDeadline } = params;

  if (!deadlineMonth) {
    return { score: rawScore, rawScore, monthsLate: 0, cap: null, frozen: false };
  }

  const monthsLate = Math.max(0, monthsBetween(deadlineMonth, period));
  if (monthsLate === 0) {
    return { score: rawScore, rawScore, monthsLate: 0, cap: null, frozen: false };
  }

  if (scoreFinalAfterDeadline) {
    const frozenScore = params.scoreAtDeadline ?? rawScore;
    return { score: frozenScore, rawScore, monthsLate, cap: null, frozen: true };
  }

  const cap = latenessCap(monthsLate) ?? MAX_SCORE;
  return { score: Math.min(rawScore, cap), rawScore, monthsLate, cap, frozen: false };
}

// --------------------------------------------------------------------------
// Leaf scoring
// --------------------------------------------------------------------------

export type KpiDefinition = {
  metricType: MetricType;
  direction: Direction | null;
  targetMode: TargetMode | null;
  targetConfig: TargetConfig | null;
  deadlineMonth: string | null;
  scoreFinalAfterDeadline: boolean;
};

export type Entry = {
  period: string;
  value: number | null;
  basis: ValueBasis;
  completionDate: Date | null;
};

export type LeafScore = {
  score: number | null;
  band: Band | null;
  /** The figure actually scored, and where it came from. */
  value: number | null;
  basis: ValueBasis | null;
  /** True when scored from an estimate, so the score is provisional. */
  provisional: boolean;
  /** Set when a deadline changed the score; drives the UI explanation. */
  deadline: DeadlineOutcome | null;
  /** Why there is no score, when there isn't one. */
  pendingReason: "NO_DATA" | "NOT_YET_DUE" | null;
};

const NO_SCORE = (pendingReason: LeafScore["pendingReason"]): LeafScore => ({
  score: null,
  band: null,
  value: null,
  basis: null,
  provisional: false,
  deadline: null,
  pendingReason,
});

/**
 * Picks the figure to score for `period`: the actual recorded for that period
 * if there is one, otherwise the most recent estimate at or before it. A KPI
 * that isn't complete yet has no year-to-date actual, so its latest estimate
 * stands in and the resulting score is flagged provisional.
 */
export function selectEntry(entries: Entry[], period: string): Entry | null {
  const upTo = entries
    .filter((e) => e.period <= period)
    .sort((a, b) => a.period.localeCompare(b.period));

  const exactActual = upTo.find((e) => e.period === period && e.basis === "ACTUAL");
  if (exactActual) return exactActual;

  const exact = upTo.find((e) => e.period === period);
  if (exact) return exact;

  // Carry the most recent estimate forward; an older *actual* is deliberately
  // not carried, because a missing YTD actual means "not reported this month".
  for (let i = upTo.length - 1; i >= 0; i--) {
    if (upTo[i].basis === "ESTIMATE") return upTo[i];
  }
  return null;
}

/**
 * Scores one leaf KPI for one scorecard month.
 *
 * `MONTH_COMPLETION` KPIs need no entry to be scored once overdue: past the
 * target month they are scored as though completed on the last day of the
 * scorecard month, so a slipping milestone drags the score down on its own.
 */
export function scoreLeaf(
  kpi: KpiDefinition,
  entries: Entry[],
  period: string
): LeafScore {
  if (kpi.metricType === "MONTH_COMPLETION") {
    return scoreMilestoneLeaf(kpi, entries, period);
  }

  const entry = selectEntry(entries, period);
  if (!entry || entry.value === null) return NO_SCORE("NO_DATA");
  if (!kpi.direction || !kpi.targetMode || !kpi.targetConfig) {
    return NO_SCORE("NO_DATA");
  }

  const raw =
    kpi.targetMode === "FIXED"
      ? scoreFixedTarget(entry.value, kpi.targetConfig as FixedTargetConfig, kpi.direction)
      : scoreRangeTarget(entry.value, kpi.targetConfig as RangeTargetConfig, kpi.direction);

  const deadline = applyDeadline({
    rawScore: roundScore(raw),
    period,
    deadlineMonth: kpi.deadlineMonth,
    scoreFinalAfterDeadline: kpi.scoreFinalAfterDeadline,
    scoreAtDeadline: kpi.deadlineMonth
      ? scoreFrozenAtDeadline(kpi, entries, kpi.deadlineMonth)
      : null,
  });

  const score = roundScore(deadline.score);
  return {
    score,
    band: bandForScore(score),
    value: entry.value,
    basis: entry.basis,
    provisional: entry.basis === "ESTIMATE",
    deadline: kpi.deadlineMonth ? deadline : null,
    pendingReason: null,
  };
}

/** The raw score as at the deadline month, used when a KPI freezes. */
function scoreFrozenAtDeadline(
  kpi: KpiDefinition,
  entries: Entry[],
  deadlineMonth: string
): number | null {
  const entry = selectEntry(entries, deadlineMonth);
  if (!entry || entry.value === null) return 0; // nothing achieved by the deadline
  if (!kpi.direction || !kpi.targetMode || !kpi.targetConfig) return null;

  const raw =
    kpi.targetMode === "FIXED"
      ? scoreFixedTarget(entry.value, kpi.targetConfig as FixedTargetConfig, kpi.direction)
      : scoreRangeTarget(entry.value, kpi.targetConfig as RangeTargetConfig, kpi.direction);
  return roundScore(raw);
}

function scoreMilestoneLeaf(
  kpi: KpiDefinition,
  entries: Entry[],
  period: string
): LeafScore {
  const config = kpi.targetConfig as MonthTargetConfig | null;
  if (!config?.targetMonth) return NO_SCORE("NO_DATA");

  const completed = entries
    .filter((e) => e.completionDate && e.period <= period)
    .sort((a, b) => a.period.localeCompare(b.period))[0];

  if (completed?.completionDate) {
    // Once recorded, the score stands for this month and every later one.
    const score = roundScore(scoreMonthCompletion(completed.completionDate, config));
    return {
      score,
      band: bandForScore(score),
      value: null,
      basis: completed.basis,
      provisional: completed.basis === "ESTIMATE",
      deadline: null,
      pendingReason: null,
    };
  }

  // Not completed. Until the target month is behind us there is nothing to
  // say, so the KPI sits out of the rollup; after that it scores as though it
  // were completed on the last day of the scorecard month.
  if (monthsBetween(config.targetMonth, period) <= 0) return NO_SCORE("NOT_YET_DUE");

  const score = roundScore(scoreMonthCompletion(lastDayOfPeriod(period), config));
  return {
    score,
    band: bandForScore(score),
    value: null,
    basis: null,
    provisional: false,
    deadline: null,
    pendingReason: null,
  };
}

// --------------------------------------------------------------------------
// Rollup
// --------------------------------------------------------------------------

export type RollupInput = {
  /** The child's score as displayed, rounded to 1dp. */
  score: number | null;
  /**
   * The same score before rounding. Aggregating from this rather than from the
   * displayed value keeps a total from drifting as rounding errors compound,
   * and keeps it independent of how the hierarchy happens to be grouped.
   * Defaults to `score` — correct for a leaf, whose score is rounded by rule.
   */
  exactScore?: number | null;
  /** The child's full weight, whether or not it produced a score. */
  weight: number;
  /**
   * How much of that weight actually has a figure behind it. For a leaf this
   * is its whole weight or nothing; for a parent it is the sum from its own
   * descendants, which is what keeps coverage honest more than one level up.
   */
  scoredWeight: number;
  /** How much of the scored weight rests on an estimate. */
  provisionalWeight: number;
};

export type Rollup = {
  /** Rounded to 1dp, so it always sits inside a band. */
  score: number | null;
  /** Unrounded, for feeding into a further rollup. */
  exactScore: number | null;
  band: Band | null;
  /** Share of total weight that produced a score, 0..1. */
  coverage: number;
  /** Share of total weight whose score came from an estimate, 0..1. */
  provisionalShare: number;
  scoredWeight: number;
  provisionalWeight: number;
  totalWeight: number;
};

/**
 * Weighted average of child scores, skipping children with no score and
 * renormalising over the rest — so an early month with half the data still
 * reads on the same 0-5 scale.
 *
 * Children are weighted by their *scored* weight rather than their nominal
 * weight. That makes a rollup at any depth identical to a flat weighted
 * average over every scored leaf beneath it, which is what "leaf weights sum
 * to 100%" implies: a branch that is only half reported carries only half its
 * weight into its parent, instead of lending its full weight to a score that
 * rests on less.
 */
export function rollup(children: RollupInput[]): Rollup {
  const totalWeight = children.reduce((sum, c) => sum + Math.max(0, c.weight), 0);
  const scoredWeight = children.reduce((sum, c) => sum + Math.max(0, c.scoredWeight), 0);
  const provisionalWeight = children.reduce(
    (sum, c) => sum + Math.max(0, c.provisionalWeight),
    0
  );

  const contributing = children.filter((c) => c.score !== null && c.scoredWeight > 0);

  if (contributing.length === 0 || scoredWeight <= 0) {
    return {
      score: null,
      exactScore: null,
      band: null,
      coverage: 0,
      provisionalShare: 0,
      scoredWeight: 0,
      provisionalWeight: 0,
      totalWeight,
    };
  }

  const weighted = contributing.reduce(
    (sum, c) => sum + (c.exactScore ?? (c.score as number)) * c.scoredWeight,
    0
  );
  const exactScore = weighted / scoredWeight;
  const score = roundScore(exactScore);

  return {
    score,
    exactScore,
    band: bandForScore(score),
    coverage: totalWeight > 0 ? scoredWeight / totalWeight : 0,
    provisionalShare: totalWeight > 0 ? provisionalWeight / totalWeight : 0,
    scoredWeight,
    provisionalWeight,
    totalWeight,
  };
}
