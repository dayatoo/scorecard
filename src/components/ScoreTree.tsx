"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";

import { BandTargetCells, BandTargetHeaderCells } from "./BandColumns";
import { CoverageBadge, ScoreCell } from "./ScoreCell";
import { formatDateAbbrev } from "@/lib/dates";
import { formatPeriodShort } from "@/lib/fiscal";
import { BANDS, type Band, type MetricType } from "@/lib/scoring";
import { DEFAULT_SCORING_OPTIONS, type DueMode } from "@/lib/scoring-modes";

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
 * Reversible kill switch for the row expand/collapse animation below. Flip
 * to `false` to fall straight back to the old instant unmount/mount
 * behavior with no other code changes, if the animation ever misbehaves.
 */
const ROW_ANIMATION_ENABLED = true;

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
  dueMode = DEFAULT_SCORING_OPTIONS.dueMode,
}: {
  rows: TreeRow[];
  periods: string[];
  currentPeriod: string;
  /** Which "Unreported KPI handling" toggle is active — changes the legend's wording below. */
  dueMode?: DueMode;
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
  const isRowVisible = (row: TreeRow) => {
    let parentId = row.parentId;
    while (parentId) {
      if (!expanded.has(parentId)) return false;
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return true;
  };

  // With the row animation on, every row stays mounted (so a collapse has
  // something to transition out) and CSS + aria-hidden do the hiding;
  // otherwise a collapsed row is unmounted entirely, exactly like before
  // this feature existed.
  const visible = ROW_ANIMATION_ENABLED ? rows : rows.filter(isRowVisible);

  // Collapse props for a row's cells. `max-height` on a `<td>`/`<th>` itself
  // is silently ignored by browsers in table layout (a table cell's height
  // always follows its content, however small the cap) — confirmed by
  // inspecting a collapsed cell's computed height staying at its natural
  // ~21px despite `max-height: 0px` being correctly applied. Only a nested
  // block-level element actually honors `max-height` + `overflow-hidden`,
  // so the cap has to live on an inner wrapper inside each cell; the cell
  // itself then naturally shrinks to fit that wrapper's collapsed height,
  // with its own padding zeroed too so it doesn't add height on top of it.
  const collapseCellProps = (
    rowVisible: boolean
  ): {
    cellClassName: string;
    cellStyle: CSSProperties | undefined;
    innerClassName: string;
    innerStyle: CSSProperties | undefined;
  } => ({
    cellClassName: ROW_ANIMATION_ENABLED
      ? "transition-[padding-top,padding-bottom] duration-200 ease-out motion-reduce:transition-none"
      : "",
    cellStyle: ROW_ANIMATION_ENABLED && !rowVisible ? { paddingTop: 0, paddingBottom: 0 } : undefined,
    // No `block`/`display` utility here: some callers apply this to an
    // already-block-level element (e.g. a `flex` div), where adding one
    // would fight the element's own display value in the cascade. Callers
    // wrapping plain inline content add `block` themselves alongside this.
    innerClassName: ROW_ANIMATION_ENABLED
      ? "overflow-hidden transition-[max-height,opacity] duration-200 ease-out motion-reduce:transition-none"
      : "",
    innerStyle: ROW_ANIMATION_ENABLED
      ? rowVisible
        ? { maxHeight: "3.5rem" }
        : { maxHeight: 0, opacity: 0 }
      : undefined,
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
              const rowVisible = ROW_ANIMATION_ENABLED ? isRowVisible(row) : true;
              const cell = collapseCellProps(rowVisible);
              // The group-row wash only goes on cells that don't already carry
              // their own band tint — layering it under a band column's
              // semi-transparent color would muddy that column relative to
              // the same band on every other row.
              const groupRowBg = row.level === 1 ? "bg-blue-50/70" : "";

              return (
                <tr
                  key={row.id}
                  aria-hidden={ROW_ANIMATION_ENABLED && !rowVisible ? true : undefined}
                  className={`${
                    ROW_ANIMATION_ENABLED
                      ? `border-b last:border-0 transition-colors duration-200 motion-reduce:transition-none ${
                          rowVisible
                            ? "hover:bg-blue-50/40"
                            : "border-transparent pointer-events-none"
                        }`
                      : "border-b last:border-0 hover:bg-blue-50/40"
                  } ${row.level === 1 ? "font-medium" : ""}`}
                >
                  <th scope="row" className={`px-4 py-1.5 text-left font-normal ${groupRowBg} ${cell.cellClassName}`} style={cell.cellStyle}>
                    <div
                      className={`flex items-center gap-1.5 ${cell.innerClassName}`}
                      style={{ paddingLeft: `${(row.level - 1) * 1.25}rem`, ...cell.innerStyle }}
                    >
                      {expandable ? (
                        <button
                          type="button"
                          onClick={() => toggle(row.id)}
                          aria-expanded={isOpen}
                          aria-label={`${isOpen ? "Collapse" : "Expand"} ${row.name}`}
                          tabIndex={rowVisible ? 0 : -1}
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
                        tabIndex={rowVisible ? undefined : -1}
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

                  <td className={`tabular px-2 py-1.5 text-right text-xs text-gray-500 ${groupRowBg} ${cell.cellClassName}`} style={cell.cellStyle}>
                    <span className={`block ${cell.innerClassName}`} style={cell.innerStyle}>
                      {row.weight > 0 ? `${row.weight.toFixed(1)}%` : "—"}
                    </span>
                  </td>

                  {showBands ? (
                    <BandTargetCells
                      bandTargets={row.bandTargets}
                      unit={row.unit}
                      metricType={row.metricType}
                      className={`tabular px-2 py-1.5 text-right text-xs text-gray-500 ${cell.cellClassName}`}
                      cellStyle={cell.cellStyle}
                      innerClassName={cell.innerClassName}
                      innerStyle={cell.innerStyle}
                    />
                  ) : (
                    <td className={`tabular px-2 py-1.5 text-right text-xs text-gray-500 ${groupRowBg} ${cell.cellClassName}`} style={cell.cellStyle}>
                      <span className={`block ${cell.innerClassName}`} style={cell.innerStyle}>
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
                      </span>
                    </td>
                  )}

                  <td className={`tabular px-2 py-1.5 text-right text-xs text-gray-500 ${groupRowBg} ${cell.cellClassName}`} style={cell.cellStyle}>
                    <span className={`block ${cell.innerClassName}`} style={cell.innerStyle}>
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
                    </span>
                  </td>

                  {visiblePeriods.map((period) => {
                    const entry = row.scores[period];
                    return (
                      <td key={period} className={`px-2 py-1.5 text-center ${groupRowBg} ${cell.cellClassName}`} style={cell.cellStyle}>
                        <span className={`block ${cell.innerClassName}`} style={cell.innerStyle}>
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
                        </span>
                      </td>
                    );
                  })}

                  <td className={`px-3 py-1.5 text-right ${groupRowBg} ${cell.cellClassName}`} style={cell.cellStyle}>
                    <span className={`block ${cell.innerClassName}`} style={cell.innerStyle}>
                      {!row.isLeaf && (
                        <CoverageBadge
                          scoredLeafCount={current?.scoredLeafCount ?? 0}
                          leafCount={current?.leafCount ?? 0}
                        />
                      )}
                    </span>
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
        figure recorded this month, out of the total;{" "}
        {dueMode === "zero"
          ? "unreported KPIs are scored as 0 rather than left out of the average."
          : dueMode === "assume-meet-decay"
            ? "unreported KPIs are assumed at a decaying Meet score rather than left out of the average."
            : "unreported KPIs are left out of the score average rather than counted as zero."}{" "}
        <strong>est</strong> marks a score based on an estimate.
        <strong> n/d</strong> means a milestone is not yet due.
        <strong> asm</strong> marks a score assumed by the &ldquo;unreported&rdquo;
        toggle rather than reported.
      </p>
    </div>
  );
}
