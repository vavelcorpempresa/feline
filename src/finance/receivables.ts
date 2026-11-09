import crypto from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { dateSchema, FinanceError, FinanceLedger, financeTransaction, keySchema, moneySchema } from './ledger';
import { formatSiiTimestamp } from '../utils/sii-normative.utils';

const D = (value: string | number | Prisma.Decimal) => new Prisma.Decimal(value);
const uuid = z.string().uuid();
const requestHash = (input: unknown) => crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
export const receiptSchema = z.object({ date: dateSchema, amount: moneySchema,
  method: z.enum(['TRANSFERENCIA', 'EFECTIVO', 'TARJETA', 'OTRO']), reference: z.string().trim().min(1).max(100) }).strict();
export const reversalSchema = z.object({ date: dateSchema, reason: z.string().trim().min(3).max(200) }).strict();
export const allocationSchema = z.object({ creditId: uuid, invoiceId: uuid, amount: moneySchema, date: dateSchema }).strict();
export const listSchema = z.object({ asOf: dateSchema, search: z.string().trim().max(100).default(''),
  customerId: uuid.optional(), kind: z.enum(['all','debt','credit']).default('all'), cursor: uuid.optional() }).strict();

export const includeBalance = {
  document: { select: { estado: true, tipoDte: true, folio: true, accountMove: { select: { payments: { select: { id: true } } } } } },
  receipts: { include: { reversals: true } },
  invoiceAllocations: { include: { reversals: true } },
  creditAllocations: { include: { reversals: true } },
} satisfies Prisma.FinanceReceivableInclude;
type Account = Prisma.FinanceReceivableGetPayload<{ include: typeof includeBalance }>;

/** Saldo exacto a una fecha; las anulaciones son eventos nuevos, no ediciones históricas. */
export function balance(row: Account, asOf = '9999-12-31') {
  const applies = (date: Date) => date.toISOString().slice(0, 10) <= asOf;
  let result = row.amount;
  for (const receipt of row.receipts) {
    if (applies(receipt.date)) result = result.minus(receipt.amount);
    if (receipt.reversals.some(r => applies(r.date))) result = result.plus(receipt.amount);
  }
  for (const allocation of row.invoiceAllocations) {
    if (applies(allocation.date)) result = result.minus(allocation.amount);
    if (allocation.reversals.some(r => applies(r.date))) result = result.plus(allocation.amount);
  }
  for (const allocation of row.creditAllocations) {
    if (applies(allocation.date)) result = result.plus(allocation.amount);
    if (allocation.reversals.some(r => applies(r.date))) result = result.minus(allocation.amount);
  }
  return result;
}
function validateDate(row: Account, date: string) {
  const dates = [row.date, ...row.receipts.flatMap(r => [r.date, ...r.reversals.map(v => v.date)]),
    ...[...row.invoiceAllocations, ...row.creditAllocations].flatMap(a => [a.date, ...a.reversals.map(v => v.date)])];
  const latest = dates.reduce((a, d) => d > a ? d : a).toISOString().slice(0, 10);
  if (date < latest) throw new FinanceError(409, 'La fecha debe ser igual o posterior al último movimiento del documento.');
  if (date > formatSiiTimestamp().slice(0, 10)) throw new FinanceError(400, 'No se pueden registrar cobros o aplicaciones futuros como realizados.');
}
function checkLegacy(row: Account) {
  if (row.document.accountMove?.payments.length) throw new FinanceError(409, 'El documento tiene pagos anteriores pendientes de conciliar con este libro. Revísalo antes de registrar otro movimiento.');
}

