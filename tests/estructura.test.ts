import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { VERSION, puerto, urlPublica } from '../src/config';
import vm from 'node:vm';
import { renderFelineAntdDashboardHtml } from '../src/ui/feline-antd-dashboard.html';
import { renderPanel } from '../src/ui/panel-compilado';

// ============================================================================
// ESTRUCTURA (auditoría ACF, grupo 4): versión única, dependencias fijas
// ============================================================================

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

describe('Estructura del proyecto', () => {
  it('La versión del código coincide con package.json y se declara el motor de Node', () => {
    expect(VERSION).toBe(pkg.version);
    expect(pkg.engines?.node).toBeTruthy();
  });

  it('Puerto y URL pública salen de una sola configuración', () => {
    const previo = { ...process.env };
    process.env.PORT = '3999';
    delete process.env.FELINE_PUBLIC_URL;
    expect(puerto()).toBe(3999);
    expect(urlPublica()).toBe('http://localhost:3999');
    process.env = previo;
  });

  it('El panel carga cada librería externa con versión fija', () => {
    const html = renderFelineAntdDashboardHtml();
    const scripts = [...html.matchAll(/<script[^>]*src="(https:\/\/unpkg\.com\/[^"]+)"/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const url of scripts) {
      // paquete@versión exacta (x.y.z)
      expect(url, url).toMatch(/^https:\/\/unpkg\.com\/(@[^/]+\/)?[^/@]+@\d+\.\d+\.\d+\//);
    }
    expect(html).toContain('Feline v' + VERSION);
  });

  it('No hay dependencias declaradas que el código no use', () => {
    const fuentes = ['src', 'sdk']
      .flatMap((d) => fs.readdirSync(d, { recursive: true }).map((f) => d + '/' + String(f)))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => fs.readFileSync(f, 'utf8'))
      .join('\n');
    for (const dep of Object.keys(pkg.dependencies)) {
      expect(fuentes.includes("'" + dep + "'") || fuentes.includes('"' + dep + '"') || fuentes.includes(dep + '/'), dep).toBe(true);
    }
  });

  it('El panel se entrega compilado: sin JSX ni Babel en el navegador, con JavaScript válido', () => {
    const html = renderPanel();
    expect(html).not.toContain('text/babel');
    expect(html).not.toContain('@babel/standalone');
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts.length).toBe(1);
    // Compila como JavaScript estándar (no se ejecuta: necesita React y antd del navegador)
    expect(() => new vm.Script(scripts[0])).not.toThrow();
    expect(scripts[0]).toContain('React.createElement');
    // Misma instancia en caché en el segundo pedido
    expect(renderPanel()).toBe(html);
    expect(html).toContain('Feline Capital');
    // El código fuente sí sigue en JSX (se edita igual que antes)
    expect(renderFelineAntdDashboardHtml()).toContain('<script type="text/babel">');
  });

  it('Rocas del Sur quedó unificado en Feline: una sola marca y las rutas antiguas redirigen', async () => {
    const html = renderPanel();
    expect(html).not.toMatch(/Rocas del Sur|rocasdelsur|rds-/);
    const { buildFastifyApp } = await import('../src/server');
    const app = buildFastifyApp({ siiModo: 'simulado' });
    for (const ruta of ['/rocas', '/feline']) {
      const res = await app.inject({ method: 'GET', url: ruta });
      expect(res.statusCode, ruta).toBe(301);
      expect(res.headers.location).toBe('/');
    }
    const raiz = await app.inject({ method: 'GET', url: '/', headers: { accept: 'application/json' } });
    expect(raiz.json()).toMatchObject({ system: 'Feline' });
    expect(raiz.json().brand).toBeUndefined();
    await app.close();
  });
});
