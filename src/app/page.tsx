import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { IssueBanner } from "@/components/IssueBanner";
import { PeriodPicker } from "@/components/PeriodPicker";
import { ScoreTree, type TreeRow } from "@/components/ScoreTree";
import { CoverageBadge, ScoreCell } from "@/components/ScoreCell";
import { formatPeriodLabel, periodsOfFiscalYear } from "@/lib/fiscal";
import { flattenTree } from "@/lib/kpi-tree";
import { getScorecard, listFiscalYears } from "@/lib/data";
import { requireAuthPage } from "@/lib/session";

export const metadata = { title: "Dashboard — KPI Scorecard" };

// Scores depend on the request (which month, which year), so this page is
// always rendered fresh rather than cached.
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  await requireAuthPage();

  const params = await searchParams;
  const fiscalYearId = typeof params.fy === "string" ? params.fy : undefined;
  const period = typeof params.period === "string" ? params.period : undefined;

  const [scorecard, fiscalYears] = await Promise.all([
    getScorecard({ fiscalYearId, period }),
    listFiscalYears(),
  ]);

  if (!scorecard) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <EmptyState
          title="No scorecard yet"
          description="Create a fiscal year, then import your KPI hierarchy from a spreadsheet to get started."
          actionHref="/manage"
          actionLabel="Set up a fiscal year"
        />
      </div>
    );
  }

  const nodes = flattenTree(scorecard.roots);

  if (nodes.length === 0) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <Header scorecard={scorecard} fiscalYears={fiscalYears} />
        <EmptyState
          title={`${scorecard.fiscalYear.label} has no KPIs yet`}
          description="Import your Strategic Goals, KPIs and sub-KPIs from a spreadsheet — download the template, fill it in, and upload it back."
          actionHref="/import"
          actionLabel="Import KPIs"
        />
      </div>
    );
  }

  const rows: TreeRow[] = nodes.map((node) => ({
    id: node.id,
    code: node.code,
    name: node.name,
    level: node.level,
    isLeaf: node.isLeaf,
    weight: node.weight,
    parentId: node.parentId,
    departments: node.departments.map((d) => d.name),
    pendingReason: node.leaf?.pendingReason ?? null,
    scores: Object.fromEntries(
      scorecard.periods.map((p) => [
        p,
        scorecard.scoresByPeriod.get(p)?.get(node.id) ?? {
          score: null,
          band: null,
          coverage: 0,
          provisional: false,
          prorated: false,
          notYetDueShare: 0,
        },
      ])
    ),
  }));

  const totalRow = {
    scores: Object.fromEntries(
      scorecard.periods.map((p) => {
        const t = scorecard.totalsByPeriod.get(p);
        return [
          p,
          {
            score: t?.score ?? null,
            band: t?.band ?? null,
            coverage: t?.coverage ?? 0,
            provisional: (t?.provisionalShare ?? 0) > 0,
            prorated: (t?.proratedWeight ?? 0) > 0,
            notYetDueShare: t?.notYetDueShare ?? 0,
          },
        ];
      })
    ),
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <Header scorecard={scorecard} fiscalYears={fiscalYears} />
      <IssueBanner issues={scorecard.issues} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label={`Total score — ${formatPeriodLabel(scorecard.period)}`}
          score={scorecard.total.score}
          band={scorecard.total.band}
          provisional={scorecard.total.provisionalShare > 0}
          prorated={scorecard.total.proratedWeight > 0}
          footer={
            <>
              <CoverageBadge
                coverage={scorecard.total.coverage}
                provisionalShare={scorecard.total.provisionalShare}
                notYetDueShare={scorecard.total.notYetDueShare}
              />
              <span className="ml-1 text-xs text-gray-500">of weight scored</span>
              {scorecard.total.proratedShare > 0 && (
                <span className="ml-1 text-xs text-gray-500">
                  · {Math.round(scorecard.total.proratedShare * 100)}% pro-rated
                </span>
              )}
            </>
          }
        />
        {/* Every Strategic Goal, not a fixed few: the grid wraps to as many rows
            as the scorecard needs. Truncating here once hid goals entirely, since
            the summary is the only place a goal's score is shown unexpanded. */}
        {scorecard.roots.map((goal) => (
          <SummaryCard
            key={goal.id}
            label={goal.name}
            href={`/kpi/${goal.id}?period=${scorecard.period}`}
            score={goal.score}
            band={goal.band}
            provisional={goal.provisional}
            prorated={goal.prorated}
            footer={
              <>
                <CoverageBadge coverage={goal.coverage} notYetDueShare={goal.notYetDueShare} />
                <span className="ml-1 text-xs text-gray-500">
                  of {goal.weight.toFixed(0)}% weight
                </span>
              </>
            }
          />
        ))}
      </section>

      <ScoreTree
        rows={rows}
        periods={scorecard.periods}
        currentPeriod={scorecard.period}
        total={totalRow}
      />
    </div>
  );
}

function Header({
  scorecard,
  fiscalYears,
}: {
  scorecard: NonNullable<Awaited<ReturnType<typeof getScorecard>>>;
  fiscalYears: { id: string; label: string; startYear: number }[];
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {scorecard.fiscalYear.label} scorecard
          {scorecard.fiscalYear.closedAt && (
            <span className="ml-2 align-middle rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
              Closed
            </span>
          )}
        </h1>
        <p className="mt-0.5 text-sm text-gray-600">
          Reporting {formatPeriodLabel(scorecard.period)} · year-to-date figures
          against full-year targets
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PeriodPicker
          period={scorecard.period}
          periods={periodsOfFiscalYear(scorecard.fiscalYear.startYear)}
          fiscalYears={fiscalYears}
          fiscalYearId={scorecard.fiscalYear.id}
        />
        <Link
          href={`/api/export?fy=${scorecard.fiscalYear.id}&period=${scorecard.period}`}
          className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
          prefetch={false}
        >
          Export to Excel
        </Link>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  score,
  band,
  provisional,
  prorated,
  footer,
  href,
}: {
  label: string;
  score: number | null;
  band: Parameters<typeof ScoreCell>[0]["band"];
  provisional?: boolean;
  prorated?: boolean;
  footer?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <div className="truncate text-xs font-medium text-gray-500" title={label}>
        {label}
      </div>
      <div className="mt-2">
        <ScoreCell
          score={score}
          band={band}
          provisional={provisional}
          prorated={prorated}
          size="lg"
          showBandLabel
        />
      </div>
      <div className="mt-2">{footer}</div>
    </>
  );

  const className = "rounded-lg border bg-white px-4 py-3";
  return href ? (
    <Link href={href} className={`${className} block hover:border-blue-300 hover:shadow-sm`}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}
