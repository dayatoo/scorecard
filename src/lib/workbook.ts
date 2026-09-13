// Excel import and export.
//
// One workbook shape serves both directions: what you export you can edit and
// import straight back. The KPIs sheet is the hierarchy (a row per KPI, joined
// to its parent by code); Departments is the owner dropdown list; Readme spells
// out the rules so the file explains itself away from the app.

import ExcelJS from "exceljs";

import { BAND_STYLES } from "./band-style";
import { DEFAULT_CURRENCY } from "./config";
import type { KpiRecord, ScoredNode } from "./kpi-tree";
import { flattenTree } from "./kpi-tree";
import { formatPeriodLabel } from "./fiscal";
import { parseNumberInput, parseRangeInput } from "./targets";
import {
  BANDS,
  BAND_BOUNDS,
  bandLabel,
  type Band,
  type Direction,
  type Frequency,
  type MetricType,
  type Phasing,
  type TargetMode,
} from "./scoring";

export const KPI_SHEET = "KPIs";
export const DEPARTMENT_SHEET = "Departments";
export const README_SHEET = "Readme";
export const SCORES_SHEET = "Scores";
export const VALUES_SHEET = "Values";

const BAND_COLUMNS: Record<Band, string> = {
  POOR: "Poor",
  IMPROVEMENT_NEEDED: "Improvement Needed",
  MEET: "Meet",
  GOOD: "Good",
  VERY_GOOD: "Very Good",
  EXCELLENT: "Excellent",
};

// "Weight %" was renamed to "Weight % (of group)" when weights changed from a
// company-wide share to a share of a KPI's own siblings. The rename matters
// more than it looks: the parser checks headers and refuses a missing one, so
// an old global-weight workbook is rejected outright rather than silently
// misread — a leaf whose global weight of 0.3 sat among siblings totalling 5
// would otherwise be read as a *local* 0.3 and normalised to 6% of its group,
// a twentyfold distortion with no warning at all.
export const KPI_COLUMNS = [
  "Code",
  "Name",
  "Parent Code",
  "Weight % (of group)",
  "Departments",
  "Metric Type",
  "Unit",
  "Direction",
  "Target Mode",
  ...BANDS.map((b) => BAND_COLUMNS[b]),
  "Deadline Month",
  "Score Final After Deadline",
  "Frequency",
  "Phasing",
  "Phase Shares",
] as const;

/** Export-only, informational: mirrors the detail page's derived Global % field. Ignored on import. */
const GLOBAL_WEIGHT_COLUMN = "Global %";

const METRIC_TYPES: MetricType[] = [
  "PERCENTAGE",
  "DOLLAR",
  "QUANTITY",
  "DAYS",
  "MONTH_COMPLETION",
];

const DIRECTIONS: Direction[] = ["HIGHER_BETTER", "LOWER_BETTER"];
const TARGET_MODES: TargetMode[] = ["FIXED", "RANGE"];
const FREQUENCIES: Frequency[] = ["MONTHLY", "QUARTERLY", "ANNUAL"];
const PHASINGS: Phasing[] = ["NONE", "EVEN", "CUSTOM"];

/**
 * Units seen on most scorecards. Unlike the columns above this is only a
 * shortlist — the unit is a free label on the KPI, so a KPI counted in
 * anything else (tonnes, complaints, MWh) still types straight in.
 */
const UNIT_SUGGESTIONS = ["%", DEFAULT_CURRENCY, "days", "score", "units", "months"];

/**
 * The columns whose value has to come from a list, so people pick rather than
 * remember the spelling. `strict` columns reject anything else; Unit only
 * offers its list, since any label is valid there.
 */
const LIST_COLUMNS: { column: string; values: string[]; strict: boolean }[] = [
  { column: "Metric Type", values: METRIC_TYPES, strict: true },
  { column: "Unit", values: UNIT_SUGGESTIONS, strict: false },
  { column: "Direction", values: DIRECTIONS, strict: true },
  { column: "Target Mode", values: TARGET_MODES, strict: true },
  { column: "Score Final After Deadline", values: ["Yes", "No"], strict: true },
  { column: "Frequency", values: FREQUENCIES, strict: true },
  { column: "Phasing", values: PHASINGS, strict: true },
];

/**
 * How far down the sheet the dropdowns reach. Excel validates a fixed block of
 * cells rather than a whole column, so this has to be well past the ~100 rows a
 * scorecard runs to, without being so far that the file bloats.
 */
const VALIDATED_ROWS = 500;

// --------------------------------------------------------------------------
// Parsing
// --------------------------------------------------------------------------

