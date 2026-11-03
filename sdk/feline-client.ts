/**
 * Cliente oficial de la API de Feline (ERP central / Motor DTE).
 *
 * Archivo único, sin dependencias: cópialo en cualquier proyecto Node 18+ / Next.js (solo en el servidor;
 * la clave nunca debe llegar al navegador).
 *
 *   const feline = new FelineClient({ baseUrl: process.env.FELINE_API_URL!, apiKey: process.env.FELINE_API_KEY! });
 *   const doc = await feline.emitir({ tipoDte: 39, ... }, { idempotencyKey: `pedido_${pedido.id}` });
 *
 * Webhook (ruta POST de tu proyecto):
 *   const evento = parsearWebhookFeline(await req.text(), req.headers.get('x-firma'), process.env.FELINE_WEBHOOK_SECRET!);
 *
 * Contrato completo: GET {FELINE_API_URL}/v1/openapi.json
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------------
// Tipos del contrato
// ---------------------------------------------------------------------------
export type TipoDte = 33 | 34 | 39 | 41 | 56 | 61;

export type EstadoDocumento =
  | 'PENDIENTE'
  | 'FIRMADO'
  | 'EN_LOTE'
  | 'ENVIADO'
  | 'ACEPTADO'
  | 'ACEPTADO_CON_REPARO'
  | 'RECHAZADO'
  | 'ANULADO';

export interface ItemDocumento {
  nombre: string;
  cantidad: number;
  /** Factura y notas: precio NETO unitario. Boleta: precio FINAL con IVA incluido. */
  precio: number;
  exento?: boolean;
  codigo?: string;
  unidad?: string;
  descripcion?: string;
}

export interface ReferenciaDocumento {
  /** Código SII ('33', '801', 'HES'...) o alias 'OC' | 'PED' | 'NP' | 'CONTRATO'. */
  tipo: string;
  folio: string | number;
  fecha?: string;
  /** 1 anula, 2 corrige texto, 3 corrige montos (notas de crédito/débito). */
  codRef?: 1 | 2 | 3;
  razon?: string;
}

export interface DocumentoRequest {
  tipoDte: TipoDte;
  /** Id del documento en tu proyecto (ej. pedido). Se puede usar para buscarlo después. */
  referenciaExterna?: string;
  fechaEmision?: string;
  fechaVencimiento?: string;
  formaPago?: 1 | 2 | 3;
  /** RUT de la empresa de tu clave (otro RUT → 403). */
  emisor: { rut: string; [extra: string]: unknown };
  receptor: {
    rut: string;
    razonSocial: string;
    giro?: string;
    direccion?: string;
    comuna?: string;
    ciudad?: string;
    correo?: string;
    contacto?: string;
  };
  items: ItemDocumento[];
  referencias?: ReferenciaDocumento[];
}

export interface Documento {
  id: string;
  tipoDte: number;
  folio: number;
  estado: EstadoDocumento;
  referenciaExterna?: string;
  glosa?: string;
  trackId?: string;
  fechaEmision: string;
  montoNeto: number;
  montoExento: number;
  iva: number;
  montoTotal: number;
  xmlUrl: string;
  pdfUrl: string;
}

export interface ResultadoEmision extends Documento {
  idempotente: boolean;
  advertencias?: string[];
}

export interface FiltrosListado {
  tipoDte?: number;
  estado?: EstadoDocumento;
  referenciaExterna?: string;
  desde?: string;
  hasta?: string;
  /** Incluir documentos emitidos por otros proyectos de la misma empresa. */
  todos?: boolean;
  limite?: number;
  cursor?: string;
}

export interface Empresa {
  proyecto: { id: string; nombre: string; permisos: string[] };
  empresa: { rut: string; razonSocial: string; giro: string; ambienteSii: 'CERTIFICACION' | 'PRODUCCION' };
  certificado: { titular: string; venceEl: string } | null;
  foliosDisponibles: Array<{ tipoDte: number; disponibles: number }>;
  /** Folios consumidos por emisiones fallidas que deben anularse ante el SII. */
  foliosPorAnular: Array<{ tipoDte: number; folio: number }>;
}

export type EventoWebhook =
  | ({ evento: 'documento.estado' } & Documento)
  | { evento: 'webhook.prueba'; proyecto: string; enviadoAt: string };

/** Estados definitivos: el documento ya no cambiará. */
export const ESTADOS_FINALES: readonly EstadoDocumento[] = ['ACEPTADO', 'ACEPTADO_CON_REPARO', 'RECHAZADO', 'ANULADO'];

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------
export class FelineApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detalles?: unknown
  ) {
    super(message);
    this.name = 'FelineApiError';
  }
  /** Reintentable sin riesgo (con la misma Idempotency-Key). */
  get reintentable() {
    return this.status === 0 || this.status === 409 || this.status === 429 || this.status >= 500;
  }
}

