"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { fiscalYearLabel, periodsOfFiscalYear } from "@/lib/fiscal";
import { getScorecard } from "@/lib/data";
import {
  automaticCheckpointName,
  serializeFiscalYear,
  writeCheckpoint,
} from "@/lib/backup";
import type { ParsedKpi, ParsedValue, ParsedUpdate } from "@/lib/workbook";
import { assertFiscalYearOpen } from "@/lib/validation";
import { attempt, type ActionResult } from "./result";

export async function createFiscalYear(input: {
  startYear: number;
  copyFromId: string | null;
}): Promise<ActionResult> {
  return attempt(async () => {
    await requireAdmin();

    if (
      !Number.isInteger(input.startYear) ||
      input.startYear < 2000 ||
      input.startYear > 2100
    ) {
      throw new Error("Enter a starting year between 2000 and 2100.");
    }

    const existing = await prisma.fiscalYear.findUnique({
      where: { startYear: input.startYear },
    });
    if (existing)
      throw new Error(`${fiscalYearLabel(input.startYear)} already exists.`);

    const created = await prisma.fiscalYear.create({
      data: {
        startYear: input.startYear,
        label: fiscalYearLabel(input.startYear),
      },
    });

    if (input.copyFromId) await copyHierarchy(input.copyFromId, created.id);

    revalidatePath("/manage");
    revalidatePath("/");
  });
}

/**
 * Duplicates a year's hierarchy, weights and targets into a new year — the
 * usual starting point, since most of a scorecard carries over and only the
 * numbers move. Recorded values are deliberately not copied.
 */
async function copyHierarchy(fromId: string, toId: string): Promise<void> {
  const source = await prisma.kpi.findMany({
    where: { fiscalYearId: fromId },
    orderBy: { sortOrder: "asc" },
    include: { departments: true },
  });

  // Two passes: create every KPI parentless, then wire up the hierarchy once
  // all the new ids exist.
  const idMap = new Map<string, string>();
  for (const kpi of source) {
    const created = await prisma.kpi.create({
      data: {
        fiscalYearId: toId,
        code: kpi.code,
        name: kpi.name,
        sortOrder: kpi.sortOrder,
        weight: kpi.weight,
        metricType: kpi.metricType,
        direction: kpi.direction,
        targetMode: kpi.targetMode,
        targetConfig: kpi.targetConfig,
        unit: kpi.unit,
        deadlineMonth: kpi.deadlineMonth,
        scoreFinalAfterDeadline: kpi.scoreFinalAfterDeadline,
        departments: {
          createMany: {
            data: kpi.departments.map((d) => ({
              departmentId: d.departmentId,
            })),
          },
        },
      },
    });
    idMap.set(kpi.id, created.id);
  }

  for (const kpi of source) {
    if (!kpi.parentId) continue;
    await prisma.kpi.update({
      where: { id: idMap.get(kpi.id) as string },
      data: { parentId: idMap.get(kpi.parentId) },
    });
  }
}

export async function setActiveFiscalYear(id: string): Promise<ActionResult> {
  return attempt(async () => {
    await requireAdmin();
    await prisma.$transaction([
      prisma.fiscalYear.updateMany({ data: { isActive: false } }),
      prisma.fiscalYear.update({ where: { id }, data: { isActive: true } }),
    ]);
    revalidatePath("/");
    revalidatePath("/manage");
  });
}

export async function deleteFiscalYear(id: string): Promise<ActionResult> {
  return attempt(async () => {
    await requireAdmin();
    const fiscalYear = await prisma.fiscalYear.findUnique({
      where: { id },
      select: { closedAt: true, label: true },
    });
    if (!fiscalYear) throw new Error("That fiscal year no longer exists.");
    if (fiscalYear.closedAt) {
      throw new Error(`${fiscalYear.label} is closed. Reopen it first if you want to delete it.`);
    }
    // Cascades to KPIs, their values and their updates.
    await prisma.fiscalYear.delete({ where: { id } });
    revalidatePath("/");
    revalidatePath("/manage");
  });
}

/**
 * Freezes a fiscal year: takes an immutable snapshot of every month's
 * computed scorecard, then blocks every further write to its KPIs. A future
 * change to the scoring engine itself can never move a year once closed —
 * the closed year always renders from this snapshot, not a live recompute.
 */
