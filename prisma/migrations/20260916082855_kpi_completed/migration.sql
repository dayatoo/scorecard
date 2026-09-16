-- AlterTable
ALTER TABLE "Kpi" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "completedPeriod" TEXT;
