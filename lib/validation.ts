import { z } from 'zod';
const cents = z.number().int().min(0).max(100000000);
const id = z.string().min(1).max(150);
export const selectionSchema = z.object({
  productId: id, variantId: z.string().max(150), widthCm: z.number().positive().max(3000), depthCm: z.number().positive().max(3000),
  fixedId: z.string().max(150), colorId: id, optionIds: z.array(id).max(30), quantity: z.number().int().min(1).max(100),
  installationCents: cents, deliveryCents: cents, discountBasisPoints: z.number().int().min(0).max(5000),
});
const field = z.string().trim().max(500);
export const clientSchema = z.object({ name: field.min(1), address: field, email: z.union([z.literal(''), z.string().email().max(254)]), phone: field, notes: z.string().trim().max(3000) });
export const companySchema = z.object({ name: field.min(1), address: field, vatNumber: field, email: z.union([z.literal(''), z.string().email().max(254)]), phone: field, validityDays: z.number().int().min(1).max(365), vatBasisPoints: z.number().int().min(0).max(3000), terms: z.string().max(4000) });
const cell = z.object({ widthCm: z.number().positive().max(3000), depthCm: z.number().positive().max(3000), cents: cents.positive(), special: z.boolean().optional() });
const productSchema = z.object({
  id, name: field.min(1), categoryId: id, type: z.enum(['grid', 'sqm', 'fixed']), image: z.string().regex(/^\/catalog\/[\w.-]+\.webp$/).or(z.literal('')),
  description: z.string().max(3000), pages: z.array(z.number().int().min(1).max(10000)).max(30), technicalPage: z.number().int().min(1),
  review: z.enum(['checked','pending']), reviewNote: field,
  variants: z.array(z.object({ id, label: field, page: z.number().int().min(1), cells: z.array(cell).max(3000) })).max(30),
  fixed: z.array(z.object({ id, label: field, cents: cents.positive() })).max(1000),
  sqmCents: cents.positive().optional(), minSqm: z.number().min(0).max(1000).optional(), minHeightCm: z.number().min(0).max(3000).optional(), minWidthCm: z.number().min(0).max(3000).optional(),
  colors: z.array(z.object({ id, label: field, hex: z.string().regex(/^#[a-fA-F0-9]{6}$/), basisPoints: z.number().int().min(0).max(10000) })).min(1).max(100),
  options: z.array(z.object({ id, label: field, cents: cents.optional(), basisPoints: z.number().int().min(0).max(10000).optional(), unit: z.enum(['piece','width-m','percent']), group: id, requires: z.array(id).max(30).optional(), page: z.number().int().min(1) })).max(100),
  notes: z.array(z.string().max(1500)).max(30), minimumDifferenceCm: z.number().min(0).max(500).optional(),
});
export const catalogSchema = z.object({ version: id, manufacturer: field.min(1), source: z.object({ name: field, sha256: z.string().regex(/^[a-f0-9]{64}$/), pages: z.number().int().positive(), edition: field }), categories: z.array(z.object({ id, name: field, description: field, image: z.string().max(200), icon: field })).min(1).max(30), products: z.array(productSchema).min(1).max(400) }).superRefine((catalog, ctx) => {
  const unique = new Set<string>(), cats = new Set(catalog.categories.map(c => c.id));
  for (const p of catalog.products) {
    if (unique.has(p.id) || !cats.has(p.categoryId)) ctx.addIssue({ code: 'custom', message: 'ID prodotto duplicato o categoria mancante.' });
    unique.add(p.id);
    const variants = new Set<string>();
    for (const v of p.variants) {
      if (variants.has(v.id)) ctx.addIssue({ code: 'custom', message: 'ID variante duplicato.' });
      variants.add(v.id);
      const cells = new Set<string>();
      for (const c of v.cells) { const key = `${c.widthCm}:${c.depthCm}`; if (cells.has(key)) ctx.addIssue({ code: 'custom', message: `Cella duplicata in ${p.name}.` }); cells.add(key); }
    }
  }
});
