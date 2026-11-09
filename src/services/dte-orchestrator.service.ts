import { Prisma, PrismaClient } from '@prisma/client';
import {
  CodigoTipoDTE,
  DetalleItemSII,
  ReferenciaSII,
} from '../types/sii-dte.types';
import { CafTedService } from './caf-ted.service';
import { DteXmlBuilderService } from './dte-xml-builder.service';
import { XmlDsigSignerService } from './xmldsig-signer.service';
import { SiiWebServiceIntegration } from './sii-webservice.service';
import { formatSiiTimestamp } from '../utils/sii-normative.utils';

// ============================================================================
// ORQUESTADOR MULTIEMPRESA DE EMISIÓN, FIRMA Y ENVÍO DE DTE AL SII
// ============================================================================

export interface EmitirDtePayload {
  tenantId: string;
  receptorId: string;
  tipoDte: CodigoTipoDTE;
  fechaEmision: string; // AAAA-MM-DD
  fechaVenc?: string;   // AAAA-MM-DD
  fmaPago?: 1 | 2 | 3;
  detalles: DetalleItemSII[];
  referencias?: ReferenciaSII[];
  apiClientId?: string; // Integración externa (API v1) que solicita el documento
  idempotencyReservationId?: string; // Reserva interna de la API, enlazada atómicamente al DTE
  referenciaExterna?: string; // Id del documento en el proyecto que lo solicita (ej. pedido)
  correoDestino?: string; // Correo del receptor para este documento (se envía al ser aceptado por el SII)
}

