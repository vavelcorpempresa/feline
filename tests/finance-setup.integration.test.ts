import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { registerFinance } from '../src/finance/routes';

const url = process.env.FINANCE_SETUP_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (u.hostname !== '127.0.0.1' || u.port !== '55439' || !u.pathname.endsWith('_setup_test')) throw Error('La instalación inicial solo se prueba en una base local desechable *_setup_test, puerto 55439.');
}
describe.skipIf(!url)('Configuración inicial local en base vacía', () => {
  let db: PrismaClient, app: FastifyInstance, sessionCookie: string;
  const previous = { ...process.env };
  const input = {
    name: 'Administrador de pruebas', email: 'Inicial@EXAMPLE.TEST', password: 'Clave-de-pruebas-123', passwordConfirm: 'Clave-de-pruebas-123',
    company: { rut: '76123456-0', razonSocial: 'EMPRESA FICTICIA DE PRUEBAS', giro: 'Pruebas de software', direccion: 'Dirección de pruebas 1', comuna: 'Santiago', ciudad: 'Santiago', acteco: [620200], rutEnvia: '11111111-1', fchResol: '2026-11-03' },
  };
  beforeAll(async () => {
    process.env.NODE_ENV = 'test'; process.env.FELINE_FINANCE_SETUP = 'local'; delete process.env.FELINE_PUBLIC_URL;
    db = new PrismaClient({ datasources: { db: { url } } });
    expect(await db.tenant.count()).toBe(0); expect(await db.financeUser.count()).toBe(0);
    app = Fastify(); registerFinance(app, db);
  });
  afterAll(async () => { await app?.close(); await db?.$disconnect(); process.env = previous; });
  it('Solo ofrece registro desde localhost y con habilitación explícita', async () => {
    expect((await app.inject({ url: '/api/v1/finance/setup-state' })).json()).toEqual({ available: true });
    expect((await app.inject({ url: '/api/v1/finance/setup-state', remoteAddress: '203.0.113.1' })).json()).toEqual({ available: false });
    expect((await app.inject({ method: 'POST', url: '/api/v1/finance/setup', remoteAddress: '203.0.113.1', payload: input })).statusCode).toBe(404);
    expect((await app.inject({ url: '/api/v1/finance/setup-state', headers: { host: 'externo.example' } })).json()).toEqual({ available: false });
    expect((await app.inject({ url: '/api/v1/finance/setup-state', headers: { 'x-forwarded-for': '203.0.113.1' } })).json()).toEqual({ available: false });
    process.env.FELINE_FINANCE_SETUP = '';
    expect((await app.inject({ url: '/api/v1/finance/setup-state' })).json()).toEqual({ available: false });
    process.env.FELINE_FINANCE_SETUP = 'local';
  });
  it('Rechaza contraseñas discordantes, RUT inválido y origen cruzado sin crear datos', async () => {
    const send = (payload: unknown) => app.inject({ method: 'POST', url: '/api/v1/finance/setup', payload: payload as any });
    expect((await send({ ...input, passwordConfirm: 'Otra-clave-de-pruebas-123' })).statusCode).toBe(400);
    expect((await send({ ...input, company: { ...input.company, rut: '76123456-1' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/finance/setup', headers: { origin: 'https://externo.example' }, payload: input })).statusCode).toBe(403);
    expect(await db.tenant.count()).toBe(0); expect(await db.financeUser.count()).toBe(0);
  });
  it('Dos registros simultáneos crean una sola empresa, administrador y sesión', async () => {
    const replies = await Promise.all([1, 2].map(() => app.inject({ method: 'POST', url: '/api/v1/finance/setup', payload: input })));
    expect(replies.map(r => r.statusCode).sort()).toEqual([201, 409]);
    const created = replies.find(r => r.statusCode === 201)!;
    expect(created.body).not.toMatch(/password|scrypt|tokenHash/);
    sessionCookie = String(created.headers['set-cookie']).split(';')[0];
    expect(created.headers['set-cookie']).toMatch(/HttpOnly/);
    expect(await db.tenant.count()).toBe(1); expect(await db.financeUser.count()).toBe(1); expect(await db.financeSession.count()).toBe(1);
    const user = await db.financeUser.findFirstOrThrow();
    expect(user.email).toBe('inicial@example.test'); expect(user.passwordHash).not.toContain(input.password);
    expect(await db.financeMembership.count({ where: { userId: user.id, role: 'OWNER' } })).toBe(1);
    const company = await db.tenant.findFirstOrThrow(); expect(company.environment).toBe('CERTIFICACION'); expect(company.nroResol).toBe(0);
    expect(await db.financePeriod.count({ where: { tenantId: company.id, closedAt: null } })).toBe(1);
  });
  it('La sesión inicial accede a su empresa y el registro queda clausurado', async () => {
    const session = await app.inject({ url: '/api/v1/finance/session', headers: { cookie: sessionCookie } });
    expect(session.statusCode).toBe(200); expect(session.json().memberships).toHaveLength(1);
    expect((await app.inject({ url: '/api/v1/finance/setup-state' })).json()).toEqual({ available: false });
    expect((await app.inject({ method: 'POST', url: '/api/v1/finance/setup', payload: input })).statusCode).toBe(409);
  });
  it('Producción no permite habilitar la instalación inicial local', async () => {
    process.env.NODE_ENV = 'production';
    try {
      expect((await app.inject({ url: '/api/v1/finance/setup-state' })).json()).toEqual({ available: false });
      expect((await app.inject({ method: 'POST', url: '/api/v1/finance/setup', payload: input })).statusCode).toBe(404);
    } finally { process.env.NODE_ENV = 'test'; }
  });
});
