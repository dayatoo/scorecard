import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";
import { ApprovalsClient } from "./ApprovalsClient";

export const metadata = { title: "Approvals — KPI Scorecard" };
export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const [, proposals] = await Promise.all([
    requireAdminPage(),
    prisma.kpiChangeProposal.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { proposedBy: true, kpi: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Approvals</h1>
        <p className="mt-0.5 text-sm text-gray-600">
          Department members&rsquo; proposed changes to their own KPIs&rsquo; settings,
          waiting on your review.
        </p>
      </div>

      <ApprovalsClient
        proposals={proposals.map((p) => ({
          id: p.id,
          kpiId: p.kpiId,
          kpiName: p.kpi.name,
          kpiCode: p.kpi.code,
          proposedByUsername: p.proposedBy.username,
          createdAt: p.createdAt.toISOString(),
          summary: JSON.parse(p.summary) as {
            field: string; label: string; from: string; to: string;
          }[],
        }))}
      />
    </div>
  );
}
