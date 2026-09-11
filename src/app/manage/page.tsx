import { ManageClient } from "./ManageClient";
import { getActiveFiscalYear, listDepartments, listFiscalYears } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { requireAuthPage } from "@/lib/session";

export const metadata = { title: "Manage — KPI Scorecard" };
export const dynamic = "force-dynamic";

export default async function ManagePage() {
  await requireAuthPage();

  const [fiscalYears, departments, active] = await Promise.all([
    listFiscalYears(),
    listDepartments(),
    getActiveFiscalYear(),
  ]);

  const counts = await prisma.kpi.groupBy({
    by: ["fiscalYearId"],
    _count: { _all: true },
  });
  const kpiCount = new Map(counts.map((c) => [c.fiscalYearId, c._count._all]));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Manage</h1>
        <p className="mt-0.5 text-sm text-gray-600">
          Fiscal years and the department list. KPIs themselves are edited on
          their own pages, or imported from a spreadsheet.
        </p>
      </div>

      <ManageClient
        fiscalYears={fiscalYears.map((fy) => ({
          id: fy.id,
          startYear: fy.startYear,
          label: fy.label,
          isActive: fy.isActive,
          kpiCount: kpiCount.get(fy.id) ?? 0,
        }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        activeId={active?.id ?? null}
      />
    </div>
  );
}
