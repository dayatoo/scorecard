import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_CURRENCY } from "./config";
import {
  buildExampleWorkbook,
  buildTemplateWorkbook,
  parseWorkbook,
  type ExportKpi,
} from "./workbook";

const bytesToArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

describe("template workbook", () => {
  it("parses back with headers intact and no KPI rows", async () => {
    const bytes = await buildTemplateWorkbook(["Finance", "Operations"]);
    const result = await parseWorkbook(bytesToArrayBuffer(bytes));

    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.kpis, []);
    assert.deepEqual(result.departments, ["Finance", "Operations"]);
  });
});

describe("example workbook round-trip", () => {
  it("re-imports every KPI without issues", async () => {
    const bytes = await buildExampleWorkbook();
    const result = await parseWorkbook(bytesToArrayBuffer(bytes));

    assert.deepEqual(result.issues, []);
    assert.equal(result.kpis.length, 7);
    assert.deepEqual(result.departments, ["Finance", "IT", "Operations"]);
  });

  it("preserves the hierarchy", async () => {
    const { kpis } = await parseWorkbook(
      bytesToArrayBuffer(await buildExampleWorkbook())
    );
    const byCode = new Map(kpis.map((k) => [k.code, k]));

    assert.equal(byCode.get("SG1")?.parentCode, null);
    assert.equal(byCode.get("SG1.1")?.parentCode, "SG1");
    assert.equal(byCode.get("SG2.3")?.parentCode, "SG2");
  });

  it("preserves fixed targets, including a lower-is-better KPI", async () => {
    const { kpis } = await parseWorkbook(
      bytesToArrayBuffer(await buildExampleWorkbook())
    );
    const days = kpis.find((k) => k.code === "SG2.1");

    assert.equal(days?.metricType, "DAYS");
    assert.equal(days?.direction, "LOWER_BETTER");
    assert.equal(days?.targetMode, "FIXED");
    assert.deepEqual(JSON.parse(days!.targetConfig!), {
      POOR: 12,
      IMPROVEMENT_NEEDED: 11,
      MEET: 10,
      GOOD: 9,
      VERY_GOOD: 8,
      EXCELLENT: 7,
    });
  });

  it("preserves range targets", async () => {
    const { kpis } = await parseWorkbook(
      bytesToArrayBuffer(await buildExampleWorkbook())
    );
    const csat = kpis.find((k) => k.code === "SG1.2");

    assert.equal(csat?.targetMode, "RANGE");
    assert.deepEqual(JSON.parse(csat!.targetConfig!), {
      POOR: [0, 49],
      IMPROVEMENT_NEEDED: [50, 69],
      MEET: [70, 79],
      GOOD: [80, 89],
      VERY_GOOD: [90, 95],
      EXCELLENT: [96, 100],
    });
  });

  it("preserves a month-of-completion target and a deadline", async () => {
    const { kpis } = await parseWorkbook(
      bytesToArrayBuffer(await buildExampleWorkbook())
    );

    const milestone = kpis.find((k) => k.code === "SG2.2");
    assert.equal(milestone?.metricType, "MONTH_COMPLETION");
    assert.deepEqual(JSON.parse(milestone!.targetConfig!), { targetMonth: "2026-10" });

    const deadlined = kpis.find((k) => k.code === "SG2.3");
    assert.equal(deadlined?.deadlineMonth, "2026-12");
    assert.equal(deadlined?.scoreFinalAfterDeadline, false);
  });

  it("carries the configured currency as the unit on money KPIs", async () => {
    const { kpis } = await parseWorkbook(
      bytesToArrayBuffer(await buildExampleWorkbook())
    );
    const revenue = kpis.find((k) => k.code === "SG1.1");
    assert.equal(revenue?.metricType, "DOLLAR");
    assert.equal(revenue?.unit, DEFAULT_CURRENCY);
  });

  it("preserves weights and multiple departments", async () => {
    const { kpis } = await parseWorkbook(
      bytesToArrayBuffer(await buildExampleWorkbook())
    );

    assert.equal(kpis.find((k) => k.code === "SG1.1")?.weight, 40);
    assert.deepEqual(kpis.find((k) => k.code === "SG2.2")?.departments, [
      "Operations",
      "IT",
    ]);
    // Parent rows carry no weight of their own.
    assert.equal(kpis.find((k) => k.code === "SG1")?.weight, 0);
  });

  it("adds up leaf weights to 100", async () => {
    const { kpis } = await parseWorkbook(
      bytesToArrayBuffer(await buildExampleWorkbook())
    );
    const parents = new Set(kpis.map((k) => k.parentCode).filter(Boolean));
    const leafTotal = kpis
      .filter((k) => !parents.has(k.code))
      .reduce((sum, k) => sum + k.weight, 0);

    assert.equal(leafTotal, 100);
  });
});

