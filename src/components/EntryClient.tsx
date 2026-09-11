"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { KpiValue } from "@prisma/client";
import type { KpiNode } from "@/lib/kpi-tree";
import { upsertKpiValue, deleteKpiValue } from "@/app/actions";
import { currentPeriod } from "@/lib/kpi-tree";

const METRIC_VALUE_LABEL: Record<string, string> = {
  PERCENTAGE: "Value (%)",
  DOLLAR: "Value ($)",
  QUANTITY: "Value (quantity)",
  DAYS: "Value (days)",
};

function toDateInputValue(d: Date | null): string {
  if (!d) return "";
  const date = new Date(d);
  return date.toISOString().slice(0, 10);
}

export default function EntryClient({
  leaves,
  values,
}: {
  leaves: { node: KpiNode; path: string }[];
  values: KpiValue[];
}) {
  const [kpiId, setKpiId] = useState(leaves[0]?.node.id ?? "");
  const [period, setPeriod] = useState(currentPeriod());
  const [value, setValue] = useState<string>("");
  const [completionDate, setCompletionDate] = useState<string>("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const selected = leaves.find((l) => l.node.id === kpiId)?.node ?? null;
  const isMonthType = selected?.metricType === "MONTH_COMPLETION";

  const historyForKpi = useMemo(
    () => values.filter((v) => v.kpiId === kpiId).sort((a, b) => (a.period < b.period ? 1 : -1)),
    [values, kpiId]
  );

  function loadExisting(p: string) {
    const existing = values.find((v) => v.kpiId === kpiId && v.period === p);
    setValue(existing?.value != null ? String(existing.value) : "");
    setCompletionDate(toDateInputValue(existing?.completionDate ?? null));
    setNote(existing?.note ?? "");
  }

  function handlePeriodChange(p: string) {
    setPeriod(p);
    loadExisting(p);
  }

  function handleKpiChange(id: string) {
    setKpiId(id);
    const existing = values.find((v) => v.kpiId === id && v.period === period);
    setValue(existing?.value != null ? String(existing.value) : "");
    setCompletionDate(toDateInputValue(existing?.completionDate ?? null));
    setNote(existing?.note ?? "");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await upsertKpiValue({
        kpiId,
        period,
        value: isMonthType ? null : value === "" ? null : Number(value),
        completionDate: isMonthType ? completionDate || null : null,
        note: note || null,
      });
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    startTransition(async () => {
      await deleteKpiValue(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-4 bg-white shadow-sm">
        <label className="flex flex-col text-sm gap-1">
          <span className="font-medium">KPI</span>
          <select
            className="border rounded px-2 py-1"
            value={kpiId}
            onChange={(e) => handleKpiChange(e.target.value)}
          >
            {leaves.map(({ node, path }) => (
              <option key={node.id} value={node.id}>
                {path}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-sm gap-1 max-w-xs">
          <span className="font-medium">Period (month)</span>
          <input
            type="month"
            className="border rounded px-2 py-1"
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
            required
          />
        </label>

        {isMonthType ? (
          <label className="flex flex-col text-sm gap-1 max-w-xs">
            <span className="font-medium">Actual completion date</span>
            <input
              type="date"
              className="border rounded px-2 py-1"
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
              required
            />
          </label>
        ) : (
          <label className="flex flex-col text-sm gap-1 max-w-xs">
            <span className="font-medium">
              {selected ? METRIC_VALUE_LABEL[selected.metricType ?? ""] ?? "Value" : "Value"}
            </span>
            <input
              type="number"
              step="any"
              className="border rounded px-2 py-1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </label>
        )}

        <label className="flex flex-col text-sm gap-1">
          <span className="font-medium">Note (optional)</span>
          <textarea
            className="border rounded px-2 py-1"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
        </label>

        <button
          type="submit"
          disabled={isPending || !kpiId}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50"
        >
          Save entry
        </button>
      </form>

      <div>
        <h2 className="text-sm font-semibold text-gray-600 mb-2">
          Entry history {selected ? `— ${selected.name}` : ""}
        </h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-1">Period</th>
              <th className="py-1">{isMonthType ? "Completion date" : "Value"}</th>
              <th className="py-1">Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {historyForKpi.map((v) => (
              <tr key={v.id} className="border-b last:border-0">
                <td className="py-1">{v.period}</td>
                <td className="py-1">
                  {v.completionDate ? toDateInputValue(v.completionDate) : v.value}
                </td>
                <td className="py-1 text-gray-500">{v.note}</td>
                <td className="py-1 text-right">
                  <button className="text-red-500 text-xs" onClick={() => handleDelete(v.id)}>
                    delete
                  </button>
                </td>
              </tr>
            ))}
            {historyForKpi.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-gray-400 text-center">
                  No entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
