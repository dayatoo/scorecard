"use client";

import { useState } from "react";
import type { KpiNode } from "@/lib/kpi-tree";
import type {
  Direction,
  TargetMode,
  LeafMetricType,
  FixedTargetConfig,
  RangeTargetConfig,
  MonthTargetConfig,
} from "@/lib/scoring";
import type { KpiInput } from "@/app/actions";

const METRIC_LABELS: Record<LeafMetricType, string> = {
  PERCENTAGE: "Percentage completion",
  DOLLAR: "Dollar amount",
  QUANTITY: "Quantity",
  DAYS: "Number of days",
  MONTH_COMPLETION: "Month of completion",
};

const RANGE_BANDS: { key: keyof RangeTargetConfig; label: string }[] = [
  { key: "poor", label: "Poor" },
  { key: "improvementNeeded", label: "Improvement Needed" },
  { key: "meet", label: "Meet" },
  { key: "good", label: "Good" },
  { key: "veryGood", label: "Very Good" },
  { key: "excellent", label: "Excellent" },
];

function emptyFixed(): FixedTargetConfig {
  return { poorThreshold: 0, meetTarget: 0, goodThreshold: 0, veryGoodThreshold: 0, excellentThreshold: 0 };
}
function emptyRange(): RangeTargetConfig {
  return {
    poor: [0, 0],
    improvementNeeded: [0, 0],
    meet: [0, 0],
    good: [0, 0],
    veryGood: [0, 0],
    excellent: [0, 0],
  };
}

