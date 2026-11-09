import { ModuloApi } from './modulo';

// ============================================================================
// NORMA API · ESPECIFICACIÓN OPENAPI
// Se arma uniendo el fragmento de cada módulo; el registro impide arrancar si una
// ruta no está en el fragmento de su módulo, así la especificación no se desfasa.
// ============================================================================

export const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
export const json = (schema: unknown) => ({ 'application/json': { schema } });
export const error = (descripcion: string) => ({ description: descripcion, content: json(ref('Error')) });
export const paramId = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };

export function construirOpenApi(opciones: {
  publicBaseUrl: string;
  version: string;
  modulos: readonly ModuloApi[];
}) {
  const { publicBaseUrl, version, modulos } = opciones;
  const paths: Record<string, unknown> = {};
  const schemas: Record<string, unknown> = {
    Error: {
      type: 'object',
      required: ['error', 'codigo', 'requestId'],
      properties: {
        error: { type: 'string', description: 'Mensaje en español para mostrar o registrar.' },
        codigo: {
          type: 'string',
          enum: [
            'SOLICITUD_INVALIDA',
            'NO_AUTENTICADO',
            'SIN_PERMISO',
            'NO_ENCONTRADO',
            'CONFLICTO',
            'TIPO_NO_SOPORTADO',
            'REGLA_DE_NEGOCIO',
            'DEMASIADAS_SOLICITUDES',
            'NO_DISPONIBLE',
            'ERROR_INTERNO',
          ],
          description: 'Código estable para decidir en el código del proyecto.',
        },
        requestId: { type: 'string', description: 'Igual a la cabecera x-request-id.' },
        detalles: {},
      },
    },
  };

  for (const m of modulos) {
    // Cada operación queda etiquetada con su módulo
    for (const [ruta, operaciones] of Object.entries(m.openapi.paths)) {
      const conTag: Record<string, unknown> = {};
      for (const [metodo, op] of Object.entries(operaciones as Record<string, object>)) {
        conTag[metodo] = { tags: [m.id], ...op };
      }
      paths[ruta] = { ...(paths[ruta] as object), ...conTag };
    }
    Object.assign(schemas, m.openapi.schemas ?? {});
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Feline API',
      version,
      description:
        'Motor DTE y ERP central, organizado en módulos (ver GET /v1/modulos y docs/API_NORMA.md). ' +
        'Cada proyecto se conecta con su propia clave (`Authorization: Bearer flk_...`), que pertenece a una ' +
        'empresa emisora y tiene permisos `recurso:accion`. Toda respuesta trae `x-request-id`; los errores ' +
        'tienen la forma `Error`. Los cambios de estado de los documentos se avisan por webhook firmado con ' +
        'HMAC-SHA256 (cabecera `x-firma`, hex del cuerpo exacto).',
    },
    servers: [{ url: publicBaseUrl }],
    security: [{ bearer: [] }],
    tags: modulos.map((m) => ({ name: m.id, description: `${m.nombre} (v${m.version}). ${m.descripcion}` })),
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer', description: 'Clave de proyecto flk_...' } },
      schemas,
    },
    paths,
  };
}
