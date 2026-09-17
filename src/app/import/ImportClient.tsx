"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { ConfirmSaveDialog } from "@/components/ConfirmSaveDialog";
import { hasErrors } from "@/lib/validation";
import { commitImport, previewImport, type ImportPreview } from "./actions";
import type { ImportMode, ImportSummary } from "@/app/actions/admin";

/**
 * Upload, then preview, then confirm. The preview is deliberately a separate
 * step: an import can remove KPIs whose codes are no longer in the sheet, and
 * that takes their recorded figures with them.
 */
export function ImportClient({
  fiscalYears,
  defaultFiscalYearId,
}: {
  fiscalYears: { id: string; label: string }[];
  defaultFiscalYearId: string | null;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fiscalYearId, setFiscalYearId] = useState(defaultFiscalYearId ?? "");
  // Update only is the safe default: it upserts what is in the sheet and
  // leaves everything else alone, which is correct the moment any part of
  // the hierarchy is created or edited in the app rather than solely
  // maintained in the spreadsheet. Replace is a deliberate, riskier choice.
  const [mode, setMode] = useState<ImportMode>("UPDATE");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const upload = (formData: FormData) => {
    startTransition(async () => {
      try {
        setSummary(null);
        const result = await previewImport(formData, fiscalYearId || undefined);
        if (!result.ok) {
          setPreview(null);
          setError(result.error);
          return;
        }
        setPreview(result.data);
        setError(null);
      } catch {
        setPreview(null);
        setError("Could not reach the server. Check your connection and try again.");
      }
    });
  };

  const commit = () => {
    if (!preview) return;
    startTransition(async () => {
      try {
        const result = await commitImport({
          fiscalYearId,
          kpis: preview.kpis,
          departments: preview.departments,
          values: preview.values,
          updates: preview.updates,
          mode,
        });
        if (!result.ok) {
          setError(result.error);
          setConfirming(false);
          return;
        }
        setSummary(result.data);
        setPreview(null);
        setConfirming(false);
        setError(null);
        if (fileInput.current) fileInput.current.value = "";
        router.refresh();
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
        setConfirming(false);
      }
    });
  };

  const blocked = preview
    ? preview.parseIssues.length > 0 || hasErrors(preview.issues) || preview.kpis.length === 0
    : true;

  if (fiscalYears.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        Create a fiscal year on the{" "}
        <Link href="/manage" className="font-medium underline">Manage</Link> page
        before importing — a scorecard always belongs to a year.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form action={upload} className="rounded-lg border bg-white px-5 py-4">
        <h2 className="text-sm font-semibold">Upload your spreadsheet</h2>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-gray-700">Import into</span>
            <select
              name="fiscalYearId"
              className="mt-1 rounded border border-gray-300 px-2.5 py-1.5 text-sm"
              value={fiscalYearId}
              onChange={(e) => setFiscalYearId(e.target.value)}
            >
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>{fy.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-gray-700">Workbook</span>
            <input
              ref={fileInput}
              type="file"
              name="file"
              accept=".xlsx"
              required
              className="mt-1 block text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-gray-700"
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Reading…" : "Check file"}
          </button>
        </div>

        <fieldset className="mt-3">
          <legend className="block text-xs font-medium text-gray-700">How to apply this file</legend>
          <div className="mt-1.5 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="mode"
                checked={mode === "UPDATE"}
                onChange={() => setMode("UPDATE")}
              />
              Update only — leave anything not in the file alone
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="mode"
                checked={mode === "REPLACE"}
                onChange={() => setMode("REPLACE")}
              />
              Replace the year — remove anything not in the file
            </label>
          </div>
        </fieldset>

        {error && <p className="mt-3 text-sm font-medium text-rose-700">{error}</p>}
      </form>

      {summary && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <p className="font-medium">Import complete.</p>
          <p className="mt-1">
            {summary.created} KPI{summary.created === 1 ? "" : "s"} added,{" "}
            {summary.updated} updated
            {summary.removed > 0 && `, ${summary.removed} removed`}
            {summary.departmentsCreated > 0 &&
              `, ${summary.departmentsCreated} new department${summary.departmentsCreated === 1 ? "" : "s"}`}
            {summary.valuesWritten > 0 &&
              `, ${summary.valuesWritten} monthly figure${summary.valuesWritten === 1 ? "" : "s"}`}
            {summary.updatesWritten > 0 &&
              `, ${summary.updatesWritten} progress update${summary.updatesWritten === 1 ? "" : "s"}`}
            .
          </p>
          <Link href="/" className="mt-2 inline-block font-medium underline">
            View the scorecard
          </Link>
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-4">
            <Stat label="KPIs in file" value={String(preview.counts.total)} />
            <Stat label="Lowest-level KPIs" value={String(preview.counts.leaves)} />
            <Stat label="Levels deep" value={String(preview.counts.levels)} />
            <Stat
              label="Strategic Goals total"
              value={`${preview.counts.weightTotal.toFixed(2)}%`}
              tone={Math.abs(preview.counts.weightTotal - 100) > 0.01 ? "warn" : "ok"}
            />
            {preview.values.length > 0 && (
              <Stat label="Monthly figures" value={String(preview.values.length)} />
            )}
            {preview.updates.length > 0 && (
              <Stat label="Progress updates" value={String(preview.updates.length)} />
            )}
          </dl>

          {preview.parseIssues.length > 0 && (
            <IssueList
              title={`${preview.parseIssues.length} problem${preview.parseIssues.length === 1 ? "" : "s"} reading the file`}
              description="Fix these in the spreadsheet and upload it again."
              tone="error"
              items={preview.parseIssues.map((i) => ({
                text: i.row ? `Row ${i.row}: ${i.message}` : i.message,
              }))}
            />
          )}

          {preview.wouldRemove.length > 0 && (
            <IssueList
              title={`${preview.wouldRemove.length} KPI${preview.wouldRemove.length === 1 ? "" : "s"} in this year ${preview.wouldRemove.length === 1 ? "is" : "are"} not in this file`}
              description={
                mode === "REPLACE"
                  ? "Replace mode will remove these, along with any figures recorded against them."
                  : "Update only leaves these exactly as they are — nothing about them changes."
              }
              tone={mode === "REPLACE" ? "error" : "warn"}
              items={preview.wouldRemove.map((k) => ({
                text: `${k.code} — ${k.name}${k.figuresRecorded > 0 ? ` (${k.figuresRecorded} month${k.figuresRecorded === 1 ? "" : "s"} recorded)` : ""}`,
                severity: mode === "REPLACE" ? "error" : "warning",
              }))}
            />
          )}

          {preview.issues.length > 0 && (
            <IssueList
              title="Checks on the hierarchy"
              description={
                hasErrors(preview.issues)
                  ? "The errors must be fixed before this can be imported."
                  : "These are warnings — the import can go ahead."
              }
              tone={hasErrors(preview.issues) ? "error" : "warn"}
              items={preview.issues.map((i) => ({
                text: `${i.kpiCode ? `${i.kpiCode}: ` : ""}${i.message}`,
                severity: i.severity,
              }))}
            />
          )}

          {preview.kpis.length > 0 && (
            <div className="overflow-hidden rounded-lg border bg-white">
              <div className="border-b px-5 py-3">
                <h2 className="text-sm font-semibold">What will be imported</h2>
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="border-b text-left text-xs font-medium text-gray-500 uppercase">
                      <th scope="col" className="px-4 py-2">Code</th>
                      <th scope="col" className="px-4 py-2">Name</th>
                      <th scope="col" className="px-4 py-2">Parent</th>
                      <th scope="col" className="px-4 py-2 text-right">Weight</th>
                      <th scope="col" className="px-4 py-2">Metric</th>
                      <th scope="col" className="px-4 py-2">Owners</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.kpis.map((kpi) => (
                      <tr key={kpi.code} className="border-b last:border-0">
                        <td className="px-4 py-1 font-mono text-xs text-gray-500">{kpi.code}</td>
                        <td className="px-4 py-1">{kpi.name}</td>
                        <td className="px-4 py-1 font-mono text-xs text-gray-500">
                          {kpi.parentCode ?? "—"}
                        </td>
                        <td className="tabular px-4 py-1 text-right text-gray-600">
                          {kpi.weight > 0 ? `${kpi.weight}%` : "—"}
                        </td>
                        <td className="px-4 py-1 text-xs text-gray-600">
                          {kpi.metricType?.replace(/_/g, " ").toLowerCase() ?? "rollup"}
                        </td>
                        <td className="px-4 py-1 text-xs text-gray-600">
                          {kpi.departments.join(", ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={blocked || pending}
              onClick={() => setConfirming(true)}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Import into {fiscalYears.find((f) => f.id === fiscalYearId)?.label}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            {blocked && (
              <span className="text-sm text-gray-500">
                Fix the problems above before importing.
              </span>
            )}
          </div>
        </div>
      )}

      <ConfirmSaveDialog
        open={confirming}
        isSaving={pending}
        title="Import this hierarchy?"
        changes={
          preview
            ? [
                {
                  field: "kpis",
                  label: "KPIs",
                  from: "whatever is in this fiscal year now",
                  to: `the ${preview.counts.total} KPIs in this file`,
                },
                {
                  field: "removal",
                  label: "KPIs not in the file",
                  from: "kept",
                  to:
                    mode === "REPLACE"
                      ? `removed (${preview.wouldRemove.length}), along with the figures recorded against them`
                      : "kept — Update only never removes a KPI",
                },
                {
                  field: "figures",
                  label: "Figures for KPIs kept",
                  from: "recorded",
                  to: "unchanged — KPIs are matched on their code",
                },
                ...(preview.values.length > 0
                  ? [
                      {
                        field: "values",
                        label: "Monthly figures in this file",
                        from: "whatever is recorded for those months now",
                        to: `${preview.values.length} figures written, overwriting those months`,
                      },
                    ]
                  : []),
                ...(preview.updates.length > 0
                  ? [
                      {
                        field: "updates",
                        label: "Progress updates in this file",
                        from: "existing updates kept as-is",
                        to: `up to ${preview.updates.length} new update${preview.updates.length === 1 ? "" : "s"} posted — rows matching an update already here are skipped`,
                      },
                    ]
                  : []),
              ]
            : []
        }
        onConfirm={commit}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

function Stat({ label, value, tone = "ok" }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd
        className={`tabular mt-1 text-lg font-semibold ${tone === "warn" ? "text-amber-700" : "text-gray-900"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function IssueList({
  title, description, tone, items,
}: {
  title: string;
  description: string;
  tone: "error" | "warn";
  items: { text: string; severity?: "error" | "warning" }[];
}) {
  const style =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <div className={`rounded-lg border px-5 py-4 text-sm ${style}`}>
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-xs opacity-80">{description}</p>
      <ul className="mt-2 max-h-56 space-y-1 overflow-auto">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span aria-hidden className="opacity-60">
              {item.severity === "warning" ? "!" : "✕"}
            </span>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
