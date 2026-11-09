# Pendientes

- Colas persistentes de solicitudes y reconciliación tras reinicios. El registro Comercial de FUGAR sigue usando su archivo existente, con protección local e idempotencia persistente en FELINE para la misma credencial.
- Configuración multiemisor por tienda con autorización tributaria, segregación de comisiones, eventos y crowdfunding, y asociación de NC con devoluciones.
- Paneles solicitados y descarga autenticada del comprador, migración de registros históricos y pruebas E2E de pagos, reintentos y webhook receptor.
- Validación previa sin consumo, bitácora de transiciones, timestamp y deduplicación durable de eventos, recuperación de fallas y autorización oficial de cada emisor.
- La API existente conserva emisión firmada con espera acotada para el despacho. Aún falta aceptar una solicitud durable en cola antes de generar el DTE.
