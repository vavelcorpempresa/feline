import { relaxedDataEntry } from './development-validation';
import type { FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { hashClave } from '../auth/panel-auth';
import { dateSchema, FinanceError } from './ledger';
import { formatSiiTimestamp, normalizeAndValidateRut } from '../utils/sii-normative.utils';

const schema = z.object({
  name: z.string().trim().min(relaxedDataEntry() ? 0 : 2).max(100),
  email: (relaxedDataEntry() ? z.string() : z.string().email()).max(254).transform(v => v.toLowerCase()),
  password: z.string().min(12).max(256),
  passwordConfirm: z.string().min(12).max(256),
  company: z.object({
    rut: z.string().trim(), razonSocial: z.string().trim().min(relaxedDataEntry() ? 0 : 3).max(100),
    giro: z.string().trim().min(relaxedDataEntry() ? 0 : 3).max(80), direccion: z.string().trim().min(relaxedDataEntry() ? 0 : 3).max(70),
    comuna: z.string().trim().min(relaxedDataEntry() ? 0 : 2).max(20), ciudad: z.string().trim().min(relaxedDataEntry() ? 0 : 2).max(20),
    acteco: z.array(z.number().int().min(relaxedDataEntry() ? 0 : 1).max(999999)).min(relaxedDataEntry() ? 0 : 1).max(4),
    rutEnvia: z.string().trim(), fchResol: relaxedDataEntry() ? z.string().transform(v => v || formatSiiTimestamp().slice(0, 10)).pipe(dateSchema) : dateSchema,
  }).strict(),
}).strict().refine(v => v.password === v.passwordConfirm, { message: 'Las contraseñas no coinciden.', path: ['passwordConfirm'] });

/** Solo instalación local expresamente habilitada; nunca a través de proxy o producción. */
export function localSetupAllowed(req: FastifyRequest): boolean {
  if (process.env.NODE_ENV === 'production' || process.env.FELINE_FINANCE_SETUP !== 'local') return false;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip)) return false;
  if (['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip'].some(h => req.headers[h] !== undefined)) return false;
  try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL('http://' + req.headers.host).hostname); }
  catch { return false; }
}
export async function setupAvailable(db: PrismaClient): Promise<boolean> {
  const [users, companies] = await Promise.all([db.financeUser.count(), db.tenant.count()]);
  return users === 0 && companies === 0;
}
export async function createInitialFinanceCompany(db: PrismaClient, raw: unknown, tokenHash: string) {
  const input = schema.parse(raw);
  let rut: string, rutEnvia: string;
  try {
    rut = relaxedDataEntry() ? input.company.rut : normalizeAndValidateRut(input.company.rut);
    rutEnvia = relaxedDataEntry() ? input.company.rutEnvia : normalizeAndValidateRut(input.company.rutEnvia);
  } catch { throw new FinanceError(400, 'Revisa el RUT de la empresa y el del firmante.'); }
  return db.$transaction(async tx => {
    // Serializar el primer registro incluso entre varias instancias del servidor.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(703110110)`;
    if (await tx.financeUser.count() || await tx.tenant.count()) throw new FinanceError(409, 'La configuración inicial ya fue realizada.');
    const c = input.company;
    const company = await tx.tenant.create({ data: { rut, razonSocial: c.razonSocial, giro: c.giro, acteco: c.acteco,
      direccionOrigen: c.direccion, comunaOrigen: c.comuna, ciudadOrigen: c.ciudad,
      fchResol: new Date(c.fchResol), nroResol: 0, rutEnvia, environment: 'CERTIFICACION' } });
    const user = await tx.financeUser.create({ data: { name: input.name, email: input.email,
      passwordHash: hashClave(input.password), memberships: { create: { tenantId: company.id, role: 'OWNER' } } } });
    await tx.financeSession.create({ data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 8 * 3600_000) } });
    const month = formatSiiTimestamp().slice(0, 7);
    const period = await tx.financePeriod.create({ data: { tenantId: company.id, month } });
    await tx.financeAuditEvent.createMany({ data: [
      { tenantId: company.id, actorId: user.id, action: 'user.provision', entityId: user.id, data: { role: 'OWNER', method: 'local-setup' } },
      { tenantId: company.id, actorId: user.id, action: 'period.open', entityId: period.id, data: { month } },
    ] });
    return { userId: user.id, tenantId: company.id, name: user.name };
  });
}
