# Finanzas y Contabilidad — núcleo persistente

Estado: implementación incremental; no representa los 16 módulos terminados ni certificación SII de producción.

## Qué se agregó

- Panel React en `/finanzas`, compilado con esbuild como el panel existente. No se reemplaza `/`.
- Usuarios persistentes y membresías por empresa con roles OWNER, ACCOUNTANT, BILLING y VIEWER.
- Sesiones aleatorias de ocho horas guardadas como hash; cookies HttpOnly y SameSite=Strict, Secure en producción; revocación al salir.
- Protección de escrituras por permiso, empresa, tipo JSON y origen; bloqueo temporal de intentos de ingreso.
- Períodos mensuales, apertura idempotente, cierre y bloqueo de nuevos asientos en meses cerrados.
- Asientos CLP con importes Decimal y contrato de cadenas de dígitos; partida doble, idempotencia y reversión.
- Restricciones y disparadores PostgreSQL: cuadratura al confirmar la transacción, una sola naturaleza por línea, inmutabilidad de asientos y auditoría, y prohibición de agregar líneas a un asiento ya publicado.
- Balance de comprobación mensual y diario con paginación. Auditoría de publicación, reversión, apertura, cierre, aprovisionamiento y configuración de centralización.
- Centralización manual y proceso automático opcional para DTE 33/34/39/41/56/61 aceptados o aceptados con reparo. La regla actual utiliza CxC, ingresos afectos/exentos e IVA débito; no sustituye una política contable completa de reconocimiento de ingresos.
- Cola persistente con errores, reintentos y vínculo único documento/asiento. Una corrección de texto sin monto no genera asiento. Las correcciones monetarias provenientes de DTE se hacen con el documento correspondiente, no con una reversión manual independiente.
- El cierre verifica que no queden DTE aceptados con monto pendientes de centralización.
- Corrección de pagos persistentes: control de concurrencia mediante actualización condicionada y pertenencia del diario a la empresa.
- DTE y reserva de idempotencia se guardan en una sola transacción. Si falla la respuesta después del commit, se conserva la reserva y el reintento devuelve el mismo documento.
- Multiplicación de cantidad por precio e IVA/desglose de boleta mediante Decimal; se conserva el redondeo a CLP y se rechazan importes que exceden las columnas Int actuales antes de consumir folio.
- SII simulado como valor local, modo explícito en producción y bloqueo del transporte a los hosts productivos sin habilitación específica. Las redirecciones HTTP del transporte SII se rechazan.
- El panel anterior advierte que trabaja con datos en memoria y ofrece acceso al registro persistente.

## Instalación inicial desde la aplicación

En desarrollo local se puede habilitar `FELINE_FINANCE_SETUP=local`. Si no existen empresas ni usuarios, `/finanzas` ofrece el formulario para crear la empresa, el administrador y el período actual. La contraseña la introduce el usuario y se almacena con scrypt; no hay claves predeterminadas. No se cargan operaciones ni documentos ficticios en esa base.

El primer registro se permite únicamente desde localhost, con host local y sin cabeceras de proxy, y queda bloqueado en producción. Una transacción con bloqueo de instalación impide que dos solicitudes creen dos administradores iniciales. Al existir la primera empresa y usuario, el formulario deja de estar disponible. El emisor se crea en certificación con resolución 0, sin certificado ni CAF; ello no acredita autorización del SII.

El entorno PostgreSQL de desarrollo, cuando se aprovisiona, utiliza un volumen persistente y escucha solo en localhost:55440. Es independiente del contenedor desechable de pruebas en 55439. Las pruebas que vacían tablas no aceptan la dirección de desarrollo. La conexión y las claves locales se guardan en `.env`, excluido de Git y con permisos de acceso limitados. Los datos iniciales quedan vacíos hasta que el usuario completa el formulario.

## Instalación en una base nueva

1. Respaldar código, archivos privados y base existente; guardar también las claves del cifrado por un canal seguro. La copia de código por sí sola no respalda los datos ni los certificados.
2. Configurar una base PostgreSQL vacía y exclusivamente de desarrollo. No copiar la base productiva para pruebas sin una estrategia de anonimización.
3. Ejecutar `npm run prisma:generate`, `npx prisma migrate deploy`, `npm run typecheck` y `npm run build` con esa base configurada.
4. Crear la empresa mediante la administración existente. No utilizar `dev:empresa-prueba` con datos reales.
5. Aprovisionar un usuario con `npm run finance:user`. El comando requiere FELINE_FINANCE_TENANT_ID, FELINE_FINANCE_EMAIL, FELINE_FINANCE_NAME, FELINE_FINANCE_PASSWORD y FELINE_FINANCE_ROLE. La contraseña debe tener al menos 12 caracteres y se entrega por entorno seguro, no como argumento. El correo es único; el comando no cambia contraseñas de identidades existentes.
6. Iniciar en modo simulado y abrir `/finanzas`. Abrir explícitamente los períodos necesarios. La configuración de centralización automática queda desactivada.

No se han creado cuentas ni asignado empresas reales automáticamente.

## Bases existentes sin historial de migraciones

No aplicar ciegamente la migración baseline a una base con tablas existentes. Primero comparar su esquema real con la baseline `202611030001_baseline`, documentar diferencias y probar una restauración del respaldo. Solo si el esquema coincide, registrar la baseline como aplicada mediante `prisma migrate resolve --applied 202611030001_baseline`, y después aplicar las migraciones aditivas. Ninguno de estos pasos se ejecutó sobre la base del proyecto original.

