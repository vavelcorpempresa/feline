import crypto from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { dateSchema, FinanceError, FinanceLedger, financeTransaction, keySchema, moneySchema } from './ledger';
import { formatSiiTimestamp } from '../utils/sii-normative.utils';

const D = (value: string | number | Prisma.Decimal) => new Prisma.Decimal(value);
const uuid = z.string().uuid();
const requestHash = (input: unknown) => crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');

export const positiveMoneySchema = moneySchema.refine(v => BigInt(v) > 0n, 'El monto debe ser mayor a cero');

export const CHILEAN_BANKS = [
  { code: 'CHILE', name: 'Banco de Chile / Banco Edwards' },
  { code: 'SANTANDER', name: 'Banco Santander Chile' },
  { code: 'BCI', name: 'Banco de Crédito e Inversiones (BCI)' },
  { code: 'ESTADO', name: 'Banco del Estado de Chile' },
  { code: 'SCOTIABANK', name: 'Scotiabank Chile' },
  { code: 'ITAU', name: 'Banco Itaú Chile' },
  { code: 'SECURITY', name: 'Banco Security' },
  { code: 'BICE', name: 'Banco BICE' },
  { code: 'FALABELLA', name: 'Banco Falabella' },
  { code: 'CONSORCIO', name: 'Banco Consorcio' },
  { code: 'RIPLEY', name: 'Banco Ripley' },
  { code: 'OTRO', name: 'Otro / Medio de Pago Digital' },
] as const;

export const bankAccountSchema = z.object({
  bankCode: z.string().min(2).max(20),
  bankName: z.string().trim().min(2).max(80),
  accountType: z.enum(['CORRIENTE', 'VISTA', 'AHORRO']).default('CORRIENTE'),
  accountNumber: z.string().trim().min(3).max(40),
  currency: z.string().trim().min(3).max(10).default('CLP'),
  accountCode: z.string().min(1).max(16).default('110210'),
  initialBalance: moneySchema.default('0'),
  initialDate: dateSchema.optional(),
  isActive: z.boolean().default(true),
}).strict();

export const bankRuleSchema = z.object({
  name: z.string().trim().min(2).max(100),
  pattern: z.string().trim().min(2).max(150),
  action: z.enum(['AUTO_FEE', 'AUTO_INTEREST', 'DIRECT_EXPENSE']).default('AUTO_FEE'),
  targetAccountCode: z.string().min(1).max(16).default('410210'),
  isActive: z.boolean().default(true),
}).strict();

export const manualReconciliationSchema = z.object({
  statementLineId: uuid,
  matchType: z.enum(['RECEIPT', 'VENDOR_PAYMENT', 'TRANSFER', 'DIRECT_MOVEMENT', 'MANUAL_ENTRY']),
  targetId: uuid, // id del comprobante (receiptId, paymentId, transferId, movementId o entryId)
  notes: z.string().trim().max(250).optional(),
}).strict();

export const adjustmentReconciliationSchema = z.object({
  statementLineId: uuid,
  type: z.enum(['FEE', 'INTEREST', 'DIFFERENCE']),
  targetAccountCode: z.string().min(1).max(16), // 410210 Gastos Bancarios, 520190 Otros Ingresos
  description: z.string().trim().min(3).max(250),
  notes: z.string().trim().max(250).optional(),
}).strict();

export interface ParsedStatementLine {
  transactionDate: string; // YYYY-MM-DD
  valueDate?: string;
  description: string;
  referenceNumber?: string;
  amount: string; // entero CLP (positivo abono, negativo cargo)
  balanceAfter?: string;
  lineHash: string;
}

export class FinanceBanking {
  private readonly ledger: FinanceLedger;
  constructor(private readonly db: PrismaClient) {
    this.ledger = new FinanceLedger(db);
  }

  private async lock(tx: Prisma.TransactionClient, tenantId: string) {
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
  }

