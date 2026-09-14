"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { setGroupWeights, type WeightChild } from "@/app/actions/weights";

type Mode = "PERCENT" | "RATIO";

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * Splits `amount` evenly across `count` shares, each to 2 decimal places,
 * summing to exactly `amount` (to the cent) — dividing in cent-integer space
 * and handing the leftover cents to the first few shares, rather than
 * rounding each share independently and letting the rounding error compound
 * (100 / 6, rounded per-share, would otherwise total 100.02, not 100).
 */
function evenSplit(amount: number, count: number): string[] {
  const totalCents = Math.round(amount * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => ((base + (i < remainder ? 1 : 0)) / 100).toFixed(2));
}

/**
 * Rounds each percentage to 2 decimal places so the set still sums to
 * exactly the (rounded) total — largest-remainder rounding, so that e.g.
 * [28.571..., 14.285..., 14.285..., ...] (which sum to 100) don't each round
 * independently to values that sum to 100.02.
 */
function roundToSum(percentages: number[]): string[] {
  const cents = percentages.map((p) => p * 100);
  const floors = cents.map((c) => Math.floor(c));
  const targetTotal = Math.round(cents.reduce((a, b) => a + b, 0));
  let remainder = targetTotal - floors.reduce((a, b) => a + b, 0);
  const order = cents
    .map((c, i) => ({ i, frac: c - Math.floor(c) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    result[i] += 1;
    remainder -= 1;
  }
  return result.map((c) => (c / 100).toFixed(2));
}

/**
 * Groups children by sub-group for display, keeping each child's index into
 * the original `childKpis`/`percentages` arrays — purely a display aid, the
 * only real 100% requirement stays the whole group's (shown in the counter
 * above), so each cluster here just gets an informational subtotal.
 */
function clusterForDisplay(kpis: WeightChild[]): { subGroup: string | null; items: { kpi: WeightChild; index: number }[] }[] {
  const order: string[] = [];
  const buckets = new Map<string, { kpi: WeightChild; index: number }[]>();
  kpis.forEach((kpi, index) => {
    const key = kpi.subGroup ?? "";
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push({ kpi, index });
  });
  return order.map((key) => ({ subGroup: key || null, items: buckets.get(key)! }));
}

export function WeightsEditor({
  fiscalYearId,
  parentId,
  childKpis,
  fiscalYearClosed = false,
}: {
  fiscalYearId: string;
  parentId: string | null;
  parentLabel: string;
  childKpis: WeightChild[];
  fiscalYearClosed?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("PERCENT");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(childKpis.map((k) => [k.id, String(k.weight)]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const singleChild = childKpis.length === 1;

  const raw = childKpis.map((k) => Number(values[k.id] || 0));
  const percentages =
    mode === "PERCENT"
      ? raw
      : (() => {
          const sum = raw.reduce((a, b) => a + b, 0);
          return sum > 0 ? raw.map((v) => (v / sum) * 100) : raw.map(() => 0);
        })();
  const total = singleChild ? 100 : percentages.reduce((a, b) => a + b, 0);
  const balanced = Math.abs(total - 100) <= 0.01;
  const counterColor = balanced
    ? "text-emerald-700"
    : total < 100
      ? "text-amber-700"
      : "text-rose-700";

  const setValue = (id: string, value: string) => setValues((v) => ({ ...v, [id]: value }));

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    if (next === "RATIO") {
      const scaled = raw.map((p) => Math.round(p * 10));
      const g = scaled.reduce((a, b) => gcd(a, b), 0);
      const ratios = g > 0 ? scaled.map((v) => v / g) : scaled.map(() => 1);
      setValues(Object.fromEntries(childKpis.map((k, i) => [k.id, String(ratios[i])])));
    } else {
      const shares = roundToSum(percentages);
      setValues(Object.fromEntries(childKpis.map((k, i) => [k.id, shares[i]])));
    }
    setMode(next);
    setSaved(false);
  };

  const equalSplitAll = () => {
    if (mode === "PERCENT") {
      const shares = evenSplit(100, childKpis.length);
      setValues(Object.fromEntries(childKpis.map((k, i) => [k.id, shares[i]])));
    } else {
      setValues(Object.fromEntries(childKpis.map((k) => [k.id, "1"])));
    }
    setSaved(false);
  };

  const equalSplitRemaining = () => {
    const unset = childKpis.filter((k) => Number(values[k.id] || 0) === 0);
    if (unset.length === 0) return;
    if (mode === "PERCENT") {
      const usedSum = childKpis
        .filter((k) => Number(values[k.id] || 0) !== 0)
        .reduce((sum, k) => sum + Number(values[k.id] || 0), 0);
      const shares = evenSplit(Math.max(0, 100 - usedSum), unset.length);
      setValues((v) => {
        const next = { ...v };
        unset.forEach((k, i) => {
          next[k.id] = shares[i];
        });
        return next;
      });
    } else {
      setValues((v) => {
        const next = { ...v };
        for (const k of unset) next[k.id] = "1";
        return next;
      });
    }
    setSaved(false);
  };

  const save = async () => {
    setError(null);
    setSaved(false);
    setSaving(true);
    const shares = roundToSum(percentages);
    const weights = childKpis.map((k, i) => ({ id: k.id, weight: Number(shares[i]) }));
    const result = await setGroupWeights({ fiscalYearId, parentId, weights });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {fiscalYearClosed && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">
          This year is closed. An admin can reopen it to make changes.
        </p>
      )}
      {error && <p className="text-sm font-medium text-rose-700">{error}</p>}
      {saved && !error && <p className="text-sm font-medium text-emerald-700">Saved.</p>}

      <div className="rounded-lg border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className={`text-sm font-bold ${counterColor}`}>
            {balanced
              ? `Balanced — totals to ${total.toFixed(2)}%`
              : total < 100
                ? `${(100 - total).toFixed(2)}% left to assign (totals to ${total.toFixed(2)}%)`
                : `${(total - 100).toFixed(2)}% too much (totals to ${total.toFixed(2)}%)`}
          </div>
          {!singleChild && !fiscalYearClosed && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex overflow-hidden rounded border border-gray-300">
                <button
                  type="button"
                  className={`px-2 py-1 font-medium ${mode === "PERCENT" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                  onClick={() => switchMode("PERCENT")}
                >
                  Percentage
                </button>
                <button
                  type="button"
                  className={`px-2 py-1 font-medium ${mode === "RATIO" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                  onClick={() => switchMode("RATIO")}
                >
                  Ratio
                </button>
              </div>
              <button
                type="button"
                className="rounded border border-gray-300 px-2 py-1 font-medium text-gray-700 hover:bg-gray-50"
                onClick={equalSplitAll}
              >
                Equal split — all
              </button>
              <button
                type="button"
                className="rounded border border-gray-300 px-2 py-1 font-medium text-gray-700 hover:bg-gray-50"
                onClick={equalSplitRemaining}
              >
                Equal split — remaining
              </button>
            </div>
          )}
        </div>

        <fieldset disabled={fiscalYearClosed} className="divide-y">
          {singleChild ? (
            <div className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div>
                <span className="mr-2 font-mono text-xs text-gray-400">{childKpis[0].code}</span>
                {childKpis[0].name}
              </div>
              <span className="text-xs text-gray-500">100% (only child)</span>
            </div>
          ) : (
            clusterForDisplay(childKpis).map((cluster) => (
              <div key={cluster.subGroup ?? "__none__"}>
                {cluster.subGroup && (
                  <div className="flex items-center justify-between bg-gray-50 px-4 py-1 text-xs font-medium text-gray-500">
                    <span>{cluster.subGroup}</span>
                    <span>
                      {cluster.items.reduce((sum, { index }) => sum + percentages[index], 0).toFixed(1)}%
                    </span>
                  </div>
                )}
                {cluster.items.map(({ kpi, index: i }) => (
                  <div key={kpi.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-16 shrink-0 font-mono text-xs text-gray-400">{kpi.code}</span>
                    <span className="flex-1 truncate">{kpi.name}</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      aria-label={`Weight for ${kpi.name}`}
                      className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm"
                      value={values[kpi.id] ?? ""}
                      onChange={(e) => setValue(kpi.id, e.target.value)}
                    />
                    {mode === "RATIO" && (
                      <span
                        data-testid={`derived-percent-${kpi.id}`}
                        className="w-16 shrink-0 text-right text-xs text-gray-400"
                      >
                        {percentages[i].toFixed(1)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </fieldset>
      </div>

      {!fiscalYearClosed && (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      )}
    </div>
  );
}
