"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { ConfirmSaveDialog, SaveBar } from "@/components/ConfirmSaveDialog";
import { DateField } from "@/components/DateField";
import {
  attributeInputClass as inputClass,
  Field,
  Panel,
  SettingsPanel,
  targetPoint,
  TargetsPanel,
  type AttributeDraft,
} from "@/components/KpiAttributeFields";
import { CoverageBadge, ScoreCell } from "@/components/ScoreCell";
import { ScoreChart, ValueChart } from "@/components/ScoreChart";
import { useDirtyForm } from "@/components/useDirtyForm";
import { formatDate, formatMonth } from "@/lib/dates";
import { formatPeriodLabel } from "@/lib/fiscal";
import {
  BANDS,
  bandLabel,
  type Band,
  type Direction,
  type Frequency,
  type LeafScore,
  type MetricType,
  type Phasing,
  type TargetConfig,
  type TargetMode,
} from "@/lib/scoring";
import { addKpiUpdate, saveEntry, saveKpiSettings } from "@/app/actions/kpi";
import { clearOverride, overrideScore } from "@/app/actions/calibration";
import {
  crossesNumericMonthBoundary,
  draftToMetricInput,
  metricToDraft,
  type MetricDraft,
} from "@/lib/targets";
import { ScoreExplainer } from "./ScoreExplainer";

type HistoryRow = {
  period: string;
  /** Later than the month being reported on, so deliberately unscored. */
  isFuture: boolean;
  value: number | null;
  basis: "ACTUAL" | "ESTIMATE" | null;
  completionDate: string | null;
  note: string | null;
  score: number | null;
  band: Band | null;
  coverage: number;
  provisional: boolean;
};

export type KpiProps = {
  id: string;
  code: string;
  name: string;
  subGroup: string | null;
  level: number;
  isLeaf: boolean;
  weight: number;
  globalWeight: number;
  frequency: Frequency;
  phasing: Phasing;
  phaseConfig: number[] | null;
  metricType: MetricType | null;
  direction: Direction | null;
  targetMode: TargetMode | null;
  targetConfig: TargetConfig | null;
  unit: string | null;
  deadlineMonth: string | null;
  scoreFinalAfterDeadline: boolean;
  departmentIds: string[];
  score: number | null;
  band: Band | null;
  coverage: number;
  provisional: boolean;
  leaf: LeafScore | null;
};

/**
 * One draft object for the whole page, so a single Save covers every edit.
 * Field order matters: `changes` is emitted in `Object.keys` order, so the
 * metric fields sit immediately before `targets`/`targetMonth` and the
 * confirmation dialog reads in causal order (what changed, then its targets).
 */
type Draft = {
  code: string;
  name: string;
  weight: string;
  subGroup: string;
  unit: string;
  departmentIds: string[];
  deadlineMonth: string;
  scoreFinalAfterDeadline: boolean;
  frequency: Frequency;
  metricType: MetricType | "";
  targetMode: TargetMode | "";
  direction: Direction | "";
  phasing: Phasing;
  phaseShares: string; // 12 comma-separated shares, CUSTOM only
  targets: Record<string, string>;
  targetMonth: string;
  clearFigures: boolean;
  value: string;
  basis: "ACTUAL" | "ESTIMATE";
  completionDate: string;
  note: string;
};

export type PendingProposal = {
  id: string;
  summary: { field: string; label: string; from: string; to: string }[];
  proposedByUsername: string;
  createdAt: string;
};

