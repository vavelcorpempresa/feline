import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { hashApiKey } from './claves';
import { ApiError, cuerpoError } from './errores';
import { ContextoApi, ModuloApi } from './modulo';

// ============================================================================
// NORMA API · REGISTRO DE MÓDULOS
// Monta los módulos bajo un prefijo de versión (/v1) con piezas comunes:
//   - autenticación `Authorization: Bearer flk_...` y control de permisos,
//   - cabecera `x-request-id` en todas las respuestas,
//   - errores con forma única (errores.ts), incluido el 404 de rutas inexistentes,
//   - validación de la norma al iniciar: una ruta que no la cumple impide arrancar.
// ============================================================================

export interface RutaCatalogo {
  metodo: string;
  ruta: string;
  acceso: 'publico' | 'clave' | 'permiso';
  permiso?: string;
}

export interface ModuloCatalogo {
  id: string;
  nombre: string;
  descripcion: string;
  version: string;
  permisos: Array<{ permiso: string; descripcion: string }>;
  rutas: RutaCatalogo[];
}

export interface Catalogo {
  version: string;
  modulos: ModuloCatalogo[];
}

const ID_MODULO = /^[a-z][a-z0-9-]*$/;
const PERMISO = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;

/** Ruta Fastify (`/v1/documentos/:id`) en formato OpenAPI (`/v1/documentos/{id}`). */
export function rutaOpenApi(ruta: string): string {
  return ruta.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

/** Valida la declaración de los módulos (sin rutas). Lanza un error con todas las faltas. */
export function validarModulos(modulos: readonly ModuloApi[]): void {
  const faltas: string[] = [];
  const ids = new Set<string>();
  const permisos = new Set<string>();
  for (const m of modulos) {
    if (!ID_MODULO.test(m.id)) faltas.push(`Módulo "${m.id}": el id debe ir en minúsculas (a-z, 0-9, -).`);
    if (ids.has(m.id)) faltas.push(`Módulo "${m.id}" repetido.`);
    ids.add(m.id);
    if (m.id !== 'sistema' && m.prefijo !== `/${m.id}`) {
      faltas.push(`Módulo "${m.id}": su prefijo debe ser "/${m.id}" (es "${m.prefijo}").`);
    }
    if (!/^\d+\.\d+\.\d+$/.test(m.version)) faltas.push(`Módulo "${m.id}": versión "${m.version}" no es semver.`);
    for (const p of Object.keys(m.permisos)) {
      if (!PERMISO.test(p)) faltas.push(`Módulo "${m.id}": el permiso "${p}" debe tener la forma recurso:accion.`);
      if (permisos.has(p)) faltas.push(`Permiso "${p}" declarado por dos módulos.`);
      permisos.add(p);
    }
  }
  if (faltas.length > 0) throw new Error('La API no cumple la norma:\n- ' + faltas.join('\n- '));
}

/** Todos los permisos declarados por los módulos (para crear claves de proyecto). */
export function permisosDe(modulos: readonly ModuloApi[]): string[] {
  return modulos.flatMap((m) => Object.keys(m.permisos));
}

export function registrarModulos(
  app: FastifyInstance,
  opciones: { version: string; modulos: readonly ModuloApi[]; ctx: ContextoApi }
): Catalogo {
  const { version, modulos, ctx } = opciones;
  validarModulos(modulos);
  const permisosValidos = new Set(permisosDe(modulos));
  const prefijoVersion = `/${version}`;

  const catalogo: Catalogo = {
    version,
    modulos: modulos.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      descripcion: m.descripcion,
      version: m.version,
      permisos: Object.entries(m.permisos).map(([permiso, descripcion]) => ({ permiso, descripcion })),
      rutas: [],
    })),
  };

  app.register(
    async (api) => {
      // Identificador de la solicitud, para cruzar un error del proyecto con el registro de Feline
      api.addHook('onRequest', async (request, reply) => {
        reply.header('x-request-id', request.id);
      });

      // Autenticación y permisos (antes de leer el cuerpo)
      api.addHook('onRequest', async (request: FastifyRequest) => {
        const config = request.routeOptions.config;
        if (config.publico) return;
        if (!config.scope && !config.soloClave) return; // 404 de rutas inexistentes

        const match = (request.headers.authorization ?? '').match(/^Bearer\s+(\S+)$/i);
        if (!match) throw new ApiError(401, 'Falta la cabecera Authorization: Bearer <clave>');
        const client = await ctx.prisma.apiClient.findUnique({
          where: { keyHash: hashApiKey(match[1]) },
          include: { tenant: { select: { rut: true, isActive: true } } },
        });
        if (!client || !client.isActive || !client.tenant.isActive) {
          throw new ApiError(401, 'Clave de API inválida o revocada');
        }
        if (config.scope && !client.scopes.includes(config.scope)) {
          throw new ApiError(403, `La clave del proyecto "${client.nombre}" no tiene el permiso ${config.scope}`);
        }

        request.apiClient = {
          id: client.id,
          nombre: client.nombre,
          tenantId: client.tenantId,
          tenantRut: client.tenant.rut,
          scopes: client.scopes,
        };
        // Registro de uso sin bloquear la respuesta
        void ctx.prisma.apiClient
          .update({ where: { id: client.id }, data: { lastUsedAt: new Date() } })
          .catch(() => undefined);
      });

      api.setErrorHandler((error, request, reply: FastifyReply) => {
        if (error instanceof ApiError) {
          return reply.code(error.statusCode).send(cuerpoError(error.statusCode, error.message, request.id, error.detalles));
        }
        if (error instanceof ZodError) {
          return reply.code(400).send(cuerpoError(400, 'Datos inválidos', request.id, error.issues));
        }
        const status = (error as { statusCode?: number }).statusCode;
        if (status && status >= 400 && status < 500) {
          return reply.code(status).send(cuerpoError(status, error.message, request.id));
        }
        request.log.error(error);
        return reply.code(500).send(cuerpoError(500, 'Error interno del motor DTE', request.id));
      });

      api.setNotFoundHandler((request, reply) =>
        reply.code(404).send(cuerpoError(404, `No existe ${request.method} ${request.url.split('?')[0]}`, request.id))
      );

      for (const [i, modulo] of modulos.entries()) {
        const rutas = catalogo.modulos[i].rutas;
        await api.register(
          async (scope) => {
            scope.addHook('onRoute', (route) => {
              const metodos = (Array.isArray(route.method) ? route.method : [route.method]).filter((m) => m !== 'HEAD');
              if (metodos.length === 0) return;
              const config = (route.config ?? {}) as { scope?: string; soloClave?: boolean; publico?: boolean };
              const declarados = [config.scope, config.soloClave, config.publico].filter(Boolean).length;
              const nombre = `${metodos.join(',')} ${route.url}`;
              if (declarados !== 1) {
                throw new Error(`Norma API: ${nombre} debe declarar exactamente uno de scope, soloClave o publico.`);
              }
              if (config.scope && !permisosValidos.has(config.scope)) {
                throw new Error(`Norma API: ${nombre} usa el permiso "${config.scope}", que ningún módulo declara.`);
              }
              if (!modulo.openapi.paths[rutaOpenApi(route.url)]) {
                throw new Error(`Norma API: ${nombre} no está documentada en el OpenAPI del módulo "${modulo.id}".`);
              }
              for (const metodo of metodos) {
                rutas.push({
                  metodo,
                  ruta: route.url,
                  acceso: config.publico ? 'publico' : config.soloClave ? 'clave' : 'permiso',
                  ...(config.scope ? { permiso: config.scope } : {}),
                });
              }
            });
            await modulo.registrar(scope, ctx);
          },
          { prefix: modulo.prefijo }
        );
      }
    },
    { prefix: prefijoVersion }
  );

  return catalogo;
}
