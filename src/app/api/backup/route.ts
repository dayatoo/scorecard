import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { serializeFiscalYear } from "@/lib/backup";

/**
 * Downloads a fiscal year as a backup file — either a saved checkpoint,
 * served exactly as it was stored, or the year as it stands right now.
 *
 * Admin-only, unlike the Excel export: a backup is one year's entire
 * contents, history included, in a single file.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in.", { status: 401 });
  if (user.role !== "ADMIN") return new Response("Admins only.", { status: 403 });

  const params = new URL(request.url).searchParams;
  const checkpointId = params.get("checkpoint");
  const fiscalYearId = params.get("fy");

  let json: string;
  let label: string;

  if (checkpointId) {
    const checkpoint = await prisma.fiscalYearCheckpoint.findUnique({
      where: { id: checkpointId },
      include: { fiscalYear: { select: { label: true } } },
    });
    if (!checkpoint) return new Response("No such checkpoint.", { status: 404 });
    json = checkpoint.data;
    label = checkpoint.fiscalYear.label;
  } else if (fiscalYearId) {
    const backup = await serializeFiscalYear(fiscalYearId);
    json = JSON.stringify(backup, null, 2);
    label = backup.fiscalYear.label;
  } else {
    return new Response("Name a fiscal year or a checkpoint to download.", { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const filename = `scorecard-backup-${label.replace(/\//g, "-")}-${today}.json`;

  return new Response(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
