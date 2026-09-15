// Dashboard-only "what if" scoring toggles.
//
// This module never changes how `scoring.ts` decides a score — it only
// reprocesses what that engine already returned (or, for excluding
// estimates, filters what gets fed into it). `scoring.ts` itself has zero
// awareness of this module and is called exactly as it always has been.

import {
  bandForScore,
  dueMonths,
  monthOfFiscalYear,
  monthsBetween,
  roundScore,
  shiftPeriod,
  BAND_BOUNDS,
  type Entry,
  type KpiDefinition,
  type LeafScore,
} from "./scoring";

export type DueMode = "exclude" | "assume-meet-decay";
export type EstimateMode = "count" | "exclude" | "zero";
export type ScoringOptions = { dueMode: DueMode; estimateMode: EstimateMode };
export const DEFAULT_SCORING_OPTIONS: ScoringOptions = {
  dueMode: "exclude",
  estimateMode: "count",
};

/** Top of the Meet band — what a not-yet-due KPI is assumed to be tracking at. */
export const ASSUMED_MEET_SCORE = BAND_BOUNDS.MEET.hi;

/** A `LeafScore` after the toggles have had a chance to reprocess it. */
export type ModedLeafScore = LeafScore & {
  /** True when this score was synthesized by the `assume-meet-decay` toggle rather than reported. */
  assumed: boolean;
};

/**
 * `estimateMode: "exclude"` support: drop ESTIMATE-basis entries before they
 * ever reach `selectEntry`/`scoreLeaf`/`scoreMilestoneLeaf`. With fewer
 * entries to choose from, those unmodified functions naturally treat an
 * excluded estimate the same as genuinely missing data.
 */
export function filterEntriesForMode(entries: Entry[], estimateMode: EstimateMode): Entry[] {
  if (estimateMode !== "exclude") return entries;
  return entries.filter((e) => e.basis !== "ESTIMATE");
}

/** The same lateness bands `LATENESS_CAPS` already uses, reused rather than reinvented. */
export function assumedScoreForLateness(monthsLate: number): number {
  if (monthsLate <= 0) return ASSUMED_MEET_SCORE; // 3.4
  if (monthsLate === 1) return BAND_BOUNDS.IMPROVEMENT_NEEDED.hi; // 2.9
  if (monthsLate === 2) return BAND_BOUNDS.POOR.hi; // 2.4
  return 0;
}

/**
 * How many months overdue a numeric (non-milestone) KPI is, for the
 * `assume-meet-decay` toggle. A KPI with an explicit `deadlineMonth` is late
 * by however many months past it. Otherwise: a MONTHLY KPI is due every
 * month, so it's late the instant a month goes unreported — counted from the
 * most recent entry of any basis, or the fiscal year's first month if none
 * exists yet. A QUARTERLY/ANNUAL KPI is late only once its own most recent
 * due month has passed with nothing reported for it.
 */
export function monthsLateForNumeric(kpi: KpiDefinition, entries: Entry[], period: string): number {
  if (kpi.deadlineMonth) return Math.max(0, monthsBetween(kpi.deadlineMonth, period));

  const frequency = kpi.frequency ?? "MONTHLY";
  const fyStart = shiftPeriod(period, -(monthOfFiscalYear(period) - 1));

  if (frequency === "MONTHLY") {
    const lastEntry = entries
      .filter((e) => e.period <= period)
      .sort((a, b) => b.period.localeCompare(a.period))[0];
    const since = lastEntry ? lastEntry.period : fyStart;
    return Math.max(0, monthsBetween(since, period));
  }

  const mostRecentDue = dueMonths(frequency)
    .map((m) => shiftPeriod(fyStart, m - 1))
    .filter((p) => p <= period)
    .sort()
    .at(-1);
  if (!mostRecentDue) return 0;

  const reported = entries.some((e) => e.period >= mostRecentDue && e.period <= period);
  return reported ? 0 : Math.max(0, monthsBetween(mostRecentDue, period));
}

/**
 * Reprocesses one leaf's already-computed `LeafScore` under the active
 * toggles. Never re-derives a score from scratch — only transforms what
 * `scoreLeaf`/`scoreMilestoneLeaf` already returned (their own logic stays
 * untouched; see `filterEntriesForMode` for the one input-side exception).
 */
export function applyScoringMode(
  leaf: LeafScore,
  kpi: KpiDefinition,
  entries: Entry[],
  period: string,
  options: ScoringOptions
): ModedLeafScore {
  if (options.estimateMode === "zero" && leaf.basis === "ESTIMATE") {
    const score = roundScore(0);
    return { ...leaf, score, band: bandForScore(score), provisional: false, assumed: false };
  }

  if (options.dueMode === "assume-meet-decay" && leaf.score === null) {
    if (kpi.metricType === "MONTH_COMPLETION") {
      // An overdue milestone already got a real score from the engine's own
      // ladder logic — this only fires strictly before its target month.
      if (leaf.pendingReason === "NOT_YET_DUE") {
        const score = ASSUMED_MEET_SCORE;
        return { ...leaf, score, band: bandForScore(score), assumed: true, pendingReason: null };
      }
    } else {
      const monthsLate = monthsLateForNumeric(kpi, entries, period);
      const score = roundScore(assumedScoreForLateness(monthsLate));
      return { ...leaf, score, band: bandForScore(score), assumed: true, pendingReason: null };
    }
  }

  return { ...leaf, assumed: false };
}
