import { ClienteReceptor, DocumentoDTE } from '@prisma/client';

// ============================================================================
// ARCHIVOS DE UN DTE YA FIRMADO: XML descargable y datos del receptor tal como quedaron firmados.
// Los usan la API (/v1/documentos/:id/xml y /pdf) y el envío por correo.
// ============================================================================

/** XML del DTE firmado como archivo suelto (ISO-8859-1), con el namespace del SII declarado. */
export function xmlDescargable(doc: Pick<DocumentoDTE, 'dteXmlFirmado'>): Buffer | null {
  if (!doc.dteXmlFirmado) return null;
  // El DTE se firmó asumiendo el namespace del SII: el XML suelto debe declararlo para verificar
  const dte = doc.dteXmlFirmado.replace(/^<DTE version="1.0">/, '<DTE xmlns="http://www.sii.cl/SiiDte" version="1.0">');
  return Buffer.from(`<?xml version="1.0" encoding="ISO-8859-1"?>\n${dte}`, 'latin1');
}

const desescapar = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/**
 * Receptor según el XML firmado del documento. El registro ClienteReceptor se comparte entre
 * documentos (todas las boletas a consumidor final usan 66666666-6) y guarda el último dato recibido;
 * el documento impreso debe mostrar el receptor de ESE documento.
 */
export function receptorDelDocumento<R extends Pick<ClienteReceptor, 'rut' | 'razonSocial' | 'giro' | 'direccion' | 'comuna'>>(
  doc: Pick<DocumentoDTE, 'dteXmlFirmado'>,
  receptor: R
): R {
  const bloque = doc.dteXmlFirmado?.match(/<Receptor>([\s\S]*?)<\/Receptor>/)?.[1];
  if (!bloque) return receptor;
  const campo = (tag: string) => {
    const v = bloque.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];
    return v === undefined ? undefined : desescapar(v);
  };
  return {
    ...receptor,
    rut: campo('RUTRecep') ?? receptor.rut,
    razonSocial: campo('RznSocRecep') ?? receptor.razonSocial,
    giro: campo('GiroRecep') ?? receptor.giro,
    direccion: campo('DirRecep') ?? receptor.direccion,
    comuna: campo('CmnaRecep') ?? receptor.comuna,
  };
}