export async function closeFiscalYear(fiscalYearId: string): Promise<ActionResult> {
  return attempt(async () => {
    const admin = await requireAdmin();

    const fiscalYear = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } });
    if (!fiscalYear) throw new Error("That fiscal year no longer exists.");
    if (fiscalYear.closedAt) throw new Error(`${fiscalYear.label} is already closed.`);

    const scorecard = await getScorecard({ fiscalYearId });
    if (!scorecard) throw new Error("Could not load this year's scorecard.");

    const { buildScoredTree } = await import("@/lib/kpi-tree");
    const yearPeriods = periodsOfFiscalYear(fiscalYear.startYear);
    const data: Record<string, { roots: unknown; total: unknown }> = {};
    for (const p of yearPeriods) {
      const { roots, total } = buildScoredTree(scorecard.kpiRecords, scorecard.values, p, scorecard.overrides);
      data[p] = { roots, total };
    }

    await prisma.$transaction(async (tx) => {
      await tx.fiscalYearSnapshot.upsert({
        where: { fiscalYearId },
        create: { fiscalYearId, data: JSON.stringify(data) },
        update: { data: JSON.stringify(data) },
      });
      await tx.fiscalYear.update({
        where: { id: fiscalYearId },
        data: { closedAt: new Date(), closedById: admin.id },
      });
      await tx.fiscalYearAudit.create({
        data: { fiscalYearId, action: "closed", author: admin.username },
      });
    });

    revalidatePath("/");
    revalidatePath("/manage");
    revalidatePath("/kpis");
    revalidatePath("/milestones");
  });
}

export async function reopenFiscalYear(fiscalYearId: string, reason: string): Promise<ActionResult> {
  return attempt(async () => {
    const admin = await requireAdmin();

    const trimmedReason = reason.trim();
    if (!trimmedReason) throw new Error("Explain why this year is being reopened.");

    const fiscalYear = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } });
    if (!fiscalYear) throw new Error("That fiscal year no longer exists.");
    if (!fiscalYear.closedAt) throw new Error(`${fiscalYear.label} is not closed.`);

    await prisma.$transaction(async (tx) => {
      // The snapshot is kept, not deleted — what the board actually
      // approved stays inspectable even after a reopen for correction.
      // Re-closing later overwrites it with a fresh one.
      await tx.fiscalYear.update({
        where: { id: fiscalYearId },
        data: { closedAt: null, closedById: null },
      });
      await tx.fiscalYearAudit.create({
        data: { fiscalYearId, action: "reopened", reason: trimmedReason, author: admin.username },
      });
    });

    revalidatePath("/");
    revalidatePath("/manage");
    revalidatePath("/kpis");
    revalidatePath("/milestones");
  });
}

export async function saveDepartments(
  departments: { id: string | null; name: string }[],
): Promise<ActionResult> {
  return attempt(async () => {
    await requireAdmin();

    const names = departments.map((d) => d.name.trim()).filter(Boolean);
    const duplicate = names.find(
      (name, index) => names.indexOf(name) !== index,
    );
    if (duplicate) throw new Error(`"${duplicate}" is listed twice.`);

    const keptIds = departments.map((d) => d.id).filter(Boolean) as string[];

    // A batch of operations sent together, rather than an interactive
    // transaction — the latter holds one DB session open across several
    // round-trips, which the production transaction-pooling connection
    // (see docs/deploy.md) doesn't reliably preserve, surfacing as
    // "Transaction not found... was obtained before disconnecting."
    const ops = [
      // Removing a department detaches it from its KPIs rather than deleting
      // them; ownership is metadata, not the KPI itself.
      prisma.department.deleteMany({ where: { id: { notIn: keptIds } } }),
      ...departments
        .filter((d) => d.name.trim())
        .map((d) =>
          d.id
            ? prisma.department.update({ where: { id: d.id }, data: { name: d.name.trim() } })
            : prisma.department.create({ data: { name: d.name.trim() } })
        ),
    ];
    await prisma.$transaction(ops);

    revalidatePath("/manage");
    revalidatePath("/kpis");
  });
}

