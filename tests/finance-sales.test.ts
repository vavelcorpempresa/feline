import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { buildFastifyApp } from '../src/server';
import { prismaBase } from '../src/core/tenant-context';
import { ADMIN, iniciarSesion } from './ayudas-panel';

const tenant = '58f11c36-4e29-4e62-b093-eb2ae18458ca';
const other = '97fc96e3-0b60-4fd6-8384-39727d2e9691';
const document = '82e3cc54-bc23-412a-a1da-5681ce4c6e48';
const headers = { cookie: 'feline_finance=' + 'a'.repeat(64), 'x-tenant-id': tenant };
const session = {
  id: 'session', userId: 'user', expiresAt: new Date(Date.now() + 60000),
  user: { active: true, name: 'Lectura', memberships: [
    { tenantId: tenant, role: 'VIEWER', tenant: { isActive: true, razonSocial: 'Empresa de prueba' } },
  ] },
};

afterEach(() => vi.restoreAllMocks());

describe('Ventas persistentes', () => {
  it('rechaza una sesión demo antes de buscar empresas o documentos', async () => {
    const app = buildFastifyApp({ siiModo: 'simulado' });
    const lookup = vi.spyOn(prismaBase.tenant, 'findMany');
    try {
      const cookie = await iniciarSesion(app, ADMIN);
      const res = await app.inject({ url: '/api/v1/finance/sales/documents', headers: { ...headers, cookie } });
      expect(res.statusCode).toBe(401);
      expect(lookup).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('comprueba membresía antes de listar o descargar', async () => {
    const app = buildFastifyApp({ siiModo: 'simulado' });
    vi.spyOn(prismaBase.financeSession, 'findUnique').mockResolvedValue(session as never);
    const list = vi.spyOn(prismaBase.documentoDTE, 'findMany');
    const get = vi.spyOn(prismaBase.documentoDTE, 'findFirst').mockResolvedValue(null);
    try {
      const wrong = { ...headers, 'x-tenant-id': other };
      expect((await app.inject({ url: '/api/v1/finance/sales/documents', headers: wrong })).statusCode).toBe(403);
      expect((await app.inject({ url: '/api/v1/finance/sales/documents/'+document+'/xml', headers: wrong })).statusCode).toBe(403);
      expect(list).not.toHaveBeenCalled();
      expect(get).not.toHaveBeenCalled();
      expect((await app.inject({ url: '/api/v1/finance/sales/documents/'+document+'/xml', headers })).statusCode).toBe(404);
      expect(get).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: document, tenantId: tenant }) }));
    } finally { await app.close(); }
  });

  it('separa el estado SII del saldo y limita la búsqueda al tenant autorizado', async () => {
    const app = buildFastifyApp({ siiModo: 'simulado' });
    vi.spyOn(prismaBase.financeSession, 'findUnique').mockResolvedValue(session as never);
    const list = vi.spyOn(prismaBase.documentoDTE, 'findMany').mockResolvedValue([
      { id: document, estado: 'ACEPTADO', receptor: { tenantId: tenant, rut: 'test', razonSocial: 'Prueba' }, accountMove: null, receivables: [] },
      { id: other, estado: 'ACEPTADO', receptor: { tenantId: other }, accountMove: null,
        receivables: [{ amount: new Prisma.Decimal(100), document: {}, invoiceAllocations: [], creditAllocations: [],
          receipts: [{ amount: new Prisma.Decimal(40), date: new Date('2020-01-01'), reversals: [] }] }] },
    ] as never);
    try {
      const res = await app.inject({ url: '/api/v1/finance/sales/documents?kind=invoice&folio=7', headers });
      expect(res.statusCode).toBe(200);
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: tenant, folio: 7, tipoDte: { in: [33,34,110] } }) }));
      expect(res.json().items).toMatchObject([
        { estado: 'ACEPTADO', paymentStatus: 'Sin saldo verificado', balance: null },
        { estado: 'ACEPTADO', paymentStatus: 'Parcial', balance: '60', customer: null },
      ]);
      expect((await app.inject({ url: '/api/v1/finance/sales/documents?from=2026-10-01&to=2026-09-01', headers })).statusCode).toBe(400);
    } finally { await app.close(); }
  });

  it('compila la interfaz con las entradas del menú de Ventas', async () => {
    const app = buildFastifyApp({ siiModo: 'simulado' });
    try {
      const res = await app.inject({ url: '/finanzas' });
      expect(res.statusCode).toBe(200);
      for (const page of ['sales-summary', 'sales-invoices', 'sales-receipts', 'sales-documents', 'receivables']) {
        expect(res.body).toContain(page);
      }
    } finally { await app.close(); }
  });
});
