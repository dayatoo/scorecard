-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "Phasing" AS ENUM ('NONE', 'EVEN', 'CUSTOM');

-- AlterTable
ALTER TABLE "Kpi" ADD COLUMN     "frequency" "Frequency" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "phaseConfig" TEXT,
ADD COLUMN     "phasing" "Phasing" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "KpiAudit" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KpiAudit_kpiId_createdAt_idx" ON "KpiAudit"("kpiId", "createdAt");

-- AddForeignKey
ALTER TABLE "KpiAudit" ADD CONSTRAINT "KpiAudit_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
