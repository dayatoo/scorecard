// Turns flat KPI rows plus their recorded values into a scored hierarchy.
//
// Weights are local: every node's stored weight is its share of its own
// siblings, summing to 100 within each group (roots included). A node's
// *global* weight — its share of the whole company — is derived top-down:
// globalOf(node) = globalOf(parent) x node.weight / sum(siblings' weight),
// with roots scaled to sum to 100. The scoring engine itself needs no
// awareness of this: rollup() has only ever cared about ratios within a
// group, so local and global weights score identically.

import {
  bandForScore,
  roundScore,
  rollup,
  scoreLeaf,
  type Band,
  type Direction,
  type Entry,
  type Frequency,
  type KpiDefinition,
  type LeafScore,
  type MetricType,
  type Phasing,
  type Rollup,
  type TargetConfig,
  type TargetMode,
} from "./scoring";

export type KpiRecord = {
  id: string;
  code: string;
  name: string;
  /** Purely organizational — clusters siblings for display, no scoring effect. */
  subGroup?: string | null;
  /** Free text, suggested from a reusable company-wide list. No scoring effect. */
  status?: string | null;
  parentId: string | null;
  sortOrder: number;
  /** Local weight — this node's share of its own siblings. */
  weight: number;
  /** Defaults applied where absent, so a caller building a synthetic record (e.g. an import preview) need not set these. */
  frequency?: Frequency;
  phasing?: Phasing;
  phaseConfig?: string | null;
  metricType: MetricType | null;
  direction: Direction | null;
  targetMode: TargetMode | null;
  targetConfig: string | null;
  unit: string | null;
  deadlineMonth: string | null;
  scoreFinalAfterDeadline: boolean;
  departments: { id: string; name: string }[];
};

/** A manual score calibration for one KPI in one period. Keyed by kpiId; a KPI may carry several, one per period. */
export type ScoreOverrideRecord = {
  period: string;
  score: number;
  reason: string;
  byUsername: string;
  createdAt: Date;
};

export function parsePhaseConfig(raw: string | null): number[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as number[]) : null;
  } catch {
    return null;
  }
}

export type ValueRecord = {
  kpiId: string;
  period: string;
  value: number | null;
  basis: "ACTUAL" | "ESTIMATE";
  completionDate: Date | null;
  note: string | null;
  /** VARIANCE metrics only — the period's target/budget figure. */
  plannedValue?: number | null;
};

/** A KPI plus its computed score for one period, and its children. */
export type ScoredNode = {
  id: string;
  code: string;
  name: string;
  /** Purely organizational — clusters siblings for display, no scoring effect. */
  subGroup: string | null;
  /** Free text, suggested from a reusable company-wide list. No scoring effect. */
  status: string | null;
  level: number;
  isLeaf: boolean;
  /** Local weight: this node's share of its own siblings (sums to ~100 per group). */
  weight: number;
  /** Derived, read-only: this node's share of the whole company (roots sum to 100). */
  globalWeight: number;
  frequency: Frequency;
  phasing: Phasing;
  phaseConfig: number[] | null;
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
  /** Share of this node's *due* weight that has a figure behind it, 0..1. */
  coverage: number;
  /** Absolute (local-scale) weight beneath this node that produced a score. */
  scoredWeight: number;
  /** Absolute weight beneath this node whose score rests on an estimate. */
  provisionalWeight: number;
  /** Absolute weight beneath this node that is not yet due to be reported. */
  notYetDueWeight: number;
  /** Absolute weight beneath this node whose score rests on a phased target. */
  proratedWeight: number;
  /** Share of this node's total weight not yet due, 0..1. */
  notYetDueShare: number;
  /** Share of this node's total weight that is pro-rated, 0..1. */
  proratedShare: number;
  /** True when any of this node's score rests on an estimate. */
  provisional: boolean;
  /** True when any of this node's score rests on a phased (pro-rated) target. */
  prorated: boolean;
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
    frequency: kpi.frequency ?? "MONTHLY",
    phasing: kpi.phasing ?? "NONE",
    phaseConfig: parsePhaseConfig(kpi.phaseConfig ?? null),
  };
}

