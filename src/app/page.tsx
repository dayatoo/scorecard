import { DownloadLink } from "@/components/DownloadLink";
import { EmptyState } from "@/components/EmptyState";
import { IssueBanner } from "@/components/IssueBanner";
import { PeriodPicker } from "@/components/PeriodPicker";
import { SummaryCard, TotalScoreHero } from "@/components/ScoreHero";
import { ScoreTree, type TreeRow } from "@/components/ScoreTree";
import { formatPeriodLabel, periodsOfFiscalYear } from "@/lib/fiscal";
import { flattenTree, leavesOf } from "@/lib/kpi-tree";
import { getScorecard, listFiscalYears } from "@/lib/data";
import { BANDS, type Band } from "@/lib/scoring";
import { DEFAULT_SCORING_OPTIONS, type DueMode, type EstimateMode } from "@/lib/scoring-modes";
import { requireAuthPage } from "@/lib/session";
import { describeBandTarget, describeMeetTarget } from "@/lib/targets";

export const metadata = { title: "Dashboard — KPI Scorecard" };

// Scores depend on the request (which month, which year), so this page is
// always rendered fresh rather than cached.
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const fiscalYearId = typeof params.fy === "string" ? params.fy : undefined;
  const period = typeof params.period === "string" ? params.period : undefined;

  const dueMode: DueMode =
    params.dueMode === "assume-meet-decay" || params.dueMode === "zero"
      ? params.dueMode
      : DEFAULT_SCORING_OPTIONS.dueMode;
  const estimateMode: EstimateMode =
    params.estimateMode === "exclude" || params.estimateMode === "zero"
      ? params.estimateMode
      : DEFAULT_SCORING_OPTIONS.estimateMode;

  const [, scorecard, fiscalYears] = await Promise.all([
    requireAuthPage(),
    getScorecard({ fiscalYearId, period, scoring: { dueMode, estimateMode } }),
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
        <Header scorecard={scorecard} fiscalYears={fiscalYears} dueMode={dueMode} estimateMode={estimateMode} />
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
    subGroup: node.subGroup,
    level: node.level,
    isLeaf: node.isLeaf,
    weight: node.weight,
    parentId: node.parentId,
    departments: node.departments.map((d) => d.name),
    meetTarget: describeMeetTarget(node.targetConfig, node.metricType),
    bandTargets: Object.fromEntries(
      BANDS.map((b) => [b, describeBandTarget(node.targetConfig, node.metricType, b)])
    ) as Record<Band, string | null>,
    unit: node.unit,
    metricType: node.metricType,
    value: node.leaf?.value ?? null,
    completionDate: node.leaf?.completionDate ?? null,
    basis: node.leaf?.basis ?? null,
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
          assumed: false,
          notYetDueShare: 0,
          leafCount: node.leafCount,
          scoredLeafCount: 0,
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
            assumed: false,
            notYetDueShare: t?.notYetDueShare ?? 0,
            leafCount: t?.leafCount ?? 0,
            scoredLeafCount: t?.scoredLeafCount ?? 0,
          },
        ];
      })
    ),
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <Header scorecard={scorecard} fiscalYears={fiscalYears} dueMode={dueMode} estimateMode={estimateMode} />
      <IssueBanner issues={scorecard.issues} />

      {/* Total score gets its own band — deliberately unlike the Strategic
          Goal cards below it, so it reads as the headline figure rather
          than a third peer in the same grid. */}
      <TotalScoreHero total={scorecard.total} period={scorecard.period} leaves={leavesOf(scorecard.roots)} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            assumed={goal.assumed}
            footer={`${goal.scoredLeafCount}/${goal.leafCount} of ${goal.weight.toFixed(0)}% weight`}
          />
        ))}
      </section>

      <ScoreTree
        rows={rows}
        periods={scorecard.periods}
        currentPeriod={scorecard.period}
        total={totalRow}
        dueMode={dueMode}
      />
    </div>
  );
}

function Header({
  scorecard,
  fiscalYears,
  dueMode,
  estimateMode,
}: {
  scorecard: NonNullable<Awaited<ReturnType<typeof getScorecard>>>;
  fiscalYears: { id: string; label: string; startYear: number }[];
  dueMode: DueMode;
  estimateMode: EstimateMode;
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
          dueMode={dueMode}
          estimateMode={estimateMode}
          closed={scorecard.fiscalYear.closedAt !== null}
        />
        <DownloadLink
          href={`/api/export?fy=${scorecard.fiscalYear.id}&period=${scorecard.period}`}
          label="Export to Excel"
          loadingLabel="Exporting…"
          className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
        />
      </div>
    </div>
  );
}

