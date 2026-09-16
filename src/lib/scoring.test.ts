import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BANDS,
  BAND_BOUNDS,
  applyDeadline,
  bandForScore,
  latenessCap,
  monthsBetween,
  rollup,
  roundScore,
  scoreFixedTarget,
  scoreLeaf,
  scoreMonthCompletion,
  scoreRangeTarget,
  selectEntry,
  shiftPeriod,
  varianceMagnitude,
  type Entry,
  type FixedTargetConfig,
  type KpiDefinition,
  type RangeTargetConfig,
} from "./scoring";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

// Targets stepping by 1, as the KPIs in this app are defined.
const fixedUp: FixedTargetConfig = {
  POOR: 98,
  IMPROVEMENT_NEEDED: 99,
  MEET: 100,
  GOOD: 101,
  VERY_GOOD: 102,
  EXCELLENT: 103,
};

// "Lower is better", e.g. days taken to close the books.
const fixedDown: FixedTargetConfig = {
  POOR: 12,
  IMPROVEMENT_NEEDED: 11,
  MEET: 10,
  GOOD: 9,
  VERY_GOOD: 8,
  EXCELLENT: 7,
};

describe("bands", () => {
  it("assigns every 1dp score between 0 and 5 to exactly one band", () => {
    for (let tenths = 0; tenths <= 50; tenths++) {
      const score = tenths / 10;
      const band = bandForScore(score);
      const { lo, hi } = BAND_BOUNDS[band];
      assert.ok(
        score >= lo && score <= hi,
        `${score} was placed in ${band} (${lo}-${hi}) but does not fall inside it`
      );
    }
  });

  it("leaves no gap between consecutive bands at 1dp resolution", () => {
    for (let i = 1; i < BANDS.length; i++) {
      const previousTop = BAND_BOUNDS[BANDS[i - 1]].hi;
      const thisBottom = BAND_BOUNDS[BANDS[i]].lo;
      assert.equal(
        Math.round((thisBottom - previousTop) * 10),
        1,
        `${BANDS[i - 1]} -> ${BANDS[i]} is not one decimal step`
      );
    }
  });
});

describe("roundScore", () => {
  it("rounds to one decimal place and clamps to 0..5", () => {
    assert.equal(roundScore(3.44), 3.4);
    assert.equal(roundScore(3.45), 3.5);
    assert.equal(roundScore(-2), 0);
    assert.equal(roundScore(7.3), 5);
    assert.equal(roundScore(Number.NaN), 0);
  });
});

describe("scoreFixedTarget — higher is better", () => {
  it("scores the top of the highest band whose target is met", () => {
    assert.equal(scoreFixedTarget(98, fixedUp, "HIGHER_BETTER"), 2.4);
    assert.equal(scoreFixedTarget(99, fixedUp, "HIGHER_BETTER"), 2.9);
    assert.equal(scoreFixedTarget(100, fixedUp, "HIGHER_BETTER"), 3.4);
    assert.equal(scoreFixedTarget(101, fixedUp, "HIGHER_BETTER"), 3.9);
    assert.equal(scoreFixedTarget(102, fixedUp, "HIGHER_BETTER"), 4.5);
    assert.equal(scoreFixedTarget(103, fixedUp, "HIGHER_BETTER"), 5);
  });

  it("caps at 5 beyond the Excellent target", () => {
    assert.equal(scoreFixedTarget(500, fixedUp, "HIGHER_BETTER"), 5);
  });

  it("holds the lower band's top for a value between two targets", () => {
    assert.equal(scoreFixedTarget(100.5, fixedUp, "HIGHER_BETTER"), 3.4);
  });

  it("scales proportionally below the Poor target", () => {
    assert.equal(scoreFixedTarget(49, fixedUp, "HIGHER_BETTER"), 1.2);
    assert.equal(scoreFixedTarget(0, fixedUp, "HIGHER_BETTER"), 0);
    assert.equal(roundScore(scoreFixedTarget(24.5, fixedUp, "HIGHER_BETTER")), 0.6);
  });
});

