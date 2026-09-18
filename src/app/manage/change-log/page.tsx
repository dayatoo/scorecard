import Link from "next/link";

import { purgeExpiredFiscalYears } from "@/app/actions/admin";
import { DownloadLink } from "@/components/DownloadLink";
import { formatBruneiTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/session";

export const metadata = { title: "Change log — KPI Scorecard" };
export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  closed: "Closed",
  reopened: "Reopened",
  restored: "Restored from backup",
  held: "Moved to holding",
  restored_from_holding: "Restored from holding",
  purged: "Permanently deleted",
};

export default async function ChangeLogPage() {
  await requireAdminPage();
  await purgeExpiredFiscalYears();

  const events = await prisma.fiscalYearAudit.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Change log</h1>
          <p className="mt-0.5 max-w-prose text-sm text-gray-600">
            Every fiscal year lifecycle event — closed, reopened, moved to
            holding, restored, or permanently deleted. For a KPI&rsquo;s own
            settings and figure changes, see that KPI&rsquo;s detail page.
          </p>
        </div>
        <Link href="/manage" className="text-sm text-blue-700 hover:underline">
          Back to Manage
        </Link>
      </div>

      <div className="rounded-lg border bg-white">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Fiscal year events</h2>
          <DownloadLink
            href="/api/audit-export"
            label="Export full audit trail (Excel)"
            loadingLabel="Preparing…"
            className="text-sm font-medium text-blue-700 hover:underline"
          />
        </div>
        <ul className="divide-y">
          {events.map((e) => (
            <li key={e.id} className="px-5 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-gray-900">
                  {ACTION_LABELS[e.action] ?? e.action} — {e.fiscalYearLabel}
                </span>
                <span className="text-xs text-gray-500">{formatBruneiTime(e.createdAt)}</span>
              </div>
              <div className="mt-0.5 text-xs text-gray-600">
                {e.author}
                {e.reason && ` — ${e.reason}`}
              </div>
            </li>
          ))}
          {events.length === 0 && (
            <li className="px-5 py-4 text-sm text-gray-500">Nothing has happened here yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
