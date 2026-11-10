import { authorize, database, failure, HttpError, toQuote, quoteScope } from '../../../../../lib/server';
import { createQuotePdf } from '../../../../../lib/pdf';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    authorize(request);const { id } = await context.params;
    const row = await database().prepare("SELECT * FROM quotations WHERE id = ? AND (? = '' OR owner_id = ?)").bind(Number(id), quoteScope(request), quoteScope(request)).first<Parameters<typeof toQuote>[0]>();
    if (!row) throw new HttpError(404,'Preventivo non trovato.');
    const quote = toQuote(row);const pdf = await createQuotePdf(quote);
    return new Response(new Uint8Array(pdf),{ headers:{ 'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${quote.number}.pdf"`,'Cache-Control':'no-store' } });
  } catch(error) { return failure(error); }
}