export class FinanceReceivables {
  private readonly ledger: FinanceLedger;
  constructor(private readonly db: PrismaClient) { this.ledger = new FinanceLedger(db); }
  private async lock(tx: Prisma.TransactionClient, tenantId: string) {
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
  }
  private async account(tx: Prisma.TransactionClient, tenantId: string, id: string) {
    const row = await tx.financeReceivable.findFirst({ where: { id, tenantId }, include: includeBalance });
    if (!row) throw new FinanceError(404, 'Documento de cartera no encontrado en esta empresa.');
    return row;
  }
  private async openPeriod(tx: Prisma.TransactionClient, tenantId: string, date: string) {
    const period = await tx.financePeriod.findUnique({ where: { tenantId_month: { tenantId, month: date.slice(0, 7) } } });
    if (!period || period.closedAt) throw new FinanceError(409, 'El período de la operación no existe o está cerrado.');
  }
  async receive(tenantId: string, actorId: string, receivableId: string, key: string, raw: unknown) {
    uuid.parse(receivableId); key = keySchema.parse(key);
    const input = receiptSchema.parse(raw), hash = requestHash({ receivableId, ...input });
    if (!D(input.amount).gt(0)) throw new FinanceError(400, 'El cobro debe ser mayor a cero.');
    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);
      const previous = await tx.financeReceipt.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } } });
      if (previous) {
        if (previous.requestHash !== hash) throw new FinanceError(409, 'La clave ya se usó para otro cobro.');
        return { receipt: previous, replay: true };
      }
      const row = await this.account(tx, tenantId, receivableId);
      checkLegacy(row); validateDate(row, input.date);
      if (!row.amount.gt(0) || ['ANULADO', 'RECHAZADO'].includes(row.document.estado)) throw new FinanceError(409, 'Este documento no admite cobros. Revisa sus notas de crédito.');
      if (D(input.amount).gt(balance(row))) throw new FinanceError(409, 'El cobro supera el saldo pendiente del documento.');
      const id = crypto.randomUUID();
      const posted = await this.ledger.recordOperation(tx, tenantId, actorId, id, {
        date: input.date, description: 'Cobro DTE ' + row.document.tipoDte + ' · folio ' + row.document.folio + ' · ' + input.reference,
        lines: [{ accountCode: '110110', debit: input.amount, credit: '0' }, { accountCode: '110310', debit: '0', credit: input.amount }],
      });
      const receipt = await tx.financeReceipt.create({ data: { id, tenantId, receivableId, entryId: posted.entry.id,
        ...input, date: new Date(input.date), amount: D(input.amount), idempotencyKey: key, requestHash: hash, createdBy: actorId } });
      await tx.financeAuditEvent.create({ data: { tenantId, actorId, action: 'receipt.register', entityId: receipt.id,
        data: { receivableId, amount: input.amount, entryId: posted.entry.id } } });
      return { receipt, replay: false };
    });
  }
  async reverseReceipt(tenantId: string, actorId: string, receiptId: string, key: string, raw: unknown) {
    uuid.parse(receiptId); key = keySchema.parse(key);
    const input = reversalSchema.parse(raw), hash = requestHash({ receiptId, ...input });
    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);
      const previous = await tx.financeReceiptReversal.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } } });
      if (previous) {
        if (previous.requestHash !== hash) throw new FinanceError(409, 'La clave ya se usó para otra reversión.');
        return { reversal: previous, replay: true };
      }
      const receipt = await tx.financeReceipt.findFirst({ where: { id: receiptId, tenantId }, include: { reversals: true } });
      if (!receipt) throw new FinanceError(404, 'Cobro no encontrado.');
      if (receipt.reversals.length) throw new FinanceError(409, 'El cobro ya fue revertido.');
      const row = await this.account(tx, tenantId, receipt.receivableId); validateDate(row, input.date);
      const id = crypto.randomUUID(), amount = receipt.amount.toFixed(0);
      const posted = await this.ledger.recordOperation(tx, tenantId, actorId, id, { date: input.date,
        description: 'Reversión de cobro · ' + input.reason,
        lines: [{ accountCode: '110310', debit: amount, credit: '0' }, { accountCode: '110110', debit: '0', credit: amount }],
      }, receipt.entryId);
      const reversal = await tx.financeReceiptReversal.create({ data: { id, tenantId, receiptId, entryId: posted.entry.id,
        ...input, date: new Date(input.date), idempotencyKey: key, requestHash: hash, createdBy: actorId } });
      await tx.financeAuditEvent.create({ data: { tenantId, actorId, action: 'receipt.reverse', entityId: reversal.id,
        data: { receiptId, amount, entryId: posted.entry.id, reason: input.reason } } });
      return { reversal, replay: false };
    });
  }
  async allocateCredit(tenantId: string, actorId: string, key: string, raw: unknown) {
    key = keySchema.parse(key);
    const input = allocationSchema.parse(raw), hash = requestHash(input);
    if (!D(input.amount).gt(0)) throw new FinanceError(400, 'La aplicación debe ser mayor a cero.');
    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);
      const previous = await tx.financeCreditAllocation.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } } });
      if (previous) {
        if (previous.requestHash !== hash) throw new FinanceError(409, 'La clave ya se usó para otra aplicación.');
        return { allocation: previous, replay: true };
      }
      const credit = await this.account(tx, tenantId, input.creditId), invoice = await this.account(tx, tenantId, input.invoiceId);
      checkLegacy(credit); checkLegacy(invoice);
      if (['ANULADO', 'RECHAZADO'].includes(credit.document.estado)) throw new FinanceError(409, 'La nota de crédito requiere revisión antes de aplicarse.');
      if (!credit.amount.lt(0) || !invoice.amount.gt(0) || credit.customerId !== invoice.customerId) throw new FinanceError(400, 'Selecciona una nota de crédito y una deuda del mismo cliente.');
      validateDate(credit, input.date); validateDate(invoice, input.date); await this.openPeriod(tx, tenantId, input.date);
      if (D(input.amount).gt(balance(credit).negated()) || D(input.amount).gt(balance(invoice))) throw new FinanceError(409, 'La aplicación supera el crédito disponible o la deuda pendiente.');
      const allocation = await tx.financeCreditAllocation.create({ data: { tenantId, ...input, date: new Date(input.date), amount: D(input.amount),
        idempotencyKey: key, requestHash: hash, createdBy: actorId } });
      await tx.financeAuditEvent.create({ data: { tenantId, actorId, action: 'credit.allocate', entityId: allocation.id,
        data: { creditId: credit.id, invoiceId: invoice.id, amount: input.amount } } });
      return { allocation, replay: false };
    });
  }
  async reverseAllocation(tenantId: string, actorId: string, allocationId: string, key: string, raw: unknown) {
    uuid.parse(allocationId); key = keySchema.parse(key);
    const input = reversalSchema.parse(raw), hash = requestHash({ allocationId, ...input });
    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);
      const previous = await tx.financeCreditAllocationReversal.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } } });
      if (previous) {
        if (previous.requestHash !== hash) throw new FinanceError(409, 'La clave ya se usó para otra reversión.');
        return { reversal: previous, replay: true };
      }
      const allocation = await tx.financeCreditAllocation.findFirst({ where: { id: allocationId, tenantId }, include: { reversals: true } });
      if (!allocation) throw new FinanceError(404, 'Aplicación no encontrada.');
      if (allocation.reversals.length) throw new FinanceError(409, 'La aplicación ya fue revertida.');
      validateDate(await this.account(tx, tenantId, allocation.creditId), input.date);
      validateDate(await this.account(tx, tenantId, allocation.invoiceId), input.date);
      await this.openPeriod(tx, tenantId, input.date);
      const reversal = await tx.financeCreditAllocationReversal.create({ data: { tenantId, allocationId, ...input, date: new Date(input.date),
        idempotencyKey: key, requestHash: hash, createdBy: actorId } });
      await tx.financeAuditEvent.create({ data: { tenantId, actorId, action: 'credit.reverse', entityId: reversal.id,
        data: { allocationId, reason: input.reason } } });
      return { reversal, replay: false };
    });
  }
  async detail(tenantId: string, id: string) {
    uuid.parse(id);
    return this.db.$transaction(async tx => {
      const row = await this.account(tx, tenantId, id);
      return { id: row.id, customerId: row.customerId, amount: row.amount.toFixed(0), balance: balance(row).toFixed(0),
        legacyPayments: !!row.document.accountMove?.payments.length,
        receipts: row.receipts.map(r => ({ id: r.id, amount: r.amount.toFixed(0), date: r.date, method: r.method, reference: r.reference, reversal: r.reversals[0] ? { date: r.reversals[0].date, reason: r.reversals[0].reason } : null })),
        allocations: [...row.invoiceAllocations, ...row.creditAllocations].map(a => ({ id: a.id, creditId: a.creditId, invoiceId: a.invoiceId, amount: a.amount.toFixed(0), date: a.date, reversal: a.reversals[0] ? { date: a.reversals[0].date, reason: a.reversals[0].reason } : null })),
      };
    }, { isolationLevel: 'RepeatableRead' });
  }
}

