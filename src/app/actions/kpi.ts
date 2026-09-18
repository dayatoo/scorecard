"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth, type CurrentUser } from "@/lib/session";
import { formatPeriodLabel, isPeriodInFiscalYear } from "@/lib/fiscal";
import { formatDate } from "@/lib/dates";
import { listDepartments } from "@/lib/data";
import { parseTargetConfig } from "@/lib/kpi-tree";
import {
  BANDS,
  lastDayOfPeriod,
  type Band,
  type Direction,
  type Frequency,
  type MetricType,
  type Phasing,
  type TargetConfig,
  type TargetMode,
} from "@/lib/scoring";
import {
  crossesNumericMonthBoundary,
  metricColumns,
  validateMetric,
  type MetricInput,
} from "@/lib/targets";
import { assertFiscalYearOpen } from "@/lib/validation";
import { diffKpiValueFields } from "@/lib/kpi-value-audit";
import { attempt, type ActionResult } from "./result";

// Every action re-checks authentication: a server action is a POST endpoint
// that can be called without going through the UI, so the proxy's page-level
// gate is not enough on its own.

export type SaveEntryInput = {
  kpiId: string;
  period: string;
  value: number | null;
  /** VARIANCE metrics only — the period's target/budget figure. */
  plannedValue: number | null;
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
    select: { fiscalYear: { select: { startYear: true, closedAt: true, label: true } } },
  });
  if (!kpi) throw new Error("That KPI no longer exists.");
  if (!isPeriodInFiscalYear(period, kpi.fiscalYear.startYear)) {
    throw new Error(`${period} is outside the fiscal year this KPI belongs to.`);
  }
  assertFiscalYearOpen(kpi.fiscalYear);
}

/** Throws unless the user is an admin or their department owns this KPI. */
async function assertOwnsKpi(user: CurrentUser, kpiId: string): Promise<void> {
  if (user.role === "ADMIN") return;
  const owns = await prisma.kpiDepartment.findFirst({
    where: { kpiId, departmentId: user.departmentId },
  });
  if (!owns) {
    throw new Error("You can only report figures for your own department's KPIs.");
  }
}

/** Writes one month's figure. Called only after the user confirms a save. */
export async function saveEntry(input: SaveEntryInput): Promise<ActionResult> {
  return attempt(async () => {
    const user = await requireAuth();
    await writeEntry(user, input);
  });
}

async function writeEntry(user: CurrentUser, input: SaveEntryInput): Promise<void> {
  await assertOwnsKpi(user, input.kpiId);
  await assertPeriodValid(input.kpiId, input.period);

  if (input.value !== null && !Number.isFinite(input.value)) {
    throw new Error("That value is not a number.");
  }
  if (input.plannedValue !== null && !Number.isFinite(input.plannedValue)) {
    throw new Error("That target value is not a number.");
  }

  const completionDate = input.completionDate ? new Date(input.completionDate) : null;
  if (completionDate && Number.isNaN(completionDate.getTime())) {
    throw new Error("That completion date is not a valid date.");
  }
  // Something cannot have been completed after the month being reported on —
  // that would let a future completion score an earlier month. An estimate
  // is a projection rather than a confirmed completion, so it's allowed to
  // point at a month that hasn't happened yet.
  if (completionDate && input.basis !== "ESTIMATE") {
    const endOfPeriod = lastDayOfPeriod(input.period);
    if (completionDate > endOfPeriod) {
      throw new Error(
        `${formatDate(completionDate)} is after ${formatPeriodLabel(input.period)}, the month being reported on. Record it against the month it was completed in.`
      );
    }
  }

  const data = {
    value: input.value,
    plannedValue: input.plannedValue,
    basis: input.basis,
    completionDate,
    note: input.note?.trim() || null,
  };

  await prisma.$transaction(async (tx) => {
    const existing = await tx.kpiValue.findUnique({
      where: { kpiId_period: { kpiId: input.kpiId, period: input.period } },
    });

    const changes = diffKpiValueFields(existing, data);
    if (changes.length > 0) {
      await tx.kpiValueAudit.createMany({
        data: changes.map((c) => ({
          kpiId: input.kpiId,
          period: input.period,
          field: c.field,
          from: c.from,
          to: c.to,
          authorUsername: user.username,
          authorCompanyId: user.companyIdNumber,
        })),
      });
    }

    // Clearing every field removes the entry outright, so the KPI goes back
    // to "not reported" rather than sitting on a hollow row that scores zero.
    if (data.value === null && data.plannedValue === null && data.completionDate === null && data.note === null) {
      await tx.kpiValue.deleteMany({
        where: { kpiId: input.kpiId, period: input.period },
      });
    } else {
      await tx.kpiValue.upsert({
        where: { kpiId_period: { kpiId: input.kpiId, period: input.period } },
        create: { kpiId: input.kpiId, period: input.period, ...data },
        update: data,
      });
    }
  });

  revalidatePath("/");
  revalidatePath("/kpis");
  revalidatePath("/entry");
  revalidatePath("/milestones");
  revalidatePath(`/kpi/${input.kpiId}`);
}

