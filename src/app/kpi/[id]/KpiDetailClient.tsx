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
  type LeafScore,
  type MetricType,
  type TargetConfig,
  type TargetMode,
} from "@/lib/scoring";
import {
  addKpiUpdate,
  saveEntry,
  saveKpiSettings,
  type TargetConfigInput,
} from "@/app/actions/kpi";

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

type KpiProps = {
  id: string;
  code: string;
  name: string;
  level: number;
  isLeaf: boolean;
  weight: number;
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

/** One draft object for the whole page, so a single Save covers every edit. */
type Draft = {
  name: string;
  weight: string;
  unit: string;
  departmentIds: string[];
  deadlineMonth: string;
  scoreFinalAfterDeadline: boolean;
  targets: Record<string, string>;
  value: string;
  basis: "ACTUAL" | "ESTIMATE";
  completionDate: string;
  note: string;
};

export function KpiDetailClient({
  kpi,
  subKpis,
  history,
  updates,
  departments,
  period,
  periods,
  fiscalYearLabel,
}: {
  kpi: KpiProps;
  subKpis: {
    id: string; code: string; name: string; weight: number;
    score: number | null; band: Band | null; coverage: number; provisional: boolean;
  }[];
  history: HistoryRow[];
  updates: { id: string; period: string; body: string; author: string | null; createdAt: string }[];
  departments: { id: string; name: string }[];
  period: string;
  periods: string[];
  fiscalYearLabel: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const current = history.find((h) => h.period === period);

  const initial = useMemo<Draft>(
    () => ({
      name: kpi.name,
      weight: kpi.isLeaf ? String(kpi.weight) : "",
      unit: kpi.unit ?? "",
      departmentIds: [...kpi.departmentIds].sort(),
      deadlineMonth: kpi.deadlineMonth ?? "",
      scoreFinalAfterDeadline: kpi.scoreFinalAfterDeadline,
      targets: targetsToDraft(kpi),
      value: current?.value !== null && current?.value !== undefined ? String(current.value) : "",
      basis: current?.basis ?? "ACTUAL",
      completionDate: current?.completionDate ?? "",
      note: current?.note ?? "",
    }),
    // Re-seeds when the month changes, which is the only time the server sends
    // a materially different record for the same KPI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kpi.id, period]
  );

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
        return BANDS.map((b) => {
          const raw = targets[b] || "";
          const shown = kpi.metricType === "MONTH_COMPLETION" && b === "MEET" ? formatMonth(raw) : raw;
          return `${bandLabel(b)} ${shown || "—"}`;
        }).join("; ");
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
      name: "Name", weight: "Weight %", unit: "Unit", departmentIds: "Departments",
      deadlineMonth: "Deadline month", scoreFinalAfterDeadline: "After the deadline",
      targets: "Targets", value: `Value for ${formatPeriodLabel(period)}`,
      basis: "Figure is", completionDate: "Completion date",
      note: `Note for ${formatPeriodLabel(period)}`,
    }
  );

  const { draft, setField, changes, isDirty, isSaving, error, reset, commit } = form;

  const entryFields = new Set(["value", "basis", "completionDate", "note"]);
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

      if ([...touched].some((f) => !entryFields.has(f))) {
        const result = await saveKpiSettings({
          kpiId: kpi.id,
          name: d.name,
          weight: kpi.isLeaf ? Number(d.weight || 0) : 0,
          unit: d.unit || null,
          departmentIds: d.departmentIds,
          deadlineMonth: d.deadlineMonth || null,
          scoreFinalAfterDeadline: d.scoreFinalAfterDeadline,
          targetConfig: draftToTargets(kpi, d.targets),
        });
        if (!result.ok) throw new Error(result.error);
      }
    });

    if (ok) {
      setConfirming(false);
      router.refresh();
    }
  };

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
        />
      )}

      <SettingsPanel
        kpi={kpi}
        draft={draft}
        setField={setField}
        departments={departments}
      />

      {kpi.isLeaf && <TargetsPanel kpi={kpi} draft={draft} setField={setField} />}

      {!kpi.isLeaf && subKpis.length > 0 && <ChildrenTable subKpis={subKpis} period={period} />}

      <HistoryTable history={history} kpi={kpi} currentPeriod={period} />

      <UpdatesPanel kpiId={kpi.id} period={period} updates={updates} />

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
        isSaving={isSaving}
        title={`Save changes to ${kpi.name}?`}
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

function EntryPanel({
  kpi, draft, setField, period,
}: {
  kpi: KpiProps;
  draft: Draft;
  setField: <K extends keyof Draft>(field: K, value: Draft[K]) => void;
  period: string;
}) {
  const isMilestone = kpi.metricType === "MONTH_COMPLETION";

  return (
    <Panel
      title={`Figures for ${formatPeriodLabel(period)}`}
      description={
        isMilestone
          ? "Record the date this was actually completed."
          : "Year-to-date figure, compared against the full-year target."
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isMilestone ? (
          <Field label="Completion date" hint="Leave blank until it is finished.">
            <DateField
              className={`mt-1 ${inputClass}`}
              value={draft.completionDate}
              onChange={(iso) => setField("completionDate", iso)}
            />
          </Field>
        ) : (
          <>
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
            <Field
              label="This figure is"
              hint={
                draft.basis === "ESTIMATE"
                  ? "Scores from estimates are flagged as provisional."
                  : undefined
              }
            >
              <select
                className={`mt-1 ${inputClass}`}
                value={draft.basis}
                onChange={(e) => setField("basis", e.target.value as Draft["basis"])}
              >
                <option value="ACTUAL">An actual</option>
                <option value="ESTIMATE">An estimate</option>
              </select>
            </Field>
          </>
        )}

        <div className="sm:col-span-2">
          <Field label="Note for this month">
            <textarea
              rows={2}
              className={`mt-1 ${inputClass}`}
              value={draft.note}
              placeholder="Explain a variance, or leave blank."
              onChange={(e) => setField("note", e.target.value)}
            />
          </Field>
        </div>
      </div>
    </Panel>
  );
}

