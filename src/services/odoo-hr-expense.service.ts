import crypto from 'node:crypto';
import { OdooJournalItem } from './odoo-accounting-engine.service';
import { FelineLiveSandboxStore } from './feline-live-sandbox.service';

// ============================================================================
// MÓDULO ODOO 18 HR_EXPENSE (GASTOS Y RENDICIONES DE EMPLEADOS)
// Reconstrucción REA adaptada a normativa chilena (l10n_cl)
// Clona los modelos y flujos de:
//   - addons/hr_expense/models/hr_expense.py
//   - addons/hr_expense/models/hr_expense_sheet.py
//   - Integración directa con Partida Doble Odoo (account.move) y Balance 8 Columnas
// ============================================================================

export type HrExpensePaymentMode = 'own_account' | 'company_account';

export type HrExpenseCategory =
  | 'ALIMENTACION'
  | 'TRANSPORTE'
  | 'ALOJAMIENTO'
  | 'INSUMOS'
  | 'SOFTWARE'
  | 'REPRESENTACION'
  | 'OTROS';

export type HrExpenseVoucherType =
  | 'BOLETA_39'
  | 'FACTURA_33'
  | 'BOLETA_EXENTA_41'
  | 'HONORARIOS_71'
  | 'VALE_INTERNO';

export const EXPENSE_CATEGORIES_METADATA: Record<
  HrExpenseCategory,
  { label: string; defaultAccountCode: string; defaultAccountName: string; icon: string }
> = {
  ALIMENTACION: {
    label: 'Alimentación y Viáticos',
    defaultAccountCode: '410235',
    defaultAccountName: 'Gastos Generales, Alimentación y Viáticos',
    icon: '🍔',
  },
  TRANSPORTE: {
    label: 'Transporte, Taxis, Peajes y Combustible',
    defaultAccountCode: '410235',
    defaultAccountName: 'Gastos de Movilización y Peajes',
    icon: '🚕',
  },
  ALOJAMIENTO: {
    label: 'Hoteles y Alojamiento en Terreno',
    defaultAccountCode: '410235',
    defaultAccountName: 'Gastos de Alojamiento y Viajes',
    icon: '🏨',
  },
  INSUMOS: {
    label: 'Materiales, Ferretería e Insumos Operativos',
    defaultAccountCode: '410235',
    defaultAccountName: 'Insumos Menores y Materiales de Oficina',
    icon: '📦',
  },
  SOFTWARE: {
    label: 'Suscripciones Cloud, Software y SaaS',
    defaultAccountCode: '410235',
    defaultAccountName: 'Gastos de Software, Cloud y Telecomunicaciones',
    icon: '💻',
  },
  REPRESENTACION: {
    label: 'Gastos de Representación y Reuniones',
    defaultAccountCode: '410235',
    defaultAccountName: 'Gastos de Representación Comercial',
    icon: '🤝',
  },
  OTROS: {
    label: 'Otros Gastos Varios',
    defaultAccountCode: '410235',
    defaultAccountName: 'Otros Gastos Generales de Administración',
    icon: '📄',
  },
};

export const VOUCHER_TYPE_LABELS: Record<HrExpenseVoucherType, string> = {
  BOLETA_39: '[39] Boleta Electrónica',
  FACTURA_33: '[33] Factura Electrónica (con IVA)',
  BOLETA_EXENTA_41: '[41] Boleta Exenta de IVA',
  HONORARIOS_71: '[71] Boleta de Honorarios',
  VALE_INTERNO: 'Ticket / Vale de Caja Chica',
};

export interface HrExpenseRecord {
  id: string;
  tenantId: string;
  sheetId?: string;
  employeeId: string;
  employeeName: string;
  employeeRut: string;
  date: string;
  name: string;
  category: HrExpenseCategory;
  paymentMode: HrExpensePaymentMode;
  voucherType: HrExpenseVoucherType;
  voucherNumber?: string;
  vendorRut?: string;
  vendorName?: string;
  totalAmount: number;
  untaxedAmount: number;
  taxAmount: number;
  accountCode: string;
  receiptFileName?: string;
  notes?: string;
  state: 'draft' | 'reported' | 'submitted' | 'approved' | 'posted' | 'done' | 'refused';
  createdAt: string;
}

