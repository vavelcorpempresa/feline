import { relaxedDataEntry } from './development-validation';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { FinanceError } from './ledger';
import { normalizeAndValidateRut } from '../utils/sii-normative.utils';

const fields = z.object({ razonSocial: z.string().trim().min(relaxedDataEntry() ? 0 : 2).max(100), giro: z.string().trim().min(relaxedDataEntry() ? 0 : 2).max(40),
  direccion: z.string().trim().min(relaxedDataEntry() ? 0 : 3).max(70), comuna: z.string().trim().min(relaxedDataEntry() ? 0 : 2).max(20), ciudad: z.string().trim().min(relaxedDataEntry() ? 0 : 2).max(20),
  contacto: z.string().trim().max(80).optional(), correoDte: (relaxedDataEntry() ? z.string() : z.string().email()).max(80).optional(),
  taxpayerType: z.enum(['VAT_AFFECTED_1ST_CAT','FEES_RECEIPT_ISSUER','END_CONSUMER','FOREIGNER']),
}).strict();
export const customerSchema = fields.extend({ rut: z.string().trim() });
export const customerUpdateSchema = fields;
export async function listCustomers(db: PrismaClient, tenantId: string, raw: unknown) {
  const q = z.object({ search: z.string().trim().max(100).default(''), cursor: z.string().uuid().optional() }).parse(raw);
  const rows = await db.clienteReceptor.findMany({ where: { tenantId, ...(q.search ? { OR: [{ razonSocial: { contains: q.search, mode: 'insensitive' } }, { rut: { contains: q.search, mode: 'insensitive' } }] } : {}) },
    orderBy: { id: 'asc' }, take: 51, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) });
  const more = rows.length > 50; if (more) rows.pop();
  return { items: rows, nextCursor: more ? rows[rows.length - 1].id : null };
}
export async function saveCustomer(db: PrismaClient, tenantId: string, actorId: string, raw: unknown, id?: string) {
  const data = id ? customerUpdateSchema.parse(raw) : customerSchema.parse(raw);
  let rut: string | undefined;
  if ('rut' in data) {
    try { rut = relaxedDataEntry() ? String(data.rut) : normalizeAndValidateRut(String(data.rut)); }
    catch { throw new FinanceError(400, 'El RUT del cliente no es válido.'); }
  }
  try {
    return await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id=${tenantId}::uuid FOR UPDATE`;
      if (id && !await tx.clienteReceptor.findFirst({ where: { id, tenantId } })) throw new FinanceError(404, 'Cliente no encontrado en esta empresa.');
      const payload = { ...data, contacto: data.contacto || null, correoDte: data.correoDte || null };
      const customer = id
        ? await tx.clienteReceptor.update({ where: { id }, data: payload })
        : await tx.clienteReceptor.create({ data: { ...payload, rut: rut!, tenantId } });
      await tx.financeAuditEvent.create({ data: { tenantId, actorId, action: id ? 'customer.update' : 'customer.create', entityId: customer.id, data: { fields: Object.keys(data) } } });
      return customer;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new FinanceError(409, 'El cliente ya existe con ese RUT en esta empresa.');
    throw e;
  }
}
