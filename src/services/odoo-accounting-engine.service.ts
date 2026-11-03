import crypto from 'node:crypto';
import { CodigoTipoDTE } from '../types/sii-dte.types';
import { OdooMoveType } from './odoo-account-move.service';

// ============================================================================
// MOTOR CONTABLE ODOO 18 + L10N_CL MEJORADO (PARTIDA DOBLE & BALANCE 8 COLUMNAS)
// Reconstrucción REA de:
//   - addons/account/models/account_account.py
//   - addons/account/models/account_move.py
//   - addons/account/models/account_move_line.py
//   - addons/l10n_cl/models/template_cl.py
//   - addons/l10n_cl/data/template/account.account-cl.csv
// ============================================================================

export type OdooAccountType =
  | 'asset_receivable'
  | 'asset_cash'
  | 'asset_current'
  | 'asset_non_current'
  | 'asset_prepayments'
  | 'asset_fixed'
  | 'liability_payable'
  | 'liability_credit_card'
  | 'liability_current'
  | 'liability_non_current'
  | 'equity'
  | 'equity_unaffected'
  | 'income'
  | 'income_other'
  | 'expense'
  | 'expense_depreciation'
  | 'expense_direct_cost'
  | 'off_balance';

export type OdooInternalGroup = 'asset' | 'liability' | 'equity' | 'income' | 'expense' | 'off';

export interface OdooAccountDefinition {
  code: string; // 6 dígitos según template_cl.py (`code_digits: 6`)
  name: string;
  accountType: OdooAccountType;
  internalGroup: OdooInternalGroup;
  reconcile: boolean;
  includeInitialBalance: boolean; // true = Cuentas de Balance (Inventario), false = Cuentas de Resultado (P&L)
  siiClassification: 'ACTIVO_CORRIENTE' | 'ACTIVO_FIJO' | 'PASIVO_CORRIENTE' | 'PATRIMONIO' | 'INGRESO_OPERACIONAL' | 'COSTO_GASTO';
}

/**
 * Plan de Cuentas Oficial de Chile clonado de `addons/l10n_cl/data/template/account.account-cl.csv`
 * y `addons/l10n_cl/models/template_cl.py` de Odoo 18.
 */
