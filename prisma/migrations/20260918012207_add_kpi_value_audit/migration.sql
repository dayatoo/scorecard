-- CreateTable
CREATE TABLE "KpiValueAudit" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "authorUsername" TEXT NOT NULL,
    "authorCompanyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiValueAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KpiValueAudit_kpiId_period_createdAt_idx" ON "KpiValueAudit"("kpiId", "period", "createdAt");

-- AddForeignKey
ALTER TABLE "KpiValueAudit" ADD CONSTRAINT "KpiValueAudit_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