// ---------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------
export interface FelineClientOptions {
  /** URL base de Feline, sin /v1 (ej. http://localhost:3004). */
  baseUrl: string;
  apiKey: string;
  /** Reintentos ante errores de red, 409, 429 y 5xx (por defecto 3). */
  reintentos?: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export class FelineClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opciones: FelineClientOptions) {
    if (!opciones.baseUrl) throw new Error('FelineClient: falta baseUrl (FELINE_API_URL)');
    if (!opciones.apiKey) throw new Error('FelineClient: falta apiKey (FELINE_API_KEY)');
    // Acepta la URL con o sin /v1 al final
    this.baseUrl = opciones.baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
    this.fetchImpl = opciones.fetch ?? globalThis.fetch;
  }

  /**
   * Emite un documento. `idempotencyKey` debe ser estable por documento (ej. `pedido_123_boleta`):
   * reintentar con la misma clave devuelve el mismo documento sin consumir otro folio.
   */
  emitir(documento: DocumentoRequest, opciones: { idempotencyKey: string }): Promise<ResultadoEmision> {
    if (!opciones?.idempotencyKey) throw new Error('FelineClient.emitir: idempotencyKey es obligatoria');
    return this.json('POST', '/v1/documentos', documento, { 'Idempotency-Key': opciones.idempotencyKey });
  }

  obtener(id: string): Promise<Documento> {
    return this.json('GET', `/v1/documentos/${encodeURIComponent(id)}`);
  }

  listar(filtros: FiltrosListado = {}): Promise<{ datos: Documento[]; siguienteCursor: string | null }> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) if (v !== undefined) qs.set(k, String(v));
    const query = qs.toString();
    return this.json('GET', `/v1/documentos${query ? `?${query}` : ''}`);
  }

  /** Recorre todas las páginas del listado. */
  async *listarTodos(filtros: Omit<FiltrosListado, 'cursor'> = {}): AsyncGenerator<Documento> {
    let cursor: string | undefined;
    do {
      const pagina = await this.listar({ ...filtros, cursor });
      for (const doc of pagina.datos) yield doc;
      cursor = pagina.siguienteCursor ?? undefined;
    } while (cursor);
  }

  /** Busca el documento emitido para un id de tu proyecto (o null si no existe). */
  async buscarPorReferencia(referenciaExterna: string): Promise<Documento | null> {
    const { datos } = await this.listar({ referenciaExterna, limite: 1 });
    return datos[0] ?? null;
  }

  async pdf(id: string): Promise<ArrayBuffer> {
    return (await this.request('GET', `/v1/documentos/${encodeURIComponent(id)}/pdf`)).arrayBuffer();
  }

  async xml(id: string): Promise<ArrayBuffer> {
    return (await this.request('GET', `/v1/documentos/${encodeURIComponent(id)}/xml`)).arrayBuffer();
  }

  empresa(): Promise<Empresa> {
    return this.json('GET', '/v1/empresa');
  }

  /** Pide a Feline enviar un evento `webhook.prueba` a tu webhook y devuelve si llegó. */
  probarWebhook(): Promise<{ entregado: boolean; url?: string; error?: string }> {
    return this.json('POST', '/v1/webhooks/prueba');
  }

  /** Espera a que el documento llegue a un estado final (útil en scripts; en producción usa el webhook). */
  async esperarEstadoFinal(id: string, opciones: { cadaMs?: number; maxMs?: number } = {}): Promise<Documento> {
    const limite = Date.now() + (opciones.maxMs ?? 5 * 60_000);
    for (;;) {
      const doc = await this.obtener(id);
      if (ESTADOS_FINALES.includes(doc.estado) || Date.now() > limite) return doc;
      await new Promise((r) => setTimeout(r, opciones.cadaMs ?? 10_000));
    }
  }

  // -------------------------------------------------------------------------
  private async json<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    const res = await this.request(method, path, body, headers);
    return (await res.json()) as T;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    const maxIntentos = (this.opciones.reintentos ?? 3) + 1;
    let ultimoError: FelineApiError | undefined;

    for (let intento = 1; intento <= maxIntentos; intento++) {
      let res: Response;
      try {
        res = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.opciones.apiKey}`,
            Accept: 'application/json',
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...headers,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(this.opciones.timeoutMs ?? 30_000),
        });
      } catch (err) {
        ultimoError = new FelineApiError(0, `No se pudo conectar con Feline (${this.baseUrl}): ${(err as Error).message}`);
        if (intento < maxIntentos) await this.espera(intento);
        continue;
      }

      if (res.ok) return res;

      let mensaje = `HTTP ${res.status}`;
      let detalles: unknown;
      try {
        const data = (await res.json()) as { error?: string; detalles?: unknown };
        mensaje = data.error ?? mensaje;
        detalles = data.detalles;
      } catch {
        /* cuerpo no JSON */
      }
      ultimoError = new FelineApiError(res.status, mensaje, detalles);
      if (!ultimoError.reintentable || intento === maxIntentos) throw ultimoError;
      await this.espera(intento);
    }
    throw ultimoError!;
  }

  private espera(intento: number) {
    return new Promise((r) => setTimeout(r, Math.min(500 * 2 ** (intento - 1), 8_000)));
  }
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------
/** Verifica la cabecera `x-firma` (HMAC-SHA256 hex del cuerpo EXACTO recibido). */
export function verificarWebhookFeline(cuerpo: string, firma: string | null | undefined, secreto: string): boolean {
  if (!firma || !secreto) return false;
  const esperada = createHmac('sha256', secreto).update(cuerpo, 'utf8').digest();
  const recibida = Buffer.from(firma.trim().replace(/^sha256=/i, ''), 'hex');
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}

/** Verifica la firma y devuelve el evento; lanza error si la firma no es válida. */
export function parsearWebhookFeline(cuerpo: string, firma: string | null | undefined, secreto: string): EventoWebhook {
  if (!verificarWebhookFeline(cuerpo, firma, secreto)) {
    throw new FelineApiError(401, 'Firma de webhook inválida');
  }
  return JSON.parse(cuerpo) as EventoWebhook;
}
