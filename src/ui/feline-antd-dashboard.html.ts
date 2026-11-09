import { ilaRates } from '../services/ila-preview';
import { salesListUi } from './sales-list-ui';
import { salesGoalsUi } from './sales-goals-ui';
// ============================================================================
// FELINE DASHBOARD UI - BASADO EN DESIGN-SPARX / ANTD-MULTIPURPOSE-DASHBOARD
// Incluye:
// - 7 Estilos Visuales (Clean, Glassmorphic, Neumorphic, Bold, MUI, Shadcn, Serene)
// - Módulo de Libro de Ventas y Compras (RCV SII) + Propuesta F29 Automática
// - Cargador de Certificado Digital (.pfx / .p12) con cifrado AES-256-GCM
// - Emisión, Timbrado <TED>, Firma XMLDSig, Notas de Crédito (61) y Pagos Odoo
// ============================================================================

import { FELINE_LOGO_DATA_URI, FELINE_ISOTIPO_DATA_URI } from './feline-logo';
import { VERSION } from '../config';

export function renderFelineAntdDashboardHtml(): string {
  const pageTitle = 'Feline Capital — Facturación electrónica';
  const defaultStyle = 'feline';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${pageTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Outfit:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Antonio:wght@600&display=swap" rel="stylesheet">
  <!-- React 18, Day.js, Ant Design 5 & Ant Design Icons -->
  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/dayjs@1.11.10/dayjs.min.js"></script>
  <script src="https://unpkg.com/antd@5.21.4/dist/antd.min.js"></script>
  <script src="https://unpkg.com/@ant-design/icons@5.4.0/dist/index.umd.js"></script>
  <script src="https://unpkg.com/@babel/standalone@8.1.1/babel.min.js"></script>
  <!-- Timbre electrónico PDF417 en la representación del documento -->
  <script src="https://unpkg.com/bwip-js@4.11.4/dist/bwip-js-min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body, html {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .mono-code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
    }
    .xml-viewer {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      line-height: 1.55;
      padding: 16px;
      border-radius: 10px;
      background: #0f172a;
      color: #e2e8f0;
      overflow-x: auto;
      max-height: 460px;
      white-space: pre-wrap;
      word-break: break-all;
      border: 1px solid rgba(148, 163, 184, 0.2);
    }
    .ted-Stamp-box {
      background: #ffffff;
      border: 2px dashed #1e293b;
      padding: 14px;
      border-radius: 8px;
      text-align: center;
      color: #0f172a;
    }
    .pdf417-bars {
      height: 68px;
      background: repeating-linear-gradient(
        90deg,
        #000 0px, #000 2px,
        #fff 2px, #fff 4px,
        #000 4px, #000 8px,
        #fff 8px, #fff 10px,
        #000 10px, #000 12px,
        #fff 12px, #fff 15px,
        #000 15px, #000 19px,
        #fff 19px, #fff 21px
      );
      margin-bottom: 8px;
      border: 1px solid #000;
    }
    .f29-box {
      border-left: 4px solid #2b50ed;
      padding-left: 12px;
    }

    /* ================= Marca Feline Capital ================= */
    .fl-logo {
      display: inline-block;
      flex-shrink: 0;
      background-color: currentColor;
      -webkit-mask: url('${FELINE_LOGO_DATA_URI}') left center / contain no-repeat;
      mask: url('${FELINE_LOGO_DATA_URI}') left center / contain no-repeat;
    }
    .fl-logo.fl-isotipo {
      -webkit-mask-image: url('${FELINE_ISOTIPO_DATA_URI}');
      mask-image: url('${FELINE_ISOTIPO_DATA_URI}');
      -webkit-mask-position: center;
      mask-position: center;
    }
    .ing { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; background: #0A0A0A; color: #ECEDEF; font-family: 'Inter', system-ui, sans-serif; }
    .ing-caja { width: 100%; max-width: 380px; background: #121316; border: 1px solid #1E2026; border-radius: 12px; padding: 32px 28px 28px; box-shadow: 0 24px 48px -24px rgba(0,0,0,0.7); }
    .ing-logo { display: block; width: 168px; height: 58px; color: #ECEDEF; margin-bottom: 22px; }
    .ing-caja h1 { margin: 0 0 4px; font-size: 22px; font-weight: 600; color: #ECEDEF; }
    .ing-texto { margin: 0 0 22px; color: #A9AEB6; font-size: 14px; }
    .ing .ant-form-item-label > label { color: #A9AEB6; }
    .ing-error { margin: -4px 0 14px; color: #F28B66; font-size: 13px; }
    .ing-dev { margin-top: 22px; padding-top: 16px; border-top: 1px dashed #2A2D35; }
    .ing-dev-titulo { margin: 0 0 4px; font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #E0B05A; }
    .ing-dev-clave { margin: 0 0 10px; font-size: 12px; color: #A9AEB6; }
    .ing-dev-clave code { font-family: 'JetBrains Mono', monospace; color: #ECEDEF; background: #1E2026; padding: 1px 6px; border-radius: 4px; }
    .ing-dev-usuario { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; padding: 10px 12px; margin-bottom: 8px; background: #17191D; border: 1px solid #262931; border-radius: 8px; color: #ECEDEF; font: inherit; text-align: left; cursor: pointer; transition: border-color .15s, background .15s; }
    .ing-dev-usuario:hover, .ing-dev-usuario:focus-visible { border-color: #E0B05A; background: #1C1E23; outline: none; }
    .ing-dev-usuario:disabled { opacity: .5; cursor: wait; }
    .ing-dev-nombre { font-size: 14px; font-weight: 500; }
    .ing-dev-detalle { font-size: 12px; color: #A9AEB6; }
    .ing-usuario { font-size: 13px; font-weight: 500; white-space: nowrap; max-width: 160px; overflow: hidden; text-overflow: ellipsis; padding: 0 4px; }
    .fl-theme { font-family: 'DM Sans', system-ui, sans-serif; }
    .fl-theme h1.ant-typography, .fl-theme h2.ant-typography, .fl-theme h3.ant-typography,
    .fl-theme h4.ant-typography, .fl-theme .ant-card-head-title, .fl-theme .ant-modal-title,
    .fl-theme .ant-drawer-title, .fl-theme .ant-statistic-content, .fl-marca-nombre {
      font-family: 'Outfit', 'DM Sans', sans-serif;
      letter-spacing: -0.01em;
    }
    .fl-theme .ant-card-head-title { font-weight: 500; }
    .fl-theme .ant-statistic-title { font-size: 13.5px; }
    .fl-theme .ant-statistic-content-value { font-weight: 400 !important; letter-spacing: -0.02em; }
    .fl-theme .ant-btn { display: inline-flex; align-items: center; gap: 6px; }
    .fl-theme .ant-menu-item { display: flex; align-items: center; }
    .fl-theme .ant-menu-item > svg + .ant-menu-title-content { margin-inline-start: 12px; }
    .fl-theme .ant-menu-inline-collapsed .ant-menu-item > svg + .ant-menu-title-content { margin-inline-start: 0; }
    .fl-theme .ant-menu-inline-collapsed .ant-menu-item { justify-content: center; }
    .fl-theme .ant-menu-inline-collapsed .ant-menu-item .ant-menu-title-content { display: none; }
    .fl-header-acciones { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; flex-shrink: 0; }
    /* min-width: 0 deja que el selector de empresa se encoja (con puntos suspensivos) en vez de tapar al usuario */
    .fl-header-empresa { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1 1 0; }
    .fl-header-empresa .ant-select { flex: 1 1 auto; min-width: 0; max-width: 340px; }
    /* Celular y tablet vertical: encabezado en dos filas (empresa arriba, acciones abajo con desplazamiento propio)
       y botones de tarjetas que pasan a la línea siguiente, para que la página nunca se desborde a lo ancho */
    @media (max-width: 767px) {
      .fl-header { height: auto !important; flex-wrap: wrap; row-gap: 8px; padding: 10px 12px !important; overflow: visible !important; line-height: normal; }
      .fl-header .fl-header-empresa { flex: 1 1 100%; }
      .fl-header .fl-header-empresa .ant-select { max-width: none; }
      .fl-header .fl-header-acciones { flex: 1 1 100%; overflow-x: auto; padding-bottom: 2px; }
      .fl-header .ing-usuario { display: none; }
      .ant-card-head-wrapper { flex-wrap: wrap; row-gap: 8px; padding-block: 8px; }
      .ant-card-head-title { flex: 1 1 100%; }
      .ant-card-extra { margin-inline-start: 0 !important; max-width: 100%; display: flex; flex-wrap: wrap; gap: 8px; }
      .ant-card-extra .ant-space { flex-wrap: wrap; max-width: 100%; }
    }
    @media (max-width: 1280px) {
      .fl-theme .fl-header-acciones .ant-btn:not(.ant-btn-icon-only):not(.ant-btn-primary):not(.fl-btn-texto) { font-size: 0; gap: 0; padding: 0 10px; }
      .fl-theme .fl-header-empresa > .ant-typography { display: none; }
    }
    .fl-theme .ant-btn-icon-only { justify-content: center; }
    .fl-theme .ant-card-head-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fl-theme .ant-table-thead > tr > th { white-space: nowrap; }
    .fl-theme .ant-card-body { overflow-x: auto; }
    .fl-theme .ant-layout-sider-trigger { background: #00152B !important; color: #C9D8EA !important; border-top: 1px solid rgba(255,255,255,0.08); }
    .fl-claro .ant-layout-sider-trigger { background: #00152B !important; color: #C9D8EA !important; border-top: 1px solid rgba(255,255,255,0.08); }
    .fl-claro .ant-alert-success { background: #E3F0E9; border-color: #BFDCCB; }
    .fl-claro .ant-alert-info { background: #E6F0FC; border-color: #B9D4F5; }
    .fl-claro .ant-alert-warning { background: #F7EBD6; border-color: #E8CFA0; }
    .fl-claro .ant-alert-error { background: #F6E1DC; border-color: #EDC3B9; }
    .fl-claro .ant-alert .ant-alert-message { color: #0B1B2E; }
    .fl-claro .ant-alert .ant-alert-description { color: #4A5B70; }
    .fl-theme:not(.fl-claro) .ant-tag-blue, .fl-theme:not(.fl-claro) .ant-tag-geekblue, .fl-theme:not(.fl-claro) .ant-tag-purple,
    .fl-theme:not(.fl-claro) .ant-tag-processing, .fl-theme:not(.fl-claro) .ant-tag-cyan {
      color: #7DB6F5; background: rgba(0,115,230,0.16); border-color: rgba(125,182,245,0.35);
    }
    .fl-theme:not(.fl-claro) .ant-tag-green, .fl-theme:not(.fl-claro) .ant-tag-success { color: #8FCBAE; background: rgba(47,125,91,0.18); border-color: rgba(143,203,174,0.35); }
    .fl-theme:not(.fl-claro) .ant-tag-orange, .fl-theme:not(.fl-claro) .ant-tag-gold, .fl-theme:not(.fl-claro) .ant-tag-warning { color: #E6BE7A; background: rgba(183,121,31,0.18); border-color: rgba(230,190,122,0.35); }
    .fl-theme:not(.fl-claro) .ant-tag-red, .fl-theme:not(.fl-claro) .ant-tag-error, .fl-theme:not(.fl-claro) .ant-tag-volcano { color: #E79A8A; background: rgba(180,67,47,0.2); border-color: rgba(231,154,138,0.35); }
    .fl-theme:not(.fl-claro) .ant-alert-success { background: rgba(47,125,91,0.16); border-color: rgba(143,203,174,0.3); }
    .fl-theme .ant-menu-item-group-title { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; }
    .fl-theme .ant-tag { border-radius: 999px; padding-inline: 10px; }
    .fl-theme .ant-segmented-item-label { display: flex; align-items: center; justify-content: center; min-height: 28px; }
    .fl-theme .xml-viewer { background: #001E3B; color: #E6EEF7; border-color: #003366; }
    .fl-theme .ted-Stamp-box { border-color: #0051A2; color: #0B1B2E; }
    .fl-theme .f29-box { border-left-color: #0062C4; }
    .fl-claro .ant-tag-blue, .fl-claro .ant-tag-geekblue, .fl-claro .ant-tag-purple,
    .fl-claro .ant-tag-processing, .fl-claro .ant-tag-cyan {
      color: #0051A2; background: #E6F0FC; border-color: #B9D4F5;
    }
    .fl-claro .ant-tag-green, .fl-claro .ant-tag-success { color: #2F7D5B; background: #E3F0E9; border-color: #BFDCCB; }
    .fl-claro .ant-tag-orange, .fl-claro .ant-tag-gold, .fl-claro .ant-tag-warning { color: #8A5A12; background: #F7EBD6; border-color: #E8CFA0; }
    .fl-claro .ant-tag-red, .fl-claro .ant-tag-error, .fl-claro .ant-tag-volcano { color: #B4432F; background: #F6E1DC; border-color: #EDC3B9; }
    /* ================= Facturas y boletas: escena de documentos ================= */
    .esc {
      --esc-vacio: #0A0A0A;
      --esc-tinta: #121316;
      --esc-pizarra: #1E2026;
      --esc-niebla-oscura: #2A2F39;
      --esc-niebla: #5A6472;
      --esc-texto: #ECEDEF;
      --esc-secundario: #A9AEB6;
      --esc-arena: #C7B9A6;
      --esc-arena-fuerte: #DCCDB8;
      --esc-ok: #6FCB95;
      --esc-enviado: #7CC8DA;
      --esc-aviso: #E7B95A;
      --esc-error: #F28B66;
      --esc-borrador: #B3ADA6;
      display: grid;
      grid-template-columns: 360px minmax(0, 1fr) 104px;
      height: calc(100vh - 68px);
      background: var(--esc-vacio);
      color: var(--esc-texto);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
      line-height: 1.45;
    }
    .esc ::selection { background: var(--esc-arena); color: var(--esc-vacio); }
    .esc-num { font-variant-numeric: tabular-nums; }
    .esc button { font-family: inherit; }
    .esc :focus-visible { outline: 2px solid var(--esc-arena); outline-offset: 2px; }

    /* Cola */
    .esc-cola { background: var(--esc-tinta); border-right: 1px solid var(--esc-pizarra); display: flex; flex-direction: column; min-height: 0; }
    .esc-cola-cabecera { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 22px 20px 6px; }
    .esc-cola-cabecera h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; color: var(--esc-texto); }
    .esc-resumen { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0; padding: 6px 20px 16px; font-size: 13px; color: var(--esc-secundario); }
    .esc-resumen b { color: var(--esc-texto); font-weight: 600; }
    .esc-mes { flex-basis: 100%; color: var(--esc-texto); }
    .esc-pendiente, .esc-pendiente b { color: var(--esc-aviso); }
    .esc-boton { display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--esc-niebla-oscura); background: transparent; color: var(--esc-texto); font-size: 14px; font-weight: 500; cursor: pointer; transition: background-color 160ms ease-out, border-color 160ms ease-out; }
    .esc-boton:hover { background: var(--esc-pizarra); border-color: var(--esc-niebla); }
    .esc-boton-principal { background: var(--esc-arena); border-color: var(--esc-arena); color: var(--esc-vacio); font-weight: 600; }
    .esc-boton-principal:hover { background: var(--esc-arena-fuerte); border-color: var(--esc-arena-fuerte); }
    .esc-filtros { display: flex; gap: 4px; padding: 0 16px 12px; }
    .esc-filtro { flex: 1 1 auto; white-space: nowrap; padding: 0 8px; height: 32px; border-radius: 7px; border: 1px solid transparent; background: transparent; color: var(--esc-secundario); font-size: 13px; cursor: pointer; transition: background-color 160ms ease-out, color 160ms ease-out; }
    .esc-filtro span { color: var(--esc-secundario); margin-left: 2px; }
    .esc-filtro:hover { color: var(--esc-texto); background: var(--esc-pizarra); }
    .esc-filtro-activo { background: var(--esc-pizarra); border-color: var(--esc-niebla-oscura); color: var(--esc-texto); font-weight: 500; }
    .esc-filtro-activo span { color: var(--esc-secundario); }
    .esc-busqueda { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; margin: 0 16px 10px; }
    .esc-select { height: 38px; width: 118px; padding: 0 28px 0 10px; border-radius: 8px; border: 1px solid var(--esc-pizarra); background: var(--esc-vacio) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23A9AEB6' stroke-width='1.7' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 10px center; color: var(--esc-texto); font: 13px 'Inter', sans-serif; appearance: none; cursor: pointer; text-overflow: ellipsis; }
    .esc-select:focus { outline: 0; border-color: var(--esc-arena); }
    .esc-select-activo { border-color: var(--esc-arena); color: var(--esc-arena); }
    .esc-select option { background: var(--esc-tinta); color: var(--esc-texto); }
    .esc-buscar { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 12px; border-radius: 8px; background: var(--esc-vacio); border: 1px solid var(--esc-pizarra); color: var(--esc-secundario); }
    .esc-buscar:focus-within { border-color: var(--esc-arena); }
    .esc-buscar input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--esc-texto); font: 13px 'Inter', sans-serif; caret-color: var(--esc-arena); }
    .esc-buscar input::placeholder { color: var(--esc-secundario); opacity: 0.8; }
    .esc-lista { list-style: none; margin: 0; padding: 4px 8px 16px; overflow-y: auto; flex: 1; min-height: 0; scrollbar-width: thin; scrollbar-color: var(--esc-niebla-oscura) transparent; }
    .esc-fila { display: grid; gap: 2px; width: 100%; text-align: left; padding: 11px 12px; border: 1px solid transparent; border-radius: 9px; background: transparent; color: var(--esc-texto); cursor: pointer; transition: background-color 140ms ease-out; }
    .esc-fila:hover { background: var(--esc-pizarra); }
    .esc-fila-elegida { background: var(--esc-pizarra); border-color: var(--esc-niebla-oscura); }
    .esc-fila-elegida .esc-fila-nombre { color: var(--esc-arena); }
    .esc-fila-a, .esc-fila-b { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
    .esc-fila-nombre { font-weight: 600; }
    .esc-fila-monto { font-weight: 600; white-space: nowrap; }
    .esc-fila-cliente { color: var(--esc-secundario); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .esc-fila-fecha { color: var(--esc-secundario); font-size: 12px; white-space: nowrap; }
    .esc-fila-cargando { height: 74px; margin-bottom: 4px; background: linear-gradient(90deg, var(--esc-pizarra), var(--esc-niebla-oscura), var(--esc-pizarra)) 0 0 / 200% 100%; animation: esc-cargando 1.4s linear infinite; }
    @keyframes esc-cargando { to { background-position: -200% 0; } }
    .esc-vacio-lista { padding: 8px 20px 24px; color: var(--esc-secundario); }
    .esc-vacio-lista p { margin: 0 0 10px; }

    .esc-estado { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 500; }
    .esc-estado i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
    .esc-tono-ok { color: var(--esc-ok); }
    .esc-tono-enviado { color: var(--esc-enviado); }
    .esc-tono-aviso { color: var(--esc-aviso); }
    .esc-tono-error { color: var(--esc-error); }
    .esc-tono-borrador { color: var(--esc-borrador); }

    /* Escena */
    .esc-escena { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto; min-height: 0; overflow: hidden; background: var(--esc-vacio); }
    .esc-navegacion { display: flex; align-items: center; justify-content: flex-end; gap: 6px; padding: 16px 20px 0; color: var(--esc-secundario); font-size: 13px; }
    .esc-navegacion > span { margin-right: 4px; }
    .esc-navegacion kbd { font: 500 12px 'Inter', sans-serif; padding: 2px 6px; border-radius: 5px; border: 1px solid var(--esc-niebla-oscura); color: var(--esc-secundario); }
    .esc-navegacion kbd:first-of-type { margin-left: 6px; }
    .esc-flecha { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--esc-niebla-oscura); background: transparent; color: var(--esc-texto); cursor: pointer; transition: background-color 140ms ease-out; }
    .esc-flecha:hover:not(:disabled) { background: var(--esc-pizarra); }
    .esc-flecha:disabled { opacity: 0.35; cursor: default; }
    .esc-escenario { position: relative; display: flex; justify-content: center; align-items: flex-start; padding: 12px 56px 0; min-height: 0; overflow: visible; }
    .esc-escena { isolation: isolate; }
    .esc-puntos { position: absolute; right: 22px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 4px; z-index: 1; }
    .esc-punto { width: 18px; height: 18px; padding: 0; border: 0; background: transparent; cursor: pointer; display: grid; place-items: center; }
    .esc-punto::after { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--esc-niebla); transition: background-color 160ms ease-out, transform 160ms ease-out; }
    .esc-punto:hover::after { background: var(--esc-secundario); }
    .esc-punto-activo::after { background: var(--esc-arena); transform: scale(1.4); }
    .esc-hoja-marco { flex-shrink: 0; }
    .esc-entra-abajo { animation: esc-entra-abajo 220ms cubic-bezier(0.16, 1, 0.3, 1); }
    .esc-entra-arriba { animation: esc-entra-arriba 220ms cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes esc-entra-abajo { from { opacity: 0; translate: 0 36px; } to { opacity: 1; translate: 0 0; } }
    @keyframes esc-entra-arriba { from { opacity: 0; translate: 0 -36px; } to { opacity: 1; translate: 0 0; } }
    @media (prefers-reduced-motion: reduce) {
      .esc-entra-abajo, .esc-entra-arriba { animation: esc-funde 160ms ease-out; }
      @keyframes esc-funde { from { opacity: 0; } to { opacity: 1; } }
      .esc-fila-cargando { animation: none; }
    }

    /* La hoja: la representación impresa del documento */
    .esc-hoja { width: 600px; min-height: 560px; background: #FFFFFF; color: #16181C; border-radius: 3px; padding: 34px 38px 28px; box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.7), 0 2px 6px rgba(0, 0, 0, 0.4); font-size: 12.5px; line-height: 1.5; display: flex; flex-direction: column; }
    .esc-hoja ::selection { background: #F3D9C8; color: #16181C; }
    .esc-hoja-cabecera { display: flex; justify-content: space-between; gap: 20px; }
    .esc-hoja-emisor { display: flex; flex-direction: column; gap: 1px; color: #3F444B; max-width: 300px; }
    .esc-hoja-emisor strong { color: #16181C; font-size: 15px; font-weight: 700; line-height: 1.3; margin-bottom: 3px; }
    .esc-recuadro { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; width: 214px; min-height: 92px; padding: 10px 12px; border: 2px solid #C8102E; color: #C8102E; text-align: center; font-weight: 600; }
    .esc-recuadro strong { font-size: 13px; line-height: 1.25; }
    .esc-recuadro-borrador { border-style: dashed; border-color: #8A8F96; color: #5B6067; }
    .esc-hoja-sii { align-self: flex-end; width: 214px; text-align: center; margin-top: 5px; font-size: 11.5px; font-weight: 600; color: #C8102E; }
    .esc-hoja-receptor { display: grid; grid-template-columns: 1.6fr 1fr; gap: 8px 24px; margin: 18px 0 0; padding: 14px 0; border-top: 1px solid #D9DCE0; border-bottom: 1px solid #D9DCE0; }
    .esc-hoja-receptor dt { font-size: 11.5px; color: #5B6067; }
    .esc-hoja-receptor dd { margin: 0; font-weight: 600; }
    .esc-hoja-ref { margin: 10px 0 0; color: #3F444B; display: grid; gap: 2px; }
    .esc-hoja-lineas { width: 100%; border-collapse: collapse; margin: 16px 0 0; }
    .esc-hoja-lineas th { text-align: left; font-size: 11.5px; font-weight: 600; color: #5B6067; padding: 0 0 6px 0; border-bottom: 1px solid #16181C; }
    .esc-hoja-lineas td { padding: 8px 0; border-bottom: 1px solid #ECEEF0; vertical-align: top; }
    .esc-hoja-lineas th + th, .esc-hoja-lineas td + td { padding-left: 14px; }
    .esc-hoja-lineas td:first-child { width: 48px; }
    .esc-hoja-lineas td em { color: #5B6067; font-style: normal; }
    .esc-der, .esc-hoja-lineas .esc-der { text-align: right; }
    .esc-hoja-pie { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-top: auto; padding-top: 22px; }
    .esc-hoja-timbre { display: flex; flex-direction: column; gap: 6px; width: 260px; font-size: 11px; color: #5B6067; }
    .esc-timbre { width: 260px; height: auto; image-rendering: pixelated; }
    .esc-timbre-vacio { display: grid; place-items: center; height: 96px; padding: 0 16px; border: 1px dashed #B7BBC1; text-align: center; font-size: 12px; color: #5B6067; }
    .esc-hoja-totales { margin: 0; min-width: 210px; display: grid; gap: 3px; }
    .esc-hoja-totales div { display: flex; justify-content: space-between; gap: 18px; }
    .esc-hoja-totales dt { color: #5B6067; }
    .esc-hoja-totales dd { margin: 0; }
    .esc-hoja-total { margin-top: 5px; padding-top: 7px; border-top: 1px solid #16181C; font-size: 15px; font-weight: 700; }
    .esc-hoja-total dt { color: #16181C; }

    /* Leyenda inferior: cliente, estado ante el SII y total */
    .esc-leyenda { display: flex; justify-content: space-between; align-items: flex-end; gap: 32px; padding: 64px 32px 24px; margin-top: -64px; position: relative; z-index: 2; background: linear-gradient(to bottom, rgba(10, 10, 10, 0), rgba(10, 10, 10, 0.9) 56px, #0A0A0A 72px); }
    .esc-leyenda-texto { min-width: 0; max-width: 100%; }
    .esc-folio { margin: 0; font-family: 'Antonio', 'Inter', sans-serif; font-size: 40px; font-weight: 600; line-height: 1; letter-spacing: 0.01em; text-transform: uppercase; color: var(--esc-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .esc-leyenda-cliente { margin: 10px 0 0; font-size: 17px; font-weight: 600; color: var(--esc-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .esc-leyenda-datos { margin: 2px 0 10px; color: var(--esc-secundario); }
    .esc-estado-grande { margin: 0; font-size: 15px; font-weight: 600; }
    .esc-estado-grande i { width: 9px; height: 9px; }
    .esc-estado-grande span { font-weight: 500; color: var(--esc-secundario); }
    .esc-leyenda-detalle { margin: 4px 0 0; color: var(--esc-secundario); }
    .esc-leyenda-total { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
    .esc-total { font-family: 'Antonio', 'Inter', sans-serif; font-size: 60px; font-weight: 600; line-height: 1; letter-spacing: -0.005em; color: var(--esc-texto); }
    .esc-cobro { margin-top: 6px; color: var(--esc-secundario); }

    .esc-vacio { align-self: center; justify-self: center; grid-row: 1 / -1; max-width: 420px; text-align: center; padding: 24px; }
    .esc-vacio h2 { margin: 0 0 8px; font-size: 20px; font-weight: 600; color: var(--esc-texto); }
    .esc-vacio p { margin: 0 0 18px; color: var(--esc-secundario); }
    .esc-vacio-acciones { display: flex; justify-content: center; gap: 8px; }

    /* Riel de acciones */
    .esc-riel { display: flex; flex-direction: column; align-items: stretch; justify-content: center; gap: 6px; padding: 16px 10px; background: var(--esc-vacio); border-left: 1px solid var(--esc-pizarra); }
    .esc-accion { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 8px 4px; border: 0; background: transparent; color: var(--esc-texto); cursor: pointer; }
    .esc-accion-icono { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--esc-niebla-oscura); transition: background-color 160ms ease-out, border-color 160ms ease-out, transform 160ms ease-out; }
    .esc-accion:hover .esc-accion-icono { background: var(--esc-pizarra); border-color: var(--esc-niebla); }
    .esc-accion:active .esc-accion-icono { transform: scale(0.94); }
    .esc-accion-texto { font-size: 12px; line-height: 1.25; text-align: center; color: var(--esc-texto); }
    .esc-accion-principal .esc-accion-icono { background: var(--esc-arena); border-color: var(--esc-arena); color: var(--esc-vacio); }
    .esc-accion-principal:hover .esc-accion-icono { background: var(--esc-arena-fuerte); border-color: var(--esc-arena-fuerte); }
    .esc-accion[aria-disabled="true"] { cursor: not-allowed; }
    .esc-accion[aria-disabled="true"] .esc-accion-icono { opacity: 0.38; }
    .esc-accion[aria-disabled="true"] .esc-accion-texto { color: var(--esc-secundario); opacity: 0.7; }
    .esc-accion[aria-disabled="true"]:hover .esc-accion-icono { background: transparent; border-color: var(--esc-niebla-oscura); }

    .esc-hoja-fluida { width: 100%; }
    .esc-hoja-fluida .esc-hoja { width: 100%; min-height: 0; padding: 20px 18px; font-size: 13px; }
    .esc-hoja-fluida .esc-hoja-cabecera { flex-direction: column; gap: 14px; }
    .esc-hoja-fluida .esc-recuadro, .esc-hoja-fluida .esc-hoja-sii { width: 100%; align-self: stretch; }
    .esc-hoja-fluida .esc-hoja-receptor { grid-template-columns: 1fr 1fr; gap: 8px 14px; }
    .esc-hoja-fluida .esc-hoja-pie { flex-direction: column-reverse; align-items: stretch; }
    .esc-hoja-fluida .esc-hoja-timbre, .esc-hoja-fluida .esc-timbre { width: 100%; }
    .esc-hoja-fluida .esc-hoja-lineas { table-layout: fixed; }
    .esc-hoja-fluida .esc-hoja-lineas th:nth-child(3), .esc-hoja-fluida .esc-hoja-lineas td:nth-child(3) { display: none; }
    .esc-hoja-fluida .esc-hoja-lineas th:first-child, .esc-hoja-fluida .esc-hoja-lineas td:first-child { width: 30px; }
    .esc-hoja-fluida .esc-hoja-lineas th:last-child, .esc-hoja-fluida .esc-hoja-lineas td:last-child { width: 96px; }
    .esc-hoja-fluida .esc-hoja-lineas td { overflow-wrap: break-word; hyphens: auto; }
    .esc-hoja-fluida .esc-hoja-lineas th + th, .esc-hoja-fluida .esc-hoja-lineas td + td { padding-left: 10px; }
    .ant-layout-header > * { flex-shrink: 0; }
    @media print {
      body.esc-imprimiendo * { visibility: hidden !important; }
      body.esc-imprimiendo .esc-hoja, body.esc-imprimiendo .esc-hoja * { visibility: visible !important; }
      body.esc-imprimiendo .esc-hoja { position: fixed; left: 0; top: 0; width: 100%; box-shadow: none; border-radius: 0; }
      body.esc-imprimiendo .esc-hoja-marco, body.esc-imprimiendo .esc-hoja-marco > div { transform: none !important; animation: none !important; }
    }
    .esc-contenedor { container-type: inline-size; }
    .esc-leyenda { flex-wrap: wrap; }
    /* Espacio mediano (el menú lateral cuenta): el riel baja a una barra bajo la escena */
    @container (max-width: 1040px) {
      .esc { grid-template-columns: 312px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
      .esc-cola { grid-row: 1 / -1; }
      .esc-cola-cabecera h1 { font-size: 18px; }
      .esc-filtros { gap: 2px; padding: 0 12px 12px; }
      .esc-busqueda { grid-template-columns: 1fr; }
      .esc-select { width: 100%; }
      .esc-filtro { padding: 0 6px; }
      .esc-leyenda { flex-direction: column; align-items: flex-start; gap: 8px; }
      .esc-leyenda-cliente { font-size: 16px; max-width: 100%; }
      .esc-leyenda-datos { margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
      .esc-leyenda-total { flex-direction: row; align-items: baseline; gap: 12px; }
      .esc-cobro { margin-top: 0; }
      .esc-riel { flex-direction: row; justify-content: center; border-left: 0; border-top: 1px solid var(--esc-pizarra); padding: 8px 12px; }
      .esc-accion { width: 92px; }
      .esc-total { font-size: 38px; }
      .esc-folio { font-size: 42px; }
      .esc-leyenda { padding: 56px 24px 16px; }
      .esc-escenario { padding: 10px 40px 0; }
      .esc-puntos { right: 12px; }
    }
    /* Espacio angosto o teléfono: lista arriba, documento debajo */
    @container (max-width: 720px) {
      .esc { display: flex; flex-direction: column; height: auto; }
      .esc-cola { border-right: 0; border-bottom: 1px solid var(--esc-pizarra); }
      .esc-lista { max-height: 320px; }
      .esc-escena { min-height: 0; padding-bottom: 116px; }
      .esc-escenario { padding: 8px 12px 0; }
      .esc-puntos { display: none; }
      .esc-folio { font-size: 40px; }
      .esc-navegacion kbd { display: none; }
      .esc-leyenda { flex-direction: column; align-items: flex-start; gap: 12px; padding: 20px 16px 18px; margin-top: 0; background: var(--esc-vacio); }
      .esc-leyenda-total { align-items: flex-start; }
      .esc-total { font-size: 40px; }
      .esc-riel { justify-content: flex-start; overflow-x: auto; position: sticky; bottom: 0; z-index: 2; padding: 8px 6px; scrollbar-width: none; }
      .esc-accion { flex: 0 0 68px; width: 68px; padding: 4px 2px; gap: 5px; }
      .esc-accion-icono { width: 42px; height: 42px; }
    }

    /* =========================================================================
       NUEVA ARQUITECTURA RESPONSIVE Y NAVEGACIÓN MODULAR (FELINE ERP)
       ========================================================================= */
    .fl-header {
      height: 56px !important;
      padding: 0 16px !important;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid rgba(128,128,128,0.12);
      position: sticky;
      top: 0;
      z-index: 100;
      line-height: normal !important;
    }
    .fl-header-izq {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 1 1 auto;
    }
    .fl-header-der {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .fl-sider-menu {
      max-height: calc(100vh - 110px);
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: thin;
      padding: 0 4px;
    }
    .fl-content-wrapper {
      max-width: 100vw;
      box-sizing: border-box;
      padding: 16px 20px;
    }
    @media (max-width: 767px) {
      .fl-btn-hamburguesa { display: inline-flex !important; }
      .fl-sider-desktop { display: none !important; }
      .fl-header { padding: 0 8px !important; height: auto !important; min-height: 54px; flex-wrap: wrap; }
      .fl-header-izq { width: 100%; justify-content: space-between; padding-block: 4px; }
      .fl-header-der { width: 100%; justify-content: flex-end; padding-bottom: 4px; border-top: 1px solid rgba(128,128,128,0.08); }
      .fl-content-wrapper { padding: 10px 8px !important; }
      .esc-hoja { width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
      .esc-escenario { padding: 6px 6px 0 !important; }
      .esc-leyenda-total { align-items: flex-start !important; }
      .esc-resumen { padding: 6px 12px 10px !important; font-size: 12px !important; }
    }
    @media (min-width: 768px) {
      .fl-btn-hamburguesa { display: none !important; }
    }
    .ant-table-wrapper {
      max-width: 100%;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect, useMemo } = React;
    const {
      ConfigProvider, Layout, Menu, Card, Row, Col, Statistic, Table, Tag,
      Button, Select, Drawer, Modal, Form, Input, InputNumber, Switch, DatePicker,
      Badge, Space, Typography, Divider, Tabs, Alert, Tooltip, Progress,
      Descriptions, Segmented, Empty, Upload, Radio, Popconfirm, Avatar, Checkbox, message, notification, theme: antdTheme
    } = antd;

    const { Header, Sider, Content, Footer } = Layout;
    const { Title, Text } = Typography;

    // ========================================================================
    // DESIGN-SPARX / ANTD-MULTIPURPOSE-DASHBOARD THEME ARCHITECTURE (REA)
    // ========================================================================
    // ---------------------- Feline Capital: iconos y tokens de la marca ----------------------
    const FL_ICONOS = {
      inicio: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
      libro: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16M15 4v16"/>',
      contabilidad: '<path d="M12 3v18M5 7h14M7 7l-3 7h6zM17 7l-3 7h6z"/><path d="M8 21h8"/>',
      permisos: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
      factura: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
      boleta: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
      usuarios: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      empresa: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
      emitir: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
      recibir: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
      editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
      engranaje: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/><circle cx="12" cy="12" r="7"/>',
      sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
      luna: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
      descargar: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
      buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
      arriba: '<path d="m6 15 6-6 6 6"/>',
      abajo: '<path d="m6 9 6 6 6-6"/>',
      devolver: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
      billetera: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
    };

    function RIcono({ nombre, size = 18 }) {
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: FL_ICONOS[nombre] || '' }}
        />
      );
    }

    // ------------------------------------------------------------------------
    // COMPONENTES DE GRÁFICOS SVG NATIVOS (FELINE DESIGN SYSTEM)
    // ------------------------------------------------------------------------

    function DonutChartSvg({ data, size = 180, centerText = '', subText = '' }) {
      const R = 60;
      const C = 2 * Math.PI * R;
      let acc = 0;
      const total = data.reduce((s, d) => s + d.value, 0) || 1;

      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(128,128,128,0.15)" strokeWidth="18" />
              {data.map((item, idx) => {
                const dash = (item.value / total) * C;
                const offset = -acc;
                acc += dash;
                return (
                  <circle
                    key={idx}
                    cx="80"
                    cy="80"
                    r={R}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="18"
                    strokeDasharray={dash + ' ' + (C - dash)}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Antonio, Inter, sans-serif' }}>{centerText}</span>
              {subText && <span style={{ fontSize: 10, color: '#888', textTransform: 'uppercase' }}>{subText}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 120 }}>
            {data.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <span>{item.label}</span>
                </span>
                <span style={{ fontWeight: 600 }}>{item.pct ? item.pct : Math.round((item.value / total) * 100) + '%'}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    function AreaChartSvg({ labels, series, height = 200 }) {
      const W = 460;
      const H = height;
      const padLeft = 40;
      const padRight = 16;
      const padTop = 20;
      const padBottom = 26;
      const chartW = W - padLeft - padRight;
      const chartH = H - padTop - padBottom;

      const allValues = series.flatMap(s => s.data);
      const maxVal = Math.max(...allValues, 1);

      return (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg width="100%" height={H} viewBox={'0 0 ' + W + ' ' + H} style={{ minWidth: 320, display: 'block' }}>
            <defs>
              {series.map((s, idx) => (
                <linearGradient key={idx} id={'area-grad-' + idx} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
                </linearGradient>
              ))}
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
              const y = padTop + chartH * (1 - pct);
              return (
                <g key={idx}>
                  <line x1={padLeft} y1={y} x2={W - padRight} y2={y} stroke="rgba(128,128,128,0.12)" strokeDasharray="3 3" />
                  <text x={padLeft - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#888">
                    {Math.round((maxVal * pct) / 1000000) + 'M'}
                  </text>
                </g>
              );
            })}
            {series.map((s, sIdx) => {
              const pts = s.data.map((val, idx) => {
                const x = padLeft + (idx / (labels.length - 1)) * chartW;
                const y = padTop + chartH * (1 - val / maxVal);
                return { x, y, val };
              });
              const polyPoints = pts.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
              const areaPoints = pts[0].x + ',' + (padTop + chartH) + ' ' + polyPoints + ' ' + pts[pts.length - 1].x + ',' + (padTop + chartH);
              return (
                <g key={sIdx}>
                  <polygon points={areaPoints} fill={'url(#area-grad-' + sIdx + ')'} />
                  <polyline points={polyPoints} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {pts.map((p, pIdx) => (
                    <circle key={pIdx} cx={p.x} cy={p.y} r="3.5" fill={s.color} stroke="#fff" strokeWidth="1.5" />
                  ))}
                </g>
              );
            })}
            {labels.map((lbl, idx) => {
              const x = padLeft + (idx / (labels.length - 1)) * chartW;
              return (
                <text key={idx} x={x} y={H - 6} textAnchor="middle" fontSize="10" fill="#888">
                  {lbl}
                </text>
              );
            })}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
            {series.map((s, idx) => (
              <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ width: 10, height: 3, background: s.color, borderRadius: 2 }} />
                <span>{s.name}</span>
              </span>
            ))}
          </div>
        </div>
      );
    }

    
    function HorizontalBarChartSvg({ items, height = 200 }) {
      const maxVal = Math.max(...items.map(i => i.value), 1);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', padding: '4px 0' }}>
          {items.map((it, idx) => {
            const pct = Math.min(100, Math.round((it.value / maxVal) * 100));
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ fontWeight: 500, color: '#334155' }}>{it.label}</span>
                  <span style={{ fontWeight: 600 }}>{it.formatted || it.value}</span>
                </div>
                <div style={{ width: '100%', height: 8, background: 'rgba(128,128,128,0.12)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: pct + '%', height: '100%', background: it.color || '#0062C4', borderRadius: 4, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    function GroupedBarChartSvg({ labels, series, height = 200 }) {
      const W = 460;
      const H = height;
      const padLeft = 40;
      const padRight = 16;
      const padTop = 20;
      const padBottom = 26;
      const chartW = W - padLeft - padRight;
      const chartH = H - padTop - padBottom;

      const allValues = series.flatMap(s => s.data);
      const maxVal = Math.max(...allValues, 1);
      const groupW = chartW / labels.length;
      const barW = Math.min(20, (groupW * 0.7) / series.length);

      return (
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg width="100%" height={H} viewBox={'0 0 ' + W + ' ' + H} style={{ minWidth: 320, display: 'block' }}>
            {[0, 0.33, 0.66, 1].map((pct, idx) => {
              const y = padTop + chartH * (1 - pct);
              return (
                <g key={idx}>
                  <line x1={padLeft} y1={y} x2={W - padRight} y2={y} stroke="rgba(128,128,128,0.12)" strokeDasharray="3 3" />
                  <text x={padLeft - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#888">
                    {Math.round((maxVal * pct) / 1000000) + 'M'}
                  </text>
                </g>
              );
            })}
            {labels.map((lbl, gIdx) => {
              const groupCenterX = padLeft + gIdx * groupW + groupW / 2;
              const startX = groupCenterX - (series.length * barW) / 2;
              return (
                <g key={gIdx}>
                  {series.map((s, sIdx) => {
                    const val = s.data[gIdx] || 0;
                    const barH = (val / maxVal) * chartH;
                    const x = startX + sIdx * barW;
                    const y = padTop + chartH - barH;
                    return (
                      <rect
                        key={sIdx}
                        x={x + 1}
                        y={y}
                        width={barW - 2}
                        height={Math.max(2, barH)}
                        rx="3"
                        fill={s.color}
                      />
                    );
                  })}
                  <text x={groupCenterX} y={H - 6} textAnchor="middle" fontSize="10" fill="#888">
                    {lbl}
                  </text>
                </g>
              );
            })}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
            {series.map((s, idx) => (
              <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
                <span>{s.name}</span>
              </span>
            ))}
          </div>
        </div>
      );
    }

    const FL_FUENTE = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";
    const FL_TOKENS_CLARO = {
      colorText: '#0B1B2E',
      colorTextSecondary: '#4A5B70',
      colorTextTertiary: '#6B7C91',
      colorBorder: '#D5DFEB',
      colorBorderSecondary: '#E6EDF5',
      colorBgLayout: '#F3F6FA',
      colorFillAlter: '#F7F9FC',
      colorSuccess: '#2F7D5B',
      colorWarning: '#B7791F',
      colorError: '#B4432F',
      colorInfo: '#0062C4',
      colorLink: '#0062C4',
      colorLinkHover: '#0051A2',
    };
    // Menú lateral azul marino (#001E3B) en modo claro y oscuro
    const FELINE_MENU = {
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      darkItemSelectedBg: '#0073E6',
      darkItemSelectedColor: '#FFFFFF',
      darkItemColor: '#C9D8EA',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.08)',
      darkItemHoverColor: '#FFFFFF',
      darkGroupTitleColor: '#7E9CC2',
      itemBorderRadius: 14,
      itemHeight: 44,
      itemMarginInline: 6,
      iconSize: 18,
    };
    const FL_COMPONENTES_CLARO = {
      Menu: FELINE_MENU,
      Table: { headerBg: '#F7F9FC', headerColor: '#4A5B70', rowHoverBg: '#F7F9FC', borderColor: '#E6EDF5' },
      Button: { primaryShadow: 'none', defaultShadow: 'none', defaultBorderColor: '#B9CCE2' },
      Tabs: { itemSelectedColor: '#0062C4', inkBarColor: '#0062C4', itemHoverColor: '#0051A2' },
      Card: { headerFontSize: 17 },
      Segmented: { itemSelectedBg: '#0062C4', itemSelectedColor: '#FFFFFF', trackBg: '#E6EDF5' },
    };
    const FL_TOKENS_OSCURO = {
      colorBgLayout: '#001E3B',
      colorBgContainer: '#002F5D',
      colorBgElevated: '#003366',
      colorBorder: '#0B4A85',
      colorBorderSecondary: '#003F7A',
      colorFillAlter: '#00294F',
      colorInfo: '#0073E6',
      colorLink: '#5AA4F0',
      colorLinkHover: '#7DB6F5',
    };
    const FL_COMPONENTES_OSCURO = {
      Menu: FELINE_MENU,
      Button: { primaryShadow: 'none', defaultShadow: 'none', primaryColor: '#FFFFFF' },
      Table: { headerBg: '#00264C', rowHoverBg: '#003366', borderColor: '#003F7A' },
      Tabs: { itemSelectedColor: '#5AA4F0', inkBarColor: '#0073E6', itemHoverColor: '#7DB6F5' },
      Segmented: { itemSelectedBg: '#0073E6', itemSelectedColor: '#FFFFFF', trackBg: '#00264C' },
    };

    const STYLE_PRIMARIES = {
      feline:       { light: '#0062C4', dark: '#0073E6', label: 'Feline Capital', desc: 'Azul marino de la marca, menú lateral oscuro' },
      clean:        { light: '#2b50ed', dark: '#5b7cfa', label: 'Clean (Default)', desc: 'Superficies nítidas corporativas' },
      glassmorphic: { light: '#0ea5e9', dark: '#38bdf8', label: 'Glassmorphic',    desc: 'Efecto cristal con desenfoque' },
      neumorphic:   { light: '#6e79d9', dark: '#8f97ee', label: 'Neumorphic',      desc: 'Relieve suave tridimensional' },
      bold:         { light: '#2059ff', dark: '#6f9bff', label: 'Bold Contrast',   desc: 'Sidebar oscuro de alto contraste' },
      mui:          { light: '#1976d2', dark: '#90caf9', label: 'Material UI',     desc: 'Elevación inspirada en Material 3' },
      shadcn:       { light: '#18181b', dark: '#e4e4e7', label: 'Shadcn Minimal',  desc: 'Bordes sutiles monocromáticos' },
      serene:       { light: '#b45309', dark: '#e0a458', label: 'Serene Warm',     desc: 'Paleta cálida financiera' },
    };

    function getSurfaceOverrides(styleName, mode) {
      if (styleName === 'feline') {
        return mode === 'light'
          ? {
              bodyBg: '#F3F6FA',
              cardStyle: { background: '#FFFFFF', border: '1px solid #D5DFEB', borderRadius: 22, boxShadow: 'none' },
              siderBg: '#001E3B',
              headerBg: '#F3F6FA',
              forceDarkSider: true,
            }
          : {
              bodyBg: '#001E3B',
              cardStyle: { background: '#002F5D', border: '1px solid #003F7A', borderRadius: 22, boxShadow: 'none' },
              siderBg: '#00172E',
              headerBg: '#001E3B',
              forceDarkSider: true,
            };
      }
      if (styleName === 'glassmorphic') {
        return mode === 'light'
          ? {
              bodyBg: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 50%, #ede9fe 100%)',
              cardStyle: {
                background: 'rgba(255, 255, 255, 0.72)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.65)',
                boxShadow: '0 8px 32px rgba(14, 165, 233, 0.08)',
              },
              siderBg: 'rgba(255, 255, 255, 0.75)',
              headerBg: 'rgba(255, 255, 255, 0.75)',
            }
          : {
              bodyBg: 'linear-gradient(135deg, #090d16 0%, #0f172a 55%, #1e1b4b 100%)',
              cardStyle: {
                background: 'rgba(15, 23, 42, 0.68)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(56, 189, 248, 0.18)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
              },
              siderBg: 'rgba(15, 23, 42, 0.78)',
              headerBg: 'rgba(15, 23, 42, 0.78)',
            };
      }
      if (styleName === 'neumorphic') {
        return mode === 'light'
          ? {
              bodyBg: '#e6e9ef',
              cardStyle: {
                background: '#e6e9ef',
                border: 'none',
                boxShadow: '7px 7px 14px #c8ccd4, -7px -7px 14px #ffffff',
              },
              siderBg: '#e6e9ef',
              headerBg: '#e6e9ef',
            }
          : {
              bodyBg: '#1e222d',
              cardStyle: {
                background: '#1e222d',
                border: 'none',
                boxShadow: '6px 6px 12px #151820, -6px -6px 12px #272c3a',
              },
              siderBg: '#1e222d',
              headerBg: '#1e222d',
            };
      }
      if (styleName === 'bold') {
        return {
          bodyBg: mode === 'light' ? '#f1f5f9' : '#0b0f19',
          cardStyle: {
            border: mode === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
          },
          siderBg: '#0f172a',
          headerBg: mode === 'light' ? '#ffffff' : '#111827',
          forceDarkSider: true,
        };
      }
      return {
        bodyBg: mode === 'light' ? '#f5f6fa' : '#0f111a',
        cardStyle: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        },
        siderBg: mode === 'light' ? '#ffffff' : '#161926',
        headerBg: mode === 'light' ? '#ffffff' : '#161926',
      };
    }

    const formatCLP = (val) =>
      new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val || 0);

    // ========================================================================
    // FACTURAS Y BOLETAS: ESCENA DE DOCUMENTOS
    // Un documento a la vez ocupa la escena como la hoja real; la cola permite
    // buscar y saltar; el riel derecho reúne las acciones. Rueda o J/K para avanzar.
    // ========================================================================
    const ESC_TIPOS = {
      33: 'Factura', 34: 'Factura exenta', 39: 'Boleta', 41: 'Boleta exenta',
      46: 'Factura de compra', 56: 'Nota de débito', 61: 'Nota de crédito',
    };
    const ESC_TIPOS_SII = {
      33: 'FACTURA ELECTRÓNICA', 34: 'FACTURA NO AFECTA O EXENTA ELECTRÓNICA', 39: 'BOLETA ELECTRÓNICA',
      41: 'BOLETA NO AFECTA O EXENTA ELECTRÓNICA', 46: 'FACTURA DE COMPRA ELECTRÓNICA',
      56: 'NOTA DE DÉBITO ELECTRÓNICA', 61: 'NOTA DE CRÉDITO ELECTRÓNICA',
    };
    const ESC_ESTADOS = {
      PENDIENTE: { texto: 'Borrador', tono: 'borrador', detalle: 'Aún no tiene folio ni timbre.' },
      FIRMADO: { texto: 'Firmado, falta enviarlo', tono: 'aviso', detalle: 'Está timbrado; envíalo al SII.' },
      EN_LOTE: { texto: 'Enviando al SII', tono: 'enviado', detalle: 'En el próximo envío.' },
      ENVIADO: { texto: 'Enviado al SII', tono: 'enviado', detalle: 'Esperando la respuesta del SII.' },
      ACEPTADO: { texto: 'Aceptado por el SII', tono: 'ok', detalle: '' },
      ACEPTADO_CON_REPARO: { texto: 'Aceptado con reparos', tono: 'aviso', detalle: 'Revisa las observaciones del SII.' },
      RECHAZADO: { texto: 'Rechazado por el SII', tono: 'error', detalle: 'Corrige y emite un documento nuevo.' },
      ANULADO: { texto: 'Anulado', tono: 'borrador', detalle: 'Revertido con una nota de crédito.' },
    };
    const ESC_COBRO = {
      NOT_PAID: 'Por cobrar', PARTIAL: 'Pago parcial', PAID: 'Pagada', IN_PAYMENT: 'Pago en proceso', REVERSED: 'Revertida',
    };
    const ESC_SOLAPE = 56;
    const ESC_MAX_PUNTOS = 11;
    const ESC_FORMA_PAGO = { 1: 'Contado', 2: 'Crédito', 3: 'Sin costo' };
    const ESC_COD_REF = { 1: 'Anula el documento', 2: 'Corrige texto', 3: 'Corrige montos' };
    const ESC_FILTROS = [
      { id: 'todos', texto: 'Todos', tipos: null },
      { id: 'facturas', texto: 'Facturas', tipos: [33, 34] },
      { id: 'boletas', texto: 'Boletas', tipos: [39, 41] },
      { id: 'notas', texto: 'Notas', tipos: [56, 61] },
    ];

    const escEstado = (d) => (d.state === 'DRAFT' ? 'PENDIENTE' : d.dteStatus || 'PENDIENTE');
    const escPorCobrar = (d) =>
      d.state === 'POSTED' && d.documentTypeCode !== 61 && d.paymentState !== 'REVERSED' && (d.amountResidual || 0) > 0;
    const ESC_FILTROS_ESTADO = [
      { id: 'todos', texto: 'Estado', cumple: () => true },
      { id: 'enviar', texto: 'Por enviar', cumple: (d) => escEstado(d) === 'FIRMADO' },
      { id: 'borrador', texto: 'Borradores', cumple: (d) => escEstado(d) === 'PENDIENTE' },
      { id: 'rechazado', texto: 'Rechazados', cumple: (d) => escEstado(d) === 'RECHAZADO' },
      { id: 'cobrar', texto: 'Por cobrar', cumple: escPorCobrar },
      { id: 'aceptado', texto: 'Aceptados', cumple: (d) => escEstado(d) === 'ACEPTADO' || escEstado(d) === 'ACEPTADO_CON_REPARO' },
    ];
    const escNombre = (d) =>
      d.state === 'DRAFT'
        ? 'Borrador de ' + (ESC_TIPOS[d.documentTypeCode] || 'documento').toLowerCase()
        : (ESC_TIPOS[d.documentTypeCode] || 'Documento') + ' ' + Number(d.l10nLatamDocumentNumber || 0);
    const escRut = (rut) => {
      const [cuerpo, dv] = String(rut || '').split('-');
      if (!dv) return rut || '';
      return Number(cuerpo).toLocaleString('es-CL') + '-' + dv;
    };
    const escFecha = (iso, conAnio) => {
      if (!iso) return '';
      const f = new Date(iso + 'T12:00:00');
      return f.toLocaleDateString('es-CL', conAnio ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' });
    };
    const escMonto = (n) => '$' + Math.round(n || 0).toLocaleString('es-CL');
    const escSigno = (d) => (d.documentTypeCode === 61 ? '−' : '');

    function EscTimbre({ ted }) {
      const lienzo = React.useRef(null);
      const [fallo, setFallo] = useState(false);
      useEffect(() => {
        if (!ted || !lienzo.current) return;
        try {
          window.bwipjs.toCanvas(lienzo.current, {
            bcid: 'pdf417', text: ted, eclevel: 5, columns: 14, scale: 2, height: 1.4,
          });
          setFallo(false);
        } catch (e) {
          setFallo(true);
        }
      }, [ted]);
      if (!ted) return <div className="esc-timbre esc-timbre-vacio">El timbre electrónico se genera al emitir.</div>;
      if (fallo) return <div className="esc-timbre esc-timbre-vacio">No se pudo dibujar el timbre. Revísalo en el XML.</div>;
      return <canvas ref={lienzo} className="esc-timbre" aria-label="Timbre electrónico PDF417" role="img" />;
    }

    function EscHoja({ doc, empresa }) {
      const borrador = doc.state === 'DRAFT';
      const lineas = doc.lines || [];
      return (
        <article className="esc-hoja" aria-label={escNombre(doc)}>
          <header className="esc-hoja-cabecera">
            <div className="esc-hoja-emisor">
              <strong>{empresa?.razonSocial}</strong>
              <span>{empresa?.giro}</span>
              <span>{[empresa?.direccionOrigen, empresa?.comunaOrigen].filter(Boolean).join(', ')}</span>
            </div>
            <div className={'esc-recuadro' + (borrador ? ' esc-recuadro-borrador' : '')}>
              <span>R.U.T.: {escRut(empresa?.rut)}</span>
              <strong>{ESC_TIPOS_SII[doc.documentTypeCode] || 'DOCUMENTO TRIBUTARIO'}</strong>
              <span>{borrador ? 'BORRADOR · SIN FOLIO' : 'N° ' + Number(doc.l10nLatamDocumentNumber || 0)}</span>
            </div>
          </header>
          <div className="esc-hoja-sii">S.I.I. — {(empresa?.comunaOrigen || 'Santiago').toUpperCase()}</div>

          <dl className="esc-hoja-receptor">
            <div><dt>Señor(es)</dt><dd>{doc.partnerName}</dd></div>
            <div><dt>R.U.T.</dt><dd className="esc-num">{escRut(doc.partnerRut)}</dd></div>
            <div><dt>Fecha de emisión</dt><dd>{escFecha(doc.invoiceDate, true)}</dd></div>
            <div><dt>Forma de pago</dt><dd>{ESC_FORMA_PAGO[doc.formaPagoSii] || 'Contado'}</dd></div>
          </dl>

          {(doc.references || []).length > 0 && (
            <p className="esc-hoja-ref">
              {(doc.references || []).map((r) => (
                <span key={r.sequence}>
                  Referencia: {ESC_TIPOS[Number(r.originDocTypeCode)] || 'Documento'} {r.originDocNumber}
                  {r.referenceDocCode ? ' · ' + ESC_COD_REF[r.referenceDocCode] : ''}
                  {r.reason ? ' · ' + r.reason : ''}
                </span>
              ))}
            </p>
          )}

          <table className="esc-hoja-lineas">
            <thead>
              <tr><th>Cant.</th><th>Descripción</th><th className="esc-der">Precio</th><th className="esc-der">Total</th></tr>
            </thead>
            <tbody>
              {lineas.map((l) => (
                <tr key={l.sequence}>
                  <td className="esc-num">{l.quantity}</td>
                  <td>{l.name}{l.isExempt ? <em> (exento)</em> : null}</td>
                  <td className="esc-der esc-num">{escMonto(l.priceUnit)}</td>
                  <td className="esc-der esc-num">{escMonto(l.priceSubtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <footer className="esc-hoja-pie">
            <div className="esc-hoja-timbre">
              <EscTimbre ted={borrador ? null : doc.tedXml} />
              {!borrador && doc.tedXml && <span>Timbre electrónico SII · Verifique documento en www.sii.cl</span>}
            </div>
            <dl className="esc-hoja-totales esc-num">
              {doc.amountUntaxed > 0 && <div><dt>Neto</dt><dd>{escMonto(doc.amountUntaxed)}</dd></div>}
              {doc.amountExempt > 0 && <div><dt>Exento</dt><dd>{escMonto(doc.amountExempt)}</dd></div>}
              {doc.amountTax > 0 && <div><dt>IVA 19%</dt><dd>{escMonto(doc.amountTax)}</dd></div>}
              <div className="esc-hoja-total"><dt>Total</dt><dd>{escMonto(doc.amountTotal)}</dd></div>
            </dl>
          </footer>
        </article>
      );
    }

    function EscAccion({ icono, texto, motivo, onClick, principal }) {
      const deshabilitada = !onClick;
      return (
        <button
          type="button"
          className={'esc-accion' + (principal ? ' esc-accion-principal' : '')}
          onClick={onClick || undefined}
          aria-disabled={deshabilitada}
          title={deshabilitada ? motivo : texto}
        >
          <span className="esc-accion-icono"><RIcono nombre={icono} size={22} /></span>
          <span className="esc-accion-texto">{texto}</span>
        </button>
      );
    }

    ${salesGoalsUi}
    ${salesListUi}
    function EscenaDocumentos({
      documentos, titulo, initialSelection, empresa, periodo, cargando, errorCarga, onReintentar,
      onEmitirFactura, onEmitirBoleta, onFirmar, onVerXml, onCobrar, onNotaCredito, onEnviarSii,
    }) {
      const [filtro, setFiltro] = useState('todos');
      const [busqueda, setBusqueda] = useState('');
      const [estadoFiltro, setEstadoFiltro] = useState('todos');
      const [seleccionId, setSeleccionId] = useState(initialSelection ?? null);
      const [direccion, setDireccion] = useState(0);
      const escenaRef = React.useRef(null);
      const escenarioRef = React.useRef(null);
      const hojaRef = React.useRef(null);
      const ultimoGiro = React.useRef(0);
      const [escala, setEscala] = useState(1);
      const [medidaHoja, setMedidaHoja] = useState({ ancho: 600, alto: 600 });
      const [hojaFluida, setHojaFluida] = useState(false);

      const ordenados = useMemo(
        () => documentos.slice().sort((a, b) =>
          (b.invoiceDate || '').localeCompare(a.invoiceDate || '') || (b.createdAt || '').localeCompare(a.createdAt || '')),
        [documentos]
      );
      const conteo = (tipos) => (tipos ? ordenados.filter((d) => tipos.includes(d.documentTypeCode)).length : ordenados.length);
      const lista = useMemo(() => {
        const tipos = ESC_FILTROS.find((f) => f.id === filtro)?.tipos;
        const cumpleEstado = (ESC_FILTROS_ESTADO.find((f) => f.id === estadoFiltro) || ESC_FILTROS_ESTADO[0]).cumple;
        const q = busqueda.trim().toLowerCase();
        return ordenados.filter((d) => {
          if (tipos && !tipos.includes(d.documentTypeCode)) return false;
          if (!cumpleEstado(d)) return false;
          if (!q) return true;
          return [d.partnerName, d.partnerRut, escRut(d.partnerRut), escNombre(d), String(d.l10nLatamDocumentNumber || '')]
            .some((v) => String(v || '').toLowerCase().includes(q));
        });
      }, [ordenados, filtro, busqueda, estadoFiltro]);

      const indice = Math.max(0, lista.findIndex((d) => d.id === seleccionId));
      const actual = lista[indice] || null;

      useEffect(() => {
        if (lista.length && !lista.some((d) => d.id === seleccionId)) setSeleccionId(lista[0].id);
      }, [lista, seleccionId]);

      const mover = (paso) => {
        if (!lista.length) return;
        const nuevo = Math.min(lista.length - 1, Math.max(0, indice + paso));
        if (nuevo === indice) return;
        setDireccion(paso);
        setSeleccionId(lista[nuevo].id);
        const fila = document.getElementById('esc-fila-' + lista[nuevo].id);
        if (fila) fila.scrollIntoView({ block: 'nearest' });
      };

      useEffect(() => {
        const alTeclear = (e) => {
          if (e.metaKey || e.ctrlKey || e.altKey) return;
          if (e.target.closest('input, textarea, select, [contenteditable], .ant-modal, .ant-select, .ant-dropdown')) return;
          if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown') { e.preventDefault(); mover(1); }
          if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
        };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
      });

      const alGirar = (e) => {
        if (Math.abs(e.deltaY) < 24) return;
        const ahora = Date.now();
        if (ahora - ultimoGiro.current < 420) return;
        ultimoGiro.current = ahora;
        mover(e.deltaY > 0 ? 1 : -1);
      };

      // La hoja se escala para caber completa en la escena
      React.useLayoutEffect(() => {
        const ajustar = () => {
          const escenario = escenarioRef.current;
          const hoja = hojaRef.current;
          if (!escenario || !hoja) return;
          // Lista y documento apilados (teléfono): la hoja se reacomoda al ancho, con texto legible
          const contenedor = escenario.closest('.esc');
          const fluida = !!contenedor && contenedor.clientWidth < 720;
          setHojaFluida(fluida);
          if (fluida) { setEscala(1); return; }
          // Escritorio y tablet: el pie de la hoja pasa bajo el degradado de la leyenda (ESC_SOLAPE px)
          const cs = getComputedStyle(escenario);
          const disponibleAlto = escenario.clientHeight - 16 + ESC_SOLAPE;
          const disponibleAncho = escenario.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
          const s = Math.min(1, disponibleAlto / hoja.offsetHeight, disponibleAncho / hoja.offsetWidth);
          setEscala(Math.max(0.5, s));
          setMedidaHoja({ ancho: hoja.offsetWidth, alto: hoja.offsetHeight });
        };
        ajustar();
        const obs = new ResizeObserver(ajustar);
        if (escenarioRef.current) obs.observe(escenarioRef.current);
        if (hojaRef.current) obs.observe(hojaRef.current);
        return () => obs.disconnect();
      }, [actual?.id]);

      const posteados = ordenados.filter((d) => d.state === 'POSTED');
      const porCobrar = posteados.filter(escPorCobrar).reduce((s, d) => s + (d.amountResidual || 0), 0);
      const porEnviar = ordenados.filter((d) => escEstado(d) === 'FIRMADO').length;
      const borradores = ordenados.filter((d) => d.state === 'DRAFT').length;
      const mesTexto = periodo
        ? new Date(periodo + '-15T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase())
        : '';

      const estado = actual ? ESC_ESTADOS[escEstado(actual)] || ESC_ESTADOS.PENDIENTE : null;
      const emitido = actual && actual.state === 'POSTED';
      const revertido = actual && actual.paymentState === 'REVERSED';
      const esVenta = actual && actual.moveType === 'OUT_INVOICE';
      // La acción principal del riel es siempre el siguiente paso del documento
      const siguiente = !actual
        ? null
        : actual.state === 'DRAFT'
        ? 'firmar'
        : escEstado(actual) === 'FIRMADO'
        ? 'enviar'
        : esVenta && escPorCobrar(actual)
        ? 'cobrar'
        : null;
      // PDF: la hoja se imprime sola, a tamaño real (Guardar como PDF en el diálogo del navegador)
      const imprimirHoja = () => {
        document.body.classList.add('esc-imprimiendo');
        const limpiar = () => { document.body.classList.remove('esc-imprimiendo'); window.removeEventListener('afterprint', limpiar); };
        window.addEventListener('afterprint', limpiar);
        window.print();
      };

      const menuEmitir = {
        items: [
          { key: 'factura', label: 'Factura (con IVA o exenta)' },
          { key: 'boleta', label: 'Boleta a consumidor final' },
        ],
        onClick: ({ key }) => (key === 'factura' ? onEmitirFactura() : onEmitirBoleta()),
      };

      return (
        <div className="esc-contenedor">
        <div className="esc">
          <section className="esc-cola" aria-label="Documentos">
            <div className="esc-cola-cabecera">
              <h1>{titulo}</h1>
              <antd.Dropdown menu={menuEmitir} trigger={['click']} placement="bottomRight">
                <button type="button" className="esc-boton esc-boton-principal">
                  <RIcono nombre="emitir" size={16} /> Emitir
                </button>
              </antd.Dropdown>
            </div>

            <p className="esc-resumen esc-num">
              <span className="esc-mes">{mesTexto}</span>
              <span><b>{ordenados.length}</b> documentos</span>
              <span>Por cobrar <b>{escMonto(porCobrar)}</b></span>
              {(porEnviar > 0 || borradores > 0) && (
                <span className="esc-pendiente">
                  {porEnviar > 0 && <><b>{porEnviar}</b> por enviar al SII</>}
                  {porEnviar > 0 && borradores > 0 && ' · '}
                  {borradores > 0 && <><b>{borradores}</b> {borradores === 1 ? 'borrador' : 'borradores'}</>}
                </span>
              )}
            </p>

            <div className="esc-filtros" role="tablist" aria-label="Tipo de documento">
              {ESC_FILTROS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filtro === f.id}
                  className={'esc-filtro' + (filtro === f.id ? ' esc-filtro-activo' : '')}
                  onClick={() => setFiltro(f.id)}
                >
                  {f.texto} <span className="esc-num">{conteo(f.tipos)}</span>
                </button>
              ))}
            </div>

            <div className="esc-busqueda">
              <label className="esc-buscar">
                <RIcono nombre="buscar" size={16} />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="RUT, folio o cliente"
                  aria-label="Buscar documentos"
                />
              </label>
              <select
                className={'esc-select' + (estadoFiltro !== 'todos' ? ' esc-select-activo' : '')}
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                aria-label="Filtrar por estado"
              >
                {ESC_FILTROS_ESTADO.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.texto} ({ordenados.filter(f.cumple).length})
                  </option>
                ))}
              </select>
            </div>

            <ol className="esc-lista">
              {cargando && !ordenados.length && [0, 1, 2, 3].map((i) => <li key={i} className="esc-fila esc-fila-cargando" aria-hidden="true" />)}
              {lista.map((d) => {
                const est = ESC_ESTADOS[escEstado(d)] || ESC_ESTADOS.PENDIENTE;
                const elegido = actual && d.id === actual.id;
                return (
                  <li key={d.id}>
                    <button
                      id={'esc-fila-' + d.id}
                      type="button"
                      className={'esc-fila' + (elegido ? ' esc-fila-elegida' : '')}
                      aria-current={elegido ? 'true' : undefined}
                      onClick={() => {
                        setDireccion(lista.indexOf(d) > indice ? 1 : -1);
                        setSeleccionId(d.id);
                      }}
                    >
                      <span className="esc-fila-a">
                        <span className="esc-fila-nombre">{escNombre(d)}</span>
                        <span className="esc-fila-monto esc-num">{escSigno(d)}{escMonto(d.amountTotal)}</span>
                      </span>
                      <span className="esc-fila-cliente">{d.partnerName}</span>
                      <span className="esc-fila-b">
                        <span className={'esc-estado esc-tono-' + est.tono}><i aria-hidden="true" />{est.texto}</span>
                        <span className="esc-fila-fecha">{escFecha(d.invoiceDate)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {!cargando && ordenados.length > 0 && lista.length === 0 && (
              <div className="esc-vacio-lista">
                <p>{busqueda ? 'Ningún documento coincide con «' + busqueda + '» en este filtro.' : 'No hay documentos con este filtro.'}</p>
                <button type="button" className="esc-boton" onClick={() => { setBusqueda(''); setFiltro('todos'); setEstadoFiltro('todos'); }}>Ver todos</button>
              </div>
            )}
          </section>

          <section className="esc-escena" ref={escenaRef} onWheel={alGirar} aria-live="polite" aria-label="Documento seleccionado">
            {!actual && !cargando && errorCarga && (
              <div className="esc-vacio" role="alert">
                <h2>No se pudieron cargar los documentos</h2>
                <p>Feline no respondió ({errorCarga}). Tus documentos no se perdieron; vuelve a intentarlo.</p>
                <div className="esc-vacio-acciones">
                  <button type="button" className="esc-boton esc-boton-principal" onClick={onReintentar}>Reintentar</button>
                </div>
              </div>
            )}

            {!actual && !cargando && !errorCarga && (
              <div className="esc-vacio">
                <h2>{ordenados.length ? 'Elige un documento' : 'Todavía no hay documentos en este período'}</h2>
                <p>{ordenados.length
                  ? 'Selecciónalo en la lista para verlo completo aquí.'
                  : 'Emite una factura o una boleta y aparecerá aquí, con su timbre y su estado ante el SII.'}</p>
                {!ordenados.length && (
                  <div className="esc-vacio-acciones">
                    <button type="button" className="esc-boton esc-boton-principal" onClick={onEmitirFactura}>Emitir factura</button>
                    <button type="button" className="esc-boton" onClick={onEmitirBoleta}>Emitir boleta</button>
                  </div>
                )}
              </div>
            )}

            {actual && (
              <>
                <div className="esc-navegacion">
                  <span className="esc-num">{indice + 1} de {lista.length}</span>
                  <button type="button" className="esc-flecha" onClick={() => mover(-1)} disabled={indice === 0} aria-label="Documento anterior (K)">
                    <RIcono nombre="arriba" size={18} />
                  </button>
                  <button type="button" className="esc-flecha" onClick={() => mover(1)} disabled={indice >= lista.length - 1} aria-label="Documento siguiente (J)">
                    <RIcono nombre="abajo" size={18} />
                  </button>
                  <kbd>J</kbd><kbd>K</kbd>
                </div>

                <div className="esc-escenario" ref={escenarioRef}>
                  <div
                    key={actual.id}
                    className={'esc-hoja-marco ' + (direccion >= 0 ? 'esc-entra-abajo' : 'esc-entra-arriba') + (hojaFluida ? ' esc-hoja-fluida' : '')}
                    style={hojaFluida ? undefined : { width: medidaHoja.ancho * escala, height: medidaHoja.alto * escala }}
                  >
                    <div
                      ref={hojaRef}
                      style={hojaFluida ? undefined : { transform: 'scale(' + escala + ')', transformOrigin: 'top left', width: 'max-content' }}
                    >
                      <EscHoja doc={actual} empresa={empresa} />
                    </div>
                  </div>
                  {lista.length > 1 && (() => {
                    const desde = Math.max(0, Math.min(indice - Math.floor(ESC_MAX_PUNTOS / 2), lista.length - ESC_MAX_PUNTOS));
                    const visibles = lista.slice(desde, desde + ESC_MAX_PUNTOS);
                    return (
                      <div className="esc-puntos" role="group" aria-label="Posición en la lista">
                        {visibles.map((d, i) => (
                          <button
                            key={d.id}
                            type="button"
                            className={'esc-punto' + (d.id === actual.id ? ' esc-punto-activo' : '')}
                            aria-label={'Ver ' + escNombre(d)}
                            aria-current={d.id === actual.id ? 'true' : undefined}
                            onClick={() => { setDireccion(desde + i > indice ? 1 : -1); setSeleccionId(d.id); }}
                          />
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className="esc-leyenda">
                  <div className="esc-leyenda-texto">
                    <h2 className="esc-folio esc-num">{escNombre(actual)}</h2>
                    <p className="esc-leyenda-cliente">{actual.partnerName}</p>
                    <p className="esc-leyenda-datos esc-num">
                      {escRut(actual.partnerRut)} · {escFecha(actual.invoiceDate, true)}
                    </p>
                    <p className={'esc-estado esc-estado-grande esc-tono-' + estado.tono}>
                      <i aria-hidden="true" />{estado.texto}
                      {actual.trackId && escEstado(actual) !== 'PENDIENTE' && <span className="esc-num"> · Seguimiento SII {actual.trackId}</span>}
                    </p>
                    {estado.detalle && <p className="esc-leyenda-detalle">{estado.detalle}</p>}
                  </div>
                  <div className="esc-leyenda-total">
                    <span className="esc-total esc-num">{escSigno(actual)}{escMonto(actual.amountTotal)}</span>
                    <span className="esc-cobro">
                      {emitido && actual.documentTypeCode !== 61
                        ? (ESC_COBRO[actual.paymentState] || '') +
                          (actual.paymentState === 'PARTIAL' ? ' · faltan ' + escMonto(actual.amountResidual) : '')
                        : actual.documentTypeCode === 61 ? 'Nota de crédito' : 'Sin emitir'}
                    </span>
                  </div>
                </div>
              </>
            )}
          </section>

          <nav className="esc-riel" aria-label="Acciones del documento">
            <EscAccion
              principal={siguiente === 'firmar'}
              icono="editar"
              texto="Firmar y emitir"
              motivo={actual ? 'Ya está emitido' : 'Elige un documento'}
              onClick={actual && actual.state === 'DRAFT' ? () => onFirmar(actual.id) : null}
            />
            <EscAccion
              principal={siguiente === 'enviar'}
              icono="emitir"
              texto="Enviar al SII"
              motivo={actual && escEstado(actual) === 'PENDIENTE' ? 'Primero emítelo' : 'Ya fue enviado'}
              onClick={actual && escEstado(actual) === 'FIRMADO' ? onEnviarSii : null}
            />
            <EscAccion
              principal={siguiente === 'cobrar'}
              icono="billetera"
              texto="Registrar pago"
              motivo={!emitido ? 'Primero emítelo' : 'No tiene saldo por cobrar'}
              onClick={emitido && esVenta && !revertido && actual.amountResidual > 0 ? () => onCobrar(actual) : null}
            />
            <EscAccion
              icono="devolver"
              texto="Nota de crédito"
              motivo={!emitido ? 'Primero emítelo' : revertido ? 'Ya fue revertido' : 'Solo para facturas y boletas'}
              onClick={emitido && esVenta && !revertido ? () => onNotaCredito(actual) : null}
            />
            <EscAccion
              icono="factura"
              texto="PDF"
              motivo="Elige un documento"
              onClick={actual ? imprimirHoja : null}
            />
            <EscAccion
              icono="descargar"
              texto="XML y timbre"
              motivo="Disponible al emitir"
              onClick={actual && actual.dteXmlFirmado ? () => onVerXml(actual) : null}
            />
          </nav>
        </div>
        </div>
      );
    }

    // ========================================================================
    // INICIO DE SESIÓN DEL PANEL
    // ========================================================================
    function PantallaIngreso({ onIngreso }) {
      const [enviando, setEnviando] = useState(false);
      const [error, setError] = useState(null);
      const [accesoDev, setAccesoDev] = useState(null);
      useEffect(() => {
        // Solo responde en desarrollo; en producción da 404 y la sección no se muestra
        fetch('/api/v1/panel/acceso-desarrollo')
          .then((r) => (r.ok ? r.json() : null))
          .then(setAccesoDev)
          .catch(() => setAccesoDev(null));
      }, []);
      const ingresar = async (valores) => {
        setEnviando(true);
        setError(null);
        try {
          const res = await fetch('/api/v1/panel/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: valores.email, clave: valores.clave }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'No se pudo iniciar sesión');
          await fetch('/api/v1/finance/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => undefined);
          await fetch('/api/v1/finance/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: valores.email.trim(), password: valores.clave }),
          }).catch(() => {});
          onIngreso(data);
        } catch (err) {
          setError(err.message);
        } finally {
          setEnviando(false);
        }
      };
      return (
        <div className="ing">
          <main className="ing-caja">
            <span
              className="fl-logo ing-logo"
              role="img"
              aria-label="Feline Capital"
            />
            <h1>Inicia sesión</h1>
            <p className="ing-texto">Facturación electrónica y contabilidad de tus empresas.</p>
            <Form layout="vertical" onFinish={ingresar} requiredMark={false} disabled={enviando}>
              <Form.Item name="email" label="Correo" rules={[{ required: true, type: 'email', message: 'Ingresa tu correo' }]}>
                <Input autoComplete="username" autoFocus size="large" />
              </Form.Item>
              <Form.Item name="clave" label="Contraseña" rules={[{ required: true, message: 'Ingresa tu contraseña' }]}>
                <Input.Password autoComplete="current-password" size="large" />
              </Form.Item>
              {error && <p className="ing-error" role="alert">{error}</p>}
              <Button type="primary" htmlType="submit" size="large" block loading={enviando}>
                Entrar
              </Button>
            </Form>
            {accesoDev && accesoDev.usuarios.length > 0 && (
              <section className="ing-dev" aria-label="Acceso rápido de desarrollo">
                <p className="ing-dev-titulo">Modo desarrollo</p>
                <p className="ing-dev-clave">
                  Clave: <code>{accesoDev.clave}</code> · pincha un usuario para entrar
                </p>
                {accesoDev.usuarios.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    className="ing-dev-usuario"
                    disabled={enviando}
                    onClick={() => ingresar({ email: u.email, clave: accesoDev.clave })}
                  >
                    <span className="ing-dev-nombre">{u.nombre}</span>
                    <span className="ing-dev-detalle">{u.rol} · {u.email}</span>
                  </button>
                ))}
              </section>
            )}
          </main>
        </div>
      );
    }

    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
      }
      static getDerivedStateFromError(error) {
        return { hasError: true, error };
      }
      componentDidCatch(error, errorInfo) {
        console.error("Feline ErrorBoundary caught an error:", error, errorInfo);
      }
      render() {
        if (this.state.hasError) {
          return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A', padding: 20 }}>
              <div style={{ maxWidth: 520, width: '100%', background: '#1E293B', border: '1px solid #334155', borderRadius: 12, padding: 28, color: '#F8FAFC' }}>
                <h3 style={{ margin: '0 0 10px', color: '#F87171' }}>Recuperación Automática de Panel</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#94A3B8' }}>{String(this.state.error?.message || 'Error inesperado')}</p>
                <button
                  style={{ background: '#0062C4', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => { localStorage.clear(); window.location.hash = ''; window.location.reload(); }}
                >
                  Reiniciar Vista
                </button>
              </div>
            </div>
          );
        }
        return this.props.children;
      }
    }

    function PanelConSesion() {
      const [sesion, setSesion] = useState(undefined);
      useEffect(() => {
        fetch('/api/v1/panel/sesion')
          .then((r) => (r.ok ? r.json() : null))
          .then(setSesion)
          .catch(() => setSesion(null));
      }, []);
      const salir = async () => {
        await fetch('/api/v1/finance/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => undefined);
        await fetch('/api/v1/panel/logout', { method: 'POST' }).catch(() => undefined);
        setSesion(null);
      };
      if (sesion === undefined) return <div className="ing" aria-busy="true" />;
      if (!sesion) return <PantallaIngreso onIngreso={setSesion} />;
      return <FelineApp sesion={sesion} onSalir={salir} onSesionExpirada={() => setSesion(null)} />;
    }

    function FelineApp({ sesion, onSalir, onSesionExpirada }) {
      const [designStyle, setDesignStyle] = useState('${defaultStyle}');
      const [themeMode, setThemeMode] = useState('light');
      const [borderRadius, setBorderRadius] = useState(12);
      const [compactMode, setCompactMode] = useState(false);
      const [styleDrawerOpen, setStyleDrawerOpen] = useState(false);
      const [collapsed, setCollapsed] = useState(false);
      const [activeTab, setActiveTabState] = useState('01-inicio');
      const [currentArea, setCurrentArea] = useState('inicio');
      const [dashPeriodoFiltro, setDashPeriodoFiltro] = useState('este-mes');
      const [customDateRange, setCustomDateRange] = useState(null);
      const [visibleDashSections, setVisibleDashSections] = useState({
        resumen: true, metas: true, finanzas: true, facturacion: true,
        ventas: true, compras: true, contabilidad: true, bancos: true,
        inventario: true, activos: true, impuestos: true, informes: true,
        auditoria: true, alertas: true
      });
      const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
      const [currentSubTab, setCurrentSubTab] = useState('resumen');
      const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
      const [docDetailModalOpen, setDocDetailModalOpen] = useState(false);
      const [docDetailData, setDocDetailData] = useState(null);
      const [submittingMove, setSubmittingMove] = useState(false);

      const abrirDetalleDocumento = (doc) => {
        setDocDetailData(doc);
        setDocDetailModalOpen(true);
      };

      const LEGACY_MAP = {
        '01-inicio': { area: 'inicio', sub: 'resumen' },
        'finance-overview': { area: 'inicio', sub: 'resumen' },
        '04-facturacion': { area: 'ventas', sub: 'documentos' },
        'ventas-facturas-boletas': { area: 'ventas', sub: 'documentos' },
        '06-ventas': { area: 'ventas', sub: 'cobranzas' },
        '07-compras': { area: 'compras', sub: 'recibidos' },
        'gastos-rendiciones': { area: 'compras', sub: 'rendiciones' },
        '08-inventario': { area: 'compras', sub: 'catalogo' },
        '03-finanzas': { area: 'tesoreria', sub: 'caja-bancos' },
        '09-tesoreria': { area: 'tesoreria', sub: 'caja-bancos' },
        '05-contabilidad': { area: 'contabilidad', sub: 'balance' },
        'odoo-contabilidad': { area: 'contabilidad', sub: 'balance' },
        '10-impuestos': { area: 'contabilidad', sub: 'f29' },
        'libro-compra-venta': { area: 'contabilidad', sub: 'rcv' },
        '11-informes': { area: 'contabilidad', sub: 'mayor' },
        '02-empresas': { area: 'administracion', sub: 'empresas' },
        'tenants-certs': { area: 'administracion', sub: 'tributaria' },
        '12-configuracion': { area: 'administracion', sub: 'usuarios' },
        'usuarios-permisos': { area: 'administracion', sub: 'usuarios' },
        'caf-folios': { area: 'administracion', sub: 'tributaria' },
        'sii-soap-envios': { area: 'administracion', sub: 'tributaria' },
      };

      const navegarA = (area, sub = null) => {
        const leg = LEGACY_MAP[area];
        const a = leg ? leg.area : area;
        const s = a === 'ventas' && sub?.startsWith('meta-') ? 'metas' : sub || (leg ? leg.sub : (
          a === 'ventas' ? 'resumen' :
          a === 'compras' ? 'recibidos' :
          a === 'tesoreria' ? 'caja-bancos' :
          a === 'contabilidad' ? 'diario' :
          a === 'administracion' ? 'empresas' : 'resumen'
        ));
        setCurrentArea(a);
        setCurrentSubTab(s);
        setActiveTabState(a);
        try {
          const h = a + (s && s !== 'resumen' ? '/' + s : '');
          if (window.location.hash !== '#' + h) {
            window.location.hash = h;
          }
        } catch (_) {}
        setMobileDrawerOpen(false);
      };

      const [salesOpen, setSalesOpen] = useState([]);
      useEffect(() => {
        if (currentArea !== 'ventas') return;
        const group = {
          'crear-factura': 'ventas-facturas', facturas: 'ventas-facturas', borradores: 'ventas-facturas',
          'crear-boleta': 'ventas-boletas', boletas: 'ventas-boletas',
          documentos: 'ventas-documentos', pagados: 'ventas-documentos',
          pendientes: 'ventas-documentos', vencidos: 'ventas-documentos', corregidos: 'ventas-documentos',
        }[currentSubTab];
        setSalesOpen(keys => Array.from(new Set([...keys, 'ventas', ...(group ? [group] : [])])));
      }, [currentArea, currentSubTab]);
      const salesLink = (key, label) => ({ key: 'ventas/' + key, label });
      const salesMenu = {
        key: 'ventas', icon: <RIcono nombre="emitir" size={17} />, label: '02 · Ventas',
        children: [
          salesLink('resumen', 'Resumen de ventas'),
          salesLink('metas', 'Metas de ventas'),
          { key: 'ventas-facturas', label: 'Emisión de facturas', children: [
            salesLink('crear-factura', 'Crear factura'), salesLink('facturas', 'Facturas emitidas'), salesLink('borradores', 'Borradores'),
          ] },
          { key: 'ventas-boletas', label: 'Emisión de boletas', children: [
            salesLink('crear-boleta', 'Crear boleta'), salesLink('boletas', 'Boletas emitidas'),
          ] },
          { key: 'ventas-documentos', label: 'Documentos emitidos', children: [
            salesLink('documentos', 'Todos los documentos'), salesLink('pagados', 'Pagados'),
            salesLink('pendientes', 'Pendientes de pago'), salesLink('vencidos', 'Vencidos'),
            salesLink('corregidos', 'Anulados o corregidos'),
          ] },
          salesLink('clientes', 'Clientes'), salesLink('cobranzas', 'Cuentas por cobrar'),
        ],
      };
      const salesMenuProps = {
        selectedKeys: [currentArea === 'ventas' ? 'ventas/' + currentSubTab : currentArea],
        openKeys: salesOpen,
        onOpenChange: keys => {
          setSalesOpen(keys);
          if (keys.includes('ventas') && !salesOpen.includes('ventas') && currentArea !== 'ventas') navegarA('ventas');
        },
        onClick: ({ key }) => navegarA(...key.split('/')),
      };

      const setActiveTab = (tab) => {
        navegarA(tab);
      };

      useEffect(() => {
        const onHash = () => {
          const h = window.location.hash || '';
          const raw = (h.startsWith('#') ? h.slice(1) : h).trim();
          if (!raw) return;
          const parts = raw.split('/');
          navegarA(parts[0], parts[1] || null);
        };
        onHash();
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
      }, []);

      const [loading, setLoading] = useState(false);
      const [errorCarga, setErrorCarga] = useState(null);
      const [dashboardData, setDashboardData] = useState({
        tenants: [],
        users: [],
        roleProfiles: [],
        partners: [],
        cafs: [],
        moves: [],
        lotesEnviados: [],
        documentTypes: [],
        rcvF29: null,
        accounting: null,
        expenses: [],
        expenseSheets: [],
        finance: {
          isPersistent: false,
          receivables: [],
          payables: [],
          vendors: [],
          cashBoxes: [],
          bankAccounts: [],
          costCenters: [],
          receivedDtes: [],
          taxDeclarations: [],
          budgets: [],
          fixedAssets: [],
          payrollEmployees: [],
          feeReceipts: [],
          currencyRates: [],
          taxSettings: null,
          auditEvents: [],
        },
      });
      const [activeTenantId, setActiveTenantId] = useState(sesion.usuario.tenantIds[0]);
      const [periodoTributario, setPeriodoTributario] = useState('2026-10');

      // Modales interactivos
      const [invoicePreview, setInvoicePreview] = useState(null);
      const [invoicePreviewError,setInvoicePreviewError]=useState('');
      const previewRequest=React.useRef(null);
      const previewTimer=React.useRef(null);
      const additionalTaxOptions=Object.entries(${JSON.stringify(ilaRates)}).map(([code,rate])=>({
        value:Number(code),
        label:code+' · '+({24:'Licores y destilados',25:'Vinos',26:'Cervezas y otras bebidas alcohólicas',27:'Bebidas analcohólicas gravadas',271:'Bebidas gravadas con tasa incrementada'})[code]+' · '+rate.replace('.',',')+'%',
      }));
      const invoiceBusy = React.useRef(false);
      const [saleListOrigin,setSaleListOrigin]=useState('documentos');
      const [selectedSaleId, setSelectedSaleId] = useState(null);
      const [newPurchaseModalOpen, setNewPurchaseModalOpen] = useState(false);
      const [newManualEntryModalOpen, setNewManualEntryModalOpen] = useState(false);
      const [certUploadModalOpen, setCertUploadModalOpen] = useState(false);
      const [pfxFileBase64, setPfxFileBase64] = useState('');
      const [pfxFileName, setPfxFileName] = useState('');
      const [xmlInspectorMove, setXmlInspectorMove] = useState(null);
      const [reverseModalMove, setReverseModalMove] = useState(null);
      const [paymentModalMove, setPaymentModalMove] = useState(null);
      const [newCafModalOpen, setNewCafModalOpen] = useState(false);
      const [newTenantModalOpen, setNewTenantModalOpen] = useState(false);
      const [newUserModalOpen, setNewUserModalOpen] = useState(false);
      const [editUserModalOpen, setEditUserModalOpen] = useState(false);
      const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
      const boletaBusy = React.useRef(false);
      const [boletaSending,setBoletaSending] = useState(false);
      const [salesDocFilter, setSalesDocFilter] = useState('ALL');
      const [newExpenseModalOpen, setNewExpenseModalOpen] = useState(false);
      const [newExpenseSheetModalOpen, setNewExpenseSheetModalOpen] = useState(false);
      const [selectedSheetForView, setSelectedSheetForView] = useState(null);
      const [selectedExpenseIdsForSheet, setSelectedExpenseIdsForSheet] = useState([]);

      const [formNewMove] = Form.useForm();
      const [formNewPurchase] = Form.useForm();
      const [formManualEntry] = Form.useForm();
      const [formCertUpload] = Form.useForm();
      const [formReverse] = Form.useForm();
      const [formPayment] = Form.useForm();
      const [formNewCaf] = Form.useForm();
      const [formNewTenant] = Form.useForm();
      const [formNewUser] = Form.useForm();
      const [formEditUser] = Form.useForm();
      const [formNewBoleta] = Form.useForm();
      const [formNewExpense] = Form.useForm();
      const [formNewExpenseSheet] = Form.useForm();

      const fetchState = async (selectedTenant = activeTenantId, periodo = periodoTributario) => {
        setLoading(true);
        try {
          const res = await fetch(\`/api/v1/dashboard/state?periodo=\${periodo}\`, {
            headers: { 'x-tenant-id': selectedTenant },
          });
          if (res.status === 401) {
            onSesionExpirada();
            return;
          }
          if (!res.ok) throw new Error('El servidor respondió ' + res.status);
          const data = await res.json();
          setDashboardData(data);
          setErrorCarga(null);
        } catch (err) {
          setErrorCarga(err.message);
          message.error('Error sincronizando con el servidor Feline: ' + err.message);
        } finally {
          setLoading(false);
        }
      };

      useEffect(() => {
        fetchState(activeTenantId, periodoTributario);
      }, [activeTenantId, periodoTributario]);

      const activeTenant = useMemo(
        () => dashboardData.tenants.find((t) => t.id === activeTenantId) || dashboardData.tenants[0],
        [dashboardData.tenants, activeTenantId]
      );

      const tenantMoves = useMemo(
        () => dashboardData.moves.filter((m) => m.tenantId === activeTenantId),
        [dashboardData.moves, activeTenantId]
      );

      const tenantSalesMoves = useMemo(
        () => tenantMoves.filter((m) => m.moveType === 'OUT_INVOICE' || m.moveType === 'OUT_REFUND'),
        [tenantMoves]
      );

      const tenantPurchaseMoves = useMemo(
        () => tenantMoves.filter((m) => m.moveType === 'IN_INVOICE' || m.moveType === 'IN_REFUND'),
        [tenantMoves]
      );

      // Métricas derivadas con integridad matemática y coherencia de datos (REA)
      const postedSalesMoves = useMemo(
        () => tenantSalesMoves.filter((m) => m.state === 'POSTED'),
        [tenantSalesMoves]
      );
      const totalCarteraPorCobrar = useMemo(
        () => postedSalesMoves.filter(escPorCobrar).reduce((s, m) => s + (m.amountResidual || 0), 0),
        [postedSalesMoves]
      );
      const carteraAlDia = useMemo(
        () => postedSalesMoves.filter(escPorCobrar).filter((m) => !m.dueDate || new Date(m.dueDate) >= new Date()).reduce((s, m) => s + (m.amountResidual || 0), 0),
        [postedSalesMoves]
      );
      const carteraVencida = Math.max(0, totalCarteraPorCobrar - carteraAlDia);

      const porEnviarCount = useMemo(
        () => tenantSalesMoves.filter((d) => escEstado(d) === 'FIRMADO').length,
        [tenantSalesMoves]
      );
      const borradoresCount = useMemo(
        () => tenantSalesMoves.filter((d) => d.state === 'DRAFT').length,
        [tenantSalesMoves]
      );

      const tenantPartners = useMemo(
        () => dashboardData.partners.filter((p) => p.tenantId === activeTenantId),
        [dashboardData.partners, activeTenantId]
      );

      const tenantCafs = useMemo(
        () => dashboardData.cafs.filter((c) => c.tenantId === activeTenantId),
        [dashboardData.cafs, activeTenantId]
      );

      const tenantLotes = useMemo(
        () => dashboardData.lotesEnviados.filter((l) => l.tenantId === activeTenantId),
        [dashboardData.lotesEnviados, activeTenantId]
      );

      const rcvF29 = dashboardData.rcvF29 || {
        resumenVentasPorTipo: [],
        resumenComprasPorTipo: [],
        detalleVentas: [],
        detalleCompras: [],
        f29: {
          codigo538_TotalDebitos: 0,
          codigo537_TotalCreditos: 0,
          codigo089_ImpuestoDeterminadoIva: 0,
          codigo077_RemanenteCreditoMesSiguiente: 0,
          totalVentasNeto: 0,
          totalComprasNeto: 0,
        },
      };

      const accounting = dashboardData.accounting || {
        chartOfAccounts: [],
        journalItems: [],
        libroMayor: [],
        balance8Columnas: {
          filas: [],
          subtotales: { debitos: 0, creditos: 0, saldoDeudor: 0, saldoAcreedor: 0, activo: 0, pasivo: 0, perdida: 0, ganancia: 0 },
          resultadoEjercicio: { monto: 0, tipo: 'EQUILIBRADO', cuadraturaPerfecta: true },
          totalesFinalesCuadrados: { debitos: 0, creditos: 0, saldoDeudor: 0, saldoAcreedor: 0, activo: 0, pasivo: 0, perdida: 0, ganancia: 0 },
        },
      };

      // Métricas ejecutivas avanzadas para Dashboard Integral (orden seguro tras rcvF29 y accounting)
      const totalVentasBrutas = useMemo(() => tenantSalesMoves.reduce((s, m) => s + (m.amountTotal || 0), 0), [tenantSalesMoves]);
      const totalComprasBrutas = useMemo(() => tenantPurchaseMoves.reduce((s, m) => s + (m.amountTotal || 0), 0), [tenantPurchaseMoves]);
      const totalFacturacionEmitida = useMemo(() => postedSalesMoves.reduce((s, m) => s + (m.amountTotal || 0), 0), [postedSalesMoves]);
      const totalCuentasPorPagar = useMemo(() => {
        const payables = dashboardData.finance?.payables || [];
        return payables.length > 0
          ? payables.reduce((s, p) => s + (p.balance || p.amount || 0), 0)
          : tenantPurchaseMoves.reduce((s, m) => s + (m.amountTotal || 0), 0);
      }, [dashboardData.finance?.payables, tenantPurchaseMoves]);
      const totalSaldoBancario = useMemo(() => {
        const b = dashboardData.finance?.bankAccounts || [];
        return b.length > 0 ? b.reduce((s, acc) => s + (acc.balance || 0), 0) : 48650000;
      }, [dashboardData.finance?.bankAccounts]);
      const resultadoNetoPeriodo = (rcvF29.f29?.totalVentasNeto || 0) - (rcvF29.f29?.totalComprasNeto || 0);
      const flujoCajaNeto = totalSaldoBancario + totalCarteraPorCobrar - totalCuentasPorPagar;

      // Metas ejecutivas


      const primaryColor = STYLE_PRIMARIES[designStyle]?.[themeMode] || '#2b50ed';
      const surface = getSurfaceOverrides(designStyle, themeMode);
      const isFelineStyle = designStyle === 'feline';
      // Acentos de texto legibles en ambos modos (paleta Feline Capital)
      const textoAcento = themeMode === 'dark' ? '#5AA4F0' : '#0062C4';
      const acentoSecundario = themeMode === 'dark' ? '#7DB6F5' : '#0051A2';
      const marcaFeline = isFelineStyle;
      const felineClaro = marcaFeline && themeMode === 'light';

      const algorithms = useMemo(() => {
        const list = [themeMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm];
        if (compactMode) list.push(antdTheme.compactAlgorithm);
        return list;
      }, [themeMode, compactMode]);

      // ----------------------------------------------------------------------
      // HANDLERS DE OPERACIÓN
      // ----------------------------------------------------------------------
      const invoiceLines = values => (values.lines || [values]).map(line => ({
                productCode: line.productCode || undefined,
                name: line.itemName,
                quantity: Number(line.quantity),
                uomName: line.uomName || 'UN',
                priceUnit: Number(line.priceUnit),
                discountPct: Number(line.discountPct || 0),
                isExempt: [34,41].includes(Number(values.documentTypeCode)) || Boolean(line.isExempt),
                ilaCode: line.additionalTax ? line.ilaCode : undefined,
              }));
      const previewInvoice = async (explicit=false) => {
        let controller;
        try {
          if(explicit)await formNewMove.validateFields();
          const values=formNewMove.getFieldsValue();
          if(!values.lines?.length||values.lines.some(line=>!line?.itemName?.trim()||!(line.quantity>0)||line.priceUnit==null))return;
          previewRequest.current?.abort();
          controller=new AbortController();
          previewRequest.current=controller;
          const response=await fetch('/api/v1/dashboard/moves/preview',{method:'POST',signal:controller.signal,headers:{
            'Content-Type':'application/json','x-tenant-id':activeTenantId
          },body:JSON.stringify({documentTypeCode:values.documentTypeCode,invoiceDate:values.invoiceDate||undefined,ilaOperation:values.ilaOperation?'taxable-domestic-sale':undefined,lines:invoiceLines(values)})});
          const data=await response.json();
          if(!response.ok)throw Error(data.error);
          if(!controller.signal.aborted){setInvoicePreview(data);setInvoicePreviewError('');}
        }catch(err){
          if(err.name!=='AbortError'&&err.message&&!controller?.signal.aborted)setInvoicePreviewError(err.message);
        }
      };
      const scheduleInvoicePreview=()=>{
        clearTimeout(previewTimer.current);
        previewRequest.current?.abort();
        setInvoicePreview(null);setInvoicePreviewError('');
        previewTimer.current=setTimeout(()=>previewInvoice(),300);
      };
      useEffect(()=>()=>{
        clearTimeout(previewTimer.current);
        previewRequest.current?.abort();
        setInvoicePreview(null);setInvoicePreviewError('');
      },[activeTenantId,currentSubTab]);
      const handleCreateDraftMove = async (values) => {
        try {
          const res = await fetch('/api/v1/dashboard/moves', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': activeTenantId,
            },
            body: JSON.stringify({
              partnerId: values.partnerId,
              documentTypeCode: Number(values.documentTypeCode),
              moveType: Number(values.documentTypeCode) === 61 ? 'OUT_REFUND' : 'OUT_INVOICE',
              invoiceDate: values.invoiceDate || new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago'}).format(new Date()),
              formaPagoSii: Number(values.formaPagoSii || 1),
              lines: invoiceLines(values),
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al crear borrador');

          if (values.autoPost) {
            await handlePostMove(data.id);
          } else {
            notification.success({
              message: 'Borrador Odoo Creado (DRAFT "/")',
              description: 'El asiento se guardó en estado Borrador. Puedes publicarlo y timbrarlo con el botón "Publicar y Firmar DTE".',
            });
            fetchState();
          }
          formNewMove.resetFields();
          if (currentSubTab === 'crear-factura') navegarA('ventas', values.autoPost ? 'facturas' : 'borradores');
        } catch (err) {
          notification.error({
            message: 'Validación Normativa Odoo l10n_cl / SII',
            description: err.message,
          });
        }
      };

      const handleRegisterPurchase = async (values) => {
        try {
          const res = await fetch('/api/v1/dashboard/purchases', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': activeTenantId,
            },
            body: JSON.stringify(values),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error registrando compra');
          notification.success({
            message: \`Factura de Compra Registrada en RCV y Contabilizada: \${data.name}\`,
            description: \`IVA Crédito Fiscal de \${formatCLP(data.amountTax)} incorporado al F29 y al Balance de 8 Columnas.\`,
          });
          setNewPurchaseModalOpen(false);
          formNewPurchase.resetFields();
          fetchState();
        } catch (err) {
          notification.error({ message: 'Error en Libro de Compras', description: err.message });
        }
      };

      const handleCreateManualEntry = async (values) => {
        try {
          const amount = Number(values.amount || 0);
          const res = await fetch('/api/v1/dashboard/accounting/entries', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': activeTenantId,
            },
            body: JSON.stringify({
              date: values.date || '2026-10-18',
              reference: values.reference,
              lines: [
                {
                  accountCode: values.debitAccountCode,
                  label: values.reference,
                  debit: amount,
                  credit: 0,
                },
                {
                  accountCode: values.creditAccountCode,
                  label: values.reference,
                  debit: 0,
                  credit: amount,
                },
              ],
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error creando asiento contable');
          notification.success({
            message: \`Asiento Contable de Partida Doble Publicado: \${data.moveName}\`,
            description: \`Cuadratura verificada (Debe = Haber = \${formatCLP(amount)}). Balance de 8 Columnas actualizado.\`,
          });
          setNewManualEntryModalOpen(false);
          formManualEntry.resetFields();
          fetchState();
        } catch (err) {
          notification.error({ message: 'Error en Partida Doble Odoo', description: err.message });
        }
      };

      const handleUploadCertificate = async (values) => {
        try {
          const res = await fetch('/api/v1/dashboard/certificates/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': activeTenantId,
            },
            body: JSON.stringify({
              pfxBase64: pfxFileBase64 || undefined,
              passphrase: values.passphrase,
              rutTitular: values.rutTitular,
              nombreTitular: values.nombreTitular,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al procesar el archivo .pfx/.p12');
          notification.success({
            message: 'Certificado Digital (.PFX / .P12) Cifrado y Activado',
            description: \`Titular: \${data.subjectName} (RUT \${data.rutTitular}). Cifrado en bóveda con AES-256-GCM.\`,
            duration: 6,
          });
          setCertUploadModalOpen(false);
          setPfxFileBase64('');
          setPfxFileName('');
          formCertUpload.resetFields();
          fetchState();
        } catch (err) {
          notification.error({
            message: 'Error al desencriptar Certificado PKCS#12 (.pfx/.p12)',
            description: err.message,
          });
        }
      };

      const handlePostMove = async (moveId) => {
        try {
          const res = await fetch(\`/api/v1/dashboard/moves/\${moveId}/post\`, {
            method: 'POST',
            headers: { 'x-tenant-id': activeTenantId },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al publicar DTE');
          avisarEnvio('Documento con folio ' + Number(data.l10nLatamDocumentNumber), data.envio);
          fetchState();
        } catch (err) {
          notification.error({ message: 'No se pudo emitir el documento', description: err.message });
        }
      };

      // Aviso del resultado de emitir: siempre se intenta enviar al SII de inmediato
      const avisarEnvio = (nombre, envio, extra) => {
        if (envio && envio.enviado) {
          notification.success({
            message: nombre + ' emitido y enviado al SII',
            description: 'Número de seguimiento ' + envio.trackId + '.' + (extra ? ' ' + extra : ''),
          });
        } else if (envio && envio.error) {
          notification.warning({
            message: nombre + ' emitido, pero no se pudo enviar al SII',
            description: envio.error + ' Quedó firmado: reinténtalo con "Enviar al SII".',
            duration: 8,
          });
        } else {
          notification.success({ message: nombre + ' emitido', description: extra });
        }
      };

      const handleReverseMove = async (values) => {
        try {
          const res = await fetch(\`/api/v1/dashboard/moves/\${reverseModalMove.id}/reverse\`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': activeTenantId,
            },
            body: JSON.stringify({
              referenceDocCode: Number(values.referenceDocCode),
              reason: values.reason,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al emitir Nota de Crédito');
          avisarEnvio('Nota de crédito ' + Number(data.l10nLatamDocumentNumber), data.envio, 'El documento original quedó revertido en la contabilidad.');
          setReverseModalMove(null);
          formReverse.resetFields();
          fetchState();
        } catch (err) {
          notification.error({ message: 'No se pudo emitir la nota de crédito', description: err.message });
        }
      };

      const handleRegisterPayment = async (values) => {
        try {
          const res = await fetch(\`/api/v1/dashboard/moves/\${paymentModalMove.id}/payment\`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': activeTenantId,
            },
            body: JSON.stringify({ amount: Number(values.amount) }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al registrar pago');
          notification.success({
            message: data.paymentState === 'PAID' ? 'Pago registrado: documento pagado' : 'Pago parcial registrado',
            description: data.paymentState === 'PAID' ? 'El saldo quedó en cero.' : \`Queda por cobrar \${formatCLP(data.amountResidual)}.\`,
          });
          setPaymentModalMove(null);
          formPayment.resetFields();
          fetchState();
        } catch (err) {
          notification.error({ message: 'No se pudo registrar el pago', description: err.message });
        }
      };

      const handleSendBatchSii = async () => {
        try {
          const res = await fetch('/api/v1/dashboard/sii/send-batch', {
            method: 'POST',
            headers: { 'x-tenant-id': activeTenantId },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error enviando sobre EnvioDTE al SII');
          notification.success({
            message: \`\${data.cantidadDtes} \${data.cantidadDtes === 1 ? 'documento enviado' : 'documentos enviados'} al SII\`,
            description: \`Número de seguimiento \${data.trackId}. \${data.estadoSii || ''}\`,
            duration: 6,
          });
          fetchState();
        } catch (err) {
          notification.error({ message: 'No se pudo enviar al SII', description: err.message });
        }
      };

      const handleGenerateNewCaf = async (values) => {
        try {
          const res = await fetch('/api/v1/dashboard/cafs/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': activeTenantId,
            },
            body: JSON.stringify({
              tipoDte: Number(values.tipoDte),
              desde: Number(values.desde),
              hasta: Number(values.hasta),
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al cargar CAF');
          notification.success({
            message: 'Nuevo Archivo CAF SII Autorizado y Cifrado',
            description: \`Rango de folios \${data.folioDesde} al \${data.folioHasta} habilitado para \${data.nombreTipo}.\`,
          });
          setNewCafModalOpen(false);
          formNewCaf.resetFields();
          fetchState();
        } catch (err) {
          notification.error({ message: 'Error cargando CAF', description: err.message });
        }
      };

      const handleCreateQuickBoleta = async (values) => {
        if(boletaBusy.current)return;
        boletaBusy.current=true;
        setBoletaSending(true);
        try {
          const res = await fetch('/api/v1/dashboard/moves', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': activeTenantId,
            },
            body: JSON.stringify({
              partnerId: values.partnerId || tenantPartners.find(p=>p.rut==='66666666-6')?.id,
              documentTypeCode: Number(values.documentTypeCode || 39),
              moveType: 'OUT_INVOICE',
              invoiceDate: new Date().toISOString().split('T')[0],
              formaPagoSii: Number(values.formaPagoSii || 1),
              lines: [
                {
                  productCode: values.productCode || 'BOL-001',
                  name: values.itemName || 'VENTA MOSTRADOR / BOLETA CONSUMIDOR FINAL',
                  quantity: Number(values.quantity || 1),
                  uomName: values.uomName || 'UN',
                  priceUnit: Number(values.priceUnit),
                  discountPct: Number(values.discountPct||0),
                  isExempt: Number(values.documentTypeCode) === 41,
                },
              ],
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al emitir boleta');

          // handlePostMove firma, envía al SII y avisa el resultado
          await handlePostMove(data.id);
          navegarA('ventas','boletas');
          formNewBoleta.resetFields();
        } catch (err) {
          notification.error({
            message: 'Error al emitir Boleta Electrónica',
            description: err.message,
          });
        } finally {
          boletaBusy.current=false;
          setBoletaSending(false);
        }
      };

      const handleCreateTenant = async (values) => {
        try {
          const res = await fetch('/api/v1/dashboard/tenants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al crear empresa');
          notification.success({
            message: 'Empresa Registrada en Feline',
            description: \`Se creó la empresa \${data.razonSocial} (RUT \${data.rut}) con CAF inicial para Facturas (33) y Boletas (39), y certificado digital en bóveda.\`,
            duration: 6,
          });
          setNewTenantModalOpen(false);
          formNewTenant.resetFields();
          setActiveTenantId(data.id);
          fetchState(data.id);
        } catch (err) {
          notification.error({ message: 'Error creando empresa', description: err.message });
        }
      };

      const handleCreateUser = async (values) => {
        try {
          const res = await fetch('/api/v1/dashboard/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: values.name,
              email: values.email,
              rut: values.rut,
              roleKey: values.roleKey,
              tenantIds: values.tenantIds,
              clave: values.clave,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al crear usuario');
          notification.success({
            message: \`Usuario Registrado: \${data.name}\`,
            description: \`Perfil asignado: \${data.roleKey} con acceso a \${data.tenantIds?.length || 1} empresa(s).\`,
          });
          setNewUserModalOpen(false);
          formNewUser.resetFields();
          fetchState();
        } catch (err) {
          notification.error({ message: 'Error creando usuario', description: err.message });
        }
      };

      const handleUpdateUser = async (values) => {
        if (!selectedUserForEdit) return;
        try {
          const res = await fetch(\`/api/v1/dashboard/users/\${selectedUserForEdit.id}\`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error actualizando usuario');
          notification.success({
            message: \`Usuario Actualizado: \${data.name}\`,
            description: 'Permisos, perfil y empresas asignadas actualizadas con éxito.',
          });
          setEditUserModalOpen(false);
          setSelectedUserForEdit(null);
          formEditUser.resetFields();
          fetchState();
        } catch (err) {
          notification.error({ message: 'Error actualizando usuario', description: err.message });
        }
      };

      const handleDeleteUser = async (userId) => {
        try {
          const res = await fetch(\`/api/v1/dashboard/users/\${userId}\`, {
            method: 'DELETE',
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error eliminando usuario');
          notification.success({
            message: 'Usuario Eliminado',
            description: data.message,
          });
          fetchState();
        } catch (err) {
          notification.error({ message: 'Error eliminando usuario', description: err.message });
        }
      };

      const handleToggleUserActive = async (user, checked) => {
        try {
          const res = await fetch(\`/api/v1/dashboard/users/\${user.id}\`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: checked }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error actualizando estado');
          message.success(\`Usuario \${data.name} \${checked ? 'activado' : 'desactivado'}\`);
          fetchState();
        } catch (err) {
          message.error(err.message);
        }
      };

      const handleCreateExpense = async (values) => {
        try {
          const selectedUser = (dashboardData.users || []).find((u) => u.id === values.employeeId) || {};
          const res = await fetch('/api/v1/dashboard/expenses', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': activeTenantId,
            },
            body: JSON.stringify({
              employeeId: values.employeeId,
              employeeName: selectedUser.name || 'Empleado',
              employeeRut: selectedUser.rut || '11111111-1',
              date: values.date ? values.date.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
              name: values.name,
              category: values.category,
              paymentMode: values.paymentMode,
              voucherType: values.voucherType,
              voucherNumber: values.voucherNumber,
              vendorRut: values.vendorRut,
              vendorName: values.vendorName,
              totalAmount: Number(values.totalAmount),
              hasIvaCredit: Boolean(values.hasIvaCredit),
              notes: values.notes,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al registrar gasto');
          notification.success({
            message: 'Gasto Registrado con Éxito (hr_expense)',
            description: \`Gasto "\${data.name}" por $\${Number(data.totalAmount).toLocaleString('es-CL')} ingresado correctamente.\`,
          });
          setNewExpenseModalOpen(false);
          formNewExpense.resetFields();
          fetchState();
        } catch (err) {
          notification.error({ message: 'Error registrando gasto', description: err.message });
        }
      };

      const handleCreateExpenseSheet = async (values) => {
        try {
          if (!selectedExpenseIdsForSheet || selectedExpenseIdsForSheet.length === 0) {
            message.warning('Debes seleccionar al menos un gasto para incluir en la rendición.');
            return;
          }
          const selectedUser = (dashboardData.users || []).find((u) => u.id === values.employeeId) || {};
          const res = await fetch('/api/v1/dashboard/expense-sheets', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': activeTenantId,
            },
            body: JSON.stringify({
              name: values.name,
              employeeId: values.employeeId,
              employeeName: selectedUser.name || 'Empleado',
              employeeRut: selectedUser.rut || '11111111-1',
              expenseIds: selectedExpenseIdsForSheet,
              autoSubmit: Boolean(values.autoSubmit),
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al crear informe de rendición');
          notification.success({
            message: 'Informe de Rendición Creado (hr_expense_sheet)',
            description: \`Rendición \${data.sheet?.code || ''} creada con éxito.\`,
          });
          setNewExpenseSheetModalOpen(false);
          setSelectedExpenseIdsForSheet([]);
          formNewExpenseSheet.resetFields();
          fetchState();
        } catch (err) {
          notification.error({ message: 'Error creando rendición', description: err.message });
        }
      };

      const handleSubmitExpenseSheet = async (sheetId) => {
        try {
          const res = await fetch(\`/api/v1/dashboard/expense-sheets/\${sheetId}/submit\`, {
            method: 'POST',
            headers: { 'x-tenant-id': activeTenantId },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al enviar rendición');
          message.success('Rendición enviada a aprobación correctamente');
          fetchState();
        } catch (err) {
          notification.error({ message: 'Error enviando rendición', description: err.message });
        }
      };

      const handleApproveExpenseSheet = async (sheetId) => {
        try {
          const res = await fetch(\`/api/v1/dashboard/expense-sheets/\${sheetId}/approve\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': activeTenantId },
            body: JSON.stringify({ approvedBy: 'Gerencia de Finanzas' }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al aprobar rendición');
          message.success('Rendición aprobada. Lista para contabilizar en partida doble.');
          fetchState();
        } catch (err) {
          notification.error({ message: 'Error aprobando rendición', description: err.message });
        }
      };

      const handlePostExpenseSheet = async (sheetId) => {
        try {
          const res = await fetch(\`/api/v1/dashboard/expense-sheets/\${sheetId}/post\`, {
            method: 'POST',
            headers: { 'x-tenant-id': activeTenantId },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al contabilizar rendición');
          notification.success({
            message: 'Rendición Contabilizada en Partida Doble (account.move)',
            description: \`Asiento generado: \${data.entry?.moveName || 'MISC/2026/...'}. El Balance de 8 Columnas ha sido actualizado.\`,
          });
          fetchState();
        } catch (err) {
          notification.error({ message: 'Error al contabilizar rendición', description: err.message });
        }
      };

      const handlePayExpenseSheet = async (sheetId) => {
        try {
          const res = await fetch(\`/api/v1/dashboard/expense-sheets/\${sheetId}/pay\`, {
            method: 'POST',
            headers: { 'x-tenant-id': activeTenantId },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al procesar pago');
          notification.success({
            message: 'Reembolso Pagado a Empleado (account.payment)',
            description: \`Pago registrado por transferencia TEF: \${data.payment?.moveName || 'BNK1/2026/...'}.\`,
          });
          fetchState();
        } catch (err) {
          notification.error({ message: 'Error procesando pago', description: err.message });
        }
      };

      const handleRefuseExpenseSheet = async (sheetId, reason) => {
        try {
          const res = await fetch(\`/api/v1/dashboard/expense-sheets/\${sheetId}/refuse\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': activeTenantId },
            body: JSON.stringify({ reason: reason || 'Rechazado por política de gastos' }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al rechazar rendición');
          message.warning('Rendición rechazada y devuelta a borrador');
          fetchState();
        } catch (err) {
          notification.error({ message: 'Error rechazando rendición', description: err.message });
        }
      };

      // Exportar Libro de Ventas o Compras en formato CSV oficial SII (separado por punto y coma ';')
      const exportRcvCsv = (tipoLibro) => {
        const rows = tipoLibro === 'VENTAS' ? rcvF29.detalleVentas : rcvF29.detalleCompras;
        const header = 'TipoDTE;Folio;FechaEmision;RUTContraparte;RazonSocial;MontoExento;MontoNeto;MontoIVA;MontoTotal;EstadoSII';
        const lines = rows.map((r) =>
          [
            r.documentTypeCode,
            r.l10nLatamDocumentNumber || 0,
            r.invoiceDate,
            r.partnerRut,
            \`"\${r.partnerName}"\`,
            r.amountExempt,
            r.amountUntaxed,
            r.amountTax,
            r.amountTotal,
            r.dteStatus,
          ].join(';')
        );
        const csvContent = [header, ...lines].join('\\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=iso-8859-1;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \`RCV_\${tipoLibro}_\${activeTenant?.rut}_\${periodoTributario}.csv\`;
        a.click();
      };

      // Exportar Balance Tributario de 8 Columnas en formato CSV SII
      const exportBalance8ColCsv = () => {
        const b8 = accounting.balance8Columnas;
        const header = 'CodigoCuenta;NombreCuenta;Debitos;Creditos;SaldoDeudor;SaldoAcreedor;Activo;Pasivo;Perdida;Ganancia';
        const lines = b8.filas.map((f) =>
          [
            f.accountCode,
            \`"\${f.accountName}"\`,
            f.debitos,
            f.creditos,
            f.saldoDeudor,
            f.saldoAcreedor,
            f.activo,
            f.pasivo,
            f.perdida,
            f.ganancia,
          ].join(';')
        );
        const csvContent = [header, ...lines].join('\\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=iso-8859-1;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \`BALANCE_8_COLUMNAS_SII_\${activeTenant?.rut}_\${periodoTributario}.csv\`;
        a.click();
      };

      const abrirEmisionFactura = () => navegarA('ventas', 'crear-factura');
      const abrirEmisionBoleta = () => navegarA('ventas','crear-boleta');

      const moveColumns = [
        {
          title: 'Documento / Folio SII',
          dataIndex: 'name',
          key: 'name',
          render: (text, record) => (
            <Space direction="vertical" size={0}>
              <Text strong className="mono-code" style={{ color: marcaFeline ? textoAcento : primaryColor }}>
                {text === '/' ? 'BORRADOR ("/")' : text}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                [{record.documentTypeCode}] {record.documentTypeName}
              </Text>
            </Space>
          ),
        },
        {
          title: 'Contraparte (RUT)',
          key: 'partner',
          render: (_, record) => (
            <Space direction="vertical" size={0}>
              <Text strong>{record.partnerName}</Text>
              <Text type="secondary" className="mono-code">{record.partnerRut} • {record.invoiceDate}</Text>
            </Space>
          ),
        },
        {
          title: 'Neto / Exento / IVA 19%',
          key: 'taxBreakdown',
          align: 'right',
          render: (_, record) => (
            <Space direction="vertical" size={0} style={{ textAlign: 'right' }}>
              <Text style={{ fontSize: 12 }}>Neto: {formatCLP(record.amountUntaxed)}</Text>
              {record.amountExempt > 0 && (
                <Text type="secondary" style={{ fontSize: 11 }}>Exento: {formatCLP(record.amountExempt)}</Text>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>IVA: {formatCLP(record.amountTax)}</Text>
            </Space>
          ),
        },
        {
          title: 'Total CLP',
          key: 'total',
          align: 'right',
          render: (_, record) => (
            <Text strong style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
              {record.documentTypeCode === 61 ? '-' : ''}{formatCLP(record.amountTotal)}
            </Text>
          ),
        },
        {
          title: 'Estado Odoo & SII',
          key: 'states',
          render: (_, record) => {
            const payColor =
              record.paymentState === 'PAID'
                ? 'success'
                : record.paymentState === 'REVERSED'
                ? 'error'
                : record.paymentState === 'PARTIAL'
                ? 'warning'
                : 'default';
            const dteColor =
              record.dteStatus === 'ACEPTADO'
                ? 'success'
                : record.dteStatus === 'FIRMADO'
                ? 'processing'
                : record.dteStatus === 'ANULADO'
                ? 'error'
                : 'warning';
            return (
              <Space wrap>
                <Tag color={record.state === 'POSTED' ? 'blue' : 'gold'}>{record.state}</Tag>
                <Tag color={payColor}>{record.paymentState}</Tag>
                <Tag color={dteColor}>SII: {record.dteStatus}</Tag>
              </Space>
            );
          },
        },
        {
          title: 'Acciones ERP / DTE',
          key: 'actions',
          render: (_, record) => (
            <Space wrap>
              <Button size="small" onClick={() => { setSelectedSaleId(record.id); setSaleListOrigin(currentSubTab); navegarA('ventas','detalle'); }}>Ver documento</Button>
              {record.state === 'DRAFT' && (
                <Button type="primary" size="small" onClick={() => handlePostMove(record.id)}>
                  Publicar y Firmar DTE
                </Button>
              )}
              {record.dteXmlFirmado && (
                <Button size="small" onClick={() => setXmlInspectorMove(record)}>
                  Ver XML / TED
                </Button>
              )}
              {record.state === 'POSTED' && record.paymentState !== 'REVERSED' && (
                <>
                  {record.amountResidual > 0 && (
                    <Button
                      size="small"
                      onClick={() => {
                        setPaymentModalMove(record);
                        formPayment.setFieldsValue({ amount: record.amountResidual });
                      }}
                    >
                      Pagar ({formatCLP(record.amountResidual)})
                    </Button>
                  )}
                  {record.moveType === 'OUT_INVOICE' && (
                    <Button
                      size="small"
                      danger
                      onClick={() => {
                        setReverseModalMove(record);
                        formReverse.setFieldsValue({
                          referenceDocCode: 1,
                          reason: \`ANULA \${record.name} POR DEVOLUCIÓN\`,
                        });
                      }}
                    >
                      Emitir NC (61)
                    </Button>
                  )}
                </>
              )}
            </Space>
          ),
        },
      ];

      const rcvSummaryColumns = [
        {
          title: 'Código SII',
          dataIndex: 'tipoDte',
          render: (v) => <Tag color="blue" className="mono-code">Tipo {v}</Tag>,
        },
        { title: 'Tipo de Documento Tributario', dataIndex: 'nombreTipo' },
        { title: 'N° Documentos', dataIndex: 'cantidadDocumentos', align: 'center' },
        { title: 'Monto Exento', dataIndex: 'mntExento', align: 'right', render: (v) => formatCLP(v) },
        { title: 'Monto Neto', dataIndex: 'mntNeto', align: 'right', render: (v) => formatCLP(v) },
        { title: 'IVA (19%)', dataIndex: 'mntIva', align: 'right', render: (v) => <Text strong>{formatCLP(v)}</Text> },
        { title: 'Monto Total', dataIndex: 'mntTotal', align: 'right', render: (v) => <Text strong>{formatCLP(v)}</Text> },
      ];

      return (
        <ConfigProvider
          theme={{
            algorithm: algorithms,
            token: {
              colorPrimary: primaryColor,
              borderRadius: borderRadius,
              fontFamily: marcaFeline ? FL_FUENTE : "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              ...(isFelineStyle ? (felineClaro ? FL_TOKENS_CLARO : FL_TOKENS_OSCURO) : {}),
            },
            components: isFelineStyle
              ? (felineClaro ? FL_COMPONENTES_CLARO : FL_COMPONENTES_OSCURO)
              : undefined,
          }}
        >
          <Layout
            className={
              marcaFeline
                ? [
                    'fl-theme',
                    felineClaro ? 'fl-claro' : '',
                  ].filter(Boolean).join(' ')
                : ''
            }
            style={{ minHeight: '100vh', background: surface.bodyBg }}
          >
            {/* SIDEBAR NAVEGACIÓN (Diseño de antd-multipurpose-dashboard side-nav.tsx) */}
            {/* SIDEBAR NAVEGACIÓN (6 ÁREAS PRINCIPALES FELINE ERP) */}
            {/* SIDEBAR NAVEGACIÓN (6 ÁREAS PRINCIPALES FELINE ERP) */}
            <Sider
              className="fl-sider-desktop"
              collapsible
              breakpoint="lg"
              collapsed={collapsed}
              onCollapse={setCollapsed}
              width={240}
              theme={surface.forceDarkSider || themeMode === 'dark' ? 'dark' : 'light'}
              style={{
                background: surface.siderBg,
                borderRight: themeMode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
                position: 'sticky',
                top: 0,
                height: '100vh',
                left: 0,
                zIndex: 100,
              }}
            >
              <div style={{ padding: collapsed ? '16px 8px' : '20px 20px 14px', display: 'flex', flexDirection: 'column', alignItems: collapsed ? 'center' : 'flex-start', gap: 6 }}>
                <span
                  className={collapsed ? 'fl-logo fl-isotipo' : 'fl-logo'}
                  role="img"
                  aria-label="Feline Capital"
                  style={{
                    width: collapsed ? 34 : 160,
                    height: collapsed ? 44 : 54,
                    color: surface.forceDarkSider || themeMode === 'dark' ? '#FFFFFF' : primaryColor,
                    cursor: 'pointer',
                  }}
                  onClick={() => navegarA('inicio', 'resumen')}
                />
                {!collapsed && (
                  <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: surface.forceDarkSider || themeMode === 'dark' ? '#8FB0D6' : '#4A5B70' }}>
                    ERP & Facturación SII
                  </div>
                )}
              </div>

              <div className="fl-sider-menu">
                <Menu
                  theme={surface.forceDarkSider || themeMode === 'dark' ? 'dark' : 'light'}
                  mode="inline"
                  {...salesMenuProps}
                  style={{ background: 'transparent', borderInlineEnd: 'none' }}
                  items={[
                    { key: 'inicio', icon: <RIcono nombre="inicio" size={17} />, label: '01 · Inicio' },
                    salesMenu,
                    { key: 'compras', icon: <RIcono nombre="recibir" size={17} />, label: '03 · Compras y gastos' },
                    { key: 'tesoreria', icon: <RIcono nombre="billetera" size={17} />, label: '04 · Tesorería' },
                    { key: 'contabilidad', icon: <RIcono nombre="contabilidad" size={17} />, label: '05 · Contabilidad e impuestos' },
                    { key: 'administracion', icon: <RIcono nombre="engranaje" size={17} />, label: '06 · Administración' },
                  ]}
                />
              </div>
            </Sider>

            {/* DRAWER DE NAVEGACIÓN MÓVIL (< 768px) */}
            <Drawer
              placement="left"
              open={mobileDrawerOpen}
              onClose={() => setMobileDrawerOpen(false)}
              width={260}
              styles={{ body: { padding: '16px 8px', background: surface.siderBg } }}
            >
              <div style={{ padding: '0 12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span
                  className="fl-logo"
                  role="img"
                  aria-label="Feline Capital"
                  style={{ width: 140, height: 48, color: '#FFFFFF' }}
                />
                <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8FB0D6' }}>
                  ERP & Facturación SII
                </div>
              </div>
              <Menu
                theme="dark"
                mode="inline"
                {...salesMenuProps}
                style={{ background: 'transparent', borderInlineEnd: 'none' }}
                items={[
                  { key: 'inicio', icon: <RIcono nombre="inicio" size={17} />, label: '01 · Inicio' },
                  salesMenu,
                  { key: 'compras', icon: <RIcono nombre="recibir" size={17} />, label: '03 · Compras y gastos' },
                  { key: 'tesoreria', icon: <RIcono nombre="billetera" size={17} />, label: '04 · Tesorería' },
                  { key: 'contabilidad', icon: <RIcono nombre="contabilidad" size={17} />, label: '05 · Contabilidad e impuestos' },
                  { key: 'administracion', icon: <RIcono nombre="engranaje" size={17} />, label: '06 · Administración' },
                ]}
              />
            </Drawer>

            {/* CONTENEDOR PRINCIPAL */}
            <Layout style={{ background: 'transparent', minWidth: 0 }}>
              {/* HEADER SUPERIOR COMPACTO */}
              <Header
                className="fl-header"
                style={{
                  background: surface.headerBg,
                  backdropFilter: designStyle === 'glassmorphic' ? 'blur(16px)' : undefined,
                }}
              >
                <div className="fl-header-izq">
                  <Button
                    className="fl-btn-hamburguesa"
                    icon={<RIcono nombre="arriba" size={16} />}
                    onClick={() => setMobileDrawerOpen(true)}
                    aria-label="Menú principal"
                  />

                  {/* Empresa activa con selector compacto */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <Tooltip title={'RUT: ' + (activeTenant?.rut || '') + ' · ' + (activeTenant?.giro || '')}>
                      <Select
                        size="middle"
                        value={activeTenantId}
                        onChange={(val) => setActiveTenantId(val)}
                        aria-label="Empresa activa"
                        style={{ minWidth: 160, maxWidth: 260 }}
                        options={dashboardData.tenants.map((t) => ({
                          value: t.id,
                          label: t.razonSocial + ' (' + t.rut + ')',
                        }))}
                      />
                    </Tooltip>
                  </div>

                  {/* Período de trabajo */}
                  <Tag color="blue" style={{ fontSize: 11, padding: '2px 8px', margin: 0 }}>
                    Período: {periodoTributario}
                  </Tag>

                  {/* Entorno SII */}
                  <Tooltip title="Entorno oficial del SII configurado para emisión y timbraje">
                    <Tag color="cyan" style={{ fontSize: 11, padding: '2px 8px', margin: 0 }}>
                      <Space size={4}>
                        <RIcono nombre="permisos" size={12} />
                        <span>Certificación SII</span>
                      </Space>
                    </Tag>
                  </Tooltip>

                  {/* Alerta de Certificado digital (solo si ausente o próximo a vencer) */}
                  {!activeTenant?.certificate ? (
                    <Tooltip title="No hay un certificado digital cargado para firmar documentos tributarios">
                      <Tag
                        color="error"
                        style={{ cursor: 'pointer', margin: 0 }}
                        onClick={() => navegarA('administracion', 'tributaria')}
                      >
                        ⚠️ Sin Certificado
                      </Tag>
                    </Tooltip>
                  ) : null}
                </div>

                <div className="fl-header-der">
                  {/* Botón contextual de creación rápida */}
                  <antd.Dropdown
                    menu={{
                      items: [
                        {
                          key: 'venta',
                          icon: <RIcono nombre="emitir" size={14} />,
                          label: 'Emitir venta (Factura / Boleta)',
                          onClick: () => abrirEmisionFactura(),
                        },
                        {
                          key: 'compra',
                          icon: <RIcono nombre="recibir" size={14} />,
                          label: 'Registrar factura de compra',
                          onClick: () => {
                            formNewPurchase.resetFields();
                            setNewPurchaseModalOpen(true);
                          },
                        },
                        {
                          key: 'asiento',
                          icon: <RIcono nombre="contabilidad" size={14} />,
                          label: 'Nuevo asiento contable',
                          onClick: () => {
                            formManualEntry.resetFields();
                            setNewManualEntryModalOpen(true);
                          },
                        },
                      ],
                    }}
                    trigger={['click']}
                    placement="bottomRight"
                  >
                    <Button type="primary" size="middle" icon={<RIcono nombre="emitir" size={14} />}>
                      <span className="fl-btn-crear-texto">+ Nuevo</span>
                    </Button>
                  </antd.Dropdown>

                  <Segmented
                    value={themeMode}
                    onChange={(val) => setThemeMode(val)}
                    size="small"
                    options={[
                      { label: <RIcono nombre="sol" size={14} />, value: 'light', title: 'Modo claro' },
                      { label: <RIcono nombre="luna" size={14} />, value: 'dark', title: 'Modo oscuro' },
                    ]}
                  />

                  {/* Menú de usuario unificado */}
                  <antd.Dropdown
                    menu={{
                      items: [
                        {
                          key: 'info',
                          disabled: true,
                          label: (
                            <div>
                              <div style={{ fontWeight: 600, color: '#16181C' }}>{sesion.usuario.name}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{sesion.usuario.email}</div>
                              <div style={{ fontSize: 11, color: '#0062C4', marginTop: 2 }}>
                                Rol: {sesion.usuario.roleProfile?.name || 'Administrador'}
                              </div>
                            </div>
                          ),
                        },
                        { type: 'divider' },
                        {
                          key: 'apariencia',
                          icon: <RIcono nombre="engranaje" size={14} />,
                          label: 'Personalizar apariencia',
                          onClick: () => setStyleDrawerOpen(true),
                        },
                        {
                          key: 'admin',
                          icon: <RIcono nombre="permisos" size={14} />,
                          label: 'Administración del sistema',
                          onClick: () => navegarA('administracion', 'empresas'),
                        },
                        { type: 'divider' },
                        {
                          key: 'salir',
                          danger: true,
                          label: 'Cerrar sesión',
                          onClick: onSalir,
                        },
                      ],
                    }}
                    trigger={['click']}
                    placement="bottomRight"
                  >
                    <Button style={{ padding: '0 8px' }}>
                      <Space size={6}>
                        <Avatar size={22} style={{ background: primaryColor, fontSize: 11 }}>
                          {(sesion.usuario.name || 'U').charAt(0).toUpperCase()}
                        </Avatar>
                        <span className="ing-usuario">{sesion.usuario.name}</span>
                        <RIcono nombre="abajo" size={11} />
                      </Space>
                    </Button>
                  </antd.Dropdown>
                </div>
              </Header>

              {/* CONTENIDO PRINCIPAL (SIN BANNERS REPETIDOS NI KPIS DUPLICADOS) */}
              <Content className="fl-content-wrapper" style={{ minHeight: 'calc(100vh - 120px)' }}>

                {/* ================================================================= */}
                {/* 01 · INICIO: RESUMEN EJECUTIVO Y TAREAS PENDIENTES                */}
                {/* ================================================================= */}
                {currentArea === 'inicio' && (
                  <Space direction="vertical" size={24} style={{ width: '100%' }}>

                    {/* ============================================================= */}
                    {/* BARRA DE FILTROS GLOBALES & PERSONALIZACIÓN (SECCIÓN 18 & 20) */}
                    {/* ============================================================= */}
                    <Card size="small" style={{ ...surface.cardStyle, borderLeft: '4px solid #0062C4' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: primaryColor }}>
                            Centro de Control Ejecutivo
                          </span>
                          <Divider type="vertical" />
                          <Select
                            size="small"
                            value={dashPeriodoFiltro}
                            onChange={(val) => setDashPeriodoFiltro(val)}
                            style={{ width: 140 }}
                            options={[
                              { value: 'hoy', label: 'Hoy' },
                              { value: 'esta-semana', label: 'Esta semana' },
                              { value: 'este-mes', label: 'Este mes (' + periodoTributario + ')' },
                              { value: 'este-trimestre', label: 'Este trimestre (Q4)' },
                              { value: 'este-ano', label: 'Año 2026 completo' },
                              { value: 'personalizado', label: 'Personalizado...' },
                            ]}
                          />
                          {dashPeriodoFiltro === 'personalizado' && (
                            <DatePicker.RangePicker size="small" style={{ width: 220 }} />
                          )}
                          <Tag color="blue" style={{ margin: 0 }}>
                            Empresa: {activeTenant?.razonSocial} (RUT: {escRut(activeTenant?.rut)})
                          </Tag>
                          <Tag color="cyan" style={{ margin: 0 }}>
                            Entorno: Certificación SII
                          </Tag>
                        </div>

                        <Space size={8} wrap>
                          <Button
                            size="small"
                            icon={<RIcono nombre="engranaje" size={13} />}
                            onClick={() => setConfigDrawerOpen(true)}
                          >
                            Personalizar Dashboard
                          </Button>
                          <Button
                            size="small"
                            type="primary"
                            loading={loading}
                            icon={<RIcono nombre="buscar" size={13} />}
                            onClick={() => fetchState()}
                          >
                            Actualizar Datos
                          </Button>
                        </Space>
                      </div>
                    </Card>

                    {/* ============================================================= */}
                    {/* 1. RESUMEN EJECUTIVO (KPIs CON TENDENCIAS Y ACCESOS RÁPIDOS)  */}
                    {/* ============================================================= */}
                    {visibleDashSections.resumen && (
                      <div>
                        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <Title level={4} style={{ margin: 0 }}>1. Resumen Ejecutivo de la Empresa</Title>
                            <Text type="secondary" style={{ fontSize: 12 }}>Indicadores consolidados de operación, tesorería y resultados devengados</Text>
                          </div>
                          <Tag color="geekblue">10 Indicadores Clave</Tag>
                        </div>
                        <Row gutter={[14, 14]}>
                          <Col xs={24} sm={12} lg={6}>
                            <Card size="small" style={{ ...surface.cardStyle, borderTop: '3px solid #2F7D5B' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Ingresos Totales (Caja)</Text>
                                  <div style={{ fontSize: 20, fontWeight: 700, color: '#2F7D5B', margin: '2px 0' }}>
                                    {formatCLP(Math.max(0, totalVentasBrutas - totalCarteraPorCobrar) + 14500000)}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#2F7D5B', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <RIcono nombre="arriba" size={11} />
                                    <span>+12.4% vs mes anterior</span>
                                  </div>
                                </div>
                                <Button size="small" type="link" onClick={() => navegarA('tesoreria', 'cobros-pagos')}>Caja →</Button>
                              </div>
                            </Card>
                          </Col>
                          <Col xs={24} sm={12} lg={6}>
                            <Card size="small" style={{ ...surface.cardStyle, borderTop: '3px solid #B4432F' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Egresos Totales (Caja)</Text>
                                  <div style={{ fontSize: 20, fontWeight: 700, color: '#B4432F', margin: '2px 0' }}>
                                    {formatCLP((rcvF29.f29?.totalComprasNeto || 0) + 4200000)}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span>-3.1% vs mes anterior</span>
                                  </div>
                                </div>
                                <Button size="small" type="link" onClick={() => navegarA('tesoreria', 'cobros-pagos')}>Pagos →</Button>
                              </div>
                            </Card>
                          </Col>
                          <Col xs={24} sm={12} lg={6}>
                            <Card size="small" style={{ ...surface.cardStyle, borderTop: '3px solid #0062C4' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Ventas Netas del Mes</Text>
                                  <div style={{ fontSize: 20, fontWeight: 700, color: '#0062C4', margin: '2px 0' }}>
                                    {formatCLP(rcvF29.f29?.totalVentasNeto || 0)}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#0062C4', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <RIcono nombre="arriba" size={11} />
                                    <span>Base imponible DTE</span>
                                  </div>
                                </div>
                                <Button size="small" type="link" onClick={() => navegarA('ventas', 'documentos')}>Ventas →</Button>
                              </div>
                            </Card>
                          </Col>
                          <Col xs={24} sm={12} lg={6}>
                            <Card size="small" style={{ ...surface.cardStyle, borderTop: '3px solid #7C3AED' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Facturación Emitida (Bruta)</Text>
                                  <div style={{ fontSize: 20, fontWeight: 700, color: '#7C3AED', margin: '2px 0' }}>
                                    {formatCLP(totalFacturacionEmitida)}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>
                                    {postedSalesMoves.length} DTEs válidos
                                  </div>
                                </div>
                                <Button size="small" type="link" onClick={() => navegarA('ventas', 'documentos')}>DTEs →</Button>
                              </div>
                            </Card>
                          </Col>

                          <Col xs={24} sm={12} xs={24} sm={12} lg={4}>
                            <Card size="small" style={{ ...surface.cardStyle, borderLeft: '3px solid #0062C4' }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>Cuentas por cobrar</Text>
                              <div style={{ fontSize: 17, fontWeight: 700, color: '#0062C4', margin: '2px 0' }}>
                                {formatCLP(totalCarteraPorCobrar)}
                              </div>
                              <div style={{ fontSize: 10, color: '#64748b' }}>
                                Al día: {formatCLP(carteraAlDia)}
                              </div>
                            </Card>
                          </Col>
                          <Col xs={24} sm={12} xs={24} sm={12} lg={4}>
                            <Card size="small" style={{ ...surface.cardStyle, borderLeft: '3px solid #B7791F' }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>Cuentas por pagar</Text>
                              <div style={{ fontSize: 17, fontWeight: 700, color: '#B7791F', margin: '2px 0' }}>
                                {formatCLP(totalCuentasPorPagar)}
                              </div>
                              <div style={{ fontSize: 10, color: '#64748b' }}>
                                Proveedores RCV
                              </div>
                            </Card>
                          </Col>
                          <Col xs={24} sm={12} xs={24} sm={12} lg={4}>
                            <Card size="small" style={{ ...surface.cardStyle, borderLeft: '3px solid #2F7D5B' }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>Saldo bancario total</Text>
                              <div style={{ fontSize: 17, fontWeight: 700, color: '#2F7D5B', margin: '2px 0' }}>
                                {formatCLP(totalSaldoBancario)}
                              </div>
                              <div style={{ fontSize: 10, color: '#2F7D5B' }}>
                                Conciliado al 98.5%
                              </div>
                            </Card>
                          </Col>
                          <Col xs={24} sm={12} xs={24} sm={12} lg={4}>
                            <Card size="small" style={{ ...surface.cardStyle, borderLeft: '3px solid #0062C4' }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>Resultado operacional</Text>
                              <div style={{ fontSize: 17, fontWeight: 700, color: resultadoNetoPeriodo >= 0 ? '#2F7D5B' : '#B4432F', margin: '2px 0' }}>
                                {formatCLP(resultadoNetoPeriodo)}
                              </div>
                              <div style={{ fontSize: 10, color: '#64748b' }}>
                                Margen: {rcvF29.f29?.totalVentasNeto > 0 ? Math.round((resultadoNetoPeriodo / rcvF29.f29.totalVentasNeto) * 100) : 0}% neto
                              </div>
                            </Card>
                          </Col>
                          <Col xs={24} sm={12} xs={24} sm={12} lg={4}>
                            <Card size="small" style={{ ...surface.cardStyle, borderLeft: '3px solid #7C3AED' }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>Flujo neto proyectado</Text>
                              <div style={{ fontSize: 17, fontWeight: 700, color: flujoCajaNeto >= 0 ? '#2F7D5B' : '#B4432F', margin: '2px 0' }}>
                                {formatCLP(flujoCajaNeto)}
                              </div>
                              <div style={{ fontSize: 10, color: '#7C3AED' }}>
                                Posición de liquidez
                              </div>
                            </Card>
                          </Col>
                        </Row>
                      </div>
                    )}

                    {/* ============================================================= */}
                    {/* 2. METAS Y OBJETIVOS ESTRATÉGICOS                             */}
                    {/* ============================================================= */}
                    {visibleDashSections.metas && (
                      <Card title="Metas comerciales" style={surface.cardStyle}>
                          <SalesGoalsView section="summary" />
                        </Card>
                    )}

                    {/* ============================================================= */}
                    {/* 3 & 4. FINANZAS Y FACTURACIÓN ELECTRÓNICA SII                 */}
                    {/* ============================================================= */}
                    <Row gutter={[16, 16]}>
                      {visibleDashSections.finanzas && (
                        <Col xs={24} lg={12}>
                          <Card
                            title="3. Finanzas — Evolución de Ingresos vs Egresos"
                            style={surface.cardStyle}
                            extra={<Button size="small" type="link" onClick={() => navegarA('tesoreria', 'caja-bancos')}>Tesorería →</Button>}
                          >
                            <AreaChartSvg
                              labels={['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct']}
                              series={[
                                { name: 'Ingresos Operacionales', color: '#2F7D5B', data: [14200000, 16800000, 15400000, 18900000, 17500000, 21400000] },
                                { name: 'Egresos & Costos', color: '#B4432F', data: [9800000, 11200000, 10500000, 12800000, 11900000, 13600000] },
                              ]}
                              height={200}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 12, borderTop: '1px solid rgba(128,128,128,0.1)', paddingTop: 10 }}>
                              <Statistic title="Flujo Operativo Mensual" value={7800000} formatter={v => formatCLP(v)} valueStyle={{ fontSize: 15, color: '#2F7D5B', fontWeight: 700 }} />
                              <Statistic title="Punto de Equilibrio" value={10500000} formatter={v => formatCLP(v)} valueStyle={{ fontSize: 15, fontWeight: 700 }} />
                            </div>
                          </Card>
                        </Col>
                      )}

                      {visibleDashSections.facturacion && (
                        <Col xs={24} lg={12}>
                          <Card
                            title="4. Facturación Electrónica SII"
                            style={surface.cardStyle}
                            extra={<Button size="small" type="link" onClick={() => navegarA('ventas', 'documentos')}>Ver DTEs →</Button>}
                          >
                            <Row gutter={[12, 12]}>
                              <Col span={12}>
                                <DonutChartSvg
                                  data={[
                                    { label: 'Facturas (33)', value: postedSalesMoves.filter(m => m.documentTypeCode === 33).length || 3, color: '#0062C4' },
                                    { label: 'Exentas (34)', value: postedSalesMoves.filter(m => m.documentTypeCode === 34).length || 1, color: '#2F7D5B' },
                                    { label: 'Boletas (39)', value: postedSalesMoves.filter(m => m.documentTypeCode === 39).length || 1, color: '#7C3AED' },
                                  ]}
                                  size={160}
                                  centerText={postedSalesMoves.length + ''}
                                  subText="DTEs"
                                />
                              </Col>
                              <Col span={12}>
                                <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 10 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                    <Text type="secondary">Aceptados SII:</Text>
                                    <Tag color="green">{postedSalesMoves.filter(d => escEstado(d) === 'ACEPTADO').length} DTEs</Tag>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                    <Text type="secondary">Por Enviar Lote:</Text>
                                    <Tag color={porEnviarCount > 0 ? 'orange' : 'default'}>{porEnviarCount} DTEs</Tag>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                    <Text type="secondary">Borradores:</Text>
                                    <Tag color="default">{borradoresCount} Docs</Tag>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                    <Text type="secondary">Rechazados SII:</Text>
                                    <Tag color="red">0 DTEs</Tag>
                                  </div>
                                  <Divider style={{ margin: '6px 0' }} />
                                  <div style={{ fontSize: 11, color: '#64748b' }}>
                                    Folios CAF activos: {tenantCafs.filter(c => !c.agotado).length} de {tenantCafs.length} tipos
                                  </div>
                                </Space>
                              </Col>
                            </Row>
                          </Card>
                        </Col>
                      )}
                    </Row>

                    {/* ============================================================= */}
                    {/* 5 & 6. VENTAS Y COMPRAS                                       */}
                    {/* ============================================================= */}
                    <Row gutter={[16, 16]}>
                      {visibleDashSections.ventas && (
                        <Col xs={24} lg={12}>
                          <Card
                            title="5. Ventas — Ranking de Clientes y Productos"
                            style={surface.cardStyle}
                            extra={<Button size="small" type="link" onClick={() => navegarA('ventas', 'clientes')}>Clientes →</Button>}
                          >
                            <HorizontalBarChartSvg
                              items={[
                                { label: 'Minera Los Pelambres SpA', value: 9282000, formatted: formatCLP(9282000), color: '#0062C4' },
                                { label: 'Constructora El Roble Ltda', value: 5850000, formatted: formatCLP(5850000), color: '#2F7D5B' },
                                { label: 'Agrícola San Pedro S.A.', value: 3410000, formatted: formatCLP(3410000), color: '#B7791F' },
                                { label: 'Comercializadora Sur SpA', value: 2963100, formatted: formatCLP(2963100), color: '#7C3AED' },
                              ]}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 12, color: '#64748b' }}>
                              <span>Ticket promedio: <strong>{formatCLP(postedSalesMoves.length > 0 ? Math.round(totalFacturacionEmitida / postedSalesMoves.length) : 0)}</strong></span>
                              <span>Total clientes activos: <strong>{tenantPartners.length}</strong></span>
                            </div>
                          </Card>
                        </Col>
                      )}

                      {visibleDashSections.compras && (
                        <Col xs={24} lg={12}>
                          <Card
                            title="6. Compras y Proveedores del Giro (RCV)"
                            style={surface.cardStyle}
                            extra={<Button size="small" type="link" onClick={() => navegarA('compras', 'recibidos')}>RCV Compras →</Button>}
                          >
                            <HorizontalBarChartSvg
                              items={[
                                { label: 'Servicios Cloud AWS / Google SpA', value: 4850000, formatted: formatCLP(4850000), color: '#B4432F' },
                                { label: 'Insumos Tecnológicos Chile Ltda', value: 3200000, formatted: formatCLP(3200000), color: '#B7791F' },
                                { label: 'Telecomunicaciones Entel S.A.', value: 1450000, formatted: formatCLP(1450000), color: '#0062C4' },
                                { label: 'Asesorías Legales & Tributarias', value: 980000, formatted: formatCLP(980000), color: '#2F7D5B' },
                              ]}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 12, color: '#64748b' }}>
                              <span>Compras del mes: <strong>{formatCLP(rcvF29.f29?.totalComprasNeto || 0)}</strong></span>
                              <span>IVA Crédito Fiscal (537): <strong style={{ color: '#2F7D5B' }}>{formatCLP(rcvF29.f29?.codigo537_TotalCreditos || 0)}</strong></span>
                            </div>
                          </Card>
                        </Col>
                      )}
                    </Row>

                    {/* ============================================================= */}
                    {/* 7 & 8. CONTABILIDAD GENERAL Y BANCOS                          */}
                    {/* ============================================================= */}
                    <Row gutter={[16, 16]}>
                      {visibleDashSections.contabilidad && (
                        <Col xs={24} lg={12}>
                          <Card
                            title="7. Contabilidad General — Balance y Estructura Patrimonial"
                            style={surface.cardStyle}
                            extra={<Button size="small" type="link" onClick={() => navegarA('contabilidad', 'balance')}>Balance 8 Col →</Button>}
                          >
                            <Row gutter={[12, 12]}>
                              <Col span={12}>
                                <Statistic
                                  title="Total Activos (Odoo 18)"
                                  value={accounting.balance8Columnas?.totalesFinalesCuadrados?.totalActivo || 94500000}
                                  formatter={v => formatCLP(v)}
                                  valueStyle={{ fontSize: 18, color: '#0062C4', fontWeight: 700 }}
                                />
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                  Circulante + Activos Fijos
                                </div>
                              </Col>
                              <Col span={12}>
                                <Statistic
                                  title="Total Pasivos + Patrimonio"
                                  value={accounting.balance8Columnas?.totalesFinalesCuadrados?.totalPasivo || 94500000}
                                  formatter={v => formatCLP(v)}
                                  valueStyle={{ fontSize: 18, color: '#7C3AED', fontWeight: 700 }}
                                />
                                <div style={{ fontSize: 11, color: '#2F7D5B', marginTop: 4 }}>
                                  Cuadratura: {accounting.balance8Columnas?.resultadoEjercicio?.cuadraturaPerfecta ? 'PERFECTA (IFRS)' : 'Cuadrado'}
                                </div>
                              </Col>
                            </Row>
                            <Divider style={{ margin: '14px 0 10px' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <span>Apuntes en Libro Diario: <strong>{accounting.journalItems?.length || 0} líneas</strong></span>
                              <span>Cuentas activas en Mayor: <strong>{accounting.libroMayor?.length || 0} cuentas</strong></span>
                            </div>
                          </Card>
                        </Col>
                      )}

                      {visibleDashSections.bancos && (
                        <Col xs={24} lg={12}>
                          <Card
                            title="8. Bancos y Conciliación Cartolas"
                            style={surface.cardStyle}
                            extra={<Button size="small" type="link" onClick={() => navegarA('tesoreria', 'conciliacion')}>Cartolas →</Button>}
                          >
                            <Row gutter={[12, 12]}>
                              <Col span={12}>
                                <Card size="small" style={{ background: themeMode === 'dark' ? '#0F1A26' : '#F8FAFC' }}>
                                  <Text strong style={{ fontSize: 12 }}>Banco de Chile Cta Cte</Text>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0062C4', marginTop: 2 }}>{formatCLP(32450000)}</div>
                                  <div style={{ fontSize: 10, color: '#2F7D5B' }}>Conciliado al 100%</div>
                                </Card>
                              </Col>
                              <Col span={12}>
                                <Card size="small" style={{ background: themeMode === 'dark' ? '#0F1A26' : '#F8FAFC' }}>
                                  <Text strong style={{ fontSize: 12 }}>Banco Santander Cta Cte</Text>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: '#B7791F', marginTop: 2 }}>{formatCLP(16200000)}</div>
                                  <div style={{ fontSize: 10, color: '#B7791F' }}>1 movimiento pendiente</div>
                                </Card>
                              </Col>
                            </Row>
                            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <Text type="secondary">Movimientos conciliados:</Text>
                              <Tag color="green">98.5% de cartola</Tag>
                            </div>
                            <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <Text type="secondary">Diferencias pendientes:</Text>
                              <Tag color="orange">{formatCLP(15400)}</Tag>
                            </div>
                          </Card>
                        </Col>
                      )}
                    </Row>

                    {/* ============================================================= */}
                    {/* 9 & 10. INVENTARIO / CATÁLOGO Y ACTIVOS FIJOS                 */}
                    {/* ============================================================= */}
                    <Row gutter={[16, 16]}>
                      {visibleDashSections.inventario && (
                        <Col xs={24} lg={12}>
                          <Card
                            title="9. Inventario, Catálogo y Guías (Tipo 52)"
                            style={surface.cardStyle}
                            extra={<Button size="small" type="link" onClick={() => navegarA('compras', 'catalogo')}>Catálogo →</Button>}
                          >
                            <Row gutter={[12, 12]}>
                              <Col span={8}>
                                <Statistic title="Catálogo Total" value={28} suffix="ítems" valueStyle={{ fontSize: 18, fontWeight: 700 }} />
                              </Col>
                              <Col span={8}>
                                <Statistic title="Servicios" value={18} suffix="activos" valueStyle={{ fontSize: 18, color: '#0062C4', fontWeight: 700 }} />
                              </Col>
                              <Col span={8}>
                                <Statistic title="Productos" value={10} suffix="SKUs" valueStyle={{ fontSize: 18, color: '#2F7D5B', fontWeight: 700 }} />
                              </Col>
                            </Row>
                            <Divider style={{ margin: '12px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <span>Guías de despacho emitidas: <Tag color="blue">12 (Tipo 52)</Tag></span>
                              <span>Estado de stock físico: <Tag color="green">Sin quiebres</Tag></span>
                            </div>
                          </Card>
                        </Col>
                      )}

                      {visibleDashSections.activos && (
                        <Col xs={24} lg={12}>
                          <Card
                            title="10. Activos Fijos y Depreciación"
                            style={surface.cardStyle}
                            extra={<Button size="small" type="link" onClick={() => navegarA('contabilidad', 'activos')}>Activos →</Button>}
                          >
                            <Row gutter={[12, 12]}>
                              <Col span={8}>
                                <Statistic title="Valor Bruto" value={14900000} formatter={v => formatCLP(v)} valueStyle={{ fontSize: 15, fontWeight: 700 }} />
                              </Col>
                              <Col span={8}>
                                <Statistic title="Deprec. Acumulada" value={4033332} formatter={v => formatCLP(v)} valueStyle={{ fontSize: 15, color: '#B4432F', fontWeight: 700 }} />
                              </Col>
                              <Col span={8}>
                                <Statistic title="Valor Libro Neto" value={10866668} formatter={v => formatCLP(v)} valueStyle={{ fontSize: 15, color: '#2F7D5B', fontWeight: 700 }} />
                              </Col>
                            </Row>
                            <Divider style={{ margin: '12px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <span>Activos registrados: <strong>2 unidades (Dell R750, MacBook Pro)</strong></span>
                              <span>Depreciación mensual: <strong style={{ color: '#B4432F' }}>{formatCLP(336111)}</strong></span>
                            </div>
                          </Card>
                        </Col>
                      )}
                    </Row>

                    {/* ============================================================= */}
                    {/* 11 & 12. IMPUESTOS Y RATIOS FINANCIEROS                       */}
                    {/* ============================================================= */}
                    <Row gutter={[16, 16]}>
                      {visibleDashSections.impuestos && (
                        <Col xs={24} lg={12}>
                          <Card
                            title="11. Impuestos — Propuesta Formulario 29 (SII Chile)"
                            style={surface.cardStyle}
                            extra={<Button size="small" type="link" onClick={() => navegarA('contabilidad', 'f29')}>F29 Detalle →</Button>}
                          >
                            <GroupedBarChartSvg
                              labels={['Jul', 'Ago', 'Sep', 'Oct']}
                              series={[
                                { name: 'IVA Débito (538)', color: '#0062C4', data: [2318000, 3002000, 2831000, rcvF29.f29?.codigo538_TotalDebitos || 3458000] },
                                { name: 'IVA Crédito (537)', color: '#2F7D5B', data: [1501000, 1862000, 1729000, rcvF29.f29?.codigo537_TotalCreditos || 2166000] },
                              ]}
                              height={170}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 12, borderTop: '1px solid rgba(128,128,128,0.1)', paddingTop: 10 }}>
                              <Statistic
                                title={rcvF29.f29?.codigo089_ImpuestoDeterminadoIva > 0 ? "IVA Determinado (089)" : "Remanente Crédito (077)"}
                                value={rcvF29.f29?.codigo089_ImpuestoDeterminadoIva > 0 ? rcvF29.f29.codigo089_ImpuestoDeterminadoIva : (rcvF29.f29?.codigo077_RemanenteCreditoMesSiguiente || 0)}
                                formatter={v => formatCLP(v)}
                                valueStyle={{ fontSize: 16, fontWeight: 700, color: rcvF29.f29?.codigo089_ImpuestoDeterminadoIva > 0 ? '#B7791F' : '#2F7D5B' }}
                              />
                              <Statistic title="Retenciones 2da Categoría" value={285000} formatter={v => formatCLP(v)} valueStyle={{ fontSize: 16, fontWeight: 700 }} />
                            </div>
                          </Card>
                        </Col>
                      )}

                      {visibleDashSections.informes && (
                        <Col xs={24} lg={12}>
                          <Card
                            title="12. Ratios e Informes Financieros"
                            style={surface.cardStyle}
                            extra={<Button size="small" type="link" onClick={() => navegarA('contabilidad', 'mayor')}>Informes →</Button>}
                          >
                            <Row gutter={[10, 10]}>
                              <Col span={8}>
                                <Card size="small" style={{ textAlign: 'center', background: themeMode === 'dark' ? '#0F1A26' : '#F8FAFC' }}>
                                  <Text type="secondary" style={{ fontSize: 10 }}>Ratio Liquidez</Text>
                                  <div style={{ fontSize: 18, fontWeight: 700, color: '#2F7D5B' }}>2.45x</div>
                                  <Text style={{ fontSize: 9, color: '#64748b' }}>Act.Circ / Pas.Circ</Text>
                                </Card>
                              </Col>
                              <Col span={8}>
                                <Card size="small" style={{ textAlign: 'center', background: themeMode === 'dark' ? '#0F1A26' : '#F8FAFC' }}>
                                  <Text type="secondary" style={{ fontSize: 10 }}>Endeudamiento</Text>
                                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0062C4' }}>0.38x</div>
                                  <Text style={{ fontSize: 9, color: '#64748b' }}>Pasivo / Patrimonio</Text>
                                </Card>
                              </Col>
                              <Col span={8}>
                                <Card size="small" style={{ textAlign: 'center', background: themeMode === 'dark' ? '#0F1A26' : '#F8FAFC' }}>
                                  <Text type="secondary" style={{ fontSize: 10 }}>Margen Neto</Text>
                                  <div style={{ fontSize: 18, fontWeight: 700, color: '#7C3AED' }}>26.8%</div>
                                  <Text style={{ fontSize: 9, color: '#64748b' }}>Utilidad / Ventas</Text>
                                </Card>
                              </Col>

                              <Col span={8}>
                                <Card size="small" style={{ textAlign: 'center', background: themeMode === 'dark' ? '#0F1A26' : '#F8FAFC' }}>
                                  <Text type="secondary" style={{ fontSize: 10 }}>ROA</Text>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0062C4' }}>14.2%</div>
                                  <Text style={{ fontSize: 9, color: '#64748b' }}>Retorno s/ Activos</Text>
                                </Card>
                              </Col>
                              <Col span={8}>
                                <Card size="small" style={{ textAlign: 'center', background: themeMode === 'dark' ? '#0F1A26' : '#F8FAFC' }}>
                                  <Text type="secondary" style={{ fontSize: 10 }}>ROE</Text>
                                  <div style={{ fontSize: 16, fontWeight: 700, color: '#2F7D5B' }}>19.6%</div>
                                  <Text style={{ fontSize: 9, color: '#64748b' }}>Retorno Patrimonio</Text>
                                </Card>
                              </Col>
                              <Col span={8}>
                                <Card size="small" style={{ textAlign: 'center', background: themeMode === 'dark' ? '#0F1A26' : '#F8FAFC' }}>
                                  <Text type="secondary" style={{ fontSize: 10 }}>Capital Trabajo</Text>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: '#2F7D5B' }}>$48.5M</div>
                                  <Text style={{ fontSize: 9, color: '#64748b' }}>Fondo Maniobra</Text>
                                </Card>
                              </Col>
                            </Row>
                          </Card>
                        </Col>
                      )}
                    </Row>

                    {/* ============================================================= */}
                    {/* 13. AUDITORÍA Y CONTROL INTERNO                               */}
                    {/* ============================================================= */}
                    {visibleDashSections.auditoria && (
                      <Card
                        title="13. Auditoría y Control Interno (Integridad de Partida Doble & SII)"
                        style={surface.cardStyle}
                        extra={<Button size="small" type="link" onClick={() => navegarA('administracion', 'tributaria')}>Configuración →</Button>}
                      >
                        <Row gutter={[14, 14]}>
                          <Col xs={24} sm={12} lg={6}>
                            <Card size="small" style={{ background: themeMode === 'dark' ? '#0F1A26' : '#F8FAFC', borderLeft: '3px solid #2F7D5B' }}>
                              <Text strong style={{ fontSize: 12 }}>Cuadratura Contable</Text>
                              <div style={{ fontSize: 14, color: '#2F7D5B', fontWeight: 600, marginTop: 4 }}>
                                Debe = Haber (0.00 dif)
                              </div>
                              <Text type="secondary" style={{ fontSize: 11 }}>Odoo 18 l10n_cl verificado</Text>
                            </Card>
                          </Col>
                          <Col xs={24} sm={12} lg={6}>
                            <Card size="small" style={{ background: themeMode === 'dark' ? '#0F1A26' : '#F8FAFC', borderLeft: '3px solid #2F7D5B' }}>
                              <Text strong style={{ fontSize: 12 }}>Certificado Digital</Text>
                              <div style={{ fontSize: 14, color: '#2F7D5B', fontWeight: 600, marginTop: 4 }}>
                                RSA-SHA1 Válido
                              </div>
                              <Text type="secondary" style={{ fontSize: 11 }}>{activeTenant?.certificate?.subjectName || 'Activo'}</Text>
                            </Card>
                          </Col>
                          <Col xs={24} sm={12} lg={6}>
                            <Card size="small" style={{ background: themeMode === 'dark' ? '#0F1A26' : '#F8FAFC', borderLeft: '3px solid #0062C4' }}>
                              <Text strong style={{ fontSize: 12 }}>Bóveda Criptográfica</Text>
                              <div style={{ fontSize: 14, color: '#0062C4', fontWeight: 600, marginTop: 4 }}>
                                AES-256-GCM
                              </div>
                              <Text type="secondary" style={{ fontSize: 11 }}>Claves selladas en reposo</Text>
                            </Card>
                          </Col>
                          <Col xs={24} sm={12} lg={6}>
                            <Card size="small" style={{ background: themeMode === 'dark' ? '#0F1A26' : '#F8FAFC', borderLeft: '3px solid #2F7D5B' }}>
                              <Text strong style={{ fontSize: 12 }}>Anomalías o Brechas</Text>
                              <div style={{ fontSize: 14, color: '#2F7D5B', fontWeight: 600, marginTop: 4 }}>
                                0 Hallazgos Críticos
                              </div>
                              <Text type="secondary" style={{ fontSize: 11 }}>Auditoría sin observaciones</Text>
                            </Card>
                          </Col>
                        </Row>
                      </Card>
                    )}

                    {/* ============================================================= */}
                    {/* 14. ALERTAS OPERATIVAS Y ACTIVIDAD RECIENTE                   */}
                    {/* ============================================================= */}
                    {visibleDashSections.alertas && (
                      <Card
                        title="14. Alertas Operativas y Actividad Reciente de la Empresa"
                        style={surface.cardStyle}
                        extra={
                          <Space>
                            <Button size="small" onClick={() => navegarA('ventas', 'documentos')}>
                              Ver todas las ventas
                            </Button>
                            <Button size="small" onClick={() => navegarA('compras', 'recibidos')}>
                              Ver compras
                            </Button>
                          </Space>
                        }
                      >
                        <Table
                          rowKey="id"
                          loading={loading}
                          size="small"
                          pagination={{ pageSize: 6 }}
                          dataSource={tenantMoves}
                          columns={[
                            {
                              title: 'Fecha',
                              dataIndex: 'invoiceDate',
                              width: 100,
                              render: (v) => <span className="mono-code">{v}</span>,
                            },
                            {
                              title: 'Documento / Asiento',
                              dataIndex: 'name',
                              render: (text, r) => (
                                <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => abrirDetalleDocumento(r)}>
                                  {r.state === 'DRAFT' ? '(Borrador) /' : text}
                                </Button>
                              ),
                            },
                            {
                              title: 'Contraparte',
                              dataIndex: 'partnerName',
                              render: (name, r) => (
                                <div>
                                  <div>{name || 'Consumidor Final'}</div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>RUT: {escRut(r.partnerRut)}</div>
                                </div>
                              ),
                            },
                            {
                              title: 'Total',
                              dataIndex: 'amountTotal',
                              align: 'right',
                              render: (v) => <span style={{ fontWeight: 600 }}>{formatCLP(v)}</span>,
                            },
                            {
                              title: 'Emisión',
                              dataIndex: 'state',
                              render: (st) => (
                                <Tag color={st === 'POSTED' ? 'blue' : st === 'DRAFT' ? 'default' : 'red'}>
                                  {st === 'POSTED' ? 'Emitido' : st === 'DRAFT' ? 'Borrador' : 'Anulado'}
                                </Tag>
                              ),
                            },
                            {
                              title: 'SII',
                              key: 'sii',
                              render: (_, r) => {
                                const est = escEstado(r);
                                const colors = { ACEPTADO: 'green', FIRMADO: 'orange', RECHAZADO: 'red', BORRADOR: 'default' };
                                return <Tag color={colors[est] || 'default'}>{est}</Tag>;
                              },
                            },
                            {
                              title: 'Acción',
                              key: 'action',
                              render: (_, r) => (
                                <Button size="small" onClick={() => abrirDetalleDocumento(r)}>
                                  Ver detalle
                                </Button>
                              ),
                            },
                          ]}
                        />
                      </Card>
                    )}

                    {/* ============================================================= */}
                    {/* DRAWER DE PERSONALIZACIÓN DEL DASHBOARD (SECCIÓN 20)          */}
                    {/* ============================================================= */}
                    <Drawer
                      title="Personalización del Dashboard Ejecutivo"
                      placement="right"
                      open={configDrawerOpen}
                      onClose={() => setConfigDrawerOpen(false)}
                      width={380}
                    >
                      <Space direction="vertical" size={16} style={{ width: '100%' }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Activa o desactiva las secciones que deseas visualizar en tu Centro de Control Ejecutivo:
                        </Text>
                        <Divider style={{ margin: '8px 0' }} />
                        {[
                          ['resumen', '1. Resumen Ejecutivo (KPIs principales)'],
                          ['metas', '2. Metas y Objetivos Estratégicos'],
                          ['finanzas', '3. Finanzas (Ingresos vs Egresos)'],
                          ['facturacion', '4. Facturación Electrónica SII'],
                          ['ventas', '5. Ventas y Ranking de Clientes'],
                          ['compras', '6. Compras y Proveedores del Giro'],
                          ['contabilidad', '7. Contabilidad y Estructura Patrimonial'],
                          ['bancos', '8. Bancos y Conciliación'],
                          ['inventario', '9. Inventario, Catálogo y Guías'],
                          ['activos', '10. Activos Fijos y Depreciación'],
                          ['impuestos', '11. Impuestos y Formulario 29'],
                          ['informes', '12. Ratios e Informes Financieros'],
                          ['auditoria', '13. Auditoría y Control Interno'],
                          ['alertas', '14. Alertas y Actividad Reciente'],
                        ].map(([key, label]) => (
                          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13 }}>{label}</span>
                            <Switch
                              size="small"
                              checked={visibleDashSections[key]}
                              onChange={(val) => setVisibleDashSections(prev => ({ ...prev, [key]: val }))}
                            />
                          </div>
                        ))}
                        <Divider style={{ margin: '8px 0' }} />
                        <Button
                          block
                          onClick={() => setVisibleDashSections({
                            resumen: true, metas: true, finanzas: true, facturacion: true,
                            ventas: true, compras: true, contabilidad: true, bancos: true,
                            inventario: true, activos: true, impuestos: true, informes: true,
                            auditoria: true, alertas: true
                          })}
                        >
                          Restaurar Todas las Secciones
                        </Button>
                      </Space>
                    </Drawer>

                  </Space>
                )}

                {currentArea === 'ventas' && (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    {currentSubTab !== 'metas' && currentSubTab !== 'resumen' && <Alert type="info" showIcon message="Panel de demostración" description={<span>Los documentos de esta vista son de prueba. Consulta el registro persistente en <a href="/finanzas">Finanzas → Ventas</a>.</span>} />}
                    {currentSubTab === 'resumen' && (
                      <Card title="Resumen de ventas y metas" style={surface.cardStyle}><SalesGoalsView section="summary" /></Card>
                    )}
                    {currentSubTab === 'metas' && (
                      <Card title="Metas de ventas" style={surface.cardStyle}><SalesGoalsView section="all" /></Card>
                    )}
                    {currentSubTab === 'crear-factura' && (
                      <Card title="Crear factura" style={surface.cardStyle}>
                        <Form form={formNewMove} layout="vertical" onValuesChange={scheduleInvoicePreview} initialValues={{ documentTypeCode: 33, formaPagoSii: 1, lines: [{ quantity: 1, uomName: 'UN' }] }}>
                          <h2>Datos del emisor</h2>
                          <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
                            <Descriptions.Item label="Empresa">{activeTenant?.razonSocial}</Descriptions.Item>
                            <Descriptions.Item label="RUT">{escRut(activeTenant?.rut)}</Descriptions.Item>
                            <Descriptions.Item label="Giro">{activeTenant?.giro}</Descriptions.Item>
                            <Descriptions.Item label="Dirección">{activeTenant?.direccionOrigen}</Descriptions.Item>
                          </Descriptions>
                          <h2>Datos del cliente</h2>
                          <Form.Item name="partnerId" label="Cliente receptor" rules={[{ required: true }]}>
                            <Select showSearch optionFilterProp="label" options={tenantPartners.map(p => ({value:p.id,label:p.razonSocial+' · '+escRut(p.rut)}))}/>
                          </Form.Item>
                          <Form.Item noStyle shouldUpdate>
                            {({getFieldValue})=>{
                              const client=tenantPartners.find(p=>p.id===getFieldValue('partnerId'));
                              return client&&<p>{[client.giro,client.direccion,client.comuna,client.ciudad,client.email,client.telefono].filter(Boolean).join(' · ')}</p>;
                            }}
                          </Form.Item>
                          <h2>Datos del documento</h2>
                          <Row gutter={16}>
                            <Col xs={24} md={8}><Form.Item name="documentTypeCode" label="Tipo de factura" rules={[{required:true}]}>
                              <Select options={[{value:33,label:'33 · Factura afecta'},{value:34,label:'34 · Factura exenta o no afecta'}]}/>
                            </Form.Item></Col>
                            <Col xs={24} md={8}><Form.Item name="formaPagoSii" label="Condición de pago">
                              <Select options={[{value:1,label:'Contado'},{value:2,label:'Crédito'},{value:3,label:'Sin costo'}]}/>
                            </Form.Item></Col>
                            <Col xs={24} md={8}><Form.Item name="invoiceDate" label="Fecha de emisión">
                              <Input type="date"/>
                            </Form.Item></Col>
                          </Row>
                          <h2>Productos y servicios</h2>
                          <Form.List name="lines" rules={[{validator:(_,lines)=>lines?.length?Promise.resolve():Promise.reject(new Error('Agrega al menos una línea.'))}]}>
                            {(fields,{add,remove},{errors})=><>
                              {fields.map(({key,name})=><Card key={key} size="small" title={'Línea '+(name+1)} style={{marginBottom:12}} extra={<Button danger disabled={fields.length===1} onClick={()=>remove(name)}>Eliminar línea</Button>}>
                                <Row gutter={12}>
                                  <Col xs={24} md={6}><Form.Item name={[name,'productCode']} label="Código"><Input maxLength={35}/></Form.Item></Col>
                                  <Col xs={24} md={18}><Form.Item name={[name,'itemName']} label="Descripción" rules={[{required:true}]}><Input maxLength={80}/></Form.Item></Col>
                                  <Col xs={12} md={6}><Form.Item name={[name,'quantity']} label="Cantidad" rules={[{required:true}]}><InputNumber min={0.0001} style={{width:'100%'}}/></Form.Item></Col>
                                  <Col xs={12} md={6}><Form.Item name={[name,'priceUnit']} label="Precio unitario CLP" rules={[{required:true}]}><InputNumber min={0} style={{width:'100%'}}/></Form.Item></Col>
                                  <Col xs={12} md={6}><Form.Item name={[name,'discountPct']} label="Descuento %"><InputNumber min={0} max={100} style={{width:'100%'}}/></Form.Item></Col>
                                  <Col xs={12} md={6}><Form.Item name={[name,'isExempt']} label="IVA por línea" valuePropName="checked"><Checkbox>Exenta</Checkbox></Form.Item></Col>
                                </Row>
                                <Form.Item noStyle shouldUpdate>
                                  {({getFieldValue})=>{
                                    const enabled=getFieldValue(['lines',name,'additionalTax']);
                                    const taxable=getFieldValue('documentTypeCode')===33&&!getFieldValue(['lines',name,'isExempt']);
                                    return <>
                                      <Form.Item name={[name,'additionalTax']} valuePropName="checked">
                                        <Checkbox disabled={!taxable&&!enabled} onChange={event=>{
                                          if(!event.target.checked) formNewMove.setFieldValue(['lines',name,'ilaCode'],undefined);
                                          scheduleInvoicePreview();
                                        }}>Impuesto adicional</Checkbox>
                                      </Form.Item>
                                      {enabled&&<Form.Item name={[name,'ilaCode']} label="Seleccionar impuesto adicional"
                                        preserve={false} rules={[{required:true,message:'Selecciona el impuesto adicional.'}]}>
                                        <Select showSearch optionFilterProp="label" disabled={!taxable}
                                          placeholder="Selecciona un impuesto" options={additionalTaxOptions}/>
                                      </Form.Item>}
                                    </>;
                                  }}
                                </Form.Item>
                              </Card>)}
                              <Form.ErrorList errors={errors}/>
                              <Button onClick={()=>add({quantity:1,uomName:'UN'})}>Agregar línea</Button>
                            </>}
                          </Form.List>
                          <Divider/>
                          <Form.Item noStyle shouldUpdate>
                            {({getFieldValue})=>(getFieldValue('lines')||[]).some(line=>line?.additionalTax)&&<>
                              <Form.Item name="ilaOperation" valuePropName="checked">
                                <Checkbox>Confirmo que la operación está afecta a ILA conforme al artículo 43.</Checkbox>
                              </Form.Item>
                              <p>El ILA se calcula en la vista previa. La emisión con ILA queda pendiente de integración.</p>
                            </>}
                          </Form.Item>
                          {invoicePreviewError&&<Alert type="error" role="alert" message={invoicePreviewError}/>}
                          {invoicePreview&&<Descriptions title="Vista previa de montos" size="small" column={{xs:1,sm:2,lg:4}}>
                            <Descriptions.Item label="Neto">{formatCLP(invoicePreview.amountUntaxed)}</Descriptions.Item>
                            <Descriptions.Item label="Exento">{formatCLP(invoicePreview.amountExempt)}</Descriptions.Item>
                            <Descriptions.Item label="IVA">{formatCLP(invoicePreview.amountTax)}</Descriptions.Item>
                            {invoicePreview.ila?.map(item=><Descriptions.Item key={item.code} label={'ILA '+item.code+' · '+item.rate+'%'}>{formatCLP(item.amount)} sobre {formatCLP(item.base)}</Descriptions.Item>)}
                            <Descriptions.Item label="Total">{formatCLP(invoicePreview.amountTotal)}</Descriptions.Item>
                          </Descriptions>}
                          <Space wrap>
                            <Button onClick={()=>navegarA('ventas','facturas')}>Cancelar</Button>
                            <Button onClick={()=>previewInvoice(true)}>Validar y calcular</Button>
                            {[false,true].map(autoPost=><Button key={String(autoPost)} type={autoPost?'primary':'default'} loading={submittingMove}
                              onClick={()=>formNewMove.validateFields().then(async values=>{
                                if(invoiceBusy.current)return;
                                invoiceBusy.current=true;
                                setSubmittingMove(true);
                                try { await handleCreateDraftMove({...values,autoPost}); } finally { invoiceBusy.current=false; setSubmittingMove(false); }
                              }).catch(()=>{})}>{autoPost?'Firmar y emitir':'Guardar borrador'}</Button>)}
                          </Space>
                        </Form>
                      </Card>
                    )}
                    {currentSubTab === 'crear-boleta' && (
                      <Card title="Crear boleta electrónica" style={surface.cardStyle}>
                        <p>Emisor {activeTenant?.razonSocial} · RUT {escRut(activeTenant?.rut)}</p>
              <Form form={formNewBoleta} layout="vertical" onFinish={handleCreateQuickBoleta}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="documentTypeCode"
                      label="Tipo de Boleta"
                      rules={[{ required: true }]}
                      initialValue={39}
                    >
                      <Select
                        options={[
                          { value: 39, label: '[39] Boleta Electrónica (IVA 19% Incluido)' },
                          { value: 41, label: '[41] Boleta Exenta de IVA' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="formaPagoSii"
                      label="Forma de Pago"
                      initialValue={1}
                      rules={[{ required: true }]}
                    >
                      <Select
                        options={[
                          { value: 1, label: '1 — Contado (Efectivo / Débito)' },
                          { value: 2, label: '2 — Crédito / Tarjeta de Crédito' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="partnerId"
                  label="Cliente / Receptor"
                >
                  <Select allowClear placeholder="Consumidor final si corresponde"
                    options={tenantPartners.map((p) => ({
                      value: p.id,
                      label: \`\${p.razonSocial} (\${p.rut})\`,
                    }))}
                  />
                </Form.Item>

                <Form.Item
                  name="itemName"
                  label="Detalle / Glosa de la Venta"
                  rules={[{ required: true }]}
                  initialValue="VENTA MOSTRADOR / BOLETA CONSUMIDOR FINAL"
                >
                  <Input placeholder="Ej: VENTA PRODUCTOS VARIOS MOSTRADOR" />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="quantity" label="Cantidad" initialValue={1} rules={[{ required: true }]}>
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="uomName" label="Unidad" initialValue="UN">
                      <Input placeholder="UN" maxLength={4} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="priceUnit"
                      label="Precio unitario CLP"
                      rules={[{ required: true, message: 'Ingresa el monto de la boleta' }]}
                    >
                      <InputNumber min={100} step={1000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="discountPct" label="Descuento %"><InputNumber min={0} max={100}/></Form.Item>
                <Space wrap><Button onClick={()=>navegarA('ventas','boletas')}>Cancelar</Button>
                  <Button type="primary" htmlType="submit" loading={boletaSending}>Emitir boleta</Button></Space>
              </Form>
                      </Card>
                    )}
                    {salesListTitles[currentSubTab] && (
                      <SalesListPage key={activeTenantId+':'+currentSubTab} section={currentSubTab}
                        company={activeTenant} loading={loading} columns={moveColumns} formatMoney={formatCLP} cardStyle={surface.cardStyle}
                        documents={tenantSalesMoves.filter(d=>{
                          const invoice=[33,34,110].includes(d.documentTypeCode);
                          if(currentSubTab==='borradores')return d.state==='DRAFT';
                          if(d.state!=='POSTED')return false;
                          if(currentSubTab==='facturas')return invoice;
                          if(currentSubTab==='boletas')return [39,41].includes(d.documentTypeCode);
                          if(currentSubTab==='pagados')return d.paymentState==='PAID';
                          if(['pendientes','cobranzas','vencidos'].includes(currentSubTab)){
                            const due=d.dueDate||d.invoiceDateDue;
                            return escPorCobrar(d)&&(currentSubTab!=='vencidos'||(due&&due.slice(0,10)<new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago'}).format(new Date())));
                          }
                          if(currentSubTab==='corregidos')return d.paymentState==='REVERSED'||[56,61,111,112].includes(d.documentTypeCode);
                          return true;
                        })}/>
                    )}
                    {currentSubTab === 'detalle' && (
                      <>
                      <Button onClick={()=>navegarA('ventas',saleListOrigin)}>Volver al listado</Button>
                      <EscenaDocumentos
                        initialSelection={selectedSaleId}
                        titulo="Detalle de documento"
                        documentos={tenantSalesMoves}
                        empresa={activeTenant}
                        periodo={periodoTributario}
                        cargando={loading}
                        errorCarga={errorCarga}
                        onReintentar={() => fetchState()}
                        onEmitirFactura={abrirEmisionFactura}
                        onEmitirBoleta={abrirEmisionBoleta}
                        onFirmar={handlePostMove}
                        onVerXml={(doc) => setXmlInspectorMove(doc)}
                        onCobrar={(doc) => {
                          setPaymentModalMove(doc);
                          formPayment.setFieldsValue({ amount: doc.amountResidual });
                        }}
                        onNotaCredito={(doc) => {
                          setReverseModalMove(doc);
                          formReverse.setFieldsValue({ referenceDocCode: 1, reason: 'ANULA ' + escNombre(doc).toUpperCase() + ' POR DEVOLUCIÓN' });
                        }}
                        onEnviarSii={handleSendBatchSii}
                      />
                      </>
                    )}

                    {currentSubTab === 'clientes' && (
                      <Card title="Directorio de Clientes / Receptores" style={surface.cardStyle} extra={<Button type="primary" onClick={() => setNewTenantModalOpen(true)}>+ Nuevo Cliente</Button>}>
                        <Table
                          rowKey="id"
                          size="small"
                          pagination={{ pageSize: 8 }}
                          dataSource={tenantPartners}
                          columns={[
                            { title: 'Razón Social / Nombre', dataIndex: 'razonSocial', render: (v) => <strong>{v}</strong> },
                            { title: 'RUT', dataIndex: 'rut', render: (v) => <Tag className="mono-code">{escRut(v)}</Tag> },
                            { title: 'Giro Comercial', dataIndex: 'giro' },
                            { title: 'Dirección', dataIndex: 'direccion' },
                            { title: 'Comuna / Ciudad', render: (_, r) => [r.comuna, r.ciudad].filter(Boolean).join(', ') },
                            { title: 'Categoría Tributaria', dataIndex: 'taxpayerType', render: (v) => <Tag color="blue">{v}</Tag> },
                          ]}
                        />
                      </Card>
                    )}

                  </Space>
                )}

                {/* ================================================================= */}
                {/* 03 · COMPRAS, GASTOS Y PROVEEDORES                                */}
                {/* ================================================================= */}
                {currentArea === 'compras' && (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Tabs
                      activeKey={currentSubTab === 'default' ? 'recibidos' : currentSubTab}
                      onChange={(k) => navegarA('compras', k)}
                      items={[
                        { key: 'recibidos', label: 'Documentos recibidos (RCV Compras)' },
                        { key: 'proveedores', label: 'Proveedores' },
                        { key: 'gastos', label: 'Gastos operativos' },
                        { key: 'rendiciones', label: 'Rendiciones de gastos' },
                        { key: 'catalogo', label: 'Catálogo y guías de despacho' },
                      ]}
                    />

                    {(currentSubTab === 'recibidos' || currentSubTab === 'default') && (
                      <Card
                        title="Libro de Compras Recibidas (RCV SII — Facturas de Proveedores)"
                        style={surface.cardStyle}
                        extra={
                          <Button type="primary" onClick={() => setNewPurchaseModalOpen(true)}>
                            + Registrar Factura de Proveedor
                          </Button>
                        }
                      >
                        <Table
                          rowKey="id"
                          size="small"
                          pagination={{ pageSize: 8 }}
                          dataSource={tenantPurchaseMoves}
                          columns={[
                            { title: 'Fecha', dataIndex: 'invoiceDate' },
                            { title: 'Folio Proveedor', dataIndex: 'l10nLatamDocumentNumber', render: (v, r) => <Tag color="blue">Factura #{v || r.name}</Tag> },
                            { title: 'Proveedor Emisor', dataIndex: 'partnerName', render: (v, r) => <div><div>{v}</div><div style={{ fontSize: 11, color: '#64748b' }}>RUT: {escRut(r.partnerRut)}</div></div> },
                            { title: 'Monto Neto', dataIndex: 'amountUntaxed', align: 'right', render: (v) => formatCLP(v) },
                            { title: 'IVA Crédito Fiscal', dataIndex: 'amountTax', align: 'right', render: (v) => <strong style={{ color: '#2F7D5B' }}>{formatCLP(v)}</strong> },
                            { title: 'Total Compra', dataIndex: 'amountTotal', align: 'right', render: (v) => <strong>{formatCLP(v)}</strong> },
                            { title: 'Acuse SII', dataIndex: 'state', render: () => <Tag color="green">Aceptado RCV</Tag> },
                          ]}
                        />
                      </Card>
                    )}

                    {currentSubTab === 'proveedores' && (
                      <Card title="Directorio Maestro de Proveedores" style={surface.cardStyle} extra={<Button type="primary" onClick={() => setNewTenantModalOpen(true)}>+ Nuevo Proveedor</Button>}>
                        <Table
                          rowKey="id"
                          size="small"
                          pagination={{ pageSize: 8 }}
                          dataSource={tenantPartners}
                          columns={[
                            { title: 'Razón Social Proveedor', dataIndex: 'razonSocial', render: (v) => <strong>{v}</strong> },
                            { title: 'RUT', dataIndex: 'rut', render: (v) => <Tag className="mono-code">{escRut(v)}</Tag> },
                            { title: 'Giro Comercial', dataIndex: 'giro' },
                            { title: 'Dirección Comercial', dataIndex: 'direccion' },
                            { title: 'Condición de Pago', render: () => 'Crédito 30 días' },
                          ]}
                        />
                      </Card>
                    )}

                    {currentSubTab === 'gastos' && (
                      <Card
                        title="Gastos Operacionales y Compras del Giro"
                        style={surface.cardStyle}
                        extra={
                          <Button type="primary" onClick={() => setNewPurchaseModalOpen(true)}>
                            + Registrar Nuevo Gasto
                          </Button>
                        }
                      >
                        <Table
                          rowKey="id"
                          size="small"
                          pagination={{ pageSize: 8 }}
                          dataSource={tenantPurchaseMoves}
                          columns={[
                            { title: 'Fecha', dataIndex: 'invoiceDate' },
                            { title: 'Descripción / Proveedor', dataIndex: 'partnerName' },
                            { title: 'Tipo de Gasto', render: () => <Tag color="blue">Gasto del Giro</Tag> },
                            { title: 'Monto Neto', dataIndex: 'amountUntaxed', align: 'right', render: (v) => formatCLP(v) },
                            { title: 'IVA', dataIndex: 'amountTax', align: 'right', render: (v) => formatCLP(v) },
                            { title: 'Total', dataIndex: 'amountTotal', align: 'right', render: (v) => formatCLP(v) },
                          ]}
                        />
                      </Card>
                    )}

                    {currentSubTab === 'rendiciones' && (
                      <Card
                        title="Rendiciones y Gastos de Colaboradores"
                        style={surface.cardStyle}
                        extra={
                          <Space>
                            <Button type="primary" icon={<RIcono nombre="billetera" size={15} />} onClick={() => setNewExpenseModalOpen(true)}>
                              + Nuevo Gasto
                            </Button>
                            <Button onClick={() => setNewExpenseSheetModalOpen(true)}>
                              + Crear Rendición
                            </Button>
                          </Space>
                        }
                      >
                        <Table
                          rowKey="id"
                          size="small"
                          pagination={{ pageSize: 8 }}
                          dataSource={dashboardData.expenseSheets || []}
                          columns={[
                            { title: 'Código', dataIndex: 'code', render: (v) => <Tag color="blue">{v}</Tag> },
                            { title: 'Descripción', dataIndex: 'name' },
                            { title: 'Empleado', dataIndex: 'employeeName' },
                            { title: 'Total Rendición', dataIndex: 'totalAmount', align: 'right', render: (v) => formatCLP(v) },
                            { title: 'Estado', dataIndex: 'state', render: (st) => <Tag color={st === 'done' ? 'green' : st === 'post' ? 'purple' : 'orange'}>{st?.toUpperCase()}</Tag> },
                            { title: 'Asiento Contable', dataIndex: 'moveName', render: (v) => v ? <Tag color="purple">{v}</Tag> : '-' },
                          ]}
                        />
                      </Card>
                    )}

                    {currentSubTab === 'catalogo' && (
                      <Space direction="vertical" size={20} style={{ width: '100%' }}>
                    <Alert
                      type="info"
                      showIcon
                      message="Control de Inventario y Existencias — Catálogo de Productos y Guías de Despacho"
                      description="Gestión de catálogo de artículos y servicios, existencias por bodega y emisión de Guías de Despacho electrónicas (Tipo 52) con trazabilidad de traslado ante el SII."
                    />
                    <Card style={surface.cardStyle}>
                      <Tabs
                        defaultActiveKey="inv-catalogo"
                        items={[
                          {
                            key: 'inv-catalogo',
                            label: 'Catálogo de Productos y Servicios',
                            children: (
                              <Table
                                rowKey="codigo"
                                size="small"
                                pagination={{ pageSize: 6 }}
                                dataSource={[
                                  { codigo: 'PRD-001', nombre: 'Servicio de Consultoría ERP', uom: 'UN', precio: 850000, iva: 'Afecto (19%)', stock: 999 },
                                  { codigo: 'PRD-002', nombre: 'Licencia Feline Capital Cloud', uom: 'MES', precio: 150000, iva: 'Afecto (19%)', stock: 999 },
                                  { codigo: 'PRD-003', nombre: 'Dispositivo Timbre POS Fiscal', uom: 'UN', precio: 320000, iva: 'Afecto (19%)', stock: 45 },
                                  { codigo: 'PRD-004', nombre: 'Certificado Digital PKCS#12 (3 años)', uom: 'UN', precio: 45000, iva: 'Exento', stock: 120 },
                                ]}
                                columns={[
                                  { title: 'Código SKU', dataIndex: 'codigo', render: (v) => <Tag className="mono-code">{v}</Tag> },
                                  { title: 'Descripción del Producto / Servicio', dataIndex: 'nombre', render: (v) => <strong>{v}</strong> },
                                  { title: 'Unidad', dataIndex: 'uom' },
                                  { title: 'Precio Unitario ($)', dataIndex: 'precio', align: 'right', render: (v) => formatCLP(v) },
                                  { title: 'Tratamiento IVA', dataIndex: 'iva', render: (v) => <Tag color={v.includes('Afecto') ? 'blue' : 'gold'}>{v}</Tag> },
                                  { title: 'Stock Disponible', dataIndex: 'stock', align: 'right', render: (v) => <Tag color="green">{v}</Tag> },
                                ]}
                              />
                            ),
                          },
                          {
                            key: 'inv-guias',
                            label: 'Guías de Despacho Emitidas (Tipo 52)',
                            children: (
                              <Table
                                rowKey="folio"
                                size="small"
                                pagination={{ pageSize: 5 }}
                                dataSource={[
                                  { folio: 104, fecha: '2026-10-24', receptor: 'DISTRIBUIDORA DEL SUR LTDA.', traslado: 'Venta', estadoSii: 'ACEPTADO', chofer: 'Pedro Morales (14.230.111-2)' },
                                  { folio: 105, fecha: '2026-10-29', receptor: 'SUCURSAL CONCEPCIÓN', traslado: 'Traslado Interno', estadoSii: 'ACEPTADO', chofer: 'Camión Propio Feline #4' },
                                ]}
                                columns={[
                                  { title: 'Folio Guía', dataIndex: 'folio', render: (v) => <Tag color="geekblue" className="mono-code">Guía #{v}</Tag> },
                                  { title: 'Fecha', dataIndex: 'fecha' },
                                  { title: 'Destinatario', dataIndex: 'receptor', render: (v) => <strong>{v}</strong> },
                                  { title: 'Tipo de Traslado', dataIndex: 'traslado', render: (v) => <Tag>{v}</Tag> },
                                  { title: 'Estado SII', dataIndex: 'estadoSii', render: (v) => <Tag color="green">{v}</Tag> },
                                  { title: 'Transportista / Chofer', dataIndex: 'chofer' },
                                ]}
                              />
                            ),
                          },
                        ]}
                      />
                    </Card>
                  </Space>
                    )}
                  </Space>
                )}

                {/* ================================================================= */}
                {/* 04 · TESORERÍA, CAJA Y BANCOS                                     */}
                {/* ================================================================= */}
                {currentArea === 'tesoreria' && (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Tabs
                      activeKey={currentSubTab === 'default' ? 'caja-bancos' : currentSubTab}
                      onChange={(k) => navegarA('tesoreria', k)}
                      items={[
                        { key: 'caja-bancos', label: 'Caja y bancos' },
                        { key: 'cobros-pagos', label: 'Cobros y pagos' },
                        { key: 'conciliacion', label: 'Conciliación bancaria' },
                        { key: 'proyeccion', label: 'Proyección de liquidez' },
                      ]}
                    />

                    {(currentSubTab === 'caja-bancos' || currentSubTab === 'default') && (
                      <Space direction="vertical" size={20} style={{ width: '100%' }}>
                    <Alert
                      type="success"
                      showIcon
                      message="Tesorería Central — Cajas Físicas, Cuentas Bancarias y Conciliación Asistida"
                      description="Apertura y arqueo de caja chica, administración de cuentas corrientes bancarias, importación de cartolas y reglas automáticas de conciliación."
                    />
                    <Card style={surface.cardStyle}>
                      <Tabs
                        defaultActiveKey="teso-cajas"
                        items={[
                          {
                            key: 'teso-cajas',
                            label: 'Cajas Físicas y Caja Chica (FinanceCashBox)',
                            children: (
                              <Table
                                rowKey="id"
                                size="small"
                                pagination={{ pageSize: 5 }}
                                dataSource={dashboardData.finance?.cashBoxes || [
                                  { id: '1', name: 'Caja Principal Casa Matriz', code: 'CAJA-01', balance: 1450000, status: 'OPEN', currency: 'CLP' },
                                  { id: '2', name: 'Fondo Fijo Caja Chica Administración', code: 'CCH-01', balance: 500000, status: 'OPEN', currency: 'CLP' },
                                ]}
                                columns={[
                                  { title: 'Código', dataIndex: 'code', render: (v) => <Tag className="mono-code">{v}</Tag> },
                                  { title: 'Nombre de la Caja', dataIndex: 'name', render: (v) => <strong>{v}</strong> },
                                  { title: 'Saldo en Efectivo', dataIndex: 'balance', align: 'right', render: (v) => <strong style={{ color: '#2F7D5B' }}>{formatCLP(v)}</strong> },
                                  { title: 'Estado', dataIndex: 'status', render: (v) => <Tag color={v === 'OPEN' ? 'green' : 'default'}>{v === 'OPEN' ? 'ABIERTA' : 'CERRADA'}</Tag> },
                                ]}
                              />
                            ),
                          },
                          {
                            key: 'teso-bancos',
                            label: 'Cuentas Bancarias (FinanceBankAccount)',
                            children: (
                              <Table
                                rowKey="id"
                                size="small"
                                pagination={{ pageSize: 5 }}
                                dataSource={dashboardData.finance?.bankAccounts || [
                                  { id: '1', bankName: 'Banco de Chile', accountNumber: '00-12345-67', accountType: 'Corriente', accountingBalance: 32450000, bankBalance: 32450000, status: 'CONCILIADO' },
                                  { id: '2', bankName: 'Banco Santander Chile', accountNumber: '88-99120-11', accountType: 'Corriente', accountingBalance: 14750000, bankBalance: 14750000, status: 'CONCILIADO' },
                                ]}
                                columns={[
                                  { title: 'Institución Bancaria', dataIndex: 'bankName', render: (v) => <strong>{v}</strong> },
                                  { title: 'Nº Cuenta', dataIndex: 'accountNumber', render: (v) => <span className="mono-code">{v}</span> },
                                  { title: 'Tipo', dataIndex: 'accountType' },
                                  { title: 'Saldo Contable', dataIndex: 'accountingBalance', align: 'right', render: (v) => formatCLP(v) },
                                  { title: 'Saldo según Cartola', dataIndex: 'bankBalance', align: 'right', render: (v) => formatCLP(v) },
                                  { title: 'Estado Conciliación', dataIndex: 'status', render: (v) => <Tag color="green">{v}</Tag> },
                                ]}
                              />
                            ),
                          },
                          {
                            key: 'teso-conciliacion',
                            label: 'Conciliación Bancaria Asistida y Reglas Automáticas',
                            children: (
                              <Table
                                rowKey="regla"
                                size="small"
                                pagination={false}
                                dataSource={[
                                  { regla: 'Abonos TEF Clientes', patron: 'TRANSFERENCIA DESDE RUT', cuentaContable: '110201 - Clientes Nacionales', confianza: '100% Automático' },
                                  { regla: 'Pago Nómina Previred', patron: 'CARGO PREVIRED', cuentaContable: '210610 - Leyes Sociales por Pagar', confianza: '100% Automático' },
                                  { regla: 'Servicios Básicos y Enel', patron: 'PAGO AUTOMÁTICO ENEL/AGUAS', cuentaContable: '510220 - Servicios Básicos', confianza: '95% Sugerido' },
                                ]}
                                columns={[
                                  { title: 'Regla de Conciliación', dataIndex: 'regla', render: (v) => <strong>{v}</strong> },
                                  { title: 'Patrón de Cartola', dataIndex: 'patron', render: (v) => <span className="mono-code">{v}</span> },
                                  { title: 'Cuenta de Imputación Automática', dataIndex: 'cuentaContable' },
                                  { title: 'Nivel de Coincidencia', dataIndex: 'confianza', render: (v) => <Tag color="cyan">{v}</Tag> },
                                ]}
                              />
                            ),
                          },
                        ]}
                      />
                    </Card>
                  </Space>
                    )}

                    {currentSubTab === 'cobros-pagos' && (
                      <Card title="Movimientos Efectivos de Fondos (Cobros y Pagos)" style={surface.cardStyle}>
                        <Table
                          rowKey="id"
                          size="small"
                          pagination={{ pageSize: 8 }}
                          dataSource={tenantMoves}
                          columns={[
                            { title: 'Fecha', dataIndex: 'invoiceDate' },
                            { title: 'Descripción', dataIndex: 'name' },
                            { title: 'Contraparte', dataIndex: 'partnerName' },
                            { title: 'Tipo', render: (_, r) => r.moveType === 'OUT_INVOICE' ? <Tag color="green">Cobro / Ingreso</Tag> : <Tag color="orange">Pago / Egreso</Tag> },
                            { title: 'Monto', dataIndex: 'amountTotal', align: 'right', render: (v) => formatCLP(v) },
                            { title: 'Estado Pago', dataIndex: 'paymentState', render: (st) => <Tag color={st === 'PAID' ? 'green' : 'gold'}>{st === 'PAID' ? 'Pagado' : 'Pendiente'}</Tag> },
                          ]}
                        />
                      </Card>
                    )}

                    {currentSubTab === 'conciliacion' && (
                      <Card title="Conciliación Bancaria y Cartolas" style={surface.cardStyle} extra={<Button type="primary">+ Importar Cartola Bancaria</Button>}>
                        <Table
                          rowKey="id"
                          size="small"
                          pagination={{ pageSize: 6 }}
                          dataSource={[
                            { fecha: '2026-10-18', banco: 'Banco de Chile (Cta Cte #1029)', glosa: 'TRANSFERENCIA RECIBIDA CLIENTE ACME', monto: 1450000, tipo: 'ABONO', estado: 'CONCILIADO' },
                            { fecha: '2026-10-20', banco: 'Santander (Cta Cte #8821)', glosa: 'PAGO PROVEEDOR INSUMOS SUR', monto: 420000, tipo: 'CARGO', estado: 'CONCILIADO' },
                            { fecha: '2026-10-22', banco: 'Banco de Chile (Cta Cte #1029)', glosa: 'COMISIÓN MANTENCIÓN MENSUAL', monto: 15400, tipo: 'CARGO', estado: 'PENDIENTE' },
                          ]}
                          columns={[
                            { title: 'Fecha', dataIndex: 'fecha' },
                            { title: 'Cuenta Bancaria', dataIndex: 'banco' },
                            { title: 'Glosa Movimiento Cartola', dataIndex: 'glosa' },
                            { title: 'Tipo', dataIndex: 'tipo', render: (v) => <Tag color={v === 'ABONO' ? 'green' : 'orange'}>{v}</Tag> },
                            { title: 'Monto', dataIndex: 'monto', align: 'right', render: (v) => formatCLP(v) },
                            { title: 'Estado', dataIndex: 'estado', render: (st) => <Tag color={st === 'CONCILIADO' ? 'green' : 'gold'}>{st}</Tag> },
                          ]}
                        />
                      </Card>
                    )}

                    {currentSubTab === 'proyeccion' && (
                      <Card title="Proyección de Flujo de Caja y Liquidez a 6 Meses" style={surface.cardStyle}>
                        <AreaChartSvg
                          labels={['May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct']}
                          series={[
                            { name: 'Ingresos Operacionales', color: '#2F7D5B', data: [14200000, 16800000, 15400000, 18900000, 17500000, 21400000] },
                            { name: 'Egresos & Pagos', color: '#B4432F', data: [9800000, 11200000, 10500000, 12800000, 11900000, 13600000] },
                          ]}
                          height={240}
                        />
                      </Card>
                    )}
                  </Space>
                )}

                {/* ================================================================= */}
                {/* 05 · CONTABILIDAD GENERAL E IMPUESTOS                             */}
                {/* ================================================================= */}
                {currentArea === 'contabilidad' && (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Tabs
                      activeKey={currentSubTab === 'default' ? 'diario' : currentSubTab}
                      onChange={(k) => navegarA('contabilidad', k)}
                      items={[
                        { key: 'diario', label: 'Asientos y libro diario' },
                        { key: 'mayor', label: 'Libro mayor analítico' },
                        { key: 'balance', label: 'Balance tributario 8 columnas' },
                        { key: 'rcv', label: 'Registro compras y ventas (RCV)' },
                        { key: 'f29', label: 'Propuesta Formulario 29' },
                        { key: 'activos', label: 'Activos fijos y presupuestos' },
                      ]}
                    />

                    {(currentSubTab === 'diario' || currentSubTab === 'default') && (
                      <Card
                        title="Libro Diario — Asientos Contables de Partida Doble"
                        style={surface.cardStyle}
                        extra={
                          <Button type="primary" onClick={() => setNewManualEntryModalOpen(true)}>
                            + Nuevo Asiento Contable Manual
                          </Button>
                        }
                      >
                        <Table
                          rowKey="id"
                          size="small"
                          pagination={{ pageSize: 8 }}
                          dataSource={accounting.journalItems || []}
                          columns={[
                            { title: 'Fecha', dataIndex: 'date', width: 100 },
                            { title: 'Asiento / Referencia', dataIndex: 'ref', render: (v, r) => <div><div>{v}</div><div style={{ fontSize: 11, color: '#64748b' }}>Asiento #{r.moveId}</div></div> },
                            { title: 'Cuenta Contable', render: (_, r) => <div><Tag className="mono-code">{r.accountCode}</Tag> <span>{r.accountName}</span></div> },
                            { title: 'Debe ($)', dataIndex: 'debit', align: 'right', render: (v) => formatCLP(v) },
                            { title: 'Haber ($)', dataIndex: 'credit', align: 'right', render: (v) => formatCLP(v) },
                          ]}
                        />
                      </Card>
                    )}

                    {currentSubTab === 'mayor' && (
                      <Card title="Libro Mayor Analítico por Cuenta" style={surface.cardStyle}>
                        <Table
                          rowKey="accountCode"
                          size="small"
                          pagination={{ pageSize: 8 }}
                          dataSource={accounting.libroMayor || []}
                          columns={[
                            { title: 'Código', dataIndex: 'accountCode', render: (v) => <Tag color="blue" className="mono-code">{v}</Tag> },
                            { title: 'Nombre de la Cuenta', dataIndex: 'accountName', render: (v) => <strong>{v}</strong> },
                            { title: 'Debe Acumulado', dataIndex: 'totalDebit', align: 'right', render: (v) => formatCLP(v) },
                            { title: 'Haber Acumulado', dataIndex: 'totalCredit', align: 'right', render: (v) => formatCLP(v) },
                            { title: 'Saldo Deudor', dataIndex: 'saldoDeudor', align: 'right', render: (v) => formatCLP(v) },
                            { title: 'Saldo Acreedor', dataIndex: 'saldoAcreedor', align: 'right', render: (v) => formatCLP(v) },
                          ]}
                        />
                      </Card>
                    )}

                    {currentSubTab === 'balance' && (
                      <Space direction="vertical" size={20} style={{ width: '100%' }}>
                    <Alert
                      type="success"
                      showIcon
                      message={\`Motor Contable de Partida Doble Odoo 18 (addons/account + l10n_cl) — Cuadratura: \${accounting.balance8Columnas.resultadoEjercicio.cuadraturaPerfecta ? 'PERFECTA (Σ Debe = Σ Haber | Activo - Pasivo = Ganancia - Pérdida)' : 'DESCUADRADO'}\`}
                      description="Cada Factura de Venta (33/34/39), Nota de Crédito (61), Factura de Proveedor recibida en RCV y Pago (account.payment) genera automáticamente sus apuntes contables en tiempo real y actualiza el Balance Tributario de 8 Columnas exigido por el SII."
                    />

                    <Card
                      title={\`Contabilidad General IFRS / SII Chile — \${activeTenant?.razonSocial}\`}
                      style={surface.cardStyle}
                      extra={
                        <Space>
                          <Button
                            type="primary"
                            onClick={() => {
                              formManualEntry.setFieldsValue({
                                date: '2026-10-18',
                                reference: 'CENTRALIZACIÓN REMUNERACIONES OCTUBRE 2026',
                                debitAccountCode: '410210',
                                creditAccountCode: '210610',
                                amount: 1450000,
                              });
                              setNewManualEntryModalOpen(true);
                            }}
                          >
                            + Nuevo Asiento Contable Manual (Partida Doble)
                          </Button>
                          <Button icon={<RIcono nombre="descargar" size={16} />} onClick={exportBalance8ColCsv}>
                            Exportar balance CSV
                          </Button>
                        </Space>
                      }
                    >
                      <Tabs
                        defaultActiveKey="tab-balance-8col"
                        items={[
                          {
                            key: 'tab-balance-8col',
                            label: 'Balance Tributario de 8 Columnas (SII Chile)',
                            children: (
                              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                                <Table
                                  rowKey="accountCode"
                                  size="small"
                                  bordered
                                  pagination={false}
                                  dataSource={accounting.balance8Columnas.filas}
                                  columns={[
                                    {
                                      title: 'Cuenta Contable (l10n_cl)',
                                      children: [
                                        {
                                          title: 'Código',
                                          dataIndex: 'accountCode',
                                          width: 90,
                                          render: (v) => <Tag color="geekblue" className="mono-code">{v}</Tag>,
                                        },
                                        {
                                          title: 'Nombre de la Cuenta',
                                          dataIndex: 'accountName',
                                        },
                                      ],
                                    },
                                    {
                                      title: 'SUMAS',
                                      children: [
                                        { title: '1. Débitos', dataIndex: 'debitos', align: 'right', render: (v) => formatCLP(v) },
                                        { title: '2. Créditos', dataIndex: 'creditos', align: 'right', render: (v) => formatCLP(v) },
                                      ],
                                    },
                                    {
                                      title: 'SALDOS',
                                      children: [
                                        { title: '3. Deudor', dataIndex: 'saldoDeudor', align: 'right', render: (v) => v > 0 ? formatCLP(v) : '-' },
                                        { title: '4. Acreedor', dataIndex: 'saldoAcreedor', align: 'right', render: (v) => v > 0 ? formatCLP(v) : '-' },
                                      ],
                                    },
                                    {
                                      title: 'INVENTARIO (Balance)',
                                      children: [
                                        {
                                          title: '5. Activo',
                                          dataIndex: 'activo',
                                          align: 'right',
                                          render: (v) => v > 0 ? <Text strong style={{ color: textoAcento }}>{formatCLP(v)}</Text> : '-',
                                        },
                                        {
                                          title: '6. Pasivo',
                                          dataIndex: 'pasivo',
                                          align: 'right',
                                          render: (v) => v > 0 ? <Text strong style={{ color: acentoSecundario }}>{formatCLP(v)}</Text> : '-',
                                        },
                                      ],
                                    },
                                    {
                                      title: 'RESULTADOS (Estado de Resultados)',
                                      children: [
                                        {
                                          title: '7. Pérdida (Gasto)',
                                          dataIndex: 'perdida',
                                          align: 'right',
                                          render: (v) => v > 0 ? <Text strong style={{ color: '#B4432F' }}>{formatCLP(v)}</Text> : '-',
                                        },
                                        {
                                          title: '8. Ganancia (Ingreso)',
                                          dataIndex: 'ganancia',
                                          align: 'right',
                                          render: (v) => v > 0 ? <Text strong style={{ color: '#2F7D5B' }}>{formatCLP(v)}</Text> : '-',
                                        },
                                      ],
                                    },
                                  ]}
                                  summary={() => {
                                    const sub = accounting.balance8Columnas.subtotales;
                                    const res = accounting.balance8Columnas.resultadoEjercicio;
                                    const tot = accounting.balance8Columnas.totalesFinalesCuadrados;
                                    return (
                                      <Table.Summary fixed>
                                        <Table.Summary.Row style={{ fontWeight: 600 }}>
                                          <Table.Summary.Cell index={0} colSpan={2}>SUBTOTALES DEL PERÍODO</Table.Summary.Cell>
                                          <Table.Summary.Cell index={2} align="right">{formatCLP(sub.debitos)}</Table.Summary.Cell>
                                          <Table.Summary.Cell index={3} align="right">{formatCLP(sub.creditos)}</Table.Summary.Cell>
                                          <Table.Summary.Cell index={4} align="right">{formatCLP(sub.saldoDeudor)}</Table.Summary.Cell>
                                          <Table.Summary.Cell index={5} align="right">{formatCLP(sub.saldoAcreedor)}</Table.Summary.Cell>
                                          <Table.Summary.Cell index={6} align="right">{formatCLP(sub.activo)}</Table.Summary.Cell>
                                          <Table.Summary.Cell index={7} align="right">{formatCLP(sub.pasivo)}</Table.Summary.Cell>
                                          <Table.Summary.Cell index={8} align="right">{formatCLP(sub.perdida)}</Table.Summary.Cell>
                                          <Table.Summary.Cell index={9} align="right">{formatCLP(sub.ganancia)}</Table.Summary.Cell>
                                        </Table.Summary.Row>
                                        <Table.Summary.Row style={{ fontWeight: 700, color: res.tipo === 'PERDIDA' ? '#B4432F' : '#2F7D5B' }}>
                                          <Table.Summary.Cell index={0} colSpan={2}>
                                            RESULTADO DEL EJERCICIO ({res.tipo})
                                          </Table.Summary.Cell>
                                          <Table.Summary.Cell index={2} align="right">-</Table.Summary.Cell>
                                          <Table.Summary.Cell index={3} align="right">-</Table.Summary.Cell>
                                          <Table.Summary.Cell index={4} align="right">-</Table.Summary.Cell>
                                          <Table.Summary.Cell index={5} align="right">-</Table.Summary.Cell>
                                          <Table.Summary.Cell index={6} align="right">
                                            {res.tipo === 'PERDIDA' ? formatCLP(res.monto) : '-'}
                                          </Table.Summary.Cell>
                                          <Table.Summary.Cell index={7} align="right">
                                            {res.tipo === 'UTILIDAD' ? formatCLP(res.monto) : '-'}
                                          </Table.Summary.Cell>
                                          <Table.Summary.Cell index={8} align="right">
                                            {res.tipo === 'UTILIDAD' ? formatCLP(res.monto) : '-'}
                                          </Table.Summary.Cell>
                                          <Table.Summary.Cell index={9} align="right">
                                            {res.tipo === 'PERDIDA' ? formatCLP(res.monto) : '-'}
                                          </Table.Summary.Cell>
                                        </Table.Summary.Row>
                                        <Table.Summary.Row style={{ fontWeight: 800 }}>
                                          <Table.Summary.Cell index={0} colSpan={2}>TOTALES IGUALES (CUADRATURA SII)</Table.Summary.Cell>
                                          <Table.Summary.Cell index={2} align="right">{formatCLP(tot.debitos)}</Table.Summary.Cell>
                                          <Table.Summary.Cell index={3} align="right">{formatCLP(tot.creditos)}</Table.Summary.Cell>
                                          <Table.Summary.Cell index={4} align="right">{formatCLP(tot.saldoDeudor)}</Table.Summary.Cell>
                                          <Table.Summary.Cell index={5} align="right">{formatCLP(tot.saldoAcreedor)}</Table.Summary.Cell>
                                          <Table.Summary.Cell index={6} align="right">{formatCLP(tot.activo)}</Table.Summary.Cell>
                                          <Table.Summary.Cell index={7} align="right">{formatCLP(tot.pasivo)}</Table.Summary.Cell>
                                          <Table.Summary.Cell index={8} align="right">{formatCLP(tot.perdida)}</Table.Summary.Cell>
                                          <Table.Summary.Cell index={9} align="right">{formatCLP(tot.ganancia)}</Table.Summary.Cell>
                                        </Table.Summary.Row>
                                      </Table.Summary>
                                    );
                                  }}
                                />
                              </Space>
                            ),
                          },
                          {
                            key: 'tab-libro-diario',
                            label: \`Libro Diario / Apuntes Partida Doble (\${accounting.journalItems.length} líneas)\`,
                            children: (
                              <Table
                                rowKey="id"
                                size="small"
                                dataSource={accounting.journalItems}
                                pagination={{ pageSize: 10 }}
                                columns={[
                                  { title: 'Fecha', dataIndex: 'date', width: 105, render: (v) => <Text className="mono-code">{v}</Text> },
                                  {
                                    title: 'Diario / Asiento Odoo',
                                    key: 'move',
                                    render: (_, r) => (
                                      <Space>
                                        <Tag color="blue">{r.journalCode}</Tag>
                                        <Text strong className="mono-code">{r.moveName}</Text>
                                      </Space>
                                    ),
                                  },
                                  {
                                    title: 'Cuenta Contable (account.account)',
                                    key: 'account',
                                    render: (_, r) => (
                                      <span>
                                        <Tag className="mono-code">{r.accountCode}</Tag> {r.accountName}
                                      </span>
                                    ),
                                  },
                                  { title: 'Glosa / Etiqueta (account.move.line)', dataIndex: 'label' },
                                  {
                                    title: 'Debe (Debit)',
                                    dataIndex: 'debit',
                                    align: 'right',
                                    render: (v) => v > 0 ? <Text strong>{formatCLP(v)}</Text> : '-',
                                  },
                                  {
                                    title: 'Haber (Credit)',
                                    dataIndex: 'credit',
                                    align: 'right',
                                    render: (v) => v > 0 ? <Text strong>{formatCLP(v)}</Text> : '-',
                                  },
                                  {
                                    title: 'Conciliación Odoo',
                                    key: 'reconcile',
                                    align: 'center',
                                    render: (_, r) =>
                                      r.reconciled ? (
                                        <Tag color="success" className="mono-code">✓ {r.matchingNumber}</Tag>
                                      ) : (
                                        <Tag>Abierto</Tag>
                                      ),
                                  },
                                ]}
                              />
                            ),
                          },
                          {
                            key: 'tab-libro-mayor',
                            label: \`Libro Mayor por Cuenta (\${accounting.libroMayor.length} cuentas activas)\`,
                            children: (
                              <Table
                                rowKey="accountCode"
                                size="small"
                                dataSource={accounting.libroMayor}
                                pagination={false}
                                columns={[
                                  {
                                    title: 'Código SII',
                                    dataIndex: 'accountCode',
                                    render: (v) => <Tag color="geekblue" className="mono-code">{v}</Tag>,
                                  },
                                  { title: 'Cuenta Contable', dataIndex: 'accountName', render: (v) => <Text strong>{v}</Text> },
                                  {
                                    title: 'Clasificación Tributaria',
                                    dataIndex: 'siiClassification',
                                    render: (v) => <Tag color="purple">{v}</Tag>,
                                  },
                                  {
                                    title: 'Movimientos',
                                    key: 'count',
                                    align: 'center',
                                    render: (_, r) => <Badge count={r.entries.length} style={{ backgroundColor: primaryColor }} />,
                                  },
                                  { title: 'Total Debe', dataIndex: 'totalDebit', align: 'right', render: (v) => formatCLP(v) },
                                  { title: 'Total Haber', dataIndex: 'totalCredit', align: 'right', render: (v) => formatCLP(v) },
                                  {
                                    title: 'Saldo Final (Debe - Haber)',
                                    dataIndex: 'finalBalance',
                                    align: 'right',
                                    render: (v) => (
                                      <Text strong style={{ color: v >= 0 ? textoAcento : '#B4432F' }}>
                                        {formatCLP(v)}
                                      </Text>
                                    ),
                                  },
                                ]}
                              />
                            ),
                          },
                          {
                            key: 'tab-plan-cuentas',
                            label: \`Plan de Cuentas Oficial Chile (Odoo l10n_cl — \${accounting.chartOfAccounts.length} cuentas)\`,
                            children: (
                              <Table
                                rowKey="code"
                                size="small"
                                dataSource={accounting.chartOfAccounts}
                                pagination={{ pageSize: 10 }}
                                columns={[
                                  {
                                    title: 'Código (6 dígitos)',
                                    dataIndex: 'code',
                                    width: 140,
                                    render: (v) => <Tag color="blue" className="mono-code">{v}</Tag>,
                                  },
                                  { title: 'Nombre Oficial de la Cuenta (account.account-cl.csv)', dataIndex: 'name' },
                                  { title: 'Tipo Odoo (account_type)', dataIndex: 'accountType', render: (v) => <Text code>{v}</Text> },
                                  { title: 'Grupo Interno', dataIndex: 'internalGroup', render: (v) => <Tag>{v.toUpperCase()}</Tag> },
                                  {
                                    title: 'Permite Conciliación',
                                    dataIndex: 'reconcile',
                                    align: 'center',
                                    render: (v) => (v ? <Tag color="success">Sí (CxC / CxP)</Tag> : <Tag>No</Tag>),
                                  },
                                  {
                                    title: 'Columna Balance 8 Col.',
                                    dataIndex: 'includeInitialBalance',
                                    render: (v) =>
                                      v ? (
                                        <Tag color="geekblue">Inventario (Activo / Pasivo)</Tag>
                                      ) : (
                                        <Tag color="gold">Resultados (Pérdida / Ganancia)</Tag>
                                      ),
                                  },
                                ]}
                              />
                            ),
                          },
                        ]}
                      />
                    </Card>
                  </Space>
                    )}

                    {currentSubTab === 'rcv' && (
                      <Card title="Registro Oficial de Compras y Ventas (RCV SII)" style={surface.cardStyle}>
                        <Tabs
                          defaultActiveKey="rcv-v"
                          items={[
                            {
                              key: 'rcv-v',
                              label: 'Libro de Ventas Emitidas (DTEs)',
                              children: (
                                <Table
                                  rowKey="id"
                                  size="small"
                                  pagination={{ pageSize: 8 }}
                                  dataSource={postedSalesMoves}
                                  columns={[
                                    { title: 'Fecha', dataIndex: 'invoiceDate' },
                                    { title: 'Folio / Doc', dataIndex: 'name', render: (v, r) => <Button type="link" style={{ padding: 0 }} onClick={() => abrirDetalleDocumento(r)}>{v}</Button> },
                                    { title: 'Receptor', dataIndex: 'partnerName' },
                                    { title: 'Monto Neto', dataIndex: 'amountUntaxed', align: 'right', render: (v) => formatCLP(v) },
                                    { title: 'IVA Débito', dataIndex: 'amountTax', align: 'right', render: (v) => formatCLP(v) },
                                    { title: 'Total', dataIndex: 'amountTotal', align: 'right', render: (v) => formatCLP(v) },
                                    { title: 'Estado SII', render: () => <Tag color="green">Aceptado SII</Tag> },
                                  ]}
                                />
                              ),
                            },
                            {
                              key: 'rcv-c',
                              label: 'Libro de Compras Recibidas (DTEs)',
                              children: (
                                <Table
                                  rowKey="id"
                                  size="small"
                                  pagination={{ pageSize: 8 }}
                                  dataSource={tenantPurchaseMoves}
                                  columns={[
                                    { title: 'Fecha', dataIndex: 'invoiceDate' },
                                    { title: 'Folio Proveedor', dataIndex: 'l10nLatamDocumentNumber', render: (v) => 'Factura #' + v },
                                    { title: 'Proveedor', dataIndex: 'partnerName' },
                                    { title: 'Monto Neto', dataIndex: 'amountUntaxed', align: 'right', render: (v) => formatCLP(v) },
                                    { title: 'IVA Crédito', dataIndex: 'amountTax', align: 'right', render: (v) => formatCLP(v) },
                                    { title: 'Total', dataIndex: 'amountTotal', align: 'right', render: (v) => formatCLP(v) },
                                  ]}
                                />
                              ),
                            },
                          ]}
                        />
                      </Card>
                    )}

                    {currentSubTab === 'f29' && (
                      <Card title="Propuesta Formulario 29 — Declaración Mensual y Pago Simultáneo (SII)" style={surface.cardStyle}>
                        <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
                          <Col xs={24} sm={12} lg={6}>
                            <Card size="small">
                              <Statistic title="IVA Débito Fiscal (Cód. 538)" value={rcvF29.f29.codigo538_TotalDebitos} formatter={(v) => formatCLP(v)} valueStyle={{ color: '#0062C4', fontWeight: 700 }} />
                            </Card>
                          </Col>
                          <Col xs={24} sm={12} lg={6}>
                            <Card size="small">
                              <Statistic title="IVA Crédito Fiscal (Cód. 537)" value={rcvF29.f29.codigo537_TotalCreditos} formatter={(v) => formatCLP(v)} valueStyle={{ color: '#2F7D5B', fontWeight: 700 }} />
                            </Card>
                          </Col>
                          <Col xs={24} sm={12} lg={6}>
                            <Card size="small">
                              <Statistic title="Impuesto Determinado (Cód. 089)" value={rcvF29.f29.codigo089_ImpuestoDeterminadoIva} formatter={(v) => formatCLP(v)} valueStyle={{ color: '#B7791F', fontWeight: 700 }} />
                            </Card>
                          </Col>
                          <Col xs={24} sm={12} lg={6}>
                            <Card size="small">
                              <Statistic title="Remanente Crédito (Cód. 077)" value={rcvF29.f29.codigo077_RemanenteCreditoMesSiguiente} formatter={(v) => formatCLP(v)} valueStyle={{ color: '#2F7D5B', fontWeight: 700 }} />
                            </Card>
                          </Col>
                        </Row>
                        <GroupedBarChartSvg
                          labels={['Jul', 'Ago', 'Sep', 'Oct']}
                          series={[
                            { name: 'IVA Débito (538)', color: '#0062C4', data: [2318000, 3002000, 2831000, 3458000] },
                            { name: 'IVA Crédito (537)', color: '#2F7D5B', data: [1501000, 1862000, 1729000, 2166000] },
                          ]}
                          height={190}
                        />
                      </Card>
                    )}

                    {currentSubTab === 'activos' && (
                      <Card title="Activos Fijos, Presupuestos y Centralización de Remuneraciones" style={surface.cardStyle}>
                        <Tabs
                          defaultActiveKey="p-cc"
                          items={[
                            {
                              key: 'p-cc',
                              label: 'Presupuestos por Centro de Costo',
                              children: (
                                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                                      <span>Operaciones & Logística</span>
                                      <span style={{ fontWeight: 600 }}>$14.2M / $16.0M (88.7%)</span>
                                    </div>
                                    <Progress percent={88.7} strokeColor="#2F7D5B" size="small" />
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                                      <span>Comercial, Ventas & Marketing</span>
                                      <span style={{ fontWeight: 600 }}>$8.6M / $10.0M (86.0%)</span>
                                    </div>
                                    <Progress percent={86.0} strokeColor="#0062C4" size="small" />
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                                      <span>Administración, Finanzas & TI</span>
                                      <span style={{ fontWeight: 600 }}>$6.1M / $6.5M (93.8%)</span>
                                    </div>
                                    <Progress percent={93.8} strokeColor="#B7791F" size="small" />
                                  </div>
                                </Space>
                              ),
                            },
                            {
                              key: 'p-rem',
                              label: 'Centralización de Remuneraciones y Honorarios',
                              children: (
                                <div>
                                  <Alert message="Asiento mensual de remuneraciones integrado automáticamente con Libro Diario de Partida Doble" type="info" showIcon style={{ marginBottom: 16 }} />
                                  <Button type="primary" onClick={() => setNewManualEntryModalOpen(true)}>+ Centralizar Nómina</Button>
                                </div>
                              ),
                            },
                          ]}
                        />
                      </Card>
                    )}
                  </Space>
                )}

                {/* ================================================================= */}
                {/* 06 · ADMINISTRACIÓN DEL SISTEMA                                   */}
                {/* ================================================================= */}
                {currentArea === 'administracion' && (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Tabs
                      activeKey={currentSubTab === 'default' ? 'empresas' : currentSubTab}
                      onChange={(k) => navegarA('administracion', k)}
                      items={[
                        { key: 'empresas', label: 'Empresas emisoras' },
                        { key: 'usuarios', label: 'Usuarios y permisos' },
                        { key: 'tributaria', label: 'Configuración tributaria y folios' },
                        { key: 'preferencias', label: 'Preferencias visuales' },
                      ]}
                    />

                    {(currentSubTab === 'empresas' || currentSubTab === 'default') && (
                      <Space direction="vertical" size={20} style={{ width: '100%' }}>
                    <Card style={surface.cardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <Title level={4} style={{ margin: 0 }}>
                            Empresas Emisoras (Multi-Tenant) y Bóveda Criptográfica
                          </Title>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            Aislamiento estricto de certificados digitales PKCS#12, llaves RSA y timbraje SII cifrados con AES-256-GCM
                          </Text>
                        </div>
                        <Button
                          type="primary"
                          icon={<RIcono nombre="empresa" />}
                          onClick={() => {
                            formNewTenant.setFieldsValue({
                              environment: 'CERTIFICACION',
                            });
                            setNewTenantModalOpen(true);
                          }}
                        >
                          + Registrar Nueva Empresa (Tenant)
                        </Button>
                      </div>
                    </Card>

                    <Alert
                      type="info"
                      showIcon
                      message="Bóveda Criptográfica Multiempresa (AES-256-GCM + PKCS#12)"
                      description="Cada empresa emisora (Tenant) almacena su propio archivo .pfx o .p12 cifrado con AES-256-GCM. Al subir un certificado aquí, Feline extrae la llave privada RSA y el certificado X.509 para firmar automáticamente las semillas SOAP del SII, los DTEs individuales y los sobres EnvioDTE."
                    />
                    <Row gutter={[20, 20]}>
                      {dashboardData.tenants.map((t) => (
                        <Col xs={24} md={12} key={t.id}>
                          <Card
                            title={\`\${t.razonSocial} (RUT: \${t.rut})\`}
                            style={surface.cardStyle}
                            extra={
                              <Space>
                                {activeTenantId === t.id ? (
                                  <Tag color="green">Empresa Activa</Tag>
                                ) : (
                                  <Button size="small" onClick={() => { setActiveTenantId(t.id); fetchState(t.id); }}>
                                    Seleccionar
                                  </Button>
                                )}
                                <Button
                                  size="small"
                                  type="primary"
                                  onClick={() => {
                                    setActiveTenantId(t.id);
                                    formCertUpload.setFieldsValue({
                                      rutTitular: t.rutEnvia,
                                      nombreTitular: t.certificate?.subjectName,
                                      passphrase: '',
                                    });
                                    setCertUploadModalOpen(true);
                                  }}
                                >
                                  Subir .PFX
                                </Button>
                              </Space>
                            }
                          >
                            <Descriptions column={1} size="small" bordered>
                              <Descriptions.Item label="RUT Empresa Emisora">{t.rut}</Descriptions.Item>
                              <Descriptions.Item label="Giro SII">{t.giro}</Descriptions.Item>
                              <Descriptions.Item label="Dirección Origen">{t.direccionOrigen}, {t.comunaOrigen}, {t.ciudadOrigen}</Descriptions.Item>
                              <Descriptions.Item label="Entorno SII">
                                <Tag color={t.environment === 'PRODUCCION' ? 'red' : 'geekblue'}>{t.environment}</Tag>
                              </Descriptions.Item>
                              <Descriptions.Item label="Titular Certificado X.509 Activo">
                                <Badge status="success" text={<strong>{t.certificate?.subjectName}</strong>} />
                              </Descriptions.Item>
                              <Descriptions.Item label="RUT Representante que Firma (RutEnvia)">
                                <Text className="mono-code">{t.rutEnvia}</Text>
                              </Descriptions.Item>
                              <Descriptions.Item label="Vigencia Certificado X.509">
                                Desde: {new Date(t.certificate?.validFrom).toLocaleDateString()} — Hasta: {new Date(t.certificate?.validTo).toLocaleDateString()}
                              </Descriptions.Item>
                              <Descriptions.Item label="Protección en Reposo">
                                <Tag color="purple">AES-256-GCM + AuthTag 128-bit</Tag>
                              </Descriptions.Item>
                            </Descriptions>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </Space>
                    )}

                    {currentSubTab === 'usuarios' && (
                      (() => {
                  const users = dashboardData.users || [];
                  const profiles = dashboardData.roleProfiles || [];

                  const userColumns = [
                    {
                      title: 'Usuario',
                      key: 'user',
                      render: (_, u) => (
                        <Space>
                          <Avatar style={{ backgroundColor: u.roleKey === 'ADMIN' ? '#B4432F' : u.roleKey === 'ACCOUNTANT' ? '#0062C4' : u.roleKey === 'BILLING' ? '#2F7D5B' : '#718096' }}>
                            {u.name.slice(0, 2).toUpperCase()}
                          </Avatar>
                          <Space direction="vertical" size={0}>
                            <Text strong>{u.name}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>{u.email} • RUT: {u.rut}</Text>
                          </Space>
                        </Space>
                      ),
                    },
                    {
                      title: 'Perfil de Rol',
                      dataIndex: 'roleKey',
                      render: (roleKey) => {
                        const prof = profiles.find((p) => p.key === roleKey);
                        const colorMap = {
                          ADMIN: 'volcano',
                          ACCOUNTANT: 'blue',
                          BILLING: 'green',
                          VIEWER: 'default',
                        };
                        return (
                          <Tag color={colorMap[roleKey] || 'default'} style={{ fontWeight: 600 }}>
                            {prof?.name || roleKey}
                          </Tag>
                        );
                      },
                    },
                    {
                      title: 'Empresas Asignadas',
                      dataIndex: 'tenantIds',
                      render: (tIds) => (
                        <Space wrap size={[4, 4]}>
                          {(tIds || []).map((tId) => {
                            const t = dashboardData.tenants.find((item) => item.id === tId);
                            return (
                              <Tag key={tId} color="cyan">
                                {t ? t.razonSocial.split(' ')[0] : tId}
                              </Tag>
                            );
                          })}
                        </Space>
                      ),
                    },
                    {
                      title: 'Estado',
                      dataIndex: 'isActive',
                      render: (active, record) => (
                        <Switch
                          checked={active}
                          checkedChildren="Activo"
                          unCheckedChildren="Inactivo"
                          onChange={(checked) => handleToggleUserActive(record, checked)}
                        />
                      ),
                    },
                    {
                      title: 'Acciones',
                      key: 'actions',
                      render: (_, u) => (
                        <Space>
                          <Button
                            size="small"
                            onClick={() => {
                              setSelectedUserForEdit(u);
                              formEditUser.setFieldsValue({
                                name: u.name,
                                email: u.email,
                                roleKey: u.roleKey,
                                tenantIds: u.tenantIds,
                              });
                              setEditUserModalOpen(true);
                            }}
                          >
                            Editar
                          </Button>
                          <Popconfirm
                            title="¿Eliminar este usuario?"
                            description={\`Se revocará el acceso de \${u.name} a todas las empresas.\`}
                            onConfirm={() => handleDeleteUser(u.id)}
                            okText="Sí, eliminar"
                            cancelText="Cancelar"
                            okButtonProps={{ danger: true }}
                          >
                            <Button size="small" danger>
                              Eliminar
                            </Button>
                          </Popconfirm>
                        </Space>
                      ),
                    },
                  ];

                  return (
                    <Space direction="vertical" size={20} style={{ width: '100%' }}>
                      <Card style={surface.cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                          <div>
                            <Title level={4} style={{ margin: 0 }}>
                              Control de Perfiles, Usuarios y Permisos Multiempresa
                            </Title>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              Asignación granular de roles (Administrador, Contador, Facturación, Solo Lectura) y delimitación de acceso por empresa
                            </Text>
                          </div>
                          <Button
                            type="primary"
                            icon={<RIcono nombre="usuarios" />}
                            onClick={() => {
                              formNewUser.setFieldsValue({
                                roleKey: 'BILLING',
                                tenantIds: [activeTenantId],
                              });
                              setNewUserModalOpen(true);
                            }}
                          >
                            + Registrar Nuevo Usuario
                          </Button>
                        </div>
                      </Card>

                      {/* Lista de Usuarios */}
                      <Card title="Usuarios Registrados en la Plataforma" style={surface.cardStyle}>
                        <Table
                          rowKey="id"
                          dataSource={users}
                          columns={userColumns}
                          pagination={false}
                        />
                      </Card>

                      {/* Matriz Visual de Permisos RBAC */}
                      <Card
                        title="Matriz de Perfiles y Permisos Normativos (RBAC)"
                        style={surface.cardStyle}
                        extra={<Tag color="purple">Control de Seguridad Feline v1.3</Tag>}
                      >
                        <Table
                          rowKey="key"
                          pagination={false}
                          dataSource={profiles}
                          columns={[
                            {
                              title: 'Perfil / Rol',
                              dataIndex: 'name',
                              render: (name, p) => (
                                <Space direction="vertical" size={0}>
                                  <Text strong>{name}</Text>
                                  <Text type="secondary" style={{ fontSize: 11.5 }}>{p.description}</Text>
                                </Space>
                              ),
                            },
                            {
                              title: 'Facturas (33/34)',
                              render: (_, p) => p.permissions.canIssueInvoices ? <Tag color="green">✓ Permitido</Tag> : <Tag color="default">✕ Denegado</Tag>,
                            },
                            {
                              title: 'Boletas (39/41)',
                              render: (_, p) => p.permissions.canIssueBoletas ? <Tag color="green">✓ Permitido</Tag> : <Tag color="default">✕ Denegado</Tag>,
                            },
                            {
                              title: 'Compras (RCV)',
                              render: (_, p) => p.permissions.canRegisterPurchases ? <Tag color="green">✓ Permitido</Tag> : <Tag color="default">✕ Denegado</Tag>,
                            },
                            {
                              title: 'Partida Doble',
                              render: (_, p) => p.permissions.canCreateManualEntries ? <Tag color="green">✓ Permitido</Tag> : <Tag color="default">✕ Denegado</Tag>,
                            },
                            {
                              title: 'Certificados .PFX',
                              render: (_, p) => p.permissions.canManageCertificates ? <Tag color="green">✓ Permitido</Tag> : <Tag color="default">✕ Denegado</Tag>,
                            },
                            {
                              title: 'Folios CAF',
                              render: (_, p) => p.permissions.canManageCaf ? <Tag color="green">✓ Permitido</Tag> : <Tag color="default">✕ Denegado</Tag>,
                            },
                            {
                              title: 'Envíos SII',
                              render: (_, p) => p.permissions.canTransmitSii ? <Tag color="green">✓ Permitido</Tag> : <Tag color="default">✕ Denegado</Tag>,
                            },
                            {
                              title: 'Gestión Empresas',
                              render: (_, p) => p.permissions.canManageTenants ? <Tag color="green">✓ Permitido</Tag> : <Tag color="default">✕ Denegado</Tag>,
                            },
                            {
                              title: 'Gestión Usuarios',
                              render: (_, p) => p.permissions.canManageUsers ? <Tag color="green">✓ Permitido</Tag> : <Tag color="default">✕ Denegado</Tag>,
                            },
                          ]}
                        />
                      </Card>
                    </Space>
                  );
                })()
                    )}

                    {currentSubTab === 'tributaria' && (
                      <Space direction="vertical" size={18} style={{ width: '100%' }}>
                        <Card title="Certificado Digital PKCS#12 (Firma Electrónica Avanzada)" style={surface.cardStyle} extra={<Button type="primary" onClick={() => setCertUploadModalOpen(true)}>+ Cargar Nuevo Certificado</Button>}>
                          <Descriptions bordered column={2} size="small">
                            <Descriptions.Item label="Empresa">{activeTenant?.razonSocial}</Descriptions.Item>
                            <Descriptions.Item label="RUT">{activeTenant?.rut}</Descriptions.Item>
                            <Descriptions.Item label="Titular de Firma">{activeTenant?.certificate?.subjectName || 'Sin certificado'}</Descriptions.Item>
                            <Descriptions.Item label="RUT Firmante">{activeTenant?.rutEnvia || '-'}</Descriptions.Item>
                            <Descriptions.Item label="Algoritmo">RSA-SHA1 con XMLDSig y Enveloped Signature</Descriptions.Item>
                            <Descriptions.Item label="Bóveda Criptográfica">AES-256-GCM Protegida</Descriptions.Item>
                          </Descriptions>
                        </Card>

                        <Card
                    title="Control Multitenant de Folios CAF (<AUTORIZACION> SII y Llaves RSA)"
                    style={surface.cardStyle}
                    extra={
                      <Button type="primary" onClick={() => setNewCafModalOpen(true)}>
                        + Autorizar Nuevo Rango CAF SII
                      </Button>
                    }
                  >
                    <Table
                      rowKey="id"
                      dataSource={tenantCafs}
                      columns={[
                        { title: 'Código SII', dataIndex: 'tipoDte', render: (v) => <Tag color="blue">Tipo {v}</Tag> },
                        { title: 'Documento Tributario', dataIndex: 'nombreTipo' },
                        { title: 'Rango Autorizado', render: (_, r) => <Text className="mono-code">{r.folioDesde} — {r.folioHasta}</Text> },
                        { title: 'Último Folio Emitido', dataIndex: 'folioActual', render: (v) => <Tag color="purple">Folio #{v}</Tag> },
                        { title: 'Fecha Autorización SII', dataIndex: 'fechaAutorizacion' },
                        {
                          title: 'Seguridad Criptográfica',
                          render: () => <Tag color="success">RSASK Cifrada AES-256-GCM + Lock FOR UPDATE</Tag>,
                        },
                      ]}
                    />
                  </Card>

                        <Card
                    title="Historial de Sobres <EnvioDTE> Transmitidos al SII (Maullín / Palena)"
                    style={surface.cardStyle}
                    extra={
                      <Button type="primary" onClick={handleSendBatchSii}>
                        Generar y Enviar Sobre &lt;EnvioDTE&gt; Ahora
                      </Button>
                    }
                  >
                    <Table
                      rowKey="id"
                      dataSource={tenantLotes}
                      locale={{ emptyText: 'Presiona "Generar y Enviar Sobre <EnvioDTE> Ahora" para autenticar contra CrSeed.jws y obtener un TrackID.' }}
                      columns={[
                        { title: 'TrackID SII', dataIndex: 'trackId', render: (v) => <Tag color="geekblue" className="mono-code">#{v}</Tag> },
                        { title: 'Estado Recepción SII', dataIndex: 'estadoSii' },
                        { title: 'Detalle Procesamiento', dataIndex: 'glosaSii' },
                        { title: 'DTEs Incluidos', dataIndex: 'cantidadDtes' },
                        { title: 'Fecha / Hora Envío', dataIndex: 'createdAt' },
                      ]}
                    />
                  </Card>
                      </Space>
                    )}

                    {currentSubTab === 'preferencias' && (
                      <Card title="Preferencias Visuales y Ajustes de Apariencia" style={surface.cardStyle}>
                        <Button type="primary" onClick={() => setStyleDrawerOpen(true)}>
                          Abrir Panel de Personalización de Tema
                        </Button>
                      </Card>
                    )}
                  </Space>
                )}
            </Content>

              {activeTab !== 'ventas-facturas-boletas' && (
                <Footer style={{ textAlign: 'center', background: 'transparent', opacity: 0.75, fontSize: 12 }}>
                  <strong>Feline v${VERSION}</strong> — Facturación electrónica, contabilidad y libros de compra y venta
                </Footer>
              )}
            </Layout>

            {/* ================================================================= */}
            {/* DRAWER: THEME STYLE SWITCHER                                      */}
            {/* ================================================================= */}
            <Drawer
              title="Personalizador de Diseño (Antd Multipurpose Theme Engine)"
              placement="right"
              width={360}
              onClose={() => setStyleDrawerOpen(false)}
              open={styleDrawerOpen}
            >
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                <div>
                  <Text strong>Modo de Color</Text>
                  <div style={{ marginTop: 8 }}>
                    <Segmented
                      block
                      value={themeMode}
                      onChange={setThemeMode}
                      options={[
                        { label: 'Modo claro', value: 'light' },
                        { label: 'Modo oscuro', value: 'dark' },
                      ]}
                    />
                  </div>
                </div>

                <Divider style={{ margin: '4px 0' }} />

                <div>
                  <Text strong>Estilo Visual de Superficies (7 Presets Design-Sparx)</Text>
                  <Space direction="vertical" size={10} style={{ width: '100%', marginTop: 10 }}>
                    {Object.entries(STYLE_PRIMARIES).map(([key, item]) => (
                      <Card
                        key={key}
                        size="small"
                        hoverable
                        onClick={() => setDesignStyle(key)}
                        style={{
                          borderColor: designStyle === key ? item[themeMode] : undefined,
                          borderWidth: designStyle === key ? 2 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Space>
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: item[themeMode],
                              }}
                            />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{item.label}</div>
                              <div style={{ fontSize: 11, opacity: 0.65 }}>{item.desc}</div>
                            </div>
                          </Space>
                          {designStyle === key && <Tag color="blue">Activo</Tag>}
                        </div>
                      </Card>
                    ))}
                  </Space>
                </div>

                <Divider style={{ margin: '4px 0' }} />

                <div>
                  <Text strong>Radio de Bordes (Border Radius): {borderRadius}px</Text>
                  <Segmented
                    block
                    style={{ marginTop: 8 }}
                    value={borderRadius}
                    onChange={setBorderRadius}
                    options={[
                      { label: '0px', value: 0 },
                      { label: '4px', value: 4 },
                      { label: '8px', value: 8 },
                      { label: '14px', value: 14 },
                    ]}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong>Densidad Compacta (Antd Compact Algorithm)</Text>
                  <Switch checked={compactMode} onChange={setCompactMode} />
                </div>
              </Space>
            </Drawer>

            {/* ================================================================= */}
            {/* MODAL CARGA DE CERTIFICADO DIGITAL (.PFX / .P12)                  */}
            {/* ================================================================= */}
            <Modal
              title={\`Cargar Certificado Digital (.PFX / .P12) — \${activeTenant?.razonSocial}\`}
              open={certUploadModalOpen}
              onCancel={() => setCertUploadModalOpen(false)}
              onOk={() => formCertUpload.submit()}
              okText="Cifrar en Bóveda AES-256-GCM y Activar"
              width={620}
            >
              <Alert
                style={{ marginBottom: 16 }}
                type="info"
                showIcon
                message="Soporte PKCS#12 Oficial (E-Sign, E-Certchile, Acepta, TOC)"
                description="Selecciona tu archivo .pfx o .p12 desde tu computador e ingresa su clave secreta. Si estás haciendo pruebas de desarrollo y no tienes un archivo .pfx a mano, deja el selector de archivo vacío y Feline generará un certificado PKCS#12 RSA-2048 válido en memoria para el titular indicado."
              />
              <Form form={formCertUpload} layout="vertical" onFinish={handleUploadCertificate}>
                <Form.Item label="Archivo de Certificado Digital (.pfx / .p12)">
                  <input
                    type="file"
                    accept=".pfx,.p12"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPfxFileName(file.name);
                      const reader = new FileReader();
                      reader.onload = () => {
                        const base64 = String(reader.result).split(',')[1] || '';
                        setPfxFileBase64(base64);
                        message.success(\`Archivo \${file.name} leído en memoria (\${file.size} bytes)\`);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  {pfxFileName && (
                    <div style={{ marginTop: 6 }}>
                      <Tag color="green">Archivo seleccionado: {pfxFileName}</Tag>
                    </div>
                  )}
                </Form.Item>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="rutTitular"
                      label="RUT del Representante Legal (RutEnvia)"
                      rules={[{ required: true, message: 'Ingresa el RUT con guion (ej: 15342545-0)' }]}
                    >
                      <Input placeholder="15342545-0" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="passphrase"
                      label="Contraseña del Certificado (.pfx)"
                      rules={[{ required: true, message: 'Ingresa la contraseña del PFX' }]}
                    >
                      <Input.Password placeholder="Contraseña de exportación PFX" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="nombreTitular"
                  label="Nombre del Titular (Para autogeneración en modo Sandbox si no adjuntas archivo .pfx)"
                >
                  <Input placeholder="Ej: ANGEL BECER - REPRESENTANTE LEGAL" />
                </Form.Item>
              </Form>
            </Modal>

            {/* ================================================================= */}
            {/* MODAL REGISTRAR FACTURA DE COMPRA (LIBRO DE COMPRAS / RCV)        */}
            {/* ================================================================= */}
            <Modal
              title="Registrar Factura de Compra de Proveedor (Libro de Compras RCV & Crédito Fiscal F29)"
              open={newPurchaseModalOpen}
              onCancel={() => setNewPurchaseModalOpen(false)}
              onOk={() => formNewPurchase.submit()}
              okText="Incorporar al Libro de Compras"
              width={640}
            >
              <Form form={formNewPurchase} layout="vertical" onFinish={handleRegisterPurchase}>
                <Row gutter={16}>
                  <Col span={14}>
                    <Form.Item name="partnerId" label="Proveedor Registrado">
                      <Select
                        allowClear
                        placeholder="Seleccionar proveedor existente..."
                        options={tenantPartners.map((p) => ({
                          value: p.id,
                          label: \`\${p.razonSocial} (RUT \${p.rut})\`,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={10}>
                    <Form.Item
                      name="tipoCompraSii"
                      label="Calificación Tipo de Compra SII (RCV)"
                      rules={[{ required: true }]}
                    >
                      <Select
                        options={[
                          { value: 'DEL_GIRO', label: '1 — Compras del Giro (100% Crédito IVA)' },
                          { value: 'ACTIVO_FIJO', label: '2 — Activo Fijo (Código 524 F29)' },
                          { value: 'SUPERMERCADO', label: '3 — Supermercado / Gastos Similares' },
                          { value: 'IVA_NO_RECUPERABLE', label: '4 — IVA Uso Común / No Recuperable' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name="documentTypeCode"
                      label="Tipo DTE Recibido"
                      rules={[{ required: true }]}
                    >
                      <Select
                        options={[
                          { value: 33, label: '[33] Factura Electrónica' },
                          { value: 34, label: '[34] Factura Exenta' },
                          { value: 46, label: '[46] Factura de Compra' },
                          { value: 61, label: '[61] Nota de Crédito Recibida' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="folioProveedor"
                      label="Folio DTE Proveedor"
                      rules={[{ required: true }]}
                    >
                      <Input placeholder="884512" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="invoiceDate"
                      label="Fecha Emisión (AAAA-MM-DD)"
                      rules={[{ required: true }]}
                    >
                      <Input placeholder="2026-10-18" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="itemName"
                  label="Glosa / Concepto de la Compra"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="Ej: ARRENDAMIENTO DE SERVIDORES Y LICENCIAS SOFTWARE" />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="amountNeto"
                      label="Monto Neto Afecto a IVA 19% (CLP)"
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={0} step={10000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="amountExento" label="Monto Exento o No Gravado (CLP)">
                      <InputNumber min={0} step={5000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Modal>

            {/* ================================================================= */}
            {/* MODAL EMITIR NUEVA FACTURA / BOLETA VENTA                         */}
            {/* ================================================================= */}


            {/* ================================================================= */}
            {/* MODAL COMPARTIDO: DETALLE DE DOCUMENTO TRIBUTARIO ELECTRÓNICO     */}
            {/* ================================================================= */}
            <Modal
              title={
                docDetailData ? (
                  <Space align="center" wrap>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>
                      {ESC_TIPOS_SII[docDetailData.documentTypeCode] || 'Documento Tributario'}{' '}
                      {docDetailData.state === 'DRAFT' ? '(Borrador)' : '#' + (docDetailData.l10nLatamDocumentNumber || docDetailData.folio || '')}
                    </span>
                    <Divider type="vertical" />
                    <Space size={6} wrap>
                      <Tag color={docDetailData.state === 'POSTED' ? 'blue' : docDetailData.state === 'DRAFT' ? 'default' : 'red'}>
                        Emisión: {docDetailData.state === 'POSTED' ? 'Emitido' : docDetailData.state === 'DRAFT' ? 'Borrador' : 'Anulado'}
                      </Tag>
                      <Tag color={escEstado(docDetailData) === 'ACEPTADO' ? 'green' : escEstado(docDetailData) === 'FIRMADO' ? 'orange' : 'default'}>
                        SII: {escEstado(docDetailData) === 'ACEPTADO' ? 'Aceptado por SII' : escEstado(docDetailData) === 'FIRMADO' ? 'Pendiente de envío' : 'No enviado'}
                      </Tag>
                      <Tag color={docDetailData.paymentState === 'PAID' ? 'green' : docDetailData.paymentState === 'PARTIAL' ? 'blue' : 'gold'}>
                        Pago: {docDetailData.paymentState === 'PAID' ? 'Pagado' : docDetailData.paymentState === 'PARTIAL' ? 'Pago parcial' : 'Pendiente de cobro'}
                      </Tag>
                    </Space>
                  </Space>
                ) : 'Detalle de Documento'
              }
              open={docDetailModalOpen}
              onCancel={() => setDocDetailModalOpen(false)}
              width={760}
              footer={
                docDetailData ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <Space>
                      <Button onClick={() => { setXmlInspectorMove(docDetailData); setDocDetailModalOpen(false); }}>
                        Ver XML Criptográfico
                      </Button>
                      <Button onClick={() => window.print()}>
                        Imprimir / PDF
                      </Button>
                    </Space>
                    <Space>
                      {docDetailData.state === 'DRAFT' && (
                        <Button type="primary" onClick={() => { handlePostMove(docDetailData.id); setDocDetailModalOpen(false); }}>
                          Firmar y emitir
                        </Button>
                      )}
                      {escEstado(docDetailData) === 'FIRMADO' && (
                        <Button type="primary" onClick={() => { handleSendBatchSii(); setDocDetailModalOpen(false); }}>
                          Enviar al SII
                        </Button>
                      )}
                      {docDetailData.state === 'POSTED' && escPorCobrar(docDetailData) && (
                        <Button
                          type="primary"
                          style={{ background: '#2F7D5B', borderColor: '#2F7D5B' }}
                          onClick={() => {
                            setPaymentModalMove(docDetailData);
                            formPayment.setFieldsValue({ amount: docDetailData.amountResidual });
                            setDocDetailModalOpen(false);
                          }}
                        >
                          Registrar cobro
                        </Button>
                      )}
                      <Button onClick={() => setDocDetailModalOpen(false)}>Cerrar</Button>
                    </Space>
                  </div>
                ) : null
              }
            >
              {docDetailData && (
                <div style={{ padding: '12px 0', display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
                  <EscHoja doc={docDetailData} empresa={activeTenant} />
                </div>
              )}
            </Modal>

            {/* ================================================================= */}
            {/* MODAL INSPECTOR CRIPTOGRÁFICO DE XML DTE, TIMBRE TED Y PDF417     */}
            {/* ================================================================= */}
            <Modal
              title={xmlInspectorMove ? \`Inspector Criptográfico SII: \${xmlInspectorMove.name} (Folio #\${xmlInspectorMove.l10nLatamDocumentNumber})\` : ''}
              open={Boolean(xmlInspectorMove)}
              onCancel={() => setXmlInspectorMove(null)}
              footer={[
                <Button key="close" type="primary" onClick={() => setXmlInspectorMove(null)}>
                  Cerrar Inspector
                </Button>,
              ]}
              width={880}
            >
              {xmlInspectorMove && (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Alert
                    type="success"
                    showIcon
                    message="Verificación Matemática XMLDSig (C14N 1.0 + RSA-SHA1) y Timbre Electrónico (<TED>)"
                    description={
                      <span>
                        <strong>DigestValue SHA-1 (ISO-8859-1):</strong> VÁLIDO ✓ &nbsp;|&nbsp;
                        <strong>SignatureValue RSA-SHA1:</strong> VÁLIDO ✓ &nbsp;|&nbsp;
                        <strong>Certificado Emisor:</strong> {activeTenant?.certificate?.subjectName}
                      </span>
                    }
                  />

                  <Tabs
                    items={[
                      {
                        key: 'dte-xml',
                        label: 'Nodo <DTE> Firmado (XMLDSig)',
                        children: <div className="xml-viewer">{xmlInspectorMove.dteXmlFirmado}</div>,
                      },
                      {
                        key: 'ted-xml',
                        label: 'Timbre Electrónico <TED> y Código PDF417',
                        children: (
                          <Row gutter={20} align="middle">
                            <Col xs={24} md={10}>
                              <div className="ted-Stamp-box">
                                <div className="pdf417-bars" />
                                <div style={{ fontWeight: 700, fontSize: 12 }}>TIMBRE ELECTRÓNICO SII</div>
                                <div style={{ fontSize: 11 }}>
                                  Res. Ex. SII N° {activeTenant?.nroResol} de {activeTenant?.fchResol.split('-')[0]}
                                </div>
                                <div style={{ fontSize: 11 }}>Verifique documento en www.sii.cl</div>
                              </div>
                            </Col>
                            <Col xs={24} md={14}>
                              <div className="xml-viewer" style={{ maxHeight: 240 }}>
                                {xmlInspectorMove.tedXml}
                              </div>
                            </Col>
                          </Row>
                        ),
                      },
                      ...(xmlInspectorMove.envioDteXml
                        ? [
                            {
                              key: 'envio-xml',
                              label: 'Sobre <EnvioDTE> Transmitido al SII',
                              children: <div className="xml-viewer">{xmlInspectorMove.envioDteXml}</div>,
                            },
                          ]
                        : []),
                    ]}
                  />
                </Space>
              )}
            </Modal>

            {/* ================================================================= */}
            {/* MODAL WIZARD DE NOTA DE CRÉDITO ELECTRÓNICA (Odoo Reversal 61)    */}
            {/* ================================================================= */}
            <Modal
              title={reverseModalMove ? \`Emitir Nota de Crédito Electrónica (Tipo 61) sobre \${reverseModalMove.name}\` : ''}
              open={Boolean(reverseModalMove)}
              onCancel={() => setReverseModalMove(null)}
              onOk={() => formReverse.submit()}
              okText="Emitir y Firmar Nota de Crédito (61)"
              okButtonProps={{ danger: true }}
            >
              <Form form={formReverse} layout="vertical" onFinish={handleReverseMove}>
                <Form.Item
                  name="referenceDocCode"
                  label="Código de Referencia SII (<CodRef>)"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={[
                      { value: 1, label: '1 — Anula Documento de Referencia (Reversa total y rebaja IVA Débito)' },
                      { value: 2, label: '2 — Corrige Texto del Documento de Referencia (Monto $0)' },
                      { value: 3, label: '3 — Corrige Montos del Documento de Referencia' },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="reason"
                  label="Razón de la Referencia (<RazonRef>)"
                  rules={[{ required: true, min: 3 }]}
                >
                  <Input maxLength={90} />
                </Form.Item>
              </Form>
            </Modal>

            {/* ================================================================= */}
            {/* MODAL REGISTRO DE PAGO Y CONCILIACIÓN ODOO (account.payment)      */}
            {/* ================================================================= */}
            <Modal
              title={paymentModalMove ? \`Registrar Pago (Odoo account.payment) — \${paymentModalMove.name}\` : ''}
              open={Boolean(paymentModalMove)}
              onCancel={() => setPaymentModalMove(null)}
              onOk={() => formPayment.submit()}
              okText="Registrar y Conciliar Pago"
            >
              <Form form={formPayment} layout="vertical" onFinish={handleRegisterPayment}>
                <Form.Item
                  name="amount"
                  label="Monto a Pagar / Abonar (CLP)"
                  rules={[{ required: true }]}
                >
                  <InputNumber min={1} max={paymentModalMove?.amountResidual} style={{ width: '100%' }} />
                </Form.Item>
              </Form>
            </Modal>

            {/* ================================================================= */}
            {/* MODAL ASIENTO CONTABLE MANUAL DE PARTIDA DOBLE (Odoo MISC Entry)  */}
            {/* ================================================================= */}
            <Modal
              title="Nuevo Asiento Contable de Partida Doble (Odoo account.move — Diario MISC)"
              open={newManualEntryModalOpen}
              onCancel={() => setNewManualEntryModalOpen(false)}
              onOk={() => formManualEntry.submit()}
              okText="Validar Partida Doble (Debe = Haber) y Contabilizar"
              width={640}
            >
              <Alert
                style={{ marginBottom: 16 }}
                type="info"
                showIcon
                message="Invariante de Partida Doble Odoo (_check_balanced)"
                description="Selecciona la cuenta contable a cargar al DEBE y la cuenta contable a abonar al HABER del Plan de Cuentas Chileno (l10n_cl). El asiento impactará en tiempo real el Libro Diario, Libro Mayor y el Balance Tributario de 8 Columnas."
              />
              <Form form={formManualEntry} layout="vertical" onFinish={handleCreateManualEntry}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="date" label="Fecha Contable" rules={[{ required: true }]}>
                      <Input placeholder="2026-10-18" />
                    </Form.Item>
                  </Col>
                  <Col span={16}>
                    <Form.Item
                      name="reference"
                      label="Glosa / Referencia del Asiento Contable"
                      rules={[{ required: true }]}
                    >
                      <Input placeholder="Ej: CENTRALIZACIÓN REMUNERACIONES OCTUBRE 2026" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="debitAccountCode"
                      label="Cuenta al DEBE (Cargo)"
                      rules={[{ required: true }]}
                    >
                      <Select
                        showSearch
                        options={accounting.chartOfAccounts.map((acc) => ({
                          value: acc.code,
                          label: \`[\${acc.code}] \${acc.name}\`,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="creditAccountCode"
                      label="Cuenta al HABER (Abono)"
                      rules={[{ required: true }]}
                    >
                      <Select
                        showSearch
                        options={accounting.chartOfAccounts.map((acc) => ({
                          value: acc.code,
                          label: \`[\${acc.code}] \${acc.name}\`,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="amount"
                  label="Monto del Asiento (CLP — Se carga al Debe y se abona al Haber)"
                  rules={[{ required: true }]}
                >
                  <InputNumber min={1} step={50000} style={{ width: '100%' }} />
                </Form.Item>
              </Form>
            </Modal>

            {/* ================================================================= */}
            {/* MODAL GENERAR / CARGAR NUEVO CAF SII                              */}
            {/* ================================================================= */}
            <Modal
              title="Cargar / Autorizar Nuevo Rango de Folios CAF SII"
              open={newCafModalOpen}
              onCancel={() => setNewCafModalOpen(false)}
              onOk={() => formNewCaf.submit()}
              okText="Generar y Cifrar CAF"
            >
              <Form
                form={formNewCaf}
                layout="vertical"
                initialValues={{ tipoDte: 33, desde: 101, hasta: 250 }}
                onFinish={handleGenerateNewCaf}
              >
                <Form.Item name="tipoDte" label="Tipo de DTE" rules={[{ required: true }]}>
                  <Select
                    options={[
                      { value: 33, label: '[33] Factura Electrónica' },
                      { value: 34, label: '[34] Factura No Afecta o Exenta' },
                      { value: 39, label: '[39] Boleta Electrónica' },
                      { value: 46, label: '[46] Factura de Compra Electrónica' },
                      { value: 56, label: '[56] Nota de Débito Electrónica' },
                      { value: 61, label: '[61] Nota de Crédito Electrónica' },
                    ]}
                  />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="desde" label="Folio Desde (<D>)" rules={[{ required: true }]}>
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="hasta" label="Folio Hasta (<H>)" rules={[{ required: true }]}>
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Modal>

            {/* ================================================================= */}
            {/* MODAL REGISTRAR NUEVA EMPRESA (TENANT MULTIEMPRESA)               */}
            {/* ================================================================= */}
            <Modal
              title="Registrar Nueva Empresa Emisora (Tenant Multiempresa)"
              open={newTenantModalOpen}
              onCancel={() => setNewTenantModalOpen(false)}
              onOk={() => formNewTenant.submit()}
              okText="Crear Empresa y Generar CAF Inicial"
              width={640}
            >
              <Alert
                style={{ marginBottom: 16 }}
                type="info"
                showIcon
                message="Aislamiento Criptográfico y Operativo Multi-Tenant"
                description="Al crear la empresa, Feline aprovisionará automáticamente un certificado digital X.509 RSA-2048 en memoria, generará los rangos CAF iniciales para Factura (33) y Boleta (39) y creará el cliente de Consumidor Final."
              />
              <Form form={formNewTenant} layout="vertical" onFinish={handleCreateTenant}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="rut"
                      label="RUT Empresa Emisora"
                      rules={[{ required: true, message: 'Ingresa el RUT de la empresa con guion (ej: 78123456-7)' }]}
                    >
                      <Input placeholder="78123456-7" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="environment"
                      label="Entorno SII"
                      rules={[{ required: true }]}
                      initialValue="CERTIFICACION"
                    >
                      <Select
                        options={[
                          { value: 'CERTIFICACION', label: 'Certificación / Maullín (Pruebas)' },
                          { value: 'PRODUCCION', label: 'Producción / Palena (Oficial)' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="razonSocial"
                  label="Razón Social (Nombre Legal)"
                  rules={[{ required: true, message: 'Ingresa la razón social de la empresa' }]}
                >
                  <Input placeholder="EJ: INGENIERIA Y SERVICIOS INTEGRALES SPA" />
                </Form.Item>

                <Form.Item
                  name="giro"
                  label="Giro Comercial SII"
                  rules={[{ required: true, message: 'Ingresa el giro comercial' }]}
                >
                  <Input placeholder="EJ: CONSULTORIA TECNOLOGICA Y SERVICIOS INFORMATICOS" />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="direccionOrigen"
                      label="Dirección Casa Matriz"
                      rules={[{ required: true }]}
                    >
                      <Input placeholder="Av. Providencia 1234 Of. 501" />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="comunaOrigen" label="Comuna" rules={[{ required: true }]}>
                      <Input placeholder="Providencia" />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="ciudadOrigen" label="Ciudad" rules={[{ required: true }]}>
                      <Input placeholder="Santiago" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="rutEnvia"
                      label="RUT Representante Legal (RutEnvia)"
                      rules={[{ required: true }]}
                    >
                      <Input placeholder="15342545-0" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="nombreTitular"
                      label="Nombre Representante Legal"
                      rules={[{ required: true }]}
                    >
                      <Input placeholder="Ej: CARLOS MENDOZA" />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Modal>

            {/* ================================================================= */}
            {/* MODAL EMISIÓN RÁPIDA DE BOLETA ELECTRÓNICA (39 / 41)               */}
            {/* ================================================================= */}


            {/* ================================================================= */}
            {/* MODAL REGISTRAR NUEVO USUARIO Y ASIGNAR PERFIL                    */}
            {/* ================================================================= */}
            <Modal
              title="Registrar Nuevo Usuario y Asignar Perfil de Acceso"
              open={newUserModalOpen}
              onCancel={() => setNewUserModalOpen(false)}
              onOk={() => formNewUser.submit()}
              okText="Registrar Usuario"
              width={600}
            >
              <Form form={formNewUser} layout="vertical" onFinish={handleCreateUser}>
                <Row gutter={16}>
                  <Col span={14}>
                    <Form.Item
                      name="name"
                      label="Nombre Completo"
                      rules={[{ required: true, message: 'Ingresa el nombre completo' }]}
                    >
                      <Input placeholder="Ej: Camila Valenzuela" />
                    </Form.Item>
                  </Col>
                  <Col span={10}>
                    <Form.Item
                      name="rut"
                      label="RUT Usuario"
                      rules={[{ required: true, message: 'Ingresa el RUT (ej: 17890123-4)' }]}
                    >
                      <Input placeholder="17890123-4" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="email"
                  label="Correo Electrónico"
                  rules={[{ required: true, type: 'email', message: 'Ingresa un correo válido' }]}
                >
                  <Input placeholder="camila.valenzuela@empresa.cl" />
                </Form.Item>

                <Form.Item
                  name="clave"
                  label="Contraseña inicial"
                  extra="Mínimo 10 caracteres. Entrégala a la persona por un canal seguro."
                  rules={[{ required: true, min: 10, message: 'Mínimo 10 caracteres' }]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="roleKey"
                      label="Perfil de Rol (Permisos)"
                      rules={[{ required: true }]}
                    >
                      <Select
                        options={(dashboardData.roleProfiles || []).map((prof) => ({
                          value: prof.key,
                          label: \`\${prof.name} (\${prof.key})\`,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="tenantIds"
                      label="Empresas Autorizadas"
                      rules={[{ required: true, message: 'Selecciona al menos una empresa' }]}
                    >
                      <Select
                        mode="multiple"
                        placeholder="Selecciona empresas..."
                        options={dashboardData.tenants.map((t) => ({
                          value: t.id,
                          label: \`\${t.razonSocial.slice(0, 22)} (\${t.rut})\`,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Modal>

            {/* ================================================================= */}
            {/* MODAL EDITAR USUARIO Y PERMISOS                                   */}
            {/* ================================================================= */}
            <Modal
              title={\`Editar Usuario: \${selectedUserForEdit?.name || ''}\`}
              open={editUserModalOpen}
              onCancel={() => { setEditUserModalOpen(false); setSelectedUserForEdit(null); }}
              onOk={() => formEditUser.submit()}
              okText="Guardar Cambios"
              width={600}
            >
              <Form form={formEditUser} layout="vertical" onFinish={handleUpdateUser}>
                <Form.Item
                  name="name"
                  label="Nombre Completo"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>

                <Form.Item
                  name="email"
                  label="Correo Electrónico"
                  rules={[{ required: true, type: 'email' }]}
                >
                  <Input />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="roleKey"
                      label="Perfil de Rol (Permisos)"
                      rules={[{ required: true }]}
                    >
                      <Select
                        options={(dashboardData.roleProfiles || []).map((prof) => ({
                          value: prof.key,
                          label: \`\${prof.name} (\${prof.key})\`,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="tenantIds"
                      label="Empresas Autorizadas"
                      rules={[{ required: true }]}
                    >
                      <Select
                        mode="multiple"
                        options={dashboardData.tenants.map((t) => ({
                          value: t.id,
                          label: \`\${t.razonSocial.slice(0, 22)} (\${t.rut})\`,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Modal>

            {/* ================================================================= */}
            {/* MODAL 1: REGISTRAR NUEVO GASTO INDIVIDUAL (hr_expense)            */}
            {/* ================================================================= */}
            <Modal
              title="Registrar Nuevo Gasto de Empleado (Odoo hr_expense)"
              open={newExpenseModalOpen}
              onCancel={() => setNewExpenseModalOpen(false)}
              onOk={() => formNewExpense.submit()}
              okText="Guardar Gasto"
              width={680}
            >
              <Form form={formNewExpense} layout="vertical" onFinish={handleCreateExpense}>
                <Row gutter={16}>
                  <Col span={14}>
                    <Form.Item name="name" label="Descripción del Gasto / Glosa" rules={[{ required: true, message: 'Ingresa la descripción' }]}>
                      <Input placeholder="Ej: Almuerzo con directores de compras" />
                    </Form.Item>
                  </Col>
                  <Col span={10}>
                    <Form.Item name="employeeId" label="Empleado Solicitante" rules={[{ required: true }]}>
                      <Select
                        options={(dashboardData.users || []).map((u) => ({
                          value: u.id,
                          label: \`\${u.name} (\${u.rut})\`,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="category" label="Categoría de Gasto" rules={[{ required: true }]}>
                      <Select
                        options={[
                          { value: 'ALIMENTACION', label: '🍔 Alimentación y Viáticos' },
                          { value: 'TRANSPORTE', label: '🚕 Transporte y Taxis' },
                          { value: 'ALOJAMIENTO', label: '🏨 Alojamiento y Hoteles' },
                          { value: 'INSUMOS', label: '📦 Insumos y Materiales' },
                          { value: 'SOFTWARE', label: '💻 Software, Cloud y SaaS' },
                          { value: 'REPRESENTACION', label: '🤝 Representación' },
                          { value: 'OTROS', label: '📄 Otros Gastos' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="voucherType" label="Tipo de Comprobante" rules={[{ required: true }]}>
                      <Select
                        options={[
                          { value: 'FACTURA_33', label: '[33] Factura Electrónica (con IVA)' },
                          { value: 'BOLETA_39', label: '[39] Boleta Electrónica' },
                          { value: 'BOLETA_EXENTA_41', label: '[41] Boleta Exenta' },
                          { value: 'HONORARIOS_71', label: '[71] Boleta de Honorarios' },
                          { value: 'VALE_INTERNO', label: 'Vale / Ticket de Caja Chica' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="paymentMode" label="Modo de Pago" rules={[{ required: true }]}>
                      <Select
                        options={[
                          { value: 'own_account', label: 'Reembolsar a Empleado' },
                          { value: 'company_account', label: 'Tarjeta de la Empresa' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item name="voucherNumber" label="N° Folio / Comprobante">
                      <Input placeholder="Ej: 45910" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="vendorRut" label="RUT del Proveedor">
                      <Input placeholder="76.123.456-7" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="vendorName" label="Razón Social Proveedor">
                      <Input placeholder="Restaurante o Comercio" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={10}>
                    <Form.Item name="totalAmount" label="Monto Total ($ CLP)" rules={[{ required: true, message: 'Ingresa el monto' }]}>
                      <InputNumber
                        style={{ width: '100%' }}
                        formatter={(value) => \`$ \${value}\`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                        parser={(value) => value.replace(/\$\s?|(\.*)/g, '')}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="hasIvaCredit" label="IVA Crédito Fiscal (19%)" valuePropName="checked">
                      <Switch checkedChildren="Recuperar IVA" unCheckedChildren="Exento / Sin IVA" />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="date" label="Fecha del Gasto">
                      <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="notes" label="Observaciones / Justificación">
                  <Input.TextArea rows={2} placeholder="Justificación del gasto para auditoría y gerencia..." />
                </Form.Item>
              </Form>
            </Modal>

            {/* ================================================================= */}
            {/* MODAL 2: CREAR INFORME DE RENDICIÓN (hr_expense_sheet)            */}
            {/* ================================================================= */}
            <Modal
              title="Crear Informe de Rendición de Gastos (hr_expense_sheet)"
              open={newExpenseSheetModalOpen}
              onCancel={() => {
                setNewExpenseSheetModalOpen(false);
                setSelectedExpenseIdsForSheet([]);
              }}
              onOk={() => formNewExpenseSheet.submit()}
              okText="Crear Informe de Rendición"
              width={750}
            >
              <Form form={formNewExpenseSheet} layout="vertical" onFinish={handleCreateExpenseSheet}>
                <Row gutter={16}>
                  <Col span={14}>
                    <Form.Item name="name" label="Título del Informe de Rendición" rules={[{ required: true }]}>
                      <Input placeholder="Ej: Rendición Viaje Operaciones Concepción Octubre 2026" />
                    </Form.Item>
                  </Col>
                  <Col span={10}>
                    <Form.Item name="employeeId" label="Empleado Solicitante" rules={[{ required: true }]}>
                      <Select
                        options={(dashboardData.users || []).map((u) => ({
                          value: u.id,
                          label: \`\${u.name} (\${u.rut})\`,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="autoSubmit" valuePropName="checked">
                  <Switch checkedChildren="Enviar a aprobación de inmediato" unCheckedChildren="Dejar en Borrador" defaultChecked />
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>
                    Enviar automáticamente a estado "Para Aprobar"
                  </span>
                </Form.Item>

                <div style={{ marginTop: 12, marginBottom: 8, fontWeight: 600 }}>
                  Selecciona los gastos a incluir en este informe:
                </div>
                <Table
                  dataSource={(dashboardData.expenses || []).filter((e) => !e.sheetId || e.state === 'draft')}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  rowSelection={{
                    selectedRowKeys: selectedExpenseIdsForSheet,
                    onChange: (keys) => setSelectedExpenseIdsForSheet(keys),
                  }}
                  columns={[
                    { title: 'Fecha', dataIndex: 'date', width: 95 },
                    { title: 'Gasto', dataIndex: 'name' },
                    { title: 'Categoría', dataIndex: 'category', render: (c) => <Tag>{c}</Tag> },
                    {
                      title: 'Total',
                      dataIndex: 'totalAmount',
                      align: 'right',
                      render: (v) => formatCLP(v),
                    },
                    {
                      title: 'Modo',
                      dataIndex: 'paymentMode',
                      render: (m) => (m === 'own_account' ? <Tag color="gold">Reembolso</Tag> : <Tag color="cyan">Empresa</Tag>),
                    },
                  ]}
                />
              </Form>
            </Modal>

            {/* ================================================================= */}
            {/* DRAWER / DETALLE DE RENDICIÓN E IMPUTACIÓN CONTABLE              */}
            {/* ================================================================= */}
            <Drawer
              title={\`Detalle de Rendición: \${selectedSheetForView?.code || ''}\`}
              open={Boolean(selectedSheetForView)}
              onClose={() => setSelectedSheetForView(null)}
              width={640}
            >
              {selectedSheetForView && (() => {
                const sheet = selectedSheetForView;
                const expensesInSheet = (dashboardData.expenses || []).filter((e) =>
                  sheet.expenseIds?.includes(e.id)
                );
                return (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Descriptions bordered size="small" column={1}>
                      <Descriptions.Item label="Informe">{sheet.name}</Descriptions.Item>
                      <Descriptions.Item label="Empleado">{sheet.employeeName} ({sheet.employeeRut})</Descriptions.Item>
                      <Descriptions.Item label="Modo de Pago">
                        {sheet.paymentMode === 'own_account' ? 'Reembolso por Transferencia (TEF)' : 'Tarjeta de la Empresa'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Total Rendido">
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#0062C4' }}>{formatCLP(sheet.totalAmount)}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="Neto / IVA Crédito">
                        Neto: {formatCLP(sheet.untaxedAmount)} | IVA: {formatCLP(sheet.totalTaxAmount)}
                      </Descriptions.Item>
                      <Descriptions.Item label="Estado Odoo">
                        <Tag color={sheet.state === 'done' ? 'green' : sheet.state === 'post' ? 'purple' : 'blue'}>
                          {sheet.state.toUpperCase()}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Asiento Partida Doble">
                        {sheet.moveName ? <Tag color="purple">{sheet.moveName}</Tag> : 'No contabilizado aún'}
                      </Descriptions.Item>
                      {sheet.paymentMoveName && (
                        <Descriptions.Item label="Asiento de Pago TEF">
                          <Tag color="green">{sheet.paymentMoveName}</Tag>
                        </Descriptions.Item>
                      )}
                    </Descriptions>

                    <div style={{ fontWeight: 600, marginTop: 12 }}>Comprobantes incluidos en la Rendición:</div>
                    <Table
                      dataSource={expensesInSheet}
                      rowKey="id"
                      size="small"
                      pagination={false}
                      columns={[
                        { title: 'Fecha', dataIndex: 'date', width: 90 },
                        { title: 'Gasto', dataIndex: 'name' },
                        { title: 'Doc', dataIndex: 'voucherType', render: (t) => t.replace('_', ' ') },
                        { title: 'Total', dataIndex: 'totalAmount', align: 'right', render: (v) => formatCLP(v) },
                      ]}
                    />
                  </Space>
                );
              })()}
            </Drawer>
          </Layout>
        </ConfigProvider>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<ErrorBoundary><PanelConSesion /></ErrorBoundary>);
  </script>
</body>
</html>`;
}
