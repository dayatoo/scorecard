-- CreateTable
CREATE TABLE "FiscalYearCheckpoint" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "data" TEXT NOT NULL,
    "kpiCount" INTEGER NOT NULL,
    "valueCount" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalYearCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalYearCheckpoint_fiscalYearId_createdAt_idx" ON "FiscalYearCheckpoint"("fiscalYearId", "createdAt");

-- AddForeignKey
ALTER TABLE "FiscalYearCheckpoint" ADD CONSTRAINT "FiscalYearCheckpoint_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYearCheckpoint" ADD CONSTRAINT "FiscalYearCheckpoint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
