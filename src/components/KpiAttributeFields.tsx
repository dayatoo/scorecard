// The shared form for a KPI's definition — metric type, targets, owning
// departments, deadline, reporting frequency, phasing. Used two places: the
// KPI detail page (`src/app/kpi/[id]/KpiDetailClient.tsx`), and the
// hierarchy page's edit panel (`src/app/manage/hierarchy/KpiEditPanel.tsx`).
//
// Deliberately just presentation, driven by a `draft`/`setField` pair — it
// has no idea how or when saving happens. Both callers build their own
// `SaveKpiSettingsInput` from the same draft shape and call `saveKpiSettings`
// (`src/app/actions/kpi.ts`) themselves, on their own schedule (one shared
// Save for the whole detail page; an immediate Save in the hierarchy panel).

import Link from "next/link";

import { MonthField } from "@/components/MonthField";
import { BAND_STYLES } from "@/lib/band-style";
import { DEFAULT_CURRENCY } from "@/lib/config";
import {
  BANDS,
  BAND_BOUNDS,
  bandLabel,
  type Direction,
  type Frequency,
  type MetricType,
  type Phasing,
  type TargetConfig,
  type TargetMode,
} from "@/lib/scoring";

/** The settings/targets slice of a KPI's editable state — everything these two panels read or write. */
export type AttributeDraft = {
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
  /** Confirms clearing figures that would otherwise block a numeric <-> month-completion change. */
  clearFigures: boolean;
};

export const attributeInputClass =
  "w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

