import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildScoredTree,
  isKpiComplete,
  type KpiRecord,
  type ScoreOverrideRecord,
  type ValueRecord,
} from "./kpi-tree";

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

describe("global weight derivation", () => {
  it("a two-root tree with an uneven child group still totals 100 at every level", () => {
    const kpis: KpiRecord[] = [
      kpi({ id: "A", weight: 50 }),
      kpi({ id: "B", weight: 50 }),
      // A's children sum to 80, not 100 — shares should still normalise so
      // 40/20/20 behaves as 50/25/25 of A's own 50% global share.
      kpi({ id: "A1", parentId: "A", weight: 40 }),
      kpi({ id: "A2", parentId: "A", weight: 20 }),
      kpi({ id: "A3", parentId: "A", weight: 20 }),
      kpi({ id: "B1", parentId: "B", weight: 100 }),
    ];

    const { roots, byId } = buildScoredTree(kpis, [], "2026-04");

    // Roots' globals total 100 whatever their own group says (here it's exactly 100).
    const rootsGlobalTotal = roots.reduce((sum, r) => sum + r.globalWeight, 0);
    assert.ok(Math.abs(rootsGlobalTotal - 100) < 1e-9);

    const a = byId.get("A")!;
    const a1 = byId.get("A1")!;
    const a2 = byId.get("A2")!;
    const a3 = byId.get("A3")!;

    assert.ok(Math.abs(a.globalWeight - 50) < 1e-9);
    // 40/80 of A's 50% share = 25%; 20/80 of it = 12.5% each.
    assert.ok(Math.abs(a1.globalWeight - 25) < 1e-9);
    assert.ok(Math.abs(a2.globalWeight - 12.5) < 1e-9);
    assert.ok(Math.abs(a3.globalWeight - 12.5) < 1e-9);

    // A parent's derived global equals the sum of its children's.
    const childSum = a1.globalWeight + a2.globalWeight + a3.globalWeight;
    assert.ok(Math.abs(childSum - a.globalWeight) < 1e-9);
  });

  it("a nested rollup child's scored weight is expressed on its parent's scale, not its own subtree's", () => {
    const percentMetric = {
      metricType: "PERCENTAGE" as const,
      direction: "HIGHER_BETTER" as const,
      targetMode: "FIXED" as const,
      targetConfig: JSON.stringify({
        POOR: 0, IMPROVEMENT_NEEDED: 25, MEET: 50, GOOD: 75, VERY_GOOD: 90, EXCELLENT: 100,
      }),
      unit: "%",
    };

    // Root -> A (weight 70, itself a rollup of A1/A2) and B (weight 30, a leaf).
    // A1 and A2 are both fully scored, so A's own children sum to 100 on A's
    // *own* internal scale — a different scale than A's 70% share of Root.
    const kpis: KpiRecord[] = [
      kpi({ id: "Root", weight: 100 }),
      kpi({ id: "A", parentId: "Root", weight: 70 }),
      kpi({ id: "B", parentId: "Root", weight: 30, ...percentMetric }),
      kpi({ id: "A1", parentId: "A", weight: 60, ...percentMetric }),
      kpi({ id: "A2", parentId: "A", weight: 40, ...percentMetric }),
    ];
    const values: ValueRecord[] = [
      // A1 reaches Meet (score 3.4), A2 reaches Good (score 3.9), B reaches
      // Excellent (score 5.0) — all fully reported, so coverage should be
      // exactly 100% everywhere, and the weighted average should treat A as
      // 70% of Root, not the 100 its own children happen to sum to.
      { kpiId: "A1", period: "2026-04", value: 50, basis: "ACTUAL", completionDate: null, note: null },
      { kpiId: "A2", period: "2026-04", value: 75, basis: "ACTUAL", completionDate: null, note: null },
      { kpiId: "B", period: "2026-04", value: 100, basis: "ACTUAL", completionDate: null, note: null },
    ];

    const { byId } = buildScoredTree(kpis, values, "2026-04");
    const root = byId.get("Root")!;
    const a = byId.get("A")!;

    // A's own rollup (A1 60% @ 3.4, A2 40% @ 3.9) = 3.6, independent of the bug.
    assert.ok(Math.abs((a.exactScore as number) - 3.6) < 1e-9);

    // Root's scored weight must equal its own total weight (100), not the
    // 130 you'd get by passing A's internal 60+40 through unscaled.
    assert.ok(Math.abs(root.scoredWeight - 100) < 1e-9);
    assert.equal(root.coverage, 1);

    // Root's weighted average must weight A by its true 70% share: (3.6*70 + 5.0*30)/100 = 4.02 -> 4.0.
    assert.ok(Math.abs((root.exactScore as number) - 4.02) < 1e-6);
    assert.equal(root.score, 4.0);
  });

  it("adding the first child to a leaf gives it 100% of the parent's share automatically", () => {
    const kpis: KpiRecord[] = [
      kpi({ id: "A", weight: 100 }),
      kpi({ id: "A1", parentId: "A", weight: 100 }),
    ];
    const { byId } = buildScoredTree(kpis, [], "2026-04");
    assert.equal(byId.get("A1")!.globalWeight, 100);
  });

  it("local weight is unaffected by depth — every node's own record is looked up directly", () => {
    const kpis: KpiRecord[] = [
      kpi({ id: "A", weight: 30 }),
      kpi({ id: "B", weight: 70 }),
      kpi({ id: "A1", parentId: "A", weight: 100 }),
    ];
    const { byId } = buildScoredTree(kpis, [], "2026-04");
    assert.equal(byId.get("A")!.weight, 30);
    assert.equal(byId.get("B")!.weight, 70);
  });
});

