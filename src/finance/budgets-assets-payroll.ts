import crypto from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { FinanceError, FinanceLedger } from './ledger';
import { formatSiiTimestamp } from '../utils/sii-normative.utils';

export const budgetSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  name: z.string().min(2).max(100),
  department: z.string().max(100).optional(),
  notes: z.string().max(255).optional(),
  items: z.array(z.object({
    costCenterId: z.string().uuid().optional(),
    accountCode: z.string().regex(/^\d{6}$/),
    month: z.number().int().min(1).max(12),
    allocatedAmount: z.union([z.number(), z.string()]).transform(v => new Prisma.Decimal(v)),
  })),
}).strict();

export const fixedAssetSchema = z.object({
  code: z.string().min(2).max(30),
  name: z.string().min(2).max(150),
  category: z.enum(['EQUIPMENT', 'FURNITURE', 'VEHICLE', 'BUILDING', 'SOFTWARE']),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  purchaseCost: z.union([z.number(), z.string()]).transform(v => new Prisma.Decimal(v)),
  residualValue: z.union([z.number(), z.string()]).default(0).transform(v => new Prisma.Decimal(v)),
  usefulLifeMonths: z.number().int().positive(),
  costCenterId: z.string().uuid().optional(),
}).strict();

export const employeeSchema = z.object({
  rut: z.string().min(3).max(12),
  name: z.string().min(2).max(150),
  position: z.string().min(2).max(100),
  department: z.string().max(100).optional(),
  afp: z.string().min(2).max(50),
  healthSystem: z.string().min(2).max(50),
  baseSalary: z.union([z.number(), z.string()]).transform(v => new Prisma.Decimal(v)),
  costCenterId: z.string().uuid().optional(),
}).strict();

export const payrollSlipSchema = z.object({
  employeeId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  overtime: z.union([z.number(), z.string()]).default(0).transform(v => new Prisma.Decimal(v)),
  bonus: z.union([z.number(), z.string()]).default(0).transform(v => new Prisma.Decimal(v)),
  gratification: z.union([z.number(), z.string()]).default(0).transform(v => new Prisma.Decimal(v)),
  nonTaxableAllowances: z.union([z.number(), z.string()]).default(0).transform(v => new Prisma.Decimal(v)),
}).strict();

export const feeReceiptSchema = z.object({
  rut: z.string().min(3).max(12),
  name: z.string().min(2).max(150),
  folio: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).transform(v => BigInt(v)),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(2).max(255),
  grossAmount: z.union([z.number(), z.string()]).transform(v => new Prisma.Decimal(v)),
  retentionRate: z.union([z.number(), z.string()]).default(13.75).transform(v => new Prisma.Decimal(v)),
  costCenterId: z.string().uuid().optional(),
}).strict();

export class FinanceBudgetsAssetsPayroll {
  constructor(private readonly db: PrismaClient, private readonly ledger: FinanceLedger) {}

  // ============================================================================
  // 10 · PRESUPUESTOS Y EJECUCIÓN
  // ============================================================================

  async listBudgets(tenantId: string, year?: number) {
    return this.db.financeBudget.findMany({
      where: { tenantId, ...(year ? { year } : {}) },
      include: { items: { include: { costCenter: true } } },
      orderBy: { year: 'desc' },
    });
  }

  async saveBudget(tenantId: string, userId: string, rawInput: unknown) {
    const input = budgetSchema.parse(rawInput);

    const budget = await this.db.financeBudget.create({
      data: {
        tenantId,
        year: input.year,
        name: input.name,
        department: input.department,
        notes: input.notes,
        status: 'DRAFT',
        items: {
          create: input.items.map(it => ({
            tenantId,
            accountCode: it.accountCode,
            month: it.month,
            allocatedAmount: it.allocatedAmount,
            costCenterId: it.costCenterId,
          })),
        },
      },
      include: { items: true },
    });

    await this.db.financeAuditEvent.create({
      data: {
        tenantId,
        actorId: userId,
        action: 'budget.create',
        entityId: budget.id,
        data: { year: input.year, name: input.name, itemsCount: input.items.length },
      },
    });

    return budget;
  }

