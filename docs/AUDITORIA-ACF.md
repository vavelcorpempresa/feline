# Auditoría ACF de Feline — 3 de noviembre de 2026

Realizada con la skill *ai-construction-framework* (flujo "proyecto existente"). Referencia congelada: commit `d417070` (estado base). Reparaciones en la rama `acf/revision`, un commit por grupo.

## Hallazgos y estado

| # | Gravedad | Falla | Estado | Commit |
|---|---|---|---|---|
| 1 | Crítica | `GET /api/v1/dashboard/state` entregaba documentos, clientes, folios y usuarios de todas las empresas | Reparada | `0e52d80` |
| 2 | Crítica | `POST /api/v1/tenants` creaba empresas en la base real sin autenticación | Reparada: exige `FELINE_ADMIN_TOKEN` | `0e52d80` |
| 3 | Crítica | El modo demostración (`/api/v1/dashboard/*`, sin login) también operaba en producción | Reparada: bloqueado si `NODE_ENV=production` salvo `FELINE_DEMO=on` | `0e52d80` |
| 4 | Alta | Notas de crédito repetidas sobre una factura ya anulada, sobre otra nota o sobre una compra | Reparada (panel y API real) | `3555705` |
| 5 | Alta | Un pago con monto inválido dejaba el saldo en `NaN` | Reparada (panel y API real) | `3555705` |
| 6 | Alta | Líneas sin validar: cantidad ≤ 0, precio negativo, descuento > 100 %, total $0 | Reparada (validación compartida) | `3555705` |
| 7 | Media | Rangos de folios de demostración inválidos o que reutilizaban folios | Reparada | `3555705` |
| 8 | Media | Se podía duplicar el correo de otro usuario al editarlo | Reparada | `3555705` |
| 9 | Media | Despachador SII: errores descartados en silencio, documentos atascados en EN_LOTE, reintentos sin espera | Reparada | `cd4d9fa` |
| 10 | Estructura | Contexto multiempresa implícito que nadie usaba (`db`, AsyncLocalStorage) | Eliminado | `0e52d80` |
| 11 | Estructura | Versión y puerto inconsistentes; Node sin declarar; Babel del panel sin versión (ya había saltado a la 8); dependencias sin uso o mal clasificadas | Reparada | `31db292` |

## Evidencia

- Pruebas nuevas: `tests/seguridad-panel.test.ts` (3), `tests/reglas-negocio.test.ts` (6), `tests/estructura.test.ts` (4) y 3 casos del despachador en `tests/api-v1.integration.test.ts`.
- Cada prueba nueva de los grupos 1, 2 y 3 se ejecutó contra el código original (`git stash`) y **falló**; con la reparación **pasa**.
- Suite completa: 64 de 64 pruebas, con PostgreSQL de pruebas (`TEST_DATABASE_URL`), `npm run typecheck` y `npm run build` sin errores.
- Panel verificado en el navegador (puerto 3007): carga, muestra documentos y no tiene errores de consola salvo `favicon.ico` (preexistente).

## Pendientes (requieren decisión o una fase completa)

- **Login real con roles** para el panel (fase 0). Mientras tanto, el panel de demostración no debe exponerse en internet.
- **Dos mundos separados**: el panel usa datos en memoria y la API usa PostgreSQL (fase 2).
- **Panel monolítico**: un archivo de ~5.300 líneas compilado en el navegador; conviene un paso de compilación.
- **Folio perdido** si la firma falla después de asignarlo (requiere anulación de folios ante el SII).

## Riesgos de las reparaciones

- La compatibilidad con FUGAR y los demás proyectos conectados se mantiene: la API v1 no cambió.

- Integraciones que llamaban `POST /api/v1/tenants` sin token ahora reciben 503/401: deben usar `npm run admin` o configurar `FELINE_ADMIN_TOKEN`.
- Documentos con total $0 o líneas inválidas que antes se aceptaban ahora se rechazan con un mensaje claro.

## Reversión

Cada grupo es un commit independiente: `git revert <commit>` deshace solo ese grupo. El estado previo completo es el commit `d417070`.
