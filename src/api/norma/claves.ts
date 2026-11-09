import crypto from 'node:crypto';

// ============================================================================
// NORMA API · CLAVES DE PROYECTO
// Cada sistema conectado (FUGAR u otro) usa su propia clave `flk_...`, ligada a
// una empresa emisora y a una lista de permisos. En la base solo queda el hash.
// ============================================================================

export const API_KEY_PREFIX = 'flk_';

export function hashApiKey(clave: string): string {
  return crypto.createHash('sha256').update(clave, 'utf8').digest('hex');
}

/** Genera una clave nueva. Se muestra una sola vez; en base de datos solo queda su hash. */
export function generarApiKey(): { clave: string; prefix: string; hash: string } {
  const clave = API_KEY_PREFIX + crypto.randomBytes(32).toString('base64url');
  return { clave, prefix: clave.slice(0, 12), hash: hashApiKey(clave) };
}
