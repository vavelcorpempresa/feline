import { describe, expect, it } from 'vitest';
import { calculateIlaPreview, IlaCode } from '../src/services/ila-preview';

describe('Cálculo previo de ILA por producto', () => {
  it.each([[24, 31500], [25, 20500], [26, 20500], [27, 10000], [271, 18000]] as const)(
    'aplica el código %s sobre el neto afecto', (code, amount) => {
      expect(calculateIlaPreview(33, '2026-11-08', 'taxable-domestic-sale', [{ code, exempt: false, base: 100000 }]))
        .toMatchObject([{ code, base: 100000, amount }]);
    });
  it('agrupa por código, redondea el monto del grupo y conserva códigos de igual tasa separados', () => {
    const row = (code: IlaCode, base: number) => ({ code, base, exempt: false });
    expect(calculateIlaPreview(33, '2026-11-08', 'taxable-domestic-sale', [
      row(25, 2), row(25, 2), row(26, 10000), { exempt: true, base: 500 },
    ])).toMatchObject([{ code: 25, base: 4, amount: 1 }, { code: 26, base: 10000, amount: 2050 }]);
  });
  it('rechaza exenciones, operaciones sin confirmación, tipos incompatibles y fechas anteriores', () => {
    const line = { code: 25 as const, exempt: false, base: 10000 };
    expect(() => calculateIlaPreview(34, '2026-11-08', 'taxable-domestic-sale', [line])).toThrow();
    expect(() => calculateIlaPreview(33, '2026-11-08', undefined, [line])).toThrow();
    expect(() => calculateIlaPreview(33, '2026-11-08', 'taxable-domestic-sale', [{ ...line, exempt: true }])).toThrow();
    expect(() => calculateIlaPreview(33, '2014-09-30', 'taxable-domestic-sale', [line])).toThrow();
  });
});