  async approveBudget(tenantId: string, userId: string, budgetId: string) {
    const budget = await this.db.financeBudget.update({
      where: { id: budgetId, tenantId },
      data: { status: 'APPROVED' },
    });

    await this.db.financeAuditEvent.create({
      data: {
        tenantId,
        actorId: userId,
        action: 'budget.approve',
        entityId: budgetId,
        data: { name: budget.name },
      },
    });

    return budget;
  }

  async getBudgetExecution(tenantId: string, budgetId: string) {
    const budget = await this.db.financeBudget.findFirstOrThrow({
      where: { id: budgetId, tenantId },
      include: { items: true },
    });

    // Consultar todos los movimientos contables reales del año
    const startYear = new Date(`${budget.year}-01-01`);
    const endYear = new Date(`${budget.year + 1}-01-01`);

    const realLines = await this.db.financeEntryLine.findMany({
      where: {
        entry: { tenantId, date: { gte: startYear, lt: endYear } },
      },
      include: { entry: true },
    });

    // Mapear gastos reales por accountCode y mes
    const realMap = new Map<string, Prisma.Decimal>();
    for (const l of realLines) {
      const month = l.entry.date.getUTCMonth() + 1;
      const key = `${l.accountCode}:${month}`;
      const cur = realMap.get(key) || new Prisma.Decimal(0);
      realMap.set(key, cur.plus(l.debit.minus(l.credit)));
    }

    let totalBudgeted = new Prisma.Decimal(0);
    let totalExecuted = new Prisma.Decimal(0);

    const comparison = budget.items.map(it => {
      totalBudgeted = totalBudgeted.plus(it.allocatedAmount);
      const key = `${it.accountCode}:${it.month}`;
      const executed = realMap.get(key) || new Prisma.Decimal(0);
      totalExecuted = totalExecuted.plus(executed);
      const variance = it.allocatedAmount.minus(executed);
      const percent = it.allocatedAmount.gt(0)
        ? executed.mul(100).div(it.allocatedAmount).toDecimalPlaces(1).toString() + '%'
        : '0%';

      return {
        id: it.id,
        accountCode: it.accountCode,
        month: it.month,
        budgeted: it.allocatedAmount.toString(),
        executed: executed.toString(),
        variance: variance.toString(),
        executionPercent: percent,
        isOverBudget: variance.lt(0),
      };
    });

    const overallPercent = totalBudgeted.gt(0)
      ? totalExecuted.mul(100).div(totalBudgeted).toDecimalPlaces(1).toString() + '%'
      : '0%';

    return {
      budget: { id: budget.id, name: budget.name, year: budget.year, status: budget.status },
      totals: {
        budgeted: totalBudgeted.toString(),
        executed: totalExecuted.toString(),
        variance: totalBudgeted.minus(totalExecuted).toString(),
        executionPercent: overallPercent,
      },
      comparison,
    };
  }

  // ============================================================================
  // 11 · ACTIVOS FIJOS Y DEPRECIACIÓN
  // ============================================================================

  async listFixedAssets(tenantId: string) {
    const assets = await this.db.financeFixedAsset.findMany({
      where: { tenantId },
      include: { costCenter: true },
      orderBy: { code: 'asc' },
    });

    return assets.map(a => ({
      ...a,
      purchaseCost: a.purchaseCost.toString(),
      residualValue: a.residualValue.toString(),
      accumulatedDepreciation: a.accumulatedDepreciation.toString(),
      bookValue: a.bookValue.toString(),
      purchaseDate: a.purchaseDate.toISOString().slice(0, 10),
    }));
  }

