import { z } from 'zod';
import { prismaBase } from '../core/tenant-context';
import { hashClave } from '../auth/panel-auth';
import { normalizeAndValidateRut } from '../utils/sii-normative.utils';

// Aprovisionamiento explícito; contraseña por variable, nunca argumento ni registro.
// Empresa por FELINE_FINANCE_TENANT_ID (uuid) o por FELINE_FINANCE_RUT (scripts/deploy/crear-usuario.sh).
async function main() {
  const rut = process.env.FELINE_FINANCE_RUT;
  const tenantId = rut
    ? (await prismaBase.tenant.findUniqueOrThrow({ where: { rut: normalizeAndValidateRut(rut) } })).id
    : z.string().uuid().parse(process.env.FELINE_FINANCE_TENANT_ID);
  const email = z.string().email().transform(s => s.toLowerCase()).parse(process.env.FELINE_FINANCE_EMAIL);
  const name = z.string().min(2).max(100).parse(process.env.FELINE_FINANCE_NAME);
  const password = z.string().min(12).max(256).parse(process.env.FELINE_FINANCE_PASSWORD);
  const role = z.enum(['OWNER', 'ACCOUNTANT', 'BILLING', 'VIEWER']).parse(process.env.FELINE_FINANCE_ROLE || 'VIEWER');
  await prismaBase.$transaction(async tx => {
    await tx.tenant.findUniqueOrThrow({ where: { id: tenantId, isActive: true } });
    const user = await tx.financeUser.create({ data: { email, name, passwordHash: hashClave(password), memberships: { create: { tenantId, role } } } });
    await tx.financeAuditEvent.create({ data: { tenantId, actorId: user.id, action: 'user.provision', entityId: user.id, data: { role, method: 'local-admin' } } });
  });
  console.log('Usuario financiero creado.');
}
main().catch(() => { console.error('No se pudo crear el usuario. Verifica empresa, correo único y parámetros.'); process.exitCode = 1; }).finally(() => prismaBase.$disconnect());
