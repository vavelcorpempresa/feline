// ============================================================================
// TIPADOS NORMATIVOS SII CHILE - ESQUEMAS DTE_v10.xsd, EnvioDTE_v10.xsd, SiiTypes_v10.xsd
// Metodología REA (Recuperación y Empleo de Antecedentes)
// ============================================================================

/**
 * Códigos oficiales de Documentos Tributarios Electrónicos del SII
 */
export enum CodigoTipoDTE {
  FacturaElectronica = 33,
  FacturaNoAfectaOExenta = 34,
  BoletaElectronica = 39,
  BoletaNoAfectaOExenta = 41,
  FacturaCompraElectronica = 46,
  GuiaDespachoElectronica = 52,
  NotaDebitoElectronica = 56,
  NotaCreditoElectronica = 61,
}

export type AmbienteSII = 'CERTIFICACION' | 'PRODUCCION';

/**
 * Endpoints oficiales del SII según ambiente y naturaleza del documento
 */
export const SII_ENDPOINTS = {
  CERTIFICACION: {
    SOAP_SEED_URL: 'https://maullin.sii.cl/DTEWS/CrSeed.jws',
    SOAP_TOKEN_URL: 'https://maullin.sii.cl/DTEWS/GetTokenFromSeed.jws',
    SOAP_QUERY_UP_URL: 'https://maullin.sii.cl/DTEWS/QueryEstUp.jws',
    SOAP_QUERY_DTE_URL: 'https://maullin.sii.cl/DTEWS/QueryEstDte.jws',
    CGI_DTE_UPLOAD_URL: 'https://maullin.sii.cl/cgi_dte/UPL/DTEUpload',
    CGI_DTE_HOST: 'maullin.sii.cl',
    BOLETA_REST_SEED_URL: 'https://apicert.sii.cl/recursos/v1/boleta.electronica.semilla',
    BOLETA_REST_TOKEN_URL: 'https://apicert.sii.cl/recursos/v1/boleta.electronica.token',
    BOLETA_REST_UPLOAD_URL: 'https://pangal.sii.cl/recursos/v1/boleta.electronica.envio',
    BOLETA_REST_STATUS_URL: 'https://apicert.sii.cl/recursos/v1/boleta.electronica.envio',
  },
  PRODUCCION: {
    SOAP_SEED_URL: 'https://palena.sii.cl/DTEWS/CrSeed.jws',
    SOAP_TOKEN_URL: 'https://palena.sii.cl/DTEWS/GetTokenFromSeed.jws',
    SOAP_QUERY_UP_URL: 'https://palena.sii.cl/DTEWS/QueryEstUp.jws',
    SOAP_QUERY_DTE_URL: 'https://palena.sii.cl/DTEWS/QueryEstDte.jws',
    CGI_DTE_UPLOAD_URL: 'https://palena.sii.cl/cgi_dte/UPL/DTEUpload',
    CGI_DTE_HOST: 'palena.sii.cl',
    BOLETA_REST_SEED_URL: 'https://api.sii.cl/recursos/v1/boleta.electronica.semilla',
    BOLETA_REST_TOKEN_URL: 'https://api.sii.cl/recursos/v1/boleta.electronica.token',
    BOLETA_REST_UPLOAD_URL: 'https://rahue.sii.cl/recursos/v1/boleta.electronica.envio',
    BOLETA_REST_STATUS_URL: 'https://api.sii.cl/recursos/v1/boleta.electronica.envio',
  },
} as const;

/**
 * Nodo <IdDoc> (Identificación del Documento)
 * Orden estricto según DTE_v10.xsd
 */
export interface IdDocSII {
  TipoDTE: CodigoTipoDTE;
  Folio: number;
  FchEmis: string; // Formato AAAA-MM-DD
  IndNoRebaja?: 1;
  TipoDespacho?: 1 | 2 | 3;
  IndTraslado?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  IndServicio?: 1 | 2 | 3 | 4 | 5; // Obligatorio en Boletas (3 = Boleta de Ventas y Servicios)
  MntBruto?: 1;
  FmaPago?: 1 | 2 | 3; // 1: Contado, 2: Crédito, 3: Sin costo (entrega gratuita)
  FchVenc?: string; // Formato AAAA-MM-DD
}

/**
 * Nodo <Emisor>
 * Nota: En Boleta (39/41), las etiquetas difieren levemente (RznSocEmisor, GiroEmisor)
 * y nuestro builder XML normaliza automáticamente según el TipoDTE.
 */
export interface EmisorSII {
  RUTEmisor: string;
  RznSoc: string;        // Máx 100 caracteres
  GiroEmis: string;      // Máx 80 caracteres
  Acteco: number[];      // Máx 4 códigos de actividad económica (solo DTE, no aplica en Boleta 39/41)
  CdgSIISucur?: string;  // Código sucursal SII opcional
  DirOrigen: string;     // Máx 70 caracteres
  CmnaOrigen: string;    // Máx 20 caracteres
  CiudadOrigen?: string; // Máx 20 caracteres
}

