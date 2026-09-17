import { EmptyState } from "@/components/EmptyState";
import { PeriodPicker } from "@/components/PeriodPicker";
import { getScorecard, listFiscalYears } from "@/lib/data";
import { formatPeriodLabel, periodsOfFiscalYear } from "@/lib/fiscal";
import { leavesOf, strategicGoalOf } from "@/lib/kpi-tree";
import { requireAuthPage } from "@/lib/session";
import { describeMeetTarget } from "@/lib/targets";
import { SimulationGrid, type SimulationRow } from "./SimulationGrid";

export const metadata = { title: "Simulate — KPI Scorecard" };
export const dynamic = "force-dynamic";

export default async function SimulatePage({ searchParams }: PageProps<"/simulate">) {
  const params = await searchParams;
  const fiscalYearId = typeof params.fy === "string" ? params.fy : undefined;
  const period = typeof params.period === "string" ? params.period : undefined;

  const [, scorecard, fiscalYears] = await Promise.all([
    requireAuthPage(),
    getScorecard({ fiscalYearId, period }),
    listFiscalYears(),
  ]);

  if (!scorecard || leavesOf(scorecard.roots).length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <EmptyState
          title="No KPIs to simulate"
          description="Import your KPI hierarchy first, then come back to try out different figures."
          actionHref="/import"
          actionLabel="Import KPIs"
        />
      </div>
    );
  }

  // Each field's baseline is the most recently *reported* figure at or before
  // the simulated period, not necessarily this period's own entry — a month
  // nobody has entered yet would otherwise start every row blank, forcing a
  // person to retype the whole scorecard before they could try changing just
  // one KPI. History is scanned per field independently (a KPI can have a
  // value from one month and a completion date set in another).
  const historyByKpi = new Map<string, typeof scorecard.values>();
  for (const v of scorecard.values) {
    if (v.period > scorecard.period) continue;
    const list = historyByKpi.get(v.kpiId) ?? [];
    list.push(v);
    historyByKpi.set(v.kpiId, list);
  }
  for (const list of historyByKpi.values()) list.sort((a, b) => (a.period < b.period ? 1 : -1));

  const rows: SimulationRow[] = leavesOf(scorecard.roots).map((node) => {
    const history = historyByKpi.get(node.id) ?? [];
    const latestValue = history.find((v) => v.value !== null);
    const latestPlanned = history.find((v) => v.plannedValue !== null);
    const latestCompletion = history.find((v) => v.completionDate !== null);
    // Only one baseline period is shown per row (the value's, since that's
    // what most metrics key off) — good enough for a "here's roughly where
    // this stood" hint, not meant to describe every field separately.
    const baselinePeriod = latestValue ?? latestCompletion;
    return {
      id: node.id,
      code: node.code,
      name: node.name,
      strategicGoal: strategicGoalOf(node, scorecard.byId).name,
      metricType: node.metricType,
      unit: node.unit,
      meetTarget: describeMeetTarget(node.targetConfig, node.metricType),
      weight: node.globalWeight,
      targetDate: node.metricType === "MONTH_COMPLETION" ? ((node.targetConfig as { targetMonth?: string } | null)?.targetMonth ?? null) : null,
      value: latestValue?.value ?? null,
      plannedValue: latestPlanned?.plannedValue ?? null,
      completionDate: latestCompletion?.completionDate?.toISOString().slice(0, 10) ?? null,
      baselinePeriod: baselinePeriod && baselinePeriod.period !== scorecard.period ? baselinePeriod.period : null,
    };
  });

  // Raw inputs to `buildScoredTree`, serialized for the client component,
  // which re-runs it locally on every keystroke — nothing here is a network
  // round-trip, and nothing typed on this page is ever written back.
  const values = scorecard.values.map((v) => ({ ...v, completionDate: v.completionDate?.toISOString() ?? null }));
  const overrides = [...scorecard.overrides.entries()].map(([kpiId, records]) => [
    kpiId,
    records.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  ]) as [string, { period: string; score: number; reason: string; byUsername: string; createdAt: string }[]][];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Simulate — {formatPeriodLabel(scorecard.period)}</h1>
          <p className="mt-0.5 text-sm text-gray-600">
            Try out different figures and watch every score update live. Nothing here is saved.
          </p>
        </div>
        <PeriodPicker
          period={scorecard.period}
          periods={periodsOfFiscalYear(scorecard.fiscalYear.startYear)}
          fiscalYears={fiscalYears}
          fiscalYearId={scorecard.fiscalYear.id}
        />
      </div>

      <SimulationGrid
        rows={rows}
        period={scorecard.period}
        kpiRecords={scorecard.kpiRecords}
        values={values}
        overrides={overrides}
      />
    </div>
  );
}
