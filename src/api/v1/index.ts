import { FastifyInstance } from 'fastify';
import { ContextoApi, ModuloApi } from '../norma/modulo';
import { Catalogo, permisosDe, registrarModulos } from '../norma/registro';
import { construirOpenApi } from '../norma/openapi';
import { moduloSistema } from './modulos/sistema.modulo';
import { moduloEmpresa } from './modulos/empresa.modulo';
import { moduloDocumentos } from './modulos/documentos.modulo';
import { moduloWebhooks } from './modulos/webhooks.modulo';

// ============================================================================
// API v1 DE FELINE PARA LOS SISTEMAS CONECTADOS (FUGAR Marketplace y cualquier otro)
// Cada recurso es un módulo (src/api/v1/modulos). Para agregar uno, ver docs/API_NORMA.md:
// crear <recurso>.modulo.ts y sumarlo a MODULOS_V1. Catálogo vivo: GET /v1/modulos.
// ============================================================================

export const VERSION_API = '1.1.0';

/** Módulos de negocio de la v1 (el módulo `sistema` se agrega al registrar). */
export const MODULOS_V1: readonly ModuloApi[] = [moduloEmpresa, moduloDocumentos, moduloWebhooks];

/** Permisos que se pueden asignar a una clave de proyecto. */
export const SCOPES: readonly string[] = permisosDe(MODULOS_V1);
export type Scope = string;

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
