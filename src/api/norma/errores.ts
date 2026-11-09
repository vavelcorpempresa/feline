// ============================================================================
// NORMA API · ERRORES
// Todas las respuestas de error de /v1 tienen la misma forma:
//   { error: string, codigo: CodigoError, requestId: string, detalles?: unknown }
// `error` se mantiene por compatibilidad con los proyectos ya conectados (FUGAR).
// ============================================================================

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly detalles?: unknown
  ) {
    super(message);
  }
}

export type CodigoError =
  | 'SOLICITUD_INVALIDA'
  | 'NO_AUTENTICADO'
  | 'SIN_PERMISO'
  | 'NO_ENCONTRADO'
  | 'CONFLICTO'
  | 'TIPO_NO_SOPORTADO'
  | 'REGLA_DE_NEGOCIO'
  | 'DEMASIADAS_SOLICITUDES'
  | 'NO_DISPONIBLE'
  | 'ERROR_INTERNO';

const CODIGOS: Record<number, CodigoError> = {
  400: 'SOLICITUD_INVALIDA',
  401: 'NO_AUTENTICADO',
  403: 'SIN_PERMISO',
  404: 'NO_ENCONTRADO',
  409: 'CONFLICTO',
  415: 'TIPO_NO_SOPORTADO',
  422: 'REGLA_DE_NEGOCIO',
  429: 'DEMASIADAS_SOLICITUDES',
  503: 'NO_DISPONIBLE',
};

export function codigoDeEstado(status: number): CodigoError {
  return CODIGOS[status] ?? (status >= 500 ? 'ERROR_INTERNO' : 'SOLICITUD_INVALIDA');
}

export interface CuerpoError {
  error: string;
  codigo: CodigoError;
  requestId: string;
  detalles?: unknown;
}

export function cuerpoError(status: number, mensaje: string, requestId: string, detalles?: unknown): CuerpoError {
  return { error: mensaje, codigo: codigoDeEstado(status), requestId, ...(detalles !== undefined ? { detalles } : {}) };
}
