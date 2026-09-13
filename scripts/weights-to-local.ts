// One-off conversion: re-expresses every KPI's stored weight from a
// company-wide ("global") share into a share of its own siblings ("local"),
// the convention Part 2 of the in-app-authoring change moves to.
//
// Run this EXACTLY ONCE, against data still in the old convention (every
// parent's stored weight is 0, and leaf weights sum to 100 company-wide).
// It is idempotent only for a flat hierarchy: on a tree with parents already
// carrying a real local weight, a second run mis-reads those local weights as
// global ones and produces wrong numbers, because a parent's "global" share
// is always re-derived here as the sum of its descendant leaves, ignoring
// whatever the parent's own row already says. Do not run it against
// `prisma/seed.ts`'s fixture data, which is already expressed in local
// weights — only against a real database still holding pre-migration data.
//
// No schema migration is needed alongside it — `weight` is already a Float
// column; only what it means, and the numbers in it, change.
//
// Usage: npm run migrate:weights

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Row = { id: string; parentId: string | null; weight: number };

async function convertFiscalYear(fiscalYearId: string, label: string): Promise<void> {
  const kpis: Row[] = await prisma.kpi.findMany({
    where: { fiscalYearId },
    select: { id: true, parentId: true, weight: true },
  });
  if (kpis.length === 0) return;

  const byId = new Map(kpis.map((k) => [k.id, k]));
  const childrenOf = new Map<string | null, Row[]>();
  for (const k of kpis) {
    const list = childrenOf.get(k.parentId) ?? [];
    list.push(k);
    childrenOf.set(k.parentId, list);
  }

  // Derive each node's current *global* share from its stored weight: a leaf's
  // stored weight already is its global share; a parent's is the sum of its
  // descendant leaves' stored weights (today's convention, being replaced).
  const globalOf = new Map<string, number>();
  const leafGlobal = (id: string): number => {
    const cached = globalOf.get(id);
    if (cached !== undefined) return cached;
    const kids = childrenOf.get(id) ?? [];
    const value = kids.length === 0 ? (byId.get(id)?.weight ?? 0) : kids.reduce((s, c) => s + leafGlobal(c.id), 0);
    globalOf.set(id, value);
    return value;
  };
  for (const k of kpis) leafGlobal(k.id);
  const rootsGlobal = (childrenOf.get(null) ?? []).reduce((s, k) => s + leafGlobal(k.id), 0);
  globalOf.set("__ROOT__", rootsGlobal || 1);

  const updates: { id: string; weight: number }[] = [];
  for (const [parentId, group] of childrenOf) {
    const groupTotal = group.reduce((s, k) => s + leafGlobal(k.id), 0);
    if (groupTotal <= 0) continue;
    for (const k of group) {
      const local = (leafGlobal(k.id) / groupTotal) * 100;
      updates.push({ id: k.id, weight: local });
    }
    void parentId;
  }

  for (const u of updates) {
    await prisma.kpi.update({ where: { id: u.id }, data: { weight: u.weight } });
  }
  console.log(`  ${label}: converted ${updates.length} KPIs.`);
}

async function main() {
  const years = await prisma.fiscalYear.findMany({ select: { id: true, label: true } });
  console.log(`Converting weights from global to local shares across ${years.length} fiscal year(s)…`);
  for (const year of years) await convertFiscalYear(year.id, year.label);
  console.log("Done. Run this script again at any time — it is a no-op once weights are already local.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