export const ODOO_CL_CHART_OF_ACCOUNTS: OdooAccountDefinition[] = [
  // 1. ACTIVOS (11xxxx Corrientes / 12xxxx Fijos)
  {
    code: '110110',
    name: 'Caja y Bancos Moneda Nacional',
    accountType: 'asset_cash',
    internalGroup: 'asset',
    reconcile: false,
    includeInitialBalance: true,
    siiClassification: 'ACTIVO_CORRIENTE',
  },
  {
    code: '110210',
    name: 'Depósitos en Divisas / Fondos Mutuos',
    accountType: 'asset_current',
    internalGroup: 'asset',
    reconcile: false,
    includeInitialBalance: true,
    siiClassification: 'ACTIVO_CORRIENTE',
  },
  {
    code: '110310',
    name: 'Clientes Nacionales (Deudores por Ventas)',
    accountType: 'asset_receivable',
    internalGroup: 'asset',
    reconcile: true,
    includeInitialBalance: true,
    siiClassification: 'ACTIVO_CORRIENTE',
  },
  {
    code: '110315',
    name: 'Facturas Cedidas por Cobrar (Factoring)',
    accountType: 'asset_receivable',
    internalGroup: 'asset',
    reconcile: true,
    includeInitialBalance: true,
    siiClassification: 'ACTIVO_CORRIENTE',
  },
  {
    code: '110610',
    name: 'Mercaderías y Existencias',
    accountType: 'asset_current',
    internalGroup: 'asset',
    reconcile: false,
    includeInitialBalance: true,
    siiClassification: 'ACTIVO_CORRIENTE',
  },
  {
    code: '110710',
    name: 'IVA Crédito Fiscal',
    accountType: 'asset_current',
    internalGroup: 'asset',
    reconcile: false,
    includeInitialBalance: true,
    siiClassification: 'ACTIVO_CORRIENTE',
  },
  {
    code: '110720',
    name: 'Remanente Crédito Fiscal IVA',
    accountType: 'asset_current',
    internalGroup: 'asset',
    reconcile: false,
    includeInitialBalance: true,
    siiClassification: 'ACTIVO_CORRIENTE',
  },
  {
    code: '110740',
    name: 'P.P.M. (Pagos Provisionales Mensuales) / Art. 33 BIS',
    accountType: 'asset_receivable',
    internalGroup: 'asset',
    reconcile: true,
    includeInitialBalance: true,
    siiClassification: 'ACTIVO_CORRIENTE',
  },
  {
    code: '121110',
    name: 'Equipos y Mobiliario de Oficina',
    accountType: 'asset_fixed',
    internalGroup: 'asset',
    reconcile: false,
    includeInitialBalance: true,
    siiClassification: 'ACTIVO_FIJO',
  },
  {
    code: '121120',
    name: 'Equipos Computacionales y Servidores',
    accountType: 'asset_fixed',
    internalGroup: 'asset',
    reconcile: false,
    includeInitialBalance: true,
    siiClassification: 'ACTIVO_FIJO',
  },

  // 2. PASIVOS (21xxxx Corrientes)
  {
    code: '210210',
    name: 'Proveedores Nacionales (Cuentas por Pagar)',
    accountType: 'liability_payable',
    internalGroup: 'liability',
    reconcile: true,
    includeInitialBalance: true,
    siiClassification: 'PASIVO_CORRIENTE',
  },
  {
    code: '210510',
    name: 'Honorarios por Pagar / Retención 2ª Categoría',
    accountType: 'liability_payable',
    internalGroup: 'liability',
    reconcile: true,
    includeInitialBalance: true,
    siiClassification: 'PASIVO_CORRIENTE',
  },
  {
    code: '210610',
    name: 'Remuneraciones e Imposiciones por Pagar',
    accountType: 'liability_current',
    internalGroup: 'liability',
    reconcile: false,
    includeInitialBalance: true,
    siiClassification: 'PASIVO_CORRIENTE',
  },
  {
    code: '210710',
    name: 'IVA Débito Fiscal',
    accountType: 'liability_current',
    internalGroup: 'liability',
    reconcile: false,
    includeInitialBalance: true,
    siiClassification: 'PASIVO_CORRIENTE',
  },
  {
    code: '210720',
    name: 'Impuestos Mensuales F29 por Pagar',
    accountType: 'liability_current',
    internalGroup: 'liability',
    reconcile: false,
    includeInitialBalance: true,
    siiClassification: 'PASIVO_CORRIENTE',
  },

  // 3. PATRIMONIO (31xxxx Capital y Resultados Acumulados)
  {
    code: '310110',
    name: 'Capital Social Pagado',
    accountType: 'equity',
    internalGroup: 'equity',
    reconcile: false,
    includeInitialBalance: true,
    siiClassification: 'PATRIMONIO',
  },
  {
    code: '310210',
    name: 'Utilidades Acumuladas / Resultados Ejercicios Anteriores',
    accountType: 'equity',
    internalGroup: 'equity',
    reconcile: false,
    includeInitialBalance: true,
    siiClassification: 'PATRIMONIO',
  },
  {
    code: '399999',
    name: 'Resultado del Ejercicio (Utilidad / Pérdida No Distribuida)',
    accountType: 'equity_unaffected',
    internalGroup: 'equity',
    reconcile: false,
    includeInitialBalance: true,
    siiClassification: 'PATRIMONIO',
  },

  // 4. COSTOS Y GASTOS (41xxxx Resultado Pérdida)
  {
    code: '410110',
    name: 'Costo de Ventas y Servicios del Giro',
    accountType: 'expense_direct_cost',
    internalGroup: 'expense',
    reconcile: false,
    includeInitialBalance: false,
    siiClassification: 'COSTO_GASTO',
  },
  {
    code: '410210',
    name: 'Remuneraciones y Sueldos del Personal',
    accountType: 'expense',
    internalGroup: 'expense',
    reconcile: false,
    includeInitialBalance: false,
    siiClassification: 'COSTO_GASTO',
  },
  {
    code: '410235',
    name: 'Gastos Generales, Cloud, Telecomunicaciones y Administración',
    accountType: 'expense',
    internalGroup: 'expense',
    reconcile: false,
    includeInitialBalance: false,
    siiClassification: 'COSTO_GASTO',
  },
  {
    code: '410290',
    name: 'Depreciación del Ejercicio',
    accountType: 'expense_depreciation',
    internalGroup: 'expense',
    reconcile: false,
    includeInitialBalance: false,
    siiClassification: 'COSTO_GASTO',
  },

  // 5. INGRESOS (51xxxx Resultado Ganancia)
  {
    code: '510110',
    name: 'Ingresos por Ventas y Servicios del Giro (Afectos)',
    accountType: 'income',
    internalGroup: 'income',
    reconcile: false,
    includeInitialBalance: false,
    siiClassification: 'INGRESO_OPERACIONAL',
  },
  {
    code: '510120',
    name: 'Ingresos por Ventas y Servicios Exentos de IVA',
    accountType: 'income',
    internalGroup: 'income',
    reconcile: false,
    includeInitialBalance: false,
    siiClassification: 'INGRESO_OPERACIONAL',
  },
  {
    code: '520110',
    name: 'Otros Ingresos Fuera de Explotación / Diferencia de Cambio',
    accountType: 'income_other',
    internalGroup: 'income',
    reconcile: false,
    includeInitialBalance: false,
    siiClassification: 'INGRESO_OPERACIONAL',
  },
];

