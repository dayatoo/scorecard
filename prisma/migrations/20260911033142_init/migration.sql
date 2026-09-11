-- CreateTable
CREATE TABLE "Kpi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "weight" REAL NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metricType" TEXT,
    "direction" TEXT,
    "targetMode" TEXT,
    "targetConfig" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Kpi_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Kpi" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KpiValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kpiId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "value" REAL,
    "completionDate" DATETIME,
    "note" TEXT,
    "enteredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KpiValue_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Kpi_parentId_idx" ON "Kpi"("parentId");

-- CreateIndex
CREATE INDEX "KpiValue_kpiId_idx" ON "KpiValue"("kpiId");

-- CreateIndex
CREATE UNIQUE INDEX "KpiValue_kpiId_period_key" ON "KpiValue"("kpiId", "period");
