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

import { formatPeriodLabel } from "./fiscal";
import { BANDS, shiftPeriod, type Band, type Direction, type MetricType, type TargetMode } from "./scoring";
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

/**
 * "50-69", "50 – 69", "50 to 69" — or a bare number ("100", "$100", "100%"),
 * accepted as shorthand for an exact target: a single-point window `[n, n]`.
 * `scoreRangeTarget` already scores a degenerate window like this as reaching
 * that band outright, including any value beyond it, so no scoring-side
 * change is needed for this shorthand to behave like an absolute target.
 */
export function parseRangeInput(text: string): [number, number] | null {
  const cleaned = text.replace(/\s*(?:to|–|—)\s*/gi, "-").trim();
  const match = cleaned.match(/^(-?[\d.]+)\s*-\s*(-?[\d.]+)$/);
  if (match) {
    const lo = Number(match[1]);
    const hi = Number(match[2]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    return [lo, hi];
  }
  const single = parseNumberInput(text);
  return single === null ? null : [single, single];
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
    draft.targets[band] = Array.isArray(value)
      ? value[0] === value[1]
        ? String(value[0])
        : `${value[0]}-${value[1]}`
      : String(value);
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

  const metricType = draft.metricType as NumericMetricType;

  // VARIANCE is always scored as a symmetric %-deviation window — direction
  // and target mode aren't meaningful choices for it (there's no "higher is
  // better" for a variance, and a variance target is always a window, never
  // a single point), so they're forced here regardless of what the draft (a
  // stale form, say) carries, rather than asked for.
  if (metricType === "VARIANCE") {
    const bands = {} as Record<Band, [number, number]>;
    for (const band of BANDS) {
      const range = parseRangeInput(draft.targets[band] ?? "");
      if (!range) {
        return { ok: false, error: `The ${bandName(band)} variance window should look like "10-15".` };
      }
      bands[band] = range;
    }
    return { ok: true, metric: { kind: "RANGE", metricType, direction: "LOWER_BETTER", bands } };
  }

  if (!draft.direction) return { ok: false, error: "Choose a direction — higher or lower is better." };
  if (!draft.targetMode) return { ok: false, error: "Choose a target mode — fixed or range." };

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

/** A milestone's band ladder (see `scoreMonthCompletion`): each band away
 *  from MEET is one calendar month away from the target month, with
 *  EXCELLENT and POOR left open-ended since they cover every month beyond
 *  the ladder's ends, not just one. */
const MILESTONE_BAND_OFFSET: Record<Band, number> = {
  EXCELLENT: -3,
  VERY_GOOD: -2,
  GOOD: -1,
  MEET: 0,
  IMPROVEMENT_NEEDED: 1,
  POOR: 2,
};

/**
 * "What am I being measured against" in one short string, for any one band —
 * a milestone's target month, shifted to that band's rung on the completion
 * ladder (EXCELLENT/POOR read as open-ended, since they cover every month
 * beyond the ladder's ends), or that band's number or range. Used wherever a
 * KPI is listed alongside its score, so its targets are visible without
 * opening it. `null` for a rollup (no metric) or a KPI with no target set yet.
 */
export function describeBandTarget(config: unknown, metricType: MetricType | null, band: Band): string | null {
  if (!config || typeof config !== "object") return null;

  if (metricType === "MONTH_COMPLETION") {
    const month = (config as { targetMonth?: string }).targetMonth;
    if (!month) return null;
    const target = shiftPeriod(month, MILESTONE_BAND_OFFSET[band]);
    if (band === "EXCELLENT") return `${formatPeriodLabel(target)} or earlier`;
    if (band === "POOR") return `${formatPeriodLabel(target)} or later`;
    return formatPeriodLabel(target);
  }

  const value = (config as Record<string, unknown>)[band];
  if (typeof value === "number") return value.toLocaleString();
  if (Array.isArray(value) && value.length === 2) {
    return value[0] === value[1] ? value[0].toLocaleString() : `${value[0]}–${value[1]}`;
  }
  return null;
}

/** The Meet band's target specifically — see `describeBandTarget`. */
export function describeMeetTarget(config: unknown, metricType: MetricType | null): string | null {
  return describeBandTarget(config, metricType, "MEET");
}
