import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import { FinanceLedger, financeTransaction } from '../src/finance/ledger';
import { FinanceReceivables, listReceivables } from '../src/finance/receivables';
import { registerFinance } from '../src/finance/routes';
import { OdooAccountMoveService } from '../src/services/odoo-account-move.service';
import { hashClave } from '../src/auth/panel-auth';

const url = process.env.FINANCE_RECEIVABLES_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (u.hostname !== '127.0.0.1' || u.port !== '55439' || !u.pathname.endsWith('_receivables_test')) throw Error('La cartera solo se prueba en una base desechable *_receivables_test en localhost:55439.');
}
describe.skipIf(!url)('Cartera persistente y contabilidad en PostgreSQL', () => {
  let db: PrismaClient, ledger: FinanceLedger, service: FinanceReceivables, app: FastifyInstance;
  let tenant: string, other: string, actor: string, otherActor: string;
  const cookies: Record<string,string> = {}, cafs: Record<string,string> = {};
  let folio = 0, customerNumber = 100;
  const hash = hashClave('Pruebas-cartera-123');
  const customer = async (company = tenant) => {
    const n = ++customerNumber;
    return db.clienteReceptor.create({ data: { tenantId: company, rut: 'TEST-' + n, razonSocial: 'Cliente ficticio ' + n,
      giro: 'Pruebas', direccion: 'Dirección ficticia', comuna: 'Santiago', ciudad: 'Santiago' } });
  };
  async function document(customerId: string, total: number, type = 34, company = tenant, date = '2020-01-01', due: string | null = '2020-01-10') {
    const d = await db.documentoDTE.create({ data: { tenantId: company, receptorId: customerId, cafId: cafs[company + ':' + type], tipoDte: type,
      folio: ++folio, fechaEmision: new Date(date), fechaVenc: due ? new Date(due) : null, mntNeto: 0, mntExento: total, iva: 0, mntTotal: total, detallesJson: [], estado: 'ACEPTADO' } });
    const posted = await ledger.postDocument(company, company === tenant ? actor : otherActor, d.id);
    const ar = await db.financeReceivable.findUniqueOrThrow({ where: { documentId: d.id } });
    return { doc: d, ar, entry: posted.entry! };
  }
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } }); ledger = new FinanceLedger(db); service = new FinanceReceivables(db);
    expect(await db.tenant.count()).toBe(0);
    for (const [rut, name] of [['76123456-0','Pruebas A'],['76192083-9','Pruebas B']]) {
      const t = await db.tenant.create({ data: { rut, razonSocial: name, giro: 'Pruebas', acteco: [620200], direccionOrigen: 'Pruebas', comunaOrigen: 'Santiago', ciudadOrigen: 'Santiago', rutEnvia: '11111111-1', fchResol: new Date('2020-01-01'), nroResol: 0 } });
      if (!tenant) tenant = t.id; else other = t.id;
      for (const type of [34,61]) {
        cafs[t.id + ':' + type] = (await db.cafFolio.create({ data: { tenantId: t.id, tipoDte: type, folioDesde: 1, folioHasta: 10000, folioActual: 1, fechaAutorizacion: new Date('2020-01-01'), xmlCafNodo: 'FICTICIO', privateKeyEncrypted: 'FICTICIO', privateKeyIv: 'FICTICIO', privateKeyAuthTag: 'FICTICIO', publicKeyModulus: 'FICTICIO', publicKeyExponent: 'AQAB' } })).id;
      }
    }
    for (const role of ['OWNER','ACCOUNTANT','BILLING','VIEWER'] as const) {
      const u = await db.financeUser.create({ data: { email: role.toLowerCase() + '@cartera.example.test', name: role, passwordHash: hash,
        memberships: { create: { tenantId: tenant, role } } } });
      if (role === 'OWNER') actor = u.id;
    }
    otherActor = (await db.financeUser.create({ data: { email: 'otra@cartera.example.test', name: 'Otra empresa', passwordHash: hash, memberships: { create: { tenantId: other, role: 'OWNER' } } } })).id;
    for (const company of [tenant, other]) for (const month of ['2020-01','2020-02','2020-03']) await ledger.openPeriod(company, company === tenant ? actor : otherActor, month);
    app = Fastify(); registerFinance(app, db);
    for (const role of ['OWNER','ACCOUNTANT','BILLING','VIEWER']) {
      const login = await app.inject({ method: 'POST', url: '/api/v1/finance/login', payload: { email: role.toLowerCase() + '@cartera.example.test', password: 'Pruebas-cartera-123' } });
      expect(login.statusCode).toBe(200); cookies[role] = String(login.headers['set-cookie']).split(';')[0];
    }
  }, 30000);
  afterAll(async () => { await app?.close(); await db?.$disconnect(); });
  const headers = (role = 'OWNER', key = crypto.randomUUID()) => ({ cookie: cookies[role], 'x-tenant-id': tenant, 'idempotency-key': key });
  const receipt = (amount: string, date = '2020-01-15') => ({ amount, date, method: 'TRANSFERENCIA', reference: 'Referencia de pruebas' });

  it('El DTE centralizado crea una sola deuda o crédito sin duplicar clientes ni asientos', async () => {
    const c = await customer(); const d = await document(c.id, 100);
    expect(d.ar.amount.toFixed(0)).toBe('100'); expect(d.ar.sourceEntryId).toBe(d.entry.id);
    await ledger.postDocument(tenant, actor, d.doc.id);
    expect(await db.financeReceivable.count({ where: { documentId: d.doc.id } })).toBe(1);
    const n = await document(c.id, 30, 61); expect(n.ar.amount.toFixed(0)).toBe('-30');
    const rows = await listReceivables(db, tenant, { asOf: '2020-01-31', customerId: c.id });
    expect(rows.summary).toMatchObject({ net: '70', pending: '100', credits: '30' });
  });
  it('El abono y su asiento se registran una vez, con importes exactos y datos históricos conservados', async () => {
    const c = await customer(), d = await document(c.id, 100);
    const first = await service.receive(tenant, actor, d.ar.id, 'abono-1', receipt('60'));
    const replay = await service.receive(tenant, actor, d.ar.id, 'abono-1', receipt('60'));
    expect(replay).toMatchObject({ replay: true, receipt: { id: first.receipt.id } });
    expect((await service.detail(tenant, d.ar.id)).balance).toBe('40');
    const lines = await db.financeEntryLine.findMany({ where: { entryId: first.receipt.entryId } });
    expect(lines.map(l => l.debit.minus(l.credit).toFixed(0)).sort()).toEqual(['-60','60']);
    await expect(service.receive(tenant, actor, d.ar.id, 'abono-1', receipt('61'))).rejects.toThrow(/clave/);
    await expect(ledger.reverse(tenant, actor, first.receipt.entryId, 'atajo', '2020-01-16', 'Intento genérico')).rejects.toThrow(/cobro/);
  });
  it('Abonos concurrentes no sobrepagan ni pierden saldo; reintentos simultáneos comparten el mismo cobro', async () => {
    const c = await customer(), d = await document(c.id, 100);
    const attempts = await Promise.allSettled(['a','b'].map(k => service.receive(tenant, actor, d.ar.id, 'concurrente-' + k, receipt('70'))));
    expect(attempts.filter(a => a.status === 'fulfilled')).toHaveLength(1);
    expect((await service.detail(tenant, d.ar.id)).balance).toBe('30');
    const same = await Promise.all(Array.from({ length: 4 }, () => service.receive(tenant, actor, d.ar.id, 'concurrente-misma', receipt('25'))));
    expect(new Set(same.map(r => r.receipt.id)).size).toBe(1); expect(same.filter(r => !r.replay)).toHaveLength(1);
    expect((await service.detail(tenant, d.ar.id)).balance).toBe('5');
  });
  it('Aplicar y revertir notas de crédito no genera otro descuento en el libro contable', async () => {
    const c = await customer(), invoice = await document(c.id, 100), credit = await document(c.id, 30, 61);
    const before = await db.financeEntry.count({ where: { tenantId: tenant } });
    const allocation = await service.allocateCredit(tenant, actor, 'compensacion-1', { creditId: credit.ar.id, invoiceId: invoice.ar.id, amount: '30', date: '2020-01-12' });
    expect(await db.financeEntry.count({ where: { tenantId: tenant } })).toBe(before);
    expect((await service.detail(tenant, invoice.ar.id)).balance).toBe('70');
    expect((await service.detail(tenant, credit.ar.id)).balance).toBe('0');
    await expect(service.allocateCredit(tenant, actor, 'compensacion-exceso', { creditId: credit.ar.id, invoiceId: invoice.ar.id, amount: '1', date: '2020-01-12' })).rejects.toThrow(/supera/);
    const cash = await service.receive(tenant, actor, invoice.ar.id, 'compensacion-cobro', receipt('40','2020-01-15'));
    await service.reverseAllocation(tenant, actor, allocation.allocation.id, 'desaplicar-1', { date: '2020-01-16', reason: 'Corrige la aplicación' });
    expect((await service.detail(tenant, invoice.ar.id)).balance).toBe('60');
    expect((await service.detail(tenant, credit.ar.id)).balance).toBe('-30');
    expect((await listReceivables(db, tenant, { asOf: '2020-01-31', customerId: c.id })).summary.net).toBe('30');
    await service.reverseReceipt(tenant, actor, cash.receipt.id, 'anula-cobro-1', { date: '2020-02-01', reason: 'Registro de cobro incorrecto' });
    expect((await service.detail(tenant, invoice.ar.id)).balance).toBe('100');
    expect((await listReceivables(db, tenant, { asOf: '2020-01-31', customerId: c.id })).summary.net).toBe('30');
    expect((await listReceivables(db, tenant, { asOf: '2020-02-02', customerId: c.id })).summary.net).toBe('70');
  });
  it('La reversión del cobro es completa, idempotente y solo puede ocurrir una vez', async () => {
    const c = await customer(), d = await document(c.id, 80);
    const cash = await service.receive(tenant, actor, d.ar.id, 'reversion-base', receipt('80'));
    const input = { date: '2020-02-01', reason: 'Corrige registro duplicado' };
    const reversed = await service.reverseReceipt(tenant, actor, cash.receipt.id, 'reversion-base-1', input);
    expect((await service.reverseReceipt(tenant, actor, cash.receipt.id, 'reversion-base-1', input)).replay).toBe(true);
    await expect(service.reverseReceipt(tenant, actor, cash.receipt.id, 'otra-reversion', input)).rejects.toThrow(/ya fue/);
    expect((await service.detail(tenant, d.ar.id)).balance).toBe('80');
    expect((await db.financeEntry.findUniqueOrThrow({ where: { id: reversed.reversal.entryId } })).reversesId).toBe(cash.receipt.entryId);
  });
  it('Rechaza fechas inválidas, retrocesos en movimientos y períodos cerrados sin crear cobros', async () => {
    const c = await customer(), d = await document(c.id, 100);
    await expect(service.receive(tenant, actor, d.ar.id, 'fecha-invalida', receipt('10','2020-02-31'))).rejects.toThrow();
    await expect(service.receive(tenant, actor, d.ar.id, 'cero', receipt('0'))).rejects.toThrow(/cero/);
    await expect(service.receive(tenant, actor, d.ar.id, 'decimal', receipt('1.5'))).rejects.toThrow();
    await service.receive(tenant, actor, d.ar.id, 'posterior', receipt('10','2020-02-01'));
    await expect(service.receive(tenant, actor, d.ar.id, 'anterior', receipt('10','2020-01-31'))).rejects.toThrow(/último/);
    await expect(service.receive(tenant, actor, d.ar.id, 'sin-periodo', receipt('10','2020-04-01'))).rejects.toThrow(/período/);
    expect((await service.detail(tenant, d.ar.id)).balance).toBe('90');
  });
  it('La API aplica permisos de caja y separa empresas en cobros, créditos y clientes', async () => {
    const c = await customer(), d = await document(c.id, 100), foreign = await document((await customer(other)).id, 100, 34, other);
    const send = (role: string, id: string) => app.inject({ method: 'POST', url: '/api/v1/finance/receivables/' + id + '/receipts', headers: headers(role), payload: receipt('10') });
    expect((await send('VIEWER', d.ar.id)).statusCode).toBe(403);
    expect((await send('OWNER', foreign.ar.id)).statusCode).toBe(404);
    const collected = await send('BILLING', d.ar.id); expect(collected.statusCode, collected.body).toBe(201);
    const denied = await app.inject({ method: 'POST', url: '/api/v1/finance/receipts/' + collected.json().receipt.id + '/reverse', headers: headers('BILLING'), payload: { date: '2020-01-16', reason: 'No autorizado' } });
    expect(denied.statusCode).toBe(403);
    const allowed = await app.inject({ method: 'POST', url: '/api/v1/finance/receipts/' + collected.json().receipt.id + '/reverse', headers: headers('ACCOUNTANT'), payload: { date: '2020-01-16', reason: 'Aprobado por contador' } });
    expect(allowed.statusCode, allowed.body).toBe(201);
    expect((await app.inject({ url: '/api/v1/finance/receivables/' + foreign.ar.id, headers: headers() })).statusCode).toBe(404);
  });
  it('No aplica créditos entre clientes y rechaza aplicación superior a la deuda', async () => {
    const a = await customer(), b = await customer(), invoice = await document(a.id, 20), wrong = await document(b.id, 30, 61), credit = await document(a.id, 30, 61);
    await expect(service.allocateCredit(tenant, actor, 'cliente-ajeno', { creditId: wrong.ar.id, invoiceId: invoice.ar.id, amount: '10', date: '2020-01-15' })).rejects.toThrow(/mismo cliente/);
    await expect(service.allocateCredit(tenant, actor, 'credito-exceso', { creditId: credit.ar.id, invoiceId: invoice.ar.id, amount: '21', date: '2020-01-15' })).rejects.toThrow(/supera/);
    await expect(db.financeCreditAllocation.create({ data: { tenantId: tenant, creditId: credit.ar.id, invoiceId: invoice.ar.id, amount: 21, date: new Date('2020-01-15'), idempotencyKey: 'sql-exceso', requestHash: 'prueba', createdBy: actor } })).rejects.toThrow(/saldo disponible/);
  });
  it('La base conserva cobros, saldos y aplicaciones inmutables y rechaza asientos huérfanos', async () => {
    const c = await customer(), d = await document(c.id, 10);
    const cash = await service.receive(tenant, actor, d.ar.id, 'inmutable', receipt('5'));
    await expect(db.financeReceipt.update({ where: { id: cash.receipt.id }, data: { amount: 2 } })).rejects.toThrow(/inmutable/);
    await expect(db.financeReceivable.delete({ where: { id: d.ar.id } })).rejects.toThrow(/inmutable/);
    const count = await db.financeEntry.count();
    await expect(financeTransaction(db, tx => ledger.recordOperation(tx, tenant, actor, crypto.randomUUID(), { date: '2020-01-15', description: 'Operación huérfana de prueba', lines: [{ accountCode: '110110', debit: '1', credit: '0' }, { accountCode: '110310', debit: '0', credit: '1' }] }))).rejects.toThrow(/operación de cartera/);
    expect(await db.financeEntry.count()).toBe(count);
  });
  it('Informa antigüedad y vencimientos sin asumir una fecha donde no existe', async () => {
    const c = await customer(); await document(c.id, 100, 34, tenant, '2020-01-01','2020-01-10'); await document(c.id, 50, 34, tenant, '2020-01-01',null);
    const report = await listReceivables(db, tenant, { asOf: '2020-02-10', customerId: c.id });
    expect(report.summary).toMatchObject({ pending: '150', overdue60: '100', overdue30: '0', withoutDueDate: '50' });
    expect((await listReceivables(db, tenant, { asOf: '2019-12-31', customerId: c.id })).summary.net).toBe('0');
  });
  it('Pagos del módulo anterior se señalan para revisión y no se cobran otra vez silenciosamente', async () => {
    const c = await customer(), d = await document(c.id, 100);
    await db.l10nLatamDocumentType.upsert({ where: { code: 34 }, update: {}, create: { code: 34, name: 'Exenta', reportName: 'Exenta', internalType: 'invoice', docCodePrefix: 'EXE' } });
    const journal = await db.accountJournal.create({ data: { tenantId: tenant, code: 'LEGA', name: 'Prueba anterior', type: 'BANK' } });
    const move = await db.accountMove.create({ data: { tenantId: tenant, partnerId: c.id, journalId: journal.id, documentTypeCode: 34, name: 'Prueba anterior', invoiceDate: new Date('2020-01-01'), amountTotal: 100, amountResidual: 50, state: 'POSTED', documentoDteId: d.doc.id } });
    await db.accountPayment.create({ data: { tenantId: tenant, moveId: move.id, partnerId: c.id, journalId: journal.id, amount: 50, paymentDate: new Date('2020-01-10') } });
    await expect(service.receive(tenant, actor, d.ar.id, 'duplicado-antiguo', receipt('50'))).rejects.toThrow(/pagos anteriores/);
    await expect(new OdooAccountMoveService(db, {} as never).registerPayment({ tenantId: tenant, moveId: move.id, journalId: journal.id, amount: 10, paymentDate: '2020-01-15' })).rejects.toThrow(/cartera persistente/);
    const list = await listReceivables(db, tenant, { asOf: '2020-01-31', customerId: c.id });
    expect(list.summary.reviewCount).toBe(1); expect(list.items[0].legacyPayments).toBe(true);
  });
  it('Clientes reutiliza el maestro existente, normaliza RUT y no permite cambiarlo por la edición', async () => {
    const payload = { rut: '77.777.777-7', razonSocial: 'Cliente API ficticio', giro: 'Pruebas', direccion: 'Pruebas 123', comuna: 'Santiago', ciudad: 'Santiago', taxpayerType: 'VAT_AFFECTED_1ST_CAT' };
    const created = await app.inject({ method: 'POST', url: '/api/v1/finance/customers', headers: headers('BILLING'), payload });
    expect(created.statusCode, created.body).toBe(201); expect(created.json().rut).toBe('77777777-7');
    expect((await app.inject({ method: 'POST', url: '/api/v1/finance/customers', headers: headers(), payload })).statusCode).toBe(409);
    const { rut, ...update } = payload;
    expect((await app.inject({ method: 'PUT', url: '/api/v1/finance/customers/' + created.json().id, headers: headers(), payload: { ...update, razonSocial: 'Nombre actualizado' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url: '/api/v1/finance/customers/' + created.json().id, headers: headers(), payload })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/finance/customers', headers: headers('VIEWER'), payload })).statusCode).toBe(403);
    const list = await app.inject({ url: '/api/v1/finance/customers?search=77777777', headers: headers() });
    expect(list.json().items.map((v: any) => v.id)).toEqual([created.json().id]);
    expect(await db.financeAuditEvent.count({ where: { tenantId: tenant, action: 'customer.update', entityId: created.json().id } })).toBe(1);
  });
  it('La cartera concilia con Clientes del libro y muestra diferencias de asientos manuales', async () => {
    const report = await listReceivables(db, tenant, { asOf: '2020-02-28' });
    expect(report.reconciliation?.difference).toBe('0');
    const manual = await ledger.post(tenant, actor, 'saldo-manual-no-asociado', { date: '2020-02-20', description: 'Saldo de apertura sin documento', lines: [{ accountCode: '110310', debit: '3', credit: '0' }, { accountCode: '310110', debit: '0', credit: '3' }] });
    expect((await listReceivables(db, tenant, { asOf: '2020-02-28' })).reconciliation?.difference).toBe('3');
    await ledger.reverse(tenant, actor, manual.entry.id, 'revierte-manual-no-asociado', '2020-02-21', 'Corrige prueba de apertura');
    expect((await listReceivables(db, tenant, { asOf: '2020-02-28' })).reconciliation?.difference).toBe('0');
  });
  it('La búsqueda trata caracteres especiales como texto y pagina sin repetir documentos', async () => {
    const c = await customer();
    for (let i = 0; i < 53; i++) await document(c.id, 1);
    const first = await listReceivables(db, tenant, { asOf: '2020-01-31', customerId: c.id });
    expect(first.items).toHaveLength(50); expect(first.nextCursor).toBeTruthy();
    const next = await listReceivables(db, tenant, { asOf: '2020-01-31', customerId: c.id, cursor: first.nextCursor });
    expect(next.items).toHaveLength(3); expect(new Set([...first.items,...next.items].map(r => r.id)).size).toBe(53);
    expect((await listReceivables(db, tenant, { asOf: '2020-01-31', search: "%' OR 1=1 --" })).items).toHaveLength(0);
    expect((await listReceivables(db, other, { asOf: '2020-01-31', customerId: c.id })).items).toHaveLength(0);
  }, 30000);
});
