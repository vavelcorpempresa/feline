import crypto from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { dateSchema, FinanceError, FinanceLedger, financeTransaction, keySchema, moneySchema } from './ledger';
import { formatSiiTimestamp } from '../utils/sii-normative.utils';

const D = (value: string | number | Prisma.Decimal) => new Prisma.Decimal(value);
const uuid = z.string().uuid();
const requestHash = (input: unknown) => crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');

export const positiveMoneySchema = moneySchema.refine(v => BigInt(v) > 0n, 'El monto debe ser mayor a cero');

export const cashBoxSchema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(['CENTRAL', 'PETTY_CASH', 'BRANCH']).default('CENTRAL'),
  currency: z.string().trim().min(3).max(10).default('CLP'),
  accountCode: z.string().min(1).max(16).default('110110'),
  responsibleUserId: uuid.optional(),
  maxBalance: moneySchema.optional(),
  isActive: z.boolean().default(true),
}).strict();

export const openShiftSchema = z.object({
  cashBoxId: uuid,
  openingBalance: moneySchema.default('0'),
  notes: z.string().trim().max(500).optional(),
}).strict();

export const closeShiftSchema = z.object({
  countedBalance: moneySchema,
  notes: z.string().trim().max(500).optional(),
  differenceReason: z.string().trim().max(250).optional(),
}).strict();

export const directMovementSchema = z.object({
  cashBoxId: uuid.optional(),
  type: z.enum(['INCOME', 'EXPENSE']),
  date: dateSchema,
  amount: positiveMoneySchema,
  accountCode: z.string().min(1).max(16), // Contrapartida
  category: z.enum(['GASTO_MENOR', 'RETIRO', 'APORTE', 'OTRO']).default('OTRO'),
  description: z.string().trim().min(3).max(250),
  recipientOrPayer: z.string().trim().max(100).optional(),
  voucherNumber: z.string().trim().max(50).optional(),
}).strict();

export const internalTransferSchema = z.object({
  fromAccountCode: z.string().min(1).max(16).default('110110'),
  fromCashBoxId: uuid.optional(),
  toAccountCode: z.string().min(1).max(16).default('110210'),
  toCashBoxId: uuid.optional(),
  amount: positiveMoneySchema,
  date: dateSchema,
  reference: z.string().trim().min(2).max(100),
  notes: z.string().trim().max(250).optional(),
}).strict();

export const paymentRequestSchema = z.object({
  amount: positiveMoneySchema,
  date: dateSchema,
  dueDate: dateSchema.optional(),
  recipient: z.string().trim().min(2).max(120),
  reason: z.string().trim().min(3).max(250),
  category: z.string().trim().max(30).default('GASTO'),
  urgency: z.enum(['NORMAL', 'URGENT']).default('NORMAL'),
}).strict();

export class FinanceTreasury {
  private readonly ledger: FinanceLedger;
  constructor(private readonly db: PrismaClient) {
    this.ledger = new FinanceLedger(db);
  }

  private async lock(tx: Prisma.TransactionClient, tenantId: string) {
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
  }

  // 1. Maestro de Cajas y Caja Chica
  async listCashBoxes(tenantId: string) {
    const boxes = await this.db.financeCashBox.findMany({
      where: { tenantId },
      include: {
        shifts: { where: { status: 'OPEN' }, take: 1 },
      },
      orderBy: { name: 'asc' },
    });

    const entries = await this.db.financeEntryLine.groupBy({
      by: ['accountCode'],
      where: { entry: { tenantId } },
      _sum: { debit: true, credit: true },
    });

    const accountBalances = new Map<string, Prisma.Decimal>();
    for (const e of entries) {
      const net = (e._sum.debit || new Prisma.Decimal(0)).minus(e._sum.credit || new Prisma.Decimal(0));
      accountBalances.set(e.accountCode, net);
    }

    return boxes.map(b => ({
      ...b,
      currentBalance: (accountBalances.get(b.accountCode) || new Prisma.Decimal(0)).toString(),
      maxBalance: b.maxBalance ? b.maxBalance.toString() : null,
      currentShift: b.shifts[0] ? {
        id: b.shifts[0].id,
        openedAt: b.shifts[0].openedAt.toISOString(),
        openingBalance: b.shifts[0].openingBalance.toString(),
      } : null,
    }));
  }

