import { ModuloApi } from '../norma/modulo';
import { permisosDe } from '../norma/registro';
import { moduloEmpresa } from './modulos/empresa.modulo';
import { moduloDocumentos } from './modulos/documentos.modulo';
import { moduloWebhooks } from './modulos/webhooks.modulo';

// Módulos de negocio: los que usan las claves de proyecto. Archivo aparte de index.ts para que
// la consola de administración (usada por el módulo plataforma) no dependa de todos los módulos.
export const MODULOS_NEGOCIO_V1: readonly ModuloApi[] = [moduloEmpresa, moduloDocumentos, moduloWebhooks];

/** Permisos que se pueden asignar a una clave de proyecto. */
export const SCOPES: readonly string[] = permisosDe(MODULOS_NEGOCIO_V1);
export type Scope = string;
