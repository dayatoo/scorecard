import { getScorecard } from "@/lib/data";
import { isAuthenticated } from "@/lib/session";
import { flattenTree } from "@/lib/kpi-tree";
import { prisma } from "@/lib/prisma";
import { buildExportWorkbook, type ExportKpi, type ExportUpdate, type ExportValue } from "@/lib/workbook";

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * The scorecard as a workbook: the hierarchy in the same shape the importer
 * reads, plus a Scores sheet for the months on screen. Exporting and
 * re-importing the same file is a no-op, which is what makes it safe to use
 * the export as the editing surface for bulk changes.
 */
export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return new Response("Not signed in.", { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const scorecard = await getScorecard({
    fiscalYearId: params.get("fy") ?? undefined,
    period: params.get("period") ?? undefined,
  });

  if (!scorecard) return new Response("No scorecard to export.", { status: 404 });

  const nodes = flattenTree(scorecard.roots);
  const codeById = new Map(nodes.map((n) => [n.id, n.code]));

  const kpis: ExportKpi[] = nodes.map((node) => ({
    code: node.code,
    name: node.name,
    parentCode: node.parentId ? (codeById.get(node.parentId) ?? null) : null,
    weight: node.weight,
    globalWeight: node.globalWeight,
    departments: node.departments.map((d) => d.name),
    metricType: node.metricType,
    unit: node.unit,
    direction: node.direction,
    targetMode: node.targetMode,
    targetConfig: node.targetConfig,
    deadlineMonth: node.deadlineMonth,
    scoreFinalAfterDeadline: node.scoreFinalAfterDeadline,
    frequency: node.frequency,
    phasing: node.phasing,
    phaseConfig: node.phaseConfig,
    isLeaf: node.isLeaf,
    status: node.status,
  }));

  const [kpiValues, kpiUpdates] = await Promise.all([
    prisma.kpiValue.findMany({ where: { kpi: { fiscalYearId: scorecard.fiscalYear.id } } }),
    prisma.kpiUpdate.findMany({ where: { kpi: { fiscalYearId: scorecard.fiscalYear.id } } }),
  ]);

  const values: ExportValue[] = kpiValues
    .map((v) => {
      const code = codeById.get(v.kpiId);
      if (!code) return null;
      return {
        code,
        period: v.period,
        value: v.value,
        plannedValue: v.plannedValue,
        basis: v.basis,
        completionDate: v.completionDate ? v.completionDate.toISOString().slice(0, 10) : null,
        note: v.note,
      };
    })
    .filter((v): v is ExportValue => v !== null);

  const updates: ExportUpdate[] = kpiUpdates
    .map((u) => {
      const code = codeById.get(u.kpiId);
      if (!code) return null;
      return {
        id: u.id,
        code,
        period: u.period,
        mode: u.mode,
        body: u.body,
        author: u.author,
        currentProgress: u.currentProgress,
        nextProgress: u.nextProgress,
        timeCost: u.timeCost,
        issues: u.issues,
        createdAt: u.createdAt,
      };
    })
    .filter((u): u is ExportUpdate => u !== null);

  const bytes = await buildExportWorkbook({
    fiscalYearLabel: scorecard.fiscalYear.label,
    kpis,
    departments: scorecard.departments.map((d) => d.name),
    periods: scorecard.periods,
    tree: scorecard.roots,
    totalsByPeriod: new Map(
      [...scorecard.totalsByPeriod].map(([period, total]) => [
        period,
        { score: total.score, coverage: total.coverage },
      ])
    ),
    scoresByPeriod: scorecard.scoresByPeriod,
    values,
    updates,
  });

  const filename = `kpi-scorecard-${scorecard.fiscalYear.label.replace(/\//g, "-")}-${scorecard.period}.xlsx`;

  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