describe("scoreFixedTarget — lower is better", () => {
  it("scores the top of the highest band whose target is met", () => {
    assert.equal(scoreFixedTarget(12, fixedDown, "LOWER_BETTER"), 2.4);
    assert.equal(scoreFixedTarget(11, fixedDown, "LOWER_BETTER"), 2.9);
    assert.equal(scoreFixedTarget(10, fixedDown, "LOWER_BETTER"), 3.4);
    assert.equal(scoreFixedTarget(9, fixedDown, "LOWER_BETTER"), 3.9);
    assert.equal(scoreFixedTarget(8, fixedDown, "LOWER_BETTER"), 4.5);
    assert.equal(scoreFixedTarget(7, fixedDown, "LOWER_BETTER"), 5);
    assert.equal(scoreFixedTarget(1, fixedDown, "LOWER_BETTER"), 5);
  });

  it("scales proportionally when it overshoots the Poor target", () => {
    assert.equal(scoreFixedTarget(24, fixedDown, "LOWER_BETTER"), 1.2);
    assert.equal(scoreFixedTarget(48, fixedDown, "LOWER_BETTER"), 0.6);
  });
});

describe("scoreRangeTarget", () => {
  const range: RangeTargetConfig = {
    POOR: [0, 49],
    IMPROVEMENT_NEEDED: [50, 69],
    MEET: [70, 79],
    GOOD: [80, 89],
    VERY_GOOD: [90, 95],
    EXCELLENT: [96, 100],
  };

  it("maps each window's edges to its band's score bounds", () => {
    assert.equal(roundScore(scoreRangeTarget(70, range, "HIGHER_BETTER")), 3);
    assert.equal(roundScore(scoreRangeTarget(79, range, "HIGHER_BETTER")), 3.4);
    assert.equal(roundScore(scoreRangeTarget(80, range, "HIGHER_BETTER")), 3.5);
    assert.equal(roundScore(scoreRangeTarget(89, range, "HIGHER_BETTER")), 3.9);
  });

  it("interpolates inside a window", () => {
    // Midpoint of the Meet window sits midway between 3.0 and 3.4.
    assert.equal(roundScore(scoreRangeTarget(74.5, range, "HIGHER_BETTER")), 3.2);
  });

  it("clamps beyond the outermost windows", () => {
    assert.equal(roundScore(scoreRangeTarget(1000, range, "HIGHER_BETTER")), 5);
    assert.equal(roundScore(scoreRangeTarget(-50, range, "HIGHER_BETTER")), 0);
  });

  it("reverses the value axis when lower is better", () => {
    const cost: RangeTargetConfig = {
      POOR: [200, 500],
      IMPROVEMENT_NEEDED: [150, 199],
      MEET: [100, 149],
      GOOD: [80, 99],
      VERY_GOOD: [60, 79],
      EXCELLENT: [0, 59],
    };
    // The cheap end of the Meet window is the good end, so it scores the top.
    assert.equal(roundScore(scoreRangeTarget(100, cost, "LOWER_BETTER")), 3.4);
    assert.equal(roundScore(scoreRangeTarget(149, cost, "LOWER_BETTER")), 3);
    // Inside the Excellent window but not at its best edge, so it interpolates.
    assert.equal(roundScore(scoreRangeTarget(10, cost, "LOWER_BETTER")), 4.9);
    assert.equal(roundScore(scoreRangeTarget(0, cost, "LOWER_BETTER")), 5);
    // Beyond the open end of the outermost window, clamped to the band top.
    assert.equal(roundScore(scoreRangeTarget(-20, cost, "LOWER_BETTER")), 5);
    assert.equal(roundScore(scoreRangeTarget(9999, cost, "LOWER_BETTER")), 0);
  });

  it("an absolute extreme band (equal low/high) scores its band's top, matching FIXED's own-target convention, no matter how far past it the value is", () => {
    // Excellent given as a bare "12" (stored [12, 12]) rather than a window —
    // a self-consistent scale, since splicing [12, 12] into `range` above
    // (built for a 0-100 scale) would put Excellent below Very Good.
    const higherBetter: RangeTargetConfig = {
      POOR: [0, 4],
      IMPROVEMENT_NEEDED: [5, 6],
      MEET: [7, 8],
      GOOD: [9, 10],
      VERY_GOOD: [11, 11],
      EXCELLENT: [12, 12],
    };
    assert.equal(scoreRangeTarget(12, higherBetter, "HIGHER_BETTER"), 5);
    assert.equal(scoreRangeTarget(1000, higherBetter, "HIGHER_BETTER"), 5);

    // Poor given as a bare "50" with lower-is-better — the worst band, so a
    // value far beyond it still scores exactly what reaching 50 would.
    const lowerBetter: RangeTargetConfig = {
      POOR: [50, 50],
      IMPROVEMENT_NEEDED: [40, 49],
      MEET: [30, 39],
      GOOD: [20, 29],
      VERY_GOOD: [10, 19],
      EXCELLENT: [0, 9],
    };
    assert.equal(scoreRangeTarget(50, lowerBetter, "LOWER_BETTER"), BAND_BOUNDS.POOR.hi);
    assert.equal(scoreRangeTarget(1000, lowerBetter, "LOWER_BETTER"), BAND_BOUNDS.POOR.hi);
  });
});

