import { ClienteReceptor, DocumentoDTE, PrismaClient, Tenant } from '@prisma/client';
import { DtePdfService } from './dte-pdf.service';
import { receptorDelDocumento, xmlDescargable } from './dte-archivos';

// ============================================================================
// ENVÍO DE DOCUMENTOS POR CORREO (Resend, API HTTPS: DigitalOcean bloquea SMTP)
// Cuando el SII acepta un documento con correo de destino, el despachador lo marca pendiente
// y este servicio envía el PDF y el XML al receptor. Reintenta con espera creciente; cada
// solicitud usa una Idempotency-Key propia, así un reintento no duplica el correo.
// Variables: RESEND_API_KEY, FELINE_CORREO_REMITENTE, FELINE_CORREO_RESPONDER_A.
// ============================================================================

export const MAX_INTENTOS_CORREO = 6;
const RESEND_URL = 'https://api.resend.com/emails';

/** Espera antes del reintento n: 1 min, 5 min, 30 min, 2 h, 6 h. */
export function esperaReintentoCorreoMs(intento: number): number {
  return [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000, 6 * 3600_000][Math.min(intento, 5) - 1] ?? 6 * 3600_000;
}

const NOMBRES: Record<number, string> = {
  33: 'Factura electrónica',
  34: 'Factura exenta electrónica',
  39: 'Boleta electrónica',
  41: 'Boleta exenta electrónica',
  56: 'Nota de débito electrónica',
  61: 'Nota de crédito electrónica',
};

type DocumentoCompleto = DocumentoDTE & { tenant: Tenant; receptor: ClienteReceptor };

const escaparHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clp = (n: number) => '$' + n.toLocaleString('es-CL');

/** Asunto y cuerpo del correo al receptor. */
export function contenidoCorreo(doc: DocumentoCompleto) {
  const tipo = NOMBRES[doc.tipoDte] ?? `Documento tributario ${doc.tipoDte}`;
  const emisor = doc.tenant.razonSocial;
  const receptor = receptorDelDocumento(doc, doc.receptor);
  const fecha = doc.fechaEmision.toISOString().slice(0, 10).split('-').reverse().join('-');
  const asunto = `${tipo} N° ${doc.folio} de ${emisor}`;
  const saludo = receptor.rut === '66666666-6' ? 'Hola,' : `Estimado(a) ${receptor.razonSocial}:`;
  const texto = [
    saludo,
    '',
    `${emisor} (RUT ${doc.tenant.rut}) te envía la ${tipo.toLowerCase()} N° ${doc.folio}, emitida el ${fecha}, por un total de ${clp(doc.mntTotal)}.`,
    '',
    'Adjuntamos la representación impresa (PDF) y el documento tributario electrónico (XML).',
    'Puedes verificar el documento en www.sii.cl.',
    '',
    'Este correo se envió automáticamente.',
  ].join('\n');
  const html = `<!doctype html><html lang="es"><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.5">
<p>${escaparHtml(saludo)}</p>
<p><strong>${escaparHtml(emisor)}</strong> (RUT ${escaparHtml(doc.tenant.rut)}) te envía la ${escaparHtml(tipo.toLowerCase())}
<strong>N° ${doc.folio}</strong>, emitida el ${fecha}, por un total de <strong>${clp(doc.mntTotal)}</strong>.</p>
<p>Adjuntamos la representación impresa (PDF) y el documento tributario electrónico (XML).
Puedes verificar el documento en <a href="https://www.sii.cl">www.sii.cl</a>.</p>
<p style="color:#6b7280;font-size:12px">Este correo se envió automáticamente.</p>
</body></html>`;
  return { asunto, texto, html, nombreArchivo: `${tipo.replace(/ electrónica$/, '').replace(/\s+/g, '_')}_${doc.folio}` };
}

export interface OpcionesCorreo {
  apiKey?: string;
  /** Dirección de envío de un dominio verificado en Resend, ej. documentos@fugar.cl. */
  remitente: string;
  responderA?: string;
  http?: typeof fetch;
  timeoutMs?: number;
  registrarError?: (mensaje: string, error: unknown) => void;
}

