import { describe, it, expect, afterEach } from 'vitest';
import { buildFastifyApp } from '../src/server';
import { felineSandboxStore } from '../src/services/feline-live-sandbox.service';
import { ADMIN, iniciarSesion } from './ayudas-panel';

// ============================================================================
// SEGURIDAD DEL PANEL Y DE LA ADMINISTRACIÓN (auditoría ACF, grupo 1)
// ============================================================================

const entornoOriginal = { ...process.env };
afterEach(() => {
  process.env = { ...entornoOriginal };
});

describe('Seguridad del panel y administración', () => {
  it('El estado del panel solo trae datos de la empresa consultada', async () => {
    const app = buildFastifyApp({ siiModo: 'simulado' });
    const [a, b] = felineSandboxStore.tenants;
    expect(a && b).toBeTruthy();
    const cookie = await iniciarSesion(app, ADMIN);
    const res = await app.inject({ method: 'GET', url: '/api/v1/dashboard/state', headers: { 'x-tenant-id': a.id, cookie } });
    const estado = res.json();
    expect(estado.moves.length).toBeGreaterThan(0);
    for (const coleccion of ['moves', 'partners', 'cafs', 'lotesEnviados']) {
      expect(estado[coleccion].every((x: any) => x.tenantId === a.id), coleccion).toBe(true);
    }
    expect(estado.users.every((u: any) => u.tenantIds.includes(a.id))).toBe(true);
    expect(estado.partners.some((p: any) => p.tenantId === b.id)).toBe(false);
    await app.close();
  });

  it('El modo demostración queda bloqueado en producción salvo FELINE_DEMO=on', async () => {
    process.env.NODE_ENV = 'production';
    process.env.TENANT_VAULT_MASTER_KEY = 'a'.repeat(64);
    delete process.env.FELINE_DEMO;
    const app = buildFastifyApp({ siiModo: 'real' });
    const bloqueado = await app.inject({ method: 'GET', url: '/api/v1/dashboard/state' });
    expect(bloqueado.statusCode).toBe(403);
    await app.close();

    process.env.FELINE_DEMO = 'on';
    process.env.FELINE_SESSION_SECRET = 'secreto-de-sesion-de-pruebas';
    const app2 = buildFastifyApp({ siiModo: 'real' });
    const cookie = await iniciarSesion(app2, ADMIN);
    const permitido = await app2.inject({ method: 'GET', url: '/api/v1/dashboard/state', headers: { cookie } });
    expect(permitido.statusCode).toBe(200);
    await app2.close();
  });

  it('Crear empresas por API exige FELINE_ADMIN_TOKEN', async () => {
    const cuerpo = { rut: '76123456-0' };
    delete process.env.FELINE_ADMIN_TOKEN;
    const app = buildFastifyApp({ siiModo: 'simulado' });
    expect((await app.inject({ method: 'POST', url: '/api/v1/tenants', payload: cuerpo })).statusCode).toBe(503);
    await app.close();

    process.env.FELINE_ADMIN_TOKEN = 'token-secreto-de-prueba';
    const app2 = buildFastifyApp({ siiModo: 'simulado' });
    const sinToken = await app2.inject({ method: 'POST', url: '/api/v1/tenants', payload: cuerpo });
    expect(sinToken.statusCode).toBe(401);
    const malo = await app2.inject({
      method: 'POST', url: '/api/v1/tenants', payload: cuerpo, headers: { authorization: 'Bearer otro' },
    });
    expect(malo.statusCode).toBe(401);
    // Con token correcto pasa la autenticación y llega a la validación de datos (400)
    const bueno = await app2.inject({
      method: 'POST', url: '/api/v1/tenants', payload: cuerpo, headers: { authorization: 'Bearer token-secreto-de-prueba' },
    });
    expect(bueno.statusCode).toBe(400);
    await app2.close();
  });
});
