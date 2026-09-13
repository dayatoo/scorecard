"use client";

import Link from "next/link";
import { useState } from "react";

import { CoverageBadge, ScoreCell } from "./ScoreCell";
import { formatPeriodShort } from "@/lib/fiscal";
import type { Band } from "@/lib/scoring";

export type TreeRow = {
  id: string;
  code: string;
  name: string;
  level: number;
  isLeaf: boolean;
  weight: number;
  parentId: string | null;
  departments: string[];
  /** Score per period, keyed by period. */
  scores: Record<
    string,
    {
      score: number | null;
      band: Band | null;
      coverage: number;
      provisional: boolean;
      prorated: boolean;
      notYetDueShare: number;
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
        notYetDueShare: number;
      }
    >;
  };
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(rows.filter((r) => r.level === 1).map((r) => r.id))
  );

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
        <h2 className="text-sm font-semibold text-gray-700">Scorecard</h2>
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
              <th scope="col" className="px-4 py-2">KPI</th>
              <th scope="col" className="px-2 py-2 text-right">Weight</th>
              {periods.map((period) => (
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
                    row.level === 1 ? "bg-gray-50/70 font-medium" : ""
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
                    </div>
                  </th>

                  <td className="tabular px-2 py-1.5 text-right text-xs text-gray-500">
                    {row.weight > 0 ? `${row.weight.toFixed(1)}%` : "—"}
                  </td>

                  {periods.map((period) => {
                    const entry = row.scores[period];
                    return (
                      <td key={period} className="px-2 py-1.5 text-center">
                        <ScoreCell
                          score={entry?.score ?? null}
                          band={entry?.band ?? null}
                          provisional={entry?.provisional}
                          prorated={entry?.prorated}
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
                    <CoverageBadge coverage={current?.coverage ?? 0} notYetDueShare={current?.notYetDueShare} />
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
              {periods.map((period) => {
                const entry = total.scores[period];
                return (
                  <td key={period} className="px-2 py-2.5 text-center">
                    <ScoreCell
                      score={entry?.score ?? null}
                      band={entry?.band ?? null}
                      provisional={entry?.provisional}
                      prorated={entry?.prorated}
                      size="sm"
                    />
                  </td>
                );
              })}
              <td className="px-3 py-2.5 text-right">
                <CoverageBadge
                  coverage={total.scores[currentPeriod]?.coverage ?? 0}
                  notYetDueShare={total.scores[currentPeriod]?.notYetDueShare}
                />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="border-t bg-gray-50 px-4 py-2 text-xs text-gray-500">
        <strong>Scored</strong> is the share of a KPI&rsquo;s weight that has a figure
        recorded this month; unreported KPIs are left out of the average rather than
        counted as zero. <strong>est</strong> marks a score based on an estimate.
        <strong> n/d</strong> means a milestone is not yet due.
      </p>
    </div>
  );
}
