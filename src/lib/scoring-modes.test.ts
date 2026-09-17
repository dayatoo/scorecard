import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scoreLeaf, type Entry, type FixedTargetConfig, type KpiDefinition } from "./scoring";
import {
  applyScoringMode,
  assumedScoreForLateness,
  filterEntriesForMode,
  monthsLateForNumeric,
  DEFAULT_SCORING_OPTIONS,
} from "./scoring-modes";

const fixedUp: FixedTargetConfig = {
  POOR: 98,
  IMPROVEMENT_NEEDED: 99,
  MEET: 100,
  GOOD: 101,
  VERY_GOOD: 102,
  EXCELLENT: 103,
};

const numericKpi: KpiDefinition = {
  metricType: "QUANTITY",
  direction: "HIGHER_BETTER",
  targetMode: "FIXED",
  targetConfig: fixedUp,
  deadlineMonth: null,
  scoreFinalAfterDeadline: false,
  frequency: "MONTHLY",
};

const milestoneKpi: KpiDefinition = {
  metricType: "MONTH_COMPLETION",
  direction: null,
  targetMode: "MONTH_COMPLETION" as never,
  targetConfig: { targetMonth: "2026-10" },
  deadlineMonth: null,
  scoreFinalAfterDeadline: false,
};

describe("assumedScoreForLateness", () => {
  it("follows the same lateness bands as latenessCap", () => {
    assert.equal(assumedScoreForLateness(0), 3.4);
    assert.equal(assumedScoreForLateness(-1), 3.4);
    assert.equal(assumedScoreForLateness(1), 2.9);
    assert.equal(assumedScoreForLateness(2), 2.4);
    assert.equal(assumedScoreForLateness(3), 0);
    assert.equal(assumedScoreForLateness(10), 0);
  });
});

describe("monthsLateForNumeric", () => {
  it("uses the explicit deadline when one is set", () => {
    const kpi = { ...numericKpi, deadlineMonth: "2026-06" };
    assert.equal(monthsLateForNumeric(kpi, [], "2026-06"), 0);
    assert.equal(monthsLateForNumeric(kpi, [], "2026-08"), 2);
    assert.equal(monthsLateForNumeric(kpi, [], "2026-05"), 0);
  });

  it("a MONTHLY KPI with no deadline is late from its most recent entry", () => {
    const entries: Entry[] = [
      { period: "2026-06", value: 10, basis: "ACTUAL", completionDate: null },
    ];
    assert.equal(monthsLateForNumeric(numericKpi, entries, "2026-06"), 0);
    assert.equal(monthsLateForNumeric(numericKpi, entries, "2026-09"), 3);
  });

  it("a MONTHLY KPI with no entries at all is late from the fiscal year start", () => {
    // Fiscal year starts in April; period 2026-07 is fiscal month 4.
    assert.equal(monthsLateForNumeric(numericKpi, [], "2026-07"), 3);
  });

  it("a QUARTERLY KPI with no deadline is only late once its own due month has passed unreported", () => {
    const kpi: KpiDefinition = { ...numericKpi, frequency: "QUARTERLY" };
    // Fiscal month 3 (June) is the first QUARTERLY due month.
    assert.equal(monthsLateForNumeric(kpi, [], "2026-05"), 0); // due month hasn't arrived yet
    assert.equal(monthsLateForNumeric(kpi, [], "2026-08"), 2); // due June, now August, nothing reported
    const reported: Entry[] = [
      { period: "2026-06", value: 10, basis: "ACTUAL", completionDate: null },
    ];
    assert.equal(monthsLateForNumeric(kpi, reported, "2026-08"), 0);
  });
});

