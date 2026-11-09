import { describe, it, expect, vi } from 'vitest';
import { modoSii } from '../src/config';
import { SiiWebServiceIntegration } from '../src/services/sii-webservice.service';

describe('Bloqueo de producción SII', () => {
  it('Bloquea antes de cualquier solicitud HTTP a producción sin autorización', async () => {
    const old = process.env.FELINE_SII_PRODUCCION_AUTORIZADA;
    delete process.env.FELINE_SII_PRODUCCION_AUTORIZADA;
    try {
      const fetch = vi.fn();
      await expect(new SiiWebServiceIntegration(fetch).requestSoapSeed('PRODUCCION')).rejects.toThrow(/bloqueado/);
      expect(fetch).not.toHaveBeenCalled();
    } finally { if (old !== undefined) process.env.FELINE_SII_PRODUCCION_AUTORIZADA = old; }
  });
});

describe('Elección de ambiente', () => {
  it('Producción exige modo explícito y no acepta simulación inadvertida', () => {
    const original = { ...process.env };
    try {
      process.env.NODE_ENV = 'production'; delete process.env.FELINE_SII_MODO; delete process.env.FELINE_DEMO;
      expect(() => modoSii()).toThrow(/explícitamente/);
      expect(() => modoSii('simulado')).toThrow(/DEMO/);
      expect(modoSii('real')).toBe('real');
      process.env.NODE_ENV = 'test'; expect(modoSii()).toBe('simulado');
    } finally { process.env = original; }
  });
});