describe("varianceMagnitude", () => {
  it("is symmetric — over and under target by the same amount give the same magnitude", () => {
    assert.equal(varianceMagnitude(112, 100), 12);
    assert.equal(varianceMagnitude(88, 100), 12);
  });

  it("returns null when there's nothing to compare against", () => {
    assert.equal(varianceMagnitude(100, null), null);
    assert.equal(varianceMagnitude(100, 0), null);
  });
});

describe("scoreLeaf — VARIANCE", () => {
  // A variance KPI is always RANGE + LOWER_BETTER — Meet is within ±10-15%.
  const varianceRange: RangeTargetConfig = {
    POOR: [30, 999],
    IMPROVEMENT_NEEDED: [20, 29],
    MEET: [10, 15],
    GOOD: [5, 9],
    VERY_GOOD: [2, 4],
    EXCELLENT: [0, 1],
  };
  const varianceKpi: KpiDefinition = {
    metricType: "VARIANCE",
    direction: "LOWER_BETTER",
    targetMode: "RANGE",
    targetConfig: varianceRange,
    deadlineMonth: null,
    scoreFinalAfterDeadline: false,
  };

  it("scores +12% and -12% variance identically", () => {
    const over = scoreLeaf(
      varianceKpi,
      [{ period: "2026-06", value: 112, plannedValue: 100, basis: "ACTUAL", completionDate: null }],
      "2026-06"
    );
    const under = scoreLeaf(
      varianceKpi,
      [{ period: "2026-06", value: 88, plannedValue: 100, basis: "ACTUAL", completionDate: null }],
      "2026-06"
    );
    assert.equal(over.score, under.score);
    assert.equal(over.band, "MEET");
    assert.equal(under.band, "MEET");
  });

  it("reports no data when the target/planned figure is missing", () => {
    const result = scoreLeaf(
      varianceKpi,
      [{ period: "2026-06", value: 112, plannedValue: null, basis: "ACTUAL", completionDate: null }],
      "2026-06"
    );
    assert.equal(result.score, null);
    assert.equal(result.pendingReason, "NO_DATA");
  });
});

