CREATE TABLE "SalesGoal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "period" VARCHAR(10) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "target" DECIMAL(20,0) NOT NULL CHECK ("target" > 0),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'CLP' CHECK ("currency" = 'CLP'),
    "responsible" VARCHAR(100) NOT NULL,
    "notes" VARCHAR(1000) NOT NULL DEFAULT '',
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesGoal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SalesGoal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CHECK ("endDate" >= "startDate"),
    CHECK ("period" IN ('day','week','month','quarter','semester','year'))
);
CREATE UNIQUE INDEX "SalesGoal_tenantId_period_startDate_key" ON "SalesGoal" ("tenantId","period","startDate");

CREATE TABLE "IpcMonthlyIndex" (
    "id" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "base" INTEGER NOT NULL,
    "value" DECIMAL(20,12) NOT NULL CHECK ("value" > 0),
    "source" TEXT NOT NULL,
    "publishedAt" DATE NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedBy" UUID NOT NULL,
    CONSTRAINT "IpcMonthlyIndex_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IpcMonthlyIndex_base_month_value_key" ON "IpcMonthlyIndex" ("base","month","value");
CREATE INDEX "IpcMonthlyIndex_base_month_retrievedAt_idx" ON "IpcMonthlyIndex" ("base","month","retrievedAt");
