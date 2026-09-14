import { ImportClient } from "./ImportClient";
import { getActiveFiscalYear, listFiscalYears } from "@/lib/data";
import { requireAdminPage } from "@/lib/session";

export const metadata = { title: "Import — KPI Scorecard" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [, fiscalYears, active] = await Promise.all([
    requireAdminPage(),
    listFiscalYears(),
    getActiveFiscalYear(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Import KPIs</h1>
        <p className="mt-1 max-w-prose text-sm text-gray-600">
          Build the whole hierarchy in a spreadsheet and upload it. KPIs are
          matched on their <strong>Code</strong>, so re-importing an edited sheet
          updates them in place and keeps the figures already recorded.
        </p>
      </div>

      <div className="rounded-lg border bg-white px-5 py-4">
        <h2 className="text-sm font-semibold">Start from a template</h2>
        <p className="mt-1 text-sm text-gray-600">
          The template carries the right column headings and a Readme sheet
          explaining every field. The example is the same file with a small
          worked scorecard already filled in.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="/api/template"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Download blank template
          </a>
          <a
            href="/api/template?example=1"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Download filled example
          </a>
        </div>
      </div>

      <ImportClient
        fiscalYears={fiscalYears.map((fy) => ({ id: fy.id, label: fy.label }))}
        defaultFiscalYearId={active?.id ?? null}
      />
    </div>
  );
}
