// Turns flat KPI rows plus their recorded values into a scored hierarchy.
//
// Weights are global: every leaf carries its own share of the company's 100%.
// A parent's weight is therefore not stored but derived — the sum of its
// descendant leaves — which keeps a parent's rollup consistent with the total
// no matter how deep the tree goes.

import {
  bandForScore,
  rollup,
  scoreLeaf,
  type Band,
  type Direction,
  type Entry,
  type KpiDefinition,
  type LeafScore,
  type MetricType,
  type Rollup,
  type TargetConfig,
  type TargetMode,
} from "./scoring";

export type KpiRecord = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  weight: number;
  metricType: MetricType | null;
  direction: Direction | null;
  targetMode: TargetMode | null;
  targetConfig: string | null;
  unit: string | null;
  deadlineMonth: string | null;
  scoreFinalAfterDeadline: boolean;
  departments: { id: string; name: string }[];
};

export type ValueRecord = {
  kpiId: string;
  period: string;
  value: number | null;
  basis: "ACTUAL" | "ESTIMATE";
  completionDate: Date | null;
  note: string | null;
};

/** A KPI plus its computed score for one period, and its children. */
export type ScoredNode = {
  id: string;
  code: string;
  name: string;
  level: number;
  isLeaf: boolean;
  /** Global weight: stored for leaves, summed from descendants for parents. */
  weight: number;
  metricType: MetricType | null;
  direction: Direction | null;
  targetMode: TargetMode | null;
  targetConfig: TargetConfig | null;
  unit: string | null;
  deadlineMonth: string | null;
  scoreFinalAfterDeadline: boolean;
  departments: { id: string; name: string }[];
  parentId: string | null;
  children: ScoredNode[];
  /** Score for the requested period, with band and provenance. */
  score: number | null;
  /** The same score before rounding, used when rolling up further. */
  exactScore: number | null;
  band: Band | null;
  /** Share of this node's weight that has a figure behind it, 0..1. */
  coverage: number;
  /** Absolute weight beneath this node that produced a score. */
  scoredWeight: number;
  /** Absolute weight beneath this node whose score rests on an estimate. */
  provisionalWeight: number;
  /** True when any of this node's score rests on an estimate. */
  provisional: boolean;
  /** Leaf detail — null on rollup nodes. */
  leaf: LeafScore | null;
};

export function parseTargetConfig(raw: string | null): TargetConfig | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TargetConfig;
  } catch {
    return null;
  }
}

function toDefinition(kpi: KpiRecord): KpiDefinition {
  return {
    metricType: kpi.metricType as MetricType,
    direction: kpi.direction,
    targetMode: kpi.targetMode,
    targetConfig: parseTargetConfig(kpi.targetConfig),
    deadlineMonth: kpi.deadlineMonth,
    scoreFinalAfterDeadline: kpi.scoreFinalAfterDeadline,
  };
}

/**
 * Builds the scored tree for one period.
 *
 * Leaves are scored from their entries; parents are rolled up depth-first so a
 * fourth-level score reaches the Strategic Goal correctly. Coverage is tracked
 * against *total* weight, so a parent whose children are half-reported reads
 * "50% scored" rather than silently looking complete.
 */
