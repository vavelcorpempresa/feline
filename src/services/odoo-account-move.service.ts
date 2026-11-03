import { PrismaClient } from '@prisma/client';
import {
  CodigoTipoDTE,
  DetalleItemSII,
  ReferenciaSII,
} from '../types/sii-dte.types';
import { DteBillingOrchestratorService } from './dte-orchestrator.service';

// ============================================================================
// FELINE - MOTOR DE FACTURACIÓN ODOO (`account.move` + `l10n_cl` + `l10n_latam`)
// Clonado mediante REA desde https://github.com/odoo/odoo/tree/18.0/addons/l10n_cl
// ============================================================================

export type OdooTaxpayerType =
  | 'VAT_AFFECTED_1ST_CAT' // '1' en Odoo l10n_cl (Contribuyente afecto a IVA 1a Categoría)
  | 'FEES_RECEIPT_ISSUER'  // '2' en Odoo l10n_cl (Emisor Boleta Honorarios 2a Categoría)
  | 'END_CONSUMER'         // '3' en Odoo l10n_cl (Consumidor Final -> Boleta 39/41)
  | 'FOREIGNER';           // '4' en Odoo l10n_cl (Extranjero -> Factura Compra 46)

export type OdooMoveType =
  | 'OUT_INVOICE'
  | 'OUT_REFUND'
  | 'IN_INVOICE'
  | 'IN_REFUND'
  | 'ENTRY';

export type OdooJournalType = 'SALE' | 'PURCHASE' | 'CASH' | 'BANK' | 'GENERAL';

export interface LatamDocumentTypeCatalogItem {
  code: number;
  name: string;
  reportName: string;
  internalType: 'invoice' | 'invoice_in' | 'debit_note' | 'credit_note' | 'stock_picking';
  docCodePrefix: string;
  l10nClActive: boolean;
}

/**
 * Catálogo oficial extraído de `addons/l10n_cl/data/l10n_latam.document.type.csv` en Odoo
 */
export const ODOO_L10N_CL_DOCUMENT_TYPES: readonly LatamDocumentTypeCatalogItem[] = [
  {
    code: 33,
    name: 'Factura Electrónica',
    reportName: 'FACTURA ELECTRÓNICA',
    internalType: 'invoice',
    docCodePrefix: 'FAC',
    l10nClActive: true,
  },
  {
    code: 34,
    name: 'Factura No Afecta o Exenta Electrónica',
    reportName: 'FACTURA EXENTA ELECTRÓNICA',
    internalType: 'invoice',
    docCodePrefix: 'FNA',
    l10nClActive: true,
  },
  {
    code: 39,
    name: 'Boleta Electrónica',
    reportName: 'BOLETA ELECTRÓNICA',
    internalType: 'invoice',
    docCodePrefix: 'BEL',
    l10nClActive: true,
  },
  {
    code: 41,
    name: 'Boleta No Afecta o Exenta Electrónica',
    reportName: 'BOLETA EXENTA ELECTRÓNICA',
    internalType: 'invoice',
    docCodePrefix: 'BXE',
    l10nClActive: true,
  },
  {
    code: 46,
    name: 'Factura de Compra Electrónica',
    reportName: 'FACTURA DE COMPRA ELECTRÓNICA',
    internalType: 'invoice_in',
    docCodePrefix: 'FCE',
    l10nClActive: true,
  },
  {
    code: 52,
    name: 'Guía de Despacho Electrónica',
    reportName: 'GUÍA DE DESPACHO ELECTRÓNICA',
    internalType: 'stock_picking',
    docCodePrefix: 'GDE',
    l10nClActive: true,
  },
  {
    code: 56,
    name: 'Nota de Débito Electrónica',
    reportName: 'NOTA DE DÉBITO ELECTRÓNICA',
    internalType: 'debit_note',
    docCodePrefix: 'N/D',
    l10nClActive: true,
  },
  {
    code: 61,
    name: 'Nota de Crédito Electrónica',
    reportName: 'NOTA DE CRÉDITO ELECTRÓNICA',
    internalType: 'credit_note',
    docCodePrefix: 'N/C',
    l10nClActive: true,
  },
  {
    code: 71,
    name: 'Boleta de Honorarios Electrónica',
    reportName: 'BOLETA DE HONORARIOS ELECTRÓNICA',
    internalType: 'invoice',
    docCodePrefix: 'BHE',
    l10nClActive: true,
  },
] as const;

