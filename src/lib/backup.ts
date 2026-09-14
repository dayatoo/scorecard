// Reading a fiscal year into a backup document, and putting one back.
//
// The document's shape and its validator live in ./backup-format, which has
// no database access; this module is the part that touches Prisma. Both are
// re-exported here so callers have a single import.
//
// Not to be confused with FiscalYearSnapshot, which freezes the *computed
// scores* of a closed year and is only ever read. A backup holds the figures,
// targets, hierarchy and history a year is rebuilt from.

import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "./prisma";
import { fiscalYearLabel } from "./fiscal";
import {
  BACKUP_FORMAT_VERSION,
  countValues,
  type BackupKpi,
  type FiscalYearBackup,
  type RestoreSummary,
  type RestoreTarget,
} from "./backup-format";

export * from "./backup-format";

/**
 * Reads one fiscal year's raw tables into a backup document.
 *
 * Deliberately does *not* go through getScorecard: for a closed year that
 * returns the frozen score snapshot rather than source data, so serializing
 * through it would back up computed scores instead of the figures behind
 * them — and a restore from that could never rebuild the year.
 *
 * User accounts and password hashes are never included (a backup file is not
 * a credential store), nor are pending KpiChangeProposals, which are
 * transient approval-queue workflow rather than scorecard state. Usernames
 * appear only as free-text attribution.
 */
export async function serializeFiscalYear(fiscalYearId: string): Promise<FiscalYearBackup> {
  const fiscalYear = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } });
  if (!fiscalYear) throw new Error("That fiscal year no longer exists.");

  const rows = await prisma.kpi.findMany({
    where: { fiscalYearId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    include: {
      departments: { include: { department: true } },
      values: { orderBy: { period: "asc" } },
      updates: { orderBy: { createdAt: "asc" } },
      audits: { orderBy: { createdAt: "asc" } },
      scoreOverrides: { orderBy: { period: "asc" }, include: { by: { select: { username: true } } } },
    },
  });

  const codeById = new Map(rows.map((row) => [row.id, row.code]));

  const kpis: BackupKpi[] = rows.map((row) => ({
    code: row.code,
    parentCode: row.parentId ? (codeById.get(row.parentId) ?? null) : null,
    name: row.name,
    sortOrder: row.sortOrder,
    weight: row.weight,
    frequency: row.frequency,
    phasing: row.phasing,
    phaseConfig: row.phaseConfig,
    metricType: row.metricType,
    direction: row.direction,
    targetMode: row.targetMode,
    targetConfig: row.targetConfig,
    unit: row.unit,
    deadlineMonth: row.deadlineMonth,
    scoreFinalAfterDeadline: row.scoreFinalAfterDeadline,
    departments: row.departments.map((d) => d.department.name),
    values: row.values.map((v) => ({
      period: v.period,
      value: v.value,
      plannedValue: v.plannedValue,
      basis: v.basis,
      completionDate: v.completionDate ? v.completionDate.toISOString() : null,
      note: v.note,
    })),
    updates: row.updates.map((u) => ({
      period: u.period,
      mode: u.mode,
      body: u.body,
      currentProgress: u.currentProgress,
      nextProgress: u.nextProgress,
      timeCost: u.timeCost,
      issues: u.issues,
      author: u.author,
      createdAt: u.createdAt.toISOString(),
    })),
    audits: row.audits.map((a) => ({
      field: a.field,
      label: a.label,
      from: a.from,
      to: a.to,
      author: a.author,
      createdAt: a.createdAt.toISOString(),
    })),
    overrides: row.scoreOverrides.map((o) => ({
      period: o.period,
      score: o.score,
      reason: o.reason,
      byUsername: o.by.username,
      createdAt: o.createdAt.toISOString(),
    })),
  }));

  const departments = [...new Set(kpis.flatMap((k) => k.departments))].sort();

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    fiscalYear: {
      startYear: fiscalYear.startYear,
      label: fiscalYear.label || fiscalYearLabel(fiscalYear.startYear),
      wasClosed: fiscalYear.closedAt !== null,
    },
    departments,
    kpis,
  };
}

/**
 * Writes a restore point, inside a caller-supplied transaction so a
 * checkpoint and whatever it protects against land together or not at all.
 */
export async function writeCheckpoint(
  tx: Prisma.TransactionClient,
  input: {
    fiscalYearId: string;
    name: string;
    automatic: boolean;
    createdById: string | null;
    backup: FiscalYearBackup;
  }
): Promise<void> {
  await tx.fiscalYearCheckpoint.create({
    data: {
      fiscalYearId: input.fiscalYearId,
      name: input.name,
      automatic: input.automatic,
      data: JSON.stringify(input.backup),
      kpiCount: input.backup.kpis.length,
      valueCount: countValues(input.backup),
      createdById: input.createdById,
    },
  });
}

/**
 * Rebuilds a fiscal year from a backup, inside a caller-supplied transaction.
 *
 * In place, this replaces the year's contents wholesale: its KPIs are deleted
 * (cascading to figures, updates, audits, calibrations and any pending
 * proposals) and recreated from the document. KPIs get fresh ids, so links to
 * individual KPI pages from before a restore will not resolve — the calling
 * UI says so before anyone confirms.
 *
 * The restored year is always *open*. The document records whether it was
 * closed when taken, but reinstating closedAt would leave a frozen score
 * snapshot sitting alongside freshly restored source data; re-closing the
 * year regenerates that snapshot from what is actually there.
 */
