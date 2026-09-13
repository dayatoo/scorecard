"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { ConfirmSaveDialog } from "@/components/ConfirmSaveDialog";
import { formatDate } from "@/lib/dates";
import { fiscalYearLabel } from "@/lib/fiscal";
import {
  createCheckpoint,
  deleteCheckpoint,
  previewRestoreFromCheckpoint,
  previewRestoreFromUpload,
  restoreFromCheckpoint,
  restoreFromUpload,
  type RestorePreview,
} from "@/app/actions/backup";
import type { RestoreSummary } from "@/lib/backup";

type FiscalYear = {
  id: string;
  label: string;
  startYear: number;
  closedAt: string | null;
};

type Checkpoint = {
  id: string;
  name: string;
  automatic: boolean;
  kpiCount: number;
  valueCount: number;
  createdBy: string | null;
  createdAt: string;
};

/** Where a restore should land: over the year it came from, or into a new one. */
type TargetMode = "IN_PLACE" | "NEW_YEAR";

/** Which source a pending restore is reading from — a saved row, or the picked file. */
type PendingRestore =
  | { kind: "CHECKPOINT"; checkpointId: string; name: string; preview: RestorePreview }
  | { kind: "UPLOAD"; name: string; preview: RestorePreview };

const inputClass =
  "rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";

