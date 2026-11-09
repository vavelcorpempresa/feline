# Norma de la API REST de Feline

Esta norma rige cómo Feline expone su API a los otros sistemas (FUGAR y los que vengan) y cómo se agregan módulos nuevos. El código la hace cumplir: si una ruta no la respeta, el servidor no arranca y las pruebas fallan.

Catálogo en vivo: `GET /v1/modulos` · Especificación: `GET /v1/openapi.json` · Cliente: [`sdk/feline-client.ts`](../sdk/feline-client.ts)

## 1. Conectar una empresa y un sistema nuevos

Todo el alta se hace por API con el módulo `plataforma`, usando el token de plataforma (`FELINE_ADMIN_TOKEN`, definido en el servidor de Feline y solo por HTTPS). Son cuatro llamadas:

```bash
F=https://feline.tudominio.cl; T="Authorization: Bearer $FELINE_ADMIN_TOKEN"

# 1. Empresa emisora (si el RUT ya existe, actualiza sus datos)
curl -X POST $F/v1/plataforma/empresas -H "$T" -H 'Content-Type: application/json' -d '{
  "rut": "76192083-9", "razonSocial": "MI EMPRESA SPA", "giro": "Venta al por menor", "acteco": [479100],
  "direccionOrigen": "Av. Siempre Viva 123", "comunaOrigen": "Providencia", "ciudadOrigen": "Santiago",
  "fchResol": "2026-01-15", "nroResol": 0, "rutEnvia": "12345678-5", "environment": "CERTIFICACION" }'

# 2. Firma electrónica (.pfx en base64). Se guarda cifrada.
curl -X POST $F/v1/plataforma/empresas/76192083-9/certificado -H "$T" -H 'Content-Type: application/json' \
  -d "{\"pfxBase64\": \"$(base64 -i firma.pfx)\", \"clave\": \"****\"}"

# 3. Folios CAF descargados del SII (uno por tipo de documento)
curl -X POST $F/v1/plataforma/empresas/76192083-9/caf -H "$T" -H 'Content-Type: application/json' \
  -d "$(jq -Rs '{xml: .}' FoliosSII33.xml)"

# 4. Clave del sistema que emitirá, con los permisos mínimos que necesita
curl -X POST $F/v1/plataforma/empresas/76192083-9/proyectos -H "$T" -H 'Content-Type: application/json' \
  -d '{ "nombre": "Mi sistema", "webhookUrl": "https://mi-sistema/api/feline/webhook",
        "permisos": ["empresa:leer", "documentos:emitir", "documentos:leer"] }'
```

La respuesta del paso 4 trae `variables` con `FELINE_API_URL`, `FELINE_API_KEY` y `FELINE_WEBHOOK_SECRET`, listas para el `.env` del sistema. La clave (`flk_...`) y el secreto se muestran una sola vez: en Feline solo queda el hash de la clave. Lo mismo se puede hacer por consola con `npm run admin` (`empresa:crear`, `certificado:cargar`, `caf:cargar`, `proyecto:conectar`).

Después, en el sistema:
1. Guardar esas variables en el servidor del sistema (nunca en el navegador).
2. Copiar `sdk/feline-client.ts` al sistema y verificar la conexión al iniciar:
   ```ts
   const feline = new FelineClient({ baseUrl: process.env.FELINE_API_URL!, apiKey: process.env.FELINE_API_KEY! });
   const { proyecto, empresa, permisos } = await feline.yo();
   ```

Cada sistema tiene su propia clave. No se comparten claves entre sistemas: así se puede revocar uno sin afectar a los demás y cada documento queda asociado al sistema que lo pidió.

## 2. Módulos

La API se organiza en módulos. Cada uno agrupa un recurso y vive en `src/api/v1/modulos/<id>.modulo.ts`.

| Módulo | Rutas | Permisos que declara |
|---|---|---|
| `sistema` | `GET /v1/salud`, `GET /v1/modulos`, `GET /v1/openapi.json` (sin clave) · `GET /v1/yo` (cualquier clave válida) | — |
| `empresa` | `GET /v1/empresa` | `empresa:leer` |
| `documentos` | `POST /v1/documentos`, `GET /v1/documentos`, `GET /v1/documentos/:id`, `.../pdf`, `.../xml` | `documentos:emitir`, `documentos:leer` |
| `webhooks` | `POST /v1/webhooks/prueba` (usa `empresa:leer`) | — |
| `plataforma` | `GET/POST /v1/plataforma/empresas`, `.../empresas/:rut/certificado`, `.../caf`, `.../proyectos`, `/v1/plataforma/proyectos/:id/rotar-clave`, `.../webhook`, `.../revocar` (token de plataforma) | — |

