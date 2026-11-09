import crypto from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ODOO_CL_CHART_OF_ACCOUNTS } from '../services/odoo-accounting-engine.service';

export class FinanceError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}
export const monthSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);
export const dateSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])-\d{2}$/).refine(
  s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
  'Fecha inexistente',
);
export const moneySchema = z.string().regex(/^(0|[1-9]\d{0,17})$/, 'Usa pesos CLP enteros, sin separadores');
export const entrySchema = z.object({
  date: dateSchema,
  description: z.string().trim().min(3).max(250),
  lines: z.array(z.object({ accountCode: z.string().min(1).max(16), debit: moneySchema, credit: moneySchema, costCenterId: z.string().uuid().optional() }).strict()).min(2).max(200),
}).strict();
export type EntryInput = z.infer<typeof entrySchema>;
export const keySchema = z.string().trim().min(1).max(200);
const decimal = (value: string) => new Prisma.Decimal(value);
const hash = (data: unknown) => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

/** Ejecuta las restricciones diferidas antes de devolver éxito al cliente. */
export async function financeTransaction<T>(db: PrismaClient, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(async tx => {
    const result = await work(tx);
    await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
    return result;
  });
}

export class FinanceLedger {
  constructor(private readonly db: PrismaClient) {}

  async openPeriod(tenantId: string, actorId: string, month: string) {
    monthSchema.parse(month);
    return financeTransaction(this.db, async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
      const existing = await tx.financePeriod.findUnique({ where: { tenantId_month: { tenantId, month } } });
      if (existing?.closedAt) throw new FinanceError(409, 'El período ya está cerrado y no puede reabrirse por esta operación.');
      if (existing) return existing;
      const period = await tx.financePeriod.create({ data: { tenantId, month } });
      await tx.financeAuditEvent.create({ data: { tenantId, actorId, action: 'period.open', entityId: period.id, data: { month } } });
      return period;
    });
  }

  async post(tenantId: string, actorId: string, key: string, raw: unknown) {
    const input = entrySchema.parse(raw);
    keySchema.parse(key);
    return financeTransaction(this.db, tx => this.postInside(tx, tenantId, actorId, key, input));
  }

  private async postInside(tx: Prisma.TransactionClient, tenantId: string, actorId: string, key: string, input: EntryInput, reversesId?: string, sourceDocumentId?: string, sourceOperationId?: string) {
    const requestHash = hash({ ...input, reversesId, sourceDocumentId, sourceOperationId });
    // El bloqueo por empresa evita carreras de idempotencia, publicación, reversión y cierre.
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
    const previous = await tx.financeEntry.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: key } }, include: { lines: true } });
    if (previous) {
      if (previous.requestHash !== requestHash) throw new FinanceError(409, 'La clave ya se usó para otra operación.');
      return { entry: previous, replay: true };
    }
    const period = await tx.financePeriod.findUnique({ where: { tenantId_month: { tenantId, month: input.date.slice(0, 7) } } });
    if (!period || period.closedAt) throw new FinanceError(409, 'El período no existe o está cerrado.');
    const custom = await tx.financeCustomAccount.findMany({ where: { tenantId, isActive: true }, select: { code: true } });
    const accounts = new Set([...ODOO_CL_CHART_OF_ACCOUNTS.map(a => a.code), ...custom.map(c => c.code)]);
    let debit = decimal('0'), credit = decimal('0');
    for (const line of input.lines) {
      if (!accounts.has(line.accountCode)) throw new FinanceError(400, 'Cuenta contable desconocida: ' + line.accountCode);
      const d = decimal(line.debit), c = decimal(line.credit);
      if ((d.isZero() && c.isZero()) || (d.gt(0) && c.gt(0))) throw new FinanceError(400, 'Cada línea debe tener solo un debe o un haber positivo.');
      debit = debit.plus(d); credit = credit.plus(c);
    }
    if (!debit.equals(credit)) throw new FinanceError(400, 'El asiento no cuadra: debe y haber deben coincidir.');
    const entry = await tx.financeEntry.create({ data: {
      tenantId, periodId: period.id, date: new Date(input.date), description: input.description,
      idempotencyKey: key, requestHash, createdBy: actorId, reversesId, sourceDocumentId, sourceOperationId,
      lines: { create: input.lines.map(l => ({ ...l, debit: decimal(l.debit), credit: decimal(l.credit), costCenterId: l.costCenterId || null })) },
    }, include: { lines: true } });
    await tx.financeAuditEvent.create({ data: { tenantId, actorId, action: reversesId ? 'entry.reverse' : 'entry.post', entityId: entry.id, data: { periodId: period.id, total: debit.toFixed(0), reversesId: reversesId ?? null } } });
    return { entry, replay: false };
  }

  /** Operaciones de cartera y su asiento comparten la transacción del servicio. */
  async recordEntry(tx: Prisma.TransactionClient, tenantId: string, actorId: string, key: string, raw: unknown, reversesId?: string) {
    keySchema.parse(key);
    return this.postInside(tx, tenantId, actorId, key, entrySchema.parse(raw), reversesId);
  }

  async recordOperation(tx: Prisma.TransactionClient, tenantId: string, actorId: string, operationId: string, raw: unknown, reversesId?: string) {
    z.string().uuid().parse(operationId);
    return this.postInside(tx, tenantId, actorId, 'operation:' + operationId, entrySchema.parse(raw), reversesId, undefined, operationId);
  }

  async postDocument(tenantId: string, actorId: string, documentId: string) {
    z.string().uuid().parse(documentId);
    return financeTransaction(this.db, async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
      const doc = await tx.documentoDTE.findFirst({ where: { id: documentId, tenantId } });
      if (!doc) throw new FinanceError(404, 'Documento no encontrado en esta empresa.');
      if (!['ACEPTADO', 'ACEPTADO_CON_REPARO'].includes(doc.estado)) throw new FinanceError(409, 'Solo se centralizan DTE aceptados.');
      if (![33, 34, 39, 41, 56, 61].includes(doc.tipoDte)) throw new FinanceError(422, 'Tipo de documento sin regla contable verificada.');
      if (doc.mntTotal === 0 && doc.tipoDte === 61) {
        const references = Array.isArray(doc.referenciasJson) ? doc.referenciasJson : [];
        const textOnly = references.some(r => r && typeof r === 'object' && !Array.isArray(r) && r.CodRef === 2);
        if (!textOnly || doc.mntNeto !== 0 || doc.mntExento !== 0 || doc.iva !== 0) {
          throw new FinanceError(422, 'La nota sin monto debe corresponder a una corrección de texto.');
        }
        await tx.financePostingJob.updateMany({ where: { documentId, tenantId }, data: { state: 'SKIPPED', lastError: null } });
        return { entry: null, replay: false, skipped: true };
      }
      const values = [doc.mntNeto, doc.mntExento, doc.iva, doc.mntTotal];
      if (values.some(v => !Number.isSafeInteger(v) || v < 0) || doc.mntTotal <= 0 || doc.mntNeto + doc.mntExento + doc.iva !== doc.mntTotal) {
        throw new FinanceError(422, 'Totales inconsistentes: revisar el documento antes de centralizar.');
      }
      const creditNote = doc.tipoDte === 61;
      const lines: EntryInput['lines'] = [];
      const line = (accountCode: string, amount: number, debit: boolean) => {
        if (amount) lines.push({ accountCode, debit: debit ? String(amount) : '0', credit: debit ? '0' : String(amount) });
      };
      line('110310', doc.mntTotal, !creditNote);
      line('510110', doc.mntNeto, creditNote);
      line('510120', doc.mntExento, creditNote);
      line('210710', doc.iva, creditNote);
      const result = await this.postInside(tx, tenantId, actorId, 'dte:' + doc.id, {
        date: doc.fechaEmision.toISOString().slice(0, 10), description: 'DTE ' + doc.tipoDte + ' · folio ' + doc.folio, lines,
      }, undefined, doc.id);
      await tx.financeReceivable.upsert({ where: { documentId }, update: {}, create: {
        tenantId, documentId, customerId: doc.receptorId, sourceEntryId: result.entry.id,
        date: doc.fechaEmision, dueDate: doc.fechaVenc,
        amount: new Prisma.Decimal(doc.mntTotal).mul(creditNote ? -1 : 1),
      } });
      await tx.financePostingJob.updateMany({ where: { documentId, tenantId }, data: { state: 'DONE', entryId: result.entry.id, lastError: null } });
      return { ...result, skipped: false };
    });
  }

  async reverse(tenantId: string, actorId: string, id: string, key: string, date: string, reason: string) {
    z.string().uuid().parse(id); keySchema.parse(key); dateSchema.parse(date); z.string().trim().min(3).max(200).parse(reason);
    return financeTransaction(this.db, async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
      const origin = await tx.financeEntry.findFirst({ where: { id, tenantId }, include: { lines: true, reversal: true } });
      if (!origin) throw new FinanceError(404, 'Asiento no encontrado.');
      if (origin.sourceDocumentId) throw new FinanceError(409, 'El asiento proviene de un DTE. Corrígelo mediante el documento tributario correspondiente.');
      if (origin.sourceOperationId) throw new FinanceError(409, 'El asiento proviene de un cobro. Utiliza la reversión del cobro para conservar la cartera.');
      if (origin.reversesId) throw new FinanceError(409, 'No se puede revertir un asiento de reversión.');
      if (origin.reversal && origin.reversal.idempotencyKey !== key) throw new FinanceError(409, 'El asiento ya fue revertido.');
      return this.postInside(tx, tenantId, actorId, key, {
        date, description: 'Reversión: ' + reason,
        lines: origin.lines.map(l => ({ accountCode: l.accountCode, debit: l.credit.toFixed(0), credit: l.debit.toFixed(0) })),
      }, id);
    });
  }

  async closePeriod(tenantId: string, actorId: string, month: string) {
    monthSchema.parse(month);
    return financeTransaction(this.db, async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
      const period = await tx.financePeriod.findUnique({ where: { tenantId_month: { tenantId, month } } });
      if (!period) throw new FinanceError(404, 'Período no encontrado.');
      if (period.closedAt) return period;
      const pendingDocuments = await tx.documentoDTE.count({ where: {
        tenantId, estado: { in: ['ACEPTADO', 'ACEPTADO_CON_REPARO'] }, mntTotal: { gt: 0 },
        fechaEmision: { gte: new Date(month + '-01'), lt: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 1)) },
        financeEntries: { none: {} },
      } });
      if (pendingDocuments) throw new FinanceError(409, 'Hay DTE aceptados pendientes de centralización. Revísalos antes del cierre.');
      const closed = await tx.financePeriod.update({ where: { id: period.id }, data: { closedAt: new Date(), closedBy: actorId } });
      await tx.financeAuditEvent.create({ data: { tenantId, actorId, action: 'period.close', entityId: period.id, data: { month } } });
      return closed;
    });
  }

  async report(tenantId: string, month: string) {
    monthSchema.parse(month);
    const rows = await this.db.financeEntryLine.findMany({ where: { entry: { tenantId, period: { month } } } });
    const accounts = new Map<string, { accountCode: string; name: string; debit: Prisma.Decimal; credit: Prisma.Decimal }>();
    for (const row of rows) {
      const a = accounts.get(row.accountCode) ?? { accountCode: row.accountCode, name: ODOO_CL_CHART_OF_ACCOUNTS.find(a => a.code === row.accountCode)?.name ?? row.accountCode, debit: decimal('0'), credit: decimal('0') };
      a.debit = a.debit.plus(row.debit); a.credit = a.credit.plus(row.credit); accounts.set(row.accountCode, a);
    }
    const result = [...accounts.values()].sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    const debit = result.reduce((a, r) => a.plus(r.debit), decimal('0'));
    const credit = result.reduce((a, r) => a.plus(r.credit), decimal('0'));
    return { month, currency: 'CLP', debit: debit.toFixed(0), credit: credit.toFixed(0), balanced: debit.equals(credit),
      accounts: result.map(a => ({ ...a, debit: a.debit.toFixed(0), credit: a.credit.toFixed(0), balance: a.debit.minus(a.credit).toFixed(0) })) };
  }
}
