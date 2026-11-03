import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

// ============================================================================
// PRUEBA DE INTEGRACIÓN API v1 ↔ FUGAR MARKETPLACE (PostgreSQL real)
// Requiere TEST_DATABASE_URL (base desechable: se vacía al iniciar). Ejemplo:
//   TEST_DATABASE_URL=postgresql://postgres:feline_test@127.0.0.1:54339/feline_test npx vitest run tests/api-v1
// ============================================================================

const TEST_DB = process.env.TEST_DATABASE_URL;

// Copia literal de lo que hace FUGAR (app/api/v1/billing/webhook/route.ts y lib/dte/types.ts)
function fugarVerificaFirma(bodyText: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(bodyText).digest('hex');
  const a = Buffer.from(signature), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function fugarEstadoDesdeMotor(estado: string | null | undefined) {
  const e = String(estado || '').toUpperCase();
  if (/REPARO/.test(e)) return 'ACEPTADO_REPAROS';
  if (/ACEPT|ACK|OK/.test(e)) return 'ACEPTADO';
  if (/RECHAZ|REJECT|ERROR_SII/.test(e)) return 'RECHAZADO';
  return 'ENVIADO';
}

// Payload idéntico al que arma FUGAR en lib/services/dte.service.ts
function payloadFugar(tipoDte: number, overrides: Record<string, unknown> = {}) {
  const esBoleta = tipoDte === 39 || tipoDte === 41;
  return {
    tipoDte,
    emisor: {
      rut: '76192083-9',
      razonSocial: 'EMPRESA DE PRUEBA SPA',
      giro: 'Venta al por menor',
      acteco: [479100],
      direccion: 'Av. Providencia 1234',
      comuna: 'Providencia',
      ciudad: 'Santiago',
    },
    receptor: esBoleta
      ? { rut: '66666666-6', razonSocial: 'Consumidor final', giro: 'Particular', direccion: 'Sin Dirección', comuna: 'Santiago' }
      : {
          rut: '77777777-7',
          razonSocial: "DISCOS O'HIGGINS LTDA",
          giro: 'Venta de discos',
          direccion: 'Av. Matta 500',
          comuna: 'Santiago Centro Comuna Larga',
          correo: 'dte@discos.cl',
        },
    referencias: [{ tipo: 'PED', folio: 'FUG-1001' }],
    items: [
      { nombre: 'Polera Gira 2026 — M · Negro', cantidad: 2, precio: esBoleta ? 15990 : 13437, exento: false },
      { nombre: 'Despacho', cantidad: 1, precio: esBoleta ? 3990 : 3353, exento: false },
    ],
    ...overrides,
  };
}

describe.skipIf(!TEST_DB)('API v1 Motor DTE ↔ FUGAR Marketplace (PostgreSQL)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let clave: string;
  let webhookSecret: string;
  let claveOtraEmpresa: string;
  let admin: any;
  const webhooksRecibidos: Array<{ body: string; firma: string | null }> = [];

  const auth = (k = clave) => ({ authorization: `Bearer ${k}` });

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.FELINE_PUBLIC_URL = 'http://feline.test';
    const { prismaBase } = await import('../src/core/tenant-context');
    const { buildFastifyApp } = await import('../src/server');
    const { FelineAdmin } = await import('../src/admin/feline-admin');
    prisma = prismaBase;

    // Base desechable: vaciar todas las tablas
    const tablas = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    await prisma.$executeRawUnsafe(
      `TRUNCATE ${tablas.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`
    );

    admin = new FelineAdmin(prisma);
    const empresa = await admin.crearEmpresaPrueba({ webhookUrl: 'http://fugar.test/api/v1/billing/webhook' });
    clave = empresa.clave;
    webhookSecret = empresa.webhookSecret!;
    const otra = await admin.crearEmpresaPrueba({ rut: '76123456-0' });
    claveOtraEmpresa = otra.clave;

    // Webhook de FUGAR simulado: guarda el cuerpo exacto y la firma recibida
    const webhookFetch: typeof fetch = async (_url, init) => {
      webhooksRecibidos.push({
        body: String(init?.body),
        firma: new Headers(init?.headers).get('x-firma'),
      });
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
    };
    app = buildFastifyApp({ siiModo: 'simulado', webhookFetch });
    await app.ready();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  const emitir = (payload: unknown, key: string, k = clave) =>
    app.inject({
      method: 'POST',
      url: '/v1/documentos',
      headers: { ...auth(k), 'idempotency-key': key, 'content-type': 'application/json' },
      payload: payload as any,
    });

  it('Rechaza solicitudes sin clave o con clave inválida (401)', async () => {
    const sinClave = await app.inject({ method: 'POST', url: '/v1/documentos', payload: payloadFugar(33) });
    expect(sinClave.statusCode).toBe(401);
    const malaClave = await emitir(payloadFugar(33), 'x', 'flk_clave_falsa');
    expect(malaClave.statusCode).toBe(401);
  });

  it('Exige Idempotency-Key (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/documentos',
      headers: auth(),
      payload: payloadFugar(33),
    });
    expect(res.statusCode).toBe(400);
  });

  let facturaId: string;

  it('Emite Factura 33 con el payload de FUGAR: 202 { id, tipoDte, folio, estado }', async () => {
    const res = await emitir(payloadFugar(33), 'fugar_dte_factura_1');
    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body).toMatchObject({ tipoDte: 33, folio: 1, estado: 'FIRMADO', idempotente: false });
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    // Neto = 2×13437 + 3353 = 30227 → IVA 5743 → Total 35970
    expect(body).toMatchObject({ montoNeto: 30227, iva: 5743, montoTotal: 35970 });
    expect(body.pdfUrl).toBe(`http://feline.test/v1/documentos/${body.id}/pdf`);
    // Lo que FUGAR lee de la respuesta (lib/services/dte.service.ts)
    expect(fugarEstadoDesdeMotor(body.estado)).toBe('ENVIADO');
    facturaId = body.id;
  });

  it('Reintento con la misma Idempotency-Key: 200 idempotente, mismo documento y sin consumir folio', async () => {
    const res = await emitir(payloadFugar(33), 'fugar_dte_factura_1');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: facturaId, folio: 1, idempotente: true });
    const total = await prisma.documentoDTE.count({ where: { tipoDte: 33 } });
    expect(total).toBe(1);
  });

  it('Misma Idempotency-Key con otro contenido: 422', async () => {
    const res = await emitir(payloadFugar(33, { items: [{ nombre: 'Otro', cantidad: 1, precio: 100 }] }), 'fugar_dte_factura_1');
    expect(res.statusCode).toBe(422);
  });

  it('No permite emitir con un RUT emisor distinto al de la clave (403)', async () => {
    const p = payloadFugar(33);
    const res = await emitir({ ...p, emisor: { ...p.emisor, rut: '76123456-0' } }, 'fugar_dte_otro_emisor');
    expect(res.statusCode).toBe(403);
  });

  it('Valida el payload y responde errores claros (400)', async () => {
    const res = await emitir(payloadFugar(33, { items: [] }), 'fugar_dte_sin_items');
    expect(res.statusCode).toBe(400);
    const rutMalo = await emitir(
      payloadFugar(33, { receptor: { rut: '77777777-1', razonSocial: 'X' } }),
      'fugar_dte_rut_malo'
    );
    expect(rutMalo.statusCode).toBe(400);
    expect(rutMalo.json().error).toMatch(/RUT del receptor/);
  });

  it('Emite Boleta 39 con precios IVA incluido: total = suma de precios finales', async () => {
    const res = await emitir(payloadFugar(39), 'fugar_dte_boleta_1');
    expect(res.statusCode).toBe(202);
    // Bruto = 2×15990 + 3990 = 35970 → Neto 30227 + IVA 5743
    expect(res.json()).toMatchObject({ tipoDte: 39, folio: 1, montoTotal: 35970, montoNeto: 30227, iva: 5743 });
    // La referencia PED no viaja en boletas: se informa como advertencia
    expect(res.json().advertencias?.[0]).toMatch(/boletas/i);
  });

  it('Emisiones concurrentes asignan folios únicos y correlativos (SELECT ... FOR UPDATE)', async () => {
    const resultados = await Promise.all(
      Array.from({ length: 8 }, (_, i) => emitir(payloadFugar(39), `fugar_dte_concurrente_${i}`))
    );
    expect(resultados.every((r) => r.statusCode === 202)).toBe(true);
    const folios = resultados.map((r) => r.json().folio).sort((a, b) => a - b);
    expect(folios).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('Referencia PED se traduce a código SII 802 (Nota de Pedido) en la factura', async () => {
    const doc = await prisma.documentoDTE.findUniqueOrThrow({ where: { id: facturaId } });
    expect(doc.dteXmlFirmado).toContain('<TpoDocRef>802</TpoDocRef><FolioRef>FUG-1001</FolioRef>');
    // Comuna truncada al largo máximo del SII (20) y apóstrofo sin escapar (firma válida)
    expect(doc.dteXmlFirmado).toContain("<RznSocRecep>DISCOS O'HIGGINS LTDA</RznSocRecep>");
    expect(doc.dteXmlFirmado).toContain('<CmnaRecep>Santiago Centro Comu</CmnaRecep>');
  });

  it('GET estado, PDF con timbre y XML firmado', async () => {
    const estado = await app.inject({ method: 'GET', url: `/v1/documentos/${facturaId}`, headers: auth() });
    expect(estado.statusCode).toBe(200);
    expect(estado.json()).toMatchObject({ id: facturaId, folio: 1 });

    const pdf = await app.inject({ method: 'GET', url: `/v1/documentos/${facturaId}/pdf`, headers: auth() });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');

    const xml = await app.inject({ method: 'GET', url: `/v1/documentos/${facturaId}/xml`, headers: auth() });
    expect(xml.statusCode).toBe(200);
    const xmlStr = xml.rawPayload.toString('latin1');
    expect(xmlStr).toMatch(/^<\?xml version="1.0" encoding="ISO-8859-1"\?>\n<DTE xmlns="http:\/\/www.sii.cl\/SiiDte"/);

    const { XmlDsigSignerService } = await import('../src/services/xmldsig-signer.service');
    const cert = xmlStr.match(/<X509Certificate>([^<]+)<\/X509Certificate>/)![1];
    const pem = `-----BEGIN CERTIFICATE-----\n${cert.match(/.{1,64}/g)!.join('\n')}\n-----END CERTIFICATE-----`;
    const doc = await prisma.documentoDTE.findUniqueOrThrow({ where: { id: facturaId } });
    expect(XmlDsigSignerService.verifySignedXml(xmlStr, `F${doc.folio}T33`, pem)).toEqual({
      validDigest: true,
      validSignature: true,
    });
  });

  it('Aislamiento: la clave de otra empresa no ve los documentos (404)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/documentos/${facturaId}`,
      headers: auth(claveOtraEmpresa),
    });
    expect(res.statusCode).toBe(404);
  });

  it('Nota de Crédito 61 que anula la factura (referencia tributaria con CodRef 1)', async () => {
    const res = await emitir(
      payloadFugar(61, {
        referencias: [{ tipo: '33', folio: 1, codRef: 1, razon: 'Anula factura por devolución' }],
      }),
      'fugar_nc_1'
    );
    expect(res.statusCode).toBe(202);
    const doc = await prisma.documentoDTE.findUniqueOrThrow({ where: { id: res.json().id } });
    expect(doc.dteXmlFirmado).toContain('<TpoDocRef>33</TpoDocRef><FolioRef>1</FolioRef>');
    expect(doc.dteXmlFirmado).toContain('<CodRef>1</CodRef>');
  });

  it('Sin CAF disponible responde 422 con mensaje claro', async () => {
    const res = await emitir(payloadFugar(56, { referencias: [{ tipo: '33', folio: 1, codRef: 3, razon: 'x' }] }), 'nd_sin_caf_tras_agotar');
    // La empresa de prueba sí tiene CAF 56: se agota a mano para probar el error
    expect(res.statusCode).toBe(202);
    await prisma.cafFolio.updateMany({ where: { tipoDte: 56 }, data: { agotado: true } });
    const sinCaf = await emitir(payloadFugar(56, { referencias: [{ tipo: '33', folio: 1, codRef: 3, razon: 'x' }] }), 'nd_sin_caf');
    expect(sinCaf.statusCode).toBe(422);
    expect(sinCaf.json().error).toMatch(/No existen folios CAF/);
    // La clave se libera: un reintento posterior (con CAF nuevo) es posible
    expect(await prisma.apiIdempotencia.count({ where: { clave: 'nd_sin_caf' } })).toBe(0);
  });

  it('Ciclo SII completo: FIRMADO → ENVIADO → ACEPTADO con webhooks firmados que FUGAR acepta', async () => {
    // Ciclo 1: envía todos los firmados (factura, boletas, notas) y avisa ENVIADO
    const t1 = await app.dteDispatcher.tick();
    expect((t1 as any).enviados).toBeGreaterThanOrEqual(12);
    const factura = await prisma.documentoDTE.findUniqueOrThrow({ where: { id: facturaId } });
    expect(factura.estado).toBe('ENVIADO');
    expect(factura.trackId).toBeTruthy();

    // Ciclo 2: consulta el estado al SII y avisa ACEPTADO
    await prisma.documentoDTE.updateMany({ data: { siiConsultadoAt: null } });
    await app.dteDispatcher.tick();
    const aceptada = await prisma.documentoDTE.findUniqueOrThrow({ where: { id: facturaId } });
    expect(aceptada.estado).toBe('ACEPTADO');

    const boleta = await prisma.documentoDTE.findFirstOrThrow({ where: { tipoDte: 39, folio: 1 } });
    expect(boleta.estado).toBe('ACEPTADO');
    const lote = await prisma.envioDteLote.findFirstOrThrow({ where: { documentos: { some: { id: boleta.id } } } });
    expect(lote.esBoleta).toBe(true);
    expect(lote.xmlEnvio).toContain('<EnvioBOLETA');

    // Webhooks: firma válida con el algoritmo de FUGAR y estados que FUGAR entiende
    const avisosFactura = webhooksRecibidos
      .map((w) => ({ ...w, json: JSON.parse(w.body) }))
      .filter((w) => w.json.id === facturaId);
    expect(avisosFactura.map((w) => fugarEstadoDesdeMotor(w.json.estado))).toEqual(['ENVIADO', 'ACEPTADO']);
    for (const w of webhooksRecibidos) {
      expect(fugarVerificaFirma(w.body, w.firma, webhookSecret)).toBe(true);
    }
    expect(avisosFactura[1].json).toMatchObject({
      id: facturaId,
      folio: 1,
      trackId: aceptada.trackId,
      xmlUrl: `http://feline.test/v1/documentos/${facturaId}/xml`,
      pdfUrl: `http://feline.test/v1/documentos/${facturaId}/pdf`,
    });

    // La empresa sin webhook configurado no genera avisos
    const otra = await prisma.apiClient.findFirstOrThrow({ where: { webhookUrl: null } });
    expect(await prisma.webhookEvento.count({ where: { apiClientId: otra.id } })).toBe(0);
  });

  describe('Conexión genérica de proyectos (SDK + permisos)', () => {
    let baseUrl: string;
    let FelineClient: typeof import('../sdk/feline-client').FelineClient;
    let sdk: typeof import('../sdk/feline-client');

    beforeAll(async () => {
      sdk = await import('../sdk/feline-client');
      FelineClient = sdk.FelineClient;
      baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
    });

    it('OpenAPI es público y describe los endpoints', async () => {
      const res = await fetch(`${baseUrl}/v1/openapi.json`);
      expect(res.status).toBe(200);
      const spec = await res.json();
      expect(spec.openapi).toBe('3.0.3');
      expect(Object.keys(spec.paths)).toEqual(
        expect.arrayContaining(['/v1/documentos', '/v1/documentos/{id}', '/v1/empresa', '/v1/webhooks/prueba'])
      );
    });

    it('SDK: empresa, emisión con referencia externa, idempotencia, búsqueda y PDF', async () => {
      const feline = new FelineClient({ baseUrl: `${baseUrl}/v1`, apiKey: clave });

      const empresa = await feline.empresa();
      expect(empresa.empresa.rut).toBe('76192083-9');
      expect(empresa.proyecto.permisos).toEqual(['documentos:emitir', 'documentos:leer', 'empresa:leer']);
      expect(empresa.foliosDisponibles.find((f) => f.tipoDte === 39)?.disponibles).toBeGreaterThan(900);

      const pedido = { ...payloadFugar(39), referenciaExterna: 'proyecto-x-pedido-77' } as any;
      const doc = await feline.emitir(pedido, { idempotencyKey: 'sdk_pedido_77' });
      expect(doc).toMatchObject({ tipoDte: 39, idempotente: false, referenciaExterna: 'proyecto-x-pedido-77' });
      const repetido = await feline.emitir(pedido, { idempotencyKey: 'sdk_pedido_77' });
      expect(repetido).toMatchObject({ id: doc.id, idempotente: true });

      expect((await feline.buscarPorReferencia('proyecto-x-pedido-77'))?.id).toBe(doc.id);
      expect(await feline.buscarPorReferencia('no-existe')).toBeNull();

      const pdf = Buffer.from(await feline.pdf(doc.id));
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('SDK: listado paginado recorre todos los documentos del proyecto', async () => {
      const feline = new FelineClient({ baseUrl, apiKey: clave });
      const total = await prisma.documentoDTE.count({
        where: { apiClient: { keyHash: (await import('../src/api/v1/documentos.routes')).hashApiKey(clave) } },
      });
      const primera = await feline.listar({ limite: 3 });
      expect(primera.datos).toHaveLength(3);
      expect(primera.siguienteCursor).toBeTruthy();
      const ids: string[] = [];
      for await (const d of feline.listarTodos({ limite: 4 })) ids.push(d.id);
      expect(ids).toHaveLength(total);
      expect(new Set(ids).size).toBe(total);
      const boletas = await feline.listar({ tipoDte: 39, limite: 100 });
      expect(boletas.datos.every((d) => d.tipoDte === 39)).toBe(true);
    });

    it('Permisos: un proyecto de solo lectura no puede emitir; por defecto solo ve sus documentos', async () => {
      const lectura = await admin.crearApiClient({
        rut: '76192083-9',
        nombre: 'Dashboard contable',
        permisos: ['documentos:leer'],
      });
      const feline = new FelineClient({ baseUrl, apiKey: lectura.clave, reintentos: 0 });

      await expect(feline.emitir(payloadFugar(39) as any, { idempotencyKey: 'lectura_1' })).rejects.toMatchObject({
        status: 403,
        message: expect.stringMatching(/documentos:emitir/),
      });
      await expect(feline.empresa()).rejects.toMatchObject({ status: 403 });

      expect((await feline.listar()).datos).toHaveLength(0);
      const todos = await feline.listar({ todos: true, limite: 100 });
      expect(todos.datos.length).toBeGreaterThan(10);
    });

    it('Rotar y revocar claves de un proyecto', async () => {
      const p = await admin.crearApiClient({ rut: '76192083-9', nombre: 'Proyecto temporal' });
      const vieja = new FelineClient({ baseUrl, apiKey: p.clave, reintentos: 0 });
      await expect(vieja.empresa()).resolves.toBeTruthy();

      const { clave: nueva } = await admin.rotarClave(p.id);
      await expect(vieja.empresa()).rejects.toMatchObject({ status: 401 });
      const conNueva = new FelineClient({ baseUrl, apiKey: nueva, reintentos: 0 });
      await expect(conNueva.empresa()).resolves.toBeTruthy();

      await admin.revocarProyecto(p.id);
      await expect(conNueva.empresa()).rejects.toMatchObject({ status: 401 });
      const lista = await admin.listarProyectos('76192083-9');
      expect(lista.find((x: any) => x.id === p.id)).toMatchObject({ activo: false, nombre: 'Proyecto temporal' });
    });

    it('Webhook de prueba llega firmado y el SDK lo verifica', async () => {
      const feline = new FelineClient({ baseUrl, apiKey: clave });
      const antes = webhooksRecibidos.length;
      expect(await feline.probarWebhook()).toMatchObject({ entregado: true });
      const recibido = webhooksRecibidos[antes];
      const evento = sdk.parsearWebhookFeline(recibido.body, recibido.firma, webhookSecret);
      expect(evento.evento).toBe('webhook.prueba');
      expect(() => sdk.parsearWebhookFeline(recibido.body, recibido.firma, 'otro-secreto')).toThrow(/Firma/);

      // Proyecto sin webhook: respuesta clara
      const sinWebhook = new FelineClient({ baseUrl, apiKey: claveOtraEmpresa });
      expect(await sinWebhook.probarWebhook()).toMatchObject({ entregado: false });
    });

    it('SDK no reintenta errores del cliente (400) y sí reintenta caídas de red', async () => {
      let llamadas = 0;
      const contando: typeof fetch = async (input, init) => {
        llamadas++;
        return fetch(input, init);
      };
      const feline = new FelineClient({ baseUrl, apiKey: clave, fetch: contando, reintentos: 2 });
      await expect(feline.emitir({ ...payloadFugar(33), items: [] } as any, { idempotencyKey: 'sdk_400' })).rejects.toMatchObject({ status: 400 });
      expect(llamadas).toBe(1);

      const caido = new FelineClient({ baseUrl: 'http://127.0.0.1:9', apiKey: clave, reintentos: 1 });
      await expect(caido.empresa()).rejects.toMatchObject({ status: 0, reintentable: true });
    });
  });

  describe('Despachador SII: recuperación, reintentos y registro de errores (auditoría ACF, grupo 3)', () => {
    const atrasar = (id: string, minutos: number) =>
      prisma.$executeRawUnsafe(
        `UPDATE documentos_dte SET "updatedAt" = now() - interval '${minutos} minutes' WHERE id = '${id}'::uuid`
      );

    it('Recupera un documento que quedó en EN_LOTE por un envío interrumpido', async () => {
      const res = await emitir(payloadFugar(33), 'acf_en_lote_atascado');
      const id = res.json().id;
      await prisma.documentoDTE.update({ where: { id }, data: { estado: 'EN_LOTE' } });
      await atrasar(id, 20);
      const r: any = await app.dteDispatcher.tick();
      expect(r.recuperados).toBeGreaterThanOrEqual(1);
      expect((await prisma.documentoDTE.findUniqueOrThrow({ where: { id } })).estado).toBe('ENVIADO');
    });

    it('Un envío fallido espera antes de reintentar y deja registro del error', async () => {
      const { DteDispatcherService } = await import('../src/services/dte-dispatcher.service');
      const res = await emitir(payloadFugar(33), 'acf_envio_fallido');
      const id = res.json().id;
      let intentos = 0;
      const errores: string[] = [];
      const orquestadorQueFalla: any = {
        enviarLoteDteAlSii: async () => {
          intentos++;
          throw new Error('SII no responde');
        },
      };
      const sinWebhooks: any = { encolar: async () => null, entregarPendientes: async () => ({ entregados: 0, fallidos: 0 }) };
      const despachador = new DteDispatcherService(prisma, orquestadorQueFalla, {} as any, {} as any, sinWebhooks, {
        lote: 100,
        registrarError: (m) => errores.push(m),
      });
      // Solo este documento queda pendiente de envío
      await prisma.documentoDTE.updateMany({ where: { estado: 'FIRMADO', NOT: { id } }, data: { estado: 'ACEPTADO' } });

      await despachador.tick();
      expect(intentos).toBe(1);
      const tras1 = await prisma.documentoDTE.findUniqueOrThrow({ where: { id } });
      expect(tras1.estado).toBe('FIRMADO');
      expect(tras1.glosaEstadoSii).toMatch(/^Reintento de envío: SII no responde/);
      expect(errores.some((e) => e.includes(id))).toBe(true);

      await despachador.tick();
      expect(intentos).toBe(1); // dentro de la espera: no se reintenta

      await atrasar(id, 10);
      await despachador.tick();
      expect(intentos).toBe(2); // pasada la espera: se reintenta
    });

    it('Si el ciclo completo falla, el error queda registrado', async () => {
      const { DteDispatcherService } = await import('../src/services/dte-dispatcher.service');
      const errores: string[] = [];
      const prismaCaido: any = { documentoDTE: { updateMany: async () => { throw new Error('sin base de datos'); } } };
      const despachador = new DteDispatcherService(prismaCaido, {} as any, {} as any, {} as any, {} as any, {
        registrarError: (m) => errores.push(m),
      });
      const r: any = await despachador.tick();
      expect(r.omitido).toBe(true);
      expect(errores).toEqual(['el ciclo falló']);
    });
  });
});