  async createFixedAsset(tenantId: string, userId: string, rawInput: unknown) {
    const input = fixedAssetSchema.parse(rawInput);

    const asset = await this.db.financeFixedAsset.create({
      data: {
        tenantId,
        code: input.code,
        name: input.name,
        category: input.category,
        purchaseDate: new Date(input.purchaseDate),
        purchaseCost: input.purchaseCost,
        residualValue: input.residualValue,
        usefulLifeMonths: input.usefulLifeMonths,
        depreciatedMonths: 0,
        accumulatedDepreciation: new Prisma.Decimal(0),
        bookValue: input.purchaseCost,
        status: 'ACTIVE',
        costCenterId: input.costCenterId,
      },
    });

    await this.db.financeAuditEvent.create({
      data: {
        tenantId,
        actorId: userId,
        action: 'fixed_asset.create',
        entityId: asset.id,
        data: { code: asset.code, name: asset.name, purchaseCost: input.purchaseCost.toString() },
      },
    });

    return asset;
  }

  async depreciateAssetsMonthly(tenantId: string, userId: string, period: string) {
    // period YYYY-MM
    const assets = await this.db.financeFixedAsset.findMany({
      where: { tenantId, status: 'ACTIVE' },
    });

    let totalDepreciation = new Prisma.Decimal(0);
    const day = `${period}-28`;

    await this.db.$transaction(async tx => {
      for (const asset of assets) {
        if (asset.depreciatedMonths >= asset.usefulLifeMonths) {
          await tx.financeFixedAsset.update({
            where: { id: asset.id },
            data: { status: 'FULLY_DEPRECIATED' },
          });
          continue;
        }

        const depreciableBase = asset.purchaseCost.minus(asset.residualValue);
        const monthlyQuota = depreciableBase.div(asset.usefulLifeMonths).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
        const newAccum = asset.accumulatedDepreciation.plus(monthlyQuota);
        const newBookValue = asset.purchaseCost.minus(newAccum);
        const newMonths = asset.depreciatedMonths + 1;

        await tx.financeFixedAsset.update({
          where: { id: asset.id },
          data: {
            accumulatedDepreciation: newAccum,
            bookValue: newBookValue,
            depreciatedMonths: newMonths,
            status: newMonths >= asset.usefulLifeMonths ? 'FULLY_DEPRECIATED' : 'ACTIVE',
          },
        });

        totalDepreciation = totalDepreciation.plus(monthlyQuota);
      }

      // Asiento contable de depreciación del mes si hay monto
      if (totalDepreciation.gt(0)) {
        await this.ledger.recordEntry(tx, tenantId, userId, `depreciation:${period}`, {
          date: day,
          description: `Depreciación mensual de activos fijos correspondiente a ${period}`,
          lines: [
            { accountCode: '410110', debit: totalDepreciation.toString(), credit: '0' }, // Gasto Depreciación
            { accountCode: '110210', debit: '0', credit: totalDepreciation.toString() }, // Contrapartida de valuación
          ],
        });
      }
    });

    await this.db.financeAuditEvent.create({
      data: {
        tenantId,
        actorId: userId,
        action: 'fixed_asset.depreciate_period',
        entityId: tenantId,
        data: { period, totalDepreciation: totalDepreciation.toString(), assetsCount: assets.length },
      },
    });

    return {
      period,
      assetsDepreciated: assets.length,
      totalDepreciation: totalDepreciation.toString(),
    };
  }

  // ============================================================================
  // 12 · REMUNERACIONES Y HONORARIOS
  // ============================================================================

  async listEmployees(tenantId: string) {
    const list = await this.db.financePayrollEmployee.findMany({
      where: { tenantId },
      include: { costCenter: true },
      orderBy: { name: 'asc' },
    });

    return list.map(e => ({
      ...e,
      baseSalary: e.baseSalary.toString(),
    }));
  }

