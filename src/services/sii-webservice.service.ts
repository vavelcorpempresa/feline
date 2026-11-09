import { AmbienteSII, SII_ENDPOINTS } from '../types/sii-dte.types';
import { UnpackedCertificate } from '../core/crypto-vault';
import { XmlDsigSignerService } from './xmldsig-signer.service';
import {
  decodeFromIso88591Buffer,
  encodeToIso88591Buffer,
  splitRut,
} from '../utils/sii-normative.utils';

// ============================================================================
// SERVICIO DE INTEGRACIÓN CON WEB SERVICES SOAP Y REST/CGI DEL SII CHILE
// Soporta múltiples contribuyentes (Tenants) concurrentes con caché de Token aislada
// ============================================================================

interface CachedTenantToken {
  token: string;
  expiresAt: number;
}

export interface SiiUploadResult {
  success: boolean;
  trackId?: string;
  status: string;
  rawResponse: string;
  timestamp: string;
}

export interface SiiStatusQueryResult {
  estado: string;          // Ej: EPR (Envío Procesado), DOK (Documento OK), RCH (Rechazado)
  glosa: string;
  aceptados: number;
  rechazados: number;
  reparos: number;
  rawXml: string;
}

export class SiiWebServiceIntegration {
  // Caché de tokens en memoria aislada por clave `${tenantId}:${environment}:${channel}`
  private readonly tokenCache = new Map<string, CachedTenantToken>();

  /**
   * Permite inyectar un cliente HTTP personalizado (fetch) para pruebas unitarias / mocks
   * o utilizar el `fetch` nativo de Node.js 20+ en producción.
   */
  private readonly httpClient: typeof fetch;

