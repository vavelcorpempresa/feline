import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { FinanceTreasury } from './treasury';

export function registerTreasury(api: FastifyInstance, db: PrismaClient) {
  const treasury = new FinanceTreasury(db);

  // 1. Cajas y Caja Chica
  api.get('/cash-boxes', { config: { financePermission: 'read' } }, async req => {
    return treasury.listCashBoxes(req.financeTenantId!);
  });

  api.post('/cash-boxes', { config: { financePermission: 'treasury' } }, async (req, reply) => {
    const box = await treasury.saveCashBox(req.financeTenantId!, req.financeSession!.userId, req.body);
    return reply.code(201).send(box);
  });

  api.put('/cash-boxes/:id', { config: { financePermission: 'treasury' } }, async req => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    return treasury.saveCashBox(req.financeTenantId!, req.financeSession!.userId, req.body, params.id);
  });

  // 2. Turnos y Arqueos de Caja
  api.post('/cash-boxes/shifts/open', { config: { financePermission: 'treasury' } }, async (req, reply) => {
    const shift = await treasury.openShift(req.financeTenantId!, req.financeSession!.userId, req.body);
    return reply.code(201).send(shift);
  });

  api.post('/cash-boxes/shifts/:id/close', { config: { financePermission: 'treasury' } }, async req => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    return treasury.closeShift(req.financeTenantId!, req.financeSession!.userId, params.id, req.body);
  });

  // 3. Movimientos Directos
  api.get('/treasury/direct-movements', { config: { financePermission: 'read' } }, async req => {
    return treasury.listDirectMovements(req.financeTenantId!, req.query);
  });

  api.post('/treasury/direct-movements', { config: { financePermission: 'treasury' } }, async (req, reply) => {
    const key = String(req.headers['idempotency-key'] || '');
    const result = await treasury.recordDirectMovement(req.financeTenantId!, req.financeSession!.userId, key, req.body);
    return reply.code(result.replay ? 200 : 201).send(result.movement);
  });

  api.post('/treasury/direct-movements/:id/reverse', { config: { financePermission: 'reverse' } }, async (req, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const key = String(req.headers['idempotency-key'] || '');
    const result = await treasury.reverseDirectMovement(req.financeTenantId!, req.financeSession!.userId, params.id, key, req.body);
    return reply.code(result.replay ? 200 : 201).send(result.reversal);
  });

  // 4. Transferencias Internas
  api.get('/treasury/transfers', { config: { financePermission: 'read' } }, async req => {
    return treasury.listInternalTransfers(req.financeTenantId!);
  });

  api.post('/treasury/transfers', { config: { financePermission: 'treasury' } }, async (req, reply) => {
    const key = String(req.headers['idempotency-key'] || '');
    const result = await treasury.transfer(req.financeTenantId!, req.financeSession!.userId, key, req.body);
    return reply.code(result.replay ? 200 : 201).send(result.transfer);
  });

  // 5. Solicitudes de Pago
  api.get('/treasury/payment-requests', { config: { financePermission: 'read' } }, async req => {
    return treasury.listPaymentRequests(req.financeTenantId!);
  });

  api.post('/treasury/payment-requests', { config: { financePermission: 'treasury' } }, async (req, reply) => {
    const created = await treasury.createPaymentRequest(req.financeTenantId!, req.financeSession!.userId, req.body);
    return reply.code(201).send(created);
  });

  api.post('/treasury/payment-requests/:id/approve', { config: { financePermission: 'pay' } }, async req => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    return treasury.updatePaymentRequestStatus(req.financeTenantId!, req.financeSession!.userId, params.id, 'APPROVED');
  });

  api.post('/treasury/payment-requests/:id/reject', { config: { financePermission: 'pay' } }, async req => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({ rejectionReason: z.string().trim().max(250).optional() }).parse(req.body);
    return treasury.updatePaymentRequestStatus(req.financeTenantId!, req.financeSession!.userId, params.id, 'REJECTED', body.rejectionReason);
  });

  // 6. Control de Liquidez y Proyección
  api.get('/treasury/liquidity-projection', { config: { financePermission: 'read' } }, async req => {
    return treasury.getLiquidityAndProjection(req.financeTenantId!);
  });
}
