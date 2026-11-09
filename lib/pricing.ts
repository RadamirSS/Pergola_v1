import type { Calculation, Company, Product, ReviewOverride, Selection } from './types';

export const defaultCompany: Company = {
  name: 'Pergola', address: '', vatNumber: '', email: '', phone: '', validityDays: 30,
  vatBasisPoints: 2200,
  terms: 'Prezzi riferiti al listino IC Tende 2023, da confermare con il produttore. Trasporto e posa esclusi salvo voce esplicita. L’ordine richiede conferma tecnica di misure, fissaggi e dotazioni.',
};
export const emptySelection = (p: Product): Selection => {
  const cell = p.variants[0]?.cells.find(c => !c.special) ?? p.variants[0]?.cells[0];
  const dimensions = p.fixed[0]?.label.match(/(\d+)\s*[x×]\s*(\d+)/);
  return { productId: p.id, variantId: p.variants[0]?.id ?? '', widthCm: cell?.widthCm ?? (dimensions ? Number(dimensions[1]) : 100), depthCm: cell?.depthCm ?? (dimensions ? Number(dimensions[2]) : 150), fixedId: p.fixed[0]?.id ?? '', colorId: p.colors[0]?.id ?? '', optionIds: [], quantity: 1, installationCents: 0, deliveryCents: 0, discountBasisPoints: 0 };
};
const round = (v: number) => Math.round(v + Number.EPSILON);
export const euro = (cents: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);

