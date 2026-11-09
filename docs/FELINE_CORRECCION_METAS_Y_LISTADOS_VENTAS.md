# FELINE ERP · ciclos personalizados y listados de Ventas

## Diagnóstico y cambios

La API de metas imponía el inicio de calendario y derivaba el término. La pantalla enviaba esas fechas sin campos editables. Varias rutas documentales abrían directamente el visor individual y Crear boleta requería abrir un modal.

La API de Finanzas ahora recibe inicio y término manuales para los seis tipos de meta. Se conserva el modelo SalesGoal y la compatibilidad con solicitudes antiguas que omiten el término de un ciclo calendario. Se usa un bloqueo transaccional PostgreSQL por empresa y tipo antes de detectar superposiciones, y se conservan la versión de edición y la auditoría de cambios. Las fechas son inclusivas. Una meta diaria abarca exactamente un día. En ciclos personalizados, la comparación previa usa la misma duración y las interanuales desplazan las dos fechas de referencia. El ajuste por IPC reutiliza la función existente.

El propietario puede consultar ciclos actuales e históricos por fecha en la misma página de Metas de ventas. Puede modificar el objetivo y el rango o crear otro ciclo. La comparación mostrada corresponde al ciclo consultado. Los ciclos futuros se pueden guardar. Su consulta de progreso por fecha queda pendiente.

## Rutas y componentes

- ventas/borradores, ventas/boletas, ventas/documentos, ventas/pagados, ventas/pendientes, ventas/vencidos, ventas/corregidos y ventas/cobranzas usan SalesListPage. Facturas emitidas usa el mismo componente.
- Cada listado tiene período de Chile, rango manual, búsqueda, filtros combinables por documento, estado y monto, indicadores, distribución por tipo, orden por fecha, paginación y CSV del conjunto filtrado. Borradores usa fecha de creación y vencidos usa vencimiento. Las demás vistas filtran por emisión. En cartera se suma saldo, no el total facturado.
- El visor EscenaDocumentos está en ventas/detalle y se abre mediante Ver documento. Conserva las acciones de visualización y operación disponibles antes del cambio.
- ventas/crear-boleta abre el formulario existente dentro del área principal. Mantiene los códigos 39 y 41 y reutiliza las acciones de borrador técnico, firma y envío del flujo demo. Cuando existe el receptor genérico de la empresa, se utiliza al dejar el receptor vacío.
- Los listados del panel principal leen el API demo existente y aplican los filtros al conjunto recibido. La consulta persistente sigue disponible en Finanzas. Quedan pendientes la unificación con PostgreSQL, la paginación de servidor, gráficos especializados de cobros y mora, filtros por fecha efectiva de cobro, acciones completas de borrador y gestión persistente de cobranzas.

## Impuestos y Retenciones

La factura muestra una tabla por línea con casillas ILA, búsqueda y filtro de categoría, código, tasa, base y aplicación. IVA se determina por el tratamiento de la línea. Los códigos 24, 25, 26, 27 y 271 recalculan el desglose mediante la misma API de vista previa al editar datos completos. El motor rechaza combinaciones incompatibles. Productos suntuarios, diésel, tabaco, pirotecnia y cambio de sujeto figuran como referencia; la tabla no presume su aplicabilidad.

La emisión con ILA permanece bloqueada. Quedan pendientes configuración persistente por SKU, catálogo completo, tasas versionadas, XML, PDF y contabilidad de impuestos adicionales. Fuente [Formato DTE del SII](https://www.sii.cl/factura_electronica/factura_mercado/formato_dte_202602.pdf) y [tasas del artículo 42](https://www.sii.cl/preguntas_frecuentes/impuestos_mensuales/001_130_1250.htm).

## Verificación

Compilación y comprobación de tipos correctas. Suite unitaria con 143 pruebas aprobadas. Se verificó en navegador la tabla de impuestos y la apertura directa de las nueve rutas en localhost:3020. La comprobación de rutas cubre presentación y controles visibles; faltan pruebas exhaustivas de cambios de empresa, exportaciones, acciones y diseño responsive.
