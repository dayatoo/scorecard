import Link from "next/link";
import { notFound } from "next/navigation";

import { getGroupWeights } from "@/app/actions/weights";
import { getActiveFiscalYear, listFiscalYears } from "@/lib/data";
import { requireAdminPage } from "@/lib/session";
import { WeightsEditor } from "./WeightsEditor";

export const metadata = { title: "Edit weights — KPI Scorecard" };
export const dynamic = "force-dynamic";

export default async function GroupWeightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ parentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();

  const { parentId: rawParentId } = await params;
  const parentId = rawParentId === "root" ? null : rawParentId;

  const query = await searchParams;
  const requestedId = typeof query.fy === "string" ? query.fy : undefined;

  const [fiscalYears, activeYear] = await Promise.all([listFiscalYears(), getActiveFiscalYear()]);
  const fiscalYearId = requestedId ?? activeYear?.id;
  const selectedFiscalYear = fiscalYears.find((fy) => fy.id === fiscalYearId) ?? null;

  if (!fiscalYearId) notFound();

  const result = await getGroupWeights(fiscalYearId, parentId);
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
          {result.error}
        </p>
        <Link href="/manage/hierarchy/weights" className="text-sm text-blue-700 hover:underline">
          Back to Weights
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Edit weights</h1>
          <p className="mt-0.5 text-sm text-gray-600">
            {result.data.parentLabel === "Strategic Goals"
              ? "Every Strategic Goal, weighed against each other."
              : `Every direct sub-KPI of "${result.data.parentLabel}", weighed against each other.`}
          </p>
        </div>
        <Link href="/manage/hierarchy/weights" className="text-sm text-blue-700 hover:underline">
          Back to Weights
        </Link>
      </div>

      <WeightsEditor
        fiscalYearId={fiscalYearId}
        parentId={parentId}
        parentLabel={result.data.parentLabel}
        childKpis={result.data.children}
        fiscalYearClosed={!!selectedFiscalYear?.closedAt}
      />
    </div>
  );
}
