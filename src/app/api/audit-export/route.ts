import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { buildAuditTrailWorkbook } from "@/lib/workbook";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * The full cross-KPI audit trail as a workbook — fiscal-year lifecycle
 * events, every KPI definition change and every KPI value change, across
 * every fiscal year. Admin-only, like a backup: this is the one-stop record
 * the Change log page itself only shows a slice of.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in.", { status: 401 });
  if (user.role !== "ADMIN") return new Response("Admins only.", { status: 403 });

  const [fiscalYearAudits, kpiAudits, kpiValueAudits] = await Promise.all([
    prisma.fiscalYearAudit.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.kpiAudit.findMany({
      orderBy: { createdAt: "desc" },
      include: { kpi: { select: { code: true, name: true, fiscalYear: { select: { label: true } } } } },
    }),
    prisma.kpiValueAudit.findMany({
      orderBy: { createdAt: "desc" },
      include: { kpi: { select: { code: true, name: true, fiscalYear: { select: { label: true } } } } },
    }),
  ]);

  const bytes = await buildAuditTrailWorkbook({
    fiscalYearEvents: fiscalYearAudits.map((a) => ({
      createdAt: a.createdAt,
      fiscalYearLabel: a.fiscalYearLabel,
      action: a.action,
      reason: a.reason,
      author: a.author,
    })),
    kpiDefinitionChanges: kpiAudits.map((a) => ({
      createdAt: a.createdAt,
      fiscalYearLabel: a.kpi.fiscalYear.label,
      kpiCode: a.kpi.code,
      kpiName: a.kpi.name,
      label: a.label,
      from: a.from,
      to: a.to,
      author: a.author,
    })),
    kpiValueChanges: kpiValueAudits.map((a) => ({
      createdAt: a.createdAt,
      fiscalYearLabel: a.kpi.fiscalYear.label,
      kpiCode: a.kpi.code,
      kpiName: a.kpi.name,
      period: a.period,
      field: a.field,
      from: a.from,
      to: a.to,
      author: a.authorUsername,
      companyId: a.authorCompanyId,
    })),
  });

  const today = new Date().toISOString().slice(0, 10);
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="kpi-scorecard-audit-trail-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
