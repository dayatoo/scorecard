// Prints the seeded scorecard to the console, so the scoring rules can be
// eyeballed against real database rows. Run with: npx tsx scripts/check-scorecard.ts
//
// Loads records directly rather than through src/lib/data.ts, which is marked
// server-only and refuses to run outside Next.

import { PrismaClient } from "@prisma/client";

import { buildScoredTree, flattenTree, type KpiRecord } from "../src/lib/kpi-tree";
import { trailingPeriods } from "../src/lib/fiscal";

const prisma = new PrismaClient();
const PERIOD = process.argv[2] ?? "2026-08";

async function main() {
  const rows = await prisma.kpi.findMany({
    orderBy: [{ sortOrder: "asc" }],
    include: { departments: { include: { department: true } } },
  });
  const values = await prisma.kpiValue.findMany();

  const kpis: KpiRecord[] = rows.map((row) => ({
    ...row,
    departments: row.departments.map((d) => ({ id: d.department.id, name: d.department.name })),
  }));

  const { roots, total } = buildScoredTree(kpis, values, PERIOD);

  console.log(`Reporting ${PERIOD}\n`);
  for (const node of flattenTree(roots)) {
    const score = node.score === null ? "  —  " : node.score.toFixed(1).padStart(5);
    const flags = [
      node.provisional ? "est" : "",
      node.leaf?.pendingReason ?? "",
      node.leaf?.deadline?.monthsLate
        ? `${node.leaf.deadline.monthsLate}m late (raw ${node.leaf.deadline.rawScore}, ${
            node.leaf.deadline.frozen ? "frozen" : `cap ${node.leaf.deadline.cap}`
          })`
        : "",
    ].filter(Boolean).join(" ");
    console.log(
      `${score} ${node.weight.toFixed(1).padStart(5)}%  ${"  ".repeat(node.level - 1)}${node.code} ${node.name}  ${flags}`
    );
  }

  console.log(`\nTOTAL ${total.score} (${total.band})`);
  console.log(
    `Coverage ${(total.coverage * 100).toFixed(1)}% of ${total.totalWeight}% total weight, of which ${(total.provisionalShare * 100).toFixed(1)}% rests on estimates`
  );

  console.log("\nTrailing window:");
  for (const p of trailingPeriods(PERIOD)) {
    const snapshot = buildScoredTree(kpis, values, p);
    console.log(
      `  ${p}: ${snapshot.total.score ?? "—"}  (coverage ${(snapshot.total.coverage * 100).toFixed(0)}%)`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