export async function restoreInto(
  tx: Prisma.TransactionClient,
  backup: FiscalYearBackup,
  target: RestoreTarget
): Promise<RestoreSummary> {
  const fiscalYear =
    target.mode === "IN_PLACE"
      ? await tx.fiscalYear.findUnique({ where: { id: target.fiscalYearId } })
      : await tx.fiscalYear.create({
          data: {
            startYear: target.startYear,
            label: fiscalYearLabel(target.startYear),
          },
        });
  if (!fiscalYear) throw new Error("That fiscal year no longer exists.");

  if (target.mode === "IN_PLACE") {
    await tx.kpi.deleteMany({ where: { fiscalYearId: fiscalYear.id } });
    // A restored year is open, whatever it was before — see the note above.
    await tx.fiscalYear.update({
      where: { id: fiscalYear.id },
      data: { closedAt: null, closedById: null },
    });
    await tx.fiscalYearSnapshot.deleteMany({ where: { fiscalYearId: fiscalYear.id } });
  }

  const wantedDepartments = [...new Set(backup.kpis.flatMap((k) => k.departments))];
  const existingDepartments = await tx.department.findMany();
  const departmentIdByName = new Map(
    existingDepartments.map((d) => [d.name.toLowerCase(), d.id])
  );
  let departmentsCreated = 0;
  for (const name of wantedDepartments) {
    if (departmentIdByName.has(name.toLowerCase())) continue;
    const created = await tx.department.create({ data: { name } });
    departmentIdByName.set(name.toLowerCase(), created.id);
    departmentsCreated++;
  }

  // Overrides carry a username, not an id. A user who no longer exists (or
  // never existed in this deployment) would break the required relation, so
  // those calibrations are dropped rather than silently reattributed.
  const usernames = [...new Set(backup.kpis.flatMap((k) => k.overrides.map((o) => o.byUsername)))];
  const userIdByUsername = new Map(
    (await tx.user.findMany({ where: { username: { in: usernames } }, select: { id: true, username: true } }))
      .map((u) => [u.username, u.id])
  );

  // Two passes, as copyHierarchy and applyImport already do: create every KPI
  // parentless so a parent listed after its child still resolves, then wire
  // the hierarchy once all the new ids exist.
  const idByCode = new Map<string, string>();
  let values = 0;
  let overrides = 0;

  for (const kpi of backup.kpis) {
    const created = await tx.kpi.create({
      data: {
        fiscalYearId: fiscalYear.id,
        code: kpi.code,
        name: kpi.name,
        sortOrder: kpi.sortOrder,
        weight: kpi.weight,
        frequency: kpi.frequency,
        phasing: kpi.phasing,
        phaseConfig: kpi.phaseConfig,
        metricType: kpi.metricType,
        direction: kpi.direction,
        targetMode: kpi.targetMode,
        targetConfig: kpi.targetConfig,
        unit: kpi.unit,
        deadlineMonth: kpi.deadlineMonth,
        scoreFinalAfterDeadline: kpi.scoreFinalAfterDeadline,
        departments: {
          createMany: {
            data: kpi.departments
              .map((name) => departmentIdByName.get(name.toLowerCase()))
              .filter((id): id is string => Boolean(id))
              .map((departmentId) => ({ departmentId })),
          },
        },
      },
    });
    idByCode.set(kpi.code.toLowerCase(), created.id);

    if (kpi.values.length > 0) {
      await tx.kpiValue.createMany({
        data: kpi.values.map((v) => ({
          kpiId: created.id,
          period: v.period,
          value: v.value,
          plannedValue: v.plannedValue,
          basis: v.basis,
          completionDate: v.completionDate ? new Date(v.completionDate) : null,
          note: v.note,
        })),
      });
      values += kpi.values.length;
    }

    if (kpi.updates.length > 0) {
      await tx.kpiUpdate.createMany({
        data: kpi.updates.map((u) => ({
          kpiId: created.id,
          period: u.period,
          mode: u.mode,
          body: u.body,
          currentProgress: u.currentProgress,
          nextProgress: u.nextProgress,
          timeCost: u.timeCost,
          issues: u.issues,
          author: u.author,
          createdAt: new Date(u.createdAt),
        })),
      });
    }

    if (kpi.audits.length > 0) {
      await tx.kpiAudit.createMany({
        data: kpi.audits.map((a) => ({
          kpiId: created.id,
          field: a.field,
          label: a.label,
          from: a.from,
          to: a.to,
          author: a.author,
          createdAt: new Date(a.createdAt),
        })),
      });
    }

    const restorableOverrides = kpi.overrides.filter((o) => userIdByUsername.has(o.byUsername));
    if (restorableOverrides.length > 0) {
      await tx.scoreOverride.createMany({
        data: restorableOverrides.map((o) => ({
          kpiId: created.id,
          period: o.period,
          score: o.score,
          reason: o.reason,
          byId: userIdByUsername.get(o.byUsername) as string,
          createdAt: new Date(o.createdAt),
        })),
      });
      overrides += restorableOverrides.length;
    }
  }

  for (const kpi of backup.kpis) {
    if (!kpi.parentCode) continue;
    const parentId = idByCode.get(kpi.parentCode.toLowerCase());
    if (!parentId) continue;
    await tx.kpi.update({
      where: { id: idByCode.get(kpi.code.toLowerCase()) as string },
      data: { parentId },
    });
  }

  return {
    fiscalYearId: fiscalYear.id,
    fiscalYearLabel: fiscalYear.label || fiscalYearLabel(fiscalYear.startYear),
    kpis: backup.kpis.length,
    values,
    overrides,
    departmentsCreated,
  };
}
