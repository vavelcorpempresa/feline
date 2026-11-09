# Pruebas tributarias

Se ejecutaron tests/api-v1.integration.test.ts y tests/ila-preview.test.ts con --no-cache, PostgreSQL 16 desechable, seis migraciones, FELINE_SII_XSD_DIR y transporte simulado. Resultado 41 casos aprobados, incluidos 34 de integración y 7 de cálculo ILA.

Cobertura probada: folios concurrentes, idempotencia, estados simulados, sobres 33 y 39 contra XSD, cálculo ILA por cinco códigos, agrupación, redondeo e incompatibilidades. Pendientes: casos oficiales, XSD por tipo restante, ILA en XML/PDF y asientos, recepción y E2E en navegador.