export interface HrExpenseSheetRecord {
  id: string;
  code: string;
  tenantId: string;
  name: string;
  employeeId: string;
  employeeName: string;
  employeeRut: string;
  accountingDate: string;
  paymentMode: HrExpensePaymentMode;
  state: 'draft' | 'submit' | 'approve' | 'post' | 'done' | 'cancel';
  approvalDate?: string;
  approvedBy?: string;
  totalAmount: number;
  untaxedAmount: number;
  totalTaxAmount: number;
  expenseIds: string[];
  moveId?: string;
  moveName?: string;
  paymentMoveId?: string;
  paymentMoveName?: string;
  refusalReason?: string;
  createdAt: string;
}

export class OdooHrExpenseService {
  private expenseSeq = 1;
  private sheetSeq = 1;

  public createExpense(params: {
    tenantId: string;
    employeeId: string;
    employeeName: string;
    employeeRut: string;
    date: string;
    name: string;
    category: HrExpenseCategory;
    paymentMode: HrExpensePaymentMode;
    voucherType: HrExpenseVoucherType;
    voucherNumber?: string;
    vendorRut?: string;
    vendorName?: string;
    totalAmount: number;
    hasIvaCredit?: boolean;
    receiptFileName?: string;
    notes?: string;
  }): HrExpenseRecord {
    const totalAmount = Math.round(params.totalAmount || 0);
    if (totalAmount <= 0) {
      throw new Error('El monto del gasto debe ser mayor a cero.');
    }

    const hasIva = params.voucherType === 'FACTURA_33' || Boolean(params.hasIvaCredit);
    const untaxedAmount = hasIva ? Math.round(totalAmount / 1.19) : totalAmount;
    const taxAmount = totalAmount - untaxedAmount;

    const meta = EXPENSE_CATEGORIES_METADATA[params.category] || EXPENSE_CATEGORIES_METADATA.OTROS;

    return {
      id: `exp-${crypto.randomUUID().slice(0, 8)}`,
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      employeeRut: params.employeeRut,
      date: params.date || new Date().toISOString().split('T')[0],
      name: params.name,
      category: params.category,
      paymentMode: params.paymentMode,
      voucherType: params.voucherType,
      voucherNumber: params.voucherNumber,
      vendorRut: params.vendorRut,
      vendorName: params.vendorName,
      totalAmount,
      untaxedAmount,
      taxAmount,
      accountCode: meta.defaultAccountCode,
      receiptFileName: params.receiptFileName,
      notes: params.notes,
      state: 'draft',
      createdAt: new Date().toISOString(),
    };
  }

  public createExpenseSheet(params: {
    tenantId: string;
    name: string;
    employeeId: string;
    employeeName: string;
    employeeRut: string;
    expenseIds: string[];
    expensesList: HrExpenseRecord[];
    autoSubmit?: boolean;
  }): { sheet: HrExpenseSheetRecord; updatedExpenses: HrExpenseRecord[] } {
    if (!params.expenseIds || params.expenseIds.length === 0) {
      throw new Error('Debes seleccionar al menos un gasto para crear la rendición de gastos.');
    }

    const selectedExpenses = params.expensesList.filter(
      (e) => params.expenseIds.includes(e.id) && e.tenantId === params.tenantId
    );

    if (selectedExpenses.length === 0) {
      throw new Error('No se encontraron gastos válidos para la rendición.');
    }

    const sheetId = `sheet-${crypto.randomUUID().slice(0, 8)}`;
    const code = `EXP/2026/${String(this.sheetSeq++).padStart(4, '0')}`;
    const today = new Date().toISOString().split('T')[0];

    const totalAmount = selectedExpenses.reduce((sum, e) => sum + e.totalAmount, 0);
    const untaxedAmount = selectedExpenses.reduce((sum, e) => sum + e.untaxedAmount, 0);
    const totalTaxAmount = selectedExpenses.reduce((sum, e) => sum + e.taxAmount, 0);

    // Si todos son pagados con tarjeta empresa, el informe es company_account; si no, own_account
    const allCompany = selectedExpenses.every((e) => e.paymentMode === 'company_account');
    const paymentMode: HrExpensePaymentMode = allCompany ? 'company_account' : 'own_account';

    const sheet: HrExpenseSheetRecord = {
      id: sheetId,
      code,
      tenantId: params.tenantId,
      name: params.name,
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      employeeRut: params.employeeRut,
      accountingDate: today,
      paymentMode,
      state: params.autoSubmit ? 'submit' : 'draft',
      totalAmount,
      untaxedAmount,
      totalTaxAmount,
      expenseIds: selectedExpenses.map((e) => e.id),
      createdAt: new Date().toISOString(),
    };

    const updatedExpenses = selectedExpenses.map((e) => ({
      ...e,
      sheetId,
      state: (params.autoSubmit ? 'submitted' : 'reported') as HrExpenseRecord['state'],
    }));

    return { sheet, updatedExpenses };
  }

