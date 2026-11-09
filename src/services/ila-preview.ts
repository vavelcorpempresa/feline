import { Prisma } from '@prisma/client';

// DL 825, art. 42. Códigos del Formato DTE SII 2.5, sección 4.
export const ilaRates = { 24: '31.5', 25: '20.5', 26: '20.5', 27: '10', 271: '18' } as const;
export type IlaCode = keyof typeof ilaRates;
export const ilaEffectiveFrom = '2014-10-01';

export function calculateIlaPreview(documentType: number, date: string, operation: string | undefined,
  lines: Array<{ code?: IlaCode; exempt: boolean; base: number }>) {
  const totals = new Map<IlaCode, Prisma.Decimal>();
  for (const line of lines) {
    if (line.code === undefined) continue;
    if (documentType !== 33 || line.exempt || operation !== 'taxable-domestic-sale' || date < ilaEffectiveFrom) {
      throw new Error('El cálculo ILA requiere factura afecta, línea afecta a IVA y operación nacional confirmada como afecta conforme al artículo 43.');
    }
    const rate = ilaRates[line.code];
    if (rate === undefined || !Number.isSafeInteger(line.base) || line.base < 0) throw new Error('Código o base de ILA inválido.');
    totals.set(line.code, (totals.get(line.code) ?? new Prisma.Decimal(0)).plus(line.base));
  }
  return Array.from(totals, ([code, base]) => ({
    code, rate: ilaRates[code], base: base.toNumber(),
    amount: base.times(ilaRates[code]).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber(),
  }));
}