describe("scoreMonthCompletion", () => {
  const target = { targetMonth: "2026-10" };

  it("scales by day within the target month", () => {
    // The worked example from the specification.
    assert.equal(roundScore(scoreMonthCompletion(utc(2026, 10, 1), target)), 3.4);
    assert.equal(roundScore(scoreMonthCompletion(utc(2026, 10, 31), target)), 3);
  });

  it("climbs a band for each month early", () => {
    assert.equal(roundScore(scoreMonthCompletion(utc(2026, 9, 1), target)), 3.9);
    assert.equal(roundScore(scoreMonthCompletion(utc(2026, 8, 1), target)), 4.5);
    assert.equal(roundScore(scoreMonthCompletion(utc(2026, 7, 1), target)), 5);
  });

  it("drops a band for each month late", () => {
    assert.equal(roundScore(scoreMonthCompletion(utc(2026, 11, 1), target)), 2.9);
    assert.equal(roundScore(scoreMonthCompletion(utc(2026, 11, 30), target)), 2.5);
    assert.equal(roundScore(scoreMonthCompletion(utc(2026, 12, 1), target)), 2.4);
  });

  it("two or more months late (Poor) scales continuously to the fiscal year end", () => {
    // Target Oct 2026 sits in FY2026/27, which ends 31 Mar 2027. Two months
    // late starts 1 Dec 2026, and the Poor band now stretches all the way
    // from there (2.4) to 31 Mar 2027 (0) — including into Jan/Feb/Mar,
    // where it used to already read 0 — instead of resetting to 0 at the end
    // of each individual month.
    assert.equal(roundScore(scoreMonthCompletion(utc(2026, 12, 1), target)), 2.4);
    assert.equal(roundScore(scoreMonthCompletion(utc(2026, 12, 31), target)), 1.8);
    assert.equal(roundScore(scoreMonthCompletion(utc(2027, 1, 1), target)), 1.8);
    assert.equal(roundScore(scoreMonthCompletion(utc(2027, 1, 15), target)), 1.5);
    assert.equal(roundScore(scoreMonthCompletion(utc(2027, 2, 1), target)), 1.2);
    assert.equal(roundScore(scoreMonthCompletion(utc(2027, 3, 31), target)), 0);
  });

  it("scores zero on or after the fiscal year end", () => {
    assert.equal(roundScore(scoreMonthCompletion(utc(2027, 4, 1), target)), 0);
    assert.equal(roundScore(scoreMonthCompletion(utc(2028, 1, 1), target)), 0);
  });

  it("gives no extra credit beyond three months early", () => {
    assert.equal(roundScore(scoreMonthCompletion(utc(2025, 1, 1), target)), 5);
  });

  it("handles a target month spanning a year boundary", () => {
    const dec = { targetMonth: "2026-12" };
    assert.equal(roundScore(scoreMonthCompletion(utc(2027, 1, 1), dec)), 2.9);
    assert.equal(roundScore(scoreMonthCompletion(utc(2026, 11, 1), dec)), 3.9);
  });
});

describe("period arithmetic", () => {
  it("shifts across year boundaries", () => {
    assert.equal(shiftPeriod("2026-01", -1), "2025-12");
    assert.equal(shiftPeriod("2026-12", 1), "2027-01");
    assert.equal(shiftPeriod("2026-04", 11), "2027-03");
  });

  it("counts months between periods in both directions", () => {
    assert.equal(monthsBetween("2026-10", "2026-12"), 2);
    assert.equal(monthsBetween("2026-10", "2026-08"), -2);
    assert.equal(monthsBetween("2026-10", "2026-10"), 0);
  });
});

