"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { BandTargetCells, BandTargetHeaderCells } from "@/components/BandColumns";
import { CoverageBadge, ScoreCell } from "@/components/ScoreCell";
import { SortHeader } from "@/components/SortHeader";
import { formatDateAbbrev } from "@/lib/dates";
import { formatPeriodLabel } from "@/lib/fiscal";
import { SCORE_TYPES, SCORE_TYPE_LABELS, scoreTypesOf, type ScoreType } from "@/lib/score-type";
import { BANDS, bandLabel, type Band, type MetricType } from "@/lib/scoring";
import { sortRows } from "@/lib/sort";

export type KpiTableRow = {
  id: string;
  code: string;
  name: string;
  subGroup: string | null;
  meetTarget: string | null;
  bandTargets: Record<Band, string | null>;
  level: number;
  isLeaf: boolean;
  weight: number;
  strategicGoal: string;
  strategicGoalId: string;
  departments: string[];
  metricType: MetricType | null;
  unit: string | null;
  deadlineMonth: string | null;
  value: number | null;
  /** MONTH_COMPLETION only — the recorded completion date, as an ISO string. */
  completionDate: string | null;
  basis: "ACTUAL" | "ESTIMATE" | null;
  score: number | null;
  band: Band | null;
  coverage: number;
  leafCount: number;
  scoredLeafCount: number;
  provisional: boolean;
  prorated: boolean;
  pendingReason: string | null;
};

type SortKey = "code" | "name" | "strategicGoal" | "weight" | "score" | "coverage" | "level";

/**
 * The KPI list, as either a flat master list of every lowest-level KPI or a
 * single hierarchy level. Sorting and filtering are client-side: the whole
 * year's set is around a hundred rows, small enough that a round-trip per
 * sort would only make it feel slower.
 */
