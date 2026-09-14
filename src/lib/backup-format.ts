// One fiscal year's complete source data, as a single portable document —
// the shape of it, and the validator that turns untrusted text back into it.
//
// This is the app's recovery format. The *same* document is what a saved
// checkpoint stores, what the download serves, and what an upload accepts, so
// a checkpoint and an uploaded file are the same thing arriving by different
// routes.
//
// Deliberately free of database access, so the format and its validation can
// be exercised directly in tests. Everything that reads or writes a year
// lives in ./backup.

import { fiscalYearLabel } from "./fiscal";
import { checkNoCycles } from "./validation";
import type { KpiRecord } from "./kpi-tree";
import type {
  Direction,
  Frequency,
  MetricType,
  Phasing,
  TargetMode,
} from "./scoring";

/**
 * Bumped only when the shape below changes incompatibly. An unrecognised
 * version is refused outright rather than guessed at — a half-understood
 * restore is worse than a refused one.
 */
export const BACKUP_FORMAT_VERSION = 1;

/** Uploads above this are refused before parsing. A real year is well under 1 MB. */
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export type BackupValue = {
  period: string;
  value: number | null;
  basis: "ACTUAL" | "ESTIMATE";
  completionDate: string | null;
  note: string | null;
};

export type BackupUpdate = {
  period: string;
  mode: "SIMPLE" | "DETAILED";
  body: string | null;
  currentProgress: string | null;
  nextProgress: string | null;
  timeCost: string | null;
  issues: string | null;
  author: string | null;
  createdAt: string;
};

export type BackupAudit = {
  field: string;
  label: string;
  from: string;
  to: string;
  author: string | null;
  createdAt: string;
};

export type BackupOverride = {
  period: string;
  score: number;
  reason: string;
  byUsername: string;
  createdAt: string;
};

export type BackupKpi = {
  /** The join key inside the document — ids are never carried across. */
  code: string;
  parentCode: string | null;
  name: string;
  sortOrder: number;
  weight: number;
  frequency: Frequency;
  phasing: Phasing;
  phaseConfig: string | null;
  metricType: MetricType | null;
  direction: Direction | null;
  targetMode: TargetMode | null;
  targetConfig: string | null;
  unit: string | null;
  deadlineMonth: string | null;
  scoreFinalAfterDeadline: boolean;
  /** Department names, resolved (and created if missing) on restore. */
  departments: string[];
  values: BackupValue[];
  updates: BackupUpdate[];
  audits: BackupAudit[];
  overrides: BackupOverride[];
};

export type FiscalYearBackup = {
  formatVersion: number;
  exportedAt: string;
  fiscalYear: {
    startYear: number;
    label: string;
    /** Whether the year was closed when this was taken. A restore never reinstates it. */
    wasClosed: boolean;
  };
  departments: string[];
  kpis: BackupKpi[];
};

export function countValues(backup: FiscalYearBackup): number {
  return backup.kpis.reduce((sum, k) => sum + k.values.length, 0);
}

/** "Before import, 13 Sep 2026 15:04" — how every automatic checkpoint is labelled. */
export function automaticCheckpointName(what: "import" | "restore"): string {
  const when = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Before ${what}, ${when}`;
}

/**
 * Turns untrusted text into a backup document, or throws a message worth
 * showing someone. Everything is checked before a restore touches the
 * database, so a malformed file is refused rather than half-applied.
 *
 * Structural *warnings* a year may legitimately carry — weights that don't
 * sum to 100, a KPI with no targets yet — are not checked here: a backup is
 * a faithful record of what was there, and restoring it must reproduce it
 * exactly, imperfections included. Only things that make a hierarchy
 * impossible to rebuild are rejected.
 */
export function parseBackup(text: string): FiscalYearBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON. Choose a backup file downloaded from this app.");
  }

  if (!isObject(raw)) throw new Error("That file isn't a scorecard backup.");

  const version = raw.formatVersion;
  if (typeof version !== "number") {
    throw new Error("That file isn't a scorecard backup — it has no format version.");
  }
  if (version !== BACKUP_FORMAT_VERSION) {
    throw new Error(
      `That backup is format version ${version}, and this app reads version ${BACKUP_FORMAT_VERSION}. ` +
        "It was probably made by a different version of the app."
    );
  }

  const year = raw.fiscalYear;
  if (!isObject(year) || typeof year.startYear !== "number" || !Number.isInteger(year.startYear)) {
    throw new Error("That backup doesn't say which fiscal year it holds.");
  }

  if (!Array.isArray(raw.kpis)) throw new Error("That backup has no KPIs in it.");

  const kpis = raw.kpis.map((entry, index) => parseKpi(entry, index));

  const codes = new Set<string>();
  for (const kpi of kpis) {
    const key = kpi.code.toLowerCase();
    if (codes.has(key)) throw new Error(`That backup lists the code "${kpi.code}" twice.`);
    codes.add(key);
  }
  for (const kpi of kpis) {
    if (kpi.parentCode && !codes.has(kpi.parentCode.toLowerCase())) {
      throw new Error(
        `"${kpi.name}" says its parent is "${kpi.parentCode}", which isn't in this backup.`
      );
    }
  }

  // Codes stand in for ids, so the existing cycle check applies directly.
  const asRecords: KpiRecord[] = kpis.map((kpi) => ({
    id: kpi.code.toLowerCase(),
    code: kpi.code,
    name: kpi.name,
    parentId: kpi.parentCode ? kpi.parentCode.toLowerCase() : null,
    sortOrder: kpi.sortOrder,
    weight: kpi.weight,
    metricType: kpi.metricType,
    direction: kpi.direction,
    targetMode: kpi.targetMode,
    targetConfig: kpi.targetConfig,
    unit: kpi.unit,
    deadlineMonth: kpi.deadlineMonth,
    scoreFinalAfterDeadline: kpi.scoreFinalAfterDeadline,
    departments: [],
  }));
  const cycles = checkNoCycles(asRecords);
  if (cycles.length > 0) throw new Error(cycles[0].message);

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : new Date().toISOString(),
    fiscalYear: {
      startYear: year.startYear,
      label: typeof year.label === "string" && year.label ? year.label : fiscalYearLabel(year.startYear),
      wasClosed: year.wasClosed === true,
    },
    departments: Array.isArray(raw.departments)
      ? raw.departments.filter((d): d is string => typeof d === "string")
      : [],
    kpis,
  };
}

