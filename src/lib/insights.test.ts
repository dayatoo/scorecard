import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeOpportunities, computeRisks } from "./insights";
import { buildScoredTree, leavesOf, type KpiRecord, type ScoreOverrideRecord, type ValueRecord } from "./kpi-tree";
import { BAND_BOUNDS, roundScore } from "./scoring";

function kpi(overrides: Partial<KpiRecord> & { id: string }): KpiRecord {
  return {
    code: overrides.id,
    name: overrides.id,
    parentId: null,
    sortOrder: 0,
    weight: 0,
    metricType: null,
    direction: null,
    targetMode: null,
    targetConfig: null,
    unit: null,
    deadlineMonth: null,
    scoreFinalAfterDeadline: false,
    completed: false,
    completedPeriod: null,
    departments: [],
    ...overrides,
  };
}

const fixedMetric = {
  metricType: "QUANTITY" as const,
  direction: "HIGHER_BETTER" as const,
  targetMode: "FIXED" as const,
  targetConfig: JSON.stringify({ POOR: 10, IMPROVEMENT_NEEDED: 20, MEET: 30, GOOD: 40, VERY_GOOD: 50, EXCELLENT: 60 }),
};

const rangeMetric = {
  metricType: "PERCENTAGE" as const,
  direction: "HIGHER_BETTER" as const,
  targetMode: "RANGE" as const,
  targetConfig: JSON.stringify({
    POOR: [0, 49], IMPROVEMENT_NEEDED: [50, 69], MEET: [70, 79],
    GOOD: [80, 89], VERY_GOOD: [90, 95], EXCELLENT: [96, 100],
  }),
};

describe("computeOpportunities — target asymmetry by mode", () => {
  it("a FIXED leaf's opportunity target is the next band's hi (discrete jump)", () => {
    const kpis: KpiRecord[] = [kpi({ id: "Root", weight: 100 }), kpi({ id: "A", parentId: "Root", weight: 100, ...fixedMetric })];
    // Meets Meet's target (30) exactly -> scores MEET.hi (3.4).
    const values: ValueRecord[] = [{ kpiId: "A", period: "2026-04", value: 30, basis: "ACTUAL", completionDate: null, note: null }];
    const { roots, total } = buildScoredTree(kpis, values, "2026-04");

    const [opp] = computeOpportunities(roots, total);
    assert.equal(opp.currentBand, "MEET");
    assert.equal(opp.nextBand, "GOOD");
    // Impact reflects reaching GOOD.hi (3.9), not GOOD.lo (3.5).
    const expectedDelta = BAND_BOUNDS.GOOD.hi - 3.4;
    assert.ok(Math.abs(opp.scoreImpact - expectedDelta) < 1e-9);
  });

  it("a RANGE leaf's opportunity target is the next band's lo (continuous entry)", () => {
    const kpis: KpiRecord[] = [kpi({ id: "Root", weight: 100 }), kpi({ id: "A", parentId: "Root", weight: 100, ...rangeMetric })];
    // Dead center of Meet's window (70-79) -> scores halfway between 3.0 and 3.4.
    const values: ValueRecord[] = [{ kpiId: "A", period: "2026-04", value: 74.5, basis: "ACTUAL", completionDate: null, note: null }];
    const { roots, total } = buildScoredTree(kpis, values, "2026-04");

    const [opp] = computeOpportunities(roots, total);
    assert.equal(opp.currentBand, "MEET");
    assert.equal(opp.nextBand, "GOOD");
    const leafExact = roundScore(3.0 + 0.5 * (3.4 - 3.0));
    const expectedDelta = BAND_BOUNDS.GOOD.lo - leafExact;
    assert.ok(Math.abs(opp.scoreImpact - expectedDelta) < 1e-6);
  });

  it("excludes an already-Excellent leaf", () => {
    const kpis: KpiRecord[] = [kpi({ id: "Root", weight: 100 }), kpi({ id: "A", parentId: "Root", weight: 100, ...fixedMetric })];
    const values: ValueRecord[] = [{ kpiId: "A", period: "2026-04", value: 60, basis: "ACTUAL", completionDate: null, note: null }];
    const { roots, total } = buildScoredTree(kpis, values, "2026-04");
    assert.deepEqual(computeOpportunities(roots, total), []);
  });

  it("excludes a scored, incomplete, overdue milestone — no band above its current one is reachable", () => {
    const kpis: KpiRecord[] = [
      kpi({ id: "Root", weight: 100, metricType: "MONTH_COMPLETION", targetConfig: JSON.stringify({ targetMonth: "2026-01" }) }),
    ];
    // Never completed, and the target month (Jan 2026) is well behind the scored period.
    const { roots, total } = buildScoredTree(kpis, [], "2026-04");
    assert.deepEqual(computeOpportunities(roots, total), []);
  });

  it("excludes a completed milestone frozen at a middling band — it can no longer move at all", () => {
    const kpis: KpiRecord[] = [
      kpi({ id: "Root", weight: 100, metricType: "MONTH_COMPLETION", targetConfig: JSON.stringify({ targetMonth: "2026-01" }) }),
    ];
    // Completed one month late -> frozen at Improvement Needed forever.
    const values: ValueRecord[] = [
      { kpiId: "Root", period: "2026-02", value: null, basis: "ACTUAL", completionDate: new Date("2026-02-15"), note: null },
    ];
    const { roots, total } = buildScoredTree(kpis, values, "2026-04");
    assert.equal(leavesOf(roots)[0]!.band, "IMPROVEMENT_NEEDED");
    assert.deepEqual(computeOpportunities(roots, total), []);
  });
});

