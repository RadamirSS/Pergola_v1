import test from 'node:test';
import assert from 'node:assert/strict';
import catalogData from '../data/catalog.json' with { type: 'json' };
import { calculate, defaultCompany, emptySelection } from '../lib/pricing.ts';
import { catalogSchema } from '../lib/validation.ts';
import type { Catalog, Product } from '../lib/types.ts';
const catalog = catalogData as Catalog;
const product = (name: string) => catalog.products.find(p => p.name === name)!;
const price = (p: Product, patch = {}) => calculate(p, { ...emptySelection(p), ...patch }, catalog.version, defaultCompany);

test('the complete catalogue satisfies the import contract and references existing images', () => {
  assert.equal(catalogSchema.safeParse(catalog).success, true);
  assert.equal(catalog.categories.length,9);assert.equal(catalog.products.length,133);
  assert.equal(new Set(catalog.products.map(p=>p.id)).size,catalog.products.length);
});
test('California 300 x 200: PDF p.51 base 680 EUR and VAT 149.60 EUR', () => {
  const result=price(product('California'),{widthCm:300,depthCm:200});
  assert.equal(result.baseCents,68000);assert.equal(result.vatCents,14960);assert.equal(result.totalCents,82960);assert.equal(result.issuable,true);
});
test('Summer Winter 2 campate: searches the selected table, not the first matching depth', () => {
  const p=product('Summer Winter Addossata');const variant=p.variants.find(v=>v.page===126)!;
  const result=price(p,{variantId:variant.id,widthCm:500,depthCm:300});
  assert.equal(result.baseCents,789100);assert.equal(result.available,true);assert.equal(result.issuable,false);
  assert.equal(price(p,{variantId:p.variants[0].id,widthCm:500,depthCm:300}).available,false);
});
test('35mm blind enforces minimum 1.50 square metres and 40cm minimum width', () => {
  const p=product('Veneziana 35 mm');const result=price(p,{widthCm:50,depthCm:100});
  assert.equal(result.areaSqm,.5);assert.equal(result.billedAreaSqm,1.5);assert.equal(result.baseCents,5850);
  assert.equal(price(p,{widthCm:39,depthCm:100}).available,false);
});
test('vertical blinds enforce billable height as well as minimum area', () => {
  const result=price(product('Verticale Atene'),{widthCm:200,depthCm:100});
  assert.equal(result.billedAreaSqm,4);assert.equal(result.baseCents,13600);
});
test('insect screen minimum differs by number of leaves', () => {
  assert.equal(price(product('Zanzariera Battente 1 anta'),{widthCm:100,depthCm:100}).baseCents,36400);
  assert.equal(price(product('Zanzariera Battente 2 ante'),{widthCm:100,depthCm:100}).baseCents,40300);
});
test('unlisted dimensions never interpolate a price', () => assert.equal(price(product('California'),{widthCm:301,depthCm:200}).available,false));
test('red/special cells cannot become offers even after model approval', () => {
  const p=product('California');const result=price(p,{widthCm:245,depthCm:250});
  assert.equal(result.available,true);assert.equal(result.issuable,false);assert.ok(result.warnings.some(w=>w.includes('special')));
});
test('options use actual piece / metre / percentage units and reject duplicate or incompatible groups', () => {
  const p=product('California');const s={widthCm:300,depthCm:200,optionIds:['ic-standard','tettuccio','tappi']};
  assert.equal(price(p,s).productCents,113300);
  assert.equal(price(p,{...s,optionIds:['tappi']}).available,false);
  assert.equal(price(p,{...s,optionIds:['ic-standard','ic-soccorso']}).available,false);
  assert.equal(price(p,{...s,optionIds:['ic-standard','ic-standard']}).available,false);
  assert.equal(price(p,{...s,optionIds:['invented-motor']}).available,false);
});
test('quantity, product discount, installation and transport have a defined order', () => {
  const result=price(product('California'),{widthCm:300,depthCm:200,quantity:2,discountBasisPoints:1000,installationCents:10000,deliveryCents:5000});
  assert.equal(result.productCents,136000);assert.equal(result.discountCents,13600);assert.equal(result.subtotalCents,137400);assert.equal(result.vatCents,30228);assert.equal(result.totalCents,167628);
});
test('negative, fractional quantities and nonfinite amounts are rejected', () => {
  const p=product('California');for(const patch of [{quantity:1.5},{quantity:0},{quantity:101},{deliveryCents:-1},{discountBasisPoints:9000},{widthCm:NaN}])assert.equal(price(p,patch).available,false);
});
test('manual review revocation is effective; an approval does not fill missing cells', () => {
  const p=product('California');const s={...emptySelection(p),widthCm:300,depthCm:200};
  assert.equal(calculate(p,s,catalog.version,defaultCompany,{status:'pending',note:'Revoked',updatedAt:''}).issuable,false);
  assert.equal(calculate(p,{...s,widthCm:301},catalog.version,defaultCompany,{status:'checked',note:'Approved',updatedAt:''}).available,false);
});
test('all extracted cells are reachable in their own variant and retain exact source amounts', () => {
  let count=0;
  for(const p of catalog.products)for(const v of p.variants)for(const cell of v.cells){
    const result=price(p,{variantId:v.id,widthCm:cell.widthCm,depthCm:cell.depthCm});
    assert.equal(result.baseCents,cell.cents,`${p.name} ${v.label} ${cell.widthCm}x${cell.depthCm}`);count++;
  }
  assert.ok(count>7500);
});
test('same-depth alternatives remain distinct: Olanda LED and 5000 mantovana', () => {
  const p=product('Olanda');assert.notEqual(price(p).baseCents,price(p,{variantId:p.variants[1].id}).baseCents);
  const q=product('5000');const a=q.variants[0],b=q.variants[1];
  assert.equal(price(q,{variantId:a.id,widthCm:300,depthCm:300}).baseCents,38300);
  assert.equal(price(q,{variantId:b.id,widthCm:300,depthCm:300}).baseCents,36100);
});
