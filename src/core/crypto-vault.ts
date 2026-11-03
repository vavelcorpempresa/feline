import crypto from 'node:crypto';
import forge from 'node-forge';

// ============================================================================
// BÓVEDA CRIPTOGRÁFICA (AES-256-GCM) Y EXTRACTOR PKCS#12 (.PFX / .P12)
// Protege los Certificados Digitales y las llaves privadas CAF por Tenant
// ============================================================================

export interface EncryptedPayload {
  ciphertextBase64: string;
  ivHex: string;
  authTagHex: string;
}

export interface UnpackedCertificate {
  privateKeyPem: string;
  certificatePem: string;
  certificateBase64Der: string; // Para el nodo <X509Certificate> sin cabeceras PEM
  rutTitular?: string;
  subjectName: string;
  validFrom: Date;
  validTo: Date;
}

export class CryptoVaultService {
  private readonly masterKey: Buffer;

  constructor(masterKeyHex?: string) {
    // Clave maestra de 32 bytes (256 bits) desde variable de entorno o derivada de forma segura
    let rawKey = masterKeyHex || process.env.TENANT_VAULT_MASTER_KEY;
    if (!rawKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'TENANT_VAULT_MASTER_KEY no está definida: no se puede cifrar certificados ni llaves CAF en producción.'
        );
      }
      // Solo desarrollo/pruebas: clave conocida, nunca usar con certificados reales
      console.warn('[CryptoVault] TENANT_VAULT_MASTER_KEY no definida; usando clave de desarrollo.');
      rawKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    }

    this.masterKey =
      rawKey.length === 64
        ? Buffer.from(rawKey, 'hex')
        : crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Cifra un Buffer o String usando AES-256-GCM autenticado
   */
  public encrypt(plainData: Buffer | string): EncryptedPayload {
    const iv = crypto.randomBytes(12); // 96 bits recomendados por NIST para GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);

    const inputBuffer = Buffer.isBuffer(plainData)
      ? plainData
      : Buffer.from(plainData, 'utf8');

    const encrypted = Buffer.concat([cipher.update(inputBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertextBase64: encrypted.toString('base64'),
      ivHex: iv.toString('hex'),
      authTagHex: authTag.toString('hex'),
    };
  }

  /**
   * Descifra un payload cifrado con AES-256-GCM
   */
  public decryptToBuffer(payload: EncryptedPayload): Buffer {
    const iv = Buffer.from(payload.ivHex, 'hex');
    const authTag = Buffer.from(payload.authTagHex, 'hex');
    const encryptedBuffer = Buffer.from(payload.ciphertextBase64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  }

  public decryptToString(payload: EncryptedPayload): string {
    return this.decryptToBuffer(payload).toString('utf8');
  }

  /**
   * Extrae la llave privada RSA y el certificado X.509 desde un archivo .pfx / .p12
   * Compatible con certificados emitidos por E-Sign, E-Certchile, Acepta, TOC, etc.
   */
  public static unpackPkcs12(pfxBuffer: Buffer, passphrase: string): UnpackedCertificate {
    const p12Der = forge.util.createBuffer(pfxBuffer.toString('binary'));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);

    // 1. Extraer Llave Privada (pkcs8ShroudedKeyBag o keyBag)
    let privateKey: forge.pki.PrivateKey | null = null;
    const shroudedBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBags = p12.getBags({ bagType: forge.pki.oids.keyBag });

    const allKeyBags = [
      ...(shroudedBags[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
      ...(keyBags[forge.pki.oids.keyBag] || []),
    ];

    for (const bag of allKeyBags) {
      if (bag.key) {
        privateKey = bag.key;
        break;
      }
    }

    if (!privateKey) {
      throw new Error('No se encontró una llave privada RSA válida dentro del contenedor PKCS#12 (.pfx/.p12).');
    }

    // 2. Extraer Certificado X.509 del titular
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certs = certBags[forge.pki.oids.certBag] || [];

    if (certs.length === 0 || !certs[0].cert) {
      throw new Error('No se encontró un certificado X.509 dentro del contenedor PKCS#12 (.pfx/.p12).');
    }

    const mainCert = certs[0].cert;
    const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
    const certificatePem = forge.pki.certificateToPem(mainCert);

    // Limpiar cabeceras PEM para obtener el Base64 puro exigido en <X509Certificate>
    const certificateBase64Der = certificatePem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\r?\n|\r/g, '')
      .trim();

    const cnAttr = mainCert.subject.getField('CN');
    const serialNumberAttr = mainCert.subject.getField('serialNumber');

    return {
      privateKeyPem,
      certificatePem,
      certificateBase64Der,
      rutTitular: serialNumberAttr ? String(serialNumberAttr.value) : undefined,
      subjectName: cnAttr ? String(cnAttr.value) : 'Titular Firma Electronica',
      validFrom: mainCert.validity.notBefore,
      validTo: mainCert.validity.notAfter,
    };
  }
}
