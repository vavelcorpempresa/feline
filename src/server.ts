import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prismaBase } from './core/tenant-context';
import { VERSION, puerto, urlPublica } from './config';
import { CryptoVaultService } from './core/crypto-vault';
import { CafTedService } from './services/caf-ted.service';
import { XmlDsigSignerService } from './services/xmldsig-signer.service';
import { SiiWebServiceIntegration } from './services/sii-webservice.service';
import { DteBillingOrchestratorService } from './services/dte-orchestrator.service';
import {
  ODOO_L10N_CL_DOCUMENT_TYPES,
  OdooAccountMoveService,
} from './services/odoo-account-move.service';
import {
  FelineLiveSandboxStore,
  felineSandboxStore,
  FELINE_ROLE_PROFILES,
  FelineRoleKey,
} from './services/feline-live-sandbox.service';
import { renderFelineAntdDashboardHtml } from './ui/feline-antd-dashboard.html';
import { CodigoTipoDTE } from './types/sii-dte.types';
import { normalizeAndValidateRut } from './utils/sii-normative.utils';
import { registerApiV1 } from './api/v1/documentos.routes';
import { ApiDocumentosService } from './services/api-documentos.service';
import { WebhookService } from './services/webhook.service';
import { DteDispatcherService } from './services/dte-dispatcher.service';
import { crearFetchSiiSimulado } from './services/sii-simulado';

// ============================================================================
// FELINE - SERVIDOR FASTIFY, DASHBOARD ANTD MULTIPURPOSE Y API REST (PUERTO 3004)
// Motor Híbrido: Odoo Accounting (`account.move` + `l10n_cl`) + SII Chile DTE
// ============================================================================

export type SiiModo = 'real' | 'simulado';

/** Compara el token de administrador en tiempo constante. */
function tokenAdminValido(header: string | undefined, esperado: string): boolean {
  const recibido = (header ?? '').replace(/^Bearer\s+/i, '');
  const a = crypto.createHash('sha256').update(recibido).digest();
  const b = crypto.createHash('sha256').update(esperado).digest();
  return recibido.length > 0 && crypto.timingSafeEqual(a, b);
}

export interface BuildAppOptions {
  /** Conexión al SII: 'real' (maullin/palena según el ambiente del tenant) o 'simulado' (solo desarrollo). */
  siiModo?: SiiModo;
  /** Cliente HTTP para entregar webhooks (inyectable en pruebas). */
  webhookFetch?: typeof fetch;
}

declare module 'fastify' {
  interface FastifyInstance {
    dteDispatcher: DteDispatcherService;
  }
}

