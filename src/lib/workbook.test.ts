import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_CURRENCY } from "./config";
import {
  buildExampleWorkbook,
  buildExportWorkbook,
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

  it("exports an absolute RANGE band as a bare number, and re-imports it to the same single-point window", async () => {
    const kpi: ExportKpi = {
      code: "K1", name: "A KPI", parentCode: null, weight: 100,
      departments: [], metricType: "QUANTITY", unit: "units",
      direction: "HIGHER_BETTER", targetMode: "RANGE",
      targetConfig: {
        POOR: [0, 4], IMPROVEMENT_NEEDED: [5, 6], MEET: [7, 8],
        GOOD: [9, 10], VERY_GOOD: [11, 11], EXCELLENT: [12, 12],
      },
      deadlineMonth: null, scoreFinalAfterDeadline: false, isLeaf: true,
    };

    const bytes = await buildExportWorkbook({
      fiscalYearLabel: "FY2026/27",
      kpis: [kpi],
      departments: [],
      periods: [],
      tree: [],
      totalsByPeriod: new Map(),
      scoresByPeriod: new Map(),
      values: [],
      updates: [],
    });

    const ExcelJS = (await import("exceljs")).default;
    const readBack = new ExcelJS.Workbook();
    await readBack.xlsx.load(bytesToArrayBuffer(bytes));
    const excellentCell = readBack.getWorksheet("KPIs")!.getRow(2).getCell(15).value;
    assert.equal(excellentCell, 12); // a plain number, not the string "12-12"

    const { kpis, issues } = await parseWorkbook(bytesToArrayBuffer(bytes));
    assert.deepEqual(issues, []);
    assert.deepEqual(JSON.parse(kpis[0].targetConfig!).EXCELLENT, [12, 12]);
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

  it("reads Weight (of group) as a fraction of 1, not a percentage", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const { KPI_COLUMNS } = await import("./workbook");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("KPIs");
    sheet.addRow([...KPI_COLUMNS]);
    sheet.addRow([
      "K1", "A KPI", null, 0.4, "", "QUANTITY", "units", "HIGHER_BETTER", "FIXED",
      1, 2, 3, 4, 5, 6, null, "No", null, null, null,
    ]);
    const bytes = (await workbook.xlsx.writeBuffer()) as unknown;
    const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer);

    const { kpis, issues } = await parseWorkbook(bytesToArrayBuffer(buffer));
    assert.deepEqual(issues, []);
    assert.equal(kpis[0].weight, 40);
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
      Code: "K1", Name: "A KPI", "Parent Code": null, "Weight (of group)": 1,
      Departments: "Finance", "Metric Type": "QUANTITY", Unit: "units",
      Direction: "HIGHER_BETTER", "Target Mode": "FIXED",
      Poor: 1, "Improvement Needed": 2, Meet: 3, Good: 4, "Very Good": 5, Excellent: 6,
      "Deadline Month": null, "Score Final After Deadline": "No",
    };
    const merged: Record<string, string | number | null> = { ...base, ...overrides };
    return [
      merged.Code, merged.Name, merged["Parent Code"], merged["Weight (of group)"],
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

  it("accepts a bare number in a RANGE band as an exact target", async () => {
    const result = await parseWorkbook(
      await buildSheet([row({ "Target Mode": "RANGE", Excellent: 100 })])
    );
    assert.deepEqual(result.issues, []);
    assert.deepEqual(JSON.parse(result.kpis[0].targetConfig!).EXCELLENT, [100, 100]);
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

  it("accepts a real Excel date in a month-of-completion Meet cell, ignoring the day", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const { KPI_COLUMNS } = await import("./workbook");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("KPIs");
    sheet.addRow([...KPI_COLUMNS]);
    const dataRow = sheet.addRow([
      "K1", "A milestone", null, 0.5, "", "MONTH_COMPLETION", "", "", "",
      null, null, null, null, null, null, null, "No", null, null, null,
    ]);
    // Meet is the 12th column (Code, Name, Parent Code, Weight, Departments,
    // Metric Type, Unit, Direction, Target Mode, Poor, Improvement Needed, Meet).
    dataRow.getCell(12).value = new Date(Date.UTC(2026, 9, 15));

    const bytes = (await workbook.xlsx.writeBuffer()) as unknown;
    const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer);

    const result = await parseWorkbook(bytesToArrayBuffer(buffer));
    assert.deepEqual(result.issues, []);
    assert.deepEqual(JSON.parse(result.kpis[0].targetConfig!), { targetMonth: "2026-10" });
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

describe("column dropdowns", () => {
  /**
   * Validation is stored against a range, not a cell, so read it back out of
   * the file the way Excel does rather than through the cell API.
   */
  const validationsOf = async (bytes: Uint8Array) => {
    // JSZip rather than a new devDependency: ExcelJS writes the workbook with
    // it, so it is always present alongside it.
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(bytes);
    const sheets = Object.keys(zip.files).filter((n) => n.startsWith("xl/worksheets/sheet"));

    let xml = "";
    for (const name of sheets) {
      const text = await zip.files[name].async("string");
      if (text.includes("dataValidation")) xml = text;
    }

    return [...xml.matchAll(/<dataValidation\s([^>]*)>\s*<formula1>(.*?)<\/formula1>/g)].map((m) => {
      const attrs = Object.fromEntries(
        [...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]])
      );
      return {
        sqref: attrs.sqref,
        title: attrs.errorTitle ?? attrs.promptTitle ?? "",
        strict: attrs.showErrorMessage === "1",
        options: m[2].replace(/&quot;/g, "").split(","),
      };
    });
  };

  const forColumn = async (bytes: Uint8Array, header: string) => {
    const { KPI_COLUMNS } = await import("./workbook");
    const index = KPI_COLUMNS.indexOf(header as (typeof KPI_COLUMNS)[number]);
    const letter = String.fromCharCode(65 + index);
    return (await validationsOf(bytes)).find((v) => v.sqref.startsWith(`${letter}2:`));
  };

  it("offers every valid value on the closed columns, and refuses anything else", async () => {
    const bytes = await buildTemplateWorkbook([]);

    for (const [header, expected] of [
      ["Metric Type", ["PERCENTAGE", "DOLLAR", "QUANTITY", "DAYS", "MONTH_COMPLETION", "VARIANCE"]],
      ["Direction", ["HIGHER_BETTER", "LOWER_BETTER"]],
      ["Target Mode", ["FIXED", "RANGE"]],
      ["Score Final After Deadline", ["Yes", "No"]],
    ] as const) {
      const validation = await forColumn(bytes, header);
      assert.deepEqual(validation?.options, [...expected], header);
      assert.equal(validation?.strict, true, `${header} should refuse a typo`);
    }
  });

  it("suggests units without enforcing them, since any label is valid", async () => {
    const unit = await forColumn(await buildTemplateWorkbook([]), "Unit");

    assert.ok(unit?.options.includes(DEFAULT_CURRENCY));
    assert.equal(unit?.strict, false);
  });

  it("covers enough rows for a full scorecard", async () => {
    const validation = await forColumn(await buildTemplateWorkbook([]), "Metric Type");
    const lastRow = Number(validation!.sqref.split(":")[1].replace(/\D/g, ""));

    assert.ok(lastRow >= 200, `dropdowns stop at row ${lastRow}`);
  });

  it("writes non-overlapping ranges, which Excel reports as corruption", async () => {
    const ranges = (await validationsOf(await buildTemplateWorkbook([]))).map((v) => v.sqref);

    assert.equal(new Set(ranges).size, ranges.length);
    // One range per validated column, not one per cell: Metric Type, Unit,
    // Direction, Target Mode, Score Final After Deadline, Frequency, Phasing.
    assert.equal(ranges.length, 7);
  });

  it("leaves the sheet empty, so exported rows start at row 2", async () => {
    const result = await parseWorkbook(bytesToArrayBuffer(await buildExampleWorkbook()));

    assert.deepEqual(result.issues, []);
    assert.equal(result.kpis.length, 7);
    assert.equal(result.kpis[0].code, "SG1");
  });
});

describe("Values sheet", () => {
  const VALUE_COLUMNS = ["Code", "Period", "Value", "Basis", "Completion Date", "Note"];

  const buildWithValues = async (valueRows: (string | number | null)[][]) => {
    const ExcelJS = (await import("exceljs")).default;
    const { KPI_COLUMNS, VALUES_SHEET } = await import("./workbook");
    const workbook = new ExcelJS.Workbook();

    const kpis = workbook.addWorksheet("KPIs");
    kpis.addRow([...KPI_COLUMNS]);
    kpis.addRow([
      "K1", "A KPI", null, 100, "Finance", "QUANTITY", "units",
      "HIGHER_BETTER", "FIXED", 1, 2, 3, 4, 5, 6, null, "No",
    ]);

    const values = workbook.addWorksheet(VALUES_SHEET);
    values.addRow(VALUE_COLUMNS);
    valueRows.forEach((r) => values.addRow(r));

    const written = (await workbook.xlsx.writeBuffer()) as unknown;
    const bytes =
      written instanceof Uint8Array
        ? new Uint8Array(written)
        : new Uint8Array(written as ArrayBuffer);
    return bytesToArrayBuffer(bytes);
  };

  it("reads a figure, defaulting an unmarked basis to actual", async () => {
    const result = await parseWorkbook(await buildWithValues([["K1", "2026-08", 4, null, null, "on track"]]));

    assert.deepEqual(result.issues, []);
    assert.equal(result.values.length, 1);
    assert.deepEqual(
      { ...result.values[0], row: undefined },
      {
        code: "K1", period: "2026-08", value: 4, plannedValue: null, basis: "ACTUAL",
        completionDate: null, note: "on track", row: undefined,
      }
    );
  });

  it("recognises an estimate", async () => {
    const result = await parseWorkbook(await buildWithValues([["K1", "2026-08", 4, "Estimate", null, null]]));
    assert.equal(result.values[0].basis, "ESTIMATE");
  });

  it("reads a completion date as dd/mm/yyyy, not month-first", async () => {
    const result = await parseWorkbook(await buildWithValues([["K1", "2026-08", null, null, "03/09/2026", null]]));
    assert.deepEqual(result.issues, []);
    assert.equal(result.values[0].completionDate, "2026-09-03");
  });

  it("rejects a date that does not exist", async () => {
    const result = await parseWorkbook(await buildWithValues([["K1", "2026-08", null, null, "31/02/2026", null]]));
    assert.ok(result.issues.some((i) => i.message.includes("is not a date")));
    assert.equal(result.values.length, 0);
  });

  it("reports a code that matches no KPI", async () => {
    const result = await parseWorkbook(await buildWithValues([["NOPE", "2026-08", 4, null, null, null]]));
    assert.ok(result.issues.some((i) => i.message.includes("does not match any KPI")));
  });

  it("reports a malformed period rather than guessing at it", async () => {
    const result = await parseWorkbook(await buildWithValues([["K1", "whenever", 4, null, null, null]]));
    assert.ok(result.issues.some((i) => i.message.includes("is not a month")));
  });

  it("reports the same KPI twice in one month", async () => {
    const result = await parseWorkbook(
      await buildWithValues([
        ["K1", "2026-08", 4, null, null, null],
        ["K1", "2026-08", 5, null, null, null],
      ])
    );
    assert.ok(result.issues.some((i) => i.message.includes("already has a figure")));
    assert.equal(result.values.length, 1);
  });

  it("reports a value that is not a number", async () => {
    const result = await parseWorkbook(await buildWithValues([["K1", "2026-08", "lots", null, null, null]]));
    assert.ok(result.issues.some((i) => i.message.includes("is not a number")));
  });

  it("ignores blank spacer rows", async () => {
    const result = await parseWorkbook(await buildWithValues([[], ["K1", "2026-08", 4, null, null, null]]));
    assert.deepEqual(result.issues, []);
    assert.equal(result.values.length, 1);
  });

  it("returns no values when the workbook has no Values sheet", async () => {
    const result = await parseWorkbook(bytesToArrayBuffer(await buildExampleWorkbook()));
    assert.deepEqual(result.values, []);
  });
});

describe("Status column", () => {
  it("round-trips a KPI's status through export and re-import", async () => {
    const kpi: ExportKpi = {
      code: "K1", name: "A KPI", parentCode: null, weight: 100,
      departments: [], metricType: "QUANTITY", unit: "units",
      direction: "HIGHER_BETTER", targetMode: "FIXED",
      targetConfig: { POOR: 1, IMPROVEMENT_NEEDED: 2, MEET: 3, GOOD: 4, VERY_GOOD: 5, EXCELLENT: 6 },
      deadlineMonth: null, scoreFinalAfterDeadline: false, isLeaf: true,
      status: "On track",
    };

    const bytes = await buildExportWorkbook({
      fiscalYearLabel: "FY2026/27",
      kpis: [kpi],
      departments: [],
      periods: [],
      tree: [],
      totalsByPeriod: new Map(),
      scoresByPeriod: new Map(),
      values: [],
      updates: [],
    });

    const result = await parseWorkbook(bytesToArrayBuffer(bytes));
    assert.deepEqual(result.issues, []);
    assert.equal(result.kpis[0].status, "On track");
  });

  it("reads a blank Status cell as null, not an empty string", async () => {
    const kpi: ExportKpi = {
      code: "K1", name: "A KPI", parentCode: null, weight: 100,
      departments: [], metricType: "QUANTITY", unit: "units",
      direction: "HIGHER_BETTER", targetMode: "FIXED",
      targetConfig: { POOR: 1, IMPROVEMENT_NEEDED: 2, MEET: 3, GOOD: 4, VERY_GOOD: 5, EXCELLENT: 6 },
      deadlineMonth: null, scoreFinalAfterDeadline: false, isLeaf: true,
    };

    const bytes = await buildExportWorkbook({
      fiscalYearLabel: "FY2026/27",
      kpis: [kpi],
      departments: [],
      periods: [],
      tree: [],
      totalsByPeriod: new Map(),
      scoresByPeriod: new Map(),
      values: [],
      updates: [],
    });

    const result = await parseWorkbook(bytesToArrayBuffer(bytes));
    assert.equal(result.kpis[0].status, null);
  });
});

describe("Updates sheet", () => {
  const UPDATE_COLUMNS = [
    "Id", "Code", "Period", "Mode", "Author", "Body",
    "Current Progress", "Next Progress", "Time Cost", "Issues",
  ];

  const buildWithUpdates = async (updateRows: (string | null)[][]) => {
    const ExcelJS = (await import("exceljs")).default;
    const { KPI_COLUMNS, UPDATES_SHEET } = await import("./workbook");
    const workbook = new ExcelJS.Workbook();

    const kpis = workbook.addWorksheet("KPIs");
    kpis.addRow([...KPI_COLUMNS]);
    kpis.addRow([
      "K1", "A KPI", null, 100, "Finance", "QUANTITY", "units",
      "HIGHER_BETTER", "FIXED", 1, 2, 3, 4, 5, 6, null, "No",
    ]);

    const updates = workbook.addWorksheet(UPDATES_SHEET);
    updates.addRow(UPDATE_COLUMNS);
    updateRows.forEach((r) => updates.addRow(r));

    const written = (await workbook.xlsx.writeBuffer()) as unknown;
    const bytes =
      written instanceof Uint8Array
        ? new Uint8Array(written)
        : new Uint8Array(written as ArrayBuffer);
    return bytesToArrayBuffer(bytes);
  };

  it("reads a Simple-mode update", async () => {
    const result = await parseWorkbook(
      await buildWithUpdates([["upd-1", "K1", "2026-08", "Simple", "alice", "Making progress", null, null, null, null]])
    );

    assert.deepEqual(result.issues, []);
    assert.equal(result.updates.length, 1);
    assert.deepEqual(
      { ...result.updates[0], row: undefined },
      {
        id: "upd-1", code: "K1", period: "2026-08", mode: "SIMPLE",
        body: "Making progress", author: "alice",
        currentProgress: null, nextProgress: null, timeCost: null, issues: null,
        row: undefined,
      }
    );
  });

  it("reads a Detailed-mode update", async () => {
    const result = await parseWorkbook(
      await buildWithUpdates([
        ["upd-2", "K1", "2026-08", "Detailed", "bob", null, "Halfway done", "Finish rollout", "2 days", "None"],
      ])
    );

    assert.equal(result.updates[0].mode, "DETAILED");
    assert.equal(result.updates[0].currentProgress, "Halfway done");
    assert.equal(result.updates[0].nextProgress, "Finish rollout");
    assert.equal(result.updates[0].timeCost, "2 days");
    assert.equal(result.updates[0].issues, "None");
  });

  it("treats a blank Id as unset, so it can be created fresh on import", async () => {
    const result = await parseWorkbook(
      await buildWithUpdates([[null, "K1", "2026-08", "Simple", "alice", "Note", null, null, null, null]])
    );
    assert.equal(result.updates[0].id, null);
  });

  it("allows the same KPI and period to appear on more than one update row", async () => {
    const result = await parseWorkbook(
      await buildWithUpdates([
        ["upd-1", "K1", "2026-08", "Simple", "alice", "First post", null, null, null, null],
        ["upd-2", "K1", "2026-08", "Simple", "alice", "Second post", null, null, null, null],
      ])
    );
    assert.deepEqual(result.issues, []);
    assert.equal(result.updates.length, 2);
  });

  it("reports a code that matches no KPI", async () => {
    const result = await parseWorkbook(
      await buildWithUpdates([["upd-1", "NOPE", "2026-08", "Simple", "alice", "Note", null, null, null, null]])
    );
    assert.ok(result.issues.some((i) => i.message.includes("does not match any KPI")));
  });

  it("reports a malformed period rather than guessing at it", async () => {
    const result = await parseWorkbook(
      await buildWithUpdates([["upd-1", "K1", "whenever", "Simple", "alice", "Note", null, null, null, null]])
    );
    assert.ok(result.issues.some((i) => i.message.includes("is not a month")));
  });

  it("ignores blank spacer rows", async () => {
    const result = await parseWorkbook(
      await buildWithUpdates([[], ["upd-1", "K1", "2026-08", "Simple", "alice", "Note", null, null, null, null]])
    );
    assert.deepEqual(result.issues, []);
    assert.equal(result.updates.length, 1);
  });

  it("returns no updates when the workbook has no Updates sheet", async () => {
    const result = await parseWorkbook(bytesToArrayBuffer(await buildExampleWorkbook()));
    assert.deepEqual(result.updates, []);
  });

  it("round-trips values and updates written by buildExportWorkbook", async () => {
    const kpi: ExportKpi = {
      code: "K1", name: "A KPI", parentCode: null, weight: 100,
      departments: [], metricType: "QUANTITY", unit: "units",
      direction: "HIGHER_BETTER", targetMode: "FIXED",
      targetConfig: { POOR: 1, IMPROVEMENT_NEEDED: 2, MEET: 3, GOOD: 4, VERY_GOOD: 5, EXCELLENT: 6 },
      deadlineMonth: null, scoreFinalAfterDeadline: false, isLeaf: true,
    };

    const bytes = await buildExportWorkbook({
      fiscalYearLabel: "FY2026/27",
      kpis: [kpi],
      departments: [],
      periods: [],
      tree: [],
      totalsByPeriod: new Map(),
      scoresByPeriod: new Map(),
      values: [
        {
          code: "K1", period: "2026-08", value: 4, plannedValue: null,
          basis: "ACTUAL", completionDate: null, note: "on track",
        },
      ],
      updates: [
        {
          id: "upd-1", code: "K1", period: "2026-08", mode: "DETAILED",
          body: null, author: "alice", currentProgress: "Halfway done",
          nextProgress: "Finish rollout", timeCost: "2 days", issues: null,
          createdAt: new Date("2026-08-15T00:00:00Z"),
        },
      ],
    });

    const result = await parseWorkbook(bytesToArrayBuffer(bytes));
    assert.deepEqual(result.issues, []);
    assert.equal(result.values.length, 1);
    assert.equal(result.values[0].value, 4);
    assert.equal(result.updates.length, 1);
    assert.equal(result.updates[0].id, "upd-1");
    assert.equal(result.updates[0].mode, "DETAILED");
    assert.equal(result.updates[0].currentProgress, "Halfway done");
  });
});

// Keeps the ExportKpi shape honest against what the writer actually needs.
const _shapeCheck: ExportKpi = {
  code: "X", name: "X", parentCode: null, weight: 0, departments: [],
  metricType: null, unit: null, direction: null, targetMode: null,
  targetConfig: null, deadlineMonth: null, scoreFinalAfterDeadline: false, isLeaf: true,
};
void _shapeCheck;