  // 1. Maestro de Cuentas Bancarias
  async listBankAccounts(tenantId: string) {
    const accounts = await this.db.financeBankAccount.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    const entries = await this.db.financeEntryLine.groupBy({
      by: ['accountCode'],
      where: { entry: { tenantId } },
      _sum: { debit: true, credit: true },
    });

    const accountLedgerBalances = new Map<string, Prisma.Decimal>();
    for (const e of entries) {
      const net = (e._sum.debit || new Prisma.Decimal(0)).minus(e._sum.credit || new Prisma.Decimal(0));
      accountLedgerBalances.set(e.accountCode, net);
    }

    const statementStats = await this.db.financeBankStatementLine.groupBy({
      by: ['bankAccountId', 'status'],
      where: { tenantId },
      _count: { id: true },
    });

    const statsMap = new Map<string, { pending: number; reconciled: number; total: number }>();
    for (const s of statementStats) {
      const curr = statsMap.get(s.bankAccountId) || { pending: 0, reconciled: 0, total: 0 };
      if (s.status === 'PENDING') curr.pending += s._count.id;
      if (s.status === 'RECONCILED' || s.status === 'ADJUSTED') curr.reconciled += s._count.id;
      curr.total += s._count.id;
      statsMap.set(s.bankAccountId, curr);
    }

    return accounts.map(acc => {
      const stats = statsMap.get(acc.id) || { pending: 0, reconciled: 0, total: 0 };
      const ledgerNet = accountLedgerBalances.get(acc.accountCode) || new Prisma.Decimal(0);
      const calculatedBalance = acc.initialBalance.plus(ledgerNet);

      return {
        ...acc,
        initialBalance: acc.initialBalance.toString(),
        calculatedBalance: calculatedBalance.toString(),
        initialDate: acc.initialDate ? acc.initialDate.toISOString().slice(0, 10) : null,
        stats,
      };
    });
  }