function SettingsPanel({
  kpi, draft, setField, departments,
}: {
  kpi: KpiProps;
  draft: Draft;
  setField: <K extends keyof Draft>(field: K, value: Draft[K]) => void;
  departments: { id: string; name: string }[];
}) {
  const toggleDepartment = (id: string) => {
    const next = draft.departmentIds.includes(id)
      ? draft.departmentIds.filter((d) => d !== id)
      : [...draft.departmentIds, id];
    setField("departmentIds", next.sort());
  };

  return (
    <Panel title="Definition">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Name">
          <input
            className={`mt-1 ${inputClass}`}
            value={draft.name}
            onChange={(e) => setField("name", e.target.value)}
          />
        </Field>

        {kpi.isLeaf && (
          <>
            <Field label="Weight %" hint="All lowest-level KPIs should add to 100%.">
              <input
                type="number" step="any" min="0"
                className={`mt-1 ${inputClass}`}
                value={draft.weight}
                onChange={(e) => setField("weight", e.target.value)}
              />
            </Field>
            <Field label="Unit">
              <input
                className={`mt-1 ${inputClass}`}
                value={draft.unit}
                placeholder={`e.g. ${DEFAULT_CURRENCY}, %, days`}
                onChange={(e) => setField("unit", e.target.value)}
              />
            </Field>
          </>
        )}

        {kpi.isLeaf && kpi.metricType !== "MONTH_COMPLETION" && (
          <>
            <Field label="Deadline month" hint="Optional. Means the last day of that month.">
              <MonthField
                className={`mt-1 ${inputClass}`}
                value={draft.deadlineMonth}
                onChange={(yearMonth) => setField("deadlineMonth", yearMonth)}
              />
            </Field>
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
          </>
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
      </div>
    </Panel>
  );
}

function TargetsPanel({
  kpi, draft, setField,
}: {
  kpi: KpiProps;
  draft: Draft;
  setField: <K extends keyof Draft>(field: K, value: Draft[K]) => void;
}) {
  const isMilestone = kpi.metricType === "MONTH_COMPLETION";
  const currentValue = kpi.leaf?.value ?? null;

  if (isMilestone) {
    return (
      <Panel
        title="Target"
        description="Completing early climbs a band per month; completing late drops one."
      >
        <div className="max-w-xs">
          <Field label="Target month (Meet)">
            <MonthField
              className={`mt-1 ${inputClass}`}
              value={draft.targets.MEET ?? ""}
              onChange={(yearMonth) => setField("targets", { ...draft.targets, MEET: yearMonth })}
            />
          </Field>
        </div>
        <ul className="mt-4 space-y-1 text-sm text-gray-600">
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

  const isRange = kpi.targetMode === "RANGE";

  return (
    <Panel
      title="Targets"
      description={
        isRange
          ? 'A window per band, written "50-69". The score scales across the window.'
          : "One number per band. Reaching a band's target scores the top of that band."
      }
    >
      <div className="overflow-x-auto">
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
      </div>
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
  const [author, setAuthor] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const post = () => {
    startTransition(async () => {
      try {
        const result = await addKpiUpdate({ kpiId, period, body, author: author || null });
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
          <input
            className={`${inputClass} max-w-48`}
            value={author}
            placeholder="Your name (optional)"
            onChange={(e) => setAuthor(e.target.value)}
          />
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

// --- target draft <-> config -----------------------------------------------

function targetsToDraft(kpi: KpiProps): Record<string, string> {
  const config = kpi.targetConfig;
  if (!config) return {};

  if (kpi.metricType === "MONTH_COMPLETION") {
    return { MEET: (config as { targetMonth?: string }).targetMonth ?? "" };
  }

  const out: Record<string, string> = {};
  for (const band of BANDS) {
    const value = (config as Record<Band, unknown>)[band];
    if (value === undefined || value === null) out[band] = "";
    else if (Array.isArray(value)) out[band] = `${value[0]}-${value[1]}`;
    else out[band] = String(value);
  }
  return out;
}

function draftToTargets(kpi: KpiProps, targets: Record<string, string>): TargetConfigInput | null {
  if (kpi.metricType === "MONTH_COMPLETION") {
    const targetMonth = targets.MEET?.trim();
    return targetMonth ? { kind: "MONTH", targetMonth } : null;
  }

  if (kpi.targetMode === "RANGE") {
    const bands = {} as Record<Band, [number, number]>;
    for (const band of BANDS) {
      const match = (targets[band] ?? "").trim().match(/^(-?[\d.]+)\s*-\s*(-?[\d.]+)$/);
      if (!match) throw new Error(`The ${bandLabel(band)} window should look like "50-69".`);
      bands[band] = [Number(match[1]), Number(match[2])];
    }
    return { kind: "RANGE", bands };
  }

  if (kpi.targetMode === "FIXED") {
    const bands = {} as Record<Band, number>;
    for (const band of BANDS) {
      const value = Number((targets[band] ?? "").replace(/[,\s$£€%]/g, ""));
      if (!Number.isFinite(value)) throw new Error(`The ${bandLabel(band)} target is not a number.`);
      bands[band] = value;
    }
    return { kind: "FIXED", bands };
  }

  return null;
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
