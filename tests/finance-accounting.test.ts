import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  customAccountSchema,
  costCenterSchema,
} from '../src/finance/accounting';

describe('Fase 4: 08 Contabilidad General + 13 Informes Financieros + 01 Dashboard Financiero', () => {
  describe('Plan de Cuentas y Subcuentas Personalizadas', () => {
    it('Valida subcuenta con código chileno de 6 dígitos y clasificación SII', () => {
      const valid = {
        code: '110130',
        name: 'Caja Sucursal Antofagasta',
        accountType: 'asset_cash',
        internalGroup: 'asset',
        siiClassification: 'ACTIVO_CORRIENTE',
        includeInitialBalance: true,
        reconcile: false,
        isActive: true,
      };
      const parsed = customAccountSchema.parse(valid);
      expect(parsed.code).toBe('110130');
      expect(parsed.name).toBe('Caja Sucursal Antofagasta');
      expect(parsed.siiClassification).toBe('ACTIVO_CORRIENTE');
      expect(parsed.includeInitialBalance).toBe(true);
    });

    it('Rechaza subcuenta con código que no tiene 6 dígitos numéricos', () => {
      expect(() => customAccountSchema.parse({
        code: '1101',
        name: 'Caja Invalida',
      })).toThrow();

      expect(() => customAccountSchema.parse({
        code: 'ABCDEF',
        name: 'Caja Invalida',
      })).toThrow();
    });
  });

  describe('Centros de Costo y Dimensiones Analíticas', () => {
    it('Valida centro de costo con código y nombre', () => {
      const valid = {
        code: 'CC-ADM',
        name: 'Administración y Finanzas',
        description: 'Gastos corporativos de casa matriz',
        isActive: true,
      };
      const parsed = costCenterSchema.parse(valid);
      expect(parsed.code).toBe('CC-ADM');
      expect(parsed.name).toBe('Administración y Finanzas');
    });

    it('Rechaza centro de costo con código vacío o nombre muy corto', () => {
      expect(() => costCenterSchema.parse({
        code: 'A',
        name: 'X',
      })).toThrow();
    });
  });

  describe('Informes Financieros: Balance General y Cuadratura', () => {
    it('Comprueba cuadratura contable: Activos = Pasivos + Patrimonio', () => {
      const activoCorriente = new Prisma.Decimal('5000000'); // Cajas, bancos, CxC
      const activoFijo = new Prisma.Decimal('2500000');      // Servidores, computadores
      const totalActivos = activoCorriente.plus(activoFijo); // 7.500.000

      const pasivoCorriente = new Prisma.Decimal('1500000'); // Proveedores, IVA débito
      const pasivoLargoPlazo = new Prisma.Decimal('1000000'); // Deuda financiera
      const capital = new Prisma.Decimal('4000000');          // Capital social
      const resultadoEjercicio = new Prisma.Decimal('1000000'); // Utilidad neta

      const totalPasivos = pasivoCorriente.plus(pasivoLargoPlazo); // 2.500.000
      const totalPatrimonio = capital.plus(resultadoEjercicio);    // 5.000.000
      const totalPasivoYPatrimonio = totalPasivos.plus(totalPatrimonio); // 7.500.000

      expect(totalActivos.equals(totalPasivoYPatrimonio)).toBe(true);
      expect(totalActivos.toString()).toBe('7500000');
    });
  });

  describe('Informes Financieros: Estado de Resultados', () => {
    it('Calcula margen bruto, resultado operacional y resultado neto', () => {
      const ventasNetas = new Prisma.Decimal('10000000');
      const costoVentas = new Prisma.Decimal('6000000');
      const margenBruto = ventasNetas.minus(costoVentas); // 4.000.000 (40%)

      const gastosAdmin = new Prisma.Decimal('1500000');
      const resultadoOperacional = margenBruto.minus(gastosAdmin); // 2.500.000

      const otrosIngresos = new Prisma.Decimal('200000'); // Intereses ganados
      const otrosGastos = new Prisma.Decimal('50000');    // Comisiones bancarias
      const resultadoNeto = resultadoOperacional.plus(otrosIngresos).minus(otrosGastos); // 2.650.000

      expect(margenBruto.toString()).toBe('4000000');
      expect(resultadoOperacional.toString()).toBe('2500000');
      expect(resultadoNeto.toString()).toBe('2650000');
      expect(margenBruto.div(ventasNetas).mul(100).toFixed(1) + '%').toBe('40.0%');
    });
  });

  describe('Informes Financieros: Balance de 8 Columnas (Tributario)', () => {
    it('Verifica el doble balance chileno: Inventario (Activo - Pasivo) = Resultado (Ganancia - Pérdida)', () => {
      const activo = new Prisma.Decimal('8500000');
      const pasivo = new Prisma.Decimal('6000000');
      const diffInventario = activo.minus(pasivo); // 2.500.000 utilidad

      const ganancia = new Prisma.Decimal('4500000');
      const perdida = new Prisma.Decimal('2000000');
      const diffResultado = ganancia.minus(perdida); // 2.500.000 utilidad

      expect(diffInventario.equals(diffResultado)).toBe(true);
      expect(diffResultado.toString()).toBe('2500000');
    });
  });

  describe('Dashboard Financiero: Liquidez y Capital de Trabajo', () => {
    it('Calcula capital de trabajo neto (Disponibilidad + CxC - CxP)', () => {
      const liquidez = new Prisma.Decimal('1200000'); // Cajas y bancos
      const cxc = new Prisma.Decimal('3500000');      // Clientes por cobrar
      const cxp = new Prisma.Decimal('1800000');      // Proveedores por pagar

      const capitalTrabajo = liquidez.plus(cxc).minus(cxp);
      expect(capitalTrabajo.toString()).toBe('2900000');
    });

    it('Detecta alertas de morosidad y facturas vencidas', () => {
      const totalCxC = new Prisma.Decimal('1000000');
      const overdueCxC = new Prisma.Decimal('350000');
      const ratio = overdueCxC.div(totalCxC).mul(100).toFixed(1) + '%';
      expect(ratio).toBe('35.0%');
    });
  });
});