/**
 * Representa un Apunte Contable de Partida Doble (`account.move.line` en Odoo)
 */
export interface OdooJournalItem {
  id: string;
  tenantId: string;
  moveId: string;
  moveName: string; // Ej: "FAC 000001", "COMP-33 #884512", "BNK1/2026/0001", "MISC/2026/0001"
  journalCode: 'INV' | 'BOL' | 'BILL' | 'BNK1' | 'CSH1' | 'MISC';
  date: string; // YYYY-MM-DD
  accountCode: string; // Ej: "110310", "510110", "210710"
  accountName: string;
  partnerRut?: string;
  partnerName?: string;
  label: string; // Glosa del apunte
  debit: number; // Debe (CLP entero)
  credit: number; // Haber (CLP entero)
  balance: number; // debit - credit
  reconciled: boolean;
  matchingNumber?: string; // Ej: "A001" cuando se concilia Factura vs Pago o Factura vs Nota de Crédito
}

/**
 * Fila del Balance Tributario de 8 Columnas (Formato Oficial SII Chile)
 */
export interface FilaBalanceOchoColumnas {
  accountCode: string;
  accountName: string;
  accountType: OdooAccountType;
  internalGroup: OdooInternalGroup;
  // Columnas 1 y 2: SUMAS
  debitos: number;
  creditos: number;
  // Columnas 3 y 4: SALDOS
  saldoDeudor: number;
  saldoAcreedor: number;
  // Columnas 5 y 6: INVENTARIO (Balance General: Activo / Pasivo + Patrimonio)
  activo: number;
  pasivo: number;
  // Columnas 7 y 8: RESULTADOS (Estado de Resultados: Pérdida / Ganancia)
  perdida: number;
  ganancia: number;
}

export interface ReporteBalanceOchoColumnas {
  periodoHasta: string;
  filas: FilaBalanceOchoColumnas[];
  subtotales: {
    debitos: number;
    creditos: number;
    saldoDeudor: number;
    saldoAcreedor: number;
    activo: number;
    pasivo: number;
    perdida: number;
    ganancia: number;
  };
  resultadoEjercicio: {
    monto: number; // |ganancia - perdida| === |activo - pasivo|
    tipo: 'UTILIDAD' | 'PERDIDA' | 'EQUILIBRADO';
    cuadraturaPerfecta: boolean; // Verifica que (Activo - Pasivo) === (Ganancia - Pérdida) y Sumas Debe === Haber
  };
  totalesFinalesCuadrados: {
    debitos: number;
    creditos: number;
    saldoDeudor: number;
    saldoAcreedor: number;
    activo: number;
    pasivo: number;
    perdida: number;
    ganancia: number;
  };
}

export class OdooAccountingEngineService {
  /**
   * Obtiene la definición de una cuenta del Plan de Cuentas Chileno (`l10n_cl`) por código.
   */
  public static getAccountByCode(code: string): OdooAccountDefinition {
    const acc = ODOO_CL_CHART_OF_ACCOUNTS.find((a) => a.code === code);
    if (!acc) {
      throw new Error(`Cuenta contable '${code}' no existe en el Plan de Cuentas SII / Odoo l10n_cl.`);
    }
    return acc;
  }

