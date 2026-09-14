import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { IssueBanner } from "@/components/IssueBanner";
import { PeriodPicker } from "@/components/PeriodPicker";
import { ScoreTree, type TreeRow } from "@/components/ScoreTree";
import { CoverageBadge, ScoreCell } from "@/components/ScoreCell";
import { bandStyle } from "@/lib/band-style";
import { formatPeriodLabel, periodsOfFiscalYear } from "@/lib/fiscal";
import { flattenTree } from "@/lib/kpi-tree";
import { getScorecard, listFiscalYears } from "@/lib/data";
import { BANDS, type Band } from "@/lib/scoring";
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

  const [, scorecard, fiscalYears] = await Promise.all([
    requireAuthPage(),
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

      {/* Total score gets its own band — deliberately unlike the Strategic
          Goal cards below it, so it reads as the headline figure rather
          than a third peer in the same grid. */}
      <TotalScoreHero scorecard={scorecard} />

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

function TotalScoreHero({
  scorecard,
}: {
  scorecard: NonNullable<Awaited<ReturnType<typeof getScorecard>>>;
}) {
  const { total, period } = scorecard;
  const style = bandStyle(total.band);

  return (
    <section
      className="rounded-2xl p-7 text-white shadow-sm"
      style={{
        background:
          "radial-gradient(480px 260px at 88% -20%, rgba(32,176,236,0.35), transparent 65%), " +
          "linear-gradient(155deg, #04336A 0%, #032853 55%, #021A38 100%)",
      }}
    >
      <div className="text-xs font-bold tracking-widest text-blue-400 uppercase">
        Total score — {formatPeriodLabel(period)}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <span className="font-heading text-5xl font-extrabold">
          {total.score !== null ? total.score.toFixed(1) : "—"}
        </span>
        {style && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-bold">
            <span className="h-2 w-2 rounded-full" style={{ background: style.hex }} />
            {style.label}
          </span>
        )}
      </div>
      <div className="tabular mt-2.5 text-xs text-white/65">
        {Math.round(total.coverage * 100)}% scored
        {total.notYetDueShare > 0 && ` · ${Math.round(total.notYetDueShare * 100)}% not due`}
        {total.proratedShare > 0 && ` · ${Math.round(total.proratedShare * 100)}% pro-rated`}
      </div>
    </section>
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
