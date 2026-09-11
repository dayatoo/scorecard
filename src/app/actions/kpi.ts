"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { formatPeriodLabel, isPeriodInFiscalYear } from "@/lib/fiscal";
import { formatDate } from "@/lib/dates";
import { BANDS, lastDayOfPeriod, type Band } from "@/lib/scoring";
import { attempt, type ActionResult } from "./result";

// Every action re-checks authentication: a server action is a POST endpoint
// that can be called without going through the UI, so the proxy's page-level
// gate is not enough on its own.

export type SaveEntryInput = {
  kpiId: string;
  period: string;
  value: number | null;
  basis: "ACTUAL" | "ESTIMATE";
  completionDate: string | null;
  note: string | null;
};

/** Reject a period that is not a real month inside the KPI's own fiscal year. */
async function assertPeriodValid(kpiId: string, period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new Error(`"${period}" is not a valid month.`);
  }
  const kpi = await prisma.kpi.findUnique({
    where: { id: kpiId },
    select: { fiscalYear: { select: { startYear: true } } },
  });
  if (!kpi) throw new Error("That KPI no longer exists.");
  if (!isPeriodInFiscalYear(period, kpi.fiscalYear.startYear)) {
    throw new Error(`${period} is outside the fiscal year this KPI belongs to.`);
  }
}

/** Writes one month's figure. Called only after the user confirms a save. */
export async function saveEntry(input: SaveEntryInput): Promise<ActionResult> {
  return attempt(() => writeEntry(input));
}

async function writeEntry(input: SaveEntryInput): Promise<void> {
  await requireAuth();
  await assertPeriodValid(input.kpiId, input.period);

  if (input.value !== null && !Number.isFinite(input.value)) {
    throw new Error("That value is not a number.");
  }

  const completionDate = input.completionDate ? new Date(input.completionDate) : null;
  if (completionDate && Number.isNaN(completionDate.getTime())) {
    throw new Error("That completion date is not a valid date.");
  }
  // Something cannot have been completed after the month being reported on —
  // that would let a future completion score an earlier month.
  if (completionDate) {
    const endOfPeriod = lastDayOfPeriod(input.period);
    if (completionDate > endOfPeriod) {
      throw new Error(
        `${formatDate(completionDate)} is after ${formatPeriodLabel(input.period)}, the month being reported on. Record it against the month it was completed in.`
      );
    }
  }

  const data = {
    value: input.value,
    basis: input.basis,
    completionDate,
    note: input.note?.trim() || null,
  };

  // Clearing every field removes the entry outright, so the KPI goes back to
  // "not reported" rather than sitting on a hollow row that scores zero.
  if (data.value === null && data.completionDate === null && data.note === null) {
    await prisma.kpiValue.deleteMany({
      where: { kpiId: input.kpiId, period: input.period },
    });
  } else {
    await prisma.kpiValue.upsert({
      where: { kpiId_period: { kpiId: input.kpiId, period: input.period } },
      create: { kpiId: input.kpiId, period: input.period, ...data },
      update: data,
    });
  }

  revalidatePath("/");
  revalidatePath("/kpis");
  revalidatePath("/entry");
  revalidatePath("/milestones");
  revalidatePath(`/kpi/${input.kpiId}`);
}

/** Bulk version for the data-entry grid — one confirmation, one pass. */
export async function saveEntries(inputs: SaveEntryInput[]): Promise<ActionResult> {
  return attempt(async () => {
    await requireAuth();
    for (const input of inputs) await writeEntry(input);
  });
}

/** Targets as the editor sends them: band numbers, band windows, or a month. */
export type TargetConfigInput =
  | { kind: "FIXED"; bands: Record<Band, number> }
  | { kind: "RANGE"; bands: Record<Band, [number, number]> }
  | { kind: "MONTH"; targetMonth: string };

export type SaveKpiSettingsInput = {
  kpiId: string;
  name: string;
  weight: number;
  unit: string | null;
  departmentIds: string[];
  deadlineMonth: string | null;
  scoreFinalAfterDeadline: boolean;
  targetConfig: TargetConfigInput | null;
};

/** Updates a KPI's definition from the detail page. */
export async function saveKpiSettings(input: SaveKpiSettingsInput): Promise<ActionResult> {
  return attempt(() => writeKpiSettings(input));
}

async function writeKpiSettings(input: SaveKpiSettingsInput): Promise<void> {
  await requireAuth();

  const name = input.name.trim();
  if (!name) throw new Error("A KPI needs a name.");
  if (!Number.isFinite(input.weight) || input.weight < 0) {
    throw new Error("Weight must be zero or more.");
  }
  if (input.deadlineMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.deadlineMonth)) {
    throw new Error("A deadline must be a month in YYYY-MM form.");
  }

  validateTargets(input.targetConfig);

  await prisma.$transaction([
    prisma.kpi.update({
      where: { id: input.kpiId },
      data: {
        name,
        weight: input.weight,
        unit: input.unit?.trim() || null,
        deadlineMonth: input.deadlineMonth,
        scoreFinalAfterDeadline: input.scoreFinalAfterDeadline,
        targetConfig: serialiseTargets(input.targetConfig),
      },
    }),
    prisma.kpiDepartment.deleteMany({ where: { kpiId: input.kpiId } }),
    prisma.kpiDepartment.createMany({
      data: input.departmentIds.map((departmentId) => ({
        kpiId: input.kpiId,
        departmentId,
      })),
      skipDuplicates: true,
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/kpis");
  revalidatePath("/manage");
  revalidatePath(`/kpi/${input.kpiId}`);
}

function bandName(band: Band): string {
  return band.replace(/_/g, " ").toLowerCase();
}

function validateTargets(config: TargetConfigInput | null): void {
  if (!config) return;

  if (config.kind === "MONTH") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(config.targetMonth)) {
      throw new Error("The target month must be in YYYY-MM form, e.g. 2026-10.");
    }
    return;
  }

  for (const band of BANDS) {
    const value = config.bands[band];
    if (value === undefined || value === null) {
      throw new Error(`The ${bandName(band)} target is missing.`);
    }
    const numbers = Array.isArray(value) ? value : [value];
    if (numbers.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
      throw new Error(`The ${bandName(band)} target is not a number.`);
    }
  }
}

/** Back to the JSON shape the scoring engine reads from the database. */
function serialiseTargets(config: TargetConfigInput | null): string | null {
  if (!config) return null;
  if (config.kind === "MONTH") return JSON.stringify({ targetMonth: config.targetMonth });
  return JSON.stringify(config.bands);
}

export async function addKpiUpdate(input: {
  kpiId: string;
  period: string;
  body: string;
  author: string | null;
}): Promise<ActionResult> {
  return attempt(async () => {
    await requireAuth();

    const body = input.body.trim();
    if (!body) throw new Error("Write something before posting an update.");

    await prisma.kpiUpdate.create({
      data: {
        kpiId: input.kpiId,
        period: input.period,
        body,
        author: input.author?.trim() || null,
      },
    });

    revalidatePath(`/kpi/${input.kpiId}`);
  });
}

export async function deleteKpiUpdate(id: string, kpiId: string): Promise<ActionResult> {
  return attempt(async () => {
    await requireAuth();
    await prisma.kpiUpdate.delete({ where: { id } });
    revalidatePath(`/kpi/${kpiId}`);
  });
}