export function buildScoredTree(
  kpis: KpiRecord[],
  values: ValueRecord[],
  period: string
): { roots: ScoredNode[]; total: Rollup; byId: Map<string, ScoredNode> } {
  const entriesByKpi = new Map<string, Entry[]>();
  for (const v of values) {
    const list = entriesByKpi.get(v.kpiId) ?? [];
    list.push({
      period: v.period,
      value: v.value,
      basis: v.basis,
      completionDate: v.completionDate,
    });
    entriesByKpi.set(v.kpiId, list);
  }

  const childrenOf = new Map<string | null, KpiRecord[]>();
  for (const kpi of kpis) {
    const list = childrenOf.get(kpi.parentId) ?? [];
    list.push(kpi);
    childrenOf.set(kpi.parentId, list);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  }

  const byId = new Map<string, ScoredNode>();

  const build = (kpi: KpiRecord, level: number): ScoredNode => {
    const kids = childrenOf.get(kpi.id) ?? [];
    const isLeaf = kids.length === 0;

    const node: ScoredNode = {
      id: kpi.id,
      code: kpi.code,
      name: kpi.name,
      level,
      isLeaf,
      weight: 0,
      metricType: kpi.metricType,
      direction: kpi.direction,
      targetMode: kpi.targetMode,
      targetConfig: parseTargetConfig(kpi.targetConfig),
      unit: kpi.unit,
      deadlineMonth: kpi.deadlineMonth,
      scoreFinalAfterDeadline: kpi.scoreFinalAfterDeadline,
      departments: kpi.departments,
      parentId: kpi.parentId,
      children: [],
      score: null,
      exactScore: null,
      band: null,
      coverage: 0,
      scoredWeight: 0,
      provisionalWeight: 0,
      provisional: false,
      leaf: null,
    };

    if (isLeaf) {
      const leaf = scoreLeaf(toDefinition(kpi), entriesByKpi.get(kpi.id) ?? [], period);
      const scored = leaf.score !== null;
      node.weight = kpi.weight;
      node.leaf = leaf;
      node.score = leaf.score;
      node.exactScore = leaf.score;
      node.band = leaf.band;
      node.provisional = leaf.provisional;
      node.scoredWeight = scored ? kpi.weight : 0;
      node.provisionalWeight = scored && leaf.provisional ? kpi.weight : 0;
      node.coverage = scored ? 1 : 0;
    } else {
      node.children = kids.map((child) => build(child, level + 1));
      const result = rollup(node.children.map(toRollupInput));
      node.weight = result.totalWeight;
      node.score = result.score;
      node.exactScore = result.exactScore;
      node.band = result.band;
      node.coverage = result.coverage;
      node.scoredWeight = result.scoredWeight;
      node.provisionalWeight = result.provisionalWeight;
      // A parent is provisional if any scored weight beneath it is.
      node.provisional = result.provisionalWeight > 0;
    }

    byId.set(node.id, node);
    return node;
  };

  const roots = (childrenOf.get(null) ?? []).map((kpi) => build(kpi, 1));

  const total = rollup(roots.map(toRollupInput));

  return { roots, total, byId };
}

/** A scored node as the rollup function wants to see it. */
function toRollupInput(node: ScoredNode) {
  return {
    score: node.score,
    exactScore: node.exactScore,
    weight: node.weight,
    scoredWeight: node.scoredWeight,
    provisionalWeight: node.provisionalWeight,
  };
}

/** Every node of the tree, depth-first — the order they should be listed in. */
export function flattenTree(roots: ScoredNode[]): ScoredNode[] {
  const out: ScoredNode[] = [];
  const walk = (node: ScoredNode) => {
    out.push(node);
    node.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}

export function leavesOf(roots: ScoredNode[]): ScoredNode[] {
  return flattenTree(roots).filter((n) => n.isLeaf);
}

/** The chain of ancestors from the Strategic Goal down to (not including) `node`. */
export function ancestorsOf(node: ScoredNode, byId: Map<string, ScoredNode>): ScoredNode[] {
  const chain: ScoredNode[] = [];
  let current = node.parentId ? byId.get(node.parentId) : undefined;
  while (current) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

/** The Strategic Goal a node belongs to (itself, if it is one). */
export function strategicGoalOf(
  node: ScoredNode,
  byId: Map<string, ScoredNode>
): ScoredNode {
  const chain = ancestorsOf(node, byId);
  return chain[0] ?? node;
}

/** Weighted average across a set of already-scored nodes, e.g. one department. */
export function rollupNodes(nodes: ScoredNode[]): Rollup {
  return rollup(nodes.map(toRollupInput));
}

export { bandForScore };