  constructor(httpClient: typeof fetch = globalThis.fetch) {
    this.httpClient = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      const productivos = new Set(['palena.sii.cl', 'api.sii.cl', 'rahue.sii.cl']);
      if (productivos.has(url.hostname) && process.env.FELINE_SII_PRODUCCION_AUTORIZADA !== 'SI_AUTORIZO_PRODUCCION') {
        throw new Error('SII producción bloqueado: se requiere autorización expresa y configuración del operador.');
      }
      // No seguir redirecciones a un ambiente distinto del solicitado.
      return httpClient(input, { ...init, redirect: 'error' });
    };
  }

  /**
   * 1. Solicita una Semilla (`getSeed`) al Web Service SOAP `CrSeed.jws` del SII.
   */
  public async requestSoapSeed(environment: AmbienteSII): Promise<string> {
    const url = SII_ENDPOINTS[environment].SOAP_SEED_URL;
    const soapEnvelope =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
      `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
      `xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ` +
      `xmlns:def="http://DefaultNamespace">` +
      `<soapenv:Header/>` +
      `<soapenv:Body>` +
      `<def:getSeed soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"/>` +
      `</soapenv:Body>` +
      `</soapenv:Envelope>`;

    const response = await this.httpClient(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        SOAPAction: '',
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} al solicitar semilla SOAP al SII (${url}).`);
    }

    const rawSoapResponse = await response.text();
    const decodedXml = SiiWebServiceIntegration.unescapeSoapInnerXml(rawSoapResponse);

    const estadoMatch = decodedXml.match(/<ESTADO>([^<]+)<\/ESTADO>/);
    const semillaMatch = decodedXml.match(/<SEMILLA>([^<]+)<\/SEMILLA>/);

    if (!estadoMatch || estadoMatch[1].trim() !== '00' || !semillaMatch) {
      throw new Error(
        `El SII rechazó la entrega de Semilla SOAP. Respuesta: ${decodedXml}`
      );
    }

    return semillaMatch[1].trim();
  }

  /**
   * 2. Firma la semilla con el certificado del Tenant y la intercambia por un Token (`getToken`)
   * en `GetTokenFromSeed.jws`. Gestiona caché aislada por Tenant (TTL 45 minutos).
   */
  public async getAuthenticatedTokenForTenant(
    tenantId: string,
    environment: AmbienteSII,
    cert: UnpackedCertificate
  ): Promise<string> {
    const cacheKey = `${tenantId}:${environment}:SOAP`;
    const cached = this.tokenCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.token;
    }

    const seed = await this.requestSoapSeed(environment);
    const signedSeedXml = XmlDsigSignerService.signSeedXml(seed, cert);

    // Escapar el XML firmado para enviarlo como argumento string `pszXml` dentro del cuerpo SOAP RPC
    const escapedSignedSeed = signedSeedXml
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const url = SII_ENDPOINTS[environment].SOAP_TOKEN_URL;
    const soapEnvelope =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
      `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
      `xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ` +
      `xmlns:def="http://DefaultNamespace">` +
      `<soapenv:Header/>` +
      `<soapenv:Body>` +
      `<def:getToken soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">` +
      `<pszXml xsi:type="xsd:string">${escapedSignedSeed}</pszXml>` +
      `</def:getToken>` +
      `</soapenv:Body>` +
      `</soapenv:Envelope>`;

    const response = await this.httpClient(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        SOAPAction: '',
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} al solicitar Token SOAP al SII (${url}).`);
    }

    const rawSoapResponse = await response.text();
    const decodedXml = SiiWebServiceIntegration.unescapeSoapInnerXml(rawSoapResponse);

    const estadoMatch = decodedXml.match(/<ESTADO>([^<]+)<\/ESTADO>/);
    const tokenMatch = decodedXml.match(/<TOKEN>([^<]+)<\/TOKEN>/);

    if (!estadoMatch || estadoMatch[1].trim() !== '00' || !tokenMatch) {
      throw new Error(
        `Error de autenticación en SII GetTokenFromSeed para Tenant ${tenantId}: ${decodedXml}`
      );
    }

    const token = tokenMatch[1].trim();

    // Guardar en caché por 45 minutos (el token SII expira a los 60 min de inactividad)
    this.tokenCache.set(cacheKey, {
      token,
      expiresAt: now + 45 * 60 * 1000,
    });

    return token;
  }

  /**
   * 3. Envía un lote `EnvioDTE` al CGI del SII (`/cgi_dte/UPL/DTEUpload`)
   * cumpliendo estrictamente el formato `multipart/form-data` con saltos `\r\n`,
   * codificación `ISO-8859-1` y cabecera `User-Agent: Mozilla/4.0 ( compatible; PROG 1.0; Windows NT)`.
   */
  public async uploadEnvioDteToSii(params: {
    tenantId: string;
    environment: AmbienteSII;
    rutSender: string;
    rutCompany: string;
    signedEnvioXml: string;
    cert: UnpackedCertificate;
    filename?: string;
  }): Promise<SiiUploadResult> {
    const {
      tenantId,
      environment,
      rutSender,
      rutCompany,
      signedEnvioXml,
      cert,
      filename = `ENVIO_DTE_${Date.now()}.xml`,
    } = params;

    const token = await this.getAuthenticatedTokenForTenant(tenantId, environment, cert);
    const { boundary, body } = SiiWebServiceIntegration.buildUploadMultipart(
      rutSender,
      rutCompany,
      signedEnvioXml,
      filename
    );
    const endpoint = SII_ENDPOINTS[environment];

    const response = await this.httpClient(endpoint.CGI_DTE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Accept: 'image/gif, image/x-xbitmap, image/jpeg, image/pjpeg, application/vnd.ms-powerpoint, application/ms-excel, application/msword, */*',
        Referer: `https://${endpoint.CGI_DTE_HOST}`,
        'Accept-Language': 'es-cl',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'User-Agent': 'Mozilla/4.0 ( compatible; PROG 1.0; Windows NT)',
        Cookie: `TOKEN=${token}`,
      },
      body,
    });

    const responseArrayBuffer = await response.arrayBuffer();
    const rawResponse = decodeFromIso88591Buffer(Buffer.from(responseArrayBuffer));

    // Parsear <RECEPCIONDTE><STATUS>0</STATUS><TRACKID>...</TRACKID></RECEPCIONDTE>
    const statusMatch = rawResponse.match(/<STATUS>([^<]+)<\/STATUS>/);
    const trackIdMatch = rawResponse.match(/<TRACKID>([^<]+)<\/TRACKID>/);
    const timestampMatch = rawResponse.match(/<TIMESTAMP>([^<]+)<\/TIMESTAMP>/);

    const status = statusMatch ? statusMatch[1].trim() : 'UNKNOWN';
    const trackId = trackIdMatch ? trackIdMatch[1].trim() : undefined;

    return {
      success: status === '0' && Boolean(trackId),
      trackId,
      status,
      rawResponse,
      timestamp: timestampMatch ? timestampMatch[1].trim() : new Date().toISOString(),
    };
  }

  /**
   * Construye el cuerpo `multipart/form-data` con el orden exacto exigido por el SII
   * (rutSender, dvSender, rutCompany, dvCompany, archivo), saltos `\r\n` y el XML en ISO-8859-1.
   * Es el mismo formato para el CGI DTEUpload y para la API REST de Boletas.
   */
  private static buildUploadMultipart(
    rutSender: string,
    rutCompany: string,
    signedEnvioXml: string,
    filename: string
  ): { boundary: string; body: Uint8Array<ArrayBuffer> } {
    const sender = splitRut(rutSender);
    const company = splitRut(rutCompany);

    const boundary = `------------------------SiiDteBoundary${Date.now().toString(16)}`;
    const CRLF = '\r\n';

    const fields = [
      { name: 'rutSender', value: sender.numero },
      { name: 'dvSender', value: sender.dv },
      { name: 'rutCompany', value: company.numero },
      { name: 'dvCompany', value: company.dv },
    ];

    let multipartHeaderStr = '';
    for (const field of fields) {
      multipartHeaderStr += `--${boundary}${CRLF}`;
      multipartHeaderStr += `Content-Disposition: form-data; name="${field.name}"${CRLF}${CRLF}`;
      multipartHeaderStr += `${field.value}${CRLF}`;
    }

    multipartHeaderStr += `--${boundary}${CRLF}`;
    multipartHeaderStr += `Content-Disposition: form-data; name="archivo"; filename="${filename}"${CRLF}`;
    multipartHeaderStr += `Content-Type: text/xml${CRLF}${CRLF}`;

    const multipartFooterStr = `${CRLF}--${boundary}--${CRLF}`;

    // Convertir el XML firmado a bytes ISO-8859-1 puros para mantener intacta la firma XMLDSig
    // Uint8Array respaldado por ArrayBuffer: tipo de cuerpo aceptado por `fetch`
    const body = Uint8Array.from(
      Buffer.concat([
        Buffer.from(multipartHeaderStr, 'ascii'),
        encodeToIso88591Buffer(signedEnvioXml),
        Buffer.from(multipartFooterStr, 'ascii'),
      ])
    );

    return { boundary, body };
  }

  /**
   * Obtiene el Token de la API REST de Boleta Electrónica (`boleta.electronica.semilla` +
   * `boleta.electronica.token`). Es independiente del token SOAP de DTE.
   */
  public async getBoletaTokenForTenant(
    tenantId: string,
    environment: AmbienteSII,
    cert: UnpackedCertificate
  ): Promise<string> {
    const cacheKey = `${tenantId}:${environment}:BOLETA_REST`;
    const cached = this.tokenCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.token;
    }

    const endpoint = SII_ENDPOINTS[environment];
    const seedResponse = await this.httpClient(endpoint.BOLETA_REST_SEED_URL, {
      method: 'GET',
      headers: { Accept: 'application/xml' },
    });
    if (!seedResponse.ok) {
      throw new Error(`Error HTTP ${seedResponse.status} al solicitar semilla de Boleta al SII.`);
    }
    const seedXml = await seedResponse.text();
    const semillaMatch = seedXml.match(/<SEMILLA>([^<]+)<\/SEMILLA>/);
    const seedEstado = seedXml.match(/<ESTADO>([^<]+)<\/ESTADO>/);
    if (!semillaMatch || seedEstado?.[1].trim() !== '00') {
      throw new Error(`El SII rechazó la entrega de Semilla de Boleta. Respuesta: ${seedXml}`);
    }

    const signedSeedXml = XmlDsigSignerService.signSeedXml(semillaMatch[1].trim(), cert);
    const tokenResponse = await this.httpClient(endpoint.BOLETA_REST_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml', Accept: 'application/xml' },
      body: signedSeedXml,
    });
    if (!tokenResponse.ok) {
      throw new Error(`Error HTTP ${tokenResponse.status} al solicitar Token de Boleta al SII.`);
    }
    const tokenXml = await tokenResponse.text();
    const tokenMatch = tokenXml.match(/<TOKEN>([^<]+)<\/TOKEN>/);
    const tokenEstado = tokenXml.match(/<ESTADO>([^<]+)<\/ESTADO>/);
    if (!tokenMatch || tokenEstado?.[1].trim() !== '00') {
      throw new Error(`Error de autenticación en API Boleta SII para Tenant ${tenantId}: ${tokenXml}`);
    }

    const token = tokenMatch[1].trim();
    this.tokenCache.set(cacheKey, { token, expiresAt: now + 45 * 60 * 1000 });
    return token;
  }

  /**
   * Envía un sobre `EnvioBOLETA` a la API REST del SII (`boleta.electronica.envio`).
   * Las Boletas 39/41 NO se aceptan por el CGI DTEUpload.
   */
  public async uploadEnvioBoletaToSii(params: {
    tenantId: string;
    environment: AmbienteSII;
    rutSender: string;
    rutCompany: string;
    signedEnvioXml: string;
    cert: UnpackedCertificate;
    filename?: string;
  }): Promise<SiiUploadResult> {
    const {
      tenantId,
      environment,
      rutSender,
      rutCompany,
      signedEnvioXml,
      cert,
      filename = `ENVIO_BOLETA_${Date.now()}.xml`,
    } = params;

    const token = await this.getBoletaTokenForTenant(tenantId, environment, cert);
    const { boundary, body } = SiiWebServiceIntegration.buildUploadMultipart(
      rutSender,
      rutCompany,
      signedEnvioXml,
      filename
    );

    const response = await this.httpClient(SII_ENDPOINTS[environment].BOLETA_REST_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'User-Agent': 'Mozilla/4.0 ( compatible; PROG 1.0; Windows NT)',
        Cookie: `TOKEN=${token}`,
      },
      body,
    });

    const rawResponse = await response.text();
    let json: { trackid?: number | string; estado?: string; fecha_recepcion?: string } = {};
    try {
      json = JSON.parse(rawResponse);
    } catch {
      // Respuesta no JSON (error HTTP o HTML del SII): se informa como fallida
    }

    const trackId = json.trackid !== undefined ? String(json.trackid) : undefined;
    const status = json.estado ?? `HTTP_${response.status}`;

    return {
      success: response.ok && Boolean(trackId),
      trackId,
      status,
      rawResponse,
      timestamp: json.fecha_recepcion ?? new Date().toISOString(),
    };
  }

  /**
   * Consulta el estado de un envío de Boletas por TrackID en la API REST
   * (`GET boleta.electronica.envio/{rut}-{dv}-{trackid}`).
   */
  public async queryBoletaStatusByTrackId(params: {
    tenantId: string;
    environment: AmbienteSII;
    rutCompany: string;
    trackId: string;
    cert: UnpackedCertificate;
  }): Promise<{ estado: string; raw: unknown }> {
    const { tenantId, environment, rutCompany, trackId, cert } = params;
    const token = await this.getBoletaTokenForTenant(tenantId, environment, cert);
    const company = splitRut(rutCompany);
    const url = `${SII_ENDPOINTS[environment].BOLETA_REST_STATUS_URL}/${company.numero}-${company.dv}-${trackId}`;

    const response = await this.httpClient(url, {
      method: 'GET',
      headers: { Accept: 'application/json', Cookie: `TOKEN=${token}` },
    });
    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} al consultar estado de Boletas (TrackID ${trackId}).`);
    }
    const raw = (await response.json()) as { estado?: string };
    return { estado: raw.estado ?? 'UNK', raw };
  }

  /**
   * 4. Consulta el estado asíncrono de un envío masivo (`TrackID`) mediante `QueryEstUp.jws`
   */
  public async queryUploadStatusByTrackId(params: {
    tenantId: string;
    environment: AmbienteSII;
    rutCompany: string;
    trackId: string;
    cert: UnpackedCertificate;
  }): Promise<SiiStatusQueryResult> {
    const { tenantId, environment, rutCompany, trackId, cert } = params;
    const token = await this.getAuthenticatedTokenForTenant(tenantId, environment, cert);
    const company = splitRut(rutCompany);

    const url = SII_ENDPOINTS[environment].SOAP_QUERY_UP_URL;
    const soapEnvelope =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
      `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
      `xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ` +
      `xmlns:def="http://DefaultNamespace">` +
      `<soapenv:Header/>` +
      `<soapenv:Body>` +
      `<def:getEstUp soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">` +
      `<RutCompania xsi:type="xsd:string">${company.numero}</RutCompania>` +
      `<DvCompania xsi:type="xsd:string">${company.dv}</DvCompania>` +
      `<TrackId xsi:type="xsd:string">${trackId}</TrackId>` +
      `<Token xsi:type="xsd:string">${token}</Token>` +
      `</def:getEstUp>` +
      `</soapenv:Body>` +
      `</soapenv:Envelope>`;

    const response = await this.httpClient(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        SOAPAction: '',
      },
      body: soapEnvelope,
    });

    const rawSoap = await response.text();
    const decodedXml = SiiWebServiceIntegration.unescapeSoapInnerXml(rawSoap);

    const extractTag = (tag: string, fallback: string = '') => {
      const match = decodedXml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return match ? match[1].trim() : fallback;
    };

    return {
      estado: extractTag('ESTADO', 'UNK'),
      glosa: extractTag('GLOSA', 'Sin glosa informada por el SII'),
      aceptados: parseInt(extractTag('ACEPTADOS', '0'), 10),
      rechazados: parseInt(extractTag('RECHAZADOS', '0'), 10),
      reparos: parseInt(extractTag('REPAROS', '0'), 10),
      rawXml: decodedXml,
    };
  }

  /**
   * Desescapa entidades XML dentro de la respuesta SOAP (`&lt;SII:RESPUESTA...&gt;`)
   */
  public static unescapeSoapInnerXml(soapXml: string): string {
    return soapXml
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }
}