describe("applyScoringMode", () => {
  it("returns the leaf unchanged (plus assumed: false) under default options", () => {
    const entries: Entry[] = [{ period: "2026-06", value: 100, basis: "ACTUAL", completionDate: null }];
    const leaf = scoreLeaf(numericKpi, entries, "2026-06");
    const result = applyScoringMode(leaf, numericKpi, entries, "2026-06", DEFAULT_SCORING_OPTIONS);
    assert.deepEqual({ ...result, assumed: undefined }, { ...leaf, assumed: undefined });
    assert.equal(result.assumed, false);
  });

  it("assume-meet-decay synthesizes a decaying score for an unreported MONTHLY KPI", () => {
    const leaf = scoreLeaf(numericKpi, [], "2026-07"); // fiscal month 4, 3 months since FY start
    const result = applyScoringMode(leaf, numericKpi, [], "2026-07", {
      dueMode: "assume-meet-decay",
      estimateMode: "count",
    });
    assert.equal(result.score, 0); // 3+ months late
    assert.equal(result.assumed, true);
    assert.equal(result.pendingReason, null);
  });

  it("assume-meet-decay gives a not-yet-due milestone the Meet default, not an overdue one", () => {
    const notYetDue = scoreLeaf(milestoneKpi, [], "2026-08"); // before target month
    const notYetDueResult = applyScoringMode(notYetDue, milestoneKpi, [], "2026-08", {
      dueMode: "assume-meet-decay",
      estimateMode: "count",
    });
    assert.equal(notYetDueResult.score, 3.4);
    assert.equal(notYetDueResult.assumed, true);

    // Past the target month, scoreMilestoneLeaf already returns a real score
    // via its own untouched ladder logic — applyScoringMode must leave it alone.
    const overdue = scoreLeaf(milestoneKpi, [], "2026-11");
    assert.notEqual(overdue.score, null);
    const overdueResult = applyScoringMode(overdue, milestoneKpi, [], "2026-11", {
      dueMode: "assume-meet-decay",
      estimateMode: "count",
    });
    assert.equal(overdueResult.score, overdue.score);
    assert.equal(overdueResult.assumed, false);
  });

  it("dueMode zero forces an unreported MONTHLY KPI's score to 0", () => {
    const leaf = scoreLeaf(numericKpi, [], "2026-06"); // no entries — unreported
    assert.equal(leaf.score, null);
    const result = applyScoringMode(leaf, numericKpi, [], "2026-06", {
      dueMode: "zero",
      estimateMode: "count",
    });
    assert.equal(result.score, 0);
    assert.equal(result.band, "POOR");
    assert.equal(result.assumed, true);
    assert.equal(result.pendingReason, null);
  });

  it("dueMode zero also scores a not-yet-due milestone as 0, unlike assume-meet-decay", () => {
    const notYetDue = scoreLeaf(milestoneKpi, [], "2026-08"); // before target month
    assert.equal(notYetDue.score, null);
    assert.equal(notYetDue.pendingReason, "NOT_YET_DUE");
    const result = applyScoringMode(notYetDue, milestoneKpi, [], "2026-08", {
      dueMode: "zero",
      estimateMode: "count",
    });
    assert.equal(result.score, 0);
    assert.equal(result.assumed, true);
    assert.equal(result.pendingReason, null);
  });

  it("estimateMode zero forces an ESTIMATE-basis score to 0", () => {
    const entries: Entry[] = [{ period: "2026-06", value: 102, basis: "ESTIMATE", completionDate: null }];
    const leaf = scoreLeaf(numericKpi, entries, "2026-06");
    assert.notEqual(leaf.score, 0);
    const result = applyScoringMode(leaf, numericKpi, entries, "2026-06", {
      dueMode: "exclude",
      estimateMode: "zero",
    });
    assert.equal(result.score, 0);
    assert.equal(result.provisional, false);
    assert.equal(result.assumed, false);
  });

  it("filterEntriesForMode + assume-meet-decay: an excluded estimate is treated as missing", () => {
    const entries: Entry[] = [{ period: "2026-06", value: 102, basis: "ESTIMATE", completionDate: null }];
    const filtered = filterEntriesForMode(entries, "exclude");
    assert.deepEqual(filtered, []);
    const leaf = scoreLeaf(numericKpi, filtered, "2026-06");
    assert.equal(leaf.score, null);
    const result = applyScoringMode(leaf, numericKpi, filtered, "2026-06", {
      dueMode: "assume-meet-decay",
      estimateMode: "exclude",
    });
    assert.equal(result.assumed, true);
    // No entries at all once ESTIMATE is excluded, so lateness counts from
    // the fiscal year start: 2026-06 is fiscal month 3 (April=1), 2 late.
    assert.equal(result.score, 2.4);
  });

  it("filterEntriesForMode is a no-op for count/zero modes", () => {
    const entries: Entry[] = [{ period: "2026-06", value: 102, basis: "ESTIMATE", completionDate: null }];
    assert.equal(filterEntriesForMode(entries, "count"), entries);
    assert.equal(filterEntriesForMode(entries, "zero"), entries);
  });
});
