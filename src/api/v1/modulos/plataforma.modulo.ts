import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { FelineAdmin } from '../../../admin/feline-admin';
import { ApiError } from '../../norma/errores';
import { definirModulo } from '../../norma/modulo';
import { error, json, ref } from '../../norma/openapi';

// ============================================================================
// ALTA DE EMPRESAS Y SISTEMAS POR API (mismo efecto que `npm run admin`)
// Una empresa nueva queda lista para emitir con cuatro llamadas:
//   POST /v1/plataforma/empresas                       crear la empresa
//   POST /v1/plataforma/empresas/:rut/certificado      firma electrónica (.pfx en base64)
//   POST /v1/plataforma/empresas/:rut/caf              folios autorizados por el SII (XML)
//   POST /v1/plataforma/empresas/:rut/proyectos        clave del sistema que emitirá (FUGAR u otro)
// Exige `Authorization: Bearer <FELINE_ADMIN_TOKEN>` y solo debe usarse por HTTPS.
// ============================================================================

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato AAAA-MM-DD');

const EmpresaSchema = z
  .object({
    rut: z.string().trim().min(3),
    razonSocial: z.string().trim().min(2).max(100),
    giro: z.string().trim().min(2).max(80),
    acteco: z.array(z.number().int().positive()).min(1).max(4),
    direccionOrigen: z.string().trim().min(1).max(70),
    comunaOrigen: z.string().trim().min(1).max(20),
    ciudadOrigen: z.string().trim().min(1).max(20),
    fchResol: fecha,
    nroResol: z.number().int().min(0),
    rutEnvia: z.string().trim().min(3),
    environment: z.enum(['CERTIFICACION', 'PRODUCCION']).default('CERTIFICACION'),
  })
  .strict();

const CertificadoSchema = z
  .object({
    pfxBase64: z.string().min(16).max(200_000),
    clave: z.string().min(1).max(200),
  })
  .strict();

const CafSchema = z.object({ xml: z.string().min(50).max(200_000) }).strict();

const ProyectoSchema = z
  .object({
    nombre: z.string().trim().min(2).max(80),
    webhookUrl: z.string().url().optional(),
    permisos: z.array(z.string()).min(1).optional(),
  })
  .strict();

const WebhookSchema = z.object({ url: z.union([z.string().url(), z.literal('')]) }).strict();

const ParamRut = z.object({ rut: z.string().min(3).max(12) });
const ParamId = z.object({ id: z.string().uuid('Id de proyecto inválido') });

/** Los errores de la consola de administración son texto: aquí se traducen a la norma. */
async function traducir<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError || err instanceof z.ZodError) throw err;
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') throw new ApiError(404, 'Proyecto no encontrado');
      if (err.code === 'P2002') throw new ApiError(409, 'Ya existe un registro con esos datos');
      throw err;
    }
    const mensaje = err instanceof Error ? err.message : String(err);
    if (/^No existe la empresa/.test(mensaje)) throw new ApiError(404, mensaje);
    throw new ApiError(422, mensaje);
  }
}

const rutPath = { name: 'rut', in: 'path', required: true, schema: { type: 'string', example: '76192083-9' } };
const idPath = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
const comunes = { '401': error('Token de plataforma inválido'), '503': error('FELINE_ADMIN_TOKEN no configurado') };

