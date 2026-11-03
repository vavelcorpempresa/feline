import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { CodigoTipoDTE, ConstruirDteInput, ParsedCafData } from '../types/sii-dte.types';
import {
  escapeXmlSiiText,
  formatSiiTimestamp,
  encodeToIso88591Buffer,
} from '../utils/sii-normative.utils';
import { CryptoVaultService } from '../core/crypto-vault';

// ============================================================================
// SERVICIO DE GESTIÓN DE CAF, ASIGNACIÓN ATÓMICA DE FOLIOS Y TIMBRE (TED)
// Cumplimiento estricto del Instructivo Técnico del Timbre Electrónico SII
// ============================================================================

export class CafTedService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly vault: CryptoVaultService
  ) {}

  /**
   * Parsea un archivo XML de Autorización de Folios (<AUTORIZACION>) emitido por el SII.
   * Importante (REA): Extrae el nodo <CAF version="1.0">...</CAF> de manera literal
   * para no invalidar la firma <FRMA> aplicada por el SII sobre <DA>.
   */
  public static parseAutorizacionCafXml(xmlAutorizacionRaw: string): ParsedCafData {
    // 1. Extraer literalmente el nodo <CAF ...>...</CAF> sin modificar ni un solo espacio
    const cafMatch = xmlAutorizacionRaw.match(/<CAF[^>]*>[\s\S]*?<\/CAF>/);
    if (!cafMatch) {
      throw new Error('El XML proporcionado no contiene un nodo <CAF> válido emitido por el SII.');
    }
    const rawCafXml = cafMatch[0];

    const extractTag = (xml: string, tag: string): string => {
      const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`);
      const match = xml.match(regex);
      if (!match) {
        throw new Error(`Falta el tag obligatorio <${tag}> dentro del archivo CAF del SII.`);
      }
      return match[1].trim();
    };

    const rutEmisor = extractTag(rawCafXml, 'RE');
    const razonSocial = extractTag(rawCafXml, 'RS');
    const tipoDte = parseInt(extractTag(rawCafXml, 'TD'), 10) as CodigoTipoDTE;
    const rngBlock = extractTag(rawCafXml, 'RNG');
    const folioDesde = parseInt(extractTag(rngBlock, 'D'), 10);
    const folioHasta = parseInt(extractTag(rngBlock, 'H'), 10);
    const fechaAutorizacion = extractTag(rawCafXml, 'FA');

    const rsapkBlock = extractTag(rawCafXml, 'RSAPK');
    const modulusBase64 = extractTag(rsapkBlock, 'M');
    const exponentBase64 = extractTag(rsapkBlock, 'E');
    const idKey = extractTag(rawCafXml, 'IDK');
    const firmaSii = extractTag(rawCafXml, 'FRMA');

    // Extraer la llave privada RSA (<RSASK>) que viene fuera de <CAF> pero dentro de <AUTORIZACION>
    const privateKeyPem = extractTag(xmlAutorizacionRaw, 'RSASK');

    if (folioDesde > folioHasta) {
      throw new Error(`Rango de folios inválido en CAF: Desde (${folioDesde}) > Hasta (${folioHasta}).`);
    }

    return {
      rutEmisor,
      razonSocial,
      tipoDte,
      folioDesde,
      folioHasta,
      fechaAutorizacion,
      modulusBase64,
      exponentBase64,
      idKey,
      firmaSii,
      privateKeyPem,
      rawCafXml,
    };
  }

  /**
   * Registra un nuevo CAF en la base de datos asociado exclusivamente a un Tenant,
   * cifrando la llave privada <RSASK> en reposo con AES-256-GCM.
   */
  public async uploadCafForTenant(tenantId: string, xmlAutorizacionRaw: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new Error(`Tenant "${tenantId}" no existe.`);
    }

    const parsed = CafTedService.parseAutorizacionCafXml(xmlAutorizacionRaw);

    if (parsed.rutEmisor !== tenant.rut) {
      throw new Error(
        `Violación de Seguridad Tributaria: El CAF pertenece al RUT ${parsed.rutEmisor}, pero la empresa activa tiene RUT ${tenant.rut}.`
      );
    }

    const encryptedKey = this.vault.encrypt(parsed.privateKeyPem);

    return this.prisma.cafFolio.create({
      data: {
        tenantId,
        tipoDte: parsed.tipoDte,
        folioDesde: parsed.folioDesde,
        folioHasta: parsed.folioHasta,
        folioActual: parsed.folioDesde - 1, // El primer folio asignado será `folioDesde`
        fechaAutorizacion: new Date(parsed.fechaAutorizacion),
        xmlCafNodo: parsed.rawCafXml,
        privateKeyEncrypted: encryptedKey.ciphertextBase64,
        privateKeyIv: encryptedKey.ivHex,
        privateKeyAuthTag: encryptedKey.authTagHex,
        publicKeyModulus: parsed.modulusBase64,
        publicKeyExponent: parsed.exponentBase64,
        agotado: false,
        activo: true,
      },
    });
  }

  /**
   * Asigna de forma atómica y transaccional (con bloqueo pesimista `SELECT ... FOR UPDATE`)
   * el siguiente folio disponible para una empresa emisora (`tenantId`) y un `tipoDte`.
   * Garantiza 0% de colisión o duplicidad de folios bajo alta concurrencia.
   */
  public async allocateNextFolio(
    tenantId: string,
    tipoDte: CodigoTipoDTE
  ): Promise<{ folio: number; cafId: string; cafData: ParsedCafData }> {
    const result = await this.prisma.$transaction(async (tx) => {
      // Bloqueo de fila a nivel de PostgreSQL para serializar asignaciones concurrentes del mismo Tenant + TipoDTE
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          folio_desde: number;
          folio_hasta: number;
          folio_actual: number;
          fecha_autorizacion: Date;
          xml_caf_nodo: string;
          private_key_encrypted: string;
          private_key_iv: string;
          private_key_auth_tag: string;
          public_key_modulus: string;
          public_key_exponent: string;
        }>
      >`
        SELECT
          id,
          "folioDesde" AS folio_desde,
          "folioHasta" AS folio_hasta,
          "folioActual" AS folio_actual,
          "fechaAutorizacion" AS fecha_autorizacion,
          "xmlCafNodo" AS xml_caf_nodo,
          "privateKeyEncrypted" AS private_key_encrypted,
          "privateKeyIv" AS private_key_iv,
          "privateKeyAuthTag" AS private_key_auth_tag,
          "publicKeyModulus" AS public_key_modulus,
          "publicKeyExponent" AS public_key_exponent
        FROM caf_folios
        WHERE "tenantId" = ${tenantId}::uuid
          AND "tipoDte" = ${tipoDte}
          AND activo = true
          AND agotado = false
        ORDER BY "folioDesde" ASC
        LIMIT 1
        FOR UPDATE
      `;

      if (rows.length === 0) {
        throw new Error(
          `No existen folios CAF disponibles (activos y no agotados) para el Tenant ${tenantId} y TipoDTE ${tipoDte}.`
        );
      }

      const cafRow = rows[0];
      const nextFolio = cafRow.folio_actual + 1;

      if (nextFolio > cafRow.folio_hasta) {
        await tx.cafFolio.update({
          where: { id: cafRow.id },
          data: { agotado: true, activo: false },
        });
        // No lanzar dentro de la transacción: el rollback descartaría la marca de agotado
        return { exhaustedCafId: cafRow.id, folioHasta: cafRow.folio_hasta } as const;
      }

      const isNowExhausted = nextFolio >= cafRow.folio_hasta;

      await tx.cafFolio.update({
        where: { id: cafRow.id },
        data: {
          folioActual: nextFolio,
          agotado: isNowExhausted,
        },
      });

      const decryptedPrivateKeyPem = this.vault.decryptToString({
        ciphertextBase64: cafRow.private_key_encrypted,
        ivHex: cafRow.private_key_iv,
        authTagHex: cafRow.private_key_auth_tag,
      });

      // Reconstruir metadatos del CAF
      const parsedCaf = CafTedService.parseAutorizacionCafXml(
        `<AUTORIZACION>${cafRow.xml_caf_nodo}<RSASK>${decryptedPrivateKeyPem}</RSASK></AUTORIZACION>`
      );

      return {
        folio: nextFolio,
        cafId: cafRow.id,
        cafData: parsedCaf,
      };
    });

    if ('exhaustedCafId' in result) {
      throw new Error(
        `El CAF ${result.exhaustedCafId} para TipoDTE ${tipoDte} ha alcanzado su límite máximo (${result.folioHasta}).`
      );
    }
    return result;
  }

  /**
   * Genera el nodo <TED version="1.0"> (Timbre Electrónico del DTE) cumpliendo
   * las reglas exactas del SII:
   * - Orden estricto de etiquetas dentro de <DD>: RE, TD, F, FE, RR, RSR, MNT, IT1, CAF, TSTED.
   * - Truncado normativo de <RSR> e <IT1> a 40 caracteres máximo.
   * - <DD> aplanado en una sola línea (sin retornos de carro ni espacios entre tags) antes de hashear con SHA1.
   * - Firma RSA-SHA1 con la llave privada (<RSASK>) del CAF.
   */
  public static generateTedXml(input: ConstruirDteInput): string {
    const { idDoc, emisor, receptor, totales, detalles, caf } = input;

    if (!detalles || detalles.length === 0) {
      throw new Error('El DTE debe contener al menos 1 ítem en <Detalle> para construir el nodo <IT1> del TED.');
    }

    // Validación de seguridad de rango de folio contra el CAF
    if (idDoc.Folio < caf.folioDesde || idDoc.Folio > caf.folioHasta) {
      throw new Error(
        `Folio ${idDoc.Folio} fuera del rango autorizado en el CAF (${caf.folioDesde} - ${caf.folioHasta}).`
      );
    }

    if (idDoc.TipoDTE !== caf.tipoDte) {
      throw new Error(
        `El TipoDTE (${idDoc.TipoDTE}) no coincide con el tipo autorizado en el CAF (${caf.tipoDte}).`
      );
    }

    const tsted = input.timestampFirma || formatSiiTimestamp(new Date());

    // Regla SII: RSR (Razón Social Receptor) e IT1 (Nombre primer ítem) truncados a máx 40 chars
    const rsrEscaped = escapeXmlSiiText(receptor.RznSocRecep, 40);
    const it1Escaped = escapeXmlSiiText(detalles[0].NmbItem, 40);

    // El nodo <CAF> dentro de <DD> debe aplanarse sin saltos de línea ni espacios entre tags
    // para que el string firmado coincida bit a bit con el XML serializado.
    const cafFlattened = caf.rawCafXml
      .replace(/>\s+</g, '><')
      .replace(/\r?\n|\r/g, '')
      .trim();

    // Construcción canónica de <DD> en una sola línea sin espacios entre etiquetas
    const ddCanonical =
      `<DD>` +
      `<RE>${escapeXmlSiiText(emisor.RUTEmisor)}</RE>` +
      `<TD>${idDoc.TipoDTE}</TD>` +
      `<F>${idDoc.Folio}</F>` +
      `<FE>${escapeXmlSiiText(idDoc.FchEmis)}</FE>` +
      `<RR>${escapeXmlSiiText(receptor.RUTRecep)}</RR>` +
      `<RSR>${rsrEscaped}</RSR>` +
      `<MNT>${Math.round(totales.MntTotal)}</MNT>` +
      `<IT1>${it1Escaped}</IT1>` +
      `${cafFlattened}` +
      `<TSTED>${tsted}</TSTED>` +
      `</DD>`;

    // Firma RSA-SHA1 sobre los bytes ISO-8859-1 del nodo <DD>
    const ddBufferIso = encodeToIso88591Buffer(ddCanonical);
    const signer = crypto.createSign('RSA-SHA1');
    signer.update(ddBufferIso);
    signer.end();

    const signatureBase64 = signer.sign(caf.privateKeyPem, 'base64');

    return (
      `<TED version="1.0">` +
      `${ddCanonical}` +
      `<FRMT algoritmo="SHA1withRSA">${signatureBase64}</FRMT>` +
      `</TED>`
    );
  }
}
