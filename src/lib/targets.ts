// The one place a KPI's metric definition — metric type, target mode,
// direction and its six band targets or target month — is parsed, drafted and
// turned back into database columns.
//
// Three separate copies of this used to exist and disagreed: strict parsing
// in the KPI detail page, tolerant parsing in the importer, and a third set of
// rules in the server action. Collapsing them here means the detail page
// gains the importer's tolerant parsing ("50 to 69", "$1,200", "45%") as a
// side effect of sharing rather than copying, and — the reason this module
// exists at all — `metricColumns` is the only function allowed to produce
// `metricType` / `targetMode` / `direction` / `targetConfig`, always together.
// Writing them separately was the latent bug: a target mode could change
// while the database still recorded the old one.

import { BANDS, type Band, type Direction, type MetricType, type TargetMode } from "./scoring";
import { orderingIssue } from "./validation";

export type NumericMetricType = Exclude<MetricType, "MONTH_COMPLETION">;

/** The raw, editable form of a KPI's metric definition. */
export type MetricDraft = {
  metricType: MetricType | "";
  targetMode: TargetMode | "";
  direction: Direction | "";
  /** Six raw strings, kept verbatim across a target-mode flip. */
  targets: Record<Band, string>;
  /** "YYYY-MM"; held apart from `targets` rather than overloading the Meet slot. */
  targetMonth: string;
};

/** A validated metric definition, ready to become database columns. */
export type MetricInput =
  | { kind: "NONE" }
  | { kind: "MONTH"; targetMonth: string }
  | {
      kind: "FIXED";
      metricType: NumericMetricType;
      direction: Direction;
      bands: Record<Band, number>;
    }
  | {
      kind: "RANGE";
      metricType: NumericMetricType;
      direction: Direction;
      bands: Record<Band, [number, number]>;
    };

// --------------------------------------------------------------------------
// Parsing — tolerant of how a person actually types a number
// --------------------------------------------------------------------------

/** Tolerates thousands separators, currency symbols and a trailing %. */
export function parseNumberInput(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[,\s$£€%]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** "50-69", "50 – 69", "50 to 69" — but not a bare number. */
export function parseRangeInput(text: string): [number, number] | null {
  const cleaned = text.replace(/\s*(?:to|–|—)\s*/gi, "-").trim();
  const match = cleaned.match(/^(-?[\d.]+)\s*-\s*(-?[\d.]+)$/);
  if (!match) return null;
  const lo = Number(match[1]);
  const hi = Number(match[2]);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return [lo, hi];
}

// --------------------------------------------------------------------------
// KPI <-> draft
// --------------------------------------------------------------------------

/** Seeds an editor's draft from a KPI's stored definition. */
export function metricToDraft(kpi: {
  metricType: MetricType | null;
  targetMode: TargetMode | null;
  direction: Direction | null;
  targetConfig: unknown;
}): MetricDraft {
  const draft: MetricDraft = {
    metricType: kpi.metricType ?? "",
    targetMode: kpi.targetMode ?? "",
    direction: kpi.direction ?? "",
    targets: { POOR: "", IMPROVEMENT_NEEDED: "", MEET: "", GOOD: "", VERY_GOOD: "", EXCELLENT: "" },
    targetMonth: "",
  };

  if (!kpi.targetConfig) return draft;

  if (kpi.metricType === "MONTH_COMPLETION") {
    draft.targetMonth = (kpi.targetConfig as { targetMonth?: string }).targetMonth ?? "";
    return draft;
  }

  for (const band of BANDS) {
    const value = (kpi.targetConfig as Record<Band, unknown>)[band];
    if (value === undefined || value === null) continue;
    draft.targets[band] = Array.isArray(value) ? `${value[0]}-${value[1]}` : String(value);
  }
  return draft;
}

/**
 * Turns a draft back into a validated `MetricInput`, or an error message
 * naming the problem. Never throws — the caller decides how to surface it.
 */
export function draftToMetricInput(
  draft: MetricDraft,
  isLeaf: boolean
): { ok: true; metric: MetricInput } | { ok: false; error: string } {
  if (!isLeaf) return { ok: true, metric: { kind: "NONE" } };
  if (!draft.metricType) return { ok: true, metric: { kind: "NONE" } };

  if (draft.metricType === "MONTH_COMPLETION") {
    const targetMonth = draft.targetMonth.trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
      return { ok: false, error: "The target month must be in YYYY-MM form, e.g. 2026-10." };
    }
    return { ok: true, metric: { kind: "MONTH", targetMonth } };
  }

  if (!draft.direction) return { ok: false, error: "Choose a direction — higher or lower is better." };
  if (!draft.targetMode) return { ok: false, error: "Choose a target mode — fixed or range." };

  const metricType = draft.metricType as NumericMetricType;

  if (draft.targetMode === "RANGE") {
    const bands = {} as Record<Band, [number, number]>;
    for (const band of BANDS) {
      const range = parseRangeInput(draft.targets[band] ?? "");
      if (!range) {
        return { ok: false, error: `The ${bandName(band)} window should look like "50-69".` };
      }
      bands[band] = range;
    }
    return { ok: true, metric: { kind: "RANGE", metricType, direction: draft.direction, bands } };
  }

  const bands = {} as Record<Band, number>;
  for (const band of BANDS) {
    const value = parseNumberInput(draft.targets[band] ?? "");
    if (value === null) return { ok: false, error: `The ${bandName(band)} target is not a number.` };
    bands[band] = value;
  }
  return { ok: true, metric: { kind: "FIXED", metricType, direction: draft.direction, bands } };
}

