import { Prisma } from '@prisma/client';

export const periods = ['day', 'week', 'month', 'quarter', 'semester', 'year'] as const;
export type SalesPeriod = typeof periods[number];
export const dateText = (date: Date) => date.toISOString().slice(0, 10);
const dayMs = 86400000;
export const addDays = (date: Date, days: number) => new Date(date.getTime() + days * dayMs);
export const dayCount = (start: Date, end: Date) => (end.getTime() - start.getTime()) / dayMs + 1;

export function bounds(period: SalesPeriod, date: Date) {
  if (period === 'day') return { start: date, end: date };
  if (period === 'week') {
    const start = addDays(date, -((date.getUTCDay() + 6) % 7));
    return { start, end: addDays(start, 6) };
  }
  const months = { month: 1, quarter: 3, semester: 6, year: 12 }[period];
  const year = date.getUTCFullYear();
  const startMonth = Math.floor(date.getUTCMonth() / months) * months;
  return { start: new Date(Date.UTC(year, startMonth, 1)), end: new Date(Date.UTC(year, startMonth + months, 0)) };
}

export function equivalent(period: SalesPeriod, start: Date, years: number) {
  if (period === 'week') {
    const year = addDays(start, 3).getUTCFullYear();
    const first = (y: number) => bounds('week', new Date(Date.UTC(y, 0, 4))).start;
    const week = Math.round((start.getTime() - first(year).getTime()) / (7 * dayMs));
    const comparison = addDays(first(year - years), week * 7);
    // Una semana 53 se compara con la última semana del año ISO si ese año tiene 52.
    return bounds('week', comparison >= first(year - years + 1) ? addDays(comparison, -7) : comparison);
  }
  const year = start.getUTCFullYear() - years;
  const month = start.getUTCMonth();
  const day = Math.min(start.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return bounds(period, new Date(Date.UTC(year, month, day)));
}

export const growth = (value: Prisma.Decimal, baseline: Prisma.Decimal) =>
  baseline.gt(0) ? value.div(baseline).minus(1).times(100).toFixed(2) : null;

export function adjust(amount: Prisma.Decimal, historical: { value: Prisma.Decimal; base: number } | null,
  reference: { value: Prisma.Decimal; base: number } | null) {
  if (!historical || !reference || historical.base !== reference.base) return null;
  const factor = reference.value.div(historical.value);
  return { amount: amount.times(factor), inflation: factor.minus(1).times(100).toFixed(2) };
}