export function BackupsClient({
  fiscalYears,
  selectedFiscalYearId,
  suggestedStartYear,
  checkpoints,
}: {
  fiscalYears: FiscalYear[];
  selectedFiscalYearId: string;
  suggestedStartYear: number;
  checkpoints: Checkpoint[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RestoreSummary | null>(null);

  const [name, setName] = useState("");
  const [targetMode, setTargetMode] = useState<TargetMode>("IN_PLACE");
  const [newStartYear, setNewStartYear] = useState(suggestedStartYear);
  const [restoring, setRestoring] = useState<PendingRestore | null>(null);
  // Held in state rather than read back off the input at confirm time: the
  // preview step runs between picking and confirming, and a File is only a
  // handle, so keeping it costs nothing.
  const [pickedFile, setPickedFile] = useState<File | null>(null);

  const selected = fiscalYears.find((fy) => fy.id === selectedFiscalYearId) ?? fiscalYears[0];
  const isClosed = selected.closedAt !== null;

  const target = () =>
    targetMode === "IN_PLACE"
      ? ({ mode: "IN_PLACE", fiscalYearId: selected.id } as const)
      : ({ mode: "NEW_YEAR", startYear: newStartYear } as const);

  const run = (work: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      try {
        const result = await work();
        if (!result.ok) {
          setError(result.error ?? "Something went wrong.");
          return;
        }
        setError(null);
        router.refresh();
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      }
    });

  const save = () =>
    run(async () => {
      const result = await createCheckpoint(selected.id, name);
      if (result.ok) setName("");
      return result;
    });

  const openRestoreFromCheckpoint = (checkpoint: Checkpoint) =>
    startTransition(async () => {
      setSummary(null);
      try {
        const result = await previewRestoreFromCheckpoint(checkpoint.id, target());
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        setRestoring({
          kind: "CHECKPOINT",
          checkpointId: checkpoint.id,
          name: checkpoint.name,
          preview: result.data,
        });
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      }
    });

  const openRestoreFromUpload = () =>
    startTransition(async () => {
      setSummary(null);
      if (!pickedFile) {
        setError("Choose a backup file to upload.");
        return;
      }
      try {
        const result = await previewRestoreFromUpload(uploadFormData(), target());
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        setRestoring({ kind: "UPLOAD", name: pickedFile.name, preview: result.data });
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      }
    });

  const confirmRestore = () => {
    if (!restoring) return;
    startTransition(async () => {
      try {
        const result =
          restoring.kind === "CHECKPOINT"
            ? await restoreFromCheckpoint(restoring.checkpointId, target())
            : await restoreFromUpload(uploadFormData(), target());
        if (!result.ok) {
          setError(result.error);
          setRestoring(null);
          return;
        }
        setError(null);
        setRestoring(null);
        setSummary(result.data);
        setPickedFile(null);
        if (fileInput.current) fileInput.current.value = "";
        router.refresh();
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
        setRestoring(null);
      }
    });
  };

  // Both the preview and the confirm send the file itself, rather than the
  // parsed document making a round trip through the client only to be sent
  // straight back — a backup is large, and the server re-validates anyway.
  const uploadFormData = (): FormData => {
    const data = new FormData();
    if (pickedFile) data.set("file", pickedFile);
    return data;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          <span className="mr-2 text-xs font-medium text-gray-700">Fiscal year</span>
          <select
            aria-label="Fiscal year"
            className={inputClass}
            value={selected.id}
            onChange={(e) => router.push(`/manage/backups?fy=${e.target.value}`)}
          >
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>{fy.label}</option>
            ))}
          </select>
        </label>
        <a
          href={`/api/backup?fy=${selected.id}`}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Download {selected.label} as it is now
        </a>
      </div>

      {error && (
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
          {error}
        </p>
      )}

      {summary && (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Restored {summary.fiscalYearLabel}: {summary.kpis} KPI
          {summary.kpis === 1 ? "" : "s"}, {summary.values} figure
          {summary.values === 1 ? "" : "s"}
          {summary.overrides > 0 && `, ${summary.overrides} calibration${summary.overrides === 1 ? "" : "s"}`}.
        </p>
      )}

      <section className="rounded-lg border bg-white">
        <div className="border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Save a checkpoint</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Take one before anything risky — a bulk import, a round of target
            changes — so there is a known-good state to come back to.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <label className="block flex-1">
            <span className="block text-xs font-medium text-gray-700">Name</span>
            <input
              className={`mt-1 w-full ${inputClass}`}
              placeholder="e.g. Before the Q2 target revision"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={pending || !name.trim()}
            onClick={save}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Working…" : "Save checkpoint"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border bg-white">
        <div className="border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Where a restore should go</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Applies to both the checkpoints below and an uploaded file.
          </p>
        </div>
        <div className="space-y-2 px-5 py-4 text-sm">
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="targetMode"
              className="mt-1"
              checked={targetMode === "IN_PLACE"}
              onChange={() => setTargetMode("IN_PLACE")}
            />
            <span>
              <span className="font-medium">Over {selected.label}</span>
              <span className="block text-xs text-gray-500">
                Replaces everything in that year. A checkpoint of its current
                state is saved first, so this can itself be undone.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="radio"
              name="targetMode"
              className="mt-1"
              checked={targetMode === "NEW_YEAR"}
              onChange={() => setTargetMode("NEW_YEAR")}
            />
            <span>
              <span className="font-medium">As a new fiscal year</span>
              <span className="block text-xs text-gray-500">
                Builds a separate year from the backup, changing nothing that
                already exists — the safe way to check a backup holds what you
                think it does.
              </span>
            </span>
          </label>
          {targetMode === "NEW_YEAR" && (
            <label className="block pt-1">
              <span className="block text-xs font-medium text-gray-700">New year starts</span>
              <input
                type="number"
                aria-label="New year starts"
                className={`mt-1 w-28 ${inputClass}`}
                value={newStartYear}
                onChange={(e) => setNewStartYear(Number(e.target.value))}
              />
              <span className="mt-1 block text-xs text-gray-500">
                {Number.isFinite(newStartYear) ? fiscalYearLabel(newStartYear) : " "}
              </span>
            </label>
          )}
          {targetMode === "IN_PLACE" && isClosed && (
            <p className="pt-1 text-xs text-amber-700">
              {selected.label} is closed. Reopen it on the Manage page before
              restoring over it.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-white">
        <div className="border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Saved checkpoints for {selected.label}</h2>
        </div>
        <ul className="divide-y">
          {checkpoints.map((checkpoint) => (
            <li
              key={checkpoint.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0">
                <span className="font-medium">{checkpoint.name}</span>
                {checkpoint.automatic && (
                  <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                    auto
                  </span>
                )}
                <span className="block text-xs text-gray-500">
                  {formatDate(new Date(checkpoint.createdAt))}
                  {checkpoint.createdBy && ` · ${checkpoint.createdBy}`} ·{" "}
                  {checkpoint.kpiCount} KPI{checkpoint.kpiCount === 1 ? "" : "s"} ·{" "}
                  {checkpoint.valueCount} figure{checkpoint.valueCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => openRestoreFromCheckpoint(checkpoint)}
                  className="rounded border border-gray-300 px-2.5 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Restore
                </button>
                <a
                  href={`/api/backup?checkpoint=${checkpoint.id}`}
                  className="text-sm text-blue-700 hover:underline"
                >
                  Download
                </a>
                {!checkpoint.automatic && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => deleteCheckpoint(checkpoint.id))}
                    className="rounded border border-rose-200 px-2.5 py-1 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
          {checkpoints.length === 0 && (
            <li className="px-5 py-4 text-sm text-gray-500">
              No checkpoints for {selected.label} yet — save one above, or
              upload a backup file below.
            </li>
          )}
        </ul>
      </section>

      <section className="rounded-lg border bg-white">
        <div className="border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Restore from a file</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            A .json backup downloaded from this app — from this deployment or
            another one.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <label className="block">
            <span className="block text-xs font-medium text-gray-700">Backup file</span>
            <input
              ref={fileInput}
              type="file"
              name="file"
              accept="application/json,.json"
              aria-label="Backup file"
              onChange={(e) => {
                setPickedFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
              className="mt-1 block text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
          </label>
          <button
            type="button"
            disabled={pending || !pickedFile}
            onClick={openRestoreFromUpload}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {pending ? "Reading…" : "Check this file"}
          </button>
        </div>
      </section>

      <ConfirmSaveDialog
        open={restoring !== null}
        isSaving={pending}
        title={
          restoring
            ? targetMode === "IN_PLACE"
              ? `Restore ${selected.label} from "${restoring.name}"?`
              : `Build ${fiscalYearLabel(newStartYear)} from "${restoring.name}"?`
            : ""
        }
        warnings={restoring ? restoreWarnings(restoring.preview, targetMode, selected.label) : []}
        changes={restoring ? restoreChanges(restoring.preview, targetMode) : []}
        onCancel={() => setRestoring(null)}
        onConfirm={confirmRestore}
      />
    </div>
  );
}

function restoreChanges(preview: RestorePreview, targetMode: TargetMode) {
  const changes = [
    {
      field: "kpis",
      label: "KPIs",
      from: preview.current ? `${preview.current.kpis} now` : "a new, empty year",
      to: `${preview.source.kpis} from the backup`,
    },
    {
      field: "values",
      label: "Recorded figures",
      from: preview.current ? `${preview.current.values} now` : "none",
      to: `${preview.source.values} from the backup`,
    },
  ];

  if (preview.source.overrides > 0) {
    changes.push({
      field: "overrides",
      label: "Score calibrations",
      from: "whatever is set now",
      to: `${preview.source.overrides} from the backup`,
    });
  }

  if (targetMode === "IN_PLACE" && preview.removed.length > 0) {
    changes.push({
      field: "removed",
      label: `${preview.removed.length} KPI${preview.removed.length === 1 ? "" : "s"} not in the backup`,
      from: preview.removed.slice(0, 6).join(", ") + (preview.removed.length > 6 ? "…" : ""),
      to: "removed, with their figures",
    });
  }

  if (targetMode === "IN_PLACE" && preview.added.length > 0) {
    changes.push({
      field: "added",
      label: `${preview.added.length} KPI${preview.added.length === 1 ? "" : "s"} the year doesn't have`,
      from: "not present",
      to: preview.added.slice(0, 6).join(", ") + (preview.added.length > 6 ? "…" : ""),
    });
  }

  return changes;
}

function restoreWarnings(
  preview: RestorePreview,
  targetMode: TargetMode,
  currentLabel: string
): string[] {
  const warnings: string[] = [];

  if (targetMode === "IN_PLACE") {
    warnings.push(
      `Everything currently in ${currentLabel} is replaced by what this backup holds.`
    );
    warnings.push(
      "A checkpoint of the current state is saved first, so this restore can itself be undone."
    );
    warnings.push(
      "KPIs are recreated, so saved links to individual KPI pages will stop resolving."
    );
  } else {
    warnings.push(
      `A separate fiscal year is created. Nothing already in the app changes.`
    );
  }

  if (preview.source.wasClosed) {
    warnings.push(
      "This backup was taken from a closed year. The restored year comes back open — close it again to re-freeze its scores."
    );
  }

  if (preview.source.startYear && targetMode === "IN_PLACE") {
    warnings.push(
      `The backup was taken from ${preview.source.label}, on ${formatDate(new Date(preview.source.exportedAt))}.`
    );
  }

  return warnings;
}
