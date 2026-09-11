import { listDepartments } from "@/lib/data";
import { isAuthenticated } from "@/lib/session";
import { buildExampleWorkbook, buildTemplateWorkbook } from "@/lib/workbook";

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** The blank import template, or the same file with a worked example in it. */
export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return new Response("Not signed in.", { status: 401 });
  }

  const wantsExample = new URL(request.url).searchParams.get("example") === "1";

  const bytes = wantsExample
    ? await buildExampleWorkbook()
    : await buildTemplateWorkbook((await listDepartments()).map((d) => d.name));

  const filename = wantsExample ? "kpi-import-example.xlsx" : "kpi-import-template.xlsx";

  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
