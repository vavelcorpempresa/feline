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

## Mejoras posteriores (3 de noviembre)

| Mejora | Commit |
|---|---|
| **Inicio de sesión con roles**: contraseñas con scrypt, sesión firmada en cookie HttpOnly, bloqueo tras 5 intentos, acceso por empresa y permisos por rol en todas las rutas del panel. Además, crear empresa y generar folios ya no devuelven llaves privadas. | `d0a69a5` |
| **Folios sin uso**: los errores de datos se detectan antes de asignar folio; si la emisión falla después, el folio se registra para anularlo ante el SII (`/v1/empresa` → `foliosPorAnular`, `npm run admin -- folios:sin-uso`). | `1ba97f0` |
| **Panel compilado en el servidor**: el navegador ya no descarga Babel (~2,4 MB) ni compila el panel en cada carga. | `299af00` |

Variables nuevas: `FELINE_SESSION_SECRET` (obligatoria en producción) y `FELINE_PANEL_CLAVE_DEMO`. Esquema nuevo: tabla `folios_sin_uso` (`npm run db:push`).

## Pendientes

- **Dos mundos separados**: el panel usa datos en memoria (usuarios incluidos: se reinician con el servidor) y la API usa PostgreSQL. Unificarlos es la fase 2 del ROADMAP.
- **Panel monolítico**: ya no se compila en el navegador, pero sigue siendo un archivo de ~5.300 líneas; dividirlo en módulos es una mejora de mantenimiento.
- **Cierre de sesión**: la sesión es firmada y sin estado; al cerrar sesión se borra la cookie, pero un token copiado sigue válido hasta su vencimiento (12 h).

## Riesgos de las reparaciones

- La compatibilidad con FUGAR y los demás proyectos conectados se mantiene: la API v1 no cambió.

- Integraciones que llamaban `POST /api/v1/tenants` sin token ahora reciben 503/401: deben usar `npm run admin` o configurar `FELINE_ADMIN_TOKEN`.
- Documentos con total $0 o líneas inválidas que antes se aceptaban ahora se rechazan con un mensaje claro.

## Reversión

Cada grupo es un commit independiente: `git revert <commit>` deshace solo ese grupo. El estado previo completo es el commit `d417070`.
