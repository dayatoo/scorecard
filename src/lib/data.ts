// Server-side data access. Every page reads the scorecard through here, so the
// shape of a "scorecard" is defined once rather than reassembled per route.

import "server-only";

import { prisma } from "./prisma";
import {
  currentPeriod,
  fiscalYearLabel,
  fiscalYearOfPeriod,
  periodsOfFiscalYear,
  trailingPeriods,
} from "./fiscal";
import {
  buildHierarchyTree,
  buildScoredTree,
  flattenTree,
  type HierarchyNode,
  type KpiRecord,
  type ScoredNode,
  type ScoreOverrideRecord,
  type ValueRecord,
} from "./kpi-tree";
import { validateHierarchy, type Issue } from "./validation";
import type { Band, Rollup } from "./scoring";

export type PeriodScores = Map<
  string,
  {
    score: number | null;
    band: Band | null;
    coverage: number;
    provisional: boolean;
    prorated: boolean;
    notYetDueShare: number;
  }
>;

export type Scorecard = {
  fiscalYear: { id: string; startYear: number; label: string; closedAt: string | null };
  /** The month being reported on. */
  period: string;
  /** That month plus up to three before it, oldest first. */
  periods: string[];
  roots: ScoredNode[];
  byId: Map<string, ScoredNode>;
  total: Rollup;
  /** Per-period lookups, for the trailing-months columns. */
  scoresByPeriod: Map<string, PeriodScores>;
  totalsByPeriod: Map<string, Rollup>;
  departments: { id: string; name: string }[];
  issues: Issue[];
  kpiRecords: KpiRecord[];
  values: ValueRecord[];
  overrides: Map<string, ScoreOverrideRecord[]>;
};

/** The year marked active, else the most recent one. */
export async function getActiveFiscalYear() {
  return (
    (await prisma.fiscalYear.findFirst({ where: { isActive: true } })) ??
    (await prisma.fiscalYear.findFirst({ orderBy: { startYear: "desc" } }))
  );
}

export async function listFiscalYears() {
  return prisma.fiscalYear.findMany({ orderBy: { startYear: "desc" } });
}

export async function listDepartments() {
  return prisma.department.findMany({ orderBy: { name: "asc" } });
}

/** Every Status value ever saved on a KPI, for the Status field's suggestion list. */
export async function listStatusOptions(): Promise<string[]> {
  const options = await prisma.kpiStatusOption.findMany({ orderBy: { name: "asc" } });
  return options.map((o) => o.name);
}

