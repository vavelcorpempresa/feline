// ============================================================================
// FELINE DASHBOARD UI - BASADO EN DESIGN-SPARX / ANTD-MULTIPURPOSE-DASHBOARD
// Incluye:
// - 7 Estilos Visuales (Clean, Glassmorphic, Neumorphic, Bold, MUI, Shadcn, Serene)
// - Módulo de Libro de Ventas y Compras (RCV SII) + Propuesta F29 Automática
// - Cargador de Certificado Digital (.pfx / .p12) con cifrado AES-256-GCM
// - Emisión, Timbrado <TED>, Firma XMLDSig, Notas de Crédito (61) y Pagos Odoo
// ============================================================================

import { FELINE_LOGO_DATA_URI, FELINE_ISOTIPO_DATA_URI } from './feline-logo';
import { RDS_LOGO_DATA_URI } from './rds-logo';

export function renderFelineAntdDashboardHtml(brand: 'feline' | 'rocas' = 'feline'): string {
  const isRocas = brand === 'rocas';
  const pageTitle = isRocas
    ? 'Rocas del Sur — Facturación electrónica'
    : 'Feline Capital — Facturación electrónica';
  const defaultStyle = isRocas ? 'rocasdelsur' : 'feline';

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
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/dayjs@1.11.10/dayjs.min.js"></script>
  <script src="https://unpkg.com/antd@5.21.4/dist/antd.min.js"></script>
  <script src="https://unpkg.com/@ant-design/icons@5.4.0/dist/index.umd.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
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

    /* ================= Feline Capital & Rocas del Sur ================= */
    .rds-logo {
      display: inline-block;
      flex-shrink: 0;
      background-color: currentColor;
      -webkit-mask: url('${isRocas ? RDS_LOGO_DATA_URI : FELINE_LOGO_DATA_URI}') ${isRocas ? 'center' : 'left center'} / contain no-repeat;
      mask: url('${isRocas ? RDS_LOGO_DATA_URI : FELINE_LOGO_DATA_URI}') ${isRocas ? 'center' : 'left center'} / contain no-repeat;
    }
    .rds-logo.rds-isotipo {
      -webkit-mask-image: url('${isRocas ? RDS_LOGO_DATA_URI : FELINE_ISOTIPO_DATA_URI}');
      mask-image: url('${isRocas ? RDS_LOGO_DATA_URI : FELINE_ISOTIPO_DATA_URI}');
      -webkit-mask-position: center;
      mask-position: center;
    }
    .rds-logo-rocas {
      display: inline-block;
      flex-shrink: 0;
      background-color: currentColor;
      -webkit-mask: url('${RDS_LOGO_DATA_URI}') center / contain no-repeat;
      mask: url('${RDS_LOGO_DATA_URI}') center / contain no-repeat;
    }
    .rds-logo-feline {
      display: inline-block;
      flex-shrink: 0;
      background-color: currentColor;
      -webkit-mask: url('${FELINE_LOGO_DATA_URI}') left center / contain no-repeat;
      mask: url('${FELINE_LOGO_DATA_URI}') left center / contain no-repeat;
    }
    .rds-logo-feline.rds-isotipo {
      -webkit-mask-image: url('${FELINE_ISOTIPO_DATA_URI}');
      mask-image: url('${FELINE_ISOTIPO_DATA_URI}');
      -webkit-mask-position: center;
      mask-position: center;
    }
    .rds-theme { font-family: 'DM Sans', system-ui, sans-serif; }
    .rds-theme h1.ant-typography, .rds-theme h2.ant-typography, .rds-theme h3.ant-typography,
    .rds-theme h4.ant-typography, .rds-theme .ant-card-head-title, .rds-theme .ant-modal-title,
    .rds-theme .ant-drawer-title, .rds-theme .ant-statistic-content, .rds-marca-nombre {
      font-family: 'Outfit', 'DM Sans', sans-serif;
      letter-spacing: -0.01em;
    }
    .rds-theme .ant-card-head-title { font-weight: 500; }
    .rds-theme .ant-statistic-title { font-size: 13.5px; }
    .rds-theme .ant-statistic-content-value { font-weight: 400 !important; letter-spacing: -0.02em; }
    .rds-theme .ant-btn { display: inline-flex; align-items: center; gap: 6px; }
    .rds-theme .ant-menu-item { display: flex; align-items: center; }
    .rds-theme .ant-menu-item > svg + .ant-menu-title-content { margin-inline-start: 12px; }
    .rds-theme .ant-menu-inline-collapsed .ant-menu-item > svg + .ant-menu-title-content { margin-inline-start: 0; }
    .rds-theme .ant-menu-inline-collapsed .ant-menu-item { justify-content: center; }
    .rds-theme .ant-menu-inline-collapsed .ant-menu-item .ant-menu-title-content { display: none; }
    .rds-theme .rds-header-acciones { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; flex-shrink: 0; }
    .rds-theme .rds-header-empresa { display: flex; align-items: center; gap: 10px; min-width: 200px; flex: 1 1 auto; }
    @media (max-width: 1280px) {
      .rds-theme .rds-header-acciones .ant-btn:not(.ant-btn-icon-only):not(.ant-btn-primary) { font-size: 0; gap: 0; padding: 0 10px; }
      .rds-theme .rds-header-empresa > .ant-typography { display: none; }
    }
    .rds-theme .ant-btn-icon-only { justify-content: center; }
    .rds-theme .ant-card-head-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rds-theme .ant-table-thead > tr > th { white-space: nowrap; }
    .rds-theme .ant-card-body { overflow-x: auto; }
    .rds-theme .ant-layout-sider-trigger { background: #00152B !important; color: #C9D8EA !important; border-top: 1px solid rgba(255,255,255,0.08); }
    .rds-claro .ant-layout-sider-trigger { background: #00152B !important; color: #C9D8EA !important; border-top: 1px solid rgba(255,255,255,0.08); }
    .rds-rocas.rds-theme .ant-layout-sider-trigger { background: #1A1613 !important; color: #D8BB96 !important; border-top: 1px solid rgba(255,255,255,0.08); }
    .rds-rocas.rds-claro .ant-layout-sider-trigger { background: #E8DAC6 !important; color: #5C432A !important; border-top: 1px solid #E3D7C7; }
    .rds-claro .ant-alert-success { background: #E3F0E9; border-color: #BFDCCB; }
    .rds-claro .ant-alert-info { background: #E6F0FC; border-color: #B9D4F5; }
    .rds-rocas.rds-claro .ant-alert-info { background: #EFE4D5; border-color: #D8BB96; }
    .rds-claro .ant-alert-warning { background: #F7EBD6; border-color: #E8CFA0; }
    .rds-claro .ant-alert-error { background: #F6E1DC; border-color: #EDC3B9; }
    .rds-claro .ant-alert .ant-alert-message { color: #0B1B2E; }
    .rds-claro .ant-alert .ant-alert-description { color: #4A5B70; }
    .rds-rocas.rds-claro .ant-alert .ant-alert-message { color: #1F1B17; }
    .rds-rocas.rds-claro .ant-alert .ant-alert-description { color: #4F453C; }
    .rds-theme:not(.rds-claro) .ant-tag-blue, .rds-theme:not(.rds-claro) .ant-tag-geekblue, .rds-theme:not(.rds-claro) .ant-tag-purple,
    .rds-theme:not(.rds-claro) .ant-tag-processing, .rds-theme:not(.rds-claro) .ant-tag-cyan {
      color: #7DB6F5; background: rgba(0,115,230,0.16); border-color: rgba(125,182,245,0.35);
    }
    .rds-rocas.rds-theme:not(.rds-claro) .ant-tag-blue, .rds-rocas.rds-theme:not(.rds-claro) .ant-tag-geekblue, .rds-rocas.rds-theme:not(.rds-claro) .ant-tag-purple,
    .rds-rocas.rds-theme:not(.rds-claro) .ant-tag-processing, .rds-rocas.rds-theme:not(.rds-claro) .ant-tag-cyan {
      color: #D8BB96; background: rgba(216,187,150,0.12); border-color: rgba(216,187,150,0.35);
    }
    .rds-theme:not(.rds-claro) .ant-tag-green, .rds-theme:not(.rds-claro) .ant-tag-success { color: #8FCBAE; background: rgba(47,125,91,0.18); border-color: rgba(143,203,174,0.35); }
    .rds-theme:not(.rds-claro) .ant-tag-orange, .rds-theme:not(.rds-claro) .ant-tag-gold, .rds-theme:not(.rds-claro) .ant-tag-warning { color: #E6BE7A; background: rgba(183,121,31,0.18); border-color: rgba(230,190,122,0.35); }
    .rds-theme:not(.rds-claro) .ant-tag-red, .rds-theme:not(.rds-claro) .ant-tag-error, .rds-theme:not(.rds-claro) .ant-tag-volcano { color: #E79A8A; background: rgba(180,67,47,0.2); border-color: rgba(231,154,138,0.35); }
    .rds-theme:not(.rds-claro) .ant-alert-success { background: rgba(47,125,91,0.16); border-color: rgba(143,203,174,0.3); }
    .rds-theme .ant-menu-item-group-title { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; }
    .rds-theme .ant-tag { border-radius: 999px; padding-inline: 10px; }
    .rds-theme .ant-segmented-item-label { display: flex; align-items: center; justify-content: center; min-height: 28px; }
    .rds-theme .xml-viewer { background: #001E3B; color: #E6EEF7; border-color: #003366; }
    .rds-theme .ted-Stamp-box { border-color: #0051A2; color: #0B1B2E; }
    .rds-theme .f29-box { border-left-color: #0062C4; }
    .rds-rocas.rds-theme .xml-viewer { background: #1F1B17; color: #F4EDE4; border-color: #3A322B; }
    .rds-rocas.rds-theme .ted-Stamp-box { border-color: #B08A5E; color: #1F1B17; }
    .rds-rocas.rds-theme .f29-box { border-left-color: #B08A5E; }
    .rds-claro .ant-tag-blue, .rds-claro .ant-tag-geekblue, .rds-claro .ant-tag-purple,
    .rds-claro .ant-tag-processing, .rds-claro .ant-tag-cyan {
      color: #0051A2; background: #E6F0FC; border-color: #B9D4F5;
    }
    .rds-rocas.rds-claro .ant-tag-blue, .rds-rocas.rds-claro .ant-tag-geekblue, .rds-rocas.rds-claro .ant-tag-purple,
    .rds-rocas.rds-claro .ant-tag-processing, .rds-rocas.rds-claro .ant-tag-cyan {
      color: #5C432A; background: #EFE4D5; border-color: #D8BB96;
    }
    .rds-claro .ant-tag-green, .rds-claro .ant-tag-success { color: #2F7D5B; background: #E3F0E9; border-color: #BFDCCB; }
    .rds-claro .ant-tag-orange, .rds-claro .ant-tag-gold, .rds-claro .ant-tag-warning { color: #8A5A12; background: #F7EBD6; border-color: #E8CFA0; }
    .rds-claro .ant-tag-red, .rds-claro .ant-tag-error, .rds-claro .ant-tag-volcano { color: #B4432F; background: #F6E1DC; border-color: #EDC3B9; }
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
      Descriptions, Segmented, Empty, Upload, Radio, Popconfirm, Avatar, message, notification, theme: antdTheme
    } = antd;

    const { Header, Sider, Content, Footer } = Layout;
    const { Title, Text } = Typography;

    // ========================================================================
    // DESIGN-SPARX / ANTD-MULTIPURPOSE-DASHBOARD THEME ARCHITECTURE (REA)
    // ========================================================================
    // ---------------------- Feline Capital & Rocas del Sur: iconos y tokens ----------------------
    const RDS_ICONOS = {
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
          dangerouslySetInnerHTML={{ __html: RDS_ICONOS[nombre] || '' }}
        />
      );
    }

    const RDS_FUENTE = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";
    const RDS_TOKENS_CLARO = {
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
    const ROCAS_TOKENS_CLARO = {
      colorText: '#1F1B17',
      colorTextSecondary: '#6E6257',
      colorTextTertiary: '#8A7D70',
      colorBorder: '#E3D7C7',
      colorBorderSecondary: '#EFE4D5',
      colorBgLayout: '#F6F1EA',
      colorFillAlter: '#FBF8F4',
      colorSuccess: '#2F7D5B',
      colorWarning: '#B7791F',
      colorError: '#B4432F',
      colorInfo: '#7A5B3A',
      colorLink: '#7A5B3A',
      colorLinkHover: '#5C432A',
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
    const RDS_COMPONENTES_CLARO = {
      Menu: FELINE_MENU,
      Table: { headerBg: '#F7F9FC', headerColor: '#4A5B70', rowHoverBg: '#F7F9FC', borderColor: '#E6EDF5' },
      Button: { primaryShadow: 'none', defaultShadow: 'none', defaultBorderColor: '#B9CCE2' },
      Tabs: { itemSelectedColor: '#0062C4', inkBarColor: '#0062C4', itemHoverColor: '#0051A2' },
      Card: { headerFontSize: 17 },
      Segmented: { itemSelectedBg: '#0062C4', itemSelectedColor: '#FFFFFF', trackBg: '#E6EDF5' },
    };
    const ROCAS_COMPONENTES_CLARO = {
      Menu: {
        itemBg: 'transparent',
        itemSelectedBg: '#D8BB96',
        itemSelectedColor: '#2A2017',
        itemColor: '#4F453C',
        itemHoverBg: 'rgba(255, 255, 255, 0.7)',
        itemHoverColor: '#1F1B17',
        itemActiveBg: '#E3D2BA',
        itemBorderRadius: 14,
        itemHeight: 44,
        itemMarginInline: 6,
        groupTitleColor: '#6E6257',
        iconSize: 18,
      },
      Table: { headerBg: '#FBF8F4', headerColor: '#6E6257', rowHoverBg: '#FBF8F4', borderColor: '#EFE4D5' },
      Button: { primaryShadow: 'none', defaultShadow: 'none', defaultBorderColor: '#D8BB96' },
      Tabs: { itemSelectedColor: '#7A5B3A', inkBarColor: '#7A5B3A', itemHoverColor: '#5C432A' },
      Card: { headerFontSize: 17 },
      Segmented: { itemSelectedBg: '#D8BB96', itemSelectedColor: '#2A2017', trackBg: '#EFE4D5' },
    };
    const RDS_TOKENS_OSCURO = {
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
    const RDS_COMPONENTES_OSCURO = {
      Menu: FELINE_MENU,
      Button: { primaryShadow: 'none', defaultShadow: 'none', primaryColor: '#FFFFFF' },
      Table: { headerBg: '#00264C', rowHoverBg: '#003366', borderColor: '#003F7A' },
      Tabs: { itemSelectedColor: '#5AA4F0', inkBarColor: '#0073E6', itemHoverColor: '#7DB6F5' },
      Segmented: { itemSelectedBg: '#0073E6', itemSelectedColor: '#FFFFFF', trackBg: '#00264C' },
    };
    const ROCAS_COMPONENTES_OSCURO = {
      Menu: {
        darkItemBg: 'transparent',
        darkItemSelectedBg: '#D8BB96',
        darkItemSelectedColor: '#2A2017',
        darkItemColor: '#D3C4B0',
        darkItemHoverBg: 'rgba(216, 187, 150, 0.12)',
        itemBorderRadius: 14,
        itemHeight: 44,
        itemMarginInline: 6,
      },
      Button: { primaryShadow: 'none', defaultShadow: 'none', primaryColor: '#2A2017' },
    };

    const STYLE_PRIMARIES = {
      rocasdelsur:  { light: '#7A5B3A', dark: '#D8BB96', label: 'Rocas del Sur',  desc: 'Arena y tierra de la marca, superficies claras' },
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
      if (styleName === 'rocasdelsur') {
        return mode === 'light'
          ? {
              bodyBg: '#F6F1EA',
              cardStyle: { background: '#FFFFFF', border: '1px solid #E3D7C7', borderRadius: 22, boxShadow: 'none' },
              siderBg: '#EFE4D5',
              headerBg: '#F6F1EA',
            }
          : {
              bodyBg: '#15120F',
              cardStyle: { background: '#1F1B17', border: '1px solid #3A322B', borderRadius: 22, boxShadow: 'none' },
              siderBg: '#1F1B17',
              headerBg: '#15120F',
            };
      }
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

    function EscenaDocumentos({
      documentos, empresa, periodo, cargando, errorCarga, onReintentar,
      onEmitirFactura, onEmitirBoleta, onFirmar, onVerXml, onCobrar, onNotaCredito, onEnviarSii,
    }) {
      const [filtro, setFiltro] = useState('todos');
      const [busqueda, setBusqueda] = useState('');
      const [estadoFiltro, setEstadoFiltro] = useState('todos');
      const [seleccionId, setSeleccionId] = useState(null);
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
              <h1>Facturas y boletas</h1>
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

    function FelineApp() {
      const [designStyle, setDesignStyle] = useState('${defaultStyle}');
      const [themeMode, setThemeMode] = useState('light');
      const [borderRadius, setBorderRadius] = useState(12);
      const [compactMode, setCompactMode] = useState(false);
      const [styleDrawerOpen, setStyleDrawerOpen] = useState(false);
      const [collapsed, setCollapsed] = useState(false);
      const [activeTab, setActiveTab] = useState('finance-overview');

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
      });
      const [activeTenantId, setActiveTenantId] = useState('tenant-feline-tech-01');
      const [periodoTributario, setPeriodoTributario] = useState('2026-10');

      // Modales interactivos
      const [newMoveModalOpen, setNewMoveModalOpen] = useState(false);
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
      const [newBoletaModalOpen, setNewBoletaModalOpen] = useState(false);
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

      const primaryColor = STYLE_PRIMARIES[designStyle]?.[themeMode] || '#2b50ed';
      const surface = getSurfaceOverrides(designStyle, themeMode);
      const isRocasStyle = designStyle === 'rocasdelsur';
      const isFelineStyle = designStyle === 'feline';
      // Acentos de texto legibles en ambos modos (paleta Rocas del Sur / Feline Capital)
      const textoAcento = isRocasStyle
        ? (themeMode === 'dark' ? '#D8BB96' : '#7A5B3A')
        : (themeMode === 'dark' ? '#5AA4F0' : '#0062C4');
      const acentoSecundario = isRocasStyle
        ? (themeMode === 'dark' ? '#E6BE7A' : '#5C432A')
        : (themeMode === 'dark' ? '#7DB6F5' : '#0051A2');
      const rdsActivo = isRocasStyle || isFelineStyle;
      const rdsClaro = rdsActivo && themeMode === 'light';

      const algorithms = useMemo(() => {
        const list = [themeMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm];
        if (compactMode) list.push(antdTheme.compactAlgorithm);
        return list;
      }, [themeMode, compactMode]);

      // ----------------------------------------------------------------------
      // HANDLERS DE OPERACIÓN
      // ----------------------------------------------------------------------
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
              invoiceDate: new Date().toISOString().split('T')[0],
              formaPagoSii: Number(values.formaPagoSii || 1),
              lines: [
                {
                  productCode: values.productCode || 'ITEM-01',
                  name: values.itemName,
                  quantity: Number(values.quantity || 1),
                  uomName: values.uomName || 'UN',
                  priceUnit: Number(values.priceUnit),
                  discountPct: Number(values.discountPct || 0),
                  isExempt: Number(values.documentTypeCode) === 34 || Number(values.documentTypeCode) === 41 || Boolean(values.isExempt),
                },
              ],
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
          setNewMoveModalOpen(false);
          formNewMove.resetFields();
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
          notification.success({
            message: \`Documento emitido con el folio \${Number(data.l10nLatamDocumentNumber)}\`,
            description: 'Quedó firmado, timbrado y registrado en la contabilidad. Falta enviarlo al SII.',
          });
          fetchState();
        } catch (err) {
          notification.error({ message: 'No se pudo emitir el documento', description: err.message });
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
          notification.success({
            message: \`Nota de crédito \${Number(data.l10nLatamDocumentNumber)} emitida\`,
            description: 'El documento original quedó revertido en la contabilidad.',
          });
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
        try {
          const res = await fetch('/api/v1/dashboard/moves', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': activeTenantId,
            },
            body: JSON.stringify({
              partnerId: values.partnerId,
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
                  discountPct: 0,
                  isExempt: Number(values.documentTypeCode) === 41,
                },
              ],
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Error al emitir boleta');

          await handlePostMove(data.id);
          notification.success({
            message: 'Boleta Electrónica Emitida y Timbrada con Éxito',
            description: 'Se asignó el Folio SII y se generó el Timbre Electrónico <TED> listo para entrega al cliente.',
          });
          setNewBoletaModalOpen(false);
          formNewBoleta.resetFields();
        } catch (err) {
          notification.error({
            message: 'Error al emitir Boleta Electrónica',
            description: err.message,
          });
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

      const abrirEmisionFactura = () => {
        formNewMove.setFieldsValue({
          documentTypeCode: 33,
          partnerId: tenantPartners.find((p) => p.rut !== '66666666-6')?.id || tenantPartners[0]?.id,
          quantity: 1,
          priceUnit: 100000,
          formaPagoSii: 1,
          autoPost: true,
        });
        setNewMoveModalOpen(true);
      };
      const abrirEmisionBoleta = () => {
        const cf = tenantPartners.find((p) => p.rut === '66666666-6') || tenantPartners[0];
        formNewBoleta.setFieldsValue({
          documentTypeCode: 39,
          partnerId: cf?.id,
          quantity: 1,
          priceUnit: 15000,
          formaPagoSii: 1,
          itemName: 'VENTA MOSTRADOR / BOLETA CONSUMIDOR FINAL',
        });
        setNewBoletaModalOpen(true);
      };

      const moveColumns = [
        {
          title: 'Documento / Folio SII',
          dataIndex: 'name',
          key: 'name',
          render: (text, record) => (
            <Space direction="vertical" size={0}>
              <Text strong className="mono-code" style={{ color: rdsActivo ? textoAcento : primaryColor }}>
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
              fontFamily: rdsActivo ? RDS_FUENTE : "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              ...(isRocasStyle
                ? (rdsClaro ? ROCAS_TOKENS_CLARO : {})
                : (rdsClaro ? RDS_TOKENS_CLARO : isFelineStyle ? RDS_TOKENS_OSCURO : {})),
            },
            components: isRocasStyle
              ? (rdsClaro ? ROCAS_COMPONENTES_CLARO : ROCAS_COMPONENTES_OSCURO)
              : isFelineStyle
              ? (rdsClaro ? RDS_COMPONENTES_CLARO : RDS_COMPONENTES_OSCURO)
              : undefined,
          }}
        >
          <Layout
            className={
              rdsActivo
                ? [
                    'rds-theme',
                    rdsClaro ? 'rds-claro' : '',
                    isRocasStyle ? 'rds-rocas' : '',
                  ].filter(Boolean).join(' ')
                : ''
            }
            style={{ minHeight: '100vh', background: surface.bodyBg }}
          >
            {/* SIDEBAR NAVEGACIÓN (Diseño de antd-multipurpose-dashboard side-nav.tsx) */}
            <Sider
              collapsible
              breakpoint="lg"
              collapsed={collapsed}
              onCollapse={setCollapsed}
              width={280}
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
              {isRocasStyle ? (
                <div style={{ padding: collapsed ? '18px 12px' : '20px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    className="rds-logo-rocas"
                    role="img"
                    aria-label="Logo Rocas del Sur"
                    style={{
                      width: collapsed ? 40 : 52,
                      height: collapsed ? 40 : 52,
                      color: surface.forceDarkSider || themeMode === 'dark' ? '#D8BB96' : '#7A5B3A',
                    }}
                  />
                  {!collapsed && (
                    <div>
                      <div className="rds-marca-nombre" style={{ fontWeight: 600, fontSize: 17, color: surface.forceDarkSider || themeMode === 'dark' ? '#F4EDE4' : '#1F1B17' }}>
                        Rocas del Sur
                      </div>
                      <div style={{ fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: surface.forceDarkSider || themeMode === 'dark' ? '#B3A595' : '#6E6257' }}>
                        Facturación · Feline
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: collapsed ? '18px 12px' : '22px 24px 18px', display: 'flex', flexDirection: 'column', alignItems: collapsed ? 'center' : 'flex-start', gap: 8 }}>
                  {isFelineStyle ? (
                    <span
                      className={collapsed ? 'rds-logo-feline rds-isotipo' : 'rds-logo-feline'}
                      role="img"
                      aria-label="Feline Capital"
                      style={{
                        width: collapsed ? 36 : 184,
                        height: collapsed ? 48 : 64,
                        color: '#FFFFFF',
                      }}
                    />
                  ) : (
                    <span
                      className={collapsed ? 'rds-logo rds-isotipo' : 'rds-logo'}
                      role="img"
                      aria-label="Feline Capital"
                      style={{
                        width: collapsed ? 36 : 184,
                        height: collapsed ? 48 : 64,
                        color: surface.forceDarkSider || themeMode === 'dark' ? '#FFFFFF' : primaryColor,
                      }}
                    />
                  )}
                  {!collapsed && (
                    <div style={{ fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: surface.forceDarkSider || themeMode === 'dark' ? '#8FB0D6' : '#4A5B70' }}>
                      Facturación electrónica
                    </div>
                  )}
                </div>
              )}

              <Menu
                theme={surface.forceDarkSider || themeMode === 'dark' ? 'dark' : 'light'}
                mode="inline"
                selectedKeys={[activeTab]}
                onClick={({ key }) => setActiveTab(key)}
                style={{ background: 'transparent', borderInlineEnd: 'none', padding: '0 8px' }}
                items={[
                  {
                    type: 'group',
                    label: !collapsed ? 'Ventas & DTE' : '',
                    children: [
                      {
                        key: 'finance-overview',
                        icon: <RIcono nombre="inicio" />,
                        label: 'Resumen General',
                      },
                      {
                        key: 'ventas-facturas-boletas',
                        icon: <RIcono nombre="factura" />,
                        label: 'Facturas y Boletas',
                      },
                      {
                        key: 'libro-compra-venta',
                        icon: <RIcono nombre="libro" />,
                        label: 'Libro Compras/Ventas',
                      },
                    ],
                  },
                  {
                    type: 'group',
                    label: !collapsed ? 'Contabilidad & SII' : '',
                    children: [
                      {
                        key: 'odoo-contabilidad',
                        icon: <RIcono nombre="contabilidad" />,
                        label: 'Contabilidad y Balance',
                      },
                      {
                        key: 'gastos-rendiciones',
                        icon: <RIcono nombre="billetera" />,
                        label: 'Gastos y Rendiciones (hr_expense)',
                      },
                      {
                        key: 'caf-folios',
                        icon: <RIcono nombre="emitir" />,
                        label: 'Folios (CAF)',
                      },
                      {
                        key: 'sii-soap-envios',
                        icon: <RIcono nombre="descargar" />,
                        label: 'Envíos al SII',
                      },
                    ],
                  },
                  {
                    type: 'group',
                    label: !collapsed ? 'Administración' : '',
                    children: [
                      {
                        key: 'tenants-certs',
                        icon: <RIcono nombre="empresa" />,
                        label: 'Empresas y Certificados',
                      },
                      {
                        key: 'usuarios-permisos',
                        icon: <RIcono nombre="usuarios" />,
                        label: 'Usuarios y Permisos',
                      },
                    ],
                  },
                ]}
              />
            </Sider>

            {/* CONTENEDOR PRINCIPAL */}
            <Layout style={{ background: 'transparent' }}>
              {/* HEADER SUPERIOR */}
              <Header
                style={{
                  background: surface.headerBg,
                  backdropFilter: designStyle === 'glassmorphic' ? 'blur(16px)' : undefined,
                  padding: '0 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  borderBottom: themeMode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 99,
                  height: 68,
                  overflowX: 'auto',
                  overflowY: 'hidden',
                }}
              >
                <div className="rds-header-empresa">
                  <Text type="secondary" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    Empresa
                  </Text>
                  <Select
                    value={activeTenantId}
                    onChange={(val) => setActiveTenantId(val)}
                    style={{ width: '100%', maxWidth: 340, minWidth: 180 }}
                    options={dashboardData.tenants.map((t) => ({
                      value: t.id,
                      label: \`\${t.razonSocial} — RUT \${t.rut}\`,
                    }))}
                  />
                </div>

                <div className="rds-header-acciones">
                  <Tooltip title="Cargar certificado digital">
                  <Button
                    aria-label="Cargar certificado"
                    icon={<RIcono nombre="permisos" size={16} />}
                    onClick={() => {
                      formCertUpload.setFieldsValue({
                        rutTitular: activeTenant?.rutEnvia || '15342545-0',
                        nombreTitular: activeTenant?.certificate?.subjectName || '',
                        passphrase: '',
                      });
                      setCertUploadModalOpen(true);
                    }}
                  />
                  </Tooltip>

                  <Button
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
                    <RIcono nombre="editar" size={16} />
                    Asiento contable
                  </Button>

                  <Button
                    onClick={() => {
                      formNewPurchase.setFieldsValue({
                        partnerId: tenantPartners.find((p) => p.rut === '92580000-7')?.id,
                        documentTypeCode: 33,
                        folioProveedor: String(Math.floor(100000 + Math.random() * 899999)),
                        invoiceDate: '2026-10-18',
                        tipoCompraSii: 'DEL_GIRO',
                        amountNeto: 420000,
                        amountExento: 0,
                      });
                      setNewPurchaseModalOpen(true);
                    }}
                  >
                    <RIcono nombre="recibir" size={16} />
                    Registrar compra
                  </Button>

                  <Button
                    type="primary"
                    style={activeTab === 'ventas-facturas-boletas' ? { display: 'none' } : undefined}
                    onClick={() => {
                      formNewMove.setFieldsValue({
                        partnerId: tenantPartners[0]?.id,
                        documentTypeCode: 33,
                        formaPagoSii: 1,
                        quantity: 1,
                        uomName: 'UN',
                        priceUnit: 250000,
                        discountPct: 0,
                        autoPost: true,
                      });
                      setNewMoveModalOpen(true);
                    }}
                  >
                    <RIcono nombre="emitir" size={16} />
                    Emitir documento
                  </Button>

                  <Segmented
                    value={themeMode}
                    onChange={(val) => setThemeMode(val)}
                    options={[
                      { label: <RIcono nombre="sol" size={16} />, value: 'light', title: 'Modo claro' },
                      { label: <RIcono nombre="luna" size={16} />, value: 'dark', title: 'Modo oscuro' },
                    ]}
                  />

                  <Tooltip title="Apariencia">
                    <Button aria-label="Apariencia" icon={<RIcono nombre="engranaje" size={16} />} onClick={() => setStyleDrawerOpen(true)} />
                  </Tooltip>
                </div>
              </Header>

              {/* CONTENIDO DINÁMICO DEL DASHBOARD */}
              <Content style={activeTab === 'ventas-facturas-boletas' ? { margin: 0, minHeight: 0 } : { margin: '24px', minHeight: 280 }}>
                {/* BANNER DEL CONTRIBUYENTE Y ACCESO RÁPIDO AL CERTIFICADO DIGITAL */}
                {activeTenant && activeTab !== 'ventas-facturas-boletas' && (
                  <Card style={{ ...surface.cardStyle, marginBottom: 20 }} size="small">
                    <Row gutter={[16, 12]} align="middle" justify="space-between">
                      <Col>
                        <Space size="large" wrap>
                          <div>
                            <Text type="secondary" style={{ fontSize: 11 }}>Empresa emisora</Text>
                            <div style={{ fontWeight: 700, fontSize: 15 }}>{activeTenant.razonSocial}</div>
                          </div>
                          <Divider type="vertical" />
                          <div>
                            <Text type="secondary" style={{ fontSize: 11 }}>RUT</Text>
                            <div className="mono-code" style={{ fontWeight: 600 }}>{activeTenant.rut}</div>
                          </div>
                          <Divider type="vertical" />
                          <div>
                            <Text type="secondary" style={{ fontSize: 11 }}>Certificado digital activo</Text>
                            <div style={{ fontSize: 12 }}>
                              <Badge status="success" text={<strong>{activeTenant.certificate?.subjectName}</strong>} />
                              <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                                (RUT Firma: {activeTenant.rutEnvia})
                              </Text>
                            </div>
                          </div>
                        </Space>
                      </Col>
                      <Col>
                        <Space wrap>
                          <Button
                            size="small"
                            type="primary"
                            ghost
                            onClick={() => {
                              formCertUpload.setFieldsValue({
                                rutTitular: activeTenant.rutEnvia,
                                nombreTitular: activeTenant.certificate?.subjectName,
                              });
                              setCertUploadModalOpen(true);
                            }}
                          >
                            Cambiar certificado
                          </Button>
                          <Button
                            size="small"
                            onClick={() => setActiveTab('libro-compra-venta')}
                          >
                            Libro de compras y ventas
                          </Button>
                          <Button
                            size="small"
                            onClick={() => setActiveTab('odoo-contabilidad')}
                          >
                            Balance 8 columnas
                          </Button>
                        </Space>
                      </Col>
                    </Row>
                  </Card>
                )}

                {/* 4 TARJETAS KPI CON CÁLCULO DE IVA DÉBITO, IVA CRÉDITO Y F29 */}
                <Row gutter={[20, 20]} style={{ marginBottom: 24, display: activeTab === 'ventas-facturas-boletas' ? 'none' : undefined }}>
                  <Col xs={24} sm={12} lg={6}>
                    <Card style={{ ...surface.cardStyle, height: '100%' }}>
                      <Statistic
                        title="IVA Débito Fiscal Ventas (Cód. 538)"
                        value={rcvF29.f29.codigo538_TotalDebitos}
                        formatter={(val) => formatCLP(val)}
                        valueStyle={{ color: rdsActivo ? textoAcento : primaryColor, fontWeight: 700 }}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Ventas Netas del Mes: {formatCLP(rcvF29.f29.totalVentasNeto)}
                      </Text>
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card style={{ ...surface.cardStyle, height: '100%' }}>
                      <Statistic
                        title="IVA Crédito Fiscal Compras (Cód. 537)"
                        value={rcvF29.f29.codigo537_TotalCreditos}
                        formatter={(val) => formatCLP(val)}
                        valueStyle={{ color: acentoSecundario, fontWeight: 700 }}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Compras Netas del Mes: {formatCLP(rcvF29.f29.totalComprasNeto)}
                      </Text>
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card style={{ ...surface.cardStyle, height: '100%' }}>
                      <Statistic
                        title={
                          rcvF29.f29.codigo089_ImpuestoDeterminadoIva > 0
                            ? 'IVA a Pagar en F29 (Cód. 089)'
                            : 'Remanente Crédito Fiscal (Cód. 077)'
                        }
                        value={
                          rcvF29.f29.codigo089_ImpuestoDeterminadoIva > 0
                            ? rcvF29.f29.codigo089_ImpuestoDeterminadoIva
                            : rcvF29.f29.codigo077_RemanenteCreditoMesSiguiente
                        }
                        formatter={(val) => formatCLP(val)}
                        valueStyle={{
                          color: rcvF29.f29.codigo089_ImpuestoDeterminadoIva > 0 ? '#B7791F' : '#2F7D5B',
                          fontWeight: 700,
                        }}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Propuesta F29 SII Período {periodoTributario}
                      </Text>
                    </Card>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Card style={{ ...surface.cardStyle, height: '100%' }}>
                      <Statistic
                        title={\`Resultado Contable (\${accounting.balance8Columnas.resultadoEjercicio.tipo})\`}
                        value={accounting.balance8Columnas.resultadoEjercicio.monto}
                        formatter={(val) => formatCLP(val)}
                        valueStyle={{
                          color: accounting.balance8Columnas.resultadoEjercicio.tipo === 'PERDIDA' ? '#B4432F' : '#2F7D5B',
                          fontWeight: 700,
                        }}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Balance 8 Columnas: {accounting.balance8Columnas.resultadoEjercicio.cuadraturaPerfecta ? 'Cuadrado ✓' : 'Revisar'}
                      </Text>
                    </Card>
                  </Col>
                </Row>

                {/* ================================================================= */}
                {/* MÓDULO CONTABILIDAD ODOO (BALANCE 8 COLUMNAS, DIARIO, MAYOR, COA) */}
                {/* ================================================================= */}
                {activeTab === 'odoo-contabilidad' && (
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

                {/* ================================================================= */}
                {/* MÓDULO ODOO 18: GASTOS Y RENDICIONES DE EMPLEADOS (hr_expense)     */}
                {/* ================================================================= */}
                {activeTab === 'gastos-rendiciones' && (() => {
                  const expensesList = dashboardData.expenses || [];
                  const sheetsList = dashboardData.expenseSheets || [];

                  // KPIs
                  const totalGastosMes = expensesList.reduce((acc, e) => acc + (e.totalAmount || 0), 0);
                  const totalIvaCredito = expensesList.reduce((acc, e) => acc + (e.taxAmount || 0), 0);
                  const porReembolsarMonto = sheetsList
                    .filter((s) => s.state === 'post' && s.paymentMode === 'own_account')
                    .reduce((acc, s) => acc + (s.totalAmount || 0), 0);
                  const pendientesAprobacion = sheetsList.filter((s) => s.state === 'submit').length;

                  const categoriaBadge = {
                    ALIMENTACION: { label: 'Alimentación', icon: '🍔', color: 'orange' },
                    TRANSPORTE: { label: 'Transporte', icon: '🚕', color: 'blue' },
                    ALOJAMIENTO: { label: 'Alojamiento', icon: '🏨', color: 'cyan' },
                    INSUMOS: { label: 'Insumos', icon: '📦', color: 'purple' },
                    SOFTWARE: { label: 'Software & SaaS', icon: '💻', color: 'geekblue' },
                    REPRESENTACION: { label: 'Representación', icon: '🤝', color: 'magenta' },
                    OTROS: { label: 'Otros Gastos', icon: '📄', color: 'default' },
                  };

                  const estadoSheetBadge = {
                    draft: { label: 'Borrador', color: 'default' },
                    submit: { label: 'Enviado (Para Aprobar)', color: 'orange' },
                    approve: { label: 'Aprobado (Listo Contabilizar)', color: 'cyan' },
                    post: { label: 'Contabilizado (Partida Doble)', color: 'purple' },
                    done: { label: 'Pagado / Reembolsado', color: 'green' },
                    cancel: { label: 'Rechazado', color: 'red' },
                  };

                  const sheetColumns = [
                    {
                      title: 'Código',
                      dataIndex: 'code',
                      key: 'code',
                      render: (text) => <Tag color="blue" style={{ fontWeight: 600 }}>{text}</Tag>,
                    },
                    {
                      title: 'Descripción del Informe',
                      dataIndex: 'name',
                      key: 'name',
                      render: (text, r) => (
                        <div>
                          <div style={{ fontWeight: 600 }}>{text}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            Fecha Contable: {r.accountingDate} • {r.expenseIds?.length || 0} gasto(s)
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: 'Empleado Solicitante',
                      dataIndex: 'employeeName',
                      key: 'employeeName',
                      render: (text, r) => (
                        <div>
                          <div>{text}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>RUT: {r.employeeRut}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Modo de Pago',
                      dataIndex: 'paymentMode',
                      key: 'paymentMode',
                      render: (mode) =>
                        mode === 'own_account' ? (
                          <Tag color="gold">Reembolso Empleado</Tag>
                        ) : (
                          <Tag color="cyan">Tarjeta Corporativa</Tag>
                        ),
                    },
                    {
                      title: 'Total Rendición',
                      dataIndex: 'totalAmount',
                      key: 'totalAmount',
                      align: 'right',
                      render: (val, r) => (
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{formatCLP(val)}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            Neto: {formatCLP(r.untaxedAmount)} | IVA: {formatCLP(r.totalTaxAmount)}
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: 'Estado Odoo',
                      dataIndex: 'state',
                      key: 'state',
                      render: (st) => {
                        const meta = estadoSheetBadge[st] || { label: st, color: 'default' };
                        return <Tag color={meta.color}>{meta.label}</Tag>;
                      },
                    },
                    {
                      title: 'Asiento Contable',
                      dataIndex: 'moveName',
                      key: 'moveName',
                      render: (val, r) =>
                        val ? (
                          <div>
                            <Tag color="purple" style={{ fontSize: 11 }}>{val}</Tag>
                            {r.paymentMoveName && (
                              <div style={{ marginTop: 2 }}>
                                <Tag color="green" style={{ fontSize: 11 }}>TEF: {r.paymentMoveName}</Tag>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Pendiente</span>
                        ),
                    },
                    {
                      title: 'Acciones de Flujo',
                      key: 'actions',
                      align: 'center',
                      render: (_, r) => (
                        <Space wrap>
                          {r.state === 'draft' && (
                            <Button size="small" type="primary" onClick={() => handleSubmitExpenseSheet(r.id)}>
                              Enviar para Aprobar
                            </Button>
                          )}
                          {r.state === 'submit' && (
                            <Button size="small" type="primary" onClick={() => handleApproveExpenseSheet(r.id)}>
                              Aprobar
                            </Button>
                          )}
                          {r.state === 'approve' && (
                            <Button
                              size="small"
                              type="primary"
                              style={{ background: '#722ed1', borderColor: '#722ed1' }}
                              onClick={() => handlePostExpenseSheet(r.id)}
                            >
                              Contabilizar Partida Doble
                            </Button>
                          )}
                          {r.state === 'post' && r.paymentMode === 'own_account' && (
                            <Button
                              size="small"
                              type="primary"
                              style={{ background: '#10b981', borderColor: '#10b981' }}
                              onClick={() => handlePayExpenseSheet(r.id)}
                            >
                              Pagar / Reembolsar TEF
                            </Button>
                          )}
                          {['draft', 'submit', 'approve'].includes(r.state) && (
                            <Popconfirm
                              title="¿Rechazar esta rendición de gastos?"
                              onConfirm={() => handleRefuseExpenseSheet(r.id, 'Gasto no justificado')}
                              okText="Sí, Rechazar"
                              cancelText="Cancelar"
                            >
                              <Button size="small" danger>
                                Rechazar
                              </Button>
                            </Popconfirm>
                          )}
                          <Button size="small" onClick={() => setSelectedSheetForView(r)}>
                            Detalle
                          </Button>
                        </Space>
                      ),
                    },
                  ];

                  const expenseColumns = [
                    {
                      title: 'Fecha',
                      dataIndex: 'date',
                      key: 'date',
                      width: 100,
                    },
                    {
                      title: 'Descripción del Gasto',
                      dataIndex: 'name',
                      key: 'name',
                      render: (text, r) => (
                        <div>
                          <div style={{ fontWeight: 600 }}>{text}</div>
                          {r.notes && <div style={{ fontSize: 11, color: '#64748b' }}>{r.notes}</div>}
                        </div>
                      ),
                    },
                    {
                      title: 'Categoría',
                      dataIndex: 'category',
                      key: 'category',
                      render: (cat) => {
                        const meta = categoriaBadge[cat] || categoriaBadge.OTROS;
                        return (
                          <Tag color={meta.color}>
                            {meta.icon} {meta.label}
                          </Tag>
                        );
                      },
                    },
                    {
                      title: 'Comprobante',
                      dataIndex: 'voucherType',
                      key: 'voucherType',
                      render: (tipo, r) => (
                        <div>
                          <div>{tipo === 'FACTURA_33' ? 'Factura 33 (con IVA)' : tipo === 'BOLETA_39' ? 'Boleta 39' : tipo}</div>
                          {r.voucherNumber && <div style={{ fontSize: 11, color: '#64748b' }}>N°: {r.voucherNumber}</div>}
                        </div>
                      ),
                    },
                    {
                      title: 'Proveedor',
                      dataIndex: 'vendorName',
                      key: 'vendorName',
                      render: (text, r) =>
                        text ? (
                          <div>
                            <div>{text}</div>
                            {r.vendorRut && <div style={{ fontSize: 11, color: '#64748b' }}>{r.vendorRut}</div>}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        ),
                    },
                    {
                      title: 'Neto',
                      dataIndex: 'untaxedAmount',
                      key: 'untaxedAmount',
                      align: 'right',
                      render: (v) => formatCLP(v),
                    },
                    {
                      title: 'IVA Crédito',
                      dataIndex: 'taxAmount',
                      key: 'taxAmount',
                      align: 'right',
                      render: (v) => (v > 0 ? <span style={{ color: '#0062C4', fontWeight: 600 }}>{formatCLP(v)}</span> : '-'),
                    },
                    {
                      title: 'Total',
                      dataIndex: 'totalAmount',
                      key: 'totalAmount',
                      align: 'right',
                      render: (v) => <span style={{ fontWeight: 700 }}>{formatCLP(v)}</span>,
                    },
                    {
                      title: 'Modo Pago',
                      dataIndex: 'paymentMode',
                      key: 'paymentMode',
                      render: (m) =>
                        m === 'own_account' ? (
                          <Tag color="gold">Propio (Reembolso)</Tag>
                        ) : (
                          <Tag color="cyan">Tarjeta Empresa</Tag>
                        ),
                    },
                    {
                      title: 'Estado',
                      dataIndex: 'state',
                      key: 'state',
                      render: (st, r) => {
                        const colors = {
                          draft: 'default',
                          reported: 'blue',
                          approved: 'cyan',
                          posted: 'purple',
                          done: 'green',
                          refused: 'red',
                        };
                        return (
                          <div>
                            <Tag color={colors[st] || 'default'}>{st.toUpperCase()}</Tag>
                            {r.sheetId && (
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                Rendición: {sheetsList.find((s) => s.id === r.sheetId)?.code || r.sheetId}
                              </div>
                            )}
                          </div>
                        );
                      },
                    },
                  ];

                  return (
                    <Space direction="vertical" size={20} style={{ width: '100%' }}>
                      <Card
                        title="Módulo Odoo 18: Gastos y Rendiciones de Empleados (hr_expense + l10n_cl)"
                        style={surface.cardStyle}
                        extra={
                          <Space>
                            <Button
                              type="primary"
                              icon={<RIcono nombre="billetera" size={15} />}
                              onClick={() => {
                                formNewExpense.resetFields();
                                formNewExpense.setFieldsValue({
                                  employeeId: dashboardData.users[0]?.id,
                                  date: dayjs(),
                                  category: 'ALIMENTACION',
                                  paymentMode: 'own_account',
                                  voucherType: 'FACTURA_33',
                                  hasIvaCredit: true,
                                });
                                setNewExpenseModalOpen(true);
                              }}
                            >
                              + Nuevo Gasto
                            </Button>
                            <Button
                              type="default"
                              icon={<RIcono nombre="libro" size={15} />}
                              onClick={() => {
                                formNewExpenseSheet.resetFields();
                                formNewExpenseSheet.setFieldsValue({
                                  employeeId: dashboardData.users[0]?.id,
                                  name: \`Rendición de Gastos - \${dayjs().format('MMMM YYYY')}\`,
                                  autoSubmit: true,
                                });
                                setSelectedExpenseIdsForSheet([]);
                                setNewExpenseSheetModalOpen(true);
                              }}
                            >
                              + Nueva Rendición (Informe)
                            </Button>
                          </Space>
                        }
                      >
                        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                          <Col xs={24} sm={12} lg={6}>
                            <Card size="small" style={{ background: themeMode === 'dark' ? '#1e293b' : '#f8fafc', borderRadius: 8 }}>
                              <Statistic
                                title="Total Gastos Registrados (Mes)"
                                value={totalGastosMes}
                                formatter={(val) => formatCLP(Number(val))}
                                valueStyle={{ color: textoAcento, fontWeight: 700 }}
                              />
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                {expensesList.length} comprobante(s) en total
                              </div>
                            </Card>
                          </Col>

                          <Col xs={24} sm={12} lg={6}>
                            <Card size="small" style={{ background: themeMode === 'dark' ? '#1e293b' : '#f8fafc', borderRadius: 8 }}>
                              <Statistic
                                title="Rendiciones por Reembolsar"
                                value={porReembolsarMonto}
                                formatter={(val) => formatCLP(Number(val))}
                                valueStyle={{ color: '#ea580c', fontWeight: 700 }}
                              />
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                Contabilizadas, listas para pago TEF
                              </div>
                            </Card>
                          </Col>

                          <Col xs={24} sm={12} lg={6}>
                            <Card size="small" style={{ background: themeMode === 'dark' ? '#1e293b' : '#f8fafc', borderRadius: 8 }}>
                              <Statistic
                                title="Pendientes de Aprobación"
                                value={pendientesAprobacion}
                                valueStyle={{ color: '#2563eb', fontWeight: 700 }}
                              />
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                Esperando visto bueno de gerencia
                              </div>
                            </Card>
                          </Col>

                          <Col xs={24} sm={12} lg={6}>
                            <Card size="small" style={{ background: themeMode === 'dark' ? '#1e293b' : '#f8fafc', borderRadius: 8 }}>
                              <Statistic
                                title="IVA Crédito Fiscal Recuperable"
                                value={totalIvaCredito}
                                formatter={(val) => formatCLP(Number(val))}
                                valueStyle={{ color: '#059669', fontWeight: 700 }}
                              />
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                                Imputado a cuenta 110710 (F29)
                              </div>
                            </Card>
                          </Col>
                        </Row>

                        <Tabs
                          defaultActiveKey="sheets"
                          items={[
                            {
                              key: 'sheets',
                              label: \`Informes de Rendición (\${sheetsList.length})\`,
                              children: (
                                <Table
                                  dataSource={sheetsList}
                                  columns={sheetColumns}
                                  rowKey="id"
                                  pagination={{ pageSize: 8 }}
                                  size={compactMode ? 'small' : 'middle'}
                                />
                              ),
                            },
                            {
                              key: 'expenses',
                              label: \`Gastos Individuales (\${expensesList.length})\`,
                              children: (
                                <Table
                                  dataSource={expensesList}
                                  columns={expenseColumns}
                                  rowKey="id"
                                  pagination={{ pageSize: 10 }}
                                  size={compactMode ? 'small' : 'middle'}
                                />
                              ),
                            },
                          ]}
                        />
                      </Card>
                    </Space>
                  );
                })()}

                {/* ================================================================= */}
                {/* MÓDULO 1: LIBRO DE VENTAS Y COMPRAS (RCV SII) + PROPUESTA F29     */}
                {/* ================================================================= */}
                {activeTab === 'libro-compra-venta' && (
                  <Space direction="vertical" size={20} style={{ width: '100%' }}>
                    <Card
                      title={\`Registro de Compras y Ventas (RCV SII) y Propuesta Formulario 29 — Período \${periodoTributario}\`}
                      style={surface.cardStyle}
                      extra={
                        <Space>
                          <Select
                            value={periodoTributario}
                            onChange={setPeriodoTributario}
                            options={[
                              { value: '2026-10', label: 'Octubre 2026 (2026-10)' },
                              { value: '2026-09', label: 'Septiembre 2026 (2026-09)' },
                            ]}
                          />
                          <Button icon={<RIcono nombre="descargar" size={16} />} onClick={() => exportRcvCsv('VENTAS')}>
                            CSV ventas
                          </Button>
                          <Button icon={<RIcono nombre="descargar" size={16} />} onClick={() => exportRcvCsv('COMPRAS')}>
                            CSV compras
                          </Button>
                        </Space>
                      }
                    >
                      <Tabs
                        defaultActiveKey="tab-ventas"
                        items={[
                          {
                            key: 'tab-ventas',
                            label: \`Libro de Ventas Emitidas (\${rcvF29.detalleVentas?.length || 0} DTEs)\`,
                            children: (
                              <Space direction="vertical" size={18} style={{ width: '100%' }}>
                                <div>
                                  <Text strong>Resumen Oficial SII de Ventas por Tipo de DTE (Carátula RCV Ventas)</Text>
                                  <Table
                                    style={{ marginTop: 8 }}
                                    rowKey="tipoDte"
                                    size="small"
                                    pagination={false}
                                    columns={rcvSummaryColumns}
                                    dataSource={rcvF29.resumenVentasPorTipo}
                                  />
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Text strong>Detalle Nominativo del Libro de Ventas (Facturas 33, Exentas 34, Boletas 39, NC 61)</Text>
                                    <Button type="primary" size="small" onClick={() => setNewMoveModalOpen(true)}>
                                      + Emitir Nuevo DTE de Venta
                                    </Button>
                                  </div>
                                  <Table
                                    rowKey="id"
                                    size="small"
                                    columns={moveColumns}
                                    dataSource={tenantSalesMoves}
                                    pagination={{ pageSize: 6 }}
                                  />
                                </div>
                              </Space>
                            ),
                          },
                          {
                            key: 'tab-compras',
                            label: \`Libro de Compras Recibidas (\${rcvF29.detalleCompras?.length || 0} DTEs)\`,
                            children: (
                              <Space direction="vertical" size={18} style={{ width: '100%' }}>
                                <div>
                                  <Text strong>Resumen Oficial SII de Compras por Tipo de DTE (Carátula RCV Compras — Crédito Fiscal)</Text>
                                  <Table
                                    style={{ marginTop: 8 }}
                                    rowKey="tipoDte"
                                    size="small"
                                    pagination={false}
                                    columns={rcvSummaryColumns}
                                    dataSource={rcvF29.resumenComprasPorTipo}
                                  />
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Text strong>Detalle Nominativo del Libro de Compras (Facturas de Proveedores / Acuse de Recibo)</Text>
                                    <Button type="primary" size="small" onClick={() => setNewPurchaseModalOpen(true)}>
                                      + Registrar Factura de Proveedor (Compra)
                                    </Button>
                                  </div>
                                  <Table
                                    rowKey="id"
                                    size="small"
                                    columns={moveColumns}
                                    dataSource={tenantPurchaseMoves}
                                    pagination={{ pageSize: 6 }}
                                  />
                                </div>
                              </Space>
                            ),
                          },
                          {
                            key: 'tab-f29',
                            label: 'Propuesta Declaración Mensual F29 (SII)',
                            children: (
                              <Descriptions bordered column={2} size="middle">
                                <Descriptions.Item label="Código [538] Total Débitos Fiscales (IVA Ventas - NC Emitidas)">
                                  <Text strong style={{ color: rdsActivo ? textoAcento : primaryColor, fontSize: 15 }}>
                                    {formatCLP(rcvF29.f29.codigo538_TotalDebitos)}
                                  </Text>
                                </Descriptions.Item>
                                <Descriptions.Item label="Código [537] Total Créditos Fiscales (IVA Compras del Giro)">
                                  <Text strong style={{ color: acentoSecundario, fontSize: 15 }}>
                                    {formatCLP(rcvF29.f29.codigo537_TotalCreditos)}
                                  </Text>
                                </Descriptions.Item>
                                <Descriptions.Item label="Base Imponible Ventas Netas del Período">
                                  {formatCLP(rcvF29.f29.totalVentasNeto)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Base Imponible Compras Netas del Período">
                                  {formatCLP(rcvF29.f29.totalComprasNeto)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Código [089] Impuesto Determinado IVA a Pagar">
                                  <Tag color={rcvF29.f29.codigo089_ImpuestoDeterminadoIva > 0 ? 'volcano' : 'green'} style={{ fontSize: 14, padding: '4px 10px' }}>
                                    {formatCLP(rcvF29.f29.codigo089_ImpuestoDeterminadoIva)}
                                  </Tag>
                                </Descriptions.Item>
                                <Descriptions.Item label="Código [077] Remanente de Crédito Fiscal para el mes siguiente">
                                  <Tag color="green" style={{ fontSize: 14, padding: '4px 10px' }}>
                                    {formatCLP(rcvF29.f29.codigo077_RemanenteCreditoMesSiguiente)}
                                  </Tag>
                                </Descriptions.Item>
                              </Descriptions>
                            ),
                          },
                        ]}
                      />
                    </Card>
                  </Space>
                )}

                {/* ================================================================= */}
                {/* MÓDULO 2: OVERVIEW PRINCIPAL                                      */}
                {/* ================================================================= */}
                {activeTab === 'finance-overview' && (
                  <Row gutter={[20, 20]}>
                    <Col xs={24} xxl={17}>
                      <Card
                        title="Movimientos recientes"
                        style={surface.cardStyle}
                        extra={
                          <Space>
                            <Button size="small" onClick={() => setActiveTab('odoo-contabilidad')}>
                              Balance 8 columnas
                            </Button>
                            <Button size="small" onClick={() => setActiveTab('libro-compra-venta')}>
                              RCV y F29
                            </Button>
                            <Button size="small" type="primary" icon={<RIcono nombre="emitir" size={14} />} onClick={handleSendBatchSii}>
                              Enviar lote al SII
                            </Button>
                          </Space>
                        }
                      >
                        <Table
                          rowKey="id"
                          loading={loading}
                          columns={moveColumns}
                          dataSource={tenantMoves}
                          pagination={{ pageSize: 6 }}
                          size="middle"
                        />
                      </Card>
                    </Col>

                    <Col xs={24} xxl={7}>
                      <Space direction="vertical" size={20} style={{ width: '100%' }}>
                        <Card
                          title="Folios CAF disponibles"
                          style={surface.cardStyle}
                          extra={
                            <Button size="small" type="link" onClick={() => setNewCafModalOpen(true)}>
                              + Cargar CAF
                            </Button>
                          }
                        >
                          <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            {tenantCafs.map((caf) => {
                              const total = caf.folioHasta - caf.folioDesde + 1;
                              const usados = caf.folioActual - caf.folioDesde + 1;
                              const pct = Math.min(100, Math.round((usados / total) * 100));
                              return (
                                <div key={caf.id}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <Text strong style={{ fontSize: 12 }}>
                                      [{caf.tipoDte}] {caf.nombreTipo}
                                    </Text>
                                    <Text className="mono-code" type="secondary">
                                      #{caf.folioActual} / {caf.folioHasta}
                                    </Text>
                                  </div>
                                  <Progress percent={pct} size="small" status={caf.agotado ? 'exception' : 'active'} />
                                </div>
                              );
                            })}
                          </Space>
                        </Card>

                        <Card title="Últimos Sobres <EnvioDTE> al SII" style={surface.cardStyle}>
                          {tenantLotes.length === 0 ? (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description="Sin lotes enviados aún. Usa «Enviar lote al SII» en Movimientos recientes."
                            />
                          ) : (
                            <Space direction="vertical" style={{ width: '100%' }} size={12}>
                              {tenantLotes.slice(0, 3).map((lote) => (
                                <Alert
                                  key={lote.id}
                                  type="success"
                                  showIcon
                                  message={\`TrackID SII: #\${lote.trackId}\`}
                                  description={\`\${lote.estadoSii} — \${lote.glosaSii}\`}
                                />
                              ))}
                            </Space>
                          )}
                        </Card>
                      </Space>
                    </Col>
                  </Row>
                )}

                {/* ================================================================= */}
                {/* MÓDULO VENTAS: FACTURAS Y BOLETAS ELECTRÓNICAS                   */}
                {/* ================================================================= */}
                {activeTab === 'ventas-facturas-boletas' && (
                  <EscenaDocumentos
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
                )}

                {/* ================================================================= */}
                {/* MÓDULO 3: BÓVEDA DE CERTIFICADOS DIGITALES (.PFX/.P12) Y EMPRESAS */}
                {/* ================================================================= */}
                {activeTab === 'tenants-certs' && (
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

                {/* ================================================================= */}
                {/* MÓDULO: PERFILES DE ACCESO, USUARIOS Y PERMISOS (RBAC)            */}
                {/* ================================================================= */}
                {activeTab === 'usuarios-permisos' && (() => {
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
                })()}

                {/* ================================================================= */}
                {/* MÓDULO 4: CONTROL DE FOLIOS CAF                                   */}
                {/* ================================================================= */}
                {activeTab === 'caf-folios' && (
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
                )}

                {/* ================================================================= */}
                {/* MÓDULO 5: ENVÍOS SII SOAP/CGI                                     */}
                {/* ================================================================= */}
                {activeTab === 'sii-soap-envios' && (
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
                )}
              </Content>

              {activeTab !== 'ventas-facturas-boletas' && (
                <Footer style={{ textAlign: 'center', background: 'transparent', opacity: 0.75, fontSize: 12 }}>
                  <strong>Feline ERP v1.3.0</strong> — SII Chile DTE + Contabilidad Odoo 18 (Partida Doble & Balance 8 Columnas) + RCV/F29 + Design Sparx Antd Multipurpose Dashboard (Puerto 3004)
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
            <Modal
              title="Emitir Documento Tributario Electrónico de Venta (Odoo account.move + SII CAF)"
              open={newMoveModalOpen}
              onCancel={() => setNewMoveModalOpen(false)}
              onOk={() => formNewMove.submit()}
              okText="Procesar Documento"
              width={640}
            >
              <Form form={formNewMove} layout="vertical" onFinish={handleCreateDraftMove}>
                <Row gutter={16}>
                  <Col span={14}>
                    <Form.Item
                      name="partnerId"
                      label="Cliente / Receptor (Aislado por Tenant)"
                      rules={[{ required: true }]}
                    >
                      <Select
                        options={tenantPartners.map((p) => ({
                          value: p.id,
                          label: \`\${p.razonSocial} (\${p.rut}) — [\${p.taxpayerType}]\`,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={10}>
                    <Form.Item
                      name="documentTypeCode"
                      label="Tipo de DTE (l10n_latam.document.type)"
                      rules={[{ required: true }]}
                    >
                      <Select
                        options={[
                          { value: 33, label: '[33] Factura Electrónica (Afecta IVA)' },
                          { value: 34, label: '[34] Factura No Afecta o Exenta' },
                          { value: 39, label: '[39] Boleta Electrónica (Consumidor Final)' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={6}>
                    <Form.Item name="productCode" label="Código Ítem">
                      <Input placeholder="SKU-001" />
                    </Form.Item>
                  </Col>
                  <Col span={18}>
                    <Form.Item
                      name="itemName"
                      label="Glosa / Nombre del Ítem (<NmbItem> e <IT1> del TED)"
                      rules={[{ required: true, message: 'Ingresa el nombre del servicio o producto' }]}
                    >
                      <Input placeholder="Ej: SERVICIO DE CONSULTORÍA E INTEGRACIÓN SII DTE" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={6}>
                    <Form.Item name="quantity" label="Cantidad" rules={[{ required: true }]}>
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="uomName" label="Unidad (UnmdItem)">
                      <Input placeholder="UN" maxLength={4} />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="priceUnit" label="Precio Unitario Neto (CLP)" rules={[{ required: true }]}>
                      <InputNumber min={0} step={1000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item name="discountPct" label="% Descuento">
                      <InputNumber min={0} max={100} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16} align="middle">
                  <Col span={12}>
                    <Form.Item name="formaPagoSii" label="Forma de Pago SII (<FmaPago>)">
                      <Select
                        options={[
                          { value: 1, label: '1 — Contado' },
                          { value: 2, label: '2 — Crédito' },
                          { value: 3, label: '3 — Sin Costo (Entrega Gratuita)' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="autoPost" valuePropName="checked" label="Acción Contable Odoo">
                      <Switch
                        checkedChildren="Publicar y Firmar XMLDSig Inmediatamente"
                        unCheckedChildren="Guardar como Borrador ('/')"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
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
            <Modal
              title="Emitir Boleta Electrónica (SII Tipo 39 Afecta / 41 Exenta)"
              open={newBoletaModalOpen}
              onCancel={() => setNewBoletaModalOpen(false)}
              onOk={() => formNewBoleta.submit()}
              okText="Emitir, Timbrar <TED> y Finalizar"
              width={600}
            >
              <Alert
                style={{ marginBottom: 16 }}
                type="success"
                showIcon
                message="Emisión Inmediata de Boleta Electrónica"
                description="La boleta se emite, timbra con el CAF correspondiente, se firma digitalmente con la llave RSA y queda lista para entrega o consulta del cliente."
              />
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
                  rules={[{ required: true }]}
                >
                  <Select
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
                      label="Monto Total (CLP)"
                      rules={[{ required: true, message: 'Ingresa el monto de la boleta' }]}
                    >
                      <InputNumber min={100} step={1000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Modal>

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
    root.render(<FelineApp />);
  </script>
</body>
</html>`;
}
