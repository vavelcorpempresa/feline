# FELINE ERP · auditoría inicial REA

Corte del 8 de noviembre de 2026. Revisión del árbol de trabajo local, que incluye cambios previos en finanzas, Prisma y el panel. Los estados se aplican al alcance indicado en cada fila.

| Módulo | Estado | Evidencia y brecha | Prioridad | Solución y dependencia |
|---|---|---|---|---|
| Inicio | DEFECTUOSO | GET /api/v1/dashboard/state enlaza un ID de demo con el primer tenant de PostgreSQL. También combina indicadores en memoria con consultas que silencian errores. | P0 | Separar identidades y usar sesión financiera para datos persistentes. |
| Empresas | INCOMPLETO | Tenant, CertificadoDigital, FinanceMembership y API administrativa. La demo mantiene su propio registro y usuarios. | P0 | Validar los límites de autorización y consolidar flujos persistentes. |
| Facturación | INCOMPLETO | API v1, builder XML, CAF/TED, firma, PDF, envío y despacho. XSD oficial y ciclo completo por tipo sin evidencia de certificación. | P0 | Validación XSD, folios concurrentes, estados por DTE y certificación autorizada. |
| Emitidos y recibidos | INCOMPLETO | DocumentoDTE y FinanceReceivedDte. Revisión local de recibidos y asociación a pagar. Conciliación oficial y entrega al receptor no verificadas. | P1 | Validar firma y procedencia, conciliar RCV y verificar entrega. |
| Motor tributario | INCOMPLETO | AccountTax, FinanceTaxSetting y lógica en servicios DTE y finanzas. Falta demostrar cálculo central versionado por vigencia y base. | P0 | Inventariar y reconciliar cálculos con fuentes oficiales antes de ampliar cobertura. |
| Declaraciones | DEFECTUOSO | FinanceTaxF29Declaration y finance/tax-dte.ts. La propuesta usa ENVIADO junto con aceptados. El estado de envío no acredita aceptación. F50, F22 y DJ sin cobertura verificada. | P0 | Definir por separado la elegibilidad tributaria y la conciliación con el RCV. |
| Contabilidad | NO VERIFICADO | FinanceEntry/Line, FinancePeriod y centralizer. Pruebas unitarias existentes. Falta verificar partida doble y cierre en PostgreSQL con concurrencia. | P0 | Probar restricciones y transacciones en base desechable. |
| Finanzas | INCOMPLETO | FinanceReceivable/Payable, pagos, reversiones, caja, transferencias y presupuesto. Flujo integrado no validado. | P1 | Probar centralización, pagos parciales, reversión e idempotencia. |
| Bancos | NO VERIFICADO | FinanceBankAccount/Statement/Rule/Reconciliation y banking.routes.ts. Pruebas unitarias existentes. | P1 | Validar importación, deduplicación, evidencia y reversión en base desechable. |
| Inventario | NO IMPLEMENTADO | AccountMoveLine.productCode referencia un código libre. Esquema inspeccionado sin entidad persistente de inventario. | P1 | Diseñar catálogo, bodegas y movimientos con relación a DTE y contabilidad. |
| Clientes y proveedores | INCOMPLETO | ClienteReceptor, FinanceVendor, customers.ts y vendors.ts. | P1 | Verificar historial, permisos, condiciones y cartera. |
| Remuneraciones y honorarios | INCOMPLETO | FinancePayrollEmployee/Slip y FinanceFeeReceipt. No se validaron vigencias ni cotizaciones. | P1 | Separar reglas de cálculo de captura y verificar fuentes y períodos. |
| Informes | INCOMPLETO | Panel demo, contabilidad financiera, PDF DTE y auditoría. Cobertura completa de exportaciones sin verificar. | P2 | Verificar cada informe y formato sobre datos persistentes autorizados. |
| Administración | INCOMPLETO | API clients, sesiones, auditoría, webhooks y trabajos de contabilización. MFA, restauración y rotación operativa sin verificar. | P0 | Auditar secretos, permisos, destinos HTTP y recuperabilidad. |

## Mapa inicial

- Node.js y TypeScript estricto. Fastify sirve el dashboard React/Ant Design, el panel financiero y las API. Prisma administra PostgreSQL. Vitest contiene pruebas HTTP inyectadas, unitarias y suites con PostgreSQL.
- src/server.ts registra /, /dashboard, /finanzas, /api/v1/dashboard/*, API de administración, API documental y rutas financieras. Contrato de integración en src/api/v1/openapi.ts y cliente en sdk/feline-client.ts.
- src/services contiene dos caminos: demo en memoria y API documental persistente. En persistencia, API → orquestador → CAF/TED y XMLDSig → despachador SII → estado y webhooks. FinanceCentralizer consume trabajos de contabilización.
- prisma/schema.prisma agrupa tenants, certificados, CAF, DTE, envíos, idempotencia, webhooks y entidades contables, comerciales, bancarias, tributarias y de nómina. prisma/migrations contiene baseline y cuatro incrementos. No se comprobó restauración.
- La evidencia de diseño local está en DESIGN.md, PRODUCT.md y .impeccable. La evaluación responsive y WCAG 2.2 AA queda por ejecutar. No hay skill de Impeccable en el catálogo activo.
- Certificación, producción SII y validez por tipo documental quedan por verificar. Referencia primaria: [esquemas XML del SII](https://www.sii.cl/servicios_online/3532-formato_xml-3811.html).

## Línea base

TypeScript sin errores. Vitest reportó 123 pruebas aprobadas en 16 archivos y terminó con EPERM al guardar su caché en Google Drive. Las cuatro suites PostgreSQL no formaron parte de esa ejecución.
