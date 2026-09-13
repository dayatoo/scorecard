-- AlterTable
ALTER TABLE "FiscalYear" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT;

-- CreateTable
CREATE TABLE "ScoreOverride" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "byId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalYearSnapshot" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalYearSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalYearAudit" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "author" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalYearAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScoreOverride_kpiId_idx" ON "ScoreOverride"("kpiId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreOverride_kpiId_period_key" ON "ScoreOverride"("kpiId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYearSnapshot_fiscalYearId_key" ON "FiscalYearSnapshot"("fiscalYearId");

-- CreateIndex
CREATE INDEX "FiscalYearAudit_fiscalYearId_createdAt_idx" ON "FiscalYearAudit"("fiscalYearId", "createdAt");

-- AddForeignKey
ALTER TABLE "FiscalYear" ADD CONSTRAINT "FiscalYear_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreOverride" ADD CONSTRAINT "ScoreOverride_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreOverride" ADD CONSTRAINT "ScoreOverride_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYearSnapshot" ADD CONSTRAINT "FiscalYearSnapshot_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYearAudit" ADD CONSTRAINT "FiscalYearAudit_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
