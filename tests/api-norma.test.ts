import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { buildFastifyApp } from '../src/server';
import { MODULOS_V1, SCOPES } from '../src/api/v1';
import { definirModulo, ContextoApi } from '../src/api/norma/modulo';
import { registrarModulos, rutaOpenApi, validarModulos } from '../src/api/norma/registro';

// Sin base de datos: solo rutas públicas y rechazos que ocurren antes de consultar la clave.
describe('Norma de módulos de la API REST', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildFastifyApp({ siiModo: 'simulado' });
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('El catálogo lista los módulos con sus permisos y rutas, sin clave', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/modulos' });
    expect(res.statusCode).toBe(200);
    const catalogo = res.json();
    expect(catalogo.version).toBe('v1');
    expect(catalogo.modulos.map((m: { id: string }) => m.id)).toEqual(['sistema', 'empresa', 'documentos', 'webhooks', 'plataforma']);

    const documentos = catalogo.modulos.find((m: { id: string }) => m.id === 'documentos');
    expect(documentos.permisos.map((p: { permiso: string }) => p.permiso)).toEqual(['documentos:emitir', 'documentos:leer']);
    expect(documentos.rutas).toContainEqual({ metodo: 'POST', ruta: '/v1/documentos', acceso: 'permiso', permiso: 'documentos:emitir' });
    expect(documentos.rutas).toContainEqual({ metodo: 'GET', ruta: '/v1/documentos/:id/pdf', acceso: 'permiso', permiso: 'documentos:leer' });
  });

  it('Se conservan las rutas que ya usa FUGAR', async () => {
    const rutas = (await app.inject({ method: 'GET', url: '/v1/modulos' }))
      .json()
      .modulos.flatMap((m: { rutas: Array<{ metodo: string; ruta: string }> }) => m.rutas.map((r) => `${r.metodo} ${r.ruta}`));
    for (const r of [
      'GET /v1/empresa',
      'POST /v1/documentos',
      'GET /v1/documentos',
      'GET /v1/documentos/:id',
      'GET /v1/documentos/:id/pdf',
      'GET /v1/documentos/:id/xml',
      'POST /v1/webhooks/prueba',
      'GET /v1/openapi.json',
    ]) {
      expect(rutas).toContain(r);
    }
  });

  it('Cada ruta del catálogo está en la especificación OpenAPI, etiquetada con su módulo', async () => {
    const catalogo = (await app.inject({ method: 'GET', url: '/v1/modulos' })).json();
    const spec = (await app.inject({ method: 'GET', url: '/v1/openapi.json' })).json();
    expect(spec.openapi).toBe('3.1.0');
    for (const m of catalogo.modulos) {
      for (const r of m.rutas) {
        const op = spec.paths[rutaOpenApi(r.ruta)]?.[r.metodo.toLowerCase()];
        expect(op, `${r.metodo} ${r.ruta}`).toBeDefined();
        expect(op.tags).toEqual([m.id]);
      }
    }
    expect(spec.components.schemas.Error.required).toEqual(['error', 'codigo', 'requestId']);
  });

  it('Los permisos asignables son los que declaran los módulos y tienen forma recurso:accion', () => {
    expect([...SCOPES]).toEqual(['empresa:leer', 'documentos:emitir', 'documentos:leer']);
    for (const s of SCOPES) expect(s).toMatch(/^[a-z-]+:[a-z-]+$/);
    expect(() => validarModulos(MODULOS_V1)).not.toThrow();
  });

  it('Sin clave: 401 con error, codigo y requestId igual a la cabecera x-request-id', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/documentos', payload: {} });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error).toMatch(/Authorization/);
    expect(body.codigo).toBe('NO_AUTENTICADO');
    expect(body.requestId).toBe(res.headers['x-request-id']);

    const yo = await app.inject({ method: 'GET', url: '/v1/yo', headers: { authorization: 'Basic abc' } });
    expect(yo.statusCode).toBe(401);
  });

  it('Una ruta inexistente bajo /v1 responde 404 con la forma de error de la norma', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/no-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ codigo: 'NO_ENCONTRADO', requestId: res.headers['x-request-id'] });
  });

  describe('El registro rechaza módulos que no cumplen la norma', () => {
    const ctx = {} as ContextoApi;
    const base = {
      nombre: 'Prueba',
      descripcion: 'Módulo de prueba',
      version: '1.0.0',
      permisos: { 'prueba:leer': 'Leer' },
      openapi: { paths: { '/v1/prueba': { get: {} } } },
    };
    const montar = async (modulo: ReturnType<typeof definirModulo>) => {
      const a = Fastify();
      registrarModulos(a, { version: 'v1', modulos: [modulo], ctx });
      try {
        await a.ready();
      } finally {
        await a.close();
      }
    };

    it('Ruta sin declarar su acceso', async () => {
      const m = definirModulo({ ...base, id: 'prueba', prefijo: '/prueba', registrar: (a) => void a.get('', async () => ({})) });
      await expect(montar(m)).rejects.toThrow(/exactamente uno de scope, soloClave, plataforma o publico/);
    });

    it('Ruta con un permiso que ningún módulo declara', async () => {
      const m = definirModulo({
        ...base,
        id: 'prueba',
        prefijo: '/prueba',
        registrar: (a) => void a.get('', { config: { scope: 'otro:leer' } }, async () => ({})),
      });
      await expect(montar(m)).rejects.toThrow(/ningún módulo declara/);
    });

    it('Ruta que no está en el OpenAPI del módulo', async () => {
      const m = definirModulo({
        ...base,
        id: 'prueba',
        prefijo: '/prueba',
        registrar: (a) => void a.get('/oculta', { config: { scope: 'prueba:leer' } }, async () => ({})),
      });
      await expect(montar(m)).rejects.toThrow(/no está documentada/);
    });

    it('Prefijo distinto del id y permiso mal formado', () => {
      const m = definirModulo({ ...base, id: 'prueba', prefijo: '/otra', permisos: { Leer: 'x' }, registrar: () => undefined });
      expect(() => validarModulos([m])).toThrow(/prefijo debe ser "\/prueba"[\s\S]*recurso:accion/);
    });

    it('Un módulo que cumple la norma se monta', async () => {
      const m = definirModulo({
        ...base,
        id: 'prueba',
        prefijo: '/prueba',
        registrar: (a) => void a.get('', { config: { scope: 'prueba:leer' } }, async () => ({})),
      });
      await expect(montar(m)).resolves.toBeUndefined();
    });
  });
});
