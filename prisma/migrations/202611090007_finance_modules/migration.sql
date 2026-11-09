-- AlterTable
ALTER TABLE "FinanceEntryLine" ADD COLUMN     "costCenterId" UUID;

-- CreateTable
CREATE TABLE "FinanceVendor" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "rut" VARCHAR(15) NOT NULL,
    "razonSocial" VARCHAR(120) NOT NULL,
    "giro" VARCHAR(100) NOT NULL,
    "direccion" VARCHAR(100) NOT NULL,
    "comuna" VARCHAR(30) NOT NULL,
    "ciudad" VARCHAR(30) NOT NULL,
    "contacto" VARCHAR(80),
    "correo" VARCHAR(120),
    "telefono" VARCHAR(30),
    "banco" VARCHAR(60),
    "tipoCuenta" VARCHAR(30),
    "numeroCuenta" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePurchaseOrder" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "folio" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "expectedDeliveryDate" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
    "netAmount" DECIMAL(20,0) NOT NULL,
    "taxAmount" DECIMAL(20,0) NOT NULL,
    "totalAmount" DECIMAL(20,0) NOT NULL,
    "notes" VARCHAR(500),
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancePurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePurchaseOrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "description" VARCHAR(250) NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(20,0) NOT NULL,
    "totalPrice" DECIMAL(20,0) NOT NULL,

    CONSTRAINT "FinancePurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePayable" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "purchaseOrderId" UUID,
    "sourceEntryId" UUID,
    "documentType" INTEGER NOT NULL,
    "folio" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "dueDate" DATE,
    "netAmount" DECIMAL(20,0) NOT NULL,
    "taxAmount" DECIMAL(20,0) NOT NULL,
    "exemptAmount" DECIMAL(20,0) NOT NULL,
    "totalAmount" DECIMAL(20,0) NOT NULL,
    "kind" VARCHAR(20) NOT NULL DEFAULT 'DEBT',
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "description" VARCHAR(250),
    "scheduledDate" DATE,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancePayable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceVendorPayment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "payableId" UUID,
    "vendorId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "amount" DECIMAL(20,0) NOT NULL,
    "date" DATE NOT NULL,
    "method" VARCHAR(20) NOT NULL,
    "accountCode" VARCHAR(16) NOT NULL DEFAULT '110110',
    "reference" VARCHAR(100) NOT NULL,
    "isAdvance" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceVendorPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceVendorPaymentReversal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceVendorPaymentReversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceVendorCreditAllocation" (
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

    CONSTRAINT "FinanceVendorCreditAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceVendorCreditAllocationReversal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "allocationId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceVendorCreditAllocationReversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCashBox" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'CENTRAL',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'CLP',
    "accountCode" VARCHAR(16) NOT NULL DEFAULT '110110',
    "responsibleUserId" UUID,
    "maxBalance" DECIMAL(20,0),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCashBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCashShift" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cashBoxId" UUID NOT NULL,
    "openedBy" UUID NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingBalance" DECIMAL(20,0) NOT NULL,
    "closedBy" UUID,
    "closedAt" TIMESTAMP(3),
    "expectedBalance" DECIMAL(20,0),
    "countedBalance" DECIMAL(20,0),
    "difference" DECIMAL(20,0),
    "differenceReason" VARCHAR(250),
    "differenceEntryId" UUID,
    "status" VARCHAR(12) NOT NULL DEFAULT 'OPEN',
    "notes" VARCHAR(500),

    CONSTRAINT "FinanceCashShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceDirectMovement" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "cashBoxId" UUID,
    "shiftId" UUID,
    "entryId" UUID NOT NULL,
    "type" VARCHAR(10) NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(20,0) NOT NULL,
    "accountCode" VARCHAR(16) NOT NULL,
    "category" VARCHAR(30) NOT NULL DEFAULT 'OTRO',
    "description" VARCHAR(250) NOT NULL,
    "recipientOrPayer" VARCHAR(100),
    "voucherNumber" VARCHAR(50),
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceDirectMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceDirectMovementReversal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "movementId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceDirectMovementReversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceInternalTransfer" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "fromAccountCode" VARCHAR(16) NOT NULL,
    "fromCashBoxId" UUID,
    "toAccountCode" VARCHAR(16) NOT NULL,
    "toCashBoxId" UUID,
    "entryId" UUID NOT NULL,
    "amount" DECIMAL(20,0) NOT NULL,
    "date" DATE NOT NULL,
    "reference" VARCHAR(100) NOT NULL,
    "notes" VARCHAR(250),
    "idempotencyKey" VARCHAR(200) NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceInternalTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePaymentRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "amount" DECIMAL(20,0) NOT NULL,
    "date" DATE NOT NULL,
    "dueDate" DATE,
    "recipient" VARCHAR(120) NOT NULL,
    "reason" VARCHAR(250) NOT NULL,
    "category" VARCHAR(30) NOT NULL DEFAULT 'GASTO',
    "urgency" VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
    "status" VARCHAR(15) NOT NULL DEFAULT 'PENDING',
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" VARCHAR(250),
    "paidPaymentId" UUID,
    "requestedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancePaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceBankAccount" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "bankCode" VARCHAR(20) NOT NULL,
    "bankName" VARCHAR(80) NOT NULL,
    "accountType" VARCHAR(20) NOT NULL DEFAULT 'CORRIENTE',
    "accountNumber" VARCHAR(40) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'CLP',
    "accountCode" VARCHAR(16) NOT NULL DEFAULT '110210',
    "initialBalance" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "initialDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceBankStatement" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "bankAccountId" UUID NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "fileHash" VARCHAR(64) NOT NULL,
    "format" VARCHAR(30) NOT NULL DEFAULT 'GENERIC_CSV',
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedBy" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "openingBalance" DECIMAL(20,0),
    "closingBalance" DECIMAL(20,0),
    "totalCredits" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "totalDebits" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "lineCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FinanceBankStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceBankStatementLine" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "statementId" UUID NOT NULL,
    "bankAccountId" UUID NOT NULL,
    "transactionDate" DATE NOT NULL,
    "valueDate" DATE,
    "description" VARCHAR(255) NOT NULL,
    "referenceNumber" VARCHAR(100),
    "amount" DECIMAL(20,0) NOT NULL,
    "balanceAfter" DECIMAL(20,0),
    "lineHash" VARCHAR(64) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "FinanceBankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceBankReconciliation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "statementLineId" UUID NOT NULL,
    "matchType" VARCHAR(30) NOT NULL,
    "targetEntryId" UUID,
    "matchedReceiptId" UUID,
    "matchedPaymentId" UUID,
    "matchedTransferId" UUID,
    "matchedMovementId" UUID,
    "adjustmentEntryId" UUID,
    "notes" VARCHAR(250),
    "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reconciledBy" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FinanceBankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceBankReconciliationReversal" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "reconciliationId" UUID NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "reversedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedBy" UUID NOT NULL,

    CONSTRAINT "FinanceBankReconciliationReversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceBankRule" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "pattern" VARCHAR(150) NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "targetAccountCode" VARCHAR(16) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceBankRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCostCenter" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(200),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCustomAccount" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "accountType" VARCHAR(30) NOT NULL,
    "internalGroup" VARCHAR(20) NOT NULL,
    "siiClassification" VARCHAR(30) NOT NULL,
    "includeInitialBalance" BOOLEAN NOT NULL DEFAULT true,
    "reconcile" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCustomAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceFiscalYear" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "openingEntryId" UUID,
    "closingEntryId" UUID,
    "status" VARCHAR(15) NOT NULL DEFAULT 'OPEN',
    "resultAmount" DECIMAL(20,0),
    "resultType" VARCHAR(15),
    "closedAt" TIMESTAMP(3),
    "closedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceFiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceReceivedDte" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "senderRut" VARCHAR(12) NOT NULL,
    "senderName" VARCHAR(150) NOT NULL,
    "documentType" INTEGER NOT NULL,
    "folio" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "netAmount" DECIMAL(20,0) NOT NULL,
    "taxAmount" DECIMAL(20,0) NOT NULL,
    "exemptAmount" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(20,0) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
    "claimReason" VARCHAR(255),
    "xmlPayload" TEXT,
    "payableId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceReceivedDte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTaxF29Declaration" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "salesNet" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "salesExempt" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "salesVatDebit" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "purchasesNet" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "purchasesExempt" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "purchasesVatCredit" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "feeRetention" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "payrollRetention" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "ppmRate" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "ppmAmount" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "netTaxPayable" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "taxCreditRemainder" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "status" VARCHAR(15) NOT NULL DEFAULT 'DRAFT',
    "declaredAt" TIMESTAMP(3),
    "declaredBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceTaxF29Declaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceBudget" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "status" VARCHAR(15) NOT NULL DEFAULT 'DRAFT',
    "department" VARCHAR(100),
    "notes" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceBudgetItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "budgetId" UUID NOT NULL,
    "costCenterId" UUID,
    "accountCode" VARCHAR(16) NOT NULL,
    "month" INTEGER NOT NULL,
    "allocatedAmount" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceBudgetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceFixedAsset" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "purchaseCost" DECIMAL(20,0) NOT NULL,
    "residualValue" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "usefulLifeMonths" INTEGER NOT NULL,
    "depreciatedMonths" INTEGER NOT NULL DEFAULT 0,
    "accumulatedDepreciation" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "bookValue" DECIMAL(20,0) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "payableId" UUID,
    "costCenterId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceFixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePayrollEmployee" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "rut" VARCHAR(12) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "position" VARCHAR(100) NOT NULL,
    "department" VARCHAR(100),
    "afp" VARCHAR(50) NOT NULL,
    "healthSystem" VARCHAR(50) NOT NULL,
    "baseSalary" DECIMAL(20,0) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "costCenterId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePayrollEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePayrollSlip" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "baseSalary" DECIMAL(20,0) NOT NULL,
    "overtime" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "gratification" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "totalImponible" DECIMAL(20,0) NOT NULL,
    "nonTaxableAllowances" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "afpDeduction" DECIMAL(20,0) NOT NULL,
    "healthDeduction" DECIMAL(20,0) NOT NULL,
    "afcDeduction" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "incomeTax" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(20,0) NOT NULL,
    "netSalary" DECIMAL(20,0) NOT NULL,
    "status" VARCHAR(15) NOT NULL DEFAULT 'DRAFT',
    "sourceEntryId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePayrollSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceFeeReceipt" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "rut" VARCHAR(12) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "folio" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "grossAmount" DECIMAL(20,0) NOT NULL,
    "retentionRate" DECIMAL(5,2) NOT NULL DEFAULT 13.75,
    "retentionAmount" DECIMAL(20,0) NOT NULL,
    "netAmount" DECIMAL(20,0) NOT NULL,
    "status" VARCHAR(15) NOT NULL DEFAULT 'PENDING',
    "sourceEntryId" UUID,
    "costCenterId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceFeeReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCurrencyRate" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "rate" DECIMAL(12,4) NOT NULL,
    "source" VARCHAR(50) NOT NULL DEFAULT 'BANCO_CENTRAL_CL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceCurrencyRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTaxSetting" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "environment" VARCHAR(15) NOT NULL DEFAULT 'CERTIFICACION',
    "ppmRate" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "feeRetentionRate" DECIMAL(5,2) NOT NULL DEFAULT 13.75,
    "autoAcuseDte" BOOLEAN NOT NULL DEFAULT false,
    "siiCertificateExpiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceTaxSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceVendor_tenantId_razonSocial_idx" ON "FinanceVendor"("tenantId", "razonSocial");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceVendor_tenantId_id_key" ON "FinanceVendor"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceVendor_tenantId_rut_key" ON "FinanceVendor"("tenantId", "rut");

