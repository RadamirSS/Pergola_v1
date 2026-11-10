import { z } from 'zod';
import { catalogSchema, companySchema } from '../../../lib/validation';
import { body, database, failure, HttpError, json, loadWorkspace, mutationGuard, quoteScope } from '../../../lib/server';
export async function PUT(request: Request) {
  try {
    mutationGuard(request);
    if (quoteScope(request)) throw new HttpError(403, 'Area riservata al rivenditore.');
    const data = z.object({ company: companySchema.optional(), catalog: catalogSchema.optional(), review: z.object({ productId: z.string().max(150), status: z.enum(['checked','pending']), note: z.string().min(10).max(500) }).optional() }).parse(await body(request));
    const db = database(); const now = new Date().toISOString(); const statements: D1PreparedStatement[] = [];
    if (data.review) {
      const catalog = data.catalog ?? (await loadWorkspace()).catalog;
      if (!catalog.products.some(product => product.id === data.review!.productId)) throw new HttpError(404, 'Modello da verificare non trovato.');
    }
    for (const key of ['company','catalog'] as const) if (data[key]) statements.push(db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at').bind(key, JSON.stringify(data[key]), now));
    if (data.review) statements.push(db.prepare('INSERT INTO product_reviews (product_id, status, note, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(product_id) DO UPDATE SET status=excluded.status, note=excluded.note, updated_at=excluded.updated_at').bind(data.review.productId, data.review.status, data.review.note, now));
    // A replacement catalogue invalidates previous review overrides.
    if (data.catalog) statements.push(db.prepare('DELETE FROM product_reviews'));
    if (statements.length) await db.batch(statements);
    return json(await loadWorkspace());
  } catch (error) { return failure(error); }
}
