import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { FinanceError, dateSchema, moneySchema } from './ledger';

const itemSchema = z.object({
  description: z.string().trim().min(1).max(250),
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Cantidad numérica válida'),
  unitPrice: moneySchema,
}).strict();

export const purchaseOrderSchema = z.object({
  vendorId: z.string().uuid(),
  date: dateSchema,
  expectedDeliveryDate: dateSchema.optional(),
  notes: z.string().trim().max(500).optional(),
  items: z.array(itemSchema).min(1).max(100),
}).strict();

export async function listPurchaseOrders(db: PrismaClient, tenantId: string, raw: unknown) {
  const q = z.object({
    status: z.enum(['ALL', 'BORRADOR', 'APROBADA', 'RECEPCIONADA', 'FACTURADA', 'CANCELADA']).default('ALL'),
    vendorId: z.string().uuid().optional(),
    search: z.string().trim().max(100).default(''),
    cursor: z.string().uuid().optional(),
  }).parse(raw);

  const rows = await db.financePurchaseOrder.findMany({
    where: {
      tenantId,
      ...(q.status !== 'ALL' ? { status: q.status } : {}),
      ...(q.vendorId ? { vendorId: q.vendorId } : {}),
      ...(q.search ? {
        OR: [
          { vendor: { razonSocial: { contains: q.search, mode: 'insensitive' } } },
          { vendor: { rut: { contains: q.search, mode: 'insensitive' } } },
          { notes: { contains: q.search, mode: 'insensitive' } },
        ],
      } : {}),
    },
    include: {
      vendor: { select: { id: true, rut: true, razonSocial: true } },
      items: true,
      payables: { select: { id: true, folio: true, documentType: true, totalAmount: true } },
    },
    orderBy: { folio: 'desc' },
    take: 51,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });

  const more = rows.length > 50;
  if (more) rows.pop();

  return {
    items: rows.map(r => ({
      ...r,
      netAmount: r.netAmount.toString(),
      taxAmount: r.taxAmount.toString(),
      totalAmount: r.totalAmount.toString(),
      items: r.items.map(it => ({
        ...it,
        quantity: it.quantity.toString(),
        unitPrice: it.unitPrice.toString(),
        totalPrice: it.totalPrice.toString(),
      })),
    })),
    nextCursor: more ? rows[rows.length - 1].id : null,
  };
}

export async function createPurchaseOrder(db: PrismaClient, tenantId: string, actorId: string, raw: unknown) {
  const input = purchaseOrderSchema.parse(raw);

  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;

    const vendor = await tx.financeVendor.findFirst({ where: { id: input.vendorId, tenantId } });
    if (!vendor) throw new FinanceError(404, 'Proveedor no encontrado en esta empresa.');

    // Folio correlativo por empresa
    const last = await tx.financePurchaseOrder.findFirst({
      where: { tenantId },
      orderBy: { folio: 'desc' },
      select: { folio: true },
    });
    const folio = (last?.folio ?? 0) + 1;

    let net = new Prisma.Decimal(0);
    const calculatedItems = input.items.map(it => {
      const q = new Prisma.Decimal(it.quantity);
      const price = new Prisma.Decimal(it.unitPrice);
      const totalLine = q.mul(price).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
      net = net.plus(totalLine);
      return {
        description: it.description,
        quantity: q,
        unitPrice: price,
        totalPrice: totalLine,
      };
    });

    const tax = net.mul(new Prisma.Decimal('0.19')).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
    const total = net.plus(tax);

    const po = await tx.financePurchaseOrder.create({
      data: {
        tenantId,
        vendorId: input.vendorId,
        folio,
        date: new Date(input.date),
        expectedDeliveryDate: input.expectedDeliveryDate ? new Date(input.expectedDeliveryDate) : null,
        notes: input.notes || null,
        netAmount: net,
        taxAmount: tax,
        totalAmount: total,
        status: 'BORRADOR',
        createdBy: actorId,
        items: {
          create: calculatedItems,
        },
      },
      include: { items: true, vendor: true },
    });

    await tx.financeAuditEvent.create({
      data: {
        tenantId,
        actorId,
        action: 'purchase_order.create',
        entityId: po.id,
        data: { folio, vendorId: input.vendorId, total: total.toString() },
      },
    });

    return {
      ...po,
      netAmount: po.netAmount.toString(),
      taxAmount: po.taxAmount.toString(),
      totalAmount: po.totalAmount.toString(),
      items: po.items.map(it => ({
        ...it,
        quantity: it.quantity.toString(),
        unitPrice: it.unitPrice.toString(),
        totalPrice: it.totalPrice.toString(),
      })),
    };
  });
}

export async function updatePurchaseOrderStatus(
  db: PrismaClient,
  tenantId: string,
  actorId: string,
  orderId: string,
  newStatus: 'APROBADA' | 'RECEPCIONADA' | 'CANCELADA',
) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;

    const po = await tx.financePurchaseOrder.findFirst({ where: { id: orderId, tenantId } });
    if (!po) throw new FinanceError(404, 'Orden de compra no encontrada.');

    if (po.status === 'CANCELADA') {
      throw new FinanceError(409, 'Una orden cancelada no admite cambios de estado.');
    }
    if (po.status === 'FACTURADA' && newStatus === 'CANCELADA') {
      throw new FinanceError(409, 'No se puede cancelar una orden ya facturada.');
    }

    const updated = await tx.financePurchaseOrder.update({
      where: { id: orderId },
      data: { status: newStatus },
      include: { vendor: true, items: true },
    });

    await tx.financeAuditEvent.create({
      data: {
        tenantId,
        actorId,
        action: 'purchase_order.status_change',
        entityId: orderId,
        data: { previousStatus: po.status, newStatus, folio: po.folio },
      },
    });

    return {
      ...updated,
      netAmount: updated.netAmount.toString(),
      taxAmount: updated.taxAmount.toString(),
      totalAmount: updated.totalAmount.toString(),
    };
  });
}
