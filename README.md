# Pergola v1

An independent Italian configurator for IC Tende products: catalogue-based pricing,
technical review, saved quotations, PDF documents and internal order confirmation.
AI photo analysis and image generation are visibly disabled; there is no AI API call.

## What is implemented

- 133 products in 9 families, imported **directly from the supplied 257-page PDF**.
- Separate price tables for spans, LED/cassette configurations and material variants.
- Integer-cent calculations, billable area/height minima, product quantities,
  model-specific options, commercial discounts, installation, transport and VAT.
- Missing prices never become zero-cost products. No interpolation or undocumented
  rounding to a larger catalogue dimension.
- Special/red cells and unreviewed models cannot be issued as offers. They can be
  saved as review requests. Admin review notes and decisions persist in the database.
- Shared database archive, monotonic database IDs, idempotent save requests and
  immutable quote snapshots. Re-importing a catalogue never reprices old documents.
- Real Unicode PDF download, with a page-aware source breakdown and draft/review
  watermark text. Client confirmation is an internal status, not a supplier submission.
- Company settings, catalogue JSON export/replacement and manual review workflow.
- Responsive interface, keyboard labels, explicit loading and failure states.

## Run

Node >=22.13 and npm are required. The project runs on Vinext (Next.js-compatible
React) and Cloudflare Workers. D1 provides durable SQL storage.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_ordinary_warbound.sql
npm run dev
```

Open the URL printed by the development command. Development authentication is
local-only and is compiled out of production. The preview database is separate
from the hosted database. Do not commit `.wrangler`, `.dev.vars`, `.env`, or builds.

## Deployment and access

The included `.openai/hosting.json` declares a `DB` D1 binding. Hosted publication
provisions the database and applies schema migrations. A private owner-only preview
uses the hosting gateway and runtime `PERGOLA_ACCESS=owner-private`.

**Do not use `owner-private` outside that private gateway or when changing its
audience.** For a standalone/public Cloudflare deployment, leave that setting unset
and configure a strong random `ADMIN_TOKEN` server secret. `/api/session` exchanges
it for a Secure, HttpOnly, SameSite cookie. All catalogue, archive and admin endpoints
require authorization. Configure your D1 binding and apply migrations before serving.
This is a single-company v1, not a multi-tenant SaaS or a public customer portal.

## Catalogue and verification

`data/catalog.json` is the versioned runtime catalogue. `docs/source-pages/` contains
the extracted text of referenced PDF pages; `data/extraction-report.json` describes
coverage. The source filename and SHA-256 are included in the catalogue. Product
images are extracted from the same PDF. The original 84 MB PDF is not duplicated
in Git; keep the original supplied document for visual and colour-based checks.

To reproduce extraction:

```sh
python -m pip install pdfplumber pymupdf Pillow
python scripts/import-catalog.py /absolute/path/to/DOC-20260808-WA0021_261109_221634.pdf
```

Only California's ordinary configuration and the explicitly transcribed m² tariffs
and minima are initially marked checked. Other tables are estimates pending manual
technical review, including ambiguous source entries. A checked flag means the
listed data was reviewed, **not** that the 2023 price is current or that a structural
assessment has been performed. Confirm supplier prices before real sales.

Accessory groups are intentionally model-specific. California includes explicit IC
Tende motor choices, controller and protection options from p.51. Unmapped motors,
sensors, electrical integrations and other additions require manual review; the
application does not invent compatibility rules. Some physical units and tables in
the source itself are inconsistent (for example p.219); these remain unapproved.

See [architecture](docs/ARCHITECTURE.md) and [acceptance checks](docs/ACCEPTANCE.md).

## Checks

```sh
npm run typecheck
npm test
npm run build
```

The pricing tests cover known failures in the reference configurator, source-page
fixtures, percentage/metre options, minimum areas, independent variants, invalid
values, verification gates, and reachability of every extracted grid cell. Build
output alone does not prove every PDF cell was extracted correctly.

## Ownership and scope

All application source, importer, schema and migrations are in this repository.
No runtime dependency on the previous developer's app exists. The catalogue remains
IC Tende's supplied product data. DejaVu Sans is embedded for Unicode PDF support;
its license is included in `docs/FONT-LICENSE.txt`.