### Reglas que el registro verifica al iniciar

1. El `id` del módulo va en minúsculas, es único y sus rutas viven bajo `/v1/<id>` (solo `sistema` usa la raíz).
2. Cada permiso tiene la forma `recurso:accion` (`documentos:emitir`) y lo declara un único módulo, con una descripción para el administrador.
3. Cada ruta declara **exactamente uno** de estos accesos:
   - `scope: '<permiso>'`: exige una clave con ese permiso (lo normal),
   - `soloClave: true`: exige una clave válida, sin permiso específico,
   - `plataforma: true`: exige el token de plataforma `FELINE_ADMIN_TOKEN` (alta de empresas y claves). Sin ese token configurado, responde 503,
   - `publico: true`: sin clave (solo salud, catálogo y especificación).
4. Cada ruta está en el fragmento OpenAPI de su módulo, por lo que la especificación nunca queda desfasada del código.
5. La versión del módulo es semver.

### Agregar un módulo

```ts
// src/api/v1/modulos/clientes.modulo.ts
import { definirModulo } from '../../norma/modulo';
import { ApiError } from '../../norma/errores';
import { error, paramId } from '../../norma/openapi';

export const moduloClientes = definirModulo({
  id: 'clientes',
  nombre: 'Clientes',
  descripcion: 'Receptores frecuentes de la empresa.',
  version: '1.0.0',
  prefijo: '/clientes',
  permisos: { 'clientes:leer': 'Consultar los clientes de la empresa.' },
  openapi: {
    paths: {
      '/v1/clientes/{id}': {
        get: { summary: 'Un cliente', parameters: [paramId], responses: { '200': { description: 'OK' }, '404': error('No encontrado') } },
      },
    },
  },
  registrar(app, ctx) {
    app.get('/:id', { config: { scope: 'clientes:leer' } }, async (request) => {
      const { id } = request.params as { id: string };
      // Siempre filtrar por la empresa de la clave: un sistema nunca ve datos de otra empresa
      const cliente = await ctx.prisma.receptor.findFirst({ where: { id, tenantId: request.apiClient!.tenantId } });
      if (!cliente) throw new ApiError(404, 'Cliente no encontrado');
      return cliente;
    });
  },
});
```

Después se suma a `MODULOS_V1` en [`src/api/v1/index.ts`](../src/api/v1/index.ts). El permiso nuevo queda disponible para asignarlo a las claves. Las claves existentes no lo reciben solas.

Lista de revisión antes de subir un módulo:

- [ ] Toda consulta filtra por `request.apiClient.tenantId`.
- [ ] Las entradas se validan con zod. Un error de validación responde 400 sin consumir folios ni escribir nada.
- [ ] Los `POST` que crean algo con efecto tributario o contable exigen `Idempotency-Key` (ver §4).
- [ ] Los montos CLP son enteros. No se usa `number` con decimales para dinero.
- [ ] Hay prueba en `tests/` y el módulo aparece en `GET /v1/modulos`.

## 3. Forma de las respuestas

**Éxito:** el recurso en JSON, con campos en español y `camelCase`. Los listados devuelven `{ datos: [...], siguienteCursor: string | null }`, con paginación por cursor (`?cursor=...&limite=50`, máximo 100).

**Error:** siempre esta forma, en todas las rutas de `/v1`, incluidas las inexistentes:

```json
{ "error": "Clave de API inválida o revocada", "codigo": "NO_AUTENTICADO", "requestId": "req-3f", "detalles": null }
```

