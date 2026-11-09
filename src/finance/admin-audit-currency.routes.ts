import { FastifyInstance } from 'fastify';
import { PrismaClient, FinanceRole } from '@prisma/client';
import { z } from 'zod';
import { FinanceAdminAuditCurrency } from './admin-audit-currency';

export function registerAdminAuditCurrency(api: FastifyInstance, db: PrismaClient) {
  const service = new FinanceAdminAuditCurrency(db);

  // --- 14. AUDITORÍA EXTENDIDA ---
  api.get('/audit/logs', { config: { financePermission: 'audit' } }, async req => {
    const q = z.object({
      action: z.string().optional(),
      actorId: z.string().uuid().optional(),
      cursor: z.string().uuid().optional(),
      limit: z.coerce.number().int().optional(),
    }).parse(req.query);

    return service.getAuditLog(req.financeTenantId!, q);
  });

  // --- 15. CONFIGURACIÓN TRIBUTARIA Y CAFs ---
  api.get('/tax-settings', { config: { financePermission: 'read' } }, async req => {
    return service.getTaxSettings(req.financeTenantId!);
  });

  api.put('/tax-settings', { config: { financePermission: 'close' } }, async req => {
    return service.updateTaxSettings(req.financeTenantId!, req.financeSession!.userId, req.body);
  });

  // --- 16. MULTIMONEDA & USUARIOS / ROLES ---
  api.get('/currency-rates', { config: { financePermission: 'read' } }, async req => {
    const q = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(req.query);
    return service.getCurrencyRates(q.date);
  });

  api.post('/currency-rates', { config: { financePermission: 'close' } }, async (req, reply) => {
    const result = await service.setCurrencyRate(req.financeSession!.userId, req.body);
    return reply.code(201).send(result);
  });

  api.get('/users/memberships', { config: { financePermission: 'users' } }, async req => {
    return service.listUsersAndMemberships(req.financeTenantId!);
  });

  api.patch('/users/:userId/role', { config: { financePermission: 'users' } }, async req => {
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.params);
    const { role } = z.object({
      role: z.enum(['OWNER', 'ACCOUNTANT', 'BILLING', 'VIEWER']),
    }).strict().parse(req.body);

    return service.updateUserRole(req.financeTenantId!, req.financeSession!.userId, userId, role as FinanceRole);
  });
}