  async saveEmployee(tenantId: string, userId: string, rawInput: unknown) {
    const input = employeeSchema.parse(rawInput);

    const emp = await this.db.financePayrollEmployee.upsert({
      where: { tenantId_rut: { tenantId, rut: input.rut } },
      update: {
        name: input.name,
        position: input.position,
        department: input.department,
        afp: input.afp,
        healthSystem: input.healthSystem,
        baseSalary: input.baseSalary,
        costCenterId: input.costCenterId,
      },
      create: {
        tenantId,
        rut: input.rut,
        name: input.name,
        position: input.position,
        department: input.department,
        afp: input.afp,
        healthSystem: input.healthSystem,
        baseSalary: input.baseSalary,
        costCenterId: input.costCenterId,
      },
    });

    await this.db.financeAuditEvent.create({
      data: {
        tenantId,
        actorId: userId,
        action: 'employee.save',
        entityId: emp.id,
        data: { rut: emp.rut, name: emp.name },
      },
    });

    return emp;
  }

  async generatePayrollSlip(tenantId: string, userId: string, rawInput: unknown) {
    const input = payrollSlipSchema.parse(rawInput);
    const emp = await this.db.financePayrollEmployee.findFirstOrThrow({
      where: { id: input.employeeId, tenantId },
    });

    const totalImponible = emp.baseSalary.plus(input.overtime).plus(input.bonus).plus(input.gratification);

    // Descuentos legales chilenos promedio: AFP (11.5%), Salud (7%), AFC (0.6%)
    const afpDeduction = totalImponible.mul(11.5).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
    const healthDeduction = totalImponible.mul(7.0).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
    const afcDeduction = totalImponible.mul(0.6).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);

    // Impuesto Único de Segunda Categoría (tramos simplificados SII)
    let incomeTax = new Prisma.Decimal(0);
    const taxableBase = totalImponible.minus(afpDeduction).minus(healthDeduction).minus(afcDeduction);
    if (taxableBase.gt(950000)) {
      incomeTax = taxableBase.minus(950000).mul(4).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
    }

    const totalDeductions = afpDeduction.plus(healthDeduction).plus(afcDeduction).plus(incomeTax);
    const netSalary = totalImponible.plus(input.nonTaxableAllowances).minus(totalDeductions);

    const day = `${input.period}-28`;

    const slip = await this.db.$transaction(async tx => {
      // Asiento contable de remuneraciones:
      // Debe: Sueldos y Remuneraciones (410110)
      // Haber: Imposiciones y Leyes Sociales por Pagar (210210)
      // Haber: Retención Impuesto Único (210210)
      // Haber: Sueldos por Pagar Líquido (210210)
      const entry = await this.ledger.recordEntry(tx, tenantId, userId, `payroll:${emp.id}:${input.period}`, {
        date: day,
        description: `Liquidación de sueldo ${emp.name} (${emp.rut}) · Período ${input.period}`,
        lines: [
          { accountCode: '410110', debit: totalImponible.plus(input.nonTaxableAllowances).toString(), credit: '0', costCenterId: emp.costCenterId || undefined },
          { accountCode: '210210', debit: '0', credit: afpDeduction.plus(healthDeduction).plus(afcDeduction).toString() },
          ...(incomeTax.gt(0) ? [{ accountCode: '210210', debit: '0', credit: incomeTax.toString() }] : []),
          { accountCode: '210210', debit: '0', credit: netSalary.toString() },
        ],
      });

      return tx.financePayrollSlip.upsert({
        where: { tenantId_employeeId_period: { tenantId, employeeId: emp.id, period: input.period } },
        update: {
          baseSalary: emp.baseSalary,
          overtime: input.overtime,
          bonus: input.bonus,
          gratification: input.gratification,
          totalImponible,
          nonTaxableAllowances: input.nonTaxableAllowances,
          afpDeduction,
          healthDeduction,
          afcDeduction,
          incomeTax,
          totalDeductions,
          netSalary,
          status: 'APPROVED',
          sourceEntryId: entry.entry.id,
        },
        create: {
          tenantId,
          employeeId: emp.id,
          period: input.period,
          baseSalary: emp.baseSalary,
          overtime: input.overtime,
          bonus: input.bonus,
          gratification: input.gratification,
          totalImponible,
          nonTaxableAllowances: input.nonTaxableAllowances,
          afpDeduction,
          healthDeduction,
          afcDeduction,
          incomeTax,
          totalDeductions,
          netSalary,
          status: 'APPROVED',
          sourceEntryId: entry.entry.id,
        },
      });
    });

