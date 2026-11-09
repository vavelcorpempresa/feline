import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { FinanceBanking } from './banking';

const uuid = z.string().uuid();

export function registerBanking(app: FastifyInstance, db: PrismaClient) {
  const banking = new FinanceBanking(db);

  // 1. Maestro de Cuentas Bancarias
  app.get('/bank-accounts', { config: { financePermission: 'read' } }, async req => {
    return banking.listBankAccounts(req.financeTenantId!);
  });

  app.post('/bank-accounts', { config: { financePermission: 'treasury' } }, async (req, reply) => {
    const result = await banking.saveBankAccount(req.financeTenantId!, req.financeSession!.userId, req.body);
    return reply.code(201).send(result);
  });

  app.put('/bank-accounts/:id', { config: { financePermission: 'treasury' } }, async req => {
    const id = uuid.parse((req.params as { id: string }).id);
    return banking.saveBankAccount(req.financeTenantId!, req.financeSession!.userId, req.body, id);
  });

  // 2. Importación de Cartolas Bancarias
  app.post('/bank-statements/import', { config: { financePermission: 'treasury' } }, async (req, reply) => {
    const body = z.object({
      bankAccountId: uuid,
      filename: z.string().min(1).max(255),
      content: z.string().min(5),
    }).strict().parse(req.body);

    const result = await banking.importStatement(
      req.financeTenantId!,
      req.financeSession!.userId,
      body.bankAccountId,
      body.filename,
      body.content
    );
    return reply.code(201).send(result);
  });

  // 3. Movimientos de Cartola y Candidatos
  app.get('/bank-accounts/:id/lines', { config: { financePermission: 'read' } }, async req => {
    const id = uuid.parse((req.params as { id: string }).id);
    const query = z.object({
      status: z.string().optional(),
      search: z.string().optional(),
      cursor: uuid.optional(),
    }).parse(req.query);

    return banking.listStatementLines(req.financeTenantId!, id, query);
  });

  app.get('/bank-lines/:id/candidates', { config: { financePermission: 'read' } }, async req => {
    const id = uuid.parse((req.params as { id: string }).id);
    return banking.findCandidates(req.financeTenantId!, id);
  });

  // 4. Conciliación Manual y Ajustes
  app.post('/bank-reconciliations/manual', { config: { financePermission: 'treasury' } }, async (req, reply) => {
    const result = await banking.reconcileManual(req.financeTenantId!, req.financeSession!.userId, req.body);
    return reply.code(201).send(result);
  });

  app.post('/bank-reconciliations/adjustment', { config: { financePermission: 'treasury' } }, async (req, reply) => {
    const key = String(req.headers['idempotency-key'] ?? '');
    const result = await banking.reconcileWithAdjustment(req.financeTenantId!, req.financeSession!.userId, key, req.body);
    return reply.code(201).send(result);
  });

  app.post('/bank-lines/:id/unidentified', { config: { financePermission: 'treasury' } }, async req => {
    const id = uuid.parse((req.params as { id: string }).id);
    const body = z.object({ notes: z.string().trim().max(250).optional() }).strict().parse(req.body);
    return banking.markUnidentified(req.financeTenantId!, req.financeSession!.userId, id, body.notes);
  });

  app.post('/bank-reconciliations/:id/undo', { config: { financePermission: 'treasury' } }, async req => {
    const id = uuid.parse((req.params as { id: string }).id);
    const body = z.object({ reason: z.string().trim().min(3).max(200) }).strict().parse(req.body);
    return banking.undoReconciliation(req.financeTenantId!, req.financeSession!.userId, id, body.reason);
  });

  // 5. Reglas de Conciliación Asistida
  app.get('/bank-rules', { config: { financePermission: 'read' } }, async req => {
    return banking.listRules(req.financeTenantId!);
  });

  app.post('/bank-rules', { config: { financePermission: 'treasury' } }, async (req, reply) => {
    const result = await banking.saveRule(req.financeTenantId!, req.financeSession!.userId, req.body);
    return reply.code(201).send(result);
  });

  app.put('/bank-rules/:id', { config: { financePermission: 'treasury' } }, async req => {
    const id = uuid.parse((req.params as { id: string }).id);
    return banking.saveRule(req.financeTenantId!, req.financeSession!.userId, req.body, id);
  });

  app.delete('/bank-rules/:id', { config: { financePermission: 'treasury' } }, async req => {
    const id = uuid.parse((req.params as { id: string }).id);
    return banking.deleteRule(req.financeTenantId!, req.financeSession!.userId, id);
  });

  app.post('/bank-accounts/:id/apply-rules', { config: { financePermission: 'treasury' } }, async req => {
    const id = uuid.parse((req.params as { id: string }).id);
    return banking.applyRules(req.financeTenantId!, req.financeSession!.userId, id);
  });
}
