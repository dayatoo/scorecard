import type { Kpi, KpiValue } from "@prisma/client";
import {
  scoreLeafKpi,
  rollupScores,
  type Direction,
  type TargetMode,
  type LeafMetricType,
  type FixedTargetConfig,
  type RangeTargetConfig,
  type MonthTargetConfig,
} from "./scoring";

export type TargetConfig = FixedTargetConfig | RangeTargetConfig | MonthTargetConfig;

export type KpiNode = Omit<Kpi, "targetConfig" | "metricType" | "direction" | "targetMode"> & {
  metricType: LeafMetricType | null;
  direction: Direction | null;
  targetMode: TargetMode | null;
  targetConfig: TargetConfig | null;
  children: KpiNode[];
};

export function parseTargetConfig(raw: string | null): TargetConfig | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TargetConfig;
  } catch {
    return null;
  }
}

export function buildTree(flat: Kpi[]): KpiNode[] {
  const nodes = new Map<string, KpiNode>();
  for (const k of flat) {
    nodes.set(k.id, {
      ...k,
      metricType: k.metricType as LeafMetricType | null,
      direction: k.direction as Direction | null,
      targetMode: k.targetMode as TargetMode | null,
      targetConfig: parseTargetConfig(k.targetConfig),
      children: [],
    });
  }
  const roots: KpiNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId) {
      const parent = nodes.get(node.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (list: KpiNode[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    for (const n of list) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

export type ValueLookup = Map<string, Map<string, KpiValue>>; // kpiId -> period -> value

export function buildValueLookup(values: KpiValue[]): ValueLookup {
  const map: ValueLookup = new Map();
  for (const v of values) {
    if (!map.has(v.kpiId)) map.set(v.kpiId, new Map());
    map.get(v.kpiId)!.set(v.period, v);
  }
  return map;
}

/** Compute the score of a node (and, as a side effect of recursion, its descendants) for one period. */
export function scoreNodeForPeriod(
  node: KpiNode,
  period: string,
  lookup: ValueLookup
): number | null {
  if (node.children.length === 0) {
    if (!node.metricType) return null;
    const entry = lookup.get(node.id)?.get(period) ?? null;
    return scoreLeafKpi({
      metricType: node.metricType,
      direction: node.direction,
      targetMode: node.targetMode,
      targetConfig: node.targetConfig as FixedTargetConfig | RangeTargetConfig | MonthTargetConfig,
      value: entry?.value ?? null,
      completionDate: entry?.completionDate ?? null,
    });
  }
  const childScores = node.children.map((c) => ({
    score: scoreNodeForPeriod(c, period, lookup),
    weight: c.weight,
  }));
  return rollupScores(childScores);
}

/** Returns `count` periods as "YYYY-MM" strings, oldest first, ending at `endPeriod` (inclusive). */
export function recentPeriods(endPeriod: string, count: number): string[] {
  const [y, m] = endPeriod.split("-").map(Number);
  const periods: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const total = y * 12 + (m - 1) - i;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    periods.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return periods;
}

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function flattenTree(nodes: KpiNode[]): KpiNode[] {
  const out: KpiNode[] = [];
  const walk = (list: KpiNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}