export type ImportMode = "REPLACE" | "UPDATE";

export type ImportSummary = {
  created: number;
  updated: number;
  removed: number;
  departmentsCreated: number;
  /** Monthly figures written from the workbook's optional Values sheet. */
  valuesWritten: number;
  /** Progress Updates created from the workbook's optional Updates sheet — rows whose Id already existed are skipped. */
  updatesWritten: number;
};

/**
 * Writes the contents of a parsed workbook into a fiscal year.
 *
 * Matching is by code, so re-importing an edited sheet updates KPIs in place
 * and keeps their recorded values. Under `REPLACE`, a KPI whose code has
 * disappeared from the sheet is removed, along with its values — which is why
 * the import screen shows a diff and asks for confirmation first. Under
 * `UPDATE` (the default), anything absent from the sheet is left alone —
 * correct once any part of the hierarchy is created or edited in the app,
 * since the spreadsheet is no longer the sole source of truth.
 */
export async function applyImport(input: {
  fiscalYearId: string;
  kpis: ParsedKpi[];
  departments: string[];
  values?: ParsedValue[];
  updates?: ParsedUpdate[];
  mode?: ImportMode;
}): Promise<ImportSummary> {
  const admin = await requireAdmin();
  const mode: ImportMode = input.mode ?? "UPDATE";

  const { fiscalYearId, kpis } = input;
  if (kpis.length === 0) throw new Error("That workbook has no KPI rows.");

  const targetYear = await prisma.fiscalYear.findUnique({
    where: { id: fiscalYearId },
    select: { closedAt: true, label: true },
  });
  if (!targetYear) throw new Error("That fiscal year no longer exists.");
  assertFiscalYearOpen(targetYear);

  // A restore point before anything is written, so an import that turns out
  // to have been the wrong spreadsheet — a Replace run in particular, which
  // removes KPIs and their figures — can be undone from /manage/backups.
  const priorState = await serializeFiscalYear(fiscalYearId);
  if (priorState.kpis.length > 0) {
    await prisma.$transaction((tx) =>
      writeCheckpoint(tx, {
        fiscalYearId,
        name: automaticCheckpointName("import"),
        automatic: true,
        createdById: admin.id,
        backup: priorState,
      })
    );
  }

  const existingDepartments = await prisma.department.findMany();
  const departmentIdByName = new Map(
    existingDepartments.map((d) => [d.name.toLowerCase(), d.id]),
  );

  let departmentsCreated = 0;
  for (const name of input.departments) {
    if (departmentIdByName.has(name.toLowerCase())) continue;
    const created = await prisma.department.create({ data: { name } });
    departmentIdByName.set(name.toLowerCase(), created.id);
    departmentsCreated++;
  }

  const existing = await prisma.kpi.findMany({ where: { fiscalYearId } });
  const existingByCode = new Map(
    existing.map((k) => [k.code.toLowerCase(), k]),
  );
  const incomingCodes = new Set(kpis.map((k) => k.code.toLowerCase()));

  let created = 0;
  let updated = 0;
  const idByCode = new Map<string, string>();
  const allKpiIds: string[] = [];
  const departmentPairs: { kpiId: string; departmentId: string }[] = [];

  // Pass 1: upsert every row without its parent, so a parent listed after its
  // child in the sheet still resolves. Department links are collected here
  // and written in one batch below, rather than per row, since Prisma has no
  // bulk upsert of its own to fold the KPI write itself into the same batch.
  for (const [index, kpi] of kpis.entries()) {
    const data = {
      name: kpi.name,
      sortOrder: index,
      weight: kpi.weight,
      metricType: kpi.metricType,
      direction: kpi.direction,
      targetMode: kpi.targetMode,
      targetConfig: kpi.targetConfig,
      unit: kpi.unit,
      deadlineMonth: kpi.deadlineMonth,
      scoreFinalAfterDeadline: kpi.scoreFinalAfterDeadline,
      frequency: kpi.frequency,
      phasing: kpi.phasing,
      phaseConfig: kpi.phaseConfig,
      status: kpi.status,
      parentId: null as string | null,
    };

    const match = existingByCode.get(kpi.code.toLowerCase());
    const record = match
      ? await prisma.kpi.update({ where: { id: match.id }, data })
      : await prisma.kpi.create({
          data: { ...data, fiscalYearId, code: kpi.code },
        });

    if (match) updated++;
    else created++;
    idByCode.set(kpi.code.toLowerCase(), record.id);
    allKpiIds.push(record.id);

    const departmentIds = kpi.departments
      .map((name) => departmentIdByName.get(name.toLowerCase()))
      .filter(Boolean) as string[];
    for (const departmentId of departmentIds) {
      departmentPairs.push({ kpiId: record.id, departmentId });
    }
  }

  // Every imported KPI's department links are cleared and rewritten as two
  // bulk statements, rather than a delete+create per row.
  await prisma.kpiDepartment.deleteMany({ where: { kpiId: { in: allKpiIds } } });
  if (departmentPairs.length > 0) {
    await prisma.kpiDepartment.createMany({ data: departmentPairs, skipDuplicates: true });
  }

  // Pass 2: attach parents, in one statement rather than one UPDATE per row.
  const parentPairs = kpis
    .map((kpi) => {
      if (!kpi.parentCode) return null;
      const parentId = idByCode.get(kpi.parentCode.toLowerCase());
      const childId = idByCode.get(kpi.code.toLowerCase());
      if (!parentId || !childId) return null;
      return { childId, parentId };
    })
    .filter((p): p is { childId: string; parentId: string } => p !== null);

  if (parentPairs.length > 0) {
    await prisma.$executeRaw`
      UPDATE "Kpi" AS k
      SET "parentId" = c.parent_id
      FROM (VALUES ${Prisma.join(
        parentPairs.map((p) => Prisma.sql`(${p.childId}, ${p.parentId})`)
      )}) AS c(child_id, parent_id)
      WHERE k.id = c.child_id
    `;
  }

  const toRemove =
    mode === "REPLACE"
      ? existing.filter((k) => !incomingCodes.has(k.code.toLowerCase()))
      : [];
  if (toRemove.length > 0) {
    await prisma.kpi.deleteMany({
      where: { id: { in: toRemove.map((k) => k.id) } },
    });
  }

  // Monthly figures, if the workbook carried a Values sheet. Written after the
  // hierarchy so every code resolves, and upserted so re-importing a corrected
  // sheet overwrites rather than duplicates.
  let valuesWritten = 0;
  for (const v of input.values ?? []) {
    const kpiId = idByCode.get(v.code.toLowerCase());
    if (!kpiId) continue;
    const data = {
      value: v.value,
      plannedValue: v.plannedValue,
      basis: v.basis,
      completionDate: v.completionDate ? new Date(v.completionDate) : null,
      note: v.note,
    };
    await prisma.kpiValue.upsert({
      where: { kpiId_period: { kpiId, period: v.period } },
      create: { kpiId, period: v.period, ...data },
      update: data,
    });
    valuesWritten++;
  }

  // Progress Updates, if the workbook carried an Updates sheet. Deduped by
  // Id against what's already in the database, so re-importing an
  // unmodified export is a no-op here rather than duplicating every post.
  let updatesWritten = 0;
  const incomingUpdates = input.updates ?? [];
  if (incomingUpdates.length > 0) {
    const existingUpdateIds = new Set(
      (
        await prisma.kpiUpdate.findMany({
          where: { kpiId: { in: allKpiIds } },
          select: { id: true },
        })
      ).map((u) => u.id)
    );

    for (const u of incomingUpdates) {
      const kpiId = idByCode.get(u.code.toLowerCase());
      if (!kpiId) continue;
      if (u.id && existingUpdateIds.has(u.id)) continue;

      await prisma.kpiUpdate.create({
        data: {
          kpiId,
          period: u.period,
          mode: u.mode,
          body: u.body,
          author: u.author,
          currentProgress: u.currentProgress,
          nextProgress: u.nextProgress,
          timeCost: u.timeCost,
          issues: u.issues,
        },
      });
      updatesWritten++;
    }
  }

  revalidatePath("/");
  revalidatePath("/kpis");
  revalidatePath("/entry");
  revalidatePath("/manage");
  revalidatePath("/milestones");

  return { created, updated, removed: toRemove.length, departmentsCreated, valuesWritten, updatesWritten };
}
