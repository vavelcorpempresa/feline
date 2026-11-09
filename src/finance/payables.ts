import crypto from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { dateSchema, FinanceError, FinanceLedger, financeTransaction, keySchema, moneySchema } from './ledger';
import { formatSiiTimestamp } from '../utils/sii-normative.utils';

const D = (value: string | number | Prisma.Decimal) => new Prisma.Decimal(value);
const uuid = z.string().uuid();
const requestHash = (input: unknown) => crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');

export const positiveMoneySchema = moneySchema.refine(v => BigInt(v) > 0n, 'El monto debe ser mayor a cero');

export const payableCreateSchema = z.object({
  vendorId: uuid,
  purchaseOrderId: uuid.optional(),
  documentType: z.number().int().positive(), // 33, 34, 46, 61, etc.
  folio: z.number().int().positive(),
  date: dateSchema,
  dueDate: dateSchema.optional(),
  netAmount: moneySchema,
  taxAmount: moneySchema.default('0'),
  exemptAmount: moneySchema.default('0'),
  totalAmount: positiveMoneySchema,
  kind: z.enum(['DEBT', 'CREDIT', 'EXPENSE']).default('DEBT'),
  description: z.string().trim().max(250).optional(),
  expenseAccountCode: z.string().min(1).max(16).default('410110'),
}).strict();

export const vendorPaymentSchema = z.object({
  payableId: uuid.optional(),
  vendorId: uuid,
  date: dateSchema,
  amount: positiveMoneySchema,
  method: z.enum(['TRANSFERENCIA', 'CHEQUE', 'EFECTIVO', 'TARJETA', 'OTRO']),
  accountCode: z.string().min(1).max(16).default('110110'), // 110110 Caja, 110210 Banco
  reference: z.string().trim().min(1).max(100),
  isAdvance: z.boolean().default(false),
}).strict();

export const vendorPaymentReversalSchema = z.object({
  date: dateSchema,
  reason: z.string().trim().min(3).max(200),
}).strict();

export const vendorCreditAllocationSchema = z.object({
  creditId: uuid,
  invoiceId: uuid,
  amount: positiveMoneySchema,
  date: dateSchema,
}).strict();

export const payableListSchema = z.object({
  asOf: dateSchema.default(() => formatSiiTimestamp().slice(0, 10)),
  search: z.string().trim().max(100).default(''),
  vendorId: uuid.optional(),
  status: z.enum(['ALL', 'PENDIENTE', 'PROGRAMADO', 'PAGADO', 'ANULADO']).default('ALL'),
  kind: z.enum(['ALL', 'DEBT', 'CREDIT', 'EXPENSE']).default('ALL'),
  cursor: uuid.optional(),
}).strict();

const includePayableRelations = {
  vendor: { select: { id: true, rut: true, razonSocial: true } },
  purchaseOrder: { select: { id: true, folio: true } },
  payments: { include: { reversals: true } },
  invoiceAllocations: { include: { reversals: true } },
  creditAllocations: { include: { reversals: true } },
} satisfies Prisma.FinancePayableInclude;

export type PayablePayload = Prisma.FinancePayableGetPayload<{ include: typeof includePayableRelations }>;

export function calculatePayableBalance(row: PayablePayload, asOf = '9999-12-31') {
  const applies = (date: Date) => date.toISOString().slice(0, 10) <= asOf;
  let result = row.totalAmount;

  for (const payment of row.payments) {
    if (applies(payment.date)) result = result.minus(payment.amount);
    if (payment.reversals.some(r => applies(r.date))) result = result.plus(payment.amount);
  }
  for (const alloc of row.invoiceAllocations) {
    if (applies(alloc.date)) result = result.minus(alloc.amount);
    if (alloc.reversals.some(r => applies(r.date))) result = result.plus(alloc.amount);
  }
  for (const alloc of row.creditAllocations) {
    if (applies(alloc.date)) result = result.plus(alloc.amount);
    if (alloc.reversals.some(r => applies(r.date))) result = result.minus(alloc.amount);
  }

  return result;
}

export class FinancePayables {
  private readonly ledger: FinanceLedger;
  constructor(private readonly db: PrismaClient) {
    this.ledger = new FinanceLedger(db);
  }

  private async lock(tx: Prisma.TransactionClient, tenantId: string) {
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
  }

  private async getPayable(tx: Prisma.TransactionClient, tenantId: string, id: string) {
    const row = await tx.financePayable.findFirst({
      where: { id, tenantId },
      include: includePayableRelations,
    });
    if (!row) throw new FinanceError(404, 'Documento por pagar no encontrado.');
    return row;
  }

