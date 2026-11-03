---
name: Feline Facturación
description: Electronic invoicing panel for Feline Capital and Rocas del Sur; the document scene puts one SII document on a dark stage at a time.
colors:
  void: "#0A0A0A"
  ink: "#121316"
  slate: "#1E2026"
  fog-deep: "#2A2F39"
  fog: "#5A6472"
  text: "#ECEDEF"
  text-secondary: "#A9AEB6"
  sand: "#C7B9A6"
  sand-strong: "#DCCDB8"
  state-accepted: "#6FCB95"
  state-sent: "#7CC8DA"
  state-warning: "#E7B95A"
  state-rejected: "#F28B66"
  state-draft: "#B3ADA6"
  paper: "#FFFFFF"
  paper-ink: "#16181C"
  paper-graphite: "#3F444B"
  paper-gray: "#5B6067"
  paper-rule: "#D9DCE0"
  paper-rule-soft: "#ECEEF0"
  sii-red: "#C8102E"
  feline-blue: "#0062C4"
  feline-blue-dark: "#0073E6"
  feline-navy: "#001E3B"
  rocas-earth: "#7A5B3A"
  rocas-sand: "#D8BB96"
  rocas-linen: "#F6F1EA"
typography:
  display-total:
    fontFamily: "Antonio, Inter, sans-serif"
    fontSize: "60px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.005em"
  display-folio:
    fontFamily: "Antonio, Inter, sans-serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "\"tnum\" on"
  body-small:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.25
  sheet-body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sheet: "3px"
  kbd: "5px"
  tab: "7px"
  control: "8px"
  row: "9px"
  circle: "50%"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  xxl: "32px"
  stage-gutter: "56px"
components:
  button-primary:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.void}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.sand-strong}"
    textColor: "{colors.void}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.slate}"
  filter-tab:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.body-small}"
    rounded: "{rounded.tab}"
    padding: "0 8px"
    height: "32px"
  filter-tab-active:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.text}"
  input-search:
    backgroundColor: "{colors.void}"
    textColor: "{colors.text}"
    typography: "{typography.body-small}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "38px"
  queue-row:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.row}"
    padding: "11px 12px"
  queue-row-selected:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.sand}"
  rail-action:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.circle}"
    size: "48px"
  rail-action-primary:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.void}"
    rounded: "{rounded.circle}"
    size: "48px"
  document-sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-ink}"
    typography: "{typography.sheet-body}"
    rounded: "{rounded.sheet}"
    padding: "34px 38px 28px"
    width: "600px"
---

# Design System: Feline Facturación

This file records two systems that live in the same panel. **The document scene** is the new world. It currently covers only the "Facturas y boletas" view (`EscenaDocumentos` in `src/ui/feline-antd-dashboard.html.ts`), and it is dark under both brands. **The incumbent brand shell** is everything else: the Ant Design 5 theme, sidebar, header and the other screens, themed per brand (Feline Capital and Rocas del Sur). The scene sits inside the incumbent shell. It never restyles the shell, and the shell never bleeds into it.

## Overview

**Creative North Star: "The Lit Sheet"**

One tax document at a time owns a dark stage. It is shown as the real printed sheet, with its actions stacked beside it. The room is void and ink: near-black planes separated by one-pixel slate rules, with no cards, no tiles and no pills. The only light surface in the room is the document itself, a white sheet with the SII red box. That makes the document the thing you read and everything else the place you read it from.

Density is high where the work is, in the queue: 360px of tight rows, each with name, amount, client, SII state and date. The stage is calm. The sheet scales to fit and sits under a bottom scrim that repeats what matters at a glance: the folio and total in a tall condensed face, plus the client and the SII state with its reason. Moving between documents is a vertical snap (wheel, J/K, arrows, or the position dots), a short rise or fall with a fade. It is the one signature motion.

Colour is rationed. Sand is the only warm accent, and it marks only selection and the primary action. State hues appear only on SII states and on the queue's "pending" tally. Everything else is fog grey on ink.