function bandName(band: Band): string {
  return band.replace(/_/g, " ").toLowerCase();
}

/**
 * Re-checks target ordering — bands must get harder from Poor through to
 * Excellent. Throws a readable message rather than returning one, since it is
 * only ever called right before a write, where a thrown error is what the
 * server action's `attempt` wrapper expects.
 */
export function validateMetric(metric: MetricInput): MetricInput {
  if (metric.kind !== "FIXED" && metric.kind !== "RANGE") return metric;

  const config = metric.kind === "FIXED" ? metric.bands : metric.bands;
  const issue = orderingIssue(
    config as Record<Band, number | [number, number]>,
    metric.kind,
    metric.direction
  );
  if (issue) throw new Error(issue.charAt(0).toUpperCase() + issue.slice(1));
  return metric;
}

/**
 * The only function allowed to produce the four database columns a KPI's
 * metric definition lives in. Always returns all four together, so they can
 * never disagree with one another.
 */
export function metricColumns(metric: MetricInput): {
  metricType: MetricType | null;
  targetMode: TargetMode | null;
  direction: Direction | null;
  targetConfig: string | null;
} {
  switch (metric.kind) {
    case "NONE":
      return { metricType: null, targetMode: null, direction: null, targetConfig: null };
    case "MONTH":
      return {
        metricType: "MONTH_COMPLETION",
        targetMode: null,
        direction: null,
        targetConfig: JSON.stringify({ targetMonth: metric.targetMonth }),
      };
    case "FIXED":
      return {
        metricType: metric.metricType,
        targetMode: "FIXED",
        direction: metric.direction,
        targetConfig: JSON.stringify(metric.bands),
      };
    case "RANGE":
      return {
        metricType: metric.metricType,
        targetMode: "RANGE",
        direction: metric.direction,
        targetConfig: JSON.stringify(metric.bands),
      };
  }
}

/**
 * Whether switching `from` to `to` orphans data already recorded: the only
 * transition that truly does is numeric <-> month-completion, since a numeric
 * KPI stores a value and a month-completion KPI stores a completion date, and
 * neither is readable as the other. Every other change — target mode,
 * direction, target values, or between numeric metric types — leaves a
 * recorded figure meaning exactly what it meant before.
 */
export function crossesNumericMonthBoundary(
  from: MetricType | null,
  to: MetricType | null
): boolean {
  const wasNumeric = from !== null && from !== "MONTH_COMPLETION";
  const willBeNumeric = to !== null && to !== "MONTH_COMPLETION";
  const wasMonth = from === "MONTH_COMPLETION";
  const willBeMonth = to === "MONTH_COMPLETION";
  return (wasNumeric && willBeMonth) || (wasMonth && willBeNumeric);
}
