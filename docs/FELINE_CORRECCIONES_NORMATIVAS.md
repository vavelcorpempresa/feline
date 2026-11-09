# Correcciones normativas y de diagnóstico

- El CAF generado por el sandbox codifica en Base64 un marcador explícitamente sintético. Se conserva el documento firmado histórico.
- Se agregó validación optativa de sobres contra los XSD descargados del SII.
- El cálculo previo de ILA agrupa por código y exige confirmación del supuesto tributario. Se bloquea la creación con ILA en el panel mientras falte el flujo documental y contable completo.
- El resumen de Ventas separa el análisis general y la selección de tipo y fecha de ciclo de metas. El dashboard consulta el ciclo sin modificar objetivos. Metas conserva la vista unificada.
