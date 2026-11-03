import crypto from 'node:crypto';
import forge from 'node-forge';
import { CodigoTipoDTE } from '../types/sii-dte.types';
import { UnpackedCertificate, CryptoVaultService } from '../core/crypto-vault';
import { CafTedService } from './caf-ted.service';
import { DteXmlBuilderService } from './dte-xml-builder.service';
import { XmlDsigSignerService } from './xmldsig-signer.service';
import { SiiWebServiceIntegration } from './sii-webservice.service';
import {
  ODOO_L10N_CL_DOCUMENT_TYPES,
  OdooAccountMoveService,
  OdooMoveLineInput,
  OdooMoveType,
  OdooTaxpayerType,
} from './odoo-account-move.service';
import {
  ODOO_CL_CHART_OF_ACCOUNTS,
  OdooAccountingEngineService,
  OdooJournalItem,
} from './odoo-accounting-engine.service';
import {
  HrExpenseRecord,
  HrExpenseSheetRecord,
  OdooHrExpenseService,
} from './odoo-hr-expense.service';
import {
  formatSiiTimestamp,
  normalizeAndValidateRut,
} from '../utils/sii-normative.utils';

// ============================================================================
// FELINE IN-MEMORY MULTI-TENANT SANDBOX & STATE ENGINE
// Permite operar el Dashboard Antd Multipurpose y todas las funciones SII + Odoo
// de forma inmediata y persistente en sesión en el puerto 3004
// ============================================================================

export interface TenantDemoRecord {
  id: string;
  rut: string;
  razonSocial: string;
  giro: string;
  acteco: number[];
  taxpayerType: OdooTaxpayerType;
  direccionOrigen: string;
  comunaOrigen: string;
  ciudadOrigen: string;
  fchResol: string;
  nroResol: number;
  rutEnvia: string;
  environment: 'CERTIFICACION' | 'PRODUCCION';
  certificate: UnpackedCertificate;
}

export type FelineRoleKey = 'ADMIN' | 'ACCOUNTANT' | 'BILLING' | 'VIEWER';

export interface UserRoleProfile {
  key: FelineRoleKey;
  name: string;
  description: string;
  permissions: {
    canIssueInvoices: boolean; // Emisión de Facturas (33, 34, 46)
    canIssueBoletas: boolean;  // Emisión de Boletas (39, 41)
    canRegisterPurchases: boolean; // Registro en Libro de Compras
    canCreateManualEntries: boolean; // Asientos contables manuales
    canManageCertificates: boolean; // Carga de certificados digitales
    canManageCaf: boolean; // Carga de CAF y administración de folios
    canTransmitSii: boolean; // Transmisión de lotes EnvioDTE
    canManageTenants: boolean; // Crear y editar empresas
    canManageUsers: boolean; // Crear y administrar usuarios y permisos
  };
}

export const FELINE_ROLE_PROFILES: UserRoleProfile[] = [
  {
    key: 'ADMIN',
    name: 'Administrador General',
    description: 'Acceso total: gestión de empresas, usuarios, certificados, folios y emisión.',
    permissions: {
      canIssueInvoices: true,
      canIssueBoletas: true,
      canRegisterPurchases: true,
      canCreateManualEntries: true,
      canManageCertificates: true,
      canManageCaf: true,
      canTransmitSii: true,
      canManageTenants: true,
      canManageUsers: true,
    },
  },
  {
    key: 'ACCOUNTANT',
    name: 'Contador / Auditor',
    description: 'Gestión contable completa, RCV, F29, Balance de 8 Columnas y compras.',
    permissions: {
      canIssueInvoices: true,
      canIssueBoletas: true,
      canRegisterPurchases: true,
      canCreateManualEntries: true,
      canManageCertificates: false,
      canManageCaf: false,
      canTransmitSii: true,
      canManageTenants: false,
      canManageUsers: false,
    },
  },
  {
    key: 'BILLING',
    name: 'Operador de Facturación y Ventas',
    description: 'Emisión rápida de Facturas y Boletas Electrónicas ante el SII.',
    permissions: {
      canIssueInvoices: true,
      canIssueBoletas: true,
      canRegisterPurchases: false,
      canCreateManualEntries: false,
      canManageCertificates: false,
      canManageCaf: false,
      canTransmitSii: false,
      canManageTenants: false,
      canManageUsers: false,
    },
  },
  {
    key: 'VIEWER',
    name: 'Solo Lectura / Consulta',
    description: 'Acceso de visualización para reportería, trazabilidad y descargas XML.',
    permissions: {
      canIssueInvoices: false,
      canIssueBoletas: false,
      canRegisterPurchases: false,
      canCreateManualEntries: false,
      canManageCertificates: false,
      canManageCaf: false,
      canTransmitSii: false,
      canManageTenants: false,
      canManageUsers: false,
    },
  },
];

export interface UserDemoRecord {
  id: string;
  name: string;
  email: string;
  rut: string;
  roleKey: FelineRoleKey;
  tenantIds: string[]; // Empresas a las que tiene acceso el usuario
  isActive: boolean;
  createdAt: string;
}

export interface PartnerDemoRecord {
  id: string;
  tenantId: string;
  rut: string;
  razonSocial: string;
  giro: string;
  taxpayerType: OdooTaxpayerType;
  countryCode: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  correoDte: string;
}

export interface CafDemoRecord {
  id: string;
  tenantId: string;
  tipoDte: CodigoTipoDTE;
  nombreTipo: string;
  folioDesde: number;
  folioHasta: number;
  folioActual: number;
  fechaAutorizacion: string;
  xmlAutorizacion: string;
  publicKeyPem: string;
  agotado: boolean;
}

export interface MoveDemoRecord {
  id: string;
  tenantId: string;
  journalCode: string;
  partnerId: string;
  partnerRut: string;
  partnerName: string;
  documentTypeCode: CodigoTipoDTE;
  documentTypeName: string;
  name: string; // "/" en DRAFT, "FAC 000001" en POSTED
  l10nLatamDocumentNumber: string | null;
  moveType: OdooMoveType;
  state: 'DRAFT' | 'POSTED' | 'CANCEL';
  paymentState: 'NOT_PAID' | 'PARTIAL' | 'PAID' | 'REVERSED';
  invoiceDate: string;
  formaPagoSii: 1 | 2 | 3;
  amountUntaxed: number;
  amountExempt: number;
  amountTax: number;
  amountTotal: number;
  amountResidual: number;
  lines: Array<{
    sequence: number;
    productCode?: string;
    name: string;
    quantity: number;
    uomName: string;
    priceUnit: number;
    discountPct: number;
    isExempt: boolean;
    priceSubtotal: number;
    priceTotal: number;
  }>;
  references: Array<{
    sequence: number;
    originDocTypeCode: string;
    originDocNumber: string;
    referenceDocCode?: 1 | 2 | 3;
    reason?: string;
    date: string;
  }>;
  dteStatus: 'PENDIENTE' | 'FIRMADO' | 'ENVIADO' | 'ACEPTADO' | 'ANULADO';
  tipoCompraSii?: 'DEL_GIRO' | 'SUPERMERCADO' | 'ACTIVO_FIJO' | 'IVA_NO_RECUPERABLE';
  trackId?: string;
  tedXml?: string;
  dteXmlFirmado?: string;
  envioDteXml?: string;
  signatureVerification?: {
    validDigest: boolean;
    validSignature: boolean;
  };
  createdAt: string;
}

export class FelineLiveSandboxStore {
  public tenants: TenantDemoRecord[] = [];
  public users: UserDemoRecord[] = [];
  public partners: PartnerDemoRecord[] = [];
  public cafs: CafDemoRecord[] = [];
  public moves: MoveDemoRecord[] = [];
  public journalItems: OdooJournalItem[] = [];
  public expenses: HrExpenseRecord[] = [];
  public expenseSheets: HrExpenseSheetRecord[] = [];
  public hrExpenseService = new OdooHrExpenseService();
  private reconciliationSeq = 1;
  private manualEntrySeq = 1;
  public lotesEnviados: Array<{
    id: string;
    tenantId: string;
    trackId: string;
    estadoSii: string;
    glosaSii: string;
    cantidadDtes: number;
    xmlEnvio: string;
    createdAt: string;
  }> = [];

  constructor() {
    this.seedInitialMultitenantData();
  }

  private static generateSelfSignedPkcs12(commonName: string, rutTitular: string): UnpackedCertificate {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date(Date.now() - 86400000);
    cert.validity.notAfter = new Date(Date.now() + 365 * 86400000);

    const attrs = [
      { name: 'commonName', value: commonName },
      { name: 'countryName', value: 'CL' },
      { name: 'serialNumber', value: rutTitular },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'feline2026', {
      algorithm: '3des',
    });
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    return CryptoVaultService.unpackPkcs12(Buffer.from(p12Der, 'binary'), 'feline2026');
  }

