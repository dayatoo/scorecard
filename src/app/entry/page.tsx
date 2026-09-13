import { EmptyState } from "@/components/EmptyState";
import { PeriodPicker } from "@/components/PeriodPicker";
import { EntryGrid, type EntryRow } from "./EntryGrid";
import { getScorecard, listFiscalYears } from "@/lib/data";
import { requireAuthPage } from "@/lib/session";
import { leavesOf, strategicGoalOf } from "@/lib/kpi-tree";
import { formatPeriodLabel, periodsOfFiscalYear } from "@/lib/fiscal";

export const metadata = { title: "Enter data — KPI Scorecard" };
export const dynamic = "force-dynamic";

export default async function EntryPage({ searchParams }: PageProps<"/entry">) {
  const currentUser = await requireAuthPage();

  const params = await searchParams;
  const fiscalYearId = typeof params.fy === "string" ? params.fy : undefined;
  const period = typeof params.period === "string" ? params.period : undefined;

  const [scorecard, fiscalYears] = await Promise.all([
    getScorecard({ fiscalYearId, period }),
    listFiscalYears(),
  ]);

  if (!scorecard || leavesOf(scorecard.roots).length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <EmptyState
          title="No KPIs to report on"
          description="Import your KPI hierarchy first, then come back to enter each month's figures."
          actionHref="/import"
          actionLabel="Import KPIs"
        />
      </div>
    );
  }

  const entriesByKpi = new Map(
    scorecard.values
      .filter((v) => v.period === scorecard.period)
      .map((v) => [v.kpiId, v])
  );

  const rows: EntryRow[] = leavesOf(scorecard.roots).map((node) => {
    const entry = entriesByKpi.get(node.id);
    return {
      id: node.id,
      code: node.code,
      name: node.name,
      strategicGoal: strategicGoalOf(node, scorecard.byId).name,
      departments: node.departments.map((d) => d.name),
      departmentIds: node.departments.map((d) => d.id),
      metricType: node.metricType,
      unit: node.unit,
      // The Meet target, shown beside the input so the person entering a
      // figure can see what they are being measured against.
      meetTarget: describeMeetTarget(node.targetConfig, node.metricType),
      value: entry?.value ?? null,
      basis: entry?.basis ?? "ACTUAL",
      completionDate: entry?.completionDate?.toISOString().slice(0, 10) ?? null,
      note: entry?.note ?? null,
      score: node.score,
      band: node.band,
      provisional: node.provisional,
      pendingReason: node.leaf?.pendingReason ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Enter data — {formatPeriodLabel(scorecard.period)}
            {scorecard.fiscalYear.closedAt && (
              <span className="ml-2 align-middle rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                Closed
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-sm text-gray-600">
            Year-to-date figures. Nothing is saved until you press Save and confirm.
          </p>
        </div>
        <PeriodPicker
          period={scorecard.period}
          periods={periodsOfFiscalYear(scorecard.fiscalYear.startYear)}
          fiscalYears={fiscalYears}
          fiscalYearId={scorecard.fiscalYear.id}
        />
      </div>

      <EntryGrid
        rows={rows}
        period={scorecard.period}
        departments={scorecard.departments.map((d) => d.name)}
        currentUser={currentUser}
        fiscalYearClosed={!!scorecard.fiscalYear.closedAt}
      />
    </div>
  );
}

function describeMeetTarget(
  config: unknown,
  metricType: string | null
): string | null {
  if (!config || typeof config !== "object") return null;

  if (metricType === "MONTH_COMPLETION") {
    const month = (config as { targetMonth?: string }).targetMonth;
    return month ? formatPeriodLabel(month) : null;
  }

  const meet = (config as Record<string, unknown>).MEET;
  if (typeof meet === "number") return meet.toLocaleString();
  if (Array.isArray(meet) && meet.length === 2) return `${meet[0]}–${meet[1]}`;
  return null;
}
