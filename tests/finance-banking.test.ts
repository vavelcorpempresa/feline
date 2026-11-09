import { describe, it, expect } from 'vitest';
import {
  bankAccountSchema,
  bankRuleSchema,
  manualReconciliationSchema,
  adjustmentReconciliationSchema,
  FinanceBanking,
  CHILEAN_BANKS,
} from '../src/finance/banking';
import { PrismaClient } from '@prisma/client';

describe('Módulo 07 · Bancos y conciliación (Fase 3)', () => {
  describe('Maestro de Cuentas Bancarias', () => {
    it('Valida cuenta corriente bancaria con número y saldo inicial', () => {
      const valid = {
        bankCode: 'CHILE',
        bankName: 'Banco de Chile',
        accountType: 'CORRIENTE',
        accountNumber: '00-123-45678-00',
        currency: 'CLP',
        accountCode: '110210',
        initialBalance: '5000000',
        initialDate: '2026-11-01',
      };
      const parsed = bankAccountSchema.parse(valid);
      expect(parsed.bankCode).toBe('CHILE');
      expect(parsed.accountNumber).toBe('00-123-45678-00');
      expect(parsed.initialBalance).toBe('5000000');
      expect(parsed.accountCode).toBe('110210');
    });

    it('Aplica valores por defecto en tipo de cuenta y cuenta contable', () => {
      const minimal = {
        bankCode: 'SANTANDER',
        bankName: 'Banco Santander Chile',
        accountNumber: '88776655',
      };
      const parsed = bankAccountSchema.parse(minimal);
      expect(parsed.accountType).toBe('CORRIENTE');
      expect(parsed.currency).toBe('CLP');
      expect(parsed.accountCode).toBe('110210');
      expect(parsed.initialBalance).toBe('0');
      expect(parsed.isActive).toBe(true);
    });

    it('Rechaza cuenta con número muy corto o vacío', () => {
      expect(() => bankAccountSchema.parse({
        bankCode: 'BCI',
        bankName: 'Banco BCI',
        accountNumber: '1',
      })).toThrow();
    });

    it('Incluye catálogo oficial de bancos chilenos', () => {
      const codes = CHILEAN_BANKS.map(b => b.code);
      expect(codes).toContain('CHILE');
      expect(codes).toContain('SANTANDER');
      expect(codes).toContain('BCI');
      expect(codes).toContain('ESTADO');
      expect(codes).toContain('SCOTIABANK');
    });
  });

  describe('Parser de Cartolas Bancarias (CSV chileno y formatos estándar)', () => {
    const banking = new FinanceBanking({} as unknown as PrismaClient);

    it('Parsea cartola chilena con punto y coma y columnas de Cargo/Abono', () => {
      const csv = `Fecha;Detalle;Documento;Cargo;Abono;Saldo
04/11/2026;TRANSFERENCIA CLIENTE 76123456;12345;;150000;5150000
04/11/2026;COMISION MANTENCION CUENTA;0;4500;;5145500
03/11/2026;PAGO PROVEEDOR SERVIDORES;9988;85000;;5000000`;

      const lines = banking.parseStatementText(csv);
      expect(lines.length).toBe(3);

      // Primer movimiento: Abono +150000
      expect(lines[0].transactionDate).toBe('2026-11-04');
      expect(lines[0].description).toBe('TRANSFERENCIA CLIENTE 76123456');
      expect(lines[0].referenceNumber).toBe('12345');
      expect(lines[0].amount).toBe('150000');
      expect(lines[0].balanceAfter).toBe('5150000');
      expect(lines[0].lineHash.length).toBe(64);

      // Segundo movimiento: Cargo -4500
      expect(lines[1].transactionDate).toBe('2026-11-04');
      expect(lines[1].description).toBe('COMISION MANTENCION CUENTA');
      expect(lines[1].amount).toBe('-4500');

      // Tercer movimiento: Cargo -85000
      expect(lines[2].transactionDate).toBe('2026-11-03');
      expect(lines[2].amount).toBe('-85000');
    });

    it('Parsea cartola con comas y montos con formato chileno $ y puntos', () => {
      const csv = `Date,Description,Reference,Amount,Balance
2026-11-04,"ABONO INTERESES GANADOS",DEP-01,"$ 12.500","$ 1.012.500"
2026-11-04,"IMPUESTO TEF",TEF-99,"-$ 350","$ 1.012.150"`;

      const lines = banking.parseStatementText(csv);
      expect(lines.length).toBe(2);
      expect(lines[0].amount).toBe('12500');
      expect(lines[0].balanceAfter).toBe('1012500');
      expect(lines[1].amount).toBe('-350');
      expect(lines[1].balanceAfter).toBe('1012150');
    });

    it('Calcula lineHash único determinista para prevenir transacciones duplicadas', () => {
      const csv1 = `Fecha;Detalle;Documento;Cargo;Abono;Saldo\n04/11/2026;TRANSF;10;;50000;100000`;
      const csv2 = `Fecha;Detalle;Documento;Cargo;Abono;Saldo\n04/11/2026;TRANSF;10;;50000;100000`;

      const lines1 = banking.parseStatementText(csv1);
      const lines2 = banking.parseStatementText(csv2);

      expect(lines1[0].lineHash).toBe(lines2[0].lineHash);
    });

    it('Rechaza archivo sin contenido o sin líneas válidas', () => {
      expect(() => banking.parseStatementText('')).toThrow();
      expect(() => banking.parseStatementText('Solo una linea de cabecera')).toThrow();
    });
  });

  describe('Conciliación Manual y Ajustes', () => {
    const validUuid1 = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const validUuid2 = 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e';

    it('Valida conciliación manual con cobro de cliente', () => {
      const manual = {
        statementLineId: validUuid1,
        matchType: 'RECEIPT',
        targetId: validUuid2,
        notes: 'Coincide con cobro DTE folio 8801',
      };
      const parsed = manualReconciliationSchema.parse(manual);
      expect(parsed.matchType).toBe('RECEIPT');
      expect(parsed.statementLineId).toBe(validUuid1);
    });

    it('Valida conciliación por ajuste contable para comisiones bancarias', () => {
      const adj = {
        statementLineId: validUuid1,
        type: 'FEE',
        targetAccountCode: '410210',
        description: 'Comisión mensual cuenta corriente',
        notes: 'Ajuste automático',
      };
      const parsed = adjustmentReconciliationSchema.parse(adj);
      expect(parsed.type).toBe('FEE');
      expect(parsed.targetAccountCode).toBe('410210');
    });

    it('Valida conciliación por ajuste contable para intereses ganados', () => {
      const adj = {
        statementLineId: validUuid1,
        type: 'INTEREST',
        targetAccountCode: '520190',
        description: 'Intereses ganados saldo a la vista',
      };
      const parsed = adjustmentReconciliationSchema.parse(adj);
      expect(parsed.type).toBe('INTEREST');
      expect(parsed.targetAccountCode).toBe('520190');
    });
  });

  describe('Reglas de Conciliación Asistida', () => {
    it('Valida creación de regla de comisión automática', () => {
      const rule = {
        name: 'Comisiones Banco Chile',
        pattern: 'COMISION MANTENCION',
        action: 'AUTO_FEE',
        targetAccountCode: '410210',
        isActive: true,
      };
      const parsed = bankRuleSchema.parse(rule);
      expect(parsed.pattern).toBe('COMISION MANTENCION');
      expect(parsed.action).toBe('AUTO_FEE');
    });

    it('Valida regla para intereses ganados', () => {
      const rule = {
        name: 'Intereses ganados depósitos',
        pattern: 'ABONO INTERES',
        action: 'AUTO_INTEREST',
        targetAccountCode: '520190',
      };
      const parsed = bankRuleSchema.parse(rule);
      expect(parsed.action).toBe('AUTO_INTEREST');
      expect(parsed.targetAccountCode).toBe('520190');
    });
  });
});