Migraciones incluidas:

1. `202611030001_baseline`: esquema anterior al trabajo financiero.
2. `202611030002_finance_core`: identidad, períodos, libro, auditoría y controles de cuadratura/inmutabilidad.
3. `202611030003_entry_seal`: evita agregar líneas después de publicar.
4. `202611030004_dte_centralization`: origen documental, configuración, cola y validaciones de empresa/período.
5. `202611040005_receivables`: cartera documental, abonos, reversiones y aplicaciones de crédito. Ver `docs/CARTERA-PERSISTENTE.md`.

La migración baseline no es una autorización para recrear o vaciar bases existentes. No se utiliza `db:push` para desplegar estos controles: los disparadores SQL forman parte de las migraciones y deben conservarse.

## Centralización de DTE

La vista muestra hasta 100 documentos del mes e indica su situación contable. La centralización manual funciona para un DTE aceptado y un período abierto. Si el mes está cerrado, se conserva un error para revisión: no se cambia silenciosamente la fecha del asiento.

Para automatizar se requieren dos habilitaciones: `FELINE_FINANCE_DISPATCHER=on` en el servidor y la autorización por empresa desde la vista de centralización. El proceso revisa hasta 50 documentos por ciclo de 30 segundos. Un fallo contable no altera la aceptación o rechazo tributario. Las notas de corrección de texto deben tener CodRef 2 y todos los totales monetarios en cero.

La puesta en marcha de esta regla sobre una empresa con contabilidad previa exige conciliación de saldos y una fecha de corte. No se deben centralizar de nuevo documentos ya registrados por otro sistema o mediante asientos manuales sin identificar esos antecedentes. El vínculo único previene repetir la centralización de este motor; no detecta por sí solo duplicidades contra asientos manuales anteriores.

## API nueva

Base `/api/v1/finance`. Las rutas requieren sesión; las de empresa también requieren `x-tenant-id` con una membresía vigente.

| Método y ruta | Operación / permiso |
|---|---|
| POST /login | Ingreso persistente |
| GET /session | Sesión y empresas autorizadas |
| POST /logout | Revocar sesión |
| GET /accounts, /periods, /entries, /report | Lectura autorizada |
| POST /periods | Abrir un mes; propietario/contador |
| POST /periods/:month/close | Cierre confirmado; propietario/contador |
| POST /entries | Publicar; propietario/contador; Idempotency-Key obligatoria |
| POST /entries/:id/reverse | Revertir asiento manual; propietario/contador; Idempotency-Key |
| GET /centralization | Documentos y estado contable |
| POST /centralization/:id | Centralizar DTE; propietario/contador |
| PUT /centralization/configuration | Autorizar proceso por empresa; propietario/contador |
| GET /audit | Auditoría; propietario/contador |

Las claves de proyectos de `/v1` y su contrato se conservan. Las cuentas del panel de demostración no habilitan acceso al registro persistente.

## Verificación

Ejecutar `npm run test:unit` sin bases ni credenciales reales. La integración DTE se ejecuta por separado, con TEST_DATABASE_URL apuntando a una base local terminada en `_test` y FELINE_TEST_ALLOW_RESET=YES_DROP_TEST_DATA: esa suite vacía sus tablas al comenzar. No definir FINANCE_TEST_DATABASE_URL en ese proceso.

La suite `tests/finance-setup.integration.test.ts` utiliza una base vacía independiente terminada en `_setup_test`, en 55439, y verifica acceso local, exclusión de proxies/producción, validaciones, primer registro concurrente y sesión. Vitest limita el descubrimiento a `tests/` para no ejecutar copias de respaldo.

La suite `tests/finance-core.integration.test.ts` usa FINANCE_TEST_DATABASE_URL y comprueba localhost, puerto 55439 y nombre terminado en `_test`. Crea únicamente datos ficticios y no vacía tablas. Las suites no deben correr juntas sobre la misma base.

Se verificaron en la base desechable las migraciones, concurrencia, aislamiento de empresas, idempotencia, reversión, cierre, inmutabilidad y centralización. También se revisaron ingreso, navegación de diario/períodos/formulario y menú móvil de la versión inicial en navegador. La comprobación a 390 px no mostró desbordamiento horizontal. Esto no equivale a una auditoría WCAG 2.2 AA completa ni a pruebas de toda la interfaz.

## Pendientes y límites de esta entrega

Cuentas por cobrar ya dispone de clientes, abonos, reversiones, aplicación de créditos, antigüedad e integración con el libro; sus límites se documentan en `CARTERA-PERSISTENTE.md`. Persisten áreas incompletas: CxP y gestión de cobranza, tesorería, cartolas y conciliación bancaria, recepción/aceptación/reclamo DTE, presupuestos, activos fijos, nómina/honorarios, informes completos y exportación Excel, impuestos y reglas con vigencia, multisucursal, identidad federada/MFA, gestión completa de usuarios desde interfaz y respaldo real de producción. El plan de cuentas usado es el existente y todavía no es editable por empresa. El catálogo de 16 módulos muestra explícitamente las áreas pendientes; su presencia no implica que estén implementadas.

No se verificó certificación, autorización de emisores, conformidad exhaustiva con esquemas oficiales o aceptación real del SII. No se transmitieron documentos reales, no se usaron certificados reales y no se modificó una base productiva. La política actual de cierre no ofrece reapertura; las regularizaciones de períodos cerrados necesitan un flujo contable adicional aprobado y probado.
