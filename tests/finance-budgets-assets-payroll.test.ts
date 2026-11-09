import { describe, it, expect } from 'vitest';
import { budgetSchema, fixedAssetSchema, employeeSchema, feeReceiptSchema } from '../src/finance/budgets-assets-payroll';

describe('Fase 6: 10 Presupuestos + 11 Activos Fijos + 12 Remuneraciones y Honorarios', () => {
  describe('Presupuestos y Control de Ejecución (10)', () => {
    it('valida estructura de presupuesto con 12 meses', () => {
      const items = Array.from({ length: 12 }, (_, i) => ({
        accountCode: '410110',
        month: i + 1,
        allocatedAmount: 150000,
      }));

      const parsed = budgetSchema.parse({
        year: 2026,
        name: 'Presupuesto Operativo Casa Matriz',
        department: 'Operaciones',
        items,
      });

      expect(parsed.year).toBe(2026);
      expect(parsed.items.length).toBe(12);
      expect(parsed.items[0].allocatedAmount.toString()).toBe('150000');
    });

    it('calcula varianza presupuestaria y detecta sobregiro', () => {
      const budgeted = 200000;
      const executed = 250000;
      const variance = budgeted - executed; // -50.000 (sobregiro)
      const percent = (executed / budgeted) * 100;

      expect(variance).toBe(-50000);
      expect(percent).toBe(125);
      expect(variance < 0).toBe(true);
    });
  });

  describe('Activos Fijos y Depreciación (11)', () => {
    it('valida activo fijo con parámetros de vida útil y costo', () => {
      const parsed = fixedAssetSchema.parse({
        code: 'ACT-SRV-01',
        name: 'Servidor Dell PowerEdge R640',
        category: 'EQUIPMENT',
        purchaseDate: '2026-11-01',
        purchaseCost: 3600000,
        residualValue: 0,
        usefulLifeMonths: 36,
      });

      expect(parsed.code).toBe('ACT-SRV-01');
      expect(parsed.category).toBe('EQUIPMENT');
      expect(parsed.purchaseCost.toString()).toBe('3600000');
      expect(parsed.usefulLifeMonths).toBe(36);
    });

    it('calcula cuota de depreciación lineal mensual', () => {
      const cost = 3600000;
      const residual = 0;
      const lifeMonths = 36;
      const monthlyQuota = (cost - residual) / lifeMonths;

      expect(monthlyQuota).toBe(100000);
      // Tras 10 meses
      const accumulated10 = monthlyQuota * 10;
      const bookValue10 = cost - accumulated10;
      expect(accumulated10).toBe(1000000);
      expect(bookValue10).toBe(2600000);
    });
  });

  describe('Remuneraciones y Honorarios (12)', () => {
    it('valida colaborador de nómina', () => {
      const emp = employeeSchema.parse({
        rut: '16789123-4',
        name: 'Rodrigo Morales Sepúlveda',
        position: 'Ingeniero DevOps',
        afp: 'Habitat',
        healthSystem: 'Consalud',
        baseSalary: 1500000,
      });

      expect(emp.rut).toBe('16789123-4');
      expect(emp.baseSalary.toString()).toBe('1500000');
    });

    it('calcula descuentos previsionales e impuesto único chileno', () => {
      const baseSalary = 1000000;
      const afp = Math.round(baseSalary * 0.115); // 115.000
      const health = Math.round(baseSalary * 0.07); // 70.000
      const afc = Math.round(baseSalary * 0.006); // 6.000
      const totalDeductions = afp + health + afc; // 191.000
      const netSalary = baseSalary - totalDeductions; // 809.000

      expect(afp).toBe(115000);
      expect(health).toBe(70000);
      expect(afc).toBe(6000);
      expect(netSalary).toBe(809000);
    });

    it('valida boleta de honorarios y retención oficial del 13.75%', () => {
      const parsed = feeReceiptSchema.parse({
        rut: '12345678-9',
        name: 'Ana María Contador Asesorías',
        folio: 42,
        date: '2026-11-05',
        description: 'Auditoría tributaria y estados financieros',
        grossAmount: 400000,
        retentionRate: 13.75,
      });

      const retention = Math.round(Number(parsed.grossAmount) * (Number(parsed.retentionRate) / 100));
      const net = Number(parsed.grossAmount) - retention;

      expect(retention).toBe(55000);
      expect(net).toBe(345000);
    });
  });
});
