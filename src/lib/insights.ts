// Turns a scored tree into two ranked lists: the highest-leverage ways to
// raise the total score, and the KPIs most exposed to losing ground.
//
// Both rest on one exact fact about `rollup()` (see scoring.ts): because it
// renormalizes only over *scored* children at every level, the total score is
// identical to a flat weighted average over every scored leaf, weighted by
// `globalWeight`. Moving one leaf's exact score by delta — up or down — never
// changes which leaves count as scored, so its effect on the total is the
// closed form below, and effects from several leaves sum exactly with no
// interaction term. No simulation is needed to rank or to add these up.

import { leavesOf } from "./kpi-tree";
import type { ScoredNode } from "./kpi-tree";
import { BAND_BOUNDS, BANDS, varianceMagnitude, type Band, type Rollup, type TargetMode } from "./scoring";
import { describeBandTarget } from "./targets";

export type Opportunity = {
  kpiId: string;
  code: string;
  name: string;
  currentScore: number;
  currentBand: Band;
  nextBand: Band;
  /** What it takes to get there, in the KPI's own units — reuses the same
   *  band-target description shown elsewhere in the app. */
  targetDescription: string | null;
  /** Exact points added to the total score if this leaf reaches `nextBand`. */
  scoreImpact: number;
  globalWeight: number;
};

export type RiskTrend = "DECLINING" | "STABLE" | "IMPROVING" | "SLIPPING_MILESTONE" | "UNKNOWN";

export type Risk = {
  kpiId: string;
  code: string;
  name: string;
  currentScore: number;
  currentBand: Band;
  /** How far above its own band's floor this leaf currently sits, on the raw 0-5 score scale. */
  headroom: number;
  /** The same margin in the KPI's own reported units (e.g. "4.5" of a percentage) — null for a
   *  milestone, which has no numeric value to be a distance from. */
  metricHeadroom: { distance: number; unit: string | null } | null;
  /** Exact points lost from the total if this leaf falls into the band below (negative). */
  dropImpact: number;
  trend: RiskTrend;
  /** Periods until headroom is exhausted at the observed trend, when declining. */
  monthsToDrop: number | null;
  globalWeight: number;
};

/**
 * The exact score a leaf reaches by meeting one band's own target, from
 * below. FIXED targets score in discrete jumps to the top of whichever
 * band's target is met (`scoreFixedTarget`); RANGE and MONTH_COMPLETION
 * targets interpolate continuously within a band's window, so the nearer
 * (better) edge of the next band up is its bottom (`scoreRangeTarget`,
 * `scoreMonthCompletion`). MONTH_COMPLETION carries no targetMode (it's
 * null), which already falls into the RANGE-shaped branch here — correct,
 * since its scoring is continuous the same way.
 */
function bandEntryScore(band: Band, targetMode: TargetMode | null): number {
  return targetMode === "FIXED" ? BAND_BOUNDS[band].hi : BAND_BOUNDS[band].lo;
}

/**
 * Where a leaf lands right after falling out of `band` into the one below —
 * the top rung of that lower band, regardless of target mode: a FIXED
 * regression drops to the next lower target still met (that band's own hi),
 * and a RANGE regression crosses into the lower band's better-adjacent edge
 * (also its hi). So, unlike climbing up, falling down doesn't depend on mode.
 */
function bandFloorAfterDrop(band: Band): number {
  return BAND_BOUNDS[band].hi;
}

/**
 * How far a leaf's actual reported figure sits above the value that would
 * drop it into the band below, in its own units — the number a person
 * reading a percentage or a dollar figure actually needs, not a 0-5 score
 * delta. For a RANGE window the boundary is whichever edge of the current
 * band isn't the "better" one (see `scoreRangeTarget`); for a FIXED target
 * it's the band's own threshold, since falling short of it is exactly what
 * drops a leaf to the next lower target it still meets (`scoreFixedTarget`).
 * `null` for a milestone (no numeric value at all) or anything missing the
 * config/value needed to place it.
 */
function metricHeadroom(leaf: ScoredNode): { distance: number; unit: string | null } | null {
  if (leaf.metricType === null || leaf.metricType === "MONTH_COMPLETION") return null;
  if (!leaf.direction || !leaf.targetConfig || !leaf.band || leaf.leaf?.value == null) return null;

  const actual =
    leaf.metricType === "VARIANCE" ? varianceMagnitude(leaf.leaf.value, leaf.leaf.plannedValue) : leaf.leaf.value;
  if (actual === null) return null;

  const raw = (leaf.targetConfig as Record<Band, number | [number, number]>)[leaf.band];
  if (raw === undefined) return null;

  const worseEdge = Array.isArray(raw)
    ? leaf.direction === "HIGHER_BETTER"
      ? Math.min(raw[0], raw[1])
      : Math.max(raw[0], raw[1])
    : raw;

  const distance = leaf.direction === "HIGHER_BETTER" ? actual - worseEdge : worseEdge - actual;
  return { distance, unit: leaf.metricType === "VARIANCE" ? "%" : leaf.unit };
}