export type ParsedKpi = {
  code: string;
  name: string;
  parentCode: string | null;
  /** Local weight — this row's share of its own siblings. */
  weight: number;
  departments: string[];
  metricType: MetricType | null;
  unit: string | null;
  direction: Direction | null;
  targetMode: TargetMode | null;
  targetConfig: string | null;
  deadlineMonth: string | null;
  scoreFinalAfterDeadline: boolean;
  frequency: Frequency;
  phasing: Phasing;
  phaseConfig: string | null;
  /** Spreadsheet row number, so errors can point at it. */
  row: number;
};

export type ParseIssue = { row: number | null; message: string };

/** One month's recorded figure for a KPI, read from the optional Values sheet. */
export type ParsedValue = {
  code: string;
  period: string;
  value: number | null;
  basis: "ACTUAL" | "ESTIMATE";
  completionDate: string | null;
  note: string | null;
  row: number;
};

export type ParseResult = {
  kpis: ParsedKpi[];
  departments: string[];
  values: ParsedValue[];
  issues: ParseIssue[];
};

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("").trim();
    }
  }
  return String(value).trim();
}

function parseYesNo(text: string): boolean {
  return ["yes", "y", "true", "1"].includes(text.trim().toLowerCase());
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * "2026-10", "Oct 2026", "October 2026" and a real date cell all mean the same
 * month. Deliberately strict: `new Date()` would happily read "next year" as
 * January 2001, which would import a typo as a real target rather than
 * flagging it.
 */
function parseMonth(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (iso) {
    const month = Number(iso[2]);
    if (month < 1 || month > 12) return null;
    return `${iso[1]}-${String(month).padStart(2, "0")}`;
  }

  // "Oct 2026" / "October 2026", and the reverse order.
  const words = trimmed.toLowerCase().replace(/[,]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length !== 2) return null;

  const [a, b] = words;
  const yearText = /^\d{4}$/.test(b) ? b : /^\d{4}$/.test(a) ? a : null;
  const monthText = yearText === b ? a : yearText === a ? b : null;
  if (!yearText || !monthText) return null;

  const monthIndex = MONTH_NAMES.findIndex(
    (name) => name === monthText || name.slice(0, 3) === monthText
  );
  if (monthIndex < 0) return null;

  return `${yearText}-${String(monthIndex + 1).padStart(2, "0")}`;
}

// Parsing shared with the KPI detail page's editors — see targets.ts.
const parseRange = parseRangeInput;
const parseNumber = parseNumberInput;

/**
 * Reads an uploaded workbook into KPI rows. Never throws on bad content: every
 * problem becomes an issue pinned to its row, so the import preview can show
 * the whole list at once rather than failing on the first bad cell.
 */
export async function parseWorkbook(data: ArrayBuffer): Promise<ParseResult> {
  const issues: ParseIssue[] = [];
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(data);
  } catch {
    return {
      kpis: [],
      departments: [],
      values: [],
      issues: [{ row: null, message: "That file could not be read as an Excel workbook (.xlsx)." }],
    };
  }

  const kpiSheet = workbook.getWorksheet(KPI_SHEET);
  if (!kpiSheet) {
    return {
      kpis: [],
      departments: [],
      values: [],
      issues: [{ row: null, message: `The workbook has no "${KPI_SHEET}" sheet. Start from the downloadable template.` }],
    };
  }

  // Map header text to column index, so columns may be reordered.
  const headerRow = kpiSheet.getRow(1);
  const columnOf = new Map<string, number>();
  headerRow.eachCell((cell, index) => {
    const name = cellText(cell.value).toLowerCase();
    if (name) columnOf.set(name, index);
  });

  const missing = KPI_COLUMNS.filter((c) => !columnOf.has(c.toLowerCase()));
  if (missing.length > 0) {
    issues.push({
      row: 1,
      message: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    });
  }

  const get = (row: ExcelJS.Row, column: string): string => {
    const index = columnOf.get(column.toLowerCase());
    return index ? cellText(row.getCell(index).value) : "";
  };

  const kpis: ParsedKpi[] = [];
  const seenCodes = new Map<string, number>();

  kpiSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const code = get(row, "Code");
    const name = get(row, "Name");
    if (!code && !name) return; // blank spacer row

    if (!code) {
      issues.push({ row: rowNumber, message: `"${name}" has no Code. Every KPI needs one.` });
      return;
    }
    if (!name) {
      issues.push({ row: rowNumber, message: `${code} has no Name.` });
      return;
    }
    const duplicate = seenCodes.get(code.toLowerCase());
    if (duplicate) {
      issues.push({ row: rowNumber, message: `Code "${code}" is already used on row ${duplicate}.` });
      return;
    }
    seenCodes.set(code.toLowerCase(), rowNumber);

    const weightText = get(row, "Weight % (of group)");
    const weight = weightText ? parseNumber(weightText) : 0;
    if (weightText && weight === null) {
      issues.push({ row: rowNumber, message: `${code}: "${weightText}" is not a valid weight.` });
    }

    const frequencyText = get(row, "Frequency").toUpperCase().replace(/[\s-]+/g, "_");
    const frequency: Frequency = FREQUENCIES.includes(frequencyText as Frequency)
      ? (frequencyText as Frequency)
      : "MONTHLY";
    if (frequencyText && !FREQUENCIES.includes(frequencyText as Frequency)) {
      issues.push({
        row: rowNumber,
        message: `${code}: "${get(row, "Frequency")}" is not a frequency. Use one of ${FREQUENCIES.join(", ")}.`,
      });
    }

    const phasingText = get(row, "Phasing").toUpperCase();
    const phasing: Phasing = PHASINGS.includes(phasingText as Phasing) ? (phasingText as Phasing) : "NONE";
    if (phasingText && !PHASINGS.includes(phasingText as Phasing)) {
      issues.push({
        row: rowNumber,
        message: `${code}: "${get(row, "Phasing")}" is not a phasing option. Use one of ${PHASINGS.join(", ")}.`,
      });
    }

    let phaseConfig: string | null = null;
    if (phasing === "CUSTOM") {
      const sharesText = get(row, "Phase Shares");
      const shares = sharesText.split(";").map((s) => parseNumber(s.trim()));
      if (shares.length !== 12 || shares.some((s) => s === null)) {
        issues.push({
          row: rowNumber,
          message: `${code}: Phase Shares needs 12 numbers separated by semicolons when Phasing is Custom.`,
        });
      } else {
        phaseConfig = JSON.stringify(shares);
      }
    }

    const departments = get(row, "Departments")
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean);

    const metricText = get(row, "Metric Type").toUpperCase().replace(/[\s-]+/g, "_");
    const metricType = METRIC_TYPES.includes(metricText as MetricType)
      ? (metricText as MetricType)
      : null;
    if (metricText && !metricType) {
      issues.push({
        row: rowNumber,
        message: `${code}: "${get(row, "Metric Type")}" is not a metric type. Use one of ${METRIC_TYPES.join(", ")}.`,
      });
    }

    const directionText = get(row, "Direction").toUpperCase().replace(/[\s-]+/g, "_");
    const direction: Direction | null =
      directionText === "HIGHER_BETTER" || directionText === "HIGHER"
        ? "HIGHER_BETTER"
        : directionText === "LOWER_BETTER" || directionText === "LOWER"
          ? "LOWER_BETTER"
          : null;

    const modeText = get(row, "Target Mode").toUpperCase();
    const targetMode: TargetMode | null =
      modeText === "FIXED" ? "FIXED" : modeText === "RANGE" ? "RANGE" : null;

    const deadlineText = get(row, "Deadline Month");
    const deadlineMonth = deadlineText ? parseMonth(deadlineText) : null;
    if (deadlineText && !deadlineMonth) {
      issues.push({
        row: rowNumber,
        message: `${code}: "${deadlineText}" is not a month. Use YYYY-MM, e.g. 2026-10.`,
      });
    }

    const targetConfig = buildTargetConfig({
      row,
      rowNumber,
      code,
      metricType,
      targetMode,
      get,
      issues,
    });

    kpis.push({
      code,
      name,
      parentCode: get(row, "Parent Code") || null,
      weight: weight ?? 0,
      departments,
      metricType,
      unit: get(row, "Unit") || null,
      direction,
      targetMode,
      targetConfig,
      deadlineMonth,
      scoreFinalAfterDeadline: parseYesNo(get(row, "Score Final After Deadline")),
      frequency,
      phasing,
      phaseConfig,
      row: rowNumber,
    });
  });

  // Parent codes must resolve, or the hierarchy silently loses branches.
  const codes = new Set(kpis.map((k) => k.code.toLowerCase()));
  for (const kpi of kpis) {
    if (kpi.parentCode && !codes.has(kpi.parentCode.toLowerCase())) {
      issues.push({
        row: kpi.row,
        message: `${kpi.code}: parent code "${kpi.parentCode}" does not match any KPI in this sheet.`,
      });
    }
    if (kpi.parentCode && kpi.parentCode.toLowerCase() === kpi.code.toLowerCase()) {
      issues.push({ row: kpi.row, message: `${kpi.code} is listed as its own parent.` });
    }
  }

  const departmentSheet = workbook.getWorksheet(DEPARTMENT_SHEET);
  const departments = new Set<string>();
  departmentSheet?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const name = cellText(row.getCell(1).value);
    if (name) departments.add(name);
  });
  // Any department named on a KPI counts, even if the sheet omits it.
  for (const kpi of kpis) kpi.departments.forEach((d) => departments.add(d));

  const values = parseValuesSheet(workbook, codes, issues);

  return { kpis, departments: [...departments].sort(), values, issues };
}

