import Link from "next/link";

import { HoldingClient } from "./HoldingClient";
import { purgeExpiredFiscalYears } from "@/app/actions/admin";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";

export const metadata = { title: "Holding — KPI Scorecard" };
export const dynamic = "force-dynamic";

export default async function HoldingPage() {
  await requireAdminPage();
  await purgeExpiredFiscalYears();

  const heldYears = await prisma.fiscalYear.findMany({
    where: { heldAt: { not: null } },
    orderBy: { heldAt: "desc" },
    include: { heldBy: { select: { username: true } }, kpis: { select: { id: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Holding</h1>
          <p className="mt-0.5 max-w-prose text-sm text-gray-600">
            A deleted fiscal year sits here for 30 days before it is permanently
            removed. It can be restored at any point until then — it cannot be
            cleared out manually, only restored or left to expire.
          </p>
        </div>
        <Link href="/manage" className="text-sm text-blue-700 hover:underline">
          Back to Manage
        </Link>
      </div>

      <HoldingClient
        heldYears={heldYears.map((fy) => ({
          id: fy.id,
          label: fy.label,
          kpiCount: fy.kpis.length,
          heldAt: fy.heldAt!.toISOString(),
          heldBy: fy.heldBy?.username ?? null,
          purgeAt: fy.purgeAt!.toISOString(),
        }))}
      />
    </div>
  );
}