export function KpiTable({
  rows,
  departments,
  period,
}: {
  rows: KpiTableRow[];
  departments: string[];
  /** Carried into KPI links so clicking through keeps the month on screen. */
  period: string;
}) {
  const [view, setView] = useState<"leaves" | "level">("leaves");
  const [showBands, setShowBands] = useState(false);
  const [level, setLevel] = useState(1);
  const [goal, setGoal] = useState("");
  const [department, setDepartment] = useState("");
  const [band, setBand] = useState("");
  const [metric, setMetric] = useState("");
  const [scoreTypes, setScoreTypes] = useState<Set<ScoreType>>(new Set(SCORE_TYPES));
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "code",
    direction: "asc",
  });

  const goals = useMemo(
    () => [...new Set(rows.map((r) => r.strategicGoal))].sort(),
    [rows]
  );
  const maxLevel = useMemo(() => Math.max(...rows.map((r) => r.level)), [rows]);
  const metrics = useMemo(
    () => [...new Set(rows.map((r) => r.metricType).filter(Boolean))] as MetricType[],
    [rows]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = view === "leaves" ? rows.filter((r) => r.isLeaf) : rows.filter((r) => r.level === level);

    return base.filter((row) => {
      if (goal && row.strategicGoal !== goal) return false;
      if (department && !row.departments.includes(department)) return false;
      if (band && row.band !== band) return false;
      if (metric && row.metricType !== metric) return false;
      if (scoreTypes.size < SCORE_TYPES.length) {
        // An unscored row rests on no figure at all, so it belongs to no score
        // type — the same way picking a band already hides rows with no band.
        if (row.score === null) return false;
        if (!scoreTypesOf(row).some((t) => scoreTypes.has(t))) return false;
      }
      if (term && !`${row.code} ${row.name} ${row.departments.join(" ")}`.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });
  }, [rows, view, level, goal, department, band, metric, scoreTypes, search]);

  const sorted = useMemo(() => sortRows(filtered, sort.key, sort.direction), [filtered, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "score" || key === "weight" ? "desc" : "asc" }
    );

  const toggleScoreType = (type: ScoreType) =>
    setScoreTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  const clearFilters = () => {
    setGoal(""); setDepartment(""); setBand(""); setMetric(""); setSearch("");
    setScoreTypes(new Set(SCORE_TYPES));
  };
  const filtersActive =
    Boolean(goal || department || band || metric || search) || scoreTypes.size < SCORE_TYPES.length;

  const selectClass =
    "rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white px-3 py-2.5">
        <div className="flex rounded border border-gray-300 p-0.5">
          <button
            type="button"
            onClick={() => setView("leaves")}
            className={`rounded px-2.5 py-1 text-sm font-medium ${
              view === "leaves" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Master list
          </button>
          <button
            type="button"
            onClick={() => setView("level")}
            className={`rounded px-2.5 py-1 text-sm font-medium ${
              view === "level" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            By level
          </button>
        </div>

        {view === "level" && (
          <select
            aria-label="Hierarchy level"
            className={selectClass}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
          >
            {Array.from({ length: maxLevel }, (_, i) => i + 1).map((l) => (
              <option key={l} value={l}>
                {l === 1 ? "Strategic Goals" : `Level ${l}`}
              </option>
            ))}
          </select>
        )}

        <input
          type="search"
          placeholder="Search name, code or owner"
          className={`${selectClass} min-w-52 flex-1`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select aria-label="Strategic Goal" className={selectClass} value={goal} onChange={(e) => setGoal(e.target.value)}>
          <option value="">All Strategic Goals</option>
          {goals.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>

        <select aria-label="Department" className={selectClass} value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <select aria-label="Band" className={selectClass} value={band} onChange={(e) => setBand(e.target.value)}>
          <option value="">All bands</option>
          {BANDS.slice().reverse().map((b) => <option key={b} value={b}>{bandLabel(b)}</option>)}
        </select>

        {metrics.length > 1 && (
          <select aria-label="Metric type" className={selectClass} value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="">All metrics</option>
            {metrics.map((m) => (
              <option key={m} value={m}>{m.replace(/_/g, " ").toLowerCase()}</option>
            ))}
          </select>
        )}

        <fieldset className="flex items-center gap-2 rounded border border-gray-300 px-2 py-1">
          <legend className="sr-only">Score type</legend>
          {SCORE_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-1 text-sm text-gray-600">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={scoreTypes.has(t)}
                onChange={() => toggleScoreType(t)}
              />
              {SCORE_TYPE_LABELS[t]}
            </label>
          ))}
        </fieldset>

        {filtersActive && (
          <button type="button" onClick={clearFilters} className="text-sm text-blue-700 hover:underline">
            Clear
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowBands((v) => !v)}
          className="ml-auto text-xs font-medium text-blue-700 hover:text-blue-900"
        >
          {showBands ? "Hide bands" : "Show all bands"}
        </button>

        <span className="text-sm text-gray-500">
          {sorted.length} of {view === "leaves" ? rows.filter((r) => r.isLeaf).length : rows.filter((r) => r.level === level).length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
              <SortHeader label="Code" sortKey="code" sort={sort} onSort={toggleSort} />
              <SortHeader label="KPI" sortKey="name" sort={sort} onSort={toggleSort} />
              <SortHeader label="Strategic Goal" sortKey="strategicGoal" sort={sort} onSort={toggleSort} />
              <th scope="col" className="px-3 py-2">Owners</th>
              <SortHeader label="Weight" sortKey="weight" sort={sort} onSort={toggleSort} align="right" />
              {showBands ? (
                <BandTargetHeaderCells className="px-3 py-2 text-right" />
              ) : (
                <th scope="col" className="px-3 py-2 text-right">Meet Target</th>
              )}
              <th scope="col" className="px-3 py-2 text-right">YTD/LE</th>
              <SortHeader label="Score" sortKey="score" sort={sort} onSort={toggleSort} align="center" />
              <SortHeader label="Scored" sortKey="coverage" sort={sort} onSort={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-blue-50/40">
                <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{row.code}</td>
                <th scope="row" className="px-3 py-1.5 text-left font-normal">
                  <Link href={`/kpi/${row.id}?period=${period}`} className="hover:text-blue-700 hover:underline">
                    {row.name}
                  </Link>
                  {row.subGroup && (
                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {row.subGroup}
                    </span>
                  )}
                  {row.deadlineMonth && (
                    <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">
                      due {formatPeriodLabel(row.deadlineMonth)}
                    </span>
                  )}
                </th>
                <td className="px-3 py-1.5 text-gray-600">
                  <Link href={`/kpi/${row.strategicGoalId}?period=${period}`} className="hover:text-blue-700 hover:underline">
                    {row.strategicGoal}
                  </Link>
                </td>
                <td className="px-3 py-1.5 text-xs text-gray-600">
                  {row.departments.join(", ") || <span className="text-gray-300">—</span>}
                </td>
                <td className="tabular px-3 py-1.5 text-right text-gray-600">
                  {row.weight > 0 ? `${row.weight.toFixed(2)}%` : "—"}
                </td>
                {showBands ? (
                  <BandTargetCells
                    bandTargets={row.bandTargets}
                    unit={row.unit}
                    metricType={row.metricType}
                    className="tabular px-3 py-1.5 text-right text-gray-500"
                  />
                ) : (
                  <td className="tabular px-3 py-1.5 text-right text-gray-500">
                    {row.meetTarget === null ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <>
                        {row.meetTarget}
                        {row.metricType === "VARIANCE" ? (
                          <span className="ml-0.5 text-xs text-gray-400">%</span>
                        ) : (
                          row.unit &&
                          row.metricType !== "MONTH_COMPLETION" && (
                            <span className="ml-0.5 text-xs text-gray-400">{row.unit}</span>
                          )
                        )}
                      </>
                    )}
                  </td>
                )}
                <td className="tabular px-3 py-1.5 text-right text-gray-700">
                  {row.metricType === "MONTH_COMPLETION" ? (
                    row.completionDate === null ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <>
                        {formatDateAbbrev(row.completionDate)}
                        {row.basis === "ESTIMATE" && <span className="ml-1 text-xs text-amber-700">est</span>}
                      </>
                    )
                  ) : row.value === null ? (
                    <span className="text-gray-300">—</span>
                  ) : (
                    <>
                      {row.value.toLocaleString()}
                      {row.unit && <span className="ml-0.5 text-xs text-gray-400">{row.unit}</span>}
                      {row.basis === "ESTIMATE" && <span className="ml-1 text-xs text-amber-700">est</span>}
                    </>
                  )}
                </td>
                <td className="px-3 py-1.5 text-center">
                  <ScoreCell
                    score={row.score} band={row.band} provisional={row.provisional} prorated={row.prorated} size="sm"
                    placeholder={row.pendingReason === "NOT_YET_DUE" ? "n/d" : "—"}
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  {!row.isLeaf && (
                    <CoverageBadge scoredLeafCount={row.scoredLeafCount} leafCount={row.leafCount} />
                  )}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={showBands ? 14 : 9} className="px-3 py-10 text-center text-sm text-gray-500">
                  No KPIs match those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
