// Sample scorecard, useful for trying the app before importing the real one.
// Run with `npm run seed`. Safe to re-run: it replaces the sample fiscal year
// rather than adding a second copy, and touches nothing else.

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
  /** Year-to-date figures by period, for a realistic-looking history. */
  values?: Record<string, number | { value: number; basis: "ESTIMATE" }>;
  completedOn?: string;
};

const DEPARTMENTS = ["Finance", "Operations", "IT", "People", "Sales"];

// Two Strategic Goals, one of them three levels deep, covering every metric
// type and both deadline behaviours. Leaf weights sum to 100.
const KPIS: SeedKpi[] = [
  { code: "SG1", name: "Grow the business" },

  { code: "SG1.1", name: "Revenue", parentCode: "SG1" },
  {
    code: "SG1.1.1", name: "New customer revenue", parentCode: "SG1.1", weight: 20,
    departments: ["Sales"], metricType: "DOLLAR", unit: DEFAULT_CURRENCY,
    direction: "HIGHER_BETTER", targetMode: "FIXED",
    targets: { POOR: 2_000_000, IMPROVEMENT_NEEDED: 2_500_000, MEET: 3_000_000, GOOD: 3_500_000, VERY_GOOD: 4_000_000, EXCELLENT: 4_500_000 },
    values: { "2026-04": 260_000, "2026-05": 610_000, "2026-06": 980_000, "2026-07": 1_380_000, "2026-08": { value: 1_800_000, basis: "ESTIMATE" } },
  },
  {
    code: "SG1.1.2", name: "Existing customer revenue", parentCode: "SG1.1", weight: 15,
    departments: ["Sales", "Operations"], metricType: "DOLLAR", unit: DEFAULT_CURRENCY,
    direction: "HIGHER_BETTER", targetMode: "FIXED",
    targets: { POOR: 5_000_000, IMPROVEMENT_NEEDED: 5_500_000, MEET: 6_000_000, GOOD: 6_500_000, VERY_GOOD: 7_000_000, EXCELLENT: 7_500_000 },
    values: { "2026-04": 520_000, "2026-05": 1_060_000, "2026-06": 1_640_000, "2026-07": 2_280_000, "2026-08": 2_910_000 },
  },
  {
    code: "SG1.2", name: "Customer satisfaction", parentCode: "SG1", weight: 15,
    departments: ["Operations"], metricType: "PERCENTAGE", unit: "%",
    direction: "HIGHER_BETTER", targetMode: "RANGE",
    targets: { POOR: [0, 49], IMPROVEMENT_NEEDED: [50, 69], MEET: [70, 79], GOOD: [80, 89], VERY_GOOD: [90, 95], EXCELLENT: [96, 100] },
    values: { "2026-04": 74, "2026-05": 77, "2026-06": 81, "2026-07": 84, "2026-08": 86 },
  },

  { code: "SG2", name: "Operate efficiently" },
  {
    code: "SG2.1", name: "Days to close month-end books", parentCode: "SG2", weight: 15,
    departments: ["Finance"], metricType: "DAYS", unit: "days",
    direction: "LOWER_BETTER", targetMode: "FIXED",
    targets: { POOR: 12, IMPROVEMENT_NEEDED: 11, MEET: 10, GOOD: 9, VERY_GOOD: 8, EXCELLENT: 7 },
    values: { "2026-04": 12, "2026-05": 11, "2026-06": 10, "2026-07": 9, "2026-08": 8 },
  },
  {
    code: "SG2.2", name: "Complete ERP rollout", parentCode: "SG2", weight: 10,
    departments: ["IT", "Operations"], metricType: "MONTH_COMPLETION",
    targets: { targetMonth: "2026-10" },
  },
  {
    code: "SG2.3", name: "Sites migrated to the new platform", parentCode: "SG2", weight: 10,
    departments: ["IT"], metricType: "QUANTITY", unit: "sites",
    direction: "HIGHER_BETTER", targetMode: "FIXED",
    targets: { POOR: 3, IMPROVEMENT_NEEDED: 4, MEET: 5, GOOD: 6, VERY_GOOD: 7, EXCELLENT: 8 },
    // Deadline with partial credit: late progress still counts, capped.
    deadlineMonth: "2026-07",
    values: { "2026-04": 1, "2026-05": 2, "2026-06": 3, "2026-07": 4, "2026-08": 6 },
  },
  {
    code: "SG2.4", name: "Publish the annual report", parentCode: "SG2", weight: 5,
    departments: ["Finance"], metricType: "PERCENTAGE", unit: "% complete",
    direction: "HIGHER_BETTER", targetMode: "FIXED",
    targets: { POOR: 80, IMPROVEMENT_NEEDED: 90, MEET: 100, GOOD: 101, VERY_GOOD: 102, EXCELLENT: 103 },
    // Deadline that freezes: nothing after the date can change the score.
    deadlineMonth: "2026-06",
    scoreFinalAfterDeadline: true,
    values: { "2026-04": 40, "2026-05": 75, "2026-06": 95, "2026-07": 100, "2026-08": 100 },
  },
  {
    code: "SG2.5", name: "Voluntary staff turnover", parentCode: "SG2", weight: 10,
    departments: ["People"], metricType: "PERCENTAGE", unit: "%",
    direction: "LOWER_BETTER", targetMode: "RANGE",
    targets: { POOR: [20, 100], IMPROVEMENT_NEEDED: [16, 19.9], MEET: [12, 15.9], GOOD: [9, 11.9], VERY_GOOD: [6, 8.9], EXCELLENT: [0, 5.9] },
    values: { "2026-04": 14, "2026-05": 13.2, "2026-06": 12.5, "2026-07": 11, "2026-08": 10.4 },
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

  const leafWeight = KPIS.reduce((sum, k) => sum + (k.weight ?? 0), 0);
  console.log(
    `Seeded ${KPIS.length} KPIs across ${periodsOfFiscalYear(START_YEAR).length} months ` +
      `(leaf weights total ${leafWeight}%).`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