/** Ranks every not-yet-Excellent scored leaf by its exact effect on the total. */
export function computeOpportunities(roots: ScoredNode[], total: Rollup): Opportunity[] {
  if (total.scoredWeight <= 0) return [];

  const opportunities: Opportunity[] = [];
  for (const leaf of leavesOf(roots)) {
    if (leaf.score === null || leaf.band === null || leaf.exactScore === null) continue;
    // A milestone only ever gets a score once it's due — completed (frozen
    // forever at whatever band that completion earned) or overdue and
    // decaying (scored as if completed on the last day of this period). Any
    // better band belongs to a target month that has already passed, so it
    // can never be reached from here; see computeRisks' SLIPPING_MILESTONE
    // for the only thing that's actually actionable on one of these.
    if (leaf.metricType === "MONTH_COMPLETION") continue;
    const bandIndex = BANDS.indexOf(leaf.band);
    if (bandIndex === BANDS.length - 1) continue; // already Excellent

    const nextBand = BANDS[bandIndex + 1];
    const target = bandEntryScore(nextBand, leaf.targetMode);
    if (target <= leaf.exactScore) continue;

    const scoreImpact = ((target - leaf.exactScore) * leaf.globalWeight) / total.scoredWeight;
    opportunities.push({
      kpiId: leaf.id,
      code: leaf.code,
      name: leaf.name,
      currentScore: leaf.score,
      currentBand: leaf.band,
      nextBand,
      targetDescription: describeBandTarget(leaf.targetConfig, leaf.metricType, nextBand),
      scoreImpact,
      globalWeight: leaf.globalWeight,
    });
  }

  return opportunities.sort((a, b) => b.scoreImpact - a.scoreImpact);
}

/**
 * Fits the simplest reasonable trend to a trailing run of scores: the change
 * from the first to the last reported value, per period elapsed between
 * them. This is a heads-up, not a forecast, so a two-point secant is enough —
 * it deliberately doesn't try to smooth around a wobble in the middle.
 */
function trendSlope(scores: (number | null)[]): number | null {
  const firstIdx = scores.findIndex((s) => s !== null);
  let lastIdx = -1;
  for (let i = scores.length - 1; i >= 0; i--) {
    if (scores[i] !== null) {
      lastIdx = i;
      break;
    }
  }
  if (firstIdx === -1 || lastIdx === -1 || lastIdx === firstIdx) return null;
  const first = scores[firstIdx] as number;
  const last = scores[lastIdx] as number;
  return (last - first) / (lastIdx - firstIdx);
}

const DECLINE_THRESHOLD = 0.05; // points per period — below this reads as noise, not a trend

/**
 * Ranks scored leaves by how much of the total is exposed to slipping a
 * band — either because there's little headroom left, or because the
 * trailing trend is heading toward the boundary. An incomplete milestone is
 * flagged outright rather than trend-fitted: `scoreMonthCompletion` decays it
 * on a known schedule even with no new data, so there's nothing to estimate.
 */
export function computeRisks(
  roots: ScoredNode[],
  total: Rollup,
  trailingScores: Map<string, (number | null)[]>
): Risk[] {
  if (total.scoredWeight <= 0) return [];

  const risks: Risk[] = [];
  for (const leaf of leavesOf(roots)) {
    if (leaf.score === null || leaf.band === null || leaf.exactScore === null) continue;

    const isSlippingMilestone = leaf.metricType === "MONTH_COMPLETION" && leaf.leaf?.completionDate === null;
    // A completed milestone is frozen forever (see scoreMilestoneLeaf) — it
    // can neither improve nor drop, so it carries no risk at all.
    if (leaf.metricType === "MONTH_COMPLETION" && !isSlippingMilestone) continue;
    const bandIndex = BANDS.indexOf(leaf.band);
    if (bandIndex === 0 && !isSlippingMilestone) continue; // already Poor, nothing lower to fall into

    const floor = bandIndex === 0 ? 0 : bandFloorAfterDrop(BANDS[bandIndex - 1]);
    const dropImpact = ((floor - leaf.exactScore) * leaf.globalWeight) / total.scoredWeight;
    const headroom = leaf.exactScore - BAND_BOUNDS[leaf.band].lo;

    let trend: RiskTrend = "UNKNOWN";
    let monthsToDrop: number | null = null;

    if (isSlippingMilestone) {
      trend = "SLIPPING_MILESTONE";
    } else {
      const slope = trendSlope(trailingScores.get(leaf.id) ?? []);
      if (slope === null) {
        trend = "UNKNOWN";
      } else if (slope <= -DECLINE_THRESHOLD) {
        trend = "DECLINING";
        monthsToDrop = headroom / Math.abs(slope);
      } else if (slope >= DECLINE_THRESHOLD) {
        trend = "IMPROVING";
      } else {
        trend = "STABLE";
      }
    }

    risks.push({
      kpiId: leaf.id,
      code: leaf.code,
      name: leaf.name,
      currentScore: leaf.score,
      currentBand: leaf.band,
      headroom,
      metricHeadroom: metricHeadroom(leaf),
      dropImpact,
      trend,
      monthsToDrop,
      globalWeight: leaf.globalWeight,
    });
  }

  const urgency = (r: Risk): number => (r.trend === "SLIPPING_MILESTONE" || r.trend === "DECLINING" ? 1 : 0);
  return risks.sort((a, b) => urgency(b) - urgency(a) || a.dropImpact - b.dropImpact);
}