export interface OdooMoveLineInput {
  productCode?: string;
  name: string;
  description?: string;
  quantity: number;
  uomName?: string;
  priceUnit: number;
  discountPct?: number;
  discountFixed?: number;
  isExempt?: boolean;
  taxRate?: number; // Por defecto 19% en Chile
}

export interface OdooReferenceInput {
  originDocTypeCode: string; // Ej: "33", "39", "801"
  originDocNumber: string;   // Folio referenciado
  referenceDocCode?: 1 | 2 | 3; // 1: Anula, 2: Corrige Texto, 3: Corrige Montos
  reason?: string;
  date: string; // AAAA-MM-DD
}

export interface CreateDraftAccountMoveInput {
  tenantId: string;
  journalId: string;
  partnerId: string;
  documentTypeCode?: CodigoTipoDTE; // Si se omite, Feline lo infiere como hace Odoo según el Partner
  moveType: OdooMoveType;
  invoiceDate: string;
  invoiceDateDue?: string;
  formaPagoSii?: 1 | 2 | 3;
  lines: OdooMoveLineInput[];
  references?: OdooReferenceInput[];
}

export interface ComputedMoveLine extends OdooMoveLineInput {
  sequence: number;
  priceSubtotal: number;
  lineTaxAmount: number;
  priceTotal: number;
}

export interface ComputedMoveTotals {
  lines: ComputedMoveLine[];
  amountUntaxed: number;
  amountExempt: number;
  amountTax: number;
  amountTotal: number;
  amountResidual: number;
}

