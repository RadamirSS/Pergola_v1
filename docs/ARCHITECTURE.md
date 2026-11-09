# Architecture and pricing contract

## Data flow

The client loads the protected workspace endpoint and derives an immediate preview
with the shared pure engine. On save, the server validates the request, loads the
current catalogue and company settings from D1, recalculates the price and stores
the complete snapshot. It ignores any client-supplied total. PDF generation reads
only that saved snapshot. The application never treats browser storage as an archive.

## Monetary order

1. Exact table cell, fixed material/size price, or area tariff with billable minima.
2. Percentage options on base; piece/metre accessories; colour adjustment on base.
3. Multiply product and options by quantity.
4. Apply the commercial discount to products and accessories only.
5. Add separately agreed installation and delivery totals.
6. Calculate VAT on the resulting taxable amount and round to integer cents.

Percentages use integer basis points (2200 = 22%). Currency fields are integer cents.
Each monetary line and final VAT is rounded to the nearest cent. There are no regional
discounts, inferred transport charges, or automatically assumed supplier discounts.

## Database

- `settings`: company identity and optional active catalogue replacement.
- `product_reviews`: model review decisions with note and timestamp.
- `quotations`: immutable snapshots, unique request keys, autoincrement IDs and status.

`PG-YYYY-NNNNN` uses the record ID, not archive length. Cancelled records are retained.
Repeated concurrent saves with the same request key return the same record.
Allowed state transitions: draft/review/issued -> cancelled; issued -> accepted,
only while unexpired. Drafts are duplicated and repriced before issuing a new document.

## API

| Endpoint | Purpose |
| --- | --- |
| GET `/api/workspace` | Catalogue, company and review state |
| POST `/api/calculate` | Server-authoritative pricing preview |
| GET/POST `/api/quotes` | Latest 200 records / idempotent creation |
| GET/PATCH `/api/quotes/:id` | Saved record / status transition |
| GET `/api/quotes/:id/pdf` | Unicode PDF of saved snapshot |
| PUT `/api/admin` | Company, catalogue replacement, review decision |
| POST `/api/session` | Standalone administrator sign-in |
| GET `/api/health` | Database reachability, AI disabled state |

Mutations require authorization and reject cross-origin browser requests. Catalogue
replacement validates IDs, duplicate cells, allowed units, monetary bounds and shape,
then clears review overrides in the same D1 batch. Never silently migrate schemas in
request handlers. Append migrations for future schema changes.

## Explicit v1 limits

Single-company workspace; no billing, native app, CRM or manufacturer order API.
No AI calls, uploads or generated visualisation. Product images are catalogue images.
Only exact catalogue dimensions are priced for grid products. Physical dimensions,
fixings, wind/snow loads and permissions still need professional technical review.
A visual PDF inspection is needed wherever colour, footnotes or merged cells encode
meaning. Unreviewed data stays blocked for offer issuance.
