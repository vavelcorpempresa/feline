# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Four groups use the same panel, each with a different daily job:

- **Owner**: reviews and issues documents for his own companies and needs to know where each company stands.
- **Accountant / administration**: closes the month (sales and purchase book, F29 proposal, 8-column balance) and needs exact, verifiable figures.
- **Sales / cashier team**: issues facturas and boletas many times a day and needs speed with no tax errors.
- **External clients**: companies that use Feline as a service (white label) and see the panel under their own brand.

Language of use: Chilean Spanish. Users know the SII terminology (folio, CAF, RUT, IVA, F29, nota de crédito, track ID) but not the internal system terms.

## Product Purpose

Feline is the electronic invoicing engine and central ERP for its owner's companies and projects. It issues, signs (stamp + XMLDSig) and sends tax documents to the SII (Chile), records their accounting and shows each document's tax and collection status. Other projects (for example the FUGAR marketplace) connect to it through the API v1 to issue documents.

Success: every issued document ends up accepted by the SII, correctly booked and collected, and every user knows at a glance what is still pending.

## Positioning

A multi-company engine built in house: one installation serves several companies, each with its own certificate, folios (CAF) and brand, and it is also the billing backend for the owner's other projects through a project-scoped API.

## Operating Context

- Daily issuing: factura (33), factura exenta (34), boleta (39), boleta exenta (41), nota de débito (56) and nota de crédito (61).
- Document lifecycle: draft → issued and signed → sent to the SII (track ID) → accepted / accepted with objections / rejected; in parallel, collection: unpaid → partial → paid → reversed by a nota de crédito.
- Monthly close: sales and purchase book (RCV), F29 proposal, 8-column balance, general ledger.
- Company administration: digital certificate (.pfx), CAF folios, connected projects.
- Mostly used on desktop in an office; cashiers may use smaller screens.

## Capabilities and Constraints

- The current panel is a React 18 + Ant Design 5 app rendered from a Fastify string template (`src/ui/feline-antd-dashboard.html.ts`), with in-browser Babel and libraries from a CDN.
- The panel's data comes from the in-memory sandbox (`/api/v1/dashboard/*`); the real API v1 (PostgreSQL) is used by connected projects.
- The panel is served under two brands: `/` (Feline Capital) and `/rocas` (Rocas del Sur).
- Amounts in CLP with no decimals; RUT formatted with a check digit.
- Open: authentication and roles per user group (the "Usuarios y Permisos" screen exists but there are no real permissions yet).

## Brand Commitments

- **Feline Capital** and **Rocas del Sur** are two of the owner's companies; each one uses the panel with its own brand. Both brands must keep working.
- Assets: `src/ui/assets/logo-feline-capital.svg` (shield + name; isotype separate in `feline-logo.ts`) and `src/ui/assets/logo-rocas-del-sur.svg`. They are used as CSS masks, so each screen sets their color.
- External clients see the panel under their own brand (white label): the system must allow per-company branding.

## Evidence on Hand

- Sandbox example data (companies, customers, CAF, documents) in `src/services/feline-live-sandbox.service.ts`. Fictional: they are not real customers.
- No testimonials, metrics or real cases; do not invent them.

## Product Principles

1. **The tax status is never ambiguous.** Each document states clearly whether it is valid before the SII and what to do if it is not.
2. **SII language, not system language.** The screen uses the user's tax terms (folio, borrador, aceptado, nota de crédito); internal codes (`DRAFT`, `NOT_PAID`, Odoo models) never appear.
3. **Errors are prevented before issuing.** A rejected or invalid document costs money and time; validation comes before the action, not after.
4. **The same panel serves four jobs.** Owner, accountant, cashier and client share screens; density and hierarchy must serve the most frequent job without hiding the others.
5. **Multi-company by design.** It is always clear which company you are operating as.
