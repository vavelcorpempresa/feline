// ============================================================================
// CONFIGURACIÓN ÚNICA: versión, puerto y URL pública
// Antes estaban repetidas con valores distintos (1.0.0 / 1.2.0 / 1.3.0; 3004 / 3006 / 3007).
// Mantener VERSION igual a "version" de package.json (lo verifica una prueba).
// ============================================================================

export const VERSION = '1.3.0';

/** Puerto de escucha (`PORT`), 3004 por defecto. Se lee al usarse para respetar el entorno vigente. */
export function puerto(): number {
  return Number(process.env.PORT || 3004);
}

/** URL pública de Feline (`FELINE_PUBLIC_URL`); por defecto, localhost en el puerto de escucha. */
export function urlPublica(): string {
  return process.env.FELINE_PUBLIC_URL || 'http://localhost:' + puerto();
}
