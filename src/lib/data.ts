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
  buildScoredTree,
  flattenTree,
  type KpiRecord,
  type ScoredNode,
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
  fiscalYear: { id: string; startYear: number; label: string };
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

async function loadKpiRecords(fiscalYearId: string): Promise<KpiRecord[]> {
  const rows = await prisma.kpi.findMany({
    where: { fiscalYearId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    include: { departments: { include: { department: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
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

  const [kpiRecords, valueRows, departments] = await Promise.all([
    loadKpiRecords(fiscalYear.id),
    prisma.kpiValue.findMany({
      where: { kpi: { fiscalYearId: fiscalYear.id }, period: { in: yearPeriods } },
    }),
    listDepartments(),
  ]);

  const values: ValueRecord[] = valueRows.map((v) => ({
    kpiId: v.kpiId,
    period: v.period,
    value: v.value,
    basis: v.basis,
    completionDate: v.completionDate,
    note: v.note,
  }));

  const periods = trailingPeriods(period);
  const { roots, total, byId } = buildScoredTree(kpiRecords, values, period);

  // Recompute the tree for each trailing month so the columns show what the
  // scorecard actually said then, not today's numbers back-dated.
  const scoresByPeriod = new Map<string, PeriodScores>();
  const totalsByPeriod = new Map<string, Rollup>();
  for (const p of periods) {
    const snapshot = p === period ? { roots, total, byId } : buildScoredTree(kpiRecords, values, p);
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
