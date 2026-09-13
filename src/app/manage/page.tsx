import Link from "next/link";

import { ManageClient } from "./ManageClient";
import { listDepartments, listFiscalYears } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";

export const metadata = { title: "Manage — KPI Scorecard" };
export const dynamic = "force-dynamic";

export default async function ManagePage() {
  await requireAdminPage();

  const [fiscalYears, departments] = await Promise.all([
    listFiscalYears(),
    listDepartments(),
  ]);

  const counts = await prisma.kpi.groupBy({
    by: ["fiscalYearId"],
    _count: { _all: true },
  });
  const kpiCount = new Map(counts.map((c) => [c.fiscalYearId, c._count._all]));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Manage</h1>
          <p className="mt-0.5 text-sm text-gray-600">
            Fiscal years and the department list. Build structure on the{" "}
            <Link href="/manage/hierarchy" className="text-blue-700 hover:underline">
              Hierarchy
            </Link>{" "}
            page, or import it from a spreadsheet; attributes are edited on each
            KPI&rsquo;s own page.
          </p>
        </div>
        <Link
          href="/manage/hierarchy"
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Open Hierarchy →
        </Link>
      </div>

      <ManageClient
        fiscalYears={fiscalYears.map((fy) => ({
          id: fy.id,
          startYear: fy.startYear,
          label: fy.label,
          isActive: fy.isActive,
          closedAt: fy.closedAt ? fy.closedAt.toISOString() : null,
          kpiCount: kpiCount.get(fy.id) ?? 0,
        }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      />
    </div>
  );
}
