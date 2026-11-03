import { describe, it, expect, afterEach } from 'vitest';
import forge from 'node-forge';
import crypto from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import { C14nCanonicalization } from 'xml-crypto';
import { findAncestorNsForElement } from 'xml-crypto/lib/utils';
import { CryptoVaultService, UnpackedCertificate } from '../src/core/crypto-vault';
import { CafTedService } from '../src/services/caf-ted.service';
import { DteXmlBuilderService } from '../src/services/dte-xml-builder.service';
import { XmlDsigSignerService } from '../src/services/xmldsig-signer.service';
import { SiiWebServiceIntegration } from '../src/services/sii-webservice.service';
import { DteBillingOrchestratorService } from '../src/services/dte-orchestrator.service';
import { OdooAccountMoveService } from '../src/services/odoo-account-move.service';
import { OdooAccountingEngineService } from '../src/services/odoo-accounting-engine.service';
import { FelineLiveSandboxStore } from '../src/services/feline-live-sandbox.service';
import { buildFastifyApp } from '../src/server';
import { CodigoTipoDTE } from '../src/types/sii-dte.types';
import {
  encodeToIso88591Buffer,
  escapeXmlSiiText,
  formatSiiTimestamp,
} from '../src/utils/sii-normative.utils';

// ============================================================================
// PRUEBAS DE REGRESIÓN: cada caso reproduce una falla detectada en la auditoría
// ============================================================================

function generateCert(): UnpackedCertificate {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86400000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86400000);
  const attrs = [{ name: 'commonName', value: 'FIRMANTE TEST' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'x', { algorithm: '3des' });
  return CryptoVaultService.unpackPkcs12(
    Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'),
    'x'
  );
}

function generateCaf(tipoDte: CodigoTipoDTE) {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 1024,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return CafTedService.parseAutorizacionCafXml(
    `<AUTORIZACION><CAF version="1.0"><DA><RE>76123456-0</RE><RS>EMISOR</RS><TD>${tipoDte}</TD>` +
      `<RNG><D>1</D><H>100</H></RNG><FA>2026-10-01</FA><RSAPK><M>AQAB</M><E>Aw==</E></RSAPK>` +
      `<IDK>100</IDK></DA><FRMA algoritmo="SHA1withRSA">AA==</FRMA></CAF>` +
      `<RSASK>${privateKey}</RSASK></AUTORIZACION>`
  );
}

/**
 * Digest SII calculado con una C14N 1.0 independiente (xml-crypto) sobre bytes ISO-8859-1.
 * Si coincide con el <DigestValue> del proyecto, la canonicalización manual es correcta.
 */
function independentDigest(xml: string, tagName: string, id: string): string {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const nodes = Array.from(doc.getElementsByTagName(tagName));
  const node = nodes.find((n) => n.getAttribute('ID') === id)!;
  const c14n = new C14nCanonicalization().process(node as any, {
    ancestorNamespaces: findAncestorNsForElement(node as any),
  });
  return crypto.createHash('sha1').update(encodeToIso88591Buffer(c14n)).digest('base64');
}

function buildSignedEnvio(razonSocialReceptor: string, cert: UnpackedCertificate) {
  const caf = generateCaf(CodigoTipoDTE.FacturaElectronica);
  const { docId, unsignedDteXml } = DteXmlBuilderService.buildDocumentoXml({
    idDoc: { TipoDTE: 33, Folio: 1, FchEmis: '2026-10-19', FmaPago: 1 },
    emisor: {
      RUTEmisor: '76123456-0',
      RznSoc: 'COMERCIALIZADORA ÑUBLE SPA',
      GiroEmis: 'SOFTWARE',
      Acteco: [620100],
      DirOrigen: 'AV. PROVIDENCIA 1234',
      CmnaOrigen: 'PROVIDENCIA',
    },
    receptor: {
      RUTRecep: '60803000-K',
      RznSocRecep: razonSocialReceptor,
      GiroRecep: 'SERVICIOS',
      DirRecep: 'TEATINOS 120',
      CmnaRecep: 'SANTIAGO',
    },
    totales: { MntNeto: 1000, TasaIVA: 19, IVA: 190, MntTotal: 1190 },
    detalles: [{ NroLinDet: 1, NmbItem: 'ITEM', QtyItem: 1, PrcItem: 1000, MontoItem: 1000 }],
    caf,
    timestampFirma: '2026-10-19T10:00:00',
  });
  const signedDte = XmlDsigSignerService.signDteXml(unsignedDteXml, docId, cert, true);
  const { setDocId, unsignedEnvioXml } = DteXmlBuilderService.buildEnvioLoteXml({
    caratula: {
      RutEmisor: '76123456-0',
      RutEnvia: '11111111-1',
      RutReceptor: '60803000-K',
      FchResol: '2026-01-15',
      NroResol: 0,
      TmstFirmaEnv: '2026-10-19T10:01:00',
      SubTotDTE: [{ TpoDTE: 33, NroDTE: 1 }],
    },
    signedDtesXml: [signedDte],
  });
  const signedEnvio = XmlDsigSignerService.signEnvioLoteXml(unsignedEnvioXml, setDocId, cert);
  return { docId, setDocId, signedEnvio };
}