export class OdooAccountMoveService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly dteOrchestrator: DteBillingOrchestratorService
  ) {}

  /**
   * Réplica exacta de `_check_l10n_latam_document_number_is_numeric` de Odoo (`addons/l10n_cl/models/account_move.py`):
   * En Chile, el número de documento (Folio DTE) solo puede contener dígitos numéricos.
   */
  public static validateNumericFolio(folioNumber: string): string {
    const cleaned = folioNumber.trim();
    if (!/^[0-9]+$/.test(cleaned)) {
      throw new Error(
        'The DTE document number (folio) must contain only digits. (El folio DTE en Chile debe contener únicamente dígitos numéricos).'
      );
    }
    return String(parseInt(cleaned, 10));
  }

  /**
   * Réplica exacta de `_get_l10n_latam_documents_domain` de Odoo (`addons/l10n_cl/models/account_move.py`):
   * Determina qué tipos de DTE están permitidos según:
   * - El tipo de diario (`SALE` vs `PURCHASE`)
   * - El tipo de movimiento (`OUT_INVOICE`, `OUT_REFUND`, `IN_INVOICE`, `IN_REFUND`)
   * - El tipo de contribuyente SII del receptor (`l10n_cl_sii_taxpayer_type`: 1, 2, 3 o 4)
   */
  public static getAllowedLatamDocumentTypes(params: {
    journalType: OdooJournalType;
    moveType: OdooMoveType;
    companyTaxpayerType: OdooTaxpayerType;
    partnerTaxpayerType: OdooTaxpayerType;
    partnerVat?: string;
    partnerCountryCode?: string;
  }): LatamDocumentTypeCatalogItem[] {
    const {
      journalType,
      moveType,
      companyTaxpayerType,
      partnerTaxpayerType,
      partnerVat,
      partnerCountryCode = 'CL',
    } = params;

    // Filtrar por internal_type según move_type (igual que en Odoo)
    const allowedInternalTypes = new Set<string>();
    if (moveType === 'IN_REFUND' || moveType === 'OUT_REFUND') {
      allowedInternalTypes.add('credit_note');
    } else if (moveType === 'IN_INVOICE' || moveType === 'OUT_INVOICE') {
      allowedInternalTypes.add('invoice');
      allowedInternalTypes.add('debit_note');
      allowedInternalTypes.add('invoice_in');
    }

    let candidates = ODOO_L10N_CL_DOCUMENT_TYPES.filter(
      (doc) => doc.l10nClActive && allowedInternalTypes.has(doc.internalType)
    );

    if (journalType === 'SALE') {
      // Regla Odoo: Empresas de 1a categoría afectas a IVA no emiten Boleta de Honorarios (71)
      if (companyTaxpayerType === 'VAT_AFFECTED_1ST_CAT') {
        candidates = candidates.filter((d) => d.code !== 71);
      }

      // En ventas en Chile, diferenciamos si el cliente es Consumidor Final ('3') o Contribuyente IVA ('1')
      if (partnerTaxpayerType === 'END_CONSUMER') {
        const endConsumerCodes = new Set([39, 41, 56, 61]);
        candidates = candidates.filter((d) => endConsumerCodes.has(d.code));
      } else if (partnerTaxpayerType === 'VAT_AFFECTED_1ST_CAT') {
        const vatCodes = new Set([33, 34, 56, 61]);
        candidates = candidates.filter((d) => vatCodes.has(d.code));
      }

      return candidates;
    }

    // Diario de Compras (`PURCHASE`) - Réplica exacta de líneas 63-75 de `addons/l10n_cl/models/account_move.py`
    if (partnerTaxpayerType === 'VAT_AFFECTED_1ST_CAT' && partnerVat !== '60805000-0') {
      const excluded = new Set([39, 70, 71, 914, 911]);
      candidates = candidates.filter((d) => !excluded.has(d.code));
    } else if (partnerTaxpayerType === 'VAT_AFFECTED_1ST_CAT' && partnerVat === '60805000-0') {
      const excluded = new Set([39, 70, 71]);
      candidates = candidates.filter((d) => !excluded.has(d.code));
    } else if (partnerTaxpayerType === 'FEES_RECEIPT_ISSUER') {
      candidates = candidates.filter((d) => d.code === 71);
    } else if (partnerTaxpayerType === 'END_CONSUMER') {
      const allowed = new Set([35, 38, 39, 41, 56, 61]);
      candidates = candidates.filter((d) => allowed.has(d.code));
    } else if (partnerCountryCode !== 'CL' || partnerTaxpayerType === 'FOREIGNER') {
      candidates = candidates.filter((d) => d.code === 46);
    } else {
      candidates = [];
    }

    return candidates;
  }

  /**
   * Calcula los subtotales por línea (`account.move.line`) y los totales del asiento (`account.move`)
   * aplicando redondeo al entero peso chileno (`CLP`, 0 decimales) como lo hace `float_round` en Odoo `l10n_cl`.
   */
  public static computeMoveLinesAndTotals(
    lines: OdooMoveLineInput[],
    documentTypeCode: CodigoTipoDTE
  ): ComputedMoveTotals {
    if (!lines || lines.length === 0) {
      throw new Error('You need to add a line before posting. (El asiento debe tener al menos una línea).');
    }

    const forceExemptDoc =
      documentTypeCode === CodigoTipoDTE.FacturaNoAfectaOExenta ||
      documentTypeCode === CodigoTipoDTE.BoletaNoAfectaOExenta;

    let amountUntaxed = 0;
    let amountExempt = 0;

    const computedLines: ComputedMoveLine[] = lines.map((line, idx) => {
      const grossLine = line.quantity * line.priceUnit;
      const pctDiscount = line.discountPct ? grossLine * (line.discountPct / 100) : 0;
      const fixedDiscount = line.discountFixed ?? 0;
      const priceSubtotal = Math.max(0, Math.round(grossLine - pctDiscount - fixedDiscount));

      const isLineExempt = forceExemptDoc || Boolean(line.isExempt);
      const effectiveTaxRate = isLineExempt ? 0 : (line.taxRate ?? 19);
      const lineTaxAmount = Math.round(priceSubtotal * (effectiveTaxRate / 100));
      const priceTotal = priceSubtotal + lineTaxAmount;

      if (isLineExempt) {
        amountExempt += priceSubtotal;
      } else {
        amountUntaxed += priceSubtotal;
      }

      return {
        ...line,
        isExempt: isLineExempt,
        taxRate: effectiveTaxRate,
        sequence: idx + 1,
        priceSubtotal,
        lineTaxAmount,
        priceTotal,
      };
    });

    // En Chile (SII), el IVA total del documento se calcula sobre la suma del Monto Neto Afecto (19%)
    const amountTax = amountUntaxed > 0 ? Math.round(amountUntaxed * 0.19) : 0;
    const amountTotal = amountUntaxed + amountExempt + amountTax;

    return {
      lines: computedLines,
      amountUntaxed,
      amountExempt,
      amountTax,
      amountTotal,
      amountResidual: amountTotal,
    };
  }

  /**
   * Convierte las líneas de `account.move.line` al formato normativo `<Detalle>` del SII.
   * En Boletas (39/41) el SII exige `PrcItem` y `MontoItem` con IVA incluido; en los demás DTE van netos.
   */
  public static toDetallesSii(
    lines: Array<{
      sequence: number;
      productCode?: string | null;
      name: string;
      description?: string | null;
      quantity: number | { toString(): string };
      uomName: string;
      priceUnit: number | { toString(): string };
      discountPct: number | { toString(): string };
      discountFixed?: number;
      isExempt: boolean;
      priceSubtotal: number;
      priceTotal: number;
    }>,
    documentTypeCode: CodigoTipoDTE
  ): DetalleItemSII[] {
    const isBoleta =
      documentTypeCode === CodigoTipoDTE.BoletaElectronica ||
      documentTypeCode === CodigoTipoDTE.BoletaNoAfectaOExenta;

    return lines.map((line) => {
      const quantity = Number(line.quantity);
      const discountPct = Number(line.discountPct);
      const discountFixed = line.discountFixed ?? 0;
      // Factor de IVA a aplicar a precios de boleta afecta (las líneas exentas no llevan IVA)
      const ivaFactor = isBoleta && !line.isExempt && line.priceTotal > line.priceSubtotal
        ? line.priceTotal / line.priceSubtotal
        : 1;
      const prcItem = Math.round(Number(line.priceUnit) * ivaFactor * 100) / 100;

      return {
        NroLinDet: line.sequence,
        CdgItem: line.productCode ? { TpoCodigo: 'INT1', VlrCodigo: line.productCode } : undefined,
        IndExe: line.isExempt ? 1 : undefined,
        NmbItem: line.name,
        DscItem: line.description ?? undefined,
        QtyItem: quantity,
        UnmdItem: line.uomName,
        PrcItem: prcItem,
        DescuentoPct: discountPct > 0 ? discountPct : undefined,
        DescuentoMonto: discountFixed > 0 ? Math.round(discountFixed * ivaFactor) : undefined,
        MontoItem: isBoleta ? line.priceTotal : line.priceSubtotal,
      };
    });
  }

  /**
   * Formatea el nombre secuencial del asiento como hace Odoo `l10n_latam_invoice_document`:
   * En borrador es `"/"`, y al publicarse toma el prefijo del tipo documental + folio de 6 dígitos (ej. `"FAC 000001"`).
   */
  public static formatOdooMoveName(documentTypeCode: number, folio: number): string {
    const docType = ODOO_L10N_CL_DOCUMENT_TYPES.find((d) => d.code === documentTypeCode);
    const prefix = docType?.docCodePrefix ?? `DTE${documentTypeCode}`;
    return `${prefix} ${String(folio).padStart(6, '0')}`;
  }

  /**
   * Inicializa el catálogo `l10n_latam.document.type` y los diarios/impuestos base de Odoo para una empresa (`Tenant`).
   */
  public async initializeOdooLocalizationForTenant(tenantId: string) {
    // 1. Asegurar catálogo global de tipos de documento LATAM Chile
    for (const item of ODOO_L10N_CL_DOCUMENT_TYPES) {
      await this.prisma.l10nLatamDocumentType.upsert({
        where: { code: item.code },
        update: {},
        create: {
          code: item.code,
          name: item.name,
          reportName: item.reportName,
          internalType: item.internalType,
          docCodePrefix: item.docCodePrefix,
          countryCode: 'CL',
          l10nClActive: item.l10nClActive,
        },
      });
    }

    // 2. Crear Diarios Contables por defecto (`INV` Ventas, `BILL` Compras, `BNK1` Banco)
    const saleJournal = await this.prisma.accountJournal.upsert({
      where: { tenantId_code: { tenantId, code: 'INV' } },
      update: {},
      create: {
        tenantId,
        code: 'INV',
        name: 'Facturas de Cliente (SII DTE)',
        type: 'SALE',
        l10nLatamUseDocuments: true,
      },
    });

    const bankJournal = await this.prisma.accountJournal.upsert({
      where: { tenantId_code: { tenantId, code: 'BNK1' } },
      update: {},
      create: {
        tenantId,
        code: 'BNK1',
        name: 'Banco Estado / Conciliación CLP',
        type: 'BANK',
        l10nLatamUseDocuments: false,
      },
    });

    // 3. Crear Impuestos Chilenos (`IVA 19% Ventas`, `Exento`)
    await this.prisma.accountTax.createMany({
      data: [
        {
          tenantId,
          name: 'IVA 19% Ventas',
          amount: 19.0,
          amountType: 'percent',
          typeTaxUse: 'sale',
          siiTaxCode: 14,
          isExempt: false,
        },
        {
          tenantId,
          name: 'Exento Ventas',
          amount: 0.0,
          amountType: 'percent',
          typeTaxUse: 'sale',
          siiTaxCode: 0,
          isExempt: true,
        },
      ],
      skipDuplicates: true,
    });

    return { saleJournal, bankJournal };
  }

  /**
   * 1. CREAR FACTURA EN BORRADOR (`account.move` en estado `DRAFT` con nombre `"/"`)
   * Valida las reglas de dominio de Odoo `l10n_cl` antes de guardar el borrador.
   */
  public async createDraftMove(input: CreateDraftAccountMoveInput) {
    const [tenant, journal, partner] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: input.tenantId } }),
      this.prisma.accountJournal.findFirst({
        where: { id: input.journalId, tenantId: input.tenantId },
      }),
      this.prisma.clienteReceptor.findFirst({
        where: { id: input.partnerId, tenantId: input.tenantId },
      }),
    ]);

    if (!tenant) throw new Error(`Tenant ${input.tenantId} no encontrado.`);
    if (!journal) throw new Error(`Diario contable ${input.journalId} no pertenece al Tenant.`);
    if (!partner) throw new Error(`Partner/Receptor ${input.partnerId} no pertenece al Tenant.`);

    // Evaluar los tipos de documento permitidos según la matriz de Odoo l10n_cl
    const allowedDocs = OdooAccountMoveService.getAllowedLatamDocumentTypes({
      journalType: journal.type as OdooJournalType,
      moveType: input.moveType,
      companyTaxpayerType: tenant.taxpayerType as OdooTaxpayerType,
      partnerTaxpayerType: partner.taxpayerType as OdooTaxpayerType,
      partnerVat: partner.rut,
      partnerCountryCode: partner.countryCode,
    });

    if (allowedDocs.length === 0) {
      throw new Error(
        `[Odoo l10n_cl ValidationError] Ningún tipo de documento DTE es válido para el Partner ${partner.rut} (${partner.taxpayerType}) en este diario.`
      );
    }

    const selectedDocCode = (input.documentTypeCode ?? allowedDocs[0].code) as CodigoTipoDTE;
    const isAllowed = allowedDocs.some((d) => d.code === selectedDocCode);

    if (!isAllowed) {
      throw new Error(
        `[Odoo _check_document_types_post] El TipoDTE ${selectedDocCode} no está permitido para el contribuyente tipo ${partner.taxpayerType}. Permitidos: [${allowedDocs.map((d) => d.code).join(', ')}].`
      );
    }

    const computed = OdooAccountMoveService.computeMoveLinesAndTotals(
      input.lines,
      selectedDocCode
    );

    return this.prisma.accountMove.create({
      data: {
        tenantId: input.tenantId,
        journalId: input.journalId,
        partnerId: input.partnerId,
        documentTypeCode: selectedDocCode,
        name: '/', // En Odoo todo account.move en estado DRAFT tiene name = "/"
        moveType: input.moveType,
        state: 'DRAFT',
        paymentState: 'NOT_PAID',
        invoiceDate: new Date(input.invoiceDate),
        invoiceDateDue: input.invoiceDateDue ? new Date(input.invoiceDateDue) : null,
        formaPagoSii: input.formaPagoSii ?? 1,
        amountUntaxed: computed.amountUntaxed,
        amountExempt: computed.amountExempt,
        amountTax: computed.amountTax,
        amountTotal: computed.amountTotal,
        amountResidual: computed.amountResidual,
        lines: {
          create: computed.lines.map((l) => ({
            sequence: l.sequence,
            productCode: l.productCode,
            name: l.name,
            description: l.description,
            quantity: l.quantity,
            uomName: l.uomName ?? 'UN',
            priceUnit: l.priceUnit,
            discountPct: l.discountPct ?? 0,
            discountFixed: l.discountFixed ?? 0,
            isExempt: l.isExempt ?? false,
            taxRate: l.taxRate ?? 19,
            priceSubtotal: l.priceSubtotal,
            priceTotal: l.priceTotal,
          })),
        },
        references: input.references
          ? {
              create: input.references.map((ref, idx) => ({
                sequence: idx + 1,
                originDocTypeCode: ref.originDocTypeCode,
                originDocNumber: ref.originDocNumber,
                referenceDocCode: ref.referenceDocCode,
                reason: ref.reason,
                date: new Date(ref.date),
              })),
            }
          : undefined,
      },
      include: {
        lines: true,
        references: true,
        partner: true,
      },
    });
  }

  /**
   * 2. PUBLICAR / VALIDAR FACTURA (`action_post` / `_post` en Odoo `account.move`)
   * Transiciona el asiento de `DRAFT` -> `POSTED`, invoca el motor DTE de Feline para:
   * - Asignar Folio CAF atómicamente (`SELECT ... FOR UPDATE`)
   * - Generar el Timbre Electrónico `<TED>` (`SHA1withRSA`)
   * - Firmar el `<DTE>` con `XMLDSig` (`C14N`) usando el certificado del Tenant
   * - Asignar `l10nLatamDocumentNumber` y el nombre oficial (ej. `"FAC 000001"`).
   */
  public async actionPost(tenantId: string, moveId: string) {
    const move = await this.prisma.accountMove.findFirst({
      where: { id: moveId, tenantId },
      include: {
        lines: { orderBy: { sequence: 'asc' } },
        references: { orderBy: { sequence: 'asc' } },
        partner: true,
        journal: true,
      },
    });

    if (!move) {
      throw new Error(`AccountMove ${moveId} no existe en el Tenant ${tenantId}.`);
    }

    if (move.state !== 'DRAFT') {
      throw new Error(
        `[Odoo UserError] Solo se pueden publicar asientos en estado DRAFT (Estado actual: ${move.state}).`
      );
    }

    if (move.lines.length === 0) {
      throw new Error('[Odoo UserError] You need to add a line before posting.');
    }

    // Reservar el borrador de forma atómica: si dos solicitudes publican el mismo asiento a la vez,
    // solo una obtiene la reserva y emite el DTE (evita folios duplicados y DTE huérfanos).
    const POSTING_LOCK_NAME = '/posting';
    const claim = await this.prisma.accountMove.updateMany({
      where: { id: move.id, tenantId, state: 'DRAFT', name: '/' },
      data: { name: POSTING_LOCK_NAME },
    });
    if (claim.count === 0) {
      throw new Error(
        `[Odoo UserError] El asiento ${moveId} ya está siendo publicado o fue publicado por otra solicitud.`
      );
    }

    const detallesSii = OdooAccountMoveService.toDetallesSii(
      move.lines,
      move.documentTypeCode as CodigoTipoDTE
    );

    const referenciasSii: ReferenciaSII[] = move.references.map((ref) => ({
      NroLinRef: ref.sequence,
      TpoDocRef: ref.originDocTypeCode,
      FolioRef: ref.originDocNumber,
      FchRef: ref.date.toISOString().split('T')[0],
      CodRef: (ref.referenceDocCode as 1 | 2 | 3) ?? undefined,
      RazonRef: ref.reason ?? undefined,
    }));

    // Emitir y firmar el DTE mediante el orquestador criptográfico de Feline
    let documentoDte: { id: string; folio: number };
    try {
      documentoDte = await this.dteOrchestrator.emitirYFirmarDte({
        tenantId,
        receptorId: move.partnerId,
        tipoDte: move.documentTypeCode as CodigoTipoDTE,
        fechaEmision: move.invoiceDate.toISOString().split('T')[0],
        fechaVenc: move.invoiceDateDue
          ? move.invoiceDateDue.toISOString().split('T')[0]
          : undefined,
        fmaPago: (move.formaPagoSii as 1 | 2 | 3) ?? 1,
        detalles: detallesSii,
        referencias: referenciasSii.length > 0 ? referenciasSii : undefined,
      });
    } catch (err) {
      // Liberar la reserva para permitir reintentar la publicación
      await this.prisma.accountMove.updateMany({
        where: { id: move.id, tenantId, state: 'DRAFT', name: POSTING_LOCK_NAME },
        data: { name: '/' },
      });
      throw err;
    }

    const folioStr = OdooAccountMoveService.validateNumericFolio(String(documentoDte.folio));
    const formattedName = OdooAccountMoveService.formatOdooMoveName(
      move.documentTypeCode,
      documentoDte.folio
    );

    const updatedMove = await this.prisma.accountMove.update({
      where: { id: move.id },
      data: {
        state: 'POSTED',
        l10nLatamDocumentNumber: folioStr,
        name: formattedName,
        documentoDteId: documentoDte.id,
      },
      include: {
        documentoDte: true,
        lines: true,
        references: true,
      },
    });

    return updatedMove;
  }

  /**
   * 3. WIZARD DE REVERSIÓN / NOTA DE CRÉDITO (`account.move.reversal` en Odoo `l10n_cl`)
   * Crea automáticamente una Nota de Crédito Electrónica (Tipo 61) referenciando el folio,
   * fecha y tipo del documento original con `CodRef` SII (`1`: Anula, `2`: Corrige Texto, `3`: Corrige Montos).
   */
  public async reverseMovesWithCreditNote(params: {
    tenantId: string;
    originMoveId: string;
    referenceDocCode: 1 | 2 | 3; // 1 = Anula Documento de Referencia, 2 = Corrige Texto, 3 = Corrige Montos
    reason: string;
    reversalDate: string; // AAAA-MM-DD
    autoPost?: boolean;
  }) {
    const {
      tenantId,
      originMoveId,
      referenceDocCode,
      reason,
      reversalDate,
      autoPost = true,
    } = params;

    const originMove = await this.prisma.accountMove.findFirst({
      where: { id: originMoveId, tenantId },
      include: { lines: { orderBy: { sequence: 'asc' } } },
    });

    if (!originMove || originMove.state !== 'POSTED' || !originMove.l10nLatamDocumentNumber) {
      throw new Error(
        '[Odoo AccountMoveReversal] Solo se puede revertir una factura que esté en estado POSTED y posea un Folio SII asignado.'
      );
    }

    // Construir las líneas de la Nota de Crédito según el Código de Referencia SII
    const creditNoteLines: OdooMoveLineInput[] =
      referenceDocCode === 2
        ? [
            // En SII Chile, CodRef=2 (Corrige Texto) lleva 1 línea con monto 0 indicando la corrección
            {
              name: `DONDE DICE / DEBE DECIR: ${reason.substring(0, 50)}`,
              quantity: 1,
              priceUnit: 0,
              isExempt: true,
              taxRate: 0,
            },
          ]
        : originMove.lines.map((l) => ({
            productCode: l.productCode ?? undefined,
            name: l.name,
            description: l.description ?? undefined,
            quantity: Number(l.quantity),
            uomName: l.uomName,
            priceUnit: Number(l.priceUnit),
            discountPct: Number(l.discountPct),
            discountFixed: l.discountFixed,
            isExempt: l.isExempt,
            taxRate: Number(l.taxRate),
          }));

    const draftCreditNote = await this.createDraftMove({
      tenantId,
      journalId: originMove.journalId,
      partnerId: originMove.partnerId,
      documentTypeCode: CodigoTipoDTE.NotaCreditoElectronica, // 61
      moveType: 'OUT_REFUND',
      invoiceDate: reversalDate,
      formaPagoSii: originMove.formaPagoSii as 1 | 2 | 3,
      lines: creditNoteLines,
      references: [
        {
          originDocTypeCode: String(originMove.documentTypeCode),
          originDocNumber: originMove.l10nLatamDocumentNumber,
          referenceDocCode,
          reason,
          date: originMove.invoiceDate.toISOString().split('T')[0],
        },
      ],
    });

    // Vincular `reversedEntryId`
    await this.prisma.accountMove.update({
      where: { id: draftCreditNote.id },
      data: { reversedEntryId: originMove.id },
    });

    if (!autoPost) {
      return draftCreditNote;
    }

    const postedCreditNote = await this.actionPost(tenantId, draftCreditNote.id);

    // Si CodRef === 1 (Anula Documento), conciliar la factura original dejándola en estado REVERSED y saldo 0
    if (referenceDocCode === 1) {
      await this.prisma.accountMove.update({
        where: { id: originMove.id },
        data: {
          paymentState: 'REVERSED',
          amountResidual: 0,
        },
      });

      if (originMove.documentoDteId) {
        await this.prisma.documentoDTE.update({
          where: { id: originMove.documentoDteId },
          data: { estado: 'ANULADO' },
        });
      }
    }

    return postedCreditNote;
  }

  /**
   * 4. REGISTRO DE PAGOS Y CONCILIACIÓN (`account.payment.register` en Odoo)
   * Registra un abono o pago total contra un `AccountMove` publicado y actualiza
   * automáticamente `amountResidual` y `paymentState` (`PARTIAL` o `PAID`).
   */
  public async registerPayment(params: {
    tenantId: string;
    moveId: string;
    journalId: string;
    amount: number;
    paymentDate: string;
    reference?: string;
  }) {
    const { tenantId, moveId, journalId, amount, paymentDate, reference } = params;

    if (amount <= 0) {
      throw new Error('[Odoo AccountPayment] El monto del pago debe ser estrictamente mayor a 0.');
    }

    return this.prisma.$transaction(async (tx) => {
      const move = await tx.accountMove.findFirst({
        where: { id: moveId, tenantId },
      });

      if (!move || move.state !== 'POSTED') {
        throw new Error(
          '[Odoo AccountPayment] Solo se pueden registrar pagos sobre facturas publicadas (POSTED).'
        );
      }

      if (move.amountResidual <= 0) {
        throw new Error('[Odoo AccountPayment] Esta factura ya se encuentra completamente pagada o revertida.');
      }

      const appliedAmount = Math.min(move.amountResidual, Math.round(amount));
      const newResidual = move.amountResidual - appliedAmount;
      const newPaymentState = newResidual === 0 ? 'PAID' : 'PARTIAL';

      const payment = await tx.accountPayment.create({
        data: {
          tenantId,
          moveId: move.id,
          journalId,
          partnerId: move.partnerId,
          amount: appliedAmount,
          paymentDate: new Date(paymentDate),
          reference,
        },
      });

      const updatedMove = await tx.accountMove.update({
        where: { id: move.id },
        data: {
          amountResidual: newResidual,
          paymentState: newPaymentState,
        },
      });

      return { payment, updatedMove };
    });
  }
}
