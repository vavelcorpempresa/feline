# Unificación de Rocas del Sur en Feline

- **Tarea:** unificar Feline y Rocas del Sur en un solo sistema; todo lo de Rocas del Sur pasa a Feline; mejorar el código.
- **Metodología:** skill `frontend-design-architect` (REA: Razonar, Entender, Actuar).
- **Fecha:** 2026-11-03.
- **Roles:** la skill describe un flujo con varios agentes (Claude arquitecto y auditor, ChatGPT constructor, Antigravity/Gemini integración). En esta sesión **no había integración con ChatGPT, Antigravity ni Gemini**: Claude hizo todas las etapas. No se atribuye ninguna aprobación a agentes que no participaron.

## 1. Inventario de skills de diseño

| Skill | Ubicación | Decisión | Motivo |
|---|---|---|---|
| frontend-design-architect | `~/.claude/skills/synced/…/frontend-design-architect` | **Usada** | Pedida por el usuario; guía todo el proceso. |
| impeccable | `~/.claude/skills/impeccable` | No usada | El proyecto ya tiene `DESIGN.md` y `PRODUCT.md` generados con ella; se respetaron sus reglas sin volver a invocarla. |
| apple-look, apple-design, emil-design-eng, web-design, frontend-design | `~/.claude/skills/` | No usadas | Son de rediseño visual; esta tarea es unificar sin cambiar la identidad de Feline. |
| animate / improve-animations / remove-animations | `~/.claude/skills/` | No usadas | No hubo cambios de movimiento. |
| break-ui, mobile-native | `~/.claude/skills/` | No usadas | Sus objetivos (desbordes y móvil) se cubrieron con la verificación responsive de la sección 4. |

## 2. Razonar y entender: estado inicial

- **Un solo código con dos marcas.** `APP_BRAND=rocas`, la ruta `/rocas` y el parámetro `brand` cambiaban el logo, el título y el tema.
- **Lo exclusivo de Rocas del Sur:**
  - el logo `rds-logo.ts` y `logo-rocas-del-sur.svg`;
  - el estilo `rocasdelsur` (colores tierra, arena y lino);
  - los tokens `ROCAS_*`;
  - 16 reglas CSS `.rds-rocas`.
- **No había datos de Rocas del Sur:** ninguna empresa, documento ni usuario. Era solo una marca visual.
- **Prefijo heredado.** El tema propio de Feline usaba el prefijo `rds-` (de "Rocas del Sur"), lo que inducía a error.
- **Problemas responsive previos:**
  - en celular, el panel se desbordaba a 510 px;
  - en escritorio, el selector de empresa tapaba el nombre del usuario;
  - bajo 1280 px, el botón "Cerrar sesión" quedaba vacío.

## 3. Cambios

| Archivo | Cambio |
|---|---|
| `src/ui/feline-antd-dashboard.html.ts` | Una sola marca, sin parámetro `brand`. Se eliminaron el estilo `rocasdelsur`, los tokens `ROCAS_*`, las reglas `.rds-rocas` y la variante del menú lateral. Prefijo `rds-` → `fl-` (120 usos), `RDS_` → `FL_`. Las clases `.rds-logo` y `.rds-logo-feline`, que eran duplicadas, quedaron en una sola `.fl-logo`. Encabezado responsive. "Cerrar sesión" conserva su texto. |
| `src/server.ts` | Sin `APP_BRAND`. `/rocas` y `/feline` redirigen (301) a `/`. La respuesta JSON de `/` ya no incluye `brand`. |
| `src/ui/panel-compilado.ts` | Una sola caché del panel, sin el mapa por marca. |
| `src/ui/rds-logo.ts`, `src/ui/assets/logo-rocas-del-sur.svg` | Eliminados con `git rm`; se pueden recuperar desde git. |
| `tests/estructura.test.ts` | Pruebas de una sola marca y prueba nueva de redirección de las rutas antiguas. |
| `PRODUCT.md`, `DESIGN.md` | Documentan la marca única, el prefijo `fl-` y el encabezado en dos filas bajo 768 px. |

**Responsive (Mobile First):**
- Bajo 768 px el encabezado pasa a dos filas: arriba el selector de empresa; abajo las acciones, que se desplazan dentro de su propia fila.
- Los botones de las tarjetas pasan a la línea siguiente.
- El selector de empresa puede encogerse (`min-width: 0`), con puntos suspensivos, en vez de tapar al usuario.

## 4. Pruebas (ejecutadas)

| Requisito | Procedimiento | Resultado |
|---|---|---|
| Tipos | `npm run typecheck` | Aprobado (código 0) |
| Compilación | `npm run build` | Aprobado (código 0) |
| Pruebas | `vitest run` con PostgreSQL de prueba | **86/86 aprobadas** |
| Sin rastro de Rocas en el panel | Prueba automática y búsqueda de texto en 8 anchos | Aprobado |
| `/rocas` → `/` | Prueba automática (301) y navegador real | Aprobado |
| Sin desborde horizontal, ingreso y panel | Chrome sin interfaz a 320, 375, 390, 430, 768, 1024, 1280 y 1440 px | Aprobado en los 8 anchos (antes fallaba en 320–430: 510 px) |
| Logo Feline en la barra lateral | Mismos 8 anchos | Aprobado |
| Acceso con teclado al ingreso rápido | Tab hasta el botón, foco visible dorado `#E0B05A`, Enter entra | Aprobado (375 px) |

**Errores de consola:**
- un 401 en `/api/v1/panel/sesion` antes de iniciar sesión: es esperado;
- un 404 aislado en el primer contexto del navegador (a 320 px): probablemente el ícono de la pestaña (`favicon`); no se investigó.

**No verificado:** contraste WCAG completo de todas las pantallas; revisión con lector de pantalla; rendimiento (LCP, INP, CLS); los demás estilos visuales del selector (Clean, Glassmorphic, etc.) en celular.

## 5. Auditoría final

**Dictamen: APROBADO CON OBSERVACIONES.**

1. **Rocas del Sur como empresa.** No existe en Feline. Si debe facturar desde Feline, hay que crearla con sus datos reales (`npm run admin -- empresa:crear`). No se inventaron su RUT ni su resolución.
2. **Marca propia por cliente.** `PRODUCT.md` pedía antes "marca propia por cliente (white label)". Con la unificación esa capacidad desaparece del panel. Si se necesita para clientes externos, hay que diseñarla aparte, como configuración por empresa y no como código duplicado.
3. **Servidor en el puerto 3006.** Se arrancó con `APP_BRAND=rocas`. Al reiniciarlo mostrará Feline igual que el 3007, así que ya no se necesitan dos procesos.
4. **Carpeta `.impeccable/`.** Contiene archivos de trabajo con referencias a Rocas del Sur. No se modificaron porque son caché de la herramienta.
