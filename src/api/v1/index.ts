import { FastifyInstance } from 'fastify';
import { ContextoApi, ModuloApi } from '../norma/modulo';
import { Catalogo, registrarModulos } from '../norma/registro';
import { construirOpenApi } from '../norma/openapi';
import { moduloSistema } from './modulos/sistema.modulo';
import { moduloPlataforma } from './modulos/plataforma.modulo';
import { MODULOS_NEGOCIO_V1 } from './permisos';

export { SCOPES, type Scope } from './permisos';

// ============================================================================
// API v1 DE FELINE PARA LOS SISTEMAS CONECTADOS (FUGAR Marketplace y cualquier otro)
// Cada recurso es un módulo (src/api/v1/modulos). Para agregar uno, ver docs/API_NORMA.md:
// crear <recurso>.modulo.ts y sumarlo a MODULOS_V1. Catálogo vivo: GET /v1/modulos.
// ============================================================================

export const VERSION_API = '1.2.0';

/** Módulos de la v1 (el módulo `sistema` se agrega al registrar). */
export const MODULOS_V1: readonly ModuloApi[] = [...MODULOS_NEGOCIO_V1, moduloPlataforma];

export function registerApiV1(app: FastifyInstance, ctx: ContextoApi): Catalogo {
  let catalogo: Catalogo | undefined;
  let especificacion: unknown;
  const sistema = moduloSistema({
    catalogo: () => catalogo!,
    especificacion: () => (especificacion ??= construirOpenApi({ publicBaseUrl: ctx.publicBaseUrl, version: VERSION_API, modulos })),
  });
  const modulos = [sistema, ...MODULOS_V1];
  catalogo = registrarModulos(app, { version: 'v1', modulos, ctx });
  return catalogo;
}
