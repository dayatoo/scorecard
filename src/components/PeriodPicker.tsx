"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { formatPeriodLabel } from "@/lib/fiscal";

/** Switches the reporting month, and the fiscal year, via the query string. */
export function PeriodPicker({
  period,
  periods,
  fiscalYears,
  fiscalYearId,
}: {
  period: string;
  periods: string[];
  fiscalYears: { id: string; label: string }[];
  fiscalYearId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
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
            // Changing year clears the month, so the new year opens on a month
            // that actually belongs to it.
            onChange={(e) => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("fy", e.target.value);
              params.delete("period");
              router.push(`${pathname}?${params.toString()}`);
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
          onChange={(e) => navigate({ period: e.target.value })}
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {formatPeriodLabel(p)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
