# FELINE ERP · implementación de Ventas

## Razonar y entender

El dashboard original utiliza datos en memoria. El camino persistente existente combina la API v1 documental, PostgreSQL y el panel /finanzas. La API documental reserva la clave de idempotencia por cliente de integración antes de consumir folio, firma mediante el orquestador y despacha automáticamente. Para boletas el transporte existente tiene un camino REST separado. La centralización, los cobros y las reversiones usan los modelos de Finanzas.

El middleware de Finanzas aceptaba una sesión demo como propietario de todas las empresas activas y elegía el primer usuario financiero activo como actor. Se eliminó ese acceso antes de agregar rutas persistentes de Ventas.

## Actuar

Abrir /finanzas, iniciar sesión con un usuario financiero, seleccionar una empresa asignada y abrir Ventas en el lateral. El resumen consulta PostgreSQL y calcula acumulados del día, semana desde el lunes, mes, trimestre y año, con corte de fecha en Santiago. Los montos incluyen DTE aceptados y aceptados con reparo y descuentan notas de crédito aceptadas. El IVA mostrado corresponde a esos DTE. La conciliación tributaria del F29 tiene su propio alcance.

Las vistas de facturas, boletas y todos los documentos tienen filtros de fecha, folio y estado SII, más paginación. Las descargas PDF y XML requieren la sesión financiera y se limitan al tenant. El estado de pago utiliza el saldo de cartera con los cobros, aplicaciones y reversiones existentes. Si falta cartera o hay pagos legados pendientes de conciliación, se muestra «Sin saldo verificado». La condición contado/crédito se muestra cuando existe un movimiento contable asociado con el dato.

| Funcionalidad | Estado anterior | Cambios | Evidencia | Estado actual |
|---|---|---|---|---|
| Aislamiento y permisos | DEFECTUOSO | Se eliminó el escalamiento desde sesión demo. Ventas usa membresía financiera. | Casos HTTP de 401, 403 y búsqueda acotada a empresa. | CORREGIDO para las rutas verificadas |
| Navegación vertical | INCOMPLETO | Grupo Ventas en /finanzas, con resumen al abrirlo y acceso a listas, clientes y cartera. | Compilación de la interfaz y respuesta HTTP del panel. | INCOMPLETO respecto al árbol completo y E2E móvil |
| Resumen de ventas | INCOMPLETO | Acumulados persistentes y separación de neto, exento, IVA y bruto. | Un DTE firmado de prueba modifica el acumulado al cambiar su estado a aceptado en PostgreSQL. | INCOMPLETO. Gráficos, sucursal y métricas de cobros pendientes |
| Documentos emitidos | INCOMPLETO | Listados con filtros, saldo, estado financiero y tributario, PDF y XML. | Documento firmado leído y descargado desde PostgreSQL. | INCOMPLETO. Filtros financieros, historial, consulta manual, reenvío y correcciones pendientes |
| Emisión de facturas y boletas | INCOMPLETO | Se conserva el motor API v1. | La suite documental cubre folios, firma, estados y webhooks con SII simulado. | INCOMPLETO. Formularios y borradores pendientes. Certificación oficial pendiente |
| Registro independiente de ventas | NO IMPLEMENTADO | Se delimitó el flujo pendiente de persistencia y vinculación idempotente. | Sin prueba funcional. | NO IMPLEMENTADO |
| Pagos y cartera | INCOMPLETO | Acceso a la cartera existente desde Ventas. Las listas leen su saldo mediante la lógica compartida. | Prueba de pago parcial y de ausencia de saldo verificado. | INCOMPLETO. Validación de pagos y reversiones desde el flujo completo pendiente |
| Contabilidad, bancos e inventario | INCOMPLETO | Reutilización de cartera para lectura. | Cobertura documental y unitaria existente. | INCOMPLETO. Ciclo contable y bancario completo e inventario pendientes |
| Entrega al cliente | NO VERIFICADO | Descargas manuales desde Ventas. | Descargas PDF y XML probadas. | INCOMPLETO. Correo, cola y reintentos pendientes |

## Verificación

- npm run typecheck.
- npm run build con salida temporal.
- npm test -- --no-cache con integración desactivada: 129 aprobadas, 62 omitidas.
- npm test -- --no-cache tests/api-v1.integration.test.ts con PostgreSQL 16 desechable, las cinco migraciones y SII simulado: 32 aprobadas. La prueba de Ventas comprueba resumen, listado, estado financiero separado, PDF y XML.
- Quedan 31 casos financieros persistentes, las pruebas E2E de navegador y la evaluación WCAG 2.2 AA.
- Referencia oficial para validar el flujo de boletas: [instructivo técnico del SII](https://www.sii.cl/servicios_online/3532-instructivo_tecnico_be-3811.html).
