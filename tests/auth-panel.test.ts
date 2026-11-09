import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { ADMIN, CONTADORA, VENTAS, CLAVE_DEMO, iniciarSesion } from './ayudas-panel';
import { buildFastifyApp } from '../src/server';
import { felineSandboxStore } from '../src/services/feline-live-sandbox.service';
import { firmarSesion, leerSesion, hashClave, verificarClave } from '../src/auth/panel-auth';

// ============================================================================
// INICIO DE SESIÓN Y ROLES DEL PANEL
// ============================================================================

describe('Inicio de sesión y roles del panel', () => {
  let app: FastifyInstance;
  const [empresa1, empresa2] = felineSandboxStore.tenants;
  const estado = (cookie?: string, tenant?: string) =>
    app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/state',
      headers: { ...(cookie ? { cookie } : {}), ...(tenant ? { 'x-tenant-id': tenant } : {}) },
    });

  beforeAll(() => {
    app = buildFastifyApp({ siiModo: 'simulado' });
  });
  afterAll(() => app.close());

  it('Las contraseñas se guardan con scrypt y sal; nunca en claro', () => {
    const h1 = hashClave('una-clave-larga');
    const h2 = hashClave('una-clave-larga');
    expect(h1).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(h1).not.toBe(h2);
    expect(verificarClave('una-clave-larga', h1)).toBe(true);
    expect(verificarClave('otra-clave', h1)).toBe(false);
  });

  it('Sin sesión el panel responde 401; una cookie alterada o vencida no sirve', async () => {
    expect((await estado()).statusCode).toBe(401);
    expect((await estado('feline_sesion=%ZZ')).statusCode).toBe(401);
    expect(verificarClave('x', 'scrypt$00$xx')).toBe(false);
    const valida = firmarSesion('user-x');
    expect(leerSesion(valida)?.uid).toBe('user-x');
    const [datos, firma] = valida.split('.');
    const falsa = Buffer.from(JSON.stringify({ uid: 'user-admin', exp: Date.now() + 1e9 })).toString('base64url');
    expect(leerSesion(falsa + '.' + firma)).toBeNull();
    expect(leerSesion(firmarSesion('user-x', Date.now() - 13 * 3600_000))).toBeNull();
    expect((await estado('feline_sesion=' + falsa + '.' + firma)).statusCode).toBe(401);
    expect(datos).toBeTruthy();
  });

  it('Correo inexistente y contraseña errónea dan el mismo mensaje', async () => {
    const mala = await app.inject({ method: 'POST', url: '/api/v1/panel/login', payload: { email: CONTADORA, clave: 'incorrecta' } });
    const nadie = await app.inject({ method: 'POST', url: '/api/v1/panel/login', payload: { email: 'nadie@x.cl', clave: 'x' } });
    expect(mala.statusCode).toBe(401);
    expect(nadie.statusCode).toBe(401);
    expect(mala.json().error).toBe(nadie.json().error);
  });

  it('Bloquea 15 minutos tras 5 intentos fallidos, aunque luego se use la contraseña correcta', async () => {
    const intentar = (clave: string) =>
      app.inject({ method: 'POST', url: '/api/v1/panel/login', payload: { email: VENTAS, clave } });
    for (let i = 0; i < 5; i++) expect((await intentar('mala-' + i)).statusCode).toBe(401);
    expect((await intentar(CLAVE_DEMO)).statusCode).toBe(429);
  });

  it('La cookie de sesión es HttpOnly y SameSite', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/panel/login', payload: { email: ADMIN, clave: CLAVE_DEMO } });
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(res.json().usuario.passwordHash).toBeUndefined();
  });

  it('Cada usuario solo ve y opera sus empresas', async () => {
    const cookie = await iniciarSesion(app, CONTADORA); // solo empresa 1
    const propia = await estado(cookie, empresa1.id);
    expect(propia.statusCode).toBe(200);
    expect(propia.json().tenants.map((t: any) => t.id)).toEqual([empresa1.id]);
    expect((await estado(cookie, empresa2.id)).statusCode).toBe(403);
    // Sin indicar empresa se usa la primera del usuario
    expect((await estado(cookie)).json().moves.every((m: any) => m.tenantId === empresa1.id)).toBe(true);
  });

  it('El rol limita las acciones: ventas emite pero no administra folios ni usuarios', async () => {
    const cookie = await iniciarSesionSinBloqueo(VENTAS);
    const headers = { cookie, 'x-tenant-id': empresa2.id };
    const caf = await app.inject({ method: 'POST', url: '/api/v1/dashboard/cafs/generate', headers, payload: { tipoDte: 33, desde: 9000, hasta: 9100 } });
    expect(caf.statusCode).toBe(403);
    const usuarios = await app.inject({ method: 'POST', url: '/api/v1/dashboard/users', headers, payload: {} });
    expect(usuarios.statusCode).toBe(403);
    const cliente = felineSandboxStore.partners.find((p) => p.tenantId === empresa2.id && p.taxpayerType === 'VAT_AFFECTED_1ST_CAT')!;
    const borrador = await app.inject({
      method: 'POST',
      url: '/api/v1/dashboard/moves',
      headers,
      payload: { partnerId: cliente.id, documentTypeCode: 33, lines: [{ name: 'Servicio', quantity: 1, priceUnit: 1000 }] },
    });
    expect(borrador.statusCode).toBe(201);
    // Sin permiso de usuarios solo se ve a sí mismo
    expect((await estado(cookie, empresa2.id)).json().users.map((u: any) => u.email)).toEqual([VENTAS]);
  });

  it('El administrador crea usuarios con contraseña propia, que nunca se devuelve', async () => {
    const cookie = await iniciarSesion(app, ADMIN);
    const headers = { cookie, 'x-tenant-id': empresa1.id };
    const base = { name: 'Camila Pérez', email: 'camila@feline.cl', rut: '11111111-1', roleKey: 'VIEWER', tenantIds: [empresa1.id] };
    const corta = await app.inject({ method: 'POST', url: '/api/v1/dashboard/users', headers, payload: { ...base, clave: 'corta' } });
    expect(corta.statusCode).toBe(400);
    const creada = await app.inject({ method: 'POST', url: '/api/v1/dashboard/users', headers, payload: { ...base, clave: 'clave-segura-123' } });
    expect(creada.statusCode).toBe(201);
    expect(creada.body).not.toMatch(/passwordHash|scrypt/);

    await expect(iniciarSesion(app, 'camila@feline.cl', CLAVE_DEMO)).rejects.toThrow();
    const suya = await iniciarSesion(app, 'camila@feline.cl', 'clave-segura-123');
    // Solo lectura: no puede emitir
    const emitir = await app.inject({ method: 'POST', url: '/api/v1/dashboard/moves', headers: { cookie: suya }, payload: {} });
    expect(emitir.statusCode).toBe(403);
    // Ningún listado expone hashes
    expect((await estado(cookie, empresa1.id)).body).not.toMatch(/passwordHash|scrypt\$/);
  });

  it('El administrador no puede desactivarse ni eliminarse a sí mismo', async () => {
    const cookie = await iniciarSesion(app, ADMIN);
    const yo = felineSandboxStore.users.find((u) => u.email === ADMIN)!;
    const headers = { cookie, 'x-tenant-id': empresa1.id };
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/dashboard/users/' + yo.id, headers })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: '/api/v1/dashboard/users/' + yo.id, headers, payload: { isActive: false } })).statusCode).toBe(400);
  });

  it('Crear una empresa no devuelve la llave privada de su certificado', async () => {
    const cookie = await iniciarSesion(app, ADMIN);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/dashboard/tenants',
      headers: { cookie, 'x-tenant-id': empresa1.id },
      payload: {
        rut: '77777777-7', razonSocial: 'Empresa Nueva SpA', giro: 'Servicios', direccionOrigen: 'Calle 1',
        comunaOrigen: 'Santiago', ciudadOrigen: 'Santiago', rutEnvia: '11111111-1',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).not.toMatch(/PRIVATE KEY|privateKeyPem/);
    expect(res.json().certificate.subjectName).toBeTruthy();
  });

  it('Cambiar la contraseña propia', async () => {
    const cookie = await iniciarSesion(app, CONTADORA);
    const cambiar = (actual: string, nueva: string) =>
      app.inject({ method: 'POST', url: '/api/v1/panel/clave', headers: { cookie }, payload: { actual, nueva } });
    expect((await cambiar('equivocada', 'nueva-clave-segura')).statusCode).toBe(400);
    expect((await cambiar(CLAVE_DEMO, 'corta')).statusCode).toBe(400);
    expect((await cambiar(CLAVE_DEMO, 'nueva-clave-segura')).statusCode).toBe(200);
    await expect(iniciarSesion(app, CONTADORA, CLAVE_DEMO)).rejects.toThrow();
    await expect(iniciarSesion(app, CONTADORA, 'nueva-clave-segura')).resolves.toBeTruthy();
  });

  // VENTAS quedó bloqueado en la prueba de intentos fallidos: se usa una app nueva (otro registro de intentos)
  async function iniciarSesionSinBloqueo(email: string) {
    const otra = buildFastifyApp({ siiModo: 'simulado' });
    const cookie = await iniciarSesion(otra, email);
    await otra.close();
    return cookie;
  }
});
