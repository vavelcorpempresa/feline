import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registrarModulos } from '../src/api/norma/registro';
import { ContextoApi } from '../src/api/norma/modulo';
import { hashApiKey } from '../src/api/norma/claves';
import { moduloPlataforma } from '../src/api/v1/modulos/plataforma.modulo';
import { MODULOS_NEGOCIO_V1 } from '../src/api/v1/permisos';

// Alta de sistemas por API con una base simulada en memoria (sin PostgreSQL).
describe('Módulo plataforma: conectar empresas y sistemas por API', () => {
  const TOKEN = 'token-de-plataforma-de-prueba';
  let app: FastifyInstance;
  let proyectosCreados: any[];
  const tokenAnterior = process.env.FELINE_ADMIN_TOKEN;

  beforeEach(async () => {
    process.env.FELINE_ADMIN_TOKEN = TOKEN;
    proyectosCreados = [];
    const prisma = {
      tenant: {
        findUnique: async ({ where }: any) => (where.rut === '76192083-9' ? { id: 't1', rut: where.rut } : null),
      },
      apiClient: {
        create: async ({ data }: any) => {
          proyectosCreados.push(data);
          return { id: '6f1c3c1e-0000-4000-8000-000000000001', ...data };
        },
      },
    };
    app = Fastify();
    registrarModulos(app, {
      version: 'v1',
      modulos: [...MODULOS_NEGOCIO_V1, moduloPlataforma],
      ctx: { prisma, publicBaseUrl: 'https://feline.test' } as unknown as ContextoApi,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    if (tokenAnterior === undefined) delete process.env.FELINE_ADMIN_TOKEN;
    else process.env.FELINE_ADMIN_TOKEN = tokenAnterior;
  });

  const conToken = (t = TOKEN) => ({ authorization: `Bearer ${t}` });

  it('Sin FELINE_ADMIN_TOKEN configurado la plataforma queda deshabilitada (503)', async () => {
    delete process.env.FELINE_ADMIN_TOKEN;
    const res = await app.inject({ method: 'GET', url: '/v1/plataforma/empresas', headers: conToken() });
    expect(res.statusCode).toBe(503);
    expect(res.json().codigo).toBe('NO_DISPONIBLE');
  });

  it('Token ausente o distinto: 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/v1/plataforma/empresas' })).statusCode).toBe(401);
    const res = await app.inject({ method: 'GET', url: '/v1/plataforma/empresas', headers: conToken('otro') });
    expect(res.statusCode).toBe(401);
    expect(res.json().codigo).toBe('NO_AUTENTICADO');
  });

  it('Conectar un sistema devuelve su clave una vez y las variables listas para su .env', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/plataforma/empresas/76192083-9/proyectos',
      headers: conToken(),
      payload: { nombre: 'FUGAR Marketplace', webhookUrl: 'https://fugar.cl/api/v1/billing/webhook' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.variables.FELINE_API_URL).toBe('https://feline.test');
    expect(body.variables.FELINE_API_KEY).toMatch(/^flk_/);
    expect(body.variables.FELINE_WEBHOOK_SECRET).toMatch(/^[a-f0-9]{64}$/);
    expect(body.permisos).toEqual(['empresa:leer', 'documentos:emitir', 'documentos:leer']);

    // En la base solo queda el hash de la clave
    const guardado = proyectosCreados[0];
    expect(guardado.keyHash).toBe(hashApiKey(body.variables.FELINE_API_KEY));
    expect(JSON.stringify(guardado)).not.toContain(body.variables.FELINE_API_KEY);
  });

  it('Permisos acotados: solo los pedidos; uno inexistente se rechaza con 422', async () => {
    const ok = await app.inject({
      method: 'POST',
      url: '/v1/plataforma/empresas/76192083-9/proyectos',
      headers: conToken(),
      payload: { nombre: 'Consulta', permisos: ['documentos:leer'] },
    });
    expect(ok.json().permisos).toEqual(['documentos:leer']);

    const mal = await app.inject({
      method: 'POST',
      url: '/v1/plataforma/empresas/76192083-9/proyectos',
      headers: conToken(),
      payload: { nombre: 'Otro', permisos: ['todo:hacer'] },
    });
    expect(mal.statusCode).toBe(422);
    expect(mal.json().codigo).toBe('REGLA_DE_NEGOCIO');
  });

  it('Empresa inexistente: 404; datos inválidos: 400 sin tocar la base', async () => {
    const noExiste = await app.inject({
      method: 'POST',
      url: '/v1/plataforma/empresas/11111111-1/proyectos',
      headers: conToken(),
      payload: { nombre: 'X1' },
    });
    expect(noExiste.statusCode).toBe(404);

    const invalido = await app.inject({
      method: 'POST',
      url: '/v1/plataforma/empresas',
      headers: conToken(),
      payload: { rut: '76192083-9' },
    });
    expect(invalido.statusCode).toBe(400);
    expect(invalido.json().codigo).toBe('SOLICITUD_INVALIDA');

    const idMalo = await app.inject({ method: 'POST', url: '/v1/plataforma/proyectos/abc/revocar', headers: conToken() });
    expect(idMalo.statusCode).toBe(400);
    expect(proyectosCreados).toHaveLength(0);
  });
});
