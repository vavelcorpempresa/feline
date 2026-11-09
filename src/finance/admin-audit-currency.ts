import { PrismaClient, Prisma, FinanceRole } from '@prisma/client';
import { z } from 'zod';
import { FinanceError } from './ledger';

export const currencyRateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.enum(['USD', 'UF', 'EUR']),
  rate: z.union([z.number(), z.string()]).transform(v => new Prisma.Decimal(v)),
  source: z.string().max(50).optional(),
}).strict();

export const taxSettingSchema = z.object({
  environment: z.enum(['DEVELOPMENT', 'CERTIFICACION', 'PRODUCCION']).optional(),
  ppmRate: z.union([z.number(), z.string()]).optional().transform(v => v ? new Prisma.Decimal(v) : undefined),
  feeRetentionRate: z.union([z.number(), z.string()]).optional().transform(v => v ? new Prisma.Decimal(v) : undefined),
  autoAcuseDte: z.boolean().optional(),
}).strict();

export class FinanceAdminAuditCurrency {
  constructor(private readonly db: PrismaClient) {}

  // ============================================================================
  // 14 · AUDITORÍA EXTENDIDA Y CONTROL
  // ============================================================================

  async getAuditLog(tenantId: string, filters?: { action?: string; actorId?: string; cursor?: string; limit?: number }) {
    const take = filters?.limit ? Math.min(filters.limit, 200) : 50;
    const where: Prisma.FinanceAuditEventWhereInput = { tenantId };
    if (filters?.action) where.action = { contains: filters.action };
    if (filters?.actorId) where.actorId = filters.actorId;

    const rows = await this.db.financeAuditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(filters?.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const more = rows.length > take;
    if (more) rows.pop();

    return {
      items: rows,
      nextCursor: more ? rows[rows.length - 1].id : null,
      totalCount: await this.db.financeAuditEvent.count({ where }),
    };
  }

  // ============================================================================
  // 15 · CONFIGURACIÓN TRIBUTARIA Y CAFs
  // ============================================================================

  async getTaxSettings(tenantId: string) {
    const tenant = await this.db.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        id: true,
        rut: true,
        razonSocial: true,
        giro: true,
        acteco: true,
        taxpayerType: true,
        direccionOrigen: true,
        comunaOrigen: true,
        ciudadOrigen: true,
        codigoSucursal: true,
        fchResol: true,
        nroResol: true,
        environment: true,
        isActive: true,
      },
    });

    const setting = await this.db.financeTaxSetting.findUnique({
      where: { tenantId },
    });

    const cafs = await this.db.cafFolio.findMany({
      where: { tenantId },
      orderBy: { tipoDte: 'asc' },
    });

    const cafSummary = cafs.map(c => {
      const totalFolios = c.folioHasta - c.folioDesde + 1;
      const usedFolios = Math.max(0, c.folioActual - c.folioDesde);
      const remainingFolios = Math.max(0, c.folioHasta - c.folioActual + 1);

      return {
        id: c.id,
        tipoDte: c.tipoDte,
        folioDesde: c.folioDesde,
        folioHasta: c.folioHasta,
        folioActual: c.folioActual,
        totalFolios,
        usedFolios,
        remainingFolios,
        fechaAutorizacion: c.fechaAutorizacion.toISOString().slice(0, 10),
        isLow: remainingFolios < 20,
      };
    });

    return {
      company: tenant,
      settings: setting ? {
        ...setting,
        ppmRate: setting.ppmRate.toString(),
        feeRetentionRate: setting.feeRetentionRate.toString(),
      } : {
        environment: tenant.environment,
        ppmRate: '1.00',
        feeRetentionRate: '13.75',
        autoAcuseDte: false,
      },
      cafSummary,
    };
  }

  async updateTaxSettings(tenantId: string, userId: string, rawInput: unknown) {
    const input = taxSettingSchema.parse(rawInput);

    const setting = await this.db.financeTaxSetting.upsert({
      where: { tenantId },
      update: {
        ...(input.environment ? { environment: input.environment } : {}),
        ...(input.ppmRate ? { ppmRate: input.ppmRate } : {}),
        ...(input.feeRetentionRate ? { feeRetentionRate: input.feeRetentionRate } : {}),
        ...(input.autoAcuseDte !== undefined ? { autoAcuseDte: input.autoAcuseDte } : {}),
      },
      create: {
        tenantId,
        environment: input.environment || 'CERTIFICACION',
        ppmRate: input.ppmRate || new Prisma.Decimal('1.00'),
        feeRetentionRate: input.feeRetentionRate || new Prisma.Decimal('13.75'),
        autoAcuseDte: input.autoAcuseDte || false,
      },
    });

    await this.db.financeAuditEvent.create({
      data: {
        tenantId,
        actorId: userId,
        action: 'tax_setting.update',
        entityId: setting.id,
        data: { environment: setting.environment, ppmRate: setting.ppmRate.toString() },
      },
    });

    return setting;
  }

  // ============================================================================
  // 16 · MULTIMONEDA (PARIDADES) Y USUARIOS / ROLES
  // ============================================================================

  async getCurrencyRates(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const rates = await this.db.financeCurrencyRate.findMany({
      orderBy: { date: 'desc' },
      take: 30,
    });

    return rates.map(r => ({
      ...r,
      rate: r.rate.toString(),
      date: r.date.toISOString().slice(0, 10),
    }));
  }

  async setCurrencyRate(userId: string, rawInput: unknown) {
    const input = currencyRateSchema.parse(rawInput);
    const d = new Date(input.date);

    const rate = await this.db.financeCurrencyRate.upsert({
      where: { date_currency: { date: d, currency: input.currency } },
      update: { rate: input.rate, source: input.source || 'BANCO_CENTRAL_CL' },
      create: { date: d, currency: input.currency, rate: input.rate, source: input.source || 'BANCO_CENTRAL_CL' },
    });

    return rate;
  }

  async listUsersAndMemberships(tenantId: string) {
    const memberships = await this.db.financeMembership.findMany({
      where: { tenantId },
      include: {
        user: { select: { id: true, email: true, name: true, active: true, createdAt: true } },
      },
      orderBy: { role: 'asc' },
    });

    return memberships.map(m => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      active: m.user.active,
      role: m.role,
      joinedAt: m.user.createdAt,
    }));
  }

  async updateUserRole(tenantId: string, adminUserId: string, targetUserId: string, newRole: FinanceRole) {
    if (adminUserId === targetUserId && newRole !== 'OWNER') {
      throw new FinanceError(400, 'No puedes cambiar tu propio rol de OWNER para evitar pérdida de acceso.');
    }

    const membership = await this.db.financeMembership.update({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
      data: { role: newRole },
    });

    await this.db.financeAuditEvent.create({
      data: {
        tenantId,
        actorId: adminUserId,
        action: 'user.role_change',
        entityId: targetUserId,
        data: { newRole },
      },
    });

    return membership;
  }
}
