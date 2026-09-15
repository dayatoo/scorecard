"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { formatPeriodLabel } from "@/lib/fiscal";
import type { DueMode, EstimateMode } from "@/lib/scoring-modes";

const DUE_MODE_LABELS: Record<DueMode, string> = {
  exclude: "Unreported: excluded",
  "assume-meet-decay": "Unreported: assume Meet, decaying",
};

const ESTIMATE_MODE_LABELS: Record<EstimateMode, string> = {
  count: "Estimates: count at face value",
  exclude: "Estimates: excluded",
  zero: "Estimates: score as 0",
};

/** Switches the reporting month, fiscal year, and Dashboard-only scoring
    toggles, via the query string. */
export function PeriodPicker({
  period,
  periods,
  fiscalYears,
  fiscalYearId,
  dueMode,
  estimateMode,
  closed = false,
}: {
  period: string;
  periods: string[];
  fiscalYears: { id: string; label: string }[];
  fiscalYearId: string;
  /** Omit to hide the scoring-mode toggles entirely (pages other than the Dashboard). */
  dueMode?: DueMode;
  estimateMode?: EstimateMode;
  /** A closed fiscal year reads a frozen snapshot — the toggles would have nothing to apply to. */
  closed?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const navigate = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) params.set(key, value);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  };

  const select =
    "rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {fiscalYears.length > 1 && (
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <span className="sr-only">Fiscal year</span>
          <select
            className={select}
            value={fiscalYearId}
            disabled={isPending}
            // Changing year clears the month, so the new year opens on a month
            // that actually belongs to it.
            onChange={(e) => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("fy", e.target.value);
              params.delete("period");
              startTransition(() => router.push(`${pathname}?${params.toString()}`));
            }}
          >
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex items-center gap-1.5 text-sm text-gray-600">
        <span className="sr-only">Reporting month</span>
        <select
          className={select}
          value={period}
          disabled={isPending}
          onChange={(e) => navigate({ period: e.target.value })}
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {formatPeriodLabel(p)}
            </option>
          ))}
        </select>
      </label>

      {dueMode && (
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <span className="sr-only">Unreported KPI handling</span>
          <select
            className={select}
            value={dueMode}
            disabled={closed || isPending}
            title={closed ? "Disabled — a closed year shows its frozen, board-approved scores" : undefined}
            onChange={(e) => navigate({ dueMode: e.target.value })}
          >
            {(Object.keys(DUE_MODE_LABELS) as DueMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {DUE_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
      )}

      {estimateMode && (
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <span className="sr-only">Estimate handling</span>
          <select
            className={select}
            value={estimateMode}
            disabled={closed || isPending}
            title={closed ? "Disabled — a closed year shows its frozen, board-approved scores" : undefined}
            onChange={(e) => navigate({ estimateMode: e.target.value })}
          >
            {(Object.keys(ESTIMATE_MODE_LABELS) as EstimateMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {ESTIMATE_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
      )}

      {isPending && (
        <span className="flex items-center gap-1.5 text-sm text-gray-500" role="status">
          <span
            aria-hidden
            className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
          />
          Updating…
        </span>
      )}
    </div>
  );
}
