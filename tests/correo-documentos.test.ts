import { describe, it, expect } from 'vitest';
import { CorreoDocumentosService, contenidoCorreo, MAX_INTENTOS_CORREO } from '../src/services/correo.service';
import { receptorDelDocumento, xmlDescargable } from '../src/services/dte-archivos';

// Documento aceptado con su XML firmado (el receptor del XML es el de ESTA venta).
function documento(extra: Record<string, unknown> = {}) {
  return {
    id: 'd1',
    tipoDte: 39,
    folio: 7,
    fechaEmision: new Date('2026-11-09T00:00:00Z'),
    mntNeto: 34429,
    mntExento: 0,
    iva: 6541,
    mntTotal: 40970,
    detallesJson: [{ NroLinDet: 1, NmbItem: 'Polera', QtyItem: 2, PrcItem: 15990, MontoItem: 31980 }],
    tedXml: '<TED version="1.0"><DD><RE>76192083-9</RE></DD></TED>',
    dteXmlFirmado:
      '<DTE version="1.0"><Documento ID="F7T39"><Encabezado><Receptor><RUTRecep>66666666-6</RUTRecep>' +
      '<RznSocRecep>Ana P&amp;rez</RznSocRecep><DirRecep>Sin dirección</DirRecep><CmnaRecep>Ñuñoa</CmnaRecep></Receptor></Encabezado></Documento></DTE>',
    estado: 'ACEPTADO',
    correoDestino: 'ana@example.com',
    correoPendiente: true,
    correoSolicitadoAt: new Date('2026-11-09T12:00:00Z'),
    correoIntentos: 0,
    correoEnviadoAt: null,
    correoError: null,
    updatedAt: new Date(),
    tenant: { rut: '76192083-9', razonSocial: 'EMPRESA "DE" PRUEBA SPA', giro: 'Venta', direccionOrigen: 'Av. 1', comunaOrigen: 'Providencia', ciudadOrigen: 'Santiago', fchResol: new Date('2026-01-01'), nroResol: 0 },
    // Registro compartido: guarda el ÚLTIMO cliente, no el de esta boleta
    receptor: { rut: '66666666-6', razonSocial: 'Otro Cliente', giro: 'Particular', direccion: 'Calle Falsa 1', comuna: 'Santiago' },
    ...extra,
  } as any;
}

function prismaFalso(docs: any[]) {
  const updates: any[] = [];
  return {
    updates,
    documentoDTE: {
      findMany: async () => docs,
      update: async ({ data }: any) => {
        updates.push(data);
        return { ...docs[0], ...data };
      },
    },
  } as any;
}

function fetchFalso(status = 200) {
  const llamadas: Array<{ url: string; headers: Record<string, string>; body: any }> = [];
  const fn = (async (url: string, init: any) => {
    llamadas.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(status < 300 ? { id: 're_123' } : { message: 'error' }), { status });
  }) as unknown as typeof fetch;
  return { fn, llamadas };
}

describe('Envío de documentos por correo', () => {
  it('El receptor del documento sale del XML firmado, no del registro compartido', () => {
    const r = receptorDelDocumento(documento(), documento().receptor);
    expect(r.razonSocial).toBe('Ana P&rez');
    expect(r.comuna).toBe('Ñuñoa');
    expect(r.direccion).toBe('Sin dirección');
  });

  it('XML descargable en ISO-8859-1 con el namespace del SII', () => {
    const xml = xmlDescargable(documento())!.toString('latin1');
    expect(xml.startsWith('<?xml version="1.0" encoding="ISO-8859-1"?>\n<DTE xmlns="http://www.sii.cl/SiiDte"')).toBe(true);
    expect(xml).toContain('Ñuñoa');
  });

  it('Asunto y texto en español, con tipo, folio, emisor y total', () => {
    const c = contenidoCorreo(documento());
    expect(c.asunto).toBe('Boleta electrónica N° 7 de EMPRESA "DE" PRUEBA SPA');
    expect(c.texto).toContain('$40.970');
    expect(c.html).toContain('EMPRESA &quot;DE&quot; PRUEBA SPA');
    expect(c.nombreArchivo).toBe('Boleta_7');
  });

  it('Envía por Resend con PDF y XML adjuntos, remitente con la razón social y clave de idempotencia', async () => {
    const prisma = prismaFalso([documento()]);
    const { fn, llamadas } = fetchFalso(200);
    const correos = new CorreoDocumentosService(prisma, { apiKey: 're_test', remitente: 'documentos@fugar.cl', http: fn });
    expect(await correos.enviarPendientes()).toBe(1);

    const [envio] = llamadas;
    expect(envio.url).toBe('https://api.resend.com/emails');
    expect(envio.headers.Authorization).toBe('Bearer re_test');
    expect(envio.headers['Idempotency-Key']).toBe(`feline-dte-d1-${new Date('2026-11-09T12:00:00Z').getTime()}`);
    expect(envio.body.from).toBe('"EMPRESA DE PRUEBA SPA" <documentos@fugar.cl>');
    expect(envio.body.to).toEqual(['ana@example.com']);
    expect(envio.body.attachments.map((a: any) => a.filename)).toEqual(['Boleta_7.pdf', 'Boleta_7.xml']);
    expect(Buffer.from(envio.body.attachments[0].content, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
    expect(prisma.updates.at(-1)).toMatchObject({ correoPendiente: false, correoError: null, correoIntentos: 1 });
    expect(prisma.updates.at(-1).correoEnviadoAt).toBeInstanceOf(Date);
  });

  it('Error temporal (5xx): queda pendiente y se reintenta más tarde', async () => {
    const prisma = prismaFalso([documento()]);
    const { fn } = fetchFalso(503);
    const correos = new CorreoDocumentosService(prisma, { apiKey: 'k', remitente: 'documentos@fugar.cl', http: fn, registrarError: () => {} });
    expect(await correos.enviarPendientes()).toBe(0);
    const u = prisma.updates.at(-1);
    expect(u.correoPendiente).toBe(true);
    expect(u.correoSiguienteAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('Error definitivo (4xx) o último intento: deja de reintentar y guarda el motivo', async () => {
    const definitivo = prismaFalso([documento()]);
    await new CorreoDocumentosService(definitivo, { apiKey: 'k', remitente: 'd@fugar.cl', http: fetchFalso(422).fn, registrarError: () => {} }).enviarPendientes();
    expect(definitivo.updates.at(-1)).toMatchObject({ correoPendiente: false, correoSiguienteAt: null });
    expect(definitivo.updates.at(-1).correoError).toContain('422');

    const ultimo = prismaFalso([documento({ correoIntentos: MAX_INTENTOS_CORREO - 1 })]);
    await new CorreoDocumentosService(ultimo, { apiKey: 'k', remitente: 'd@fugar.cl', http: fetchFalso(500).fn, registrarError: () => {} }).enviarPendientes();
    expect(ultimo.updates.at(-1).correoPendiente).toBe(false);
  });

  it('Sin RESEND_API_KEY no intenta enviar: los documentos esperan pendientes', async () => {
    const prisma = prismaFalso([documento()]);
    const { fn, llamadas } = fetchFalso(200);
    const correos = new CorreoDocumentosService(prisma, { remitente: 'documentos@fugar.cl', http: fn });
    expect(await correos.enviarPendientes()).toBe(0);
    expect(llamadas).toHaveLength(0);
    expect(prisma.updates).toHaveLength(0);
  });
});