export async function loadKpiRecords(fiscalYearId: string): Promise<KpiRecord[]> {
  const rows = await prisma.kpi.findMany({
    where: { fiscalYearId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    include: { departments: { include: { department: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    subGroup: row.subGroup,
    status: row.status,
    parentId: row.parentId,
    sortOrder: row.sortOrder,
    weight: row.weight,
    frequency: row.frequency,
    phasing: row.phasing,
    phaseConfig: row.phaseConfig,
    metricType: row.metricType,
    direction: row.direction,
    targetMode: row.targetMode,
    targetConfig: row.targetConfig,
    unit: row.unit,
    deadlineMonth: row.deadlineMonth,
    scoreFinalAfterDeadline: row.scoreFinalAfterDeadline,
    departments: row.departments.map((d) => ({
      id: d.department.id,
      name: d.department.name,
    })),
  }));
}

/**
 * The hierarchy alone — id, code, name, level, parentId, isLeaf and both
 * weights — with none of a scorecard's figures or scoring. For pages like
 * the hierarchy editor that only need the structure: one query, instead of
 * getScorecard's KPI + values + overrides + departments queries and up to
 * four full scored-tree builds for the trailing-months columns.
 */
export async function getHierarchyTree(fiscalYearId: string): Promise<HierarchyNode[]> {
  return buildHierarchyTree(await loadKpiRecords(fiscalYearId));
}

/**
 * Loads one fiscal year's scorecard as at `period`.
 *
 * Values for the *whole* year are loaded, not just the requested months,
 * because scoring a month can need earlier entries: an estimate carries
 * forward, and a milestone's completion date keeps scoring in later months.
 */
export async function getScorecard(options?: {
  fiscalYearId?: string;
  period?: string;
}): Promise<Scorecard | null> {
  const fiscalYear = options?.fiscalYearId
    ? await prisma.fiscalYear.findUnique({ where: { id: options.fiscalYearId } })
    : await getActiveFiscalYear();
  if (!fiscalYear) return null;

  const yearPeriods = periodsOfFiscalYear(fiscalYear.startYear);
  const period = resolvePeriod(options?.period, fiscalYear.startYear);

  if (fiscalYear.closedAt) {
    const closed = await getClosedScorecard(fiscalYear, period, yearPeriods);
    if (closed) return closed;
    // No snapshot somehow exists for a closed year — fall through to a live
    // read rather than show nothing; this should not normally happen.
  }

  const [kpiRecords, valueRows, departments, overrideRows] = await Promise.all([
    loadKpiRecords(fiscalYear.id),
    prisma.kpiValue.findMany({
      where: { kpi: { fiscalYearId: fiscalYear.id }, period: { in: yearPeriods } },
    }),
    listDepartments(),
    prisma.scoreOverride.findMany({
      where: { kpi: { fiscalYearId: fiscalYear.id } },
      include: { by: { select: { username: true } } },
    }),
  ]);

  const values: ValueRecord[] = valueRows.map((v) => ({
    kpiId: v.kpiId,
    period: v.period,
    value: v.value,
    basis: v.basis,
    completionDate: v.completionDate,
    note: v.note,
  }));

  const overrides = new Map<string, ScoreOverrideRecord[]>();
  for (const o of overrideRows) {
    const list = overrides.get(o.kpiId) ?? [];
    list.push({
      period: o.period,
      score: o.score,
      reason: o.reason,
      byUsername: o.by.username,
      createdAt: o.createdAt,
    });
    overrides.set(o.kpiId, list);
  }

  const periods = trailingPeriods(period);
  const { roots, total, byId } = buildScoredTree(kpiRecords, values, period, overrides);

  // Recompute the tree for each trailing month so the columns show what the
  // scorecard actually said then, not today's numbers back-dated.
  const scoresByPeriod = new Map<string, PeriodScores>();
  const totalsByPeriod = new Map<string, Rollup>();
  for (const p of periods) {
    const snapshot = p === period ? { roots, total, byId } : buildScoredTree(kpiRecords, values, p, overrides);
    const lookup: PeriodScores = new Map();
    for (const node of flattenTree(snapshot.roots)) {
      lookup.set(node.id, {
        score: node.score,
        band: node.band,
        coverage: node.coverage,
        provisional: node.provisional,
        prorated: node.prorated,
        notYetDueShare: node.notYetDueShare,
      });
    }
    scoresByPeriod.set(p, lookup);
    totalsByPeriod.set(p, snapshot.total);
  }

  return {
    fiscalYear: {
      id: fiscalYear.id,
      startYear: fiscalYear.startYear,
      label: fiscalYear.label || fiscalYearLabel(fiscalYear.startYear),
      closedAt: fiscalYear.closedAt ? fiscalYear.closedAt.toISOString() : null,
    },
    period,
    periods,
    roots,
    byId,
    total,
    scoresByPeriod,
    totalsByPeriod,
    departments,
    issues: validateHierarchy(kpiRecords),
    kpiRecords,
    values,
    overrides,
  };
}

/**
 * Renders a closed fiscal year from its immutable snapshot instead of
 * recomputing live — so a board-approved historical year can never move
 * under a future change to the scoring engine itself. Returns null if
 * somehow no snapshot exists (the caller falls back to a live read).
 */
async function getClosedScorecard(
  fiscalYear: { id: string; startYear: number; label: string; closedAt: Date | null },
  period: string,
  yearPeriods: string[]
): Promise<Scorecard | null> {
  const snapshotRow = await prisma.fiscalYearSnapshot.findUnique({
    where: { fiscalYearId: fiscalYear.id },
  });
  if (!snapshotRow) return null;

  const data = JSON.parse(snapshotRow.data) as Record<
    string,
    { roots: ScoredNode[]; total: Rollup }
  >;
  const current = data[period];
  if (!current) return null;

  const [kpiRecords, departments] = await Promise.all([
    loadKpiRecords(fiscalYear.id),
    listDepartments(),
  ]);

  const byId = new Map(flattenTree(current.roots).map((n) => [n.id, n]));

  // Every month of the year, not just the trailing window — the KPI detail
  // page's month-by-month history reads any period directly from this map,
  // never falling back to a live recompute (which would need KpiValue rows
  // this branch deliberately doesn't load).
  const scoresByPeriod = new Map<string, PeriodScores>();
  const totalsByPeriod = new Map<string, Rollup>();
  for (const p of yearPeriods) {
    const snap = data[p];
    if (!snap) continue;
    const lookup: PeriodScores = new Map();
    for (const node of flattenTree(snap.roots)) {
      lookup.set(node.id, {
        score: node.score,
        band: node.band,
        coverage: node.coverage,
        provisional: node.provisional,
        prorated: node.prorated,
        notYetDueShare: node.notYetDueShare,
      });
    }
    scoresByPeriod.set(p, lookup);
    totalsByPeriod.set(p, snap.total);
  }

  return {
    fiscalYear: {
      id: fiscalYear.id,
      startYear: fiscalYear.startYear,
      label: fiscalYear.label || fiscalYearLabel(fiscalYear.startYear),
      closedAt: fiscalYear.closedAt ? fiscalYear.closedAt.toISOString() : null,
    },
    period,
    periods: trailingPeriods(period),
    roots: current.roots,
    byId,
    total: current.total,
    scoresByPeriod,
    totalsByPeriod,
    departments,
    issues: validateHierarchy(kpiRecords),
    kpiRecords,
    values: [],
    overrides: new Map(),
  };
}

/**
 * Which month to report on: the one asked for if it belongs to this year,
 * otherwise today's month, clamped into the year so an archived year opens on
 * its final month rather than an empty one.
 */
function resolvePeriod(requested: string | undefined, startYear: number): string {
  const yearPeriods = periodsOfFiscalYear(startYear);
  if (requested && yearPeriods.includes(requested)) return requested;

  const today = currentPeriod();
  if (fiscalYearOfPeriod(today) === startYear) return today;
  return today < yearPeriods[0] ? yearPeriods[0] : yearPeriods[yearPeriods.length - 1];
}

/** Everything the KPI detail page needs: the node, its history and its updates. */
export async function getKpiDetail(kpiId: string, period?: string) {
  const kpi = await prisma.kpi.findUnique({
    where: { id: kpiId },
    select: { fiscalYearId: true },
  });
  if (!kpi) return null;

  const scorecard = await getScorecard({ fiscalYearId: kpi.fiscalYearId, period });
  if (!scorecard) return null;

  const node = scorecard.byId.get(kpiId);
  if (!node) return null;

  const updates = await prisma.kpiUpdate.findMany({
    where: { kpiId },
    orderBy: { createdAt: "desc" },
  });

  return { scorecard, node, updates };
}
