import { describe, it, expect } from 'vitest';
import { FelineLiveSandboxStore } from '../src/services/feline-live-sandbox.service';
import { OdooAccountMoveService } from '../src/services/odoo-account-move.service';
import { buildFastifyApp } from '../src/server';

// ============================================================================
// REGLAS DE NEGOCIO (auditoría ACF, grupo 2): notas de crédito, pagos,
// líneas, rangos de folios y usuarios
// ============================================================================

const linea = (extra: Record<string, unknown> = {}) => ({ name: 'Servicio', quantity: 1, priceUnit: 1000, ...extra }) as any;

function facturaPublicada(store: FelineLiveSandboxStore) {
  const tenant = store.tenants[0];
  const cliente = store.partners.find((p) => p.tenantId === tenant.id && p.taxpayerType === 'VAT_AFFECTED_1ST_CAT')!;
  const borrador = store.createDraftMove({
    tenantId: tenant.id,
    partnerId: cliente.id,
    documentTypeCode: 33,
    moveType: 'OUT_INVOICE',
    invoiceDate: '2026-10-20',
    lines: [linea({ priceUnit: 100000 })],
  });
  return { tenant, factura: store.postMoveAndSignDte(tenant.id, borrador.id) };
}

describe('Reglas de negocio', () => {
  it('Valida las líneas: cantidad, precio, descuento y descripción', () => {
    const calc = (l: any) => () => OdooAccountMoveService.computeMoveLinesAndTotals([l], 33);
    expect(calc(linea({ quantity: 0 }))).toThrow(/cantidad mayor a 0/);
    expect(calc(linea({ quantity: -2 }))).toThrow(/cantidad mayor a 0/);
    expect(calc(linea({ quantity: 'abc' }))).toThrow(/cantidad mayor a 0/);
    expect(calc(linea({ priceUnit: -1 }))).toThrow(/precio inválido/);
    expect(calc(linea({ discountPct: 150 }))).toThrow(/entre 0 y 100/);
    expect(calc(linea({ name: '  ' }))).toThrow(/descripción/);
    // Valores numéricos que llegan como texto desde un formulario se convierten
    expect(OdooAccountMoveService.computeMoveLinesAndTotals([linea({ quantity: '2', priceUnit: '500' })], 33).amountTotal).toBe(1190);
  });

  it('Una factura por $0 se rechaza; solo la nota de crédito que corrige texto puede ir por $0', () => {
    expect(() => OdooAccountMoveService.computeMoveLinesAndTotals([linea({ priceUnit: 0 })], 33)).toThrow(/mayor a \$0/);
    expect(OdooAccountMoveService.esCorreccionDeTexto(61, [{ referenceDocCode: 2 }])).toBe(true);
    expect(OdooAccountMoveService.esCorreccionDeTexto(61, [{ referenceDocCode: 1 }])).toBe(false);
    expect(
      OdooAccountMoveService.computeMoveLinesAndTotals([linea({ priceUnit: 0 })], 61, { permitirTotalCero: true }).amountTotal
    ).toBe(0);
  });

  it('No permite anular dos veces la misma factura ni emitir nota de crédito sobre otra nota', () => {
    const store = new FelineLiveSandboxStore();
    const { tenant, factura } = facturaPublicada(store);
    const nc = store.reverseMoveWithCreditNote({ tenantId: tenant.id, originMoveId: factura.id, referenceDocCode: 1, reason: 'Anula' });
    expect(() =>
      store.reverseMoveWithCreditNote({ tenantId: tenant.id, originMoveId: factura.id, referenceDocCode: 1, reason: 'Otra vez' })
    ).toThrow(/ya fue anulado/);
    expect(() =>
      store.reverseMoveWithCreditNote({ tenantId: tenant.id, originMoveId: nc.id, referenceDocCode: 1, reason: 'NC de NC' })
    ).toThrow(/facturas o boletas de venta/);
  });

  it('Un pago con monto inválido no corrompe el saldo', () => {
    const store = new FelineLiveSandboxStore();
    const { tenant, factura } = facturaPublicada(store);
    const saldo = factura.amountResidual;
    for (const monto of [Number.NaN, 0, -5000, 'abc' as any]) {
      expect(() => store.registerPayment({ tenantId: tenant.id, moveId: factura.id, amount: monto })).toThrow(/mayor a 0/);
    }
    expect(factura.amountResidual).toBe(saldo);
    expect(store.registerPayment({ tenantId: tenant.id, moveId: factura.id, amount: 1000 }).amountResidual).toBe(saldo - 1000);
  });

  it('No permite duplicar el correo de otro usuario al editarlo', () => {
    const store = new FelineLiveSandboxStore();
    const [a, b] = store.users;
    expect(a && b).toBeTruthy();
    expect(() => store.updateUser(a.id, { email: b.email.toUpperCase() })).toThrow(/Ya existe otro usuario/);
  });

  it('Un rango de folios de demostración no puede reutilizar folios ni ser inválido', async () => {
    const app = buildFastifyApp({ siiModo: 'simulado' });
    const tenantId = 'tenant-feline-tech-01';
    const pedir = (body: unknown) =>
      app.inject({ method: 'POST', url: '/api/v1/dashboard/cafs/generate', headers: { 'x-tenant-id': tenantId }, payload: body as any });
    expect((await pedir({ tipoDte: 33, desde: 10, hasta: 5 })).statusCode).toBe(400);
    expect((await pedir({ tipoDte: 33, desde: 'x', hasta: 5 })).statusCode).toBe(400);
    const repetido = await pedir({ tipoDte: 33, desde: 1, hasta: 100 });
    expect(repetido.statusCode).toBe(400);
    expect(repetido.json().error).toMatch(/ya fue usado/);
    expect((await pedir({ tipoDte: 33, desde: 5000, hasta: 5100 })).statusCode).toBe(201);
    await app.close();
  });
});
