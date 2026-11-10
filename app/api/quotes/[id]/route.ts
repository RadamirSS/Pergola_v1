import { z } from 'zod';
import { authorize, body, database, failure, HttpError, json, mutationGuard, toQuote, quoteScope } from '../../../../lib/server';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { authorize(request); const { id } = await context.params; const row = await database().prepare("SELECT * FROM quotations WHERE id = ? AND (? = '' OR owner_id = ?)").bind(Number(id), quoteScope(request), quoteScope(request)).first<Parameters<typeof toQuote>[0]>(); if (!row) throw new HttpError(404, 'Preventivo non trovato.'); return json({ quote: toQuote(row) }); } catch (error) { return failure(error); }
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    mutationGuard(request); const { id } = await context.params;
    const { status } = z.object({ status: z.enum(['accepted','cancelled']) }).parse(await body(request));
    const db = database();
    const row = await db.prepare("SELECT * FROM quotations WHERE id = ? AND (? = '' OR owner_id = ?)").bind(Number(id), quoteScope(request), quoteScope(request)).first<Parameters<typeof toQuote>[0]>();
    if (!row) throw new HttpError(404, 'Preventivo non trovato.');
    if (status === 'accepted' && row.status !== 'issued') throw new HttpError(409, 'Si può confermare solo un preventivo emesso.');
    if (status === 'accepted' && new Date(JSON.parse(row.snapshot).validUntil).getTime() < Date.now()) throw new HttpError(409, 'Preventivo scaduto: creare una nuova offerta.');
    if (row.status === 'cancelled' || row.status === 'accepted') throw new HttpError(409, 'Il documento ha già uno stato definitivo.');
    const now = new Date().toISOString();
    const changed = await db.prepare('UPDATE quotations SET status = ?, updated_at = ? WHERE id = ? AND status = ?').bind(status, now, Number(id), row.status).run();
    if (!changed.meta.changes) throw new HttpError(409, 'Il documento è stato aggiornato: ricaricare l’archivio.');
    return json({ quote: toQuote({ ...row, status, updated_at: now }) });
  } catch (error) { return failure(error); }
}
