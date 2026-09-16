"use client";

import { useMemo, useState } from "react";

import { DateField } from "@/components/DateField";
import { ScoreCell } from "@/components/ScoreCell";
import { SummaryCard, TotalScoreHero } from "@/components/ScoreHero";
import { formatPeriodLabel } from "@/lib/fiscal";
import { buildScoredTree, type KpiRecord, type ScoreOverrideRecord, type ValueRecord } from "@/lib/kpi-tree";
import { varianceMagnitude, type MetricType } from "@/lib/scoring";

export type SimulationRow = {
  id: string;
  code: string;
  name: string;
  strategicGoal: string;
  metricType: MetricType | null;
  unit: string | null;
  meetTarget: string | null;
  value: number | null;
  /** VARIANCE metrics only — the period's target/budget figure. */
  plannedValue: number | null;
  completionDate: string | null;
  /** Set when the figures above are carried forward from an earlier month
   *  because this one hasn't been reported yet — "YYYY-MM" of that month,
   *  shown as a hint so the baseline doesn't read as this month's own data. */
  baselinePeriod: string | null;
};

/** Serialized versions of the raw scoring inputs — Dates become ISO strings
 *  crossing the server/client boundary, reconstructed here before scoring. */
type SerializedValue = Omit<ValueRecord, "completionDate"> & { completionDate: string | null };
type SerializedOverride = Omit<ScoreOverrideRecord, "createdAt"> & { createdAt: string };

type Cell = {
  value: string;
  plannedValue: string;
  completionDate: string;
};

/**
 * A live "what if" scorecard: every edit re-runs the same pure scoring
 * engine (`buildScoredTree`) entirely in the browser, so the hero score, the
 * Strategic Goal cards and every row's Score cell update on each keystroke —
 * no save, no server round-trip, and nothing here ever reaches the database.
 */