**Key Characteristics:**
- Dark void stage in both brands; the white document sheet is the only light surface.
- Three columns: queue (360px), stage (fluid), action rail (104px).
- Sand (`{colors.sand}`) is the single warm accent: primary action, selected row, active dot, focus ring, text selection.
- State colour lives only on the SII state dot and its label.
- Antonio is used only for the folio and the total; Inter is used for everything else, with tabular figures.
- White single-stroke line icons (1.7 stroke, round caps) inside circular rail buttons.
- Vertical snap between documents in 220ms, with a reduced-motion fade fallback.

## Colors

The palette is a near-black ground with grey fog, one sand accent, and a five-tone state set. The printed sheet carries its own paper palette.

### Primary
- **Sand** (`{colors.sand}`): the primary action ("Emitir", the primary rail action such as "Firmar y emitir" or "Enviar al SII"), the selected queue row's name, the active position dot, the focus outline, an active status filter, the text caret and `::selection`. **Sand Strong** (`{colors.sand-strong}`) is used only for the hover state of sand fills.

### Neutral
- **Void** (`{colors.void}`): the stage, the action rail, input wells and the scrim's end colour. It is also the text colour on sand.
- **Ink** (`{colors.ink}`): the queue column, one step above the void.
- **Slate** (`{colors.slate}`): column dividers, input borders, hover and selected fills for rows and tabs.
- **Deep Fog** (`{colors.fog-deep}`): borders of secondary buttons, arrows, kbd keys, rail circles and the selected row; the scrollbar thumb.
- **Fog** (`{colors.fog}`): inactive position dots and hover borders.
- **Bone Text** (`{colors.text}`): primary text on dark.
- **Mist** (`{colors.text-secondary}`): secondary text such as client names, dates, counts, the RUT/date line and the payment state.

### State (SII only)
- **Accepted** (`{colors.state-accepted}`): "Aceptado por el SII".
- **Sent** (`{colors.state-sent}`): "Enviando al SII" and "Enviado al SII".
- **Warning** (`{colors.state-warning}`): "Firmado, falta enviarlo" and "Aceptado con reparos", plus the queue's pending tally ("2 por enviar al SII · 1 borrador").
- **Rejected** (`{colors.state-rejected}`): "Rechazado por el SII".
- **Draft** (`{colors.state-draft}`): "Borrador" and "Anulado".

