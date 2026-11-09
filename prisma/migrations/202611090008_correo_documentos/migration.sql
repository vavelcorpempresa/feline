-- Envío por correo de los documentos al receptor (aditiva: no modifica datos existentes)
ALTER TABLE "documentos_dte" ADD COLUMN "correoDestino" VARCHAR(120);
ALTER TABLE "documentos_dte" ADD COLUMN "correoPendiente" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documentos_dte" ADD COLUMN "correoSolicitadoAt" TIMESTAMP(3);
ALTER TABLE "documentos_dte" ADD COLUMN "correoSiguienteAt" TIMESTAMP(3);
ALTER TABLE "documentos_dte" ADD COLUMN "correoIntentos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "documentos_dte" ADD COLUMN "correoEnviadoAt" TIMESTAMP(3);
ALTER TABLE "documentos_dte" ADD COLUMN "correoError" VARCHAR(500);

CREATE INDEX "documentos_dte_correoPendiente_correoSiguienteAt_idx" ON "documentos_dte"("correoPendiente", "correoSiguienteAt");
