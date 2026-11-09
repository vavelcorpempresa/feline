import { FastifyInstance } from 'fastify';
import { DteStatus, Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { dateSchema, FinanceError } from './ledger';
import { balance, includeBalance } from './receivables';
import { DtePdfService } from '../services/dte-pdf.service';
import { formatSiiTimestamp } from '../utils/sii-normative.utils';

export const salesDocumentTypes = [33, 34, 39, 41, 56, 61, 110, 111, 112];
export const acceptedSalesStates: DteStatus[] = [DteStatus.ACEPTADO, DteStatus.ACEPTADO_CON_REPARO];
export const salesCreditTypes = [61, 112];
const config = { financePermission: 'read' };
const filters = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  kind: z.enum(['invoice', 'receipt', 'all']).default('all'),
  status: z.nativeEnum(DteStatus).optional(),
  folio: z.coerce.number().int().positive().max(2147483647).optional(),
  cursor: z.string().uuid().optional(),
}).strict().refine(q => !q.from || !q.to || q.from <= q.to, 'Rango de fechas inválido.');

export function registerSales(app: FastifyInstance, db: PrismaClient) {
  app.get('/sales/summary', { config }, async req => {
    const today = formatSiiTimestamp().slice(0, 10);
    const date = new Date(today);
    const week = new Date(date);
    week.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const periods = { day: date, week, month: new Date(Date.UTC(year, month, 1)),
      quarter: new Date(Date.UTC(year, month - month % 3, 1)), year: new Date(Date.UTC(year, 0, 1)) };
    const tenantId = req.financeTenantId!;
    return db.$transaction(async tx => {
      const entries = await Promise.all(Object.entries(periods).map(async ([period, start]) => {
        const groups = await tx.documentoDTE.groupBy({
          by: ['tipoDte', 'estado'],
          where: { tenantId, tipoDte: { in: salesDocumentTypes }, fechaEmision: { gte: start, lte: date } },
          _sum: { mntNeto: true, mntExento: true, iva: true, mntTotal: true },
          _count: { _all: true },
        });
        const summary = { net: 0, exempt: 0, vat: 0, gross: 0, invoices: 0, receipts: 0, credits: 0, rejected: 0 };
        for (const group of groups) {
          if (group.estado === DteStatus.RECHAZADO) summary.rejected += group._count._all;
          if (!acceptedSalesStates.includes(group.estado)) continue;
          const credit = salesCreditTypes.includes(group.tipoDte);
          const sign = credit ? -1 : 1;
          summary.net += sign * (group._sum.mntNeto ?? 0);
          summary.exempt += sign * (group._sum.mntExento ?? 0);
          summary.vat += sign * (group._sum.iva ?? 0);
          summary.gross += sign * (group._sum.mntTotal ?? 0);
          if (credit) summary.credits += group._count._all;
          if ([33, 34, 110].includes(group.tipoDte)) summary.invoices += group._count._all;
          if ([39, 41].includes(group.tipoDte)) summary.receipts += group._count._all;
        }
        return [period, summary] as const;
      }));
      return { asOf: today, periods: Object.fromEntries(entries) };
    }, { isolationLevel: 'RepeatableRead' });
  });

  app.get('/sales/documents', { config }, async req => {
    const q = filters.parse(req.query);
    const tenantId = req.financeTenantId!;
    const asOf = formatSiiTimestamp().slice(0, 10);
    const where: Prisma.DocumentoDTEWhereInput = {
      tenantId,
      tipoDte: { in: q.kind === 'invoice' ? [33, 34, 110] : q.kind === 'receipt' ? [39, 41] : salesDocumentTypes },
      estado: q.status,
      folio: q.folio,
      fechaEmision: { gte: q.from && new Date(q.from), lte: q.to && new Date(q.to) },
      id: q.cursor ? { gt: q.cursor } : undefined,
    };
    const rows = await db.documentoDTE.findMany({
      where, orderBy: { id: 'asc' }, take: 51,
      select: { id: true, folio: true, tipoDte: true, fechaEmision: true, fechaVenc: true,
        estado: true, mntNeto: true, mntExento: true, iva: true, mntTotal: true,
        receptor: { select: { tenantId: true, rut: true, razonSocial: true } },
        accountMove: { select: { tenantId: true, formaPagoSii: true } },
        receivables: { where: { tenantId }, include: includeBalance } },
    });
    const hasNext = rows.length > 50;
    if (hasNext) rows.pop();
    const items = rows.map(({ receptor, accountMove, receivables, ...row }) => {
      const ar = receivables[0];
      const legacy = ar?.document.accountMove?.payments.length;
      const remaining = ar && ar.amount.gt(0) && !legacy ? balance(ar, asOf) : null;
      const due = (ar?.dueDate ?? row.fechaVenc)?.toISOString().slice(0, 10);
      const paymentStatus = remaining === null ? 'Sin saldo verificado' : remaining.isZero() ? 'Pagado'
        : due && due < asOf ? 'Vencido' : remaining.lt(ar.amount) ? 'Parcial' : 'Pendiente';
      return { ...row, customer: receptor.tenantId === tenantId ? { rut: receptor.rut, name: receptor.razonSocial } : null,
        paymentTerms: accountMove?.tenantId === tenantId ? accountMove.formaPagoSii : null,
        paymentStatus, balance: remaining?.toFixed(0) ?? null };
    });
    return { items, nextCursor: hasNext ? rows.at(-1)?.id : null };
  });

  app.get('/sales/documents/:id/:format', { config }, async (req, reply) => {
    const { id, format } = z.object({ id: z.string().uuid(), format: z.enum(['pdf', 'xml']) }).parse(req.params);
    const tenantId = req.financeTenantId!;
    const doc = await db.documentoDTE.findFirst({
      where: { id, tenantId, tipoDte: { in: salesDocumentTypes }, receptor: { tenantId } },
      include: { receptor: true, tenant: true },
    });
    if (!doc?.dteXmlFirmado) throw new FinanceError(404, 'Documento firmado no encontrado.');
    const file = `DTE_${doc.tipoDte}_${doc.folio}.${format}`;
    reply.header('Content-Disposition', `attachment; filename="${file}"`);
    if (format === 'pdf') return reply.type('application/pdf').send(await DtePdfService.generar(doc));
    const dte = doc.dteXmlFirmado.replace(/^<DTE version="1.0">/, '<DTE xmlns="http://www.sii.cl/SiiDte" version="1.0">');
    return reply.type('application/xml; charset=ISO-8859-1')
      .send(Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?>\n' + dte, 'latin1'));
  });
}
