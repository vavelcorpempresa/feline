import crypto from 'node:crypto';
import forge from 'node-forge';
import { PrismaClient } from '@prisma/client';
import { CryptoVaultService, UnpackedCertificate } from '../core/crypto-vault';
import { encodeToIso88591Buffer } from '../utils/sii-normative.utils';

// ============================================================================
// SERVICIO DE FIRMA ELECTRÓNICA AVANZADA (XMLDSig) MULTIEMPRESA PARA SII CHILE
// Cumple estrictamente xmldsignature_v10.xsd (C14N 1.0, RSA-SHA1, RSAKeyValue + X509Data)
// ============================================================================

export interface RsaPublicKeyComponents {
  modulusBase64: string;
  exponentBase64: string;
}

export class XmlDsigSignerService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly vault: CryptoVaultService
  ) {}

  /**
   * Guarda el Certificado Digital (.pfx/.p12) de una empresa cifrado con AES-256-GCM
   * (contenedor y contraseña) y desactiva los certificados anteriores del mismo Tenant.
   */
  public async storeCertificateForTenant(tenantId: string, pfxBuffer: Buffer, passphrase: string) {
    // Valida contraseña y contenido antes de guardar
    const unpacked = CryptoVaultService.unpackPkcs12(pfxBuffer, passphrase);
    if (unpacked.validTo < new Date()) {
      throw new Error(`El certificado de ${unpacked.subjectName} expiró el ${unpacked.validTo.toISOString()}.`);
    }

    const pfx = this.vault.encrypt(pfxBuffer);
    const pass = this.vault.encrypt(passphrase);

    return this.prisma.$transaction(async (tx) => {
      await tx.certificadoDigital.updateMany({
        where: { tenantId, isActive: true },
        data: { isActive: false },
      });
      return tx.certificadoDigital.create({
        data: {
          tenantId,
          rutTitular: (unpacked.rutTitular ?? 'DESCONOCIDO').substring(0, 12),
          nombreTitular: unpacked.subjectName.substring(0, 100),
          pfxEncrypted: Buffer.from(pfx.ciphertextBase64, 'base64'),
          pfxIv: pfx.ivHex,
          pfxAuthTag: pfx.authTagHex,
          passphraseEncrypted: pass.ciphertextBase64,
          passphraseIv: pass.ivHex,
          passphraseAuthTag: pass.authTagHex,
          validFrom: unpacked.validFrom,
          validTo: unpacked.validTo,
          isActive: true,
        },
        select: { id: true, rutTitular: true, nombreTitular: true, validFrom: true, validTo: true },
      });
    });
  }

  /**
   * Obtiene y desencripta en memoria el Certificado Digital (.pfx/.p12) activo
   * perteneciente exclusivamente a la empresa emisora (`tenantId`).
   */
  public async getTenantActiveCertificate(tenantId: string): Promise<UnpackedCertificate> {
    const certRecord = await this.prisma.certificadoDigital.findFirst({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!certRecord) {
      throw new Error(
        `La empresa emisora (${tenantId}) no posee un Certificado Digital (.pfx/.p12) activo configurado.`
      );
    }

    const now = new Date();
    if (certRecord.validTo < now) {
      throw new Error(
        `El Certificado Digital del titular ${certRecord.rutTitular} (Tenant ${tenantId}) expiró el ${certRecord.validTo.toISOString()}.`
      );
    }

    const pfxBuffer = this.vault.decryptToBuffer({
      ciphertextBase64: certRecord.pfxEncrypted.toString('base64'),
      ivHex: certRecord.pfxIv,
      authTagHex: certRecord.pfxAuthTag,
    });

    const passphrase = this.vault.decryptToString({
      ciphertextBase64: certRecord.passphraseEncrypted,
      ivHex: certRecord.passphraseIv,
      authTagHex: certRecord.passphraseAuthTag,
    });

    return CryptoVaultService.unpackPkcs12(pfxBuffer, passphrase);
  }

  /**
   * Extrae el Módulo (<Modulus>) y Exponente (<Exponent>) en Base64 desde el Certificado X.509
   * en formato PEM, tal como lo exige el nodo <KeyValue><RSAKeyValue> de xmldsignature_v10.xsd.
   */
  public static extractRsaKeyComponents(certificatePem: string): RsaPublicKeyComponents {
    const cert = forge.pki.certificateFromPem(certificatePem);
    const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;

    // Convertir BigInteger de node-forge a bytes sin el byte 0x00 inicial de signo positivo ASN.1
    let modHex = publicKey.n.toString(16);
    if (modHex.length % 2 !== 0) modHex = '0' + modHex;
    if (modHex.startsWith('00') && modHex.length > 2) {
      modHex = modHex.slice(2);
    }

    let expHex = publicKey.e.toString(16);
    if (expHex.length % 2 !== 0) expHex = '0' + expHex;

    const modulusBase64 = Buffer.from(modHex, 'hex').toString('base64');
    const exponentBase64 = Buffer.from(expHex, 'hex').toString('base64');

    return { modulusBase64, exponentBase64 };
  }

  /**
   * Parte un string Base64 en líneas de 76 caracteres o lo mantiene limpio según contexto.
   */
  private static wrapBase64(b64: string): string {
    return b64.replace(/\r?\n|\r/g, '');
  }

  /**
   * Firma un nodo <DTE version="1.0"><Documento ID="F...T...">...</Documento></DTE>
   * según la especificación del SII:
   * - Reference URI="#F{folio}T{tipo}"
   * - Transform C14N 1.0 sobre el nodo <Documento> con el namespace heredado xmlns="http://www.sii.cl/SiiDte"
   *   (Nota técnica REA: Cuando un <DTE> va dentro de <EnvioDTE xmlns="http://www.sii.cl/SiiDte">,
   *    al aplicar Canonical XML 1.0 sobre <Documento ID="...">, C14N propaga el atributo
   *    `xmlns="http://www.sii.cl/SiiDte"` al elemento raíz del subárbol referenciado `<Documento>`).
   */
  public static signDteXml(
    unsignedDteXml: string,
    docId: string,
    cert: UnpackedCertificate,
    includeInheritedSiiNamespace: boolean = true
  ): string {
    const docMatch = unsignedDteXml.match(
      new RegExp(`<Documento\\s+ID="${docId}"[^>]*>[\\s\\S]*?<\\/Documento>`)
    );
    if (!docMatch) {
      throw new Error(`No se encontró el nodo <Documento ID="${docId}"> para firmar el DTE.`);
    }

    const rawDocumentoNode = docMatch[0];

    // En Canonical XML 1.0 (http://www.w3.org/TR/2001/REC-xml-c14n-20010315):
    // Si <DTE> será insertado dentro de <EnvioDTE xmlns="http://www.sii.cl/SiiDte">,
    // el validador C14N del SII evalúa el digest de <Documento> con el namespace heredado:
    // <Documento xmlns="http://www.sii.cl/SiiDte" ID="F...T...">
    const canonicalDocumento = includeInheritedSiiNamespace
      ? rawDocumentoNode.replace(
          `<Documento ID="${docId}">`,
          `<Documento xmlns="http://www.sii.cl/SiiDte" ID="${docId}">`
        )
      : rawDocumentoNode;

    // Digest SHA1 sobre los bytes ISO-8859-1 del nodo canonicalizado
    const docBytesIso = encodeToIso88591Buffer(canonicalDocumento);
    const digestValueBase64 = crypto.createHash('sha1').update(docBytesIso).digest('base64');

    // Construir <SignedInfo> canónico (C14N propaga xmlns="http://www.w3.org/2000/09/xmldsig#")
    const signedInfoContent =
      `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
      `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
      `<Reference URI="#${docId}">` +
      `<Transforms>` +
      `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform>` +
      `</Transforms>` +
      `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
      `<DigestValue>${digestValueBase64}</DigestValue>` +
      `</Reference>`;

    const canonicalSignedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfoContent}</SignedInfo>`;

    // Calcular SignatureValue (RSA-SHA1 sobre el SignedInfo canonicalizado)
    const signer = crypto.createSign('RSA-SHA1');
    signer.update(encodeToIso88591Buffer(canonicalSignedInfo));
    signer.end();
    const signatureValueBase64 = signer.sign(cert.privateKeyPem, 'base64');

    const { modulusBase64, exponentBase64 } = XmlDsigSignerService.extractRsaKeyComponents(
      cert.certificatePem
    );

    const signatureXml =
      `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
      `<SignedInfo>${signedInfoContent}</SignedInfo>` +
      `<SignatureValue>${XmlDsigSignerService.wrapBase64(signatureValueBase64)}</SignatureValue>` +
      `<KeyInfo>` +
      `<KeyValue>` +
      `<RSAKeyValue>` +
      `<Modulus>${XmlDsigSignerService.wrapBase64(modulusBase64)}</Modulus>` +
      `<Exponent>${XmlDsigSignerService.wrapBase64(exponentBase64)}</Exponent>` +
      `</RSAKeyValue>` +
      `</KeyValue>` +
      `<X509Data>` +
      `<X509Certificate>${XmlDsigSignerService.wrapBase64(cert.certificateBase64Der)}</X509Certificate>` +
      `</X509Data>` +
      `</KeyInfo>` +
      `</Signature>`;

    // Insertar <Signature> justo antes del cierre </DTE>
    return unsignedDteXml.replace(/<\/DTE>\s*$/, `${signatureXml}</DTE>`);
  }

  /**
   * Firma el sobre contenedor <EnvioDTE> o <EnvioBOLETA> referenciando `<SetDTE ID="SetDoc">`.
   */
  public static signEnvioLoteXml(
    unsignedEnvioXml: string,
    setDocId: string,
    cert: UnpackedCertificate
  ): string {
    const setDteMatch = unsignedEnvioXml.match(
      new RegExp(`<SetDTE\\s+ID="${setDocId}"[^>]*>[\\s\\S]*?<\\/SetDTE>`)
    );
    if (!setDteMatch) {
      throw new Error(`No se encontró el nodo <SetDTE ID="${setDocId}"> dentro del sobre de envío.`);
    }

    const rawSetDteNode = setDteMatch[0];

    // En C14N 1.0, <SetDTE ID="SetDoc"> hereda los atributos de namespace del padre <EnvioDTE>
    // Orden lexicográfico de atributos de namespace en C14N 1.0:
    // xmlns="http://www.sii.cl/SiiDte" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ID="SetDoc"
    const canonicalSetDte = rawSetDteNode.replace(
      `<SetDTE ID="${setDocId}">`,
      `<SetDTE xmlns="http://www.sii.cl/SiiDte" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ID="${setDocId}">`
    );

    const setDteBytesIso = encodeToIso88591Buffer(canonicalSetDte);
    const digestValueBase64 = crypto.createHash('sha1').update(setDteBytesIso).digest('base64');

    const signedInfoContent =
      `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
      `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
      `<Reference URI="#${setDocId}">` +
      `<Transforms>` +
      `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform>` +
      `</Transforms>` +
      `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
      `<DigestValue>${digestValueBase64}</DigestValue>` +
      `</Reference>`;

    const canonicalSignedInfo =
      `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      `${signedInfoContent}` +
      `</SignedInfo>`;

    const signer = crypto.createSign('RSA-SHA1');
    signer.update(encodeToIso88591Buffer(canonicalSignedInfo));
    signer.end();
    const signatureValueBase64 = signer.sign(cert.privateKeyPem, 'base64');

    const { modulusBase64, exponentBase64 } = XmlDsigSignerService.extractRsaKeyComponents(
      cert.certificatePem
    );

    const signatureXml =
      `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
      `<SignedInfo>${signedInfoContent}</SignedInfo>` +
      `<SignatureValue>${XmlDsigSignerService.wrapBase64(signatureValueBase64)}</SignatureValue>` +
      `<KeyInfo>` +
      `<KeyValue>` +
      `<RSAKeyValue>` +
      `<Modulus>${XmlDsigSignerService.wrapBase64(modulusBase64)}</Modulus>` +
      `<Exponent>${XmlDsigSignerService.wrapBase64(exponentBase64)}</Exponent>` +
      `</RSAKeyValue>` +
      `</KeyValue>` +
      `<X509Data>` +
      `<X509Certificate>${XmlDsigSignerService.wrapBase64(cert.certificateBase64Der)}</X509Certificate>` +
      `</X509Data>` +
      `</KeyInfo>` +
      `</Signature>`;

    return unsignedEnvioXml.replace(
      /<\/(EnvioDTE|EnvioBOLETA)>\s*$/,
      `${signatureXml}</$1>`
    );
  }

  /**
   * Firma la Semilla de Autenticación del SII (`<getToken><item><Semilla>...</Semilla></item></getToken>`)
   * aplicando una firma XMLDSig Enveloped (`URI=""` y Transform `enveloped-signature`).
   */
  public static signSeedXml(seed: string, cert: UnpackedCertificate): string {
    const cleanSeed = seed.trim();
    const innerGetToken = `<getToken><item><Semilla>${cleanSeed}</Semilla></item></getToken>`;

    // En firma Enveloped con URI="", el transform enveloped-signature remueve el nodo <Signature>
    // dejando exactamente `<getToken><item><Semilla>...</Semilla></item></getToken>`
    const digestValueBase64 = crypto
      .createHash('sha1')
      .update(Buffer.from(innerGetToken, 'utf8'))
      .digest('base64');

    const signedInfoContent =
      `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
      `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
      `<Reference URI="">` +
      `<Transforms>` +
      `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>` +
      `</Transforms>` +
      `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
      `<DigestValue>${digestValueBase64}</DigestValue>` +
      `</Reference>`;

    const canonicalSignedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfoContent}</SignedInfo>`;

    const signer = crypto.createSign('RSA-SHA1');
    signer.update(Buffer.from(canonicalSignedInfo, 'utf8'));
    signer.end();
    const signatureValueBase64 = signer.sign(cert.privateKeyPem, 'base64');

    const { modulusBase64, exponentBase64 } = XmlDsigSignerService.extractRsaKeyComponents(
      cert.certificatePem
    );

    const signatureXml =
      `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
      `<SignedInfo>${signedInfoContent}</SignedInfo>` +
      `<SignatureValue>${XmlDsigSignerService.wrapBase64(signatureValueBase64)}</SignatureValue>` +
      `<KeyInfo>` +
      `<KeyValue>` +
      `<RSAKeyValue>` +
      `<Modulus>${XmlDsigSignerService.wrapBase64(modulusBase64)}</Modulus>` +
      `<Exponent>${XmlDsigSignerService.wrapBase64(exponentBase64)}</Exponent>` +
      `</RSAKeyValue>` +
      `</KeyValue>` +
      `<X509Data>` +
      `<X509Certificate>${XmlDsigSignerService.wrapBase64(cert.certificateBase64Der)}</X509Certificate>` +
      `</X509Data>` +
      `</KeyInfo>` +
      `</Signature>`;

    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<getToken><item><Semilla>${cleanSeed}</Semilla></item>${signatureXml}</getToken>`
    );
  }

  /**
   * Verificador criptográfico local para pruebas y auditoría previa al envío al SII:
   * Verifica tanto el DigestValue del documento/lote como el SignatureValue RSA-SHA1.
   */
  public static verifySignedXml(
    signedXml: string,
    referenceUriId: string,
    certificatePem: string
  ): { validDigest: boolean; validSignature: boolean } {
    const targetUri = referenceUriId === '' ? '' : `#${referenceUriId}`;
    const signatureBlocks = signedXml.match(/<Signature[\s\S]*?<\/Signature>/g) || [];
    const targetSignatureBlock = signatureBlocks.find((block) =>
      block.includes(`<Reference URI="${targetUri}">`)
    );

    if (!targetSignatureBlock) {
      return { validDigest: false, validSignature: false };
    }

    const digestMatch = targetSignatureBlock.match(/<DigestValue>([^<]+)<\/DigestValue>/);
    const sigValMatch = targetSignatureBlock.match(/<SignatureValue>([^<]+)<\/SignatureValue>/);
    const signedInfoMatch = targetSignatureBlock.match(/<SignedInfo>([\s\S]*?)<\/SignedInfo>/);

    if (!digestMatch || !sigValMatch || !signedInfoMatch) {
      return { validDigest: false, validSignature: false };
    }

    const expectedDigest = digestMatch[1].trim();
    const signatureBase64 = sigValMatch[1].trim();
    const signedInfoInner = signedInfoMatch[1];

    // 1. Verificar Digest del nodo referenciado
    let validDigest = false;
    if (referenceUriId === '') {
      const withoutXmlDecl = signedXml.replace(/<\?xml[^>]*\?>\s*/g, '');
      const withoutSignature = withoutXmlDecl.replace(/<Signature[\s\S]*?<\/Signature>/, '');
      const computed = crypto.createHash('sha1').update(Buffer.from(withoutSignature, 'utf8')).digest('base64');
      validDigest = computed === expectedDigest;
    } else {
      const isSetDte = referenceUriId === 'SetDoc' || signedXml.includes(`<SetDTE ID="${referenceUriId}">`);
      if (isSetDte) {
        const match = signedXml.match(new RegExp(`<SetDTE\\s+ID="${referenceUriId}"[^>]*>[\\s\\S]*?<\\/SetDTE>`));
        if (match) {
          const c14n = match[0].replace(
            `<SetDTE ID="${referenceUriId}">`,
            `<SetDTE xmlns="http://www.sii.cl/SiiDte" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ID="${referenceUriId}">`
          );
          const computed = crypto.createHash('sha1').update(encodeToIso88591Buffer(c14n)).digest('base64');
          validDigest = computed === expectedDigest;
        }
      } else {
        const match = signedXml.match(new RegExp(`<Documento\\s+ID="${referenceUriId}"[^>]*>[\\s\\S]*?<\\/Documento>`));
        if (match) {
          const c14n = match[0].replace(
            `<Documento ID="${referenceUriId}">`,
            `<Documento xmlns="http://www.sii.cl/SiiDte" ID="${referenceUriId}">`
          );
          const computed = crypto.createHash('sha1').update(encodeToIso88591Buffer(c14n)).digest('base64');
          validDigest = computed === expectedDigest;
        }
      }
    }

    // 2. Verificar SignatureValue RSA-SHA1 con el certificado público
    const isEnvio = signedXml.includes('<EnvioDTE') || signedXml.includes('<EnvioBOLETA');
    const canonicalSignedInfo = isEnvio
      ? `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${signedInfoInner}</SignedInfo>`
      : `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfoInner}</SignedInfo>`;

    const verifier = crypto.createVerify('RSA-SHA1');
    verifier.update(
      referenceUriId === ''
        ? Buffer.from(canonicalSignedInfo, 'utf8')
        : encodeToIso88591Buffer(canonicalSignedInfo)
    );
    verifier.end();

    const validSignature = verifier.verify(certificatePem, signatureBase64, 'base64');

    return { validDigest, validSignature };
  }
}