  /**
   * Valida el invariante fundamental de Partida Doble de Odoo (`_check_balanced` en `account_move.py`):
   * En todo asiento contable publicado, la suma de Débitos debe ser exactamente igual a la suma de Créditos.
   */
  public static assertBalancedJournalItems(items: OdooJournalItem[], moveName: string): void {
    const totalDebit = items.reduce((acc, l) => acc + Math.round(l.debit), 0);
    const totalCredit = items.reduce((acc, l) => acc + Math.round(l.credit), 0);
    if (totalDebit !== totalCredit) {
      throw new Error(
        `[Odoo _check_balanced Error] El asiento '${moveName}' está descuadrado: Total Debe ($${totalDebit}) !== Total Haber ($${totalCredit}).`
      );
    }
  }

  /**
   * Genera automáticamente los apuntes contables de Partida Doble (`account.move.line`)
   * al publicar una Factura de Venta (33, 34), Boleta (39, 41), Nota de Crédito (61)
   * o Factura de Compra de Proveedor (`IN_INVOICE`, `IN_REFUND`).
   */
  public static generateJournalItemsForInvoiceMove(params: {
    tenantId: string;
    moveId: string;
    moveName: string;
    moveType: OdooMoveType;
    documentTypeCode: CodigoTipoDTE;
    date: string;
    partnerRut: string;
    partnerName: string;
    amountUntaxed: number;
    amountExempt: number;
    amountTax: number;
    amountTotal: number;
    tipoCompraSii?: 'DEL_GIRO' | 'SUPERMERCADO' | 'ACTIVO_FIJO' | 'IVA_NO_RECUPERABLE';
  }): OdooJournalItem[] {
    const items: OdooJournalItem[] = [];
    const {
      tenantId,
      moveId,
      moveName,
      moveType,
      documentTypeCode,
      date,
      partnerRut,
      partnerName,
      amountUntaxed,
      amountExempt,
      amountTax,
      amountTotal,
    } = params;

    if (amountTotal <= 0) {
      // Caso especial: Nota de Crédito código 2 "Corrige Texto Documento de Referencia" (Monto 0)
      return [];
    }

    const addLine = (
      accountCode: string,
      label: string,
      debit: number,
      credit: number,
      journalCode: OdooJournalItem['journalCode']
    ) => {
      if (debit === 0 && credit === 0) return;
      const acc = this.getAccountByCode(accountCode);
      items.push({
        id: crypto.randomUUID(),
        tenantId,
        moveId,
        moveName,
        journalCode,
        date,
        accountCode: acc.code,
        accountName: acc.name,
        partnerRut,
        partnerName,
        label,
        debit: Math.round(debit),
        credit: Math.round(credit),
        balance: Math.round(debit) - Math.round(credit),
        reconciled: false,
      });
    };

    const isBoleta =
      documentTypeCode === CodigoTipoDTE.BoletaElectronica ||
      documentTypeCode === CodigoTipoDTE.BoletaNoAfectaOExenta;

    if (moveType === 'OUT_INVOICE') {
      const jCode = isBoleta ? 'BOL' : 'INV';
      // 1. DEBE: Cuenta por Cobrar Clientes Nacionales (110310) por el Total Bruto
      addLine(
        '110310',
        `CxC ${moveName} - ${partnerName}`,
        amountTotal,
        0,
        jCode
      );
      // 2. HABER: Ingresos por Ventas Afectas del Giro (510110) por el Neto
      if (amountUntaxed > 0) {
        addLine(
          '510110',
          `Ingreso Afecto ${moveName}`,
          0,
          amountUntaxed,
          jCode
        );
      }
      // 3. HABER: Ingresos por Ventas Exentas (510120) por el Exento
      if (amountExempt > 0) {
        addLine(
          '510120',
          `Ingreso Exento ${moveName}`,
          0,
          amountExempt,
          jCode
        );
      }
      // 4. HABER: IVA Débito Fiscal (210710) por el 19% IVA
      if (amountTax > 0) {
        addLine(
          '210710',
          `IVA Débito Fiscal 19% ${moveName}`,
          0,
          amountTax,
          jCode
        );
      }
    } else if (moveType === 'OUT_REFUND') {
      // Nota de Crédito de Venta (61): Invierte exactamente la naturaleza del asiento de venta
      const jCode = 'INV';
      if (amountUntaxed > 0) {
        addLine('510110', `Reverso Ingreso por NC ${moveName}`, amountUntaxed, 0, jCode);
      }
      if (amountExempt > 0) {
        addLine('510120', `Reverso Ingreso Exento por NC ${moveName}`, amountExempt, 0, jCode);
      }
      if (amountTax > 0) {
        addLine('210710', `Rebaja IVA Débito por NC ${moveName}`, amountTax, 0, jCode);
      }
      addLine('110310', `Abono CxC Cliente por NC ${moveName}`, 0, amountTotal, jCode);
    } else if (moveType === 'IN_INVOICE') {
      // Factura de Compra Proveedor recibida en RCV
      const jCode = 'BILL';
      const cuentaGastoOCosto =
        params.tipoCompraSii === 'ACTIVO_FIJO' ? '121120' : '410235';
      // IVA no recuperable (Art. 23 DL 825): no genera crédito fiscal y se suma al gasto
      const ivaNoRecuperable = params.tipoCompraSii === 'IVA_NO_RECUPERABLE';
      const baseGasto = amountUntaxed + amountExempt + (ivaNoRecuperable ? amountTax : 0);

      // 1. DEBE: Gasto / Costo o Activo Fijo por Neto + Exento (+ IVA no recuperable)
      if (baseGasto > 0) {
        addLine(
          cuentaGastoOCosto,
          `Compra Proveedor ${moveName} - ${partnerName}`,
          baseGasto,
          0,
          jCode
        );
      }
      // 2. DEBE: IVA Crédito Fiscal (110710) por el 19% IVA
      if (amountTax > 0 && !ivaNoRecuperable) {
        addLine(
          '110710',
          `IVA Crédito Fiscal 19% ${moveName}`,
          amountTax,
          0,
          jCode
        );
      }
      // 3. HABER: Proveedores Nacionales (210210) por el Total
      addLine(
        '210210',
        `CxP Proveedor ${moveName} - ${partnerName}`,
        0,
        amountTotal,
        jCode
      );
    } else if (moveType === 'IN_REFUND') {
      const jCode = 'BILL';
      const baseGasto = amountUntaxed + amountExempt;
      addLine('210210', `Rebaja CxP Proveedor por NC ${moveName}`, amountTotal, 0, jCode);
      if (baseGasto > 0) {
        addLine('410235', `Rebaja Gasto por NC Recibida ${moveName}`, 0, baseGasto, jCode);
      }
      if (amountTax > 0) {
        addLine('110710', `Disminución IVA Crédito por NC ${moveName}`, 0, amountTax, jCode);
      }
    }

    this.assertBalancedJournalItems(items, moveName);
    return items;
  }