describe('Regresiones SII detectadas en auditoría', () => {
  const cert = generateCert();

  it.each([
    ['nombre sin caracteres especiales', 'SERVICIO DE IMPUESTOS INTERNOS'],
    ['nombre con apóstrofo, comillas y &', `CAFÉ O'HIGGINS & "CÍA" LTDA`],
  ])('Firma XMLDSig coincide con C14N independiente (%s)', (_caso, razonSocial) => {
    const { docId, setDocId, signedEnvio } = buildSignedEnvio(razonSocial, cert);
    const digests = [...signedEnvio.matchAll(/<DigestValue>([^<]+)<\/DigestValue>/g)].map(
      (m) => m[1]
    );
    // El DTE se firma de forma aislada (antes de entrar al sobre) con solo el namespace del SII,
    // por lo que se canonicaliza en ese contexto. El primer <Signature> es el del DTE.
    const dteStandalone = signedEnvio
      .match(/<DTE version="1.0">[\s\S]*?<\/DTE>/)![0]
      .replace('<DTE version="1.0">', '<DTE xmlns="http://www.sii.cl/SiiDte" version="1.0">');
    expect(independentDigest(dteStandalone, 'Documento', docId)).toBe(digests[0]);
    expect(independentDigest(signedEnvio, 'SetDTE', setDocId)).toBe(digests[digests.length - 1]);
  });

  it('Normaliza caracteres fuera de ISO-8859-1 en vez de convertirlos en "?"', () => {
    expect(escapeXmlSiiText('Servicio – “Premium” … ’24')).toBe('Servicio - "Premium" ... \'24');
    expect(escapeXmlSiiText('Pago 🚀 OK')).toBe('Pago  OK');
    expect(escapeXmlSiiText('A & B < C')).toBe('A &amp; B &lt; C');
  });

  it('Timestamp SII usa la hora oficial de Chile (America/Santiago), no la del servidor', () => {
    // 2026-10-19 03:00 UTC = 00:00 en Chile continental (UTC-3, horario de verano)
    expect(formatSiiTimestamp(new Date('2026-10-19T03:00:00Z'))).toBe('2026-10-19T00:00:00');
  });

  describe('Bóveda criptográfica', () => {
    const prevEnv = { ...process.env };
    afterEach(() => {
      process.env = { ...prevEnv };
    });

    it('En producción se niega a operar sin TENANT_VAULT_MASTER_KEY', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.TENANT_VAULT_MASTER_KEY;
      expect(() => new CryptoVaultService()).toThrow(/TENANT_VAULT_MASTER_KEY/);
    });
  });

  describe('Boleta Electrónica (39)', () => {
    it('Totales: MontoItem es bruto (IVA incluido) y se desglosa Neto + IVA', () => {
      const totales = DteBillingOrchestratorService.calcularTotalesSii(
        CodigoTipoDTE.BoletaElectronica,
        [{ NroLinDet: 1, NmbItem: 'CAFÉ', QtyItem: 1, PrcItem: 11900, MontoItem: 11900 }]
      );
      expect(totales).toMatchObject({ mntNeto: 10000, iva: 1900, mntExento: 0, mntTotal: 11900 });
    });

    it('Totales de Factura (33) siguen calculándose sobre neto', () => {
      const totales = DteBillingOrchestratorService.calcularTotalesSii(
        CodigoTipoDTE.FacturaElectronica,
        [{ NroLinDet: 1, NmbItem: 'X', QtyItem: 1, PrcItem: 10000, MontoItem: 10000 }]
      );
      expect(totales).toMatchObject({ mntNeto: 10000, iva: 1900, mntTotal: 11900 });
    });

    it('Las líneas contables se convierten a <Detalle> con precio bruto en boletas', () => {
      const line = {
        sequence: 1,
        name: 'CAFÉ',
        quantity: 2,
        uomName: 'UN',
        priceUnit: 5000,
        discountPct: 0,
        discountFixed: 0,
        isExempt: false,
        priceSubtotal: 10000,
        priceTotal: 11900,
      };
      const [boleta] = OdooAccountMoveService.toDetallesSii([line], CodigoTipoDTE.BoletaElectronica);
      expect(boleta).toMatchObject({ PrcItem: 5950, MontoItem: 11900 });
      const [factura] = OdooAccountMoveService.toDetallesSii([line], CodigoTipoDTE.FacturaElectronica);
      expect(factura).toMatchObject({ PrcItem: 5000, MontoItem: 10000 });
    });

    it('El envío de boletas usa la API REST del SII (no el CGI DTEUpload)', async () => {
      const calls: Array<{ url: string; method: string }> = [];
      const mockFetch: typeof fetch = async (input, init) => {
        const url = String(input);
        calls.push({ url, method: init?.method ?? 'GET' });
        if (url.endsWith('boleta.electronica.semilla')) {
          return new Response(
            '<?xml version="1.0" encoding="UTF-8"?><SII:RESPUESTA xmlns:SII="http://www.sii.cl/XMLSchema"><SII:RESP_BODY><SEMILLA>012345678901</SEMILLA></SII:RESP_BODY><SII:RESP_HDR><ESTADO>00</ESTADO></SII:RESP_HDR></SII:RESPUESTA>'
          );
        }
        if (url.endsWith('boleta.electronica.token')) {
          return new Response(
            '<?xml version="1.0" encoding="UTF-8"?><SII:RESPUESTA xmlns:SII="http://www.sii.cl/XMLSchema"><SII:RESP_BODY><TOKEN>TOKBOL123</TOKEN></SII:RESP_BODY><SII:RESP_HDR><ESTADO>00</ESTADO></SII:RESP_HDR></SII:RESPUESTA>'
          );
        }
        if (url.endsWith('boleta.electronica.envio')) {
          return new Response(
            JSON.stringify({ rut_emisor: '76123456-0', trackid: 987654, estado: 'REC', fecha_recepcion: '2026-10-19 10:00:00' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`URL inesperada: ${url}`);
      };

      const ws = new SiiWebServiceIntegration(mockFetch);
      const result = await ws.uploadEnvioBoletaToSii({
        tenantId: 't1',
        environment: 'CERTIFICACION',
        rutSender: '11111111-1',
        rutCompany: '76123456-0',
        signedEnvioXml: '<EnvioBOLETA></EnvioBOLETA>',
        cert,
      });

      expect(result).toMatchObject({ success: true, trackId: '987654', status: 'REC' });
      expect(calls.map((c) => c.url)).toEqual([
        'https://apicert.sii.cl/recursos/v1/boleta.electronica.semilla',
        'https://apicert.sii.cl/recursos/v1/boleta.electronica.token',
        'https://pangal.sii.cl/recursos/v1/boleta.electronica.envio',
      ]);
      expect(calls.some((c) => c.url.includes('DTEUpload'))).toBe(false);
    });
  });

  describe('Asignación de folios CAF', () => {
    it('Marca como agotado un CAF sin folios aunque la asignación falle', async () => {
      const committed: any[] = [];
      const fakePrisma: any = {
        // Simula rollback: las escrituras solo se confirman si el callback termina sin error
        $transaction: async (fn: (tx: any) => Promise<any>) => {
          const pending: any[] = [];
          const tx = {
            $queryRaw: async () => [
              { id: 'caf-1', folio_desde: 1, folio_hasta: 10, folio_actual: 10 },
            ],
            cafFolio: { update: async (args: any) => pending.push(args) },
          };
          const result = await fn(tx);
          committed.push(...pending);
          return result;
        },
      };
      const service = new CafTedService(fakePrisma, new CryptoVaultService('a'.repeat(64)));
      await expect(service.allocateNextFolio('t1', 33)).rejects.toThrow(/límite máximo/);
      expect(committed).toEqual([
        { where: { id: 'caf-1' }, data: { agotado: true, activo: false } },
      ]);
    });
  });

  describe('Publicación de facturas (action_post)', () => {
    it('Dos publicaciones simultáneas del mismo borrador emiten un solo DTE', async () => {
      const move: any = {
        id: 'm1',
        tenantId: 't1',
        partnerId: 'p1',
        name: '/',
        state: 'DRAFT',
        documentTypeCode: 33,
        invoiceDate: new Date('2026-10-19'),
        invoiceDateDue: null,
        formaPagoSii: 1,
        lines: [
          {
            sequence: 1, productCode: null, name: 'X', description: null, quantity: 1,
            uomName: 'UN', priceUnit: 1000, discountPct: 0, discountFixed: 0,
            isExempt: false, priceSubtotal: 1000, priceTotal: 1190,
          },
        ],
        references: [],
      };
      const fakePrisma: any = {
        accountMove: {
          findFirst: async () => ({ ...move }),
          updateMany: async ({ where, data }: any) => {
            await new Promise((r) => setTimeout(r, 5));
            if (move.state === where.state && move.name === where.name) {
              Object.assign(move, data);
              return { count: 1 };
            }
            return { count: 0 };
          },
          update: async ({ data }: any) => Object.assign(move, data),
        },
      };
      let emitted = 0;
      const fakeOrchestrator: any = {
        emitirYFirmarDte: async () => {
          emitted++;
          await new Promise((r) => setTimeout(r, 10));
          return { id: `dte-${emitted}`, folio: emitted };
        },
      };
      const service = new OdooAccountMoveService(fakePrisma, fakeOrchestrator);
      const results = await Promise.allSettled([
        service.actionPost('t1', 'm1'),
        service.actionPost('t1', 'm1'),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(emitted).toBe(1);
      expect(move.state).toBe('POSTED');
    });
  });

  describe('Compras con IVA no recuperable', () => {
    it('El IVA no recuperable va al gasto y no al crédito fiscal (110710)', () => {
      const items = OdooAccountingEngineService.generateJournalItemsForInvoiceMove({
        tenantId: 't1',
        moveId: 'm1',
        moveName: 'COMP-33 #000001',
        moveType: 'IN_INVOICE',
        documentTypeCode: 33,
        date: '2026-10-19',
        partnerRut: '96571220-8',
        partnerName: 'PROVEEDOR',
        amountUntaxed: 100000,
        amountExempt: 0,
        amountTax: 19000,
        amountTotal: 119000,
        tipoCompraSii: 'IVA_NO_RECUPERABLE',
      });
      expect(items.find((i) => i.accountCode === '110710')).toBeUndefined();
      expect(items.find((i) => i.accountCode === '410235')?.debit).toBe(119000);
    });

    it('El F29 no suma IVA no recuperable como crédito fiscal', () => {
      const store = new FelineLiveSandboxStore();
      const tenantId = store.tenants[0].id;
      const antes = store.getLibroCompraVentaAndF29(tenantId, '2026-11').f29;
      store.registerSupplierPurchaseDoc({
        tenantId,
        supplierRut: '96571220-8',
        documentTypeCode: 33,
        folioProveedor: '555',
        invoiceDate: '2026-11-05',
        itemName: 'ALMUERZO',
        amountNeto: 100000,
        tipoCompraSii: 'IVA_NO_RECUPERABLE',
      });
      const despues = store.getLibroCompraVentaAndF29(tenantId, '2026-11').f29;
      expect(despues.codigo511_CreditoRecibidas).toBe(antes.codigo511_CreditoRecibidas);
    });
  });
  describe('API REST', () => {
    it('Datos inválidos al crear empresa responden 400 (no 500)', async () => {
      // El alta de empresas exige token de administrador (auditoría ACF, grupo 1)
      const tokenPrevio = process.env.FELINE_ADMIN_TOKEN;
      process.env.FELINE_ADMIN_TOKEN = 'token-de-prueba';
      const headers = { authorization: 'Bearer token-de-prueba' };
      const app = buildFastifyApp();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers,
        payload: { rut: '76123456-0' },
      });
      expect(res.statusCode).toBe(400);

      const badRut = await app.inject({
        method: 'POST',
        url: '/api/v1/tenants',
        headers,
        payload: {
          rut: '76123456-9', razonSocial: 'EMPRESA', giro: 'GIRO', acteco: [620100],
          direccionOrigen: 'DIR', comunaOrigen: 'STGO', ciudadOrigen: 'STGO',
          fchResol: '2026-01-01', nroResol: 0, rutEnvia: '11111111-1',
        },
      });
      expect(badRut.statusCode).toBe(400);
      expect(badRut.json().error).toMatch(/Dígito verificador/);
      await app.close();
      if (tokenPrevio === undefined) delete process.env.FELINE_ADMIN_TOKEN;
      else process.env.FELINE_ADMIN_TOKEN = tokenPrevio;
    });
  });
});
