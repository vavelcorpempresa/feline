# FELINE ERP · metas comerciales e IPC

## Arquitectura y permisos

Ventas usa la API financiera y su sesión persistente. La empresa se resuelve por membresía y el encabezado x-tenant-id. OWNER puede crear y editar. Los roles de lectura consultan metas y comparaciones. El servidor acepta un monto únicamente en POST o PATCH manual. En la edición se verifica la versión y se registra el antes y después en FinanceAuditEvent dentro de la transacción. Los objetivos son únicos por empresa, período e inicio. La migración agrega SalesGoal e IpcMonthlyIndex. Las comparaciones se calculan al consultar.

Rutas bajo /api/v1/finance:

- GET /sales/goals, /sales/goals/comparison y /sales/goals/progress.
- POST /sales/goals y PATCH /sales/goals/:id.
- GET /economic-indicators/ipc y /economic-indicators/ipc/history.
- POST /admin/economic-indicators/ipc/import, con sesión OWNER y FELINE_ADMIN_TOKEN.

## Fuente e importación

El INE publica la serie mensual general empalmada base 2023=100 en formatos estructurados. Usar el valor del índice general, el enlace directo al tabulado oficial y la fecha de publicación. Se implementó importación administrativa de filas normalizadas. La API comprueba dominio HTTPS oficial, base, formato, fechas y duplicados. El operador debe cotejar las filas con el archivo oficial. El servidor registra fuente, fecha de carga y actor. Un valor corregido se registra como versión adicional y la lectura usa la versión más reciente. La sincronización periódica y el verificador del contenido del archivo siguen pendientes.

El cuerpo JSON usa base 2023, source con la URL oficial y rows con month (AAAA-MM), value (decimal como cadena) y publishedAt (AAAA-MM-DD).

Fuentes [IPC general del INE](https://www.ine.gob.cl/estadisticas-por-tema/precios-e-inflacion/indice-de-precios-al-consumidor) y [manual metodológico, base 2023=100](https://www.ine.gob.cl/docs/default-source/%C3%ADndice-de-precios-al-consumidor/metodologias/base-anual-2023-100/metodolog%C3%ADa-base-anual-2023-%3D-100.pdf?sfvrsn=b1cf9a46_8).

## Períodos y cálculos

- Día, semana ISO de lunes a domingo, mes, trimestre, semestre y año. El corte actual se calcula en America/Santiago.
- Una semana ISO 53 se compara con la última semana del año comparado si ese año tiene 52. Para el 29 de febrero se usa el 28 en un año común.
- Se calcula el ciclo inmediatamente anterior y hasta tres comparaciones interanuales. Un ciclo en curso se compara con la misma cantidad de días, con límite en el final de cada ciclo. Los ciclos ya cerrados se comparan completos.
- Venta bruta CLP de DTE aceptados o aceptados con reparo menos notas de crédito aceptadas. Los cobros se mantienen en cartera. Los rechazados se excluyen.
- Índice mensual histórico al cierre del tramo comparado e índice de referencia al corte actual. Si el índice del corte falta, se usa el último publicado hasta ese mes y se advierte que el ajuste es provisional. Si falta el índice histórico, el ajuste queda sin dato.
- Histórico ajustado = histórico nominal × índice de referencia / índice histórico. Crecimiento = (venta o meta / base comparable − 1) × 100. Si la base es cero o negativa, el porcentaje queda sin dato.
- La proyección de cierre extrapola linealmente las ventas observadas por día calendario. Se usa Decimal hasta presentar CLP y porcentajes.

## Interfaz y alcance

En Ventas → Metas de ventas se consultan y configuran las seis periodicidades en una sola pantalla. El historial se abre en la misma página. En Inicio y Resumen de Ventas se reemplazaron los objetivos fijos por indicadores persistentes. Cada período sin objetivo muestra «Sin meta definida».

La implementación cubre empresa y CLP. Sucursal y otras monedas requieren fuentes comerciales segmentadas y reglas de conversión. El ambiente 3020 usa una base de prueba aislada, una factura sintética y una cuenta de prueba. La carga de la serie oficial en un ambiente operativo queda pendiente.

## Verificación

Las pruebas unitarias cubren seis calendarios, semana ISO 53, 29 de febrero, inflación, ajuste, crecimiento nominal y real y bases incompatibles. La integración usa PostgreSQL desechable y comprueba creación manual, duplicados, modificación auditada, permisos, aislamiento, ausencia de IPC, importación administrativa con datos sintéticos, deduplicación y seis indicadores sin creación automática. La vista previa se verificó por HTTP con la factura sintética. Quedan pendientes las pruebas de navegador y accesibilidad.
