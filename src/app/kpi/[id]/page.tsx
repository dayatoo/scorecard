import Link from "next/link";
import { notFound } from "next/navigation";

import { KpiDetailClient } from "./KpiDetailClient";
import { getKpiDetail, listDepartments, listStatusOptions } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { requireAuthPage } from "@/lib/session";
import { ancestorsOf } from "@/lib/kpi-tree";
import { periodsOfFiscalYear } from "@/lib/fiscal";
import type { Band } from "@/lib/scoring";
import { describeMeetTarget } from "@/lib/targets";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/kpi/[id]">) {
  const { id } = await params;
  const detail = await getKpiDetail(id);
  return { title: detail ? `${detail.node.name} — KPI Scorecard` : "KPI Scorecard" };
}

export default async function KpiDetailPage({ params, searchParams }: PageProps<"/kpi/[id]">) {
  const currentUser = await requireAuthPage();

  const { id } = await params;
  const query = await searchParams;
  const period = typeof query.period === "string" ? query.period : undefined;

  const [detail, departments, statusOptions, audits, pendingProposalRow] = await Promise.all([
    getKpiDetail(id, period),
    listDepartments(),
    listStatusOptions(),
    prisma.kpiAudit.findMany({ where: { kpiId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.kpiChangeProposal.findFirst({
      where: { kpiId: id, status: "PENDING" },
      include: { proposedBy: true },
    }),
  ]);
  if (!detail) notFound();

  const pendingProposal = pendingProposalRow
    ? {
        id: pendingProposalRow.id,
        summary: JSON.parse(pendingProposalRow.summary) as {
          field: string; label: string; from: string; to: string;
        }[],
        proposedByUsername: pendingProposalRow.proposedBy.username,
        createdAt: pendingProposalRow.createdAt.toISOString(),
      }
    : null;

  const { scorecard, node, updates } = detail;
  const ancestors = ancestorsOf(node, scorecard.byId);
  const yearPeriods = periodsOfFiscalYear(scorecard.fiscalYear.startYear);

  // The KPI's own recorded figures, month by month, for the history table and
  // the charts. Scores come from re-running the tree per month, so what the
  // chart shows is exactly what the scorecard said at the time.
  const valuesByPeriod = new Map(
    scorecard.values.filter((v) => v.kpiId === id).map((v) => [v.period, v])
  );

  // Score the KPI for every month of the year so the history table and charts
  // show what the scorecard actually said at the time. getScorecard only
  // pre-computes the trailing window, so the other months are built here.
  const { buildScoredTree } = await import("@/lib/kpi-tree");
  const scoreFor = (p: string) => {
    const cached = scorecard.scoresByPeriod.get(p)?.get(id);
    if (cached) return cached;
    const scored = buildScoredTree(scorecard.kpiRecords, scorecard.values, p, scorecard.overrides).byId.get(id);
    return {
      score: scored?.score ?? null,
      band: scored?.band ?? null,
      coverage: scored?.coverage ?? 0,
      provisional: scored?.provisional ?? false,
      prorated: scored?.prorated ?? false,
      notYetDueShare: scored?.notYetDueShare ?? 0,
    };
  };

  // Months after the one being reported on have not happened yet, so they are
  // listed but never scored. Without this, an overdue milestone — which scores
  // on its own once its target month passes — would fill the rest of the year
  // with real-looking scores for months nobody has lived through.
  const history = yearPeriods.map((p) => {
    const entry = valuesByPeriod.get(p);
    const isFuture = p > scorecard.period;
    const scored = isFuture ? null : scoreFor(p);
    return {
      period: p,
      isFuture,
      value: entry?.value ?? null,
      basis: entry?.basis ?? null,
      completionDate: entry?.completionDate?.toISOString().slice(0, 10) ?? null,
      note: entry?.note ?? null,
      score: scored?.score ?? null,
      band: (scored?.band ?? null) as Band | null,
      coverage: scored?.coverage ?? 0,
      provisional: scored?.provisional ?? false,
    };
  });

  const subKpis = node.children.map((child) => ({
    id: child.id,
    code: child.code,
    name: child.name,
    weight: child.weight,
    score: child.score,
    band: child.band,
    coverage: child.coverage,
    provisional: child.provisional,
    meetTarget: describeMeetTarget(child.targetConfig, child.metricType),
    unit: child.unit,
    metricType: child.metricType,
    // For the score explainer's rollup arithmetic: the exact (unrounded)
    // score and the scored weight are what rollup() actually weights by.
    exactScore: child.exactScore,
    scoredWeight: child.scoredWeight,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-sm text-gray-500">
        <Link href={`/?fy=${scorecard.fiscalYear.id}&period=${scorecard.period}`} className="hover:text-blue-700">
          {scorecard.fiscalYear.label}
        </Link>
        {scorecard.fiscalYear.closedAt && (
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
            Closed
          </span>
        )}
        {ancestors.map((ancestor) => (
          <span key={ancestor.id} className="flex items-center gap-1">
            <span aria-hidden>/</span>
            <Link href={`/kpi/${ancestor.id}?period=${scorecard.period}`} className="hover:text-blue-700">
              {ancestor.name}
            </Link>
          </span>
        ))}
        <span aria-hidden>/</span>
        <span className="text-gray-900">{node.name}</span>
      </nav>

      <KpiDetailClient
        kpi={{
          id: node.id,
          code: node.code,
          name: node.name,
          subGroup: node.subGroup,
          status: node.status,
          level: node.level,
          isLeaf: node.isLeaf,
          weight: node.weight,
          globalWeight: node.globalWeight,
          frequency: node.frequency,
          phasing: node.phasing,
          phaseConfig: node.phaseConfig,
          metricType: node.metricType,
          direction: node.direction,
          targetMode: node.targetMode,
          targetConfig: node.targetConfig,
          unit: node.unit,
          deadlineMonth: node.deadlineMonth,
          scoreFinalAfterDeadline: node.scoreFinalAfterDeadline,
          departmentIds: node.departments.map((d) => d.id),
          score: node.score,
          band: node.band,
          coverage: node.coverage,
          provisional: node.provisional,
          leaf: node.leaf,
        }}
        subKpis={subKpis}
        history={history}
        updates={updates.map((u) => ({
          id: u.id,
          period: u.period,
          mode: u.mode,
          body: u.body,
          currentProgress: u.currentProgress,
          nextProgress: u.nextProgress,
          timeCost: u.timeCost,
          issues: u.issues,
          author: u.author,
          createdAt: u.createdAt.toISOString(),
        }))}
        audits={audits.map((a) => ({
          id: a.id,
          field: a.field,
          label: a.label,
          from: a.from,
          to: a.to,
          author: a.author,
          createdAt: a.createdAt.toISOString(),
        }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        statusOptions={statusOptions}
        period={scorecard.period}
        periods={yearPeriods}
        fiscalYearLabel={scorecard.fiscalYear.label}
        fiscalYearClosed={!!scorecard.fiscalYear.closedAt}
        currentUser={currentUser}
        pendingProposal={pendingProposal}
      />
    </div>
  );
}
