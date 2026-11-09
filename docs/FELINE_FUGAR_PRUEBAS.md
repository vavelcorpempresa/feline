# Pruebas

FUGAR y FELINE aprobaron la comprobación de tipos. La suite de integración de FELINE aprobó 35 casos con PostgreSQL desechable, migraciones y transporte SII simulado. La prueba nueva importa el cliente real de FUGAR, abre Fastify por HTTP local, rechaza un total confirmado distinto y emite una boleta 39. Repetir la solicitud recupera el mismo DTE y folio. Se ejecutaron los XSD oficiales de los sobres de prueba 33 y 39.

Configurar FUGAR_CLIENT_FILE con la ruta absoluta a lib/services/dte.service.ts del checkout y FELINE_SII_XSD_DIR con los esquemas extraídos para repetir ambas verificaciones. Usar TEST_DATABASE_URL desechable y el guard de reinicio de la suite. La prueba HTTP no abarca una compra real de Next.js, el webhook receptor ni el SII oficial.
