import { describe, it, expect } from 'vitest';
import { estadoFinalDesdeSii } from '../src/services/dte-dispatcher.service';
import { esperaReintentoMs, firmarWebhook, WebhookService } from '../src/services/webhook.service';
import { ApiDocumentosService, DocumentoRequestSchema } from '../src/services/api-documentos.service';
import { generarApiKey, hashApiKey } from '../src/api/v1/documentos.routes';

describe('API v1 - piezas unitarias', () => {
  it('Traduce el resultado del SII a estado final del documento', () => {
    expect(estadoFinalDesdeSii({ estado: 'EPR', aceptados: 1, rechazados: 0, reparos: 0 })).toBe('ACEPTADO');
    expect(estadoFinalDesdeSii({ estado: 'EPR', aceptados: 1, rechazados: 0, reparos: 1 })).toBe('ACEPTADO_CON_REPARO');
    expect(estadoFinalDesdeSii({ estado: 'EPR', aceptados: 0, rechazados: 1, reparos: 0 })).toBe('RECHAZADO');
    expect(estadoFinalDesdeSii({ estado: 'RFR', aceptados: 0, rechazados: 0, reparos: 0 })).toBe('RECHAZADO');
    // En proceso: todavía no hay estado final
    for (const e of ['REC', 'SOK', 'FOK', 'PRD', 'CRT']) {
      expect(estadoFinalDesdeSii({ estado: e, aceptados: 0, rechazados: 0, reparos: 0 })).toBeNull();
    }
  });

  it('Claves de API: prefijo reconocible y solo se guarda su hash', () => {
    const { clave, prefix, hash } = generarApiKey();
    expect(clave.startsWith('flk_')).toBe(true);
    expect(clave.startsWith(prefix)).toBe(true);
    expect(hash).toBe(hashApiKey(clave));
    expect(hash).not.toContain(clave);
  });

  it('Backoff de webhooks: 30 s, 60 s, 120 s ... con tope de 6 horas', () => {
    expect(esperaReintentoMs(1)).toBe(30_000);
    expect(esperaReintentoMs(2)).toBe(60_000);
    expect(esperaReintentoMs(3)).toBe(120_000);
    expect(esperaReintentoMs(20)).toBe(6 * 60 * 60 * 1000);
  });

  it('Webhook fallido se reprograma; exitoso se marca entregado', async () => {
    const updates: any[] = [];
    const evento = {
      id: 'e1',
      intentos: 0,
      payload: { id: 'd1', estado: 'ACEPTADO' },
      apiClient: { webhookUrl: 'http://fugar.test/webhook', webhookSecret: 's3cr3t' },
    };
    const prisma: any = {
      webhookEvento: {
        findMany: async () => [evento],
        update: async (args: any) => updates.push(args),
      },
    };
    let respuesta = 500;
    let firmaRecibida = '';
    const fetchFake: typeof fetch = async (_u, init) => {
      firmaRecibida = new Headers(init?.headers).get('x-firma')!;
      return new Response('x', { status: respuesta });
    };
    const ws = new WebhookService(prisma, () => ({}), fetchFake);

    expect(await ws.entregarPendientes()).toEqual({ entregados: 0, fallidos: 1 });
    expect(updates[0].data.intentos).toBe(1);
    expect(updates[0].data.proximoIntento.getTime()).toBeGreaterThan(Date.now() + 25_000);
    expect(firmaRecibida).toBe(firmarWebhook(JSON.stringify(evento.payload), 's3cr3t'));

    respuesta = 200;
    expect(await ws.entregarPendientes()).toEqual({ entregados: 1, fallidos: 0 });
    expect(updates[1].data.entregadoAt).toBeInstanceOf(Date);
  });

  it('Mapea ítems: factura con precio neto, boleta con precio final, exentas con IndExe', () => {
    const base = {
      emisor: { rut: '76192083-9' },
      receptor: { rut: '66666666-6', razonSocial: 'Consumidor final' },
      items: [{ nombre: 'A', cantidad: 3, precio: 1000 }],
    };
    const factura = ApiDocumentosService.toDetalles(DocumentoRequestSchema.parse({ ...base, tipoDte: 33 }));
    expect(factura[0]).toMatchObject({ NroLinDet: 1, QtyItem: 3, PrcItem: 1000, MontoItem: 3000 });
    expect(factura[0].IndExe).toBeUndefined();
    const exenta = ApiDocumentosService.toDetalles(DocumentoRequestSchema.parse({ ...base, tipoDte: 41 }));
    expect(exenta[0].IndExe).toBe(1);
    const fraction = ApiDocumentosService.toDetalles(DocumentoRequestSchema.parse({ ...base, tipoDte: 33, items: [{ nombre: 'Fracción', cantidad: 1.005, precio: 100 }] }));
    expect(fraction[0].MontoItem).toBe(101); // 100,5 CLP exactos, sin error binario

  });

  it('Referencias: alias del marketplace a códigos SII; desconocidas se omiten con advertencia', () => {
    const req = DocumentoRequestSchema.parse({
      tipoDte: 33,
      emisor: { rut: '76192083-9' },
      receptor: { rut: '77777777-7', razonSocial: 'X' },
      items: [{ nombre: 'A', cantidad: 1, precio: 1 }],
      referencias: [
        { tipo: 'PED', folio: 'P-1' },
        { tipo: 'OC', folio: 45 },
        { tipo: 'COT', folio: 'C-9' },
      ],
    });
    const { referencias, advertencias } = ApiDocumentosService.toReferencias(req, '2026-10-19');
    expect(referencias.map((r) => [r.NroLinRef, r.TpoDocRef, r.FolioRef])).toEqual([
      [1, '802', 'P-1'],
      [2, '801', '45'],
    ]);
    expect(advertencias).toHaveLength(1);
    expect(advertencias[0]).toMatch(/COT/);
  });
});
