/** Captura libre temporal: solo desarrollo local con SII simulado. */
export function relaxedDataEntry(): boolean {
  return process.env.NODE_ENV === 'development'
    && process.env.FELINE_SII_MODO === 'simulado'
    && process.env.FELINE_RELAX_DATA_ENTRY === 'on'
    && process.env.FELINE_HOST === '127.0.0.1';
}
