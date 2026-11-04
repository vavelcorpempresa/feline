import crypto from 'node:crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  FELINE_ROLE_PROFILES,
  FelineLiveSandboxStore,
  UserDemoRecord,
  UserRoleProfile,
} from '../services/feline-live-sandbox.service';

// ============================================================================
// INICIO DE SESIÓN DEL PANEL CON ROLES
// - Contraseñas con scrypt (sal aleatoria); nunca se guardan ni se devuelven en claro.
// - Sesión firmada con HMAC-SHA256 en una cookie HttpOnly (12 horas).
// - Bloqueo de 15 minutos tras 5 intentos fallidos por correo.
// - Cada ruta del panel exige sesión, acceso a la empresa consultada y el permiso de su rol.
// ============================================================================

export const COOKIE_SESION = 'feline_sesion';
const DURACION_SESION_MS = 12 * 60 * 60 * 1000;
const MAX_FALLOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;
export const LARGO_MINIMO_CLAVE = 10;

type Permiso = keyof UserRoleProfile['permissions'];

// ---------------------------------------------------------------------------
// Contraseñas
// ---------------------------------------------------------------------------
export function hashClave(clave: string): string {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(clave, sal, 32);
  return 'scrypt$' + sal.toString('hex') + '$' + hash.toString('hex');
}

export function verificarClave(clave: string, guardado: string): boolean {
  const [alg, salHex, hashHex] = guardado.split('$');
  if (alg !== 'scrypt' || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const calculado = crypto.scryptSync(clave, Buffer.from(salHex, 'hex'), esperado.length);
  return crypto.timingSafeEqual(calculado, esperado);
}

export function validarClaveNueva(clave: unknown): string {
  if (typeof clave !== 'string' || clave.length < LARGO_MINIMO_CLAVE) {
    throw new Error('La contraseña debe tener al menos ' + LARGO_MINIMO_CLAVE + ' caracteres.');
  }
  return clave;
}

// ---------------------------------------------------------------------------
// Clave de los usuarios de demostración (sin contraseña propia todavía)
// ---------------------------------------------------------------------------
let claveDemoGenerada: string | null = null;

/**
 * Los usuarios de demostración que aún no tienen contraseña entran con FELINE_PANEL_CLAVE_DEMO.
 * Si no está definida, se genera una clave aleatoria al primer uso y se muestra una vez en el registro.
 */
export function claveDemo(registrar: (m: string) => void = console.warn): string {
  const env = process.env.FELINE_PANEL_CLAVE_DEMO;
  if (env) return env;
  if (!claveDemoGenerada) {
    claveDemoGenerada = crypto.randomBytes(9).toString('base64url');
    registrar(
      '[Panel] FELINE_PANEL_CLAVE_DEMO no está definida. Clave temporal de los usuarios de demostración: ' +
        claveDemoGenerada +
        ' (cambia en cada reinicio; defínela en .env para fijarla).'
    );
  }
  return claveDemoGenerada;
}

// ---------------------------------------------------------------------------
// Sesión firmada
// ---------------------------------------------------------------------------
let secretoGenerado: Buffer | null = null;
function secretoSesion(): Buffer {
  const env = process.env.FELINE_SESSION_SECRET;
  if (env) return crypto.createHash('sha256').update(env).digest();
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FELINE_SESSION_SECRET es obligatoria en producción.');
  }
  if (!secretoGenerado) secretoGenerado = crypto.randomBytes(32);
  return secretoGenerado;
}

export function firmarSesion(uid: string, ahora = Date.now()): string {
  const datos = Buffer.from(JSON.stringify({ uid, exp: ahora + DURACION_SESION_MS })).toString('base64url');
  const firma = crypto.createHmac('sha256', secretoSesion()).update(datos).digest('base64url');
  return datos + '.' + firma;
}

export function leerSesion(token: string | undefined, ahora = Date.now()): { uid: string } | null {
  if (!token || !token.includes('.')) return null;
  const [datos, firma] = token.split('.');
  const esperada = crypto.createHmac('sha256', secretoSesion()).update(datos).digest();
  const recibida = Buffer.from(firma, 'base64url');
  if (recibida.length !== esperada.length || !crypto.timingSafeEqual(recibida, esperada)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(datos, 'base64url').toString('utf8'));
    if (typeof uid !== 'string' || typeof exp !== 'number' || exp < ahora) return null;
    return { uid };
  } catch {
    return null;
  }
}

