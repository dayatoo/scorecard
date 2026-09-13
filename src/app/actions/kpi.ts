"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { formatPeriodLabel, isPeriodInFiscalYear } from "@/lib/fiscal";
import { formatDate } from "@/lib/dates";
import { parseTargetConfig } from "@/lib/kpi-tree";
import { BANDS, lastDayOfPeriod, type Band, type Frequency, type Phasing } from "@/lib/scoring";
import {
  crossesNumericMonthBoundary,
  metricColumns,
  validateMetric,
  type MetricInput,
} from "@/lib/targets";
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

export type SaveKpiSettingsInput = {
  kpiId: string;
  code: string;
  name: string;
  weight: number;
  unit: string | null;
  departmentIds: string[];
  deadlineMonth: string | null;
  scoreFinalAfterDeadline: boolean;
  metric: MetricInput;
  /** Confirms clearing figures that would otherwise block a numeric <-> month-completion change. */
  clearFiguresForMetricChange?: boolean;
  frequency: Frequency;
  phasing: Phasing;
  /** CUSTOM only: 12 monthly shares (0-100). */
  phaseConfig: number[] | null;
  author?: string | null;
};

type AuditEntry = { field: string; label: string; from: string; to: string };

function describeMetric(metricType: string | null, targetMode: string | null, direction: string | null, targetConfig: string | null): string {
  if (!metricType) return "no metric (rollup)";
  const config = parseTargetConfig(targetConfig);
  if (metricType === "MONTH_COMPLETION") {
    return `month completion, target ${(config as { targetMonth?: string } | null)?.targetMonth ?? "—"}`;
  }
  const bands = BANDS.map((b) => {
    const v = (config as Record<Band, unknown> | null)?.[b];
    return Array.isArray(v) ? `${v[0]}-${v[1]}` : String(v ?? "—");
  }).join(", ");
  return `${metricType} ${targetMode ?? ""} ${direction ?? ""}: ${bands}`;
}

/** Updates a KPI's definition from the detail page. */
export async function saveKpiSettings(input: SaveKpiSettingsInput): Promise<ActionResult> {
  return attempt(() => writeKpiSettings(input));
}