/**
 * Nodo <Receptor>
 */
export interface ReceptorSII {
  RUTRecep: string;      // En Boleta puede ser 66666666-6
  CdgIntRecep?: string;
  RznSocRecep: string;   // Máx 100 caracteres (en TED <RSR> se trunca a 40)
  GiroRecep?: string;    // Obligatorio en DTE (33,34,52,56,61), máx 40 caracteres
  Contacto?: string;     // Máx 80 caracteres
  CorreoRecep?: string;  // Máx 80 caracteres
  DirRecep?: string;     // Obligatorio en DTE, máx 70 caracteres
  CmnaRecep?: string;    // Obligatorio en DTE, máx 20 caracteres
  CiudadRecep?: string;  // Máx 20 caracteres
}

/**
 * Nodo <Totales>
 */
export interface TotalesSII {
  MntNeto?: number;
  MntExe?: number;
  TasaIVA?: number; // 19 en Chile para documentos afectos
  IVA?: number;
  MntTotal: number;
}

/**
 * Nodo <Detalle> (Hasta 60 líneas en DTE estándar, hasta 1000 en Boleta)
 */
export interface DetalleItemSII {
  NroLinDet: number;
  CdgItem?: {
    TpoCodigo: string;
    VlrCodigo: string;
  };
  IndExe?: 1 | 2 | 3 | 4 | 5 | 6; // 1 = Ítem exento o no afecto a IVA
  NmbItem: string;     // Máx 80 caracteres (en TED <IT1> se trunca a 40)
  DscItem?: string;    // Máx 1000 caracteres
  QtyItem?: number;
  UnmdItem?: string;   // Máx 4 caracteres (ej: UN, KG, HRS)
  PrcItem?: number;
  DescuentoPct?: number;
  DescuentoMonto?: number;
  MontoItem: number;
}

/**
 * Nodo <DscRcgGlobal> (Descuentos o Recargos Globales)
 */
export interface DscRcgGlobalSII {
  NroLinDR: number;
  TpoMov: 'D' | 'R'; // Descuento o Recargo
  GlosaDR?: string;
  TpoValor: '%' | '$';
  ValorDR: number;
  IndExeDR?: 1 | 2;
}

/**
 * Nodo <Referencia> (Obligatorio en Notas de Crédito 61 y Notas de Débito 56)
 */
export interface ReferenciaSII {
  NroLinRef: number;
  TpoDocRef: string;     // Ej: "33", "39", "SET" (para set de pruebas SII)
  IndGlobal?: 1;
  FolioRef: string;      // Folio del documento referenciado
  FchRef: string;        // AAAA-MM-DD
  CodRef?: 1 | 2 | 3;    // 1: Anula Documento, 2: Corrige Texto, 3: Corrige Montos
  RazonRef?: string;     // Máx 90 caracteres
}

/**
 * Estructura de datos del CAF parseado desde el archivo XML oficial del SII
 */
export interface ParsedCafData {
  rutEmisor: string;          // <RE>
  razonSocial: string;        // <RS>
  tipoDte: CodigoTipoDTE;     // <TD>
  folioDesde: number;         // <RNG><D>
  folioHasta: number;         // <RNG><H>
  fechaAutorizacion: string;  // <FA>
  modulusBase64: string;      // <RSAPK><M>
  exponentBase64: string;     // <RSAPK><E>
  idKey: string;              // <IDK>
  firmaSii: string;           // <FRMA>
  privateKeyPem: string;      // <RSASK> Llave privada RSA del CAF para timbrar <DD>
  rawCafXml: string;          // Nodo <CAF version="1.0">...</CAF> íntegro tal como lo emitió el SII
}

/**
 * Payload de entrada para construir y firmar un DTE completo
 */
export interface ConstruirDteInput {
  idDoc: IdDocSII;
  emisor: EmisorSII;
  receptor: ReceptorSII;
  totales: TotalesSII;
  detalles: DetalleItemSII[];
  dscRcgGlobal?: DscRcgGlobalSII[];
  referencias?: ReferenciaSII[];
  caf: ParsedCafData;
  timestampFirma?: string; // Formato AAAA-MM-DDTHH:mm:ss
}

/**
 * Carátula del sobre <EnvioDTE> o <EnvioBoleta>
 */
export interface CaratulaEnvioSII {
  RutEmisor: string;
  RutEnvia: string;
  RutReceptor: string; // "60803000-K" para envíos al SII
  FchResol: string;    // AAAA-MM-DD
  NroResol: number;    // 0 en ambiente de certificación
  TmstFirmaEnv: string;// AAAA-MM-DDTHH:mm:ss
  SubTotDTE: Array<{
    TpoDTE: CodigoTipoDTE;
    NroDTE: number;
  }>;
}
