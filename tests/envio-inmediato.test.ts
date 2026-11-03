import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ADMIN, iniciarSesion } from './ayudas-panel';
import { buildFastifyApp } from '../src/server';
import { felineSandboxStore } from '../src/services/feline-live-sandbox.service';
import { ApiDocumentosService } from '../src/services/api-documentos.service';

// ============================================================================
// ENVÍO INMEDIATO AL SII AL ACEPTAR UN DOCUMENTO — PANEL (T-ENVIO-INMEDIATO)
// ============================================================================

describe('Panel: al aceptar un documento se envía de inmediato al SII', () => {
  let app: FastifyInstance;
  let headers: Record<string, string>;
  const empresa = felineSandboxStore.tenants[0];
  const cliente = (tipo: 'VAT_AFFECTED_1ST_CAT' | 'END_CONSUMER') =>
    felineSandboxStore.partners.find((p) => p.tenantId === empresa.id && p.taxpayerType === tipo)!;

  const emitir = async (documentTypeCode: number, tipoCliente: 'VAT_AFFECTED_1ST_CAT' | 'END_CONSUMER') => {
    const borrador = await app.inject({
      method: 'POST',
      url: '/api/v1/dashboard/moves',
      headers,
      payload: { partnerId: cliente(tipoCliente).id, documentTypeCode, lines: [{ name: 'Servicio', quantity: 1, priceUnit: 10000 }] },
    });
    expect(borrador.statusCode, borrador.body).toBe(201);
    return app.inject({ method: 'POST', url: '/api/v1/dashboard/moves/' + borrador.json().id + '/post', headers });
  };

  beforeAll(async () => {
    app = buildFastifyApp({ siiModo: 'simulado' });
    headers = { cookie: await iniciarSesion(app, ADMIN), 'x-tenant-id': empresa.id };
  });
  afterAll(() => app.close());

  it('Los documentos que ya estaban firmados se envían una sola vez con "Enviar al SII"', async () => {
    const enviar = () => app.inject({ method: 'POST', url: '/api/v1/dashboard/sii/send-batch', headers });
    const primero = await enviar();
    expect(primero.statusCode).toBe(200);
    expect(primero.json().cantidadDtes).toBeGreaterThan(0);
    // Nada queda pendiente: un segundo envío no reenvía documentos aceptados
    const segundo = await enviar();
    expect(segundo.statusCode).toBe(400);
    expect(segundo.json().error).toMatch(/No hay documentos firmados pendientes/);
  });

  it('Una factura queda enviada al firmarla, sin pulsar "Enviar al SII"', async () => {
    const res = await emitir(33, 'VAT_AFFECTED_1ST_CAT');
    expect(res.statusCode).toBe(200);
    expect(res.json().envio).toMatchObject({ enviado: true });
    expect(res.json().envio.trackId).toBeTruthy();
    expect(res.json().dteStatus).toBe('ACEPTADO');
    expect(felineSandboxStore.moves.find((m) => m.id === res.json().id)?.envioDteXml).toContain('<EnvioDTE');
  });

  it('Una boleta se envía de inmediato en EnvioBOLETA', async () => {
    const res = await emitir(39, 'END_CONSUMER');
    expect(res.json().envio).toMatchObject({ enviado: true });
    const boleta = felineSandboxStore.moves.find((m) => m.id === res.json().id)!;
    expect(boleta.dteStatus).toBe('ACEPTADO');
    expect(boleta.envioDteXml).toContain('<EnvioBOLETA');
  });

  it('Una nota de crédito se envía de inmediato al emitirla', async () => {
    const factura = await emitir(33, 'VAT_AFFECTED_1ST_CAT');
    const nc = await app.inject({
      method: 'POST',
      url: '/api/v1/dashboard/moves/' + factura.json().id + '/reverse',
      headers,
      payload: { referenceDocCode: 1, reason: 'Anula por devolución' },
    });
    expect(nc.statusCode).toBe(201);
    expect(nc.json().documentTypeCode).toBe(61);
    expect(nc.json().envio).toMatchObject({ enviado: true });
    expect(nc.json().dteStatus).toBe('ACEPTADO');
  });
});

describe('API: la respuesta espera el envío solo hasta un límite', () => {
  it('Si el SII tarda más que la espera, responde sin bloquear y el envío continúa', async () => {
    const actualizado = { id: 'doc-1', estado: 'ENVIADO' };
    const prismaFalso: any = { documentoDTE: { findUnique: async () => actualizado } };
    const servicio = new ApiDocumentosService(prismaFalso, {} as any);
    servicio.esperaEnvioMs = 50;
    let terminado = false;
    servicio.alEmitir = () => new Promise((r) => setTimeout(() => { terminado = true; r(true); }, 300));
    const inicio = Date.now();
    const doc = await (servicio as any).enviarDeInmediato('doc-1');
    expect(Date.now() - inicio).toBeLessThan(250);
    expect(doc).toBe(actualizado);
    expect(terminado).toBe(false);
    await new Promise((r) => setTimeout(r, 300));
    expect(terminado).toBe(true);
  });
});