export function KpiDetailClient({
  kpi,
  subKpis,
  history,
  updates,
  audits,
  departments,
  period,
  periods,
  fiscalYearLabel,
  fiscalYearClosed,
  currentUser,
  pendingProposal,
}: {
  kpi: KpiProps;
  subKpis: {
    id: string; code: string; name: string; weight: number;
    score: number | null; band: Band | null; coverage: number; provisional: boolean;
    exactScore: number | null; scoredWeight: number;
    meetTarget: string | null; unit: string | null; metricType: MetricType | null;
  }[];
  history: HistoryRow[];
  updates: { id: string; period: string; body: string; author: string | null; createdAt: string }[];
  audits: { id: string; field: string; label: string; from: string; to: string; author: string | null; createdAt: string }[];
  departments: { id: string; name: string }[];
  period: string;
  periods: string[];
  fiscalYearLabel: string;
  fiscalYearClosed: boolean;
  currentUser: { id: string; username: string; role: "MEMBER" | "ADMIN"; departmentId: string };
  pendingProposal: PendingProposal | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const current = history.find((h) => h.period === period);

  const initial = useMemo<Draft>(() => {
    const metric = metricToDraft(kpi);
    return {
      code: kpi.code,
      name: kpi.name,
      weight: String(kpi.weight),
      subGroup: kpi.subGroup ?? "",
      unit: kpi.unit ?? "",
      departmentIds: [...kpi.departmentIds].sort(),
      deadlineMonth: kpi.deadlineMonth ?? "",
      scoreFinalAfterDeadline: kpi.scoreFinalAfterDeadline,
      frequency: kpi.frequency,
      metricType: metric.metricType,
      targetMode: metric.targetMode,
      direction: metric.direction,
      phasing: kpi.phasing,
      phaseShares: (kpi.phaseConfig ?? []).join(", "),
      targets: metric.targets,
      targetMonth: metric.targetMonth,
      clearFigures: false,
      value: current?.value !== null && current?.value !== undefined ? String(current.value) : "",
      basis: current?.basis ?? "ACTUAL",
      completionDate: current?.completionDate ?? "",
      note: current?.note ?? "",
    };
    // Re-seeds when the month changes, which is the only time the server sends
    // a materially different record for the same KPI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpi.id, period]);

  const departmentName = (id: string) =>
    departments.find((d) => d.id === id)?.name ?? id;

  const form = useDirtyForm<Draft>(
    initial,
    (field, value) => {
      if (field === "departmentIds" && Array.isArray(value)) {
        return value.length ? value.map(departmentName).join(", ") : "none";
      }
      if (field === "targets" && value && typeof value === "object") {
        const targets = value as Record<string, string>;
        return BANDS.map((b) => `${bandLabel(b)} ${targets[b] || "—"}`).join("; ");
      }
      if (field === "targetMonth") {
        return value ? formatMonth(String(value)) : "empty";
      }
      if (field === "metricType") {
        return value ? String(value).replace(/_/g, " ").toLowerCase() : "no metric (rollup)";
      }
      if (field === "clearFigures") {
        return value ? "figures cleared" : "figures kept";
      }
      if (field === "scoreFinalAfterDeadline") {
        return value ? "score freezes at the deadline" : "partial credit after the deadline";
      }
      if (field === "completionDate") {
        return value ? formatDate(String(value)) : "not completed";
      }
      if (field === "deadlineMonth") {
        return value ? formatMonth(String(value)) : "none";
      }
      if (value === "" || value === null || value === undefined) return "empty";
      return String(value);
    },
    {
      code: "Code", name: "Name", weight: "Weight % (of group)", unit: "Unit",
      departmentIds: "Departments",
      deadlineMonth: "Deadline month", scoreFinalAfterDeadline: "After the deadline",
      frequency: "Reporting frequency",
      metricType: "Metric type", targetMode: "Target mode", direction: "Direction",
      phasing: "Phasing", phaseShares: "Phase shares",
      targets: "Targets", targetMonth: "Target month",
      clearFigures: "Figures on a metric change",
      value: `Value for ${formatPeriodLabel(period)}`,
      basis: "Figure is", completionDate: "Completion date",
      note: `Note for ${formatPeriodLabel(period)}`,
    }
  );

  const { draft, setField, changes, isDirty, isSaving, error, reset, commit } = form;

  // `AttributeDraft` is this page's `Draft` minus its entry-only fields
  // (value/basis/completionDate/note), with every other field the same —
  // safe to hand the shared settings/targets panels a narrower view of the
  // same setter.
  const setAttributeField = setField as <K extends keyof AttributeDraft>(
    field: K,
    value: AttributeDraft[K]
  ) => void;

  const crossesMetricBoundary = crossesNumericMonthBoundary(
    kpi.metricType,
    draft.metricType === "" ? null : draft.metricType
  );

  const settingsFields = new Set([
    "code", "name", "weight", "unit", "departmentIds", "deadlineMonth",
    "scoreFinalAfterDeadline", "frequency", "metricType", "targetMode",
    "direction", "phasing", "phaseShares", "targets", "targetMonth", "clearFigures",
  ]);
  const warnings = (() => {
    const out: string[] = [];
    if (["metricType", "targetMode", "direction", "targets", "targetMonth"].some((f) => changes.some((c) => c.field === f))) {
      out.push("Scores for every month of the year are recalculated from the new definition.");
    }
    if (changes.some((c) => c.field === "code")) {
      out.push("A spreadsheet still using the old code will treat this as a different KPI on the next import.");
    }
    if (
      draft.metricType === "MONTH_COMPLETION" &&
      draft.targetMonth &&
      draft.targetMonth <= period &&
      changes.some((c) => c.field === "targetMonth" || c.field === "metricType")
    ) {
      out.push("That month has already passed, so this KPI is scored as overdue from now on.");
    }
    return out;
  })();

  const save = async () => {
    const ok = await commit(async (d) => {
      const touched = new Set(changes.map((c) => c.field));

      if (["value", "basis", "completionDate", "note"].some((f) => touched.has(f))) {
        const result = await saveEntry({
          kpiId: kpi.id,
          period,
          value: d.value.trim() === "" ? null : Number(d.value),
          basis: d.basis,
          completionDate: d.completionDate || null,
          note: d.note || null,
        });
        if (!result.ok) throw new Error(result.error);
      }

      if ([...touched].some((f) => settingsFields.has(f))) {
        const metricDraft: MetricDraft = {
          metricType: d.metricType,
          targetMode: d.targetMode,
          direction: d.direction,
          targets: d.targets as Record<Band, string>,
          targetMonth: d.targetMonth,
        };
        const parsed = draftToMetricInput(metricDraft, kpi.isLeaf);
        if (!parsed.ok) throw new Error(parsed.error);

        const phaseConfig = d.phasing === "CUSTOM"
          ? d.phaseShares.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
          : null;

        const result = await saveKpiSettings({
          kpiId: kpi.id,
          code: d.code,
          name: d.name,
          weight: Number(d.weight || 0),
          subGroup: d.subGroup || null,
          unit: d.unit || null,
          departmentIds: d.departmentIds,
          deadlineMonth: d.deadlineMonth || null,
          scoreFinalAfterDeadline: d.scoreFinalAfterDeadline,
          frequency: d.frequency,
          metric: parsed.metric,
          clearFiguresForMetricChange: d.clearFigures,
          phasing: d.phasing,
          phaseConfig,
        });
        if (!result.ok) throw new Error(result.error);
      }
    });

    if (ok) {
      setConfirming(false);
      router.refresh();
    }
  };

  const ownsKpi = currentUser.role === "ADMIN" || kpi.departmentIds.includes(currentUser.departmentId);
  const canEditFigures = ownsKpi && !fiscalYearClosed;
  const canEditSettings =
    !fiscalYearClosed &&
    (currentUser.role === "ADMIN" ||
      (kpi.isLeaf && ownsKpi && !pendingProposal));
  const submittingProposal =
    currentUser.role !== "ADMIN" && changes.some((c) => settingsFields.has(c.field));

  // For the score explainer: the earliest recorded completion at or before
  // the viewed period, mirroring scoreMilestoneLeaf's own selection — the
  // history row for the exact viewed period is usually empty, since a
  // completion is recorded once and then stands for every later month too.
  const completionEntry =
    kpi.metricType === "MONTH_COMPLETION"
      ? history
          .filter((h) => !h.isFuture && h.completionDate && h.period <= period)
          .sort((a, b) => a.period.localeCompare(b.period))[0] ?? null
      : null;

  const numericTargets = kpi.metricType && kpi.metricType !== "MONTH_COMPLETION"
    ? BANDS.map((band) => ({ band, value: targetPoint(kpi, band) })).filter(
        (t): t is { band: Band; value: number } => t.value !== null
      )
    : [];

  return (
    <div className="space-y-6 pb-4">
      <Header
        kpi={kpi}
        period={period}
        periods={periods}
        fiscalYearLabel={fiscalYearLabel}
        isAdmin={currentUser.role === "ADMIN"}
        fiscalYearClosed={fiscalYearClosed}
      />

      {fiscalYearClosed && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">
          This year is closed. An admin can reopen it to make changes.
        </p>
      )}

      {kpi.leaf?.deadline && kpi.leaf.deadline.monthsLate > 0 && (
        <DeadlineNotice deadline={kpi.leaf.deadline} deadlineMonth={kpi.deadlineMonth} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ScoreChart
          points={history
            .filter((h) => !h.isFuture)
            .map((h) => ({
              period: h.period, score: h.score, band: h.band, provisional: h.provisional,
            }))}
          title={`Score through ${fiscalYearLabel}`}
        />
        {kpi.isLeaf && numericTargets.length > 0 && (
          <ValueChart
            points={history
              .filter((h) => !h.isFuture)
              .map((h) => ({
                period: h.period, value: h.value, provisional: h.basis === "ESTIMATE",
              }))}
            targets={numericTargets}
            unit={kpi.unit}
            title="Year-to-date value against targets"
          />
        )}
        {!kpi.isLeaf && <ChildrenPanel subKpis={subKpis} period={period} />}
      </div>

      {kpi.isLeaf && (
        <EntryPanel
          kpi={kpi}
          draft={draft}
          setField={setField}
          period={period}
          readOnly={!canEditFigures}
          fiscalYearClosed={fiscalYearClosed}
        />
      )}

      {pendingProposal && (
        <PendingProposalPanel proposal={pendingProposal} isAdmin={currentUser.role === "ADMIN"} />
      )}

      <SettingsPanel
        subject={{ isLeaf: kpi.isLeaf, globalWeight: kpi.globalWeight }}
        draft={draft}
        setField={setAttributeField}
        departments={departments}
        crossesMetricBoundary={crossesMetricBoundary}
        readOnly={!canEditSettings}
        fiscalYearClosed={fiscalYearClosed}
      />

      {kpi.isLeaf && (
        <TargetsPanel
          subject={{
            direction: kpi.direction,
            targetConfig: kpi.targetConfig,
            unit: kpi.unit,
            currentValue: kpi.leaf?.value ?? null,
          }}
          draft={draft}
          setField={setAttributeField}
          readOnly={!canEditSettings}
        />
      )}

      {!kpi.isLeaf && subKpis.length > 0 && <ChildrenTable subKpis={subKpis} period={period} />}

      <ScoreExplainer
        kpi={kpi}
        subKpis={subKpis}
        period={period}
        completionDate={completionEntry?.completionDate ?? null}
        completionBasis={completionEntry?.basis ?? null}
      />

      <HistoryTable history={history} kpi={kpi} currentPeriod={period} />

      <UpdatesPanel kpiId={kpi.id} period={period} updates={updates} />

      <AuditPanel audits={audits} />

      <SaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        error={error}
        count={changes.length}
        onSave={() => setConfirming(true)}
        onDiscard={reset}
      />

      <ConfirmSaveDialog
        open={confirming}
        changes={changes}
        warnings={warnings}
        error={error}
        isSaving={isSaving}
        title={
          submittingProposal
            ? `Submit changes to ${kpi.name} for admin approval?`
            : `Save changes to ${kpi.name}?`
        }
        onConfirm={save}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

// --------------------------------------------------------------------------

function Header({
  kpi, period, periods, fiscalYearLabel, isAdmin, fiscalYearClosed,
}: {
  kpi: KpiProps; period: string; periods: string[]; fiscalYearLabel: string; isAdmin: boolean;
  fiscalYearClosed: boolean;
}) {
  const router = useRouter();

  return (
    <div className="rounded-lg border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
              {kpi.code}
            </span>
            <span className="text-xs text-gray-500">
              {kpi.isLeaf ? `Level ${kpi.level}` : `Level ${kpi.level} · rolls up ${""}`}
              {!kpi.isLeaf && "from its sub-KPIs"}
            </span>
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{kpi.name}</h1>
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
            <div className="flex gap-1.5">
              <dt className="text-gray-500">Weight</dt>
              <dd className="tabular font-medium">{kpi.weight.toFixed(1)}%</dd>
            </div>
            {kpi.metricType && (
              <div className="flex gap-1.5">
                <dt className="text-gray-500">Metric</dt>
                <dd className="font-medium">
                  {kpi.metricType.replace(/_/g, " ").toLowerCase()}
                  {kpi.unit && ` (${kpi.unit})`}
                </dd>
              </div>
            )}
            {kpi.direction && (
              <div className="flex gap-1.5">
                <dt className="text-gray-500">Better when</dt>
                <dd className="font-medium">
                  {kpi.direction === "HIGHER_BETTER" ? "higher" : "lower"}
                </dd>
              </div>
            )}
            {kpi.deadlineMonth && (
              <div className="flex gap-1.5">
                <dt className="text-gray-500">Deadline</dt>
                <dd className="font-medium">{formatPeriodLabel(kpi.deadlineMonth)}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="text-right">
          <ScoreCell
            score={kpi.score}
            band={kpi.band}
            provisional={kpi.provisional}
            calibrated={!!kpi.leaf?.override}
            size="lg"
            showBandLabel
            placeholder={kpi.leaf?.pendingReason === "NOT_YET_DUE" ? "not due" : "no data"}
          />
          <div className="mt-1">
            <CoverageBadge coverage={kpi.coverage} />
            <span className="ml-1 text-xs text-gray-500">scored</span>
          </div>
          <select
            aria-label="Reporting month"
            value={period}
            onChange={(e) => router.push(`/kpi/${kpi.id}?period=${e.target.value}`)}
            className="mt-2 rounded border border-gray-300 bg-white px-2 py-1 text-sm"
          >
            {periods.map((p) => (
              <option key={p} value={p}>{formatPeriodLabel(p)}</option>
            ))}
          </select>
          {isAdmin && kpi.isLeaf && !fiscalYearClosed && (
            <CalibrateControl kpiId={kpi.id} period={period} override={kpi.leaf?.override ?? null} />
          )}
        </div>
      </div>
      <p className="sr-only">{fiscalYearLabel}</p>
    </div>
  );
}

function CalibrateControl({
  kpiId, period, override,
}: {
  kpiId: string;
  period: string;
  override: { score: number; reason: string; byUsername: string; createdAt: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(override ? String(override.score) : "");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const parsed = Number(score);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5) {
      setError("Enter a score between 0 and 5.");
      return;
    }
    if (!reason.trim()) {
      setError("Explain why this score is being calibrated.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await overrideScore({ kpiId, period, score: parsed, reason: reason.trim() });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  };

  const clear = () => {
    setError(null);
    startTransition(async () => {
      const result = await clearOverride(kpiId, period);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 block w-full text-right text-xs text-blue-700 hover:underline"
      >
        {override ? "Edit calibration" : "Calibrate score"}
      </button>
    );
  }

  return (
    <div className="mt-2 w-56 rounded border border-gray-300 bg-white p-3 text-left shadow-sm">
      <label className="block text-xs font-medium text-gray-700">
        Calibrated score (0–5)
        <input
          type="number"
          step="0.1"
          min="0"
          max="5"
          className={`mt-1 ${inputClass}`}
          value={score}
          onChange={(e) => setScore(e.target.value)}
        />
      </label>
      <label className="mt-2 block text-xs font-medium text-gray-700">
        Reason
        <textarea
          rows={2}
          className={`mt-1 ${inputClass}`}
          placeholder="Why is this being calibrated?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {error && <p className="mt-1 text-xs font-medium text-rose-700">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        {override && (
          <button
            type="button"
            onClick={clear}
            disabled={pending}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Remove
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function DeadlineNotice({
  deadline, deadlineMonth,
}: {
  deadline: NonNullable<LeafScore["deadline"]>; deadlineMonth: string | null;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-medium">
        Past its deadline{deadlineMonth && ` of ${formatPeriodLabel(deadlineMonth)}`} by{" "}
        {deadline.monthsLate} month{deadline.monthsLate === 1 ? "" : "s"}.
      </p>
      <p className="mt-1">
        {deadline.frozen ? (
          <>
            This KPI&rsquo;s score was fixed at its deadline, so anything achieved since is
            recorded but does not change the score. It would otherwise have scored{" "}
            <strong>{deadline.rawScore.toFixed(1)}</strong>.
          </>
        ) : (
          <>
            Achievement still earns partial credit, capped at{" "}
            <strong>{(deadline.cap ?? 0).toFixed(1)}</strong> for being {deadline.monthsLate}{" "}
            month{deadline.monthsLate === 1 ? "" : "s"} late. Without the deadline it would
            have scored <strong>{deadline.rawScore.toFixed(1)}</strong>.
          </>
        )}
      </p>
    </div>
  );
}

/**
 * A two-option Actual/Estimate pill pair, standing in for what used to be a
 * `<select>`. Placed right beside the value or date it qualifies rather than
 * in its own grid cell, so the two read as one figure-plus-qualifier decision
 * instead of two unrelated fields that happen to be near each other.
 */
function BasisToggle({
  value, onChange, label, hint,
}: {
  value: "ACTUAL" | "ESTIMATE";
  onChange: (value: "ACTUAL" | "ESTIMATE") => void;
  label: string;
  hint?: string;
}) {
  // Deliberately not built on the shared `Field` component: `Field` wraps its
  // children in a `<label>`, and a `<label>` wrapping a group of `<button>`s
  // pollutes each button's accessible name with the label's own text on top
  // of its visible content. A plain `<span>` for the visible label, matching
  // the pattern the department picker elsewhere on this page already uses
  // for a pill group, keeps each button's name exactly what it displays.
  return (
    <div>
      <span className="block text-xs font-medium text-gray-700">{label}</span>
      <div role="radiogroup" aria-label={label} className="mt-1 inline-flex rounded border border-gray-300 bg-white p-0.5">
        {(["ACTUAL", "ESTIMATE"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={`rounded px-2.5 py-1 text-sm font-medium transition-colors ${
              value === option
                ? option === "ESTIMATE"
                  ? "bg-amber-600 text-white"
                  : "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {option === "ACTUAL" ? "Actual" : "Estimate"}
          </button>
        ))}
      </div>
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </div>
  );
}

function EntryPanel({
  kpi, draft, setField, period, readOnly, fiscalYearClosed,
}: {
  kpi: KpiProps;
  draft: Draft;
  setField: <K extends keyof Draft>(field: K, value: Draft[K]) => void;
  period: string;
  readOnly?: boolean;
  fiscalYearClosed?: boolean;
}) {
  const isMilestone = draft.metricType === "MONTH_COMPLETION";

  return (
    <Panel title={`Report for ${formatPeriodLabel(period)}`}>
      {readOnly && (
        <p className="mb-3 text-xs text-amber-700">
          {fiscalYearClosed
            ? "Read-only — this year is closed."
            : "Read-only — this KPI isn't owned by your department."}
        </p>
      )}
      <fieldset disabled={readOnly} className="flex flex-wrap items-start gap-x-8 gap-y-3">
        {isMilestone ? (
          <Field label="Completion date" hint="Leave blank until it is finished.">
            <DateField
              className={`mt-1 ${inputClass}`}
              value={draft.completionDate}
              onChange={(iso) => setField("completionDate", iso)}
            />
          </Field>
        ) : (
          <Field label={`Year-to-date value${kpi.unit ? ` (${kpi.unit})` : ""}`}>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              className={`mt-1 ${inputClass}`}
              value={draft.value}
              onChange={(e) => setField("value", e.target.value)}
            />
          </Field>
        )}

        <BasisToggle
          label={isMilestone ? "This date is" : "This figure is"}
          hint={
            draft.basis === "ESTIMATE"
              ? isMilestone
                ? "An estimated date scores provisionally, exactly like an estimated year-to-date figure."
                : "Scores from estimates are flagged as provisional."
              : undefined
          }
          value={draft.basis}
          onChange={(basis) => setField("basis", basis)}
        />
      </fieldset>

      <fieldset disabled={readOnly} className="mt-4 border-t pt-4">
        <Field label="Note for this month">
          <textarea
            rows={2}
            className={`mt-1 ${inputClass}`}
            value={draft.note}
            placeholder="Explain a variance, or leave blank."
            onChange={(e) => setField("note", e.target.value)}
          />
        </Field>
      </fieldset>
    </Panel>
  );
}

function ChildrenPanel({ subKpis, period }: {
  subKpis: { id: string; name: string; score: number | null; band: Band | null; weight: number }[];
  period: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-gray-700">Contributing sub-KPIs</h2>
      <ul className="space-y-2">
        {subKpis.map((child) => (
          <li key={child.id} className="flex items-center justify-between gap-3">
            <Link href={`/kpi/${child.id}?period=${period}`} className="truncate text-sm hover:text-blue-700 hover:underline">
              {child.name}
            </Link>
            <span className="flex shrink-0 items-center gap-2">
              <span className="tabular text-xs text-gray-500">{child.weight.toFixed(1)}%</span>
              <ScoreCell score={child.score} band={child.band} size="sm" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChildrenTable({ subKpis, period }: {
  subKpis: {
    id: string; code: string; name: string; weight: number;
    score: number | null; band: Band | null; coverage: number; provisional: boolean;
    meetTarget: string | null; unit: string | null; metricType: MetricType | null;
  }[];
  period: string;
}) {
  const totalWeight = subKpis.reduce((sum, c) => sum + c.weight, 0);

  return (
    <Panel
      title="How this score is made up"
      description="Each sub-KPI's share of this KPI's weight, and what it contributed."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-medium text-gray-500 uppercase">
              <th scope="col" className="py-2">Sub-KPI</th>
              <th scope="col" className="py-2 text-right">Weight</th>
              <th scope="col" className="py-2 text-right">Meet Target</th>
              <th scope="col" className="py-2 text-right">Share</th>
              <th scope="col" className="py-2 text-center">Score</th>
              <th scope="col" className="py-2 text-right">Scored</th>
            </tr>
          </thead>
          <tbody>
            {subKpis.map((child) => (
              <tr key={child.id} className="border-b last:border-0">
                <th scope="row" className="py-1.5 text-left font-normal">
                  <Link href={`/kpi/${child.id}?period=${period}`} className="hover:text-blue-700 hover:underline">
                    <span className="font-mono text-xs text-gray-400">{child.code}</span>{" "}
                    {child.name}
                  </Link>
                </th>
                <td className="tabular py-1.5 text-right text-gray-600">
                  {child.weight.toFixed(1)}%
                </td>
                <td className="tabular py-1.5 text-right text-gray-500">
                  {child.meetTarget === null ? (
                    "—"
                  ) : (
                    <>
                      {child.meetTarget}
                      {child.unit && child.metricType !== "MONTH_COMPLETION" && (
                        <span className="ml-0.5 text-xs text-gray-400">{child.unit}</span>
                      )}
                    </>
                  )}
                </td>
                <td className="tabular py-1.5 text-right text-gray-500">
                  {totalWeight > 0 ? `${((child.weight / totalWeight) * 100).toFixed(0)}%` : "—"}
                </td>
                <td className="py-1.5 text-center">
                  <ScoreCell
                    score={child.score} band={child.band}
                    provisional={child.provisional} size="sm"
                  />
                </td>
                <td className="py-1.5 text-right">
                  <CoverageBadge coverage={child.coverage} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function HistoryTable({
  history, kpi, currentPeriod,
}: {
  history: HistoryRow[]; kpi: KpiProps; currentPeriod: string;
}) {
  return (
    <Panel title="Month by month" description="Every month of the fiscal year.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-medium text-gray-500 uppercase">
              <th scope="col" className="py-2">Month</th>
              {kpi.isLeaf && kpi.metricType !== "MONTH_COMPLETION" && (
                <th scope="col" className="py-2 text-right">YTD value</th>
              )}
              {kpi.metricType === "MONTH_COMPLETION" && (
                <th scope="col" className="py-2">Completed</th>
              )}
              <th scope="col" className="px-3 py-2 text-center">Score</th>
              <th scope="col" className="px-3 py-2 text-right">Scored</th>
              <th scope="col" className="py-2 pl-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr
                key={row.period}
                className={`border-b last:border-0 ${
                  row.period === currentPeriod ? "bg-blue-50/60" : ""
                } ${row.isFuture ? "text-gray-400" : ""}`}
              >
                <th scope="row" className="py-1.5 text-left font-normal whitespace-nowrap">
                  {formatPeriodLabel(row.period)}
                </th>
                {kpi.isLeaf && kpi.metricType !== "MONTH_COMPLETION" && (
                  <td className="tabular py-1.5 text-right">
                    {row.value === null ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <>
                        {row.value.toLocaleString()}
                        {row.basis === "ESTIMATE" && (
                          <span className="ml-1 text-xs text-amber-700">est</span>
                        )}
                      </>
                    )}
                  </td>
                )}
                {kpi.metricType === "MONTH_COMPLETION" && (
                  <td className="py-1.5">{row.completionDate ? formatDate(row.completionDate) : <span className="text-gray-400">—</span>}</td>
                )}
                <td className="px-3 py-1.5 text-center">
                  <ScoreCell
                    score={row.score} band={row.band}
                    provisional={row.provisional} size="sm"
                    placeholder={row.isFuture ? "—" : "—"}
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  {row.isFuture ? (
                    <span className="text-xs text-gray-400">to come</span>
                  ) : (
                    <CoverageBadge coverage={row.coverage} />
                  )}
                </td>
                <td className="py-1.5 pl-3 text-xs text-gray-600">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function UpdatesPanel({
  kpiId, period, updates,
}: {
  kpiId: string;
  period: string;
  updates: { id: string; period: string; body: string; author: string | null; createdAt: string }[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const post = () => {
    startTransition(async () => {
      try {
        const result = await addKpiUpdate({ kpiId, period, body });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setBody("");
        setError(null);
        router.refresh();
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      }
    });
  };

  return (
    <Panel
      title="Status updates"
      description="Narrative about this KPI, newest first. Posted immediately, separately from the Save button."
    >
      <div className="space-y-2">
        <textarea
          rows={3}
          className={inputClass}
          value={body}
          placeholder="What has moved on this KPI?"
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={post}
            disabled={pending || !body.trim()}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
          >
            {pending ? "Posting…" : "Post update"}
          </button>
          <span className="text-xs text-gray-500">
            Filed under {formatPeriodLabel(period)}
          </span>
        </div>
        {error && <p className="text-sm font-medium text-rose-700">{error}</p>}
      </div>

      {updates.length > 0 && (
        <ul className="mt-5 space-y-4 border-t pt-4">
          {updates.map((update) => (
            <li key={update.id}>
              <div className="flex flex-wrap items-baseline gap-2 text-xs text-gray-500">
                <span className="font-medium text-gray-700">
                  {update.author || "Anonymous"}
                </span>
                <span>{formatDate(new Date(update.createdAt))}</span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5">
                  {formatPeriodLabel(update.period)}
                </span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap text-gray-800">{update.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function PendingProposalPanel({
  proposal, isAdmin,
}: {
  proposal: PendingProposal;
  isAdmin: boolean;
}) {
  return (
    <Panel
      title="Pending settings change"
      description={
        isAdmin
          ? "Awaiting your review — approve or reject it from the Approvals queue."
          : "Submitted for admin approval. It will apply once approved."
      }
    >
      <div className="mb-2 text-xs text-gray-500">
        Proposed by <span className="font-medium text-gray-700">{proposal.proposedByUsername}</span>{" "}
        on {formatDate(new Date(proposal.createdAt))}
      </div>
      <ul className="space-y-2">
        {proposal.summary.map((change) => (
          <li key={change.field} className="text-sm">
            <div className="font-medium text-gray-900">{change.label}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-gray-600">
              <span className="rounded bg-gray-100 px-1.5 py-0.5 line-through decoration-gray-400">
                {change.from}
              </span>
              <span aria-hidden>→</span>
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-900">
                {change.to}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {isAdmin && (
        <Link href="/manage/approvals" className="mt-3 inline-block text-sm text-blue-700 hover:underline">
          Go to Approvals →
        </Link>
      )}
    </Panel>
  );
}

function AuditPanel({
  audits,
}: {
  audits: { id: string; field: string; label: string; from: string; to: string; author: string | null; createdAt: string }[];
}) {
  if (audits.length === 0) return null;

  return (
    <Panel title="Changes to this KPI" description="A record of definition changes — who changed what, and from what.">
      <ul className="space-y-3">
        {audits.map((a) => (
          <li key={a.id} className="text-sm">
            <div className="flex flex-wrap items-baseline gap-2 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{a.author || "Anonymous"}</span>
              <span>{formatDate(new Date(a.createdAt))}</span>
            </div>
            <div className="mt-0.5 font-medium text-gray-900">{a.label}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-gray-600">
              <span className="rounded bg-gray-100 px-1.5 py-0.5 line-through decoration-gray-400">{a.from}</span>
              <span aria-hidden>→</span>
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-900">{a.to}</span>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