/** Shared pure engine. The server independently recalculates every saved quote. */
export function calculate(product: Product, s: Selection, version: string, company: Company, review?: ReviewOverride): Calculation {
  const errors: string[] = [], warnings: string[] = [];
  const lines: Calculation['lines'] = [];
  const result: Calculation = { available: false, issuable: false, errors, warnings, lines, productName: product.name, variantLabel: '', colorLabel: '', areaSqm: 0, billedAreaSqm: 0, baseCents: 0, productCents: 0, discountCents: 0, subtotalCents: 0, vatCents: 0, totalCents: 0, catalogVersion: version, pages: product.pages };
  const finite = (v: number, min: number, max: number, integer = false) => Number.isFinite(v) && v >= min && v <= max && (!integer || Number.isInteger(v));
  if (s.productId !== product.id) errors.push('Il prodotto non corrisponde alla configurazione.');
  if (!finite(s.quantity, 1, 100, true)) errors.push('La quantità deve essere un intero tra 1 e 100.');
  if (!finite(s.widthCm, 1, 3000) || !finite(s.depthCm, 1, 3000)) errors.push('Inserire misure valide in centimetri, da 1 a 3000.');
  if (!finite(s.installationCents, 0, 100000000, true) || !finite(s.deliveryCents, 0, 100000000, true)) errors.push('Gli importi di posa e trasporto non sono validi.');
  if (!finite(s.discountBasisPoints, 0, 5000, true)) errors.push('Lo sconto deve essere compreso tra 0 e 50%.');
  if (!finite(company.vatBasisPoints, 0, 3000, true)) errors.push('Aliquota IVA non valida.');
  if (errors.length) return result;
  const color = product.colors.find(c => c.id === s.colorId);
  if (!color) errors.push('Colore non previsto dal listino per questo modello.');
  result.colorLabel = color?.label ?? '';
  result.areaSqm = round(s.widthCm * s.depthCm) / 10000;
  let base = 0, page = product.pages[0];
  if (product.type === 'grid') {
    const variant = product.variants.find(v => v.id === s.variantId);
    const cell = variant?.cells.find(c => c.widthCm === s.widthCm && c.depthCm === s.depthCm);
    result.variantLabel = variant?.label ?? '';
    if (!variant || !cell) errors.push('Questa combinazione di misure non è presente nel listino. Nessuna interpolazione applicata.');
    else {
      base = cell.cents; page = variant.page;
      if (cell.special) warnings.push('Configurazione speciale evidenziata nel listino: verifica tecnica obbligatoria prima dell’emissione.');
      if (product.minimumDifferenceCm && s.widthCm - s.depthCm < product.minimumDifferenceCm) warnings.push(`Il listino richiede larghezza almeno ${product.minimumDifferenceCm} cm superiore alla sporgenza. Verificare eventuali bracci speciali.`);
    }
  } else if (product.type === 'sqm') {
    if (s.widthCm < (product.minWidthCm ?? 0)) errors.push(`Larghezza minima ${product.minWidthCm} cm.`);
    const billed = Math.max(product.minSqm ?? 0, s.widthCm * Math.max(s.depthCm, product.minHeightCm ?? 0) / 10000);
    result.billedAreaSqm = Math.ceil(billed * 10000) / 10000;
    base = round(billed * (product.sqmCents ?? 0));
    if (billed > result.areaSqm) warnings.push(`Applicato minimo fatturabile: ${result.billedAreaSqm.toLocaleString('it-IT')} m²${product.minHeightCm ? `, altezza fatturabile minima ${product.minHeightCm} cm` : ''}.`);
    result.variantLabel = `${euro(product.sqmCents ?? 0)} / m²`;
  } else {
    const fixed = product.fixed.find(f => f.id === s.fixedId);
    if (!fixed) errors.push('Selezionare una variante e un materiale presenti nel listino.');
    else { base = fixed.cents; result.variantLabel = fixed.label; }
  }
  if (!Number.isSafeInteger(base) || base <= 0) errors.push('Prezzo di base non disponibile: richiedere una quotazione manuale.');
  if (errors.length) return result;
  result.baseCents = base;
  lines.push({ label: `${product.name} · ${result.variantLabel}`, quantity: s.quantity, unit: product.type === 'sqm' ? `${result.billedAreaSqm} m² / cad.` : 'cad.', cents: base * s.quantity, page });
  let optionTotal = 0;
  const ids = new Set(s.optionIds);
  if (ids.size !== s.optionIds.length) errors.push('Un accessorio è stato selezionato più volte.');
  const groups = new Set<string>();
  for (const id of ids) {
    const option = product.options.find(o => o.id === id);
    if (!option) { errors.push('Accessorio non disponibile per questo prodotto.'); continue; }
    if (groups.has(option.group)) errors.push('Selezionare una sola opzione per ciascun gruppo.');
    groups.add(option.group);
    if (option.requires?.length && !option.requires.some(r => ids.has(r))) errors.push(`${option.label}: selezionare prima un dispositivo compatibile.`);
    const amount = option.unit === 'percent' ? round(base * (option.basisPoints ?? 0) / 10000) : option.unit === 'width-m' ? round(s.widthCm / 100 * (option.cents ?? 0)) : (option.cents ?? 0);
    optionTotal += amount;
    lines.push({ label: option.label, quantity: s.quantity, unit: option.unit === 'width-m' ? `${s.widthCm / 100} m / cad.` : option.unit === 'percent' ? `+${(option.basisPoints ?? 0) / 100}% base` : 'cad.', cents: amount * s.quantity, page: option.page });
  }
  const colorExtra = round(base * (color?.basisPoints ?? 0) / 10000);
  if (colorExtra) lines.push({ label: `Finitura · ${color?.label}`, quantity: s.quantity, unit: 'cad.', cents: colorExtra * s.quantity, page });
  result.productCents = (base + optionTotal + colorExtra) * s.quantity;
  result.discountCents = round(result.productCents * s.discountBasisPoints / 10000);
  if (result.discountCents) lines.push({ label: `Sconto commerciale ${s.discountBasisPoints / 100}% sui prodotti`, quantity: 1, unit: '', cents: -result.discountCents });
  if (s.installationCents) lines.push({ label: 'Posa in opera · importo concordato', quantity: 1, unit: 'totale', cents: s.installationCents });
  if (s.deliveryCents) lines.push({ label: 'Trasporto · importo concordato', quantity: 1, unit: 'totale', cents: s.deliveryCents });
  result.subtotalCents = result.productCents - result.discountCents + s.installationCents + s.deliveryCents;
  result.vatCents = round(result.subtotalCents * company.vatBasisPoints / 10000);
  result.totalCents = result.subtotalCents + result.vatCents;
  const checked = review?.status === 'checked' || (!review && product.review === 'checked');
  if (!checked) warnings.push('Dati estratti dal catalogo: verifica del modello richiesta. È possibile salvare una richiesta di verifica, non emettere un’offerta.');
  result.available = errors.length === 0;
  result.issuable = result.available && checked && !warnings.some(w => /speciale|obbligatoria|bracci speciali/.test(w));
  return result;
}