  /**
   * Genera el asiento contable de Pago y Conciliación (`account.payment` en Odoo):
   * - Si es cobro de factura de cliente (`OUT_INVOICE`):
   *   DEBE `110110 Caja y Bancos` vs HABER `110310 Clientes Nacionales`
   * - Si es pago de factura de proveedor (`IN_INVOICE`):
   *   DEBE `210210 Proveedores Nacionales` vs HABER `110110 Caja y Bancos`
   */
  public static generateJournalItemsForPayment(params: {
    tenantId: string;
    paymentId: string;
    paymentName: string;
    invoiceMoveType: OdooMoveType;
    invoiceMoveName: string;
    date: string;
    partnerRut: string;
    partnerName: string;
    amount: number;
    matchingNumber: string;
  }): OdooJournalItem[] {
    const {
      tenantId,
      paymentId,
      paymentName,
      invoiceMoveType,
      invoiceMoveName,
      date,
      partnerRut,
      partnerName,
      amount,
      matchingNumber,
    } = params;

    const bankAcc = this.getAccountByCode('110110');
    const items: OdooJournalItem[] = [];

    if (invoiceMoveType === 'OUT_INVOICE') {
      const recAcc = this.getAccountByCode('110310');
      items.push(
        {
          id: crypto.randomUUID(),
          tenantId,
          moveId: paymentId,
          moveName: paymentName,
          journalCode: 'BNK1',
          date,
          accountCode: bankAcc.code,
          accountName: bankAcc.name,
          partnerRut,
          partnerName,
          label: `Ingreso Banco Cobro ${invoiceMoveName}`,
          debit: Math.round(amount),
          credit: 0,
          balance: Math.round(amount),
          reconciled: false,
        },
        {
          id: crypto.randomUUID(),
          tenantId,
          moveId: paymentId,
          moveName: paymentName,
          journalCode: 'BNK1',
          date,
          accountCode: recAcc.code,
          accountName: recAcc.name,
          partnerRut,
          partnerName,
          label: `Conciliación Cliente ${invoiceMoveName}`,
          debit: 0,
          credit: Math.round(amount),
          balance: -Math.round(amount),
          reconciled: true,
          matchingNumber,
        }
      );
    } else {
      const payAcc = this.getAccountByCode('210210');
      items.push(
        {
          id: crypto.randomUUID(),
          tenantId,
          moveId: paymentId,
          moveName: paymentName,
          journalCode: 'BNK1',
          date,
          accountCode: payAcc.code,
          accountName: payAcc.name,
          partnerRut,
          partnerName,
          label: `Conciliación Pago Proveedor ${invoiceMoveName}`,
          debit: Math.round(amount),
          credit: 0,
          balance: Math.round(amount),
          reconciled: true,
          matchingNumber,
        },
        {
          id: crypto.randomUUID(),
          tenantId,
          moveId: paymentId,
          moveName: paymentName,
          journalCode: 'BNK1',
          date,
          accountCode: bankAcc.code,
          accountName: bankAcc.name,
          partnerRut,
          partnerName,
          label: `Egreso Banco Pago ${invoiceMoveName}`,
          debit: 0,
          credit: Math.round(amount),
          balance: -Math.round(amount),
          reconciled: false,
        }
      );
    }

    this.assertBalancedJournalItems(items, paymentName);
    return items;
  }

