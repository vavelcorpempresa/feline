# Validación XML DTE

Ejecutar la integración API v1 en PostgreSQL desechable con FELINE_SII_XSD_DIR apuntando a un directorio que contenga los ZIP oficiales extraídos en schema_dte y schema_envio_bol. La prueba usa xmllint --nonet --noout --schema con el XML de los sobres realmente persistidos, en ISO-8859-1.

- EnvioDTE_v10.xsd sobre factura 33 sintética. Aprobado.
- EnvioBOLETA_v11.xsd sobre boleta 39 sintética. Aprobado.
- Descarga inicial del 3020, antes del cambio. Falló DTE_v10.xsd porque FRMA del CAF sintético no era xs:base64Binary.
- SHA-256 de schema_dte.zip: 59429e27879824e9eecb0942cee733f7cf93cb61f8b80d5f5a34bcd22b6c5bee.
- SHA-256 de schema_envio_bol.zip: 8ae0bda6fc86a7656f4b5a18e6e5664ae463422c9786d9e6893c57efa150ac8e.

El test es optativo por disponibilidad de los archivos. La validación estructural es independiente de la verificación criptográfica y de la autorización oficial. Pendiente validar todos los tipos y habilitar validación previa al despacho en operación.