async function writeKpiSettings(input: SaveKpiSettingsInput): Promise<void> {
  await requireAuth();

  const name = input.name.trim();
  if (!name) throw new Error("A KPI needs a name.");
  const code = input.code.trim();
  if (!code) throw new Error("A KPI needs a code.");
  if (!Number.isFinite(input.weight) || input.weight < 0) {
    throw new Error("Weight must be zero or more.");
  }
  if (input.deadlineMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.deadlineMonth)) {
    throw new Error("A deadline must be a month in YYYY-MM form.");
  }

  const existing = await prisma.kpi.findUnique({
    where: { id: input.kpiId },
    include: {
      _count: { select: { children: true, values: true } },
      values: { select: { period: true, value: true, completionDate: true } },
      departments: true,
    },
  });
  if (!existing) throw new Error("That KPI no longer exists.");
  const isLeaf = existing._count.children === 0;

  // Code uniqueness, checked ourselves rather than left to Prisma's raw P2002
  // error, so the message names the actual problem.
  if (code.toLowerCase() !== existing.code.toLowerCase()) {
    const clash = await prisma.kpi.findFirst({
      where: { fiscalYearId: existing.fiscalYearId, code, id: { not: input.kpiId } },
    });
    if (clash) throw new Error(`Code "${code}" is already used by "${clash.name}" in this year.`);
  }

  // A parent's metric would be silently ignored, so a non-NONE metric on one
  // is rejected outright rather than coerced — a stale tab could otherwise
  // wipe a leaf's targets with no warning by resubmitting an old form.
  let metric = input.metric;
  if (!isLeaf && metric.kind !== "NONE") {
    throw new Error(`"${name}" has sub-KPIs, so it cannot carry its own metric.`);
  }

  const nextColumns = metricColumns(metric);

  // The only transition that truly orphans data: a numeric KPI stores a
  // value, a month-completion KPI stores a completion date, and neither is
  // readable as the other.
  const figuresAtRisk = existing.values.filter(
    (v) => v.value !== null || v.completionDate !== null
  );
  const crossesBoundary = crossesNumericMonthBoundary(existing.metricType, nextColumns.metricType);
  let clearedValueCount = 0;
  if (crossesBoundary && figuresAtRisk.length > 0) {
    if (!input.clearFiguresForMetricChange) {
      const months = figuresAtRisk.map((v) => formatPeriodLabel(v.period)).join(", ");
      throw new Error(
        `${months} ${figuresAtRisk.length === 1 ? "has a figure" : "have figures"} recorded against this KPI. They cannot be read the new way — tick "Clear these figures" to change the metric anyway.`
      );
    }
    clearedValueCount = figuresAtRisk.length;
  }

  const metricChanged =
    existing.metricType !== nextColumns.metricType ||
    existing.targetMode !== nextColumns.targetMode ||
    existing.direction !== nextColumns.direction ||
    existing.targetConfig !== nextColumns.targetConfig;
  if (metricChanged) metric = validateMetric(metric);

  // Phasing only means anything for a phase-able numeric target; forced off
  // server-side so a stale form can't leave it set on a milestone.
  const phasing: Phasing = nextColumns.metricType && nextColumns.metricType !== "MONTH_COMPLETION" ? input.phasing : "NONE";
  const phaseConfig = phasing === "CUSTOM" ? JSON.stringify(input.phaseConfig ?? []) : null;

  const audits: AuditEntry[] = [];
  const push = (field: string, label: string, from: string, to: string) => {
    if (from !== to) audits.push({ field, label, from, to });
  };
  push("name", "Name", existing.name, name);
  push("code", "Code", existing.code, code);
  push("weight", "Weight % (of group)", `${existing.weight}`, `${input.weight}`);
  push("unit", "Unit", existing.unit ?? "empty", input.unit?.trim() || "empty");
  push(
    "deadlineMonth",
    "Deadline month",
    existing.deadlineMonth ? formatPeriodLabel(existing.deadlineMonth) : "none",
    input.deadlineMonth ? formatPeriodLabel(input.deadlineMonth) : "none"
  );
  push("frequency", "Reporting frequency", existing.frequency, input.frequency);
  push("phasing", "Phasing", existing.phasing, phasing);
  if (metricChanged) {
    push(
      "targets",
      "Metric and targets",
      describeMetric(existing.metricType, existing.targetMode, existing.direction, existing.targetConfig),
      describeMetric(nextColumns.metricType, nextColumns.targetMode, nextColumns.direction, nextColumns.targetConfig)
    );
  }
  const beforeDepts = [...existing.departments.map((d) => d.departmentId)].sort().join(",");
  const afterDepts = [...input.departmentIds].sort().join(",");
  push("departments", "Owning departments", beforeDepts || "none", afterDepts || "none");

  await prisma.$transaction(async (tx) => {
    await tx.kpi.update({
      where: { id: input.kpiId },
      data: {
        name,
        code,
        weight: input.weight,
        unit: input.unit?.trim() || null,
        deadlineMonth: input.deadlineMonth,
        scoreFinalAfterDeadline: input.scoreFinalAfterDeadline,
        frequency: input.frequency,
        phasing,
        phaseConfig,
        ...nextColumns,
      },
    });

    await tx.kpiDepartment.deleteMany({ where: { kpiId: input.kpiId } });
    if (input.departmentIds.length > 0) {
      await tx.kpiDepartment.createMany({
        data: input.departmentIds.map((departmentId) => ({
          kpiId: input.kpiId,
          departmentId,
        })),
        skipDuplicates: true,
      });
    }

    if (clearedValueCount > 0) {
      await tx.kpiValue.deleteMany({ where: { kpiId: input.kpiId } });
    }

    if (audits.length > 0) {
      await tx.kpiAudit.createMany({
        data: audits.map((a) => ({
          kpiId: input.kpiId,
          field: a.field,
          label: a.label,
          from: a.from,
          to: a.to,
          author: input.author?.trim() || null,
        })),
      });
    }
  });

  revalidatePath("/");
  revalidatePath("/kpis");
  revalidatePath("/manage");
  revalidatePath("/manage/hierarchy");
  revalidatePath(`/kpi/${input.kpiId}`);
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
