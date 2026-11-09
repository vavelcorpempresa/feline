import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { adjust, bounds, dateText, equivalent, growth, periods } from '../src/finance/sales-goals';

describe('Metas comerciales', () => {
  it.each([
    ['day', '2026-11-08', '2026-11-08'],
    ['week', '2026-11-02', '2026-11-08'],
    ['month', '2026-11-01', '2026-11-30'],
    ['quarter', '2026-10-01', '2026-12-31'],
    ['semester', '2026-07-01', '2026-12-31'],
    ['year', '2026-01-01', '2026-12-31'],
  ] as const)('delimita y compara el período %s', (period, from, to) => {
    const current = bounds(period, new Date('2026-11-08'));
    expect([dateText(current.start), dateText(current.end)]).toEqual([from, to]);
    expect(equivalent(period, current.start, 1).start.getUTCFullYear()).toBe(2025);
    expect(periods).toContain(period);
  });

  it('resuelve la semana ISO 53 y el 29 de febrero', () => {
    expect(dateText(equivalent('week', new Date('2020-12-28'), 1).start)).toBe('2019-12-23');
    expect(dateText(equivalent('day', new Date('2024-02-29'), 1).start)).toBe('2023-02-28');
  });

  it('calcula crecimiento nominal y real con índices compatibles y conserva la precisión', () => {
    const historical = new Prisma.Decimal(10000000), target = new Prisma.Decimal(12000000);
    const base = { base: 2023, value: new Prisma.Decimal(100) };
    const current = { base: 2023, value: new Prisma.Decimal(104) };
    const adjusted = adjust(historical, base, current)!;
    expect(adjusted.amount.toFixed(0)).toBe('10400000');
    expect(adjusted.inflation).toBe('4.00');
    expect(growth(target, historical)).toBe('20.00');
    expect(growth(target, adjusted.amount)).toBe('15.38');
    expect(target.minus(adjusted.amount).toFixed(0)).toBe('1600000');
    expect(adjust(historical, base, null)).toBeNull();
    expect(adjust(historical, { ...base, base: 2018 }, current)).toBeNull();
  });
});
