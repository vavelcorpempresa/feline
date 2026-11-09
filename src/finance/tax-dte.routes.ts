import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { FinanceTaxDte, receivedDteSchema, f29PeriodSchema } from './tax-dte';
import { FinanceLedger } from './ledger';

export function registerTaxDte(api: FastifyInstance, db: PrismaClient) {
  const ledger = new FinanceLedger(db);
  const service = new FinanceTaxDte(db, ledger);

  // --- DTEs RECIBIDOS ---
  api.get('/tax/received-dtes', { config: { financePermission: 'read' } }, async req => {
    const q = z.object({
      status: z.string().optional(),
      senderRut: z.string().optional(),
      month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    }).parse(req.query);

    return service.listReceivedDtes(req.financeTenantId!, q);
  });

  api.post('/tax/received-dtes', { config: { financePermission: 'payables' } }, async (req, reply) => {
    const result = await service.receiveDte(req.financeTenantId!, req.financeSession!.userId, req.body);
    return reply.code(201).send(result);
  });

  api.post('/tax/received-dtes/:id/respond', { config: { financePermission: 'payables' } }, async req => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { action, reason } = z.object({
      action: z.enum(['ACCEPT', 'CLAIM']),
      reason: z.string().max(255).optional(),
    }).strict().parse(req.body);

    return service.respondReceivedDte(req.financeTenantId!, req.financeSession!.userId, id, action, reason);
  });

  api.post('/tax/received-dtes/:id/convert-to-payable', { config: { financePermission: 'payables' } }, async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const { vendorId, accountCode } = z.object({
      vendorId: z.string().uuid(),
      accountCode: z.string().regex(/^\d{6}$/).optional(),
    }).strict().parse(req.body);

    const result = await service.convertReceivedToPayable(req.financeTenantId!, req.financeSession!.userId, id, vendorId, accountCode);
    return reply.code(201).send(result);
  });

  // --- FORMULARIO 29 & GESTIÓN TRIBUTARIA ---
  api.get('/tax/f29/calculate', { config: { financePermission: 'read' } }, async req => {
    const { period } = z.object({ period: f29PeriodSchema }).parse(req.query);
    return service.calculateF29(req.financeTenantId!, period);
  });

  api.post('/tax/f29/declare', { config: { financePermission: 'close' } }, async (req, reply) => {
    const { period, status } = z.object({
      period: f29PeriodSchema,
      status: z.enum(['DRAFT', 'DECLARED', 'PAID']).optional(),
    }).strict().parse(req.body);

    const result = await service.saveF29Declaration(req.financeTenantId!, req.financeSession!.userId, period, status);
    return reply.code(201).send(result);
  });

  // --- FACTURACIÓN ELECTRÓNICA EXTENDIDA ---
  api.post('/dte/issue-extended', { config: { financePermission: 'collect' } }, async (req, reply) => {
    const bodySchema = z.object({
      tipoDte: z.number().int(),
      receptorRut: z.string().min(3).max(12),
      razonSocial: z.string().min(2).max(150),
      giro: z.string().optional(),
      direccion: z.string().optional(),
      comuna: z.string().optional(),
      ciudad: z.string().optional(),
      items: z.array(z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().nonnegative(),
        exempt: z.boolean().optional(),
      })).min(1),
      reference: z.object({
        tipoDocRef: z.number().int(),
        folioRef: z.number().int(),
        codRef: z.number().int(),
        razonRef: z.string().min(1),
      }).optional(),
    }).strict();

    const input = bodySchema.parse(req.body);
    const result = await service.issueExtendedDte(req.financeTenantId!, req.financeSession!.userId, input);
    return reply.code(201).send(result);
  });
}