  async list(tenantId: string, raw: unknown) {
    const q = payableListSchema.parse(raw);
    const rows = await this.db.financePayable.findMany({
      where: {
        tenantId,
        ...(q.status !== 'ALL' ? { status: q.status } : {}),
        ...(q.kind !== 'ALL' ? { kind: q.kind } : {}),
        ...(q.vendorId ? { vendorId: q.vendorId } : {}),
        ...(q.search ? {
          OR: [
            { vendor: { razonSocial: { contains: q.search, mode: 'insensitive' } } },
            { vendor: { rut: { contains: q.search, mode: 'insensitive' } } },
            { description: { contains: q.search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      include: includePayableRelations,
      orderBy: [{ dueDate: 'asc' }, { date: 'asc' }],
      take: 51,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });

    const more = rows.length > 50;
    if (more) rows.pop();

    const todayStr = formatSiiTimestamp().slice(0, 10);
    const today = new Date(todayStr);

    const items = rows.map(r => {
      const bal = calculatePayableBalance(r, q.asOf);
      const isOverdue = r.dueDate ? r.dueDate < today && bal.gt(0) : false;
      const daysOverdue = isOverdue && r.dueDate ? Math.floor((today.getTime() - r.dueDate.getTime()) / (1000 * 3600 * 24)) : 0;

      return {
        id: r.id,
        vendor: r.vendor,
        purchaseOrder: r.purchaseOrder,
        documentType: r.documentType,
        folio: r.folio,
        date: r.date.toISOString().slice(0, 10),
        dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
        scheduledDate: r.scheduledDate ? r.scheduledDate.toISOString().slice(0, 10) : null,
        netAmount: r.netAmount.toString(),
        taxAmount: r.taxAmount.toString(),
        exemptAmount: r.exemptAmount.toString(),
        totalAmount: r.totalAmount.toString(),
        balance: bal.toString(),
        kind: r.kind,
        status: r.status,
        description: r.description,
        isOverdue,
        daysOverdue,
        approved: !!r.approvedAt,
      };
    });

    return {
      items,
      nextCursor: more ? rows[rows.length - 1].id : null,
    };
  }

  async create(tenantId: string, actorId: string, key: string, raw: unknown) {
    key = keySchema.parse(key);
    const input = payableCreateSchema.parse(raw);
    const hash = requestHash(input);

    const net = D(input.netAmount);
    const tax = D(input.taxAmount);
    const exempt = D(input.exemptAmount);
    const total = D(input.totalAmount);

    if (!net.plus(tax).plus(exempt).equals(total)) {
      throw new FinanceError(400, 'La suma de neto, IVA y exento debe ser igual al total.');
    }
    if (!total.gt(0)) {
      throw new FinanceError(400, 'El monto total debe ser mayor a cero.');
    }

    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const vendor = await tx.financeVendor.findFirst({ where: { id: input.vendorId, tenantId } });
      if (!vendor) throw new FinanceError(404, 'Proveedor no encontrado en esta empresa.');

      const existing = await tx.financePayable.findUnique({
        where: {
          tenantId_vendorId_documentType_folio: {
            tenantId,
            vendorId: input.vendorId,
            documentType: input.documentType,
            folio: input.folio,
          },
        },
      });
      if (existing) {
        throw new FinanceError(409, `El documento ${input.documentType} folio ${input.folio} ya existe para este proveedor.`);
      }

      const id = crypto.randomUUID();
      const isCreditNote = input.kind === 'CREDIT' || input.documentType === 61;

      // Asiento contable de compra o nota de crédito
      let lines: { accountCode: string; debit: string; credit: string }[];
      let description: string;

      if (isCreditNote) {
        description = `NC Proveedor ${vendor.razonSocial} · DTE ${input.documentType} folio ${input.folio}`;
        lines = [
          { accountCode: '210210', debit: total.toString(), credit: '0' },
          ...(tax.gt(0) ? [{ accountCode: '110710', debit: '0', credit: tax.toString() }] : []),
          { accountCode: input.expenseAccountCode, debit: '0', credit: net.plus(exempt).toString() },
        ];
      } else {
        description = `Compra / Gasto ${vendor.razonSocial} · DTE ${input.documentType} folio ${input.folio}`;
        lines = [
          { accountCode: input.expenseAccountCode, debit: net.plus(exempt).toString(), credit: '0' },
          ...(tax.gt(0) ? [{ accountCode: '110710', debit: tax.toString(), credit: '0' }] : []),
          { accountCode: '210210', debit: '0', credit: total.toString() },
        ];
      }

      const posted = await this.ledger.recordEntry(tx, tenantId, actorId, 'payable:' + id, {
        date: input.date,
        description,
        lines,
      });

      const payable = await tx.financePayable.create({
        data: {
          id,
          tenantId,
          vendorId: input.vendorId,
          purchaseOrderId: input.purchaseOrderId || null,
          sourceEntryId: posted.entry.id,
          documentType: input.documentType,
          folio: input.folio,
          date: new Date(input.date),
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          netAmount: net,
          taxAmount: tax,
          exemptAmount: exempt,
          totalAmount: total,
          kind: isCreditNote ? 'CREDIT' : input.kind,
          status: 'PENDIENTE',
          description: input.description || null,
          createdBy: actorId,
        },
      });

      if (input.purchaseOrderId) {
        await tx.financePurchaseOrder.update({
          where: { id: input.purchaseOrderId },
          data: { status: 'FACTURADA' },
        });
      }

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'payable.create',
          entityId: payable.id,
          data: { vendorId: input.vendorId, folio: input.folio, total: total.toString(), entryId: posted.entry.id },
        },
      });

      return payable;
    });
  }

  async pay(tenantId: string, actorId: string, key: string, raw: unknown) {
    key = keySchema.parse(key);
    const input = vendorPaymentSchema.parse(raw);
    const hash = requestHash(input);
    const amount = D(input.amount);

    if (!amount.gt(0)) throw new FinanceError(400, 'El monto a pagar debe ser mayor a cero.');

    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const previous = await tx.financeVendorPayment.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } },
      });
      if (previous) {
        if (previous.requestHash !== hash) throw new FinanceError(409, 'La clave de idempotencia ya se utilizó para otro pago.');
        return { payment: previous, replay: true };
      }

      const vendor = await tx.financeVendor.findFirst({ where: { id: input.vendorId, tenantId } });
      if (!vendor) throw new FinanceError(404, 'Proveedor no encontrado.');

      let payable: PayablePayload | null = null;
      if (input.payableId) {
        payable = await this.getPayable(tx, tenantId, input.payableId);
        if (payable.kind === 'CREDIT') {
          throw new FinanceError(409, 'No se puede registrar un pago directo sobre una nota de crédito.');
        }
        const currentBal = calculatePayableBalance(payable);
        if (amount.gt(currentBal)) {
          throw new FinanceError(409, `El monto de pago (${amount}) supera el saldo pendiente (${currentBal}).`);
        }
      }

      const id = crypto.randomUUID();
      const desc = input.isAdvance
        ? `Anticipo a proveedor ${vendor.razonSocial} · ${input.reference}`
        : `Pago factura ${payable?.documentType ?? ''} folio ${payable?.folio ?? ''} · ${vendor.razonSocial} · ${input.reference}`;

      // Asiento contable de pago:
      // DEBE: 210210 Proveedores (Disminución de pasivo)
      // HABER: input.accountCode (Caja 110110 o Banco 110210)
      const posted = await this.ledger.recordOperation(tx, tenantId, actorId, id, {
        date: input.date,
        description: desc,
        lines: [
          { accountCode: '210210', debit: amount.toString(), credit: '0' },
          { accountCode: input.accountCode, debit: '0', credit: amount.toString() },
        ],
      });

      const payment = await tx.financeVendorPayment.create({
        data: {
          id,
          tenantId,
          payableId: input.payableId || null,
          vendorId: input.vendorId,
          entryId: posted.entry.id,
          amount,
          date: new Date(input.date),
          method: input.method,
          accountCode: input.accountCode,
          reference: input.reference,
          isAdvance: input.isAdvance,
          idempotencyKey: key,
          requestHash: hash,
          createdBy: actorId,
        },
      });

      if (payable) {
        const remaining = calculatePayableBalance(payable).minus(amount);
        if (remaining.equals(0)) {
          await tx.financePayable.update({
            where: { id: payable.id },
            data: { status: 'PAGADO' },
          });
        }
      }

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'vendor_payment.register',
          entityId: payment.id,
          data: { vendorId: input.vendorId, amount: amount.toString(), entryId: posted.entry.id },
        },
      });

      return { payment, replay: false };
    });
  }

  async reversePayment(tenantId: string, actorId: string, paymentId: string, key: string, raw: unknown) {
    key = keySchema.parse(key);
    const input = vendorPaymentReversalSchema.parse(raw);
    const hash = requestHash({ paymentId, ...input });

    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const previous = await tx.financeVendorPaymentReversal.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } },
      });
      if (previous) {
        if (previous.requestHash !== hash) throw new FinanceError(409, 'La clave ya se usó para otra reversión.');
        return { reversal: previous, replay: true };
      }

      const payment = await tx.financeVendorPayment.findFirst({
        where: { id: paymentId, tenantId },
        include: { reversals: true },
      });
      if (!payment) throw new FinanceError(404, 'Pago a proveedor no encontrado.');
      if (payment.reversals.length > 0) throw new FinanceError(409, 'El pago ya se encuentra revertido.');

      const revId = crypto.randomUUID();
      const posted = await this.ledger.recordOperation(tx, tenantId, actorId, revId, {
        date: input.date,
        description: `Reversión de pago proveedor · ${payment.reference} · ${input.reason}`,
        lines: [
          { accountCode: payment.accountCode, debit: payment.amount.toString(), credit: '0' },
          { accountCode: '210210', debit: '0', credit: payment.amount.toString() },
        ],
      });

      const reversal = await tx.financeVendorPaymentReversal.create({
        data: {
          id: revId,
          tenantId,
          paymentId,
          entryId: posted.entry.id,
          date: new Date(input.date),
          reason: input.reason,
          idempotencyKey: key,
          requestHash: hash,
          createdBy: actorId,
        },
      });

      if (payment.payableId) {
        await tx.financePayable.update({
          where: { id: payment.payableId },
          data: { status: 'PENDIENTE' },
        });
      }

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'vendor_payment.reverse',
          entityId: reversal.id,
          data: { paymentId, amount: payment.amount.toString(), reason: input.reason },
        },
      });

      return { reversal, replay: false };
    });
  }

  async allocateCredit(tenantId: string, actorId: string, key: string, raw: unknown) {
    key = keySchema.parse(key);
    const input = vendorCreditAllocationSchema.parse(raw);
    const hash = requestHash(input);
    const amount = D(input.amount);

    if (!amount.gt(0)) throw new FinanceError(400, 'El monto a aplicar debe ser mayor a cero.');

    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const previous = await tx.financeVendorCreditAllocation.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } },
      });
      if (previous) {
        if (previous.requestHash !== hash) throw new FinanceError(409, 'Clave ya usada para otra aplicación de crédito.');
        return { allocation: previous, replay: true };
      }

      const credit = await this.getPayable(tx, tenantId, input.creditId);
      const invoice = await this.getPayable(tx, tenantId, input.invoiceId);

      if (credit.kind !== 'CREDIT' && credit.documentType !== 61) {
        throw new FinanceError(400, 'El documento de origen debe ser una nota de crédito.');
      }
      if (invoice.kind !== 'DEBT' && invoice.documentType === 61) {
        throw new FinanceError(400, 'El documento de destino debe ser una factura por pagar.');
      }
      if (credit.vendorId !== invoice.vendorId) {
        throw new FinanceError(400, 'Ambos documentos deben pertenecer al mismo proveedor.');
      }

      const creditAvailable = calculatePayableBalance(credit);
      const invoicePending = calculatePayableBalance(invoice);

      if (amount.gt(creditAvailable)) {
        throw new FinanceError(409, `El monto supera el saldo disponible de la nota de crédito (${creditAvailable}).`);
      }
      if (amount.gt(invoicePending)) {
        throw new FinanceError(409, `El monto supera el saldo pendiente de la factura (${invoicePending}).`);
      }

      const id = crypto.randomUUID();
      const allocation = await tx.financeVendorCreditAllocation.create({
        data: {
          id,
          tenantId,
          creditId: input.creditId,
          invoiceId: input.invoiceId,
          amount,
          date: new Date(input.date),
          idempotencyKey: key,
          requestHash: hash,
          createdBy: actorId,
        },
      });

      if (invoicePending.minus(amount).equals(0)) {
        await tx.financePayable.update({ where: { id: invoice.id }, data: { status: 'PAGADO' } });
      }

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'vendor_credit.allocate',
          entityId: allocation.id,
          data: { creditId: input.creditId, invoiceId: input.invoiceId, amount: amount.toString() },
        },
      });

      return { allocation, replay: false };
    });
  }

  async schedule(tenantId: string, actorId: string, payableId: string, scheduledDate: string) {
    dateSchema.parse(scheduledDate);
    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);
      const payable = await this.getPayable(tx, tenantId, payableId);
      if (payable.status === 'PAGADO' || payable.status === 'ANULADO') {
        throw new FinanceError(409, 'No se puede programar un documento pagado o anulado.');
      }
      const updated = await tx.financePayable.update({
        where: { id: payableId },
        data: { scheduledDate: new Date(scheduledDate), status: 'PROGRAMADO' },
      });
      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'payable.schedule',
          entityId: payableId,
          data: { scheduledDate },
        },
      });
      return updated;
    });
  }

  async approve(tenantId: string, actorId: string, payableId: string) {
    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);
      const payable = await this.getPayable(tx, tenantId, payableId);
      const updated = await tx.financePayable.update({
        where: { id: payableId },
        data: { approvedBy: actorId, approvedAt: new Date() },
      });
      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'payable.approve',
          entityId: payableId,
          data: { approvedAt: new Date().toISOString() },
        },
      });
      return updated;
    });
  }
}
