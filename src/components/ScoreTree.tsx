"use client";

import Link from "next/link";
import { useState } from "react";

import { BandTargetCells, BandTargetHeaderCells } from "./BandColumns";
import { CoverageBadge, ScoreCell } from "./ScoreCell";
import { formatDateAbbrev } from "@/lib/dates";
import { formatPeriodShort } from "@/lib/fiscal";
import { BANDS, type Band, type MetricType } from "@/lib/scoring";

export type TreeRow = {
  id: string;
  code: string;
  name: string;
  subGroup: string | null;
  level: number;
  isLeaf: boolean;
  weight: number;
  parentId: string | null;
  departments: string[];
  meetTarget: string | null;
  bandTargets: Record<Band, string | null>;
  unit: string | null;
  metricType: MetricType | null;
  /** The KPI's own reported year-to-date figure, shown next to Meet Target. */
  value: number | null;
  /** MONTH_COMPLETION only — the recorded completion date, as an ISO string. */
  completionDate: string | null;
  basis: "ACTUAL" | "ESTIMATE" | null;
  /** Score per period, keyed by period. */
  scores: Record<
    string,
    {
      score: number | null;
      band: Band | null;
      coverage: number;
      provisional: boolean;
      prorated: boolean;
      assumed: boolean;
      notYetDueShare: number;
      leafCount: number;
      scoredLeafCount: number;
    }
  >;
  pendingReason: string | null;
};

/**
 * The scorecard hierarchy: Strategic Goals expandable down to the lowest KPI,
 * with the reporting month and the three before it side by side.
 *
 * Strategic Goals start open and everything below starts collapsed — about a
 * hundred leaf KPIs is far too many to face at once, and the Goals are what
 * the scorecard is read at.
 */
