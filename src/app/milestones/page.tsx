import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { ScoreCell } from "@/components/ScoreCell";
import { PeriodPicker } from "@/components/PeriodPicker";
import { getScorecard, listFiscalYears } from "@/lib/data";
import { requireAuthPage } from "@/lib/session";
import { leavesOf, strategicGoalOf } from "@/lib/kpi-tree";
import { formatPeriodLabel, lastPeriodOfFiscalYear, periodsOfFiscalYear } from "@/lib/fiscal";
import { latenessCap, monthsBetween, type Band } from "@/lib/scoring";

export const metadata = { title: "Deadlines — KPI Scorecard" };
export const dynamic = "force-dynamic";

type TimeBound = {
  id: string;
  code: string;
  name: string;
  strategicGoal: string;
  departments: string[];
  /** The month it must be achieved by. */
  dueMonth: string;
  kind: "MILESTONE" | "DEADLINE";
  monthsAway: number;
  score: number | null;
  band: Band | null;
  /** For an overdue deadline KPI, the cap now in force. */
  cap: number | null;
  frozen: boolean;
};

export default async function MilestonesPage({ searchParams }: PageProps<"/milestones">) {
  const params = await searchParams;
  const fiscalYearId = typeof params.fy === "string" ? params.fy : undefined;
  const period = typeof params.period === "string" ? params.period : undefined;

  const [, scorecard, fiscalYears] = await Promise.all([
    requireAuthPage(),
    getScorecard({ fiscalYearId, period }),
    listFiscalYears(),
  ]);

  if (!scorecard) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <EmptyState
          title="No scorecard yet"
          description="Create a fiscal year and import your KPIs first."
          actionHref="/manage"
          actionLabel="Set up a fiscal year"
        />
      </div>
    );
  }

  const items: TimeBound[] = [];

  for (const node of leavesOf(scorecard.roots)) {
    const goal = strategicGoalOf(node, scorecard.byId).name;
    const departments = node.departments.map((d) => d.name);

    const isMilestone = node.metricType === "MONTH_COMPLETION";
    const dueMonth = isMilestone
      ? (node.targetConfig as { targetMonth?: string } | null)?.targetMonth
      : (node.deadlineMonth ?? lastPeriodOfFiscalYear(scorecard.fiscalYear.startYear));
    if (!dueMonth) continue;

    // A milestone that has been completed is settled; a deadline KPI that has
    // reached at least the Meet band has hit its target. Neither needs chasing.
    const completed = scorecard.values.find(
      (v) => v.kpiId === node.id && v.completionDate !== null
    );
    const settled = isMilestone
      ? Boolean(completed)
      : (node.score ?? 0) >= 3 && monthsBetween(dueMonth, scorecard.period) <= 0;

    if (settled) continue;

    items.push({
      id: node.id,
      code: node.code,
      name: node.name,
      strategicGoal: goal,
      departments,
      dueMonth,
      kind: isMilestone ? "MILESTONE" : "DEADLINE",
      monthsAway: monthsBetween(scorecard.period, dueMonth),
      score: node.score,
      band: node.band,
      cap: node.leaf?.deadline?.cap ?? null,
      frozen: node.leaf?.deadline?.frozen ?? false,
    });
  }

  const overdue = items
    .filter((i) => i.monthsAway < 0)
    .sort((a, b) => a.monthsAway - b.monthsAway);
  const dueSoon = items
    .filter((i) => i.monthsAway >= 0 && i.monthsAway <= 3)
    .sort((a, b) => a.monthsAway - b.monthsAway);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Deadlines</h1>
          <p className="mt-0.5 text-sm text-gray-600">
            Time-bound KPIs as at {formatPeriodLabel(scorecard.period)}
          </p>
        </div>
        <PeriodPicker
          period={scorecard.period}
          periods={periodsOfFiscalYear(scorecard.fiscalYear.startYear)}
          fiscalYears={fiscalYears}
          fiscalYearId={scorecard.fiscalYear.id}
        />
      </div>

      <Section
        title="Overdue"
        description="Past their date without reaching target. Their scores are capped by how late they are, or already fixed."
        items={overdue}
        tone="rose"
        period={scorecard.period}
        emptyMessage="Nothing is overdue."
      />

      <Section
        title="Due within three months"
        description="Coming up, in order."
        items={dueSoon}
        tone="amber"
        period={scorecard.period}
        emptyMessage="Nothing falls due in the next three months."
      />

      {items.length === 0 && (
        <p className="rounded-lg border border-dashed bg-white px-4 py-8 text-center text-sm text-gray-500">
          No KPI in {scorecard.fiscalYear.label} has a target month or a deadline set.
          Add one from a KPI&rsquo;s own page, or in the import spreadsheet.
        </p>
      )}
    </div>
  );
}

function Section({
  title, description, items, tone, period, emptyMessage,
}: {
  title: string;
  description: string;
  items: TimeBound[];
  tone: "rose" | "amber";
  period: string;
  emptyMessage: string;
}) {
  const accent = tone === "rose" ? "border-rose-200" : "border-amber-200";

  return (
    <section className={`overflow-hidden rounded-lg border bg-white ${items.length > 0 ? accent : ""}`}>
      <div className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          {title}
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {items.length}
          </span>
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500">{emptyMessage}</p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <Link href={`/kpi/${item.id}?period=${period}`} className="font-medium hover:text-blue-700 hover:underline">
                  <span className="font-mono text-xs text-gray-400">{item.code}</span> {item.name}
                </Link>
                <p className="mt-0.5 text-xs text-gray-500">
                  {item.strategicGoal}
                  {item.departments.length > 0 && ` · ${item.departments.join(", ")}`}
                  {item.kind === "DEADLINE" && " · deadline on a non-date metric"}
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  {describeTiming(item)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs text-gray-500">{formatPeriodLabel(item.dueMonth)}</div>
                <div className="mt-1">
                  <ScoreCell
                    score={item.score} band={item.band} size="sm"
                    placeholder={item.monthsAway >= 0 ? "not due" : "—"}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function describeTiming(item: TimeBound): string {
  if (item.monthsAway > 0) {
    return `Due in ${item.monthsAway} month${item.monthsAway === 1 ? "" : "s"}.`;
  }
  if (item.monthsAway === 0) return "Due this month.";

  const late = -item.monthsAway;
  const lateness = `${late} month${late === 1 ? "" : "s"} late`;

  if (item.kind === "MILESTONE") {
    if (late >= 3) return `${lateness} — now scoring 0 until it is completed.`;
    return `${lateness} — scoring down through ${late === 1 ? "Improvement Needed" : "Poor"} while it stays open.`;
  }

  if (item.frozen) {
    return `${lateness}. This KPI's score was fixed at its deadline, so further progress will not change it.`;
  }

  const cap = latenessCap(late);
  return cap === 0
    ? `${lateness} — further achievement no longer earns any score.`
    : `${lateness} — further achievement still counts, but is capped at ${cap?.toFixed(1)}.`;
}
