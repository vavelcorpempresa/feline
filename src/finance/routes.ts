import { relaxedDataEntry } from './development-validation';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { PrismaClient, FinanceRole } from '@prisma/client';
import { z } from 'zod';
import { hashClave, verificarClave } from '../auth/panel-auth';
import { FinanceError, FinanceLedger, monthSchema } from './ledger';
import { registerSalesGoals } from './sales-goals.routes';
import { registerSales } from './sales.routes';
import { registerReceivables } from './receivables.routes';
import { registerPayables } from './payables.routes';
import { registerTreasury } from './treasury.routes';
import { registerBanking } from './banking.routes';
import { registerAccounting } from './accounting.routes';
import { registerTaxDte } from './tax-dte.routes';
import { registerBudgetsAssetsPayroll } from './budgets-assets-payroll.routes';
import { registerAdminAuditCurrency } from './admin-audit-currency.routes';
import { localSetupAllowed, setupAvailable, createInitialFinanceCompany } from './setup';
import { FinanceCentralizer } from './centralizer';
import { ODOO_CL_CHART_OF_ACCOUNTS } from '../services/odoo-accounting-engine.service';

const COOKIE = 'feline_finance';
const digest = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
const loginSchema = z.object({ email: (relaxedDataEntry() ? z.string() : z.string().email()).max(254).transform(s => s.toLowerCase()), password: z.string().min(1).max(256) }).strict();
export const FINANCE_PERMISSIONS: Record<FinanceRole, readonly string[]> = {
  OWNER: ['read', 'salesGoals', 'post', 'reverse', 'period', 'close', 'audit', 'users', 'collect', 'settle', 'reverseCollection', 'customers', 'vendors', 'payables', 'pay', 'treasury'],
  ACCOUNTANT: ['read', 'post', 'reverse', 'period', 'close', 'audit', 'collect', 'settle', 'reverseCollection', 'customers', 'vendors', 'payables', 'pay', 'treasury'],
  BILLING: ['read', 'collect', 'customers', 'vendors', 'payables', 'treasury'],
  VIEWER: ['read'],
};

