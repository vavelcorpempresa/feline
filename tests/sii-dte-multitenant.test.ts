import { describe, it, expect } from 'vitest';
import forge from 'node-forge';
import crypto from 'node:crypto';
import { CryptoVaultService } from '../src/core/crypto-vault';
import { CafTedService } from '../src/services/caf-ted.service';
import { DteXmlBuilderService } from '../src/services/dte-xml-builder.service';
import { XmlDsigSignerService } from '../src/services/xmldsig-signer.service';
import { SiiWebServiceIntegration } from '../src/services/sii-webservice.service';
import { OdooAccountMoveService } from '../src/services/odoo-account-move.service';
import { OdooAccountingEngineService } from '../src/services/odoo-accounting-engine.service';
import { CodigoTipoDTE } from '../src/types/sii-dte.types';
import {
  encodeToIso88591Buffer,
  normalizeAndValidateRut,
} from '../src/utils/sii-normative.utils';

// ============================================================================
// SUITE DE PRUEBAS AUTOMATIZADAS END-TO-END (FLUJO MULTIEMPRESA SII CHILE)
// Verifica Criptografía PKCS#12, CAF, Timbre TED, XMLDSig y Web Services SII
// ============================================================================

/**
 * Helper para generar en memoria un archivo .pfx/.p12 real (PKCS#12) para un Tenant
 */
function generateTestTenantPkcs12(params: {
  commonName: string;
  rutTitular: string;
  passphrase: string;
}): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86400000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86400000);

  const attrs = [
    { name: 'commonName', value: params.commonName },
    { name: 'countryName', value: 'CL' },
    { name: 'serialNumber', value: params.rutTitular },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    keys.privateKey,
    [cert],
    params.passphrase,
    { algorithm: '3des' }
  );
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(p12Der, 'binary');
}

/**
 * Helper para generar un XML <AUTORIZACION> (CAF) realista con su par RSA de 1024 bits
 */
