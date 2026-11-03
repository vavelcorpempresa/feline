import crypto from 'node:crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { ApiClientContext, ApiDocumentosService, ApiError } from '../../services/api-documentos.service';
import { DtePdfService } from '../../services/dte-pdf.service';
import { WebhookService } from '../../services/webhook.service';
import { buildOpenApiSpec } from './openapi';

// ============================================================================
// API v1 DE FELINE PARA LOS PROYECTOS CONECTADOS (FUGAR Marketplace y cualquier otro)
//   GET  /v1/openapi.json          Especificación OpenAPI 3 (pública)
//   GET  /v1/empresa               Empresa, certificado y folios disponibles     [empresa:leer]
//   POST /v1/documentos            Emitir (Idempotency-Key obligatoria)          [documentos:emitir]
//   GET  /v1/documentos            Listar con filtros y cursor                   [documentos:leer]
//   GET  /v1/documentos/:id        Estado del documento                          [documentos:leer]
//   GET  /v1/documentos/:id/pdf    Representación impresa con timbre PDF417      [documentos:leer]
//   GET  /v1/documentos/:id/xml    XML del DTE firmado (ISO-8859-1)              [documentos:leer]
//   POST /v1/webhooks/prueba       Envía un evento de prueba al webhook          [empresa:leer]
// Autenticación: `Authorization: Bearer <clave>`; cada clave = un proyecto + una empresa emisora.
// ============================================================================

export const API_KEY_PREFIX = 'flk_';

export const SCOPES = ['documentos:emitir', 'documentos:leer', 'empresa:leer'] as const;
export type Scope = (typeof SCOPES)[number];

export function hashApiKey(clave: string): string {
  return crypto.createHash('sha256').update(clave, 'utf8').digest('hex');
}

/** Genera una clave nueva. Se muestra una sola vez; en base de datos solo queda su hash. */
export function generarApiKey(): { clave: string; prefix: string; hash: string } {
  const clave = API_KEY_PREFIX + crypto.randomBytes(32).toString('base64url');
  return { clave, prefix: clave.slice(0, 12), hash: hashApiKey(clave) };
}

declare module 'fastify' {
  interface FastifyRequest {
    apiClient?: ApiClientContext;
  }
  interface FastifyContextConfig {
    scope?: Scope;
  }
}

export function registerApiV1(
  app: FastifyInstance,
  deps: { prisma: PrismaClient; documentos: ApiDocumentosService; webhooks: WebhookService; publicBaseUrl: string }
) {
  const { prisma, documentos, webhooks } = deps;

  // Documentación pública (sin clave): cualquier proyecto puede generar su cliente desde aquí
  app.get('/v1/openapi.json', async () => buildOpenApiSpec(deps.publicBaseUrl));

  app.register(
    async (v1) => {
      v1.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
        const header = request.headers.authorization ?? '';
        const match = header.match(/^Bearer\s+(\S+)$/i);
        if (!match) {
          return reply.code(401).send({ error: 'Falta la cabecera Authorization: Bearer <clave>' });
        }
        const client = await prisma.apiClient.findUnique({
          where: { keyHash: hashApiKey(match[1]) },
          include: { tenant: { select: { rut: true, isActive: true } } },
        });
        if (!client || !client.isActive || !client.tenant.isActive) {
          return reply.code(401).send({ error: 'Clave de API inválida o revocada' });
        }

        const requerido = request.routeOptions.config.scope;
        if (requerido && !client.scopes.includes(requerido)) {
          return reply
            .code(403)
            .send({ error: `La clave del proyecto "${client.nombre}" no tiene el permiso ${requerido}` });
        }

        request.apiClient = {
          id: client.id,
          nombre: client.nombre,
          tenantId: client.tenantId,
          tenantRut: client.tenant.rut,
          scopes: client.scopes,
        };
        // Registro de uso sin bloquear la respuesta
        void prisma.apiClient
          .update({ where: { id: client.id }, data: { lastUsedAt: new Date() } })
          .catch(() => undefined);
      });

      v1.setErrorHandler((error, request, reply) => {
        if (error instanceof ApiError) {
          return reply
            .code(error.statusCode)
            .send({ error: error.message, ...(error.detalles ? { detalles: error.detalles } : {}) });
        }
        if ((error as any).statusCode && (error as any).statusCode < 500) {
          return reply.code((error as any).statusCode).send({ error: error.message });
        }
        request.log.error(error);
        return reply.code(500).send({ error: 'Error interno del motor DTE' });
      });

      v1.get('/empresa', { config: { scope: 'empresa:leer' } }, async (request) =>
        documentos.empresa(request.apiClient!)
      );

      v1.post('/webhooks/prueba', { config: { scope: 'empresa:leer' } }, async (request) =>
        webhooks.probar(request.apiClient!.id)
      );

      v1.post('/documentos', { config: { scope: 'documentos:emitir' } }, async (request, reply) => {
        const idempotencyKey = request.headers['idempotency-key'];
        const { documento, idempotente, advertencias } = await documentos.emitir(
          request.apiClient!,
          typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
          request.body
        );
        return reply.code(idempotente ? 200 : 202).send({
          ...documentos.respuesta(documento),
          idempotente,
          ...(advertencias.length > 0 ? { advertencias } : {}),
        });
      });

      v1.get('/documentos', { config: { scope: 'documentos:leer' } }, async (request) =>
        documentos.listar(request.apiClient!, request.query)
      );

      v1.get('/documentos/:id', { config: { scope: 'documentos:leer' } }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const doc = await documentos.obtener(request.apiClient!, id);
        if (!doc) return reply.code(404).send({ error: 'Documento no encontrado' });
        return documentos.respuesta(doc);
      });

      v1.get('/documentos/:id/pdf', { config: { scope: 'documentos:leer' } }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const doc = await documentos.obtener(request.apiClient!, id);
        if (!doc) return reply.code(404).send({ error: 'Documento no encontrado' });
        const pdf = await DtePdfService.generar(doc);
        return reply
          .type('application/pdf')
          .header('Content-Disposition', `inline; filename="DTE_${doc.tipoDte}_${doc.folio}.pdf"`)
          .send(pdf);
      });

      v1.get('/documentos/:id/xml', { config: { scope: 'documentos:leer' } }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const doc = await documentos.obtener(request.apiClient!, id);
        if (!doc?.dteXmlFirmado) return reply.code(404).send({ error: 'Documento no encontrado' });
        // El DTE se firmó asumiendo el namespace del SII: el XML suelto debe declararlo para verificar
        const dte = doc.dteXmlFirmado.replace(
          /^<DTE version="1.0">/,
          '<DTE xmlns="http://www.sii.cl/SiiDte" version="1.0">'
        );
        const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>\n${dte}`;
        return reply
          .type('application/xml; charset=ISO-8859-1')
          .header('Content-Disposition', `attachment; filename="DTE_${doc.tipoDte}_${doc.folio}.xml"`)
          .send(Buffer.from(xml, 'latin1'));
      });
    },
    { prefix: '/v1' }
  );
}
