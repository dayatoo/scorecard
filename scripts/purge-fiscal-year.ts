// Hard-deletes a fiscal year by its starting year, holding or not — bypassing
// the 30-day recovery window the app's own delete flow enforces. This is a
// test-cleanup tool, not something exposed anywhere in the app: it exists so
// a scratch fiscal year created during a Playwright run (e.g. FY2029/30 in
// tests/smoke.spec.ts) can be removed outright, since the seed script only
// resets the standard sample year and leaves ad hoc ones behind.
// Run with: npx tsx scripts/purge-fiscal-year.ts <startYear>
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const startYear = Number(process.argv[2]);

async function main() {
  if (!Number.isInteger(startYear)) {
    throw new Error("Usage: npx tsx scripts/purge-fiscal-year.ts <startYear>");
  }
  await prisma.fiscalYear.deleteMany({ where: { startYear } });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
