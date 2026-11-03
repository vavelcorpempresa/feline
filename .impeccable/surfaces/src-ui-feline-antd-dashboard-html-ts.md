---
version: 1
slug: "src-ui-feline-antd-dashboard-html-ts"
primary_target: "src/ui/feline-antd-dashboard.html.ts"
related_targets: []
---

# Facturas y boletas (panel Feline)

Scope: the "Facturas y boletas" view of the Feline panel (`/` Feline Capital and `/rocas` Rocas del Sur). Mode: Operate.
Audience and job: owner, accountant, cashier and white-label client; issue, check the SII status and collect, all from the same view.
Constraints: standard controls (tabs, filters, table, buttons); Chilean Spanish with SII terms; no internal codes; both brands keep their logo.
Memorable moment: the selected document owns the stage like a printed sheet and the next one is one keystroke or flick away.
Open: real roles and permissions per user group.

## Direction contract

THESIS: One document at a time owns the stage, readable as the real sheet, with its actions stacked beside it; it refuses the category default of KPI tiles above a table of pills.
OWN-WORLD: void and ink ground (#0A0A0A / #121316 / #1E2026), fog and dusk neutrals (#5A6472 / #8B857E) for secondary text, sand (#C7B9A6) as the sole warm accent for selection and the primary action; state colours only on the SII state (accepted green, sent cyan, rejected red-orange, draft fog). The document is the only light surface: a white sheet with the SII red box. Tall condensed display (Antonio) only for folio and total; Inter for all UI, figures in tabular-nums. White line icons, one stroke.
STORY: the user scans the queue, the selected document fills the stage, they read its state and amounts at a glance and act from the rail (PDF, XML, nota de crédito, registrar pago) without leaving the view.
FIRST VIEWPORT: left the standard brand nav; next a 360px queue with tabs Todos / Facturas / Boletas / Notas, a search and status filter, a monthly tally line and the dense document list; the center is the dark stage with the selected document's sheet scaled to fit, with a bottom scrim carrying client, SII state with its reason, and the total in condensed type; on the right, a vertical rail of labelled white icons; vertical dots of position. "Emitir documento" in sand at the top of the queue.
FORM: catalog world pop-culture-shelf-vertical-video-feed-surface, adopted by the user from the declined row of the hand (position 1 of the challengers, declined by the model); signature move: vertical snap between documents on the stage (wheel, J/K, arrows) with a 200 ms translate + fade. seed:035284a8934dd3ca
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
