# Despliegue de Feline en producción

Feline se instala igual que FUGAR: un Droplet de DigitalOcean con Docker y Caddy (HTTPS automático) más una base PostgreSQL administrada. Todo se opera con los scripts de `scripts/deploy/`.

## 1. Servidor recomendado

| Recurso | Plan | Costo aprox. |
|---|---|---|
| Droplet | Basic, 2 GB RAM, 1 vCPU, 50 GB SSD, Ubuntu 24.04 | ~US$12/mes |
| Base de datos | Managed PostgreSQL 17, 1 GB RAM, 1 nodo | ~US$15/mes |
| Respaldos | El mismo Space de FUGAR (carpeta `feline/`) | ya pagado |

Los precios son de referencia: confírmalos al crear los recursos. Todo va en la **misma región que FUGAR** (NYC), para que FUGAR y Feline se hablen con poca latencia.

**Por qué esta configuración:**

- **DigitalOcean.** Es el proveedor de FUGAR: una sola cuenta, una sola factura y los mismos scripts que ya conoces.
- **Droplet propio, separado de FUGAR.** Feline es el motor de facturación de todas tus empresas. Si FUGAR se cae o se satura (su compilación usa hasta 4 GB), la facturación de las demás empresas no debe caerse con él. Además Feline guarda los certificados digitales de las empresas, y conviene que vivan aislados.
- **Proceso siempre encendido.** El despachador envía al SII, consulta estados y entrega webhooks cada 15 segundos. Por eso se usa un servidor y no funciones serverless.
- **2 GB bastan.** Feline usa unos 200–300 MB en reposo y no guarda archivos en disco: todo, incluidos los XML firmados, queda en PostgreSQL.
- **PostgreSQL administrado.** Incluye respaldos diarios y recuperación a un momento dado (7 días). Los documentos tributarios deben conservarse 6 años, así que además `backup.sh` guarda un respaldo mensual durante 72 meses.
- **Alternativa más barata:** crear la base `feline`, con su propio usuario, dentro del clúster PostgreSQL de FUGAR (ahorra ~US$15/mes). Es razonable para empezar. A cambio, ambos sistemas comparten la memoria y los respaldos de ese clúster.

Datos personales (Ley 21.719): igual que FUGAR, los datos quedan en Estados Unidos. DigitalOcean no tiene región en Sudamérica. Infórmalo como transferencia internacional a las empresas que uses en Feline.

## 2. Crear los recursos

1. **Droplet:** Create → Droplets → Ubuntu 24.04, Basic 2 GB, región NYC (la de FUGAR), **con tu clave SSH**. Nombre: `feline`.
2. **Base de datos:** Create → Databases → PostgreSQL 17, 1 GB, misma región. En *Settings → Trusted sources* agrega solo el Droplet `feline`. En *Users & Databases* crea la base `feline`.
3. **DNS:** registro `A` de `feline.<tu-dominio>` hacia la IP del Droplet. Debe existir antes del primer despliegue, porque Caddy pide el certificado HTTPS al arrancar.

## 3. Preparar el Droplet (una vez)

Desde la carpeta de Feline en tu Mac:

```bash
ssh root@<IP> 'bash -s' < scripts/deploy/bootstrap-droplet.sh
```

El script crea el usuario `deploy`, configura el firewall (solo SSH, 80 y 443), un swap de 2 GB, Docker, actualizaciones de seguridad y fail2ban, y desactiva el acceso de root y con contraseña. Desde ahí se entra con `ssh deploy@<IP>`.

## 4. Código y configuración

```bash
ssh deploy@<IP>
git clone https://github.com/vavelcorpempresa/feline.git feline   # repositorio privado: usa una deploy key de solo lectura
cd feline
cp .env.production.example .env.production && chmod 600 .env.production
nano .env.production
```

Completa `DOMAIN`, `FELINE_PUBLIC_URL` y `DATABASE_URL`. Usa la conexión **directa** (puerto 25060), no el pool, porque las migraciones de Prisma no funcionan por el pool. Genera los secretos con `openssl rand -hex 32`.

