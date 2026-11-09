import crypto from 'node:crypto';
import { Prisma, PrismaClient, DocumentoDTE } from '@prisma/client';
import { z } from 'zod';
import { CodigoTipoDTE, DetalleItemSII, ReferenciaSII } from '../types/sii-dte.types';
import { DteBillingOrchestratorService } from './dte-orchestrator.service';
import { DteXmlBuilderService } from './dte-xml-builder.service';
import { formatSiiTimestamp, normalizeAndValidateRut } from '../utils/sii-normative.utils';
import { urlPublica } from '../config';

// ============================================================================
// API DE DOCUMENTOS (v1) PARA INTEGRACIONES EXTERNAS (ej. FUGAR Marketplace)
// Contrato: POST /v1/documentos con `Authorization: Bearer <clave>` e `Idempotency-Key`.
//  - Factura (33/34) y Notas (56/61): `precio` es el precio NETO unitario.
//  - Boleta (39/41): `precio` es el precio FINAL con IVA incluido.
// ============================================================================

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha AAAA-MM-DD');

const ItemSchema = z.object({
  nombre: z.string().trim().min(1, 'Cada ítem necesita un nombre'),
  cantidad: z.number().finite().positive('La cantidad debe ser mayor a 0').max(Number.MAX_SAFE_INTEGER),
  precio: z.number().finite().min(0, 'El precio no puede ser negativo').max(Number.MAX_SAFE_INTEGER),
  exento: z.boolean().optional().default(false),
  codigo: z.string().trim().max(35).optional(),
  unidad: z.string().trim().max(4).optional(),
  descripcion: z.string().trim().max(1000).optional(),
});

const ReferenciaSchema = z.object({
  // Alias del marketplace ('PED', 'OC', 'COT') o código SII ('33', '801', 'HES', ...)
  tipo: z.string().trim().min(1).max(10),
  folio: z.union([z.string().trim().min(1).max(18), z.number().int().nonnegative()]),
  fecha: fechaIso.optional(),
  codRef: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  razon: z.string().trim().max(90).optional(),
});

export const DocumentoRequestSchema = z.object({
  tipoDte: z.union([
    z.literal(33),
    z.literal(34),
    z.literal(39),
    z.literal(41),
    z.literal(56),
    z.literal(61),
  ]),
  // Identificador del documento en el proyecto que emite (ej. id de pedido); permite buscarlo después
  referenciaExterna: z.string().trim().min(1).max(100).optional(),
  montoConfirmado: z.number().int().positive().max(2147483647).optional(),
  fechaEmision: fechaIso.optional(),
  fechaVencimiento: fechaIso.optional(),
  formaPago: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  // El marketplace envía los datos completos del emisor; solo el RUT es vinculante
  emisor: z.object({ rut: z.string().trim().min(3) }).passthrough(),
  receptor: z.object({
    rut: z.string().trim().min(3),
    razonSocial: z.string().trim().min(1),
    giro: z.string().trim().optional(),
    direccion: z.string().trim().optional(),
    comuna: z.string().trim().optional(),
    ciudad: z.string().trim().optional(),
    correo: z.string().trim().optional(),
    contacto: z.string().trim().optional(),
  }),
  items: z.array(ItemSchema).min(1, 'Debe incluir al menos un ítem').max(1000),
  referencias: z.array(ReferenciaSchema).max(40).optional(),
});

export type DocumentoRequest = z.infer<typeof DocumentoRequestSchema>;

/** Error de negocio con código HTTP explícito (se responde tal cual al cliente). */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly detalles?: unknown
  ) {
    super(message);
  }
}

export interface ApiClientContext {
  id: string;
  nombre: string;
  tenantId: string;
  tenantRut: string;
  scopes: string[];
}