function leerCookie(request: FastifyRequest, nombre: string): string | undefined {
  const cabecera = request.headers.cookie ?? '';
  for (const parte of cabecera.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nombre) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

function cookieSesion(valor: string, maxAgeSeg: number): string {
  const segura = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return COOKIE_SESION + '=' + encodeURIComponent(valor) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAgeSeg + segura;
}

// ---------------------------------------------------------------------------
// Permisos por ruta del panel (las rutas GET solo exigen sesión)
// ---------------------------------------------------------------------------
const REGLAS: Array<{ metodo: string; patron: RegExp; permisos: Permiso[] }> = [
  { metodo: 'POST', patron: /^\/api\/v1\/dashboard\/moves$/, permisos: ['canIssueInvoices', 'canIssueBoletas'] },
  { metodo: 'POST', patron: /^\/api\/v1\/dashboard\/moves\/[^/]+\/post$/, permisos: ['canIssueInvoices', 'canIssueBoletas'] },
  { metodo: 'POST', patron: /^\/api\/v1\/dashboard\/moves\/[^/]+\/reverse$/, permisos: ['canIssueInvoices'] },
  { metodo: 'POST', patron: /^\/api\/v1\/dashboard\/moves\/[^/]+\/payment$/, permisos: ['canIssueInvoices', 'canRegisterPurchases'] },
  { metodo: 'POST', patron: /^\/api\/v1\/dashboard\/purchases$/, permisos: ['canRegisterPurchases'] },
  { metodo: 'POST', patron: /^\/api\/v1\/dashboard\/accounting\/entries$/, permisos: ['canCreateManualEntries'] },
  { metodo: 'POST', patron: /^\/api\/v1\/dashboard\/certificates\/upload$/, permisos: ['canManageCertificates'] },
  { metodo: 'POST', patron: /^\/api\/v1\/dashboard\/cafs\/generate$/, permisos: ['canManageCaf'] },
  { metodo: 'POST', patron: /^\/api\/v1\/dashboard\/sii\/send-batch$/, permisos: ['canTransmitSii'] },
  { metodo: 'POST', patron: /^\/api\/v1\/dashboard\/tenants$/, permisos: ['canManageTenants'] },
  { metodo: '*', patron: /^\/api\/v1\/dashboard\/users(\/|$)/, permisos: ['canManageUsers'] },
  {
    metodo: 'POST',
    patron: /^\/api\/v1\/dashboard\/expense-sheets\/[^/]+\/(approve|post|pay|refuse)$/,
    permisos: ['canCreateManualEntries'],
  },
];

export function permisosDe(usuario: UserDemoRecord) {
  return FELINE_ROLE_PROFILES.find((r) => r.key === usuario.roleKey)?.permissions;
}

export function usuarioPublico(u: UserDemoRecord) {
  const { passwordHash: _omitida, ...publico } = u as UserDemoRecord & { passwordHash?: string };
  return publico;
}

declare module 'fastify' {
  interface FastifyRequest {
    usuarioPanel?: UserDemoRecord;
  }
}

/**
 * Registra login, logout y consulta de sesión, y protege todas las rutas /api/v1/dashboard/*.
 */
export function registrarAutenticacionPanel(app: FastifyInstance, store: FelineLiveSandboxStore) {
  const fallos = new Map<string, { cuenta: number; hasta: number }>();

  app.post('/api/v1/panel/login', async (request, reply) => {
    const { email, clave } = (request.body ?? {}) as { email?: unknown; clave?: unknown };
    const correo = String(email ?? '').trim().toLowerCase();
    const ahora = Date.now();
    const registro = fallos.get(correo);
    if (registro && registro.hasta > ahora) {
      return reply.code(429).send({ error: 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.' });
    }

    const usuario = store.users.find((u) => u.email.toLowerCase() === correo);
    const guardado = (usuario as (UserDemoRecord & { passwordHash?: string }) | undefined)?.passwordHash;
    const valida =
      !!usuario &&
      typeof clave === 'string' &&
      (guardado ? verificarClave(clave, guardado) : clave === claveDemo((m) => request.log.warn(m)));

    if (!valida || !usuario.isActive) {
      // Si hubo un bloqueo y ya venció, el conteo parte de nuevo; si no, se acumula
      const bloqueoVencido = !!registro && registro.hasta > 0 && registro.hasta <= ahora;
      const cuenta = (bloqueoVencido ? 0 : registro?.cuenta ?? 0) + 1;
      fallos.set(correo, { cuenta, hasta: cuenta >= MAX_FALLOS ? ahora + BLOQUEO_MS : 0 });
      // Mismo mensaje para correo inexistente, clave errónea o usuario inactivo
      return reply.code(401).send({ error: 'Correo o contraseña incorrectos.' });
    }

    fallos.delete(correo);
    reply.header('Set-Cookie', cookieSesion(firmarSesion(usuario.id), DURACION_SESION_MS / 1000));
    return { usuario: usuarioPublico(usuario), permisos: permisosDe(usuario) };
  });

  // Acceso rápido SOLO en desarrollo: lista los usuarios de demostración con la clave de demostración
  // para entrar con un clic. En producción la ruta no existe (404) y la clave nunca sale del servidor.
  app.get('/api/v1/panel/acceso-desarrollo', async (request, reply) => {
    if (process.env.NODE_ENV === 'production') return reply.code(404).send({ error: 'No encontrado' });
    const clave = claveDemo((m) => request.log.warn(m));
    const usuarios = store.users
      .filter((u) => u.isActive && !(u as UserDemoRecord & { passwordHash?: string }).passwordHash)
      .map((u) => ({
        email: u.email,
        nombre: u.name,
        rol: FELINE_ROLE_PROFILES.find((r) => r.key === u.roleKey)?.name ?? u.roleKey,
      }));
    return { clave, usuarios };
  });

  app.post('/api/v1/panel/logout', async (_request, reply) => {
    reply.header('Set-Cookie', cookieSesion('', 0));
    return { ok: true };
  });

  const usuarioDeSesion = (request: FastifyRequest): UserDemoRecord | null => {
    const sesion = leerSesion(leerCookie(request, COOKIE_SESION));
    if (!sesion) return null;
    const usuario = store.users.find((u) => u.id === sesion.uid);
    return usuario && usuario.isActive ? usuario : null;
  };

  app.get('/api/v1/panel/sesion', async (request, reply) => {
    const usuario = usuarioDeSesion(request);
    if (!usuario) return reply.code(401).send({ error: 'Sin sesión' });
    return { usuario: usuarioPublico(usuario), permisos: permisosDe(usuario) };
  });

  app.post('/api/v1/panel/clave', async (request, reply) => {
    const usuario = usuarioDeSesion(request);
    if (!usuario) return reply.code(401).send({ error: 'Sin sesión' });
    const { actual, nueva } = (request.body ?? {}) as { actual?: unknown; nueva?: unknown };
    const guardado = (usuario as UserDemoRecord & { passwordHash?: string }).passwordHash;
    const actualValida =
      typeof actual === 'string' && (guardado ? verificarClave(actual, guardado) : actual === claveDemo());
    if (!actualValida) return reply.code(400).send({ error: 'La contraseña actual no es correcta.' });
    try {
      (usuario as UserDemoRecord & { passwordHash?: string }).passwordHash = hashClave(validarClaveNueva(nueva));
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
    return { ok: true };
  });

  // Protección de las rutas del panel
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const ruta = request.url.split('?')[0];
    if (!ruta.startsWith('/api/v1/dashboard/')) return;

    const usuario = usuarioDeSesion(request);
    if (!usuario) return reply.code(401).send({ error: 'Inicia sesión para continuar.' });

    // Empresa: la pedida si el usuario tiene acceso; si no se indica, su primera empresa
    const pedida = request.headers['x-tenant-id'];
    const tenantId = typeof pedida === 'string' && pedida.trim() ? pedida.trim() : usuario.tenantIds[0];
    if (!tenantId || !usuario.tenantIds.includes(tenantId)) {
      return reply.code(403).send({ error: 'No tienes acceso a esta empresa.' });
    }
    request.headers['x-tenant-id'] = tenantId;

    const permisos = permisosDe(usuario);
    const regla = REGLAS.find((r) => (r.metodo === '*' || r.metodo === request.method) && r.patron.test(ruta));
    if (regla && !regla.permisos.some((p) => permisos?.[p])) {
      return reply.code(403).send({ error: 'Tu rol no permite esta acción.' });
    }
    request.usuarioPanel = usuario;
  });
}
