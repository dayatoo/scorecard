// Sample scorecard, useful for trying the app before importing the real one.
// Run with `npm run seed`. Safe to re-run: it replaces the sample fiscal year
// rather than adding a second copy, and touches nothing else.
//
// Weights here are *local* — each KPI's share of its own siblings, not of the
// whole company — matching the convention every group in the app now uses.

import bcrypt from "bcryptjs";
import { PrismaClient, type Prisma } from "@prisma/client";

import { DEFAULT_CURRENCY } from "../src/lib/config";
import { fiscalYearLabel, periodsOfFiscalYear } from "../src/lib/fiscal";

const prisma = new PrismaClient();

const START_YEAR = 2026; // FY2026/27, April 2026 - March 2027

type SeedKpi = {
  code: string;
  name: string;
  parentCode?: string;
  weight?: number;
  departments?: string[];
  metricType?: "PERCENTAGE" | "DOLLAR" | "QUANTITY" | "DAYS" | "MONTH_COMPLETION";
  unit?: string;
  direction?: "HIGHER_BETTER" | "LOWER_BETTER";
  targetMode?: "FIXED" | "RANGE";
  targets?: Record<string, number | [number, number]> | { targetMonth: string };
  deadlineMonth?: string;
  scoreFinalAfterDeadline?: boolean;
  frequency?: "MONTHLY" | "QUARTERLY" | "ANNUAL";
  phasing?: "NONE" | "EVEN" | "CUSTOM";
  phaseConfig?: number[];
  /** Year-to-date figures by period, for a realistic-looking history. */
  values?: Record<string, number | { value: number; basis: "ESTIMATE" }>;
  completedOn?: string;
};

const DEPARTMENTS = ["Finance", "Operations", "IT", "People", "Sales"];

