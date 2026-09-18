-- AlterTable
ALTER TABLE "FiscalYear" ADD COLUMN     "heldAt" TIMESTAMP(3),
ADD COLUMN     "heldById" TEXT,
ADD COLUMN     "purgeAt" TIMESTAMP(3);

-- AlterTable: add fiscalYearLabel nullable first so existing rows can be
-- backfilled from their still-intact fiscalYearId, then make it required.
ALTER TABLE "FiscalYearAudit" DROP CONSTRAINT "FiscalYearAudit_fiscalYearId_fkey";
ALTER TABLE "FiscalYearAudit" ADD COLUMN     "fiscalYearLabel" TEXT,
ALTER COLUMN "fiscalYearId" DROP NOT NULL;

UPDATE "FiscalYearAudit" AS a
SET "fiscalYearLabel" = f."label"
FROM "FiscalYear" AS f
WHERE f."id" = a."fiscalYearId" AND a."fiscalYearLabel" IS NULL;

ALTER TABLE "FiscalYearAudit" ALTER COLUMN "fiscalYearLabel" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "FiscalYear" ADD CONSTRAINT "FiscalYear_heldById_fkey" FOREIGN KEY ("heldById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYearAudit" ADD CONSTRAINT "FiscalYearAudit_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