  /**
   * Construye el **Balance Tributario de 8 Columnas (Formato Oficial SII Chile)** y el
   * **Estado de Resultados (P&L)** a partir de todos los apuntes contables publicados del Tenant.
   *
   * Regla Matemática del Balance de 8 Columnas Chileno:
   * - Columnas 1 y 2 (Sumas): Total Débitos y Total Créditos por cuenta.
   * - Columnas 3 y 4 (Saldos):
   *   - Si Débitos > Créditos => Saldo Deudor = Débitos - Créditos.
   *   - Si Créditos > Débitos => Saldo Acreedor = Créditos - Débitos.
   * - Columnas 5 y 6 (Inventario / Balance General):
   *   - Solo cuentas donde `includeInitialBalance === true` (`asset`, `liability`, `equity`).
   *   - Activo = Saldo Deudor; Pasivo = Saldo Acreedor.
   * - Columnas 7 y 8 (Resultados / Estado de Resultados):
   *   - Solo cuentas donde `includeInitialBalance === false` (`expense`, `income`).
   *   - Pérdida = Saldo Deudor; Ganancia = Saldo Acreedor.
   * - Cuadratura de Utilidad o Pérdida del Ejercicio:
   *   $(\text{Activo} - \text{Pasivo}) \equiv (\text{Ganancia} - \text{Pérdida})$
   */
  public static computeBalanceOchoColumnas(
    journalItems: OdooJournalItem[],
    periodoHasta: string = '2026-10-31'
  ): ReporteBalanceOchoColumnas {
    const mapByAccount = new Map<string, { debit: number; credit: number }>();

    for (const item of journalItems) {
      if (item.date > periodoHasta) continue;
      const cur = mapByAccount.get(item.accountCode) || { debit: 0, credit: 0 };
      cur.debit += item.debit;
      cur.credit += item.credit;
      mapByAccount.set(item.accountCode, cur);
    }

    const filas: FilaBalanceOchoColumnas[] = [];

    const sortedCodes = Array.from(mapByAccount.keys()).sort();
    for (const code of sortedCodes) {
      const sums = mapByAccount.get(code)!;
      if (sums.debit === 0 && sums.credit === 0) continue;

      const def = this.getAccountByCode(code);
      const diff = sums.debit - sums.credit;
      const saldoDeudor = diff > 0 ? diff : 0;
      const saldoAcreedor = diff < 0 ? Math.abs(diff) : 0;

      const isInventario = def.includeInitialBalance; // true para Activo/Pasivo/Patrimonio

      filas.push({
        accountCode: def.code,
        accountName: def.name,
        accountType: def.accountType,
        internalGroup: def.internalGroup,
        debitos: sums.debit,
        creditos: sums.credit,
        saldoDeudor,
        saldoAcreedor,
        activo: isInventario ? saldoDeudor : 0,
        pasivo: isInventario ? saldoAcreedor : 0,
        perdida: !isInventario ? saldoDeudor : 0,
        ganancia: !isInventario ? saldoAcreedor : 0,
      });
    }

    const subtotales = filas.reduce(
      (acc, f) => ({
        debitos: acc.debitos + f.debitos,
        creditos: acc.creditos + f.creditos,
        saldoDeudor: acc.saldoDeudor + f.saldoDeudor,
        saldoAcreedor: acc.saldoAcreedor + f.saldoAcreedor,
        activo: acc.activo + f.activo,
        pasivo: acc.pasivo + f.pasivo,
        perdida: acc.perdida + f.perdida,
        ganancia: acc.ganancia + f.ganancia,
      }),
      {
        debitos: 0,
        creditos: 0,
        saldoDeudor: 0,
        saldoAcreedor: 0,
        activo: 0,
        pasivo: 0,
        perdida: 0,
        ganancia: 0,
      }
    );

    const diffInventario = subtotales.activo - subtotales.pasivo;
    const diffResultado = subtotales.ganancia - subtotales.perdida;
    const cuadraturaPerfecta =
      subtotales.debitos === subtotales.creditos &&
      subtotales.saldoDeudor === subtotales.saldoAcreedor &&
      diffInventario === diffResultado;

    const montoResultado = Math.abs(diffResultado);
    const tipoResultado: 'UTILIDAD' | 'PERDIDA' | 'EQUILIBRADO' =
      diffResultado > 0 ? 'UTILIDAD' : diffResultado < 0 ? 'PERDIDA' : 'EQUILIBRADO';

    // Al agregar la fila de Utilidad o Pérdida del Ejercicio:
    // - Si hay UTILIDAD (Ganancia > Pérdida y Activo > Pasivo): se suma a Pasivo y a Pérdida para cuadrar columnas 5=6 y 7=8.
    // - Si hay PÉRDIDA (Pérdida > Ganancia y Pasivo > Activo): se suma a Activo y a Ganancia para cuadrar columnas 5=6 y 7=8.
    const totalesFinalesCuadrados = {
      debitos: subtotales.debitos,
      creditos: subtotales.creditos,
      saldoDeudor: subtotales.saldoDeudor,
      saldoAcreedor: subtotales.saldoAcreedor,
      activo: subtotales.activo + (tipoResultado === 'PERDIDA' ? montoResultado : 0),
      pasivo: subtotales.pasivo + (tipoResultado === 'UTILIDAD' ? montoResultado : 0),
      perdida: subtotales.perdida + (tipoResultado === 'UTILIDAD' ? montoResultado : 0),
      ganancia: subtotales.ganancia + (tipoResultado === 'PERDIDA' ? montoResultado : 0),
    };

    return {
      periodoHasta,
      filas,
      subtotales,
      resultadoEjercicio: {
        monto: montoResultado,
        tipo: tipoResultado,
        cuadraturaPerfecta,
      },
      totalesFinalesCuadrados,
    };
  }

