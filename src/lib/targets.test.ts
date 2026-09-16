import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  describeBandTarget,
  describeMeetTarget,
  draftToMetricInput,
  metricColumns,
  metricToDraft,
  crossesNumericMonthBoundary,
  parseNumberInput,
  parseRangeInput,
  validateMetric,
  type MetricDraft,
} from "./targets";

describe("parseNumberInput", () => {
  it("tolerates thousands separators, currency and a percent sign", () => {
    assert.equal(parseNumberInput("1,200"), 1200);
    assert.equal(parseNumberInput("45%"), 45);
    assert.equal(parseNumberInput("$1,200"), 1200);
    assert.equal(parseNumberInput(""), null);
    assert.equal(parseNumberInput("not a number"), null);
  });
});

describe("parseRangeInput", () => {
  it("reads several separator styles", () => {
    assert.deepEqual(parseRangeInput("50-69"), [50, 69]);
    assert.deepEqual(parseRangeInput("50 to 69"), [50, 69]);
    assert.deepEqual(parseRangeInput("50 – 69"), [50, 69]);
  });

  it("accepts a bare number as shorthand for an exact target — a single-point window", () => {
    assert.deepEqual(parseRangeInput("50"), [50, 50]);
    assert.deepEqual(parseRangeInput("$1,200"), [1200, 1200]);
    assert.deepEqual(parseRangeInput("45%"), [45, 45]);
  });

  it("rejects text that is neither a window nor a number", () => {
    assert.equal(parseRangeInput("not a number"), null);
    assert.equal(parseRangeInput(""), null);
  });
});

describe("metric round trip — the regression test for the latent column-write bug", () => {
  it("a RANGE metric survives draft -> input -> columns with all three enum columns intact", () => {
    const draft: MetricDraft = {
      metricType: "PERCENTAGE",
      targetMode: "RANGE",
      direction: "HIGHER_BETTER",
      targets: {
        POOR: "0-49", IMPROVEMENT_NEEDED: "50-69", MEET: "70-79",
        GOOD: "80-89", VERY_GOOD: "90-95", EXCELLENT: "96-100",
      },
      targetMonth: "",
    };

    const parsed = draftToMetricInput(draft, true);
    assert.ok(parsed.ok);
    if (!parsed.ok) return;

    const columns = metricColumns(parsed.metric);
    // The bug this guards against: a RANGE result silently carrying a stale
    // FIXED (or null) targetMode column while the JSON itself is array-shaped.
    assert.equal(columns.metricType, "PERCENTAGE");
    assert.equal(columns.targetMode, "RANGE");
    assert.equal(columns.direction, "HIGHER_BETTER");
    assert.deepEqual(JSON.parse(columns.targetConfig!), {
      POOR: [0, 49], IMPROVEMENT_NEEDED: [50, 69], MEET: [70, 79],
      GOOD: [80, 89], VERY_GOOD: [90, 95], EXCELLENT: [96, 100],
    });

    // And it reads back into an equivalent draft.
    const roundTripped = metricToDraft({
      metricType: columns.metricType,
      targetMode: columns.targetMode,
      direction: columns.direction,
      targetConfig: JSON.parse(columns.targetConfig!),
    });
    assert.deepEqual(roundTripped.targets, draft.targets);
  });

  it("a RANGE metric with an absolute Excellent band stores it as a single-point window and redisplays as a bare number", () => {
    const draft: MetricDraft = {
      metricType: "QUANTITY",
      targetMode: "RANGE",
      direction: "HIGHER_BETTER",
      targets: {
        POOR: "0-4", IMPROVEMENT_NEEDED: "5-6", MEET: "7-8",
        GOOD: "9-10", VERY_GOOD: "11-11", EXCELLENT: "12",
      },
      targetMonth: "",
    };

    const parsed = draftToMetricInput(draft, true);
    assert.ok(parsed.ok);
    if (!parsed.ok) return;

    const columns = metricColumns(parsed.metric);
    assert.deepEqual(JSON.parse(columns.targetConfig!).EXCELLENT, [12, 12]);

    // Redisplays as "12", not "12-12".
    const roundTripped = metricToDraft({
      metricType: columns.metricType,
      targetMode: columns.targetMode,
      direction: columns.direction,
      targetConfig: JSON.parse(columns.targetConfig!),
    });
    assert.equal(roundTripped.targets.EXCELLENT, "12");
  });

  it("a FIXED metric produces FIXED columns, not RANGE", () => {
    const draft: MetricDraft = {
      metricType: "DAYS", targetMode: "FIXED", direction: "LOWER_BETTER",
      targets: { POOR: "12", IMPROVEMENT_NEEDED: "11", MEET: "10", GOOD: "9", VERY_GOOD: "8", EXCELLENT: "7" },
      targetMonth: "",
    };
    const parsed = draftToMetricInput(draft, true);
    assert.ok(parsed.ok);
    if (!parsed.ok) return;
    const columns = metricColumns(parsed.metric);
    assert.equal(columns.targetMode, "FIXED");
    assert.deepEqual(JSON.parse(columns.targetConfig!), {
      POOR: 12, IMPROVEMENT_NEEDED: 11, MEET: 10, GOOD: 9, VERY_GOOD: 8, EXCELLENT: 7,
    });
  });

  it("a month-completion metric carries no direction or target mode", () => {
    const draft: MetricDraft = {
      metricType: "MONTH_COMPLETION", targetMode: "", direction: "",
      targets: { POOR: "", IMPROVEMENT_NEEDED: "", MEET: "", GOOD: "", VERY_GOOD: "", EXCELLENT: "" },
      targetMonth: "2026-10",
    };
    const parsed = draftToMetricInput(draft, true);
    assert.ok(parsed.ok);
    if (!parsed.ok) return;
    const columns = metricColumns(parsed.metric);
    assert.equal(columns.metricType, "MONTH_COMPLETION");
    assert.equal(columns.targetMode, null);
    assert.equal(columns.direction, null);
    assert.deepEqual(JSON.parse(columns.targetConfig!), { targetMonth: "2026-10" });
  });

  it("a parent (non-leaf) always produces NONE, regardless of the draft", () => {
    const draft: MetricDraft = {
      metricType: "PERCENTAGE", targetMode: "FIXED", direction: "HIGHER_BETTER",
      targets: { POOR: "1", IMPROVEMENT_NEEDED: "2", MEET: "3", GOOD: "4", VERY_GOOD: "5", EXCELLENT: "6" },
      targetMonth: "",
    };
    const parsed = draftToMetricInput(draft, false);
    assert.ok(parsed.ok);
    if (!parsed.ok) return;
    assert.equal(parsed.metric.kind, "NONE");
  });
});

