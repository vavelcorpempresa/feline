import crypto from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { dateSchema, FinanceError, FinanceLedger, financeTransaction, keySchema, moneySchema, monthSchema } from './ledger';
import { ODOO_CL_CHART_OF_ACCOUNTS } from '../services/odoo-accounting-engine.service';
import { formatSiiTimestamp } from '../utils/sii-normative.utils';

const D = (value: string | number | Prisma.Decimal) => new Prisma.Decimal(value);
const uuid = z.string().uuid();

export const customAccountSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
  name: z.string().trim().min(3).max(100),
  accountType: z.string().trim().min(2).max(30).default('asset_current'),
  internalGroup: z.enum(['asset', 'liability', 'equity', 'income', 'expense']).default('asset'),
  siiClassification: z.enum(['ACTIVO_CORRIENTE', 'ACTIVO_FIJO', 'PASIVO_CORRIENTE', 'PATRIMONIO', 'INGRESO_OPERACIONAL', 'COSTO_GASTO']).default('ACTIVO_CORRIENTE'),
  includeInitialBalance: z.boolean().default(true),
  reconcile: z.boolean().default(false),
  isActive: z.boolean().default(true),
}).strict();

export const costCenterSchema = z.object({
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(200).optional(),
  isActive: z.boolean().default(true),
}).strict();

export class FinanceAccounting {
  private readonly ledger: FinanceLedger;
  constructor(private readonly db: PrismaClient) {
    this.ledger = new FinanceLedger(db);
  }

  private async lock(tx: Prisma.TransactionClient, tenantId: string) {
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
  }

