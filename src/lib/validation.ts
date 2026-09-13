// Structural checks on a fiscal year's KPI hierarchy.
//
// These surface as warnings rather than hard blocks: a half-built scorecard
// should still be usable, and the person filling it in needs to see what is
// still wrong rather than be locked out.

import { BANDS, type Band, type Direction, type TargetMode } from "./scoring";
import type { KpiRecord } from "./kpi-tree";
import { parseTargetConfig } from "./kpi-tree";

export type Issue = {
  severity: "error" | "warning";
  /** The KPI this concerns, when it concerns one in particular. */
  kpiCode?: string;
  message: string;
};

const WEIGHT_TOLERANCE = 0.01;

/**
 * Every sibling group (roots included) must add to 100%, since a weight is
 * now a share of its own siblings. Checked to two decimal places so ordinary
 * rounding in a spreadsheet (33.33 x 3) does not read as an error.
 *
 * This is a warning, never a block: a group is legitimately incomplete while
 * it is being built up one KPI at a time, and scoring normalises within the
 * group regardless — the message says so, since that is the counter-intuitive
 * part. A group that doesn't sum to 100 does not lose the missing share; the
 * parent's own weight is always fully distributed across whichever children
 * it has.
 */
export function checkWeights(kpis: KpiRecord[]): Issue[] {
  const byParent = new Map<string | null, KpiRecord[]>();
  for (const kpi of kpis) {
    const list = byParent.get(kpi.parentId) ?? [];
    list.push(kpi);
    byParent.set(kpi.parentId, list);
  }

  const issues: Issue[] = [];
  for (const [parentId, group] of byParent) {
    const total = group.reduce((sum, k) => sum + k.weight, 0);
    if (Math.abs(total - 100) <= WEIGHT_TOLERANCE) continue;

    const parent = parentId ? kpis.find((k) => k.id === parentId) : null;
    const groupName = parent ? `The sub-KPIs under "${parent.name}"` : "The Strategic Goals";
    issues.push({
      severity: "warning",
      kpiCode: parent?.code,
      message: `${groupName} add up to ${total.toFixed(2)}%, not 100%. Their shares are applied proportionally, so scoring still works, but each one's influence may not be what you intended.`,
    });
  }
  return issues;
}

/** A node with no weight can never affect its parent's score, which is usually a mistake. */
export function checkZeroWeights(kpis: KpiRecord[]): Issue[] {
  return kpis
    .filter((k) => k.weight <= 0)
    .map((k) => ({
      severity: "warning" as const,
      kpiCode: k.code,
      message: `"${k.name}" has no weight, so it does not contribute to any score.`,
    }));
}

/**
 * Fixed and range targets must be ordered consistently with the KPI's
 * direction: strictly improving from Poor through to Excellent. An out-of-order
 * target silently mis-scores every month, so it is an error rather than a
 * warning.
 */
export function checkTargetOrder(kpis: KpiRecord[]): Issue[] {
  const issues: Issue[] = [];
  const parentIds = new Set(kpis.map((k) => k.parentId).filter(Boolean));

  for (const kpi of kpis) {
    if (parentIds.has(kpi.id)) continue;
    if (kpi.metricType === "MONTH_COMPLETION") {
      const config = parseTargetConfig(kpi.targetConfig) as { targetMonth?: string } | null;
      if (!config?.targetMonth || !/^\d{4}-\d{2}$/.test(config.targetMonth)) {
        issues.push({
          severity: "error",
          kpiCode: kpi.code,
          message: `"${kpi.name}" needs a target month in YYYY-MM form.`,
        });
      }
      continue;
    }

    if (!kpi.metricType || !kpi.direction || !kpi.targetMode) {
      issues.push({
        severity: "error",
        kpiCode: kpi.code,
        message: `"${kpi.name}" is missing its metric type, direction or target mode.`,
      });
      continue;
    }

    const config = parseTargetConfig(kpi.targetConfig);
    if (!config) {
      issues.push({
        severity: "error",
        kpiCode: kpi.code,
        message: `"${kpi.name}" has no targets set.`,
      });
      continue;
    }

    const ordering = orderingIssue(
      config as Record<Band, number | [number, number]>,
      kpi.targetMode,
      kpi.direction
    );
    if (ordering) {
      issues.push({ severity: "error", kpiCode: kpi.code, message: `"${kpi.name}": ${ordering}` });
    }
  }

  return issues;
}