describe("score calibration overrides", () => {
  const percentMetric = {
    metricType: "PERCENTAGE" as const,
    direction: "HIGHER_BETTER" as const,
    targetMode: "FIXED" as const,
    targetConfig: JSON.stringify({
      POOR: 0, IMPROVEMENT_NEEDED: 25, MEET: 50, GOOD: 75, VERY_GOOD: 90, EXCELLENT: 100,
    }),
    unit: "%",
  };

  it("replaces a leaf's computed score and band, without touching the reported value", () => {
    const kpis: KpiRecord[] = [
      kpi({ id: "A", weight: 100, ...percentMetric }),
    ];
    const values: ValueRecord[] = [
      { kpiId: "A", period: "2026-04", value: 50, basis: "ACTUAL", completionDate: null, note: null },
    ];
    const overrides = new Map<string, ScoreOverrideRecord[]>([
      ["A", [{ period: "2026-04", score: 4.8, reason: "One-off windfall excluded", byUsername: "admin", createdAt: new Date("2026-05-01") }]],
    ]);

    const { byId } = buildScoredTree(kpis, values, "2026-04", overrides);
    const a = byId.get("A")!;

    assert.equal(a.score, 4.8);
    assert.equal(a.band, "EXCELLENT");
    assert.equal(a.leaf!.value, 50); // the real reported figure is untouched
    assert.deepEqual(a.leaf!.override, {
      score: 4.8,
      reason: "One-off windfall excluded",
      byUsername: "admin",
      createdAt: new Date("2026-05-01").toISOString(),
    });
  });

  it("flows into a parent's weighted average like any other score", () => {
    const kpis: KpiRecord[] = [
      kpi({ id: "Root", weight: 100 }),
      kpi({ id: "A", parentId: "Root", weight: 50, ...percentMetric }),
      kpi({ id: "B", parentId: "Root", weight: 50, ...percentMetric }),
    ];
    const values: ValueRecord[] = [
      { kpiId: "A", period: "2026-04", value: 50, basis: "ACTUAL", completionDate: null, note: null }, // Meet -> 3.4
      { kpiId: "B", period: "2026-04", value: 50, basis: "ACTUAL", completionDate: null, note: null }, // Meet -> 3.4
    ];
    const overrides = new Map<string, ScoreOverrideRecord[]>([
      ["A", [{ period: "2026-04", score: 5, reason: "Calibrated up", byUsername: "admin", createdAt: new Date() }]],
    ]);

    const { byId } = buildScoredTree(kpis, values, "2026-04", overrides);
    // (5*50 + 3.4*50)/100 = 4.2
    assert.ok(Math.abs((byId.get("Root")!.exactScore as number) - 4.2) < 1e-9);
  });

  it("clears pendingReason so an overridden not-yet-due KPI counts as fully scored", () => {
    const kpis: KpiRecord[] = [
      kpi({
        id: "A", weight: 100, metricType: "MONTH_COMPLETION",
        targetConfig: JSON.stringify({ targetMonth: "2026-12" }),
      }),
    ];
    const overrides = new Map<string, ScoreOverrideRecord[]>([
      ["A", [{ period: "2026-04", score: 4, reason: "known to be on track", byUsername: "admin", createdAt: new Date() }]],
    ]);

    const { byId } = buildScoredTree(kpis, [], "2026-04", overrides);
    const a = byId.get("A")!;
    assert.equal(a.score, 4);
    assert.equal(a.leaf!.pendingReason, null);
    assert.equal(a.notYetDueWeight, 0);
    assert.equal(a.coverage, 1);
  });

  it("does nothing for a different period than the one overridden", () => {
    const kpis: KpiRecord[] = [kpi({ id: "A", weight: 100, ...percentMetric })];
    const values: ValueRecord[] = [
      { kpiId: "A", period: "2026-05", value: 50, basis: "ACTUAL", completionDate: null, note: null },
    ];
    const overrides = new Map<string, ScoreOverrideRecord[]>([
      ["A", [{ period: "2026-04", score: 5, reason: "x", byUsername: "admin", createdAt: new Date() }]],
    ]);

    const { byId } = buildScoredTree(kpis, values, "2026-05", overrides);
    assert.equal(byId.get("A")!.leaf!.override, null);
    assert.equal(byId.get("A")!.score, 3.4); // the plain Meet score, not the override
  });
});

