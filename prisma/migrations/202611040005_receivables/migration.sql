BEGIN;
-- AlterTable
ALTER TABLE "FinanceEntry" ADD COLUMN     "sourceOperationId" UUID;

-- CreateTable
CREATE TABLE "FinanceReceivable" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "sourceEntryId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "dueDate" DATE,
    "amount" DECIMAL(20,0) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceReceivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceReceipt" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "receivableId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "amount" DECIMAL(20,0) NOT NULL,
    "date" DATE NOT NULL,
    "method" VARCHAR(20) NOT NULL,
    "reference" VARCHAR(100) NOT NULL,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceReceiptReversal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "receiptId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceReceiptReversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCreditAllocation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "creditId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amount" DECIMAL(20,0) NOT NULL,
    "date" DATE NOT NULL,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceCreditAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCreditAllocationReversal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "allocationId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceCreditAllocationReversal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceivable_documentId_key" ON "FinanceReceivable"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceivable_sourceEntryId_key" ON "FinanceReceivable"("sourceEntryId");

-- CreateIndex
CREATE INDEX "FinanceReceivable_tenantId_customerId_dueDate_idx" ON "FinanceReceivable"("tenantId", "customerId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceivable_tenantId_id_key" ON "FinanceReceivable"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceipt_entryId_key" ON "FinanceReceipt"("entryId");

-- CreateIndex
CREATE INDEX "FinanceReceipt_tenantId_date_idx" ON "FinanceReceipt"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceipt_tenantId_id_key" ON "FinanceReceipt"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceipt_tenantId_idempotencyKey_key" ON "FinanceReceipt"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceiptReversal_receiptId_key" ON "FinanceReceiptReversal"("receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceiptReversal_entryId_key" ON "FinanceReceiptReversal"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceiptReversal_tenantId_idempotencyKey_key" ON "FinanceReceiptReversal"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCreditAllocation_tenantId_id_key" ON "FinanceCreditAllocation"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCreditAllocation_tenantId_idempotencyKey_key" ON "FinanceCreditAllocation"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCreditAllocationReversal_allocationId_key" ON "FinanceCreditAllocationReversal"("allocationId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCreditAllocationReversal_tenantId_idempotencyKey_key" ON "FinanceCreditAllocationReversal"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_receptores_tenantId_id_key" ON "clientes_receptores"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_dte_tenantId_id_key" ON "documentos_dte"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "folios_sin_uso_tenantId_id_key" ON "folios_sin_uso"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEntry_sourceOperationId_key" ON "FinanceEntry"("sourceOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEntry_tenantId_id_key" ON "FinanceEntry"("tenantId", "id");

-- AddForeignKey
ALTER TABLE "FinanceReceivable" ADD CONSTRAINT "FinanceReceivable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceivable" ADD CONSTRAINT "FinanceReceivable_tenantId_documentId_fkey" FOREIGN KEY ("tenantId", "documentId") REFERENCES "documentos_dte"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceivable" ADD CONSTRAINT "FinanceReceivable_tenantId_customerId_fkey" FOREIGN KEY ("tenantId", "customerId") REFERENCES "clientes_receptores"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceivable" ADD CONSTRAINT "FinanceReceivable_tenantId_sourceEntryId_fkey" FOREIGN KEY ("tenantId", "sourceEntryId") REFERENCES "FinanceEntry"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceipt" ADD CONSTRAINT "FinanceReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceipt" ADD CONSTRAINT "FinanceReceipt_tenantId_receivableId_fkey" FOREIGN KEY ("tenantId", "receivableId") REFERENCES "FinanceReceivable"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceipt" ADD CONSTRAINT "FinanceReceipt_tenantId_entryId_fkey" FOREIGN KEY ("tenantId", "entryId") REFERENCES "FinanceEntry"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceiptReversal" ADD CONSTRAINT "FinanceReceiptReversal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceiptReversal" ADD CONSTRAINT "FinanceReceiptReversal_tenantId_receiptId_fkey" FOREIGN KEY ("tenantId", "receiptId") REFERENCES "FinanceReceipt"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceiptReversal" ADD CONSTRAINT "FinanceReceiptReversal_tenantId_entryId_fkey" FOREIGN KEY ("tenantId", "entryId") REFERENCES "FinanceEntry"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCreditAllocation" ADD CONSTRAINT "FinanceCreditAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCreditAllocation" ADD CONSTRAINT "FinanceCreditAllocation_tenantId_creditId_fkey" FOREIGN KEY ("tenantId", "creditId") REFERENCES "FinanceReceivable"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCreditAllocation" ADD CONSTRAINT "FinanceCreditAllocation_tenantId_invoiceId_fkey" FOREIGN KEY ("tenantId", "invoiceId") REFERENCES "FinanceReceivable"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCreditAllocationReversal" ADD CONSTRAINT "FinanceCreditAllocationReversal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCreditAllocationReversal" ADD CONSTRAINT "FinanceCreditAllocationReversal_tenantId_allocationId_fkey" FOREIGN KEY ("tenantId", "allocationId") REFERENCES "FinanceCreditAllocation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Incorporar únicamente saldos que ya tienen un asiento documental publicado.
INSERT INTO "FinanceReceivable" (id,"tenantId","documentId","customerId","sourceEntryId",date,"dueDate",amount,"createdAt")
SELECT gen_random_uuid(),e."tenantId",d.id,d."receptorId",e.id,e.date,d."fechaVenc",
  d."mntTotal" * CASE WHEN d."tipoDte"=61 THEN -1 ELSE 1 END, CURRENT_TIMESTAMP
FROM "FinanceEntry" e JOIN documentos_dte d ON d.id=e."sourceDocumentId"
WHERE d."tipoDte" IN (33,34,39,41,56,61) AND d."mntTotal">0;

ALTER TABLE "FinanceReceivable" ADD CONSTRAINT finance_ar_nonzero CHECK (amount<>0);
ALTER TABLE "FinanceReceipt" ADD CONSTRAINT finance_receipt_positive CHECK (amount>0 AND method IN ('TRANSFERENCIA','EFECTIVO','TARJETA','OTRO'));
ALTER TABLE "FinanceCreditAllocation" ADD CONSTRAINT finance_allocation_positive CHECK (amount>0 AND "creditId"<>"invoiceId");
CREATE TRIGGER finance_ar_immutable BEFORE UPDATE OR DELETE ON "FinanceReceivable" FOR EACH ROW EXECUTE FUNCTION finance_prevent_mutation();
CREATE TRIGGER finance_receipt_immutable BEFORE UPDATE OR DELETE ON "FinanceReceipt" FOR EACH ROW EXECUTE FUNCTION finance_prevent_mutation();
CREATE TRIGGER finance_receipt_reversal_immutable BEFORE UPDATE OR DELETE ON "FinanceReceiptReversal" FOR EACH ROW EXECUTE FUNCTION finance_prevent_mutation();
CREATE TRIGGER finance_credit_allocation_immutable BEFORE UPDATE OR DELETE ON "FinanceCreditAllocation" FOR EACH ROW EXECUTE FUNCTION finance_prevent_mutation();
CREATE TRIGGER finance_credit_reversal_immutable BEFORE UPDATE OR DELETE ON "FinanceCreditAllocationReversal" FOR EACH ROW EXECUTE FUNCTION finance_prevent_mutation();

CREATE FUNCTION finance_ar_balance(ar_id uuid) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT a.amount
    -COALESCE((SELECT sum(r.amount) FROM "FinanceReceipt" r WHERE r."receivableId"=a.id),0)
    +COALESCE((SELECT sum(r.amount) FROM "FinanceReceiptReversal" v JOIN "FinanceReceipt" r ON r.id=v."receiptId" WHERE r."receivableId"=a.id),0)
    -COALESCE((SELECT sum(c.amount) FROM "FinanceCreditAllocation" c WHERE c."invoiceId"=a.id),0)
    +COALESCE((SELECT sum(c.amount) FROM "FinanceCreditAllocationReversal" v JOIN "FinanceCreditAllocation" c ON c.id=v."allocationId" WHERE c."invoiceId"=a.id),0)
    +COALESCE((SELECT sum(c.amount) FROM "FinanceCreditAllocation" c WHERE c."creditId"=a.id),0)
    -COALESCE((SELECT sum(c.amount) FROM "FinanceCreditAllocationReversal" v JOIN "FinanceCreditAllocation" c ON c.id=v."allocationId" WHERE c."creditId"=a.id),0)
  FROM "FinanceReceivable" a WHERE a.id=ar_id;
$$;
CREATE FUNCTION finance_ar_snapshot_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doc documentos_dte; posted "FinanceEntry"; ledger_amount numeric;
BEGIN
  SELECT * INTO doc FROM documentos_dte WHERE id=NEW."documentId";
  SELECT * INTO posted FROM "FinanceEntry" WHERE id=NEW."sourceEntryId";
  SELECT sum(debit-credit) INTO ledger_amount FROM "FinanceEntryLine" WHERE "entryId"=posted.id AND "accountCode"='110310';
  IF doc."tipoDte" NOT IN (33,34,39,41,56,61) THEN RAISE EXCEPTION 'Tipo documental no configurado para cartera'; END IF;
  IF doc."tenantId" IS DISTINCT FROM NEW."tenantId" OR doc."receptorId" IS DISTINCT FROM NEW."customerId"
    OR posted."tenantId" IS DISTINCT FROM NEW."tenantId" OR posted."sourceDocumentId" IS DISTINCT FROM doc.id
    OR posted.date IS DISTINCT FROM NEW.date OR ledger_amount IS DISTINCT FROM NEW.amount
    OR NEW.amount IS DISTINCT FROM (doc."mntTotal" * (CASE WHEN doc."tipoDte"=61 THEN -1 ELSE 1 END)) THEN
    RAISE EXCEPTION 'El saldo de cartera debe coincidir con su documento, cliente y asiento';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER finance_ar_snapshot BEFORE INSERT ON "FinanceReceivable" FOR EACH ROW EXECUTE FUNCTION finance_ar_snapshot_guard();

CREATE FUNCTION finance_ar_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ids uuid[]; target_id uuid; original numeric; start_date date; latest date; credit "FinanceReceivable"; invoice "FinanceReceivable";
BEGIN
  PERFORM id FROM tenants WHERE id=NEW."tenantId" FOR UPDATE;
  IF NEW.date>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date THEN RAISE EXCEPTION 'No se admiten movimientos futuros como realizados'; END IF;
  IF NOT EXISTS(SELECT 1 FROM "FinancePeriod" WHERE "tenantId"=NEW."tenantId" AND month=to_char(NEW.date,'YYYY-MM') AND "closedAt" IS NULL) THEN
    RAISE EXCEPTION 'El período de la operación no está abierto';
  END IF;
  IF TG_TABLE_NAME='FinanceReceipt' THEN
    ids:=ARRAY[NEW."receivableId"];
    IF NOT EXISTS(SELECT 1 FROM "FinanceReceivable" a JOIN documentos_dte d ON d.id=a."documentId" WHERE a.id=NEW."receivableId" AND a.amount>0 AND d.estado NOT IN ('ANULADO','RECHAZADO')) THEN
      RAISE EXCEPTION 'El documento no admite cobros';
    END IF;
    IF EXISTS(SELECT 1 FROM account_moves am JOIN account_payments p ON p."moveId"=am.id JOIN "FinanceReceivable" a ON a."documentId"=am."documentoDteId" WHERE a.id=NEW."receivableId") THEN RAISE EXCEPTION 'El documento tiene pagos anteriores pendientes de revisión'; END IF;
  ELSIF TG_TABLE_NAME='FinanceReceiptReversal' THEN
    SELECT ARRAY[r."receivableId"] INTO ids FROM "FinanceReceipt" r WHERE r.id=NEW."receiptId" AND r."tenantId"=NEW."tenantId";
  ELSIF TG_TABLE_NAME='FinanceCreditAllocation' THEN
    SELECT * INTO credit FROM "FinanceReceivable" WHERE id=NEW."creditId";
    SELECT * INTO invoice FROM "FinanceReceivable" WHERE id=NEW."invoiceId";
    IF credit.amount>=0 OR invoice.amount<=0 OR credit."customerId" IS DISTINCT FROM invoice."customerId"
      OR credit."tenantId" IS DISTINCT FROM NEW."tenantId" OR invoice."tenantId" IS DISTINCT FROM NEW."tenantId" THEN
      RAISE EXCEPTION 'El crédito y la deuda deben pertenecer al mismo cliente y empresa';
    END IF;
    IF EXISTS(SELECT 1 FROM documentos_dte WHERE id=credit."documentId" AND estado IN ('ANULADO','RECHAZADO')) THEN RAISE EXCEPTION 'El crédito requiere revisión tributaria'; END IF;
    ids:=ARRAY[NEW."creditId",NEW."invoiceId"];
  ELSE
    SELECT ARRAY[c."creditId",c."invoiceId"] INTO ids FROM "FinanceCreditAllocation" c WHERE c.id=NEW."allocationId" AND c."tenantId"=NEW."tenantId";
  END IF;
  IF ids IS NULL THEN RAISE EXCEPTION 'No se encontró la operación de cartera'; END IF;
  FOREACH target_id IN ARRAY ids LOOP
    SELECT a.amount,a.date INTO original,start_date FROM "FinanceReceivable" a WHERE a.id=target_id AND a."tenantId"=NEW."tenantId";
    IF original IS NULL THEN RAISE EXCEPTION 'Documento de otra empresa o inexistente'; END IF;
    SELECT max(date) INTO latest FROM (
      SELECT date FROM "FinanceReceipt" WHERE "receivableId"=target_id
      UNION ALL SELECT v.date FROM "FinanceReceiptReversal" v JOIN "FinanceReceipt" r ON r.id=v."receiptId" WHERE r."receivableId"=target_id
      UNION ALL SELECT date FROM "FinanceCreditAllocation" WHERE "creditId"=target_id OR "invoiceId"=target_id
      UNION ALL SELECT v.date FROM "FinanceCreditAllocationReversal" v JOIN "FinanceCreditAllocation" c ON c.id=v."allocationId" WHERE c."creditId"=target_id OR c."invoiceId"=target_id
    ) history;
    IF NEW.date<greatest(start_date,latest) THEN RAISE EXCEPTION 'La fecha antecede al último movimiento del documento'; END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER finance_receipt_event BEFORE INSERT ON "FinanceReceipt" FOR EACH ROW EXECUTE FUNCTION finance_ar_event_guard();
CREATE TRIGGER finance_receipt_reverse_event BEFORE INSERT ON "FinanceReceiptReversal" FOR EACH ROW EXECUTE FUNCTION finance_ar_event_guard();
CREATE TRIGGER finance_credit_event BEFORE INSERT ON "FinanceCreditAllocation" FOR EACH ROW EXECUTE FUNCTION finance_ar_event_guard();
CREATE TRIGGER finance_credit_reverse_event BEFORE INSERT ON "FinanceCreditAllocationReversal" FOR EACH ROW EXECUTE FUNCTION finance_ar_event_guard();

CREATE FUNCTION finance_ar_check_balances() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ids uuid[]; ar_id uuid; original numeric; remaining numeric;
BEGIN
  IF TG_TABLE_NAME='FinanceReceipt' THEN ids:=ARRAY[NEW."receivableId"];
  ELSIF TG_TABLE_NAME='FinanceReceiptReversal' THEN SELECT ARRAY[r."receivableId"] INTO ids FROM "FinanceReceipt" r WHERE r.id=NEW."receiptId";
  ELSIF TG_TABLE_NAME='FinanceCreditAllocation' THEN ids:=ARRAY[NEW."creditId",NEW."invoiceId"];
  ELSE SELECT ARRAY[c."creditId",c."invoiceId"] INTO ids FROM "FinanceCreditAllocation" c WHERE c.id=NEW."allocationId";
  END IF;
  FOREACH ar_id IN ARRAY ids LOOP
    SELECT amount INTO original FROM "FinanceReceivable" WHERE id=ar_id;
    remaining:=finance_ar_balance(ar_id);
    IF (original>0 AND (remaining<0 OR remaining>original)) OR (original<0 AND (remaining<original OR remaining>0)) THEN
      RAISE EXCEPTION 'La operación supera el saldo disponible del documento';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER finance_receipt_balances AFTER INSERT ON "FinanceReceipt" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_ar_check_balances();
CREATE CONSTRAINT TRIGGER finance_receipt_reverse_balances AFTER INSERT ON "FinanceReceiptReversal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_ar_check_balances();
CREATE CONSTRAINT TRIGGER finance_credit_balances AFTER INSERT ON "FinanceCreditAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_ar_check_balances();
CREATE CONSTRAINT TRIGGER finance_credit_reverse_balances AFTER INSERT ON "FinanceCreditAllocationReversal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_ar_check_balances();

CREATE FUNCTION finance_receipt_entry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE posted "FinanceEntry"; original "FinanceReceipt"; value numeric; cash numeric; receivable numeric; expected_reverse uuid;
BEGIN
  SELECT * INTO posted FROM "FinanceEntry" WHERE id=NEW."entryId";
  IF TG_TABLE_NAME='FinanceReceipt' THEN value:=NEW.amount;
  ELSE
    SELECT * INTO original FROM "FinanceReceipt" WHERE id=NEW."receiptId";
    value:=-original.amount; expected_reverse:=original."entryId";
  END IF;
  SELECT COALESCE(sum(debit-credit) FILTER(WHERE "accountCode"='110110'),0),COALESCE(sum(debit-credit) FILTER(WHERE "accountCode"='110310'),0)
    INTO cash,receivable FROM "FinanceEntryLine" WHERE "entryId"=posted.id;
  IF posted."tenantId" IS DISTINCT FROM NEW."tenantId" OR posted."sourceOperationId" IS DISTINCT FROM NEW.id OR posted.date IS DISTINCT FROM NEW.date
    OR posted."reversesId" IS DISTINCT FROM expected_reverse OR cash<>value OR receivable<>-value
    OR (SELECT count(*) FROM "FinanceEntryLine" WHERE "entryId"=posted.id)<>2 THEN
    RAISE EXCEPTION 'El cobro y su asiento deben coincidir en importe, empresa, fecha y origen';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER finance_receipt_entry AFTER INSERT ON "FinanceReceipt" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_receipt_entry_guard();
CREATE CONSTRAINT TRIGGER finance_receipt_reverse_entry AFTER INSERT ON "FinanceReceiptReversal" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_receipt_entry_guard();
CREATE FUNCTION finance_entry_operation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE operations int;
BEGIN
  IF NEW."sourceOperationId" IS NOT NULL THEN
    SELECT (SELECT count(*) FROM "FinanceReceipt" WHERE id=NEW."sourceOperationId" AND "entryId"=NEW.id AND "tenantId"=NEW."tenantId")
      +(SELECT count(*) FROM "FinanceReceiptReversal" WHERE id=NEW."sourceOperationId" AND "entryId"=NEW.id AND "tenantId"=NEW."tenantId") INTO operations;
    IF operations<>1 THEN RAISE EXCEPTION 'El asiento de cobro debe tener una operación de cartera vinculada'; END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER finance_entry_operation AFTER INSERT ON "FinanceEntry" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance_entry_operation_guard();
-- Comprobar también los saldos incorporados desde la versión anterior.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM "FinanceReceivable" a JOIN "FinanceEntry" e ON e.id=a."sourceEntryId"
    WHERE a.amount IS DISTINCT FROM (SELECT sum(l.debit-l.credit) FROM "FinanceEntryLine" l WHERE l."entryId"=e.id AND l."accountCode"='110310')) THEN
    RAISE EXCEPTION 'Existen documentos anteriores cuyo asiento no coincide con el saldo a incorporar';
  END IF;
END $$;
COMMIT;
