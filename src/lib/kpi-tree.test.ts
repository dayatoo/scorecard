import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildScoredTree, type KpiRecord } from "./kpi-tree";

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