-- CreateIndex
CREATE INDEX "FinancePurchaseOrder_tenantId_vendorId_date_idx" ON "FinancePurchaseOrder"("tenantId", "vendorId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePurchaseOrder_tenantId_id_key" ON "FinancePurchaseOrder"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePurchaseOrder_tenantId_folio_key" ON "FinancePurchaseOrder"("tenantId", "folio");

-- CreateIndex
CREATE INDEX "FinancePurchaseOrderItem_orderId_idx" ON "FinancePurchaseOrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePayable_sourceEntryId_key" ON "FinancePayable"("sourceEntryId");

-- CreateIndex
CREATE INDEX "FinancePayable_tenantId_vendorId_dueDate_idx" ON "FinancePayable"("tenantId", "vendorId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePayable_tenantId_id_key" ON "FinancePayable"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePayable_tenantId_vendorId_documentType_folio_key" ON "FinancePayable"("tenantId", "vendorId", "documentType", "folio");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceVendorPayment_entryId_key" ON "FinanceVendorPayment"("entryId");

-- CreateIndex
CREATE INDEX "FinanceVendorPayment_tenantId_vendorId_date_idx" ON "FinanceVendorPayment"("tenantId", "vendorId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceVendorPayment_tenantId_id_key" ON "FinanceVendorPayment"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceVendorPayment_tenantId_idempotencyKey_key" ON "FinanceVendorPayment"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceVendorPaymentReversal_paymentId_key" ON "FinanceVendorPaymentReversal"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceVendorPaymentReversal_entryId_key" ON "FinanceVendorPaymentReversal"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceVendorPaymentReversal_tenantId_idempotencyKey_key" ON "FinanceVendorPaymentReversal"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceVendorCreditAllocation_tenantId_id_key" ON "FinanceVendorCreditAllocation"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceVendorCreditAllocation_tenantId_idempotencyKey_key" ON "FinanceVendorCreditAllocation"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceVendorCreditAllocationReversal_allocationId_key" ON "FinanceVendorCreditAllocationReversal"("allocationId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceVendorCreditAllocationReversal_tenantId_idempotencyK_key" ON "FinanceVendorCreditAllocationReversal"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FinanceCashBox_tenantId_isActive_idx" ON "FinanceCashBox"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCashBox_tenantId_id_key" ON "FinanceCashBox"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCashBox_tenantId_name_key" ON "FinanceCashBox"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCashShift_differenceEntryId_key" ON "FinanceCashShift"("differenceEntryId");

-- CreateIndex
CREATE INDEX "FinanceCashShift_tenantId_cashBoxId_status_idx" ON "FinanceCashShift"("tenantId", "cashBoxId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCashShift_tenantId_id_key" ON "FinanceCashShift"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceDirectMovement_entryId_key" ON "FinanceDirectMovement"("entryId");

-- CreateIndex
CREATE INDEX "FinanceDirectMovement_tenantId_date_type_idx" ON "FinanceDirectMovement"("tenantId", "date", "type");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceDirectMovement_tenantId_id_key" ON "FinanceDirectMovement"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceDirectMovement_tenantId_idempotencyKey_key" ON "FinanceDirectMovement"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceDirectMovementReversal_movementId_key" ON "FinanceDirectMovementReversal"("movementId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceDirectMovementReversal_entryId_key" ON "FinanceDirectMovementReversal"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceDirectMovementReversal_tenantId_idempotencyKey_key" ON "FinanceDirectMovementReversal"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceInternalTransfer_entryId_key" ON "FinanceInternalTransfer"("entryId");

-- CreateIndex
CREATE INDEX "FinanceInternalTransfer_tenantId_date_idx" ON "FinanceInternalTransfer"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceInternalTransfer_tenantId_id_key" ON "FinanceInternalTransfer"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceInternalTransfer_tenantId_idempotencyKey_key" ON "FinanceInternalTransfer"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FinancePaymentRequest_tenantId_status_dueDate_idx" ON "FinancePaymentRequest"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePaymentRequest_tenantId_id_key" ON "FinancePaymentRequest"("tenantId", "id");

-- CreateIndex
CREATE INDEX "FinanceBankAccount_tenantId_bankCode_idx" ON "FinanceBankAccount"("tenantId", "bankCode");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBankAccount_tenantId_id_key" ON "FinanceBankAccount"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBankAccount_tenantId_accountNumber_key" ON "FinanceBankAccount"("tenantId", "accountNumber");

-- CreateIndex
CREATE INDEX "FinanceBankStatement_tenantId_bankAccountId_importedAt_idx" ON "FinanceBankStatement"("tenantId", "bankAccountId", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBankStatement_tenantId_id_key" ON "FinanceBankStatement"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBankStatement_tenantId_fileHash_key" ON "FinanceBankStatement"("tenantId", "fileHash");

-- CreateIndex
CREATE INDEX "FinanceBankStatementLine_tenantId_bankAccountId_transaction_idx" ON "FinanceBankStatementLine"("tenantId", "bankAccountId", "transactionDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBankStatementLine_tenantId_id_key" ON "FinanceBankStatementLine"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBankStatementLine_tenantId_lineHash_key" ON "FinanceBankStatementLine"("tenantId", "lineHash");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBankReconciliation_statementLineId_key" ON "FinanceBankReconciliation"("statementLineId");

-- CreateIndex
CREATE INDEX "FinanceBankReconciliation_tenantId_reconciledAt_idx" ON "FinanceBankReconciliation"("tenantId", "reconciledAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBankReconciliation_tenantId_id_key" ON "FinanceBankReconciliation"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBankReconciliation_tenantId_statementLineId_key" ON "FinanceBankReconciliation"("tenantId", "statementLineId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBankReconciliationReversal_tenantId_id_key" ON "FinanceBankReconciliationReversal"("tenantId", "id");

-- CreateIndex
CREATE INDEX "FinanceBankRule_tenantId_isActive_idx" ON "FinanceBankRule"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBankRule_tenantId_id_key" ON "FinanceBankRule"("tenantId", "id");

-- CreateIndex
CREATE INDEX "FinanceCostCenter_tenantId_isActive_idx" ON "FinanceCostCenter"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCostCenter_tenantId_id_key" ON "FinanceCostCenter"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCostCenter_tenantId_code_key" ON "FinanceCostCenter"("tenantId", "code");

-- CreateIndex
CREATE INDEX "FinanceCustomAccount_tenantId_isActive_idx" ON "FinanceCustomAccount"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCustomAccount_tenantId_id_key" ON "FinanceCustomAccount"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCustomAccount_tenantId_code_key" ON "FinanceCustomAccount"("tenantId", "code");

-- CreateIndex
CREATE INDEX "FinanceFiscalYear_tenantId_status_idx" ON "FinanceFiscalYear"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceFiscalYear_tenantId_id_key" ON "FinanceFiscalYear"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceFiscalYear_tenantId_year_key" ON "FinanceFiscalYear"("tenantId", "year");

-- CreateIndex
CREATE INDEX "FinanceReceivedDte_tenantId_status_idx" ON "FinanceReceivedDte"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FinanceReceivedDte_tenantId_date_idx" ON "FinanceReceivedDte"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceivedDte_tenantId_id_key" ON "FinanceReceivedDte"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceReceivedDte_tenantId_senderRut_documentType_folio_key" ON "FinanceReceivedDte"("tenantId", "senderRut", "documentType", "folio");

-- CreateIndex
CREATE INDEX "FinanceTaxF29Declaration_tenantId_status_idx" ON "FinanceTaxF29Declaration"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTaxF29Declaration_tenantId_id_key" ON "FinanceTaxF29Declaration"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTaxF29Declaration_tenantId_period_key" ON "FinanceTaxF29Declaration"("tenantId", "period");

-- CreateIndex
CREATE INDEX "FinanceBudget_tenantId_status_idx" ON "FinanceBudget"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBudget_tenantId_id_key" ON "FinanceBudget"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBudget_tenantId_year_name_key" ON "FinanceBudget"("tenantId", "year", "name");

-- CreateIndex
CREATE INDEX "FinanceBudgetItem_tenantId_budgetId_idx" ON "FinanceBudgetItem"("tenantId", "budgetId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceBudgetItem_budgetId_accountCode_month_key" ON "FinanceBudgetItem"("budgetId", "accountCode", "month");

-- CreateIndex
CREATE INDEX "FinanceFixedAsset_tenantId_status_idx" ON "FinanceFixedAsset"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceFixedAsset_tenantId_id_key" ON "FinanceFixedAsset"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceFixedAsset_tenantId_code_key" ON "FinanceFixedAsset"("tenantId", "code");

-- CreateIndex
CREATE INDEX "FinancePayrollEmployee_tenantId_isActive_idx" ON "FinancePayrollEmployee"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePayrollEmployee_tenantId_id_key" ON "FinancePayrollEmployee"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePayrollEmployee_tenantId_rut_key" ON "FinancePayrollEmployee"("tenantId", "rut");

-- CreateIndex
CREATE INDEX "FinancePayrollSlip_tenantId_period_idx" ON "FinancePayrollSlip"("tenantId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePayrollSlip_tenantId_id_key" ON "FinancePayrollSlip"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinancePayrollSlip_tenantId_employeeId_period_key" ON "FinancePayrollSlip"("tenantId", "employeeId", "period");

-- CreateIndex
CREATE INDEX "FinanceFeeReceipt_tenantId_status_idx" ON "FinanceFeeReceipt"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceFeeReceipt_tenantId_id_key" ON "FinanceFeeReceipt"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceFeeReceipt_tenantId_rut_folio_key" ON "FinanceFeeReceipt"("tenantId", "rut", "folio");

-- CreateIndex
CREATE INDEX "FinanceCurrencyRate_currency_date_idx" ON "FinanceCurrencyRate"("currency", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCurrencyRate_date_currency_key" ON "FinanceCurrencyRate"("date", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTaxSetting_tenantId_id_key" ON "FinanceTaxSetting"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTaxSetting_tenantId_key" ON "FinanceTaxSetting"("tenantId");

-- CreateIndex
CREATE INDEX "FinanceEntryLine_costCenterId_idx" ON "FinanceEntryLine"("costCenterId");

-- AddForeignKey
ALTER TABLE "FinanceEntryLine" ADD CONSTRAINT "FinanceEntryLine_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "FinanceCostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceVendor" ADD CONSTRAINT "FinanceVendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePurchaseOrder" ADD CONSTRAINT "FinancePurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePurchaseOrder" ADD CONSTRAINT "FinancePurchaseOrder_tenantId_vendorId_fkey" FOREIGN KEY ("tenantId", "vendorId") REFERENCES "FinanceVendor"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePurchaseOrderItem" ADD CONSTRAINT "FinancePurchaseOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FinancePurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayable" ADD CONSTRAINT "FinancePayable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayable" ADD CONSTRAINT "FinancePayable_tenantId_vendorId_fkey" FOREIGN KEY ("tenantId", "vendorId") REFERENCES "FinanceVendor"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayable" ADD CONSTRAINT "FinancePayable_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "FinancePurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayable" ADD CONSTRAINT "FinancePayable_tenantId_sourceEntryId_fkey" FOREIGN KEY ("tenantId", "sourceEntryId") REFERENCES "FinanceEntry"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceVendorPayment" ADD CONSTRAINT "FinanceVendorPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceVendorPayment" ADD CONSTRAINT "FinanceVendorPayment_tenantId_payableId_fkey" FOREIGN KEY ("tenantId", "payableId") REFERENCES "FinancePayable"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceVendorPayment" ADD CONSTRAINT "FinanceVendorPayment_tenantId_vendorId_fkey" FOREIGN KEY ("tenantId", "vendorId") REFERENCES "FinanceVendor"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceVendorPayment" ADD CONSTRAINT "FinanceVendorPayment_tenantId_entryId_fkey" FOREIGN KEY ("tenantId", "entryId") REFERENCES "FinanceEntry"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceVendorPaymentReversal" ADD CONSTRAINT "FinanceVendorPaymentReversal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceVendorPaymentReversal" ADD CONSTRAINT "FinanceVendorPaymentReversal_tenantId_paymentId_fkey" FOREIGN KEY ("tenantId", "paymentId") REFERENCES "FinanceVendorPayment"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceVendorPaymentReversal" ADD CONSTRAINT "FinanceVendorPaymentReversal_tenantId_entryId_fkey" FOREIGN KEY ("tenantId", "entryId") REFERENCES "FinanceEntry"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceVendorCreditAllocation" ADD CONSTRAINT "FinanceVendorCreditAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceVendorCreditAllocation" ADD CONSTRAINT "FinanceVendorCreditAllocation_tenantId_creditId_fkey" FOREIGN KEY ("tenantId", "creditId") REFERENCES "FinancePayable"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceVendorCreditAllocation" ADD CONSTRAINT "FinanceVendorCreditAllocation_tenantId_invoiceId_fkey" FOREIGN KEY ("tenantId", "invoiceId") REFERENCES "FinancePayable"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceVendorCreditAllocationReversal" ADD CONSTRAINT "FinanceVendorCreditAllocationReversal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceVendorCreditAllocationReversal" ADD CONSTRAINT "FinanceVendorCreditAllocationReversal_tenantId_allocationI_fkey" FOREIGN KEY ("tenantId", "allocationId") REFERENCES "FinanceVendorCreditAllocation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCashBox" ADD CONSTRAINT "FinanceCashBox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCashShift" ADD CONSTRAINT "FinanceCashShift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCashShift" ADD CONSTRAINT "FinanceCashShift_tenantId_cashBoxId_fkey" FOREIGN KEY ("tenantId", "cashBoxId") REFERENCES "FinanceCashBox"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDirectMovement" ADD CONSTRAINT "FinanceDirectMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDirectMovement" ADD CONSTRAINT "FinanceDirectMovement_tenantId_cashBoxId_fkey" FOREIGN KEY ("tenantId", "cashBoxId") REFERENCES "FinanceCashBox"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDirectMovement" ADD CONSTRAINT "FinanceDirectMovement_tenantId_shiftId_fkey" FOREIGN KEY ("tenantId", "shiftId") REFERENCES "FinanceCashShift"("tenantId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDirectMovement" ADD CONSTRAINT "FinanceDirectMovement_tenantId_entryId_fkey" FOREIGN KEY ("tenantId", "entryId") REFERENCES "FinanceEntry"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDirectMovementReversal" ADD CONSTRAINT "FinanceDirectMovementReversal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDirectMovementReversal" ADD CONSTRAINT "FinanceDirectMovementReversal_tenantId_movementId_fkey" FOREIGN KEY ("tenantId", "movementId") REFERENCES "FinanceDirectMovement"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDirectMovementReversal" ADD CONSTRAINT "FinanceDirectMovementReversal_tenantId_entryId_fkey" FOREIGN KEY ("tenantId", "entryId") REFERENCES "FinanceEntry"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInternalTransfer" ADD CONSTRAINT "FinanceInternalTransfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInternalTransfer" ADD CONSTRAINT "FinanceInternalTransfer_tenantId_fromCashBoxId_fkey" FOREIGN KEY ("tenantId", "fromCashBoxId") REFERENCES "FinanceCashBox"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInternalTransfer" ADD CONSTRAINT "FinanceInternalTransfer_tenantId_toCashBoxId_fkey" FOREIGN KEY ("tenantId", "toCashBoxId") REFERENCES "FinanceCashBox"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInternalTransfer" ADD CONSTRAINT "FinanceInternalTransfer_tenantId_entryId_fkey" FOREIGN KEY ("tenantId", "entryId") REFERENCES "FinanceEntry"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePaymentRequest" ADD CONSTRAINT "FinancePaymentRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBankAccount" ADD CONSTRAINT "FinanceBankAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBankStatement" ADD CONSTRAINT "FinanceBankStatement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBankStatement" ADD CONSTRAINT "FinanceBankStatement_tenantId_bankAccountId_fkey" FOREIGN KEY ("tenantId", "bankAccountId") REFERENCES "FinanceBankAccount"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBankStatementLine" ADD CONSTRAINT "FinanceBankStatementLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBankStatementLine" ADD CONSTRAINT "FinanceBankStatementLine_tenantId_statementId_fkey" FOREIGN KEY ("tenantId", "statementId") REFERENCES "FinanceBankStatement"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBankStatementLine" ADD CONSTRAINT "FinanceBankStatementLine_tenantId_bankAccountId_fkey" FOREIGN KEY ("tenantId", "bankAccountId") REFERENCES "FinanceBankAccount"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBankReconciliation" ADD CONSTRAINT "FinanceBankReconciliation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBankReconciliation" ADD CONSTRAINT "FinanceBankReconciliation_tenantId_statementLineId_fkey" FOREIGN KEY ("tenantId", "statementLineId") REFERENCES "FinanceBankStatementLine"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBankReconciliationReversal" ADD CONSTRAINT "FinanceBankReconciliationReversal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBankReconciliationReversal" ADD CONSTRAINT "FinanceBankReconciliationReversal_tenantId_reconciliationI_fkey" FOREIGN KEY ("tenantId", "reconciliationId") REFERENCES "FinanceBankReconciliation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBankRule" ADD CONSTRAINT "FinanceBankRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCostCenter" ADD CONSTRAINT "FinanceCostCenter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCustomAccount" ADD CONSTRAINT "FinanceCustomAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceFiscalYear" ADD CONSTRAINT "FinanceFiscalYear_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceivedDte" ADD CONSTRAINT "FinanceReceivedDte_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceReceivedDte" ADD CONSTRAINT "FinanceReceivedDte_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "FinancePayable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTaxF29Declaration" ADD CONSTRAINT "FinanceTaxF29Declaration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudget" ADD CONSTRAINT "FinanceBudget_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudgetItem" ADD CONSTRAINT "FinanceBudgetItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudgetItem" ADD CONSTRAINT "FinanceBudgetItem_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "FinanceBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBudgetItem" ADD CONSTRAINT "FinanceBudgetItem_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "FinanceCostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceFixedAsset" ADD CONSTRAINT "FinanceFixedAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceFixedAsset" ADD CONSTRAINT "FinanceFixedAsset_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "FinanceCostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayrollEmployee" ADD CONSTRAINT "FinancePayrollEmployee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayrollEmployee" ADD CONSTRAINT "FinancePayrollEmployee_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "FinanceCostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayrollSlip" ADD CONSTRAINT "FinancePayrollSlip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePayrollSlip" ADD CONSTRAINT "FinancePayrollSlip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "FinancePayrollEmployee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceFeeReceipt" ADD CONSTRAINT "FinanceFeeReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceFeeReceipt" ADD CONSTRAINT "FinanceFeeReceipt_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "FinanceCostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTaxSetting" ADD CONSTRAINT "FinanceTaxSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