  public static generateCafXml(params: {
    rutEmisor: string;
    razonSocial: string;
    tipoDte: CodigoTipoDTE;
    desde: number;
    hasta: number;
  }): { xmlAutorizacion: string; publicKeyPem: string } {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 1024,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    });

    const forgePub = forge.pki.publicKeyFromPem(publicKey);
    const modHex = forgePub.n.toString(16);
    const expHex = forgePub.e.toString(16);
    const modB64 = Buffer.from(modHex.length % 2 ? '0' + modHex : modHex, 'hex').toString('base64');
    const expB64 = Buffer.from(expHex.length % 2 ? '0' + expHex : expHex, 'hex').toString('base64');

    const xmlAutorizacion = `<AUTORIZACION>
<CAF version="1.0"><DA><RE>${params.rutEmisor}</RE><RS>${params.razonSocial}</RS><TD>${params.tipoDte}</TD><RNG><D>${params.desde}</D><H>${params.hasta}</H></RNG><FA>2026-10-01</FA><RSAPK><M>${modB64}</M><E>${expB64}</E></RSAPK><IDK>100</IDK></DA><FRMA algoritmo="SHA1withRSA">FirmaSiiAutorizacionFoliosFeline2026==</FRMA></CAF>
<RSASK>${privateKey}</RSASK>
</AUTORIZACION>`;

    return { xmlAutorizacion, publicKeyPem: publicKey };
  }

  private seedInitialMultitenantData() {
    // 1. Crear 2 Empresas Emisoras (Tenants) con sus Certificados Digitales X.509 aislados
    const tenant1: TenantDemoRecord = {
      id: 'tenant-feline-tech-01',
      rut: '76123456-0',
      razonSocial: 'FELINE CLOUD TECHNOLOGIES SPA',
      giro: 'DESARROLLO DE SOFTWARE TRIBUTARIO Y CONSULTORIA ERP',
      acteco: [620100, 620200],
      taxpayerType: 'VAT_AFFECTED_1ST_CAT',
      direccionOrigen: 'AV. APOQUINDO 4501 PISO 14',
      comunaOrigen: 'LAS CONDES',
      ciudadOrigen: 'SANTIAGO',
      fchResol: '2026-01-15',
      nroResol: 80,
      rutEnvia: '15342545-0',
      environment: 'CERTIFICACION',
      certificate: FelineLiveSandboxStore.generateSelfSignedPkcs12(
        'ANGEL BECER - REP LEGAL FELINE SPA',
        '15342545-0'
      ),
    };

    const tenant2: TenantDemoRecord = {
      id: 'tenant-andina-agro-02',
      rut: '77654321-7',
      razonSocial: 'EXPORTADORA Y COMERCIALIZADORA ANDINA ÑUBLE LTDA',
      giro: 'COMERCIALIZACION DE INSUMOS INDUSTRIALES Y LOGISTICA',
      acteco: [469000, 492300],
      taxpayerType: 'VAT_AFFECTED_1ST_CAT',
      direccionOrigen: 'CAMINO LONGITUDINAL SUR KM 12',
      comunaOrigen: 'CHILLAN',
      ciudadOrigen: 'CHILLAN',
      fchResol: '2026-03-10',
      nroResol: 0,
      rutEnvia: '11111111-1',
      environment: 'CERTIFICACION',
      certificate: FelineLiveSandboxStore.generateSelfSignedPkcs12(
        'CARLOS SOTO - REP LEGAL ANDINA LTDA',
        '11111111-1'
      ),
    };
    this.tenants.push(tenant1, tenant2);

    // 1.B Usuarios y Perfiles de Acceso Multiempresa
    this.users.push(
      {
        id: 'user-admin-01',
        name: 'Ángel Becer',
        email: 'angel.becer.p@gmail.com',
        rut: '15342545-0',
        roleKey: 'ADMIN',
        tenantIds: [tenant1.id, tenant2.id],
        isActive: true,
        createdAt: '2026-10-01T08:00:00Z',
      },
      {
        id: 'user-contador-02',
        name: 'Patricia Morales (Auditora F29)',
        email: 'patricia.contabilidad@feline.cl',
        rut: '16890123-4',
        roleKey: 'ACCOUNTANT',
        tenantIds: [tenant1.id],
        isActive: true,
        createdAt: '2026-10-05T09:30:00Z',
      },
      {
        id: 'user-facturador-03',
        name: 'Matías González (Ventas Mostrador)',
        email: 'matias.ventas@andina.cl',
        rut: '18456789-2',
        roleKey: 'BILLING',
        tenantIds: [tenant2.id],
        isActive: true,
        createdAt: '2026-10-10T11:00:00Z',
      }
    );

    // 2. Crear Clientes / Receptores por cada Tenant
    this.partners.push(
      {
        id: 'partner-cencosud-01',
        tenantId: tenant1.id,
        rut: '96571220-8',
        razonSocial: 'CENCOSUD RETAIL S.A.',
        giro: 'GRANDES TIENDAS Y SUPERMERCADOS',
        taxpayerType: 'VAT_AFFECTED_1ST_CAT',
        countryCode: 'CL',
        direccion: 'AV. KENNEDY 9001',
        comuna: 'LAS CONDES',
        ciudad: 'SANTIAGO',
        correoDte: 'dte@cencosud.cl',
      },
      {
        id: 'partner-codelco-02',
        tenantId: tenant1.id,
        rut: '61704000-K',
        razonSocial: 'CORPORACION NACIONAL DEL COBRE DE CHILE',
        giro: 'EXTRACCION Y PROCESAMIENTO DE COBRE',
        taxpayerType: 'VAT_AFFECTED_1ST_CAT',
        countryCode: 'CL',
        direccion: 'HUERFANOS 1270',
        comuna: 'SANTIAGO',
        ciudad: 'SANTIAGO',
        correoDte: 'recepcion.dte@codelco.cl',
      },
      {
        id: 'partner-consumidor-03',
        tenantId: tenant1.id,
        rut: '66666666-6',
        razonSocial: 'CONSUMIDOR FINAL BOLETA ELECTRONICA',
        giro: 'PARTICULAR',
        taxpayerType: 'END_CONSUMER',
        countryCode: 'CL',
        direccion: 'SANTIAGO CENTRO',
        comuna: 'SANTIAGO',
        ciudad: 'SANTIAGO',
        correoDte: 'cliente@correo.cl',
      },
      {
        id: 'partner-agrosuper-04',
        tenantId: tenant2.id,
        rut: '60803000-K',
        razonSocial: 'DISTRIBUIDORA SUR AUSTRAL S.A.',
        giro: 'DISTRIBUCION MAYORISTA DE ALIMENTOS',
        taxpayerType: 'VAT_AFFECTED_1ST_CAT',
        countryCode: 'CL',
        direccion: 'AV. O HIGGINS 890',
        comuna: 'CONCEPCION',
        ciudad: 'CONCEPCION',
        correoDte: 'intercambio@suraustral.cl',
      },
      // Proveedores para el Libro de Compras (RCV Compras)
      {
        id: 'partner-entel-prov-05',
        tenantId: tenant1.id,
        rut: '92580000-7',
        razonSocial: 'ENTEL PCS TELECOMUNICACIONES S.A.',
        giro: 'SERVICIOS DE TELECOMUNICACIONES Y DATACENTER',
        taxpayerType: 'VAT_AFFECTED_1ST_CAT',
        countryCode: 'CL',
        direccion: 'AV. COSTANERA SUR 2760',
        comuna: 'LAS CONDES',
        ciudad: 'SANTIAGO',
        correoDte: 'facturacion@entel.cl',
      },
      {
        id: 'partner-aws-prov-06',
        tenantId: tenant1.id,
        rut: '59234560-9',
        razonSocial: 'AMAZON WEB SERVICES CHILE SPA',
        giro: 'PROCESAMIENTO DE DATOS Y HOSTING CLOUD',
        taxpayerType: 'VAT_AFFECTED_1ST_CAT',
        countryCode: 'CL',
        direccion: 'AV. VITACURA 2939',
        comuna: 'LAS CONDES',
        ciudad: 'SANTIAGO',
        correoDte: 'dte-cl@amazon.com',
      }
    );

    // 3. Crear Folios CAF para ambos Tenants (Tipo 33, 34, 39, 46, 56, 61)
    const tiposIniciales: Array<{ tipo: CodigoTipoDTE; desde: number; hasta: number }> = [
      { tipo: CodigoTipoDTE.FacturaElectronica, desde: 1, hasta: 100 },
      { tipo: CodigoTipoDTE.FacturaNoAfectaOExenta, desde: 1, hasta: 50 },
      { tipo: CodigoTipoDTE.BoletaElectronica, desde: 1, hasta: 500 },
      { tipo: CodigoTipoDTE.FacturaCompraElectronica, desde: 1, hasta: 50 },
      { tipo: CodigoTipoDTE.NotaDebitoElectronica, desde: 1, hasta: 50 },
      { tipo: CodigoTipoDTE.NotaCreditoElectronica, desde: 1, hasta: 50 },
    ];

    for (const t of this.tenants) {
      for (const cfg of tiposIniciales) {
        const { xmlAutorizacion, publicKeyPem } = FelineLiveSandboxStore.generateCafXml({
          rutEmisor: t.rut,
          razonSocial: t.razonSocial,
          tipoDte: cfg.tipo,
          desde: cfg.desde,
          hasta: cfg.hasta,
        });
        const docCatalog = ODOO_L10N_CL_DOCUMENT_TYPES.find((d) => d.code === cfg.tipo);
        this.cafs.push({
          id: `caf-${t.id}-${cfg.tipo}`,
          tenantId: t.id,
          tipoDte: cfg.tipo,
          nombreTipo: docCatalog?.name ?? `DTE ${cfg.tipo}`,
          folioDesde: cfg.desde,
          folioHasta: cfg.hasta,
          folioActual: cfg.desde - 1,
          fechaAutorizacion: '2026-10-01',
          xmlAutorizacion,
          publicKeyPem,
          agotado: false,
        });
      }
    }

    // 3.B Asientos de Apertura Contable (Capital Social Inicial y Caja/Banco) para ambos Tenants
    this.createManualJournalEntry({
      tenantId: tenant1.id,
      date: '2026-10-01',
      reference: 'APERTURA EJERCICIO 2026 - CAPITAL SOCIAL FELINE SPA',
      lines: [
        {
          accountCode: '110110',
          label: 'Aporte Inicial Caja y Banco Moneda Nacional',
          debit: 25000000,
          credit: 0,
        },
        {
          accountCode: '121120',
          label: 'Servidores HSM y Cluster Producción SII',
          debit: 5000000,
          credit: 0,
        },
        {
          accountCode: '310110',
          label: 'Capital Social Suscrito y Pagado Feline SpA',
          debit: 0,
          credit: 30000000,
        },
      ],
    });

    this.createManualJournalEntry({
      tenantId: tenant2.id,
      date: '2026-10-01',
      reference: 'APERTURA EJERCICIO 2026 - CAPITAL SOCIAL ANDINA LTDA',
      lines: [
        {
          accountCode: '110110',
          label: 'Saldo Inicial Banco Estado Cuenta Corriente',
          debit: 15000000,
          credit: 0,
        },
        {
          accountCode: '310110',
          label: 'Capital Social Pagado Andina Ñuble Ltda',
          debit: 0,
          credit: 15000000,
        },
      ],
    });

    // 4. Emitir y firmar DTEs iniciales reales para poblar el Libro de Ventas y el Libro Diario
    const m1 = this.createDraftMove({
      tenantId: tenant1.id,
      partnerId: 'partner-cencosud-01',
      documentTypeCode: CodigoTipoDTE.FacturaElectronica,
      moveType: 'OUT_INVOICE',
      invoiceDate: '2026-10-18',
      formaPagoSii: 2,
      lines: [
        {
          productCode: 'FEL-ENT-01',
          name: 'SUSCRIPCIÓN ANUAL FELINE ERP MULTIEMPRESA SII DTE',
          quantity: 1,
          uomName: 'UN',
          priceUnit: 1850000,
          discountPct: 0,
        },
        {
          productCode: 'FEL-INT-02',
          name: 'INTEGRACIÓN API ODOO L10N_CL Y CONECTOR SOAP MAULLIN/PALENA',
          quantity: 2,
          uomName: 'HRS',
          priceUnit: 320000,
          discountPct: 0,
        },
      ],
    });
    this.postMoveAndSignDte(tenant1.id, m1.id);

    const m2 = this.createDraftMove({
      tenantId: tenant1.id,
      partnerId: 'partner-codelco-02',
      documentTypeCode: CodigoTipoDTE.FacturaElectronica,
      moveType: 'OUT_INVOICE',
      invoiceDate: '2026-10-18',
      formaPagoSii: 1,
      lines: [
        {
          productCode: 'AUD-REA-99',
          name: 'AUDITORÍA CRIPTOGRÁFICA XMLDSIG Y CUSTODIA HSM PKCS#12',
          quantity: 1,
          uomName: 'SERV',
          priceUnit: 950000,
        },
      ],
    });
    this.postMoveAndSignDte(tenant1.id, m2.id);

    // Registrar el cobro bancario de la factura de Codelco (m2) para demostrar conciliación automática A001
    this.registerPayment({
      tenantId: tenant1.id,
      moveId: m2.id,
      amount: m2.amountTotal,
    });

    // 5. Registrar Facturas de Proveedor recibidas para poblar el Libro de Compras (RCV Compras) y Contabilidad
    this.registerSupplierPurchaseDoc({
      tenantId: tenant1.id,
      partnerId: 'partner-entel-prov-05',
      documentTypeCode: CodigoTipoDTE.FacturaElectronica,
      folioProveedor: '884512',
      invoiceDate: '2026-10-12',
      itemName: 'ENLACE FIBRA DEDICADA Y SERVIDORES CLOUD SII',
      amountNeto: 680000,
      amountExento: 0,
      tipoCompraSii: 'DEL_GIRO',
    });

    this.registerSupplierPurchaseDoc({
      tenantId: tenant1.id,
      partnerId: 'partner-aws-prov-06',
      documentTypeCode: CodigoTipoDTE.FacturaElectronica,
      folioProveedor: '104920',
      invoiceDate: '2026-10-15',
      itemName: 'INFRAESTRUCTURA KUBERNETES Y RDS POSTGRESQL MULTI-AZ',
      amountNeto: 1120000,
      amountExento: 0,
      tipoCompraSii: 'DEL_GIRO',
    });

    // Crear también 1 factura en estado DRAFT ("/") para demostrar el botón "Publicar y Firmar DTE" en vivo
    this.createDraftMove({
      tenantId: tenant1.id,
      partnerId: 'partner-cencosud-01',
      documentTypeCode: CodigoTipoDTE.FacturaElectronica,
      moveType: 'OUT_INVOICE',
      invoiceDate: '2026-10-18',
      formaPagoSii: 1,
      lines: [
        {
          productCode: 'MOD-BOL-39',
          name: 'HABILITACIÓN BOLETA ELECTRÓNICA REST API PANGAL/RAHUE',
          quantity: 1,
          uomName: 'UN',
          priceUnit: 480000,
        },
      ],
    });

    // Y una factura emitida en el Tenant 2 para demostrar aislamiento Multitenant
    const mTenant2 = this.createDraftMove({
      tenantId: tenant2.id,
      partnerId: 'partner-agrosuper-04',
      documentTypeCode: CodigoTipoDTE.FacturaElectronica,
      moveType: 'OUT_INVOICE',
      invoiceDate: '2026-10-18',
      formaPagoSii: 1,
      lines: [
        {
          productCode: 'INS-001',
          name: 'DESPACHO INSUMOS AGRÍCOLAS REGIÓN DE ÑUBLE',
          quantity: 10,
          uomName: 'TON',
          priceUnit: 145000,
        },
      ],
    });
    this.postMoveAndSignDte(tenant2.id, mTenant2.id);

    // 6. Poblar Gastos y Rendiciones de Empleados (Odoo hr_expense)
    const emp1 = this.users[0] || { id: 'usr-admin-01', name: 'RODRIGO VALENZUELA MUÑOZ', rut: '16892341-2' };
    const exp1 = this.createExpense({
      tenantId: tenant1.id,
      employeeId: emp1.id,
      employeeName: emp1.name,
      employeeRut: emp1.rut,
      date: '2026-10-14',
      name: 'Almuerzo de trabajo con Directores de Retail',
      category: 'ALIMENTACION',
      paymentMode: 'own_account',
      voucherType: 'FACTURA_33',
      voucherNumber: '44812',
      vendorRut: '76192834-5',
      vendorName: 'RESTAURANTE PUERTO MARISCOS SPA',
      totalAmount: 48500,
      hasIvaCredit: true,
      notes: 'Reunión de coordinación despliegue Boleta Electrónica',
    });

    const exp2 = this.createExpense({
      tenantId: tenant1.id,
      employeeId: emp1.id,
      employeeName: emp1.name,
      employeeRut: emp1.rut,
      date: '2026-10-15',
      name: 'Radiotaxi Aeropuerto Pudahuel - Oficina Central',
      category: 'TRANSPORTE',
      paymentMode: 'own_account',
      voucherType: 'BOLETA_39',
      voucherNumber: '109283',
      vendorRut: '77341290-1',
      vendorName: 'RADIOTAXI OFICIAL AEROPUERTO LTDA',
      totalAmount: 26000,
      notes: 'Traslado retorno visita técnica a clientes en Concepción',
    });

    this.createExpense({
      tenantId: tenant1.id,
      employeeId: emp1.id,
      employeeName: emp1.name,
      employeeRut: emp1.rut,
      date: '2026-10-16',
      name: 'Suscripción Cloud Desarrollo GitHub Enterprise',
      category: 'SOFTWARE',
      paymentMode: 'company_account',
      voucherType: 'FACTURA_33',
      voucherNumber: '88301',
      vendorRut: '59123450-8',
      vendorName: 'GITHUB SOFTWARE CLOUD SPA',
      totalAmount: 65000,
      hasIvaCredit: true,
      notes: 'Pagado con Tarjeta de Crédito Corporativa Santander',
    });

    this.createExpense({
      tenantId: tenant1.id,
      employeeId: emp1.id,
      employeeName: emp1.name,
      employeeRut: emp1.rut,
      date: '2026-10-17',
      name: 'Insumos de oficina y archivadores para DTEs',
      category: 'INSUMOS',
      paymentMode: 'own_account',
      voucherType: 'BOLETA_39',
      voucherNumber: '67123',
      vendorRut: '76891234-4',
      vendorName: 'LIBRERIA Y PAPELERIA NACIONAL S.A.',
      totalAmount: 18900,
      notes: 'Archivadores para respaldos físicos SII',
    });

    // Crear 1 Rendición (Informe) agrupando exp1 y exp2
    const sheetResult = this.createExpenseSheet({
      tenantId: tenant1.id,
      name: 'Rendición de Gastos Viaje y Visita a Clientes Retail',
      employeeId: emp1.id,
      employeeName: emp1.name,
      employeeRut: emp1.rut,
      expenseIds: [exp1.id, exp2.id],
      autoSubmit: true,
    });
    // Aprobar la rendición para que quede lista para contabilizar (post) o pagar
    this.approveExpenseSheet(tenant1.id, sheetResult.sheet.id, 'Gerencia de Finanzas');
  }

  /**
   * Crea una nueva Empresa Emisora (Tenant) con su certificado digital inicial y folios CAF
   */
  public createTenant(params: {
    rut: string;
    razonSocial: string;
    giro: string;
    acteco: number[];
    taxpayerType?: OdooTaxpayerType;
    direccionOrigen: string;
    comunaOrigen: string;
    ciudadOrigen: string;
    fchResol?: string;
    nroResol?: number;
    rutEnvia: string;
    environment?: 'CERTIFICACION' | 'PRODUCCION';
  }): TenantDemoRecord {
    const cleanRut = normalizeAndValidateRut(params.rut);
    const existing = this.tenants.find((t) => t.rut === cleanRut);
    if (existing) {
      throw new Error(`Ya existe una empresa registrada con el RUT ${cleanRut} (${existing.razonSocial}).`);
    }

    const cleanRutEnvia = normalizeAndValidateRut(params.rutEnvia);
    const tenantId = `tenant-${Date.now()}`;
    const cert = FelineLiveSandboxStore.generateSelfSignedPkcs12(
      `${params.razonSocial} - REP LEGAL (${cleanRutEnvia})`,
      cleanRutEnvia
    );

    const newTenant: TenantDemoRecord = {
      id: tenantId,
      rut: cleanRut,
      razonSocial: params.razonSocial.toUpperCase(),
      giro: params.giro.toUpperCase(),
      acteco: params.acteco?.length ? params.acteco : [620100],
      taxpayerType: params.taxpayerType || 'VAT_AFFECTED_1ST_CAT',
      direccionOrigen: params.direccionOrigen.toUpperCase(),
      comunaOrigen: params.comunaOrigen.toUpperCase(),
      ciudadOrigen: params.ciudadOrigen.toUpperCase(),
      fchResol: params.fchResol || new Date().toISOString().split('T')[0],
      nroResol: params.nroResol ?? 80,
      rutEnvia: cleanRutEnvia,
      environment: params.environment || 'CERTIFICACION',
      certificate: cert,
    };

    this.tenants.push(newTenant);

    // Inicializar CAF básicos para Factura 33 y Boleta 39
    const tiposIniciales: Array<{ tipo: CodigoTipoDTE; desde: number; hasta: number }> = [
      { tipo: CodigoTipoDTE.FacturaElectronica, desde: 1, hasta: 100 },
      { tipo: CodigoTipoDTE.BoletaElectronica, desde: 1, hasta: 500 },
      { tipo: CodigoTipoDTE.NotaCreditoElectronica, desde: 1, hasta: 50 },
    ];

    for (const cfg of tiposIniciales) {
      const { xmlAutorizacion, publicKeyPem } = FelineLiveSandboxStore.generateCafXml({
        rutEmisor: newTenant.rut,
        razonSocial: newTenant.razonSocial,
        tipoDte: cfg.tipo,
        desde: cfg.desde,
        hasta: cfg.hasta,
      });
      const docCatalog = ODOO_L10N_CL_DOCUMENT_TYPES.find((d) => d.code === cfg.tipo);
      this.cafs.push({
        id: `caf-${newTenant.id}-${cfg.tipo}`,
        tenantId: newTenant.id,
        tipoDte: cfg.tipo,
        nombreTipo: docCatalog?.name ?? `DTE ${cfg.tipo}`,
        folioDesde: cfg.desde,
        folioHasta: cfg.hasta,
        folioActual: cfg.desde - 1,
        fechaAutorizacion: new Date().toISOString().split('T')[0],
        xmlAutorizacion,
        publicKeyPem,
        agotado: false,
      });
    }

    return newTenant;
  }

  /**
   * Crea un nuevo usuario en la plataforma con perfil de rol y empresas asignadas
   */
  public createUser(params: {
    name: string;
    email: string;
    rut: string;
    roleKey: FelineRoleKey;
    tenantIds: string[];
  }): UserDemoRecord {
    const cleanRut = normalizeAndValidateRut(params.rut);
    const cleanEmail = params.email.trim().toLowerCase();
    const existing = this.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error(`Ya existe un usuario registrado con el correo ${cleanEmail}.`);
    }

    const newUser: UserDemoRecord = {
      id: `user-${Date.now()}`,
      name: params.name.trim(),
      email: cleanEmail,
      rut: cleanRut,
      roleKey: params.roleKey,
      tenantIds: params.tenantIds?.length ? params.tenantIds : [this.tenants[0]?.id],
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    this.users.unshift(newUser);
    return newUser;
  }

  /**
   * Actualiza el perfil, rol o empresas de un usuario
   */
  public updateUser(
    id: string,
    params: Partial<{
      name: string;
      email: string;
      roleKey: FelineRoleKey;
      tenantIds: string[];
      isActive: boolean;
    }>
  ): UserDemoRecord {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new Error('Usuario no encontrado.');

    if (params.name) user.name = params.name.trim();
    if (params.email) user.email = params.email.trim().toLowerCase();
    if (params.roleKey) user.roleKey = params.roleKey;
    if (params.tenantIds) user.tenantIds = params.tenantIds;
    if (typeof params.isActive === 'boolean') user.isActive = params.isActive;

    return user;
  }

  /**
   * Elimina un usuario del sistema
   */
  public deleteUser(id: string): void {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) throw new Error('Usuario no encontrado.');
    this.users.splice(index, 1);
  }

  /**
   * Carga un archivo real .pfx/.p12 (en Base64) o genera un nuevo Certificado Digital PKCS#12
   * para la empresa emisora (`tenantId`), actualizando inmediatamente su firmador XMLDSig.
   */
  public uploadOrGenerateTenantCertificate(params: {
    tenantId: string;
    pfxBase64?: string;
    passphrase: string;
    rutTitular: string;
    nombreTitular?: string;
  }) {
    const tenant = this.tenants.find((t) => t.id === params.tenantId);
    if (!tenant) throw new Error('Empresa emisora no encontrada.');

    const normalizedRutTitular = normalizeAndValidateRut(params.rutTitular);
    let unpacked: UnpackedCertificate;

    if (params.pfxBase64 && params.pfxBase64.trim().length > 0) {
      const pfxBuffer = Buffer.from(params.pfxBase64, 'base64');
      unpacked = CryptoVaultService.unpackPkcs12(pfxBuffer, params.passphrase);
    } else {
      unpacked = FelineLiveSandboxStore.generateSelfSignedPkcs12(
        params.nombreTitular || `TITULAR FIRMA SII (${normalizedRutTitular})`,
        normalizedRutTitular
      );
    }

    tenant.certificate = unpacked;
    tenant.rutEnvia = normalizedRutTitular;

    return {
      tenantId: tenant.id,
      rutTitular: tenant.rutEnvia,
      subjectName: unpacked.subjectName,
      validFrom: unpacked.validFrom,
      validTo: unpacked.validTo,
    };
  }

  /**
   * Registra una Factura de Compra recibida de un proveedor en el Libro de Compras (RCV Compras)
   * como `IN_INVOICE` o `IN_REFUND` en Odoo (`account.move`) y genera sus apuntes de Partida Doble.
   */
  public registerSupplierPurchaseDoc(params: {
    tenantId: string;
    partnerId?: string;
    supplierRut?: string;
    supplierName?: string;
    documentTypeCode: CodigoTipoDTE; // 33, 34, 46, 61
    folioProveedor: string;
    invoiceDate: string;
    itemName: string;
    amountNeto: number;
    amountExento?: number;
    tipoCompraSii?: 'DEL_GIRO' | 'SUPERMERCADO' | 'ACTIVO_FIJO' | 'IVA_NO_RECUPERABLE';
  }): MoveDemoRecord {
    const tenant = this.tenants.find((t) => t.id === params.tenantId);
    if (!tenant) throw new Error('Tenant no encontrado.');

    let partner = params.partnerId
      ? this.partners.find((p) => p.id === params.partnerId && p.tenantId === params.tenantId)
      : undefined;

    if (!partner) {
      const cleanRut = normalizeAndValidateRut(params.supplierRut || '96571220-8');
      partner = this.partners.find((p) => p.rut === cleanRut && p.tenantId === params.tenantId);
      if (!partner) {
        partner = {
          id: `partner-prov-${Date.now()}`,
          tenantId: tenant.id,
          rut: cleanRut,
          razonSocial: (params.supplierName || 'PROVEEDOR NACIONAL S.A.').toUpperCase(),
          giro: 'PROVEEDOR DEL GIRO',
          taxpayerType: 'VAT_AFFECTED_1ST_CAT',
          countryCode: 'CL',
          direccion: 'SANTIAGO',
          comuna: 'SANTIAGO',
          ciudad: 'SANTIAGO',
          correoDte: 'dte@proveedor.cl',
        };
        this.partners.push(partner);
      }
    }

    const folioClean = OdooAccountMoveService.validateNumericFolio(params.folioProveedor);
    const isExenta = params.documentTypeCode === CodigoTipoDTE.FacturaNoAfectaOExenta;
    const neto = isExenta ? 0 : Math.round(params.amountNeto || 0);
    const exento = isExenta
      ? Math.round((params.amountNeto || 0) + (params.amountExento || 0))
      : Math.round(params.amountExento || 0);
    const iva = neto > 0 ? Math.round(neto * 0.19) : 0;
    const total = neto + exento + iva;

    const docMeta = ODOO_L10N_CL_DOCUMENT_TYPES.find((d) => d.code === params.documentTypeCode);
    const moveType: OdooMoveType =
      params.documentTypeCode === CodigoTipoDTE.NotaCreditoElectronica ? 'IN_REFUND' : 'IN_INVOICE';

    const record: MoveDemoRecord = {
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      journalCode: 'BILL',
      partnerId: partner.id,
      partnerRut: partner.rut,
      partnerName: partner.razonSocial,
      documentTypeCode: params.documentTypeCode,
      documentTypeName: `${docMeta?.name ?? 'Factura Proveedor'} [${params.tipoCompraSii ?? 'DEL_GIRO'}]`,
      name: `COMP-${params.documentTypeCode} #${folioClean.padStart(6, '0')}`,
      l10nLatamDocumentNumber: folioClean,
      moveType,
      state: 'POSTED',
      paymentState: 'NOT_PAID',
      invoiceDate: params.invoiceDate,
      formaPagoSii: 2,
      amountUntaxed: neto,
      amountExempt: exento,
      amountTax: iva,
      amountTotal: total,
      amountResidual: total,
      lines: [
        {
          sequence: 1,
          productCode: 'COMPRA-SII',
          name: params.itemName,
          quantity: 1,
          uomName: 'UN',
          priceUnit: neto + exento,
          discountPct: 0,
          isExempt: isExenta,
          priceSubtotal: neto + exento,
          priceTotal: total,
        },
      ],
      references: [],
      dteStatus: 'ACEPTADO', // Acuse de recibo SII en RCV
      tipoCompraSii: params.tipoCompraSii ?? 'DEL_GIRO',
      createdAt: new Date().toISOString(),
    };

    this.moves.unshift(record);

    // Generar automáticamente apuntes contables de Partida Doble (Odoo account.move.line)
    const jItems = OdooAccountingEngineService.generateJournalItemsForInvoiceMove({
      tenantId: tenant.id,
      moveId: record.id,
      moveName: record.name,
      moveType: record.moveType,
      documentTypeCode: record.documentTypeCode,
      date: record.invoiceDate,
      partnerRut: partner.rut,
      partnerName: partner.razonSocial,
      amountUntaxed: record.amountUntaxed,
      amountExempt: record.amountExempt,
      amountTax: record.amountTax,
      amountTotal: record.amountTotal,
      tipoCompraSii: params.tipoCompraSii,
    });
    this.journalItems.unshift(...jItems);

    return record;
  }

  /**
   * Calcula el Registro de Compras y Ventas (RCV SII) y la Propuesta del Formulario 29 (F29)
   * separando por Tipo de DTE (33, 34, 39, 46, 56, 61) y determinando IVA Débito, IVA Crédito
   * e Impuesto Determinado (o Remanente de Crédito Fiscal).
   */
  public getLibroCompraVentaAndF29(tenantId: string, periodoTributario: string = '2026-10') {
    const tenantMoves = this.moves.filter(
      (m) =>
        m.tenantId === tenantId &&
        m.state === 'POSTED' &&
        m.invoiceDate.startsWith(periodoTributario)
    );

    const ventasMoves = tenantMoves.filter(
      (m) => m.moveType === 'OUT_INVOICE' || m.moveType === 'OUT_REFUND'
    );
    const comprasMoves = tenantMoves.filter(
      (m) => m.moveType === 'IN_INVOICE' || m.moveType === 'IN_REFUND'
    );

    const buildResumenPorTipo = (records: MoveDemoRecord[]) => {
      const map = new Map<
        number,
        {
          tipoDte: number;
          nombreTipo: string;
          cantidadDocumentos: number;
          mntExento: number;
          mntNeto: number;
          mntIva: number;
          mntTotal: number;
        }
      >();

      for (const m of records) {
        const cur = map.get(m.documentTypeCode) || {
          tipoDte: m.documentTypeCode,
          nombreTipo:
            ODOO_L10N_CL_DOCUMENT_TYPES.find((d) => d.code === m.documentTypeCode)?.name ||
            `DTE ${m.documentTypeCode}`,
          cantidadDocumentos: 0,
          mntExento: 0,
          mntNeto: 0,
          mntIva: 0,
          mntTotal: 0,
        };
        cur.cantidadDocumentos += 1;
        cur.mntExento += m.amountExempt;
        cur.mntNeto += m.amountUntaxed;
        cur.mntIva += m.amountTax;
        cur.mntTotal += m.amountTotal;
        map.set(m.documentTypeCode, cur);
      }
      return Array.from(map.values()).sort((a, b) => a.tipoDte - b.tipoDte);
    };

    // Cálculo F29:
    // IVA Débito Fiscal = IVA Ventas (33, 39, 56) - IVA Notas de Crédito Emitidas (61)
    let ivaDebitoVentas = 0;
    let ivaDebitoNotasCredito = 0;
    let totalVentasNeto = 0;
    let totalVentasExento = 0;

    for (const v of ventasMoves) {
      if (v.moveType === 'OUT_REFUND' || v.documentTypeCode === 61) {
        ivaDebitoNotasCredito += v.amountTax;
        totalVentasNeto -= v.amountUntaxed;
        totalVentasExento -= v.amountExempt;
      } else {
        ivaDebitoVentas += v.amountTax;
        totalVentasNeto += v.amountUntaxed;
        totalVentasExento += v.amountExempt;
      }
    }
    const ivaDebitoFiscalNeto = Math.max(0, ivaDebitoVentas - ivaDebitoNotasCredito);

    // IVA Crédito Fiscal = IVA Compras (33, 46, 56) - IVA Notas de Crédito Recibidas (61)
    let ivaCreditoCompras = 0;
    let ivaCreditoNotasCredito = 0;
    let ivaNoRecuperable = 0;
    let totalComprasNeto = 0;
    let totalComprasExento = 0;

    for (const c of comprasMoves) {
      if (c.tipoCompraSii === 'IVA_NO_RECUPERABLE') {
        ivaNoRecuperable += c.amountTax;
        totalComprasNeto += c.amountUntaxed;
        totalComprasExento += c.amountExempt;
      } else if (c.moveType === 'IN_REFUND' || c.documentTypeCode === 61) {
        ivaCreditoNotasCredito += c.amountTax;
        totalComprasNeto -= c.amountUntaxed;
        totalComprasExento -= c.amountExempt;
      } else {
        ivaCreditoCompras += c.amountTax;
        totalComprasNeto += c.amountUntaxed;
        totalComprasExento += c.amountExempt;
      }
    }
    const ivaCreditoFiscalNeto = Math.max(0, ivaCreditoCompras - ivaCreditoNotasCredito);

    const diferenciaIva = ivaDebitoFiscalNeto - ivaCreditoFiscalNeto;
    const ivaAPagarF29 = diferenciaIva > 0 ? diferenciaIva : 0;
    const remanenteCreditoFiscal = diferenciaIva < 0 ? Math.abs(diferenciaIva) : 0;

    return {
      periodoTributario,
      resumenVentasPorTipo: buildResumenPorTipo(ventasMoves),
      resumenComprasPorTipo: buildResumenPorTipo(comprasMoves),
      detalleVentas: ventasMoves,
      detalleCompras: comprasMoves,
      f29: {
        codigo538_TotalDebitos: ivaDebitoFiscalNeto,
        codigo511_CreditoRecibidas: ivaCreditoCompras,
        codigo514_NotasCreditoRecibidas: ivaCreditoNotasCredito,
        codigo537_TotalCreditos: ivaCreditoFiscalNeto,
        ivaNoRecuperable,
        codigo089_ImpuestoDeterminadoIva: ivaAPagarF29,
        codigo077_RemanenteCreditoMesSiguiente: remanenteCreditoFiscal,
        totalVentasNeto,
        totalVentasExento,
        totalComprasNeto,
        totalComprasExento,
      },
    };
  }

  public createDraftMove(input: {
    tenantId: string;
    partnerId: string;
    documentTypeCode?: CodigoTipoDTE;
    moveType: OdooMoveType;
    invoiceDate: string;
    formaPagoSii?: 1 | 2 | 3;
    lines: OdooMoveLineInput[];
    references?: Array<{
      originDocTypeCode: string;
      originDocNumber: string;
      referenceDocCode?: 1 | 2 | 3;
      reason?: string;
      date: string;
    }>;
  }): MoveDemoRecord {
    const tenant = this.tenants.find((t) => t.id === input.tenantId);
    if (!tenant) throw new Error(`Tenant ${input.tenantId} no encontrado.`);

    const partner = this.partners.find(
      (p) => p.id === input.partnerId && p.tenantId === input.tenantId
    );
    if (!partner) {
      throw new Error(
        `Violación Multitenant: El cliente/receptor no pertenece a la empresa activa (${tenant.razonSocial}).`
      );
    }

    const allowedDocs = OdooAccountMoveService.getAllowedLatamDocumentTypes({
      journalType: 'SALE',
      moveType: input.moveType,
      companyTaxpayerType: tenant.taxpayerType,
      partnerTaxpayerType: partner.taxpayerType,
      partnerVat: partner.rut,
      partnerCountryCode: partner.countryCode,
    });

    const selectedCode = (input.documentTypeCode ?? allowedDocs[0]?.code ?? 33) as CodigoTipoDTE;
    const isAllowed = allowedDocs.some((d) => d.code === selectedCode);
    if (!isAllowed) {
      throw new Error(
        `[Odoo l10n_cl] El TipoDTE ${selectedCode} no está permitido para el receptor "${partner.razonSocial}" (${partner.taxpayerType}). Permitidos: [${allowedDocs.map((d) => d.code).join(', ')}].`
      );
    }

    const computed = OdooAccountMoveService.computeMoveLinesAndTotals(input.lines, selectedCode);
    const docMeta = ODOO_L10N_CL_DOCUMENT_TYPES.find((d) => d.code === selectedCode);

    const record: MoveDemoRecord = {
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      journalCode: 'INV',
      partnerId: partner.id,
      partnerRut: partner.rut,
      partnerName: partner.razonSocial,
      documentTypeCode: selectedCode,
      documentTypeName: docMeta?.name ?? `DTE ${selectedCode}`,
      name: '/',
      l10nLatamDocumentNumber: null,
      moveType: input.moveType,
      state: 'DRAFT',
      paymentState: 'NOT_PAID',
      invoiceDate: input.invoiceDate,
      formaPagoSii: input.formaPagoSii ?? 1,
      amountUntaxed: computed.amountUntaxed,
      amountExempt: computed.amountExempt,
      amountTax: computed.amountTax,
      amountTotal: computed.amountTotal,
      amountResidual: computed.amountResidual,
      lines: computed.lines.map((l) => ({
        sequence: l.sequence,
        productCode: l.productCode,
        name: l.name,
        quantity: l.quantity,
        uomName: l.uomName ?? 'UN',
        priceUnit: l.priceUnit,
        discountPct: l.discountPct ?? 0,
        isExempt: Boolean(l.isExempt),
        priceSubtotal: l.priceSubtotal,
        priceTotal: l.priceTotal,
      })),
      references: (input.references ?? []).map((r, idx) => ({
        sequence: idx + 1,
        ...r,
      })),
      dteStatus: 'PENDIENTE',
      createdAt: new Date().toISOString(),
    };

    this.moves.unshift(record);
    return record;
  }

  public postMoveAndSignDte(tenantId: string, moveId: string): MoveDemoRecord {
    const tenant = this.tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error('Tenant no encontrado.');

    const move = this.moves.find((m) => m.id === moveId && m.tenantId === tenantId);
    if (!move) throw new Error('Factura no encontrada en el Tenant activo.');
    if (move.state !== 'DRAFT') {
      throw new Error(`El asiento ${move.name} ya fue publicado anteriormente.`);
    }

    const partner = this.partners.find((p) => p.id === move.partnerId && p.tenantId === tenantId)!;

    // 1. Asignar Folio desde el CAF activo del Tenant
    const caf = this.cafs.find(
      (c) => c.tenantId === tenantId && c.tipoDte === move.documentTypeCode && !c.agotado
    );
    if (!caf) {
      throw new Error(
        `No hay CAF disponible para TipoDTE ${move.documentTypeCode} en la empresa ${tenant.razonSocial}.`
      );
    }

    const nextFolio = caf.folioActual + 1;
    if (nextFolio > caf.folioHasta) {
      caf.agotado = true;
      throw new Error(`El rango CAF (${caf.folioDesde}-${caf.folioHasta}) se encuentra agotado.`);
    }
    caf.folioActual = nextFolio;
    if (caf.folioActual >= caf.folioHasta) {
      caf.agotado = true;
    }

    const parsedCaf = CafTedService.parseAutorizacionCafXml(caf.xmlAutorizacion);

    // 2. Construir el árbol XML DTE y el Timbre Electrónico <TED> (SHA1withRSA)
    const { docId, tedXml, unsignedDteXml } = DteXmlBuilderService.buildDocumentoXml({
      idDoc: {
        TipoDTE: move.documentTypeCode,
        Folio: nextFolio,
        FchEmis: move.invoiceDate,
        FmaPago: move.formaPagoSii,
      },
      emisor: {
        RUTEmisor: tenant.rut,
        RznSoc: tenant.razonSocial,
        GiroEmis: tenant.giro,
        Acteco: tenant.acteco,
        DirOrigen: tenant.direccionOrigen,
        CmnaOrigen: tenant.comunaOrigen,
        CiudadOrigen: tenant.ciudadOrigen,
      },
      receptor: {
        RUTRecep: partner.rut,
        RznSocRecep: partner.razonSocial,
        GiroRecep: partner.giro,
        DirRecep: partner.direccion,
        CmnaRecep: partner.comuna,
        CiudadRecep: partner.ciudad,
        CorreoRecep: partner.correoDte,
      },
      totales: {
        MntNeto: move.amountUntaxed > 0 ? move.amountUntaxed : undefined,
        MntExe: move.amountExempt > 0 ? move.amountExempt : undefined,
        TasaIVA: move.amountUntaxed > 0 ? 19 : undefined,
        IVA: move.amountTax > 0 ? move.amountTax : undefined,
        MntTotal: move.amountTotal,
      },
      detalles: OdooAccountMoveService.toDetallesSii(move.lines, move.documentTypeCode),
      referencias:
        move.references.length > 0
          ? move.references.map((r) => ({
              NroLinRef: r.sequence,
              TpoDocRef: r.originDocTypeCode,
              FolioRef: r.originDocNumber,
              FchRef: r.date,
              CodRef: r.referenceDocCode,
              RazonRef: r.reason,
            }))
          : undefined,
      caf: parsedCaf,
    });

    // 3. Firmar DTE con XMLDSig usando el certificado X.509 del Tenant
    const signedDteXml = XmlDsigSignerService.signDteXml(
      unsignedDteXml,
      docId,
      tenant.certificate,
      true
    );

    const verification = XmlDsigSignerService.verifySignedXml(
      signedDteXml,
      docId,
      tenant.certificate.certificatePem
    );

    move.state = 'POSTED';
    move.l10nLatamDocumentNumber = OdooAccountMoveService.validateNumericFolio(String(nextFolio));
    move.name = OdooAccountMoveService.formatOdooMoveName(move.documentTypeCode, nextFolio);
    move.dteStatus = 'FIRMADO';
    move.tedXml = tedXml;
    move.dteXmlFirmado = signedDteXml;
    move.signatureVerification = verification;

    // 4. Generar automáticamente Apuntes Contables de Partida Doble (`account.move.line`) en Odoo
    const jItems = OdooAccountingEngineService.generateJournalItemsForInvoiceMove({
      tenantId: tenant.id,
      moveId: move.id,
      moveName: move.name,
      moveType: move.moveType,
      documentTypeCode: move.documentTypeCode,
      date: move.invoiceDate,
      partnerRut: partner.rut,
      partnerName: partner.razonSocial,
      amountUntaxed: move.amountUntaxed,
      amountExempt: move.amountExempt,
      amountTax: move.amountTax,
      amountTotal: move.amountTotal,
    });
    this.journalItems.unshift(...jItems);

    return move;
  }

  public reverseMoveWithCreditNote(params: {
    tenantId: string;
    originMoveId: string;
    referenceDocCode: 1 | 2 | 3;
    reason: string;
  }): MoveDemoRecord {
    const origin = this.moves.find(
      (m) => m.id === params.originMoveId && m.tenantId === params.tenantId
    );
    if (!origin || origin.state !== 'POSTED' || !origin.l10nLatamDocumentNumber) {
      throw new Error('Solo se pueden anular o corregir documentos publicados con Folio SII.');
    }

    const creditLines: OdooMoveLineInput[] =
      params.referenceDocCode === 2
        ? [
            {
              productCode: 'CORR-TXT',
              name: `CORRECCIÓN DE TEXTO: ${params.reason.substring(0, 50)}`,
              quantity: 1,
              priceUnit: 0,
              isExempt: true,
            },
          ]
        : origin.lines.map((l) => ({
            productCode: l.productCode,
            name: l.name,
            quantity: l.quantity,
            uomName: l.uomName,
            priceUnit: l.priceUnit,
            discountPct: l.discountPct,
            isExempt: l.isExempt,
          }));

    const draftNc = this.createDraftMove({
      tenantId: params.tenantId,
      partnerId: origin.partnerId,
      documentTypeCode: CodigoTipoDTE.NotaCreditoElectronica,
      moveType: 'OUT_REFUND',
      invoiceDate: new Date().toISOString().split('T')[0],
      formaPagoSii: origin.formaPagoSii,
      lines: creditLines,
      references: [
        {
          originDocTypeCode: String(origin.documentTypeCode),
          originDocNumber: origin.l10nLatamDocumentNumber,
          referenceDocCode: params.referenceDocCode,
          reason: params.reason,
          date: origin.invoiceDate,
        },
      ],
    });

    const postedNc = this.postMoveAndSignDte(params.tenantId, draftNc.id);

    if (params.referenceDocCode === 1) {
      origin.paymentState = 'REVERSED';
      origin.amountResidual = 0;
      origin.dteStatus = 'ANULADO';

      // Conciliar automáticamente la cuenta por cobrar 110310 entre la Factura Original y la Nota de Crédito
      const matchCode = `A${String(this.reconciliationSeq++).padStart(3, '0')}`;
      for (const item of this.journalItems) {
        if (
          (item.moveId === origin.id || item.moveId === postedNc.id) &&
          item.accountCode === '110310'
        ) {
          item.reconciled = true;
          item.matchingNumber = matchCode;
        }
      }
    }

    return postedNc;
  }

  public registerPayment(params: {
    tenantId: string;
    moveId: string;
    amount: number;
  }): MoveDemoRecord {
    const move = this.moves.find((m) => m.id === params.moveId && m.tenantId === params.tenantId);
    if (!move || move.state !== 'POSTED') {
      throw new Error('Solo se pueden registrar pagos sobre facturas publicadas.');
    }
    const applied = Math.min(move.amountResidual, Math.round(params.amount));
    if (applied <= 0) {
      throw new Error('El documento ya se encuentra completamente pagado o conciliado.');
    }
    move.amountResidual -= applied;
    move.paymentState = move.amountResidual === 0 ? 'PAID' : 'PARTIAL';

    // Generar asiento de pago (`account.payment`) y conciliar cuenta `110310` o `210210`
    const matchCode = `A${String(this.reconciliationSeq++).padStart(3, '0')}`;
    const paymentName = `BNK1/2026/${String(this.reconciliationSeq).padStart(4, '0')}`;
    const paymentItems = OdooAccountingEngineService.generateJournalItemsForPayment({
      tenantId: params.tenantId,
      paymentId: crypto.randomUUID(),
      paymentName,
      invoiceMoveType: move.moveType,
      invoiceMoveName: move.name,
      date: new Date().toISOString().split('T')[0],
      partnerRut: move.partnerRut,
      partnerName: move.partnerName,
      amount: applied,
      matchingNumber: matchCode,
    });
    this.journalItems.unshift(...paymentItems);

    // Si quedó pagada al 100%, marcar la línea original de CxC / CxP como conciliada
    if (move.amountResidual === 0) {
      for (const item of this.journalItems) {
        if (
          item.moveId === move.id &&
          (item.accountCode === '110310' || item.accountCode === '210210')
        ) {
          item.reconciled = true;
          item.matchingNumber = matchCode;
        }
      }
    }

    return move;
  }

  /**
   * Crea un Asiento Contable Manual (`move_type = 'ENTRY'` en diario `MISC` de Odoo)
   * validando estrictamente que Suma(Debe) === Suma(Haber).
   */
  public createManualJournalEntry(params: {
    tenantId: string;
    date: string;
    reference: string;
    lines: Array<{
      accountCode: string;
      label: string;
      debit: number;
      credit: number;
      partnerRut?: string;
      partnerName?: string;
    }>;
  }): { moveName: string; items: OdooJournalItem[] } {
    const tenant = this.tenants.find((t) => t.id === params.tenantId);
    if (!tenant) throw new Error('Tenant no encontrado.');

    if (!params.lines || params.lines.length < 2) {
      throw new Error('Un asiento contable de Partida Doble requiere al menos 2 líneas.');
    }

    const moveId = crypto.randomUUID();
    const moveName = `MISC/2026/${String(this.manualEntrySeq++).padStart(4, '0')} (${params.reference})`;

    const createdItems: OdooJournalItem[] = params.lines.map((l) => {
      const acc = OdooAccountingEngineService.getAccountByCode(l.accountCode);
      const debit = Math.round(l.debit || 0);
      const credit = Math.round(l.credit || 0);
      return {
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        moveId,
        moveName,
        journalCode: 'MISC',
        date: params.date,
        accountCode: acc.code,
        accountName: acc.name,
        partnerRut: l.partnerRut,
        partnerName: l.partnerName,
        label: l.label || params.reference,
        debit,
        credit,
        balance: debit - credit,
        reconciled: false,
      };
    });

    OdooAccountingEngineService.assertBalancedJournalItems(createdItems, moveName);
    this.journalItems.unshift(...createdItems);

    return { moveName, items: createdItems };
  }

  /**
   * Obtiene el reporte contable integral de Odoo `account` + `l10n_cl` para la empresa activa:
   * - Plan de Cuentas Chileno SII/IFRS (`ODOO_CL_CHART_OF_ACCOUNTS`)
   * - Libro Diario (Apuntes contables `account.move.line` de partida doble)
   * - Libro Mayor (`General Ledger` agrupado por cuenta contable)
   * - Balance Tributario de 8 Columnas (Formato Oficial SII Chile) y Estado de Resultados
   */
  public getAccountingReport(tenantId: string, periodoHasta: string = '2026-10-31') {
    const tenantItems = this.journalItems.filter((i) => i.tenantId === tenantId);
    const balance8Columnas = OdooAccountingEngineService.computeBalanceOchoColumnas(
      tenantItems,
      periodoHasta
    );
    const libroMayor = OdooAccountingEngineService.computeLibroMayor(tenantItems);

    return {
      chartOfAccounts: ODOO_CL_CHART_OF_ACCOUNTS,
      journalItems: tenantItems,
      libroMayor,
      balance8Columnas,
    };
  }

  public async sendBatchToSii(tenantId: string, moveIds?: string[]) {
    const tenant = this.tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error('Tenant no encontrado.');

    const targetMoves = this.moves.filter(
      (m) =>
        m.tenantId === tenantId &&
        m.state === 'POSTED' &&
        (m.moveType === 'OUT_INVOICE' || m.moveType === 'OUT_REFUND') &&
        m.dteXmlFirmado &&
        // Las boletas (39/41) no viajan en EnvioDTE: se envían en EnvioBOLETA por la API REST
        !DteXmlBuilderService.isBoleta(m.documentTypeCode) &&
        (!moveIds || moveIds.includes(m.id))
    );

    if (targetMoves.length === 0) {
      throw new Error('No hay DTEs de venta firmados (distintos de boletas) disponibles para empaquetar en EnvioDTE.');
    }

    const conteo = new Map<CodigoTipoDTE, number>();
    for (const m of targetMoves) {
      conteo.set(m.documentTypeCode, (conteo.get(m.documentTypeCode) ?? 0) + 1);
    }

    const { setDocId, unsignedEnvioXml } = DteXmlBuilderService.buildEnvioLoteXml({
      caratula: {
        RutEmisor: tenant.rut,
        RutEnvia: tenant.rutEnvia,
        RutReceptor: '60803000-K',
        FchResol: tenant.fchResol,
        NroResol: tenant.nroResol,
        TmstFirmaEnv: formatSiiTimestamp(new Date()),
        SubTotDTE: Array.from(conteo.entries()).map(([TpoDTE, NroDTE]) => ({ TpoDTE, NroDTE })),
      },
      signedDtesXml: targetMoves.map((m) => m.dteXmlFirmado!),
      esBoleta: false,
    });

    const signedEnvioXml = XmlDsigSignerService.signEnvioLoteXml(
      unsignedEnvioXml,
      setDocId,
      tenant.certificate
    );

    const mockTrackId = String(Math.floor(1000000000 + Math.random() * 9000000000));
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('CrSeed.jws')) {
        return new Response(
          `<soapenv:Envelope><soapenv:Body><getSeedReturn>&lt;SII:RESPUESTA&gt;&lt;SII:RESP_HDR&gt;&lt;ESTADO&gt;00&lt;/ESTADO&gt;&lt;/SII:RESP_HDR&gt;&lt;SII:RESP_BODY&gt;&lt;SEMILLA&gt;009876543210&lt;/SEMILLA&gt;&lt;/SII:RESP_BODY&gt;&lt;/SII:RESPUESTA&gt;</getSeedReturn></soapenv:Body></soapenv:Envelope>`,
          { status: 200 }
        );
      }
      if (url.includes('GetTokenFromSeed.jws')) {
        return new Response(
          `<soapenv:Envelope><soapenv:Body><getTokenReturn>&lt;SII:RESPUESTA&gt;&lt;SII:RESP_HDR&gt;&lt;ESTADO&gt;00&lt;/ESTADO&gt;&lt;/SII:RESP_HDR&gt;&lt;SII:RESP_BODY&gt;&lt;TOKEN&gt;FELINE_SII_TOKEN_${Date.now()}&lt;/TOKEN&gt;&lt;/SII:RESP_BODY&gt;&lt;/SII:RESPUESTA&gt;</getTokenReturn></soapenv:Body></soapenv:Envelope>`,
          { status: 200 }
        );
      }
      return new Response(
        `<?xml version="1.0" encoding="ISO-8859-1"?><RECEPCIONDTE><STATUS>0</STATUS><TRACKID>${mockTrackId}</TRACKID><TIMESTAMP>${new Date().toISOString()}</TIMESTAMP></RECEPCIONDTE>`,
        { status: 200 }
      );
    };

    const siiWs = new SiiWebServiceIntegration(mockFetch);
    const uploadResult = await siiWs.uploadEnvioDteToSii({
      tenantId: tenant.id,
      environment: tenant.environment,
      rutSender: tenant.rutEnvia,
      rutCompany: tenant.rut,
      signedEnvioXml,
      cert: tenant.certificate,
    });

    for (const m of targetMoves) {
      m.dteStatus = 'ACEPTADO';
      m.trackId = uploadResult.trackId;
      m.envioDteXml = signedEnvioXml;
    }

    const lote = {
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      trackId: uploadResult.trackId!,
      estadoSii: 'EPR - Envío Procesado (SIMULADO: no se transmitió al SII)',
      glosaSii: `DTEs Aceptados: ${targetMoves.length} | Rechazados: 0 | Reparos: 0`,
      cantidadDtes: targetMoves.length,
      xmlEnvio: signedEnvioXml,
      createdAt: new Date().toISOString(),
    };

    this.lotesEnviados.unshift(lote);
    return lote;
  }

  public createManualEntry(params: Parameters<FelineLiveSandboxStore['createManualJournalEntry']>[0]) {
    return this.createManualJournalEntry(params);
  }

  public createExpense(params: Parameters<OdooHrExpenseService['createExpense']>[0]): HrExpenseRecord {
    const expense = this.hrExpenseService.createExpense(params);
    this.expenses.unshift(expense);
    return expense;
  }

  public createExpenseSheet(params: {
    tenantId: string;
    name: string;
    employeeId: string;
    employeeName: string;
    employeeRut: string;
    expenseIds: string[];
    autoSubmit?: boolean;
  }): { sheet: HrExpenseSheetRecord; updatedExpenses: HrExpenseRecord[] } {
    const result = this.hrExpenseService.createExpenseSheet({
      ...params,
      expensesList: this.expenses,
    });
    this.expenseSheets.unshift(result.sheet);
    for (const updated of result.updatedExpenses) {
      const idx = this.expenses.findIndex((e) => e.id === updated.id);
      if (idx !== -1) {
        this.expenses[idx] = updated;
      }
    }
    return result;
  }

  public submitExpenseSheet(tenantId: string, sheetId: string): HrExpenseSheetRecord {
    const sheet = this.expenseSheets.find((s) => s.id === sheetId && s.tenantId === tenantId);
    if (!sheet) throw new Error(`Rendición con ID ${sheetId} no encontrada.`);
    this.hrExpenseService.submitExpenseSheet(sheet, this.expenses);
    return sheet;
  }

  public approveExpenseSheet(tenantId: string, sheetId: string, approvedBy?: string): HrExpenseSheetRecord {
    const sheet = this.expenseSheets.find((s) => s.id === sheetId && s.tenantId === tenantId);
    if (!sheet) throw new Error(`Rendición con ID ${sheetId} no encontrada.`);
    this.hrExpenseService.approveExpenseSheet(sheet, this.expenses, approvedBy);
    return sheet;
  }

  public postExpenseSheet(tenantId: string, sheetId: string) {
    const sheet = this.expenseSheets.find((s) => s.id === sheetId && s.tenantId === tenantId);
    if (!sheet) throw new Error(`Rendición con ID ${sheetId} no encontrada.`);
    return this.hrExpenseService.postExpenseSheet(sheet, this.expenses, this);
  }

  public payExpenseSheet(tenantId: string, sheetId: string) {
    const sheet = this.expenseSheets.find((s) => s.id === sheetId && s.tenantId === tenantId);
    if (!sheet) throw new Error(`Rendición con ID ${sheetId} no encontrada.`);
    return this.hrExpenseService.payAndReimburseExpenseSheet(sheet, this.expenses, this);
  }

  public refuseExpenseSheet(tenantId: string, sheetId: string, reason: string): HrExpenseSheetRecord {
    const sheet = this.expenseSheets.find((s) => s.id === sheetId && s.tenantId === tenantId);
    if (!sheet) throw new Error(`Rendición con ID ${sheetId} no encontrada.`);
    this.hrExpenseService.refuseExpenseSheet(sheet, this.expenses, reason);
    return sheet;
  }
}

export const felineSandboxStore = new FelineLiveSandboxStore();
