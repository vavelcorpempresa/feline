# Conectar un proyecto a Feline

Feline es el motor de facturación electrónica (DTE) central. Cualquier proyecto lo usa por HTTP con:

- **una clave por proyecto y empresa** (`FELINE_API_KEY`), con permisos;
- **un webhook** opcional, al que Feline avisa los cambios de estado de los documentos.

La especificación completa está en `GET {FELINE_API_URL}/v1/openapi.json` (no requiere clave). Con ella se puede generar un cliente en cualquier lenguaje.

> La clave da acceso a emitir documentos tributarios a nombre de la empresa. Úsala **solo en el servidor** (rutas API, server actions, workers); nunca en código que llegue al navegador.

## 1. Registrar el proyecto (en Feline)

```bash
npm run admin -- proyecto:conectar \
  --rut 76192083-9 \
  --nombre "Mi proyecto" \
  --webhook-url https://mi-proyecto.cl/api/feline/webhook
```

El comando imprime las tres variables para el `.env` del proyecto. La clave no se vuelve a mostrar:

```
FELINE_API_URL=http://localhost:3004
FELINE_API_KEY=flk_...
FELINE_WEBHOOK_SECRET=...
```

| Opción | Uso |
|---|---|
| `--permisos documentos:leer` | Proyecto de solo lectura (por defecto: `documentos:emitir,documentos:leer,empresa:leer`). |
| sin `--webhook-url` | El proyecto no recibe avisos; consulta el estado con `GET /v1/documentos/:id`. |

Otros comandos: `proyecto:listar`, `proyecto:rotar-clave --id <id>`, `proyecto:webhook --id <id> --url <url>` y `proyecto:revocar --id <id>`.

Un proyecto que factura para varias empresas necesita una clave por empresa. Cada clave solo puede emitir con el RUT de su empresa.

## 2. Instalar el cliente (proyectos Node / Next.js)

Copia [`sdk/feline-client.ts`](../sdk/feline-client.ts) al proyecto (por ejemplo, `lib/feline-client.ts`). Es un archivo único sin dependencias y necesita Node 18 o superior.

```ts
// lib/feline.ts
import { FelineClient } from './feline-client';

export const feline = new FelineClient({
  baseUrl: process.env.FELINE_API_URL!,
  apiKey: process.env.FELINE_API_KEY!,
});
```

Para comprobar la conexión: `await feline.empresa()` devuelve la empresa, el certificado vigente y los folios disponibles por tipo de documento.

## 3. Emitir un documento

```ts
const doc = await feline.emitir(
  {
    tipoDte: 39, // 33 factura · 34 factura exenta · 39 boleta · 41 boleta exenta · 56 nota de débito · 61 nota de crédito
    referenciaExterna: pedido.id, // tu id, para buscar el documento después
    emisor: { rut: '76192083-9' },
    receptor: { rut: '66666666-6', razonSocial: 'Consumidor final', correo: cliente.email },
    items: pedido.items.map((i) => ({ nombre: i.titulo, cantidad: i.cantidad, precio: i.precio })),
  },
  { idempotencyKey: `pedido_${pedido.id}_boleta` }
);
// doc → { id, folio, estado: 'ENVIADO', trackId, montoTotal, pdfUrl, xmlUrl, ... }
```

**Reglas importantes**

- **Precios.** En factura y notas, `precio` es el **neto** unitario. En boleta, es el **precio final con IVA incluido**.
- **Factura y notas.** Exigen `giro`, `direccion` y `comuna` del receptor. Feline no inventa esos datos: si faltan, responde 400.
- **`idempotencyKey`.** Debe ser **estable por documento**. Si reintentas con la misma clave (después de un timeout o una caída), recibes el mismo documento sin consumir otro folio. Si usas la misma clave con otro contenido, recibes 422.
- **Notas de crédito.** Llevan referencia al documento original, por ejemplo `referencias: [{ tipo: '33', folio: 15, codRef: 1, razon: 'Anula factura' }]`.
- **Referencias no tributarias.** Se aceptan los alias `OC` (orden de compra), `PED` (nota de pedido) y `CONTRATO`. Las boletas no llevan referencias.

## 4. Ciclo de vida y webhook

```
FIRMADO → ENVIADO (TrackID del SII) → ACEPTADO | ACEPTADO_CON_REPARO | RECHAZADO
```