describe("deadline handling", () => {
  it("caps at the top of the band matching how late it is", () => {
    assert.equal(latenessCap(0), null);
    assert.equal(latenessCap(1), 2.9);
    assert.equal(latenessCap(2), 2.4);
    assert.equal(latenessCap(3), 0);
    assert.equal(latenessCap(12), 0);
  });

  it("leaves an on-time score untouched", () => {
    const outcome = applyDeadline({
      rawScore: 5,
      period: "2026-09",
      deadlineMonth: "2026-10",
      scoreFinalAfterDeadline: false,
    });
    assert.equal(outcome.score, 5);
    assert.equal(outcome.cap, null);
    assert.equal(outcome.monthsLate, 0);
  });

  it("awards partial credit for achievement after the deadline", () => {
    const outcome = applyDeadline({
      rawScore: 5,
      period: "2026-11",
      deadlineMonth: "2026-10",
      scoreFinalAfterDeadline: false,
    });
    assert.equal(outcome.score, 2.9);
    assert.equal(outcome.rawScore, 5);
    assert.equal(outcome.monthsLate, 1);
  });

  it("never raises a score that is already below the cap", () => {
    const outcome = applyDeadline({
      rawScore: 1.8,
      period: "2026-11",
      deadlineMonth: "2026-10",
      scoreFinalAfterDeadline: false,
    });
    assert.equal(outcome.score, 1.8);
  });

  it("scores zero once three or more months late", () => {
    const outcome = applyDeadline({
      rawScore: 5,
      period: "2027-01",
      deadlineMonth: "2026-10",
      scoreFinalAfterDeadline: false,
    });
    assert.equal(outcome.score, 0);
  });

  it("freezes the deadline-month score when the KPI is marked final", () => {
    const outcome = applyDeadline({
      rawScore: 5,
      period: "2026-12",
      deadlineMonth: "2026-10",
      scoreFinalAfterDeadline: true,
      scoreAtDeadline: 3.4,
    });
    assert.equal(outcome.score, 3.4);
    assert.equal(outcome.frozen, true);
    assert.equal(outcome.rawScore, 5);
  });
});

describe("selectEntry — actual versus estimate", () => {
  const entries: Entry[] = [
    { period: "2026-04", value: 10, basis: "ACTUAL", completionDate: null },
    { period: "2026-05", value: 25, basis: "ESTIMATE", completionDate: null },
  ];

  it("prefers the period's own actual", () => {
    assert.equal(selectEntry(entries, "2026-04")?.value, 10);
  });

  it("uses the period's estimate when there is no actual", () => {
    const picked = selectEntry(entries, "2026-05");
    assert.equal(picked?.value, 25);
    assert.equal(picked?.basis, "ESTIMATE");
  });

  it("carries the latest estimate forward into an unreported month", () => {
    const picked = selectEntry(entries, "2026-07");
    assert.equal(picked?.value, 25);
    assert.equal(picked?.basis, "ESTIMATE");
  });

  it("does not carry a stale actual forward", () => {
    const actualsOnly: Entry[] = [
      { period: "2026-04", value: 10, basis: "ACTUAL", completionDate: null },
    ];
    assert.equal(selectEntry(actualsOnly, "2026-06"), null);
  });

  it("ignores entries from later periods", () => {
    assert.equal(selectEntry(entries, "2026-03"), null);
  });
});

describe("selectEntry — completed (frozen) KPIs", () => {
  const entries: Entry[] = [
    { period: "2026-04", value: 10, basis: "ACTUAL", completionDate: null },
    { period: "2026-06", value: 40, basis: "ACTUAL", completionDate: null },
    { period: "2026-07", value: 50, basis: "ESTIMATE", completionDate: null },
  ];

  it("carries the last actual on record as of the completion period forward indefinitely", () => {
    const picked = selectEntry(entries, "2026-12", "2026-06");
    assert.equal(picked?.value, 40);
    assert.equal(picked?.basis, "ACTUAL");
  });

  it("carries forward from the completion period itself", () => {
    assert.equal(selectEntry(entries, "2026-06", "2026-06")?.value, 40);
  });

  it("prefers the last actual even when a later estimate exists before the completion period", () => {
    const picked = selectEntry(entries, "2026-08", "2026-07");
    assert.equal(picked?.value, 40);
    assert.equal(picked?.basis, "ACTUAL");
  });

  it("does not affect periods before the completion period", () => {
    const picked = selectEntry(entries, "2026-04", "2026-06");
    assert.equal(picked?.value, 10);
  });

  it("falls through to normal resolution when there is no actual on record yet", () => {
    const estimateOnly: Entry[] = [
      { period: "2026-05", value: 25, basis: "ESTIMATE", completionDate: null },
    ];
    const picked = selectEntry(estimateOnly, "2026-08", "2026-06");
    assert.equal(picked?.value, 25);
    assert.equal(picked?.basis, "ESTIMATE");
  });
});

