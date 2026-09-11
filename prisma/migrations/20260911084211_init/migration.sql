-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('PERCENTAGE', 'DOLLAR', 'QUANTITY', 'DAYS', 'MONTH_COMPLETION');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('HIGHER_BETTER', 'LOWER_BETTER');

-- CreateEnum
CREATE TYPE "TargetMode" AS ENUM ('FIXED', 'RANGE');

-- CreateEnum
CREATE TYPE "ValueBasis" AS ENUM ('ACTUAL', 'ESTIMATE');

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kpi" (
    "id" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metricType" "MetricType",
    "direction" "Direction",
    "targetMode" "TargetMode",
    "unit" TEXT,
    "targetConfig" TEXT,
    "deadlineMonth" TEXT,
    "scoreFinalAfterDeadline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiDepartment" (
    "kpiId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "KpiDepartment_pkey" PRIMARY KEY ("kpiId","departmentId")
);

-- CreateTable
CREATE TABLE "KpiValue" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "basis" "ValueBasis" NOT NULL DEFAULT 'ACTUAL',
    "completionDate" TIMESTAMP(3),
    "note" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiUpdate" (
    "id" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_startYear_key" ON "FiscalYear"("startYear");

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE INDEX "Kpi_fiscalYearId_idx" ON "Kpi"("fiscalYearId");

-- CreateIndex
CREATE INDEX "Kpi_parentId_idx" ON "Kpi"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Kpi_fiscalYearId_code_key" ON "Kpi"("fiscalYearId", "code");

-- CreateIndex
CREATE INDEX "KpiDepartment_departmentId_idx" ON "KpiDepartment"("departmentId");

-- CreateIndex
CREATE INDEX "KpiValue_kpiId_idx" ON "KpiValue"("kpiId");

-- CreateIndex
CREATE UNIQUE INDEX "KpiValue_kpiId_period_key" ON "KpiValue"("kpiId", "period");

-- CreateIndex
CREATE INDEX "KpiUpdate_kpiId_createdAt_idx" ON "KpiUpdate"("kpiId", "createdAt");

-- AddForeignKey
ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kpi" ADD CONSTRAINT "Kpi_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Kpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiDepartment" ADD CONSTRAINT "KpiDepartment_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiDepartment" ADD CONSTRAINT "KpiDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiValue" ADD CONSTRAINT "KpiValue_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiUpdate" ADD CONSTRAINT "KpiUpdate_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