### Paper (the document sheet)
- **Paper** (`{colors.paper}`) with **Paper Ink** (`{colors.paper-ink}`) for values and the totals rule; **Graphite** (`{colors.paper-graphite}`) for the issuer block and references; **Paper Gray** (`{colors.paper-gray}`) for field labels and the column heads; **Paper Rule** (`{colors.paper-rule}`) and **Soft Rule** (`{colors.paper-rule-soft}`) for the receiver band and line dividers.
- **SII Red** (`{colors.sii-red}`): the 2px RUT/document-type/folio box and the "S.I.I. — COMUNA" line. On a draft, the box turns into a dashed grey (#8A8F96) box.

### Incumbent brand shell (not part of the scene)
- **Feline Capital**: primary **Feline Blue** (`{colors.feline-blue}` in light mode, `{colors.feline-blue-dark}` in dark mode), with a navy sidebar (`{colors.feline-navy}`) and #0073E6 for the selected menu item.
- **Rocas del Sur**: primary **Earth** (`{colors.rocas-earth}` in light mode) or **Rocas Sand** (`{colors.rocas-sand}` in dark mode and for the selected menu item), with a **Linen** layout ground (`{colors.rocas-linen}`).
- Both brands keep their own logo (a CSS mask) and sidebar. The scene does not change either one.

### Named Rules
**The One Warm Light Rule.** Sand is the only accent in the scene, and it means "selected" or "do this next". If something is sand, it is either chosen or the primary action.

**The State Owns Its Hue Rule.** Green, cyan, amber, red-orange and draft grey appear only on SII state (the dot, the state label, the pending tally). They are never used for decoration, buttons or amounts.

**The Only Light Surface Rule.** In the scene, the document sheet is the only light plane. Panels, rows and controls stay on void, ink and slate.

## Typography

**Display Font:** Antonio 600 (with Inter, sans-serif)
**Body Font:** Inter (with -apple-system, BlinkMacSystemFont, sans-serif)

**Character:** A tall, condensed poster face is used only for the two figures you read from across the room, the folio and the total. Every other piece of UI text, and the sheet itself, is set in a quiet, exact Inter with tabular figures.

### Hierarchy
- **Display Total** (`{typography.display-total}`): the document total in the scrim. It drops to 38px when the container is under 1040px and to 40px under 720px.
- **Display Folio** (`{typography.display-folio}`, uppercase): the document name in the scrim, such as "FACTURA 2" or "BORRADOR DE FACTURA". It is 42px in the medium container.
- **Headline** (`{typography.headline}`): the queue title "Facturas y boletas" (18px in the medium container) and the empty-state heading.
- **Title** (`{typography.title}`): the client name in the scrim. The scrim's SII state is 15px/600 with a 9px dot.
- **Body** (`{typography.body}`): the scene default; row names and amounts at 600.
- **Body Small** (`{typography.body-small}`): filters, inputs, the monthly tally and the position counter.
- **Label** (`{typography.label}`): rail action labels and dates; the state label in rows is 12.5px/500.
- **Sheet Body** (`{typography.sheet-body}`): the printed sheet. Field labels are 11.5px, the issuer name is 15px/700, and the total row is 15px/700.

### Named Rules
**The Two Figures Rule.** Antonio sets only the folio and the total. Never use it for headings, buttons or labels.

**The Tabular Rule.** Every amount, RUT and quantity uses tabular figures, so columns of CLP line up.

## Layout

The scene is a three-column grid filling `calc(100vh - 68px)` under the incumbent header: the **queue** (360px, ink), the **stage** (fluid, void), and the **action rail** (104px, void, with a slate left rule). The queue stacks a header with "Emitir", a monthly tally, filter tabs (Todos / Facturas / Boletas / Notas, each with a count), search plus a status select, and a scrolling list. The stage stacks the position counter with arrows and J/K hints (top right), the sheet centred with a 56px side gutter, the vertical position dots (right, at most 11), and a bottom scrim. The scrim overlaps the sheet's foot by 56px and fades from transparent to void.

Responsive behaviour uses container queries on the scene container, because the brand sidebar counts toward the width:
- **Under 1040px:** the queue narrows to 312px, the search and select stack, the scrim stacks with the total beside its payment state, and the rail becomes a horizontal bar under the stage.
- **Under 720px (phone):** the layout becomes a single column with the queue on top (list capped at 320px), then the sheet in fluid form (its header stacks, the price column is hidden, and the stamp sits above the totals). The scrim becomes a solid block, the rail becomes a sticky bottom bar that scrolls horizontally, and the dots and kbd hints are hidden.

Spacing works in 4px steps. Panel insets are 16–20px, rows have 11/12px padding, and the scrim has 64/32/24px.

## Elevation & Depth

The scene is flat. Depth comes from tone (void below ink below slate) and from one-pixel slate rules. The one exception is the sheet, which floats on the stage like a page lifted off a desk. The bottom scrim is a gradient over the stage, not a shadow.

### Shadow Vocabulary
- **Sheet lift** (`box-shadow: 0 30px 60px -20px rgba(0,0,0,0.7), 0 2px 6px rgba(0,0,0,0.4)`): only on the document sheet. It is removed for print.

### Named Rules
**The Paper Floats Rule.** Only the sheet casts a shadow. Controls, rows and rails are flat, and their state is shown with fill and border changes.

## Shapes

Small, quiet radii sized by role: the sheet has an almost square paper corner (`{rounded.sheet}`); kbd keys `{rounded.kbd}`; tabs `{rounded.tab}`; buttons, inputs and the select `{rounded.control}`; queue rows `{rounded.row}`. Circles are reserved for the rail action buttons, the state dots (7px, or 9px in the scrim) and the position dots. Borders are always 1px, except for the sheet's 2px SII box.

The incumbent shell uses larger radii: an Ant Design base radius of 12px, 14px sidebar menu items and 22px cards. Those stay in the shell.

## Components

### Buttons
- **Shape:** gently rounded (`{rounded.control}`), 36px tall, Inter 14px/500.
- **Primary:** a sand fill with void text at 600 and an 18px line icon on the left, as in "Emitir". There is at most one primary per region.
- **Secondary:** transparent with a deep-fog border and bone text. On hover, the fill becomes slate and the border becomes fog.
- **Hover / Focus:** 160ms ease-out on background and border. Focus shows a 2px sand outline with a 2px offset.
- **Arrow buttons:** 32px squares with the same border, and 35% opacity when disabled.

### Filter tabs
- **Style:** text tabs in Mist with a count. Hover shows a slate fill. The active tab has a slate fill, a deep-fog border, bone text at 500, and a Mist count.

### Inputs / Fields
- **Style:** a 38px void well with a 1px slate border and 13px text. Search has a leading line icon. The status select uses the native control with a drawn chevron.
- **Focus:** the border turns sand. A status select with an active filter keeps a sand border and sand text.

### Queue rows
- **Style:** a two-line grid. Line one has the name and the amount (600). Line two has the client (Mist, ellipsis), then the state dot and label, and the date (12px Mist).
- **States:** hover shows a slate fill. When selected, the row has a slate fill and a deep-fog border, and its name turns sand. While loading, rows are 74px slate shimmer bars, and the shimmer stops under reduced motion.

### Action rail
- **Style:** labelled buttons with a 48px circle (deep-fog border, 22px white line icon) above a 12px label.
- **Primary:** the next valid step (sign or send) has a sand-filled circle with a void icon.
- **Disabled:** the icon is at 38% and the label is Mist at 70%. A `title` explains why. The action stays visible and is not removed.
- **Active:** the circle scales to 0.94.

### Document sheet (signature)
The printed representation of the DTE: the issuer block, then the SII red box (R.U.T., document type in capitals, N° folio), then "S.I.I. — COMUNA", a receiver band between two rules, optional references, a line table, and a foot with the PDF417 electronic stamp on the left and the totals on the right. A draft shows a dashed grey box reading "BORRADOR · SIN FOLIO" and an empty dashed stamp slot. The sheet is 600px wide and scaled to fit the stage. Below 720px it switches to the fluid form.

### Stage scrim (signature)
This is the bottom legend over the sheet's foot. On the left are the folio (Display Folio), the client (Title), the RUT and date (Mist), the SII state with its dot, and the reason. On the right are the total (Display Total) and the payment state (Mist).

### Position dots and snap
There are up to 11 dots on 18px hit areas. Inactive dots are fog, and the active dot is sand at 1.4× scale. A change of document enters with a 220ms `cubic-bezier(0.16, 1, 0.3, 1)` move of ±36px and a fade in from the direction of travel. Under reduced motion it becomes a 160ms fade.

### Navigation (incumbent)
The brand sidebar (Ant Menu, 44px items, 14px radius, 18px line icons), the header company selector and the theme toggles all belong to the incumbent shell and are themed per brand. Feline Capital uses a navy sidebar with a blue selected item. Rocas del Sur uses a linen sidebar with a sand selected item.

## Do's and Don'ts

### Do:
- **Do** keep the scene on void (`{colors.void}`) and ink (`{colors.ink}`) in both brands and both shell themes.
- **Do** reserve sand for selection and the single next action. Its hover state is `{colors.sand-strong}`.
- **Do** show SII state as a coloured dot plus a plain-Spanish label and, where it helps, a one-line reason ("Está timbrado; envíalo al SII.").
- **Do** set every amount, RUT and quantity in tabular figures.
- **Do** keep disabled rail actions visible, dimmed, and explained by a tooltip.
- **Do** keep the 220ms vertical snap and its reduced-motion fade for any document-to-document change.
- **Do** render the document as its printed sheet, with the SII red box, rather than as a summary card.

### Don't:
- **Don't** put KPI tiles above a table of status pills in this view. The scene is a queue plus a stage.
- **Don't** use state hues for decoration, buttons or amounts.
- **Don't** use Antonio for anything other than the folio and the total.
- **Don't** add shadows to controls or panels. Only the sheet lifts.
- **Don't** bring the incumbent shell's blue or linen surfaces, or its 22px card radius, into the scene.
- **Don't** show internal codes (DRAFT, NOT_PAID); use SII terms.