  /**
   * Construye el Libro Mayor (`General Ledger` de Odoo) agrupado por Cuenta Contable,
   * calculando el saldo acumulado línea por línea.
   */
  public static computeLibroMayor(journalItems: OdooJournalItem[]) {
    const grouped = new Map<
      string,
      {
        accountCode: string;
        accountName: string;
        siiClassification: string;
        totalDebit: number;
        totalCredit: number;
        finalBalance: number;
        entries: Array<OdooJournalItem & { runningBalance: number }>;
      }
    >();

    // Ordenar cronológicamente para el saldo progresivo
    const chronological = [...journalItems].sort((a, b) => a.date.localeCompare(b.date));

    for (const item of chronological) {
      const def = this.getAccountByCode(item.accountCode);
      const cur = grouped.get(item.accountCode) || {
        accountCode: def.code,
        accountName: def.name,
        siiClassification: def.siiClassification,
        totalDebit: 0,
        totalCredit: 0,
        finalBalance: 0,
        entries: [],
      };

      cur.totalDebit += item.debit;
      cur.totalCredit += item.credit;
      cur.finalBalance = cur.totalDebit - cur.totalCredit;
      cur.entries.push({
        ...item,
        runningBalance: cur.finalBalance,
      });

      grouped.set(item.accountCode, cur);
    }

    return Array.from(grouped.values()).sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }
}