describe("scoreLeaf", () => {
  const numericKpi: KpiDefinition = {
    metricType: "QUANTITY",
    direction: "HIGHER_BETTER",
    targetMode: "FIXED",
    targetConfig: fixedUp,
    deadlineMonth: null,
    scoreFinalAfterDeadline: false,
  };

  it("reports no data rather than a zero when nothing is recorded", () => {
    const result = scoreLeaf(numericKpi, [], "2026-06");
    assert.equal(result.score, null);
    assert.equal(result.pendingReason, "NO_DATA");
  });

  it("flags a score derived from an estimate as provisional", () => {
    const result = scoreLeaf(
      numericKpi,
      [{ period: "2026-06", value: 101, basis: "ESTIMATE", completionDate: null }],
      "2026-06"
    );
    assert.equal(result.score, 3.9);
    assert.equal(result.provisional, true);
    assert.equal(result.basis, "ESTIMATE");
  });

  it("does not flag a score derived from an actual", () => {
    const result = scoreLeaf(
      numericKpi,
      [{ period: "2026-06", value: 101, basis: "ACTUAL", completionDate: null }],
      "2026-06"
    );
    assert.equal(result.provisional, false);
  });

  it("applies the lateness cap to a deadline-bound KPI", () => {
    const withDeadline: KpiDefinition = { ...numericKpi, deadlineMonth: "2026-10" };
    const entries: Entry[] = [
      { period: "2026-11", value: 103, basis: "ACTUAL", completionDate: null },
    ];
    const result = scoreLeaf(withDeadline, entries, "2026-11");
    assert.equal(result.score, 2.9);
    assert.equal(result.deadline?.rawScore, 5);
    assert.equal(result.deadline?.monthsLate, 1);
  });

  it("freezes a deadline-bound KPI marked final at its deadline-month score", () => {
    const frozenKpi: KpiDefinition = {
      ...numericKpi,
      deadlineMonth: "2026-10",
      scoreFinalAfterDeadline: true,
    };
    const entries: Entry[] = [
      { period: "2026-10", value: 100, basis: "ACTUAL", completionDate: null },
      { period: "2026-11", value: 103, basis: "ACTUAL", completionDate: null },
    ];
    assert.equal(scoreLeaf(frozenKpi, entries, "2026-10").score, 3.4);
    assert.equal(scoreLeaf(frozenKpi, entries, "2026-11").score, 3.4);
  });

  it("scores zero after the deadline when nothing was achieved by it", () => {
    const frozenKpi: KpiDefinition = {
      ...numericKpi,
      deadlineMonth: "2026-10",
      scoreFinalAfterDeadline: true,
    };
    const entries: Entry[] = [
      { period: "2026-11", value: 103, basis: "ACTUAL", completionDate: null },
    ];
    assert.equal(scoreLeaf(frozenKpi, entries, "2026-11").score, 0);
  });

  it("carries a completed KPI's last actual value forward", () => {
    const entries: Entry[] = [
      { period: "2026-06", value: 100, basis: "ACTUAL", completionDate: null },
    ];
    const completedKpi: KpiDefinition = { ...numericKpi, completed: true, completedPeriod: "2026-06" };
    const result = scoreLeaf(completedKpi, entries, "2026-09");
    assert.equal(result.value, 100);
    assert.equal(result.basis, "ACTUAL");
    assert.equal(result.score, 3.4);
  });

  it("does not retroactively change a period before the KPI was marked complete", () => {
    const entries: Entry[] = [
      { period: "2026-05", value: 98, basis: "ACTUAL", completionDate: null },
      { period: "2026-06", value: 100, basis: "ACTUAL", completionDate: null },
    ];
    const completedKpi: KpiDefinition = { ...numericKpi, completed: true, completedPeriod: "2026-06" };
    assert.equal(scoreLeaf(completedKpi, entries, "2026-05").value, 98);
  });

  it("does not let completing a KPI reopen a score already frozen by its deadline", () => {
    const frozenKpi: KpiDefinition = {
      ...numericKpi,
      deadlineMonth: "2026-10",
      scoreFinalAfterDeadline: true,
    };
    const entries: Entry[] = [
      { period: "2026-10", value: 100, basis: "ACTUAL", completionDate: null },
      { period: "2026-11", value: 103, basis: "ACTUAL", completionDate: null },
    ];
    const beforeCompletion = scoreLeaf(frozenKpi, entries, "2026-11").score;
    assert.equal(beforeCompletion, 3.4);

    // Marking it complete afterwards, carrying the higher 103 value forward,
    // must not move the score already frozen at the deadline month.
    const completedKpi: KpiDefinition = { ...frozenKpi, completed: true, completedPeriod: "2026-11" };
    const afterCompletion = scoreLeaf(completedKpi, entries, "2026-12").score;

    assert.equal(afterCompletion, beforeCompletion);
  });
});

