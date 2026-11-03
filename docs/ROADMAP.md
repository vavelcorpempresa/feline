# Feline: plan por fases

**Objetivo:** plataforma central y multiempresa para Chile. Todos los proyectos y sistemas de facturación se conectan a ella para:
1. emitir todos los documentos tributarios electrónicos;
2. llevar los libros de compra y venta;
3. gestionar los pagos;
4. hacer la conciliación bancaria.

## Estado actual

| Área | Estado |
|---|---|
| Multiempresa y conexión de proyectos (API v1, clave por proyecto, webhooks, SDK) | Listo |
| Emisión 33, 34, 56, 61 (factura, factura exenta, notas) con firma, timbre, PDF y envío al SII | Listo |
| Emisión 39, 41 (boletas) por la API REST del SII | Listo, falta el resumen diario (RCOF) |
| Libros de compra y venta, contabilidad, F29 | Solo en modo demostración (memoria), sin base de datos |
| Pagos | Solo registro manual en modo demostración |
| Conciliación bancaria | No existe |

## Fase 0 — Puesta en marcha
- Configurar `.env` de Feline, base de datos y empresa de prueba; conectar FUGAR.
- Usuarios con contraseña y roles para el panel; límite de peticiones por clave.
- Despliegue en DigitalOcean.

## Fase 1 — Todos los documentos tributarios
- Faltantes: 43 liquidación-factura, 46 factura de compra (con IVA retenido), 52 guía de despacho, 110/111/112 exportación.
- Impuestos adicionales y retenciones (ILA, combustibles, IVA retenido, etc.).
- Resumen de boletas (RCOF).
- **Recepción** de DTE de proveedores: casilla de intercambio, acuse de recibo, aceptación o reclamo (Ley 19.983).
- Opcional: cesión de facturas (factoring, AEC).

## Fase 2 — Libros de compra y venta
- Contabilidad y RCV guardados en base de datos (hoy solo en memoria).
- Registro de Ventas desde los documentos emitidos.
- Registro de Compras sincronizado con el RCV del SII y con los DTE recibidos (fase 1).
- Propuesta de F29 por empresa y período; exportación a Excel.

## Fase 3 — Gestor de pagos
- Cuentas por cobrar y por pagar por documento.
- Recepción de pagos desde las pasarelas de los proyectos (Banchile, SumUp…) y transferencias.
- Aplicación del pago al documento (total o parcial) y asiento contable automático.
- Aviso por webhook a cada proyecto.

## Fase 4 — Conciliación bancaria
- Conexión directa por API con **Banco de Chile** (API Store: "Movimientos y Saldos" y "Movimientos notificaciones") y **Scotiabank** (ScotiaBusiness Hub: "Saldos y movimientos").
  - Cada banco detrás de un conector común, para agregar otros bancos después sin cambiar la conciliación.
  - Credenciales por empresa y cuenta, cifradas como los certificados.
  - Respaldo: importación del archivo de cartola cuando la API no esté disponible.
- Calce automático: monto, fecha, RUT y referencia contra pagos y documentos.
- Bandeja de movimientos sin calzar para conciliar a mano.
- Reporte de conciliación por cuenta y período.

## Requisito del SII para emitir de verdad
Cada empresa que emita con Feline debe estar **autorizada por el SII** para usar este software (postulación y set de pruebas en el ambiente de certificación). Sin eso, el SII rechaza los envíos aunque el certificado y los CAF sean reales.
