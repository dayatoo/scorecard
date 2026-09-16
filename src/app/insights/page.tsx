import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { PeriodPicker } from "@/components/PeriodPicker";
import { bandStyle } from "@/lib/band-style";
import { getScorecard, listFiscalYears } from "@/lib/data";
import { formatPeriodLabel, periodsOfFiscalYear } from "@/lib/fiscal";
import { computeOpportunities, computeRisks, type Opportunity, type Risk } from "@/lib/insights";
import { flattenTree, leavesOf } from "@/lib/kpi-tree";
import { roundScore } from "@/lib/scoring";
import { requireAuthPage } from "@/lib/session";

export const metadata = { title: "Insights — KPI Scorecard" };

export const dynamic = "force-dynamic";

const TOP_N = 10;

export default async function InsightsPage({ searchParams }: PageProps<"/insights">) {
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
          description="Create a fiscal year, then import your KPI hierarchy from a spreadsheet to get started."
          actionHref="/manage"
          actionLabel="Set up a fiscal year"
        />
      </div>
    );
  }

  if (flattenTree(scorecard.roots).length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <EmptyState
          title={`${scorecard.fiscalYear.label} has no KPIs yet`}
          description="Import your Strategic Goals, KPIs and sub-KPIs from a spreadsheet to see insights here."
          actionHref="/import"
          actionLabel="Import KPIs"
        />
      </div>
    );
  }

  const trailingScores = new Map<string, (number | null)[]>();
  for (const leaf of leavesOf(scorecard.roots)) {
    trailingScores.set(
      leaf.id,
      scorecard.periods.map((p) => scorecard.scoresByPeriod.get(p)?.get(leaf.id)?.score ?? null)
    );
  }

  const opportunities = computeOpportunities(scorecard.roots, scorecard.total);
  const risks = computeRisks(scorecard.roots, scorecard.total, trailingScores);

  const topOpportunities = opportunities.slice(0, TOP_N);
  const topRisks = risks.slice(0, TOP_N);

  const projectedImpact = topOpportunities.reduce((sum, o) => sum + o.scoreImpact, 0);
  const projectedTotal =
    scorecard.total.exactScore !== null ? roundScore(scorecard.total.exactScore + projectedImpact) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Insights</h1>
          <p className="mt-0.5 text-sm text-gray-600">
            {scorecard.fiscalYear.label} · {formatPeriodLabel(scorecard.period)} — the biggest levers to raise the
            total score, and the KPIs most exposed to losing ground.
          </p>
        </div>
        <PeriodPicker
          period={scorecard.period}
          periods={periodsOfFiscalYear(scorecard.fiscalYear.startYear)}
          fiscalYears={fiscalYears}
          fiscalYearId={scorecard.fiscalYear.id}
        />
      </div>

      <TotalSummary
        score={scorecard.total.score}
        band={scorecard.total.band}
        projectedTotal={projectedTotal}
        opportunityCount={topOpportunities.length}
      />

      <OpportunitiesTable opportunities={topOpportunities} totalCount={opportunities.length} period={scorecard.period} />
      <RisksTable risks={topRisks} totalCount={risks.length} period={scorecard.period} />

      <HowThisWorks />
    </div>
  );
}

function TotalSummary({
  score,
  band,
  projectedTotal,
  opportunityCount,
}: {
  score: number | null;
  band: string | null;
  projectedTotal: number | null;
  opportunityCount: number;
}) {
  const style = bandStyle(band as Parameters<typeof bandStyle>[0]);
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white px-5 py-4">
      <div>
        <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Current total</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="tabular text-2xl font-bold text-gray-900">{score !== null ? score.toFixed(1) : "—"}</span>
          {style && <span className="text-sm font-bold" style={{ color: style.hex }}>{style.label}</span>}
        </div>
      </div>
      {projectedTotal !== null && opportunityCount > 0 && (
        <div className="border-l border-gray-200 pl-4">
          <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            If the top {opportunityCount} opportunities below are closed
          </div>
          <div className="mt-1 tabular text-2xl font-bold text-gray-900">{projectedTotal.toFixed(1)}</div>
        </div>
      )}
    </section>
  );
}