export type SaveEntriesFailure = { kpiId: string; error: string };

/**
 * Bulk version for the data-entry grid — one confirmation, one pass. The
 * ownership check runs per row (inside writeEntry), not just once up front,
 * so one owned row in a batch can never cover an unowned row slipped in
 * alongside it.
 *
 * Each row gets its own try/catch rather than letting the first failure
 * abort the loop: rows are independent writes (own KPI, own transaction),
 * so one bad row shouldn't cost the others their save. `result.ok` stays
 * true even when some rows failed — the failures are returned as data for
 * the caller to report, since that's a normal outcome, not an action-level
 * error (which is reserved for e.g. `requireAuth()` itself throwing).
 */
export async function saveEntries(inputs: SaveEntryInput[]): Promise<ActionResult<SaveEntriesFailure[]>> {
  return attempt(async () => {
    const user = await requireAuth();
    const failures: SaveEntriesFailure[] = [];
    for (const input of inputs) {
      try {
        await writeEntry(user, input);
      } catch (cause) {
        failures.push({
          kpiId: input.kpiId,
          error: cause instanceof Error && cause.message ? cause.message : "Could not save that row.",
        });
      }
    }
    return failures;
  });
}

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

/** Updates a KPI's definition from the detail page. */
export async function saveKpiSettings(input: SaveKpiSettingsInput): Promise<ActionResult> {
  return attempt(async () => {
    const user = await requireAuth();
    const prepared = await prepareKpiSettings(input);

    if (user.role === "ADMIN") {
      await commitKpiSettings(input, prepared, user.username);
      return;
    }

    // A member: propose the change instead of applying it directly.
    if (!prepared.isLeaf) {
      throw new Error(
        "Only an admin can change a KPI with sub-KPIs — ask them to make this change."
      );
    }
    const owns = prepared.existing.departments.some(
      (d) => d.departmentId === user.departmentId
    );
    if (!owns) {
      throw new Error("You can only propose changes to your own department's KPIs.");
    }
    const alreadyPending = await prisma.kpiChangeProposal.findFirst({
      where: { kpiId: input.kpiId, status: "PENDING" },
    });
    if (alreadyPending) {
      throw new Error("A change to this KPI is already awaiting review.");
    }
    if (prepared.audits.length === 0) {
      throw new Error("Nothing changed.");
    }

    await prisma.kpiChangeProposal.create({
      data: {
        kpiId: input.kpiId,
        proposedById: user.id,
        payload: JSON.stringify(input),
        summary: JSON.stringify(prepared.audits),
        baseUpdatedAt: prepared.existing.updatedAt,
      },
    });

    revalidatePath(`/kpi/${input.kpiId}`);
    revalidatePath("/manage/approvals");
  });
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

export type KpiAttributes = {
  code: string;
  name: string;
  subGroup: string | null;
  status: string | null;
  unit: string | null;
  departmentIds: string[];
  deadlineMonth: string | null;
  scoreFinalAfterDeadline: boolean;
  completed: boolean;
  completedPeriod: string | null;
  frequency: Frequency;
  metricType: MetricType | null;
  direction: Direction | null;
  targetMode: TargetMode | null;
  targetConfig: TargetConfig | null;
  phasing: Phasing;
  phaseConfig: string | null;
};

/**
 * Everything the hierarchy page's edit panel needs to seed its form, for one
 * KPI. The page's own node list (`getHierarchyTree` in `src/lib/data.ts`)
 * deliberately carries only structural fields — weight, globalWeight,
 * isLeaf are already known client-side and don't need refetching here.
 */
export async function getKpiAttributes(kpiId: string): Promise<ActionResult<KpiAttributes>> {
  return attempt(async () => {
    await requireAdmin();

    const kpi = await prisma.kpi.findUnique({
      where: { id: kpiId },
      include: { departments: { select: { departmentId: true } } },
    });
    if (!kpi) throw new Error("That KPI no longer exists.");

    return {
      code: kpi.code,
      name: kpi.name,
      subGroup: kpi.subGroup,
      status: kpi.status,
      unit: kpi.unit,
      departmentIds: kpi.departments.map((d) => d.departmentId),
      deadlineMonth: kpi.deadlineMonth,
      scoreFinalAfterDeadline: kpi.scoreFinalAfterDeadline,
      completed: kpi.completed,
      completedPeriod: kpi.completedPeriod,
      frequency: kpi.frequency,
      metricType: kpi.metricType,
      direction: kpi.direction,
      targetMode: kpi.targetMode,
      targetConfig: parseTargetConfig(kpi.targetConfig),
      phasing: kpi.phasing,
      phaseConfig: kpi.phaseConfig,
    };
  });
}

export type SaveToKpiDictionaryInput = {
  name: string;
  unit: string | null;
  metric: MetricInput;
};

/**
 * Saves the current metric definition — name and metric config only, no
 * placement — as a reusable dictionary entry. Re-saving under a name already
 * in use replaces that entry, the same way saving a KPI's Status adds it to
 * the company-wide suggestion list (see `KpiStatusOption`), except here the
 * whole definition is captured, not just a string.
 */
export async function saveToKpiDictionary(input: SaveToKpiDictionaryInput): Promise<ActionResult> {
  return attempt(async () => {
    await requireAdmin();

    const name = input.name.trim();
    if (!name) throw new Error("A dictionary entry needs a name.");

    const columns = metricColumns(validateMetric(input.metric));
    await prisma.kpiDictionaryEntry.upsert({
      where: { name },
      create: { name, unit: input.unit, ...columns },
      update: { unit: input.unit, ...columns },
    });

    revalidatePath("/manage/hierarchy");
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
  const phaseConfig = phasing === "CUSTOM" ? JSON.stringify(input.phaseConfig ?? []) : null;

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

export type AddKpiUpdateInput = { kpiId: string; period: string } & (
  | { mode: "SIMPLE"; body: string }
  | { mode: "DETAILED"; currentProgress: string; nextProgress: string; timeCost: string; issues: string }
);

export async function addKpiUpdate(input: AddKpiUpdateInput): Promise<ActionResult> {
  return attempt(async () => {
    const user = await requireAuth();

    if (input.mode === "SIMPLE") {
      const body = input.body.trim();
      if (!body) throw new Error("Write something before posting an update.");

      await prisma.kpiUpdate.create({
        data: { kpiId: input.kpiId, period: input.period, mode: "SIMPLE", body, author: user.username },
      });
    } else {
      const currentProgress = input.currentProgress.trim();
      const nextProgress = input.nextProgress.trim();
      const timeCost = input.timeCost.trim();
      const issues = input.issues.trim();
      if (!currentProgress && !nextProgress && !timeCost && !issues) {
        throw new Error("Fill in at least one field before posting an update.");
      }

      await prisma.kpiUpdate.create({
        data: {
          kpiId: input.kpiId,
          period: input.period,
          mode: "DETAILED",
          currentProgress: currentProgress || null,
          nextProgress: nextProgress || null,
          timeCost: timeCost || null,
          issues: issues || null,
          author: user.username,
        },
      });
    }

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
