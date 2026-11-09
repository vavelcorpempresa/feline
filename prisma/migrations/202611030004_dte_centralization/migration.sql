-- AlterTable
ALTER TABLE "FinanceEntry" ADD COLUMN     "sourceDocumentId" UUID;

-- CreateTable
CREATE TABLE "FinanceConfiguration" (
    "tenantId" UUID NOT NULL,
    "automaticPosting" BOOLEAN NOT NULL DEFAULT false,
    "authorizedBy" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceConfiguration_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "FinancePostingJob" (
    "documentId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "state" VARCHAR(12) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" VARCHAR(500),
    "entryId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePostingJob_pkey" PRIMARY KEY ("documentId")
);

-- CreateIndex
CREATE INDEX "FinancePostingJob_state_nextAttempt_idx" ON "FinancePostingJob"("state", "nextAttempt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEntry_sourceDocumentId_key" ON "FinanceEntry"("sourceDocumentId");

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "documentos_dte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceConfiguration" ADD CONSTRAINT "FinanceConfiguration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePostingJob" ADD CONSTRAINT "FinancePostingJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documentos_dte"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePostingJob" ADD CONSTRAINT "FinancePostingJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "FinancePostingJob" ADD CONSTRAINT finance_job_state CHECK (state IN ('PENDING','DONE','ERROR','SKIPPED') AND attempts >= 0);
CREATE FUNCTION finance_guard_entry_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE document_tenant uuid; period_tenant uuid; period_closed timestamp;
BEGIN
  PERFORM id FROM tenants WHERE id = NEW."tenantId" FOR UPDATE;
  SELECT "tenantId", "closedAt" INTO period_tenant, period_closed FROM "FinancePeriod" WHERE id=NEW."periodId";
  IF period_tenant IS DISTINCT FROM NEW."tenantId" OR period_closed IS NOT NULL THEN
    RAISE EXCEPTION 'El período no pertenece a la empresa o está cerrado';
  END IF;
  IF NEW."sourceDocumentId" IS NOT NULL THEN
    SELECT "tenantId" INTO document_tenant FROM documentos_dte WHERE id=NEW."sourceDocumentId";
    IF document_tenant IS DISTINCT FROM NEW."tenantId" THEN RAISE EXCEPTION 'El DTE pertenece a otra empresa'; END IF;
  END IF;
  NEW."createdTransaction" := txid_current()::text;
  RETURN NEW;
END;
$$;
CREATE TRIGGER finance_entry_insert_guard BEFORE INSERT ON "FinanceEntry" FOR EACH ROW EXECUTE FUNCTION finance_guard_entry_insert();
