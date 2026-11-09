# FELINE ERP · matriz de cumplimiento

Seguimiento parcial por módulo. El detalle por requisito sigue pendiente.

| Módulo | Estado inicial | Estado actual | Evidencia del estado |
|---|---|---|---|
| Inicio | DEFECTUOSO | INCOMPLETO | Cruce demo/finanzas corregido y probado. Indicadores persistentes y filtros pendientes. |
| Empresas | INCOMPLETO | INCOMPLETO | Tenant, CertificadoDigital, FinanceMembership y API administrativa. La demo mantiene su propio registro y usuarios. |
| Facturación | INCOMPLETO | INCOMPLETO | API v1, builder XML, CAF/TED, firma, PDF, envío y despacho. XSD oficial y ciclo completo por tipo sin evidencia de certificación. |
| Emitidos y recibidos | INCOMPLETO | INCOMPLETO | DocumentoDTE y FinanceReceivedDte. Revisión local de recibidos y asociación a pagar. Conciliación oficial y entrega al receptor no verificadas. |
| Motor tributario | INCOMPLETO | INCOMPLETO | AccountTax, FinanceTaxSetting y lógica en servicios DTE y finanzas. Falta demostrar cálculo central versionado por vigencia y base. |
| Declaraciones | DEFECTUOSO | DEFECTUOSO | FinanceTaxF29Declaration y finance/tax-dte.ts. La propuesta usa ENVIADO junto con aceptados. El estado de envío no acredita aceptación. F50, F22 y DJ sin cobertura verificada. |
| Contabilidad | NO VERIFICADO | NO VERIFICADO | FinanceEntry/Line, FinancePeriod y centralizer. Pruebas unitarias existentes. Falta verificar partida doble y cierre en PostgreSQL con concurrencia. |
| Finanzas | INCOMPLETO | INCOMPLETO | FinanceReceivable/Payable, pagos, reversiones, caja, transferencias y presupuesto. Flujo integrado no validado. |
| Bancos | NO VERIFICADO | NO VERIFICADO | FinanceBankAccount/Statement/Rule/Reconciliation y banking.routes.ts. Pruebas unitarias existentes. |
| Inventario | NO IMPLEMENTADO | NO IMPLEMENTADO | AccountMoveLine.productCode referencia un código libre. Esquema inspeccionado sin entidad persistente de inventario. |
| Clientes y proveedores | INCOMPLETO | INCOMPLETO | ClienteReceptor, FinanceVendor, customers.ts y vendors.ts. |
| Remuneraciones y honorarios | INCOMPLETO | INCOMPLETO | FinancePayrollEmployee/Slip y FinanceFeeReceipt. No se validaron vigencias ni cotizaciones. |
| Informes | INCOMPLETO | INCOMPLETO | Panel demo, contabilidad financiera, PDF DTE y auditoría. Cobertura completa de exportaciones sin verificar. |
| Administración | INCOMPLETO | INCOMPLETO | API clients, sesiones, auditoría, webhooks y trabajos de contabilización. MFA, restauración y rotación operativa sin verificar. |

## Ventas · metas e IPC

| Funcionalidad | Estado anterior | Estado actual | Evidencia y brecha |
|---|---|---|---|
| Metas manuales por empresa y CLP | DEFECTUOSO | VERIFICADO en PostgreSQL desechable | Seis períodos, edición OWNER, historial, auditoría y lecturas sin creación automática. Sucursal y otras monedas pendientes. |
| Comparaciones de ventas e IPC | NO IMPLEMENTADO | INCOMPLETO | Comparaciones y fórmula verificadas. Importación administrativa de filas normalizadas. Carga operativa y actualización periódica pendientes. |
| Dashboard de metas | DEFECTUOSO | INCOMPLETO | Seis indicadores desde PostgreSQL y navegación vertical. Pruebas de navegador y accesibilidad pendientes. |

| Ventas · formulario y listado | INCOMPLETO | INCOMPLETO | Factura en página, cálculo de vista previa y tabla demo verificados. Emisión persistente desde esta pantalla, impuestos adicionales y filtros avanzados pendientes. |
