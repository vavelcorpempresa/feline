import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  cashBoxSchema,
  openShiftSchema,
  closeShiftSchema,
  directMovementSchema,
  internalTransferSchema,
  paymentRequestSchema,
} from '../src/finance/treasury';

describe('Módulo 06 · Tesorería y Liquidez (Fase 2)', () => {
  describe('Maestro de Cajas y Caja Chica', () => {
    it('Valida caja chica con cuenta 110120 y tope máximo', () => {
      const box = {
        name: 'Caja Chica Administración',
        type: 'PETTY_CASH',
        accountCode: '110120',
        maxBalance: '150000',
        currency: 'CLP',
      };
      const parsed = cashBoxSchema.parse(box);
      expect(parsed.name).toBe('Caja Chica Administración');
      expect(parsed.type).toBe('PETTY_CASH');
      expect(parsed.accountCode).toBe('110120');
      expect(parsed.maxBalance).toBe('150000');
    });

    it('Valida caja central con cuenta por defecto 110110', () => {
      const box = {
        name: 'Caja Central Sucursal 1',
        type: 'CENTRAL',
      };
      const parsed = cashBoxSchema.parse(box);
      expect(parsed.accountCode).toBe('110110');
      expect(parsed.isActive).toBe(true);
    });

    it('Rechaza caja con nombre vacío o muy corto', () => {
      expect(() => cashBoxSchema.parse({ name: 'A' })).toThrow();
    });
  });

  describe('Control de Turnos y Arqueo de Caja', () => {
    const validUuid = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

    it('Valida apertura de turno con saldo inicial en CLP', () => {
      const open = {
        cashBoxId: validUuid,
        openingBalance: '50000',
        notes: 'Apertura de turno de mañana',
      };
      const parsed = openShiftSchema.parse(open);
      expect(parsed.openingBalance).toBe('50000');
      expect(parsed.cashBoxId).toBe(validUuid);
    });

    it('Valida cierre y arqueo con saldo contado físicamente y justificación de diferencia', () => {
      const close = {
        countedBalance: '48500',
        notes: 'Arqueo vespertino',
        differenceReason: 'Diferencia en cambio menor',
      };
      const parsed = closeShiftSchema.parse(close);
      expect(parsed.countedBalance).toBe('48500');
      expect(parsed.differenceReason).toBe('Diferencia en cambio menor');
    });

    it('Calcula diferencia de arqueo (sobrante o faltante)', () => {
      const calculated = new Prisma.Decimal('50000');
      const countedDeficit = new Prisma.Decimal('48500');
      const countedSurplus = new Prisma.Decimal('51200');

      const diffDeficit = countedDeficit.minus(calculated);
      const diffSurplus = countedSurplus.minus(calculated);

      expect(diffDeficit.toString()).toBe('-1500'); // Faltante: pérdida (cuenta 410290)
      expect(diffSurplus.toString()).toBe('1200');  // Sobrante: ganancia (cuenta 520190)
    });
  });

  describe('Movimientos Directos de Tesorería', () => {
    it('Valida egreso por gasto menor de caja chica', () => {
      const expense = {
        type: 'EXPENSE',
        date: '2026-11-04',
        amount: '12500',
        accountCode: '410210',
        category: 'GASTO_MENOR',
        description: 'Compra de artículos de aseo e insumos menores',
        recipientOrPayer: 'Librería y Bazar Don Tito',
        voucherNumber: 'BOL-9831',
      };
      const parsed = directMovementSchema.parse(expense);
      expect(parsed.type).toBe('EXPENSE');
      expect(parsed.amount).toBe('12500');
      expect(parsed.accountCode).toBe('410210');
      expect(parsed.category).toBe('GASTO_MENOR');
    });

    it('Valida ingreso por aporte de fondos', () => {
      const income = {
        type: 'INCOME',
        date: '2026-11-04',
        amount: '500000',
        accountCode: '310110',
        category: 'APORTE',
        description: 'Aporte extraordinario de capital para caja operativa',
      };
      const parsed = directMovementSchema.parse(income);
      expect(parsed.type).toBe('INCOME');
      expect(parsed.amount).toBe('500000');
    });

    it('Rechaza movimiento con monto negativo o cero', () => {
      expect(() => directMovementSchema.parse({
        type: 'EXPENSE',
        date: '2026-11-04',
        amount: '0',
        accountCode: '410210',
        description: 'Test',
      })).toThrow();

      expect(() => directMovementSchema.parse({
        type: 'EXPENSE',
        date: '2026-11-04',
        amount: '-5000',
        accountCode: '410210',
        description: 'Test',
      })).toThrow();
    });
  });

  describe('Transferencias Internas entre Cuentas y Cajas', () => {
    it('Valida transferencia de Banco a Caja Central', () => {
      const transfer = {
        fromAccountCode: '110210',
        toAccountCode: '110110',
        amount: '200000',
        date: '2026-11-04',
        reference: 'Giro cajero automático #4410',
        notes: 'Reposición de efectivo para caja',
      };
      const parsed = internalTransferSchema.parse(transfer);
      expect(parsed.amount).toBe('200000');
      expect(parsed.fromAccountCode).toBe('110210');
      expect(parsed.toAccountCode).toBe('110110');
    });

    it('Rechaza transferencia con glosa de referencia vacía', () => {
      expect(() => internalTransferSchema.parse({
        fromAccountCode: '110210',
        toAccountCode: '110110',
        amount: '50000',
        date: '2026-11-04',
        reference: '',
      })).toThrow();
    });
  });

  describe('Solicitudes y Autorizaciones de Pago', () => {
    it('Valida solicitud de pago con beneficiario, monto y urgencia', () => {
      const req = {
        amount: '180000',
        date: '2026-11-04',
        dueDate: '2026-11-10',
        recipient: 'Proveedor Telecomunicaciones SpA',
        reason: 'Renovación anual de enlaces de fibra óptica',
        urgency: 'URGENT',
      };
      const parsed = paymentRequestSchema.parse(req);
      expect(parsed.amount).toBe('180000');
      expect(parsed.urgency).toBe('URGENT');
      expect(parsed.recipient).toBe('Proveedor Telecomunicaciones SpA');
    });

    it('Rechaza solicitud de pago sin beneficiario o con monto 0', () => {
      expect(() => paymentRequestSchema.parse({
        amount: '0',
        date: '2026-11-04',
        recipient: 'Test',
        reason: 'Pago',
      })).toThrow();
    });
  });

  describe('Proyección de Liquidez y Flujo de Caja', () => {
    it('Calcula liquidez inmediata y proyección neta de flujo', () => {
      const cash = new Prisma.Decimal('150000');
      const bank = new Prisma.Decimal('2850000');
      const totalLiquidity = cash.plus(bank);
      expect(totalLiquidity.toString()).toBe('3000000');

      // Proyección a 7 días
      const cxc7 = new Prisma.Decimal('500000');  // Inflows
      const cxp7 = new Prisma.Decimal('200000');  // Outflows
      const net7 = cxc7.minus(cxp7);
      const projectedLiquidity7 = totalLiquidity.plus(net7);

      expect(net7.toString()).toBe('300000');
      expect(projectedLiquidity7.toString()).toBe('3300000');
    });
  });
});
