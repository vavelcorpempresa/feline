import { createHash, timingSafeEqual } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { dateSchema, FinanceError } from './ledger';
import { addDays, adjust, bounds, dateText, dayCount, equivalent, growth, periods } from './sales-goals';
import { formatSiiTimestamp } from '../utils/sii-normative.utils';
import { acceptedSalesStates, salesDocumentTypes, salesCreditTypes } from './sales.routes';

const read = { financePermission: 'read' };
const write = { financePermission: 'salesGoals' };
const periodSchema = z.enum(periods);
const selected = z.object({ period: periodSchema, date: dateSchema }).strict();
const editable = z.object({
  target: z.string().regex(/^[1-9]\d{0,14}$/),
  responsible: z.string().trim().min(1).max(100),
  notes: z.string().trim().max(1000).default(''),
});
const create = editable.extend({ period: periodSchema, startDate: dateSchema, endDate: dateSchema.optional() }).strict();
const month = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
const importSchema = z.object({
  source: z.string().url().max(1000).refine(value => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return url.protocol === 'https:' && ['ine.gob.cl', 'www.ine.gob.cl'].includes(url.hostname)
      && !url.username && !url.password && !url.port;
  }),
  base: z.literal(2023),
  rows: z.array(z.object({ month, value: z.string().regex(/^[1-9]\d{0,4}(\.\d{1,12})?$/),
    publishedAt: dateSchema }).strict()).min(1).max(500),
}).strict().refine(input => new Set(input.rows.map(row => row.month)).size === input.rows.length,
  'El lote contiene meses duplicados.');
const today = () => formatSiiTimestamp().slice(0, 10);
const decimal = (n: Prisma.Decimal.Value) => new Prisma.Decimal(n);
const auditFields = (g: { target: Prisma.Decimal; responsible: string; notes: string; startDate: Date; endDate: Date }) =>
  ({ target: g.target.toFixed(0), responsible: g.responsible, notes: g.notes, startDate: dateText(g.startDate), endDate: dateText(g.endDate) });

