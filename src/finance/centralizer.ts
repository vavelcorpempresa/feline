import { PrismaClient } from '@prisma/client';
import { FinanceError, FinanceLedger } from './ledger';

/** Cola persistente: los fallos contables nunca alteran el resultado tributario del DTE. */
export class FinanceCentralizer {
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  constructor(private readonly db: PrismaClient, private readonly ledger = new FinanceLedger(db)) {}
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick().catch(e => console.error('[Finanzas] Centralización interrumpida', e.message)), 30_000);
    this.timer.unref();
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  async configure(tenantId: string, actorId: string, enabled: boolean) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
      const setting = await tx.financeConfiguration.upsert({ where: { tenantId }, create: { tenantId, authorizedBy: actorId, automaticPosting: enabled }, update: { authorizedBy: actorId, automaticPosting: enabled } });
      await tx.financeAuditEvent.create({ data: { tenantId, actorId, action: 'centralization.configure', entityId: tenantId, data: { enabled } } });
      return setting;
    });
  }
  async postOne(tenantId: string, actorId: string, documentId: string) {
    const doc = await this.db.documentoDTE.findFirst({ where: { id: documentId, tenantId } });
    if (!doc) throw new FinanceError(404, 'Documento no encontrado en esta empresa.');
    await this.db.financePostingJob.upsert({ where: { documentId }, create: { documentId, tenantId }, update: {} });
    try {
      const result = await this.ledger.postDocument(tenantId, actorId, documentId);
      await this.db.financePostingJob.update({ where: { documentId }, data: { state: result.skipped ? 'SKIPPED' : 'DONE', entryId: result.entry?.id, lastError: null, attempts: { increment: 1 } } });
      return result;
    } catch (e) {
      const job = await this.db.financePostingJob.findUniqueOrThrow({ where: { documentId } });
      await this.db.financePostingJob.update({ where: { documentId }, data: {
        state: 'ERROR', attempts: { increment: 1 }, lastError: (e instanceof Error ? e.message : 'Error de centralización').slice(0, 500),
        nextAttempt: new Date(Date.now() + Math.min(3600_000, 30_000 * 2 ** Math.min(job.attempts, 7))),
      } });
      throw e;
    }
  }
  async tick() {
    if (this.running) return { posted: 0, failed: 0 };
    this.running = true;
    let posted = 0, failed = 0;
    try {
      const docs = await this.db.documentoDTE.findMany({ where: {
        tenant: { isActive: true, financeConfiguration: { automaticPosting: true } },
        estado: { in: ['ACEPTADO', 'ACEPTADO_CON_REPARO'] }, financeEntries: { none: {} },
        OR: [{ financePostingJob: null }, { financePostingJob: { state: { in: ['PENDING', 'ERROR'] }, nextAttempt: { lte: new Date() } } }],
      }, include: { tenant: { select: { financeConfiguration: true } } }, orderBy: { createdAt: 'asc' }, take: 50 });
      for (const doc of docs) {
        try { await this.postOne(doc.tenantId, doc.tenant.financeConfiguration!.authorizedBy, doc.id); posted++; }
        catch { failed++; }
      }
      return { posted, failed };
    } finally { this.running = false; }
  }
}