  public submitExpenseSheet(sheet: HrExpenseSheetRecord, expenses: HrExpenseRecord[]) {
    if (sheet.state !== 'draft') {
      throw new Error('Solo se pueden enviar a aprobación rendiciones en estado Borrador.');
    }
    sheet.state = 'submit';
    expenses.forEach((e) => {
      if (sheet.expenseIds.includes(e.id)) {
        e.state = 'submitted';
      }
    });
  }

  public approveExpenseSheet(
    sheet: HrExpenseSheetRecord,
    expenses: HrExpenseRecord[],
    approvedBy: string = 'Gerencia de Administración y Finanzas'
  ) {
    if (sheet.state !== 'submit') {
      throw new Error('Solo se pueden aprobar rendiciones en estado Enviado (Para Aprobar).');
    }
    sheet.state = 'approve';
    sheet.approvalDate = new Date().toISOString();
    sheet.approvedBy = approvedBy;
    expenses.forEach((e) => {
      if (sheet.expenseIds.includes(e.id)) {
        e.state = 'approved';
      }
    });
  }

  public postExpenseSheet(
    sheet: HrExpenseSheetRecord,
    expenses: HrExpenseRecord[],
    store: FelineLiveSandboxStore
  ): { moveName: string; items: OdooJournalItem[] } {
    if (sheet.state !== 'approve') {
      throw new Error('La rendición debe estar en estado Aprobado antes de ser contabilizada.');
    }

    const sheetExpenses = expenses.filter((e) => sheet.expenseIds.includes(e.id));
    if (sheetExpenses.length === 0) {
      throw new Error('La rendición no contiene gastos para contabilizar.');
    }

    // Preparar líneas contables de Partida Doble Odoo
    // 1. CARGO (DEBE): Gastos de Pérdida (410235 o específico) por el monto neto
    // 2. CARGO (DEBE): IVA Crédito Fiscal (110710) por el IVA de las facturas
    // 3. ABONO (HABER):
    //    - Si 'own_account' (Rendición a reembolsar a empleado): 210610 Remuneraciones y Reembolsos por Pagar
    //    - Si 'company_account' (Pagado con Tarjeta Corporativa / Caja Chica): 110110 Caja y Bancos Moneda Nacional
    const lines: Array<{
      accountCode: string;
      label: string;
      debit: number;
      credit: number;
      partnerRut?: string;
      partnerName?: string;
    }> = [];

    // Agrupar gastos por cuenta contable
    const expenseLinesMap = new Map<string, number>();
    let totalIvaCredit = 0;

    for (const exp of sheetExpenses) {
      const current = expenseLinesMap.get(exp.accountCode) || 0;
      expenseLinesMap.set(exp.accountCode, current + exp.untaxedAmount);
      totalIvaCredit += exp.taxAmount;
    }

    // Agregar apuntes de gasto (DEBE)
    for (const [accountCode, amount] of expenseLinesMap.entries()) {
      lines.push({
        accountCode,
        label: `${sheet.code} - ${sheet.name}`,
        debit: amount,
        credit: 0,
        partnerRut: sheet.employeeRut,
        partnerName: sheet.employeeName,
      });
    }

    // Agregar apunte de IVA Crédito Fiscal si existe
    if (totalIvaCredit > 0) {
      lines.push({
        accountCode: '110710', // IVA Crédito Fiscal
        label: `${sheet.code} - IVA Crédito Fiscal Facturas Gastos`,
        debit: totalIvaCredit,
        credit: 0,
        partnerRut: sheet.employeeRut,
        partnerName: sheet.employeeName,
      });
    }

    // Contrapartida (HABER)
    const creditAccountCode = sheet.paymentMode === 'own_account' ? '210610' : '110110';
    const creditLabel =
      sheet.paymentMode === 'own_account'
        ? `Reembolso por Pagar a: ${sheet.employeeName} (${sheet.employeeRut})`
        : `Pago Tarjeta Corporativa / Caja Empresa: ${sheet.name}`;

    lines.push({
      accountCode: creditAccountCode,
      label: `${sheet.code} - ${creditLabel}`,
      debit: 0,
      credit: sheet.totalAmount,
      partnerRut: sheet.employeeRut,
      partnerName: sheet.employeeName,
    });

    // Validar y publicar en el motor contable
    const entryResult = store.createManualEntry({
      tenantId: sheet.tenantId,
      date: sheet.accountingDate,
      reference: `RENDICIÓN ${sheet.code}: ${sheet.name}`,
      lines,
    });

    sheet.state = 'post';
    sheet.moveId = entryResult.items[0]?.moveId;
    sheet.moveName = entryResult.moveName;

    sheetExpenses.forEach((e) => {
      e.state = 'posted';
    });

    return entryResult;
  }