export const ListarQuerySchema = z.object({
  tipoDte: z.coerce.number().int().optional(),
  estado: z
    .enum(['PENDIENTE', 'FIRMADO', 'EN_LOTE', 'ENVIADO', 'ACEPTADO', 'ACEPTADO_CON_REPARO', 'RECHAZADO', 'ANULADO'])
    .optional(),
  referenciaExterna: z.string().trim().max(100).optional(),
  desde: fechaIso.optional(), // fecha de emisión desde (inclusive)
  hasta: fechaIso.optional(), // fecha de emisión hasta (inclusive)
  // Por defecto solo los documentos de este proyecto; `todos=true` incluye los de otros proyectos de la empresa
  todos: z.enum(['true', 'false']).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});

/** Alias de referencias no tributarias usados por integraciones → código SII (tabla de referencias). */
const ALIAS_REFERENCIA: Record<string, string> = {
  OC: '801', // Orden de Compra
  PED: '802', // Nota de Pedido
  NP: '802',
  CONTRATO: '803',
};
const CODIGOS_REFERENCIA_SII = /^(\d{1,3}|SET|HES|HEM|HEF|HMG|HMP|HMQ|HMS|HNR|HPA|HPI|HPU)$/;

export class ApiDocumentosService {
  /**
   * Envío inmediato al SII tras emitir (lo conecta el servidor con el despachador).
   * La respuesta espera hasta `esperaEnvioMs`; si el SII tarda más, el envío sigue en segundo plano.
   */
  public alEmitir: ((documentoId: string) => Promise<unknown>) | null = null;
  public esperaEnvioMs = 10_000;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly orchestrator: DteBillingOrchestratorService,
    private readonly publicBaseUrl: string = urlPublica()
  ) {}

  /** Convierte los ítems del contrato API al nodo <Detalle> del SII. */
  public static toDetalles(req: DocumentoRequest): DetalleItemSII[] {
    const exentaDoc =
      req.tipoDte === CodigoTipoDTE.FacturaNoAfectaOExenta ||
      req.tipoDte === CodigoTipoDTE.BoletaNoAfectaOExenta;

    return req.items.map((item, idx) => ({
      NroLinDet: idx + 1,
      CdgItem: item.codigo ? { TpoCodigo: 'INT1', VlrCodigo: item.codigo } : undefined,
      IndExe: item.exento || exentaDoc ? 1 : undefined,
      NmbItem: item.nombre,
      DscItem: item.descripcion,
      QtyItem: item.cantidad,
      UnmdItem: item.unidad,
      PrcItem: item.precio,
      MontoItem: new Prisma.Decimal(String(item.cantidad)).mul(String(item.precio)).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber(),
    }));
  }

  /**
   * Convierte referencias del contrato API a <Referencia> del SII.
   * Las boletas usan otra estructura de referencia en el SII, por lo que no se incluyen.
   */
  public static toReferencias(
    req: DocumentoRequest,
    fechaEmision: string
  ): { referencias: ReferenciaSII[]; advertencias: string[] } {
    const advertencias: string[] = [];
    const entrada = req.referencias ?? [];
    if (entrada.length === 0) return { referencias: [], advertencias };

    if (DteXmlBuilderService.isBoleta(req.tipoDte as CodigoTipoDTE)) {
      advertencias.push('Las boletas no incluyen referencias en el XML; se omitieron.');
      return { referencias: [], advertencias };
    }

    const referencias: ReferenciaSII[] = [];
    for (const ref of entrada) {
      const tipo = ref.tipo.toUpperCase();
      const codigo = ALIAS_REFERENCIA[tipo] ?? (CODIGOS_REFERENCIA_SII.test(tipo) ? tipo : null);
      if (!codigo) {
        advertencias.push(`Referencia "${ref.tipo}" no corresponde a un tipo SII; se omitió del XML.`);
        continue;
      }
      referencias.push({
        NroLinRef: referencias.length + 1,
        TpoDocRef: codigo,
        FolioRef: String(ref.folio),
        FchRef: ref.fecha ?? fechaEmision,
        CodRef: ref.codRef,
        RazonRef: ref.razon,
      });
    }
    return { referencias, advertencias };
  }

  public static hashRequest(req: DocumentoRequest): string {
    return crypto.createHash('sha256').update(JSON.stringify(req)).digest('hex');
  }

  /**
   * Emite un documento de forma idempotente.
   * Devuelve `idempotente: true` si la misma `Idempotency-Key` ya había emitido un documento.
   */
  public async emitir(client: ApiClientContext, idempotencyKey: string | undefined, body: unknown) {
    if (!idempotencyKey || idempotencyKey.trim().length === 0 || idempotencyKey.length > 200) {
      throw new ApiError(400, 'La cabecera Idempotency-Key es obligatoria (máx. 200 caracteres).');
    }
    const clave = idempotencyKey.trim();

    const parsed = DocumentoRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, 'Payload inválido', parsed.error.issues);
    }
    const req = parsed.data;

    // 1. La clave de API solo puede emitir con el RUT de su empresa
    const rutEmisor = this.rutValido(req.emisor.rut, 'emisor');
    if (rutEmisor !== client.tenantRut) {
      throw new ApiError(
        403,
        `La clave de API pertenece al emisor ${client.tenantRut}; no puede emitir como ${rutEmisor}.`
      );
    }
    const rutReceptor = this.rutValido(req.receptor.rut, 'receptor');

    // 2. Idempotencia: reservar la clave ANTES de consumir folio
    const requestHash = ApiDocumentosService.hashRequest(req);
    const reserva = await this.reservarClave(client.id, clave, requestHash);
    if (reserva.existente) {
      return { documento: reserva.existente, idempotente: true, advertencias: [] as string[] };
    }

    try {
      const fechaEmision = req.fechaEmision ?? formatSiiTimestamp(new Date()).slice(0, 10);
      const detalles = ApiDocumentosService.toDetalles(req);
      const { referencias, advertencias } = ApiDocumentosService.toReferencias(req, fechaEmision);

      const { mntTotal } = DteBillingOrchestratorService.calcularTotalesSii(req.tipoDte, detalles);
      if (req.montoConfirmado !== undefined && req.montoConfirmado !== mntTotal) {
        throw new ApiError(422, 'El total tributario no coincide con el monto confirmado.');
      }
      const corrigeTexto = referencias.some((r) => r.CodRef === 2);
      if (mntTotal <= 0 && !corrigeTexto) {
        throw new ApiError(422, 'El monto total del documento debe ser mayor a 0.');
      }

      const receptor = await this.upsertReceptor(client.tenantId, rutReceptor, req);

      const documento = await this.orchestrator.emitirYFirmarDte({
        tenantId: client.tenantId,
        receptorId: receptor.id,
        tipoDte: req.tipoDte,
        fechaEmision,
        fechaVenc: req.fechaVencimiento,
        fmaPago: req.formaPago,
        detalles,
        referencias: referencias.length > 0 ? referencias : undefined,
        apiClientId: client.id,
        idempotencyReservationId: reserva.id,
        referenciaExterna: req.referenciaExterna,
      });

      // Al aceptar el documento se envía de inmediato al SII
      const actual = await this.enviarDeInmediato(documento.id);
      return { documento: actual ?? documento, idempotente: false, advertencias };
    } catch (err) {
      // Liberar solo reservas sin documento. Si hubo commit y falló la respuesta,
      // conservar la clave para que el reintento recupere el mismo DTE.
      await this.prisma.apiIdempotencia.deleteMany({ where: { id: reserva.id, documentoId: null } }).catch(() => undefined);
      throw this.traducirError(err);
    }
  }

  private async enviarDeInmediato(documentoId: string) {
    if (!this.alEmitir) return null;
    const envio = this.alEmitir(documentoId).catch(() => undefined); // los errores ya quedan registrados
    let temporizador: NodeJS.Timeout | undefined;
    await Promise.race([
      envio,
      new Promise((r) => {
        temporizador = setTimeout(r, this.esperaEnvioMs);
      }),
    ]);
    clearTimeout(temporizador);
    return this.prisma.documentoDTE.findUnique({ where: { id: documentoId } });
  }

  /** Busca un documento del Tenant de la clave (nunca de otra empresa). */
  public async obtener(client: ApiClientContext, id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return this.prisma.documentoDTE.findFirst({
      where: { id, tenantId: client.tenantId },
      include: { receptor: true, tenant: true },
    });
  }

  /** Lista documentos de la empresa con filtros y paginación por cursor (más recientes primero). */
  public async listar(client: ApiClientContext, query: unknown) {
    const parsed = ListarQuerySchema.safeParse(query ?? {});
    if (!parsed.success) throw new ApiError(400, 'Filtros inválidos', parsed.error.issues);
    const q = parsed.data;

    const docs = await this.prisma.documentoDTE.findMany({
      where: {
        tenantId: client.tenantId,
        ...(q.todos === 'true' ? {} : { apiClientId: client.id }),
        ...(q.tipoDte ? { tipoDte: q.tipoDte } : {}),
        ...(q.estado ? { estado: q.estado } : {}),
        ...(q.referenciaExterna ? { referenciaExterna: q.referenciaExterna } : {}),
        ...(q.desde || q.hasta
          ? {
              fechaEmision: {
                ...(q.desde ? { gte: new Date(q.desde) } : {}),
                ...(q.hasta ? { lte: new Date(q.hasta) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limite + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });

    const hayMas = docs.length > q.limite;
    const pagina = hayMas ? docs.slice(0, q.limite) : docs;
    return {
      datos: pagina.map((d) => this.respuesta(d)),
      siguienteCursor: hayMas ? pagina[pagina.length - 1].id : null,
    };
  }

  /** Datos de la empresa de la clave: identidad, ambiente SII, certificado y folios disponibles. */
  public async empresa(client: ApiClientContext) {
    const [tenant, cert, cafs, sinUso] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({ where: { id: client.tenantId } }),
      this.prisma.certificadoDigital.findFirst({
        where: { tenantId: client.tenantId, isActive: true },
        orderBy: { createdAt: 'desc' },
        select: { nombreTitular: true, validTo: true },
      }),
      this.prisma.cafFolio.findMany({
        where: { tenantId: client.tenantId, activo: true, agotado: false },
        select: { tipoDte: true, folioActual: true, folioHasta: true },
      }),
      this.prisma.folioSinUso.findMany({
        where: { tenantId: client.tenantId, anuladoAt: null },
        select: { tipoDte: true, folio: true },
        orderBy: [{ tipoDte: 'asc' }, { folio: 'asc' }],
      }),
    ]);

    const folios = new Map<number, number>();
    for (const c of cafs) folios.set(c.tipoDte, (folios.get(c.tipoDte) ?? 0) + (c.folioHasta - c.folioActual));

    return {
      proyecto: { id: client.id, nombre: client.nombre, permisos: client.scopes },
      empresa: {
        rut: tenant.rut,
        razonSocial: tenant.razonSocial,
        giro: tenant.giro,
        ambienteSii: tenant.environment,
      },
      certificado: cert ? { titular: cert.nombreTitular, venceEl: cert.validTo.toISOString().slice(0, 10) } : null,
      foliosDisponibles: Array.from(folios.entries())
        .sort(([a], [b]) => a - b)
        .map(([tipoDte, disponibles]) => ({ tipoDte, disponibles })),
      // Folios consumidos por emisiones fallidas: deben anularse ante el SII
      foliosPorAnular: sinUso,
    };
  }

  /** Representación pública del documento (respuesta de la API y payload de webhook). */
  public respuesta(doc: DocumentoDTE) {
    return {
      id: doc.id,
      tipoDte: doc.tipoDte,
      folio: doc.folio,
      estado: doc.estado,
      referenciaExterna: doc.referenciaExterna ?? undefined,
      glosa: doc.glosaEstadoSii ?? undefined,
      trackId: doc.trackId ?? undefined,
      fechaEmision: doc.fechaEmision.toISOString().slice(0, 10),
      montoNeto: doc.mntNeto,
      montoExento: doc.mntExento,
      iva: doc.iva,
      montoTotal: doc.mntTotal,
      xmlUrl: `${this.publicBaseUrl}/v1/documentos/${doc.id}/xml`,
      pdfUrl: `${this.publicBaseUrl}/v1/documentos/${doc.id}/pdf`,
    };
  }

  private rutValido(rut: string, campo: string): string {
    try {
      return normalizeAndValidateRut(rut);
    } catch (e: any) {
      throw new ApiError(400, `RUT del ${campo} inválido: ${e.message}`);
    }
  }

  private async reservarClave(apiClientId: string, clave: string, requestHash: string) {
    try {
      const creada = await this.prisma.apiIdempotencia.create({
        data: { apiClientId, clave, requestHash },
      });
      return { id: creada.id, existente: null };
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;

      const previa = await this.prisma.apiIdempotencia.findUnique({
        where: { apiClientId_clave: { apiClientId, clave } },
        include: { documento: true },
      });
      if (!previa) {
        // La reserva concurrente falló y se liberó entre medio: el cliente puede reintentar
        throw new ApiError(409, 'Solicitud concurrente con la misma Idempotency-Key; reintenta.');
      }
      if (previa.requestHash !== requestHash) {
        throw new ApiError(
          422,
          'La Idempotency-Key ya se usó con un contenido distinto. Usa una clave nueva por documento.'
        );
      }
      if (!previa.documento) {
        throw new ApiError(409, 'Ya hay una emisión en curso con esta Idempotency-Key; reintenta en unos segundos.');
      }
      return { id: previa.id, existente: previa.documento };
    }
  }

  private async upsertReceptor(tenantId: string, rut: string, req: DocumentoRequest) {
    const r = req.receptor;
    const corte = (v: string | undefined, max: number, def: string) =>
      (v && v.length > 0 ? v : def).substring(0, max);
    const data = {
      razonSocial: corte(r.razonSocial, 100, 'Consumidor final'),
      giro: corte(r.giro, 40, 'Particular'),
      direccion: corte(r.direccion, 70, 'Sin dirección'),
      comuna: corte(r.comuna, 20, 'Santiago'),
      ciudad: corte(r.ciudad ?? r.comuna, 20, 'Santiago'),
      contacto: r.contacto ? r.contacto.substring(0, 80) : null,
      correoDte: r.correo ? r.correo.substring(0, 80) : null,
      taxpayerType: DteXmlBuilderService.isBoleta(req.tipoDte as CodigoTipoDTE)
        ? ('END_CONSUMER' as const)
        : ('VAT_AFFECTED_1ST_CAT' as const),
    };
    return this.prisma.clienteReceptor.upsert({
      where: { tenantId_rut: { tenantId, rut } },
      update: data,
      create: { tenantId, rut, ...data },
    });
  }

  /** Errores de negocio conocidos del motor → 422 con mensaje claro; el resto se propaga. */
  private traducirError(err: unknown): unknown {
    if (err instanceof ApiError) return err;
    const msg = err instanceof Error ? err.message : String(err);
    const negocio = [
      /No existen folios CAF/,
      /ha alcanzado su límite máximo/,
      /no posee un Certificado Digital/,
      /Certificado Digital .* expiró/,
      /estrictamente obligatorios/,
      /exige al menos un nodo <Referencia>/,
      /requiere al menos un código <Acteco>/,
      /no encontrada o inactiva/,
    ];
    if (negocio.some((re) => re.test(msg))) return new ApiError(422, msg);
    return err;
  }
}
