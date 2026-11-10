import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { fontBase64 } from './pdf-font';
import type { Quote } from './types';
import { formatEuro, formatDate, translateText, type Locale } from './i18n/index';

/** Downloadable PDF built from the immutable quote snapshot. */
export async function createQuotePdf(quote: Quote, locale: Locale = 'it') {
  const t = (text: string) => translateText(text, locale);
  const euro = (cents: number) => formatEuro(cents, locale);
  const date = (value: string) => formatDate(value, locale);
  const pdf = await PDFDocument.create();pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(Uint8Array.from(atob(fontBase64), c => c.charCodeAt(0)), { subset: true });
  const ink = rgb(.12,.2,.17), muted = rgb(.4,.43,.4), gold = rgb(.62,.45,.25);
  let page = pdf.addPage([595.28,841.89]), y = 788;
  const snap = quote.snapshot;
  const newPage = () => { page = pdf.addPage([595.28,841.89]); y = 788; };
  const draw = (text: string, size = 10, color = ink, x = 45) => {
    const words = String(text).replace(/\r/g,'').split(/\s+/); let line = '';
    for (const word of words) {
      const chunks: string[] = []; let chunk = '';
      for (const char of word) { if (font.widthOfTextAtSize(chunk + char,size)>490) { chunks.push(chunk);chunk=''; } chunk+=char; }
      if (chunk) chunks.push(chunk);
      for (const bit of chunks) {
        if (line && font.widthOfTextAtSize(line+' '+bit,size)>500) { if (y<65)newPage(); page.drawText(line,{x,y,size,font,color});y-=size+6;line=bit; }
        else line=line?line+' '+bit:bit;
      }
    }
    if (line) { if(y<65)newPage();page.drawText(line,{x,y,size,font,color});y-=size+6; }
  };
  draw(snap.company.name,26);draw(t('CONFIGURAZIONI SU MISURA'),8,gold);y-=13;
  draw(`${quote.number} · ${date(quote.createdAt)}`,13);
  const labels = { draft:'BOZZA - NON COSTITUISCE OFFERTA', review:'RICHIESTA DI VERIFICA - NON COSTITUISCE OFFERTA', issued:'PREVENTIVO', accepted:'ORDINE CONFERMATO INTERNAMENTE', cancelled:'DOCUMENTO ANNULLATO' };
  draw(t(labels[quote.status]),10,gold);y-=10;
  draw([snap.company.address,snap.company.vatNumber && `P. IVA ${snap.company.vatNumber}`,snap.company.email,snap.company.phone].filter(Boolean).join(' · '),9,muted);
  y-=12;draw(t('CLIENTE'),9,gold);draw(snap.client.name,13);draw([snap.client.address,snap.client.email,snap.client.phone].filter(Boolean).join(' · '),10);y-=12;
  draw(t('CONFIGURAZIONE'),9,gold);draw(t(snap.calculation.productName),17);draw(t(snap.calculation.variantLabel));
  draw(`${t('Misure')}: ${snap.selection.widthCm} x ${snap.selection.depthCm} ${t('cm')} · ${t('Finitura')}: ${t(snap.calculation.colorLabel)} · ${t('Quantità')}: ${snap.selection.quantity}`);
  y-=10;
  for (const line of snap.calculation.lines) draw(`${t(line.label)} | ${line.quantity} ${t(line.unit)} | ${euro(line.cents)}${line.page ? ` | p. ${line.page}` : ''}`,10);
  y-=12;draw(`${t('Imponibile')}: ${euro(snap.calculation.subtotalCents)}`,12);draw(`${t('IVA')} ${snap.company.vatBasisPoints/100}%: ${euro(snap.calculation.vatCents)}`,12);draw(`${t('TOTALE')}: ${euro(snap.calculation.totalCents)}`,20);y-=12;
  for (const warning of snap.calculation.warnings) draw(t(warning),9,gold);
  if(snap.client.notes) {y-=8;draw(t('NOTE DEL CLIENTE'),9,gold);draw(snap.client.notes,10);}
  y-=12;draw(`${t('Valido fino al')} ${date(snap.validUntil)}.`,9,muted);
  draw(t(snap.company.terms),9,muted);draw(`${t('Fonte')}: ${snap.source.edition}. ${t('Pagine')}: ${snap.calculation.pages.join(', ')}. ${t('Versione')}: ${snap.calculation.catalogVersion}.`,8,muted);draw(t('La conferma interna non invia automaticamente ordini al produttore.'),8,muted);
  const pages=pdf.getPages();for(let i=0;i<pages.length;i++)pages[i].drawText(`${quote.number} | ${i+1} / ${pages.length}`,{x:45,y:30,size:8,font,color:muted});
  pdf.setTitle(`${quote.number} - ${snap.calculation.productName}`);pdf.setAuthor(snap.company.name);return pdf.save();
}
