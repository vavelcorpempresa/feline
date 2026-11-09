import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import type { ApiDocumentosService } from '../../services/api-documentos.service';
import type { WebhookService } from '../../services/webhook.service';
import type { CorreoDocumentosService } from '../../services/correo.service';

// ============================================================================
// NORMA API · CONTRATO DE UN MÓDULO
// Un módulo agrupa las rutas de un recurso (documentos, empresa, webhooks...).
// Reglas que el registro hace cumplir al iniciar (ver docs/API_NORMA.md):
//   1. `id` en minúsculas, único; sus rutas viven bajo /v1/<id>.
//   2. Cada permiso que declara tiene la forma `recurso:accion`.
//   3. Cada ruta declara su acceso: `scope` (permiso), `soloClave`, `plataforma` o `publico`.
//   4. Cada ruta aparece en el fragmento OpenAPI del módulo.
// ============================================================================

/** Proyecto conectado que hace la solicitud (resuelto desde su clave). */
export interface ApiClientContext {
  id: string;
  nombre: string;
  tenantId: string;
  tenantRut: string;
  scopes: string[];
}

/** Dependencias compartidas que reciben todos los módulos. */
export interface ContextoApi {
  prisma: PrismaClient;
  documentos: ApiDocumentosService;
  webhooks: WebhookService;
  correos: CorreoDocumentosService;
  publicBaseUrl: string;
}

export interface FragmentoOpenApi {
  /** Rutas completas, con /v1 y parámetros como {id}. */
  paths: Record<string, unknown>;
  schemas?: Record<string, unknown>;
}

export interface ModuloApi {
  id: string;
  nombre: string;
  descripcion: string;
  /** Versión del módulo (semver). Sube el menor al agregar rutas; el mayor exige /v2. */
  version: string;
  /** Prefijo bajo /v1. Por norma es `/<id>`; '' solo para el módulo `sistema`. */
  prefijo: string;
  /** Permisos que introduce el módulo, con su descripción para el administrador. */
  permisos: Record<string, string>;
  openapi: FragmentoOpenApi;
  registrar(app: FastifyInstance, ctx: ContextoApi): void | Promise<void>;
}

declare module 'fastify' {
  interface FastifyRequest {
    apiClient?: ApiClientContext;
  }
  interface FastifyContextConfig {
    /** Permiso exigido a la clave del proyecto. */
    scope?: string;
    /** Exige una clave válida, sin permiso específico. */
    soloClave?: boolean;
    /** Ruta sin clave (salud, catálogo, especificación). */
    publico?: boolean;
    /** Operación de la plataforma (alta de empresas y claves): exige el token FELINE_ADMIN_TOKEN. */
    plataforma?: boolean;
  }
}

/** Ayuda de tipos para declarar un módulo. */
export function definirModulo(modulo: ModuloApi): ModuloApi {
  return modulo;
}
