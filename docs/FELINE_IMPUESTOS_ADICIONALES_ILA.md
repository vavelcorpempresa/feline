# ILA por producto · alcance de cálculo previo

El motor vigente no conserva impuestos adicionales en totales de XML, PDF o contabilidad. El formulario de factura incorpora un selector por línea para el cálculo previo. El backend exige factura afecta 33, línea afecta a IVA, fecha desde 2014-10-01 y confirmación de operación nacional afecta según art. 43. La clasificación depende del producto y la operación. El artículo excluye ventas minoristas al consumidor final y ciertas ventas de vino a granel.

| Código SII | Categoría | Tasa |
|---|---|---|
| 24 | Licores y destilados de la categoría legal | 31,5% |
| 25 | Vinos de la categoría legal | 20,5% |
| 26 | Cervezas y otras bebidas alcohólicas de la categoría legal | 20,5% |
| 27 | Bebidas analcohólicas gravadas a tasa general | 10% |
| 271 | Bebidas analcohólicas que cumplen la condición de tasa incrementada | 18% |

Se utiliza la base afecta después de descuentos obtenida del cálculo existente. Se agrupa por código y se calcula en Decimal, redondeando cada total de código a CLP. La creación de un documento con ILA seleccionado devuelve 422 para evitar omitir el impuesto. Las siete pruebas cubren montos, agrupación, redondeo, fechas y restricciones.

Pendiente: catálogo de productos y vigencias persistentes, determinación legal por operación, snapshots por línea, XML CodImpAdic e ImptoReten, XSD con impuestos, PDF, pasivo contable, notas de crédito y certificación. Otros impuestos adicionales y específicos requieren reglas independientes.
