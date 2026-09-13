"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { ConfirmSaveDialog, SaveBar } from "@/components/ConfirmSaveDialog";
import { fiscalYearLabel } from "@/lib/fiscal";
import {
  closeFiscalYear,
  createFiscalYear,
  deleteFiscalYear,
  reopenFiscalYear,
  saveDepartments,
  setActiveFiscalYear,
} from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/result";

type FiscalYear = {
  id: string;
  startYear: number;
  label: string;
  isActive: boolean;
  closedAt: string | null;
  kpiCount: number;
};

type DepartmentDraft = { id: string | null; name: string; key: string };

export function ManageClient({
  fiscalYears,
  departments,
}: {
  fiscalYears: FiscalYear[];
  departments: { id: string; name: string }[];
}) {
  return (
    <div className="space-y-6">
      <FiscalYearPanel fiscalYears={fiscalYears} />
      <DepartmentPanel departments={departments} />
    </div>
  );
}

const inputClass =
  "rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

function FiscalYearPanel({
  fiscalYears,
}: {
  fiscalYears: FiscalYear[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [startYear, setStartYear] = useState(() => suggestNextYear(fiscalYears));
  // Defaults to empty, not the active year: copying is a deliberate choice,
  // since it fills the new year's hierarchy with the active year's KPIs —
  // and re-importing a different, smaller workbook into it afterwards will
  // match by code and remove whatever isn't in that file.
  const [copyFromId, setCopyFromId] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState<FiscalYear | null>(null);
  const [confirmClose, setConfirmClose] = useState<FiscalYear | null>(null);
  const [reopening, setReopening] = useState<FiscalYear | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        router.refresh();
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      }
    });

  return (
    <section className="rounded-lg border bg-white">
      <div className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold">Fiscal years</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          The year runs 1 April to 31 March. Each has its own hierarchy, weights
          and targets, so last year&rsquo;s scores stay as they were reported.
        </p>
      </div>

      <ul className="divide-y">
        {fiscalYears.map((fy) => (
          <li key={fy.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div>
              <span className="font-medium">{fy.label}</span>
              {fy.isActive && (
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  active
                </span>
              )}
              {fy.closedAt && (
                <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                  Closed
                </span>
              )}
              <span className="ml-2 text-xs text-gray-500">
                April {fy.startYear} – March {fy.startYear + 1} · {fy.kpiCount} KPI
                {fy.kpiCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/?fy=${fy.id}`}
                className="text-sm text-blue-700 hover:underline"
              >
                Open
              </Link>
              {!fy.isActive && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setActiveFiscalYear(fy.id))}
                  className="rounded border border-gray-300 px-2.5 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Make active
                </button>
              )}
              {fy.closedAt ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => { setReopening(fy); setReopenReason(""); }}
                  className="rounded border border-gray-300 px-2.5 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Reopen
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmClose(fy)}
                  className="rounded border border-gray-300 px-2.5 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Close year
                </button>
              )}
              <button
                type="button"
                disabled={pending || !!fy.closedAt}
                onClick={() => setConfirmDelete(fy)}
                title={fy.closedAt ? "Reopen this year first to delete it." : undefined}
                className="rounded border border-rose-200 px-2.5 py-1 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {fiscalYears.length === 0 && (
          <li className="px-5 py-4 text-sm text-gray-500">
            No fiscal years yet — create one below to get started.
          </li>
        )}
      </ul>

      <div className="border-t bg-gray-50 px-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-gray-700">Starting year</span>
            <input
              type="number"
              className={`mt-1 w-28 ${inputClass}`}
              value={startYear}
              onChange={(e) => setStartYear(Number(e.target.value))}
            />
            <span className="mt-1 block text-xs text-gray-500">
              {Number.isFinite(startYear) ? fiscalYearLabel(startYear) : " "}
            </span>
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-gray-700">Copy KPIs from</span>
            <select
              className={`mt-1 ${inputClass}`}
              value={copyFromId}
              onChange={(e) => setCopyFromId(e.target.value)}
            >
              <option value="">Start empty</option>
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>{fy.label}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-gray-500">
              Copies the hierarchy and targets, not the recorded figures.
            </span>
          </label>

          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => createFiscalYear({ startYear, copyFromId: copyFromId || null }))}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Working…" : "Create year"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm font-medium text-rose-700">{error}</p>}
      </div>

      <ConfirmSaveDialog
        open={confirmDelete !== null}
        isSaving={pending}
        title={`Delete ${confirmDelete?.label}?`}
        changes={
          confirmDelete
            ? [
                {
                  field: "year",
                  label: confirmDelete.label,
                  from: `${confirmDelete.kpiCount} KPIs and every figure recorded against them`,
                  to: "permanently deleted",
                },
              ]
            : []
        }
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target) run(() => deleteFiscalYear(target.id));
        }}
      />

      <ConfirmSaveDialog
        open={confirmClose !== null}
        isSaving={pending}
        title={`Close ${confirmClose?.label}?`}
        warnings={[
          "Every KPI in this year becomes read-only for everyone, including admins.",
          "A final snapshot of every month's scores is taken now — reopening it later keeps that snapshot until you close it again.",
        ]}
        changes={
          confirmClose
            ? [
                {
                  field: "year",
                  label: confirmClose.label,
                  from: "open — figures and settings can be edited",
                  to: "closed and frozen",
                },
              ]
            : []
        }
        onCancel={() => setConfirmClose(null)}
        onConfirm={() => {
          const target = confirmClose;
          setConfirmClose(null);
          if (target) run(() => closeFiscalYear(target.id));
        }}
      />

      {reopening && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget && !pending) setReopening(null);
          }}
        >
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                Reopen {reopening.label}?
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                This lets figures and settings for this year be edited again. Explain why.
              </p>
            </div>
            <div className="px-5 py-4">
              <label className="block text-xs font-medium text-gray-700">
                Reason
                <textarea
                  rows={3}
                  className={`mt-1 w-full ${inputClass}`}
                  placeholder="Why is this year being reopened?"
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                />
              </label>
              {error && <p className="mt-2 text-sm font-medium text-rose-700">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t bg-gray-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setReopening(null)}
                disabled={pending}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || !reopenReason.trim()}
                onClick={() => {
                  const target = reopening;
                  const reason = reopenReason.trim();
                  run(async () => {
                    const result = await reopenFiscalYear(target!.id, reason);
                    if (result.ok) setReopening(null);
                    return result;
                  });
                }}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? "Reopening…" : "Reopen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function suggestNextYear(fiscalYears: FiscalYear[]): number {
  if (fiscalYears.length > 0) return Math.max(...fiscalYears.map((f) => f.startYear)) + 1;
  // Before April the current financial year still belongs to the previous one.
  const now = new Date();
  return now.getUTCMonth() + 1 >= 4 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

function DepartmentPanel({ departments }: { departments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial = useMemo<DepartmentDraft[]>(
    () => departments.map((d) => ({ id: d.id, name: d.name, key: d.id })),
    [departments]
  );
  const [draft, setDraft] = useState<DepartmentDraft[]>(initial);

  const changes = useMemo(() => {
    const out: { field: string; label: string; from: string; to: string }[] = [];

    for (const row of draft) {
      const before = initial.find((d) => d.key === row.key);
      if (!before) {
        if (row.name.trim()) {
          out.push({ field: row.key, label: "New department", from: "—", to: row.name.trim() });
        }
      } else if (before.name !== row.name) {
        out.push({ field: row.key, label: "Renamed", from: before.name, to: row.name.trim() || "empty" });
      }
    }
    for (const before of initial) {
      if (!draft.some((d) => d.key === before.key)) {
        out.push({
          field: before.key,
          label: "Removed",
          from: before.name,
          to: "removed, and detached from any KPI that used it",
        });
      }
    }
    return out;
  }, [draft, initial]);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const result = await saveDepartments(draft.map((d) => ({ id: d.id, name: d.name })));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-lg border bg-white">
      <div className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold">Departments</h2>
        <p className="mt-0.5 text-xs text-gray-500">
          The dropdown that KPI owners are chosen from. Removing one detaches it
          from its KPIs; it never deletes a KPI.
        </p>
      </div>

      <div className="space-y-2 px-5 py-4">
        {draft.map((row, index) => (
          <div key={row.key} className="flex items-center gap-2">
            <input
              aria-label={`Department ${index + 1}`}
              className={`${inputClass} flex-1`}
              value={row.name}
              onChange={(e) =>
                setDraft((current) =>
                  current.map((d) => (d.key === row.key ? { ...d, name: e.target.value } : d))
                )
              }
            />
            <button
              type="button"
              onClick={() => setDraft((current) => current.filter((d) => d.key !== row.key))}
              className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
              aria-label={`Remove ${row.name || "department"}`}
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setDraft((current) => [
              ...current,
              { id: null, name: "", key: `new-${Date.now()}-${current.length}` },
            ])
          }
          className="rounded border border-dashed border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Add department
        </button>
      </div>

      <SaveBar
        isDirty={changes.length > 0}
        isSaving={isSaving}
        error={error}
        count={changes.length}
        noun={["department change", "department changes"]}
        onSave={() => setConfirming(true)}
        onDiscard={() => { setDraft(initial); setError(null); }}
      />

      <ConfirmSaveDialog
        open={confirming}
        changes={changes}
        isSaving={isSaving}
        title="Save these department changes?"
        onConfirm={save}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
