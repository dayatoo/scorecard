"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { ConfirmSaveDialog, SaveBar } from "@/components/ConfirmSaveDialog";
import { fiscalYearLabel } from "@/lib/fiscal";
import {
  createFiscalYear,
  deleteFiscalYear,
  saveDepartments,
  setActiveFiscalYear,
} from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/result";

type FiscalYear = {
  id: string;
  startYear: number;
  label: string;
  isActive: boolean;
  kpiCount: number;
};

type DepartmentDraft = { id: string | null; name: string; key: string };

export function ManageClient({
  fiscalYears,
  departments,
  activeId,
}: {
  fiscalYears: FiscalYear[];
  departments: { id: string; name: string }[];
  activeId: string | null;
}) {
  return (
    <div className="space-y-6">
      <FiscalYearPanel fiscalYears={fiscalYears} activeId={activeId} />
      <DepartmentPanel departments={departments} />
    </div>
  );
}

const inputClass =
  "rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

function FiscalYearPanel({
  fiscalYears,
  activeId,
}: {
  fiscalYears: FiscalYear[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [startYear, setStartYear] = useState(() => suggestNextYear(fiscalYears));
  const [copyFromId, setCopyFromId] = useState<string>(activeId ?? "");
  const [confirmDelete, setConfirmDelete] = useState<FiscalYear | null>(null);

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
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmDelete(fy)}
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
