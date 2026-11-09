import crypto from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { FinanceError, FinanceLedger } from './ledger';
import { formatSiiTimestamp } from '../utils/sii-normative.utils';

export const receivedDteSchema = z.object({
  senderRut: z.string().min(3).max(12),
  senderName: z.string().min(2).max(150),
  documentType: z.number().int().positive(),
  folio: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).transform(v => BigInt(v)),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  netAmount: z.union([z.number(), z.string()]).transform(v => new Prisma.Decimal(v)),
  taxAmount: z.union([z.number(), z.string()]).transform(v => new Prisma.Decimal(v)),
  exemptAmount: z.union([z.number(), z.string()]).default(0).transform(v => new Prisma.Decimal(v)),
  xmlPayload: z.string().optional(),
}).strict();

export const f29PeriodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export class FinanceTaxDte {
  constructor(private readonly db: PrismaClient, private readonly ledger: FinanceLedger) {}

  async receiveDte(tenantId: string, userId: string, rawInput: unknown) {
    const input = receivedDteSchema.parse(rawInput);
    const totalAmount = input.netAmount.plus(input.taxAmount).plus(input.exemptAmount);

    const existing = await this.db.financeReceivedDte.findFirst({
      where: {
        tenantId,
        senderRut: input.senderRut,
        documentType: input.documentType,
        folio: input.folio,
      },
    });

    if (existing) {
      throw new FinanceError(409, `El documento ${input.documentType} folio ${input.folio.toString()} de ${input.senderRut} ya fue recibido previamente.`);
    }

    const record = await this.db.financeReceivedDte.create({
      data: {
        tenantId,
        senderRut: input.senderRut,
        senderName: input.senderName,
        documentType: input.documentType,
        folio: input.folio,
        date: new Date(input.date),
        netAmount: input.netAmount,
        taxAmount: input.taxAmount,
        exemptAmount: input.exemptAmount,
        totalAmount,
        status: 'RECEIVED',
        xmlPayload: input.xmlPayload,
      },
    });

    await this.db.financeAuditEvent.create({
      data: {
        tenantId,
        actorId: userId,
        action: 'received_dte.create',
        entityId: record.id,
        data: { senderRut: input.senderRut, documentType: input.documentType, folio: input.folio.toString(), totalAmount: totalAmount.toString() },
      },
    });

    return record;
  }

  async listReceivedDtes(tenantId: string, filters?: { status?: string; senderRut?: string; month?: string }) {
    const where: Prisma.FinanceReceivedDteWhereInput = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.senderRut) where.senderRut = { contains: filters.senderRut };
    if (filters?.month) {
      const start = new Date(`${filters.month}-01`);
      const [year, m] = filters.month.split('-').map(Number);
      const end = new Date(year, m, 1);
      where.date = { gte: start, lt: end };
    }

    const rows = await this.db.financeReceivedDte.findMany({
      where,
      orderBy: [{ date: 'desc' }, { folio: 'desc' }],
      take: 100,
    });

    return rows.map(r => ({
      ...r,
      folio: r.folio.toString(),
      netAmount: r.netAmount.toString(),
      taxAmount: r.taxAmount.toString(),
      exemptAmount: r.exemptAmount.toString(),
      totalAmount: r.totalAmount.toString(),
      date: r.date.toISOString().slice(0, 10),
    }));
  }

  async respondReceivedDte(tenantId: string, userId: string, id: string, action: 'ACCEPT' | 'CLAIM', reason?: string) {
    const doc = await this.db.financeReceivedDte.findFirstOrThrow({
      where: { id, tenantId },
    });

    if (doc.status !== 'RECEIVED') {
      throw new FinanceError(400, `El documento ya se encuentra en estado ${doc.status}.`);
    }

    const newStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'CLAIMED';
    const updated = await this.db.financeReceivedDte.update({
      where: { id },
      data: {
        status: newStatus,
        claimReason: action === 'CLAIM' ? (reason || 'Reclamo comercial o mercadería no recibida') : null,
      },
    });

    await this.db.financeAuditEvent.create({
      data: {
        tenantId,
        actorId: userId,
        action: action === 'ACCEPT' ? 'received_dte.accept' : 'received_dte.claim',
        entityId: id,
        data: { folio: doc.folio.toString(), action, reason },
      },
    });

    return updated;
  }

  async convertReceivedToPayable(tenantId: string, userId: string, id: string, vendorId: string, accountCode = '410110') {
    const doc = await this.db.financeReceivedDte.findFirstOrThrow({
      where: { id, tenantId },
    });

    if (doc.payableId) {
      throw new FinanceError(409, 'Este documento ya tiene una cuenta por pagar asociada.');
    }

    const day = doc.date.toISOString().slice(0, 10);
    const payableId = crypto.randomUUID();

    const result = await this.db.$transaction(async tx => {
      // 1. Asiento contable de compra: Gasto + IVA Crédito contra Proveedores
      const entry = await this.ledger.recordEntry(tx, tenantId, userId, `received_dte:${doc.id}`, {
        date: day,
        description: `Compra DTE ${doc.documentType} folio ${doc.folio.toString()} · ${doc.senderName}`,
        lines: [
          { accountCode, debit: doc.netAmount.toString(), credit: '0' },
          ...(doc.taxAmount.gt(0) ? [{ accountCode: '110710', debit: doc.taxAmount.toString(), credit: '0' }] : []),
          ...(doc.exemptAmount.gt(0) ? [{ accountCode, debit: doc.exemptAmount.toString(), credit: '0' }] : []),
          { accountCode: '210210', debit: '0', credit: doc.totalAmount.toString() },
        ],
      });

      // 2. Registro en FinancePayable
      const payable = await tx.financePayable.create({
        data: {
          id: payableId,
          tenantId,
          vendorId,
          documentType: doc.documentType,
          folio: Number(doc.folio),
          date: doc.date,
          dueDate: doc.date,
          netAmount: doc.netAmount,
          taxAmount: doc.taxAmount,
          exemptAmount: doc.exemptAmount,
          totalAmount: doc.totalAmount,
          kind: doc.documentType === 61 ? 'CREDIT' : 'DEBT',
          status: 'PENDIENTE',
          description: `DTE recibido de ${doc.senderName} (${doc.senderRut})`,
          sourceEntryId: entry.entry.id,
          createdBy: userId,
        },
      });

      // 3. Vincular DTE recibido
      await tx.financeReceivedDte.update({
        where: { id: doc.id },
        data: { payableId: payable.id, status: 'ACCEPTED' },
      });

      return payable;
    });

    return result;
  }

  // ============================================================================
  // GESTIÓN TRIBUTARIA & FORMULARIO 29
  // ============================================================================

  async calculateF29(tenantId: string, period: string) {
    f29PeriodSchema.parse(period);
    const start = new Date(`${period}-01`);
    const [year, m] = period.split('-').map(Number);
    const end = new Date(year, m, 1);

    // 1. Ventas emitidas del período (DocumentoDTE)
    const sales = await this.db.documentoDTE.findMany({
      where: {
        tenantId,
        fechaEmision: { gte: start, lt: end },
        estado: { in: ['ACEPTADO', 'ACEPTADO_CON_REPARO', 'ENVIADO'] },
      },
    });

    let salesNet = new Prisma.Decimal(0);
    let salesExempt = new Prisma.Decimal(0);
    let salesVatDebit = new Prisma.Decimal(0);

    for (const s of sales) {
      if (s.tipoDte === 61) {
        // Notas de crédito emitidas restan débito
        salesNet = salesNet.minus(s.mntNeto);
        salesExempt = salesExempt.minus(s.mntExento);
        salesVatDebit = salesVatDebit.minus(s.iva);
      } else {
        salesNet = salesNet.plus(s.mntNeto);
        salesExempt = salesExempt.plus(s.mntExento);
        salesVatDebit = salesVatDebit.plus(s.iva);
      }
    }

    // 2. Compras recibidas del período (FinanceReceivedDte o FinancePayable)
    const received = await this.db.financeReceivedDte.findMany({
      where: {
        tenantId,
        date: { gte: start, lt: end },
        status: { in: ['RECEIVED', 'ACCEPTED'] },
      },
    });

    let purchasesNet = new Prisma.Decimal(0);
    let purchasesExempt = new Prisma.Decimal(0);
    let purchasesVatCredit = new Prisma.Decimal(0);

    for (const r of received) {
      if (r.documentType === 61) {
        // Nota de crédito de compra resta crédito fiscal
        purchasesNet = purchasesNet.minus(r.netAmount);
        purchasesExempt = purchasesExempt.minus(r.exemptAmount);
        purchasesVatCredit = purchasesVatCredit.minus(r.taxAmount);
      } else {
        purchasesNet = purchasesNet.plus(r.netAmount);
        purchasesExempt = purchasesExempt.plus(r.exemptAmount);
        purchasesVatCredit = purchasesVatCredit.plus(r.taxAmount);
      }
    }

    // 3. Retenciones de honorarios del mes
    const feeReceipts = await this.db.financeFeeReceipt.findMany({
      where: { tenantId, date: { gte: start, lt: end } },
    });
    let feeRetention = new Prisma.Decimal(0);
    for (const f of feeReceipts) feeRetention = feeRetention.plus(f.retentionAmount);

    // 4. Retenciones de nómina / sueldos (impuesto único)
    const payrollSlips = await this.db.financePayrollSlip.findMany({
      where: { tenantId, period },
    });
    let payrollRetention = new Prisma.Decimal(0);
    for (const p of payrollSlips) payrollRetention = payrollRetention.plus(p.incomeTax);

    // 5. Configuración tributaria del tenant (PPM rate)
    const taxSetting = await this.db.financeTaxSetting.findUnique({ where: { tenantId } });
    const ppmRate = taxSetting?.ppmRate || new Prisma.Decimal('1.00');
    const positiveSalesNet = salesNet.gt(0) ? salesNet : new Prisma.Decimal(0);
    const ppmAmount = positiveSalesNet.mul(ppmRate).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);

    // 6. Liquidación de IVA y resultado F29
    const vatBalance = salesVatDebit.minus(purchasesVatCredit);
    let netTaxPayable = new Prisma.Decimal(0);
    let taxCreditRemainder = new Prisma.Decimal(0);

    if (vatBalance.gt(0)) {
      netTaxPayable = vatBalance.plus(feeRetention).plus(payrollRetention).plus(ppmAmount);
      taxCreditRemainder = new Prisma.Decimal(0);
    } else {
      taxCreditRemainder = vatBalance.abs();
      // Las retenciones y PPM siempre se pagan en el mes
      netTaxPayable = feeRetention.plus(payrollRetention).plus(ppmAmount);
    }

    // Calendario tributario: día 12 / día 20 del mes siguiente
    const [pYear, pMonth] = period.split('-').map(Number);
    const nextMonth = pMonth === 12 ? 1 : pMonth + 1;
    const nextYear = pMonth === 12 ? pYear + 1 : pYear;
    const dueDayElectronic = `${nextYear}-${String(nextMonth).padStart(2, '0')}-20`;
    const dueDayPaper = `${nextYear}-${String(nextMonth).padStart(2, '0')}-12`;

    return {
      period,
      dueDates: {
        electronic: dueDayElectronic,
        paper: dueDayPaper,
      },
      sales: {
        net: salesNet.toString(),
        exempt: salesExempt.toString(),
        vatDebit: salesVatDebit.toString(),
        count: sales.length,
      },
      purchases: {
        net: purchasesNet.toString(),
        exempt: purchasesExempt.toString(),
        vatCredit: purchasesVatCredit.toString(),
        count: received.length,
      },
      retentions: {
        feeRetention: feeRetention.toString(),
        payrollRetention: payrollRetention.toString(),
      },
      ppm: {
        ratePercent: ppmRate.toString(),
        baseSales: positiveSalesNet.toString(),
        amount: ppmAmount.toString(),
      },
      totals: {
        vatBalance: vatBalance.toString(),
        taxCreditRemainder: taxCreditRemainder.toString(),
        netTaxPayable: netTaxPayable.toString(),
      },
    };
  }

  async saveF29Declaration(tenantId: string, userId: string, period: string, status: 'DRAFT' | 'DECLARED' | 'PAID' = 'DECLARED') {
    const calc = await this.calculateF29(tenantId, period);

    const record = await this.db.financeTaxF29Declaration.upsert({
      where: { tenantId_period: { tenantId, period } },
      update: {
        salesNet: new Prisma.Decimal(calc.sales.net),
        salesExempt: new Prisma.Decimal(calc.sales.exempt),
        salesVatDebit: new Prisma.Decimal(calc.sales.vatDebit),
        purchasesNet: new Prisma.Decimal(calc.purchases.net),
        purchasesExempt: new Prisma.Decimal(calc.purchases.exempt),
        purchasesVatCredit: new Prisma.Decimal(calc.purchases.vatCredit),
        feeRetention: new Prisma.Decimal(calc.retentions.feeRetention),
        payrollRetention: new Prisma.Decimal(calc.retentions.payrollRetention),
        ppmRate: new Prisma.Decimal(calc.ppm.ratePercent),
        ppmAmount: new Prisma.Decimal(calc.ppm.amount),
        netTaxPayable: new Prisma.Decimal(calc.totals.netTaxPayable),
        taxCreditRemainder: new Prisma.Decimal(calc.totals.taxCreditRemainder),
        status,
        declaredAt: status !== 'DRAFT' ? new Date() : null,
        declaredBy: status !== 'DRAFT' ? userId : null,
      },
      create: {
        tenantId,
        period,
        salesNet: new Prisma.Decimal(calc.sales.net),
        salesExempt: new Prisma.Decimal(calc.sales.exempt),
        salesVatDebit: new Prisma.Decimal(calc.sales.vatDebit),
        purchasesNet: new Prisma.Decimal(calc.purchases.net),
        purchasesExempt: new Prisma.Decimal(calc.purchases.exempt),
        purchasesVatCredit: new Prisma.Decimal(calc.purchases.vatCredit),
        feeRetention: new Prisma.Decimal(calc.retentions.feeRetention),
        payrollRetention: new Prisma.Decimal(calc.retentions.payrollRetention),
        ppmRate: new Prisma.Decimal(calc.ppm.ratePercent),
        ppmAmount: new Prisma.Decimal(calc.ppm.amount),
        netTaxPayable: new Prisma.Decimal(calc.totals.netTaxPayable),
        taxCreditRemainder: new Prisma.Decimal(calc.totals.taxCreditRemainder),
        status,
        declaredAt: status !== 'DRAFT' ? new Date() : null,
        declaredBy: status !== 'DRAFT' ? userId : null,
      },
    });

    await this.db.financeAuditEvent.create({
      data: {
        tenantId,
        actorId: userId,
        action: 'tax.f29_declare',
        entityId: record.id,
        data: { period, status, netTaxPayable: calc.totals.netTaxPayable },
      },
    });

    return record;
  }

  // ============================================================================
  // FACTURACIÓN ELECTRÓNICA EXTENDIDA (DTEs 33, 34, 43, 46, 52, 56, 61, 110..)
  // ============================================================================

  async issueExtendedDte(tenantId: string, userId: string, rawInput: {
    tipoDte: number;
    receptorRut: string;
    razonSocial: string;
    giro?: string;
    direccion?: string;
    comuna?: string;
    ciudad?: string;
    items: Array<{ description: string; quantity: number; unitPrice: number; exempt?: boolean }>;
    reference?: { tipoDocRef: number; folioRef: number; codRef: number; razonRef: string };
  }) {
    const { tipoDte, receptorRut, items, reference } = rawInput;
    const supportedTypes = [33, 34, 43, 46, 52, 56, 61, 110, 111, 112];
    if (!supportedTypes.includes(tipoDte)) {
      throw new FinanceError(400, `Tipo de DTE ${tipoDte} no soportado. Tipos válidos: ${supportedTypes.join(', ')}`);
    }

    // 1. Obtener o crear receptor
    const receptor = await this.db.clienteReceptor.upsert({
      where: { tenantId_rut: { tenantId, rut: receptorRut } },
      update: {},
      create: {
        tenantId,
        rut: receptorRut,
        razonSocial: rawInput.razonSocial,
        giro: rawInput.giro || 'Giro general',
        direccion: rawInput.direccion || 'Dirección comercial',
        comuna: rawInput.comuna || 'Santiago',
        ciudad: rawInput.ciudad || 'Santiago',
      },
    });

    // 2. Obtener CAF activo para este tipo de documento
    const caf = await this.db.cafFolio.findFirst({
      where: { tenantId, tipoDte },
    });
    if (!caf) {
      throw new FinanceError(400, `No hay CAF cargado ni folios autorizados para el DTE tipo ${tipoDte}.`);
    }

    const folio = caf.folioActual;
    await this.db.cafFolio.update({
      where: { id: caf.id },
      data: { folioActual: { increment: 1 } },
    });

    // 3. Calcular importes netos, exentos e IVA
    let net = 0;
    let exempt = 0;
    for (const item of items) {
      const lineTotal = item.quantity * item.unitPrice;
      if (item.exempt || tipoDte === 34 || tipoDte === 110) {
        exempt += lineTotal;
      } else {
        net += lineTotal;
      }
    }
    const iva = (tipoDte === 34 || tipoDte === 110) ? 0 : Math.round(net * 0.19);
    const total = net + exempt + iva;

    const day = formatSiiTimestamp().slice(0, 10);

    // 4. Crear documento DTE
    const dte = await this.db.documentoDTE.create({
      data: {
        tenantId,
        tipoDte,
        folio,
        receptorId: receptor.id,
        cafId: caf.id,
        fechaEmision: new Date(day),
        fechaVenc: new Date(day),
        mntNeto: net,
        mntExento: exempt,
        iva,
        mntTotal: total,
        detallesJson: items,
        referenciasJson: reference ? [reference] : [],
        estado: 'ACEPTADO',
      },
    });

    // 5. Centralizar contablemente de inmediato
    await this.ledger.postDocument(tenantId, userId, dte.id);

    await this.db.financeAuditEvent.create({
      data: {
        tenantId,
        actorId: userId,
        action: 'dte.issue_extended',
        entityId: dte.id,
        data: { tipoDte, folio, total, receptorRut },
      },
    });

    return dte;
  }
}
