-- CreateEnum
CREATE TYPE "FinanceRole" AS ENUM ('OWNER', 'ACCOUNTANT', 'BILLING', 'VIEWER');

-- CreateTable
CREATE TABLE "FinanceUser" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceMembership" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "FinanceRole" NOT NULL,

    CONSTRAINT "FinanceMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSession" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePeriod" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedBy" UUID,

    CONSTRAINT "FinancePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceEntry" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "description" VARCHAR(250) NOT NULL,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversesId" UUID,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceEntryLine" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "accountCode" VARCHAR(16) NOT NULL,
    "debit" DECIMAL(20,0) NOT NULL,
    "credit" DECIMAL(20,0) NOT NULL,

    CONSTRAINT "FinanceEntryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceAuditEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "entityId" UUID NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceUser_email_key" ON "FinanceUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceMembership_tenantId_userId_key" ON "FinanceMembership"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSession_tokenHash_key" ON "FinanceSession"("tokenHash");

-- CreateIndex
CREATE INDEX "FinanceSession_expiresAt_idx" ON "FinanceSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePeriod_tenantId_month_key" ON "FinancePeriod"("tenantId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePeriod_tenantId_id_key" ON "FinancePeriod"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEntry_reversesId_key" ON "FinanceEntry"("reversesId");

-- CreateIndex
CREATE INDEX "FinanceEntry_tenantId_date_idx" ON "FinanceEntry"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEntry_tenantId_idempotencyKey_key" ON "FinanceEntry"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FinanceEntryLine_entryId_idx" ON "FinanceEntryLine"("entryId");

-- CreateIndex
CREATE INDEX "FinanceAuditEvent_tenantId_createdAt_idx" ON "FinanceAuditEvent"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "FinanceMembership" ADD CONSTRAINT "FinanceMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceMembership" ADD CONSTRAINT "FinanceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "FinanceUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSession" ADD CONSTRAINT "FinanceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "FinanceUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePeriod" ADD CONSTRAINT "FinancePeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_tenantId_periodId_fkey" FOREIGN KEY ("tenantId", "periodId") REFERENCES "FinancePeriod"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "FinanceEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntryLine" ADD CONSTRAINT "FinanceEntryLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinanceEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAuditEvent" ADD CONSTRAINT "FinanceAuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Los asientos publicados y su auditoría son append-only, también ante SQL directo.
ALTER TABLE "FinanceEntryLine" ADD CONSTRAINT "finance_line_one_side" CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0));
CREATE FUNCTION finance_prevent_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'El registro financiero es inmutable; utiliza una reversión'; END;
$$;
CREATE TRIGGER finance_entry_immutable BEFORE UPDATE OR DELETE ON "FinanceEntry" FOR EACH ROW EXECUTE FUNCTION finance_prevent_mutation();
CREATE TRIGGER finance_line_immutable BEFORE UPDATE OR DELETE ON "FinanceEntryLine" FOR EACH ROW EXECUTE FUNCTION finance_prevent_mutation();
CREATE TRIGGER finance_audit_immutable BEFORE UPDATE OR DELETE ON "FinanceAuditEvent" FOR EACH ROW EXECUTE FUNCTION finance_prevent_mutation();
CREATE FUNCTION finance_check_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entry_id uuid; line_count bigint; net numeric;
BEGIN
  IF TG_TABLE_NAME = 'FinanceEntry' THEN entry_id := NEW.id; ELSE entry_id := NEW."entryId"; END IF;
  SELECT count(*), COALESCE(sum(debit-credit),0) INTO line_count,net FROM "FinanceEntryLine" WHERE "entryId"=entry_id;
  IF line_count < 2 OR net <> 0 THEN RAISE EXCEPTION 'El asiento debe tener al menos dos líneas y estar equilibrado'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER finance_balance_entry AFTER INSERT ON "FinanceEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_check_balance();
CREATE CONSTRAINT TRIGGER finance_balance_line AFTER INSERT ON "FinanceEntryLine" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_check_balance();
