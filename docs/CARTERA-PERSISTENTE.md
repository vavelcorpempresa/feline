# Ventas y cuentas por cobrar — entrega incremental

## Operaciones disponibles

En `/finanzas`, abrir **04 · Ventas y cuentas por cobrar**.

- **Clientes:** consultar, buscar, paginar, crear y editar el mismo maestro `ClienteReceptor` que utiliza la API de emisión. Se normaliza el RUT y se evita duplicarlo dentro de la empresa. La edición mantiene el RUT para conservar la identidad e historia del tercero.
- **Cuentas por cobrar:** documentos DTE centralizados, saldo al día seleccionado, búsquedas por cliente/RUT/folio, filtro de deudas o créditos y paginación. Importes CLP exactos, sin coma flotante.
- **Cobros:** registrar abonos recibidos, medio, fecha y comprobante. En la misma transacción se registra el asiento Caja y Bancos contra Clientes. No realiza cargos, transferencias ni devoluciones de dinero.
- **Reversión del cobro:** conserva el registro original y crea el asiento inverso con fecha, responsable y motivo. Solo propietario o contador; el operador de facturación puede registrar cobros, pero no revertirlos.
- **Notas de crédito:** aplicación explícita sobre una deuda del mismo cliente. Compensa los saldos auxiliares; no vuelve a contabilizar la nota ni altera sus referencias tributarias. La aplicación puede revertirse con trazabilidad.
- **Historial:** cobros, referencias, aplicaciones y reversiones por documento.
- **Antigüedad:** por vencer/vence hoy, 1–30, 31–60, 61–90, más de 90 días y sin vencimiento. No se inventa una fecha de vencimiento cuando el DTE no la informa.
- **Conciliación de cartera:** sin filtros, se compara el total auxiliar con la cuenta Clientes del libro al día consultado. Los asientos manuales sin documento asociado generan una diferencia visible para revisión.

Las consultas históricas no ofrecen acciones de cobro o aplicación desde esos saldos; para operar se consultan los saldos de hoy. Las operaciones admiten una fecha histórica válida dentro de un período abierto, siempre que no anteceda al último movimiento del documento.

## Consistencia y seguridad

Cada saldo nace de un DTE ya centralizado: no hay un segundo maestro de clientes ni se vuelve a emitir el documento. La migración incorpora los DTE con asiento documental previo y las nuevas centralizaciones crean su saldo de cartera dentro de la misma transacción.

Los abonos, aplicaciones y sus reversiones son inmutables. Se usan bloqueos por empresa, claves de idempotencia, importes Decimal y relaciones compuestas que preservan la pertenencia a la empresa. PostgreSQL comprueba límites de saldo, contrapartes, fechas y correspondencia entre el cobro y su asiento. La aplicación fuerza la evaluación de restricciones diferidas antes de devolver éxito, para no informar una operación que el motor de base de datos rechace al confirmar.

No se permite sobreaplicar un abono o un crédito al documento. Un cliente puede conservar una nota de crédito disponible aunque haya pagado otra factura: ese crédito se muestra por separado y no se convierte automáticamente en un descuento adicional. No se implementan todavía anticipos, devolución de saldos o movimientos de caja sin documento.

Los documentos con pagos del modelo anterior se señalan para conciliación y se bloquea su cobro en el núcleo nuevo hasta revisarlos. El servicio antiguo de pagos tampoco admite cobrar un DTE que ya tiene cartera persistente, para no mantener dos vías de registro sobre la misma deuda. La importación conciliada de pagos históricos sigue pendiente; no se presume que esos registros hayan sido incorporados automáticamente.

## Roles

| Operación | Propietario | Contador | Facturación / caja | Consulta |
|---|---|---|---|---|
| Leer cartera y clientes de sus empresas | Sí | Sí | Sí | Sí |
| Crear y editar clientes | Sí | Sí | Sí | No |
| Registrar cobro recibido | Sí | Sí | Sí | No |
| Revertir un cobro | Sí | Sí | No | No |
| Aplicar o revertir créditos | Sí | Sí | No | No |

Las empresas autorizadas se resuelven desde la sesión persistente, no desde datos enviados en el formulario. Todos los cambios relevantes dejan auditoría.

## Migración

`202611040005_receivables` agrega cinco modelos: saldos documentales, cobros, reversión de cobros, aplicaciones de crédito y reversión de aplicaciones. Agrega vínculos de operación al libro y restricciones de integridad. Se ejecuta dentro de una transacción; no elimina ni modifica los asientos existentes.

Antes de aplicarla a desarrollo se debe guardar un respaldo privado de esa base y comprobar primero la migración con datos ficticios. No se ejecutan las suites de pruebas contra desarrollo, ni se copian sus datos reales a las bases desechables. Las pruebas de esta entrega admiten únicamente un nombre terminado en `_receivables_test` en localhost:55439; desarrollo sigue en 55440.

## Verificación y límites

La suite de cartera cubre creación desde DTE, idempotencia y concurrencia, abonos, reversiones, notas de crédito sin doble descuento, fechas, períodos, permisos, aislamiento de empresas, inmutabilidad, saldos históricos, antigüedad, clientes, pagos anteriores, conciliación y paginación. Se revisaron además los flujos de abono, aplicación, reversión y edición de cliente en navegador con datos explícitamente ficticios, y el ancho móvil de 390 px.

Esta entrega no completa todo el módulo de ventas ni el ERP de 16 módulos. Pendientes: gestión de cobranza y compromisos de pago, documentos no tributarios de apertura, importación conciliada de pagos anteriores, exportación de estados de cuenta, facturación persistente desde interfaz, devoluciones/anticipos, monedas, sucursales y conciliación de cuentas bancarias individuales. La cuenta contable de cobro es la combinada Caja y Bancos del plan existente; seleccionar un medio de pago no supone integración bancaria.

No se enviaron documentos al SII ni se movió dinero real durante el desarrollo o las pruebas.