describe("validateMetric — ordering", () => {
  it("rejects a band that does not improve on the one before it", () => {
    const bad = draftToMetricInput(
      {
        metricType: "QUANTITY", targetMode: "FIXED", direction: "HIGHER_BETTER",
        targets: { POOR: "5", IMPROVEMENT_NEEDED: "5", MEET: "6", GOOD: "7", VERY_GOOD: "8", EXCELLENT: "9" },
        targetMonth: "",
      },
      true
    );
    assert.ok(bad.ok);
    if (!bad.ok) return;
    assert.throws(() => validateMetric(bad.metric), /not higher/);
  });

  it("accepts a well-ordered LOWER_BETTER range", () => {
    const ok = draftToMetricInput(
      {
        metricType: "DAYS", targetMode: "RANGE", direction: "LOWER_BETTER",
        targets: {
          POOR: "20-100", IMPROVEMENT_NEEDED: "16-19", MEET: "12-15",
          GOOD: "9-11", VERY_GOOD: "6-8", EXCELLENT: "0-5",
        },
        targetMonth: "",
      },
      true
    );
    assert.ok(ok.ok);
    if (!ok.ok) return;
    assert.doesNotThrow(() => validateMetric(ok.metric));
  });
});

describe("describeMeetTarget", () => {
  it("shows a two-sided RANGE meet band as a dash-joined window", () => {
    assert.equal(describeMeetTarget({ MEET: [70, 79] }, "PERCENTAGE"), "70–79");
  });

  it("shows an absolute RANGE meet band as a bare number, not a degenerate window", () => {
    assert.equal(describeMeetTarget({ MEET: [100, 100] }, "QUANTITY"), "100");
  });

  it("shows a FIXED meet band as a bare number", () => {
    assert.equal(describeMeetTarget({ MEET: 3000000 }, "DOLLAR"), "3,000,000");
  });
});

describe("describeBandTarget", () => {
  const range = {
    POOR: [0, 49], IMPROVEMENT_NEEDED: [50, 69], MEET: [70, 79],
    GOOD: [80, 89], VERY_GOOD: [90, 95], EXCELLENT: [96, 100],
  };

  it("describes any band, not just Meet, on a RANGE config", () => {
    assert.equal(describeBandTarget(range, "PERCENTAGE", "POOR"), "0–49");
    assert.equal(describeBandTarget(range, "PERCENTAGE", "EXCELLENT"), "96–100");
  });

  it("describes any band on a FIXED config", () => {
    const fixed = { POOR: 12, IMPROVEMENT_NEEDED: 11, MEET: 10, GOOD: 9, VERY_GOOD: 8, EXCELLENT: 7 };
    assert.equal(describeBandTarget(fixed, "DAYS", "POOR"), "12");
    assert.equal(describeBandTarget(fixed, "DAYS", "EXCELLENT"), "7");
  });

  it("gives a milestone's target month shifted to each band's rung on the completion ladder", () => {
    const month = { targetMonth: "2026-10" };
    assert.equal(describeBandTarget(month, "MONTH_COMPLETION", "EXCELLENT"), "Jul 2026 or earlier");
    assert.equal(describeBandTarget(month, "MONTH_COMPLETION", "VERY_GOOD"), "Aug 2026");
    assert.equal(describeBandTarget(month, "MONTH_COMPLETION", "GOOD"), "Sep 2026");
    assert.equal(describeBandTarget(month, "MONTH_COMPLETION", "MEET"), "Oct 2026");
    assert.equal(describeBandTarget(month, "MONTH_COMPLETION", "IMPROVEMENT_NEEDED"), "Nov 2026");
    assert.equal(describeBandTarget(month, "MONTH_COMPLETION", "POOR"), "Dec 2026 or later");
  });

  it("returns null for a rollup with no config", () => {
    assert.equal(describeBandTarget(null, "PERCENTAGE", "MEET"), null);
  });
});

describe("crossesNumericMonthBoundary", () => {
  it("flags numeric <-> month-completion transitions only", () => {
    assert.equal(crossesNumericMonthBoundary("PERCENTAGE", "MONTH_COMPLETION"), true);
    assert.equal(crossesNumericMonthBoundary("MONTH_COMPLETION", "DOLLAR"), true);
    assert.equal(crossesNumericMonthBoundary("PERCENTAGE", "DOLLAR"), false);
    assert.equal(crossesNumericMonthBoundary("MONTH_COMPLETION", "MONTH_COMPLETION"), false);
    assert.equal(crossesNumericMonthBoundary(null, "PERCENTAGE"), false);
  });
});
