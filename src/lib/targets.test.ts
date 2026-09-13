import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
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

  it("rejects a bare number — it is not a window", () => {
    assert.equal(parseRangeInput("50"), null);
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

describe("crossesNumericMonthBoundary", () => {
  it("flags numeric <-> month-completion transitions only", () => {
    assert.equal(crossesNumericMonthBoundary("PERCENTAGE", "MONTH_COMPLETION"), true);
    assert.equal(crossesNumericMonthBoundary("MONTH_COMPLETION", "DOLLAR"), true);
    assert.equal(crossesNumericMonthBoundary("PERCENTAGE", "DOLLAR"), false);
    assert.equal(crossesNumericMonthBoundary("MONTH_COMPLETION", "MONTH_COMPLETION"), false);
    assert.equal(crossesNumericMonthBoundary(null, "PERCENTAGE"), false);
  });
});
