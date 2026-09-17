"use server";

import { prisma } from "@/lib/prisma";
import { applyImport, type ImportMode, type ImportSummary } from "@/app/actions/admin";
import { attempt, type ActionResult } from "@/app/actions/result";
import { requireAdmin } from "@/lib/session";
import { parseWorkbook, type ParsedKpi, type ParsedValue, type ParsedUpdate, type ParseIssue } from "@/lib/workbook";
import { validateHierarchy, type Issue } from "@/lib/validation";
import type { KpiRecord } from "@/lib/kpi-tree";

export type RemovalPreview = { code: string; name: string; figuresRecorded: number };

export type ImportPreview = {
  kpis: ParsedKpi[];
  departments: string[];
  values: ParsedValue[];
  updates: ParsedUpdate[];
  parseIssues: ParseIssue[];
  /** Structural problems: weights, target order, cycles. */
  issues: Issue[];
  counts: { total: number; leaves: number; levels: number; weightTotal: number };
  /** KPIs in the target year absent from this file — what REPLACE mode would remove. */
  wouldRemove: RemovalPreview[];
};

/**
 * Reads an uploaded workbook and reports what it would do, without writing
 * anything. The page shows this first so nothing lands in the database on the
 * strength of a mis-picked file.
 *
 * `fiscalYearId` makes this a real diff against the year being imported into,
 * rather than validating the file in isolation: without it there is no way to
 * name which KPIs a Replace import would remove before it actually removes
 * them.
 */
export async function previewImport(
  formData: FormData,
  fiscalYearId?: string
): Promise<ActionResult<ImportPreview>> {
  return attempt(() => readWorkbook(formData, fiscalYearId));
}

async function readWorkbook(formData: FormData, fiscalYearId?: string): Promise<ImportPreview> {
  await requireAdmin();

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
    completed: false,
    completedPeriod: null,
    departments: [],
    status: kpi.status,
  }));

  const parentCodes = new Set(asRecords.map((k) => k.parentId).filter(Boolean));
  const leaves = asRecords.filter((k) => !parentCodes.has(k.id));
  // Weight is now local (a share of siblings), so leaf weights across
  // different groups no longer sum to anything in particular — that
  // identity now holds trivially of *global* weight instead (every leaf's
  // derived share of the whole company always sums to 100, by construction).
  // The one flat, single-number check people actually care about first is
  // whether the top-level groups — the Strategic Goals — sum to 100; the
  // per-group detail for everything underneath is in `issues` below.
  const roots = asRecords.filter((k) => !k.parentId);

  let wouldRemove: RemovalPreview[] = [];
  if (fiscalYearId) {
    const incomingCodes = new Set(parsed.kpis.map((k) => k.code.toLowerCase()));
    const existing = await prisma.kpi.findMany({
      where: { fiscalYearId },
      include: { _count: { select: { values: true } } },
    });
    wouldRemove = existing
      .filter((k) => !incomingCodes.has(k.code.toLowerCase()))
      .map((k) => ({ code: k.code, name: k.name, figuresRecorded: k._count.values }));
  }

  return {
    kpis: parsed.kpis,
    departments: parsed.departments,
    values: parsed.values,
    updates: parsed.updates,
    parseIssues: parsed.issues,
    issues: parsed.kpis.length > 0 ? validateHierarchy(asRecords) : [],
    counts: {
      total: parsed.kpis.length,
      leaves: leaves.length,
      levels: maxDepth(asRecords),
      weightTotal: roots.reduce((sum, k) => sum + k.weight, 0),
    },
    wouldRemove,
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
  values?: ParsedValue[];
  updates?: ParsedUpdate[];
  mode?: ImportMode;
}): Promise<ActionResult<ImportSummary>> {
  return attempt(async () => {
    await requireAdmin();
    return applyImport(input);
  });
}
