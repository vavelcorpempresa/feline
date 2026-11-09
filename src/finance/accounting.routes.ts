import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { FinanceAccounting } from './accounting';

const uuid = z.string().uuid();

export function registerAccounting(app: FastifyInstance, db: PrismaClient) {
  const accounting = new FinanceAccounting(db);

  // 1. Dashboard Financiero Consolidado (Módulo 01)
  app.get('/dashboard/overview', { config: { financePermission: 'read' } }, async req => {
    const q = z.object({ month: z.string().optional() }).parse(req.query);
    return accounting.getDashboardOverview(req.financeTenantId!, q.month);
  });

  // 2. Plan de Cuentas (Módulo 08)
  app.get('/chart-of-accounts', { config: { financePermission: 'read' } }, async req => {
    return accounting.listAccounts(req.financeTenantId!);
  });

  app.post('/custom-accounts', { config: { financePermission: 'post' } }, async (req, reply) => {
    const result = await accounting.saveCustomAccount(req.financeTenantId!, req.financeSession!.userId, req.body);
    return reply.code(201).send(result);
  });

  app.put('/custom-accounts/:id', { config: { financePermission: 'post' } }, async req => {
    const id = uuid.parse((req.params as { id: string }).id);
    return accounting.saveCustomAccount(req.financeTenantId!, req.financeSession!.userId, req.body, id);
  });

  // 3. Centros de Costo (Módulo 08)
  app.get('/cost-centers', { config: { financePermission: 'read' } }, async req => {
    return accounting.listCostCenters(req.financeTenantId!);
  });

  app.post('/cost-centers', { config: { financePermission: 'post' } }, async (req, reply) => {
    const result = await accounting.saveCostCenter(req.financeTenantId!, req.financeSession!.userId, req.body);
    return reply.code(201).send(result);
  });

  app.delete('/cost-centers/:id', { config: { financePermission: 'post' } }, async req => {
    const id = uuid.parse((req.params as { id: string }).id);
    return accounting.deleteCostCenter(req.financeTenantId!, req.financeSession!.userId, id);
  });

  // 4. Libro Mayor Persistente (Módulo 08)
  app.get('/general-ledger', { config: { financePermission: 'read' } }, async req => {
    const q = z.object({
      accountCode: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      costCenterId: z.string().optional(),
    }).parse(req.query);

    return accounting.getGeneralLedger(req.financeTenantId!, q);
  });

  // 5. Asientos de Apertura y Cierre Anual (Módulo 08)
  app.post('/opening-entry', { config: { financePermission: 'post' } }, async (req, reply) => {
    const key = String(req.headers['idempotency-key'] ?? '');
    const result = await accounting.postOpeningEntry(req.financeTenantId!, req.financeSession!.userId, key, req.body);
    return reply.code(201).send(result);
  });

  app.post('/fiscal-years/:year/close', { config: { financePermission: 'close' } }, async req => {
    const year = Number((req.params as { year: string }).year);
    return accounting.closeFiscalYear(req.financeTenantId!, req.financeSession!.userId, year);
  });

  // 6. Informes Financieros (Módulo 13)
  app.get('/reports/balance-general', { config: { financePermission: 'read' } }, async req => {
    const q = z.object({ asOfDate: z.string().optional() }).parse(req.query);
    return accounting.getBalanceGeneral(req.financeTenantId!, q.asOfDate);
  });

  app.get('/reports/estado-resultados', { config: { financePermission: 'read' } }, async req => {
    const q = z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).parse(req.query);
    return accounting.getEstadoResultados(req.financeTenantId!, q.startDate, q.endDate);
  });

  app.get('/reports/balance-ocho-columnas', { config: { financePermission: 'read' } }, async req => {
    const q = z.object({ asOfDate: z.string().optional() }).parse(req.query);
    return accounting.getBalanceOchoColumnas(req.financeTenantId!, q.asOfDate);
  });
}