// Two Strategic Goals — one four levels deep, to exercise every level up to
// the five the app now supports — covering every metric type, both deadline
// behaviours, a not-yet-due milestone, a quarterly KPI and a phased one.
// Local weights: every sibling group here (roots included) sums to 100.
const KPIS: SeedKpi[] = [
  { code: "SG1", name: "Grow the business", weight: 50 },

  { code: "SG1.1", name: "Revenue", parentCode: "SG1", weight: 70 },
  {
    code: "SG1.1.1", name: "New customer revenue", parentCode: "SG1.1", weight: 57.14,
    departments: ["Sales"], metricType: "DOLLAR", unit: DEFAULT_CURRENCY,
    direction: "HIGHER_BETTER", targetMode: "FIXED",
    targets: { POOR: 2_000_000, IMPROVEMENT_NEEDED: 2_500_000, MEET: 3_000_000, GOOD: 3_500_000, VERY_GOOD: 4_000_000, EXCELLENT: 4_500_000 },
    values: { "2026-04": 260_000, "2026-05": 610_000, "2026-06": 980_000, "2026-07": 1_380_000, "2026-08": { value: 1_800_000, basis: "ESTIMATE" } },
  },
  {
    code: "SG1.1.2", name: "Existing customer revenue", parentCode: "SG1.1", weight: 42.86,
    departments: ["Sales", "Operations"], metricType: "DOLLAR", unit: DEFAULT_CURRENCY,
    direction: "HIGHER_BETTER", targetMode: "FIXED",
    // Phased evenly: a cumulative measure, so year-to-date is judged against
    // the part of the year that has elapsed rather than the full-year target.
    targets: { POOR: 5_000_000, IMPROVEMENT_NEEDED: 5_500_000, MEET: 6_000_000, GOOD: 6_500_000, VERY_GOOD: 7_000_000, EXCELLENT: 7_500_000 },
    phasing: "EVEN",
    values: { "2026-04": 520_000, "2026-05": 1_060_000, "2026-06": 1_640_000, "2026-07": 2_280_000, "2026-08": 2_910_000 },
  },
  {
    code: "SG1.2", name: "Customer satisfaction", parentCode: "SG1", weight: 30,
    departments: ["Operations"], metricType: "PERCENTAGE", unit: "%",
    direction: "HIGHER_BETTER", targetMode: "RANGE",
    targets: { POOR: [0, 49], IMPROVEMENT_NEEDED: [50, 69], MEET: [70, 79], GOOD: [80, 89], VERY_GOOD: [90, 95], EXCELLENT: [96, 100] },
    values: { "2026-04": 74, "2026-05": 77, "2026-06": 81, "2026-07": 84, "2026-08": 86 },
  },

  { code: "SG2", name: "Operate efficiently", weight: 50 },
  {
    code: "SG2.1", name: "Days to close month-end books", parentCode: "SG2", weight: 30,
    departments: ["Finance"], metricType: "DAYS", unit: "days",
    direction: "LOWER_BETTER", targetMode: "FIXED",
    targets: { POOR: 12, IMPROVEMENT_NEEDED: 11, MEET: 10, GOOD: 9, VERY_GOOD: 8, EXCELLENT: 7 },
    values: { "2026-04": 12, "2026-05": 11, "2026-06": 10, "2026-07": 9, "2026-08": 8 },
  },
  {
    code: "SG2.2", name: "Complete ERP rollout", parentCode: "SG2", weight: 20,
    departments: ["IT", "Operations"], metricType: "MONTH_COMPLETION",
    targets: { targetMonth: "2026-10" },
    // Not completed and not yet due as at the sample's reporting month — the
    // fixture for the coverage split between "not yet due" and "not reported".
  },
  {
    code: "SG2.3", name: "Sites migrated to the new platform", parentCode: "SG2", weight: 20,
    departments: ["IT"], metricType: "QUANTITY", unit: "sites",
    direction: "HIGHER_BETTER", targetMode: "FIXED",
    targets: { POOR: 3, IMPROVEMENT_NEEDED: 4, MEET: 5, GOOD: 6, VERY_GOOD: 7, EXCELLENT: 8 },
    // Deadline with partial credit: late progress still counts, capped.
    deadlineMonth: "2026-07",
    values: { "2026-04": 1, "2026-05": 2, "2026-06": 3, "2026-07": 4, "2026-08": 6 },
  },
  {
    code: "SG2.4", name: "Publish the annual report", parentCode: "SG2", weight: 10,
    departments: ["Finance"], metricType: "PERCENTAGE", unit: "% complete",
    direction: "HIGHER_BETTER", targetMode: "FIXED",
    targets: { POOR: 80, IMPROVEMENT_NEEDED: 90, MEET: 100, GOOD: 101, VERY_GOOD: 102, EXCELLENT: 103 },
    // Deadline that freezes: nothing after the date can change the score.
    deadlineMonth: "2026-06",
    scoreFinalAfterDeadline: true,
    // Annual frequency: only due in March, so it never reads as "missing" the
    // rest of the year.
    frequency: "ANNUAL",
    values: { "2026-04": 40, "2026-05": 75, "2026-06": 95, "2026-07": 100, "2026-08": 100 },
  },
  {
    code: "SG2.5", name: "Voluntary staff turnover", parentCode: "SG2", weight: 20,
    departments: ["People"], metricType: "PERCENTAGE", unit: "%",
    direction: "LOWER_BETTER", targetMode: "RANGE",
    targets: { POOR: [20, 100], IMPROVEMENT_NEEDED: [16, 19.9], MEET: [12, 15.9], GOOD: [9, 11.9], VERY_GOOD: [6, 8.9], EXCELLENT: [0, 5.9] },
    // Quarterly frequency: reported Jun/Sep/Dec/Mar, not every month.
    frequency: "QUARTERLY",
    values: { "2026-06": 13.2, "2026-08": { value: 12.5, basis: "ESTIMATE" } },
  },

  // A five-level branch: SG2 -> SG2.6 -> SG2.6.1 -> SG2.6.1.1 -> SG2.6.1.1.1,
  // exercising the deepest level the app supports and a custom-phased target.
  {
    code: "SG2.6", name: "Modernise field operations", parentCode: "SG2", weight: 0,
    // Weight is 0 here deliberately: adding this branch after the numbers
    // above were set means SG2's group no longer sums to 100 — left as-is so
    // the seed also demonstrates the "add up to X%, not 100%" warning.
  },
  { code: "SG2.6.1", name: "Fleet modernisation", parentCode: "SG2.6", weight: 100 },
  { code: "SG2.6.1.1", name: "Depot rollout", parentCode: "SG2.6.1", weight: 100 },
  {
    code: "SG2.6.1.1.1", name: "Depots converted", parentCode: "SG2.6.1.1", weight: 100,
    departments: ["Operations"], metricType: "QUANTITY", unit: "depots",
    direction: "HIGHER_BETTER", targetMode: "FIXED",
    targets: { POOR: 2, IMPROVEMENT_NEEDED: 3, MEET: 4, GOOD: 5, VERY_GOOD: 6, EXCELLENT: 7 },
    phasing: "CUSTOM",
    phaseConfig: [5, 5, 10, 10, 10, 10, 10, 10, 10, 10, 5, 5],
    values: { "2026-08": 2 },
  },
];