export function SimulationGrid({
  rows,
  period,
  kpiRecords,
  values,
  overrides,
}: {
  rows: SimulationRow[];
  period: string;
  kpiRecords: KpiRecord[];
  values: SerializedValue[];
  overrides: [string, SerializedOverride[]][];
}) {
  const initial = useMemo(
    () =>
      new Map<string, Cell>(
        rows.map((row) => [
          row.id,
          {
            value: row.value === null ? "" : String(row.value),
            plannedValue: row.plannedValue === null ? "" : String(row.plannedValue),
            completionDate: row.completionDate ?? "",
          },
        ])
      ),
    [rows]
  );

  const [draft, setDraft] = useState<Map<string, Cell>>(initial);

  const update = (id: string, patch: Partial<Cell>) => {
    setDraft((current) => {
      const next = new Map(current);
      next.set(id, { ...(next.get(id) as Cell), ...patch });
      return next;
    });
  };

  const isDirty = [...draft.entries()].some((entry) => {
    const before = initial.get(entry[0]) as Cell;
    const after = entry[1];
    return before.value !== after.value || before.plannedValue !== after.plannedValue || before.completionDate !== after.completionDate;
  });

  // Re-run the real scoring engine on every draft change: swap this period's
  // recorded figures for the simulated ones (always Actual — this page is
  // for trying out actuals, not estimates), leaving every other period's
  // history untouched, since a milestone or a carried-forward estimate can
  // depend on it.
  const { roots, total, byId } = useMemo(() => {
    const rowIds = new Set(rows.map((r) => r.id));
    const untouched = values.filter((v) => !(v.period === period && rowIds.has(v.kpiId)));
    const simulated: ValueRecord[] = [];
    for (const row of rows) {
      const cell = draft.get(row.id) as Cell;
      const value = cell.value.trim() === "" ? null : Number(cell.value);
      const plannedValue = cell.plannedValue.trim() === "" ? null : Number(cell.plannedValue);
      const completionDate = cell.completionDate ? new Date(cell.completionDate) : null;
      if (value === null && plannedValue === null && completionDate === null) continue;
      simulated.push({
        kpiId: row.id,
        period,
        value: Number.isFinite(value) ? value : null,
        basis: "ACTUAL",
        completionDate,
        note: null,
        plannedValue: Number.isFinite(plannedValue) ? plannedValue : null,
      });
    }
    const mergedValues: ValueRecord[] = [
      ...untouched.map((v) => ({ ...v, completionDate: v.completionDate ? new Date(v.completionDate) : null })),
      ...simulated,
    ];
    const overridesMap = new Map<string, ScoreOverrideRecord[]>(
      overrides.map(([kpiId, records]) => [kpiId, records.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }))])
    );
    return buildScoredTree(kpiRecords, mergedValues, period, overridesMap);
  }, [draft, rows, values, overrides, kpiRecords, period]);

  const reset = () => setDraft(initial);

  const inputClass =
    "w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
        Simulation only — nothing entered here is saved.
      </p>

      <TotalScoreHero total={total} period={period} leaves={rows.map((r) => byId.get(r.id)!).filter(Boolean)} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {roots.map((goal) => (
          <SummaryCard
            key={goal.id}
            label={goal.name}
            score={goal.score}
            band={goal.band}
            provisional={goal.provisional}
            prorated={goal.prorated}
            assumed={goal.assumed}
            footer={`${goal.scoredLeafCount}/${goal.leafCount} of ${goal.weight.toFixed(0)}% weight`}
          />
        ))}
      </section>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          Scores above update as you type — pick any KPI and try a different figure.
        </span>
        {isDirty && (
          <button
            type="button"
            onClick={reset}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reset simulation
          </button>
        )}
      </div>

      <div className="max-h-[70dvh] overflow-auto rounded-lg border bg-white">
        <table className="w-full min-w-[50rem] text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr className="border-b text-left text-xs font-medium text-gray-500 uppercase">
              <th scope="col" className="px-3 py-2">KPI</th>
              <th scope="col" className="px-3 py-2 text-right">Meet target</th>
              <th scope="col" className="w-40 px-3 py-2">Simulated actual</th>
              <th scope="col" className="px-3 py-2 text-center">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cell = draft.get(row.id) as Cell;
              const isMilestone = row.metricType === "MONTH_COMPLETION";
              const isVariance = row.metricType === "VARIANCE";
              const node = byId.get(row.id);
              const liveVariance =
                isVariance && cell.value.trim() !== "" && cell.plannedValue.trim() !== ""
                  ? varianceMagnitude(Number(cell.value), Number(cell.plannedValue))
                  : null;
              const dirty =
                cell.value !== (initial.get(row.id) as Cell).value ||
                cell.plannedValue !== (initial.get(row.id) as Cell).plannedValue ||
                cell.completionDate !== (initial.get(row.id) as Cell).completionDate;

              return (
                <tr key={row.id} className={`border-b last:border-0 ${dirty ? "bg-amber-50/60" : ""}`}>
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    <span className="font-mono text-xs text-gray-400">{row.code}</span> {row.name}
                    <span className="block text-xs text-gray-500">{row.strategicGoal}</span>
                    {row.baselinePeriod && (
                      <span className="block text-xs text-amber-700">
                        not yet reported — starting from {formatPeriodLabel(row.baselinePeriod)}
                      </span>
                    )}
                  </th>

                  <td className="tabular px-3 py-1.5 text-right text-xs text-gray-600">
                    {row.meetTarget ?? "—"}
                    {isVariance ? (
                      <span className="ml-0.5 text-gray-400">%</span>
                    ) : (
                      row.unit && !isMilestone && <span className="ml-0.5 text-gray-400">{row.unit}</span>
                    )}
                  </td>

                  <td className="px-3 py-1.5">
                    {isMilestone ? (
                      <DateField
                        label={`Simulated completion date for ${row.name}`}
                        className={inputClass}
                        value={cell.completionDate}
                        onChange={(iso) => update(row.id, { completionDate: iso })}
                      />
                    ) : isVariance ? (
                      <div className="space-y-1">
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          aria-label={`Simulated actual value for ${row.name}`}
                          placeholder="Actual"
                          className={inputClass}
                          value={cell.value}
                          onChange={(e) => update(row.id, { value: e.target.value })}
                        />
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          aria-label={`Simulated target value for ${row.name}`}
                          placeholder="Target"
                          className={inputClass}
                          value={cell.plannedValue}
                          onChange={(e) => update(row.id, { plannedValue: e.target.value })}
                        />
                        {liveVariance !== null && (
                          <span className="block text-xs text-gray-500">Variance: {liveVariance.toFixed(1)}%</span>
                        )}
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        aria-label={`Simulated actual value for ${row.name}`}
                        className={inputClass}
                        value={cell.value}
                        onChange={(e) => update(row.id, { value: e.target.value })}
                      />
                    )}
                  </td>

                  <td className="px-3 py-1.5 text-center">
                    <ScoreCell
                      score={node?.score ?? null}
                      band={node?.band ?? null}
                      prorated={node?.prorated}
                      size="sm"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
