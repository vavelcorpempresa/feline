# FELINE ERP · pruebas

| Comando o verificación | Resultado |
|---|---|
| npm run typecheck | Correcto |
| npm run build -- --outDir /private/tmp/feline-rea-build | Correcto |
| git diff --check -- src/server.ts tests/seguridad-panel.test.ts | Correcto |
| npm test -- --no-cache, sin variables de conexión de integración | 125 aprobadas, 62 omitidas |
| prisma migrate deploy, PostgreSQL 16 desechable | Aplicó las cinco migraciones |
| npm test -- --no-cache tests/api-v1.integration.test.ts, PostgreSQL desechable y SII simulado | 31 aprobadas, incluidas concurrencia de folios, ciclo de estados, webhooks e idempotencia |
| Suites finance-core, finance-setup y finance-receivables con PostgreSQL | Pendientes. Los controles rechazan puertos alternativos y el puerto 55439 está ocupado. |

La primera ejecución unitaria reportó 123 aprobadas y terminó con EPERM al guardar caché. La prueba nueva reprodujo la lectura de la primera empresa desde la sesión demo. Después de separar ambos flujos, la ejecución sin caché pasó.

Quedan pendientes el E2E en navegador, linter (el repositorio carece de script), WCAG, la prueba de restauración y la certificación oficial.
