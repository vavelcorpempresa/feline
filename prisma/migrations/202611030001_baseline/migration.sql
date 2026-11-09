-- CreateEnum
CREATE TYPE "SiiEnvironment" AS ENUM ('CERTIFICACION', 'PRODUCCION');

-- CreateEnum
CREATE TYPE "L10nClTaxpayerType" AS ENUM ('VAT_AFFECTED_1ST_CAT', 'FEES_RECEIPT_ISSUER', 'END_CONSUMER', 'FOREIGNER');

-- CreateEnum
CREATE TYPE "AccountMoveState" AS ENUM ('DRAFT', 'POSTED', 'CANCEL');

-- CreateEnum
CREATE TYPE "AccountMovePaymentState" AS ENUM ('NOT_PAID', 'IN_PAYMENT', 'PAID', 'PARTIAL', 'REVERSED');

-- CreateEnum
CREATE TYPE "AccountMoveType" AS ENUM ('OUT_INVOICE', 'OUT_REFUND', 'IN_INVOICE', 'IN_REFUND', 'ENTRY');

-- CreateEnum
CREATE TYPE "AccountJournalType" AS ENUM ('SALE', 'PURCHASE', 'CASH', 'BANK', 'GENERAL');

-- CreateEnum
CREATE TYPE "OdooAccountType" AS ENUM ('ASSET_RECEIVABLE', 'ASSET_CASH', 'ASSET_CURRENT', 'ASSET_NON_CURRENT', 'ASSET_PREPAYMENTS', 'ASSET_FIXED', 'LIABILITY_PAYABLE', 'LIABILITY_CREDIT_CARD', 'LIABILITY_CURRENT', 'LIABILITY_NON_CURRENT', 'EQUITY', 'EQUITY_UNAFFECTED', 'INCOME', 'INCOME_OTHER', 'EXPENSE', 'EXPENSE_DEPRECIATION', 'EXPENSE_DIRECT_COST', 'OFF_BALANCE');

-- CreateEnum
CREATE TYPE "OdooAccountInternalGroup" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE', 'OFF');

