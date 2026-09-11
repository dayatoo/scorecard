"use server";

import { applyImport, type ImportSummary } from "@/app/actions/admin";
import { attempt, type ActionResult } from "@/app/actions/result";
import { requireAuth } from "@/lib/session";
import { parseWorkbook, type ParsedKpi, type ParseIssue } from "@/lib/workbook";
import { validateHierarchy, type Issue } from "@/lib/validation";
import type { KpiRecord } from "@/lib/kpi-tree";

export type ImportPreview = {
  kpis: ParsedKpi[];
  departments: string[];
  parseIssues: ParseIssue[];
  /** Structural problems: weights, target order, cycles. */
  issues: Issue[];
  counts: { total: number; leaves: number; levels: number; weightTotal: number };
};

/**
 * Reads an uploaded workbook and reports what it would do, without writing
 * anything. The page shows this first so nothing lands in the database on the
 * strength of a mis-picked file.
 */
export async function previewImport(
  formData: FormData
): Promise<ActionResult<ImportPreview>> {
  return attempt(() => readWorkbook(formData));
}

async function readWorkbook(formData: FormData): Promise<ImportPreview> {
  await requireAuth();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a .xlsx file to upload.");
  }

  const parsed = await parseWorkbook(await file.arrayBuffer());

  // Re-use the same structural checks the app applies to a live hierarchy, by
  // mapping parsed rows onto the record shape those checks expect.
  const codeToId = new Map(parsed.kpis.map((k) => [k.code.toLowerCase(), k.code]));
  const asRecords: KpiRecord[] = parsed.kpis.map((kpi) => ({
    id: kpi.code,
    code: kpi.code,
    name: kpi.name,
    parentId: kpi.parentCode ? (codeToId.get(kpi.parentCode.toLowerCase()) ?? null) : null,
    sortOrder: kpi.row,
    weight: kpi.weight,
    metricType: kpi.metricType,
    direction: kpi.direction,
    targetMode: kpi.targetMode,
    targetConfig: kpi.targetConfig,
    unit: kpi.unit,
    deadlineMonth: kpi.deadlineMonth,
    scoreFinalAfterDeadline: kpi.scoreFinalAfterDeadline,
    departments: [],
  }));

  const parentCodes = new Set(asRecords.map((k) => k.parentId).filter(Boolean));
  const leaves = asRecords.filter((k) => !parentCodes.has(k.id));

  return {
    kpis: parsed.kpis,
    departments: parsed.departments,
    parseIssues: parsed.issues,
    issues: parsed.kpis.length > 0 ? validateHierarchy(asRecords) : [],
    counts: {
      total: parsed.kpis.length,
      leaves: leaves.length,
      levels: maxDepth(asRecords),
      weightTotal: leaves.reduce((sum, k) => sum + k.weight, 0),
    },
  };
}

function maxDepth(records: KpiRecord[]): number {
  const byId = new Map(records.map((r) => [r.id, r]));
  let deepest = 0;
  for (const record of records) {
    let depth = 1;
    let current = record.parentId ? byId.get(record.parentId) : undefined;
    while (current && depth < 20) {
      depth++;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    deepest = Math.max(deepest, depth);
  }
  return deepest;
}

export async function commitImport(input: {
  fiscalYearId: string;
  kpis: ParsedKpi[];
  departments: string[];
}): Promise<ActionResult<ImportSummary>> {
  return attempt(async () => {
    await requireAuth();
    return applyImport(input);
  });
}
