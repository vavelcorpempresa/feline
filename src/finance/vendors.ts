import { relaxedDataEntry } from './development-validation';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { FinanceError } from './ledger';
import { normalizeAndValidateRut } from '../utils/sii-normative.utils';

const vendorFields = z.object({
  razonSocial: z.string().trim().min(relaxedDataEntry() ? 0 : 2).max(120),
  giro: z.string().trim().min(relaxedDataEntry() ? 0 : 2).max(100),
  direccion: z.string().trim().min(relaxedDataEntry() ? 0 : 3).max(100),
  comuna: z.string().trim().min(relaxedDataEntry() ? 0 : 2).max(30),
  ciudad: z.string().trim().min(relaxedDataEntry() ? 0 : 2).max(30),
  contacto: z.string().trim().max(80).optional(),
  correo: (relaxedDataEntry() ? z.string() : z.string().email()).max(120).optional(),
  telefono: z.string().trim().max(30).optional(),
  banco: z.string().trim().max(60).optional(),
  tipoCuenta: z.string().trim().max(30).optional(),
  numeroCuenta: z.string().trim().max(50).optional(),
}).strict();

export const vendorSchema = vendorFields.extend({ rut: z.string().trim() });
export const vendorUpdateSchema = vendorFields;

export async function listVendors(db: PrismaClient, tenantId: string, raw: unknown) {
  const q = z.object({ search: z.string().trim().max(100).default(''), cursor: z.string().uuid().optional() }).parse(raw);
  const rows = await db.financeVendor.findMany({
    where: {
      tenantId,
      ...(q.search ? {
        OR: [
          { razonSocial: { contains: q.search, mode: 'insensitive' } },
          { rut: { contains: q.search, mode: 'insensitive' } },
          { giro: { contains: q.search, mode: 'insensitive' } },
        ],
      } : {}),
    },
    orderBy: { razonSocial: 'asc' },
    take: 51,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });
  const more = rows.length > 50;
  if (more) rows.pop();
  return { items: rows, nextCursor: more ? rows[rows.length - 1].id : null };
}

export async function saveVendor(db: PrismaClient, tenantId: string, actorId: string, raw: unknown, id?: string) {
  const data = id ? vendorUpdateSchema.parse(raw) : vendorSchema.parse(raw);
  let rut: string | undefined;
  if ('rut' in data) {
    try {
      rut = relaxedDataEntry() ? String(data.rut) : normalizeAndValidateRut(String(data.rut));
    } catch {
      throw new FinanceError(400, 'El RUT del proveedor no es válido.');
    }
  }

  try {
    return await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id=${tenantId}::uuid FOR UPDATE`;
      if (id && !(await tx.financeVendor.findFirst({ where: { id, tenantId } }))) {
        throw new FinanceError(404, 'Proveedor no encontrado en esta empresa.');
      }
      const payload = {
        ...data,
        contacto: data.contacto || null,
        correo: data.correo || null,
        telefono: data.telefono || null,
        banco: data.banco || null,
        tipoCuenta: data.tipoCuenta || null,
        numeroCuenta: data.numeroCuenta || null,
      };
      const vendor = id
        ? await tx.financeVendor.update({ where: { id }, data: payload })
        : await tx.financeVendor.create({ data: { ...payload, rut: rut!, tenantId } });

      await tx.financeAuditEvent.create({
        data: {
          tenantId,
          actorId,
          action: id ? 'vendor.update' : 'vendor.create',
          entityId: vendor.id,
          data: { fields: Object.keys(data), rut: vendor.rut, razonSocial: vendor.razonSocial },
        },
      });
      return vendor;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new FinanceError(409, 'El proveedor ya existe con ese RUT en esta empresa.');
    }
    throw e;
  }
}

export async function getVendorStatement(db: PrismaClient, tenantId: string, vendorId: string) {
  const vendor = await db.financeVendor.findFirst({ where: { id: vendorId, tenantId } });
  if (!vendor) throw new FinanceError(404, 'Proveedor no encontrado.');

  const payables = await db.financePayable.findMany({
    where: { tenantId, vendorId },
    include: {
      payments: { include: { reversals: true } },
      invoiceAllocations: { include: { reversals: true } },
      creditAllocations: { include: { reversals: true } },
    },
    orderBy: { date: 'asc' },
  });

  let totalDebt = new Prisma.Decimal(0);
  let totalPaid = new Prisma.Decimal(0);

  const movements = payables.map(p => {
    let paidAmount = new Prisma.Decimal(0);
    for (const pm of p.payments) {
      if (!pm.reversals.length) paidAmount = paidAmount.plus(pm.amount);
    }
    for (const alloc of p.invoiceAllocations) {
      if (!alloc.reversals.length) paidAmount = paidAmount.plus(alloc.amount);
    }
    const currentBalance = p.kind === 'DEBT'
      ? p.totalAmount.minus(paidAmount)
      : p.totalAmount.minus(paidAmount).negated();

    if (p.kind === 'DEBT') {
      totalDebt = totalDebt.plus(p.totalAmount);
      totalPaid = totalPaid.plus(paidAmount);
    }

    return {
      id: p.id,
      date: p.date.toISOString().slice(0, 10),
      dueDate: p.dueDate ? p.dueDate.toISOString().slice(0, 10) : null,
      documentType: p.documentType,
      folio: p.folio,
      description: p.description,
      kind: p.kind,
      totalAmount: p.totalAmount.toString(),
      paidAmount: paidAmount.toString(),
      balance: currentBalance.toString(),
      status: p.status,
    };
  });

  return {
    vendor,
    summary: {
      totalInvoiced: totalDebt.toString(),
      totalPaid: totalPaid.toString(),
      balanceDue: totalDebt.minus(totalPaid).toString(),
      documentsCount: payables.length,
    },
    movements,
  };
}
