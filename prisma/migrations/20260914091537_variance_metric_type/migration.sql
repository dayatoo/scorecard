-- AlterEnum
ALTER TYPE "MetricType" ADD VALUE 'VARIANCE';

-- AlterTable
ALTER TABLE "KpiValue" ADD COLUMN     "plannedValue" DOUBLE PRECISION;
