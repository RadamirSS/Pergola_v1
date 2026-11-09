import { env } from 'cloudflare:workers';
import catalogData from '../data/catalog.json';
import { defaultCompany } from './pricing';
import type { Catalog, Company, Quote, ReviewOverride } from './types';

type RuntimeEnv = Cloudflare.Env & { PERGOLA_ACCESS?: string; ADMIN_TOKEN?: string };
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function database() { if (!env.DB) throw new HttpError(503, 'Archivio non disponibile. Contattare l’amministratore.'); return env.DB; }
/** owner-private is set only behind the private Sites gateway. Standalone uses ADMIN_TOKEN. */
export function authorize(request: Request): string {
  const config = env as RuntimeEnv;
  if (import.meta.env.DEV) return 'local-development';
  if (config.PERGOLA_ACCESS === 'owner-private') return request.headers.get('oai-authenticated-user-id') ?? 'private-workspace';
  const bearer = request.headers.get('authorization')?.replace(/^Bearer /,'');
  const cookie = request.headers.get('cookie')?.split('; ').find(c => c.startsWith('pergola_admin='))?.slice(14);
  if (config.ADMIN_TOKEN && (bearer === config.ADMIN_TOKEN || cookie === config.ADMIN_TOKEN)) return 'administrator';
  throw new HttpError(401, 'Accedere all’area di lavoro per continuare.');
}
export function mutationGuard(request: Request) {
  authorize(request);
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host;
  if ((origin && new URL(origin).host !== host) || request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'Richiesta da un’origine non consentita.');
}
export async function body(request: Request) {
  if (Number(request.headers.get('content-length')) > 3000000) throw new HttpError(413, 'Il file supera il limite di 3 MB.');
  const raw = await request.text();
  if (raw.length > 3000000) throw new HttpError(413, 'Il file supera il limite di 3 MB.');
  try { return JSON.parse(raw); } catch { throw new HttpError(400, 'JSON non valido.'); }
}
export function failure(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error && typeof error === 'object' && 'issues' in error) return Response.json({ error: 'Dati non validi. Controllare i campi e il formato del catalogo.' }, { status: 400 });
  console.error('Pergola API:', error instanceof Error ? error.message : 'unexpected failure');
  return Response.json({ error: 'Operazione non completata. Riprova; i dati già salvati restano nell’archivio.' }, { status: 503 });
}
export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function loadWorkspace() {
  const db = database();
  const values = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  const settings = Object.fromEntries(values.results.map(r => [r.key, JSON.parse(r.value)]));
  const rows = await db.prepare('SELECT * FROM product_reviews').all<{ product_id: string; status: 'checked' | 'pending'; note: string; updated_at: string }>();
  const reviews: Record<string, ReviewOverride> = Object.fromEntries(rows.results.map(r => [r.product_id, { status: r.status, note: r.note, updatedAt: r.updated_at }]));
  return { catalog: (settings.catalog ?? catalogData) as Catalog, company: { ...defaultCompany, ...settings.company } as Company, reviews };
}
export function toQuote(row: { id: number; status: string; snapshot: string; created_at: string; updated_at: string }): Quote {
  const date = new Date(row.created_at);
  return { id: row.id, number: `PG-${date.getUTCFullYear()}-${String(row.id).padStart(5,'0')}`, status: row.status as Quote['status'], snapshot: JSON.parse(row.snapshot), createdAt: row.created_at, updatedAt: row.updated_at };
}