function OpportunitiesTable({
  opportunities,
  totalCount,
  period,
}: {
  opportunities: Opportunity[];
  totalCount: number;
  period: string;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Biggest opportunities</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Ranked by exact effect on the total score if each KPI reaches its next band.
        </p>
      </div>
      {opportunities.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500">Nothing to improve — every scored KPI is already Excellent.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
              <th className="px-4 py-2">KPI</th>
              <th className="px-4 py-2">Band</th>
              <th className="px-4 py-2">Needed for next band</th>
              <th className="px-4 py-2 text-right">Impact on total</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((o) => (
              <tr key={o.kpiId} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/kpi/${o.kpiId}?period=${period}`} className="font-medium text-blue-700 hover:underline">
                    {o.name}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <BandArrow from={o.currentBand} to={o.nextBand} />
                </td>
                <td className="px-4 py-2 text-gray-700">{o.targetDescription ?? "—"}</td>
                <td className="tabular px-4 py-2 text-right font-semibold text-green-700">
                  +{o.scoreImpact.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {totalCount > opportunities.length && (
        <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
          {totalCount - opportunities.length} more not shown.
        </p>
      )}
    </section>
  );
}

function RisksTable({ risks, totalCount, period }: { risks: Risk[]; totalCount: number; period: string }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">At risk of dropping</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Ranked by how much of the total is exposed if each KPI falls into the band below.
        </p>
      </div>
      {risks.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500">Nothing is close to dropping a band right now.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
              <th className="px-4 py-2">KPI</th>
              <th className="px-4 py-2">Band</th>
              <th className="px-4 py-2">Headroom</th>
              <th className="px-4 py-2">Trend</th>
              <th className="px-4 py-2 text-right">Impact if it drops</th>
            </tr>
          </thead>
          <tbody>
            {risks.map((r) => (
              <tr key={r.kpiId} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/kpi/${r.kpiId}?period=${period}`} className="font-medium text-blue-700 hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <BandPill band={r.currentBand} />
                </td>
                <td className="tabular px-4 py-2 text-gray-700">
                  {r.metricHeadroom ? (
                    <>
                      {r.metricHeadroom.distance.toLocaleString()}
                      {r.metricHeadroom.unit && <span className="ml-0.5 text-gray-400">{r.metricHeadroom.unit}</span>}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2">
                  <TrendLabel trend={r.trend} monthsToDrop={r.monthsToDrop} />
                </td>
                <td className="tabular px-4 py-2 text-right font-semibold text-red-700">
                  {r.dropImpact.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {totalCount > risks.length && (
        <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">{totalCount - risks.length} more not shown.</p>
      )}
    </section>
  );
}

function BandPill({ band }: { band: string }) {
  const style = bandStyle(band as Parameters<typeof bandStyle>[0]);
  if (!style) return <span className="text-gray-400">—</span>;
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${style.chip}`}>{style.label}</span>;
}

function BandArrow({ from, to }: { from: string; to: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <BandPill band={from} />
      <span className="text-gray-400">→</span>
      <BandPill band={to} />
    </span>
  );
}

function TrendLabel({ trend, monthsToDrop }: { trend: Risk["trend"]; monthsToDrop: number | null }) {
  switch (trend) {
    case "SLIPPING_MILESTONE":
      return <span className="text-amber-700">Slipping — scores lower every day it stays incomplete</span>;
    case "DECLINING":
      return (
        <span className="text-red-700">
          Declining{monthsToDrop !== null ? ` — ~${monthsToDrop.toFixed(1)} periods to drop` : ""}
        </span>
      );
    case "IMPROVING":
      return <span className="text-green-700">Improving</span>;
    case "STABLE":
      return <span className="text-gray-500">Stable</span>;
    default:
      return <span className="text-gray-400">Not enough history</span>;
  }
}

function HowThisWorks() {
  return (
    <details className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
      <summary className="cursor-pointer font-medium text-gray-900">How this is calculated</summary>
      <div className="mt-2 space-y-2">
        <p>
          The total score is a weighted average of every scored KPI, using each KPI&apos;s share of the whole
          company. Because that average only ever renormalizes over KPIs that have a score, moving one KPI&apos;s
          score changes the total by exactly that KPI&apos;s share — no simulation or estimate involved, and moving
          several KPIs at once adds up exactly, with no interaction between them.
        </p>
        <p>
          This ranks purely by that effect on the total. It does not yet know how hard any of these are to
          achieve — a small, easy win and a large, difficult one can show the same impact here.
        </p>
      </div>
    </details>
  );
}
