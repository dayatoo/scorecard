// Validating and writing a KPI settings change — shared by the direct-save
// action (src/app/actions/kpi.ts) and proposal approval
// (src/app/actions/proposals.ts).
//
// Kept out of the "use server" action files on purpose: every async function
// exported from one of those is a callable endpoint, and these two do no
// authentication of their own (commitKpiSettings even takes the author's
// name as an argument). Their callers authenticate first.

import "server-only";

import { revalidatePath } from "next/cache";

import { listDepartments } from "./data";
import { formatPeriodLabel } from "./fiscal";
import { parseTargetConfig } from "./kpi-tree";
import { prisma } from "./prisma";
import { BANDS, phaseConfigProblem, type Band, type Frequency, type Phasing } from "./scoring";
import {
  crossesNumericMonthBoundary,
  metricColumns,
  validateMetric,
  type MetricInput,
} from "./targets";
import { assertFiscalYearOpen } from "./validation";

export type SaveKpiSettingsInput = {
  kpiId: string;
  code: string;
  name: string;
  weight: number;
  subGroup: string | null;
  status: string | null;
  unit: string | null;
  departmentIds: string[];
  deadlineMonth: string | null;
  scoreFinalAfterDeadline: boolean;
  /** True once this KPI's value is frozen; see completedPeriod. Leaf-only. */
  completed: boolean;
  /** "YYYY-MM" the KPI was marked complete in — the period whose figure gets frozen and carried forward. Required when completed is true. */
  completedPeriod: string | null;
  metric: MetricInput;
  /** Confirms clearing figures that would otherwise block a numeric <-> month-completion change. */
  clearFiguresForMetricChange?: boolean;
  frequency: Frequency;
  phasing: Phasing;
  /** CUSTOM only: 12 monthly shares (0-100). */
  phaseConfig: number[] | null;
};

export type AuditEntry = { field: string; label: string; from: string; to: string };

function describeMetric(metricType: string | null, targetMode: string | null, direction: string | null, targetConfig: string | null): string {
  if (!metricType) return "no metric (rollup)";
  const config = parseTargetConfig(targetConfig);
  if (metricType === "MONTH_COMPLETION") {
    return `month completion, target ${(config as { targetMonth?: string } | null)?.targetMonth ?? "—"}`;
  }
  const bands = BANDS.map((b) => {
    const v = (config as Record<Band, unknown> | null)?.[b];
    if (Array.isArray(v)) return v[0] === v[1] ? String(v[0]) : `${v[0]}-${v[1]}`;
    return String(v ?? "—");
  }).join(", ");
  return `${metricType} ${targetMode ?? ""} ${direction ?? ""}: ${bands}`;
}

export type PreparedKpiSettings = {
  existing: NonNullable<Awaited<ReturnType<typeof loadExistingKpi>>>;
  isLeaf: boolean;
  name: string;
  code: string;
  nextColumns: ReturnType<typeof metricColumns>;
  phasing: Phasing;
  phaseConfig: string | null;
  clearedValueCount: number;
  audits: AuditEntry[];
};

function loadExistingKpi(kpiId: string) {
  return prisma.kpi.findUnique({
    where: { id: kpiId },
    include: {
      _count: { select: { children: true, values: true } },
      values: { select: { period: true, value: true, completionDate: true, basis: true } },
      departments: true,
      fiscalYear: { select: { closedAt: true, label: true } },
    },
  });
}

/**
 * Validates a settings change and computes its audit-trail diff, without
 * writing anything. Shared by the admin direct-save path, the member
 * propose path (which needs the diff for the approvals queue), and proposal
 * approval (which re-validates against the KPI's current state).
 */