export function buildFastifyApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.register(cors);

  // Errores de validación de entrada (zod) son errores del cliente (400), no del servidor (500)
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Datos de entrada inválidos', issues: error.issues });
    }
    if (error.message?.startsWith('Formato de RUT') || error.message?.startsWith('Dígito verificador')) {
      return reply.code(400).send({ error: error.message });
    }
    reply.log.error(error);
    return reply.code(error.statusCode ?? 500).send({ error: error.message });
  });

  const vault = new CryptoVaultService();
  const cafTedService = new CafTedService(prismaBase, vault);
  const signerService = new XmlDsigSignerService(prismaBase, vault);
  const siiModo: SiiModo = options.siiModo ?? (process.env.FELINE_SII_MODO === 'simulado' ? 'simulado' : 'real');
  const siiWsService = new SiiWebServiceIntegration(
    siiModo === 'simulado' ? crearFetchSiiSimulado() : globalThis.fetch
  );
  const orchestrator = new DteBillingOrchestratorService(
    prismaBase,
    cafTedService,
    signerService,
    siiWsService
  );
  const odooMoveService = new OdooAccountMoveService(prismaBase, orchestrator);

  // --------------------------------------------------------------------------
  // API v1 PARA INTEGRACIONES (FUGAR Marketplace) + DESPACHADOR SII Y WEBHOOKS
  // --------------------------------------------------------------------------
  const apiDocumentos = new ApiDocumentosService(prismaBase, orchestrator);
  const webhooks = new WebhookService(
    prismaBase,
    (doc) => apiDocumentos.respuesta(doc),
    options.webhookFetch ?? globalThis.fetch
  );
  const dispatcher = new DteDispatcherService(prismaBase, orchestrator, siiWsService, signerService, webhooks, {
    intervaloMs: Number(process.env.FELINE_DISPATCHER_INTERVAL_MS || 15_000),
  });
  app.decorate('dteDispatcher', dispatcher);
  app.addHook('onClose', async () => dispatcher.stop());
  registerApiV1(app, {
    prisma: prismaBase,
    documentos: apiDocumentos,
    webhooks,
    publicBaseUrl: urlPublica(),
  });

  // --------------------------------------------------------------------------
  // 0. DASHBOARD INTERACTIVO ANTD MULTIPURPOSE EN `/` Y `/dashboard`
  // --------------------------------------------------------------------------
  const currentBrand = (process.env.APP_BRAND === 'rocas' ? 'rocas' : 'feline') as 'feline' | 'rocas';

  app.get('/', async (request, reply) => {
    const accept = request.headers.accept || '';
    if (accept.includes('application/json') && !accept.includes('text/html')) {
      return {
        system: currentBrand === 'rocas' ? 'Rocas del Sur' : 'Feline',
        brand: currentBrand,
        description:
          'Sistema de Facturación Electrónica Multiempresa (Odoo account.move + l10n_cl + DTE SII Chile)',
        version: VERSION,
        port: puerto(),
        status: 'online',
        dashboardUrl: request.protocol + '://' + request.hostname + '/',
        modules: [
          'sii_dte_core',
          'odoo_account_move',
          'odoo_l10n_cl',
          'antd_multipurpose_dashboard',
        ],
      };
    }
    return reply.type('text/html; charset=utf-8').send(renderFelineAntdDashboardHtml(currentBrand));
  });

  app.get('/dashboard', async (_request, reply) => {
    return reply.type('text/html; charset=utf-8').send(renderFelineAntdDashboardHtml(currentBrand));
  });

  app.get('/rocas', async (_request, reply) => {
    return reply.type('text/html; charset=utf-8').send(renderFelineAntdDashboardHtml('rocas'));
  });

  app.get('/feline', async (_request, reply) => {
    return reply.type('text/html; charset=utf-8').send(renderFelineAntdDashboardHtml('feline'));
  });

  app.get('/api/v1/status', async () => ({
    system: 'Feline',
    version: VERSION,
    port: puerto(),
    status: 'online',
  }));

  // --------------------------------------------------------------------------
  // ENDPOINTS INTERACTIVOS DEL DASHBOARD ANTD MULTIPURPOSE (SANDBOX EN VIVO)
  // Son de demostración (datos en memoria, sin autenticación): en producción quedan
  // bloqueados salvo que se habiliten explícitamente con FELINE_DEMO=on.
  // --------------------------------------------------------------------------
  const demoHabilitado = process.env.NODE_ENV !== 'production' || process.env.FELINE_DEMO === 'on';
  app.addHook('onRequest', async (request, reply) => {
    if (!demoHabilitado && request.url.startsWith('/api/v1/dashboard/')) {
      return reply.code(403).send({
        error: 'El modo demostración del panel está deshabilitado en producción (FELINE_DEMO=on para habilitarlo).',
      });
    }
  });
  app.get('/api/v1/dashboard/state', async (request) => {
    const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
    const periodo = String((request.query as any)?.periodo || '2026-10');
    return {
      tenants: felineSandboxStore.tenants.map((t) => ({
        ...t,
        certificate: {
          subjectName: t.certificate.subjectName,
          validFrom: t.certificate.validFrom,
          validTo: t.certificate.validTo,
        },
      })),
      // Solo los datos de la empresa consultada: nunca documentos, clientes ni usuarios de otra
      users: felineSandboxStore.users.filter((u) => u.tenantIds.includes(tenantId)),
      roleProfiles: FELINE_ROLE_PROFILES,
      partners: felineSandboxStore.partners.filter((p) => p.tenantId === tenantId),
      cafs: felineSandboxStore.cafs.filter((c) => c.tenantId === tenantId).map((c) => ({
        id: c.id,
        tenantId: c.tenantId,
        tipoDte: c.tipoDte,
        nombreTipo: c.nombreTipo,
        folioDesde: c.folioDesde,
        folioHasta: c.folioHasta,
        folioActual: c.folioActual,
        fechaAutorizacion: c.fechaAutorizacion,
        agotado: c.agotado,
      })),
      moves: felineSandboxStore.moves.filter((m) => m.tenantId === tenantId),
      lotesEnviados: felineSandboxStore.lotesEnviados.filter((l) => l.tenantId === tenantId),
      documentTypes: ODOO_L10N_CL_DOCUMENT_TYPES,
      rcvF29: felineSandboxStore.getLibroCompraVentaAndF29(tenantId, periodo),
      accounting: felineSandboxStore.getAccountingReport(tenantId, `${periodo}-31`),
      expenses: felineSandboxStore.expenses.filter((e) => e.tenantId === tenantId),
      expenseSheets: felineSandboxStore.expenseSheets.filter((s) => s.tenantId === tenantId),
    };
  });

  app.post('/api/v1/dashboard/tenants', async (request, reply) => {
    try {
      const body = request.body as any;
      const newTenant = felineSandboxStore.createTenant({
        rut: body.rut,
        razonSocial: body.razonSocial,
        giro: body.giro,
        acteco: body.acteco || [620100],
        taxpayerType: body.taxpayerType || 'VAT_AFFECTED_1ST_CAT',
        direccionOrigen: body.direccionOrigen,
        comunaOrigen: body.comunaOrigen,
        ciudadOrigen: body.ciudadOrigen,
        fchResol: body.fchResol,
        nroResol: body.nroResol ? Number(body.nroResol) : 80,
        rutEnvia: body.rutEnvia || body.rut,
        environment: body.environment || 'CERTIFICACION',
      });
      return reply.code(201).send(newTenant);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/dashboard/users', async (request, reply) => {
    try {
      const body = request.body as {
        name: string;
        email: string;
        rut: string;
        roleKey: FelineRoleKey;
        tenantIds: string[];
      };
      const newUser = felineSandboxStore.createUser(body);
      return reply.code(201).send(newUser);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.put('/api/v1/dashboard/users/:userId', async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      const body = request.body as any;
      const updated = felineSandboxStore.updateUser(userId, body);
      return reply.send(updated);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.delete('/api/v1/dashboard/users/:userId', async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };
      felineSandboxStore.deleteUser(userId);
      return reply.send({ success: true, message: 'Usuario eliminado' });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/dashboard/accounting/entries', async (request, reply) => {
    try {
      const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
      const body = request.body as {
        date?: string;
        reference: string;
        lines: Array<{
          accountCode: string;
          label: string;
          debit: number;
          credit: number;
          partnerRut?: string;
          partnerName?: string;
        }>;
      };
      const entry = felineSandboxStore.createManualJournalEntry({
        tenantId,
        date: body.date || new Date().toISOString().split('T')[0],
        reference: body.reference || 'AJUSTE CONTABLE MANUAL',
        lines: body.lines || [],
      });
      return reply.code(201).send(entry);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/dashboard/certificates/upload', async (request, reply) => {
    try {
      const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
      const body = request.body as {
        pfxBase64?: string;
        passphrase: string;
        rutTitular: string;
        nombreTitular?: string;
      };
      const result = felineSandboxStore.uploadOrGenerateTenantCertificate({
        tenantId,
        ...body,
      });
      return reply.code(201).send(result);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/dashboard/purchases', async (request, reply) => {
    try {
      const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
      const body = request.body as any;
      const doc = felineSandboxStore.registerSupplierPurchaseDoc({
        tenantId,
        partnerId: body.partnerId,
        supplierRut: body.supplierRut,
        supplierName: body.supplierName,
        documentTypeCode: Number(body.documentTypeCode || 33),
        folioProveedor: String(body.folioProveedor),
        invoiceDate: body.invoiceDate || new Date().toISOString().split('T')[0],
        itemName: body.itemName,
        amountNeto: Number(body.amountNeto || 0),
        amountExento: Number(body.amountExento || 0),
        tipoCompraSii: body.tipoCompraSii || 'DEL_GIRO',
      });
      return reply.code(201).send(doc);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/dashboard/moves', async (request, reply) => {
    try {
      const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
      const body = request.body as any;
      const move = felineSandboxStore.createDraftMove({
        tenantId,
        partnerId: body.partnerId,
        documentTypeCode: body.documentTypeCode,
        moveType: body.moveType || 'OUT_INVOICE',
        invoiceDate: body.invoiceDate || new Date().toISOString().split('T')[0],
        formaPagoSii: body.formaPagoSii || 1,
        lines: body.lines || [],
        references: body.references,
      });
      return reply.code(201).send(move);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/dashboard/moves/:moveId/post', async (request, reply) => {
    try {
      const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
      const { moveId } = request.params as { moveId: string };
      const posted = felineSandboxStore.postMoveAndSignDte(tenantId, moveId);
      return reply.send(posted);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/dashboard/moves/:moveId/reverse', async (request, reply) => {
    try {
      const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
      const { moveId } = request.params as { moveId: string };
      const body = request.body as { referenceDocCode: 1 | 2 | 3; reason: string };
      const nc = felineSandboxStore.reverseMoveWithCreditNote({
        tenantId,
        originMoveId: moveId,
        referenceDocCode: body.referenceDocCode,
        reason: body.reason,
      });
      return reply.code(201).send(nc);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/dashboard/moves/:moveId/payment', async (request, reply) => {
    try {
      const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
      const { moveId } = request.params as { moveId: string };
      const body = request.body as { amount: number };
      const updated = felineSandboxStore.registerPayment({
        tenantId,
        moveId,
        amount: body.amount,
      });
      return reply.send(updated);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/dashboard/sii/send-batch', async (request, reply) => {
    try {
      const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
      const lote = await felineSandboxStore.sendBatchToSii(tenantId);
      return reply.send(lote);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/dashboard/cafs/generate', async (request, reply) => {
    try {
      const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
      const tenant = felineSandboxStore.tenants.find((t) => t.id === tenantId);
      if (!tenant) throw new Error('Tenant no encontrado');
      const raw = request.body as { tipoDte: unknown; desde: unknown; hasta: unknown };
      const body = { tipoDte: Number(raw.tipoDte) as CodigoTipoDTE, desde: Number(raw.desde), hasta: Number(raw.hasta) };
      felineSandboxStore.validarRangoCaf(tenantId, body.tipoDte, body.desde, body.hasta);
      const { xmlAutorizacion, publicKeyPem } = FelineLiveSandboxStore.generateCafXml({
        rutEmisor: tenant.rut,
        razonSocial: tenant.razonSocial,
        tipoDte: body.tipoDte,
        desde: body.desde,
        hasta: body.hasta,
      });
      const docCatalog = ODOO_L10N_CL_DOCUMENT_TYPES.find((d) => d.code === body.tipoDte);
      felineSandboxStore.cafs = felineSandboxStore.cafs.filter(
        (c) => !(c.tenantId === tenantId && c.tipoDte === body.tipoDte)
      );
      const newCaf = {
        id: `caf-${tenantId}-${body.tipoDte}-${Date.now()}`,
        tenantId,
        tipoDte: body.tipoDte,
        nombreTipo: docCatalog?.name ?? `DTE ${body.tipoDte}`,
        folioDesde: body.desde,
        folioHasta: body.hasta,
        folioActual: body.desde - 1,
        fechaAutorizacion: new Date().toISOString().split('T')[0],
        xmlAutorizacion,
        publicKeyPem,
        agotado: false,
      };
      felineSandboxStore.cafs.push(newCaf);
      return reply.code(201).send(newCaf);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // MÓDULO ODOO 18 HR_EXPENSE (GASTOS Y RENDICIONES DE EMPLEADOS)
  // --------------------------------------------------------------------------
  app.post('/api/v1/dashboard/expenses', async (request, reply) => {
    try {
      const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
      const body = request.body as any;
      const expense = felineSandboxStore.createExpense({
        tenantId,
        employeeId: body.employeeId || 'usr-default',
        employeeName: body.employeeName || 'Empleado',
        employeeRut: body.employeeRut || '11111111-1',
        date: body.date || new Date().toISOString().split('T')[0],
        name: body.name,
        category: body.category || 'OTROS',
        paymentMode: body.paymentMode || 'own_account',
        voucherType: body.voucherType || 'BOLETA_39',
        voucherNumber: body.voucherNumber,
        vendorRut: body.vendorRut,
        vendorName: body.vendorName,
        totalAmount: Number(body.totalAmount || 0),
        hasIvaCredit: Boolean(body.hasIvaCredit),
        notes: body.notes,
        receiptFileName: body.receiptFileName,
      });
      return reply.code(201).send(expense);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/dashboard/expense-sheets', async (request, reply) => {
    try {
      const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
      const body = request.body as any;
      const result = felineSandboxStore.createExpenseSheet({
        tenantId,
        name: body.name,
        employeeId: body.employeeId || 'usr-default',
        employeeName: body.employeeName || 'Empleado',
        employeeRut: body.employeeRut || '11111111-1',
        expenseIds: body.expenseIds || [],
        autoSubmit: Boolean(body.autoSubmit),
      });
      return reply.code(201).send(result);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/dashboard/expense-sheets/:sheetId/submit', async (request, reply) => {
    try {
      const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
      const { sheetId } = request.params as { sheetId: string };
      const sheet = felineSandboxStore.submitExpenseSheet(tenantId, sheetId);
      return reply.send({ success: true, sheet });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/dashboard/expense-sheets/:sheetId/approve', async (request, reply) => {
    try {
      const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
      const { sheetId } = request.params as { sheetId: string };
      const body = (request.body as any) || {};
      const sheet = felineSandboxStore.approveExpenseSheet(tenantId, sheetId, body.approvedBy);
      return reply.send({ success: true, sheet });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/dashboard/expense-sheets/:sheetId/post', async (request, reply) => {
    try {
      const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
      const { sheetId } = request.params as { sheetId: string };
      const entry = felineSandboxStore.postExpenseSheet(tenantId, sheetId);
      return reply.send({ success: true, entry });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/dashboard/expense-sheets/:sheetId/pay', async (request, reply) => {
    try {
      const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
      const { sheetId } = request.params as { sheetId: string };
      const payment = felineSandboxStore.payExpenseSheet(tenantId, sheetId);
      return reply.send({ success: true, payment });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/dashboard/expense-sheets/:sheetId/refuse', async (request, reply) => {
    try {
      const tenantId = String(request.headers['x-tenant-id'] || 'tenant-feline-tech-01');
      const { sheetId } = request.params as { sheetId: string };
      const body = (request.body as any) || {};
      const sheet = felineSandboxStore.refuseExpenseSheet(tenantId, sheetId, body.reason || 'Sin motivo');
      return reply.send({ success: true, sheet });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // ENDPOINTS CON PERSISTENCIA PRISMA POSTGRESQL (PRODUCCIÓN)
  // --------------------------------------------------------------------------
  const createTenantSchema = z.object({
    rut: z.string(),
    razonSocial: z.string().min(2).max(100),
    giro: z.string().min(2).max(80),
    acteco: z.array(z.number().int()).min(1).max(4),
    taxpayerType: z
      .enum(['VAT_AFFECTED_1ST_CAT', 'FEES_RECEIPT_ISSUER', 'END_CONSUMER', 'FOREIGNER'])
      .default('VAT_AFFECTED_1ST_CAT'),
    direccionOrigen: z.string().max(70),
    comunaOrigen: z.string().max(20),
    ciudadOrigen: z.string().max(20),
    fchResol: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    nroResol: z.number().int().min(0),
    rutEnvia: z.string(),
    environment: z.enum(['CERTIFICACION', 'PRODUCCION']).default('CERTIFICACION'),
  });

  app.post('/api/v1/tenants', async (request, reply) => {
    // Operación de administración: exige `Authorization: Bearer <FELINE_ADMIN_TOKEN>`
    const tokenAdmin = process.env.FELINE_ADMIN_TOKEN;
    if (!tokenAdmin) {
      return reply.code(503).send({ error: 'Alta de empresas por API deshabilitada: falta FELINE_ADMIN_TOKEN (usa npm run admin).' });
    }
    if (!tokenAdminValido(request.headers.authorization, tokenAdmin)) {
      return reply.code(401).send({ error: 'Token de administrador inválido' });
    }
    const body = createTenantSchema.parse(request.body);
    const tenant = await prismaBase.tenant.create({
      data: {
        rut: normalizeAndValidateRut(body.rut),
        razonSocial: body.razonSocial,
        giro: body.giro,
        acteco: body.acteco,
        taxpayerType: body.taxpayerType,
        direccionOrigen: body.direccionOrigen,
        comunaOrigen: body.comunaOrigen,
        ciudadOrigen: body.ciudadOrigen,
        fchResol: new Date(body.fchResol),
        nroResol: body.nroResol,
        rutEnvia: normalizeAndValidateRut(body.rutEnvia),
        environment: body.environment,
      },
    });

    const odooInit = await odooMoveService.initializeOdooLocalizationForTenant(tenant.id);
    return reply.code(201).send({ tenant, odooDefaults: odooInit });
  });

  app.get('/api/v1/odoo/document-types', async () => {
    return ODOO_L10N_CL_DOCUMENT_TYPES;
  });

  return app;
}

if (require.main === module) {
  const server = buildFastifyApp();
  const port = puerto();
  if (process.env.FELINE_DISPATCHER !== 'off') {
    server.dteDispatcher.start();
    server.log.info(`Despachador SII activo (modo ${process.env.FELINE_SII_MODO === 'simulado' ? 'SIMULADO' : 'real'})`);
  }
  server.listen({ port, host: '0.0.0.0' }).catch((err) => {
    server.log.error(err);
    process.exit(1);
  });
}
