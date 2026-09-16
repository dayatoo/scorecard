"use client";

import { useEffect, useState } from "react";

import { SettingsPanel, TargetsPanel, type AttributeDraft } from "@/components/KpiAttributeFields";
import { getKpiAttributes, saveKpiSettings, saveToKpiDictionary, type KpiAttributes } from "@/app/actions/kpi";
import { parsePhaseConfig } from "@/lib/kpi-tree";
import type { KpiDictionaryEntrySummary } from "@/lib/data";
import type { Band } from "@/lib/scoring";
import {
  crossesNumericMonthBoundary,
  draftToMetricInput,
  metricToDraft,
  type MetricDraft,
} from "@/lib/targets";

/**
 * The full KPI settings/targets form, in a panel over the hierarchy tree
 * rather than a separate page — the same fields, and the same
 * `saveKpiSettings` action, as the KPI detail page.
 *
 * Loads its own data on open rather than taking it as a prop: the
 * hierarchy page's node list is deliberately light on detail (see
 * `getHierarchyTree` in `src/lib/data.ts`), so the fuller record is fetched
 * only for the one KPI actually being edited.
 */
export function KpiEditPanel({
  kpiId,
  code,
  name,
  isLeaf,
  weight,
  globalWeight,
  departments,
  statusOptions,
  initialDictionaryEntry,
  onClose,
  onSaved,
}: {
  kpiId: string;
  code: string;
  name: string;
  isLeaf: boolean;
  weight: number;
  globalWeight: number;
  departments: { id: string; name: string }[];
  statusOptions: string[];
  /** Prefills the metric-config fields from a saved KPI Dictionary entry, for a just-created KPI. */
  initialDictionaryEntry?: KpiDictionaryEntrySummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [attrs, setAttrs] = useState<KpiAttributes | null>(null);
  const [draft, setDraft] = useState<AttributeDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingToDictionary, setSavingToDictionary] = useState(false);
  const [dictionaryName, setDictionaryName] = useState(name);
  const [dictionaryMessage, setDictionaryMessage] = useState<string | null>(null);

  // The parent mounts a fresh KpiEditPanel (keyed by kpiId) per KPI opened,
  // so this effect only ever runs once for the id it was mounted with —
  // no need to reset state for a changing id.
  useEffect(() => {
    let cancelled = false;

    getKpiAttributes(kpiId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const fetched = result.data;
      // A dictionary entry, if one was picked when this KPI was created,
      // overrides only the metric-config fields — everything else (weight,
      // departments, phasing, status…) still comes from the fresh KPI record.
      const metric = initialDictionaryEntry ? metricToDraft(initialDictionaryEntry) : metricToDraft(fetched);
      setAttrs(fetched);
      setDraft({
        code: fetched.code,
        name: fetched.name,
        weight: String(weight),
        subGroup: fetched.subGroup ?? "",
        status: fetched.status ?? "",
        unit: initialDictionaryEntry?.unit ?? fetched.unit ?? "",
        departmentIds: [...fetched.departmentIds].sort(),
        deadlineMonth: fetched.deadlineMonth ?? "",
        scoreFinalAfterDeadline: fetched.scoreFinalAfterDeadline,
        frequency: fetched.frequency,
        metricType: metric.metricType,
        targetMode: metric.targetMode,
        direction: metric.direction,
        phasing: fetched.phasing,
        phaseShares: (parsePhaseConfig(fetched.phaseConfig) ?? []).join(", "),
        targets: metric.targets,
        targetMonth: metric.targetMonth,
        clearFigures: false,
      });
    });

    return () => {
      cancelled = true;
    };
    // Re-loads if a different row is opened while the panel is already mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiId]);

  const setField = <K extends keyof AttributeDraft>(field: K, value: AttributeDraft[K]) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const crossesMetricBoundary =
    draft && attrs
      ? crossesNumericMonthBoundary(attrs.metricType, draft.metricType === "" ? null : draft.metricType)
      : false;

  const parseDraftMetric = (d: AttributeDraft) => {
    const metricDraft: MetricDraft = {
      metricType: d.metricType,
      targetMode: d.targetMode,
      direction: d.direction,
      targets: d.targets as Record<Band, string>,
      targetMonth: d.targetMonth,
    };
    return draftToMetricInput(metricDraft, isLeaf);
  };

  const save = async () => {
    if (!draft) return;
    setError(null);

    const parsed = parseDraftMetric(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    const phaseConfig =
      draft.phasing === "CUSTOM"
        ? draft.phaseShares.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
        : null;

    setSaving(true);
    const result = await saveKpiSettings({
      kpiId,
      code: draft.code,
      name: draft.name,
      weight: Number(draft.weight || 0),
      subGroup: draft.subGroup || null,
      status: draft.status || null,
      unit: draft.unit || null,
      departmentIds: draft.departmentIds,
      deadlineMonth: draft.deadlineMonth || null,
      scoreFinalAfterDeadline: draft.scoreFinalAfterDeadline,
      frequency: draft.frequency,
      metric: parsed.metric,
      clearFiguresForMetricChange: draft.clearFigures,
      phasing: draft.phasing,
      phaseConfig,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  };

  const saveDictionary = async () => {
    if (!draft) return;
    setDictionaryMessage(null);
    setError(null);

    const parsed = parseDraftMetric(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    const entryName = dictionaryName.trim();
    if (!entryName) {
      setError("The dictionary entry needs a name.");
      return;
    }

    setSaving(true);
    const result = await saveToKpiDictionary({
      name: entryName,
      unit: draft.unit || null,
      metric: parsed.metric,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSavingToDictionary(false);
    setDictionaryMessage(`Saved "${entryName}" to the KPI Dictionary.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 cursor-default bg-gray-900/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${name}`}
        className="relative flex h-full w-full max-w-lg flex-col bg-gray-50 shadow-xl"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="flex items-start justify-between gap-3 border-b bg-white px-5 py-4">
          <div className="min-w-0">
            <span className="font-mono text-xs text-gray-400">{code}</span>
            <h2 className="truncate text-base font-semibold text-gray-900">{name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {loading && <p className="text-sm text-gray-500">Loading…</p>}
          {error && (
            <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
              {error}
            </p>
          )}

          {draft && attrs && (
            <>
              <SettingsPanel
                subject={{ isLeaf, globalWeight }}
                draft={draft}
                setField={setField}
                departments={departments}
                statusOptions={statusOptions}
                crossesMetricBoundary={crossesMetricBoundary}
                readOnly={saving}
              />
              {isLeaf && (
                <TargetsPanel
                  subject={{
                    direction: attrs.direction,
                    targetConfig: attrs.targetConfig,
                    unit: attrs.unit,
                  }}
                  draft={draft}
                  setField={setField}
                  readOnly={saving}
                />
              )}

              {isLeaf && draft.metricType && (
                <div className="rounded border border-gray-200 bg-white p-3">
                  {dictionaryMessage && (
                    <p className="mb-2 text-xs font-medium text-emerald-700">{dictionaryMessage}</p>
                  )}
                  {savingToDictionary ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="min-w-40 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                        aria-label="Dictionary entry name"
                        placeholder="Dictionary entry name"
                        value={dictionaryName}
                        onChange={(e) => setDictionaryName(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={saveDictionary}
                        disabled={saving}
                        className="rounded bg-gray-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                      >
                        Save entry
                      </button>
                      <button
                        type="button"
                        className="text-xs text-gray-500 hover:underline"
                        onClick={() => setSavingToDictionary(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDictionaryMessage(null);
                        setSavingToDictionary(true);
                      }}
                      className="text-xs font-medium text-blue-700 hover:underline"
                    >
                      Save this metric definition to the KPI Dictionary…
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t bg-white px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading || !draft}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
