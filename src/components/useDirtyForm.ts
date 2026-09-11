"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatDate } from "@/lib/dates";

export type FieldChange = {
  field: string;
  label: string;
  from: string;
  to: string;
};

/**
 * Holds edits in local state until they are explicitly saved.
 *
 * Nothing anywhere in this app writes on blur or on change: a page tracks its
 * draft here, `isDirty` enables the Save button, `changes` feeds the
 * confirmation dialog, and only `commit` reaches the server. It also warns on
 * a browser-level navigation away while there are unsaved edits.
 */
export function useDirtyForm<T extends object>(
  initial: T,
  describe: (field: keyof T & string, value: unknown) => string = defaultDescribe,
  labels: Partial<Record<keyof T & string, string>> = {}
) {
  const [draft, setDraft] = useState<T>(initial);
  const [saved, setSaved] = useState<T>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed when the server sends down a different record (e.g. after
  // switching month), but never while the user has unsaved work in progress.
  const initialRef = useRef(initial);
  useEffect(() => {
    if (initialRef.current === initial) return;
    initialRef.current = initial;
    setDraft((current) => (equal(current, saved) ? initial : current));
    setSaved((current) => (equal(draft, current) ? initial : current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const setField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  }, []);

  const changes = useMemo<FieldChange[]>(() => {
    const out: FieldChange[] = [];
    for (const key of Object.keys(draft) as (keyof T & string)[]) {
      if (equal(draft[key], saved[key])) continue;
      out.push({
        field: key,
        label: labels[key] ?? humanise(key),
        from: describe(key, saved[key]),
        to: describe(key, draft[key]),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, saved]);

  const isDirty = changes.length > 0;

  const reset = useCallback(() => {
    setDraft(saved);
    setError(null);
  }, [saved]);

  /** Runs the save, and on success makes the draft the new baseline. */
  const commit = useCallback(
    async (save: (draft: T) => Promise<void>) => {
      setIsSaving(true);
      setError(null);
      try {
        await save(draft);
        setSaved(draft);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save those changes.");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [draft]
  );

  // Catch a tab close or a hard navigation with unsaved edits. In-app
  // navigation is guarded separately by the Save bar staying visible.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  return { draft, saved, setField, setDraft, changes, isDirty, isSaving, error, reset, commit };
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => equal(item, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    return (
      keysA.length === keysB.length &&
      keysA.every((k) =>
        equal((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
      )
    );
  }
  return false;
}

function defaultDescribe(_field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "empty";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "none";
  if (value instanceof Date) return formatDate(value);
  return String(value);
}

function humanise(field: string): string {
  const spaced = field.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}
