import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  checkDepth,
  checkWeights,
  checkZeroWeights,
  MAX_KPI_DEPTH,
  orderingIssue,
} from "./validation";
import type { KpiRecord } from "./kpi-tree";

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

describe("orderingIssue", () => {
  it("passes a well-ordered HIGHER_BETTER fixed target", () => {
    const issue = orderingIssue(
      { POOR: 1, IMPROVEMENT_NEEDED: 2, MEET: 3, GOOD: 4, VERY_GOOD: 5, EXCELLENT: 6 },
      "FIXED",
      "HIGHER_BETTER"
    );
    assert.equal(issue, null);
  });

  it("passes a well-ordered LOWER_BETTER range target", () => {
    const issue = orderingIssue(
      {
        POOR: [20, 100], IMPROVEMENT_NEEDED: [16, 19.9], MEET: [12, 15.9],
        GOOD: [9, 11.9], VERY_GOOD: [6, 8.9], EXCELLENT: [0, 5.9],
      },
      "RANGE",
      "LOWER_BETTER"
    );
    assert.equal(issue, null);
  });

  it("rejects two equal adjacent bands", () => {
    const issue = orderingIssue(
      { POOR: 1, IMPROVEMENT_NEEDED: 1, MEET: 3, GOOD: 4, VERY_GOOD: 5, EXCELLENT: 6 },
      "FIXED",
      "HIGHER_BETTER"
    );
    assert.ok(issue?.includes("not higher"));
  });
});

describe("checkDepth", () => {
  it("passes a tree exactly at the maximum depth", () => {
    const chain: KpiRecord[] = [];
    let parentId: string | null = null;
    for (let i = 1; i <= MAX_KPI_DEPTH; i++) {
      chain.push(kpi({ id: `L${i}`, parentId }));
      parentId = `L${i}`;
    }
    assert.deepEqual(checkDepth(chain), []);
  });

  it("warns on a tree one level deeper than the maximum", () => {
    const chain: KpiRecord[] = [];
    let parentId: string | null = null;
    for (let i = 1; i <= MAX_KPI_DEPTH + 1; i++) {
      chain.push(kpi({ id: `L${i}`, parentId }));
      parentId = `L${i}`;
    }
    const issues = checkDepth(chain);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].severity, "warning");
  });
});

describe("checkWeights — per sibling group", () => {
  it("passes when every group sums to 100, including 33.33 x 3", () => {
    const kpis = [
      kpi({ id: "A", weight: 33.33 }),
      kpi({ id: "B", weight: 33.33 }),
      kpi({ id: "C", weight: 33.34 }),
    ];
    assert.deepEqual(checkWeights(kpis), []);
  });

  it("warns by name only about the group that is wrong, leaving others silent", () => {
    const kpis = [
      kpi({ id: "P1", weight: 50 }),
      kpi({ id: "P2", weight: 50 }),
      kpi({ id: "C1", parentId: "P1", weight: 40 }),
      kpi({ id: "C2", parentId: "P1", weight: 40 }), // P1's children sum to 80
      kpi({ id: "C3", parentId: "P2", weight: 60 }),
      kpi({ id: "C4", parentId: "P2", weight: 40 }), // P2's children sum to 100
    ];
    const issues = checkWeights(kpis);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kpiCode, "P1");
    assert.match(issues[0].message, /80\.00%/);
  });

  it("is a warning, never a block", () => {
    const issues = checkWeights([kpi({ id: "A", weight: 10 })]);
    assert.ok(issues.every((i) => i.severity === "warning"));
  });
});

describe("checkZeroWeights", () => {
  it("flags a zero-weight node whether it is a leaf or a parent", () => {
    const kpis = [
      kpi({ id: "P", weight: 0 }),
      kpi({ id: "L", parentId: "P", weight: 100 }),
    ];
    const issues = checkZeroWeights(kpis);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kpiCode, "P");
  });
});
