-- CreateTable
CREATE TABLE "KpiDictionaryEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metricType" "MetricType",
    "direction" "Direction",
    "targetMode" "TargetMode",
    "unit" TEXT,
    "targetConfig" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiDictionaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KpiDictionaryEntry_name_key" ON "KpiDictionaryEntry"("name");
