import iconv from 'iconv-lite';

// ============================================================================
// UTILIDADES NORMATIVAS SII CHILE (RUT MÓDULO 11, SANITIZACIÓN XML, ISO-8859-1)
// ============================================================================

/**
 * Valida y formatea un RUT chileno bajo el algoritmo Módulo 11 oficial del SII.
 * Retorna el formato estandarizado SII: "12345678-5" o "12345678-K" (sin puntos, K mayúscula).
 */
export function normalizeAndValidateRut(rawRut: string): string {
  const cleaned = rawRut.replace(/\./g, '').replace(/\s+/g, '').toUpperCase();
  const match = cleaned.match(/^(\d{1,8})-?([0-9K])$/);
  if (!match) {
    throw new Error(`Formato de RUT inválido para el SII: "${rawRut}"`);
  }

  const body = match[1];
  const dvProvided = match[2];

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body.charAt(i), 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  const dvCalculated =
    remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);

  if (dvCalculated !== dvProvided) {
    throw new Error(
      `Dígito verificador inválido en RUT "${rawRut}". Esperado: ${dvCalculated}, Recibido: ${dvProvided}`
    );
  }

  return `${ parseInt(body, 10) }-${dvCalculated}`;
}

/**
 * Separa un RUT normalizado en su cuerpo numérico y dígito verificador.
 * Requerido para los campos rutSender/dvSender y rutCompany/dvCompany en DTEUpload.
 */
export function splitRut(rut: string): { numero: string; dv: string } {
  const normalized = normalizeAndValidateRut(rut);
  const [numero, dv] = normalized.split('-');
  return { numero, dv };
}

/**
 * Escapa los 5 caracteres reservados por la especificación XML del SII y trunca
 * según la longitud máxima definida en SiiTypes_v10.xsd.
 */
export function escapeXmlSiiText(value: string, maxLength?: number): string {
  // Primero filtramos cualquier caracter fuera del rango imprimible ISO-8859-1 (Latin1)
  let clean = value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Control chars prohibidos en XML 1.0
    .replace(/[‘’‚′]/g, "'") // Comillas tipográficas simples
    .replace(/[“”„″]/g, '"') // Comillas tipográficas dobles
    .replace(/[‐-―]/g, '-') // Guiones y rayas
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '') // Resto fuera de Latin1 (iconv los volvería "?")
    .trim();

  if (maxLength && clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }

  // Solo se escapan &, < y > (igual que la forma canónica C14N de un nodo de texto).
  // Escapar comillas como &quot;/&apos; invalida el DigestValue, ya que C14N las serializa literales.
  return clean
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Formatea un Date o string a formato de Timestamp SII: AAAA-MM-DDTHH:mm:ss
 * Sin milisegundos ni sufijo 'Z', según el tipo `DateTime` de SiiTypes_v10.xsd.
 */
export function formatSiiTimestamp(date: Date = new Date()): string {
  // Hora oficial de Chile continental, independiente de la zona horaria del servidor
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

/**
 * Codifica un string XML (con declaración encoding="ISO-8859-1") a un Buffer binario ISO-8859-1 real.
 * Evita errores de firma (RCH - Firma Inválida) cuando existen 'Ñ', 'ñ' o vocales con tilde.
 */
export function encodeToIso88591Buffer(xmlString: string): Buffer {
  return iconv.encode(xmlString, 'ISO-8859-1');
}

/**
 * Decodifica un Buffer ISO-8859-1 proveniente del SII (ej. archivo CAF o respuesta upload) a string UTF-8.
 */
export function decodeFromIso88591Buffer(buffer: Buffer): string {
  return iconv.decode(buffer, 'ISO-8859-1');
}
