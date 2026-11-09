import { definirModulo } from '../../norma/modulo';
import { ref } from '../../norma/openapi';

export const moduloWebhooks = definirModulo({
  id: 'webhooks',
  nombre: 'Webhooks',
  descripcion: 'Avisos firmados que Feline envía al proyecto cuando cambia el estado de sus documentos.',
  version: '1.0.0',
  prefijo: '/webhooks',
  // Probar el webhook solo exige ver la empresa: así funciona con las claves ya entregadas.
  permisos: {},
  openapi: {
    paths: {
      '/v1/webhooks/prueba': {
        post: {
          summary: 'Enviar un evento webhook.prueba al webhook del proyecto',
          responses: { '200': { description: '{ entregado: boolean, url?: string, error?: string }' } },
        },
      },
    },
    schemas: {
      WebhookEvento: {
        description:
          'POST a la URL del proyecto. Verificar `x-firma` = HMAC-SHA256(hex) del cuerpo exacto con el secreto del proyecto. ' +
          'Responder 2xx; si no, se reintenta con espera creciente (30 s ... 6 h, 12 intentos).',
        allOf: [
          ref('Documento'),
          {
            type: 'object',
            properties: { evento: { type: 'string', enum: ['documento.estado', 'webhook.prueba'] } },
          },
        ],
      },
    },
  },
  registrar(app, ctx) {
    app.post('/prueba', { config: { scope: 'empresa:leer' } }, async (request) =>
      ctx.webhooks.probar(request.apiClient!.id)
    );
  },
});