/**
 * Reads the optional Values sheet — one row per KPI per month, so a year of
 * figures can be loaded alongside the hierarchy instead of typed in by hand.
 * A workbook without the sheet imports structure only, exactly as before.
 */
function parseValuesSheet(
  workbook: ExcelJS.Workbook,
  codes: Set<string>,
  issues: ParseIssue[]
): ParsedValue[] {
  const sheet = workbook.getWorksheet(VALUES_SHEET);
  if (!sheet) return [];

  const columnOf = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, index) => {
    const name = cellText(cell.value).toLowerCase();
    if (name) columnOf.set(name, index);
  });

  const get = (row: ExcelJS.Row, column: string): string => {
    const index = columnOf.get(column.toLowerCase());
    return index ? cellText(row.getCell(index).value) : "";
  };

  const values: ParsedValue[] = [];
  const seen = new Map<string, number>();

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const code = get(row, "Code");
    const periodText = get(row, "Period");
    if (!code && !periodText) return; // blank spacer row

    if (!codes.has(code.toLowerCase())) {
      issues.push({
        row: rowNumber,
        message: `Values sheet: "${code}" does not match any KPI on the ${KPI_SHEET} sheet.`,
      });
      return;
    }

    const period = parseMonth(periodText);
    if (!period) {
      issues.push({
        row: rowNumber,
        message: `Values sheet: "${periodText}" is not a month. Use YYYY-MM, e.g. 2026-08.`,
      });
      return;
    }

    const key = `${code.toLowerCase()}|${period}`;
    const duplicate = seen.get(key);
    if (duplicate) {
      issues.push({
        row: rowNumber,
        message: `Values sheet: ${code} already has a figure for ${period} on row ${duplicate}.`,
      });
      return;
    }
    seen.set(key, rowNumber);

    const valueText = get(row, "Value");
    const value = valueText ? parseNumber(valueText) : null;
    if (valueText && value === null) {
      issues.push({
        row: rowNumber,
        message: `Values sheet: ${code}: "${valueText}" is not a number.`,
      });
      return;
    }

    const completionText = get(row, "Completion Date");
    let completionDate: string | null = null;
    if (completionText) {
      const parsed = parseDateCell(completionText);
      if (!parsed) {
        issues.push({
          row: rowNumber,
          message: `Values sheet: ${code}: "${completionText}" is not a date. Use dd/mm/yyyy.`,
        });
        return;
      }
      completionDate = parsed;
    }

    const basisText = get(row, "Basis").trim().toUpperCase();
    values.push({
      code,
      period,
      value,
      basis: basisText.startsWith("E") ? "ESTIMATE" : "ACTUAL",
      completionDate,
      note: get(row, "Note") || null,
      row: rowNumber,
    });
  });

  return values;
}