export class CorreoDocumentosService {
  private readonly http: typeof fetch;
  private avisoSinClave = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly opciones: OpcionesCorreo
  ) {
    this.http = opciones.http ?? globalThis.fetch;
  }

  static desdeEntorno(prisma: PrismaClient, http?: typeof fetch) {
    return new CorreoDocumentosService(prisma, {
      apiKey: process.env.RESEND_API_KEY || undefined,
      remitente: process.env.FELINE_CORREO_REMITENTE || 'documentos@fugar.cl',
      responderA: process.env.FELINE_CORREO_RESPONDER_A || undefined,
      http,
    });
  }

  get configurado() {
    return Boolean(this.opciones.apiKey);
  }

  /** Marca el documento para enviarlo (otra vez) por correo. `destino` reemplaza el correo guardado. */
  async solicitar(documentoId: string, destino?: string) {
    return this.prisma.documentoDTE.update({
      where: { id: documentoId },
      data: {
        ...(destino ? { correoDestino: destino } : {}),
        correoPendiente: true,
        correoSolicitadoAt: new Date(),
        correoSiguienteAt: null,
        correoIntentos: 0,
        correoError: null,
      },
    });
  }

  /** Envía los correos pendientes cuyo momento llegó. Devuelve cuántos se enviaron. */
  async enviarPendientes(lote = 10): Promise<number> {
    if (!this.configurado) {
      if (!this.avisoSinClave) {
        this.avisoSinClave = true;
        console.warn('[Correo] RESEND_API_KEY no está configurada: los documentos quedan pendientes de envío.');
      }
      return 0;
    }
    const pendientes = await this.prisma.documentoDTE.findMany({
      where: {
        correoPendiente: true,
        correoDestino: { not: null },
        OR: [{ correoSiguienteAt: null }, { correoSiguienteAt: { lte: new Date() } }],
      },
      include: { tenant: true, receptor: true },
      orderBy: { updatedAt: 'asc' },
      take: lote,
    });
    let enviados = 0;
    for (const doc of pendientes) {
      if (await this.enviarUno(doc)) enviados++;
    }
    return enviados;
  }

  private remitente(emisor: string) {
    if (this.opciones.remitente.includes('<')) return this.opciones.remitente;
    const nombre = emisor.replace(/["<>\r\n\\]/g, '').trim().slice(0, 70);
    return nombre ? `"${nombre}" <${this.opciones.remitente}>` : this.opciones.remitente;
  }

  private async enviarUno(doc: DocumentoCompleto): Promise<boolean> {
    const intento = doc.correoIntentos + 1;
    try {
      const xml = xmlDescargable(doc);
      if (!xml) throw new Error('El documento no tiene XML firmado.');
      const pdf = await DtePdfService.generar(doc);
      const c = contenidoCorreo(doc);
      const solicitud = (doc.correoSolicitadoAt ?? doc.updatedAt).getTime();
      const res = await this.http(RESEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.opciones.apiKey}`,
          'Content-Type': 'application/json',
          // Misma clave en los reintentos de una solicitud: Resend no envía dos veces
          'Idempotency-Key': `feline-dte-${doc.id}-${solicitud}`,
        },
        body: JSON.stringify({
          from: this.remitente(doc.tenant.razonSocial),
          to: [doc.correoDestino],
          ...(this.opciones.responderA ? { reply_to: this.opciones.responderA } : {}),
          subject: c.asunto,
          text: c.texto,
          html: c.html,
          attachments: [
            { filename: `${c.nombreArchivo}.pdf`, content: pdf.toString('base64') },
            { filename: `${c.nombreArchivo}.xml`, content: xml.toString('base64') },
          ],
        }),
        signal: AbortSignal.timeout(this.opciones.timeoutMs ?? 20_000),
      });
      if (!res.ok) {
        const detalle = (await res.text().catch(() => '')).slice(0, 300);
        const error = new Error(`Resend respondió ${res.status}: ${detalle}`);
        // 4xx (salvo 409 y 429) no se arregla reintentando: dirección inválida, dominio no verificado...
        (error as Error & { definitivo?: boolean }).definitivo = res.status < 500 && ![409, 429].includes(res.status);
        throw error;
      }
      await this.prisma.documentoDTE.update({
        where: { id: doc.id },
        data: { correoPendiente: false, correoEnviadoAt: new Date(), correoIntentos: intento, correoError: null, correoSiguienteAt: null },
      });
      return true;
    } catch (err) {
      const definitivo = (err as { definitivo?: boolean }).definitivo === true || intento >= MAX_INTENTOS_CORREO;
      const mensaje = err instanceof Error ? err.message : String(err);
      (this.opciones.registrarError ?? ((m, e) => console.error('[Correo] ' + m, e)))(
        `no se pudo enviar el documento ${doc.id} (intento ${intento})`,
        mensaje
      );
      await this.prisma.documentoDTE.update({
        where: { id: doc.id },
        data: {
          correoIntentos: intento,
          correoError: mensaje.slice(0, 500),
          correoPendiente: !definitivo,
          correoSiguienteAt: definitivo ? null : new Date(Date.now() + esperaReintentoCorreoMs(intento)),
        },
      });
      return false;
    }
  }
}