Al aceptar el documento, Feline lo **envía de inmediato al SII**: la respuesta suele llegar ya con estado `ENVIADO` y su `trackId`. Si el SII tarda más de 10 segundos o falla, la respuesta llega con estado `FIRMADO`, el envío continúa o se reintenta en segundo plano y no se pierde el documento. Feline avisa **cada cambio de estado** con un `POST` al webhook del proyecto.

```ts
// app/api/feline/webhook/route.ts (Next.js)
import { parsearWebhookFeline } from '@/lib/feline-client';

export async function POST(req: Request) {
  const cuerpo = await req.text(); // el cuerpo EXACTO: no uses req.json() antes de verificar
  let evento;
  try {
    evento = parsearWebhookFeline(cuerpo, req.headers.get('x-firma'), process.env.FELINE_WEBHOOK_SECRET!);
  } catch {
    return Response.json({ error: 'Firma inválida' }, { status: 401 });
  }
  if (evento.evento === 'documento.estado') {
    // evento.id, evento.estado, evento.folio, evento.referenciaExterna, evento.pdfUrl ...
    await guardarEstado(evento.referenciaExterna, evento);
  }
  return Response.json({ ok: true }); // responde 2xx; si no, Feline reintenta
}
```

- **Firma.** La cabecera `x-firma` es el HMAC-SHA256 en hexadecimal del cuerpo, calculado con `FELINE_WEBHOOK_SECRET`.
- **Reintentos.** Si tu webhook no responde 2xx, Feline reintenta 12 veces con espera creciente (de 30 s hasta 6 h).
- **Avisos repetidos.** Un mismo estado puede llegar más de una vez. Procesa los avisos de forma idempotente, usando `id` + `estado`.
- **Prueba.** `await feline.probarWebhook()` envía un evento `webhook.prueba` y devuelve si llegó.

## 5. Consultar y descargar

```ts
await feline.obtener(doc.id);                          // estado actual
await feline.buscarPorReferencia(pedido.id);           // por tu id
await feline.listar({ tipoDte: 33, desde: '2026-10-01', hasta: '2026-10-31' });
for await (const d of feline.listarTodos({ estado: 'RECHAZADO' })) { /* ... */ }
const pdf = await feline.pdf(doc.id);                  // ArrayBuffer (application/pdf)
```

`listar` muestra por defecto solo los documentos de **tu** proyecto. Con `todos: true` incluye los de los demás proyectos de la misma empresa (útil para un panel contable con permiso `documentos:leer`).

## 6. Otros lenguajes (HTTP directo)

```bash
curl -X POST "$FELINE_API_URL/v1/documentos" \
  -H "Authorization: Bearer $FELINE_API_KEY" \
  -H "Idempotency-Key: pedido_123_boleta" \
  -H "Content-Type: application/json" \
  -d '{"tipoDte":39,"emisor":{"rut":"76192083-9"},"receptor":{"rut":"66666666-6","razonSocial":"Consumidor final"},"items":[{"nombre":"Polera","cantidad":1,"precio":15990}]}'
```

| Código | Significado | ¿Reintentar? |
|---|---|---|
| 202 | Emitido y enviado al SII (`ENVIADO` + `trackId`); si el SII no respondió a tiempo, `FIRMADO` y se reintenta solo | — |
| 200 | Ya existía con esta `Idempotency-Key` (`idempotente: true`) | — |
| 400 | Datos inválidos (`detalles` indica el campo) | No: corrige los datos |
| 401 | Clave inválida o revocada | No |
| 403 | Falta un permiso, o el RUT emisor no es el de la clave | No |
| 409 | Hay una emisión en curso con la misma clave | Sí, con la misma clave |
| 422 | Regla de negocio: sin folios CAF, certificado vencido, clave reutilizada con otro contenido… | No hasta resolver la causa |
| 5xx o red | Falla temporal | Sí, con la misma clave |

El SDK reintenta automáticamente los casos 409, 429, 5xx y las fallas de red.

## 7. Desarrollo local

Con `FELINE_SII_MODO=simulado`, Feline acepta todo sin conectarse al SII. Sirve para probar el ciclo completo:

```bash
npm run admin -- dev:empresa-prueba --webhook-url http://localhost:3000/api/feline/webhook
```

Ese comando crea la empresa de prueba `76192083-9` con un certificado autofirmado y CAF locales. Esos documentos **no tienen validez tributaria**. Para emitir de verdad, carga el certificado y los CAF reales (`certificado:cargar` y `caf:cargar`) y usa `FELINE_SII_MODO=real`.
