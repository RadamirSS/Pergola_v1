# Public customer calculator: documentation audit

The previous Vercel release was an administrator workspace, protected both by
Vercel Authentication and an application access code. That was unsuitable for
the requested public customer link.

## Customer access

The root route is a public configurator. A signed, HttpOnly browser cookie creates
an anonymous visitor identity without registration. Saved projects and PDFs are
stored in D1 and filtered by that identity on every archive, detail, PDF and status
endpoint. Clearing the cookie removes this browser's access; another device has
its own projects. The administrator workspace is `/admin`, with protected APIs
under `/api/manage/`. Public callers cannot edit settings, inspect the shared
archive, apply commercial discounts or issue binding offers.

## Source documents and scope

Reviewed the supplied SmartQuote AI complete dossier and commercial presentation
(PDF and PowerPoint versions). The core flow is configuration, calculation,
quotation/PDF, history and order status, with an administrator catalogue editor.
The documents also describe AI, multiple manufacturers, subscriptions, native apps
and CRM integrations. These are not completed features of this single-catalogue
v1. AI remains explicitly disabled as requested. No Security/SCT catalogue was
supplied for this implementation; prices for those brands are not invented.

## Machine-readable catalogue

`data/catalog.json` is the runtime source, not a mockup. It contains 133 products,
9 families, 7,729 grid price cells, 49 area-tariff products and 16 fixed-price
products (68 grid products). The importer is `scripts/import-catalog.py`;
`data/extraction-report.json` and `docs/source-pages/` retain source references.
Source: 257-page IC Tende 2023 catalogue
`DOC-20260808-WA0021_261109_221634.pdf`, SHA-256
`c5505d624e60a90dcec7b188b979ce8d991857abddc5c95fd522d9cc7d06abf2`.

The catalogue is schema-validated, and tests cover all extracted grid cells,
separate variants, billable minima, accessories, VAT and invalid dimensions.
California 300 × 200 cm is EUR 680 before VAT and EUR 829.60 including 22% VAT
(source p.51). Automated reachability checks do not prove perfect transcription:
50 products have reviewed status; 83 remain subject to technical review.
Unreviewed/special configurations can be saved as review requests, not issued
as ordinary commercial offers. The 2023 prices still need supplier confirmation.