export function Panel({ title, description, children }: {
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

export function Field({ label, hint, children }: {
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

export function SettingsPanel({
  subject, draft, setField, departments, crossesMetricBoundary, readOnly, fiscalYearClosed,
}: {
  subject: { isLeaf: boolean; globalWeight: number };
  draft: AttributeDraft;
  setField: <K extends keyof AttributeDraft>(field: K, value: AttributeDraft[K]) => void;
  departments: { id: string; name: string }[];
  crossesMetricBoundary: boolean;
  readOnly?: boolean;
  fiscalYearClosed?: boolean;
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
          {fiscalYearClosed
            ? "Read-only — this year is closed."
            : "Read-only — only an admin, or your department if it owns this KPI, can change these settings."}
        </p>
      )}
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Code" hint="Unique within the year. A spreadsheet still using the old code will treat this as a different KPI.">
          <input
            className={`mt-1 ${attributeInputClass} font-mono`}
            value={draft.code}
            onChange={(e) => setField("code", e.target.value)}
          />
        </Field>

        <Field label="Name">
          <input
            className={`mt-1 ${attributeInputClass}`}
            value={draft.name}
            onChange={(e) => setField("name", e.target.value)}
          />
        </Field>

        <Field label="Weight % (of its group)" hint="Its share of its own siblings — every group should add to 100%.">
          <input
            type="number" step="any" min="0"
            className={`mt-1 ${attributeInputClass}`}
            value={draft.weight}
            onChange={(e) => setField("weight", e.target.value)}
          />
        </Field>

        <Field label="Global %" hint="Derived — this KPI's share of the whole company. Read-only.">
          <input
            disabled
            className={`mt-1 ${attributeInputClass} bg-gray-50 text-gray-500`}
            value={`${subject.globalWeight.toFixed(2)}%`}
          />
        </Field>

        <Field label="Reporting frequency">
          <select
            className={`mt-1 ${attributeInputClass}`}
            value={draft.frequency}
            onChange={(e) => setField("frequency", e.target.value as Frequency)}
          >
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly (Jun / Sep / Dec / Mar)</option>
            <option value="ANNUAL">Annual (March)</option>
          </select>
        </Field>

        {subject.isLeaf && (
          <>
            <Field label="Metric type">
              <select
                className={`mt-1 ${attributeInputClass}`}
                value={draft.metricType}
                onChange={(e) => setField("metricType", e.target.value as AttributeDraft["metricType"])}
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
                  className={`mt-1 ${attributeInputClass}`}
                  value={draft.targetMonth}
                  onChange={(yearMonth) => setField("targetMonth", yearMonth)}
                />
              </Field>
            )}

            {isNumericMetric && (
              <>
                <Field label="Unit">
                  <input
                    className={`mt-1 ${attributeInputClass}`}
                    value={draft.unit}
                    placeholder={`e.g. ${DEFAULT_CURRENCY}, %, days`}
                    onChange={(e) => setField("unit", e.target.value)}
                  />
                </Field>
                <Field label="Direction">
                  <select
                    className={`mt-1 ${attributeInputClass}`}
                    value={draft.direction}
                    onChange={(e) => setField("direction", e.target.value as AttributeDraft["direction"])}
                  >
                    <option value="">Choose one</option>
                    <option value="HIGHER_BETTER">Higher is better</option>
                    <option value="LOWER_BETTER">Lower is better</option>
                  </select>
                </Field>
                <Field label="Target mode">
                  <select
                    className={`mt-1 ${attributeInputClass}`}
                    value={draft.targetMode}
                    onChange={(e) => setField("targetMode", e.target.value as AttributeDraft["targetMode"])}
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
                    className={`mt-1 ${attributeInputClass}`}
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
                      className={`mt-1 ${attributeInputClass}`}
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

        {subject.isLeaf && !isMilestone && draft.metricType !== "" && (
          <Field label="Deadline month" hint="Optional. Means the last day of that month.">
            <MonthField
              className={`mt-1 ${attributeInputClass}`}
              value={draft.deadlineMonth}
              onChange={(yearMonth) => setField("deadlineMonth", yearMonth)}
            />
          </Field>
        )}
        {subject.isLeaf && !isMilestone && draft.metricType !== "" && (
          <Field
            label="After the deadline"
            hint={
              draft.scoreFinalAfterDeadline
                ? "Later achievement is recorded but does not change the score."
                : "Capped at 2.9 one month late, 2.4 two months late, then 0."
            }
          >
            <select
              className={`mt-1 ${attributeInputClass}`}
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

export function TargetsPanel({
  subject, draft, setField, readOnly,
}: {
  subject: {
    direction: Direction | null;
    targetConfig: TargetConfig | null;
    unit: string | null;
    /** The figure to check target bands against. Omitted when editing out of the context of one period (e.g. the hierarchy page). */
    currentValue?: number | null;
  };
  draft: AttributeDraft;
  setField: <K extends keyof AttributeDraft>(field: K, value: AttributeDraft[K]) => void;
  readOnly?: boolean;
}) {
  const isMilestone = draft.metricType === "MONTH_COMPLETION";
  const currentValue = subject.currentValue ?? null;

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
              const reached = isTargetReached(subject, band, currentValue);
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
                      className={`${attributeInputClass} max-w-40`}
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
          {subject.unit && ` ${subject.unit}`}.
        </p>
      )}
    </Panel>
  );
}

export function targetPoint(
  subject: { targetConfig: TargetConfig | null; direction: Direction | null },
  band: (typeof BANDS)[number]
): number | null {
  const value = (subject.targetConfig as Record<string, unknown> | null)?.[band];
  if (typeof value === "number") return value;
  if (Array.isArray(value) && value.length === 2) {
    return subject.direction === "HIGHER_BETTER"
      ? Math.max(Number(value[0]), Number(value[1]))
      : Math.min(Number(value[0]), Number(value[1]));
  }
  return null;
}

export function isTargetReached(
  subject: { targetConfig: TargetConfig | null; direction: Direction | null },
  band: (typeof BANDS)[number],
  actual: number | null
): boolean {
  if (actual === null) return false;
  const target = targetPoint(subject, band);
  if (target === null) return false;
  return subject.direction === "HIGHER_BETTER" ? actual >= target : actual <= target;
}