describe("scoreLeaf — milestones", () => {
  const milestone: KpiDefinition = {
    metricType: "MONTH_COMPLETION",
    direction: null,
    targetMode: null,
    targetConfig: { targetMonth: "2026-10" },
    deadlineMonth: null,
    scoreFinalAfterDeadline: false,
  };

  it("sits out of the rollup until the target month has passed", () => {
    const result = scoreLeaf(milestone, [], "2026-09");
    assert.equal(result.score, null);
    assert.equal(result.pendingReason, "NOT_YET_DUE");
    assert.equal(scoreLeaf(milestone, [], "2026-10").pendingReason, "NOT_YET_DUE");
  });

  it("decays on its own once overdue, continuing to the fiscal year end rather than flooring at zero each month", () => {
    assert.equal(scoreLeaf(milestone, [], "2026-11").score, 2.5);
    assert.equal(scoreLeaf(milestone, [], "2026-12").score, 1.8);
    assert.equal(scoreLeaf(milestone, [], "2027-01").score, 1.2);
    assert.equal(scoreLeaf(milestone, [], "2027-03").score, 0);
  });

  it("keeps its score in every month after completion is recorded", () => {
    const entries: Entry[] = [
      {
        period: "2026-09",
        value: null,
        basis: "ACTUAL",
        completionDate: utc(2026, 9, 1),
      },
    ];
    assert.equal(scoreLeaf(milestone, entries, "2026-09").score, 3.9);
    assert.equal(scoreLeaf(milestone, entries, "2026-12").score, 3.9);
    // ...and not before it was completed.
    assert.equal(scoreLeaf(milestone, entries, "2026-08").pendingReason, "NOT_YET_DUE");
  });
});

