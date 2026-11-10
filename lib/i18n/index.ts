import messages from './messages.json' with { type: 'json' };

export type Locale = 'it' | 'en' | 'ru';
export const locales = { it: 'it-IT', en: 'en-GB', ru: 'ru-RU' } as const;
export function normalizeLocale(value: string | null | undefined): Locale {
  const language = value?.toLowerCase().split(/[-_,;]/)[0];
  return language === 'en' || language === 'ru' ? language : 'it';
}
export const formatEuro = (cents: number, locale: Locale) => new Intl.NumberFormat(locales[locale], { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const formatDate = (value: string, locale: Locale) => new Date(value).toLocaleDateString(locales[locale], { timeZone: 'Europe/Rome' });
const dictionary = messages as Record<string, { en: string; ru: string }>;
const modelTerms: Array<[RegExp, string, string]> = [
  [/^Veneziana\b/, 'Venetian blind', 'Горизонтальные жалюзи'],
  [/^Verticale\b/, 'Vertical blind', 'Вертикальные жалюзи'],
  [/^Rullo\b/, 'Roller blind', 'Рулонная штора'],
  [/^Plissè\b/, 'Pleated blind', 'Штора плиссе'],
  [/^Zanzariera\b/, 'Insect screen', 'Москитная сетка'],
  [/\bAddossata\b/gi, 'wall-mounted', 'пристенная'],
  [/\bAutoportante\b/gi, 'freestanding', 'отдельно стоящая'],
  [/\bcon Telo Unico\b/gi, 'with a single fabric panel', 'с цельным полотном'],
  [/\bcon cornice\b/gi, 'with frame', 'с рамой'],
  [/\bcon cavetti e cassonetto\b/gi, 'with cables and cassette', 'с тросами и кассетой'],
  [/\bcon cavetti senza cassonetto\b/gi, 'with cables, without cassette', 'с тросами, без кассеты'],
  [/\bcon guide\b/gi, 'with guides', 'с направляющими'],
  [/\bBattente\b/gi, 'hinged', 'распашная'],
  [/\bScorrevole\b/gi, 'sliding', 'раздвижная'],
  [/\bTrasversale\b/gi, 'horizontal', 'горизонтальная'],
  [/\bFissa\b/gi, 'fixed', 'фиксированная'],
  [/\bCatena\b/gi, 'chain-operated', 'с цепным управлением'],
  [/\bMolla\b/gi, 'spring-operated', 'с пружинным механизмом'],
  [/\b(\d+) ante?\b/gi, '$1 panels', '$1 створки'],
  [/\bAlluminio\b/gi, 'aluminium', 'алюминий'],
  [/\bLegno\b/gi, 'wood', 'дерево'],
  [/\bMetallizzato\b/gi, 'metallic', 'металлик'],
  [/\bTraforato\b/gi, 'perforated', 'перфорированные'],
  [/\bignifugo\b/gi, 'fire-retardant', 'огнестойкие'],
  [/\bpoliestere\b/gi, 'polyester', 'полиэстер'],
  [/\bOscurante\b/gi, 'blackout', 'затемняющая'],
];

/** Translates display text only. Catalogue IDs, amounts and saved snapshots stay unchanged. */
export function translateText(value: string, locale: Locale): string {
  if (locale === 'it' || !value.trim()) return value;
  const text = value.trim();
  const translated = dictionary[text]?.[locale];
  if (translated) return value.replace(text, translated);
  const en = locale === 'en';
  let match: RegExpMatchArray | null;
  if ((match = text.match(/^(\d+) modelli$/))) return en ? `${match[1]} models` : `${match[1]} моделей`;
  if ((match = text.match(/^(\d+) (pezzo|pezzi)$/))) return en ? `${match[1]} ${match[1] === '1' ? 'item' : 'items'}` : `${match[1]} шт.`;
  if ((match = text.match(/^Larghezza minima ([\d.,]+) cm\.$/))) return en ? `Minimum width ${match[1]} cm.` : `Минимальная ширина ${match[1]} см.`;
  if ((match = text.match(/^Sconto commerciale ([\d.,]+)% sui prodotti$/))) return en ? `Commercial discount ${match[1]}% on products` : `Коммерческая скидка ${match[1]}% на продукцию`;
  if ((match = text.match(/^Il listino richiede larghezza almeno (\d+) cm superiore alla sporgenza\. Verificare eventuali bracci speciali\.$/))) return en ? `Width must exceed projection by at least ${match[1]} cm. Check any special arms.` : `Ширина должна превышать вылет минимум на ${match[1]} см. Проверьте необходимость специальных рычагов.`;
  if ((match = text.match(/^(.+): selezionare prima un dispositivo compatibile\.$/))) return `${translateText(match[1], locale)}: ${en ? 'select a compatible device first.' : 'сначала выберите совместимое устройство.'}`;
  if ((match = text.match(/^Applicato minimo fatturabile: ([\d.,]+) m²(?:, altezza fatturabile minima ([\d.,]+) cm)?\.$/))) return en ? `Minimum billable area applied: ${match[1].replace(',', '.')} m²${match[2] ? `, minimum billable height ${match[2]} cm` : ''}.` : `Применена минимальная оплачиваемая площадь: ${match[1]} м²${match[2] ? `, минимальная оплачиваемая высота ${match[2]} см` : ''}.`;
  if ((match = text.match(/^p\. (.+)$/))) return en ? text : `стр. ${match[1]}`;
  if ((match = text.match(/^(.+) — immagine dal catalogo IC Tende$/))) return `${match[1]} — ${en ? 'image from the IC Tende catalogue' : 'изображение из каталога IC Tende'}`;
  if ((match = text.match(/^([\d.,]+) [×x] ([\d.,]+) cm$/))) return `${match[1]} × ${match[2]} ${en ? 'cm' : 'см'}`;
  if ((match = text.match(/^([\d.,]+) m² \/ cad\.$/))) return en ? `${match[1]} m² / each` : `${match[1]} м² / шт.`;
  if ((match = text.match(/^\+([\d.,]+)% base$/))) return en ? `+${match[1]}% of base` : `+${match[1]}% от базы`;
  const prefix = Object.keys(dictionary).filter(key => text.startsWith(key + ' · ')).sort((a, b) => b.length - a.length)[0];
  if (prefix) return `${dictionary[prefix][locale]} · ${translateText(text.slice(prefix.length + 3), locale)}`;
  if (text.includes(' · ')) return text.split(' · ').map(part => translateText(part, locale)).join(' · ');
  if (text.startsWith('Finitura ·')) return text.replace('Finitura', en ? 'Finish' : 'Отделка');
  let result = text;
  for (const [pattern, english, russian] of modelTerms) result = result.replace(pattern, en ? english : russian);
  return result === text ? value : value.replace(text, result);
}
