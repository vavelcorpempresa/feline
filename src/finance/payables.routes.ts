import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { listVendors, saveVendor, getVendorStatement } from './vendors';
import { listPurchaseOrders, createPurchaseOrder, updatePurchaseOrderStatus } from './purchase-orders';
import { FinancePayables } from './payables';

export function registerPayables(api: FastifyInstance, db: PrismaClient) {
  const payablesService = new FinancePayables(db);

  // 1. Maestro de Proveedores
  api.get('/vendors', { config: { financePermission: 'read' } }, async req => {
    return listVendors(db, req.financeTenantId!, req.query);
  });

  api.post('/vendors', { config: { financePermission: 'vendors' } }, async (req, reply) => {
    const created = await saveVendor(db, req.financeTenantId!, req.financeSession!.userId, req.body);
    return reply.code(201).send(created);
  });

  api.put('/vendors/:id', { config: { financePermission: 'vendors' } }, async req => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    return saveVendor(db, req.financeTenantId!, req.financeSession!.userId, req.body, params.id);
  });

  api.get('/vendors/:id/statement', { config: { financePermission: 'read' } }, async req => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    return getVendorStatement(db, req.financeTenantId!, params.id);
  });

  // 2. Órdenes de Compra
  api.get('/purchase-orders', { config: { financePermission: 'read' } }, async req => {
    return listPurchaseOrders(db, req.financeTenantId!, req.query);
  });

  api.post('/purchase-orders', { config: { financePermission: 'payables' } }, async (req, reply) => {
    const po = await createPurchaseOrder(db, req.financeTenantId!, req.financeSession!.userId, req.body);
    return reply.code(201).send(po);
  });

  api.patch('/purchase-orders/:id/status', { config: { financePermission: 'payables' } }, async req => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({ status: z.enum(['APROBADA', 'RECEPCIONADA', 'CANCELADA']) }).parse(req.body);
    return updatePurchaseOrderStatus(db, req.financeTenantId!, req.financeSession!.userId, params.id, body.status);
  });

  // 3. Cuentas por Pagar (Payables)
  api.get('/payables', { config: { financePermission: 'read' } }, async req => {
    return payablesService.list(req.financeTenantId!, req.query);
  });

  api.post('/payables', { config: { financePermission: 'payables' } }, async (req, reply) => {
    const key = String(req.headers['idempotency-key'] || '');
    const payable = await payablesService.create(req.financeTenantId!, req.financeSession!.userId, key, req.body);
    return reply.code(201).send(payable);
  });

  api.post('/payables/:id/schedule', { config: { financePermission: 'payables' } }, async req => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({ scheduledDate: z.string() }).parse(req.body);
    return payablesService.schedule(req.financeTenantId!, req.financeSession!.userId, params.id, body.scheduledDate);
  });

  api.post('/payables/:id/approve', { config: { financePermission: 'pay' } }, async req => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    return payablesService.approve(req.financeTenantId!, req.financeSession!.userId, params.id);
  });

  // 4. Pagos a Proveedores
  api.post('/payables/:id/pay', { config: { financePermission: 'pay' } }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const key = String(req.headers['idempotency-key'] || '');
    const body = { ...(req.body as object), payableId: params.id };
    const result = await payablesService.pay(req.financeTenantId!, req.financeSession!.userId, key, body);
    return reply.code(result.replay ? 200 : 201).send(result.payment);
  });

  api.post('/payables/advance-pay', { config: { financePermission: 'pay' } }, async (req, reply) => {
    const key = String(req.headers['idempotency-key'] || '');
    const result = await payablesService.pay(req.financeTenantId!, req.financeSession!.userId, key, {
      ...(req.body as object),
      isAdvance: true,
    });
    return reply.code(result.replay ? 200 : 201).send(result.payment);
  });

  api.post('/vendor-payments/:id/reverse', { config: { financePermission: 'reverse' } }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const key = String(req.headers['idempotency-key'] || '');
    const result = await payablesService.reversePayment(req.financeTenantId!, req.financeSession!.userId, params.id, key, req.body);
    return reply.code(result.replay ? 200 : 201).send(result.reversal);
  });

  // 5. Aplicación de Notas de Crédito de Proveedor
  api.post('/payables/allocate-credit', { config: { financePermission: 'settle' } }, async (req, reply) => {
    const key = String(req.headers['idempotency-key'] || '');
    const result = await payablesService.allocateCredit(req.financeTenantId!, req.financeSession!.userId, key, req.body);
    return reply.code(result.replay ? 200 : 201).send(result.allocation);
  });
}