- `TENANT_VAULT_MASTER_KEY` cifra los certificados y las llaves CAF. **Guárdala también en tu gestor de contraseñas**: sin ella, un respaldo de la base no sirve para recuperar los certificados.
- `FELINE_SII_MODO=real`. Mientras `FELINE_SII_PRODUCCION_AUTORIZADA` esté vacía, Feline solo habla con la certificación del SII (maullin) y no con producción (palena).

## 5. Desplegar

```bash
scripts/deploy/deploy.sh 2026-11-10a
```

El script revisa que no falte ninguna variable obligatoria, compila la imagen (2 a 4 minutos), respalda la base y aplica las migraciones pendientes. Después levanta Feline y Caddy, y espera a que `/v1/salud` responda.

Para comprobarlo desde tu Mac:

```bash
curl https://feline.<tu-dominio>/v1/salud      # {"estado":"ok", ...}
curl https://feline.<tu-dominio>/v1/modulos
```

**Actualizar:** `git pull && scripts/deploy/deploy.sh <versión-nueva>`.
**Volver atrás:** `scripts/deploy/deploy.sh <versión-anterior>` (la imagen anterior sigue en el Droplet). Si la versión nueva traía migraciones, la base no se revierte: revisa antes de volver atrás.

## 6. Respaldos

```bash
crontab -e
# Respaldo diario a las 03:15 (hora de Chile)
15 3 * * * cd /home/deploy/feline && scripts/deploy/backup.sh >> backups/backup.log 2>&1
```

Cada respaldo queda en el Droplet (14 últimos) y en el Space: 30 diarios y 72 mensuales. Prueba una restauración en una base vacía al menos una vez; el comando está al final de `backup.sh`.

## 7. Dar de alta empresas y conectar sistemas

Con `FELINE_ADMIN_TOKEN` configurado (`scripts/deploy/set-secret.sh FELINE_ADMIN_TOKEN`), el alta completa se hace por API desde tu Mac. Ver [API_NORMA.md §1](API_NORMA.md):

1. Crear la empresa.
2. Cargar su certificado `.pfx`.
3. Cargar los CAF de certificación del SII.
4. Conectar el sistema (por ejemplo FUGAR), que recibe `FELINE_API_URL`, `FELINE_API_KEY` y `FELINE_WEBHOOK_SECRET`.

En FUGAR esas tres variables van en su `.env.production`. Revisa la conexión en `GET /api/v1/billing/conexion` desde el admin de FUGAR.

La consola de administración también está disponible: `scripts/deploy/admin.sh proyecto:listar`.

## 8. Paso a producción ante el SII

1. Emitir en certificación (maullin) hasta completar el set de pruebas del SII.
2. Con la empresa autorizada: cargar los CAF de producción y cambiar la empresa a `PRODUCCION` (`POST /v1/plataforma/empresas` con `"environment": "PRODUCCION"`).
3. Habilitar el envío a palena: `scripts/deploy/set-secret.sh FELINE_SII_PRODUCCION_AUTORIZADA` con el valor `SI_AUTORIZO_PRODUCCION`.

## Qué hay en producción

- **API REST v1** (`/v1/...`): la usan FUGAR y los demás sistemas.
- **Panel de finanzas** (`/finanzas`): contabilidad, cartera, tesorería y demás, con datos en PostgreSQL.
- **Panel de demostración** (`/`): trabaja con datos en memoria. En producción sus rutas `/api/v1/dashboard/*` quedan bloqueadas (403), salvo que se active `FELINE_DEMO=on` para una demo controlada.

## Si se agrega un modelo a Prisma

Un servidor nuevo crea la base con `prisma migrate deploy`, no con `db push`. Cada modelo nuevo necesita su migración:

```bash
npx prisma migrate dev --name <cambio>     # contra una base de desarrollo desechable
```

La prueba `tests/estructura.test.ts` falla si un modelo del esquema no tiene tabla en las migraciones.