| HTTP | `codigo` | Cuándo | ¿Reintentar? |
|---|---|---|---|
| 400 | `SOLICITUD_INVALIDA` | Datos mal formados (`detalles` trae los campos) | No, corregir |
| 401 | `NO_AUTENTICADO` | Falta la clave o está revocada | No |
| 403 | `SIN_PERMISO` | La clave no tiene el permiso o el RUT emisor no es el de la clave | No |
| 404 | `NO_ENCONTRADO` | El recurso no existe para esta empresa | No |
| 409 | `CONFLICTO` | Hay una emisión en curso con la misma `Idempotency-Key` | Sí, con la misma clave |
| 422 | `REGLA_DE_NEGOCIO` | Sin folios, certificado vencido, monto confirmado distinto... | No, revisar |
| 429 | `DEMASIADAS_SOLICITUDES` | Límite de uso | Sí, con espera |
| 5xx | `ERROR_INTERNO` / `NO_DISPONIBLE` | Falla de Feline | Sí, con la misma clave |

El sistema decide con `codigo` y muestra o registra `error`. Al reportar un problema se entrega el `requestId`, que también viene en la cabecera `x-request-id` de **toda** respuesta.

## 4. Idempotencia

Todo `POST` que emite un documento lleva `Idempotency-Key`, estable por operación del sistema que llama (por ejemplo `fugar_order_<id>`).

- Repetir la misma solicitud con la misma clave devuelve el mismo documento (`200`, `idempotente: true`) sin consumir otro folio.
- La misma clave con otro contenido responde 422.
- `montoConfirmado` (opcional) es el total que cobró el sistema de pagos. Si no coincide con el total tributario calculado, se responde 422 antes de reservar folio.

## 5. Webhooks

Feline avisa los cambios de estado con un `POST` a la URL del proyecto. El cuerpo es el documento más `evento` y lleva la cabecera `x-firma` = HMAC-SHA256 (hex) del cuerpo exacto con el secreto del proyecto. El receptor verifica la firma con `parsearWebhookFeline` del SDK y responde 2xx. Si no responde 2xx, Feline reintenta con espera creciente (30 s hasta 6 h, 12 intentos). `202` al emitir no significa aceptado por el SII: el estado final llega por webhook.

## 5b. Correo al receptor

Si la emisión trae `receptor.correo`, Feline envía el PDF y el XML a esa dirección cuando el SII acepta el documento. El envío usa Resend desde `FELINE_CORREO_REMITENTE`, con la razón social del emisor como nombre visible. El estado queda en el campo `correo` del documento (`AL_ACEPTAR_SII`, `PENDIENTE`, `ENVIADO` o `ERROR`).

Para reenviarlo, o enviarlo a otra dirección: `POST /v1/documentos/:id/correo` con `{ "correo": "otra@direccion.cl" }`, que exige el permiso `documentos:emitir`. Solo se aceptan documentos ya aceptados por el SII.

El correo se guarda por documento, no por cliente: las boletas a consumidor final comparten el RUT 66666666-6.

## 6. Versiones

- La versión mayor va en la ruta (`/v1`). Dentro de `/v1` solo se hacen cambios compatibles: rutas nuevas, campos nuevos opcionales y valores nuevos documentados.
- Quitar o renombrar un campo, cambiar un tipo o volver obligatorio algo opcional exige `/v2`, que conviviría con `/v1` mientras los sistemas migran.
- Cada módulo tiene su versión (`GET /v1/modulos`) y la API en conjunto la suya (`info.version` en la especificación).

## 7. Seguridad

- Las claves van solo en el servidor del sistema que llama, nunca en el navegador ni en el repositorio.
- El token de plataforma no se entrega a ningún sistema conectado: solo lo usa quien da de alta empresas. Las rutas `plataforma` reciben certificados y sus claves, por lo que solo se usan por HTTPS.
- Una clave pertenece a una empresa: todo lo que lee o escribe queda limitado a esa empresa.
- Se asignan los permisos mínimos. Un sistema que solo consulta no recibe `documentos:emitir`.
- Para revocar una clave: `npm run admin -- proyecto:revocar --id <id>`. El efecto es inmediato. Para cambiar la clave de un proyecto se usa `proyecto:rotar-clave`.

## Dónde está cada pieza

| Pieza | Archivo |
|---|---|
| Contrato de módulo y tipos | `src/api/norma/modulo.ts` |
| Registro, autenticación, errores y validación de la norma | `src/api/norma/registro.ts`, `src/api/norma/errores.ts` |
| Claves de proyecto | `src/api/norma/claves.ts` |
| Especificación OpenAPI | `src/api/norma/openapi.ts` |
| Módulos v1 | `src/api/v1/modulos/*.modulo.ts`, `src/api/v1/index.ts` |
| Pruebas de la norma | `tests/api-norma.test.ts` |