describe("computeOpportunities — additivity, cross-checked against an independent override simulation", () => {
  it("the sum of two leaves' impacts equals the actual change in the total when both are pushed up a band", () => {
    const kpis: KpiRecord[] = [
      kpi({ id: "Root", weight: 100 }),
      kpi({ id: "A", parentId: "Root", weight: 60, ...fixedMetric }),
      kpi({ id: "B", parentId: "Root", weight: 40, ...rangeMetric }),
    ];
    const values: ValueRecord[] = [
      { kpiId: "A", period: "2026-04", value: 30, basis: "ACTUAL", completionDate: null, note: null }, // Meet
      { kpiId: "B", period: "2026-04", value: 74.5, basis: "ACTUAL", completionDate: null, note: null }, // Meet
    ];
    const before = buildScoredTree(kpis, values, "2026-04");
    const opportunities = computeOpportunities(before.roots, before.total);
    const predictedSum = opportunities.reduce((sum, o) => sum + o.scoreImpact, 0);

    // Independently verify by forcing both leaves to their next band's entry
    // score via the app's own score-override mechanism, then diffing the
    // actual rebuilt total — a simulation that shares none of insights.ts's
    // arithmetic.
    const overrides = new Map<string, ScoreOverrideRecord[]>([
      ["A", [{ period: "2026-04", score: BAND_BOUNDS.GOOD.hi, reason: "sim", byUsername: "t", createdAt: new Date() }]],
      ["B", [{ period: "2026-04", score: BAND_BOUNDS.GOOD.lo, reason: "sim", byUsername: "t", createdAt: new Date() }]],
    ]);
    const after = buildScoredTree(kpis, values, "2026-04", overrides);

    const actualDelta = after.total.exactScore! - before.total.exactScore!;
    assert.ok(Math.abs(predictedSum - actualDelta) < 1e-9);
  });
});