export const moduloPlataforma = definirModulo({
  id: 'plataforma',
  nombre: 'Plataforma',
  descripcion:
    'Alta de empresas y conexión de sistemas por API: empresa, certificado, folios CAF y claves de proyecto. Exige el token de plataforma.',
  version: '1.0.0',
  prefijo: '/plataforma',
  permisos: {},
  openapi: {
    paths: {
      '/v1/plataforma/empresas': {
        get: {
          summary: 'Listar empresas con su certificado, folios y sistemas conectados',
          responses: { '200': { description: '{ datos: EmpresaPlataforma[] }' }, ...comunes },
        },
        post: {
          summary: 'Crear (o actualizar por RUT) una empresa emisora',
          requestBody: { required: true, content: json(ref('EmpresaNueva')) },
          responses: {
            '201': { description: 'Empresa creada o actualizada' },
            '400': error('Datos inválidos'),
            '422': error('RUT inválido'),
            ...comunes,
          },
        },
      },
      '/v1/plataforma/empresas/{rut}/certificado': {
        post: {
          summary: 'Cargar la firma electrónica (.pfx) de la empresa; se guarda cifrada',
          parameters: [rutPath],
          requestBody: {
            required: true,
            content: json({
              type: 'object',
              required: ['pfxBase64', 'clave'],
              properties: { pfxBase64: { type: 'string' }, clave: { type: 'string', format: 'password' } },
            }),
          },
          responses: {
            '201': { description: '{ titular, venceEl }' },
            '404': error('Empresa no encontrada'),
            '422': error('Archivo o clave del certificado inválidos'),
            ...comunes,
          },
        },
      },
      '/v1/plataforma/empresas/{rut}/caf': {
        post: {
          summary: 'Cargar un archivo CAF (folios autorizados por el SII)',
          parameters: [rutPath],
          requestBody: {
            required: true,
            content: json({ type: 'object', required: ['xml'], properties: { xml: { type: 'string' } } }),
          },
          responses: {
            '201': { description: '{ id, tipoDte, folioDesde, folioHasta }' },
            '404': error('Empresa no encontrada'),
            '422': error('CAF inválido, de otra empresa o ya cargado'),
            ...comunes,
          },
        },
      },
      '/v1/plataforma/empresas/{rut}/proyectos': {
        get: {
          summary: 'Sistemas conectados a la empresa',
          parameters: [rutPath],
          responses: { '200': { description: '{ datos: Proyecto[] }' }, '404': error('Empresa no encontrada'), ...comunes },
        },
        post: {
          summary: 'Conectar un sistema (FUGAR u otro): crea su clave flk_ y el secreto de su webhook',
          parameters: [rutPath],
          requestBody: {
            required: true,
            content: json({
              type: 'object',
              required: ['nombre'],
              properties: {
                nombre: { type: 'string', maxLength: 80 },
                webhookUrl: { type: 'string', format: 'uri' },
                permisos: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Por defecto todos los permisos de negocio (ver GET /v1/modulos).',
                },
              },
            }),
          },
          responses: {
            '201': {
              description:
                'La clave y el secreto se muestran una sola vez. `variables` trae las líneas listas para el .env del sistema.',
            },
            '404': error('Empresa no encontrada'),
            '422': error('Permisos o URL inválidos'),
            ...comunes,
          },
        },
      },
      '/v1/plataforma/proyectos/{id}/rotar-clave': {
        post: {
          summary: 'Reemplazar la clave del sistema (la anterior deja de funcionar de inmediato)',
          parameters: [idPath],
          responses: { '200': { description: '{ clave }' }, '404': error('Proyecto no encontrado'), ...comunes },
        },
      },
      '/v1/plataforma/proyectos/{id}/webhook': {
        put: {
          summary: 'Configurar (o quitar con url vacía) el webhook del sistema; genera un secreto nuevo',
          parameters: [idPath],
          requestBody: { required: true, content: json({ type: 'object', required: ['url'], properties: { url: { type: 'string' } } }) },
          responses: { '200': { description: '{ webhookUrl, webhookSecret }' }, '404': error('Proyecto no encontrado'), ...comunes },
        },
      },
      '/v1/plataforma/proyectos/{id}/revocar': {
        post: {
          summary: 'Revocar el acceso del sistema',
          parameters: [idPath],
          responses: { '200': { description: '{ id, nombre }' }, '404': error('Proyecto no encontrado'), ...comunes },
        },
      },
    },
    schemas: {
      EmpresaNueva: {
        type: 'object',
        required: ['rut', 'razonSocial', 'giro', 'acteco', 'direccionOrigen', 'comunaOrigen', 'ciudadOrigen', 'fchResol', 'nroResol', 'rutEnvia'],
        properties: {
          rut: { type: 'string', example: '76192083-9' },
          razonSocial: { type: 'string', maxLength: 100 },
          giro: { type: 'string', maxLength: 80 },
          acteco: { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 4 },
          direccionOrigen: { type: 'string', maxLength: 70 },
          comunaOrigen: { type: 'string', maxLength: 20 },
          ciudadOrigen: { type: 'string', maxLength: 20 },
          fchResol: { type: 'string', format: 'date', description: 'Fecha de la resolución SII' },
          nroResol: { type: 'integer', description: '0 en certificación' },
          rutEnvia: { type: 'string', description: 'RUT de la persona titular del certificado' },
          environment: { type: 'string', enum: ['CERTIFICACION', 'PRODUCCION'], default: 'CERTIFICACION' },
        },
      },
    },
  },
  registrar(app, ctx) {
    const admin = new FelineAdmin(ctx.prisma);
    const acceso = { config: { plataforma: true } };

    app.get('/empresas', acceso, async () => {
      const empresas = await ctx.prisma.tenant.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
          certificados: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 1, select: { validTo: true } },
          cafs: { where: { activo: true, agotado: false }, select: { tipoDte: true, folioActual: true, folioHasta: true } },
          _count: { select: { apiClients: { where: { isActive: true } } } },
        },
      });
      return {
        datos: empresas.map((t) => ({
          id: t.id,
          rut: t.rut,
          razonSocial: t.razonSocial,
          ambienteSii: t.environment,
          activa: t.isActive,
          certificadoVenceEl: t.certificados[0]?.validTo.toISOString().slice(0, 10) ?? null,
          foliosDisponibles: t.cafs.reduce((suma, c) => suma + (c.folioHasta - c.folioActual), 0),
          sistemasConectados: t._count.apiClients,
        })),
      };
    });

    app.post('/empresas', acceso, async (request, reply) => {
      const body = EmpresaSchema.parse(request.body);
      const t = await traducir(() => admin.crearEmpresa(body));
      return reply.code(201).send({ id: t.id, rut: t.rut, razonSocial: t.razonSocial, ambienteSii: t.environment });
    });

    app.post('/empresas/:rut/certificado', acceso, async (request, reply) => {
      const { rut } = ParamRut.parse(request.params);
      const { pfxBase64, clave } = CertificadoSchema.parse(request.body);
      const c = await traducir(() => admin.cargarCertificado(rut, Buffer.from(pfxBase64, 'base64'), clave));
      return reply.code(201).send({ titular: c.nombreTitular, venceEl: c.validTo.toISOString().slice(0, 10) });
    });

    app.post('/empresas/:rut/caf', acceso, async (request, reply) => {
      const { rut } = ParamRut.parse(request.params);
      const { xml } = CafSchema.parse(request.body);
      return reply.code(201).send(await traducir(() => admin.cargarCaf(rut, xml)));
    });

    app.get('/empresas/:rut/proyectos', acceso, async (request) => {
      const { rut } = ParamRut.parse(request.params);
      return { datos: await traducir(() => admin.listarProyectos(rut)) };
    });

    app.post('/empresas/:rut/proyectos', acceso, async (request, reply) => {
      const { rut } = ParamRut.parse(request.params);
      const body = ProyectoSchema.parse(request.body);
      const r = await traducir(() => admin.crearApiClient({ rut, ...body }));
      return reply.code(201).send({
        ...r,
        // Listo para pegar en el .env del sistema; no se vuelve a mostrar
        variables: {
          FELINE_API_URL: ctx.publicBaseUrl,
          FELINE_API_KEY: r.clave,
          ...(r.webhookSecret ? { FELINE_WEBHOOK_SECRET: r.webhookSecret } : {}),
        },
      });
    });

    app.post('/proyectos/:id/rotar-clave', acceso, async (request) => {
      const { id } = ParamId.parse(request.params);
      return traducir(() => admin.rotarClave(id));
    });

    app.put('/proyectos/:id/webhook', acceso, async (request) => {
      const { id } = ParamId.parse(request.params);
      const { url } = WebhookSchema.parse(request.body);
      return traducir(() => admin.configurarWebhook(id, url));
    });

    app.post('/proyectos/:id/revocar', acceso, async (request) => {
      const { id } = ParamId.parse(request.params);
      return traducir(() => admin.revocarProyecto(id));
    });
  },
});