export default function KpiForm({
  initial,
  parentId,
  onSubmit,
  onCancel,
  onDelete,
  submitting,
}: {
  initial: KpiNode | null;
  parentId: string | null;
  onSubmit: (input: KpiInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [weight, setWeight] = useState(initial?.weight ?? 1);
  const [nodeType, setNodeType] = useState<"group" | "leaf">(
    initial?.metricType ? "leaf" : initial ? "group" : "group"
  );
  const [metricType, setMetricType] = useState<LeafMetricType>(initial?.metricType ?? "PERCENTAGE");
  const [direction, setDirection] = useState<Direction>(initial?.direction ?? "HIGHER_BETTER");
  const [targetMode, setTargetMode] = useState<TargetMode>(initial?.targetMode ?? "FIXED");
  const [fixedCfg, setFixedCfg] = useState<FixedTargetConfig>(
    initial?.targetMode === "FIXED" ? (initial.targetConfig as FixedTargetConfig) : emptyFixed()
  );
  const [rangeCfg, setRangeCfg] = useState<RangeTargetConfig>(
    initial?.targetMode === "RANGE" ? (initial.targetConfig as RangeTargetConfig) : emptyRange()
  );
  const [targetMonth, setTargetMonth] = useState<string>(
    initial?.metricType === "MONTH_COMPLETION" ? (initial.targetConfig as MonthTargetConfig).targetMonth : ""
  );

  const hasChildren = (initial?.children.length ?? 0) > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let targetConfig: FixedTargetConfig | RangeTargetConfig | MonthTargetConfig | null = null;
    let mType: LeafMetricType | null = null;
    let dir: Direction | null = null;
    let mode: TargetMode | null = null;

    if (nodeType === "leaf") {
      mType = metricType;
      if (metricType === "MONTH_COMPLETION") {
        targetConfig = { targetMonth };
      } else {
        dir = direction;
        mode = targetMode;
        targetConfig = targetMode === "FIXED" ? fixedCfg : rangeCfg;
      }
    }

    onSubmit({
      name,
      parentId: initial ? initial.parentId : parentId,
      weight: Number(weight),
      metricType: mType,
      direction: dir,
      targetMode: mode,
      targetConfig,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-gray-300 rounded-lg p-4 bg-white shadow-sm space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col text-sm gap-1">
          <span className="font-medium">Name</span>
          <input
            className="border rounded px-2 py-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col text-sm gap-1">
          <span className="font-medium">Weight (relative to siblings)</span>
          <input
            type="number"
            step="any"
            min={0}
            className="border rounded px-2 py-1"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            required
          />
        </label>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="font-medium">Node type</span>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={nodeType === "group"}
            onChange={() => setNodeType("group")}
          />
          Group (rollup of sub-KPIs)
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            checked={nodeType === "leaf"}
            disabled={hasChildren}
            onChange={() => setNodeType("leaf")}
          />
          Leaf (enter values directly)
        </label>
        {hasChildren && (
          <span className="text-xs text-gray-400">Has sub-KPIs, so it is always a rollup group.</span>
        )}
      </div>

      {nodeType === "leaf" && (
        <div className="space-y-4 border-t pt-4">
          <label className="flex flex-col text-sm gap-1 max-w-xs">
            <span className="font-medium">Metric type</span>
            <select
              className="border rounded px-2 py-1"
              value={metricType}
              onChange={(e) => setMetricType(e.target.value as LeafMetricType)}
            >
              {Object.entries(METRIC_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {metricType === "MONTH_COMPLETION" ? (
            <label className="flex flex-col text-sm gap-1 max-w-xs">
              <span className="font-medium">Target month (Meet)</span>
              <input
                type="month"
                className="border rounded px-2 py-1"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                required
              />
              <span className="text-xs text-gray-500">
                Good = 1 month earlier, Very Good = 2 earlier, Excellent = 3+ earlier. Improvement
                Needed = up to 1 month late, Poor = up to 2 months late, beyond that scores 0.
              </span>
            </label>
          ) : (
            <>
              <div className="flex gap-6">
                <label className="flex flex-col text-sm gap-1">
                  <span className="font-medium">Direction</span>
                  <select
                    className="border rounded px-2 py-1"
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as Direction)}
                  >
                    <option value="HIGHER_BETTER">Higher is better</option>
                    <option value="LOWER_BETTER">Lower is better</option>
                  </select>
                </label>
                <label className="flex flex-col text-sm gap-1">
                  <span className="font-medium">Target mode</span>
                  <select
                    className="border rounded px-2 py-1"
                    value={targetMode}
                    onChange={(e) => setTargetMode(e.target.value as TargetMode)}
                  >
                    <option value="FIXED">Fixed target</option>
                    <option value="RANGE">Range target</option>
                  </select>
                </label>
              </div>

              {targetMode === "FIXED" ? (
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      ["poorThreshold", "Poor threshold"],
                      ["meetTarget", "Meet target (fixed)"],
                      ["goodThreshold", "Good threshold"],
                      ["veryGoodThreshold", "Very Good threshold"],
                      ["excellentThreshold", "Excellent threshold"],
                    ] as [keyof FixedTargetConfig, string][]
                  ).map(([key, label]) => (
                    <label key={key} className="flex flex-col text-sm gap-1">
                      <span>{label}</span>
                      <input
                        type="number"
                        step="any"
                        className="border rounded px-2 py-1"
                        value={fixedCfg[key]}
                        onChange={(e) =>
                          setFixedCfg({ ...fixedCfg, [key]: Number(e.target.value) })
                        }
                        required
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">
                    Enter the value range for each band (in the direction that makes sense for
                    this KPI).
                  </p>
                  {RANGE_BANDS.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span className="w-40">{label}</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="min"
                        className="border rounded px-2 py-1 w-28"
                        value={rangeCfg[key][0]}
                        onChange={(e) =>
                          setRangeCfg({
                            ...rangeCfg,
                            [key]: [Number(e.target.value), rangeCfg[key][1]],
                          })
                        }
                        required
                      />
                      <span>to</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="max"
                        className="border rounded px-2 py-1 w-28"
                        value={rangeCfg[key][1]}
                        onChange={(e) =>
                          setRangeCfg({
                            ...rangeCfg,
                            [key]: [rangeCfg[key][0], Number(e.target.value)],
                          })
                        }
                        required
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50"
        >
          {initial ? "Save changes" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border px-4 py-1.5 rounded text-sm"
        >
          Cancel
        </button>
        {initial && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto text-red-600 text-sm px-4 py-1.5"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
