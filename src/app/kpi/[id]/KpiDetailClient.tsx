"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { ConfirmSaveDialog, SaveBar } from "@/components/ConfirmSaveDialog";
import { DateField } from "@/components/DateField";
import { MonthField } from "@/components/MonthField";
import { CoverageBadge, ScoreCell } from "@/components/ScoreCell";
import { ScoreChart, ValueChart } from "@/components/ScoreChart";
import { useDirtyForm } from "@/components/useDirtyForm";
import { BAND_STYLES } from "@/lib/band-style";
import { DEFAULT_CURRENCY } from "@/lib/config";
import { formatDate, formatMonth } from "@/lib/dates";
import { formatPeriodLabel } from "@/lib/fiscal";
import {
  BANDS,
  BAND_BOUNDS,
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
  currentUser,
  pendingProposal,
}: {
  kpi: KpiProps;
  subKpis: {
    id: string; code: string; name: string; weight: number;
    score: number | null; band: Band | null; coverage: number; provisional: boolean;
    exactScore: number | null; scoredWeight: number;
  }[];
  history: HistoryRow[];
  updates: { id: string; period: string; body: string; author: string | null; createdAt: string }[];
  audits: { id: string; field: string; label: string; from: string; to: string; author: string | null; createdAt: string }[];
  departments: { id: string; name: string }[];
  period: string;
  periods: string[];
  fiscalYearLabel: string;
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
  const canEditFigures = ownsKpi;
  const canEditSettings =
    currentUser.role === "ADMIN" ||
    (kpi.isLeaf && ownsKpi && !pendingProposal);
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
      <Header kpi={kpi} period={period} periods={periods} fiscalYearLabel={fiscalYearLabel} />

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
        />
      )}

      {pendingProposal && (
        <PendingProposalPanel proposal={pendingProposal} isAdmin={currentUser.role === "ADMIN"} />
      )}

      <SettingsPanel
        kpi={kpi}
        draft={draft}
        setField={setField}
        departments={departments}
        crossesMetricBoundary={crossesMetricBoundary}
        readOnly={!canEditSettings}
      />

      {kpi.isLeaf && (
        <TargetsPanel kpi={kpi} draft={draft} setField={setField} readOnly={!canEditSettings} />
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
  kpi, period, periods, fiscalYearLabel,
}: {
  kpi: KpiProps; period: string; periods: string[]; fiscalYearLabel: string;
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
        </div>
      </div>
      <p className="sr-only">{fiscalYearLabel}</p>
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

function Panel({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-white">
      <div className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

const inputClass =
  "w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
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
  kpi, draft, setField, period, readOnly,
}: {
  kpi: KpiProps;
  draft: Draft;
  setField: <K extends keyof Draft>(field: K, value: Draft[K]) => void;
  period: string;
  readOnly?: boolean;
}) {
  const isMilestone = draft.metricType === "MONTH_COMPLETION";

  return (
    <Panel title={`Report for ${formatPeriodLabel(period)}`}>
      {readOnly && (
        <p className="mb-3 text-xs text-amber-700">
          Read-only — this KPI isn&apos;t owned by your department.
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

function SettingsPanel({
  kpi, draft, setField, departments, crossesMetricBoundary, readOnly,
}: {
  kpi: KpiProps;
  draft: Draft;
  setField: <K extends keyof Draft>(field: K, value: Draft[K]) => void;
  departments: { id: string; name: string }[];
  crossesMetricBoundary: boolean;
  readOnly?: boolean;
}) {
  const toggleDepartment = (id: string) => {
    const next = draft.departmentIds.includes(id)
      ? draft.departmentIds.filter((d) => d !== id)
      : [...draft.departmentIds, id];
    setField("departmentIds", next.sort());
  };

  const isMilestone = draft.metricType === "MONTH_COMPLETION";
  const isNumericMetric = draft.metricType !== "" && draft.metricType !== "MONTH_COMPLETION";

  return (
    <Panel title="Definition" description="Metric type, target mode and direction are editable here — changing any of them recalculates every month's score from the new definition.">
      {readOnly && (
        <p className="mb-3 text-xs text-amber-700">
          Read-only — only an admin, or your department if it owns this KPI, can change these settings.
        </p>
      )}
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Code" hint="Unique within the year. A spreadsheet still using the old code will treat this as a different KPI.">
          <input
            className={`mt-1 ${inputClass} font-mono`}
            value={draft.code}
            onChange={(e) => setField("code", e.target.value)}
          />
        </Field>

        <Field label="Name">
          <input
            className={`mt-1 ${inputClass}`}
            value={draft.name}
            onChange={(e) => setField("name", e.target.value)}
          />
        </Field>

        <Field label="Weight % (of its group)" hint="Its share of its own siblings — every group should add to 100%.">
          <input
            type="number" step="any" min="0"
            className={`mt-1 ${inputClass}`}
            value={draft.weight}
            onChange={(e) => setField("weight", e.target.value)}
          />
        </Field>

        <Field label="Global %" hint="Derived — this KPI's share of the whole company. Read-only.">
          <input
            disabled
            className={`mt-1 ${inputClass} bg-gray-50 text-gray-500`}
            value={`${kpi.globalWeight.toFixed(2)}%`}
          />
        </Field>

        <Field label="Reporting frequency">
          <select
            className={`mt-1 ${inputClass}`}
            value={draft.frequency}
            onChange={(e) => setField("frequency", e.target.value as Frequency)}
          >
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly (Jun / Sep / Dec / Mar)</option>
            <option value="ANNUAL">Annual (March)</option>
          </select>
        </Field>

        {kpi.isLeaf && (
          <>
            <Field label="Metric type">
              <select
                className={`mt-1 ${inputClass}`}
                value={draft.metricType}
                onChange={(e) => setField("metricType", e.target.value as Draft["metricType"])}
              >
                <option value="">No metric (make this a rollup)</option>
                <option value="PERCENTAGE">Percentage</option>
                <option value="DOLLAR">Money</option>
                <option value="QUANTITY">Quantity</option>
                <option value="DAYS">Days</option>
                <option value="MONTH_COMPLETION">Month of completion</option>
              </select>
            </Field>

            {isMilestone && (
              <Field label="Target month (Meet)">
                <MonthField
                  className={`mt-1 ${inputClass}`}
                  value={draft.targetMonth}
                  onChange={(yearMonth) => setField("targetMonth", yearMonth)}
                />
              </Field>
            )}

            {isNumericMetric && (
              <>
                <Field label="Unit">
                  <input
                    className={`mt-1 ${inputClass}`}
                    value={draft.unit}
                    placeholder={`e.g. ${DEFAULT_CURRENCY}, %, days`}
                    onChange={(e) => setField("unit", e.target.value)}
                  />
                </Field>
                <Field label="Direction">
                  <select
                    className={`mt-1 ${inputClass}`}
                    value={draft.direction}
                    onChange={(e) => setField("direction", e.target.value as Draft["direction"])}
                  >
                    <option value="">Choose one</option>
                    <option value="HIGHER_BETTER">Higher is better</option>
                    <option value="LOWER_BETTER">Lower is better</option>
                  </select>
                </Field>
                <Field label="Target mode">
                  <select
                    className={`mt-1 ${inputClass}`}
                    value={draft.targetMode}
                    onChange={(e) => setField("targetMode", e.target.value as Draft["targetMode"])}
                  >
                    <option value="">Choose one</option>
                    <option value="FIXED">Fixed — one number per band</option>
                    <option value="RANGE">Range — a window per band</option>
                  </select>
                </Field>
                <Field
                  label="Phasing"
                  hint="Pro-rates the annual target by how much of the year has elapsed. For cumulative measures only — never rates or stocks."
                >
                  <select
                    className={`mt-1 ${inputClass}`}
                    value={draft.phasing}
                    onChange={(e) => setField("phasing", e.target.value as Phasing)}
                  >
                    <option value="NONE">None — full-year target every month</option>
                    <option value="EVEN">Even — divided evenly across 12 months</option>
                    <option value="CUSTOM">Custom — month-by-month shares</option>
                  </select>
                </Field>
                {draft.phasing === "CUSTOM" && (
                  <Field label="Phase shares" hint="12 monthly shares (April first), comma-separated, summing to 100.">
                    <input
                      className={`mt-1 ${inputClass}`}
                      value={draft.phaseShares}
                      placeholder="5, 5, 10, 10, 10, 10, 10, 10, 10, 10, 5, 5"
                      onChange={(e) => setField("phaseShares", e.target.value)}
                    />
                  </Field>
                )}
              </>
            )}

          </>
        )}

        {kpi.isLeaf && !isMilestone && draft.metricType !== "" && (
          <Field label="Deadline month" hint="Optional. Means the last day of that month.">
            <MonthField
              className={`mt-1 ${inputClass}`}
              value={draft.deadlineMonth}
              onChange={(yearMonth) => setField("deadlineMonth", yearMonth)}
            />
          </Field>
        )}
        {kpi.isLeaf && !isMilestone && draft.metricType !== "" && (
          <Field
            label="After the deadline"
            hint={
              draft.scoreFinalAfterDeadline
                ? "Later achievement is recorded but does not change the score."
                : "Capped at 2.9 one month late, 2.4 two months late, then 0."
            }
          >
            <select
              className={`mt-1 ${inputClass}`}
              disabled={!draft.deadlineMonth}
              value={draft.scoreFinalAfterDeadline ? "final" : "partial"}
              onChange={(e) => setField("scoreFinalAfterDeadline", e.target.value === "final")}
            >
              <option value="partial">Award partial credit</option>
              <option value="final">Freeze the score</option>
            </select>
          </Field>
        )}

        {crossesMetricBoundary && (
          <div className="sm:col-span-2 lg:col-span-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={draft.clearFigures}
                onChange={(e) => setField("clearFigures", e.target.checked)}
              />
              <span>
                Switching between a numeric metric and month-of-completion cannot keep the
                figures already recorded — they cannot be read the new way. Tick this to clear
                them as part of this save; otherwise the save is refused.
              </span>
            </label>
          </div>
        )}

        <div className="sm:col-span-2 lg:col-span-3">
          <span className="block text-xs font-medium text-gray-700">
            Owning departments
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {departments.length === 0 && (
              <p className="text-sm text-gray-500">
                No departments yet —{" "}
                <Link href="/manage" className="text-blue-700 hover:underline">
                  add some
                </Link>
                .
              </p>
            )}
            {departments.map((department) => {
              const selected = draft.departmentIds.includes(department.id);
              return (
                <button
                  key={department.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleDepartment(department.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    selected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {department.name}
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>
    </Panel>
  );
}

function TargetsPanel({
  kpi, draft, setField, readOnly,
}: {
  kpi: KpiProps;
  draft: Draft;
  setField: <K extends keyof Draft>(field: K, value: Draft[K]) => void;
  readOnly?: boolean;
}) {
  const isMilestone = draft.metricType === "MONTH_COMPLETION";
  const currentValue = kpi.leaf?.value ?? null;

  if (!draft.metricType) return null;

  if (isMilestone) {
    return (
      <Panel
        title="Target"
        description="Completing early climbs a band per month; completing late drops one. The target month itself is set above, under Definition."
      >
        <ul className="mt-1 space-y-1 text-sm text-gray-600">
          {BANDS.slice().reverse().map((band, index) => {
            const offset = 3 - index;
            return (
              <li key={band} className="flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full`}
                  style={{ backgroundColor: BAND_STYLES[band].hex }}
                />
                <span className="w-36 font-medium">{bandLabel(band)}</span>
                <span>
                  {offset > 0
                    ? `${offset} month${offset === 1 ? "" : "s"} early`
                    : offset === 0
                      ? "in the target month"
                      : `${-offset} month${offset === -1 ? "" : "s"} late`}
                </span>
              </li>
            );
          })}
          <li className="pl-[1.125rem] text-gray-500">
            More than two months late scores 0.
          </li>
        </ul>
      </Panel>
    );
  }

  const isRange = draft.targetMode === "RANGE";

  return (
    <Panel
      title="Targets"
      description={
        isRange
          ? 'A window per band, written "50-69". The score scales across the window.'
          : "One number per band. Reaching a band's target scores the top of that band."
      }
    >
      <fieldset disabled={readOnly} className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-medium text-gray-500 uppercase">
              <th scope="col" className="py-2">Band</th>
              <th scope="col" className="py-2">Score range</th>
              <th scope="col" className="py-2">{isRange ? "Value window" : "Target"}</th>
              <th scope="col" className="py-2" />
            </tr>
          </thead>
          <tbody>
            {BANDS.slice().reverse().map((band) => {
              const reached = isTargetReached(kpi, band, currentValue);
              return (
                <tr key={band} className="border-b last:border-0">
                  <th scope="row" className="py-1.5 text-left font-normal">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: BAND_STYLES[band].hex }}
                      />
                      {bandLabel(band)}
                    </span>
                  </th>
                  <td className="tabular py-1.5 text-gray-500">
                    {BAND_BOUNDS[band].lo.toFixed(1)}–{BAND_BOUNDS[band].hi.toFixed(1)}
                  </td>
                  <td className="py-1.5 pr-3">
                    <input
                      className={`${inputClass} max-w-40`}
                      value={draft.targets[band] ?? ""}
                      placeholder={isRange ? "50-69" : "100"}
                      onChange={(e) =>
                        setField("targets", { ...draft.targets, [band]: e.target.value })
                      }
                    />
                  </td>
                  <td className="py-1.5 text-xs">
                    {reached && (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800">
                        reached
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </fieldset>
      {currentValue !== null && (
        <p className="mt-3 text-xs text-gray-500">
          Current year-to-date figure: <strong className="tabular">{currentValue.toLocaleString()}</strong>
          {kpi.unit && ` ${kpi.unit}`}.
        </p>
      )}
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

function targetPoint(kpi: KpiProps, band: Band): number | null {
  const value = (kpi.targetConfig as Record<Band, unknown> | null)?.[band];
  if (typeof value === "number") return value;
  if (Array.isArray(value) && value.length === 2) {
    return kpi.direction === "HIGHER_BETTER"
      ? Math.max(Number(value[0]), Number(value[1]))
      : Math.min(Number(value[0]), Number(value[1]));
  }
  return null;
}

function isTargetReached(kpi: KpiProps, band: Band, actual: number | null): boolean {
  if (actual === null) return false;
  const target = targetPoint(kpi, band);
  if (target === null) return false;
  return kpi.direction === "HIGHER_BETTER" ? actual >= target : actual <= target;
}
