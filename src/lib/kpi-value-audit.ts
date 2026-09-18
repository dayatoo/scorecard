// Pure helpers for diffing a KpiValue write against what was there before, so
// writeEntry (src/app/actions/kpi.ts) can append a KpiValueAudit row per
// changed field. Kept out of kpi.ts because a "use server" file may only
// export async functions, and these are plain synchronous helpers.

export type KpiValueFields = {
  value: number | null;
  plannedValue: number | null;
  basis: "ACTUAL" | "ESTIMATE";
  completionDate: Date | null;
  note: string | null;
};

const EMPTY_KPI_VALUE: KpiValueFields = {
  value: null,
  plannedValue: null,
  basis: "ACTUAL",
  completionDate: null,
  note: null,
};

/** String form of a KpiValue field for the audit log — never the text "null". */
export function stringifyField(value: number | string | Date | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Every field that actually changed between the existing row (or no row at
 * all) and the incoming write, as {field, from, to} — the shape appended to
 * KpiValueAudit. A no-op write (identical values) produces no entries.
 */
export function diffKpiValueFields(
  existing: KpiValueFields | null,
  next: KpiValueFields
): { field: string; from: string | null; to: string | null }[] {
  const before = existing ?? EMPTY_KPI_VALUE;

  const fields: (keyof KpiValueFields)[] = ["value", "plannedValue", "basis", "completionDate", "note"];
  const changes: { field: string; from: string | null; to: string | null }[] = [];
  for (const field of fields) {
    const from = before[field];
    const to = next[field];
    const same = from instanceof Date && to instanceof Date ? from.getTime() === to.getTime() : from === to;
    if (!same) {
      changes.push({ field, from: stringifyField(from), to: stringifyField(to) });
    }
  }
  return changes;
}