  public payAndReimburseExpenseSheet(
    sheet: HrExpenseSheetRecord,
    expenses: HrExpenseRecord[],
    store: FelineLiveSandboxStore
  ): { moveName: string; items: OdooJournalItem[] } {
    if (sheet.state !== 'post') {
      throw new Error('La rendición debe estar Contabilizada antes de procesar el pago o reembolso.');
    }

    if (sheet.paymentMode === 'company_account') {
      // Los gastos de empresa ya salieron de banco al contabilizarse
      sheet.state = 'done';
      expenses.forEach((e) => {
        if (sheet.expenseIds.includes(e.id)) e.state = 'done';
      });
      return { moveName: sheet.moveName || 'CONCILIADO', items: [] };
    }

    // Pago a Empleado (account.payment):
    // DEBE: 210610 Remuneraciones y Reembolsos por Pagar (disminuye deuda con empleado)
    // HABER: 110110 Caja y Bancos Moneda Nacional (egreso bancario TEF)
    const lines = [
      {
        accountCode: '210610',
        label: `EXTINCIÓN REEMBOLSO ${sheet.code}: ${sheet.employeeName}`,
        debit: sheet.totalAmount,
        credit: 0,
        partnerRut: sheet.employeeRut,
        partnerName: sheet.employeeName,
      },
      {
        accountCode: '110110',
        label: `TRANSFERENCIA BANCARIA REEMBOLSO: ${sheet.employeeName}`,
        debit: 0,
        credit: sheet.totalAmount,
        partnerRut: sheet.employeeRut,
        partnerName: sheet.employeeName,
      },
    ];

    const paymentResult = store.createManualEntry({
      tenantId: sheet.tenantId,
      date: new Date().toISOString().split('T')[0],
      reference: `PAGO REEMBOLSO ${sheet.code}: ${sheet.employeeName}`,
      lines,
    });

    sheet.state = 'done';
    sheet.paymentMoveId = paymentResult.items[0]?.moveId;
    sheet.paymentMoveName = paymentResult.moveName;

    expenses.forEach((e) => {
      if (sheet.expenseIds.includes(e.id)) {
        e.state = 'done';
      }
    });

    return paymentResult;
  }

  public refuseExpenseSheet(
    sheet: HrExpenseSheetRecord,
    expenses: HrExpenseRecord[],
    reason: string
  ) {
    if (sheet.state === 'done') {
      throw new Error('No se puede rechazar una rendición que ya fue pagada.');
    }
    sheet.state = 'cancel';
    sheet.refusalReason = reason;
    expenses.forEach((e) => {
      if (sheet.expenseIds.includes(e.id)) {
        e.state = 'draft';
      }
    });
  }
}
