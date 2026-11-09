# FELINE ERP · correcciones de Ventas

## Diagnóstico y cambios

| Área | Diagnóstico | Cambio | Estado |
|---|---|---|---|
| Resumen de ventas | Predominaban tarjetas de metas | Gráficos de evolución, documento, IVA/exento e IPC sobre DTE persistentes. Selector de período. Seis metas y proyección de cierre. | Parcial. Cobros, condiciones comerciales, adicionales y desglose por sucursal pendientes |
| Crear factura | Formulario de una línea en modal | Página dentro del ERP con emisor, búsqueda de cliente, datos del documento, líneas múltiples, descuento y exención. Borrador y emisión usan las acciones existentes. | Verificado por compilación y cálculo HTTP. El flujo de esta pantalla sigue siendo demo |
| Vista previa | Sin desglose desde el servidor | POST /api/v1/dashboard/moves/preview con permiso canIssueInvoices, validación estricta y el cálculo existente de OdooAccountMoveService. No guarda documentos. | Verificado con dos líneas, descuento e IVA |
| Facturas emitidas | Visor individual como pantalla principal | Tabla paginada, búsqueda por folio, RUT o cliente y orden por fecha. La acción Ver documento abre el visor existente con la fila seleccionada. | Parcial. Filtros avanzados, exportación e integración de la tabla principal con PostgreSQL pendientes |
| Impuestos adicionales | Motor sin campos de impuestos adicionales en el XML firmado | Catálogo informativo de códigos 23, 24, 25, 26, 27, 271 y 28. IVA y exención siguen usando el cálculo existente. | Los códigos adicionales son informativos. Aplicación, validación XSD, reglas de vigencia y contabilización pendientes |

## Rutas y componentes

- /#ventas abre el resumen.
- /#ventas/crear-factura contiene el formulario normal y reutiliza handleCreateDraftMove y handlePostMove.
- /#ventas/facturas contiene el listado. EscenaDocumentos conserva el visor y las acciones PDF, XML/TED, envío, cobro y nota de crédito que ya estaban disponibles en el panel demo.
- /#ventas/metas conserva la pantalla unificada. SalesGoalsView consume GET /api/v1/finance/sales/goals/progress, que incluye agregados por tipo, IVA y exento.
- /finanzas mantiene las consultas persistentes y descargas autenticadas existentes.

## Pruebas y límites

Typecheck correcto. La suite unitaria registró 136 pruebas aprobadas. En el 3020, una petición autenticada de vista previa con dos líneas devolvió CLP 1.800 neto, 500 exento, 342 IVA y 2.642 total. El HTML servido contiene el formulario dentro de Ventas, la tabla y las secciones gráficas. Se conservó la base aislada de la vista previa al recargar el servidor.

Pendientes: E2E visual y responsive, fecha de vencimiento y referencias en el formulario, recargos, catálogo tributario completo con validación oficial, unificación de las pantallas documentales con PostgreSQL, correo al cliente, integración contable y bancaria de extremo a extremo y certificación con el SII.

Referencia [Formato DTE del SII, versión 2.5 de febrero de 2026](https://www.sii.cl/factura_electronica/factura_mercado/formato_dte_202602.pdf).