describe("isKpiComplete", () => {
  const percentMetric = {
    metricType: "PERCENTAGE" as const,
    direction: "HIGHER_BETTER" as const,
    targetMode: "FIXED" as const,
    targetConfig: JSON.stringify({
      POOR: 0, IMPROVEMENT_NEEDED: 25, MEET: 50, GOOD: 75, VERY_GOOD: 90, EXCELLENT: 100,
    }),
    unit: "%",
  };
  const milestoneMetric = {
    metricType: "MONTH_COMPLETION" as const,
    targetConfig: JSON.stringify({ targetMonth: "2026-12" }),
  };

  it("a milestone reported Actual is complete", () => {
    const kpis: KpiRecord[] = [kpi({ id: "M", weight: 100, ...milestoneMetric })];
    const values: ValueRecord[] = [
      { kpiId: "M", period: "2026-09", value: null, basis: "ACTUAL", completionDate: new Date("2026-09-05"), note: null },
    ];
    const { byId } = buildScoredTree(kpis, values, "2026-09");
    assert.equal(isKpiComplete(byId.get("M")!, "2026-09"), true);
  });

  it("a milestone reported Estimate is not complete", () => {
    const kpis: KpiRecord[] = [kpi({ id: "M", weight: 100, ...milestoneMetric })];
    const values: ValueRecord[] = [
      { kpiId: "M", period: "2026-09", value: null, basis: "ESTIMATE", completionDate: new Date("2026-09-05"), note: null },
    ];
    const { byId } = buildScoredTree(kpis, values, "2026-09");
    assert.equal(isKpiComplete(byId.get("M")!, "2026-09"), false);
  });

  it("a numeric KPI past its deadline reported Actual is complete", () => {
    const kpis: KpiRecord[] = [kpi({ id: "N", weight: 100, deadlineMonth: "2026-08", ...percentMetric })];
    const values: ValueRecord[] = [
      { kpiId: "N", period: "2026-09", value: 80, basis: "ACTUAL", completionDate: null, note: null },
    ];
    const { byId } = buildScoredTree(kpis, values, "2026-09");
    assert.equal(isKpiComplete(byId.get("N")!, "2026-09"), true);
  });

  it("a numeric KPI past its deadline reported Estimate is not complete", () => {
    const kpis: KpiRecord[] = [kpi({ id: "N", weight: 100, deadlineMonth: "2026-08", ...percentMetric })];
    const values: ValueRecord[] = [
      { kpiId: "N", period: "2026-09", value: 80, basis: "ESTIMATE", completionDate: null, note: null },
    ];
    const { byId } = buildScoredTree(kpis, values, "2026-09");
    assert.equal(isKpiComplete(byId.get("N")!, "2026-09"), false);
  });

  it("a numeric KPI reported Actual before its deadline is not complete", () => {
    const kpis: KpiRecord[] = [kpi({ id: "N", weight: 100, deadlineMonth: "2026-12", ...percentMetric })];
    const values: ValueRecord[] = [
      { kpiId: "N", period: "2026-09", value: 80, basis: "ACTUAL", completionDate: null, note: null },
    ];
    const { byId } = buildScoredTree(kpis, values, "2026-09");
    assert.equal(isKpiComplete(byId.get("N")!, "2026-09"), false);
  });

  it("a numeric KPI with no deadlineMonth is never complete", () => {
    const kpis: KpiRecord[] = [kpi({ id: "N", weight: 100, ...percentMetric })];
    const values: ValueRecord[] = [
      { kpiId: "N", period: "2026-09", value: 80, basis: "ACTUAL", completionDate: null, note: null },
    ];
    const { byId } = buildScoredTree(kpis, values, "2026-09");
    assert.equal(isKpiComplete(byId.get("N")!, "2026-09"), false);
  });
});

