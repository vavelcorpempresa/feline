# Matriz SII · corte parcial

| Requisito | Fuente SII | DTE | Implementación | Prueba | Estado | Acción |
|---|---|---|---|---|---|---|
| Sobre factura | Formato y XSD EnvioDTE v1.0 | 33 | DteXmlBuilderService y despachador | xmllint con sobre sintético | CUMPLE | Alcance limitado a la muestra y al esquema |
| Sobre boleta | EnvioBOLETA v1.1 | 39 | Builder y transporte REST | xmllint con sobre sintético | CUMPLE | Alcance limitado a la muestra y al esquema |
| Factura exenta | Formato DTE 2.5 | 34 | Schema de entrada API v1 | Cobertura por tipo incompleta | CUMPLE PARCIALMENTE | Validar sobre y reglas de exención con fixture específico |
| Boleta exenta | Formato y API de boleta | 41 | Schema de entrada y transporte REST | Sin nueva prueba XSD por tipo | CUMPLE PARCIALMENTE | Validar sobre, representación y seguimiento |
| Liquidación factura | Formato DTE 2.5 | 43 | Ausente de DocumentoRequestSchema | Inspección del contrato | NO IMPLEMENTADO | Definir campos y flujo específico |
| Factura de compra | Formato DTE 2.5 | 46 | Ausente de DocumentoRequestSchema | Inspección del contrato | NO IMPLEMENTADO | Validar cambio de sujeto y retenciones |
| Guía de despacho | Formato DTE 2.5 | 52 | Ausente de DocumentoRequestSchema | Inspección del contrato | NO IMPLEMENTADO | Implementar traslado y referencias |
| Nota débito | Formato DTE 2.5 | 56 | Schema API v1 y referencias | Caso falta CAF | CUMPLE PARCIALMENTE | Ejecutar emisión exitosa con CAF y XSD |
| Nota crédito | Formato DTE 2.5 | 61 | Schema API v1 y referencias | Suite API local | CUMPLE PARCIALMENTE | Completar casos por motivo y efectos financieros |
| Factura exportación | Formato DTE 2.5 | 110 | Ausente de DocumentoRequestSchema | Inspección del contrato | NO IMPLEMENTADO | Campos aduaneros y monedas |
| Nota débito exportación | Formato DTE 2.5 | 111 | Ausente de DocumentoRequestSchema | Inspección del contrato | NO IMPLEMENTADO | Flujo de exportación y referencias |
| Nota crédito exportación | Formato DTE 2.5 | 112 | Ausente de DocumentoRequestSchema | Inspección del contrato | NO IMPLEMENTADO | Flujo de exportación y referencias |
| CAF concurrente | Instructivo emisión | 33 | CafTedService y transacción | Folios correlativos únicos en PostgreSQL | CUMPLE PARCIALMENTE | Probar autenticidad CAF con material autorizado |
| TED y PDF | Formato DTE y representación | 33,39 | CafTedService y DtePdfService | XML y PDF de muestra | CUMPLE PARCIALMENTE | Verificar criptografía del TED, leyendas y lectura PDF417 |
| Firma XML | XSD XMLDSig e instructivo | 33,39 | XmlDsigSignerService | Estructura XML y suite local | CUMPLE PARCIALMENTE | Verificar cadena, vigencia y autorización con material real |
| Envío y consulta | Servicios SII factura y boleta | 33,39 | SiiWebServiceIntegration y dispatcher | Transporte simulado, TrackID y estados | CUMPLE PARCIALMENTE | Certificación con endpoints oficiales |
| ILA por producto | Art. 42/43 y formato DTE | 33 | ila-preview y vista de factura | 7 pruebas de cálculo y restricciones | CUMPLE PARCIALMENTE | Integrar XML, PDF, cuentas contables y configuración persistente |
| Entrega e intercambio | XSD intercambio y Ley 19.983 | Aplicables | Descargas y registro local de recibidos | PDF/XML de factura local | CUMPLE PARCIALMENTE | Correo, acuses y validación de firma entrante |
| Resumen diario y contingencia | Portal técnico de boletas | 39,41 | Implementación y obligación por emisor pendientes de verificar | Sin prueba | NO VERIFICADO | Confirmar exigibilidad vigente y probar |
| Aislamiento | Controles técnicos internos | Aplicables | Sesiones y membresías financieras, API client por tenant | Pruebas de permisos y consultas | CUMPLE PARCIALMENTE | Auditoría completa de rutas y relaciones |
| Autorización oficial | Proceso certificación SII | Aplicables | Sin evidencia de autorización aportada | Sin ejecución oficial | BLOQUEADO POR RECURSO EXTERNO | Acceso, certificado, CAF y set asignado |

2 de 19 filas evaluadas alcanzaron CUMPLE en su alcance estrecho (10,5%). Una fila no verificada y una bloqueada se excluyen. Este indicador describe las filas del corte, con denominador incompleto respecto al universo SII.
