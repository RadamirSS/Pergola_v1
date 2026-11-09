# Vercel deployment

This Next.js entrypoint reuses the configurator UI and pricing engine. Its authenticated
server gateway calls the existing private service, preserving the same Cloudflare D1
archive, catalogue and PDF generation. This is a hybrid deployment, not a database migration.

Vercel project settings:

- Root directory: `vercel`; include source files outside root.
- Install: `cd .. && npm ci`; build: `node build.mjs`.
- Node 24; Next.js framework; production branch `main`.
- Configure server-only Production secrets `ADMIN_TOKEN` and `PERGOLA_BACKEND_TOKEN`,
  and `PERGOLA_BACKEND_URL` with the private backend origin.
- The backend must retain owner-only access and `PERGOLA_ACCESS=owner-private`.
  Obtain service access through the supported Sites connection. Never expose it in
  browser code, repository files or public environment variables.

Visitors enter the administrator access code. Sessions use signed, expiring,
Secure/HttpOnly/SameSite cookies; upstream credentials never reach the browser.
The production and preview environments must use separate credentials/backends.
Catalogue images are copied from the shared `public` directory by the build script.

For a local build, run `node vercel/build.mjs` from repository root.