describe("scoring toggles", () => {
  const percentMetric = {
    metricType: "PERCENTAGE" as const,
    direction: "HIGHER_BETTER" as const,
    targetMode: "FIXED" as const,
    targetConfig: JSON.stringify({
      POOR: 0, IMPROVEMENT_NEEDED: 25, MEET: 50, GOOD: 75, VERY_GOOD: 90, EXCELLENT: 100,
    }),
    unit: "%",
  };

  it("with no options passed, buildScoredTree behaves exactly as before (assumed always false)", () => {
    const kpis: KpiRecord[] = [kpi({ id: "N", weight: 100, ...percentMetric })];
    const { byId } = buildScoredTree(kpis, [], "2026-04");
    const n = byId.get("N")!;
    assert.equal(n.score, null);
    assert.equal(n.assumed, false);
    assert.equal(n.assumedWeight, 0);
  });

  it("assume-meet-decay flags an unreported leaf as assumed and rolls the weight up", () => {
    const kpis: KpiRecord[] = [
      kpi({ id: "Root", weight: 100 }),
      kpi({ id: "A", parentId: "Root", weight: 60, ...percentMetric }),
      kpi({ id: "B", parentId: "Root", weight: 40, ...percentMetric }),
    ];
    const values: ValueRecord[] = [
      { kpiId: "B", period: "2026-04", value: 50, basis: "ACTUAL", completionDate: null, note: null },
    ];
    const { byId } = buildScoredTree(kpis, values, "2026-04", undefined, {
      dueMode: "assume-meet-decay",
      estimateMode: "count",
    });

    const a = byId.get("A")!;
    assert.equal(a.assumed, true);
    assert.equal(a.score, 3.4);
    assert.equal(a.assumedWeight, 60);

    const b = byId.get("B")!;
    assert.equal(b.assumed, false);
    assert.equal(b.assumedWeight, 0);

    // The parent's assumedWeight is A's weight (60), nested-rescaled exactly
    // like scoredWeight/provisionalWeight already are for this same tree
    // shape — A and B together are the whole of Root's own weight.
    const root = byId.get("Root")!;
    assert.equal(root.assumed, true);
    assert.ok(Math.abs(root.assumedWeight - 60) < 1e-9);
  });

  it("estimateMode zero scores an ESTIMATE-basis leaf as 0 without flagging it assumed", () => {
    const kpis: KpiRecord[] = [kpi({ id: "A", weight: 100, ...percentMetric })];
    const values: ValueRecord[] = [
      { kpiId: "A", period: "2026-04", value: 80, basis: "ESTIMATE", completionDate: null, note: null },
    ];
    const { byId } = buildScoredTree(kpis, values, "2026-04", undefined, {
      dueMode: "exclude",
      estimateMode: "zero",
    });
    const a = byId.get("A")!;
    assert.equal(a.score, 0);
    assert.equal(a.provisional, false);
    assert.equal(a.assumed, false);
  });
});
