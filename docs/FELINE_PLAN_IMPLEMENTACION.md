# FELINE ERP · plan de implementación REA

1. **P0 · Contención.** Eliminar el acceso del dashboard demo a datos financieros persistentes. Conservar los endpoints de finanzas bajo su autenticación propia. Probar que un usuario demo no dispara lecturas de tenants reales.
2. **P0 · Núcleo y seguridad.** Revisar la segregación de todos los repositorios Prisma, integridad de CAF e idempotencia de envío y contabilización, webhook SSRF y manejo de secretos. Reproducir cada problema antes de corregirlo. Preparar una base desechable y probar migraciones y restauración antes de considerar cualquier intervención productiva.
3. **P0 · DTE y tributos.** Contrastar elegibilidad de DTE, estados y reglas por vigencia con SII/BCN. Agregar validación de XSD y cobertura de casos antes de habilitar nuevos tipos o reglas. Verificar certificación con emisor, certificado y CAF autorizados.
4. **P1 · Flujo financiero.** Validar emisión → estado oficial → asiento → cartera → pago → banco, además del camino de compras y cuentas por pagar. Asegurar reversión, cierre e idempotencia. Completar catálogo e inventario y luego declaraciones según reglas y datos verificables.
5. **P2 · Automatización e informes.** Conciliar registros con fuentes oficiales, verificar entrega al receptor, completar informes y exportaciones y medir colas y recuperación.
6. **P3 · Experiencia.** Unificar navegación sobre permisos reales, revisar responsive y accesibilidad y optimizar los indicadores con filtros persistentes.
7. **Cierre.** Ejecutar compilación, comprobación de tipos, suites unitarias, integración, E2E y seguridad. Actualizar arquitectura, matriz, evidencia tributaria y pendientes con los resultados observados.