  async saveCashBox(tenantId: string, actorId: string, raw: unknown, id?: string) {
    const input = cashBoxSchema.parse(raw);
    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);
      if (id && !(await tx.financeCashBox.findFirst({ where: { id, tenantId } }))) {
        throw new FinanceError(404, 'Caja no encontrada.');
      }
      const data = {
        name: input.name,
        type: input.type,
        currency: input.currency,
        accountCode: input.accountCode,
        responsibleUserId: input.responsibleUserId || null,
        maxBalance: input.maxBalance ? D(input.maxBalance) : null,
        isActive: input.isActive,
      };
      const box = id
        ? await tx.financeCashBox.update({ where: { id }, data })
        : await tx.financeCashBox.create({ data: { ...data, tenantId } });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: id ? 'cashbox.update' : 'cashbox.create',
          entityId: box.id,
          data: { name: box.name, type: box.type },
        },
      });
      return box;
    });
  }

  // 2. Apertura, Cierre y Arqueo de Caja
  async openShift(tenantId: string, actorId: string, raw: unknown) {
    const input = openShiftSchema.parse(raw);
    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);
      const box = await tx.financeCashBox.findFirst({ where: { id: input.cashBoxId, tenantId, isActive: true } });
      if (!box) throw new FinanceError(404, 'Caja no encontrada o inactiva.');

      const activeShift = await tx.financeCashShift.findFirst({ where: { tenantId, cashBoxId: input.cashBoxId, status: 'OPEN' } });
      if (activeShift) throw new FinanceError(409, 'Esta caja ya tiene un turno abierto. Realiza el arqueo y cierre primero.');

      const shift = await tx.financeCashShift.create({
        data: {
          tenantId,
          cashBoxId: input.cashBoxId,
          openedBy: actorId,
          openingBalance: D(input.openingBalance),
          notes: input.notes || null,
          status: 'OPEN',
        },
      });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'cash_shift.open',
          entityId: shift.id,
          data: { cashBoxId: input.cashBoxId, openingBalance: input.openingBalance },
        },
      });

      return shift;
    });
  }

  async closeShift(tenantId: string, actorId: string, shiftId: string, raw: unknown) {
    const input = closeShiftSchema.parse(raw);
    const counted = D(input.countedBalance);

    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);
      const shift = await tx.financeCashShift.findFirst({
        where: { id: shiftId, tenantId },
        include: { cashBox: true, directMovements: { include: { reversals: true } } },
      });
      if (!shift) throw new FinanceError(404, 'Turno de caja no encontrado.');
      if (shift.status === 'CLOSED') throw new FinanceError(409, 'El turno ya fue cerrado y arqueado.');

      // Calcular saldo esperado: saldo inicial + ingresos - egresos del turno
      let expected = shift.openingBalance;
      for (const m of shift.directMovements) {
        if (!m.reversals.length) {
          if (m.type === 'INCOME') expected = expected.plus(m.amount);
          if (m.type === 'EXPENSE') expected = expected.minus(m.amount);
        }
      }

      const diff = counted.minus(expected);
      let differenceEntryId: string | null = null;

      // Si hay diferencia en arqueo, generar asiento de ajuste
      if (!diff.equals(0)) {
        const todayStr = formatSiiTimestamp().slice(0, 10);
        const absDiff = diff.abs().toString();
        const isSurplus = diff.gt(0); // Sobrante
        const id = crypto.randomUUID();

        const desc = isSurplus
          ? `Ajuste arqueo de caja ${shift.cashBox.name} · Sobrante de caja`
          : `Ajuste arqueo de caja ${shift.cashBox.name} · Faltante de caja (${input.differenceReason || 'Sin motivo'})`;

        const lines = isSurplus
          ? [
              { accountCode: shift.cashBox.accountCode, debit: absDiff, credit: '0' },
              { accountCode: '520190', debit: '0', credit: absDiff }, // Otros ingresos
            ]
          : [
              { accountCode: '410290', debit: absDiff, credit: '0' }, // Gastos varios / Faltantes
              { accountCode: shift.cashBox.accountCode, debit: '0', credit: absDiff },
            ];

        const posted = await this.ledger.recordEntry(tx, tenantId, actorId, 'shift_diff:' + id, {
          date: todayStr,
          description: desc,
          lines,
        });
        differenceEntryId = posted.entry.id;
      }

      const closed = await tx.financeCashShift.update({
        where: { id: shiftId },
        data: {
          closedBy: actorId,
          closedAt: new Date(),
          expectedBalance: expected,
          countedBalance: counted,
          difference: diff,
          differenceReason: input.differenceReason || null,
          differenceEntryId,
          notes: input.notes || null,
          status: 'CLOSED',
        },
      });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'cash_shift.close',
          entityId: shiftId,
          data: {
            expected: expected.toString(),
            counted: counted.toString(),
            difference: diff.toString(),
          },
        },
      });

      return closed;
    });
  }

  // 3. Ingresos y Egresos Directos (Caja Chica, Retiros, Aportes)
  async listDirectMovements(tenantId: string, raw: unknown) {
    const q = z.object({
      type: z.enum(['ALL', 'INCOME', 'EXPENSE']).default('ALL'),
      cashBoxId: uuid.optional(),
      cursor: uuid.optional(),
    }).parse(raw);

    const rows = await this.db.financeDirectMovement.findMany({
      where: {
        tenantId,
        ...(q.type !== 'ALL' ? { type: q.type } : {}),
        ...(q.cashBoxId ? { cashBoxId: q.cashBoxId } : {}),
      },
      include: {
        cashBox: { select: { id: true, name: true, accountCode: true } },
        reversals: true,
      },
      orderBy: { date: 'desc' },
      take: 51,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });

    const more = rows.length > 50;
    if (more) rows.pop();

    return {
      items: rows.map(r => ({
        ...r,
        amount: r.amount.toString(),
        isReversed: r.reversals.length > 0,
      })),
      nextCursor: more ? rows[rows.length - 1].id : null,
    };
  }

  async recordDirectMovement(tenantId: string, actorId: string, key: string, raw: unknown) {
    key = keySchema.parse(key);
    const input = directMovementSchema.parse(raw);
    const hash = requestHash(input);
    const amount = D(input.amount);

    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const previous = await tx.financeDirectMovement.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } },
      });
      if (previous) {
        if (previous.requestHash !== hash) throw new FinanceError(409, 'Clave ya usada para otro movimiento directo.');
        return { movement: previous, replay: true };
      }

      let cashBoxAccount = '110110';
      let activeShiftId: string | null = null;

      if (input.cashBoxId) {
        const box = await tx.financeCashBox.findFirst({ where: { id: input.cashBoxId, tenantId, isActive: true } });
        if (!box) throw new FinanceError(404, 'Caja no encontrada.');
        cashBoxAccount = box.accountCode;

        const shift = await tx.financeCashShift.findFirst({ where: { cashBoxId: input.cashBoxId, status: 'OPEN' } });
        if (shift) activeShiftId = shift.id;
      }

      const id = crypto.randomUUID();
      const desc = `${input.type === 'INCOME' ? 'Ingreso directo' : 'Egreso / Caja chica'} · ${input.description} · ${input.recipientOrPayer || ''}`;

      // Asiento contable:
      // Si INCOME: DEBE Cuenta Caja / HABER Contrapartida
      // Si EXPENSE: DEBE Contrapartida / HABER Cuenta Caja
      const lines = input.type === 'INCOME'
        ? [
            { accountCode: cashBoxAccount, debit: amount.toString(), credit: '0' },
            { accountCode: input.accountCode, debit: '0', credit: amount.toString() },
          ]
        : [
            { accountCode: input.accountCode, debit: amount.toString(), credit: '0' },
            { accountCode: cashBoxAccount, debit: '0', credit: amount.toString() },
          ];

      const posted = await this.ledger.recordEntry(tx, tenantId, actorId, 'direct:' + id, {
        date: input.date,
        description: desc,
        lines,
      });

      const movement = await tx.financeDirectMovement.create({
        data: {
          id,
          tenantId,
          cashBoxId: input.cashBoxId || null,
          shiftId: activeShiftId,
          entryId: posted.entry.id,
          type: input.type,
          date: new Date(input.date),
          amount,
          accountCode: input.accountCode,
          category: input.category,
          description: input.description,
          recipientOrPayer: input.recipientOrPayer || null,
          voucherNumber: input.voucherNumber || null,
          idempotencyKey: key,
          requestHash: hash,
          createdBy: actorId,
        },
      });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'direct_movement.record',
          entityId: movement.id,
          data: { type: input.type, amount: amount.toString(), entryId: posted.entry.id },
        },
      });

      return { movement, replay: false };
    });
  }

  async reverseDirectMovement(tenantId: string, actorId: string, movementId: string, key: string, raw: unknown) {
    key = keySchema.parse(key);
    const body = z.object({ date: dateSchema, reason: z.string().trim().min(3).max(200) }).parse(raw);
    const hash = requestHash({ movementId, ...body });

    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const previous = await tx.financeDirectMovementReversal.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } },
      });
      if (previous) {
        if (previous.requestHash !== hash) throw new FinanceError(409, 'Clave ya usada para otra reversión.');
        return { reversal: previous, replay: true };
      }

      const movement = await tx.financeDirectMovement.findFirst({
        where: { id: movementId, tenantId },
        include: { reversals: true, cashBox: true },
      });
      if (!movement) throw new FinanceError(404, 'Movimiento directo no encontrado.');
      if (movement.reversals.length > 0) throw new FinanceError(409, 'El movimiento ya se encuentra revertido.');

      const revId = crypto.randomUUID();
      const cashBoxAccount = movement.cashBox?.accountCode || '110110';

      // Asiento espejo invertido
      const lines = movement.type === 'INCOME'
        ? [
            { accountCode: movement.accountCode, debit: movement.amount.toString(), credit: '0' },
            { accountCode: cashBoxAccount, debit: '0', credit: movement.amount.toString() },
          ]
        : [
            { accountCode: cashBoxAccount, debit: movement.amount.toString(), credit: '0' },
            { accountCode: movement.accountCode, debit: '0', credit: movement.amount.toString() },
          ];

      const posted = await this.ledger.recordEntry(tx, tenantId, actorId, 'rev_direct:' + revId, {
        date: body.date,
        description: `Reversión movimiento directo · ${movement.description} · ${body.reason}`,
        lines,
      });

      const reversal = await tx.financeDirectMovementReversal.create({
        data: {
          id: revId,
          tenantId,
          movementId,
          entryId: posted.entry.id,
          date: new Date(body.date),
          reason: body.reason,
          idempotencyKey: key,
          requestHash: hash,
          createdBy: actorId,
        },
      });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'direct_movement.reverse',
          entityId: reversal.id,
          data: { movementId, amount: movement.amount.toString(), reason: body.reason },
        },
      });

      return { reversal, replay: false };
    });
  }

  // 4. Transferencias Internas (Traspasos Caja / Banco)
  async listInternalTransfers(tenantId: string) {
    const rows = await this.db.financeInternalTransfer.findMany({
      where: { tenantId },
      include: {
        fromCashBox: { select: { name: true } },
        toCashBox: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take: 50,
    });
    return rows.map(r => ({
      ...r,
      amount: r.amount.toString(),
    }));
  }

  async transfer(tenantId: string, actorId: string, key: string, raw: unknown) {
    key = keySchema.parse(key);
    const input = internalTransferSchema.parse(raw);
    const hash = requestHash(input);
    const amount = D(input.amount);

    if (input.fromAccountCode === input.toAccountCode && input.fromCashBoxId === input.toCashBoxId) {
      throw new FinanceError(400, 'La cuenta o caja de origen y destino deben ser distintas.');
    }

    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const previous = await tx.financeInternalTransfer.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } },
      });
      if (previous) {
        if (previous.requestHash !== hash) throw new FinanceError(409, 'Clave ya usada para otra transferencia.');
        return { transfer: previous, replay: true };
      }

      const id = crypto.randomUUID();
      const desc = `Transferencia interna · ${input.reference} (${input.fromAccountCode} -> ${input.toAccountCode})`;

      // DEBE Cuenta Destino / HABER Cuenta Origen
      const posted = await this.ledger.recordEntry(tx, tenantId, actorId, 'transfer:' + id, {
        date: input.date,
        description: desc,
        lines: [
          { accountCode: input.toAccountCode, debit: amount.toString(), credit: '0' },
          { accountCode: input.fromAccountCode, debit: '0', credit: amount.toString() },
        ],
      });

      const transfer = await tx.financeInternalTransfer.create({
        data: {
          id,
          tenantId,
          fromAccountCode: input.fromAccountCode,
          fromCashBoxId: input.fromCashBoxId || null,
          toAccountCode: input.toAccountCode,
          toCashBoxId: input.toCashBoxId || null,
          entryId: posted.entry.id,
          amount,
          date: new Date(input.date),
          reference: input.reference,
          notes: input.notes || null,
          idempotencyKey: key,
          requestHash: hash,
          createdBy: actorId,
        },
      });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'internal_transfer.record',
          entityId: transfer.id,
          data: { amount: amount.toString(), from: input.fromAccountCode, to: input.toAccountCode },
        },
      });

      return { transfer, replay: false };
    });
  }

  // 5. Solicitudes y Autorizaciones de Pago
  async listPaymentRequests(tenantId: string) {
    const rows = await this.db.financePaymentRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map(r => ({
      ...r,
      amount: r.amount.toString(),
    }));
  }

  async createPaymentRequest(tenantId: string, actorId: string, raw: unknown) {
    const input = paymentRequestSchema.parse(raw);
    const pr = await this.db.financePaymentRequest.create({
      data: {
        tenantId,
        amount: D(input.amount),
        date: new Date(input.date),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        recipient: input.recipient,
        reason: input.reason,
        category: input.category,
        urgency: input.urgency,
        status: 'PENDING',
        requestedBy: actorId,
      },
    });

    await this.db.financeAuditEvent.create({
      data: {
        tenantId,
        actorId,
        action: 'payment_request.create',
        entityId: pr.id,
        data: { amount: input.amount, recipient: input.recipient },
      },
    });

    return { ...pr, amount: pr.amount.toString() };
  }

  async updatePaymentRequestStatus(tenantId: string, actorId: string, id: string, status: 'APPROVED' | 'REJECTED', rejectionReason?: string) {
    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);
      const pr = await tx.financePaymentRequest.findFirst({ where: { id, tenantId } });
      if (!pr) throw new FinanceError(404, 'Solicitud de pago no encontrada.');
      if (pr.status !== 'PENDING') throw new FinanceError(409, 'Solo se pueden aprobar o rechazar solicitudes pendientes.');

      const updated = await tx.financePaymentRequest.update({
        where: { id },
        data: {
          status,
          approvedBy: status === 'APPROVED' ? actorId : null,
          approvedAt: status === 'APPROVED' ? new Date() : null,
          rejectionReason: status === 'REJECTED' ? rejectionReason || null : null,
        },
      });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'payment_request.' + status.toLowerCase(),
          entityId: id,
          data: { status, rejectionReason },
        },
      });

      return { ...updated, amount: updated.amount.toString() };
    });
  }

  // 6. Control de Liquidez y Proyección de Flujo de Caja
  async getLiquidityAndProjection(tenantId: string) {
    const todayStr = formatSiiTimestamp().slice(0, 10);
    const today = new Date(todayStr);

    // Saldos reales actuales de Cajas y Bancos
    const cashLines = await this.db.financeEntryLine.groupBy({
      by: ['accountCode'],
      where: {
        entry: { tenantId },
        accountCode: { in: ['110110', '110120', '110210'] },
      },
      _sum: { debit: true, credit: true },
    });

    let totalCash = new Prisma.Decimal(0);
    let totalBank = new Prisma.Decimal(0);

    for (const line of cashLines) {
      const net = (line._sum.debit || new Prisma.Decimal(0)).minus(line._sum.credit || new Prisma.Decimal(0));
      if (line.accountCode === '110210') totalBank = totalBank.plus(net);
      else totalCash = totalCash.plus(net);
    }
    const currentLiquidity = totalCash.plus(totalBank);

    // Cobros proyectados a 30 días (CxC pendientes)
    const receivables = await this.db.financeReceivable.findMany({
      where: { tenantId },
      include: {
        receipts: { include: { reversals: true } },
        invoiceAllocations: { include: { reversals: true } },
        creditAllocations: { include: { reversals: true } },
      },
    });

    let arNext7 = new Prisma.Decimal(0);
    let arNext15 = new Prisma.Decimal(0);
    let arNext30 = new Prisma.Decimal(0);

    const d7 = new Date(today.getTime() + 7 * 86400000);
    const d15 = new Date(today.getTime() + 15 * 86400000);
    const d30 = new Date(today.getTime() + 30 * 86400000);

    for (const r of receivables) {
      let bal = r.amount;
      for (const rec of r.receipts) {
        if (!rec.reversals.length) bal = bal.minus(rec.amount);
      }
      for (const alloc of r.invoiceAllocations) {
        if (!alloc.reversals.length) bal = bal.minus(alloc.amount);
      }
      for (const alloc of r.creditAllocations) {
        if (!alloc.reversals.length) bal = bal.plus(alloc.amount);
      }

      if (bal.gt(0)) {
        const due = r.dueDate || r.date;
        if (due <= d7) arNext7 = arNext7.plus(bal);
        if (due <= d15) arNext15 = arNext15.plus(bal);
        if (due <= d30) arNext30 = arNext30.plus(bal);
      }
    }

    // Pagos comprometidos a 30 días (CxP pendientes)
    const payables = await this.db.financePayable.findMany({
      where: { tenantId, kind: 'DEBT', status: { not: 'PAGADO' } },
      include: {
        payments: { include: { reversals: true } },
        invoiceAllocations: { include: { reversals: true } },
      },
    });

    let apNext7 = new Prisma.Decimal(0);
    let apNext15 = new Prisma.Decimal(0);
    let apNext30 = new Prisma.Decimal(0);

    for (const p of payables) {
      let bal = p.totalAmount;
      for (const pay of p.payments) {
        if (!pay.reversals.length) bal = bal.minus(pay.amount);
      }
      for (const alloc of p.invoiceAllocations) {
        if (!alloc.reversals.length) bal = bal.minus(alloc.amount);
      }
      if (bal.gt(0)) {
        const due = p.scheduledDate || p.dueDate || p.date;
        if (due <= d7) apNext7 = apNext7.plus(bal);
        if (due <= d15) apNext15 = apNext15.plus(bal);
        if (due <= d30) apNext30 = apNext30.plus(bal);
      }
    }

    return {
      asOf: todayStr,
      liquidity: {
        totalCash: totalCash.toString(),
        totalBank: totalBank.toString(),
        totalLiquidity: currentLiquidity.toString(),
      },
      projection: {
        next7Days: {
          inflow: arNext7.toString(),
          outflow: apNext7.toString(),
          net: arNext7.minus(apNext7).toString(),
          projectedLiquidity: currentLiquidity.plus(arNext7).minus(apNext7).toString(),
        },
        next15Days: {
          inflow: arNext15.toString(),
          outflow: apNext15.toString(),
          net: arNext15.minus(apNext15).toString(),
          projectedLiquidity: currentLiquidity.plus(arNext15).minus(apNext15).toString(),
        },
        next30Days: {
          inflow: arNext30.toString(),
          outflow: apNext30.toString(),
          net: arNext30.minus(apNext30).toString(),
          projectedLiquidity: currentLiquidity.plus(arNext30).minus(apNext30).toString(),
        },
      },
    };
  }
}
