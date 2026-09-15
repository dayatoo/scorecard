import { EmptyState } from "@/components/EmptyState";
import { PeriodPicker } from "@/components/PeriodPicker";
import { KpiTable, type KpiTableRow } from "./KpiTable";
import { getScorecard, listFiscalYears } from "@/lib/data";
import { requireAuthPage } from "@/lib/session";
import { flattenTree, strategicGoalOf } from "@/lib/kpi-tree";
import { formatPeriodLabel, periodsOfFiscalYear } from "@/lib/fiscal";
import { BANDS, type Band } from "@/lib/scoring";
import { describeBandTarget, describeMeetTarget } from "@/lib/targets";

export const metadata = { title: "KPIs — KPI Scorecard" };
export const dynamic = "force-dynamic";

export default async function KpisPage({ searchParams }: PageProps<"/kpis">) {
  const params = await searchParams;
  const fiscalYearId = typeof params.fy === "string" ? params.fy : undefined;
  const period = typeof params.period === "string" ? params.period : undefined;

  const [, scorecard, fiscalYears] = await Promise.all([
    requireAuthPage(),
    getScorecard({ fiscalYearId, period }),
    listFiscalYears(),
  ]);

  if (!scorecard || flattenTree(scorecard.roots).length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <EmptyState
          title="No KPIs yet"
          description="Import your hierarchy from a spreadsheet to see the master list."
          actionHref="/import"
          actionLabel="Import KPIs"
        />
      </div>
    );
  }

  const rows: KpiTableRow[] = flattenTree(scorecard.roots).map((node) => {
    const goal = strategicGoalOf(node, scorecard.byId);
    return {
      id: node.id,
      code: node.code,
      name: node.name,
      subGroup: node.subGroup,
      level: node.level,
      isLeaf: node.isLeaf,
      weight: node.weight,
      strategicGoal: goal.name,
      strategicGoalId: goal.id,
      departments: node.departments.map((d) => d.name),
      metricType: node.metricType,
      unit: node.unit,
      meetTarget: describeMeetTarget(node.targetConfig, node.metricType),
      bandTargets: Object.fromEntries(
        BANDS.map((b) => [b, describeBandTarget(node.targetConfig, node.metricType, b)])
      ) as Record<Band, string | null>,
      deadlineMonth: node.deadlineMonth,
      value: node.leaf?.value ?? null,
      basis: node.leaf?.basis ?? null,
      score: node.score,
      band: node.band,
      coverage: node.coverage,
      leafCount: node.leafCount,
      scoredLeafCount: node.scoredLeafCount,
      provisional: node.provisional,
      pendingReason: node.leaf?.pendingReason ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">KPIs</h1>
          <p className="mt-0.5 text-sm text-gray-600">
            {scorecard.fiscalYear.label} · {formatPeriodLabel(scorecard.period)}
          </p>
        </div>
        <PeriodPicker
          period={scorecard.period}
          periods={periodsOfFiscalYear(scorecard.fiscalYear.startYear)}
          fiscalYears={fiscalYears}
          fiscalYearId={scorecard.fiscalYear.id}
        />
      </div>

      <KpiTable
        rows={rows}
        departments={scorecard.departments.map((d) => d.name)}
        period={scorecard.period}
      />
    </div>
  );
}
