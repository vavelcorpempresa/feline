import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { vendorSchema, vendorUpdateSchema } from '../src/finance/vendors';
import { purchaseOrderSchema } from '../src/finance/purchase-orders';
import { payableCreateSchema, vendorPaymentSchema, calculatePayableBalance } from '../src/finance/payables';

describe('Módulo 05 · Compras y cuentas por pagar (Fase 1)', () => {
  describe('Maestro de Proveedores', () => {
    it('Valida esquema de proveedor con RUT chileno y datos bancarios', () => {
      const valid = {
        rut: '76123456-7',
        razonSocial: 'Distribuidora Central SpA',
        giro: 'Venta de insumos computacionales',
        direccion: 'Av. Providencia 1234',
        comuna: 'Providencia',
        ciudad: 'Santiago',
        contacto: 'Juan Pérez',
        correo: 'contacto@distribuidora.cl',
        telefono: '+56912345678',
        banco: 'Banco de Chile',
        tipoCuenta: 'Corriente',
        numeroCuenta: '00-123-45678-00',
      };
      const parsed = vendorSchema.parse(valid);
      expect(parsed.rut).toBe('76123456-7');
      expect(parsed.banco).toBe('Banco de Chile');
    });

    it('Rechaza proveedor sin razón social o giro obligatorio', () => {
      const invalid = {
        rut: '76123456-7',
        razonSocial: 'A',
        giro: '',
        direccion: 'Calle 1',
        comuna: 'Santiago',
        ciudad: 'Santiago',
      };
      expect(() => vendorSchema.parse(invalid)).toThrow();
    });
  });

  describe('Órdenes de Compra', () => {
    it('Valida cabecera y líneas con cálculo de totales', () => {
      const poInput = {
        vendorId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        date: '2026-11-04',
        expectedDeliveryDate: '2026-11-15',
        notes: 'Despacho a sucursal central',
        items: [
          { description: 'Licencia Servidor Pro', quantity: '2', unitPrice: '150000' },
          { description: 'Soporte Técnico Anual', quantity: '1', unitPrice: '80000' },
        ],
      };
      const parsed = purchaseOrderSchema.parse(poInput);
      expect(parsed.items.length).toBe(2);

      const net = parsed.items.reduce((acc, it) => acc + (Number(it.quantity) * Number(it.unitPrice)), 0);
      const tax = Math.round(net * 0.19);
      const total = net + tax;

      expect(net).toBe(380000);
      expect(tax).toBe(72200);
      expect(total).toBe(452200);
    });

    it('Rechaza orden de compra sin ítems', () => {
      expect(() => purchaseOrderSchema.parse({
        vendorId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        date: '2026-11-04',
        items: [],
      })).toThrow();
    });
  });

  describe('Cuentas por Pagar y Partida Doble', () => {
    it('Valida concordancia aritmética: Neto + IVA + Exento = Total', () => {
      const invoice = {
        vendorId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        documentType: 33,
        folio: 4501,
        date: '2026-11-04',
        dueDate: '2026-12-04',
        netAmount: '100000',
        taxAmount: '19000',
        exemptAmount: '0',
        totalAmount: '119000',
        kind: 'DEBT' as const,
        expenseAccountCode: '410110',
      };
      const parsed = payableCreateSchema.parse(invoice);
      expect(parsed.totalAmount).toBe('119000');
    });

    it('Calcula saldo de factura considerando pagos y reversiones', () => {
      const row = {
        id: 'payable-1',
        totalAmount: new Prisma.Decimal('119000'),
        payments: [
          {
            id: 'pay-1',
            amount: new Prisma.Decimal('50000'),
            date: new Date('2026-11-05'),
            reversals: [],
          },
          {
            id: 'pay-2',
            amount: new Prisma.Decimal('20000'),
            date: new Date('2026-11-06'),
            reversals: [{ id: 'rev-1', date: new Date('2026-11-06') }], // Revertido, no resta al saldo
          },
        ],
        invoiceAllocations: [],
        creditAllocations: [],
      } as any;

      const balance = calculatePayableBalance(row);
      // Total 119000 - pay-1 (50000) = 69000 (pay-2 fue revertido)
      expect(balance.toString()).toBe('69000');
    });

    it('Calcula saldo considerando aplicación de nota de crédito de proveedor', () => {
      const row = {
        id: 'payable-inv',
        totalAmount: new Prisma.Decimal('119000'),
        payments: [
          { id: 'p1', amount: new Prisma.Decimal('30000'), date: new Date('2026-11-05'), reversals: [] },
        ],
        invoiceAllocations: [
          { id: 'alloc-1', amount: new Prisma.Decimal('19000'), date: new Date('2026-11-06'), reversals: [] },
        ],
        creditAllocations: [],
      } as any;

      const balance = calculatePayableBalance(row);
      // 119000 - 30000 (pago) - 19000 (nota de crédito compensada) = 70000
      expect(balance.toString()).toBe('70000');
    });
  });

  describe('Pagos a Proveedores y Reversiones', () => {
    it('Valida esquema de pago a proveedor con medio y cuenta contable de egreso', () => {
      const payment = {
        payableId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        vendorId: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
        date: '2026-11-04',
        amount: '50000',
        method: 'TRANSFERENCIA' as const,
        accountCode: '110210', // Banco
        reference: 'TEF-994821',
        isAdvance: false,
      };
      const parsed = vendorPaymentSchema.parse(payment);
      expect(parsed.accountCode).toBe('110210');
      expect(parsed.reference).toBe('TEF-994821');
    });

    it('Rechaza pago con monto cero o negativo', () => {
      expect(() => vendorPaymentSchema.parse({
        vendorId: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
        date: '2026-11-04',
        amount: '0',
        method: 'TRANSFERENCIA',
        reference: 'TEST',
      })).toThrow();
    });
  });
});