export class DteBillingOrchestratorService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cafTedService: CafTedService,
    private readonly signerService: XmlDsigSignerService,
    private readonly siiWsService: SiiWebServiceIntegration
  ) {}

  /**
   * Calcula los totales del documento a partir de sus líneas <Detalle>.
   * - Factura/NC/ND: MontoItem es neto y el IVA se calcula sobre la suma afecta.
   * - Boleta (39): MontoItem incluye IVA, por lo que el neto se desglosa desde el bruto
   *   (Neto = round(Bruto / 1.19), IVA = Bruto - Neto).
   */
  public static calcularTotalesSii(tipoDte: CodigoTipoDTE, detalles: DetalleItemSII[]) {
    const tasaIva = 19;
    let montoAfecto = 0;
    let mntExento = 0;

    for (const item of detalles) {
      if (!Number.isSafeInteger(item.MontoItem) || item.MontoItem < 0 || item.MontoItem > 2147483647) {
        throw new Error('El monto de cada línea debe ser un entero CLP entre 0 y 2147483647.');
      }
      if (item.IndExe === 1) {
        mntExento += Math.round(item.MontoItem);
      } else {
        montoAfecto += Math.round(item.MontoItem);
      }
    }

    const isExentoDoc =
      tipoDte === CodigoTipoDTE.FacturaNoAfectaOExenta ||
      tipoDte === CodigoTipoDTE.BoletaNoAfectaOExenta;

    if (isExentoDoc) {
      mntExento += montoAfecto;
      montoAfecto = 0;
    }

    let mntNeto: number;
    let iva: number;
    if (DteXmlBuilderService.isBoleta(tipoDte)) {
      mntNeto = new Prisma.Decimal(montoAfecto).div('1.19').toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
      iva = montoAfecto - mntNeto;
    } else {
      mntNeto = montoAfecto;
      iva = mntNeto > 0 ? new Prisma.Decimal(mntNeto).mul('0.19').toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber() : 0;
    }

    const mntTotal = mntNeto + mntExento + iva;
    if (!Number.isSafeInteger(mntTotal) || mntTotal > 2147483647) {
      throw new Error('El total supera la capacidad actual de almacenamiento CLP (2147483647).');
    }
    return { mntNeto, mntExento, tasaIva, iva, mntTotal };
  }

  /**
   * Emite y firma electrónicamente un DTE para una empresa emisora (`tenantId`),
   * asignando folio atómicamente desde su CAF vigente y almacenando el XML firmado.
   */
  public async emitirYFirmarDte(payload: EmitirDtePayload) {
    const { tenantId, receptorId, tipoDte, fechaEmision, fechaVenc, fmaPago, detalles, referencias, apiClientId, referenciaExterna, correoDestino } =
      payload;

    // 1. Verificar existencia del Tenant y que el Receptor pertenezca al mismo Tenant (Aislamiento estricto)
    const [tenant, receptor] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
      this.prisma.clienteReceptor.findFirst({ where: { id: receptorId, tenantId } }),
    ]);

    if (!tenant || !tenant.isActive) {
      throw new Error(`Empresa emisora (${tenantId}) no encontrada o inactiva.`);
    }

    if (!receptor) {
      throw new Error(
        `Violación de Aislamiento Multitenant o Receptor inexistente: El receptor ${receptorId} no pertenece al Tenant ${tenantId}.`
      );
    }

    // 2. Obtener el certificado digital activo del Tenant
    const cert = await this.signerService.getTenantActiveCertificate(tenantId);

    // 3. Calcular Totales Tributarios (Neto, Exento, IVA 19%, Total) según reglas del SII
    const { mntNeto, mntExento, tasaIva, iva, mntTotal } =
      DteBillingOrchestratorService.calcularTotalesSii(tipoDte, detalles);

    // 4. Validar todo lo que no depende del folio ANTES de consumirlo
    const datosDocumento = {
      idDoc: {
        TipoDTE: tipoDte,
        Folio: 0, // se reemplaza por el folio asignado
        FchEmis: fechaEmision,
        FmaPago: fmaPago ?? 1,
        FchVenc: fechaVenc,
      },
      emisor: {
        RUTEmisor: tenant.rut,
        RznSoc: tenant.razonSocial,
        GiroEmis: tenant.giro,
        Acteco: tenant.acteco,
        CdgSIISucur: tenant.codigoSucursal ?? undefined,
        DirOrigen: tenant.direccionOrigen,
        CmnaOrigen: tenant.comunaOrigen,
        CiudadOrigen: tenant.ciudadOrigen,
      },
      receptor: {
        RUTRecep: receptor.rut,
        RznSocRecep: receptor.razonSocial,
        GiroRecep: receptor.giro,
        DirRecep: receptor.direccion,
        CmnaRecep: receptor.comuna,
        CiudadRecep: receptor.ciudad,
        Contacto: receptor.contacto ?? undefined,
        CorreoRecep: receptor.correoDte ?? undefined,
      },
      totales: {
        MntNeto: mntNeto > 0 ? mntNeto : undefined,
        MntExe: mntExento > 0 ? mntExento : undefined,
        TasaIVA: mntNeto > 0 ? tasaIva : undefined,
        IVA: iva > 0 ? iva : undefined,
        MntTotal: mntTotal,
      },
      detalles,
      referencias,
    };
    DteXmlBuilderService.validarAntesDeFolio(datosDocumento);

    // 5. Asignar siguiente folio de manera atómica (SELECT ... FOR UPDATE)
    const { folio, cafId, cafData } = await this.cafTedService.allocateNextFolio(
      tenantId,
      tipoDte
    );

    try {
      // 6. Construir el árbol XML del DTE + Timbre Electrónico <TED>
      const { docId, tedXml, unsignedDteXml } = DteXmlBuilderService.buildDocumentoXml({
        ...datosDocumento,
        idDoc: { ...datosDocumento.idDoc, Folio: folio },
        caf: cafData,
      });

      // 7. Firmar el <DTE> con la Firma Electrónica Avanzada (XMLDSig) del Tenant
      const signedDteXml = XmlDsigSignerService.signDteXml(unsignedDteXml, docId, cert, true);

      // 8. Persistir el DTE firmado en PostgreSQL
      const documentoRecord = await this.prisma.$transaction(async tx => {
        const saved = await tx.documentoDTE.create({
          data: {
            tenantId,
            receptorId,
            cafId,
            apiClientId,
            referenciaExterna,
            correoDestino: correoDestino ?? null,
            tipoDte,
            folio,
            fechaEmision: new Date(fechaEmision),
            fechaVenc: fechaVenc ? new Date(fechaVenc) : null,
            mntNeto,
            mntExento,
            tasaIva,
            iva,
            mntTotal,
            detallesJson: detalles as any,
            referenciasJson: (referencias ?? []) as any,
            tedXml,
            dteXmlFirmado: signedDteXml,
            estado: 'FIRMADO',
          },
        });

        if (payload.idempotencyReservationId) {
          if (!apiClientId) throw new Error('Una reserva de idempotencia requiere un proyecto de API.');
          const linked = await tx.apiIdempotencia.updateMany({
            where: { id: payload.idempotencyReservationId, apiClientId, documentoId: null },
            data: { documentoId: saved.id },
          });
          if (linked.count !== 1) throw new Error('La reserva de emisión ya no está disponible.');
        }
        return saved;
      });

      return documentoRecord;
    } catch (err) {
      // El folio ya se consumió y no tiene documento: queda registrado para anularlo ante el SII
      await this.prisma.folioSinUso
        .create({
          data: { tenantId, tipoDte, folio, motivo: String((err as Error)?.message ?? err).slice(0, 2000) },
        })
        .catch(() => undefined);
      throw err;
    }
  }

  /**
   * Agrupa uno o más DTEs en estado `FIRMADO` de un Tenant en un sobre `<EnvioDTE>`,
   * aplica la firma XMLDSig de carátula/lote y lo transmite al SII obteniendo el `TrackID`.
   */
  public async enviarLoteDteAlSii(
    tenantId: string,
    documentoIds: string[],
    estadoOrigen: 'FIRMADO' | 'EN_LOTE' = 'FIRMADO'
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} no existe.`);
    }

    const documentos = await this.prisma.documentoDTE.findMany({
      where: {
        id: { in: documentoIds },
        tenantId,
        estado: estadoOrigen,
      },
      orderBy: [{ tipoDte: 'asc' }, { folio: 'asc' }],
    });

    if (documentos.length === 0) {
      throw new Error(
        `No se encontraron DTEs en estado ${estadoOrigen} pertenecientes al Tenant ${tenantId} para los IDs indicados.`
      );
    }

    const cert = await this.signerService.getTenantActiveCertificate(tenantId);

    // Calcular subtotales por TipoDTE para la <Caratula>
    const conteoPorTipo = new Map<CodigoTipoDTE, number>();
    for (const doc of documentos) {
      const tpo = doc.tipoDte as CodigoTipoDTE;
      conteoPorTipo.set(tpo, (conteoPorTipo.get(tpo) ?? 0) + 1);
    }

    const subTotDTE = Array.from(conteoPorTipo.entries()).map(([TpoDTE, NroDTE]) => ({
      TpoDTE,
      NroDTE,
    }));

    const boletas = documentos.filter((d) =>
      DteXmlBuilderService.isBoleta(d.tipoDte as CodigoTipoDTE)
    );
    if (boletas.length > 0 && boletas.length < documentos.length) {
      throw new Error(
        'Un mismo envío no puede mezclar Boletas (39/41) con otros DTE: las boletas van en EnvioBOLETA por la API REST del SII.'
      );
    }
    const esBoleta = boletas.length > 0;

    const { setDocId, unsignedEnvioXml } = DteXmlBuilderService.buildEnvioLoteXml({
      caratula: {
        RutEmisor: tenant.rut,
        RutEnvia: tenant.rutEnvia,
        RutReceptor: '60803000-K', // RUT oficial del SII para recepción de DTE
        FchResol: tenant.fchResol.toISOString().split('T')[0],
        NroResol: tenant.nroResol,
        TmstFirmaEnv: formatSiiTimestamp(new Date()),
        SubTotDTE: subTotDTE,
      },
      signedDtesXml: documentos.map((d) => d.dteXmlFirmado!),
      esBoleta,
    });

    const signedEnvioXml = XmlDsigSignerService.signEnvioLoteXml(
      unsignedEnvioXml,
      setDocId,
      cert
    );

    // Transmitir al SII: Boletas por API REST, demás DTE por CGI DTEUpload
    const uploadParams = {
      tenantId,
      environment: tenant.environment,
      rutSender: tenant.rutEnvia,
      rutCompany: tenant.rut,
      signedEnvioXml,
      cert,
    };
    const uploadResult = esBoleta
      ? await this.siiWsService.uploadEnvioBoletaToSii(uploadParams)
      : await this.siiWsService.uploadEnvioDteToSii(uploadParams);

    // Registrar lote y actualizar estado de los DTEs en una transacción
    const loteRecord = await this.prisma.$transaction(async (tx) => {
      const lote = await tx.envioDteLote.create({
        data: {
          tenantId,
          rutEmisor: tenant.rut,
          rutEnvia: tenant.rutEnvia,
          rutReceptor: '60803000-K',
          esBoleta,
          trackId: uploadResult.trackId ?? null,
          xmlEnvio: signedEnvioXml,
          estado: uploadResult.success ? 'ENVIADO' : 'RECHAZADO',
          respuestaSii: uploadResult as any,
        },
      });

      await tx.documentoDTE.updateMany({
        where: {
          id: { in: documentos.map((d) => d.id) },
          tenantId,
        },
        data: {
          envioLoteId: lote.id,
          trackId: uploadResult.trackId ?? null,
          estado: uploadResult.success ? 'ENVIADO' : 'RECHAZADO',
          glosaEstadoSii: `Upload Status: ${uploadResult.status}`,
        },
      });

      return lote;
    });

    return {
      loteId: loteRecord.id,
      success: uploadResult.success,
      esBoleta,
      trackId: uploadResult.trackId,
      statusSii: uploadResult.status,
      signedEnvioXml,
    };
  }
}
