import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  phaseFraction,
  scalePhasedTarget,
  scoreFixedTarget,
  scoreLeaf,
  type FixedTargetConfig,
} from "./scoring";

describe("phaseFraction", () => {
  it("NONE is always the full target", () => {
    assert.equal(phaseFraction("NONE", 1, null), 1);
    assert.equal(phaseFraction("NONE", 12, null), 1);
  });

  it("EVEN divides evenly across the year", () => {
    assert.equal(phaseFraction("EVEN", 5, null), 5 / 12);
    assert.equal(phaseFraction("EVEN", 12, null), 1);
  });

  it("CUSTOM cumulates its own monthly shares", () => {
    const shares = [10, 10, 10, 10, 10, 10, 10, 10, 5, 5, 5, 5];
    assert.equal(phaseFraction("CUSTOM", 3, shares), 30 / 100);
    assert.equal(phaseFraction("CUSTOM", 12, shares), 100 / 100);
  });
});

describe("scalePhasedTarget", () => {
  const fixed: FixedTargetConfig = {
    POOR: 100, IMPROVEMENT_NEEDED: 200, MEET: 300, GOOD: 400, VERY_GOOD: 500, EXCELLENT: 600,
  };

  it("scales every band by the same fraction, preserving order", () => {
    const scaled = scalePhasedTarget(fixed, "FIXED", 0.5) as FixedTargetConfig;
    assert.deepEqual(scaled, {
      POOR: 50, IMPROVEMENT_NEEDED: 100, MEET: 150, GOOD: 200, VERY_GOOD: 250, EXCELLENT: 300,
    });
  });

  it("scaling works for a LOWER_BETTER config too — smaller caps, same ordering", () => {
    const cap: FixedTargetConfig = {
      POOR: 120, IMPROVEMENT_NEEDED: 110, MEET: 100, GOOD: 90, VERY_GOOD: 80, EXCELLENT: 70,
    };
    const scaled = scalePhasedTarget(cap, "FIXED", 5 / 12) as FixedTargetConfig;
    assert.ok(scaled.POOR > scaled.IMPROVEMENT_NEEDED);
    assert.ok(scaled.MEET > scaled.GOOD);
    assert.equal(scaled.MEET, 100 * (5 / 12));
  });

  it("is a reference-equality no-op at fraction 1 — the NONE case", () => {
    const scaled = scalePhasedTarget(fixed, "FIXED", 1);
    assert.equal(scaled, fixed);
  });

  it("passes a MONTH_COMPLETION config through untouched", () => {
    const monthConfig = { targetMonth: "2026-10" };
    assert.equal(scalePhasedTarget(monthConfig, null, 0.5), monthConfig);
  });
});

describe("scoreLeaf with phasing", () => {
  const base = {
    metricType: "QUANTITY" as const,
    direction: "HIGHER_BETTER" as const,
    targetMode: "FIXED" as const,
    targetConfig: {
      POOR: 20_000, IMPROVEMENT_NEEDED: 40_000, MEET: 60_000,
      GOOD: 80_000, VERY_GOOD: 90_000, EXCELLENT: 100_000,
    },
    deadlineMonth: null,
    scoreFinalAfterDeadline: false,
  };

  it("a cumulative KPI on plan scores a deep miss with NONE but Meet with EVEN phasing", () => {
    // 5/12 of the year elapsed (fiscal months: Apr=1 ... Aug=5), figure exactly on the even-phased plan.
    const entries = [{ period: "2026-08", value: 25_000, basis: "ACTUAL" as const, completionDate: null }];

    const none = scoreLeaf({ ...base, phasing: "NONE" }, entries, "2026-08");
    assert.ok((none.score ?? 0) < 3, "unphased, 25k against a 60k Meet target should be a deep miss");

    const even = scoreLeaf({ ...base, phasing: "EVEN" }, entries, "2026-08");
    assert.equal(even.prorated, true);
    // 5/12 of the Meet target (60,000) is 25,000 exactly.
    assert.equal(even.score, 3.4);
  });

  it("a CUSTOM schedule with even shares scores identically to EVEN", () => {
    // Deliberately not on a band boundary, so a floating-point epsilon
    // between the two ways of computing 5/12 can't flip which band it lands
    // in — the two methods should agree on the score, not on the last bit.
    const entries = [{ period: "2026-08", value: 22_000, basis: "ACTUAL" as const, completionDate: null }];
    const evenShares = Array(12).fill(100 / 12);
    const custom = scoreLeaf(
      { ...base, phasing: "CUSTOM", phaseConfig: evenShares },
      entries,
      "2026-08"
    );
    const even = scoreLeaf({ ...base, phasing: "EVEN" }, entries, "2026-08");
    assert.equal(custom.score, even.score);
  });

  it("MONTH_COMPLETION is unaffected by a phasing field, even if one is set", () => {
    const milestoneBase = {
      metricType: "MONTH_COMPLETION" as const,
      direction: null, targetMode: null,
      targetConfig: { targetMonth: "2026-10" },
      deadlineMonth: null, scoreFinalAfterDeadline: false,
      phasing: "EVEN" as const,
    };
    const result = scoreLeaf(milestoneBase, [], "2026-06");
    assert.equal(result.pendingReason, "NOT_YET_DUE");
    assert.equal(result.prorated, false);
  });

  it("every KPI left at NONE scores exactly as it did before phasing existed", () => {
    const entries = [{ period: "2026-08", value: 65_000, basis: "ACTUAL" as const, completionDate: null }];
    const withPhasingField = scoreLeaf({ ...base, phasing: "NONE" }, entries, "2026-08");
    const withoutPhasingField = scoreLeaf(base, entries, "2026-08");
    assert.deepEqual(withPhasingField, withoutPhasingField);
    assert.equal(withPhasingField.score, scoreFixedTarget(65_000, base.targetConfig, "HIGHER_BETTER"));
  });
});
