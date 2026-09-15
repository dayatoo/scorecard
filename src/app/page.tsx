import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { IssueBanner } from "@/components/IssueBanner";
import { PeriodPicker } from "@/components/PeriodPicker";
import { ScoreTree, type TreeRow } from "@/components/ScoreTree";
import { bandStyle, type BandStyle } from "@/lib/band-style";
import { formatPeriodLabel, periodsOfFiscalYear } from "@/lib/fiscal";
import { flattenTree, isKpiComplete, leavesOf } from "@/lib/kpi-tree";
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
    params.dueMode === "assume-meet-decay" ? "assume-meet-decay" : DEFAULT_SCORING_OPTIONS.dueMode;
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

  const leaves = leavesOf(scorecard.roots);
  const proratedCount = leaves.filter((n) => n.prorated).length;
  const estimateCount = leaves.filter((n) => n.provisional).length;
  const completeCount = leaves.filter((n) => isKpiComplete(n, period)).length;
  const assumedCount = leaves.filter((n) => n.assumed).length;

  const lightText = style?.text !== "dark";
  const textClass = lightText ? "text-white" : "text-gray-900";
  const eyebrowClass = lightText ? "text-white/70" : "text-gray-900/60";

  const scoredLabel = `${total.scoredLeafCount}/${total.leafCount} KPIs scored`;
  const flagLabels = [
    proratedCount > 0 ? `${proratedCount} pro-rated` : null,
    estimateCount > 0 ? `${estimateCount} estimate${estimateCount === 1 ? "" : "s"}` : null,
    completeCount > 0 ? `${completeCount} complete` : null,
    assumedCount > 0 ? `${assumedCount} assumed` : null,
  ].filter((label): label is string => label !== null);

  return (
    <section
      className={`relative overflow-hidden rounded-2xl p-7 shadow-sm ${textClass}`}
      style={{
        background: style
          ? style.hex
          : "radial-gradient(480px 260px at 88% -20%, rgba(32,176,236,0.35), transparent 65%), " +
            "linear-gradient(155deg, #04336A 0%, #032853 55%, #021A38 100%)",
      }}
    >
      {/* A faint sheen over the flat band color, echoing the highlight the
          fixed navy gradient used to carry, so a solid color doesn't read as
          a plain paint swatch. */}
      {style && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(480px 260px at 88% -20%, rgba(255,255,255,${lightText ? 0.22 : 0.35}), transparent 65%)`,
          }}
        />
      )}
      <div className="relative">
        <div className={`text-xs font-bold tracking-widest uppercase ${eyebrowClass}`}>
          Total score — {formatPeriodLabel(period)}
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-3.5">
          <span className="font-heading text-5xl font-extrabold">
            {total.score !== null ? total.score.toFixed(1) : "—"}
          </span>
          {style && <span className="text-3xl font-bold opacity-90">{style.label}</span>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <HeroPill style={style}>{scoredLabel}</HeroPill>
          {flagLabels.length > 0 && (
            <span className={`mx-0.5 h-4 w-px ${lightText ? "bg-white/50" : "bg-gray-900/35"}`} />
          )}
          {flagLabels.map((label) => (
            <HeroPill key={label} style={style}>
              {label}
            </HeroPill>
          ))}
        </div>
      </div>
    </section>
  );
}

/** A coverage-stat pill on the hero: tinted with the band's own color when
    there is one, or a plain translucent chip on the fallback navy gradient. */
function HeroPill({ style, children }: { style: BandStyle | null; children: React.ReactNode }) {
  if (!style) {
    return (
      <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white/85">
        {children}
      </span>
    );
  }
  return (
    <span
      className="rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide text-gray-900"
      style={{ background: style.pillTint, borderColor: style.pillBorder }}
    >
      {children}
    </span>
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
  assumed,
  footer,
  href,
}: {
  label: string;
  score: number | null;
  band: Band | null;
  provisional?: boolean;
  prorated?: boolean;
  assumed?: boolean;
  footer?: React.ReactNode;
  href?: string;
}) {
  const style = bandStyle(band);
  const lightText = style ? style.text !== "dark" : false;
  const textClass = !style ? "text-gray-400" : lightText ? "text-white" : "text-gray-900";
  const mutedClass = !style ? "text-gray-400" : lightText ? "text-white/80" : "text-gray-900/75";

  const inner = (
    <>
      <div className={`truncate text-xs font-medium ${mutedClass}`} title={label}>
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="tabular text-2xl font-semibold">
          {score !== null ? score.toFixed(1) : "—"}
          {provisional && <sup className="ml-0.5 text-[0.6em] font-normal opacity-90">est</sup>}
          {prorated && <sup className="ml-0.5 text-[0.6em] font-normal opacity-90">pro</sup>}
          {assumed && <sup className="ml-0.5 text-[0.6em] font-normal opacity-90">asm</sup>}
        </span>
        {style && <span className="text-sm font-bold">{style.label}</span>}
      </div>
      <div className={`mt-2 text-xs ${mutedClass}`}>{footer}</div>
    </>
  );

  const className = `rounded-lg px-4 py-3 ${!style ? "bg-gray-200" : ""} ${textClass}`;
  const bg = style ? { background: style.hex } : undefined;
  return href ? (
    <Link href={href} className={`${className} block hover:brightness-95`} style={bg}>
      {inner}
    </Link>
  ) : (
    <div className={className} style={bg}>
      {inner}
    </div>
  );
}