describe("parse errors", () => {
  const buildSheet = async (rows: (string | number | null)[][]) => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("KPIs");
    const { KPI_COLUMNS } = await import("./workbook");
    sheet.addRow([...KPI_COLUMNS]);
    rows.forEach((row) => sheet.addRow(row));
    const written = (await workbook.xlsx.writeBuffer()) as unknown;
    const bytes =
      written instanceof Uint8Array
        ? new Uint8Array(written)
        : new Uint8Array(written as ArrayBuffer);
    return bytesToArrayBuffer(bytes);
  };

  const row = (overrides: Record<string, string | number | null> = {}) => {
    const base: Record<string, string | number | null> = {
      Code: "K1", Name: "A KPI", "Parent Code": null, "Weight %": 100,
      Departments: "Finance", "Metric Type": "QUANTITY", Unit: "units",
      Direction: "HIGHER_BETTER", "Target Mode": "FIXED",
      Poor: 1, "Improvement Needed": 2, Meet: 3, Good: 4, "Very Good": 5, Excellent: 6,
      "Deadline Month": null, "Score Final After Deadline": "No",
    };
    const merged: Record<string, string | number | null> = { ...base, ...overrides };
    return [
      merged.Code, merged.Name, merged["Parent Code"], merged["Weight %"],
      merged.Departments, merged["Metric Type"], merged.Unit, merged.Direction,
      merged["Target Mode"], merged.Poor, merged["Improvement Needed"], merged.Meet,
      merged.Good, merged["Very Good"], merged.Excellent,
      merged["Deadline Month"], merged["Score Final After Deadline"],
    ] as (string | number | null)[];
  };

  it("reports an unresolvable parent code", async () => {
    const result = await parseWorkbook(await buildSheet([row({ "Parent Code": "NOPE" })]));
    assert.ok(result.issues.some((i) => i.message.includes('"NOPE" does not match')));
  });

  it("reports a duplicate code", async () => {
    const result = await parseWorkbook(await buildSheet([row(), row({ Name: "Another" })]));
    assert.ok(result.issues.some((i) => i.message.includes("already used on row 2")));
  });

  it("reports a missing target", async () => {
    const result = await parseWorkbook(await buildSheet([row({ Meet: null })]));
    assert.ok(result.issues.some((i) => i.message.includes("Meet target is missing")));
  });

  it("reports an unrecognised metric type", async () => {
    const result = await parseWorkbook(await buildSheet([row({ "Metric Type": "WIDGETS" })]));
    assert.ok(result.issues.some((i) => i.message.includes("is not a metric type")));
  });

  it("reports a malformed deadline rather than guessing at it", async () => {
    for (const bad of ["next year", "garbage", "2026-13", "Octobre 2026", "2026"]) {
      const result = await parseWorkbook(await buildSheet([row({ "Deadline Month": bad })]));
      assert.ok(
        result.issues.some((i) => i.message.includes("is not a month")),
        `"${bad}" should have been rejected as a month`
      );
    }
  });

  it("accepts the month spellings people actually type", async () => {
    for (const [text, expected] of [
      ["2026-10", "2026-10"],
      ["2026-1", "2026-01"],
      ["Oct 2026", "2026-10"],
      ["October 2026", "2026-10"],
      ["2026 Oct", "2026-10"],
    ] as const) {
      const result = await parseWorkbook(await buildSheet([row({ "Deadline Month": text })]));
      assert.deepEqual(result.issues, [], `"${text}" should have parsed`);
      assert.equal(result.kpis[0].deadlineMonth, expected);
    }
  });

  it("rejects a file that is not a workbook", async () => {
    const result = await parseWorkbook(new TextEncoder().encode("hello").buffer as ArrayBuffer);
    assert.equal(result.kpis.length, 0);
    assert.ok(result.issues[0].message.includes("could not be read"));
  });

  it("tolerates formatted numbers and loose yes/no values", async () => {
    const result = await parseWorkbook(
      await buildSheet([
        row({ Poor: "8,000", "Improvement Needed": "$9,000", Meet: "10,000",
              Good: "11,000", "Very Good": "12,000", Excellent: "13,000",
              "Deadline Month": "Oct 2026", "Score Final After Deadline": "YES" }),
      ])
    );

    assert.deepEqual(result.issues, []);
    assert.equal(result.kpis[0].deadlineMonth, "2026-10");
    assert.equal(result.kpis[0].scoreFinalAfterDeadline, true);
    assert.deepEqual(JSON.parse(result.kpis[0].targetConfig!), {
      POOR: 8000, IMPROVEMENT_NEEDED: 9000, MEET: 10000,
      GOOD: 11000, VERY_GOOD: 12000, EXCELLENT: 13000,
    });
  });

  it("ignores blank spacer rows", async () => {
    const result = await parseWorkbook(await buildSheet([[], row()]));
    assert.equal(result.kpis.length, 1);
    assert.deepEqual(result.issues, []);
  });
});

// Keeps the ExportKpi shape honest against what the writer actually needs.
const _shapeCheck: ExportKpi = {
  code: "X", name: "X", parentCode: null, weight: 0, departments: [],
  metricType: null, unit: null, direction: null, targetMode: null,
  targetConfig: null, deadlineMonth: null, scoreFinalAfterDeadline: false, isLeaf: true,
};
void _shapeCheck;