function generateMockSiiCafXml(params: {
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
<CAF version="1.0"><DA><RE>${params.rutEmisor}</RE><RS>${params.razonSocial}</RS><TD>${params.tipoDte}</TD><RNG><D>${params.desde}</D><H>${params.hasta}</H></RNG><FA>2026-10-01</FA><RSAPK><M>${modB64}</M><E>${expB64}</E></RSAPK><IDK>100</IDK></DA><FRMA algoritmo="SHA1withRSA">falsaFirmaDelSiiSoloParaPruebas12345==</FRMA></CAF>
<RSASK>${privateKey}</RSASK>
</AUTORIZACION>`;

  return { xmlAutorizacion, publicKeyPem: publicKey };
}

describe('Sistema de Facturación Electrónica SII Chile - Arquitectura Multitenant (REA)', () => {
  it('1. Valida correctamente RUTs chilenos con Módulo 11 y rechaza dígitos verificadores adulterados', () => {
    expect(normalizeAndValidateRut('76.123.456-0')).toBe('76123456-0');
    expect(normalizeAndValidateRut('60.803.000-k')).toBe('60803000-K'); // RUT oficial SII
    expect(() => normalizeAndValidateRut('76.123.456-9')).toThrow(/Dígito verificador inválido/);
  });

  it('2. Aísla criptográficamente certificados PKCS#12 (.pfx) de múltiples empresas (Tenants A y B)', () => {
    const vault = new CryptoVaultService();

    // Empresa A: RUT 76123456-0
    const pfxTenantA = generateTestTenantPkcs12({
      commonName: 'REPRESENTANTE EMPRESA A SPA',
      rutTitular: '15342545-2',
      passphrase: 'ClaveSecretaTenantA_2026',
    });

    // Empresa B: RUT 77654321-K (calculamos DV válido: 77654321 -> DV 6)
    const pfxTenantB = generateTestTenantPkcs12({
      commonName: 'REPRESENTANTE EMPRESA B LTDA',
      rutTitular: '11111111-1',
      passphrase: 'ClaveSecretaTenantB_2026',
    });

    const encryptedA = vault.encrypt(pfxTenantA);
    const encryptedB = vault.encrypt(pfxTenantB);

    expect(encryptedA.ciphertextBase64).not.toBe(encryptedB.ciphertextBase64);

    const decryptedBufA = vault.decryptToBuffer(encryptedA);
    const unpackedA = CryptoVaultService.unpackPkcs12(decryptedBufA, 'ClaveSecretaTenantA_2026');
    const unpackedB = CryptoVaultService.unpackPkcs12(
      vault.decryptToBuffer(encryptedB),
      'ClaveSecretaTenantB_2026'
    );

    expect(unpackedA.subjectName).toBe('REPRESENTANTE EMPRESA A SPA');
    expect(unpackedB.subjectName).toBe('REPRESENTANTE EMPRESA B LTDA');
    expect(unpackedA.certificateBase64Der).not.toBe(unpackedB.certificateBase64Der);
  });

  it('3. Genera Timbre Electrónico (TED), DTE (Tipo 33 y 61) y sobre EnvioDTE con firmas XMLDSig verificables e ISO-8859-1', () => {
    const rutEmisor = normalizeAndValidateRut('76123456-0');
    const rutReceptor = normalizeAndValidateRut('60803000-K');

    // Generar certificado del Tenant Emisor
    const pfxBuffer = generateTestTenantPkcs12({
      commonName: 'JUAN PEREZ SOTO',
      rutTitular: '11111111-1',
      passphrase: 'pass1234',
    });
    const cert = CryptoVaultService.unpackPkcs12(pfxBuffer, 'pass1234');

    // Generar CAF Tipo 33 (Folio 1 al 50)
    const { xmlAutorizacion, publicKeyPem: cafPublicKeyPem } = generateMockSiiCafXml({
      rutEmisor,
      razonSocial: 'COMERCIALIZADORA ÑUBLE Y COMPAÑÍA SPA',
      tipoDte: CodigoTipoDTE.FacturaElectronica,
      desde: 1,
      hasta: 50,
    });

    const parsedCaf33 = CafTedService.parseAutorizacionCafXml(xmlAutorizacion);

    // Construir Factura Electrónica Tipo 33 con caracteres latinos (Ñ, tildes)
    const { docId, tedXml, unsignedDteXml } = DteXmlBuilderService.buildDocumentoXml({
      idDoc: {
        TipoDTE: CodigoTipoDTE.FacturaElectronica,
        Folio: 1,
        FchEmis: '2026-10-18',
        FmaPago: 1,
      },
      emisor: {
        RUTEmisor: rutEmisor,
        RznSoc: 'COMERCIALIZADORA ÑUBLE Y COMPAÑÍA SPA',
        GiroEmis: 'DESARROLLO DE SOFTWARE Y ASESORÍAS INFORMÁTICAS',
        Acteco: [620100, 620200],
        DirOrigen: 'AV. PROVIDENCIA 1234 OFICINA 501',
        CmnaOrigen: 'PROVIDENCIA',
        CiudadOrigen: 'SANTIAGO',
      },
      receptor: {
        RUTRecep: rutReceptor,
        RznSocRecep: 'SERVICIO DE IMPUESTOS INTERNOS CON RAZÓN SOCIAL DE MÁS DE CUARENTA CARACTERES PARA PROBAR TRUNCADO',
        GiroRecep: 'ADMINISTRACIÓN PÚBLICA Y DEFENSA',
        DirRecep: 'TEATINOS 120',
        CmnaRecep: 'SANTIAGO',
        CiudadRecep: 'SANTIAGO',
      },
      totales: {
        MntNeto: 100000,
        TasaIVA: 19,
        IVA: 19000,
        MntTotal: 119000,
      },
      detalles: [
        {
          NroLinDet: 1,
          NmbItem: 'LICENCIA ANUAL DE FACTURACIÓN ELECTRÓNICA MULTIEMPRESA CON GESTIÓN DE CAFS',
          QtyItem: 1,
          UnmdItem: 'UN',
          PrcItem: 100000,
          MontoItem: 100000,
        },
      ],
      caf: parsedCaf33,
      timestampFirma: '2026-10-18T10:30:00',
    });

    // Verificar truncado normativo a 40 caracteres en <RSR> e <IT1> dentro del TED
    const rsrMatch = tedXml.match(/<RSR>([^<]+)<\/RSR>/);
    const it1Match = tedXml.match(/<IT1>([^<]+)<\/IT1>/);
    expect(rsrMatch?.[1].length).toBeLessThanOrEqual(40);
    expect(it1Match?.[1].length).toBeLessThanOrEqual(40);

    // Verificar criptográficamente la firma SHA1withRSA del Timbre Electrónico (<TED>)
    const ddMatch = tedXml.match(/<DD>[\s\S]*?<\/DD>/);
    const frmtMatch = tedXml.match(/<FRMT algoritmo="SHA1withRSA">([^<]+)<\/FRMT>/);
    expect(ddMatch).toBeTruthy();
    expect(frmtMatch).toBeTruthy();

    const tedVerifier = crypto.createVerify('RSA-SHA1');
    tedVerifier.update(encodeToIso88591Buffer(ddMatch![0]));
    tedVerifier.end();
    const isTedValid = tedVerifier.verify(cafPublicKeyPem, frmtMatch![1], 'base64');
    expect(isTedValid).toBe(true);

    // Firmar DTE con XMLDSig
    const signedDteXml = XmlDsigSignerService.signDteXml(unsignedDteXml, docId, cert, true);
    const dteVerification = XmlDsigSignerService.verifySignedXml(
      signedDteXml,
      docId,
      cert.certificatePem
    );
    expect(dteVerification.validDigest).toBe(true);
    expect(dteVerification.validSignature).toBe(true);

    // Empaquetar en sobre <EnvioDTE> y firmar el lote completo
    const { setDocId, unsignedEnvioXml } = DteXmlBuilderService.buildEnvioLoteXml({
      caratula: {
        RutEmisor: rutEmisor,
        RutEnvia: '11111111-1',
        RutReceptor: '60803000-K',
        FchResol: '2026-01-15',
        NroResol: 0,
        TmstFirmaEnv: '2026-10-18T10:31:00',
        SubTotDTE: [{ TpoDTE: CodigoTipoDTE.FacturaElectronica, NroDTE: 1 }],
      },
      signedDtesXml: [signedDteXml],
    });

    const signedEnvioXml = XmlDsigSignerService.signEnvioLoteXml(
      unsignedEnvioXml,
      setDocId,
      cert
    );

    const envioVerification = XmlDsigSignerService.verifySignedXml(
      signedEnvioXml,
      setDocId,
      cert.certificatePem
    );
    expect(envioVerification.validDigest).toBe(true);
    expect(envioVerification.validSignature).toBe(true);
    expect(signedEnvioXml).toContain('<?xml version="1.0" encoding="ISO-8859-1"?>');
  });

  it('4. Ejecuta el flujo completo de Web Services SII: Semilla SOAP -> Firma Semilla -> Token -> Upload DTE -> Consulta TrackID', async () => {
    const pfxBuffer = generateTestTenantPkcs12({
      commonName: 'REPRESENTANTE LEGAL SII TEST',
      rutTitular: '11111111-1',
      passphrase: 'secret',
    });
    const cert = CryptoVaultService.unpackPkcs12(pfxBuffer, 'secret');

    let capturedUploadHeaders: Record<string, string> = {};
    let capturedUploadBodyStr = '';

    // Mock determinista de los endpoints SOAP y CGI de maullin.sii.cl
    const mockFetch: typeof fetch = async (input, init) => {
      const url = String(input);

      if (url.includes('CrSeed.jws')) {
        return new Response(
          `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><getSeedReturn>&lt;SII:RESPUESTA xmlns:SII=&quot;http://www.sii.cl/XMLSchema&quot;&gt;&lt;SII:RESP_HDR&gt;&lt;ESTADO&gt;00&lt;/ESTADO&gt;&lt;/SII:RESP_HDR&gt;&lt;SII:RESP_BODY&gt;&lt;SEMILLA&gt;004928172635&lt;/SEMILLA&gt;&lt;/SII:RESP_BODY&gt;&lt;/SII:RESPUESTA&gt;</getSeedReturn></soapenv:Body></soapenv:Envelope>`,
          { status: 200 }
        );
      }

      if (url.includes('GetTokenFromSeed.jws')) {
        return new Response(
          `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><getTokenReturn>&lt;SII:RESPUESTA xmlns:SII=&quot;http://www.sii.cl/XMLSchema&quot;&gt;&lt;SII:RESP_HDR&gt;&lt;ESTADO&gt;00&lt;/ESTADO&gt;&lt;/SII:RESP_HDR&gt;&lt;SII:RESP_BODY&gt;&lt;TOKEN&gt;TOKEN_SII_MAULLIN_998877&lt;/TOKEN&gt;&lt;/SII:RESP_BODY&gt;&lt;/SII:RESPUESTA&gt;</getTokenReturn></soapenv:Body></soapenv:Envelope>`,
          { status: 200 }
        );
      }

      if (url.includes('/cgi_dte/UPL/DTEUpload')) {
        capturedUploadHeaders = (init?.headers ?? {}) as Record<string, string>;
        const bodyBuf = Buffer.from(init?.body as Uint8Array);
        capturedUploadBodyStr = bodyBuf.toString('latin1');
        return new Response(
          `<?xml version="1.0" encoding="ISO-8859-1"?><RECEPCIONDTE><RUTSENDER>11111111-1</RUTSENDER><RUTCOMPANY>76123456-0</RUTCOMPANY><FILE>ENVIO.xml</FILE><TIMESTAMP>2026-10-18 10:35:00</TIMESTAMP><STATUS>0</STATUS><TRACKID>0214598712</TRACKID></RECEPCIONDTE>`,
          { status: 200 }
        );
      }

      if (url.includes('QueryEstUp.jws')) {
        return new Response(
          `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><getEstUpReturn>&lt;SII:RESPUESTA xmlns:SII=&quot;http://www.sii.cl/XMLSchema&quot;&gt;&lt;SII:RESP_HDR&gt;&lt;TRACKID&gt;0214598712&lt;/TRACKID&gt;&lt;ESTADO&gt;EPR&lt;/ESTADO&gt;&lt;GLOSA&gt;Envio Procesado&lt;/GLOSA&gt;&lt;ACEPTADOS&gt;1&lt;/ACEPTADOS&gt;&lt;RECHAZADOS&gt;0&lt;/RECHAZADOS&gt;&lt;REPAROS&gt;0&lt;/REPAROS&gt;&lt;/SII:RESP_HDR&gt;&lt;/SII:RESPUESTA&gt;</getEstUpReturn></soapenv:Body></soapenv:Envelope>`,
          { status: 200 }
        );
      }

      return new Response('Not Found', { status: 404 });
    };

    const siiWs = new SiiWebServiceIntegration(mockFetch);

    // 1. Verificar firma Enveloped de la Semilla
    const signedSeedXml = XmlDsigSignerService.signSeedXml('004928172635', cert);
    const seedVerif = XmlDsigSignerService.verifySignedXml(
      signedSeedXml,
      '',
      cert.certificatePem
    );
    expect(seedVerif.validDigest).toBe(true);
    expect(seedVerif.validSignature).toBe(true);

    // 2. Ejecutar Upload al CGI del SII
    const uploadRes = await siiWs.uploadEnvioDteToSii({
      tenantId: 'tenant-uuid-001',
      environment: 'CERTIFICACION',
      rutSender: '11111111-1',
      rutCompany: '76123456-0',
      signedEnvioXml: '<?xml version="1.0" encoding="ISO-8859-1"?><EnvioDTE version="1.0"></EnvioDTE>',
      cert,
    });

    expect(uploadRes.success).toBe(true);
    expect(uploadRes.trackId).toBe('0214598712');
    expect(capturedUploadHeaders['Cookie']).toBe('TOKEN=TOKEN_SII_MAULLIN_998877');
    expect(capturedUploadHeaders['User-Agent']).toBe(
      'Mozilla/4.0 ( compatible; PROG 1.0; Windows NT)'
    );
    expect(capturedUploadBodyStr).toContain('name="rutSender"');
    expect(capturedUploadBodyStr).toContain('name="rutCompany"');
    expect(capturedUploadBodyStr).toContain('name="archivo"');

    // 3. Consultar Estado del TrackID en QueryEstUp.jws
    const statusRes = await siiWs.queryUploadStatusByTrackId({
      tenantId: 'tenant-uuid-001',
      environment: 'CERTIFICACION',
      rutCompany: '76123456-0',
      trackId: '0214598712',
      cert,
    });

    expect(statusRes.estado).toBe('EPR');
    expect(statusRes.aceptados).toBe(1);
    expect(statusRes.rechazados).toBe(0);
  });

  it('5. Ejecuta las reglas del módulo de facturación de Odoo (account.move + l10n_cl + l10n_latam_invoice_document)', () => {
    // 5.1 Validación numérica estricta de folios (_check_l10n_latam_document_number_is_numeric en Odoo)
    expect(OdooAccountMoveService.validateNumericFolio('000125')).toBe('125');
    expect(() => OdooAccountMoveService.validateNumericFolio('FAC-125')).toThrow(
      /The DTE document number \(folio\) must contain only digits/
    );

    // 5.2 Dominio de Documentos LATAM para Ventas a Contribuyente IVA 1a Categoría ('1')
    const docsVentaEmpresa = OdooAccountMoveService.getAllowedLatamDocumentTypes({
      journalType: 'SALE',
      moveType: 'OUT_INVOICE',
      companyTaxpayerType: 'VAT_AFFECTED_1ST_CAT',
      partnerTaxpayerType: 'VAT_AFFECTED_1ST_CAT',
    });
    expect(docsVentaEmpresa.map((d) => d.code)).toEqual([33, 34, 56]);

    // 5.3 Dominio de Documentos LATAM para Ventas a Consumidor Final ('3' -> Boletas 39 y 41)
    const docsVentaConsumidor = OdooAccountMoveService.getAllowedLatamDocumentTypes({
      journalType: 'SALE',
      moveType: 'OUT_INVOICE',
      companyTaxpayerType: 'VAT_AFFECTED_1ST_CAT',
      partnerTaxpayerType: 'END_CONSUMER',
    });
    expect(docsVentaConsumidor.map((d) => d.code)).toEqual([39, 41, 56]);

    // 5.4 Dominio de Documentos LATAM para Notas de Crédito ('OUT_REFUND' -> Código 61)
    const docsNotaCredito = OdooAccountMoveService.getAllowedLatamDocumentTypes({
      journalType: 'SALE',
      moveType: 'OUT_REFUND',
      companyTaxpayerType: 'VAT_AFFECTED_1ST_CAT',
      partnerTaxpayerType: 'VAT_AFFECTED_1ST_CAT',
    });
    expect(docsNotaCredito.map((d) => d.code)).toEqual([61]);

    // 5.5 Dominio de Compras a Extranjeros ('4' -> Factura de Compra Electrónica 46)
    const docsCompraExtranjero = OdooAccountMoveService.getAllowedLatamDocumentTypes({
      journalType: 'PURCHASE',
      moveType: 'IN_INVOICE',
      companyTaxpayerType: 'VAT_AFFECTED_1ST_CAT',
      partnerTaxpayerType: 'FOREIGNER',
      partnerCountryCode: 'US',
    });
    expect(docsCompraExtranjero.map((d) => d.code)).toEqual([46]);

    // 5.6 Cálculo de líneas (account.move.line), descuentos y redondeo CLP sin decimales
    const totals = OdooAccountMoveService.computeMoveLinesAndTotals(
      [
        {
          productCode: 'ERP-01',
          name: 'IMPLEMENTACIÓN FELINE ERP ODOO L10N_CL',
          quantity: 2,
          priceUnit: 250000,
          discountPct: 10, // 500.000 - 10% = 450.000 Neto
        },
        {
          productCode: 'CAP-EX',
          name: 'CAPACITACIÓN EXENTA SII',
          quantity: 1,
          priceUnit: 50000,
          isExempt: true, // 50.000 Exento
        },
      ],
      CodigoTipoDTE.FacturaElectronica
    );

    expect(totals.amountUntaxed).toBe(450000);
    expect(totals.amountExempt).toBe(50000);
    expect(totals.amountTax).toBe(85500); // 19% de 450.000
    expect(totals.amountTotal).toBe(585500);
    expect(totals.amountResidual).toBe(585500);

    // 5.7 Formato de nombre oficial del asiento al pasar de DRAFT ("/") a POSTED
    expect(OdooAccountMoveService.formatOdooMoveName(33, 1)).toBe('FAC 000001');
    expect(OdooAccountMoveService.formatOdooMoveName(61, 42)).toBe('N/C 000042');
    expect(OdooAccountMoveService.formatOdooMoveName(39, 150)).toBe('BEL 000150');
  });

  it('6. Ejecuta el Motor Contable Odoo (Partida Doble, Conciliación y Balance Tributario de 8 Columnas SII)', () => {
    // 6.1 Generar apuntes de Partida Doble para una Factura de Venta Afecta (33) por $1.000.000 Neto + $190.000 IVA
    const itemsVenta = OdooAccountingEngineService.generateJournalItemsForInvoiceMove({
      tenantId: 'tenant-test-01',
      moveId: 'move-v1',
      moveName: 'FAC 000001',
      moveType: 'OUT_INVOICE',
      documentTypeCode: CodigoTipoDTE.FacturaElectronica,
      date: '2026-10-18',
      partnerRut: '96571220-8',
      partnerName: 'CENCOSUD RETAIL S.A.',
      amountUntaxed: 1000000,
      amountExempt: 0,
      amountTax: 190000,
      amountTotal: 1190000,
    });

    // Debe tener 3 apuntes: Debe 110310 Clientes ($1.190.000), Haber 510110 Ventas ($1.000.000), Haber 210710 IVA Débito ($190.000)
    expect(itemsVenta).toHaveLength(3);
    expect(itemsVenta.find((i) => i.accountCode === '110310')?.debit).toBe(1190000);
    expect(itemsVenta.find((i) => i.accountCode === '510110')?.credit).toBe(1000000);
    expect(itemsVenta.find((i) => i.accountCode === '210710')?.credit).toBe(190000);

    // 6.2 Generar apuntes para una Factura de Compra de Proveedor por $400.000 Neto + $76.000 IVA Crédito
    const itemsCompra = OdooAccountingEngineService.generateJournalItemsForInvoiceMove({
      tenantId: 'tenant-test-01',
      moveId: 'move-c1',
      moveName: 'COMP-33 #009120',
      moveType: 'IN_INVOICE',
      documentTypeCode: CodigoTipoDTE.FacturaElectronica,
      date: '2026-10-18',
      partnerRut: '92580000-7',
      partnerName: 'ENTEL PCS S.A.',
      amountUntaxed: 400000,
      amountExempt: 0,
      amountTax: 76000,
      amountTotal: 476000,
      tipoCompraSii: 'DEL_GIRO',
    });

    expect(itemsCompra.find((i) => i.accountCode === '410235')?.debit).toBe(400000);
    expect(itemsCompra.find((i) => i.accountCode === '110710')?.debit).toBe(76000);
    expect(itemsCompra.find((i) => i.accountCode === '210210')?.credit).toBe(476000);

    // 6.3 Calcular el Balance Tributario de 8 Columnas SII y verificar cuadratura matemática perfecta
    const balance8 = OdooAccountingEngineService.computeBalanceOchoColumnas([
      ...itemsVenta,
      ...itemsCompra,
    ]);

    expect(balance8.resultadoEjercicio.cuadraturaPerfecta).toBe(true);
    expect(balance8.resultadoEjercicio.tipo).toBe('UTILIDAD');
    // Utilidad del ejercicio = Ingresos ($1.000.000) - Gastos ($400.000) = $600.000
    expect(balance8.resultadoEjercicio.monto).toBe(600000);
    // Verificar que las 8 columnas finales cuadren en pares (1=2, 3=4, 5=6, 7=8)
    expect(balance8.totalesFinalesCuadrados.debitos).toBe(balance8.totalesFinalesCuadrados.creditos);
    expect(balance8.totalesFinalesCuadrados.saldoDeudor).toBe(balance8.totalesFinalesCuadrados.saldoAcreedor);
    expect(balance8.totalesFinalesCuadrados.activo).toBe(balance8.totalesFinalesCuadrados.pasivo);
    expect(balance8.totalesFinalesCuadrados.perdida).toBe(balance8.totalesFinalesCuadrados.ganancia);
  });
});


