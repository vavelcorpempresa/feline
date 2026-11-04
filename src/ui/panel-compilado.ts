import { transformSync } from 'esbuild';
import { renderFelineAntdDashboardHtml } from './feline-antd-dashboard.html';

// ============================================================================
// PANEL COMPILADO EN EL SERVIDOR
// El panel se escribe en JSX dentro de <script type="text/babel">. Antes, el navegador
// descargaba Babel (~3 MB) y lo traducía en cada carga. Ahora se compila una vez con esbuild
// al primer pedido y se entrega como JavaScript normal (en caché por proceso).
// ============================================================================

const BLOQUE_JSX = /<script type="text\/babel">([\s\S]*?)<\/script>/;
const SCRIPT_BABEL = /\s*<script src="https:\/\/unpkg\.com\/@babel\/standalone@[^"]+"><\/script>/;
let cache: string | null = null;

export function compilarPanel(html: string): string {
  const bloque = html.match(BLOQUE_JSX);
  if (!bloque) throw new Error('El panel no contiene el bloque <script type="text/babel"> esperado.');
  const { code } = transformSync(bloque[1], {
    loader: 'jsx',
    jsx: 'transform', // React.createElement, igual que Babel con el preset de React
    target: 'es2020',
    minify: true,
    legalComments: 'none',
  });
  // Reemplazo con función: el código compilado puede contener secuencias $ que .replace interpretaría
  return html.replace(BLOQUE_JSX, () => '<script>' + code + '</script>').replace(SCRIPT_BABEL, '');
}

export function renderPanel(): string {
  if (!cache) cache = compilarPanel(renderFelineAntdDashboardHtml());
  return cache;
}
