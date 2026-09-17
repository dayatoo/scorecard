import Link from "next/link";

import { ReportPrintButton } from "@/components/report/ReportPrintButton";
import { bandStyle } from "@/lib/band-style";
import { formatPeriodLabel } from "@/lib/fiscal";
import { ancestorsOf, flattenTree, leavesOf, type ScoredNode } from "@/lib/kpi-tree";
import { getScorecard } from "@/lib/data";
import { BAND_BOUNDS, BANDS, MAX_SCORE, type Band } from "@/lib/scoring";
import { requireAuthPage } from "@/lib/session";
import { describeMeetTarget } from "@/lib/targets";

export const metadata = { title: "Board Report — KPI Scorecard" };
export const dynamic = "force-dynamic";

const PENDING_LABELS: Record<string, string> = {
  NOT_YET_DUE: "Not yet due",
  NO_DATA: "No figure reported",
};

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const fiscalYearId = typeof params.fy === "string" ? params.fy : undefined;
  const period = typeof params.period === "string" ? params.period : undefined;

  const [, scorecard] = await Promise.all([
    requireAuthPage(),
    getScorecard({ fiscalYearId, period }),
  ]);

  if (!scorecard) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-sm text-gray-600">
          No scorecard to report on yet. <Link href="/" className="underline">Go to the Dashboard</Link> to
          set up a fiscal year first.
        </p>
      </div>
    );
  }

  const total = scorecard.total;
  const highlights = highlightsOf(scorecard.roots, scorecard.byId);
  const lowlights = lowlightsOf(scorecard.roots, scorecard.byId);
  const generatedAt = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="bg-[#faf8f4] pb-20 text-[#1c2129] print:bg-white print:pb-0">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap"
      />

      <div className="print:hidden mx-auto flex max-w-[920px] flex-wrap items-end justify-between gap-4 border-b border-[#e3dfd6] px-5 pt-10 pb-7">
        <div>
          <h1 className="text-[1.15rem] font-semibold" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
            Board report — {scorecard.fiscalYear.label}
          </h1>
          <p className="mt-1 max-w-[46ch] text-[0.85rem] text-[#5b6472]">
            A one-page executive summary plus a detailed appendix, generated from the live scorecard for{" "}
            {formatPeriodLabel(scorecard.period)}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Dashboard
          </Link>
          <ReportPrintButton />
        </div>
      </div>

      <div className="mx-auto max-w-[920px] px-5 pt-9 print:max-w-none print:px-0 print:pt-0">
        {/* ============ ONE-PAGER ============ */}
        <article
          className="report-page mb-9 rounded-[2px] border border-[#e3dfd6] bg-white px-14 pt-13 pb-11 shadow-[0_1px_2px_rgba(20,20,20,0.04),0_12px_32px_-16px_rgba(20,20,20,0.18)] print:mb-0 print:break-after-page print:border-0 print:px-0 print:py-0 print:shadow-none"
          style={{ fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif" }}
        >
          <Masthead
            fiscalYearLabel={scorecard.fiscalYear.label}
            period={scorecard.period}
            right={<div>Generated {generatedAt}</div>}
          />

          <p className="mb-1.5 text-[0.7rem] font-semibold tracking-[0.16em] text-[#0d3b66] uppercase">
            Executive summary
          </p>
          <h2
            className="mb-6 text-[1.6rem] font-semibold text-balance"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            Corporate scorecard — {formatPeriodLabel(scorecard.period)}
          </h2>

          <TotalScoreGauge score={total.score} band={total.band} />

          <div className="mt-4 flex flex-wrap gap-5">
            <Stat label="KPIs reported" value={`${total.scoredLeafCount} / ${total.leafCount}`} />
            <Stat label="coverage" value={`${Math.round(total.coverage * 100)}%`} />
            <Stat
              label="not yet due"
              value={`${Math.round(total.notYetDueShare * 100)}%`}
            />
          </div>

          <SectionHead title="Strategic goals" subtitle="Weighted contribution to total score" />
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {scorecard.roots.map((goal) => (
              <SgCard key={goal.id} goal={goal} />
            ))}
          </div>

          <SectionHead
            title="Highlights & lowlights"
            subtitle={`For ${formatPeriodLabel(scorecard.period)} only`}
          />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <h4 className="text-[0.78rem] font-semibold tracking-[0.06em] text-[#1e6b34] uppercase">
                  Highlights
                </h4>
                <span className="font-mono text-[0.72rem] text-[#8b93a1]">{highlights.length}</span>
              </div>
              <div className="border-t border-[#ecebe6]">
                {highlights.length === 0 ? (
                  <p className="py-4 text-sm text-[#8b93a1]">No KPIs scored Meet or better this period.</p>
                ) : (
                  highlights.map((item, i) => <IssueRow key={item.node.id} rank={i + 1} {...item} />)
                )}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <h4 className="text-[0.78rem] font-semibold tracking-[0.06em] text-[#a13a1f] uppercase">
                  Lowlights
                </h4>
                <span className="font-mono text-[0.72rem] text-[#8b93a1]">{lowlights.length}</span>
              </div>
              <div className="border-t border-[#ecebe6]">
                {lowlights.length === 0 ? (
                  <p className="py-4 text-sm text-[#8b93a1]">
                    No KPIs scored Improvement Needed or Poor this period.
                  </p>
                ) : (
                  lowlights.map((item, i) => <IssueRow key={item.node.id} rank={i + 1} {...item} />)
                )}
              </div>
            </div>
          </div>

          <PageFooter label="Scorecard — generated report, 1 of 2" />
        </article>

        {/* ============ APPENDIX ============ */}
        <article
          className="report-page mb-9 rounded-[2px] border border-[#e3dfd6] bg-white px-14 pt-13 pb-11 shadow-[0_1px_2px_rgba(20,20,20,0.04),0_12px_32px_-16px_rgba(20,20,20,0.18)] print:mb-0 print:border-0 print:px-0 print:py-0 print:shadow-none"
          style={{ fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif" }}
        >
          <Masthead
            fiscalYearLabel={scorecard.fiscalYear.label}
            period={scorecard.period}
            right={<div>Period: {formatPeriodLabel(scorecard.period)}</div>}
            eyebrow="Appendix A · Full KPI detail"
          />

          <p className="mb-1.5 text-[0.7rem] font-semibold tracking-[0.16em] text-[#0d3b66] uppercase">
            Appendix A
          </p>
          <h2
            className="mb-2 text-[1.6rem] font-semibold text-balance"
            style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}
          >
            Full KPI tree — current period
          </h2>
          <p className="mb-4 max-w-[62ch] text-[0.76rem] text-[#5b6472]">
            Every Strategic Goal, sub-goal and leaf KPI as scored for the period above, with its
            reporting weight and figure. Trailing months and alternate scoring modes are omitted
            here — see the live Dashboard to explore those.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[0.8rem]">
              <thead>
                <tr>
                  <th className="w-[46%] border-b border-[#1c2129] px-2 pb-2 text-left text-[0.66rem] font-semibold tracking-[0.06em] text-[#8b93a1] uppercase">
                    Strategic goal / KPI
                  </th>
                  <th className="w-[9%] border-b border-[#1c2129] px-2 pb-2 text-right text-[0.66rem] font-semibold tracking-[0.06em] text-[#8b93a1] uppercase">
                    Weight
                  </th>
                  <th className="w-[24%] border-b border-[#1c2129] px-2 pb-2 text-left text-[0.66rem] font-semibold tracking-[0.06em] text-[#8b93a1] uppercase">
                    Figure
                  </th>
                  <th className="w-[9%] border-b border-[#1c2129] px-2 pb-2 text-right text-[0.66rem] font-semibold tracking-[0.06em] text-[#8b93a1] uppercase">
                    Score
                  </th>
                  <th className="w-[12%] border-b border-[#1c2129] px-2 pb-2 text-left text-[0.66rem] font-semibold tracking-[0.06em] text-[#8b93a1] uppercase">
                    Band
                  </th>
                </tr>
              </thead>
              <tbody>
                {flattenTree(scorecard.roots).map((node) => (
                  <AppendixRow key={node.id} node={node} />
                ))}
              </tbody>
            </table>
          </div>

          <PageFooter label="Scorecard — generated report, 2 of 2" />
        </article>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 16mm; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Masthead({
  fiscalYearLabel,
  period,
  right,
  eyebrow,
}: {
  fiscalYearLabel: string;
  period: string;
  right: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6.5 flex items-start justify-between gap-4 border-b-2 border-[#1c2129] pb-4.5">
      <div className="text-2xl font-bold" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
        BELTS
        <span className="mt-0.5 block text-[0.7rem] font-medium tracking-[0.14em] text-[#8b93a1] uppercase">
          Board Performance Report
        </span>
      </div>
      <div className="text-right text-[0.78rem] leading-[1.55] text-[#5b6472]">
        {eyebrow ? (
          <div>{eyebrow}</div>
        ) : (
          <div>
            <strong className="font-semibold text-[#1c2129]">{fiscalYearLabel}</strong> ·{" "}
            {formatPeriodLabel(period)}
          </div>
        )}
        {right}
      </div>
    </div>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mt-7.5 mb-3 flex items-baseline justify-between">
      <h3 className="text-base font-semibold" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>
        {title}
      </h3>
      <span className="text-[0.72rem] text-[#8b93a1]">{subtitle}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-[0.76rem] text-[#5b6472]">
      <strong className="block font-mono text-[0.95rem] font-semibold text-[#1c2129]">{value}</strong>
      {label}
    </div>
  );
}

function PageFooter({ label }: { label: string }) {
  return (
    <div className="mt-8.5 flex justify-between border-t border-[#e3dfd6] pt-3.5 text-[0.68rem] text-[#8b93a1]">
      <span>{label}</span>
      <span>Confidential — board distribution only</span>
    </div>
  );
}

/** Score gauge: a linear 0–5 scale segmented by real band boundaries, with the
    Meet target marked mid-scale rather than at the far end — so the layout
    itself doesn't imply 5.0 is "full marks" and Meet is merely partial credit. */
function TotalScoreGauge({ score, band }: { score: number | null; band: Band | null }) {
  const style = bandStyle(band);
  const bounds = BANDS.map((b) => BAND_BOUNDS[b].lo);
  const segments = BANDS.map((b, i) => {
    const from = bounds[i];
    const to = i + 1 < bounds.length ? bounds[i + 1] : MAX_SCORE;
    return { band: b, widthPct: ((to - from) / MAX_SCORE) * 100 };
  });
  const targetPct = (BAND_BOUNDS.MEET.lo / MAX_SCORE) * 100;
  const markerPct = score !== null ? Math.min(100, (score / MAX_SCORE) * 100) : null;

  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        {style && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold tracking-[0.04em] text-white uppercase"
            style={{ backgroundColor: style.hex }}
          >
            {style.label}
          </span>
        )}
        <span className="flex items-baseline gap-1 font-mono">
          <span className="text-[1.6rem] font-semibold" style={{ color: style?.hex ?? "#1c2129" }}>
            {score !== null ? score.toFixed(1) : "—"}
          </span>
          <span className="text-[0.72rem] text-[#8b93a1]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            on the 6-band scale
          </span>
        </span>
      </div>

      <div className="rounded-xl border border-[#e3dfd6] bg-[#eef2f6] px-6 py-5">
        <p className="mb-4 max-w-[64ch] text-[0.85rem] text-[#5b6472]">
          Performance is measured against the Meet target, not against a 100% ceiling — bands past
          it (Good, Very Good, Excellent) represent exceeding target, not extra credit toward 5.0.
        </p>

        <div className="relative pt-5.5">
          <div className="absolute top-3.5 bottom-0 w-0 border-l-2 border-dashed border-[#1c2129]" style={{ left: `${targetPct}%` }}>
            <span className="absolute -top-5.5 left-1/2 -translate-x-1/2 text-[0.62rem] font-semibold tracking-[0.04em] whitespace-nowrap text-[#1c2129] uppercase">
              Target · Meet
            </span>
          </div>
          {markerPct !== null && (
            <div className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-0.5" style={{ left: `${markerPct}%` }}>
              <span className="rounded-[3px] bg-[#1c2129] px-1.5 py-px font-mono text-[0.72rem] font-semibold whitespace-nowrap text-white">
                {score?.toFixed(1)}
              </span>
              <span className="mt-[-1px] h-0 w-0 border-t-[5px] border-r-[4px] border-l-[4px] border-t-[#1c2129] border-r-transparent border-l-transparent" />
            </div>
          )}
          <div className="flex h-3.5 overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
            {segments.map((seg) => (
              <span key={seg.band} style={{ width: `${seg.widthPct}%`, backgroundColor: bandStyle(seg.band)?.hex }} />
            ))}
          </div>
          <div className="mt-1.5 flex">
            {segments.map((seg) => (
              <span key={seg.band} className="text-center text-[0.62rem] text-[#8b93a1]" style={{ width: `${seg.widthPct}%` }}>
                {BAND_BOUNDS[seg.band].label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SgCard({ goal }: { goal: ScoredNode }) {
  const style = bandStyle(goal.band);
  const color = style?.hex ?? "#0d3b66";
  const fillPct = goal.score !== null ? Math.min(100, (goal.score / MAX_SCORE) * 100) : 0;

  return (
    <div className="rounded-[3px] border border-[#e3dfd6] py-3.5 pr-4 pl-4" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="mb-0.5 flex items-baseline justify-between gap-2.5">
        <span className="text-[0.88rem] font-semibold">
          {goal.code} — {goal.name}
        </span>
        <span className="font-mono text-base font-semibold" style={{ color }}>
          {goal.score !== null ? goal.score.toFixed(1) : "—"}
        </span>
      </div>
      <div className="mb-2 text-[0.72rem] text-[#8b93a1]">{goal.globalWeight.toFixed(0)}% of total score</div>
      <div className="mb-2 h-[5px] overflow-hidden rounded-[3px] bg-[#ecebe6]">
        <span className="block h-full" style={{ width: `${fillPct}%`, backgroundColor: color }} />
      </div>
      <div className="flex flex-col gap-1">
        {goal.children.map((child) => {
          const childStyle = bandStyle(child.band);
          return (
            <div key={child.id} className="flex justify-between text-[0.76rem] text-[#5b6472]">
              <span className="truncate pr-2">{child.name}</span>
              <b className="font-mono font-semibold" style={{ color: childStyle?.hex ?? "#8b93a1" }}>
                {child.score !== null ? child.score.toFixed(1) : "—"}
              </b>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Issue = { node: ScoredNode; path: string; note: string };

const HIGHLIGHT_BANDS: Band[] = ["MEET", "GOOD", "VERY_GOOD", "EXCELLENT"];
const LOWLIGHT_BANDS: Band[] = ["IMPROVEMENT_NEEDED", "POOR"];

function highlightsOf(roots: ScoredNode[], byId: Map<string, ScoredNode>): Issue[] {
  return leavesOf(roots)
    .filter((n) => n.score !== null && n.band !== null && HIGHLIGHT_BANDS.includes(n.band))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((node) => ({
      node,
      path: ancestorsOf(node, byId)
        .map((a) => a.name)
        .join(" › "),
      note: describeIssueNote(node),
    }));
}

function lowlightsOf(roots: ScoredNode[], byId: Map<string, ScoredNode>): Issue[] {
  return leavesOf(roots)
    .filter((n) => n.score !== null && n.band !== null && LOWLIGHT_BANDS.includes(n.band))
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .map((node) => ({
      node,
      path: ancestorsOf(node, byId)
        .map((a) => a.name)
        .join(" › "),
      note: describeIssueNote(node),
    }));
}

function describeIssueNote(node: ScoredNode): string {
  if (node.leaf?.pendingReason && node.leaf.pendingReason in PENDING_LABELS) {
    return PENDING_LABELS[node.leaf.pendingReason];
  }
  if (node.metricType === "MONTH_COMPLETION") {
    const target = describeMeetTarget(node.targetConfig, node.metricType);
    return target ? `Target: ${target}` : "Milestone in progress";
  }
  const value = node.leaf?.value;
  if (value === null || value === undefined) return "No figure reported";
  const unit = node.unit ? ` ${node.unit}` : "";
  const target = describeMeetTarget(node.targetConfig, node.metricType);
  return `${value.toLocaleString()}${unit}${target ? ` vs. target ${target}${unit}` : ""}`;
}

function IssueRow({ rank, node, path, note }: Issue & { rank: number }) {
  const style = bandStyle(node.band);
  return (
    <div className="grid grid-cols-[26px_1fr_auto] items-center gap-3 border-b border-[#ecebe6] py-2.5">
      <span className="font-mono text-[0.72rem] font-semibold text-[#8b93a1]">
        {String(rank).padStart(2, "0")}
      </span>
      <div>
        <div className="text-[0.86rem] font-medium">{node.name}</div>
        <div className="mt-0.5 text-[0.72rem] text-[#8b93a1]">{path}</div>
      </div>
      <div className="text-right">
        <span
          className="inline-flex items-center gap-1.5 rounded-[3px] px-2 py-0.5 font-mono text-[0.82rem] font-semibold text-white"
          style={{ backgroundColor: style?.hex ?? "#d1d5db", color: style?.text === "dark" ? "#1c2129" : "white" }}
        >
          {node.score !== null ? node.score.toFixed(1) : "—"}
        </span>
        <span className="mt-0.5 block text-[0.68rem] text-[#8b93a1]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {note}
        </span>
      </div>
    </div>
  );
}

function AppendixRow({ node }: { node: ScoredNode }) {
  const style = bandStyle(node.band);
  const isRoot = node.level === 1;
  const indent = isRoot ? 0 : (node.level - 1) * 16;

  const figure = (() => {
    if (!node.isLeaf) return "—";
    if (node.metricType === "MONTH_COMPLETION") {
      return node.leaf?.completionDate
        ? `Completed ${new Date(node.leaf.completionDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
        : describeMeetTarget(node.targetConfig, node.metricType) ?? "In progress";
    }
    if (node.leaf?.value === null || node.leaf?.value === undefined) return "—";
    const target = describeMeetTarget(node.targetConfig, node.metricType);
    const unit = node.unit ? ` ${node.unit}` : "";
    return `${node.leaf.value.toLocaleString()}${unit}${target ? ` / ${target}${unit}` : ""}`;
  })();

  return (
    <tr className={isRoot ? "bg-[#eef2f6]" : ""}>
      <td
        className={`border-b border-[#ecebe6] py-2 pr-2 pl-2 ${isRoot ? "font-bold" : "font-normal"} ${!node.isLeaf && !isRoot ? "font-semibold" : ""}`}
        style={{ paddingLeft: 8 + indent, color: node.isLeaf && !isRoot ? "#5b6472" : undefined }}
        colSpan={isRoot ? 2 : 1}
      >
        {isRoot ? `${node.code} — ${node.name}` : node.name}
      </td>
      {!isRoot && (
        <td className="border-b border-[#ecebe6] px-2 py-2 text-right text-[#8b93a1]">
          {node.weight.toFixed(node.weight % 1 === 0 ? 0 : 1)}%
        </td>
      )}
      <td className="border-b border-[#ecebe6] px-2 py-2 font-mono">{figure}</td>
      <td className="border-b border-[#ecebe6] px-2 py-2 text-right font-mono">
        {node.score !== null ? node.score.toFixed(1) : "—"}
      </td>
      <td className="border-b border-[#ecebe6] px-2 py-2">
        {node.band && style && (
          <span
            className="inline-flex min-w-9.5 items-center justify-center rounded-[3px] px-1.5 py-0.5 font-mono text-[0.78rem] font-semibold text-white"
            style={{ backgroundColor: style.hex, color: style.text === "dark" ? "#1c2129" : "white" }}
          >
            {node.score?.toFixed(1)}
          </span>
        )}
      </td>
    </tr>
  );
}
