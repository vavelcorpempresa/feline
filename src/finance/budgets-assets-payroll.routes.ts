import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { FinanceBudgetsAssetsPayroll } from './budgets-assets-payroll';
import { FinanceLedger } from './ledger';

export function registerBudgetsAssetsPayroll(api: FastifyInstance, db: PrismaClient) {
  const ledger = new FinanceLedger(db);
  const service = new FinanceBudgetsAssetsPayroll(db, ledger);

  // --- PRESUPUESTOS ---
  api.get('/budgets', { config: { financePermission: 'read' } }, async req => {
    const q = z.object({ year: z.coerce.number().int().optional() }).parse(req.query);
    return service.listBudgets(req.financeTenantId!, q.year);
  });

  api.post('/budgets', { config: { financePermission: 'close' } }, async (req, reply) => {
    const result = await service.saveBudget(req.financeTenantId!, req.financeSession!.userId, req.body);
    return reply.code(201).send(result);
  });

  api.post('/budgets/:id/approve', { config: { financePermission: 'close' } }, async req => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    return service.approveBudget(req.financeTenantId!, req.financeSession!.userId, id);
  });

  api.get('/budgets/:id/execution', { config: { financePermission: 'read' } }, async req => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    return service.getBudgetExecution(req.financeTenantId!, id);
  });

  // --- ACTIVOS FIJOS ---
  api.get('/fixed-assets', { config: { financePermission: 'read' } }, async req => {
    return service.listFixedAssets(req.financeTenantId!);
  });

  api.post('/fixed-assets', { config: { financePermission: 'close' } }, async (req, reply) => {
    const result = await service.createFixedAsset(req.financeTenantId!, req.financeSession!.userId, req.body);
    return reply.code(201).send(result);
  });

  api.post('/fixed-assets/depreciate', { config: { financePermission: 'close' } }, async (req, reply) => {
    const { period } = z.object({ period: z.string().regex(/^\d{4}-\d{2}$/) }).strict().parse(req.body);
    const result = await service.depreciateAssetsMonthly(req.financeTenantId!, req.financeSession!.userId, period);
    return reply.code(201).send(result);
  });

  // --- REMUNERACIONES (EMPLEADOS & LIQUIDACIONES) ---
  api.get('/payroll/employees', { config: { financePermission: 'read' } }, async req => {
    return service.listEmployees(req.financeTenantId!);
  });

  api.post('/payroll/employees', { config: { financePermission: 'close' } }, async (req, reply) => {
    const result = await service.saveEmployee(req.financeTenantId!, req.financeSession!.userId, req.body);
    return reply.code(201).send(result);
  });

  api.get('/payroll/slips', { config: { financePermission: 'read' } }, async req => {
    const q = z.object({ period: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(req.query);
    return service.listPayrollSlips(req.financeTenantId!, q.period);
  });

  api.post('/payroll/slips/generate', { config: { financePermission: 'close' } }, async (req, reply) => {
    const result = await service.generatePayrollSlip(req.financeTenantId!, req.financeSession!.userId, req.body);
    return reply.code(201).send(result);
  });

  // --- BOLETAS DE HONORARIOS ---
  api.get('/fee-receipts', { config: { financePermission: 'read' } }, async req => {
    const q = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(req.query);
    return service.listFeeReceipts(req.financeTenantId!, q.month);
  });

  api.post('/fee-receipts', { config: { financePermission: 'payables' } }, async (req, reply) => {
    const result = await service.recordFeeReceipt(req.financeTenantId!, req.financeSession!.userId, req.body);
    return reply.code(201).send(result);
  });
}