/** "09/03/2026", "2026-03-09" or a real date cell to ISO yyyy-mm-dd. */
function parseDateCell(text: string): string | null {
  const trimmed = text.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!dmy) return null;
  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  const year = Number(dmy[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  if (day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildTargetConfig(params: {
  row: ExcelJS.Row;
  rowNumber: number;
  code: string;
  metricType: MetricType | null;
  targetMode: TargetMode | null;
  get: (row: ExcelJS.Row, column: string) => string;
  issues: ParseIssue[];
}): string | null {
  const { row, rowNumber, code, metricType, targetMode, get, issues } = params;

  // Parent rows carry no metric; their score is the rollup of their children.
  if (!metricType) return null;

  if (metricType === "MONTH_COMPLETION") {
    const raw = get(row, BAND_COLUMNS.MEET);
    const targetMonth = parseMonth(raw);
    if (!targetMonth) {
      issues.push({
        row: rowNumber,
        message: `${code}: a month-of-completion KPI needs its target month in the Meet column, e.g. 2026-10.`,
      });
      return null;
    }
    return JSON.stringify({ targetMonth });
  }

  if (!targetMode) {
    issues.push({ row: rowNumber, message: `${code}: Target Mode must be FIXED or RANGE.` });
    return null;
  }

  if (targetMode === "FIXED") {
    const config: Partial<Record<Band, number>> = {};
    for (const band of BANDS) {
      const raw = get(row, BAND_COLUMNS[band]);
      const value = parseNumber(raw);
      if (value === null) {
        issues.push({
          row: rowNumber,
          message: `${code}: the ${BAND_COLUMNS[band]} target is missing or not a number.`,
        });
        return null;
      }
      config[band] = value;
    }
    return JSON.stringify(config);
  }

  const config: Partial<Record<Band, [number, number]>> = {};
  for (const band of BANDS) {
    const raw = get(row, BAND_COLUMNS[band]);
    const range = parseRange(raw);
    if (!range) {
      issues.push({
        row: rowNumber,
        message: `${code}: the ${BAND_COLUMNS[band]} range should look like "50-69".`,
      });
      return null;
    }
    config[band] = range;
  }
  return JSON.stringify(config);
}

// --------------------------------------------------------------------------
// Writing
// --------------------------------------------------------------------------

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" },
  };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 30;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

/**
 * ExcelJS types `writeBuffer()` as its own `Buffer extends ArrayBuffer`, while
 * at runtime it hands back a Node Buffer. Normalising to a Uint8Array keeps
 * callers (route handlers, tests) free of that ambiguity.
 */
async function toBytes(workbook: ExcelJS.Workbook): Promise<Uint8Array> {
  const written = (await workbook.xlsx.writeBuffer()) as unknown;
  return written instanceof Uint8Array
    ? new Uint8Array(written)
    : new Uint8Array(written as ArrayBuffer);
}

function argb(hex: string): string {
  return `FF${hex.replace("#", "").toUpperCase()}`;
}

function addReadmeSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet(README_SHEET);
  sheet.columns = [{ width: 26 }, { width: 110 }];

  const lines: [string, string][] = [
    ["How this file works", ""],
    ["", "Each row on the KPIs sheet is one KPI. Build the hierarchy by putting a parent's Code in the child's Parent Code column. Leave Parent Code blank for a Strategic Goal."],
    ["", "Only the lowest-level KPIs carry a weight, a metric and targets. A KPI with children is scored as the weighted average of those children, so its own metric columns are ignored."],
    ["Weights", "Weight % is a share of the whole company. Every lowest-level KPI's weight should add up to 100."],
    ["Values", "Figures entered each month are cumulative year-to-date and are compared against the full-year target. The financial year runs 1 April to 31 March."],
    ["Score bands", BANDS.map((b) => `${bandLabel(b)} ${BAND_BOUNDS[b].lo}-${BAND_BOUNDS[b].hi}`).join("   |   ")],
    ["Metric Type", `${METRIC_TYPES.join(", ")}. Use DOLLAR for money; put the currency (${DEFAULT_CURRENCY}) in the Unit column.`],
    ["Direction", "HIGHER_BETTER when a bigger number is better (revenue, completion %), LOWER_BETTER when a smaller one is (cost, days taken, defects)."],
    ["Target Mode", "FIXED — put a single number in each band column. Reaching a band's target scores the top of that band. Targets normally step by 1 and must get harder from Poor through to Excellent."],
    ["", 'RANGE — put a window in each band column, written "50-69". The score scales across the window between that band\'s lowest and highest score.'],
    ["Month of completion", "Set Metric Type to MONTH_COMPLETION and put the target month in the Meet column as YYYY-MM. Leave the other band columns blank — finishing one, two or three months early scores Good, Very Good, Excellent, and one or two months late scores Improvement Needed or Poor."],
    ["Deadline Month", "Optional, YYYY-MM. Use it for a KPI that is time-bound even though its metric is not. It means the last day of that month."],
    ["Score Final After Deadline", 'Yes — the score freezes at whatever it was in the deadline month; later achievement is recorded but does not change it. No (the default) — later achievement still earns partial credit, capped at 2.9 one month late, 2.4 two months late, and 0 after that.'],
    ["Departments", "Who owns the KPI. Separate several with a semicolon, e.g. Finance; Operations. Names should match the Departments sheet."],
    ["Frequency", "How often the KPI is reported: Monthly (the default), Quarterly (due Jun/Sep/Dec/Mar) or Annual (due in March). A KPI not yet due in a month doesn't count as a reporting gap."],
    ["Phasing", 'None (the default) scores the year-to-date figure against the full-year target every month. Even divides the annual target evenly across 12 months. Custom uses the Phase Shares column. Only for cumulative measures — never for rates or stocks.'],
    ["Phase Shares", 'Custom phasing only: 12 monthly shares (April first), summing to 100, separated by semicolons — e.g. "5;5;10;10;10;10;10;10;10;10;5;5".'],
    ["Global %", "Export only, derived and read-only: this KPI's share of the whole company. Ignored on import — edit Weight % (of group) instead."],
    ["Dropdowns", `Metric Type, Direction, Target Mode, Score Final After Deadline, Frequency and Phasing are dropdowns — pick from the list rather than typing, and Excel will refuse anything else. Unit offers ${UNIT_SUGGESTIONS.join(", ")} as a shortcut but accepts any label, so a KPI counted in something else can still be typed in. Every one of them may be left blank on a KPI that has children.`],
    ["Values sheet (optional)", 'Add a sheet named "Values" to load monthly figures alongside the hierarchy, instead of typing them in. Columns: Code, Period, Value, Basis, Completion Date, Note. Period is YYYY-MM. Basis is Actual or Estimate. Completion Date (dd/mm/yyyy) is only for month-of-completion KPIs. A row overwrites whatever is recorded for that KPI and month.'],
  ];

  lines.forEach(([label, text], index) => {
    const row = sheet.addRow([label, text]);
    row.alignment = { vertical: "top", wrapText: true };
    if (index === 0) row.font = { bold: true, size: 14 };
    else if (label) row.getCell(1).font = { bold: true };
  });

  return sheet;
}

function addDepartmentSheet(workbook: ExcelJS.Workbook, departments: string[]) {
  const sheet = workbook.addWorksheet(DEPARTMENT_SHEET);
  sheet.columns = [{ header: "Department", key: "name", width: 40 }];
  departments.forEach((name) => sheet.addRow({ name }));
  styleHeader(sheet);
  return sheet;
}

function addKpiSheet(workbook: ExcelJS.Workbook, options?: { includeGlobalWeight?: boolean }) {
  const sheet = workbook.addWorksheet(KPI_SHEET);
  const headers: string[] = [...KPI_COLUMNS];
  // Appended at the end, never inserted, so it never shifts the positions
  // addListValidation and formatTargetCell rely on KPI_COLUMNS for.
  if (options?.includeGlobalWeight) headers.push(GLOBAL_WEIGHT_COLUMN);

  sheet.columns = headers.map((header) => ({
    header,
    width:
      header === "Name" ? 42 : header === "Departments" ? 26 : header === "Score Final After Deadline" ? 24 : 16,
  }));
  styleHeader(sheet);
  addListValidation(sheet);
  return sheet;
}

/**
 * Turns the fixed-vocabulary columns into dropdowns. A blank is always allowed
 * — a KPI with children carries no metric at all — and the strict columns
 * explain themselves when something else is typed, rather than just refusing.
 */
function addListValidation(sheet: ExcelJS.Worksheet) {
  for (const { column, values, strict } of LIST_COLUMNS) {
    const index = KPI_COLUMNS.indexOf(column as (typeof KPI_COLUMNS)[number]) + 1;
    if (index === 0) continue;
    const letter = sheet.getColumn(index).letter;

    // One validation over the whole column range, rather than one per cell.
    // Per-cell would both create 500 empty rows and hit an ExcelJS bug: it
    // merges alike validations into ranges but sorts the addresses as text,
    // so "F10" sorts before "F2" and the merge emits two overlapping ranges —
    // which Excel reports as unreadable content.
    validationsOf(sheet).add(`${letter}2:${letter}${VALIDATED_ROWS + 1}`, {
      type: "list",
      allowBlank: true,
      formulae: [`"${values.join(",")}"`],
      ...(strict
        ? {
            showErrorMessage: true,
            // OOXML allows only stop / warning / information here; ExcelJS
            // types it as a bare string and writes whatever it is given, and
            // Excel then refuses to open a file carrying anything else.
            errorStyle: "stop",
            errorTitle: `${column} not recognised`,
            error: `${column} must be one of: ${values.join(", ")}.`,
          }
        : {
            // A suggestion, not a rule — so say so on the way in rather than
            // complaining on the way out.
            showErrorMessage: false,
            showInputMessage: true,
            promptTitle: column,
            prompt: `Pick one, or type your own — any label is accepted.`,
          }),
    });
  }
}

/** ExcelJS exposes the range-addressed validation store, but does not type it. */
function validationsOf(sheet: ExcelJS.Worksheet): {
  add: (range: string, validation: ExcelJS.DataValidation) => void;
} {
  return (sheet as unknown as { dataValidations: { add: (range: string, validation: ExcelJS.DataValidation) => void } })
    .dataValidations;
}

function formatTargetCell(
  band: Band,
  metricType: MetricType | null,
  targetMode: TargetMode | null,
  config: unknown
): string | number | null {
  if (!config || !metricType) return null;

  if (metricType === "MONTH_COMPLETION") {
    const month = (config as { targetMonth?: string }).targetMonth;
    return band === "MEET" ? (month ?? null) : null;
  }

  const value = (config as Record<Band, unknown>)[band];
  if (value === undefined || value === null) return null;
  if (targetMode === "RANGE" && Array.isArray(value)) return `${value[0]}-${value[1]}`;
  return typeof value === "number" ? value : String(value);
}

export type ExportKpi = Pick<
  KpiRecord,
  | "code"
  | "name"
  | "weight"
  | "metricType"
  | "unit"
  | "direction"
  | "targetMode"
  | "deadlineMonth"
  | "scoreFinalAfterDeadline"
> & {
  parentCode: string | null;
  departments: string[];
  targetConfig: unknown;
  isLeaf: boolean;
  frequency?: Frequency;
  phasing?: Phasing;
  phaseConfig?: number[] | string | null;
  /** Export only — this KPI's derived share of the whole company. */
  globalWeight?: number;
};

function kpiRow(kpi: ExportKpi): (string | number | null)[] {
  const phaseShares = Array.isArray(kpi.phaseConfig)
    ? kpi.phaseConfig.join(";")
    : typeof kpi.phaseConfig === "string"
      ? (JSON.parse(kpi.phaseConfig) as number[]).join(";")
      : null;

  const row: (string | number | null)[] = [
    kpi.code,
    kpi.name,
    kpi.parentCode,
    // Every node now carries a meaningful local weight — its share of its own
    // siblings — parents included, not just leaves.
    kpi.weight,
    kpi.departments.join("; ") || null,
    kpi.metricType,
    kpi.unit,
    kpi.direction,
    kpi.targetMode,
    ...BANDS.map((band) =>
      formatTargetCell(band, kpi.metricType, kpi.targetMode, kpi.targetConfig)
    ),
    kpi.deadlineMonth,
    kpi.scoreFinalAfterDeadline ? "Yes" : "No",
    kpi.frequency && kpi.frequency !== "MONTHLY" ? kpi.frequency : null,
    kpi.phasing && kpi.phasing !== "NONE" ? kpi.phasing : null,
    kpi.phasing === "CUSTOM" ? phaseShares : null,
  ];
  if (kpi.globalWeight !== undefined) row.push(Number(kpi.globalWeight.toFixed(2)));
  return row;
}

/** A blank workbook with the headers, the rules, and the department list. */
export async function buildTemplateWorkbook(departments: string[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KPI Scorecard";
  addReadmeSheet(workbook);
  addKpiSheet(workbook);
  addDepartmentSheet(workbook, departments.length > 0 ? departments : ["Finance", "Operations"]);
  return toBytes(workbook);
}

/** The same template, pre-filled with a worked example of every metric type. */
export async function buildExampleWorkbook(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KPI Scorecard";
  addReadmeSheet(workbook);
  const sheet = addKpiSheet(workbook);

  const examples: ExportKpi[] = [
    {
      code: "SG1", name: "Grow the business", parentCode: null, weight: 0,
      departments: [], metricType: null, unit: null, direction: null, targetMode: null,
      targetConfig: null, deadlineMonth: null, scoreFinalAfterDeadline: false, isLeaf: false,
    },
    {
      code: "SG1.1", name: "Revenue", parentCode: "SG1", weight: 40,
      departments: ["Finance"], metricType: "DOLLAR", unit: DEFAULT_CURRENCY,
      direction: "HIGHER_BETTER", targetMode: "FIXED",
      targetConfig: { POOR: 8_000_000, IMPROVEMENT_NEEDED: 9_000_000, MEET: 10_000_000, GOOD: 11_000_000, VERY_GOOD: 12_000_000, EXCELLENT: 13_000_000 },
      deadlineMonth: null, scoreFinalAfterDeadline: false, isLeaf: true,
    },
    {
      code: "SG1.2", name: "Customer satisfaction", parentCode: "SG1", weight: 20,
      departments: ["Operations"], metricType: "PERCENTAGE", unit: "%",
      direction: "HIGHER_BETTER", targetMode: "RANGE",
      targetConfig: { POOR: [0, 49], IMPROVEMENT_NEEDED: [50, 69], MEET: [70, 79], GOOD: [80, 89], VERY_GOOD: [90, 95], EXCELLENT: [96, 100] },
      deadlineMonth: null, scoreFinalAfterDeadline: false, isLeaf: true,
    },
    {
      code: "SG2", name: "Operate efficiently", parentCode: null, weight: 0,
      departments: [], metricType: null, unit: null, direction: null, targetMode: null,
      targetConfig: null, deadlineMonth: null, scoreFinalAfterDeadline: false, isLeaf: false,
    },
    {
      code: "SG2.1", name: "Days to close month-end books", parentCode: "SG2", weight: 20,
      departments: ["Finance"], metricType: "DAYS", unit: "days",
      direction: "LOWER_BETTER", targetMode: "FIXED",
      targetConfig: { POOR: 12, IMPROVEMENT_NEEDED: 11, MEET: 10, GOOD: 9, VERY_GOOD: 8, EXCELLENT: 7 },
      deadlineMonth: null, scoreFinalAfterDeadline: false, isLeaf: true,
    },
    {
      code: "SG2.2", name: "Complete ERP rollout", parentCode: "SG2", weight: 10,
      departments: ["Operations", "IT"], metricType: "MONTH_COMPLETION", unit: null,
      direction: null, targetMode: null, targetConfig: { targetMonth: "2026-10" },
      deadlineMonth: null, scoreFinalAfterDeadline: false, isLeaf: true,
    },
    {
      code: "SG2.3", name: "Sites migrated to new platform", parentCode: "SG2", weight: 10,
      departments: ["IT"], metricType: "QUANTITY", unit: "sites",
      direction: "HIGHER_BETTER", targetMode: "FIXED",
      targetConfig: { POOR: 3, IMPROVEMENT_NEEDED: 4, MEET: 5, GOOD: 6, VERY_GOOD: 7, EXCELLENT: 8 },
      deadlineMonth: "2026-12", scoreFinalAfterDeadline: false, isLeaf: true,
    },
  ];

  examples.forEach((kpi) => sheet.addRow(kpiRow(kpi)));
  addDepartmentSheet(workbook, ["Finance", "IT", "Operations"]);
  return toBytes(workbook);
}

/**
 * A full export: the hierarchy exactly as the importer expects it back, plus a
 * Scores sheet for the periods on screen. Re-importing this file reproduces
 * the scorecard it came from.
 */
export async function buildExportWorkbook(params: {
  fiscalYearLabel: string;
  kpis: ExportKpi[];
  departments: string[];
  periods: string[];
  tree: ScoredNode[];
  totalsByPeriod: Map<string, { score: number | null; coverage: number }>;
  scoresByPeriod: Map<string, Map<string, { score: number | null; band: Band | null; coverage: number; provisional: boolean }>>;
}): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KPI Scorecard";

  addReadmeSheet(workbook);

  const kpiSheet = addKpiSheet(workbook, { includeGlobalWeight: true });
  params.kpis.forEach((kpi) => kpiSheet.addRow(kpiRow(kpi)));

  addDepartmentSheet(workbook, params.departments);

  // --- Scores -------------------------------------------------------------
  const scores = workbook.addWorksheet(SCORES_SHEET);
  scores.columns = [
    { header: "Code", width: 14 },
    { header: "KPI", width: 46 },
    { header: "Level", width: 8 },
    { header: "Weight %", width: 10 },
    { header: "Departments", width: 24 },
    ...params.periods.map((period) => ({ header: formatPeriodLabel(period), width: 13 })),
  ];
  styleHeader(scores);

  const nodes = flattenTree(params.tree);
  for (const node of nodes) {
    const row = scores.addRow([
      node.code,
      // Indent by level so the hierarchy is readable in Excel.
      `${"    ".repeat(node.level - 1)}${node.name}`,
      node.level,
      Number(node.weight.toFixed(2)),
      node.departments.map((d) => d.name).join("; "),
      ...params.periods.map((period) => {
        const score = params.scoresByPeriod.get(period)?.get(node.id)?.score;
        return score ?? null;
      }),
    ]);

    if (!node.isLeaf) row.font = { bold: true };

    // Colour each score cell by its band, matching the app.
    params.periods.forEach((period, index) => {
      const entry = params.scoresByPeriod.get(period)?.get(node.id);
      const cell = row.getCell(6 + index);
      cell.numFmt = "0.0";
      if (entry?.band) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: argb(BAND_STYLES[entry.band].hex) },
        };
        cell.font = { color: { argb: "FFFFFFFF" }, bold: !node.isLeaf };
      }
      if (entry?.provisional) {
        cell.note = "Provisional — scored from an estimate rather than an actual.";
      }
    });
  }

  scores.addRow([]);
  const totalRow = scores.addRow([
    "TOTAL",
    `${params.fiscalYearLabel} combined score`,
    null,
    100,
    null,
    ...params.periods.map((p) => params.totalsByPeriod.get(p)?.score ?? null),
  ]);
  totalRow.font = { bold: true, size: 12 };
  params.periods.forEach((_, index) => {
    totalRow.getCell(6 + index).numFmt = "0.0";
  });

  const coverageRow = scores.addRow([
    "",
    "Share of weight scored",
    null,
    null,
    null,
    ...params.periods.map((p) => params.totalsByPeriod.get(p)?.coverage ?? null),
  ]);
  coverageRow.font = { italic: true, color: { argb: "FF6B7280" } };
  params.periods.forEach((_, index) => {
    coverageRow.getCell(6 + index).numFmt = "0%";
  });

  scores.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];

  return toBytes(workbook);
}
