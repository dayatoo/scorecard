import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function recentPeriods(endPeriod: string, count: number): string[] {
  const [y, m] = endPeriod.split("-").map(Number);
  const periods: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const total = y * 12 + (m - 1) - i;
    const year = Math.floor(total / 12);
    const month = (total % 12) + 1;
    periods.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return periods;
}

function shiftMonth(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

async function main() {
  await prisma.kpiValue.deleteMany();
  await prisma.kpi.deleteMany();

  const periods = recentPeriods(currentPeriod(), 4); // [3-months-ago, 2-months-ago, last-month, current]

  const sg = await prisma.kpi.create({
    data: { name: "Grow Revenue Sustainably", weight: 1, sortOrder: 0 },
  });

  const kpiRevenue = await prisma.kpi.create({
    data: {
      name: "New Revenue Growth",
      parentId: sg.id,
      weight: 2,
      sortOrder: 0,
      metricType: "PERCENTAGE",
      direction: "HIGHER_BETTER",
      targetMode: "FIXED",
      targetConfig: JSON.stringify({
        poorThreshold: 5,
        meetTarget: 10,
        goodThreshold: 12,
        veryGoodThreshold: 15,
        excellentThreshold: 20,
      }),
    },
  });

  const kpiOpsGroup = await prisma.kpi.create({
    data: { name: "Operational Excellence", parentId: sg.id, weight: 1, sortOrder: 1 },
  });

  const kpiCost = await prisma.kpi.create({
    data: {
      name: "Project Cost Overrun",
      parentId: kpiOpsGroup.id,
      weight: 1,
      sortOrder: 0,
      metricType: "DOLLAR",
      direction: "LOWER_BETTER",
      targetMode: "RANGE",
      targetConfig: JSON.stringify({
        poor: [50000, 1000000],
        improvementNeeded: [30000, 49999],
        meet: [10000, 29999],
        good: [5000, 9999],
        veryGood: [1000, 4999],
        excellent: [0, 999],
      }),
    },
  });

  const kpiDefects = await prisma.kpi.create({
    data: {
      name: "Days to Resolve Critical Defects",
      parentId: kpiOpsGroup.id,
      weight: 1,
      sortOrder: 1,
      metricType: "DAYS",
      direction: "LOWER_BETTER",
      targetMode: "FIXED",
      targetConfig: JSON.stringify({
        poorThreshold: 20,
        meetTarget: 10,
        goodThreshold: 8,
        veryGoodThreshold: 5,
        excellentThreshold: 2,
      }),
    },
  });

  const kpiLaunch = await prisma.kpi.create({
    data: {
      name: "New Product Platform Launch",
      parentId: sg.id,
      weight: 1,
      sortOrder: 2,
      metricType: "MONTH_COMPLETION",
      targetConfig: JSON.stringify({ targetMonth: shiftMonth(currentPeriod(), 1) }),
    },
  });

  // Sample monthly values across the last 4 periods.
  const revenueValues = [7, 9, 11, 13]; // %, trending up: Poor-ish -> Meet -> Good
  const costValues = [45000, 28000, 8000, 3000]; // $, trending down (improving)
  const defectValues = [15, 11, 9, 6]; // days, trending down (improving)

  for (let i = 0; i < periods.length; i++) {
    await prisma.kpiValue.create({
      data: { kpiId: kpiRevenue.id, period: periods[i], value: revenueValues[i] },
    });
    await prisma.kpiValue.create({
      data: { kpiId: kpiCost.id, period: periods[i], value: costValues[i] },
    });
    await prisma.kpiValue.create({
      data: { kpiId: kpiDefects.id, period: periods[i], value: defectValues[i] },
    });
  }

  // Completion date entries: only meaningful once known; simulate on-track completion this month.
  await prisma.kpiValue.create({
    data: {
      kpiId: kpiLaunch.id,
      period: currentPeriod(),
      completionDate: new Date(),
    },
  });

  console.log("Seeded KPI tree:", { sg: sg.id, kpiRevenue: kpiRevenue.id, kpiCost: kpiCost.id, kpiDefects: kpiDefects.id, kpiLaunch: kpiLaunch.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
