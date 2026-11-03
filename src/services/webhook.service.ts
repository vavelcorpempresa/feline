import crypto from 'node:crypto';
import { PrismaClient, DocumentoDTE } from '@prisma/client';

// ============================================================================
// WEBHOOKS A INTEGRACIONES (bandeja de salida con reintentos)
// Firma: cabecera `x-firma` = HMAC-SHA256 en hexadecimal del cuerpo exacto,
// con el `webhookSecret` del ApiClient (en FUGAR: MOTOR_DTE_WEBHOOK_SECRET).
// ============================================================================

export const MAX_INTENTOS_WEBHOOK = 12;

export function firmarWebhook(cuerpo: string, secreto: string): string {
  return crypto.createHmac('sha256', secreto).update(cuerpo, 'utf8').digest('hex');
}

/** Espera antes del reintento n (30 s, 1 min, 2 min, ... con tope de 6 horas). */
export function esperaReintentoMs(intento: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, intento - 1), 6 * 60 * 60 * 1000);
}

export class WebhookService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly respuesta: (doc: DocumentoDTE) => Record<string, unknown>,
    private readonly httpClient: typeof fetch = globalThis.fetch,
    private readonly timeoutMs = 10_000
  ) {}

  /** Encola un aviso de cambio de estado si el documento pertenece a una integración con webhook. */
  public async encolar(doc: DocumentoDTE) {
    if (!doc.apiClientId) return null;
    const client = await this.prisma.apiClient.findUnique({ where: { id: doc.apiClientId } });
    if (!client?.webhookUrl || !client.webhookSecret || !client.isActive) return null;

    return this.prisma.webhookEvento.create({
      data: {
        apiClientId: client.id,
        documentoId: doc.id,
        evento: 'documento.estado',
        payload: { evento: 'documento.estado', ...this.respuesta(doc) } as any,
      },
    });
  }

  /**
   * Envía de inmediato un evento `webhook.prueba` para que el proyecto verifique su receptor
   * (URL alcanzable y firma correcta). No se reintenta: el resultado se devuelve al llamador.
   */
  public async probar(apiClientId: string) {
    const client = await this.prisma.apiClient.findUniqueOrThrow({ where: { id: apiClientId } });
    if (!client.webhookUrl || !client.webhookSecret) {
      return { entregado: false, error: 'El proyecto no tiene webhook configurado' };
    }
    const evento = await this.prisma.webhookEvento.create({
      data: {
        apiClientId: client.id,
        evento: 'webhook.prueba',
        payload: { evento: 'webhook.prueba', proyecto: client.nombre, enviadoAt: new Date().toISOString() },
        intentos: MAX_INTENTOS_WEBHOOK - 1, // un solo intento
      },
    });
    await this.entregarPendientes(1, evento.id);
    const final = await this.prisma.webhookEvento.findUniqueOrThrow({ where: { id: evento.id } });
    return final.entregadoAt
      ? { entregado: true, url: client.webhookUrl }
      : { entregado: false, url: client.webhookUrl, error: final.ultimoError };
  }

  /** Entrega los avisos pendientes cuyo próximo intento ya venció. */
  public async entregarPendientes(
    limite = 50,
    soloId?: string
  ): Promise<{ entregados: number; fallidos: number }> {
    const pendientes = await this.prisma.webhookEvento.findMany({
      where: {
        ...(soloId ? { id: soloId } : {}),
        entregadoAt: null,
        intentos: { lt: MAX_INTENTOS_WEBHOOK },
        proximoIntento: { lte: new Date() },
      },
      include: { apiClient: true },
      orderBy: { createdAt: 'asc' },
      take: limite,
    });

    let entregados = 0;
    let fallidos = 0;
    for (const evento of pendientes) {
      const { webhookUrl, webhookSecret } = evento.apiClient;
      const intentos = evento.intentos + 1;
      try {
        if (!webhookUrl || !webhookSecret) throw new Error('La integración ya no tiene webhook configurado');
        const cuerpo = JSON.stringify(evento.payload);
        const res = await this.httpClient(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-firma': firmarWebhook(cuerpo, webhookSecret),
            'x-feline-evento': evento.evento,
            'x-feline-evento-id': evento.id,
          },
          body: cuerpo,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
        }
        await this.prisma.webhookEvento.update({
          where: { id: evento.id },
          data: { intentos, entregadoAt: new Date(), ultimoError: null },
        });
        entregados++;
      } catch (err: any) {
        await this.prisma.webhookEvento.update({
          where: { id: evento.id },
          data: {
            intentos,
            ultimoError: String(err?.message ?? err).slice(0, 1000),
            proximoIntento: new Date(Date.now() + esperaReintentoMs(intentos)),
          },
        });
        fallidos++;
      }
    }
    return { entregados, fallidos };
  }
}