export function orderingIssue(
  config: Record<Band, number | [number, number]>,
  mode: TargetMode,
  direction: Direction
): string | null {
  // Reduce each band to the single value that has to improve band over band:
  // its target for a fixed mode, its best edge for a range.
  const points: number[] = [];
  for (const band of BANDS) {
    const raw = config[band];
    if (raw === undefined || raw === null) return `no target set for ${band}.`;
    if (mode === "FIXED") {
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        return `the ${band} target is not a number.`;
      }
      points.push(raw);
    } else {
      if (!Array.isArray(raw) || raw.length !== 2 || raw.some((n) => !Number.isFinite(n))) {
        return `the ${band} range needs two numbers.`;
      }
      points.push(direction === "HIGHER_BETTER" ? Math.max(raw[0], raw[1]) : Math.min(raw[0], raw[1]));
    }
  }

  for (let i = 1; i < points.length; i++) {
    const improving = direction === "HIGHER_BETTER" ? points[i] > points[i - 1] : points[i] < points[i - 1];
    if (!improving) {
      return `the ${BANDS[i]} target (${points[i]}) is not ${
        direction === "HIGHER_BETTER" ? "higher" : "lower"
      } than ${BANDS[i - 1]} (${points[i - 1]}). Targets must get harder from Poor through to Excellent.`;
    }
  }
  return null;
}

/** A parent that also carries a metric would have its metric silently ignored. */
export function checkParentsHaveNoMetric(kpis: KpiRecord[]): Issue[] {
  const parentIds = new Set(kpis.map((k) => k.parentId).filter(Boolean));
  return kpis
    .filter((k) => parentIds.has(k.id) && k.metricType !== null)
    .map((k) => ({
      severity: "warning" as const,
      kpiCode: k.code,
      message: `"${k.name}" has sub-KPIs, so its own metric is ignored — its score is the weighted average of its children.`,
    }));
}

/** A cycle would make the tree infinite; the importer must reject one outright. */
export function checkNoCycles(kpis: KpiRecord[]): Issue[] {
  const byId = new Map(kpis.map((k) => [k.id, k]));
  for (const kpi of kpis) {
    const seen = new Set<string>([kpi.id]);
    let current = kpi.parentId ? byId.get(kpi.parentId) : undefined;
    while (current) {
      if (seen.has(current.id)) {
        return [
          {
            severity: "error",
            kpiCode: kpi.code,
            message: `"${kpi.name}" is its own ancestor — the hierarchy contains a loop.`,
          },
        ];
      }
      seen.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }
  return [];
}

/** The scorecard is designed for five levels; deeper than that is usually a mistake. */
export const MAX_KPI_DEPTH = 5;

export function checkDepth(kpis: KpiRecord[], maxDepth = MAX_KPI_DEPTH): Issue[] {
  const byId = new Map(kpis.map((k) => [k.id, k]));
  const issues: Issue[] = [];
  for (const kpi of kpis) {
    let depth = 1;
    let current = kpi.parentId ? byId.get(kpi.parentId) : undefined;
    while (current && depth <= maxDepth + 1) {
      depth++;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    if (depth > maxDepth) {
      issues.push({
        severity: "warning",
        kpiCode: kpi.code,
        message: `"${kpi.name}" sits ${depth} levels deep; the scorecard is designed for ${maxDepth}.`,
      });
    }
  }
  return issues;
}

export function validateHierarchy(kpis: KpiRecord[]): Issue[] {
  return [
    ...checkNoCycles(kpis),
    ...checkWeights(kpis),
    ...checkZeroWeights(kpis),
    ...checkTargetOrder(kpis),
    ...checkParentsHaveNoMetric(kpis),
    ...checkDepth(kpis),
  ];
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