async function main() {
  console.log(`Seeding ${fiscalYearLabel(START_YEAR)}…`);

  for (const name of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  const departmentIdByName = new Map(
    (await prisma.department.findMany()).map((d) => [d.name, d.id])
  );

  // Two sample accounts, so the department-scoped and admin paths are both
  // exercisable right after seeding: an admin (any department), and a
  // Finance member to try the propose-then-approve flow against SG2.1/SG2.4.
  const SEED_PASSWORD = "password123";
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash,
      companyIdNumber: "EMP-0001",
      departmentId: departmentIdByName.get("Finance") as string,
      role: "ADMIN",
      status: "APPROVED",
    },
  });
  await prisma.user.upsert({
    where: { username: "finance.member" },
    update: {},
    create: {
      username: "finance.member",
      passwordHash,
      companyIdNumber: "EMP-0002",
      departmentId: departmentIdByName.get("Finance") as string,
      role: "MEMBER",
      status: "APPROVED",
    },
  });

  // Replace rather than duplicate, so re-seeding is idempotent.
  await prisma.fiscalYear.deleteMany({ where: { startYear: START_YEAR } });
  const fiscalYear = await prisma.fiscalYear.create({
    data: {
      startYear: START_YEAR,
      label: fiscalYearLabel(START_YEAR),
      isActive: true,
    },
  });
  await prisma.fiscalYear.updateMany({
    where: { id: { not: fiscalYear.id } },
    data: { isActive: false },
  });

  const idByCode = new Map<string, string>();

  for (const [index, kpi] of KPIS.entries()) {
    const created = await prisma.kpi.create({
      data: {
        fiscalYearId: fiscalYear.id,
        code: kpi.code,
        name: kpi.name,
        sortOrder: index,
        weight: kpi.weight ?? 0,
        frequency: kpi.frequency ?? "MONTHLY",
        phasing: kpi.phasing ?? "NONE",
        phaseConfig: kpi.phaseConfig ? JSON.stringify(kpi.phaseConfig) : null,
        metricType: kpi.metricType ?? null,
        direction: kpi.direction ?? null,
        targetMode: kpi.targetMode ?? null,
        targetConfig: kpi.targets ? JSON.stringify(kpi.targets) : null,
        unit: kpi.unit ?? null,
        deadlineMonth: kpi.deadlineMonth ?? null,
        scoreFinalAfterDeadline: kpi.scoreFinalAfterDeadline ?? false,
        departments: {
          createMany: {
            data: (kpi.departments ?? [])
              .map((name) => departmentIdByName.get(name))
              .filter(Boolean)
              .map((departmentId) => ({ departmentId: departmentId as string })),
          },
        },
      },
    });
    idByCode.set(kpi.code, created.id);

    if (kpi.parentCode) {
      await prisma.kpi.update({
        where: { id: created.id },
        data: { parentId: idByCode.get(kpi.parentCode) },
      });
    }

    const values: Prisma.KpiValueCreateManyInput[] = [];
    for (const [period, raw] of Object.entries(kpi.values ?? {})) {
      const entry = typeof raw === "number" ? { value: raw, basis: "ACTUAL" as const } : raw;
      values.push({
        kpiId: created.id,
        period,
        value: entry.value,
        basis: entry.basis,
      });
    }
    if (kpi.completedOn) {
      values.push({
        kpiId: created.id,
        period: kpi.completedOn.slice(0, 7),
        completionDate: new Date(kpi.completedOn),
      });
    }
    if (values.length > 0) await prisma.kpiValue.createMany({ data: values });
  }

  await prisma.kpiUpdate.create({
    data: {
      kpiId: idByCode.get("SG2.2") as string,
      period: "2026-08",
      author: "Sample data",
      body:
        "Vendor contract signed; configuration is underway. Still tracking to the " +
        "October target, though data migration is the main risk.",
    },
  });

  console.log(
    `Seeded ${KPIS.length} KPIs across ${periodsOfFiscalYear(START_YEAR).length} months, ` +
      "five levels deep, with local weights, a quarterly KPI, an annual KPI, " +
      "and phased (even and custom) targets."
  );
  console.log(
    `Seeded two accounts — username "admin" (admin) and "finance.member" ` +
      `(Finance member), both with password "${SEED_PASSWORD}".`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