describe("computeRisks", () => {
  it("gives headroom and a fixed drop-floor at the top of the lower band", () => {
    const kpis: KpiRecord[] = [kpi({ id: "Root", weight: 100 }), kpi({ id: "A", parentId: "Root", weight: 100, ...rangeMetric })];
    // Rounds to a leaf score of 3.6 — a little above Good's own floor (3.5).
    const values: ValueRecord[] = [{ kpiId: "A", period: "2026-04", value: 82.25, basis: "ACTUAL", completionDate: null, note: null }];
    const { roots, total } = buildScoredTree(kpis, values, "2026-04");

    const [risk] = computeRisks(roots, total, new Map());
    assert.equal(risk.currentBand, "GOOD");
    assert.ok(risk.headroom > 0 && risk.headroom < 0.2);
    const leaf = leavesOf(roots)[0]!;
    const expectedDrop = ((BAND_BOUNDS.MEET.hi - leaf.exactScore!) * leaf.globalWeight) / total.scoredWeight;
    assert.ok(Math.abs(risk.dropImpact - expectedDrop) < 1e-9);
    // The metric-unit margin: 82.25 is 2.25 above Good's own floor (80), the
    // value at which it would cross into Meet — not a 0-5 score delta.
    assert.deepEqual(risk.metricHeadroom, { distance: 2.25, unit: null });
  });

  it("gives a null metric headroom for a milestone — there's no numeric value to be a distance from", () => {
    const kpis: KpiRecord[] = [
      kpi({ id: "Root", weight: 100, metricType: "MONTH_COMPLETION", targetConfig: JSON.stringify({ targetMonth: "2026-01" }) }),
    ];
    const { roots, total } = buildScoredTree(kpis, [], "2026-04");
    const [risk] = computeRisks(roots, total, new Map());
    assert.equal(risk.metricHeadroom, null);
  });

  it("excludes an already-Poor leaf (nothing lower to fall into)", () => {
    const kpis: KpiRecord[] = [kpi({ id: "Root", weight: 100 }), kpi({ id: "A", parentId: "Root", weight: 100, ...fixedMetric })];
    const values: ValueRecord[] = [{ kpiId: "A", period: "2026-04", value: 1, basis: "ACTUAL", completionDate: null, note: null }];
    const { roots, total } = buildScoredTree(kpis, values, "2026-04");
    assert.deepEqual(computeRisks(roots, total, new Map()), []);
  });

  it("classifies a declining trend and projects months-to-drop", () => {
    const kpis: KpiRecord[] = [kpi({ id: "Root", weight: 100 }), kpi({ id: "A", parentId: "Root", weight: 100, ...rangeMetric })];
    const values: ValueRecord[] = [{ kpiId: "A", period: "2026-04", value: 82.25, basis: "ACTUAL", completionDate: null, note: null }];
    const { roots, total } = buildScoredTree(kpis, values, "2026-04");

    const trailing = new Map([[leavesOf(roots)[0]!.id, [4.0, 3.9, 3.8, 3.6]]]);
    const [risk] = computeRisks(roots, total, trailing);
    assert.equal(risk.trend, "DECLINING");
    assert.ok(risk.monthsToDrop !== null && risk.monthsToDrop > 0);
  });

  it("flags an incomplete, overdue milestone as slipping regardless of trend data", () => {
    const kpis: KpiRecord[] = [
      kpi({ id: "Root", weight: 100 }),
      kpi({
        id: "A", parentId: "Root", weight: 100,
        metricType: "MONTH_COMPLETION", targetConfig: JSON.stringify({ targetMonth: "2026-01" }),
      }),
    ];
    // Never completed, and the target month (Jan 2026) is behind the scored period.
    const { roots, total } = buildScoredTree(kpis, [], "2026-04");

    const [risk] = computeRisks(roots, total, new Map());
    assert.equal(risk.trend, "SLIPPING_MILESTONE");
    assert.equal(risk.monthsToDrop, null);
  });

  it("excludes a completed milestone — frozen, so no longer at risk", () => {
    const kpis: KpiRecord[] = [
      kpi({
        id: "Root", weight: 100,
        metricType: "MONTH_COMPLETION", targetConfig: JSON.stringify({ targetMonth: "2026-01" }),
      }),
    ];
    const values: ValueRecord[] = [
      { kpiId: "Root", period: "2026-01", value: null, basis: "ACTUAL", completionDate: new Date("2026-01-15") , note: null },
    ];
    const { roots, total } = buildScoredTree(kpis, values, "2026-04");
    assert.deepEqual(computeRisks(roots, total, new Map()), []);
  });
});
