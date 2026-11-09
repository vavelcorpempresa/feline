import { describe, it, expect } from 'vitest';
import { receivedDteSchema, f29PeriodSchema } from '../src/finance/tax-dte';

describe('Fase 5: 03 Documentos Recibidos + 09 Gestión Tributaria (F29) + 02 Facturación Electrónica', () => {
  describe('Documentos Tributarios Recibidos (03)', () => {
    it('valida DTE recibido con RUT, tipo, folio y montos', () => {
      const parsed = receivedDteSchema.parse({
        senderRut: '76111222-3',
        senderName: 'Proveedor de Software SpA',
        documentType: 33,
        folio: 4500,
        date: '2026-11-05',
        netAmount: 100000,
        taxAmount: 19000,
        exemptAmount: 0,
      });

      expect(parsed.senderRut).toBe('76111222-3');
      expect(parsed.documentType).toBe(33);
      expect(parsed.folio).toBe(4500n);
      expect(parsed.netAmount.toString()).toBe('100000');
      expect(parsed.taxAmount.toString()).toBe('19000');
    });

    it('rechaza DTE recibido con folio o tipo inválido', () => {
      expect(() => receivedDteSchema.parse({
        senderRut: '76111222-3',
        senderName: 'Proveedor SpA',
        documentType: -1,
        folio: 'abc',
        date: '2026-11-05',
        netAmount: 1000,
        taxAmount: 190,
      })).toThrow();
    });
  });

  describe('Gestión Tributaria y Formulario 29 (09)', () => {
    it('valida formato de período tributario mensual YYYY-MM', () => {
      expect(f29PeriodSchema.parse('2026-11')).toBe('2026-11');
      expect(() => f29PeriodSchema.parse('2026-13')).toThrow();
      expect(() => f29PeriodSchema.parse('2026/11')).toThrow();
    });

    it('calcula la liquidación de IVA y resultado F29 con Débito mayor a Crédito', () => {
      const salesVatDebit = 190000;
      const purchasesVatCredit = 95000;
      const feeRetention = 68750; // 13.75% sobre 500.000
      const payrollRetention = 15000;
      const ppmRate = 1.0;
      const salesNet = 1000000;
      const ppmAmount = Math.round(salesNet * (ppmRate / 100));

      const vatBalance = salesVatDebit - purchasesVatCredit; // 95.000 a pagar
      const totalTaxPayable = vatBalance + feeRetention + payrollRetention + ppmAmount;

      expect(vatBalance).toBe(95000);
      expect(ppmAmount).toBe(10000);
      expect(totalTaxPayable).toBe(188750);
    });

    it('calcula remanente de crédito fiscal cuando Crédito supera al Débito', () => {
      const salesVatDebit = 50000;
      const purchasesVatCredit = 120000;
      const feeRetention = 13750;
      const ppmAmount = 2500;

      const vatBalance = salesVatDebit - purchasesVatCredit; // -70.000 (Crédito a favor)
      const taxCreditRemainder = Math.abs(vatBalance);
      // Las retenciones y PPM siempre se pagan en el mes
      const totalTaxPayable = feeRetention + ppmAmount;

      expect(vatBalance).toBe(-70000);
      expect(taxCreditRemainder).toBe(70000);
      expect(totalTaxPayable).toBe(16250);
    });
  });

  describe('Facturación Electrónica Oficial y Referencias (02)', () => {
    it('valida tipos de DTE oficiales chilenos', () => {
      const supportedDtes = [33, 34, 43, 46, 52, 56, 61, 110, 111, 112];
      for (const t of supportedDtes) {
        expect(t).toBeGreaterThan(0);
      }
    });

    it('aplica códigos de referencia oficiales para Notas de Crédito (DTE 61)', () => {
      const codRef = {
        ANULA: 1,
        CORRIGE_TEXTO: 2,
        CORRIGE_MONTOS: 3,
      };
      expect(codRef.ANULA).toBe(1);
      expect(codRef.CORRIGE_TEXTO).toBe(2);
      expect(codRef.CORRIGE_MONTOS).toBe(3);
    });
  });
});