export function ScoreTree({
  rows,
  periods,
  currentPeriod,
  total,
}: {
  rows: TreeRow[];
  periods: string[];
  currentPeriod: string;
  total: {
    scores: Record<
      string,
      {
        score: number | null;
        band: Band | null;
        coverage: number;
        provisional: boolean;
        prorated: boolean;
        assumed: boolean;
        notYetDueShare: number;
        leafCount: number;
        scoredLeafCount: number;
      }
    >;
  };
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(rows.filter((r) => r.level === 1).map((r) => r.id))
  );
  const [showBands, setShowBands] = useState(false);
  // The three months before the current one start hidden — a KPI list reads
  // as "where do we stand now," and the trailing months are for comparison
  // once asked for, not clutter on every load.
  const [showTrailingMonths, setShowTrailingMonths] = useState(false);
  const visiblePeriods = showTrailingMonths ? periods : periods.filter((p) => p === currentPeriod);

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const hasChildren = new Set(rows.map((r) => r.parentId).filter(Boolean) as string[]);
  const byId = new Map(rows.map((r) => [r.id, r]));

  // A row shows only when every ancestor above it is expanded.
  const visible = rows.filter((row) => {
    let parentId = row.parentId;
    while (parentId) {
      if (!expanded.has(parentId)) return false;
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return true;
  });

  const allExpanded = expanded.size >= hasChildren.size;

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-2">
        <h2 className="font-heading text-sm font-bold text-gray-700">Scorecard</h2>
        <div className="flex items-center gap-3">
          {periods.length > 1 && (
            <button
              type="button"
              onClick={() => setShowTrailingMonths((v) => !v)}
              aria-expanded={showTrailingMonths}
              className="text-xs font-medium text-blue-700 hover:text-blue-900"
            >
              {showTrailingMonths ? "Hide past months" : "Show past 3 months"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowBands((v) => !v)}
            className="text-xs font-medium text-blue-700 hover:text-blue-900"
          >
            {showBands ? "Hide bands" : "Show all bands"}
          </button>
          <button
            type="button"
            onClick={() =>
              setExpanded(allExpanded ? new Set() : new Set(hasChildren))
            }
            className="text-xs font-medium text-blue-700 hover:text-blue-900"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
              <th scope="col" className="px-4 py-2">KPI</th>
              <th scope="col" className="px-2 py-2 text-right">Weight</th>
              {showBands ? (
                <BandTargetHeaderCells className="px-2 py-2 text-right" />
              ) : (
                <th scope="col" className="px-2 py-2 text-right">Meet Target</th>
              )}
              <th scope="col" className="px-2 py-2 text-right">YTD/LE</th>
              {visiblePeriods.map((period) => (
                <th
                  key={period}
                  scope="col"
                  className={`px-2 py-2 text-center ${period === currentPeriod ? "text-gray-900" : ""}`}
                >
                  {formatPeriodShort(period)}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-right">Scored</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const expandable = hasChildren.has(row.id);
              const isOpen = expanded.has(row.id);
              const current = row.scores[currentPeriod];

              return (
                <tr
                  key={row.id}
                  className={`border-b last:border-0 hover:bg-blue-50/40 ${
                    row.level === 1 ? "bg-blue-50/70 font-medium" : ""
                  }`}
                >
                  <th scope="row" className="px-4 py-1.5 text-left font-normal">
                    <div
                      className="flex items-center gap-1.5"
                      style={{ paddingLeft: `${(row.level - 1) * 1.25}rem` }}
                    >
                      {expandable ? (
                        <button
                          type="button"
                          onClick={() => toggle(row.id)}
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? "Collapse" : "Expand"} ${row.name}`}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                        >
                          <span aria-hidden className="text-[0.65rem]">
                            {isOpen ? "▼" : "▶"}
                          </span>
                        </button>
                      ) : (
                        <span className="w-5 shrink-0" />
                      )}
                      <Link
                        href={`/kpi/${row.id}?period=${currentPeriod}`}
                        className={`hover:text-blue-700 hover:underline ${
                          row.level === 1 ? "font-semibold" : ""
                        }`}
                      >
                        <span className="font-mono text-xs text-gray-400">{row.code}</span>{" "}
                        {row.name}
                      </Link>
                      {row.subGroup && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          {row.subGroup}
                        </span>
                      )}
                    </div>
                  </th>

                  <td className="tabular px-2 py-1.5 text-right text-xs text-gray-500">
                    {row.weight > 0 ? `${row.weight.toFixed(1)}%` : "—"}
                  </td>

                  {showBands ? (
                    <BandTargetCells
                      bandTargets={row.bandTargets}
                      unit={row.unit}
                      metricType={row.metricType}
                      className="tabular px-2 py-1.5 text-right text-xs text-gray-500"
                    />
                  ) : (
                    <td className="tabular px-2 py-1.5 text-right text-xs text-gray-500">
                      {row.meetTarget === null ? (
                        "—"
                      ) : (
                        <>
                          {row.meetTarget}
                          {row.metricType === "VARIANCE" ? (
                            <span className="ml-0.5 text-gray-400">%</span>
                          ) : (
                            row.unit &&
                            row.metricType !== "MONTH_COMPLETION" && (
                              <span className="ml-0.5 text-gray-400">{row.unit}</span>
                            )
                          )}
                        </>
                      )}
                    </td>
                  )}

                  <td className="tabular px-2 py-1.5 text-right text-xs text-gray-500">
                    {row.metricType === "MONTH_COMPLETION" ? (
                      row.completionDate === null ? (
                        "—"
                      ) : (
                        <>
                          {formatDateAbbrev(row.completionDate)}
                          {row.basis === "ESTIMATE" && (
                            <span className="ml-1 text-amber-700">est</span>
                          )}
                        </>
                      )
                    ) : row.value === null ? (
                      "—"
                    ) : (
                      <>
                        {row.value.toLocaleString()}
                        {row.unit && (
                          <span className="ml-0.5 text-gray-400">{row.unit}</span>
                        )}
                        {row.basis === "ESTIMATE" && (
                          <span className="ml-1 text-amber-700">est</span>
                        )}
                      </>
                    )}
                  </td>

                  {visiblePeriods.map((period) => {
                    const entry = row.scores[period];
                    return (
                      <td key={period} className="px-2 py-1.5 text-center">
                        <ScoreCell
                          score={entry?.score ?? null}
                          band={entry?.band ?? null}
                          provisional={entry?.provisional}
                          prorated={entry?.prorated}
                          assumed={entry?.assumed}
                          size="sm"
                          placeholder={
                            period === currentPeriod && row.pendingReason === "NOT_YET_DUE"
                              ? "n/d"
                              : "—"
                          }
                        />
                      </td>
                    );
                  })}

                  <td className="px-3 py-1.5 text-right">
                    {!row.isLeaf && (
                      <CoverageBadge
                        scoredLeafCount={current?.scoredLeafCount ?? 0}
                        leafCount={current?.leafCount ?? 0}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold">
              <th scope="row" className="px-4 py-2.5 text-left">
                Total combined score
              </th>
              <td className="tabular px-2 py-2.5 text-right text-xs text-gray-600">100%</td>
              {showBands
                ? BANDS.map((band) => <td key={band} className="px-2 py-2.5" />)
                : <td className="px-2 py-2.5" />}
              {visiblePeriods.map((period) => {
                const entry = total.scores[period];
                return (
                  <td key={period} className="px-2 py-2.5 text-center">
                    <ScoreCell
                      score={entry?.score ?? null}
                      band={entry?.band ?? null}
                      provisional={entry?.provisional}
                      prorated={entry?.prorated}
                      assumed={entry?.assumed}
                      size="sm"
                    />
                  </td>
                );
              })}
              <td className="px-3 py-2.5 text-right">
                <CoverageBadge
                  scoredLeafCount={total.scores[currentPeriod]?.scoredLeafCount ?? 0}
                  leafCount={total.scores[currentPeriod]?.leafCount ?? 0}
                />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="border-t bg-gray-50 px-4 py-2 text-xs text-gray-500">
        <strong>Scored</strong> is how many of the leaf KPIs in a branch have a
        figure recorded this month, out of the total; unreported KPIs are left
        out of the score average rather than counted as zero.{" "}
        <strong>est</strong> marks a score based on an estimate.
        <strong> n/d</strong> means a milestone is not yet due.
        <strong> asm</strong> marks a score assumed by the &ldquo;unreported&rdquo;
        toggle rather than reported.
      </p>
    </div>
  );
}
