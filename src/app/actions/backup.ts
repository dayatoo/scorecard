"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { fiscalYearLabel } from "@/lib/fiscal";
import {
  MAX_BACKUP_BYTES,
  automaticCheckpointName,
  countValues,
  parseBackup,
  restoreInto,
  serializeFiscalYear,
  writeCheckpoint,
  type FiscalYearBackup,
  type RestoreSummary,
  type RestoreTarget,
} from "@/lib/backup";
import { assertFiscalYearOpen } from "@/lib/validation";
import { attempt, type ActionResult } from "./result";

/**
 * Saves the year's current state as a named restore point.
 *
 * Allowed on a closed year, unlike every other write: saving a restore point
 * changes nothing about the year itself.
 */
export async function createCheckpoint(
  fiscalYearId: string,
  name: string
): Promise<ActionResult> {
  return attempt(async () => {
    const admin = await requireAdmin();

    const trimmed = name.trim();
    if (!trimmed) throw new Error("Give this checkpoint a name, so it can be recognised later.");
    if (trimmed.length > 120) throw new Error("That name is too long — keep it under 120 characters.");

    const backup = await serializeFiscalYear(fiscalYearId);

    await prisma.$transaction((tx) =>
      writeCheckpoint(tx, {
        fiscalYearId,
        name: trimmed,
        automatic: false,
        createdById: admin.id,
        backup,
      })
    );

    revalidatePath("/manage/backups");
  });
}

export async function deleteCheckpoint(checkpointId: string): Promise<ActionResult> {
  return attempt(async () => {
    await requireAdmin();

    const checkpoint = await prisma.fiscalYearCheckpoint.findUnique({
      where: { id: checkpointId },
      select: { automatic: true },
    });
    if (!checkpoint) throw new Error("That checkpoint no longer exists.");
    if (checkpoint.automatic) {
      throw new Error(
        "Automatic checkpoints can't be deleted — they are the record of what a restore or import overwrote."
      );
    }

    await prisma.fiscalYearCheckpoint.delete({ where: { id: checkpointId } });
    revalidatePath("/manage/backups");
  });
}

export type RestorePreview = {
  source: {
    label: string;
    startYear: number;
    exportedAt: string;
    wasClosed: boolean;
    kpis: number;
    values: number;
    overrides: number;
  };
  /** What the target year holds now — null when restoring into a brand-new year. */
  current: { label: string; kpis: number; values: number } | null;
  /** Codes in the source the target doesn't have. */
  added: string[];
  /** Codes the target has that the source doesn't — these go away. */
  removed: string[];
};

/**
 * Reports what a restore would do without writing anything. A restore
 * replaces a year wholesale, so nothing runs on the strength of a mis-picked
 * file or a mis-clicked row.
 */
export async function previewRestoreFromCheckpoint(
  checkpointId: string,
  target: RestoreTarget
): Promise<ActionResult<RestorePreview>> {
  return attempt(async () => {
    await requireAdmin();
    return describeRestore(await loadCheckpoint(checkpointId), target);
  });
}

export async function previewRestoreFromUpload(
  formData: FormData,
  target: RestoreTarget
): Promise<ActionResult<RestorePreview>> {
  return attempt(async () => {
    await requireAdmin();
    return describeRestore(await readUpload(formData), target);
  });
}

export async function restoreFromCheckpoint(
  checkpointId: string,
  target: RestoreTarget
): Promise<ActionResult<RestoreSummary>> {
  return attempt(async () => {
    const checkpoint = await prisma.fiscalYearCheckpoint.findUnique({
      where: { id: checkpointId },
      select: { name: true },
    });
    if (!checkpoint) throw new Error("That checkpoint no longer exists.");

    return runRestore(
      await loadCheckpoint(checkpointId),
      target,
      `Restored from the checkpoint "${checkpoint.name}".`
    );
  });
}

export async function restoreFromUpload(
  formData: FormData,
  target: RestoreTarget
): Promise<ActionResult<RestoreSummary>> {
  return attempt(async () =>
    runRestore(await readUpload(formData), target, "Restored from an uploaded backup file.")
  );
}

// --------------------------------------------------------------------------

async function loadCheckpoint(checkpointId: string): Promise<FiscalYearBackup> {
  const checkpoint = await prisma.fiscalYearCheckpoint.findUnique({
    where: { id: checkpointId },
    select: { data: true },
  });
  if (!checkpoint) throw new Error("That checkpoint no longer exists.");
  return parseBackup(checkpoint.data);
}