-- CreateEnum
CREATE TYPE "DteStatus" AS ENUM ('PENDIENTE', 'FIRMADO', 'EN_LOTE', 'ENVIADO', 'ACEPTADO', 'ACEPTADO_CON_REPARO', 'RECHAZADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "EnvioStatus" AS ENUM ('GENERADO', 'ENVIADO', 'PROCESANDO', 'ACEPTADO', 'RECHAZADO', 'ERROR_CONEXION');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "rut" VARCHAR(12) NOT NULL,
    "razonSocial" VARCHAR(100) NOT NULL,
    "giro" VARCHAR(80) NOT NULL,
    "acteco" INTEGER[],
    "taxpayerType" "L10nClTaxpayerType" NOT NULL DEFAULT 'VAT_AFFECTED_1ST_CAT',
    "direccionOrigen" VARCHAR(70) NOT NULL,
    "comunaOrigen" VARCHAR(20) NOT NULL,
    "ciudadOrigen" VARCHAR(20) NOT NULL,
    "codigoSucursal" VARCHAR(20),
    "fchResol" DATE NOT NULL,
    "nroResol" INTEGER NOT NULL,
    "rutEnvia" VARCHAR(12) NOT NULL,
    "environment" "SiiEnvironment" NOT NULL DEFAULT 'CERTIFICACION',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_accounts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "accountType" "OdooAccountType" NOT NULL,
    "internalGroup" "OdooAccountInternalGroup" NOT NULL,
    "reconcile" BOOLEAN NOT NULL DEFAULT false,
    "includeInitialBalance" BOOLEAN NOT NULL DEFAULT true,
    "siiF22Code" INTEGER,
    "deprecated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificados_digitales" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "rutTitular" VARCHAR(12) NOT NULL,
    "nombreTitular" VARCHAR(100) NOT NULL,
    "pfxEncrypted" BYTEA NOT NULL,
    "pfxIv" VARCHAR(64) NOT NULL,
    "pfxAuthTag" VARCHAR(64) NOT NULL,
    "passphraseEncrypted" TEXT NOT NULL,
    "passphraseIv" VARCHAR(64) NOT NULL,
    "passphraseAuthTag" VARCHAR(64) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificados_digitales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes_receptores" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "rut" VARCHAR(12) NOT NULL,
    "razonSocial" VARCHAR(100) NOT NULL,
    "giro" VARCHAR(40) NOT NULL,
    "taxpayerType" "L10nClTaxpayerType" NOT NULL DEFAULT 'VAT_AFFECTED_1ST_CAT',
    "countryCode" VARCHAR(2) NOT NULL DEFAULT 'CL',
    "direccion" VARCHAR(70) NOT NULL,
    "comuna" VARCHAR(20) NOT NULL,
    "ciudad" VARCHAR(20) NOT NULL,
    "contacto" VARCHAR(80),
    "correoDte" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_receptores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "l10n_latam_document_types" (
    "code" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "reportName" VARCHAR(60) NOT NULL,
    "internalType" VARCHAR(30) NOT NULL,
    "docCodePrefix" VARCHAR(10) NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL DEFAULT 'CL',
    "l10nClActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "l10n_latam_document_types_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "account_journals" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "type" "AccountJournalType" NOT NULL DEFAULT 'SALE',
    "l10nLatamUseDocuments" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_taxes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "amount" DECIMAL(5,2) NOT NULL,
    "amountType" TEXT NOT NULL DEFAULT 'percent',
    "typeTaxUse" TEXT NOT NULL DEFAULT 'sale',
    "priceInclude" BOOLEAN NOT NULL DEFAULT false,
    "siiTaxCode" INTEGER,
    "isExempt" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "account_taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_moves" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "journalId" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "documentTypeCode" INTEGER NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "l10nLatamDocumentNumber" VARCHAR(20),
    "moveType" "AccountMoveType" NOT NULL DEFAULT 'OUT_INVOICE',
    "state" "AccountMoveState" NOT NULL DEFAULT 'DRAFT',
    "paymentState" "AccountMovePaymentState" NOT NULL DEFAULT 'NOT_PAID',
    "invoiceDate" DATE NOT NULL,
    "invoiceDateDue" DATE,
    "formaPagoSii" INTEGER NOT NULL DEFAULT 1,
    "amountUntaxed" INTEGER NOT NULL DEFAULT 0,
    "amountExempt" INTEGER NOT NULL DEFAULT 0,
    "amountTax" INTEGER NOT NULL DEFAULT 0,
    "amountTotal" INTEGER NOT NULL DEFAULT 0,
    "amountResidual" INTEGER NOT NULL DEFAULT 0,
    "reversedEntryId" UUID,
    "documentoDteId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_moves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_move_lines" (
    "id" UUID NOT NULL,
    "moveId" UUID NOT NULL,
    "accountId" UUID,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "productCode" VARCHAR(35),
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(1000),
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "uomName" VARCHAR(4) NOT NULL DEFAULT 'UN',
    "priceUnit" DECIMAL(14,2) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discountFixed" INTEGER NOT NULL DEFAULT 0,
    "isExempt" BOOLEAN NOT NULL DEFAULT false,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 19.0,
    "priceSubtotal" INTEGER NOT NULL,
    "priceTotal" INTEGER NOT NULL,
    "debit" INTEGER NOT NULL DEFAULT 0,
    "credit" INTEGER NOT NULL DEFAULT 0,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "matchingNumber" VARCHAR(20),

    CONSTRAINT "account_move_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "l10n_cl_account_references" (
    "id" UUID NOT NULL,
    "moveId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "originDocTypeCode" VARCHAR(3) NOT NULL,
    "originDocNumber" VARCHAR(18) NOT NULL,
    "referenceDocCode" INTEGER,
    "reason" VARCHAR(90),
    "date" DATE NOT NULL,

    CONSTRAINT "l10n_cl_account_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_payments" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "moveId" UUID NOT NULL,
    "journalId" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentDate" DATE NOT NULL,
    "reference" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caf_folios" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "tipoDte" INTEGER NOT NULL,
    "folioDesde" INTEGER NOT NULL,
    "folioHasta" INTEGER NOT NULL,
    "folioActual" INTEGER NOT NULL,
    "fechaAutorizacion" DATE NOT NULL,
    "xmlCafNodo" TEXT NOT NULL,
    "privateKeyEncrypted" TEXT NOT NULL,
    "privateKeyIv" VARCHAR(64) NOT NULL,
    "privateKeyAuthTag" VARCHAR(64) NOT NULL,
    "publicKeyModulus" TEXT NOT NULL,
    "publicKeyExponent" VARCHAR(32) NOT NULL,
    "agotado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caf_folios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_dte" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "receptorId" UUID NOT NULL,
    "cafId" UUID NOT NULL,
    "envioLoteId" UUID,
    "apiClientId" UUID,
    "referenciaExterna" VARCHAR(100),
    "tipoDte" INTEGER NOT NULL,
    "folio" INTEGER NOT NULL,
    "fechaEmision" DATE NOT NULL,
    "fechaVenc" DATE,
    "indServicio" INTEGER,
    "mntNeto" INTEGER NOT NULL DEFAULT 0,
    "mntExento" INTEGER NOT NULL DEFAULT 0,
    "tasaIva" DECIMAL(5,2) NOT NULL DEFAULT 19.0,
    "iva" INTEGER NOT NULL DEFAULT 0,
    "mntTotal" INTEGER NOT NULL,
    "detallesJson" JSONB NOT NULL,
    "referenciasJson" JSONB,
    "tedXml" TEXT,
    "dteXmlFirmado" TEXT,
    "estado" "DteStatus" NOT NULL DEFAULT 'PENDIENTE',
    "glosaEstadoSii" TEXT,
    "trackId" VARCHAR(32),
    "siiConsultadoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_dte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envios_dte_lotes" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "rutEmisor" VARCHAR(12) NOT NULL,
    "rutEnvia" VARCHAR(12) NOT NULL,
    "rutReceptor" VARCHAR(12) NOT NULL DEFAULT '60803000-K',
    "esBoleta" BOOLEAN NOT NULL DEFAULT false,
    "trackId" VARCHAR(32),
    "xmlEnvio" TEXT NOT NULL,
    "estado" "EnvioStatus" NOT NULL DEFAULT 'GENERADO',
    "respuestaSii" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envios_dte_lotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_clients" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY['documentos:emitir', 'documentos:leer', 'empresa:leer']::TEXT[],
    "keyPrefix" VARCHAR(16) NOT NULL,
    "keyHash" VARCHAR(64) NOT NULL,
    "webhookUrl" VARCHAR(500),
    "webhookSecret" VARCHAR(200),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_idempotencias" (
    "id" UUID NOT NULL,
    "apiClientId" UUID NOT NULL,
    "clave" VARCHAR(200) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "documentoId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_idempotencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_eventos" (
    "id" UUID NOT NULL,
    "apiClientId" UUID NOT NULL,
    "documentoId" UUID,
    "evento" VARCHAR(40) NOT NULL DEFAULT 'documento.estado',
    "payload" JSONB NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "proximoIntento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregadoAt" TIMESTAMP(3),
    "ultimoError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folios_sin_uso" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "tipoDte" INTEGER NOT NULL,
    "folio" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "anuladoAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folios_sin_uso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_rut_key" ON "tenants"("rut");

-- CreateIndex
CREATE INDEX "tenants_rut_idx" ON "tenants"("rut");

-- CreateIndex
CREATE INDEX "account_accounts_tenantId_internalGroup_idx" ON "account_accounts"("tenantId", "internalGroup");

-- CreateIndex
CREATE UNIQUE INDEX "account_accounts_tenantId_code_key" ON "account_accounts"("tenantId", "code");

-- CreateIndex
CREATE INDEX "certificados_digitales_tenantId_isActive_idx" ON "certificados_digitales"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "clientes_receptores_tenantId_idx" ON "clientes_receptores"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_receptores_tenantId_rut_key" ON "clientes_receptores"("tenantId", "rut");

-- CreateIndex
CREATE INDEX "account_journals_tenantId_type_idx" ON "account_journals"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "account_journals_tenantId_code_key" ON "account_journals"("tenantId", "code");

-- CreateIndex
CREATE INDEX "account_taxes_tenantId_typeTaxUse_idx" ON "account_taxes"("tenantId", "typeTaxUse");

-- CreateIndex
CREATE UNIQUE INDEX "account_moves_documentoDteId_key" ON "account_moves"("documentoDteId");

-- CreateIndex
CREATE INDEX "account_moves_tenantId_state_moveType_idx" ON "account_moves"("tenantId", "state", "moveType");

-- CreateIndex
CREATE INDEX "account_moves_tenantId_documentTypeCode_l10nLatamDocumentNu_idx" ON "account_moves"("tenantId", "documentTypeCode", "l10nLatamDocumentNumber");

-- CreateIndex
CREATE INDEX "account_move_lines_moveId_idx" ON "account_move_lines"("moveId");

-- CreateIndex
CREATE INDEX "account_move_lines_accountId_idx" ON "account_move_lines"("accountId");

-- CreateIndex
CREATE INDEX "l10n_cl_account_references_moveId_idx" ON "l10n_cl_account_references"("moveId");

-- CreateIndex
CREATE INDEX "account_payments_tenantId_moveId_idx" ON "account_payments"("tenantId", "moveId");

-- CreateIndex
CREATE INDEX "caf_folios_tenantId_tipoDte_activo_agotado_idx" ON "caf_folios"("tenantId", "tipoDte", "activo", "agotado");

-- CreateIndex
CREATE UNIQUE INDEX "caf_folios_tenantId_tipoDte_folioDesde_folioHasta_key" ON "caf_folios"("tenantId", "tipoDte", "folioDesde", "folioHasta");

-- CreateIndex
CREATE INDEX "documentos_dte_tenantId_estado_idx" ON "documentos_dte"("tenantId", "estado");

-- CreateIndex
CREATE INDEX "documentos_dte_tenantId_trackId_idx" ON "documentos_dte"("tenantId", "trackId");

-- CreateIndex
CREATE INDEX "documentos_dte_apiClientId_referenciaExterna_idx" ON "documentos_dte"("apiClientId", "referenciaExterna");

-- CreateIndex
CREATE INDEX "documentos_dte_tenantId_createdAt_idx" ON "documentos_dte"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_dte_tenantId_tipoDte_folio_key" ON "documentos_dte"("tenantId", "tipoDte", "folio");

-- CreateIndex
CREATE INDEX "envios_dte_lotes_tenantId_trackId_idx" ON "envios_dte_lotes"("tenantId", "trackId");

-- CreateIndex
CREATE UNIQUE INDEX "api_clients_keyHash_key" ON "api_clients"("keyHash");

-- CreateIndex
CREATE INDEX "api_clients_tenantId_idx" ON "api_clients"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "api_idempotencias_apiClientId_clave_key" ON "api_idempotencias"("apiClientId", "clave");

-- CreateIndex
CREATE INDEX "webhook_eventos_entregadoAt_proximoIntento_idx" ON "webhook_eventos"("entregadoAt", "proximoIntento");

-- CreateIndex
CREATE INDEX "folios_sin_uso_tenantId_anuladoAt_idx" ON "folios_sin_uso"("tenantId", "anuladoAt");

-- CreateIndex
CREATE UNIQUE INDEX "folios_sin_uso_tenantId_tipoDte_folio_key" ON "folios_sin_uso"("tenantId", "tipoDte", "folio");

-- AddForeignKey
ALTER TABLE "account_accounts" ADD CONSTRAINT "account_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados_digitales" ADD CONSTRAINT "certificados_digitales_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes_receptores" ADD CONSTRAINT "clientes_receptores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_journals" ADD CONSTRAINT "account_journals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_taxes" ADD CONSTRAINT "account_taxes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_moves" ADD CONSTRAINT "account_moves_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_moves" ADD CONSTRAINT "account_moves_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "account_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_moves" ADD CONSTRAINT "account_moves_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "clientes_receptores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_moves" ADD CONSTRAINT "account_moves_documentTypeCode_fkey" FOREIGN KEY ("documentTypeCode") REFERENCES "l10n_latam_document_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_moves" ADD CONSTRAINT "account_moves_reversedEntryId_fkey" FOREIGN KEY ("reversedEntryId") REFERENCES "account_moves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_moves" ADD CONSTRAINT "account_moves_documentoDteId_fkey" FOREIGN KEY ("documentoDteId") REFERENCES "documentos_dte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_move_lines" ADD CONSTRAINT "account_move_lines_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "account_moves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_move_lines" ADD CONSTRAINT "account_move_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "l10n_cl_account_references" ADD CONSTRAINT "l10n_cl_account_references_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "account_moves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_payments" ADD CONSTRAINT "account_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_payments" ADD CONSTRAINT "account_payments_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "account_moves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_payments" ADD CONSTRAINT "account_payments_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "account_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_payments" ADD CONSTRAINT "account_payments_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "clientes_receptores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caf_folios" ADD CONSTRAINT "caf_folios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_dte" ADD CONSTRAINT "documentos_dte_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_dte" ADD CONSTRAINT "documentos_dte_receptorId_fkey" FOREIGN KEY ("receptorId") REFERENCES "clientes_receptores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_dte" ADD CONSTRAINT "documentos_dte_cafId_fkey" FOREIGN KEY ("cafId") REFERENCES "caf_folios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_dte" ADD CONSTRAINT "documentos_dte_envioLoteId_fkey" FOREIGN KEY ("envioLoteId") REFERENCES "envios_dte_lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_dte" ADD CONSTRAINT "documentos_dte_apiClientId_fkey" FOREIGN KEY ("apiClientId") REFERENCES "api_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios_dte_lotes" ADD CONSTRAINT "envios_dte_lotes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_clients" ADD CONSTRAINT "api_clients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_idempotencias" ADD CONSTRAINT "api_idempotencias_apiClientId_fkey" FOREIGN KEY ("apiClientId") REFERENCES "api_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_idempotencias" ADD CONSTRAINT "api_idempotencias_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documentos_dte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_eventos" ADD CONSTRAINT "webhook_eventos_apiClientId_fkey" FOREIGN KEY ("apiClientId") REFERENCES "api_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_eventos" ADD CONSTRAINT "webhook_eventos_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "documentos_dte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folios_sin_uso" ADD CONSTRAINT "folios_sin_uso_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