  async saveBankAccount(tenantId: string, actorId: string, raw: unknown, id?: string) {
    const input = bankAccountSchema.parse(raw);
    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const existingNumber = await tx.financeBankAccount.findFirst({
        where: { tenantId, accountNumber: input.accountNumber, ...(id ? { id: { not: id } } : {}) },
      });
      if (existingNumber) {
        throw new FinanceError(409, 'Ya existe una cuenta bancaria con este número.');
      }

      const data = {
        bankCode: input.bankCode,
        bankName: input.bankName,
        accountType: input.accountType,
        accountNumber: input.accountNumber,
        currency: input.currency,
        accountCode: input.accountCode,
        initialBalance: D(input.initialBalance),
        initialDate: input.initialDate ? new Date(input.initialDate) : null,
        isActive: input.isActive,
      };

      const account = id
        ? await tx.financeBankAccount.update({ where: { id }, data })
        : await tx.financeBankAccount.create({ data: { ...data, tenantId } });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: id ? 'bank_account.update' : 'bank_account.create',
          entityId: account.id,
          data: { bankCode: account.bankCode, accountNumber: account.accountNumber },
        },
      });

      return {
        ...account,
        initialBalance: account.initialBalance.toString(),
        initialDate: account.initialDate ? account.initialDate.toISOString().slice(0, 10) : null,
      };
    });
  }

  // 2. Parser de Cartolas Bancarias (CSV chileno y formatos estándar)
  parseStatementText(text: string): ParsedStatementLine[] {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) throw new FinanceError(400, 'El archivo de cartola no contiene suficientes líneas de datos.');

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const header = lines[0].toLowerCase().split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));

    // Detect column indexes
    let dateIdx = header.findIndex(h => h.includes('fecha') || h.includes('date'));
    let descIdx = header.findIndex(h => h.includes('descrip') || h.includes('detalle') || h.includes('glosa') || h.includes('concepto'));
    let refIdx = header.findIndex(h => h.includes('doc') || h.includes('comprobante') || h.includes('ref') || h.includes('cheque') || h.includes('operacion'));
    let amountIdx = header.findIndex(h => h.includes('monto') || h.includes('importe') || h.includes('amount'));
    let debitIdx = header.findIndex(h => h.includes('cargo') || h.includes('debito') || h.includes('debit'));
    let creditIdx = header.findIndex(h => h.includes('abono') || h.includes('credito') || h.includes('credit'));
    let balanceIdx = header.findIndex(h => h.includes('saldo') || h.includes('balance'));

    if (dateIdx === -1) dateIdx = 0;
    if (descIdx === -1) descIdx = 1;

    const parsed: ParsedStatementLine[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rawCols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (rawCols.length < 2) continue;

      const rawDate = rawCols[dateIdx] || '';
      const date = this.normalizeDate(rawDate);
      if (!date) continue; // Skip non-data rows

      const description = rawCols[descIdx] || 'Movimiento bancario';
      const referenceNumber = refIdx >= 0 ? rawCols[refIdx] : undefined;

      let amountStr = '0';
      if (amountIdx >= 0 && rawCols[amountIdx]) {
        amountStr = this.cleanAmount(rawCols[amountIdx]);
      } else if (debitIdx >= 0 || creditIdx >= 0) {
        const debit = debitIdx >= 0 && rawCols[debitIdx] ? this.cleanAmount(rawCols[debitIdx]) : '0';
        const credit = creditIdx >= 0 && rawCols[creditIdx] ? this.cleanAmount(rawCols[creditIdx]) : '0';
        if (BigInt(credit) > 0n) {
          amountStr = credit;
        } else if (BigInt(debit) > 0n) {
          amountStr = (-BigInt(debit)).toString();
        }
      }

      if (BigInt(amountStr) === 0n) continue;

      let balanceAfter: string | undefined = undefined;
      if (balanceIdx >= 0 && rawCols[balanceIdx]) {
        balanceAfter = this.cleanAmount(rawCols[balanceIdx]);
      }

      const lineHash = crypto.createHash('sha256')
        .update(`${date}|${amountStr}|${referenceNumber || ''}|${description}`)
        .digest('hex');

      parsed.push({
        transactionDate: date,
        description,
        referenceNumber: referenceNumber || undefined,
        amount: amountStr,
        balanceAfter,
        lineHash,
      });
    }

    if (parsed.length === 0) {
      throw new FinanceError(400, 'No se encontraron movimientos válidos en el archivo de cartola.');
    }

    return parsed;
  }

  private normalizeDate(raw: string): string | null {
    const trimmed = raw.trim();
    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }
    // YYYY-MM-DD
    const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      return trimmed;
    }
    return null;
  }

  private cleanAmount(raw: string): string {
    // Remove currency signs, quotes and spaces
    let s = raw.replace(/[$"'\s]/g, '');
    const isNegative = s.includes('-') || (s.startsWith('(') && s.endsWith(')'));
    s = s.replace(/[-()]/g, '');

    // Chilean decimal: "12.500,00" or "12500,50"
    if (s.includes(',')) {
      const parts = s.split(',');
      const intPart = parts[0].replace(/\./g, '');
      const decPart = parts[1] || '0';
      const n = Math.round(parseFloat(`${intPart}.${decPart}`) || 0);
      return (isNegative ? -n : n).toString();
    }

    // Thousands separators: "12.500", "1.012.500"
    if (s.includes('.')) {
      s = s.replace(/\./g, '');
    }

    const n = Math.round(parseFloat(s) || 0);
    return (isNegative ? -n : n).toString();
  }

  // 3. Importación y Almacenamiento de Cartolas
  async importStatement(tenantId: string, actorId: string, bankAccountId: string, filename: string, content: string) {
    const fileHash = crypto.createHash('sha256').update(content).digest('hex');
    const parsedLines = this.parseStatementText(content);

    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const bankAccount = await tx.financeBankAccount.findFirst({
        where: { id: bankAccountId, tenantId },
      });
      if (!bankAccount) throw new FinanceError(404, 'Cuenta bancaria no encontrada.');

      const existingStatement = await tx.financeBankStatement.findFirst({
        where: { tenantId, fileHash },
      });
      if (existingStatement) {
        throw new FinanceError(409, 'Esta cartola ya fue importada previamente en el sistema.');
      }

      // Check duplicate lines
      const lineHashes = parsedLines.map(l => l.lineHash);
      const existingLines = await tx.financeBankStatementLine.findMany({
        where: { tenantId, lineHash: { in: lineHashes } },
        select: { lineHash: true },
      });
      const existingSet = new Set(existingLines.map(l => l.lineHash));

      // Calculate totals
      let totalCredits = 0n;
      let totalDebits = 0n;
      let startDate = parsedLines[0].transactionDate;
      let endDate = parsedLines[0].transactionDate;

      for (const l of parsedLines) {
        const amt = BigInt(l.amount);
        if (amt > 0n) totalCredits += amt;
        else totalDebits += -amt;

        if (l.transactionDate < startDate) startDate = l.transactionDate;
        if (l.transactionDate > endDate) endDate = l.transactionDate;
      }

      const statement = await tx.financeBankStatement.create({
        data: {
          tenantId,
          bankAccountId,
          filename,
          fileHash,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          totalCredits: D(totalCredits.toString()),
          totalDebits: D(totalDebits.toString()),
          openingBalance: parsedLines[0]?.balanceAfter ? D(parsedLines[0].balanceAfter) : null,
          closingBalance: parsedLines[parsedLines.length - 1]?.balanceAfter ? D(parsedLines[parsedLines.length - 1].balanceAfter!) : null,
          lineCount: parsedLines.length,
          importedBy: actorId,
        },
      });

      let insertedCount = 0;
      let duplicateCount = 0;

      for (const line of parsedLines) {
        if (existingSet.has(line.lineHash)) {
          duplicateCount++;
          continue;
        }

        await tx.financeBankStatementLine.create({
          data: {
            tenantId,
            statementId: statement.id,
            bankAccountId,
            transactionDate: new Date(line.transactionDate),
            description: line.description,
            referenceNumber: line.referenceNumber || null,
            amount: D(line.amount),
            balanceAfter: line.balanceAfter ? D(line.balanceAfter) : null,
            lineHash: line.lineHash,
            status: 'PENDING',
          },
        });
        insertedCount++;
      }

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'bank_statement.import',
          entityId: statement.id,
          data: { filename, insertedCount, duplicateCount, totalCredits: totalCredits.toString(), totalDebits: totalDebits.toString() },
        },
      });

      return {
        statementId: statement.id,
        filename,
        totalLines: parsedLines.length,
        insertedCount,
        duplicateCount,
        startDate,
        endDate,
        totalCredits: totalCredits.toString(),
        totalDebits: totalDebits.toString(),
      };
    });
  }

  // 4. Listado de Movimientos de Cartola con Filtros y Estado
  async listStatementLines(tenantId: string, bankAccountId: string, query: {
    status?: string;
    search?: string;
    cursor?: string;
  }) {
    const where: Prisma.FinanceBankStatementLineWhereInput = {
      tenantId,
      bankAccountId,
      ...(query.status && query.status !== 'ALL' ? { status: query.status } : {}),
      ...(query.search ? {
        OR: [
          { description: { contains: query.search, mode: 'insensitive' } },
          { referenceNumber: { contains: query.search, mode: 'insensitive' } },
        ],
      } : {}),
    };

    const lines = await this.db.financeBankStatementLine.findMany({
      where,
      orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
      take: 51,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        reconciliation: {
          include: {
            reversals: { orderBy: { reversedAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    const hasMore = lines.length > 50;
    if (hasMore) lines.pop();

    return {
      items: lines.map(l => ({
        id: l.id,
        statementId: l.statementId,
        bankAccountId: l.bankAccountId,
        transactionDate: l.transactionDate.toISOString().slice(0, 10),
        description: l.description,
        referenceNumber: l.referenceNumber,
        amount: l.amount.toString(),
        balanceAfter: l.balanceAfter ? l.balanceAfter.toString() : null,
        status: l.status,
        reconciliation: l.reconciliation ? {
          id: l.reconciliation.id,
          matchType: l.reconciliation.matchType,
          targetEntryId: l.reconciliation.targetEntryId,
          notes: l.reconciliation.notes,
          reconciledAt: l.reconciliation.reconciledAt.toISOString(),
          isActive: l.reconciliation.isActive,
          reversal: l.reconciliation.reversals[0] ? {
            reason: l.reconciliation.reversals[0].reason,
            reversedAt: l.reconciliation.reversals[0].reversedAt.toISOString(),
          } : null,
        } : null,
      })),
      nextCursor: hasMore ? lines[lines.length - 1].id : null,
    };
  }

  // 5. Búsqueda de Candidatos para Conciliación Inteligente
  async findCandidates(tenantId: string, statementLineId: string) {
    const line = await this.db.financeBankStatementLine.findFirst({
      where: { id: statementLineId, tenantId },
    });
    if (!line) throw new FinanceError(404, 'Movimiento de cartola no encontrado.');

    const lineAmount = BigInt(line.amount.toString());
    const isCredit = lineAmount > 0n; // Abono (cobro o ingreso)
    const absAmount = isCredit ? lineAmount : -lineAmount;
    const dateStr = line.transactionDate.toISOString().slice(0, 10);

    const candidates: Array<{
      type: 'RECEIPT' | 'VENDOR_PAYMENT' | 'TRANSFER' | 'DIRECT_MOVEMENT' | 'LEDGER_ENTRY';
      id: string;
      date: string;
      amount: string;
      description: string;
      reference?: string;
      sourceAccountCode?: string;
    }> = [];

    if (isCredit) {
      // 1. Cobros de clientes (FinanceReceipt)
      const receipts = await this.db.financeReceipt.findMany({
        where: {
          tenantId,
          amount: D(absAmount.toString()),
        },
        include: {
          receivable: { include: { customer: true } },
        },
        orderBy: { date: 'desc' },
        take: 5,
      });
      for (const r of receipts) {
        candidates.push({
          type: 'RECEIPT',
          id: r.id,
          date: r.date.toISOString().slice(0, 10),
          amount: r.amount.toString(),
          description: `Cobro a cliente: ${r.receivable.customer.razonSocial}`,
          reference: r.reference,
        });
      }

      // 2. Movimientos directos de ingreso (FinanceDirectMovement)
      const directIncomes = await this.db.financeDirectMovement.findMany({
        where: {
          tenantId,
          type: 'INCOME',
          amount: D(absAmount.toString()),
        },
        orderBy: { date: 'desc' },
        take: 5,
      });
      for (const m of directIncomes) {
        candidates.push({
          type: 'DIRECT_MOVEMENT',
          id: m.id,
          date: m.date.toISOString().slice(0, 10),
          amount: m.amount.toString(),
          description: `Ingreso directo: ${m.description}`,
          reference: m.voucherNumber || undefined,
        });
      }
    } else {
      // 1. Pagos a proveedores (FinanceVendorPayment)
      const payments = await this.db.financeVendorPayment.findMany({
        where: {
          tenantId,
          amount: D(absAmount.toString()),
        },
        include: {
          payable: { include: { vendor: true } },
        },
        orderBy: { date: 'desc' },
        take: 5,
      });
      for (const p of payments) {
        candidates.push({
          type: 'VENDOR_PAYMENT',
          id: p.id,
          date: p.date.toISOString().slice(0, 10),
          amount: p.amount.toString(),
          description: `Pago a proveedor: ${p.payable?.vendor.razonSocial || 'Proveedor'}`,
          reference: p.reference,
        });
      }

      // 2. Movimientos directos de egreso (FinanceDirectMovement)
      const directExpenses = await this.db.financeDirectMovement.findMany({
        where: {
          tenantId,
          type: 'EXPENSE',
          amount: D(absAmount.toString()),
        },
        orderBy: { date: 'desc' },
        take: 5,
      });
      for (const m of directExpenses) {
        candidates.push({
          type: 'DIRECT_MOVEMENT',
          id: m.id,
          date: m.date.toISOString().slice(0, 10),
          amount: m.amount.toString(),
          description: `Egreso directo: ${m.description}`,
          reference: m.voucherNumber || undefined,
        });
      }
    }

    // 3. Transferencias internas (FinanceInternalTransfer)
    const transfers = await this.db.financeInternalTransfer.findMany({
      where: {
        tenantId,
        amount: D(absAmount.toString()),
      },
      orderBy: { date: 'desc' },
      take: 5,
    });
    for (const t of transfers) {
      candidates.push({
        type: 'TRANSFER',
        id: t.id,
        date: t.date.toISOString().slice(0, 10),
        amount: t.amount.toString(),
        description: `Transferencia: ${t.fromAccountCode} -> ${t.toAccountCode}`,
        reference: t.reference,
      });
    }

    return {
      line: {
        id: line.id,
        date: dateStr,
        description: line.description,
        referenceNumber: line.referenceNumber,
        amount: line.amount.toString(),
        isCredit,
      },
      candidates,
    };
  }

  // 6. Conciliación Manual con Operación Existente
  async reconcileManual(tenantId: string, actorId: string, raw: unknown) {
    const input = manualReconciliationSchema.parse(raw);

    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const line = await tx.financeBankStatementLine.findFirst({
        where: { id: input.statementLineId, tenantId },
      });
      if (!line) throw new FinanceError(404, 'Movimiento de cartola no encontrado.');
      if (line.status === 'RECONCILED') throw new FinanceError(409, 'El movimiento ya se encuentra conciliado.');

      let targetEntryId: string | null = null;
      let matchedReceiptId: string | null = null;
      let matchedPaymentId: string | null = null;
      let matchedTransferId: string | null = null;
      let matchedMovementId: string | null = null;

      if (input.matchType === 'RECEIPT') {
        const r = await tx.financeReceipt.findFirst({ where: { id: input.targetId, tenantId } });
        if (!r) throw new FinanceError(404, 'Cobro de cliente no encontrado.');
        targetEntryId = r.entryId;
        matchedReceiptId = r.id;
      } else if (input.matchType === 'VENDOR_PAYMENT') {
        const p = await tx.financeVendorPayment.findFirst({ where: { id: input.targetId, tenantId } });
        if (!p) throw new FinanceError(404, 'Pago a proveedor no encontrado.');
        targetEntryId = p.entryId;
        matchedPaymentId = p.id;
      } else if (input.matchType === 'TRANSFER') {
        const t = await tx.financeInternalTransfer.findFirst({ where: { id: input.targetId, tenantId } });
        if (!t) throw new FinanceError(404, 'Transferencia no encontrada.');
        targetEntryId = t.entryId;
        matchedTransferId = t.id;
      } else if (input.matchType === 'DIRECT_MOVEMENT') {
        const m = await tx.financeDirectMovement.findFirst({ where: { id: input.targetId, tenantId } });
        if (!m) throw new FinanceError(404, 'Movimiento directo no encontrado.');
        targetEntryId = m.entryId;
        matchedMovementId = m.id;
      } else if (input.matchType === 'MANUAL_ENTRY') {
        const e = await tx.financeEntry.findFirst({ where: { id: input.targetId, tenantId } });
        if (!e) throw new FinanceError(404, 'Asiento contable no encontrado.');
        targetEntryId = e.id;
      }

      const reconciliation = await tx.financeBankReconciliation.create({
        data: {
          tenantId,
          statementLineId: line.id,
          matchType: input.matchType,
          targetEntryId,
          matchedReceiptId,
          matchedPaymentId,
          matchedTransferId,
          matchedMovementId,
          notes: input.notes || null,
          reconciledBy: actorId,
          isActive: true,
        },
      });

      await tx.financeBankStatementLine.update({
        where: { id: line.id },
        data: { status: 'RECONCILED' },
      });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'bank_reconciliation.create',
          entityId: reconciliation.id,
          data: { statementLineId: line.id, matchType: input.matchType, targetId: input.targetId },
        },
      });

      return reconciliation;
    });
  }

  // 7. Conciliación con Ajuste Contable (Comisiones, Intereses, Diferencias)
  async reconcileWithAdjustment(tenantId: string, actorId: string, key: string, raw: unknown) {
    keySchema.parse(key);
    const input = adjustmentReconciliationSchema.parse(raw);

    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const line = await tx.financeBankStatementLine.findFirst({
        where: { id: input.statementLineId, tenantId },
        include: { bankAccount: true },
      });
      if (!line) throw new FinanceError(404, 'Movimiento de cartola no encontrado.');
      if (line.status === 'RECONCILED' || line.status === 'ADJUSTED') {
        throw new FinanceError(409, 'El movimiento ya se encuentra conciliado.');
      }

      const amountBigInt = BigInt(line.amount.toString());
      const isCredit = amountBigInt > 0n; // Abono (e.g. intereses ganados)
      const absAmount = isCredit ? amountBigInt : -amountBigInt;
      const bankAccountCode = line.bankAccount.accountCode; // 110210
      const contraAccountCode = input.targetAccountCode; // e.g. 410210 o 520190
      const dateStr = line.transactionDate.toISOString().slice(0, 10);

      // Lines for double entry
      let lines: Array<{ accountCode: string; debit: string; credit: string }>;

      if (!isCredit) {
        // Cargo bancario (Comisión o gasto): Débito Gasto (410210), Crédito Banco (110210)
        lines = [
          { accountCode: contraAccountCode, debit: absAmount.toString(), credit: '0' },
          { accountCode: bankAccountCode, debit: '0', credit: absAmount.toString() },
        ];
      } else {
        // Abono bancario (Interés u otro ingreso): Débito Banco (110210), Crédito Ingreso (520190)
        lines = [
          { accountCode: bankAccountCode, debit: absAmount.toString(), credit: '0' },
          { accountCode: contraAccountCode, debit: '0', credit: absAmount.toString() },
        ];
      }

      const entryResult = await this.ledger.recordEntry(tx, tenantId, actorId, key, {
        date: dateStr,
        description: input.description,
        lines,
      });

      const reconciliation = await tx.financeBankReconciliation.create({
        data: {
          tenantId,
          statementLineId: line.id,
          matchType: input.type,
          adjustmentEntryId: entryResult.entry.id,
          notes: input.notes || null,
          reconciledBy: actorId,
          isActive: true,
        },
      });

      await tx.financeBankStatementLine.update({
        where: { id: line.id },
        data: { status: 'ADJUSTED' },
      });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'bank_reconciliation.adjustment',
          entityId: reconciliation.id,
          data: { statementLineId: line.id, type: input.type, adjustmentEntryId: entryResult.entry.id },
        },
      });

      return reconciliation;
    });
  }

  // 8. Marcar como Transacción No Identificada
  async markUnidentified(tenantId: string, actorId: string, statementLineId: string, notes?: string) {
    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const line = await tx.financeBankStatementLine.findFirst({
        where: { id: statementLineId, tenantId },
      });
      if (!line) throw new FinanceError(404, 'Movimiento de cartola no encontrado.');

      const updated = await tx.financeBankStatementLine.update({
        where: { id: statementLineId },
        data: { status: 'UNIDENTIFIED' },
      });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'bank_statement_line.unidentified',
          entityId: statementLineId,
          data: { notes: notes || null },
        },
      });

      return updated;
    });
  }

  // 9. Deshacer Conciliación con Trazabilidad
  async undoReconciliation(tenantId: string, actorId: string, reconciliationId: string, reason: string) {
    if (!reason || reason.trim().length < 3) {
      throw new FinanceError(400, 'Debe especificar el motivo para deshacer la conciliación.');
    }

    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const reconciliation = await tx.financeBankReconciliation.findFirst({
        where: { id: reconciliationId, tenantId, isActive: true },
        include: { statementLine: true },
      });
      if (!reconciliation) throw new FinanceError(404, 'Conciliación activa no encontrada.');

      // Create reversal tracking record
      const reversal = await tx.financeBankReconciliationReversal.create({
        data: {
          tenantId,
          reconciliationId: reconciliation.id,
          reason: reason.trim(),
          reversedBy: actorId,
        },
      });

      // Mark reconciliation inactive
      await tx.financeBankReconciliation.update({
        where: { id: reconciliation.id },
        data: { isActive: false },
      });

      // Reset statement line status to PENDING
      await tx.financeBankStatementLine.update({
        where: { id: reconciliation.statementLineId },
        data: { status: 'PENDING' },
      });

      // If there was an adjustment entry, post reversal entry in ledger
      if (reconciliation.adjustmentEntryId) {
        const dateStr = formatSiiTimestamp().slice(0, 10);
        await this.ledger.reverse(
          tenantId,
          actorId,
          reconciliation.adjustmentEntryId,
          crypto.randomUUID(),
          dateStr,
          `Anulación conciliación bancaria: ${reason.trim()}`
        );
      }

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'bank_reconciliation.undo',
          entityId: reconciliation.id,
          data: { reason, statementLineId: reconciliation.statementLineId },
        },
      });

      return { ok: true, reversalId: reversal.id };
    });
  }

  // 10. Reglas de Conciliación Asistida
  async listRules(tenantId: string) {
    return this.db.financeBankRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async saveRule(tenantId: string, actorId: string, raw: unknown, id?: string) {
    const input = bankRuleSchema.parse(raw);
    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const data = {
        name: input.name,
        pattern: input.pattern,
        action: input.action,
        targetAccountCode: input.targetAccountCode,
        isActive: input.isActive,
      };

      const rule = id
        ? await tx.financeBankRule.update({ where: { id }, data })
        : await tx.financeBankRule.create({ data: { ...data, tenantId } });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: id ? 'bank_rule.update' : 'bank_rule.create',
          entityId: rule.id,
          data: { name: rule.name, pattern: rule.pattern },
        },
      });

      return rule;
    });
  }

  async deleteRule(tenantId: string, actorId: string, id: string) {
    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      await tx.financeBankRule.delete({ where: { id } });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'bank_rule.delete',
          entityId: id,
          data: { id },
        },
      });

      return { ok: true };
    });
  }

  // 11. Ejecución de Reglas Asistidas sobre Movimientos Pendientes
  async applyRules(tenantId: string, actorId: string, bankAccountId: string) {
    const rules = await this.db.financeBankRule.findMany({
      where: { tenantId, isActive: true },
    });
    if (rules.length === 0) return { matchedCount: 0 };

    const pendingLines = await this.db.financeBankStatementLine.findMany({
      where: { tenantId, bankAccountId, status: 'PENDING' },
    });

    let matchedCount = 0;

    for (const line of pendingLines) {
      const descUpper = line.description.toUpperCase();
      for (const rule of rules) {
        if (descUpper.includes(rule.pattern.toUpperCase())) {
          const key = crypto.randomUUID();
          await this.reconcileWithAdjustment(tenantId, actorId, key, {
            statementLineId: line.id,
            type: rule.action === 'AUTO_INTEREST' ? 'INTEREST' : 'FEE',
            targetAccountCode: rule.targetAccountCode,
            description: `Regla automática [${rule.name}]: ${line.description}`,
            notes: `Aplicado por regla asistida: ${rule.name}`,
          });
          matchedCount++;
          break; // Stop checking rules for this line
        }
      }
    }

    return { matchedCount };
  }
}
