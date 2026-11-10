import test from 'node:test';
import assert from 'node:assert/strict';
import messages from '../lib/i18n/messages.json' with { type: 'json' };
import { formatEuro, normalizeLocale, translateText } from '../lib/i18n/index.ts';
import { calculate, defaultCompany, emptySelection } from '../lib/pricing.ts';
import catalogue from '../data/catalog.json' with { type: 'json' };
import type { Product } from '../lib/types.ts';

test('all translation entries have complete English and Russian values', () => {
  assert.ok(Object.keys(messages).length > 300);
  for (const [key, value] of Object.entries(messages)) {
    assert.ok(key.trim() && value.en.trim() && value.ru.trim(), key);
    assert.equal(translateText(key, 'it'), key);
    assert.equal(translateText(key, 'en'), value.en);
    assert.equal(translateText(key, 'ru'), value.ru);
  }
});

test('locale selection, dynamic messages and catalogue labels are localized', () => {
  assert.equal(normalizeLocale('ru-RU'), 'ru');
  assert.equal(normalizeLocale('en-GB'), 'en');
  assert.equal(normalizeLocale('unknown'), 'it');
  assert.equal(translateText('California · Standard', 'ru'), 'California · Стандарт');
  assert.equal(translateText('Larghezza minima 40 cm.', 'en'), 'Minimum width 40 cm.');
  assert.match(translateText('Applicato minimo fatturabile: 1,5 m².', 'ru'), /1,5 м²/);
  assert.equal(translateText('300 × 200 cm · 1 pezzo', 'ru'), '300 × 200 см · 1 шт.');
  assert.match(translateText('  Scarica PDF ', 'ru'), /^  Скачать PDF $/);
  assert.equal(translateText('PG-2026-00001', 'ru'), 'PG-2026-00001');
});

test('localization preserves quotation amounts, catalogue IDs and saved source data', () => {
  const product = catalogue.products.find(p => p.id === 'california') as Product;
  const result = calculate(product, { ...emptySelection(product), widthCm: 300, depthCm: 200 }, catalogue.version, defaultCompany);
  const snapshot = JSON.stringify(result);
  for (const locale of ['it', 'en', 'ru'] as const) {
    result.lines.forEach(line => translateText(line.label, locale));
    formatEuro(result.totalCents, locale);
    assert.equal(result.totalCents, 82960);
    assert.equal(JSON.stringify(result), snapshot);
  }
  assert.match(formatEuro(82960, 'en'), /829\.60/);
  assert.match(formatEuro(82960, 'ru'), /829,60/);
});
