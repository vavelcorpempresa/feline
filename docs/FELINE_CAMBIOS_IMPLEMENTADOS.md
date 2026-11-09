# FELINE ERP · cambios implementados

- src/server.ts separa la sesión de demostración de PostgreSQL. GET /api/v1/dashboard/state conserva la forma de finance con colecciones vacías. Los datos financieros persistentes se consultan mediante /finanzas con su propia sesión.
- tests/seguridad-panel.test.ts comprueba por HTTP que la sesión demo recibe el contrato esperado y que la aplicación no busca la primera empresa persistente. La prueba falló antes de la corrección y pasó después.
