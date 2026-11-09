import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { hashClave } from '../src/auth/panel-auth';
import { FinanceLedger } from '../src/finance/ledger';
import { FinanceCentralizer } from '../src/finance/centralizer';
import { OdooAccountMoveService } from '../src/services/odoo-account-move.service';
import { renderFinancePanel } from '../src/ui/finance-panel';
import vm from 'node:vm';

const url = process.env.FINANCE_TEST_DATABASE_URL;
// No truncar ni ejecutar accidentalmente sobre una base de trabajo.
if (url) {
  const u = new URL(url);
  if (!['127.0.0.1', 'localhost'].includes(u.hostname) || !u.pathname.endsWith('_test') || u.port !== '55439') throw Error('La suite financiera exige la base local desechable en puerto 55439 y nombre terminado en _test.');
}
describe.skipIf(!url)('Núcleo financiero en PostgreSQL desechable', () => {
  let db: PrismaClient, ledger: FinanceLedger, app: FastifyInstance;
  let tenantId: string, otherId: string, actorId: string, cookie: string, viewerCookie: string;
  const suffix = crypto.randomBytes(4).toString('hex');
  const input = { date: '2026-11-03', description: 'Aporte de capital', lines: [
    { accountCode: '110110', debit: '9007199254740993', credit: '0' },
    { accountCode: '310110', debit: '0', credit: '9007199254740993' },
  ] };
  const headers = () => ({ cookie, 'x-tenant-id': tenantId });
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.FELINE_SII_MODO = 'simulado';
    process.env.FELINE_DISPATCHER = 'off';
    db = new PrismaClient(); ledger = new FinanceLedger(db);
    const makeTenant = (rut: string) => db.tenant.create({ data: { rut, razonSocial: 'Prueba ERP', giro: 'Pruebas', acteco: [1], direccionOrigen: 'Pruebas', comunaOrigen: 'Santiago', ciudadOrigen: 'Santiago', fchResol: new Date('2026-01-01'), nroResol: 0, rutEnvia: '11111111-1' } });
    tenantId = (await makeTenant(suffix + '-1')).id;
    otherId = (await makeTenant(suffix + '-2')).id;
    const createUser = (role: 'OWNER' | 'VIEWER') => db.financeUser.create({ data: { email: role.toLowerCase() + suffix + '@example.test', name: role, passwordHash: hashClave('Pruebas-seguras-123'), memberships: { create: { tenantId, role } } } });
    actorId = (await createUser('OWNER')).id; await createUser('VIEWER');
    const { buildFastifyApp } = await import('../src/server');
    app = buildFastifyApp({ siiModo: 'simulado' });
    async function login(role: string) { const r = await app.inject({ method: 'POST', url: '/api/v1/finance/login', payload: { email: role.toLowerCase() + suffix + '@example.test', password: 'Pruebas-seguras-123' } }); expect(r.statusCode, r.body).toBe(200); return String(r.headers['set-cookie']).split(';')[0]; }
    cookie = await login('OWNER'); viewerCookie = await login('VIEWER');
    await ledger.openPeriod(tenantId, actorId, '2026-11');
  }, 30000);
  afterAll(async () => { await app?.close(); await db?.$disconnect(); });

  it('Exige sesión, pertenencia y permiso para publicar', async () => {
    expect((await app.inject({ url: '/api/v1/finance/periods' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/v1/finance/periods', headers: { cookie, 'x-tenant-id': otherId } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/v1/finance/entries', headers: { cookie: viewerCookie, 'x-tenant-id': tenantId }, payload: input })).statusCode).toBe(403);
  });
  it('Rechaza origen cruzado y formularios sin JSON', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/v1/finance/periods', headers: { ...headers(), origin: 'https://evil.example' }, payload: { month: '2026-11' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/v1/finance/logout', headers: { ...headers(), 'content-type': 'text/plain' }, payload: '{}' })).statusCode).toBe(415);
    expect((await app.inject({ method: 'POST', url: '/api/v1/finance/entries', headers: { ...headers(), 'content-type': 'application/json' }, payload: '{' })).statusCode).toBe(400);
  });
  it('Valida calendario, cuentas, precisión, equilibrio y período', async () => {
    await expect(ledger.post(tenantId, actorId, 'bad-date', { ...input, date: '2026-02-31' })).rejects.toThrow();
    await expect(ledger.post(tenantId, actorId, 'bad-account', { ...input, lines: input.lines.map(l => ({ ...l, accountCode: 'NO' })) })).rejects.toThrow(/Cuenta/);
    await expect(ledger.post(tenantId, actorId, 'bad-number', { ...input, lines: [{ ...input.lines[0], debit: '1.5' }, input.lines[1]] })).rejects.toThrow();
    await expect(ledger.post(tenantId, actorId, 'bad-balance', { ...input, lines: [{ ...input.lines[0], debit: '1' }, input.lines[1]] })).rejects.toThrow(/cuadra/);
    await expect(ledger.post(tenantId, actorId, 'bad-period', { ...input, date: '2026-12-01' })).rejects.toThrow(/período/);
  });
  it('Publica concurrentemente una sola vez y conserva importes superiores a Number.MAX_SAFE_INTEGER', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => ledger.post(tenantId, actorId, 'concurrent-entry', input)));
    expect(new Set(results.map(r => r.entry.id)).size).toBe(1);
    expect(results.filter(r => !r.replay)).toHaveLength(1);
    const report = await ledger.report(tenantId, '2026-11');
    expect(report).toMatchObject({ debit: '9007199254740993', credit: '9007199254740993', balanced: true });
    await expect(ledger.post(tenantId, actorId, 'concurrent-entry', { ...input, description: 'Otro concepto' })).rejects.toThrow(/clave/);
  });
  it('La API exige idempotencia y devuelve importes como cadenas', async () => {
    const bad = await app.inject({ method: 'POST', url: '/api/v1/finance/entries', headers: headers(), payload: input }); expect(bad.statusCode).toBe(400);
    const report = await app.inject({ url: '/api/v1/finance/report?month=2026-11', headers: headers() });
    expect(report.json().debit).toBe('9007199254740993');
  });
  it('Revierte con trazabilidad y evita doble reversión', async () => {
    const original = await db.financeEntry.findUniqueOrThrow({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: 'concurrent-entry' } } });
    const reverse = await ledger.reverse(tenantId, actorId, original.id, 'reverse-1', '2026-11-03', 'Corrige aporte');
    expect(reverse.entry.reversesId).toBe(original.id);
    expect((await ledger.reverse(tenantId, actorId, original.id, 'reverse-1', '2026-11-03', 'Corrige aporte')).replay).toBe(true);
    await expect(ledger.reverse(tenantId, actorId, original.id, 'reverse-2', '2026-11-03', 'Otro intento')).rejects.toThrow(/revertido/);
    expect((await ledger.report(tenantId, '2026-11')).accounts.every(a => a.balance === '0')).toBe(true);
  });
  it('La base impide modificar asientos, líneas y auditoría o insertar asientos sin líneas', async () => {
    const entry = await db.financeEntry.findFirstOrThrow({ where: { tenantId } });
    await expect(db.financeEntry.update({ where: { id: entry.id }, data: { description: 'Manipulación' } })).rejects.toThrow(/inmutable/);
    const line = await db.financeEntryLine.findFirstOrThrow({ where: { entryId: entry.id } });
    await expect(db.financeEntryLine.delete({ where: { id: line.id } })).rejects.toThrow(/inmutable/);
    const event = await db.financeAuditEvent.findFirstOrThrow({ where: { tenantId } });
    await expect(db.financeAuditEvent.delete({ where: { id: event.id } })).rejects.toThrow(/inmutable/);
    await expect(db.financeEntry.create({ data: { tenantId, periodId: entry.periodId, date: new Date('2026-11-03'), description: 'Sin líneas', idempotencyKey: 'orphan', requestHash: 'x', createdBy: actorId } })).rejects.toThrow(/equilibrado/);
  });
  it('El cierre excluye publicaciones posteriores, incluso en carrera con otra transacción', async () => {
    await Promise.allSettled([ledger.closePeriod(tenantId, actorId, '2026-11'), ledger.post(tenantId, actorId, 'race-close', input)]);
    await expect(ledger.post(tenantId, actorId, 'after-close', input)).rejects.toThrow(/cerrado/);
    expect(await db.financeAuditEvent.count({ where: { tenantId, action: 'period.close' } })).toBe(1);
  });
  it('Los pagos concurrentes no pierden abonos ni crean diarios de otra empresa', async () => {
    const partner = await db.clienteReceptor.create({ data: { tenantId, rut: '11111111-1', razonSocial: 'Cliente prueba', giro: 'Pruebas', direccion: 'Pruebas', comuna: 'Santiago', ciudad: 'Santiago' } });
    await db.l10nLatamDocumentType.upsert({ where: { code: 33 }, update: {}, create: { code: 33, name: 'Factura', reportName: 'Factura', internalType: 'invoice', docCodePrefix: 'FAC' } });
    const journal = await db.accountJournal.create({ data: { tenantId, code: 'BNKT', name: 'Banco pruebas', type: 'BANK' } });
    const foreign = await db.accountJournal.create({ data: { tenantId: otherId, code: 'BNKT', name: 'Banco otra empresa', type: 'BANK' } });
    const move = await db.accountMove.create({ data: { tenantId, journalId: journal.id, partnerId: partner.id, documentTypeCode: 33, name: 'FAC prueba', state: 'POSTED', invoiceDate: new Date(), amountTotal: 100, amountResidual: 100 } });
    const service = new OdooAccountMoveService(db, {} as never);
    const params = { tenantId, moveId: move.id, journalId: journal.id, amount: 60, paymentDate: '2026-11-03' };
    await expect(service.registerPayment({ ...params, journalId: foreign.id })).rejects.toThrow(/misma empresa/);
    const results = await Promise.allSettled([service.registerPayment(params), service.registerPayment(params)]);
    expect(results.some(r => r.status === 'fulfilled')).toBe(true);
    const payments = await db.accountPayment.aggregate({ where: { moveId: move.id }, _sum: { amount: true } });
    const updated = await db.accountMove.findUniqueOrThrow({ where: { id: move.id } });
    expect((payments._sum.amount ?? 0) + updated.amountResidual).toBe(100);
  });
  it('No permite agregar nuevas líneas equilibradas a un asiento publicado', async () => {
    const entry = await db.financeEntry.findFirstOrThrow({ where: { tenantId } });
    await expect(db.financeEntryLine.createMany({ data: [
      { entryId: entry.id, accountCode: '110110', debit: '1', credit: '0' },
      { entryId: entry.id, accountCode: '310110', debit: '0', credit: '1' },
    ] })).rejects.toThrow(/agregar líneas/);
  });

  it('Centraliza ventas y notas de crédito aceptadas una sola vez, sin modificar el DTE', async () => {
    await ledger.openPeriod(tenantId, actorId, '2026-10');
    const partner = await db.clienteReceptor.findFirstOrThrow({ where: { tenantId } });
    const caf = await db.cafFolio.create({ data: { tenantId, tipoDte: 33, folioDesde: 1, folioHasta: 100, folioActual: 1, fechaAutorizacion: new Date('2026-01-01'), xmlCafNodo: 'FICTICIO', privateKeyEncrypted: 'FICTICIO', privateKeyIv: 'FICTICIO', privateKeyAuthTag: 'FICTICIO', publicKeyModulus: 'FICTICIO', publicKeyExponent: 'AQAB' } });
    const createDoc = (tipoDte: number, folio: number, state: 'ACEPTADO' | 'FIRMADO' = 'ACEPTADO', date = '2026-10-03') => db.documentoDTE.create({ data: { tenantId, receptorId: partner.id, cafId: caf.id, tipoDte, folio, fechaEmision: new Date(date), mntNeto: 100, mntExento: 0, iva: 19, mntTotal: 119, detallesJson: [], estado: state } });
    const sale = await createDoc(33, 1);
    const credit = await createDoc(61, 1);
    const unsigned = await createDoc(33, 2, 'FIRMADO');
    await expect(ledger.closePeriod(tenantId, actorId, '2026-10')).rejects.toThrow(/pendientes/);
    const list = await app.inject({ url: '/api/v1/finance/centralization?month=2026-10', headers: headers() });
    expect(list.statusCode).toBe(200); expect(list.json().items).toHaveLength(3);
    const denied = await app.inject({ method: 'POST', url: '/api/v1/finance/centralization/' + sale.id, headers: { cookie: viewerCookie, 'x-tenant-id': tenantId }, payload: { confirm: true } });
    expect(denied.statusCode).toBe(403);
    const service = new FinanceCentralizer(db, ledger);
    expect(await service.tick()).toEqual({ posted: 0, failed: 0 }); // desactivado por defecto
    await service.configure(tenantId, actorId, true);
    const tick = await service.tick(); expect(tick).toEqual({ posted: 2, failed: 0 });
    expect(await service.tick()).toEqual({ posted: 0, failed: 0 });
    expect(await db.financeEntry.count({ where: { tenantId, sourceDocumentId: { in: [sale.id, credit.id] } } })).toBe(2);
    expect((await ledger.report(tenantId, '2026-10')).accounts.every(a => a.balance === '0')).toBe(true);
    const posted = await ledger.postDocument(tenantId, actorId, sale.id); expect(posted.replay).toBe(true);
    await expect(ledger.reverse(tenantId, actorId, posted.entry!.id, 'wrong-reverse', '2026-10-04', 'Intento indebido')).rejects.toThrow(/DTE/);
    expect((await db.documentoDTE.findUniqueOrThrow({ where: { id: sale.id } })).estado).toBe('ACEPTADO');
    expect(await db.financeEntry.count({ where: { sourceDocumentId: unsigned.id } })).toBe(0);
    const blocked = await createDoc(33, 3, 'ACEPTADO', '2026-11-03');
    await expect(service.postOne(tenantId, actorId, blocked.id)).rejects.toThrow(/cerrado/);
    expect(await db.financePostingJob.findUnique({ where: { documentId: blocked.id } })).toMatchObject({ state: 'ERROR', entryId: null });
    await expect(service.postOne(otherId, actorId, sale.id)).rejects.toThrow(/empresa/);
    const text = await createDoc(61, 2);
    await db.documentoDTE.update({ where: { id: text.id }, data: { mntNeto: 0, iva: 0, mntTotal: 0, referenciasJson: [{ CodRef: 2 }] } });
    expect(await service.postOne(tenantId, actorId, text.id)).toMatchObject({ skipped: true, entry: null });
    expect(await db.financePostingJob.findUnique({ where: { documentId: text.id } })).toMatchObject({ state: 'SKIPPED' });
    await service.configure(tenantId, actorId, false);
  });

  it('La sesión revocada no puede reutilizarse y las contraseñas no aparecen en respuestas', async () => {
    const session = await app.inject({ url: '/api/v1/finance/session', headers: headers() });
    expect(session.body).not.toMatch(/passwordHash|scrypt/);
    expect((await app.inject({ method: 'POST', url: '/api/v1/finance/logout', headers: headers(), payload: {} })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/v1/finance/session', headers: headers() })).statusCode).toBe(401);
  });
});
describe('Interfaz del núcleo financiero', () => {
  it('Entrega React compilado, navegación de 16 módulos y estados pendientes explícitos', () => {
    const html = renderFinancePanel();
    expect(html).toContain('FINANZAS Y CONTABILIDAD');
    expect(html).toContain('lang="es-CL"');
    expect(html).not.toContain('type="text/babel"');
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
    expect(() => new vm.Script(script)).not.toThrow();
    expect(script).toContain('Pendiente de implementaci');
  });
});
