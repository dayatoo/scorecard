"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ConfirmSaveDialog, SaveBar } from "@/components/ConfirmSaveDialog";
import { DateField } from "@/components/DateField";
import { ScoreCell } from "@/components/ScoreCell";
import { formatDate } from "@/lib/dates";
import { formatPeriodLabel } from "@/lib/fiscal";
import type { Band, MetricType } from "@/lib/scoring";
import { saveEntries, type SaveEntryInput } from "@/app/actions/kpi";

export type EntryRow = {
  id: string;
  code: string;
  name: string;
  strategicGoal: string;
  departments: string[];
  departmentIds: string[];
  metricType: MetricType | null;
  unit: string | null;
  meetTarget: string | null;
  value: number | null;
  basis: "ACTUAL" | "ESTIMATE";
  completionDate: string | null;
  note: string | null;
  score: number | null;
  band: Band | null;
  provisional: boolean;
  pendingReason: string | null;
};

type Cell = {
  value: string;
  basis: "ACTUAL" | "ESTIMATE";
  completionDate: string;
  note: string;
};

/**
 * The month's data-entry grid. Edits accumulate locally across every row and
 * are written in one confirmed save, so a half-finished pass over a hundred
 * KPIs never leaves the scorecard in a partly-updated state.
 */
export function EntryGrid({
  rows,
  period,
  departments,
  currentUser,
  fiscalYearClosed = false,
}: {
  rows: EntryRow[];
  period: string;
  departments: string[];
  currentUser: { role: "MEMBER" | "ADMIN"; departmentId: string };
  fiscalYearClosed?: boolean;
}) {
  const owns = (row: EntryRow) =>
    !fiscalYearClosed &&
    (currentUser.role === "ADMIN" || row.departmentIds.includes(currentUser.departmentId));

  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [department, setDepartment] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial = useMemo(
    () =>
      new Map<string, Cell>(
        rows.map((row) => [
          row.id,
          {
            value: row.value === null ? "" : String(row.value),
            basis: row.basis,
            completionDate: row.completionDate ?? "",
            note: row.note ?? "",
          },
        ])
      ),
    [rows]
  );

  const [draft, setDraft] = useState<Map<string, Cell>>(initial);

  // Re-seed when the month changes, discarding nothing because a month switch
  // is a full page navigation.
  const [seenPeriod, setSeenPeriod] = useState(period);
  if (seenPeriod !== period) {
    setSeenPeriod(period);
    setDraft(initial);
  }

  const update = (id: string, patch: Partial<Cell>) => {
    setDraft((current) => {
      const next = new Map(current);
      next.set(id, { ...(next.get(id) as Cell), ...patch });
      return next;
    });
    setError(null);
  };

  const changed = useMemo(
    () =>
      rows.filter((row) => {
        const before = initial.get(row.id) as Cell;
        const after = draft.get(row.id) as Cell;
        return (
          before.value !== after.value ||
          before.basis !== after.basis ||
          before.completionDate !== after.completionDate ||
          before.note !== after.note
        );
      }),
    [rows, initial, draft]
  );

  const changes = changed.map((row) => {
    const before = initial.get(row.id) as Cell;
    const after = draft.get(row.id) as Cell;
    return {
      field: row.id,
      label: `${row.code} ${row.name}`,
      from: describeCell(before, row),
      to: describeCell(after, row),
    };
  });

  const goals = useMemo(() => [...new Set(rows.map((r) => r.strategicGoal))].sort(), [rows]);

  const visible = rows.filter((row) => {
    if (goal && row.strategicGoal !== goal) return false;
    if (department && !row.departments.includes(department)) return false;
    if (onlyMissing) {
      const cell = draft.get(row.id) as Cell;
      if (cell.value.trim() !== "" || cell.completionDate !== "") return false;
    }
    return true;
  });

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const payload: SaveEntryInput[] = changed.map((row) => {
        const cell = draft.get(row.id) as Cell;
        const raw = cell.value.trim();
        if (raw !== "" && !Number.isFinite(Number(raw))) {
          throw new Error(`"${raw}" on ${row.code} is not a number.`);
        }
        return {
          kpiId: row.id,
          period,
          value: raw === "" ? null : Number(raw),
          basis: cell.basis,
          completionDate: cell.completionDate || null,
          note: cell.note || null,
        };
      });

      const result = await saveEntries(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch (cause) {
      // Local validation above throws; anything else is a transport failure.
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Could not reach the server. Check your connection and try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    "w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";
  const selectClass =
    "rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

  const missingCount = rows.filter((r) => {
    const cell = draft.get(r.id) as Cell;
    return cell.value.trim() === "" && cell.completionDate === "";
  }).length;

  return (
    <div className="space-y-3">
      {fiscalYearClosed && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">
          This year is closed. An admin can reopen it to make changes.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white px-3 py-2.5">
        <select aria-label="Strategic Goal" className={selectClass} value={goal} onChange={(e) => setGoal(e.target.value)}>
          <option value="">All Strategic Goals</option>
          {goals.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select aria-label="Department" className={selectClass} value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
            className="rounded border-gray-300"
          />
          Only those still to report
        </label>
        <span className="ml-auto text-sm text-gray-500">
          {missingCount} of {rows.length} still to report
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[60rem] text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
              <th scope="col" className="px-3 py-2">KPI</th>
              <th scope="col" className="px-3 py-2 text-right">Meet target</th>
              <th scope="col" className="w-40 px-3 py-2">YTD value</th>
              <th scope="col" className="w-36 px-3 py-2">Basis</th>
              <th scope="col" className="px-3 py-2">Note</th>
              <th scope="col" className="px-3 py-2 text-center">Score</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const cell = draft.get(row.id) as Cell;
              const isMilestone = row.metricType === "MONTH_COMPLETION";
              const isDirty = changed.some((c) => c.id === row.id);
              const canEdit = owns(row);

              return (
                <tr
                  key={row.id}
                  className={`border-b last:border-0 ${isDirty ? "bg-amber-50/60" : ""}`}
                >
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    <Link href={`/kpi/${row.id}?period=${period}`} className="hover:text-blue-700 hover:underline">
                      <span className="font-mono text-xs text-gray-400">{row.code}</span> {row.name}
                    </Link>
                    <span className="block text-xs text-gray-500">
                      {row.strategicGoal}
                      {row.departments.length > 0 && ` · ${row.departments.join(", ")}`}
                    </span>
                  </th>

                  <td className="tabular px-3 py-1.5 text-right text-xs text-gray-600">
                    {row.meetTarget ?? "—"}
                    {row.unit && !isMilestone && <span className="ml-0.5 text-gray-400">{row.unit}</span>}
                  </td>

                  <td className="px-3 py-1.5">
                    {isMilestone ? (
                      <DateField
                        label={`Completion date for ${row.name}`}
                        className={inputClass}
                        value={cell.completionDate}
                        onChange={(iso) => update(row.id, { completionDate: iso })}
                        disabled={!canEdit}
                      />
                    ) : (
                      <input
                        type="number"
                        step="any"
                        inputMode="decimal"
                        aria-label={`Year-to-date value for ${row.name}`}
                        className={inputClass}
                        value={cell.value}
                        onChange={(e) => update(row.id, { value: e.target.value })}
                        disabled={!canEdit}
                      />
                    )}
                  </td>

                  <td className="px-3 py-1.5">
                    <select
                      aria-label={`Basis for ${row.name}`}
                      className={inputClass}
                      value={cell.basis}
                      onChange={(e) => update(row.id, { basis: e.target.value as Cell["basis"] })}
                      disabled={!canEdit}
                    >
                      <option value="ACTUAL">Actual</option>
                      <option value="ESTIMATE">Estimate</option>
                    </select>
                  </td>

                  <td className="px-3 py-1.5">
                    <input
                      aria-label={`Note for ${row.name}`}
                      className={inputClass}
                      value={cell.note}
                      placeholder={canEdit ? "Optional" : "Not your department"}
                      onChange={(e) => update(row.id, { note: e.target.value })}
                      disabled={!canEdit}
                    />
                  </td>

                  <td className="px-3 py-1.5 text-center">
                    <ScoreCell
                      score={row.score} band={row.band} provisional={row.provisional} size="sm"
                      placeholder={row.pendingReason === "NOT_YET_DUE" ? "n/d" : "—"}
                    />
                    {isDirty && (
                      <span className="block text-[0.65rem] text-amber-700">unsaved</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-gray-500">
                  No KPIs match those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Scores in the last column are as last saved — they update once you save.
      </p>

      <SaveBar
        isDirty={changed.length > 0}
        isSaving={isSaving}
        error={error}
        count={changed.length}
        noun={["KPI with unsaved figures", "KPIs with unsaved figures"]}
        onSave={() => setConfirming(true)}
        onDiscard={() => { setDraft(initial); setError(null); }}
      />

      <ConfirmSaveDialog
        open={confirming}
        changes={changes}
        isSaving={isSaving}
        title={`Save ${changed.length} figure${changed.length === 1 ? "" : "s"} for ${formatPeriodLabel(period)}?`}
        onConfirm={save}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

function describeCell(cell: Cell, row: EntryRow): string {
  const parts: string[] = [];

  if (row.metricType === "MONTH_COMPLETION") {
    parts.push(cell.completionDate ? `completed ${formatDate(cell.completionDate)}` : "not completed");
    if (cell.completionDate && cell.basis === "ESTIMATE") parts.push("estimate");
  } else if (cell.value.trim() === "") {
    parts.push("not reported");
  } else {
    parts.push(`${cell.value}${row.unit ? ` ${row.unit}` : ""}`);
    if (cell.basis === "ESTIMATE") parts.push("estimate");
  }

  if (cell.note) parts.push(`note: "${truncate(cell.note, 40)}"`);
  return parts.join(", ");
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