export function registerFinance(app: FastifyInstance, db: PrismaClient) {
  const ledger = new FinanceLedger(db);
  const centralizer = new FinanceCentralizer(db, ledger);
  const failures = new Map<string, { count: number; until: number }>();
  const dummyHash = hashClave(crypto.randomBytes(24).toString('hex'));
  const cookie = (value: string, age: number) => `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  app.register(async api => {
    api.setErrorHandler((err, req, reply) => {
      if (err instanceof z.ZodError) return reply.code(400).send({ error: 'Datos inválidos', issues: err.issues });
      if (err instanceof FinanceError) return reply.code(err.statusCode).send({ error: err.message });
      if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) return reply.code(err.statusCode).send({ error: 'Solicitud inválida.' });
      req.log.error(err);
      return reply.code(500).send({ error: 'No se pudo procesar la operación financiera.' });
    });
    api.addHook('preHandler', async (req, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        if (!String(req.headers['content-type']).startsWith('application/json')) return reply.code(415).send({ error: 'Se requiere application/json.' });
        if (req.headers.origin) {
          const expected = new URL(process.env.FELINE_PUBLIC_URL || `${req.protocol}://${req.headers.host}`).origin;
          if (req.headers.origin !== expected) return reply.code(403).send({ error: 'Origen no autorizado.' });
        }
      }
      const route = req.routeOptions.url;
      if (['/api/v1/finance/login', '/api/v1/finance/setup-state', '/api/v1/finance/setup'].includes(route ?? '')) return;
      const raw = (req.headers.cookie ?? '').split(';').map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
      if (raw && /^[a-f0-9]{64}$/.test(raw)) {
        const session = await db.financeSession.findUnique({ where: { tokenHash: digest(raw) }, include: { user: { include: { memberships: { include: { tenant: { select: { razonSocial: true, isActive: true } } } } } } } });
        if (session && session.expiresAt > new Date() && session.user.active) {
          req.financeSession = { id: session.id, userId: session.userId, name: session.user.name,
            memberships: session.user.memberships.filter(m => m.tenant.isActive).map(m => ({ tenantId: m.tenantId, role: m.role, name: m.tenant.razonSocial })) };
        }
      }
      if (!req.financeSession) return reply.code(401).send({ error: 'Inicia sesión en Finanzas.' });
      if (route === '/api/v1/finance/session' || route === '/api/v1/finance/logout') return;
      const tenant = z.string().uuid().safeParse(req.headers['x-tenant-id']);
      const membership = tenant.success && req.financeSession.memberships.find(m => m.tenantId === tenant.data);
      if (!membership) return reply.code(403).send({ error: 'Selecciona una empresa autorizada.' });
      const permission = req.routeOptions.config.financePermission;
      if (!permission || !FINANCE_PERMISSIONS[membership.role].includes(permission)) return reply.code(403).send({ error: 'Tu rol no permite esta acción.' });
      req.financeTenantId = membership.tenantId;
    });

    registerReceivables(api, db);
    registerSales(api, db);
    registerSalesGoals(api, db);
    registerPayables(api, db);
    registerTreasury(api, db);
    registerBanking(api, db);
    registerAccounting(api, db);
    registerTaxDte(api, db);
    registerBudgetsAssetsPayroll(api, db);
    registerAdminAuditCurrency(api, db);

    api.get('/setup-state', async req => ({ available: localSetupAllowed(req) && await setupAvailable(db) }));
    api.post('/setup', async (req, reply) => {
      if (!localSetupAllowed(req)) return reply.code(404).send({ error: 'Configuración inicial no disponible.' });
      const token = crypto.randomBytes(32).toString('hex');
      const result = await createInitialFinanceCompany(db, req.body, digest(token));
      reply.header('Set-Cookie', cookie(token, 8 * 3600));
      return reply.code(201).send(result);
    });
    api.post('/login', async (req, reply) => {
      const input = loginSchema.parse(req.body);
      const key = digest(req.ip + ':' + input.email);
      const now = Date.now();
      for (const [k, v] of failures) if (v.until <= now) failures.delete(k);
      const failure = failures.get(key);
      if (failure && failure.count >= 5) return reply.code(429).send({ error: 'Demasiados intentos. Espera 15 minutos.' });
      if (failures.size > 10000) return reply.code(429).send({ error: 'Intenta más tarde.' });
      const user = await db.financeUser.findUnique({ where: { email: input.email } });
      const valid = verificarClave(input.password, user?.passwordHash ?? dummyHash);
      if (!user?.active || !valid) {
        failures.set(key, { count: (failure?.count ?? 0) + 1, until: failure?.until ?? now + 15 * 60_000 });
        return reply.code(401).send({ error: 'Correo o contraseña incorrectos.' });
      }
      failures.delete(key);
      const token = crypto.randomBytes(32).toString('hex');
      await db.financeSession.create({ data: { tokenHash: digest(token), userId: user.id, expiresAt: new Date(now + 8 * 3600_000) } });
      reply.header('Set-Cookie', cookie(token, 8 * 3600));
      return { name: user.name };
    });
    api.get('/session', async req => req.financeSession);
    api.post('/logout', async (req, reply) => {
      await db.financeSession.deleteMany({ where: { id: req.financeSession!.id } });
      reply.header('Set-Cookie', cookie('', 0));
      return { ok: true };
    });
    api.get('/accounts', { config: { financePermission: 'read' } }, async () => ODOO_CL_CHART_OF_ACCOUNTS);
    api.get('/periods', { config: { financePermission: 'read' } }, async req => db.financePeriod.findMany({ where: { tenantId: req.financeTenantId }, orderBy: { month: 'desc' }, take: 120 }));
    api.post('/periods', { config: { financePermission: 'period' } }, async (req, reply) => {
      const { month } = z.object({ month: monthSchema }).strict().parse(req.body);
      return reply.code(201).send(await ledger.openPeriod(req.financeTenantId!, req.financeSession!.userId, month));
    });
    api.post('/periods/:month/close', { config: { financePermission: 'close' } }, async req => {
      z.object({ confirm: z.literal(true) }).strict().parse(req.body);
      return ledger.closePeriod(req.financeTenantId!, req.financeSession!.userId, (req.params as { month: string }).month);
    });
    api.get('/entries', { config: { financePermission: 'read' } }, async req => {
      const q = z.object({ month: monthSchema, cursor: z.string().uuid().optional() }).parse(req.query);
      const rows = await db.financeEntry.findMany({ where: { tenantId: req.financeTenantId, period: { month: q.month } },
        orderBy: { id: 'asc' }, take: 51, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}), include: { lines: true, reversal: { select: { id: true } } } });
      const hasMore = rows.length > 50; if (hasMore) rows.pop();
      return { items: rows, nextCursor: hasMore ? rows[rows.length - 1].id : null };
    });
    api.post('/entries', { config: { financePermission: 'post' } }, async (req, reply) => {
      const r = await ledger.post(req.financeTenantId!, req.financeSession!.userId, String(req.headers['idempotency-key'] ?? ''), req.body);
      return reply.code(r.replay ? 200 : 201).send(r);
    });
    api.post('/entries/:id/reverse', { config: { financePermission: 'reverse' } }, async (req, reply) => {
      const b = z.object({ date: z.string(), reason: z.string() }).strict().parse(req.body);
      const r = await ledger.reverse(req.financeTenantId!, req.financeSession!.userId, (req.params as { id: string }).id, String(req.headers['idempotency-key'] ?? ''), b.date, b.reason);
      return reply.code(r.replay ? 200 : 201).send(r);
    });
    api.get('/report', { config: { financePermission: 'read' } }, async req => ledger.report(req.financeTenantId!, monthSchema.parse((req.query as { month: string }).month)));
    api.get('/centralization', { config: { financePermission: 'read' } }, async req => {
      const month = monthSchema.parse((req.query as { month: string }).month);
      const documents = await db.documentoDTE.findMany({ where: { tenantId: req.financeTenantId, fechaEmision: { gte: new Date(month + '-01'), lt: new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 1)) } },
        include: { financeEntries: { select: { id: true } }, financePostingJob: true, receptor: { select: { razonSocial: true, rut: true } } }, orderBy: { fechaEmision: 'desc' }, take: 100 });
      return { configuration: await db.financeConfiguration.findUnique({ where: { tenantId: req.financeTenantId! } }), items: documents.map(d => ({
        id: d.id, tipoDte: d.tipoDte, folio: d.folio, date: d.fechaEmision, status: d.estado, total: String(d.mntTotal),
        customer: d.receptor.razonSocial, entryId: d.financeEntries[0]?.id ?? null,
        jobState: d.financePostingJob?.state ?? null, error: d.financePostingJob?.lastError ?? null,
      })), limit: 100 };
    });
    api.post('/centralization/:id', { config: { financePermission: 'post' } }, async (req, reply) => {
      const id = z.string().uuid().parse((req.params as { id: string }).id);
      z.object({ confirm: z.literal(true) }).strict().parse(req.body);
      const result = await centralizer.postOne(req.financeTenantId!, req.financeSession!.userId, id);
      return reply.code(result.replay ? 200 : 201).send(result);
    });
    api.put('/centralization/configuration', { config: { financePermission: 'close' } }, async req => {
      const { enabled } = z.object({ enabled: z.boolean() }).strict().parse(req.body);
      return centralizer.configure(req.financeTenantId!, req.financeSession!.userId, enabled);
    });
    api.get('/audit', { config: { financePermission: 'audit' } }, async req => {
      const q = z.object({ cursor: z.string().uuid().optional() }).parse(req.query);
      const rows = await db.financeAuditEvent.findMany({ where: { tenantId: req.financeTenantId }, orderBy: { id: 'asc' }, take: 101, ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}) });
      const more = rows.length > 100; if (more) rows.pop();
      return { items: rows, nextCursor: more ? rows[rows.length - 1].id : null };
    });
  }, { prefix: '/api/v1/finance' });
}

declare module 'fastify' {
  interface FastifyRequest {
    financeSession?: { id: string; userId: string; name: string; memberships: Array<{ tenantId: string; role: FinanceRole; name: string }> };
    financeTenantId?: string;
  }
  interface FastifyContextConfig { financePermission?: string }
}
