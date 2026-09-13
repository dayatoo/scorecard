import Link from "next/link";

import { HierarchyEditor } from "./HierarchyEditor";
import { getActiveFiscalYear, getScorecard, listFiscalYears } from "@/lib/data";
import { flattenTree } from "@/lib/kpi-tree";
import { requireAdminPage } from "@/lib/session";

export const metadata = { title: "Hierarchy — KPI Scorecard" };
export const dynamic = "force-dynamic";

export default async function HierarchyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();

  const query = await searchParams;
  const requestedId = typeof query.fy === "string" ? query.fy : undefined;

  const [fiscalYears, activeYear] = await Promise.all([
    listFiscalYears(),
    getActiveFiscalYear(),
  ]);
  const fiscalYearId = requestedId ?? activeYear?.id;

  const scorecard = fiscalYearId ? await getScorecard({ fiscalYearId }) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Hierarchy</h1>
          <p className="mt-0.5 text-sm text-gray-600">
            Add, move, re-order or delete KPIs directly. Attributes — metric type, targets,
            owners — are edited on each KPI&rsquo;s own page.
          </p>
        </div>
        <Link href="/manage" className="text-sm text-blue-700 hover:underline">
          Back to Manage
        </Link>
      </div>

      {fiscalYears.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Create a fiscal year on the{" "}
          <Link href="/manage" className="font-medium underline">Manage</Link> page first.
        </div>
      ) : (
        <HierarchyEditor
          fiscalYears={fiscalYears.map((fy) => ({ id: fy.id, label: fy.label }))}
          selectedFiscalYearId={scorecard?.fiscalYear.id ?? fiscalYears[0].id}
          nodes={
            scorecard
              ? flattenTree(scorecard.roots).map((n) => ({
                  id: n.id,
                  code: n.code,
                  name: n.name,
                  level: n.level,
                  parentId: n.parentId,
                  isLeaf: n.isLeaf,
                  weight: n.weight,
                  globalWeight: n.globalWeight,
                }))
              : []
          }
        />
      )}
    </div>
  );
}
