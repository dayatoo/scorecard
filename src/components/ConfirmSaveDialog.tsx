"use client";

import { useEffect, useRef } from "react";

import type { FieldChange } from "./useDirtyForm";

/**
 * The confirmation step every save passes through. It lists exactly what is
 * about to change, old value to new, so nothing is written on the strength of
 * a mis-click.
 */
export function ConfirmSaveDialog({
  open,
  changes,
  isSaving,
  title = "Save these changes?",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  changes: FieldChange[];
  isSaving: boolean;
  title?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) onCancel();
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, isSaving, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSaving) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-save-title"
        tabIndex={-1}
        className="w-full max-w-lg rounded-lg bg-white shadow-xl outline-none"
      >
        <div className="border-b px-5 py-4">
          <h2 id="confirm-save-title" className="text-base font-semibold text-gray-900">
            {title}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {changes.length === 1
              ? "One field will be updated."
              : `${changes.length} fields will be updated.`}
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto px-5 py-4">
          <ul className="space-y-3">
            {changes.map((change) => (
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
        </div>

        <div className="flex justify-end gap-2 border-t bg-gray-50 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Confirm and save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The sticky bar that appears once there are unsaved edits. */
export function SaveBar({
  isDirty,
  isSaving,
  error,
  onSave,
  onDiscard,
  noun = ["unsaved change", "unsaved changes"],
  count,
}: {
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
  onSave: () => void;
  onDiscard: () => void;
  /** [singular, plural] — spelled out, since not every plural takes an "s". */
  noun?: [string, string];
  count: number;
}) {
  if (!isDirty && !error) return null;

  return (
    <div className="sticky bottom-0 z-40 border-t bg-white/95 px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {error ? (
            <span className="font-medium text-rose-700">{error}</span>
          ) : (
            <span className="text-gray-700">
              {count} {count === 1 ? noun[0] : noun[1]} — nothing is saved until
              you confirm.
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || !isDirty}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
