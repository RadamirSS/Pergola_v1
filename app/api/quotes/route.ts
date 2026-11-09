import { z } from 'zod';
import { calculate } from '../../../lib/pricing';
import { clientSchema, selectionSchema } from '../../../lib/validation';
import { authorize, body, database, failure, HttpError, json, loadWorkspace, mutationGuard, toQuote } from '../../../lib/server';
export async function GET(request: Request) {
  try { authorize(request); const data = await database().prepare('SELECT * FROM quotations ORDER BY id DESC LIMIT 200').all<Parameters<typeof toQuote>[0]>(); return json({ quotes: data.results.map(toQuote) }); } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    mutationGuard(request); const owner = authorize(request);
    const payload = z.object({ selection: selectionSchema, client: clientSchema, requestKey: z.string().uuid(), issue: z.boolean().default(false) }).parse(await body(request));
    const db = database();
    const existing = await db.prepare('SELECT * FROM quotations WHERE request_key = ?').bind(payload.requestKey).first<Parameters<typeof toQuote>[0]>();
    if (existing) return json({ quote: toQuote(existing) });
    const { catalog, company, reviews } = await loadWorkspace();
    const product = catalog.products.find(p => p.id === payload.selection.productId);
    if (!product) throw new HttpError(404, 'Prodotto non trovato.');
    const calculation = calculate(product, payload.selection, catalog.version, company, reviews[product.id]);
    if (!calculation.available) throw new HttpError(422, calculation.errors.join(' '));
    if (payload.issue && !calculation.issuable) throw new HttpError(422, 'Configurazione da verificare: salvare una richiesta di verifica.');
    if (payload.issue && (!company.address || !company.vatNumber || (!company.email && !company.phone))) throw new HttpError(422, 'Completare indirizzo, partita IVA e un contatto aziendale prima di emettere un preventivo.');
    const now = new Date(); const validUntil = new Date(now.getTime() + company.validityDays * 86400000).toISOString();
    const snapshot = { selection: payload.selection, client: payload.client, calculation, company, createdAt: now.toISOString(), validUntil, source: catalog.source };
    const status = payload.issue ? 'issued' : calculation.issuable ? 'draft' : 'review';
    // INSERT OR IGNORE makes repeated/concurrent clicks idempotent without losing an ID.
    await db.prepare('INSERT OR IGNORE INTO quotations (request_key, owner_id, status, snapshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(payload.requestKey, owner, status, JSON.stringify(snapshot), now.toISOString(), now.toISOString()).run();
    const row = await db.prepare('SELECT * FROM quotations WHERE request_key = ?').bind(payload.requestKey).first<Parameters<typeof toQuote>[0]>();
    if (!row) throw new HttpError(503, 'Salvataggio non completato.');
    return json({ quote: toQuote(row) }, 201);
  } catch (error) { return failure(error); }
}