    return slip;
  }

  async listPayrollSlips(tenantId: string, period?: string) {
    return this.db.financePayrollSlip.findMany({
      where: { tenantId, ...(period ? { period } : {}) },
      include: { employee: true },
      orderBy: { period: 'desc' },
    });
  }

  async listFeeReceipts(tenantId: string, month?: string) {
    const where: Prisma.FinanceFeeReceiptWhereInput = { tenantId };
    if (month) {
      const start = new Date(`${month}-01`);
      const [y, m] = month.split('-').map(Number);
      const end = new Date(y, m, 1);
      where.date = { gte: start, lt: end };
    }

    const receipts = await this.db.financeFeeReceipt.findMany({
      where,
      include: { costCenter: true },
      orderBy: [{ date: 'desc' }, { folio: 'desc' }],
    });

    return receipts.map(r => ({
      ...r,
      folio: r.folio.toString(),
      grossAmount: r.grossAmount.toString(),
      retentionRate: r.retentionRate.toString(),
      retentionAmount: r.retentionAmount.toString(),
      netAmount: r.netAmount.toString(),
      date: r.date.toISOString().slice(0, 10),
    }));
  }

  async recordFeeReceipt(tenantId: string, userId: string, rawInput: unknown) {
    const input = feeReceiptSchema.parse(rawInput);
    const retentionAmount = input.grossAmount.mul(input.retentionRate).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
    const netAmount = input.grossAmount.minus(retentionAmount);

    const existing = await this.db.financeFeeReceipt.findFirst({
      where: { tenantId, rut: input.rut, folio: input.folio },
    });
    if (existing) {
      throw new FinanceError(409, `La boleta de honorarios folio ${input.folio.toString()} de ${input.rut} ya está registrada.`);
    }

    const receipt = await this.db.$transaction(async tx => {
      // Asiento contable de honorarios:
      // Debe: Gastos de Honorarios (410110)
      // Haber: Retención de Honorarios F29 (210210)
      // Haber: Honorarios por Pagar Líquido (210210)
      const entry = await this.ledger.recordEntry(tx, tenantId, userId, `fee:${input.rut}:${input.folio.toString()}`, {
        date: input.date,
        description: `Boleta de Honorarios folio ${input.folio.toString()} · ${input.name} · ${input.description}`,
        lines: [
          { accountCode: '410110', debit: input.grossAmount.toString(), credit: '0', costCenterId: input.costCenterId },
          { accountCode: '210210', debit: '0', credit: retentionAmount.toString() },
          { accountCode: '210210', debit: '0', credit: netAmount.toString() },
        ],
      });

      return tx.financeFeeReceipt.create({
        data: {
          tenantId,
          rut: input.rut,
          name: input.name,
          folio: input.folio,
          date: new Date(input.date),
          description: input.description,
          grossAmount: input.grossAmount,
          retentionRate: input.retentionRate,
          retentionAmount,
          netAmount,
          status: 'PENDING',
          costCenterId: input.costCenterId,
          sourceEntryId: entry.entry.id,
        },
      });
    });

    await this.db.financeAuditEvent.create({
      data: {
        tenantId,
        actorId: userId,
        action: 'fee_receipt.create',
        entityId: receipt.id,
        data: { rut: input.rut, folio: input.folio.toString(), grossAmount: input.grossAmount.toString() },
      },
    });

    return receipt;
  }
}
