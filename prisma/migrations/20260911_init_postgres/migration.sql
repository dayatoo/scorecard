-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('PERCENTAGE', 'DOLLAR', 'QUANTITY', 'DAYS', 'MONTH_COMPLETION');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('HIGHER_BETTER', 'LOWER_BETTER');

-- CreateEnum
CREATE TYPE "TargetMode" AS ENUM ('FIXED', 'RANGE');

-- CreateTable
CREATE TABLE "Kpi" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metricType" "MetricType",
    "direction" "Direction",
    "targetMode" "TargetMode",
    "targetConfig" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiValue" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "completionDate" TIMESTAMP(3),
    "note" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Kpi_parentId_idx" ON "Kpi"("parentId");

-- CreateIndex
CREATE INDEX "KpiValue_kpiId_idx" ON "KpiValue"("kpiId");

-- CreateIndex
CREATE UNIQUE INDEX "KpiValue_kpiId_period_key" ON "KpiValue"("kpiId", "period");

-- AddForeignKey
ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Kpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiValue" ADD CONSTRAINT "KpiValue_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

