import { calculate } from '../../../lib/pricing';
import { selectionSchema } from '../../../lib/validation';
import { body, failure, HttpError, json, loadWorkspace, mutationGuard } from '../../../lib/server';
export async function POST(request: Request) {
  try {
    mutationGuard(request); const selection = selectionSchema.parse(await body(request));
    const { catalog, company, reviews } = await loadWorkspace();
    const product = catalog.products.find(p => p.id === selection.productId);
    if (!product) throw new HttpError(404, 'Prodotto non trovato.');
    return json(calculate(product, selection, catalog.version, company, reviews[product.id]));
  } catch (error) { return failure(error); }
}
