import { DteStatus, PrismaClient } from '@prisma/client';
import { CodigoTipoDTE } from '../types/sii-dte.types';
import { DteBillingOrchestratorService } from './dte-orchestrator.service';
import { DteXmlBuilderService } from './dte-xml-builder.service';
import { SiiWebServiceIntegration } from './sii-webservice.service';
import { XmlDsigSignerService } from './xmldsig-signer.service';
import { WebhookService } from './webhook.service';

// ============================================================================
// DESPACHADOR ASÍNCRONO: FIRMADO → ENVIADO (TrackID) → ACEPTADO / REPARO / RECHAZADO
// Cada documento viaja en su propio envío para conocer su resultado exacto en el SII.
// En cada cambio de estado se encola un webhook para la integración que lo emitió.
// ============================================================================

/** Estados de envío del SII que indican rechazo del sobre completo. */
const ESTADOS_ENVIO_RECHAZADO = new Set(['RCH', 'RCT', 'RFR', 'RSC', 'RCS', 'RPT', 'RCO', 'RFH', 'RPR_ENV']);

/**
 * Traduce el resultado de la consulta de un envío de 1 documento a su estado final.
 * Devuelve `null` si el SII aún lo está procesando.
 */
export function estadoFinalDesdeSii(r: {
  estado: string;
  aceptados: number;
  rechazados: number;
  reparos: number;
}): DteStatus | null {
  const estado = r.estado.toUpperCase();
  if (estado === 'EPR') {
    if (r.rechazados > 0) return 'RECHAZADO';
    if (r.reparos > 0) return 'ACEPTADO_CON_REPARO';
    if (r.aceptados > 0) return 'ACEPTADO';
    return null;
  }
  if (ESTADOS_ENVIO_RECHAZADO.has(estado)) return 'RECHAZADO';
  return null; // REC, SOK, FOK, PRD, CRT...: en proceso
}

export interface DispatcherOptions {
  intervaloMs?: number;
  consultaCadaMs?: number; // Tiempo mínimo entre consultas de estado de un mismo documento
  lote?: number;
}

export class DteDispatcherService {
  private timer: NodeJS.Timeout | null = null;
  private enCurso = false;
  private readonly consultaCadaMs: number;
  private readonly lote: number;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly orchestrator: DteBillingOrchestratorService,
    private readonly siiWs: SiiWebServiceIntegration,
    private readonly signer: XmlDsigSignerService,
    private readonly webhooks: WebhookService,
    private readonly opciones: DispatcherOptions = {}
  ) {
    this.consultaCadaMs = opciones.consultaCadaMs ?? 60_000;
    this.lote = opciones.lote ?? 20;
  }

  public start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.opciones.intervaloMs ?? 15_000);
    this.timer.unref();
  }

  public stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Un ciclo completo. Nunca se solapan dos ciclos en el mismo proceso. */
  public async tick() {
    if (this.enCurso) return { omitido: true };
    this.enCurso = true;
    try {
      const enviados = await this.enviarFirmados();
      const consultados = await this.consultarEnviados();
      const webhooks = await this.webhooks.entregarPendientes();
      return { enviados, consultados, webhooks };
    } catch (err: any) {
      // Si la base de datos PostgreSQL no está disponible en desarrollo/sandbox, no tumbar el servidor
      return { error: err.message, omitido: true };
    } finally {
      this.enCurso = false;
    }
  }

  private async enviarFirmados(): Promise<number> {
    const firmados = await this.prisma.documentoDTE.findMany({
      where: { estado: 'FIRMADO', apiClientId: { not: null } },
      orderBy: { createdAt: 'asc' },
      take: this.lote,
      select: { id: true, tenantId: true },
    });

    let enviados = 0;
    for (const { id, tenantId } of firmados) {
      // Reserva atómica: otra instancia del despachador no envía el mismo documento
      const claim = await this.prisma.documentoDTE.updateMany({
        where: { id, estado: 'FIRMADO' },
        data: { estado: 'EN_LOTE' },
      });
      if (claim.count === 0) continue;

      try {
        await this.orchestrator.enviarLoteDteAlSii(tenantId, [id], 'EN_LOTE');
        enviados++;
      } catch (err: any) {
        // Falla de red o autenticación: vuelve a FIRMADO para reintentar en el próximo ciclo
        await this.prisma.documentoDTE.update({
          where: { id },
          data: { estado: 'FIRMADO', glosaEstadoSii: `Reintento de envío: ${String(err?.message).slice(0, 400)}` },
        });
        continue;
      }
      // La primera consulta de estado espera `consultaCadaMs`: el SII tarda en procesar el envío
      const doc = await this.prisma.documentoDTE.update({
        where: { id },
        data: { siiConsultadoAt: new Date() },
      });
      await this.webhooks.encolar(doc);
    }
    return enviados;
  }

  private async consultarEnviados(): Promise<number> {
    const limite = new Date(Date.now() - this.consultaCadaMs);
    const enviados = await this.prisma.documentoDTE.findMany({
      where: {
        estado: 'ENVIADO',
        trackId: { not: null },
        apiClientId: { not: null },
        OR: [{ siiConsultadoAt: null }, { siiConsultadoAt: { lte: limite } }],
      },
      include: { tenant: true },
      orderBy: { updatedAt: 'asc' },
      take: this.lote,
    });

    let resueltos = 0;
    for (const doc of enviados) {
      try {
        const cert = await this.signer.getTenantActiveCertificate(doc.tenantId);
        let estadoFinal: DteStatus | null;
        let glosa: string;

        if (DteXmlBuilderService.isBoleta(doc.tipoDte as CodigoTipoDTE)) {
          const r = await this.siiWs.queryBoletaStatusByTrackId({
            tenantId: doc.tenantId,
            environment: doc.tenant.environment,
            rutCompany: doc.tenant.rut,
            trackId: doc.trackId!,
            cert,
          });
          const est = ((r.raw as any)?.estadistica ?? [])[0] ?? {};
          estadoFinal = estadoFinalDesdeSii({
            estado: r.estado,
            aceptados: Number(est.aceptados ?? 0),
            rechazados: Number(est.rechazados ?? 0),
            reparos: Number(est.reparos ?? 0),
          });
          glosa = `SII Boleta: ${r.estado}`;
        } else {
          const r = await this.siiWs.queryUploadStatusByTrackId({
            tenantId: doc.tenantId,
            environment: doc.tenant.environment,
            rutCompany: doc.tenant.rut,
            trackId: doc.trackId!,
            cert,
          });
          estadoFinal = estadoFinalDesdeSii(r);
          glosa = `SII: ${r.estado} - ${r.glosa}`;
        }

        const actualizado = await this.prisma.documentoDTE.update({
          where: { id: doc.id },
          data: {
            siiConsultadoAt: new Date(),
            ...(estadoFinal ? { estado: estadoFinal, glosaEstadoSii: glosa.slice(0, 1000) } : {}),
          },
        });
        if (estadoFinal) {
          resueltos++;
          await this.webhooks.encolar(actualizado);
        }
      } catch (err: any) {
        await this.prisma.documentoDTE.update({
          where: { id: doc.id },
          data: {
            siiConsultadoAt: new Date(),
            glosaEstadoSii: `Error consultando estado: ${String(err?.message).slice(0, 400)}`,
          },
        });
      }
    }
    return resueltos;
  }
}
