-- CreateEnum
CREATE TYPE "KpiUpdateMode" AS ENUM ('SIMPLE', 'DETAILED');

-- AlterTable
ALTER TABLE "Kpi" ADD COLUMN     "status" TEXT;

-- AlterTable
ALTER TABLE "KpiUpdate" ADD COLUMN     "currentProgress" TEXT,
ADD COLUMN     "issues" TEXT,
ADD COLUMN     "mode" "KpiUpdateMode" NOT NULL DEFAULT 'SIMPLE',
ADD COLUMN     "nextProgress" TEXT,
ADD COLUMN     "timeCost" TEXT,
ALTER COLUMN "body" DROP NOT NULL;

-- CreateTable
CREATE TABLE "KpiStatusOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KpiStatusOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KpiStatusOption_name_key" ON "KpiStatusOption"("name");
