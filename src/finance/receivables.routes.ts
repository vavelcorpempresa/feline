import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { FinanceReceivables, listReceivables } from './receivables';
import { listCustomers, saveCustomer } from './customers';
import { formatSiiTimestamp } from '../utils/sii-normative.utils';

export function registerReceivables(app: FastifyInstance, db: PrismaClient) {
  const service = new FinanceReceivables(db);
  const id = (params: unknown) => z.object({ id: z.string().uuid() }).parse(params).id;
  app.get('/customers', { config: { financePermission: 'read' } }, req => listCustomers(db, req.financeTenantId!, req.query));
  app.post('/customers', { config: { financePermission: 'customers' } }, async (req, reply) =>
    reply.code(201).send(await saveCustomer(db, req.financeTenantId!, req.financeSession!.userId, req.body)));
  app.put('/customers/:id', { config: { financePermission: 'customers' } }, req =>
    saveCustomer(db, req.financeTenantId!, req.financeSession!.userId, req.body, id(req.params)));
  app.get('/receivables', { config: { financePermission: 'read' } }, req =>
    listReceivables(db, req.financeTenantId!, { asOf: formatSiiTimestamp().slice(0, 10), ...req.query as object }));
  app.get('/receivables/:id', { config: { financePermission: 'read' } }, req => service.detail(req.financeTenantId!, id(req.params)));
  app.post('/receivables/:id/receipts', { config: { financePermission: 'collect' } }, async (req, reply) => {
    const result = await service.receive(req.financeTenantId!, req.financeSession!.userId, id(req.params), String(req.headers['idempotency-key'] ?? ''), req.body);
    return reply.code(result.replay ? 200 : 201).send(result);
  });
  app.post('/receipts/:id/reverse', { config: { financePermission: 'reverseCollection' } }, async (req, reply) => {
    const result = await service.reverseReceipt(req.financeTenantId!, req.financeSession!.userId, id(req.params), String(req.headers['idempotency-key'] ?? ''), req.body);
    return reply.code(result.replay ? 200 : 201).send(result);
  });
  app.post('/credit-allocations', { config: { financePermission: 'settle' } }, async (req, reply) => {
    const result = await service.allocateCredit(req.financeTenantId!, req.financeSession!.userId, String(req.headers['idempotency-key'] ?? ''), req.body);
    return reply.code(result.replay ? 200 : 201).send(result);
  });
  app.post('/credit-allocations/:id/reverse', { config: { financePermission: 'settle' } }, async (req, reply) => {
    const result = await service.reverseAllocation(req.financeTenantId!, req.financeSession!.userId, id(req.params), String(req.headers['idempotency-key'] ?? ''), req.body);
    return reply.code(result.replay ? 200 : 201).send(result);
  });
}