export type RestoreTarget =
  | { mode: "IN_PLACE"; fiscalYearId: string }
  | { mode: "NEW_YEAR"; startYear: number };

export type RestoreSummary = {
  fiscalYearId: string;
  fiscalYearLabel: string;
  kpis: number;
  values: number;
  overrides: number;
  /** Departments that had to be created because the target didn't have them. */
  departmentsCreated: number;
};

// --------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseKpi(entry: unknown, index: number): BackupKpi {
  const where = `KPI ${index + 1}`;
  if (!isObject(entry)) throw new Error(`${where} in that backup isn't readable.`);

  const code = entry.code;
  if (typeof code !== "string" || !code.trim()) {
    throw new Error(`${where} in that backup has no code.`);
  }
  const name = typeof entry.name === "string" ? entry.name : code;

  return {
    code: code.trim(),
    parentCode: typeof entry.parentCode === "string" && entry.parentCode.trim()
      ? entry.parentCode.trim()
      : null,
    name,
    sortOrder: numberOr(entry.sortOrder, index),
    weight: numberOr(entry.weight, 0),
    frequency: oneOf(entry.frequency, ["MONTHLY", "QUARTERLY", "ANNUAL"] as const, "MONTHLY"),
    phasing: oneOf(entry.phasing, ["NONE", "EVEN", "CUSTOM"] as const, "NONE"),
    phaseConfig: stringOrNull(entry.phaseConfig),
    metricType: optionalOneOf(entry.metricType, [
      "PERCENTAGE", "DOLLAR", "QUANTITY", "DAYS", "MONTH_COMPLETION",
    ] as const),
    direction: optionalOneOf(entry.direction, ["HIGHER_BETTER", "LOWER_BETTER"] as const),
    targetMode: optionalOneOf(entry.targetMode, ["FIXED", "RANGE"] as const),
    targetConfig: stringOrNull(entry.targetConfig),
    unit: stringOrNull(entry.unit),
    deadlineMonth: stringOrNull(entry.deadlineMonth),
    scoreFinalAfterDeadline: entry.scoreFinalAfterDeadline === true,
    departments: Array.isArray(entry.departments)
      ? entry.departments.filter((d): d is string => typeof d === "string")
      : [],
    values: list(entry.values).map((v) => ({
      period: requirePeriod(v.period, `a figure on "${name}"`),
      value: typeof v.value === "number" && Number.isFinite(v.value) ? v.value : null,
      basis: v.basis === "ESTIMATE" ? "ESTIMATE" : "ACTUAL",
      completionDate: stringOrNull(v.completionDate),
      note: stringOrNull(v.note),
    })),
    updates: list(entry.updates).map((u) => ({
      period: requirePeriod(u.period, `an update on "${name}"`),
      mode: u.mode === "DETAILED" ? "DETAILED" : "SIMPLE",
      body: stringOrNull(u.body),
      currentProgress: stringOrNull(u.currentProgress),
      nextProgress: stringOrNull(u.nextProgress),
      timeCost: stringOrNull(u.timeCost),
      issues: stringOrNull(u.issues),
      author: stringOrNull(u.author),
      createdAt: isoOrNow(u.createdAt),
    })),
    audits: list(entry.audits).map((a) => ({
      field: typeof a.field === "string" ? a.field : "",
      label: typeof a.label === "string" ? a.label : "",
      from: typeof a.from === "string" ? a.from : "",
      to: typeof a.to === "string" ? a.to : "",
      author: stringOrNull(a.author),
      createdAt: isoOrNow(a.createdAt),
    })),
    overrides: list(entry.overrides).map((o) => ({
      period: requirePeriod(o.period, `a calibration on "${name}"`),
      score: numberOr(o.score, 0),
      reason: typeof o.reason === "string" ? o.reason : "",
      byUsername: typeof o.byUsername === "string" ? o.byUsername : "",
      createdAt: isoOrNow(o.createdAt),
    })),
  };
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isoOrNow(value: unknown): string {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return value;
  return new Date().toISOString();
}

function requirePeriod(value: unknown, where: string): string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error(`${where} has "${String(value)}" where a month like 2026-08 should be.`);
  }
  return value;
}

function oneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
): T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function optionalOneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T
): T[number] | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : null;
}