/** A sibling group's local weight total, guarding against a group of zeros. */
export function groupTotal(kids: KpiRecord[]): number {
  const total = kids.reduce((sum, k) => sum + Math.max(0, k.weight), 0);
  return total > 0 ? total : 1;
}

/**
 * Builds the scored tree for one period.
 *
 * Leaves are scored from their entries; parents are rolled up depth-first so a
 * fifth-level score reaches the Strategic Goal correctly. Coverage is tracked
 * against *due* weight (total minus not-yet-due), so a parent whose children
 * are half-reported reads "50% scored" rather than silently looking complete,
 * and a milestone or annual KPI that isn't due yet doesn't read as a gap.
 *
 * Global weight (each node's share of the whole company) is derived top-down
 * alongside the bottom-up score rollup, from the locally-stored weights.
 */
export function buildScoredTree(
  kpis: KpiRecord[],
  values: ValueRecord[],
  period: string,
  overrides?: Map<string, ScoreOverrideRecord[]>
): { roots: ScoredNode[]; total: Rollup; byId: Map<string, ScoredNode> } {
  const entriesByKpi = new Map<string, Entry[]>();
  for (const v of values) {
    const list = entriesByKpi.get(v.kpiId) ?? [];
    list.push({
      period: v.period,
      value: v.value,
      basis: v.basis,
      completionDate: v.completionDate,
      plannedValue: v.plannedValue,
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

  const build = (kpi: KpiRecord, level: number, globalWeight: number): ScoredNode => {
    const kids = childrenOf.get(kpi.id) ?? [];
    const isLeaf = kids.length === 0;

    const node: ScoredNode = {
      id: kpi.id,
      code: kpi.code,
      name: kpi.name,
      subGroup: kpi.subGroup ?? null,
      status: kpi.status ?? null,
      level,
      isLeaf,
      weight: kpi.weight,
      globalWeight,
      frequency: kpi.frequency ?? "MONTHLY",
      phasing: kpi.phasing ?? "NONE",
      phaseConfig: parsePhaseConfig(kpi.phaseConfig ?? null),
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
      notYetDueWeight: 0,
      proratedWeight: 0,
      notYetDueShare: 0,
      proratedShare: 0,
      provisional: false,
      prorated: false,
      leaf: null,
    };

    if (isLeaf) {
      let leaf = scoreLeaf(toDefinition(kpi), entriesByKpi.get(kpi.id) ?? [], period);

      // A calibrated score replaces the computed score/band for display and
      // for every rollup above it — the reported value/basis are left
      // untouched, so the real figure stays visible alongside the
      // calibration. pendingReason is cleared too: a calibrated score is a
      // real score now, so it must not also still read as "not yet due" or
      // "no data" (which would double-count it against coverage).
      const override = overrides?.get(kpi.id)?.find((o) => o.period === period);
      if (override) {
        const score = roundScore(override.score);
        leaf = {
          ...leaf,
          score,
          band: bandForScore(score),
          pendingReason: null,
          override: {
            score,
            reason: override.reason,
            byUsername: override.byUsername,
            createdAt: override.createdAt.toISOString(),
          },
        };
      }

      const scored = leaf.score !== null;
      const notYetDue = leaf.pendingReason === "NOT_YET_DUE";
      node.leaf = leaf;
      node.score = leaf.score;
      node.exactScore = leaf.score;
      node.band = leaf.band;
      node.provisional = leaf.provisional;
      node.prorated = leaf.prorated;
      node.scoredWeight = scored ? kpi.weight : 0;
      node.provisionalWeight = scored && leaf.provisional ? kpi.weight : 0;
      node.proratedWeight = scored && leaf.prorated ? kpi.weight : 0;
      node.notYetDueWeight = notYetDue ? kpi.weight : 0;
      const dueWeight = Math.max(0, kpi.weight - node.notYetDueWeight);
      node.coverage = dueWeight > 0 ? node.scoredWeight / dueWeight : 0;
      node.notYetDueShare = kpi.weight > 0 ? node.notYetDueWeight / kpi.weight : 0;
      node.proratedShare = kpi.weight > 0 ? node.proratedWeight / kpi.weight : 0;
    } else {
      const total = groupTotal(kids);
      node.children = kids.map((child) =>
        build(child, level + 1, (globalWeight * child.weight) / total)
      );
      // Ratios within a sibling group are identical whether weighted by local
      // or global weight — a common scale factor cancels — so the rollup here
      // uses each child's own (local) weight, the same field looked up for
      // every other node. The result is only ever used within this group; a
      // further rollup looks up this node's *own* local weight, not this sum.
      const result = rollup(node.children.map(toRollupInput));
      node.score = result.score;
      node.exactScore = result.exactScore;
      node.band = result.band;
      node.coverage = result.coverage;
      // result.scoredWeight etc. are absolute quantities on the scale of this
      // node's own children (which sum to result.totalWeight, ~100 by
      // convention) — not this node's own local weight among its *siblings*
      // (node.weight, e.g. 70). A grandparent's rollup reads node.weight
      // alongside these fields via toRollupInput, so they must share a scale:
      // rescale each from "share of this node's own subtree" to "share of
      // this node's own weight" before exposing it upward. Left unscaled, a
      // sibling group with a nested rollup branch would sum to more than its
      // own group's weight — inflating coverage past 100% and over-weighting
      // that branch in the parent's weighted average.
      const rescale = (value: number) =>
        result.totalWeight > 0 ? (value / result.totalWeight) * node.weight : 0;
      node.scoredWeight = rescale(result.scoredWeight);
      node.provisionalWeight = rescale(result.provisionalWeight);
      node.notYetDueWeight = rescale(result.notYetDueWeight);
      node.proratedWeight = rescale(result.proratedWeight);
      node.notYetDueShare = result.notYetDueShare;
      node.proratedShare = result.proratedShare;
      // A parent is provisional/prorated if any scored weight beneath it is.
      node.provisional = result.provisionalWeight > 0;
      node.prorated = result.proratedWeight > 0;
    }

    byId.set(node.id, node);
    return node;
  };

  const rootsTotal = groupTotal(childrenOf.get(null) ?? []);
  const roots = (childrenOf.get(null) ?? []).map((kpi) =>
    build(kpi, 1, (100 * kpi.weight) / rootsTotal)
  );

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
    notYetDueWeight: node.notYetDueWeight,
    proratedWeight: node.proratedWeight,
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

/** The structural fields of a scored tree, with none of the scoring. */
export type HierarchyNode = {
  id: string;
  code: string;
  name: string;
  /** Purely organizational — clusters siblings for display, no scoring effect. */
  subGroup: string | null;
  level: number;
  parentId: string | null;
  isLeaf: boolean;
  weight: number;
  globalWeight: number;
};

/**
 * Level, leaf-ness and global weight are all derived purely from a KPI's
 * position in the hierarchy and its local weight — buildScoredTree computes
 * them as a side effect of scoring, but a caller that only wants the
 * structure (the hierarchy editor, in particular) shouldn't have to pay for
 * the scoring engine to get them. Same shape and numbers as the equivalent
 * fields on ScoredNode, computed the same way (see groupTotal above), just
 * without a values array, an entriesByKpi map, or a rollup to build.
 */
export function buildHierarchyTree(kpis: KpiRecord[]): HierarchyNode[] {
  const childrenOf = new Map<string | null, KpiRecord[]>();
  for (const kpi of kpis) {
    const list = childrenOf.get(kpi.parentId) ?? [];
    list.push(kpi);
    childrenOf.set(kpi.parentId, list);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  }

  const out: HierarchyNode[] = [];
  const walk = (kpi: KpiRecord, level: number, globalWeight: number) => {
    const kids = childrenOf.get(kpi.id) ?? [];
    out.push({
      id: kpi.id,
      code: kpi.code,
      name: kpi.name,
      subGroup: kpi.subGroup ?? null,
      level,
      parentId: kpi.parentId,
      isLeaf: kids.length === 0,
      weight: kpi.weight,
      globalWeight,
    });
    const total = groupTotal(kids);
    for (const child of kids) walk(child, level + 1, (globalWeight * child.weight) / total);
  };

  const rootsTotal = groupTotal(childrenOf.get(null) ?? []);
  for (const kpi of childrenOf.get(null) ?? []) {
    walk(kpi, 1, (100 * kpi.weight) / rootsTotal);
  }
  return out;
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