interface BalanceRow {
  id: string; documentId: string; customerId: string; customerName: string; customerRut: string;
  date: Date; dueDate: Date | null; documentType: number; folio: number; documentStatus: string;
  amount: string; balance: string; legacyPayments: boolean;
}
interface Summary {
  count: number; net: string; pending: string; credits: string; notDue: string;
  overdue30: string; overdue60: string; overdue90: string; overdueMore: string; withoutDueDate: string; reviewCount: number;
}
function balanceQuery(tenantId: string, asOf: string, search: string, customerId: string | undefined, kind: 'all' | 'debt' | 'credit') {
  const pattern = '%' + search.replace(/[!%_]/g, c => '!' + c) + '%';
  return Prisma.sql`WITH movements AS (
    SELECT r."receivableId" AS id, -r.amount AS delta FROM "FinanceReceipt" r
      WHERE r."tenantId"=${tenantId}::uuid AND r.date<=${asOf}::date
    UNION ALL SELECT r."receivableId", r.amount FROM "FinanceReceiptReversal" v JOIN "FinanceReceipt" r ON r.id=v."receiptId"
      WHERE v."tenantId"=${tenantId}::uuid AND v.date<=${asOf}::date
    UNION ALL SELECT a."invoiceId", -a.amount FROM "FinanceCreditAllocation" a
      WHERE a."tenantId"=${tenantId}::uuid AND a.date<=${asOf}::date
    UNION ALL SELECT a."creditId", a.amount FROM "FinanceCreditAllocation" a
      WHERE a."tenantId"=${tenantId}::uuid AND a.date<=${asOf}::date
    UNION ALL SELECT a."invoiceId", a.amount FROM "FinanceCreditAllocationReversal" v JOIN "FinanceCreditAllocation" a ON a.id=v."allocationId"
      WHERE v."tenantId"=${tenantId}::uuid AND v.date<=${asOf}::date
    UNION ALL SELECT a."creditId", -a.amount FROM "FinanceCreditAllocationReversal" v JOIN "FinanceCreditAllocation" a ON a.id=v."allocationId"
      WHERE v."tenantId"=${tenantId}::uuid AND v.date<=${asOf}::date
  ), balances AS (
    SELECT a.id, a."documentId", a."customerId", a.date, a."dueDate", a.amount,
      c."razonSocial" AS "customerName", c.rut AS "customerRut", d."tipoDte" AS "documentType", d.folio,
      d.estado AS "documentStatus", a.amount+COALESCE(sum(m.delta),0) AS balance,
      EXISTS(SELECT 1 FROM account_moves am JOIN account_payments p ON p."moveId"=am.id WHERE am."documentoDteId"=a."documentId") AS "legacyPayments"
    FROM "FinanceReceivable" a JOIN clientes_receptores c ON c.id=a."customerId"
    JOIN documentos_dte d ON d.id=a."documentId" LEFT JOIN movements m ON m.id=a.id
    WHERE a."tenantId"=${tenantId}::uuid AND a.date<=${asOf}::date
    ${customerId ? Prisma.sql`AND a."customerId"=${customerId}::uuid` : Prisma.empty}
    ${search ? Prisma.sql`AND (c."razonSocial" ILIKE ${pattern} ESCAPE '!' OR c.rut ILIKE ${pattern} ESCAPE '!' OR d.folio::text=${search})` : Prisma.empty}
    GROUP BY a.id,c.id,d.id
  ), visible AS (SELECT * FROM balances ${kind === 'credit' ? Prisma.sql`WHERE amount<0 AND balance<0` : kind === 'debt' ? Prisma.sql`WHERE amount>0 AND balance>0` : Prisma.empty})`;
}
export async function listReceivables(db: PrismaClient, tenantId: string, raw: unknown) {
  const q = listSchema.parse(raw), query = balanceQuery(tenantId, q.asOf, q.search, q.customerId, q.kind);
  return db.$transaction(async tx => {
    const rows = await tx.$queryRaw<BalanceRow[]>(Prisma.sql`${query}
      SELECT id,"documentId","customerId","customerName","customerRut",date,"dueDate","documentType",folio,"documentStatus",
        amount::text, balance::text,"legacyPayments" FROM visible
      ${q.cursor ? Prisma.sql`WHERE id>${q.cursor}::uuid` : Prisma.empty} ORDER BY id LIMIT 51`);
    const [summary] = await tx.$queryRaw<Summary[]>(Prisma.sql`${query}
      SELECT count(*)::int AS count, count(*) FILTER(WHERE "legacyPayments")::int AS "reviewCount", COALESCE(sum(balance),0)::text AS net,
      COALESCE(sum(balance) FILTER(WHERE amount>0 AND balance>0),0)::text AS pending,
      COALESCE(-sum(balance) FILTER(WHERE amount<0 AND balance<0),0)::text AS credits,
      COALESCE(sum(balance) FILTER(WHERE amount>0 AND balance>0 AND "dueDate">=${q.asOf}::date),0)::text AS "notDue",
      COALESCE(sum(balance) FILTER(WHERE amount>0 AND balance>0 AND ${q.asOf}::date-"dueDate" BETWEEN 1 AND 30),0)::text AS "overdue30",
      COALESCE(sum(balance) FILTER(WHERE amount>0 AND balance>0 AND ${q.asOf}::date-"dueDate" BETWEEN 31 AND 60),0)::text AS "overdue60",
      COALESCE(sum(balance) FILTER(WHERE amount>0 AND balance>0 AND ${q.asOf}::date-"dueDate" BETWEEN 61 AND 90),0)::text AS "overdue90",
      COALESCE(sum(balance) FILTER(WHERE amount>0 AND balance>0 AND ${q.asOf}::date-"dueDate">90),0)::text AS "overdueMore",
      COALESCE(sum(balance) FILTER(WHERE amount>0 AND balance>0 AND "dueDate" IS NULL),0)::text AS "withoutDueDate" FROM visible`);
    let reconciliation: { ledger: string; subledger: string; difference: string } | null = null;
    if (!q.search && !q.customerId && q.kind === 'all') {
      const aggregate = await tx.financeEntryLine.aggregate({ where: { accountCode: '110310', entry: { tenantId, date: { lte: new Date(q.asOf) } } }, _sum: { debit: true, credit: true } });
      const ledger = D(aggregate._sum.debit ?? 0).minus(aggregate._sum.credit ?? 0);
      reconciliation = { ledger: ledger.toFixed(0), subledger: summary.net, difference: ledger.minus(summary.net).toFixed(0) };
    }
    const more = rows.length > 50; if (more) rows.pop();
    return { asOf: q.asOf, summary, reconciliation, items: rows, nextCursor: more ? rows[rows.length - 1].id : null };
  }, { isolationLevel: 'RepeatableRead' });
}