async function readUpload(formData: FormData): Promise<FiscalYearBackup> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a backup file to upload.");
  }
  if (file.size > MAX_BACKUP_BYTES) {
    throw new Error(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — backups this app reads are under ` +
        `${MAX_BACKUP_BYTES / 1024 / 1024} MB.`
    );
  }
  return parseBackup(await file.text());
}

async function describeRestore(
  backup: FiscalYearBackup,
  target: RestoreTarget
): Promise<RestorePreview> {
  let current: RestorePreview["current"] = null;
  let added = backup.kpis.map((k) => k.code);
  let removed: string[] = [];

  if (target.mode === "IN_PLACE") {
    const fiscalYear = await prisma.fiscalYear.findUnique({
      where: { id: target.fiscalYearId },
      select: { label: true, startYear: true },
    });
    if (!fiscalYear) throw new Error("That fiscal year no longer exists.");

    const existing = await prisma.kpi.findMany({
      where: { fiscalYearId: target.fiscalYearId },
      select: { code: true, _count: { select: { values: true } } },
    });

    const incoming = new Set(backup.kpis.map((k) => k.code.toLowerCase()));
    const present = new Set(existing.map((k) => k.code.toLowerCase()));

    added = backup.kpis.filter((k) => !present.has(k.code.toLowerCase())).map((k) => k.code);
    removed = existing.filter((k) => !incoming.has(k.code.toLowerCase())).map((k) => k.code);

    current = {
      label: fiscalYear.label || fiscalYearLabel(fiscalYear.startYear),
      kpis: existing.length,
      values: existing.reduce((sum, k) => sum + k._count.values, 0),
    };
  }

  return {
    source: {
      label: backup.fiscalYear.label,
      startYear: backup.fiscalYear.startYear,
      exportedAt: backup.exportedAt,
      wasClosed: backup.fiscalYear.wasClosed,
      kpis: backup.kpis.length,
      values: countValues(backup),
      overrides: backup.kpis.reduce((sum, k) => sum + k.overrides.length, 0),
    },
    current,
    added,
    removed,
  };
}

/**
 * Puts a backup back, replacing the target year's contents or building a new
 * year from it.
 *
 * The current state is always checkpointed first, in the same transaction —
 * a recovery feature you cannot recover from is a trap, and restoring the
 * wrong file is exactly the kind of mistake this whole feature exists for.
 */
async function runRestore(
  backup: FiscalYearBackup,
  target: RestoreTarget,
  describeSource: string
): Promise<RestoreSummary> {
  const admin = await requireAdmin();

  if (target.mode === "IN_PLACE") {
    const fiscalYear = await prisma.fiscalYear.findUnique({
      where: { id: target.fiscalYearId },
      select: { closedAt: true, label: true },
    });
    if (!fiscalYear) throw new Error("That fiscal year no longer exists.");
    assertFiscalYearOpen(fiscalYear);
  } else {
    if (!Number.isInteger(target.startYear) || target.startYear < 2000 || target.startYear > 2100) {
      throw new Error("Enter a starting year between 2000 and 2100.");
    }
    const clash = await prisma.fiscalYear.findUnique({ where: { startYear: target.startYear } });
    if (clash) throw new Error(`${fiscalYearLabel(target.startYear)} already exists.`);
  }

  const priorState =
    target.mode === "IN_PLACE" ? await serializeFiscalYear(target.fiscalYearId) : null;

  const summary = await prisma.$transaction(
    async (tx) => {
      if (target.mode === "IN_PLACE" && priorState) {
        await writeCheckpoint(tx, {
          fiscalYearId: target.fiscalYearId,
          name: automaticCheckpointName("restore"),
          automatic: true,
          createdById: admin.id,
          backup: priorState,
        });
      }

      const result = await restoreInto(tx, backup, target);

      await tx.fiscalYearAudit.create({
        data: {
          fiscalYearId: result.fiscalYearId,
          action: "restored",
          reason: describeSource,
          author: admin.username,
        },
      });

      return result;
    },
    // A full year is a few hundred writes; the default 5s interactive
    // transaction budget is not enough for a large scorecard.
    { timeout: 120_000, maxWait: 10_000 }
  );

  revalidatePath("/");
  revalidatePath("/kpis");
  revalidatePath("/entry");
  revalidatePath("/manage");
  revalidatePath("/manage/backups");
  revalidatePath("/milestones");

  return summary;
}