  // 1. Maestro y Administración del Plan de Cuentas
  async listAccounts(tenantId: string) {
    const custom = await this.db.financeCustomAccount.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });

    // Sum all movements per account in tenant
    const sums = await this.db.financeEntryLine.groupBy({
      by: ['accountCode'],
      where: { entry: { tenantId } },
      _sum: { debit: true, credit: true },
    });

    const sumMap = new Map<string, { debit: string; credit: string; balance: string }>();
    for (const s of sums) {
      const d = s._sum.debit || new Prisma.Decimal(0);
      const c = s._sum.credit || new Prisma.Decimal(0);
      sumMap.set(s.accountCode, {
        debit: d.toString(),
        credit: c.toString(),
        balance: d.minus(c).toString(),
      });
    }

    const standardAccounts = ODOO_CL_CHART_OF_ACCOUNTS.map(a => {
      const balanceInfo = sumMap.get(a.code) || { debit: '0', credit: '0', balance: '0' };
      return {
        code: a.code,
        name: a.name,
        accountType: a.accountType,
        internalGroup: a.internalGroup,
        siiClassification: a.siiClassification,
        includeInitialBalance: a.includeInitialBalance,
        reconcile: a.reconcile,
        isCustom: false,
        isActive: true,
        ...balanceInfo,
      };
    });

    const customMapped = custom.map(c => {
      const balanceInfo = sumMap.get(c.code) || { debit: '0', credit: '0', balance: '0' };
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        accountType: c.accountType,
        internalGroup: c.internalGroup,
        siiClassification: c.siiClassification,
        includeInitialBalance: c.includeInitialBalance,
        reconcile: c.reconcile,
        isCustom: true,
        isActive: c.isActive,
        ...balanceInfo,
      };
    });

    // Merge and sort by code
    return [...standardAccounts, ...customMapped].sort((a, b) => a.code.localeCompare(b.code));
  }

  async saveCustomAccount(tenantId: string, actorId: string, raw: unknown, id?: string) {
    const input = customAccountSchema.parse(raw);
    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      // Check not duplicate with standard accounts
      if (ODOO_CL_CHART_OF_ACCOUNTS.some(a => a.code === input.code)) {
        throw new FinanceError(409, 'El código ya existe en el catálogo estándar de cuentas.');
      }

      const existing = await tx.financeCustomAccount.findFirst({
        where: { tenantId, code: input.code, ...(id ? { id: { not: id } } : {}) },
      });
      if (existing) {
        throw new FinanceError(409, 'Ya existe una subcuenta personalizada con este código.');
      }

      const data = {
        code: input.code,
        name: input.name,
        accountType: input.accountType,
        internalGroup: input.internalGroup,
        siiClassification: input.siiClassification,
        includeInitialBalance: input.includeInitialBalance,
        reconcile: input.reconcile,
        isActive: input.isActive,
      };

      const account = id
        ? await tx.financeCustomAccount.update({ where: { id }, data })
        : await tx.financeCustomAccount.create({ data: { ...data, tenantId } });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: id ? 'account.update' : 'account.create',
          entityId: account.id,
          data: { code: account.code, name: account.name },
        },
      });

      return account;
    });
  }

  // 2. Centros de Costos y Dimensiones Analíticas
  async listCostCenters(tenantId: string) {
    const centers = await this.db.financeCostCenter.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });

    const sums = await this.db.financeEntryLine.groupBy({
      by: ['costCenterId'],
      where: { entry: { tenantId }, costCenterId: { not: null } },
      _sum: { debit: true, credit: true },
    });

    const sumMap = new Map<string, { debit: string; credit: string }>();
    for (const s of sums) {
      if (!s.costCenterId) continue;
      sumMap.set(s.costCenterId, {
        debit: (s._sum.debit || new Prisma.Decimal(0)).toString(),
        credit: (s._sum.credit || new Prisma.Decimal(0)).toString(),
      });
    }

    return centers.map(c => ({
      ...c,
      totalDebit: sumMap.get(c.id)?.debit || '0',
      totalCredit: sumMap.get(c.id)?.credit || '0',
    }));
  }

  async saveCostCenter(tenantId: string, actorId: string, raw: unknown, id?: string) {
    const input = costCenterSchema.parse(raw);
    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const existing = await tx.financeCostCenter.findFirst({
        where: { tenantId, code: input.code, ...(id ? { id: { not: id } } : {}) },
      });
      if (existing) throw new FinanceError(409, 'Ya existe un centro de costo con este código.');

      const data = {
        code: input.code,
        name: input.name,
        description: input.description || null,
        isActive: input.isActive,
      };

      const costCenter = id
        ? await tx.financeCostCenter.update({ where: { id }, data })
        : await tx.financeCostCenter.create({ data: { ...data, tenantId } });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: id ? 'cost_center.update' : 'cost_center.create',
          entityId: costCenter.id,
          data: { code: costCenter.code, name: costCenter.name },
        },
      });

      return costCenter;
    });
  }

  async deleteCostCenter(tenantId: string, actorId: string, id: string) {
    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const used = await tx.financeEntryLine.count({ where: { costCenterId: id } });
      if (used > 0) throw new FinanceError(409, 'No se puede eliminar un centro de costos con movimientos contables asignados.');

      await tx.financeCostCenter.delete({ where: { id } });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'cost_center.delete',
          entityId: id,
          data: { id },
        },
      });

      return { ok: true };
    });
  }

  // 3. Libro Mayor Persistente con Saldos Acumulados y Navegación
  async getGeneralLedger(tenantId: string, query: {
    accountCode?: string;
    startDate?: string;
    endDate?: string;
    costCenterId?: string;
  }) {
    const where: Prisma.FinanceEntryLineWhereInput = {
      entry: {
        tenantId,
        ...(query.startDate || query.endDate ? {
          date: {
            ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
            ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
          },
        } : {}),
      },
      ...(query.accountCode ? { accountCode: query.accountCode } : {}),
      ...(query.costCenterId ? { costCenterId: query.costCenterId } : {}),
    };

    const lines = await this.db.financeEntryLine.findMany({
      where,
      include: {
        entry: true,
        costCenter: true,
      },
      orderBy: [{ accountCode: 'asc' }, { entry: { date: 'asc' } }, { entry: { id: 'asc' } }],
    });

    const accountDefinitions = await this.listAccounts(tenantId);
    const defMap = new Map(accountDefinitions.map(a => [a.code, a]));

    const accountsMap = new Map<string, {
      accountCode: string;
      accountName: string;
      accountType: string;
      internalGroup: string;
      totalDebit: Prisma.Decimal;
      totalCredit: Prisma.Decimal;
      finalBalance: Prisma.Decimal;
      movements: Array<{
        id: string;
        entryId: string;
        date: string;
        description: string;
        debit: string;
        credit: string;
        runningBalance: string;
        costCenter?: string;
        sourceDocumentId?: string | null;
        sourceOperationId?: string | null;
      }>;
    }>();

    for (const line of lines) {
      let acc = accountsMap.get(line.accountCode);
      if (!acc) {
        const def = defMap.get(line.accountCode);
        acc = {
          accountCode: line.accountCode,
          accountName: def ? def.name : line.accountCode,
          accountType: def ? def.accountType : 'asset_current',
          internalGroup: def ? def.internalGroup : 'asset',
          totalDebit: new Prisma.Decimal(0),
          totalCredit: new Prisma.Decimal(0),
          finalBalance: new Prisma.Decimal(0),
          movements: [],
        };
        accountsMap.set(line.accountCode, acc);
      }

      acc.totalDebit = acc.totalDebit.plus(line.debit);
      acc.totalCredit = acc.totalCredit.plus(line.credit);
      acc.finalBalance = acc.finalBalance.plus(line.debit).minus(line.credit);

      acc.movements.push({
        id: line.id,
        entryId: line.entryId,
        date: line.entry.date.toISOString().slice(0, 10),
        description: line.entry.description,
        debit: line.debit.toString(),
        credit: line.credit.toString(),
        runningBalance: acc.finalBalance.toString(),
        costCenter: line.costCenter?.name,
        sourceDocumentId: line.entry.sourceDocumentId,
        sourceOperationId: line.entry.sourceOperationId,
      });
    }

    return {
      startDate: query.startDate || null,
      endDate: query.endDate || null,
      accounts: Array.from(accountsMap.values()).map(a => ({
        ...a,
        totalDebit: a.totalDebit.toString(),
        totalCredit: a.totalCredit.toString(),
        finalBalance: a.finalBalance.toString(),
      })),
    };
  }

  // 4. Asiento de Apertura Contable y Cierre Anual
  async postOpeningEntry(tenantId: string, actorId: string, key: string, raw: unknown) {
    const parsed = z.object({
      date: dateSchema,
      description: z.string().trim().min(3).max(250).default('Asiento de apertura del ejercicio'),
      lines: z.array(z.object({ accountCode: z.string(), debit: moneySchema, credit: moneySchema })).min(2),
    }).parse(raw);

    const year = Number(parsed.date.slice(0, 4));

    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      const entryResult = await this.ledger.recordEntry(tx, tenantId, actorId, key, parsed);

      await tx.financeFiscalYear.upsert({
        where: { tenantId_year: { tenantId, year } },
        update: { openingEntryId: entryResult.entry.id },
        create: {
          tenantId,
          year,
          openingEntryId: entryResult.entry.id,
          status: 'OPEN',
        },
      });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'fiscal_year.opening',
          entityId: entryResult.entry.id,
          data: { year, date: parsed.date },
        },
      });

      return entryResult;
    });
  }

  async closeFiscalYear(tenantId: string, actorId: string, year: number) {
    const yearNum = z.number().int().min(2020).max(2050).parse(year);

    return financeTransaction(this.db, async tx => {
      await this.lock(tx, tenantId);

      // Verify all 12 periods of the year are closed
      const periods = await tx.financePeriod.findMany({
        where: {
          tenantId,
          month: { startsWith: `${yearNum}-` },
        },
      });

      const unclosed = periods.filter(p => !p.closedAt);
      if (unclosed.length > 0) {
        throw new FinanceError(409, `Debe cerrar todos los períodos mensuales de ${yearNum} antes del cierre anual.`);
      }

      // Check sum of P&L accounts (4xxxx and 5xxxx)
      const pnlSums = await tx.financeEntryLine.groupBy({
        by: ['accountCode'],
        where: {
          entry: { tenantId, date: { gte: new Date(`${yearNum}-01-01`), lte: new Date(`${yearNum}-12-31`) } },
          OR: [
            { accountCode: { startsWith: '4' } },
            { accountCode: { startsWith: '5' } },
          ],
        },
        _sum: { debit: true, credit: true },
      });

      let totalExpenses = new Prisma.Decimal(0); // 4xxxx
      let totalRevenues = new Prisma.Decimal(0); // 5xxxx
      const closingLines: Array<{ accountCode: string; debit: string; credit: string }> = [];

      for (const row of pnlSums) {
        const d = row._sum.debit || new Prisma.Decimal(0);
        const c = row._sum.credit || new Prisma.Decimal(0);
        const net = d.minus(c); // Positivo = saldo deudor (gasto); Negativo = saldo acreedor (ingreso)

        if (row.accountCode.startsWith('4')) {
          totalExpenses = totalExpenses.plus(net);
          // To cancel expense account: credit the expense account
          if (!net.isZero()) {
            closingLines.push({
              accountCode: row.accountCode,
              debit: '0',
              credit: net.toString(),
            });
          }
        } else if (row.accountCode.startsWith('5')) {
          const rev = c.minus(d); // Ingresos saldo acreedor
          totalRevenues = totalRevenues.plus(rev);
          // To cancel revenue account: debit the revenue account
          if (!rev.isZero()) {
            closingLines.push({
              accountCode: row.accountCode,
              debit: rev.toString(),
              credit: '0',
            });
          }
        }
      }

      const netResult = totalRevenues.minus(totalExpenses); // Positivo = Ganancia, Negativo = Pérdida
      const resultAccount = '310120'; // Resultados Acumulados

      if (netResult.gt(0)) {
        // Ganancia neta: Acreditar Resultados Acumulados
        closingLines.push({
          accountCode: resultAccount,
          debit: '0',
          credit: netResult.toString(),
        });
      } else if (netResult.lt(0)) {
        // Pérdida neta: Debitar Resultados Acumulados
        closingLines.push({
          accountCode: resultAccount,
          debit: netResult.abs().toString(),
          credit: '0',
        });
      }

      const key = `closing:${tenantId}:${yearNum}`;
      const entryResult = await this.ledger.recordEntry(tx, tenantId, actorId, key, {
        date: `${yearNum}-12-31`,
        description: `Asiento de Cierre Anual Ejercicio ${yearNum} · Traspaso a Resultados Acumulados`,
        lines: closingLines,
      });

      await tx.financeFiscalYear.upsert({
        where: { tenantId_year: { tenantId, year: yearNum } },
        update: {
          closingEntryId: entryResult.entry.id,
          status: 'CLOSED',
          resultAmount: netResult.abs(),
          resultType: netResult.gt(0) ? 'PROFIT' : netResult.lt(0) ? 'LOSS' : 'BALANCED',
          closedAt: new Date(),
          closedBy: actorId,
        },
        create: {
          tenantId,
          year: yearNum,
          closingEntryId: entryResult.entry.id,
          status: 'CLOSED',
          resultAmount: netResult.abs(),
          resultType: netResult.gt(0) ? 'PROFIT' : netResult.lt(0) ? 'LOSS' : 'BALANCED',
          closedAt: new Date(),
          closedBy: actorId,
        },
      });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'fiscal_year.close',
          entityId: entryResult.entry.id,
          data: { year: yearNum, netResult: netResult.toString() },
        },
      });

      return {
        year: yearNum,
        netResult: netResult.toString(),
        resultType: netResult.gt(0) ? 'UTILIDAD' : netResult.lt(0) ? 'PERDIDA' : 'EQUILIBRADO',
        closingEntryId: entryResult.entry.id,
      };
    });
  }

  // 5. Informes Financieros Clasificados
  async getBalanceGeneral(tenantId: string, asOfDate?: string) {
    const targetDate = asOfDate || formatSiiTimestamp().slice(0, 10);

    const rows = await this.db.financeEntryLine.findMany({
      where: {
        entry: {
          tenantId,
          date: { lte: new Date(targetDate) },
        },
      },
    });

    const accountSums = new Map<string, Prisma.Decimal>();
    for (const r of rows) {
      const cur = accountSums.get(r.accountCode) || new Prisma.Decimal(0);
      accountSums.set(r.accountCode, cur.plus(r.debit).minus(r.credit));
    }

    const accounts = await this.listAccounts(tenantId);

    // Classification groups:
    // Activo Corriente (11xxxx): Caja, Bancos, CxC, IVA Crédito, Existencias
    // Activo No Corriente / Fijo (12xxxx): Inmuebles, Maquinaria, Equipos
    // Pasivo Corriente (21xxxx): Proveedores, IVA Débito, Retenciones
    // Pasivo Largo Plazo (22xxxx): Préstamos largo plazo
    // Patrimonio (31xxxx): Capital, Resultados acumulados + Resultado ejercicio

    let activoCorriente = new Prisma.Decimal(0);
    let activoFijo = new Prisma.Decimal(0);
    let pasivoCorriente = new Prisma.Decimal(0);
    let pasivoLargoPlazo = new Prisma.Decimal(0);
    let patrimonio = new Prisma.Decimal(0);
    let ingresos = new Prisma.Decimal(0);
    let gastos = new Prisma.Decimal(0);

    const itemsActivoCorriente: Array<{ code: string; name: string; amount: string }> = [];
    const itemsActivoFijo: Array<{ code: string; name: string; amount: string }> = [];
    const itemsPasivoCorriente: Array<{ code: string; name: string; amount: string }> = [];
    const itemsPasivoLargoPlazo: Array<{ code: string; name: string; amount: string }> = [];
    const itemsPatrimonio: Array<{ code: string; name: string; amount: string }> = [];

    for (const acc of accounts) {
      const net = accountSums.get(acc.code) || new Prisma.Decimal(0);
      if (net.isZero()) continue;

      if (acc.code.startsWith('11')) {
        activoCorriente = activoCorriente.plus(net);
        itemsActivoCorriente.push({ code: acc.code, name: acc.name, amount: net.toString() });
      } else if (acc.code.startsWith('12')) {
        activoFijo = activoFijo.plus(net);
        itemsActivoFijo.push({ code: acc.code, name: acc.name, amount: net.toString() });
      } else if (acc.code.startsWith('21')) {
        const pas = net.negated();
        pasivoCorriente = pasivoCorriente.plus(pas);
        itemsPasivoCorriente.push({ code: acc.code, name: acc.name, amount: pas.toString() });
      } else if (acc.code.startsWith('22')) {
        const pas = net.negated();
        pasivoLargoPlazo = pasivoLargoPlazo.plus(pas);
        itemsPasivoLargoPlazo.push({ code: acc.code, name: acc.name, amount: pas.toString() });
      } else if (acc.code.startsWith('31')) {
        const pat = net.negated();
        patrimonio = patrimonio.plus(pat);
        itemsPatrimonio.push({ code: acc.code, name: acc.name, amount: pat.toString() });
      } else if (acc.code.startsWith('4')) {
        gastos = gastos.plus(net);
      } else if (acc.code.startsWith('5')) {
        ingresos = ingresos.plus(net.negated());
      }
    }

    const resultadoEjercicio = ingresos.minus(gastos);
    const totalPatrimonio = patrimonio.plus(resultadoEjercicio);
    const totalActivos = activoCorriente.plus(activoFijo);
    const totalPasivos = pasivoCorriente.plus(pasivoLargoPlazo);
    const totalPasivoYPatrimonio = totalPasivos.plus(totalPatrimonio);
    const cuadratura = totalActivos.equals(totalPasivoYPatrimonio);

    return {
      asOfDate: targetDate,
      activos: {
        corriente: { total: activoCorriente.toString(), items: itemsActivoCorriente },
        fijo: { total: activoFijo.toString(), items: itemsActivoFijo },
        total: totalActivos.toString(),
      },
      pasivos: {
        corriente: { total: pasivoCorriente.toString(), items: itemsPasivoCorriente },
        largoPlazo: { total: pasivoLargoPlazo.toString(), items: itemsPasivoLargoPlazo },
        total: totalPasivos.toString(),
      },
      patrimonio: {
        capitalYReservas: patrimonio.toString(),
        resultadoEjercicio: resultadoEjercicio.toString(),
        total: totalPatrimonio.toString(),
        items: itemsPatrimonio,
      },
      totalPasivoYPatrimonio: totalPasivoYPatrimonio.toString(),
      cuadratura,
    };
  }

  async getEstadoResultados(tenantId: string, startDate?: string, endDate?: string) {
    const todayStr = formatSiiTimestamp().slice(0, 10);
    const start = startDate || `${todayStr.slice(0, 4)}-01-01`;
    const end = endDate || todayStr;

    const rows = await this.db.financeEntryLine.findMany({
      where: {
        entry: {
          tenantId,
          date: { gte: new Date(start), lte: new Date(end) },
        },
        OR: [
          { accountCode: { startsWith: '4' } },
          { accountCode: { startsWith: '5' } },
        ],
      },
      include: { entry: true },
    });

    const accounts = await this.listAccounts(tenantId);
    const accMap = new Map(accounts.map(a => [a.code, a]));

    let ventasNetas = new Prisma.Decimal(0);
    let costoVentas = new Prisma.Decimal(0);
    let gastosAdmin = new Prisma.Decimal(0);
    let otrosIngresos = new Prisma.Decimal(0);
    let otrosGastos = new Prisma.Decimal(0);

    for (const r of rows) {
      if (r.accountCode === '510110' || r.accountCode === '510120') {
        ventasNetas = ventasNetas.plus(r.credit).minus(r.debit);
      } else if (r.accountCode.startsWith('4101')) {
        costoVentas = costoVentas.plus(r.debit).minus(r.credit);
      } else if (r.accountCode.startsWith('4102') || r.accountCode.startsWith('4103')) {
        gastosAdmin = gastosAdmin.plus(r.debit).minus(r.credit);
      } else if (r.accountCode.startsWith('5201')) {
        otrosIngresos = otrosIngresos.plus(r.credit).minus(r.debit);
      } else if (r.accountCode.startsWith('4201')) {
        otrosGastos = otrosGastos.plus(r.debit).minus(r.credit);
      }
    }

    const margenBruto = ventasNetas.minus(costoVentas);
    const resultadoOperacional = margenBruto.minus(gastosAdmin);
    const resultadoNeto = resultadoOperacional.plus(otrosIngresos).minus(otrosGastos);

    return {
      startDate: start,
      endDate: end,
      ventasNetas: ventasNetas.toString(),
      costoVentas: costoVentas.toString(),
      margenBruto: margenBruto.toString(),
      gastosAdmin: gastosAdmin.toString(),
      resultadoOperacional: resultadoOperacional.toString(),
      otrosIngresos: otrosIngresos.toString(),
      otrosGastos: otrosGastos.toString(),
      resultadoNeto: resultadoNeto.toString(),
      margenBrutoPorcentaje: ventasNetas.gt(0) ? margenBruto.div(ventasNetas).mul(100).toFixed(1) + '%' : '0.0%',
      margenNetoPorcentaje: ventasNetas.gt(0) ? resultadoNeto.div(ventasNetas).mul(100).toFixed(1) + '%' : '0.0%',
    };
  }

  async getBalanceOchoColumnas(tenantId: string, asOfDate?: string) {
    const targetDate = asOfDate || formatSiiTimestamp().slice(0, 10);
    const rows = await this.db.financeEntryLine.findMany({
      where: {
        entry: { tenantId, date: { lte: new Date(targetDate) } },
      },
    });

    const map = new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>();
    for (const r of rows) {
      const cur = map.get(r.accountCode) || { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(0) };
      map.set(r.accountCode, { debit: cur.debit.plus(r.debit), credit: cur.credit.plus(r.credit) });
    }

    const accounts = await this.listAccounts(tenantId);
    const filas: Array<{
      code: string;
      name: string;
      debit: string;
      credit: string;
      saldoDeudor: string;
      saldoAcreedor: string;
      activo: string;
      pasivo: string;
      perdida: string;
      ganancia: string;
    }> = [];

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    let totalDeudor = new Prisma.Decimal(0);
    let totalAcreedor = new Prisma.Decimal(0);
    let totalActivo = new Prisma.Decimal(0);
    let totalPasivo = new Prisma.Decimal(0);
    let totalPerdida = new Prisma.Decimal(0);
    let totalGanancia = new Prisma.Decimal(0);

    for (const acc of accounts) {
      const s = map.get(acc.code);
      if (!s || (s.debit.isZero() && s.credit.isZero())) continue;

      totalDebit = totalDebit.plus(s.debit);
      totalCredit = totalCredit.plus(s.credit);

      const net = s.debit.minus(s.credit);
      const deudor = net.gt(0) ? net : new Prisma.Decimal(0);
      const acreedor = net.lt(0) ? net.abs() : new Prisma.Decimal(0);

      totalDeudor = totalDeudor.plus(deudor);
      totalAcreedor = totalAcreedor.plus(acreedor);

      const isBalanceAccount = acc.includeInitialBalance; // 1xxxx, 2xxxx, 3xxxx

      const activo = isBalanceAccount ? deudor : new Prisma.Decimal(0);
      const pasivo = isBalanceAccount ? acreedor : new Prisma.Decimal(0);
      const perdida = !isBalanceAccount ? deudor : new Prisma.Decimal(0);
      const ganancia = !isBalanceAccount ? acreedor : new Prisma.Decimal(0);

      totalActivo = totalActivo.plus(activo);
      totalPasivo = totalPasivo.plus(pasivo);
      totalPerdida = totalPerdida.plus(perdida);
      totalGanancia = totalGanancia.plus(ganancia);

      filas.push({
        code: acc.code,
        name: acc.name,
        debit: s.debit.toString(),
        credit: s.credit.toString(),
        saldoDeudor: deudor.toString(),
        saldoAcreedor: acreedor.toString(),
        activo: activo.toString(),
        pasivo: pasivo.toString(),
        perdida: perdida.toString(),
        ganancia: ganancia.toString(),
      });
    }

    const diffInventario = totalActivo.minus(totalPasivo);
    const diffResultado = totalGanancia.minus(totalPerdida);
    const resultadoMonto = diffResultado.abs();
    const resultadoTipo = diffResultado.gt(0) ? 'UTILIDAD' : diffResultado.lt(0) ? 'PERDIDA' : 'EQUILIBRADO';

    return {
      asOfDate: targetDate,
      filas,
      totales: {
        debitos: totalDebit.toString(),
        creditos: totalCredit.toString(),
        saldoDeudor: totalDeudor.toString(),
        saldoAcreedor: totalAcreedor.toString(),
        activo: totalActivo.toString(),
        pasivo: totalPasivo.toString(),
        perdida: totalPerdida.toString(),
        ganancia: totalGanancia.toString(),
      },
      resultado: {
        tipo: resultadoTipo,
        monto: resultadoMonto.toString(),
        cuadrado: totalDebit.equals(totalCredit) && totalDeudor.equals(totalAcreedor) && diffInventario.equals(diffResultado),
      },
    };
  }

  // 6. Dashboard Financiero Consolidado y KPIs
  async getDashboardOverview(tenantId: string, monthParam?: string) {
    const todayStr = formatSiiTimestamp().slice(0, 10);
    const month = monthParam || todayStr.slice(0, 7);

    // 1. Cuentas por Cobrar (CxC)
    const receivables = await this.db.financeReceivable.findMany({
      where: { tenantId },
      include: { receipts: true, invoiceAllocations: true, creditAllocations: true, customer: true },
    });

    let totalCxC = new Prisma.Decimal(0);
    let overdueCxC = new Prisma.Decimal(0);
    for (const r of receivables) {
      if (r.amount.lte(0)) continue; // skip credit notes
      const receiptsSum = r.receipts.reduce((acc, it) => acc.plus(it.amount), new Prisma.Decimal(0));
      const creditsSum = r.invoiceAllocations.reduce((acc, it) => acc.plus(it.amount), new Prisma.Decimal(0));
      const bal = r.amount.minus(receiptsSum).minus(creditsSum);
      if (bal.gt(0)) {
        totalCxC = totalCxC.plus(bal);
        if (r.dueDate && r.dueDate < new Date(todayStr)) {
          overdueCxC = overdueCxC.plus(bal);
        }
      }
    }

    // 2. Cuentas por Pagar (CxP)
    const payables = await this.db.financePayable.findMany({
      where: { tenantId, kind: 'DEBT', status: { not: 'PAGADA' } },
      include: { payments: true, creditAllocations: true, vendor: true },
    });

    let totalCxP = new Prisma.Decimal(0);
    let overdueCxP = new Prisma.Decimal(0);
    for (const p of payables) {
      const paymentsSum = p.payments.reduce((acc, it) => acc.plus(it.amount), new Prisma.Decimal(0));
      const creditsSum = p.creditAllocations.reduce((acc, it) => acc.plus(it.amount), new Prisma.Decimal(0));
      const bal = p.totalAmount.minus(paymentsSum).minus(creditsSum);
      if (bal.gt(0)) {
        totalCxP = totalCxP.plus(bal);
        if (p.dueDate && p.dueDate < new Date(todayStr)) {
          overdueCxP = overdueCxP.plus(bal);
        }
      }
    }

    // 3. Liquidez Inmediata (Cajas y Bancos)
    const cashBoxes = await this.db.financeCashBox.findMany({ where: { tenantId } });
    const bankAccounts = await this.db.financeBankAccount.findMany({ where: { tenantId } });

    const entryLines = await this.db.financeEntryLine.groupBy({
      by: ['accountCode'],
      where: { entry: { tenantId } },
      _sum: { debit: true, credit: true },
    });

    const balanceMap = new Map<string, Prisma.Decimal>();
    for (const l of entryLines) {
      const net = (l._sum.debit || new Prisma.Decimal(0)).minus(l._sum.credit || new Prisma.Decimal(0));
      balanceMap.set(l.accountCode, net);
    }

    let totalCash = new Prisma.Decimal(0);
    for (const cb of cashBoxes) {
      totalCash = totalCash.plus(balanceMap.get(cb.accountCode) || new Prisma.Decimal(0));
    }

    let totalBank = new Prisma.Decimal(0);
    for (const ba of bankAccounts) {
      const net = balanceMap.get(ba.accountCode) || new Prisma.Decimal(0);
      totalBank = totalBank.plus(ba.initialBalance.plus(net));
    }

    const totalLiquidity = totalCash.plus(totalBank);

    // 4. Ventas y Compras del mes (DTE + Directos)
    const pnlMonth = await this.getEstadoResultados(tenantId, `${month}-01`, todayStr);

    // 5. KPIs Financieros
    const morosidadRatio = totalCxC.gt(0) ? overdueCxC.div(totalCxC).mul(100).toFixed(1) + '%' : '0.0%';
    const capitalDeTrabajo = totalLiquidity.plus(totalCxC).minus(totalCxP);

    // Alertas
    const alerts: Array<{ severity: 'HIGH' | 'MEDIUM' | 'INFO'; title: string; message: string }> = [];

    if (overdueCxC.gt(0)) {
      alerts.push({
        severity: 'MEDIUM',
        title: 'Cartera de Clientes Vencida',
        message: `Existen ${overdueCxC.toString()} CLP en cuentas por cobrar vencidas fuera de plazo.`,
      });
    }

    if (overdueCxP.gt(0)) {
      alerts.push({
        severity: 'HIGH',
        title: 'Facturas de Proveedores Vencidas',
        message: `Existen ${overdueCxP.toString()} CLP pendientes de pago a proveedores con fecha expirada.`,
      });
    }

    if (totalLiquidity.lt(100000)) {
      alerts.push({
        severity: 'HIGH',
        title: 'Alerta de Liquidez Crítica',
        message: `La disponibilidad en cajas y bancos es baja (${totalLiquidity.toString()} CLP). Monitorea el flujo de caja.`,
      });
    }

    return {
      month,
      liquidity: {
        cash: totalCash.toString(),
        bank: totalBank.toString(),
        total: totalLiquidity.toString(),
      },
      receivables: {
        total: totalCxC.toString(),
        overdue: overdueCxC.toString(),
        current: totalCxC.minus(overdueCxC).toString(),
        morosidadRatio,
      },
      payables: {
        total: totalCxP.toString(),
        overdue: overdueCxP.toString(),
        current: totalCxP.minus(overdueCxP).toString(),
      },
      performance: {
        salesMonth: pnlMonth.ventasNetas,
        expensesMonth: pnlMonth.costoVentas,
        grossMargin: pnlMonth.margenBruto,
        netResult: pnlMonth.resultadoNeto,
        grossMarginPercent: pnlMonth.margenBrutoPorcentaje,
      },
      workingCapital: capitalDeTrabajo.toString(),
      alerts,
    };
  }
}