describe("rollup", () => {
  // A leaf either contributes its whole weight or none of it.
  const leaf = (score: number | null, weight: number, provisional = false) => ({
    score,
    weight,
    scoredWeight: score === null ? 0 : weight,
    provisionalWeight: score !== null && provisional ? weight : 0,
    leafCount: 1,
    scoredLeafCount: score === null ? 0 : 1,
  });

  // A rolled-up node, seen as a child of the level above it.
  const asChild = (r: ReturnType<typeof rollup>) => ({
    score: r.score,
    exactScore: r.exactScore,
    weight: r.totalWeight,
    scoredWeight: r.scoredWeight,
    provisionalWeight: r.provisionalWeight,
    leafCount: r.leafCount,
    scoredLeafCount: r.scoredLeafCount,
  });

  it("weights children by their share of scored weight", () => {
    const result = rollup([leaf(5, 30), leaf(2.5, 10)]);
    // (5*30 + 2.5*10) / 40 = 4.375 -> 4.4
    assert.equal(result.score, 4.4);
    assert.equal(result.coverage, 1);
  });

  it("renormalises over scored children and reports coverage", () => {
    const result = rollup([leaf(4, 25), leaf(null, 75)]);
    assert.equal(result.score, 4);
    assert.equal(result.coverage, 0.25);
    assert.equal(result.totalWeight, 100);
    assert.equal(result.scoredWeight, 25);
  });

  it("returns no score when nothing is scored", () => {
    const result = rollup([leaf(null, 100)]);
    assert.equal(result.score, null);
    assert.equal(result.band, null);
    assert.equal(result.coverage, 0);
  });

  it("reports the share of weight resting on estimates", () => {
    const result = rollup([leaf(4, 40, true), leaf(3, 60)]);
    assert.equal(result.provisionalShare, 0.4);
    assert.equal(result.provisionalWeight, 40);
  });

  it("always produces a score that sits inside its band", () => {
    const result = rollup([leaf(2.4, 1), leaf(2.5, 1)]);
    // 2.45 rounds to 2.5, the bottom of Improvement Needed — not into the gap.
    assert.equal(result.score, 2.5);
    assert.equal(result.band, "IMPROVEMENT_NEEDED");
  });

  it("carries missing data up through a parent instead of hiding it", () => {
    // A branch worth 50 with only 40 of it reported.
    const branch = rollup([leaf(4, 15), leaf(null, 10), leaf(3, 25)]);
    assert.equal(branch.coverage, 0.8);
    assert.equal(branch.scoredWeight, 40);

    // Seen from the level above, that branch must still read as 40/50 scored,
    // not as a fully-covered child just because it has a score of its own.
    const total = rollup([asChild(branch), leaf(5, 50)]);
    assert.equal(total.coverage, 0.9);
    assert.equal(total.scoredWeight, 90);
  });

  it("gives a rollup of rollups the same answer as one flat weighted average", () => {
    const leaves: [number, number][] = [[4.5, 15], [2.9, 10], [2.9, 5], [3.7, 10], [1.4, 20]];
    const flat = rollup(leaves.map(([score, weight]) => leaf(score, weight)));

    // Same leaves, but grouped under two parents first.
    const left = rollup(leaves.slice(0, 3).map(([s, w]) => leaf(s, w)));
    const right = rollup(leaves.slice(3).map(([s, w]) => leaf(s, w)));
    const nested = rollup([left, right].map(asChild));

    assert.equal(nested.score, flat.score);
  });

  it("does not let a half-reported branch lend its full weight", () => {
    // Branch A: worth 50, but only 10 of it reported, scoring 5.
    const branchA = rollup([leaf(5, 10), leaf(null, 40)]);
    // Branch B: worth 50, fully reported, scoring 1.
    const branchB = rollup([leaf(1, 50)]);

    const total = rollup([branchA, branchB].map(asChild));

    // Weighted by scored weight: (5*10 + 1*50) / 60 = 1.67, not the 3.0 that
    // treating both branches as equal halves would have produced.
    assert.equal(total.score, 1.7);
    assert.equal(total.coverage, 0.6);
  });

  it("counts scored and total leaves, including unreported ones", () => {
    const result = rollup([leaf(4, 15), leaf(null, 10), leaf(3, 25)]);
    assert.equal(result.leafCount, 3);
    assert.equal(result.scoredLeafCount, 2);
  });

  it("sums leaf counts through a nested rollup", () => {
    const branchA = rollup([leaf(5, 10), leaf(null, 40)]);
    const branchB = rollup([leaf(1, 25), leaf(2, 25)]);
    const total = rollup([branchA, branchB].map(asChild));
    assert.equal(total.leafCount, 4);
    assert.equal(total.scoredLeafCount, 3);
  });
});
