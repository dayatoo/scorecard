import Link from "next/link";

import { listWeightGroups } from "@/app/actions/weights";
import { getActiveFiscalYear, listFiscalYears } from "@/lib/data";
import { requireAdminPage } from "@/lib/session";

export const metadata = { title: "Weights — KPI Scorecard" };
export const dynamic = "force-dynamic";

export default async function WeightsIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();

  const query = await searchParams;
  const requestedId = typeof query.fy === "string" ? query.fy : undefined;

  const [fiscalYears, activeYear] = await Promise.all([listFiscalYears(), getActiveFiscalYear()]);
  const fiscalYearId = requestedId ?? activeYear?.id;
  const selectedFiscalYear = fiscalYears.find((fy) => fy.id === fiscalYearId) ?? null;

  const result = fiscalYearId
    ? await listWeightGroups(fiscalYearId)
    : { ok: true as const, data: [] };
  const groups = result.ok ? result.data : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Weights</h1>
          <p className="mt-0.5 text-sm text-gray-600">
            Every group of sibling KPIs, and whether its weights add up to 100%. Click a group to
            edit its weights.
          </p>
        </div>
        <Link href="/manage/hierarchy" className="text-sm text-blue-700 hover:underline">
          Back to Hierarchy
        </Link>
      </div>

      {fiscalYears.length > 0 && (
        <form method="get" className="flex items-center gap-2 text-sm">
          <label>
            <span className="mr-2 text-xs font-medium text-gray-700">Fiscal year</span>
            <select
              name="fy"
              className="rounded border border-gray-300 px-2 py-1 text-sm"
              defaultValue={selectedFiscalYear?.id ?? fiscalYears[0].id}
            >
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  {fy.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Go
          </button>
        </form>
      )}

      {!result.ok && <p className="text-sm font-medium text-rose-700">{result.error}</p>}

      {fiscalYears.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Create a fiscal year on the{" "}
          <Link href="/manage" className="font-medium underline">
            Manage
          </Link>{" "}
          page first.
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-500">No groups yet — add some KPIs on the Hierarchy page.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-white">
          {groups.map((group) => {
            const balanced = Math.abs(group.total - 100) <= 0.01;
            return (
              <li key={group.parentId ?? "root"}>
                <Link
                  href={`/manage/hierarchy/weights/${group.parentId ?? "root"}${
                    fiscalYearId ? `?fy=${fiscalYearId}` : ""
                  }`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-gray-50"
                >
                  <div>
                    <span className="font-medium text-gray-900">{group.parentLabel}</span>
                    {group.breadcrumb && (
                      <span className="ml-2 text-xs text-gray-400">{group.breadcrumb}</span>
                    )}
                    <span className="ml-2 text-xs text-gray-500">
                      {group.childCount} KPI{group.childCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className={`font-bold ${balanced ? "text-emerald-700" : "text-rose-700"}`}>
                    {group.total.toFixed(2)}%{!balanced && " - not 100%"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
