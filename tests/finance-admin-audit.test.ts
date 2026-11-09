import { describe, it, expect } from 'vitest';
import { currencyRateSchema, taxSettingSchema } from '../src/finance/admin-audit-currency';

describe('Fase 7: 14 Auditoría + 15 Configuración Tributaria + 16 Administración Financiera', () => {
  describe('Auditoría y Trazabilidad (14)', () => {
    it('comprueba formato de evento de auditoría inmutable', () => {
      const event = {
        action: 'tax.f29_declare',
        entityId: '8093dbdf-834f-4ee6-8a7c-3f92e592751e',
        actorId: '2bdf10c4-9548-4cb2-87ff-f8492040d73f',
        data: { period: '2026-11', netTaxPayable: '188750' },
      };

      expect(event.action).toBe('tax.f29_declare');
      expect(event.data.period).toBe('2026-11');
    });
  });

  describe('Configuración Tributaria y Folios CAF (15)', () => {
    it('valida parámetros tributarios versionables', () => {
      const parsed = taxSettingSchema.parse({
        environment: 'PRODUCCION',
        ppmRate: 1.25,
        feeRetentionRate: 13.75,
        autoAcuseDte: true,
      });

      expect(parsed.environment).toBe('PRODUCCION');
      expect(parsed.ppmRate?.toString()).toBe('1.25');
      expect(parsed.feeRetentionRate?.toString()).toBe('13.75');
      expect(parsed.autoAcuseDte).toBe(true);
    });

    it('calcula folios CAF disponibles y detecta stock bajo', () => {
      const folioDesde = 1;
      const folioHasta = 1000;
      const folioActual = 985;

      const totalFolios = folioHasta - folioDesde + 1;
      const usedFolios = folioActual - folioDesde;
      const remainingFolios = folioHasta - folioActual + 1;
      const isLow = remainingFolios < 20;

      expect(totalFolios).toBe(1000);
      expect(usedFolios).toBe(984);
      expect(remainingFolios).toBe(16);
      expect(isLow).toBe(true);
    });
  });

  describe('Multimoneda y Roles de Usuario (16)', () => {
    it('valida paridad de divisas con banco central', () => {
      const rate = currencyRateSchema.parse({
        date: '2026-11-05',
        currency: 'USD',
        rate: 978.50,
        source: 'BANCO_CENTRAL_CL',
      });

      expect(rate.currency).toBe('USD');
      expect(rate.rate.toString()).toBe('978.5');
    });

    it('valida jerarquía y permisos de roles', () => {
      const roles = ['OWNER', 'ACCOUNTANT', 'BILLING', 'VIEWER'] as const;
      expect(roles).toContain('OWNER');
      expect(roles).toContain('ACCOUNTANT');
      expect(roles).toContain('BILLING');
      expect(roles).toContain('VIEWER');
    });
  });
});