async function checkCycle(tx: Prisma.TransactionClient, tenantId: string, period: string, start: Date, end: Date, id?: string) {
  if (end < start || (period === 'day' && dateText(end) !== dateText(start))) {
    throw new FinanceError(400, 'Revisa las fechas del ciclo. Una meta diaria debe empezar y terminar el mismo día.');
  }
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${period}))`;
  if (await tx.salesGoal.findFirst({ where: { tenantId, period, id: id ? { not: id } : undefined,
    startDate: { lte: end }, endDate: { gte: start } }, select: { id: true } })) {
    throw new FinanceError(409, 'Ya existe una meta de este tipo que se superpone al ciclo.');
  }
}

export function registerSalesGoals(app: FastifyInstance, db: PrismaClient) {
  app.get('/sales/goals', { config: read }, req => {
    const q = z.object({ before: dateSchema.optional() }).strict().parse(req.query);
    return db.salesGoal.findMany({ where: { tenantId: req.financeTenantId!, startDate: q.before ? { lt: new Date(q.before) } : undefined },
      orderBy: [{ startDate: 'desc' }, { period: 'asc' }], take: 100 });
  });

  app.post('/sales/goals', { config: write }, async (req, reply) => {
    const input = create.parse(req.body);
    const start = new Date(input.startDate);
    const standard = bounds(input.period, start);
    if (!input.endDate && dateText(standard.start) !== input.startDate) throw new FinanceError(400, 'Indica la fecha de término del ciclo personalizado.');
    const end = input.endDate ? new Date(input.endDate) : standard.end;
    const tenantId = req.financeTenantId!, actorId = req.financeSession!.userId;
    try {
      const goal = await db.$transaction(async tx => {
        await checkCycle(tx, tenantId, input.period, start, end);
        const goal = await tx.salesGoal.create({ data: {
          tenantId, period: input.period, startDate: start, endDate: end, target: input.target,
          responsible: input.responsible, notes: input.notes, createdBy: actorId, updatedBy: actorId,
        } });
        await tx.financeAuditEvent.create({ data: { tenantId, actorId, action: 'sales.goal.create', entityId: goal.id,
          data: auditFields(goal) } });
        return goal;
      });
      return reply.code(201).send(goal);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new FinanceError(409, 'Ya existe una meta para este período.');
      }
      throw err;
    }
  });

  app.patch('/sales/goals/:id', { config: write }, async req => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const input = editable.extend({ version: z.string().datetime(), startDate: dateSchema.optional(), endDate: dateSchema.optional() }).strict().parse(req.body);
    const tenantId = req.financeTenantId!, actorId = req.financeSession!.userId;
    return db.$transaction(async tx => {
      const before = await tx.salesGoal.findFirst({ where: { id, tenantId } });
      if (!before) throw new FinanceError(404, 'Meta no encontrada.');
      const startDate = input.startDate ? new Date(input.startDate) : before.startDate;
      const endDate = input.endDate ? new Date(input.endDate) : before.endDate;
      await checkCycle(tx, tenantId, before.period, startDate, endDate, id);
      const updated = await tx.salesGoal.updateMany({
        where: { id, tenantId, updatedAt: new Date(input.version) },
        data: { target: input.target, responsible: input.responsible, notes: input.notes, startDate, endDate, updatedBy: actorId },
      });
      if (!updated.count) throw new FinanceError(409, 'La meta cambió. Recarga antes de guardar.');
      const after = await tx.salesGoal.findUniqueOrThrow({ where: { id } });
      await tx.financeAuditEvent.create({ data: { tenantId, actorId, action: 'sales.goal.update', entityId: id,
        data: { before: auditFields(before), after: auditFields(after) } } });
      return after;
    });
  });

  const compare = async (tx: Prisma.TransactionClient, tenantId: string, period: typeof periods[number], date: Date) => {
    const now = new Date(today());
    const goal = await tx.salesGoal.findFirst({ where: { tenantId, period, startDate: { lte: date }, endDate: { gte: date } },
      orderBy: { startDate: 'desc' } });
    const standard = bounds(period, date);
    const start = goal?.startDate ?? standard.start, end = goal?.endDate ?? standard.end;
    const custom = dateText(start) !== dateText(standard.start) || dateText(end) !== dateText(standard.end);
    const cutoff = end < now ? end : now;
    const elapsed = Math.max(0, dayCount(start, cutoff));
    const sales = async (from: Date, to: Date) => {
      const groups = to < from ? [] : await tx.documentoDTE.groupBy({ by: ['tipoDte'], where: {
        tenantId, tipoDte: { in: salesDocumentTypes }, estado: { in: acceptedSalesStates },
        fechaEmision: { gte: from, lte: to },
      }, _sum: { mntTotal: true, mntExento: true, iva: true }, _count: { _all: true } });
      const total = (field: 'mntTotal' | 'mntExento' | 'iva') => groups.reduce((sum, g) =>
        sum.plus(decimal(g._sum[field] ?? 0).times(salesCreditTypes.includes(g.tipoDte) ? -1 : 1)), decimal(0));
      const documents = groups.map(g => ({ type: g.tipoDte, count: g._count._all, gross: String(g._sum.mntTotal ?? 0) }));
      return { gross: total('mntTotal'), exempt: total('mntExento').toFixed(0), vat: total('iva').toFixed(0), documents };
    };
    const goalAt = (startDate: Date) => tx.salesGoal.findUnique({ where: { tenantId_period_startDate: { tenantId, period, startDate } } });
    const ipc = (target: string, fallback: boolean) => tx.ipcMonthlyIndex.findFirst({
      where: { base: 2023, month: fallback ? { lte: target } : target, publishedAt: { lte: now } },
      orderBy: [{ month: 'desc' }, { retrievedAt: 'desc' }, { id: 'desc' }],
    });
    const refMonth = dateText(cutoff).slice(0, 7);
    const [actual, reference] = await Promise.all([sales(start, cutoff), ipc(refMonth, true)]);
    const current = actual.gross;
    const previous = custom ? { start: addDays(start, -dayCount(start, end)), end: addDays(start, -1) } : bounds(period, addDays(start, -1));
    const cycles = [['previous', previous], ...[1, 2, 3].map(year => [String(year), custom
      ? { start: equivalent('day', start, year).start, end: equivalent('day', end, year).end }
      : equivalent(period, start, year)] as const)] as const;
    const comparisons = await Promise.all(cycles.map(async ([key, range]) => {
      const equivalentEnd = addDays(range.start, elapsed - 1);
      const until = elapsed >= dayCount(start, end) || equivalentEnd > range.end ? range.end : equivalentEnd;
      const [historical, previousGoal, historicalIndex] = await Promise.all([
        sales(range.start, until), goalAt(range.start), ipc(dateText(until).slice(0, 7), false),
      ]);
      const nominal = historical.gross;
      const adjusted = adjust(nominal, historicalIndex, reference);
      return { key, start: dateText(range.start), end: dateText(until), nominal: nominal.toFixed(0),
        adjusted: adjusted?.amount.toFixed(0) ?? null, inflation: adjusted?.inflation ?? null,
        previousGoal: previousGoal?.target.toFixed(0) ?? null,
        previousProgress: previousGoal ? nominal.div(previousGoal.target).times(100).toFixed(2) : null,
        nominalGrowth: growth(current, nominal), realGrowth: adjusted ? growth(current, adjusted.amount) : null,
        targetGrowth: goal ? growth(goal.target, nominal) : null,
        targetRealGrowth: goal && adjusted ? growth(goal.target, adjusted.amount) : null,
        targetDifference: goal ? goal.target.minus(nominal).toFixed(0) : null,
        targetRealDifference: goal && adjusted ? goal.target.minus(adjusted.amount).toFixed(0) : null,
      };
    }));
    return { period, start: dateText(start), end: dateText(end), goal, current: current.toFixed(0), breakdown: { exempt: actual.exempt, vat: actual.vat, documents: actual.documents }, comparisons,
      average: comparisons.slice(1).reduce((sum, item) => sum.plus(item.nominal), decimal(0)).div(3).toFixed(0),
      referenceMonth: reference?.month ?? null, provisional: reference?.month !== refMonth,
      completion: goal ? current.div(goal.target).times(100).toFixed(2) : null,
      remaining: goal ? Prisma.Decimal.max(goal.target.minus(current), 0).toFixed(0) : null,
      daysRemaining: Math.max(0, dayCount(now, end) - 1),
      projection: elapsed ? current.times(dayCount(start, end)).div(elapsed).toFixed(0) : null };
  };
  app.get('/sales/goals/comparison', { config: read }, req => {
    const q = selected.parse(req.query);
    if (q.date > today()) throw new FinanceError(400, 'Selecciona una fecha hasta hoy.');
    return db.$transaction(tx => compare(tx, req.financeTenantId!, q.period, new Date(q.date)), { isolationLevel: 'RepeatableRead' });
  });
  app.get('/sales/goals/progress', { config: read }, req => {
    const { date = today() } = z.object({ date: dateSchema.optional() }).strict().parse(req.query);
    if (date > today()) throw new FinanceError(400, 'Selecciona una fecha de consulta hasta hoy.');
    return db.$transaction(tx => Promise.all(periods.map(period => compare(tx, req.financeTenantId!, period, new Date(date)))),
      { isolationLevel: 'RepeatableRead', timeout: 15000 });
  });

  app.get('/economic-indicators/ipc', { config: read }, () => db.ipcMonthlyIndex.findFirst({
    where: { base: 2023, publishedAt: { lte: new Date(today()) } },
    orderBy: [{ month: 'desc' }, { retrievedAt: 'desc' }, { id: 'desc' }],
  }));
  app.get('/economic-indicators/ipc/history', { config: read }, () => db.ipcMonthlyIndex.findMany({
    orderBy: [{ month: 'desc' }, { retrievedAt: 'desc' }, { id: 'desc' }], take: 500,
  }));
  app.post('/admin/economic-indicators/ipc/import', { config: write }, async req => {
    const expected = process.env.FELINE_ADMIN_TOKEN;
    const digest = (value: string) => createHash('sha256').update(value).digest();
    if (!expected || !timingSafeEqual(digest(req.headers.authorization ?? ''), digest('Bearer ' + expected))) {
      throw new FinanceError(403, 'Se requiere autorización de administración del sistema.');
    }
    const input = importSchema.parse(req.body);
    if (input.rows.some(row => row.publishedAt > today() || row.publishedAt.slice(0, 7) <= row.month)) {
      throw new FinanceError(400, 'Revisa las fechas de publicación de la serie.');
    }
    return db.ipcMonthlyIndex.createMany({ skipDuplicates: true, data: input.rows.map(row => ({
      ...row, publishedAt: new Date(row.publishedAt), base: input.base, source: input.source, importedBy: req.financeSession!.userId,
    })) });
  });
}
