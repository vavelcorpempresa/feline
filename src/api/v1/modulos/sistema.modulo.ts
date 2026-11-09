import { VERSION } from '../../../config';
import { definirModulo, ModuloApi } from '../../norma/modulo';
import { Catalogo } from '../../norma/registro';
import { error, json } from '../../norma/openapi';

// Salud, catálogo de módulos, especificación y verificación de la clave.
// Es lo primero que un sistema nuevo llama para comprobar que está bien conectado.
export function moduloSistema(fuentes: { catalogo: () => Catalogo; especificacion: () => unknown }): ModuloApi {
  return definirModulo({
    id: 'sistema',
    nombre: 'Sistema',
    descripcion: 'Salud del servicio, módulos disponibles, especificación OpenAPI y verificación de la clave.',
    version: '1.0.0',
    prefijo: '',
    permisos: {},
    openapi: {
      paths: {
        '/v1/salud': {
          get: {
            summary: 'Estado del servicio y de su base de datos (sin clave)',
            security: [],
            responses: {
              '200': { description: '{ estado: "ok", version, baseDatos: "ok", hora }' },
              '503': { description: '{ estado: "degradado", version, baseDatos: "error", hora }' },
            },
          },
        },
        '/v1/modulos': {
          get: {
            summary: 'Módulos disponibles, sus permisos y rutas (sin clave)',
            security: [],
            responses: { '200': { description: 'Catálogo de módulos', content: json({ type: 'object' }) } },
          },
        },
        '/v1/openapi.json': {
          get: {
            summary: 'Esta especificación (sin clave)',
            security: [],
            responses: { '200': { description: 'OpenAPI 3.1' } },
          },
        },
        '/v1/yo': {
          get: {
            summary: 'Proyecto, empresa y permisos de la clave usada',
            responses: {
              '200': {
                description: 'Clave válida',
                content: json({
                  type: 'object',
                  properties: {
                    proyecto: { type: 'object', properties: { id: { type: 'string' }, nombre: { type: 'string' } } },
                    empresa: { type: 'object', properties: { id: { type: 'string' }, rut: { type: 'string' } } },
                    permisos: { type: 'array', items: { type: 'string' } },
                  },
                }),
              },
              '401': error('Clave inválida o revocada'),
            },
          },
        },
      },
    },
    registrar(app, ctx) {
      app.get('/salud', { config: { publico: true } }, async (_request, reply) => {
        const baseDatos = await ctx.prisma.$queryRaw`SELECT 1`.then(
          () => 'ok' as const,
          () => 'error' as const
        );
        return reply.code(baseDatos === 'ok' ? 200 : 503).send({
          estado: baseDatos === 'ok' ? 'ok' : 'degradado',
          version: VERSION,
          baseDatos,
          hora: new Date().toISOString(),
        });
      });

      app.get('/modulos', { config: { publico: true } }, async () => fuentes.catalogo());

      app.get('/openapi.json', { config: { publico: true } }, async () => fuentes.especificacion());

      app.get('/yo', { config: { soloClave: true } }, async (request) => {
        const c = request.apiClient!;
        return {
          proyecto: { id: c.id, nombre: c.nombre },
          empresa: { id: c.tenantId, rut: c.tenantRut },
          permisos: c.scopes,
        };
      });
    },
  });
}
