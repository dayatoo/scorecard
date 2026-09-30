// Purging fiscal years whose 30-day holding period has run out.
//
// Lives outside the "use server" action files so it can't be called as an
// endpoint: it does no authentication of its own, and is only ever run by
// the admin pages that list held years, after they've checked the viewer.

import "server-only";

import { prisma } from "./prisma";

/**
 * Hard-deletes every fiscal year whose holding period has expired. There's no
 * cron/job runner anywhere in this app, so this is called lazily at the top
 * of the admin pages that list held or purged years (/manage/holding and
 * /manage/change-log)
 * rather than on a real schedule — a held year is purged on the next admin
 * page load after its purgeAt passes, not to the minute.
 */
export async function purgeExpiredFiscalYears(): Promise<void> {
  const expired = await prisma.fiscalYear.findMany({
    where: { heldAt: { not: null }, purgeAt: { lte: new Date() } },
    select: { id: true, label: true },
  });

  for (const fiscalYear of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.fiscalYearAudit.create({
        data: {
          fiscalYearId: fiscalYear.id,
          fiscalYearLabel: fiscalYear.label,
          action: "purged",
          author: "system",
        },
      });
      // Cascades to KPIs, their values, updates and every audit trail.
      await tx.fiscalYear.delete({ where: { id: fiscalYear.id } });
    });
  }
}
