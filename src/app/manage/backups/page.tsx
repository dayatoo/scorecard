import Link from "next/link";

import { BackupsClient } from "./BackupsClient";
import { getActiveFiscalYear, listFiscalYears } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";

export const metadata = { title: "Checkpoints — KPI Scorecard" };
export const dynamic = "force-dynamic";

export default async function BackupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const requestedId = typeof query.fy === "string" ? query.fy : undefined;

  const [, fiscalYears, activeYear] = await Promise.all([
    requireAdminPage(),
    listFiscalYears(),
    getActiveFiscalYear(),
  ]);
  const selectedId = requestedId ?? activeYear?.id ?? fiscalYears[0]?.id ?? null;

  const checkpoints = selectedId
    ? await prisma.fiscalYearCheckpoint.findMany({
        where: { fiscalYearId: selectedId },
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { username: true } } },
      })
    : [];

  const selected = fiscalYears.find((fy) => fy.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Checkpoints</h1>
          <p className="mt-0.5 max-w-prose text-sm text-gray-600">
            A checkpoint is a complete copy of one year&rsquo;s scorecard — its
            hierarchy, targets, figures, calibrations and history — saved so it
            can be put back later. Download one to keep a copy outside the app,
            and upload it again to restore from it.
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
        <BackupsClient
          fiscalYears={fiscalYears.map((fy) => ({
            id: fy.id,
            label: fy.label,
            startYear: fy.startYear,
            closedAt: fy.closedAt ? fy.closedAt.toISOString() : null,
          }))}
          selectedFiscalYearId={selected?.id ?? fiscalYears[0].id}
          suggestedStartYear={Math.max(...fiscalYears.map((fy) => fy.startYear)) + 1}
          checkpoints={checkpoints.map((c) => ({
            id: c.id,
            name: c.name,
            automatic: c.automatic,
            kpiCount: c.kpiCount,
            valueCount: c.valueCount,
            createdBy: c.createdBy?.username ?? null,
            createdAt: c.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}