export async function prepareKpiSettings(input: SaveKpiSettingsInput): Promise<PreparedKpiSettings> {
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
  if (input.completedPeriod && !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.completedPeriod)) {
    throw new Error("A completion period must be a month in YYYY-MM form.");
  }
  if (input.completed && !input.completedPeriod) {
    throw new Error("Marking a KPI complete needs the period it was completed in.");
  }

  const existing = await loadExistingKpi(input.kpiId);
  if (!existing) throw new Error("That KPI no longer exists.");
  assertFiscalYearOpen(existing.fiscalYear);
  const isLeaf = existing._count.children === 0;

  if (input.completed && !isLeaf) {
    throw new Error("Only a leaf KPI (one with no sub-KPIs) can be marked complete.");
  }
  if (
    input.completed &&
    existing.metricType !== "MONTH_COMPLETION" &&
    !existing.values.some(
      (v) => v.basis === "ACTUAL" && v.value !== null && v.period <= input.completedPeriod!
    )
  ) {
    throw new Error(
      "This KPI has no actual figure on record yet to freeze — report one first, then mark it complete."
    );
  }

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

  // Phasing only means anything for a phase-able cumulative numeric target;
  // forced off server-side so a stale form can't leave it set on a milestone
  // or on a VARIANCE KPI (whose bands are a % window, not an annual total to
  // pro-rate — scaling "10-15%" mid-year would be meaningless).
  const phasing: Phasing =
    nextColumns.metricType && nextColumns.metricType !== "MONTH_COMPLETION" && nextColumns.metricType !== "VARIANCE"
      ? input.phasing
      : "NONE";
  if (phasing === "CUSTOM") {
    const problem = phaseConfigProblem(input.phaseConfig);
    if (problem) throw new Error(problem);
  }
  const phaseConfig = phasing === "CUSTOM" ? JSON.stringify(input.phaseConfig) : null;

  const audits: AuditEntry[] = [];
  const push = (field: string, label: string, from: string, to: string) => {
    if (from !== to) audits.push({ field, label, from, to });
  };
  push("name", "Name", existing.name, name);
  push("code", "Code", existing.code, code);
  push("weight", "Weight % (of group)", `${existing.weight}`, `${input.weight}`);
  push("subGroup", "Sub-group", existing.subGroup ?? "none", input.subGroup?.trim() || "none");
  push("status", "Status", existing.status ?? "none", input.status?.trim() || "none");
  push("unit", "Unit", existing.unit ?? "empty", input.unit?.trim() || "empty");
  push(
    "deadlineMonth",
    "Deadline month",
    existing.deadlineMonth ? formatPeriodLabel(existing.deadlineMonth) : "none",
    input.deadlineMonth ? formatPeriodLabel(input.deadlineMonth) : "none"
  );
  push(
    "completed",
    "Mark complete",
    existing.completed ? `complete as of ${formatPeriodLabel(existing.completedPeriod!)}` : "not complete",
    input.completed ? `complete as of ${formatPeriodLabel(input.completedPeriod!)}` : "not complete"
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
  const departmentNameById = new Map((await listDepartments()).map((d) => [d.id, d.name]));
  const nameOf = (id: string) => departmentNameById.get(id) ?? id;
  const beforeDepts = existing.departments.map((d) => nameOf(d.departmentId)).sort().join(", ");
  const afterDepts = input.departmentIds.map(nameOf).sort().join(", ");
  push("departments", "Owning departments", beforeDepts || "none", afterDepts || "none");

  return { existing, isLeaf, name, code, nextColumns, phasing, phaseConfig, clearedValueCount, audits };
}

/** Actually writes a prepared settings change, attributing the audit trail to `authorUsername`. */
export async function commitKpiSettings(
  input: SaveKpiSettingsInput,
  prepared: PreparedKpiSettings,
  authorUsername: string
): Promise<void> {
  const { name, code, nextColumns, phasing, phaseConfig, clearedValueCount, audits } = prepared;

  await prisma.$transaction(async (tx) => {
    await tx.kpi.update({
      where: { id: input.kpiId },
      data: {
        name,
        code,
        weight: input.weight,
        subGroup: input.subGroup?.trim() || null,
        status: input.status?.trim() || null,
        unit: input.unit?.trim() || null,
        deadlineMonth: input.deadlineMonth,
        scoreFinalAfterDeadline: input.scoreFinalAfterDeadline,
        completed: input.completed,
        completedPeriod: input.completed ? input.completedPeriod : null,
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

    // Saved for reuse: the next KPI's Status field suggests it too.
    const status = input.status?.trim();
    if (status) {
      await tx.kpiStatusOption.upsert({
        where: { name: status },
        create: { name: status },
        update: {},
      });
    }

    if (audits.length > 0) {
      await tx.kpiAudit.createMany({
        data: audits.map((a) => ({
          kpiId: input.kpiId,
          field: a.field,
          label: a.label,
          from: a.from,
          to: a.to,
          author: authorUsername,
        })),
      });
    }
  });

  revalidatePath("/");
  revalidatePath("/kpis");
  revalidatePath("/manage");
  revalidatePath("/manage/hierarchy");
  revalidatePath("/manage/approvals");
  revalidatePath(`/kpi/${input.kpiId}`);
}
