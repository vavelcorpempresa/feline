# Integración FELINE y FUGAR

FUGAR usa Next.js 16.3.5 y Prisma con PostgreSQL según el checkout inspeccionado. FELINE usa Fastify y Prisma. Se reutiliza /v1/documentos, /v1/empresa y el SDK sdk/feline-client.ts. El contrato OpenAPI 3.1 se publica en /v1/openapi.json. El archivo YAML usa sintaxis JSON, compatible con YAML 1.2.

En FUGAR la confirmación de pago dispara fulfillPaidOrder y createDteForPaidOrder. La ruta administrativa de pedido y el reintento Comercial llaman al mismo servicio. El servicio consulta el pedido, subórdenes y pagos persistidos. Solo habilita la venta física afecta de una tienda configurada. Verifica un único pago COMPLETED en CLP con ID externo y monto igual al total. La preferencia fiscal se lee de los datos persistidos del checkout.

FUGAR envía referenciaExterna igual al ID del pedido, montoConfirmado y una clave estable por pedido. FELINE autentica la empresa y compara el total tributario calculado antes de reservar folio. La transacción del motor vincula el DTE a su reserva de idempotencia. La API devuelve el estado alcanzado y el identificador del DTE. 202 no implica aceptación del SII.
