"""Build the IC Tende catalogue from the supplied PDF; never execute the reference app.

Usage: python scripts/import-catalog.py /absolute/path/to/catalog.pdf
Requires pdfplumber, PyMuPDF and Pillow. Tables are extracted from their original
cells, keeping separate tables/variants and explicit missing prices. Source page
text and a reproducible extraction report are committed for review.
"""
import sys, re, json, hashlib, io, unicodedata
from pathlib import Path
import pdfplumber, fitz
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1])
doc = pdfplumber.open(SOURCE)
images_doc = fitz.open(SOURCE)
text = {i+1: page.extract_text(layout=False) or '' for i,page in enumerate(doc.pages)}
report = []

def slug(s):
    return re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()).strip('-')

def nums(s):
    return re.findall(r'\d+(?:[.,]\d+)?|(?<!\w)-(?!\w)',s or '')

def number(s):
    return float(s.replace(',','.'))

colors = [dict(id=slug(n),label=n,hex=h,basisPoints=0) for n,h in [('Bianco RAL 9010','#eeede5'),('Avorio RAL 1013','#e6dcc3'),('Marrone RAL 8017','#50382e'),('Verde RAL 6005','#214f3d'),('Grigio RAL 7035','#b5b9b4'),('Nero RAL 9005','#242523')]]
catdefs = [
 ('bracci','Tende a bracci','Ombra su misura per balconi e terrazze.',50,'Sun'),
 ('caduta','Tende a caduta','Protezione verticale, privacy e comfort.',14,'PanelTop'),
 ('giardino','Tende giardino','Coperture per terrazzi e grandi spazi.',86,'TreePine'),
 ('cappottine','Cappottine','Forme classiche per finestre e ingressi.',100,'Store'),
 ('orizzontali','Tende orizzontali','Schermature per verande e giardini d’inverno.',116,'Layers'),
 ('gazebi','Gazebi','Strutture indipendenti per vivere all’aperto.',206,'Tent'),
 ('pergole','Pergoltende','Spazi da abitare, in ogni stagione.',124,'House'),
 ('tecniche','Veneziane e zanzariere','Luce, protezione e dettagli per gli interni.',234,'Blinds'),
 ('ombrelloni','Ombrelloni','Soluzioni per il giardino e l’ospitalità.',224,'Umbrella'),
]
categories=[]
out=ROOT/'public/catalog';out.mkdir(parents=True,exist_ok=True)

def picture(page, key):
    path=out/(key+'.webp')
    if path.exists(): return '/catalog/'+path.name
    imgs=images_doc[page-1].get_images(full=True)
    if not imgs:return ''
    img=max(imgs,key=lambda a:a[2]*a[3] if a[2]>500 and a[3]>300 else 0)
    info=images_doc.extract_image(img[0]);im=Image.open(io.BytesIO(info['image'])).convert('RGB')
    im.thumbnail((1600,1100));im.save(path,'WEBP',quality=86)
    return '/catalog/'+path.name

for cid,name,desc,page,icon in catdefs:
    categories.append(dict(id=cid,name=name,description=desc,image=picture(page,cid),icon=icon))

def tables(page):
    if page==25:
        widths=[125,150,200,243,300,350,400,480];cells=[]
        for line in text[page].splitlines():
            match=re.match(r'^\s*(200|230|260|300)\s*(\+\s*M|senza\s*M)\s+(.*)$',line)
            if match:
                values=nums(match[3])
                if len(values)==len(widths):
                    cells.extend(dict(widthCm=w,depthCm=int(match[1]),cents=round(number(v)*100),dimensionLabel=match[1]+' '+match[2]) for w,v in zip(widths,values))
        return [('Sporgenza Larghezza',cells)] if cells else []
    results=[]
    for table in doc.pages[page-1].extract_tables():
        head=' '.join(str(c or '') for row in table[:3] for c in row)
        if 'sporgenza' not in head.lower(): continue
        xi=None;xs=None;yc=0
        for index,row in enumerate(table[:5]):
            for ci,cell in enumerate(row):
                n=nums(cell)
                if len(n)>=3 and all(v!='-' for v in n) and not re.search(r'[A-Za-z]',cell or ''):
                    # A merged header cell contains the full width axis.
                    xi=index;xs=[number(v) for v in n];yc=ci-1;break
            if xs:break
        if not xs: continue
        cells=[];pending=[];previous=None
        for row in table[xi+1:]:
            label=(row[yc] or '').strip()
            if label:
                if not re.match(r'^\d',label):continue
                pending=[(number(nums(l)[0]),l.replace('\n',' ')) for l in label.splitlines() if nums(l)]
            if not pending:continue
            values=[]
            for cell in row[yc+1:]: values+=nums(cell)
            if len(values)<len(xs):continue
            depth,dimlabel=pending.pop(0)
            # Motorisation/accessory tables never have a dimensional width header.
            for width,value in zip(xs,values[:len(xs)]):
                if value=='-':continue
                price=number(value)
                if price<=0:continue
                cells.append(dict(widthCm=width,depthCm=depth,cents=round(price*100),dimensionLabel=dimlabel))
        if cells:results.append((head,cells))
    return results

def extract_options(page):
    """Only options whose amount and unit are explicit on the model's own page."""
    options=[]
    raw=text[page]
    for line in raw.splitlines():
        # Tissue percentage choices apply to the base product, not to motors.
        if '+' in line and '%' in line and not re.search(r'(?i)led|comando',line):
            mat=re.search(r'(.+?)\s*\+\s*(\d+)\s*%',line)
            if mat:
                label=mat[1].strip('• .-');pct=int(mat[2])
                if len(label)>5 and pct<=50 and len(label)<115:
                    group='cucitura' if 'TENARA' in label else 'confezione' if 'simmetrico' in label.lower() else 'tessuto'
                    options.append(dict(id='tessuto-'+slug(label),label=label,unit='percent',basisPoints=pct*100,group=group,page=page))
    # Rich, reviewed motor and accessory options for California, read from p.51.
    if page==51:
        for id,label,price,group,unit,requires in [
          ('ic-standard','IC Tende · motore standard',120,'motore','piece',[]),
          ('ic-soccorso','IC Tende · motore con soccorso',170,'motore','piece',[]),
          ('ic-radio-meccanico','IC Tende · motore radio meccanico',220,'motore','piece',[]),
          ('ic-radio-elettronico','IC Tende · motore radio elettronico',280,'motore','piece',[]),
          ('ic-radio-soccorso','IC Tende · motore radio con soccorso',270,'motore','piece',[]),
          ('ic-kit','IC Tende · kit centralina e telecomando',120,'controllo','piece',['ic-standard','ic-soccorso']),
          ('tettuccio','Tettuccio di protezione',87,'tettuccio','width-m',[]),
          ('tappi','Tappi per tettuccio · coppia',72,'tappi','piece',['tettuccio']),
          ('molla','Molla di compensazione',105,'molla','piece',[]),
        ]:
            options.append(dict(id=id,label=label,cents=price*100,group=group,unit=unit,page=page,requires=requires))
    return options

def create(name,cat,tech,pages,labels=None,review=False):
    variants=[]
    for page in pages:
        tab=tables(page)
        for n,(head,cells) in enumerate(tab):
            # Rows +M and senza M are distinct configurations, not duplicate prices.
            dimlabels=set(c['dimensionLabel'] for c in cells)
            subsets=[('Con mantovana',[c for c in cells if 'senza' not in c['dimensionLabel'].lower()]),('Senza mantovana',[c for c in cells if 'senza' in c['dimensionLabel'].lower()])] if any('senza' in l.lower() for l in dimlabels) else [('',cells)]
            for suffix,sub in subsets:
                if not sub:continue
                if labels: label=labels[min(len(variants),len(labels)-1)]
                elif cat=='pergole':label=f'{pages.index(page)+1} campat'+('a' if pages.index(page)==0 else 'e')
                elif cat=='giardino':label='Tenda affiancata' if 'AFFIANCATA' in head else 'Tenda singola'
                elif name=='Roll':label='Con cassonetto' if n==0 else 'Senza cassonetto'
                elif name in ['Olanda','Dubai-350']:label='LED integrati' if n else 'Standard'
                else:label='Standard' if len(tab)==1 else f'Tabella {n+1}'
                if suffix:label=suffix
                cleaned=[{k:v for k,v in cell.items() if k!='dimensionLabel'} for cell in sub]
                # Missing dash cells remain missing. Red price cells require technical review.
                rednums=set()
                for w in doc.pages[page-1].extract_words(extra_attrs=['non_stroking_color']):
                    col=w.get('non_stroking_color');val=w['text']
                    if isinstance(col,(list,tuple)) and len(col)>=3 and col[0]>.7 and col[1]<.35 and col[2]<.35 and re.fullmatch(r'\d+',val):rednums.add(int(val)*100)
                for cell in cleaned:
                    if cell['cents'] in rednums:cell['special']=True
                variants.append(dict(id=f'v-{page}-{n}-{len(variants)}',label=label,page=page,cells=cleaned))
    # Technical descriptions stop before dimensions/colours, keeping the source wording.
    desc=text[tech]
    desc=re.split(r'COLORI|DATI TECNICI|CARATTERISTICHE',desc)[0]
    desc=re.sub(r'UNI\s*EN\s*13561','',desc)
    desc=' '.join(desc.split())[:380]
    allowed=[c.copy() for c in colors if c['label'].split(' RAL')[0].upper() in text[tech].upper()]
    if not allowed:allowed=[colors[0].copy()]
    p=dict(id=slug(name),name=name,categoryId=cat,type='grid',image=picture(tech,slug(name)),description=desc,pages=pages,technicalPage=tech,review='checked' if review else 'pending',reviewNote='Tabelle e regole principali confrontate con il PDF.' if review else 'Estrazione da PDF: verifica tecnica e commerciale richiesta prima dell’emissione.',variants=variants,fixed=[],colors=allowed,options=extract_options(pages[0]),notes=[])
    if cat=='pergole':
        p['notes'].append('Verificare campate, fissaggi, altezza e condizioni di posa prima dell’ordine.')
        if 'MINIMA INCLINAZIONE UTILE 10%' in text[pages[0]]:p['notes'].append('Inclinazione minima utile: 10%.')
        p['notes'].append('Motorizzazione e dotazioni di serie da confermare sulla scheda tecnica; nessun motore aggiunto automaticamente.')
    if cat=='bracci':
        mat=re.search(r'ALMENO\s*(\d+)\s*cm',text[pages[0]],re.I)
        if mat:p['minimumDifferenceCm']=int(mat[1])
        p['notes'].append('Le celle speciali del listino richiedono verifica dei bracci e del montaggio.')
    if not variants:p['notes'].append('Tabella non estratta in modo affidabile: richiedere un preventivo manuale.')
    products.append(p);report.append(dict(id=p['id'],pages=pages,variants=len(variants),cells=sum(len(v['cells']) for v in variants),status=p['review']))
    return p

products=[]
bracci=[('California',50),('Malta',52),('Caraibi',54),('Austria',56),('Mexico',58),('Europa',60),('Mexico Plus',62),('Hollywoodiana',64),('Marcesa 300',66),('New Orly',68),('Olanda',70),('Maximus',72),('Elite',74),('Riobox-400',76),('Dubai-350',78),('Barcellona',80),('Barcellona Sombrex',82)]
for name,page in bracci:create(name,'bracci',page,[page+1],review=name=='California')
caduta=[('3000',14),('5000',16),('3000 con cavetti senza cassonetto',18),('3000 con cavetti e cassonetto',20),('3000 con guide',22),('7000',24),('T4 con cassonetto',26),('T4 senza cassonetto',28),('6000 Retrò',30),('Inox',32),('Classique',34),('Crystal',36),('Balaustra autoportante',38),('Balaustra',40),('Balaustra con cornice',42),('Callas Zip',44),('Londra',46)]
for name,page in caduta:create(name,'caduta',page,[page+1])
for name,page in [('America',86),('Maxi',88),('Maxi con Telo Unico',90),('Mini',92),('America Box',94),('Maxi Box',96)]:create(name,'giardino',page,[page+1])
for name,page in [('Standard',100),('Prolungata',102),('Gradini',104),('Cupola',106),('Barletta',108),('Fissa',110),('Fissa K35',112)]:create(name,'cappottine',page,[page+1])
for name,page in [('New Millenium',116),('Nuvola',118),('Roll',120)]:create(name,'orizzontali',page,[page+1])
pergole=[('Summer Winter Addossata',124),('Summer Winter Autoportante',128),('Summer Winter Wood Addossata',132),('Summer Winter Wood Autoportante',136),('Summer Winter Wings',140),('Summer Winter Veil',144),('Minù Addossata',148),('Minù Autoportante',152),('Shine Addossata',156),('Shine Autoportante',160),('Master Addossata',164),('Master Autoportante',168),('Linear Addossata',172),('Linear Autoportante',176),('Klima 120 Addossata',180),('Klima 120 Autoportante',186),('Klima 200 Addossata',192),('Klima 200 Autoportante',198)]
for name,page in pergole:
    pp=list(range(page+1,page+(6 if page>=180 else 4)))
    create(name,'pergole',page,pp)

def fixed_product(name,cat,tech,page):
    p=dict(id=slug(name),name=name,categoryId=cat,type='fixed',image=picture(tech,slug(name)),description='Configurazioni e materiali dal listino originale IC Tende.',pages=[page],technicalPage=tech,review='pending',reviewNote='Verificare variante, materiale e dotazioni con il produttore.',variants=[],fixed=[],colors=[colors[0].copy()],options=[],notes=['Altri colori e lavorazioni richiedono una quotazione dedicata.'])
    # Tables preserve every material column instead of discarding secondary prices.
    for ti,table in enumerate(doc.pages[page-1].extract_tables()):
        header=table[0]
        if not re.search('(?i)dimension', ' '.join(c or '' for c in header)):continue
        dims=[]
        for row in table[1:]:
            if row[0]:dims=re.findall(r'\d+\s*[xX×]\s*\d+',row[0])
            if not dims:continue
            dim=dims.pop(0)
            for ci,cell in enumerate(row[1:],1):
                if cell and re.fullmatch(r'\d+(?:[.,]\d+)?',cell.strip()):
                    label=re.sub(r'\s+',' ',header[ci] or f'Materiale {ci}')
                    p['fixed'].append(dict(id=f'f-{ti}-{len(p["fixed"])}',label=f'{dim} cm · {label}',cents=round(number(cell)*100)))
    if not p['fixed']:p['notes'].append('Prezzi da inserire dopo verifica: tabella complessa.')
    products.append(p)

for name,tech in [('Flat autoportante',206),('Flat addossata',208),('Pluvio Punta',210),('Maxi Small',212),('Malaga Punta',214),('Pagoda Evolution',216),('Multi Pagoda',218),('Pluvio Curvo',220)]:fixed_product(name,'gazebi',tech,tech+1)
for name,tech in [('Maldive',224),('Margherita',225),('Nicholas',226),('Double',227),('Tulipano',228),('Mirò',229),('Rosy',230),('Primula',231)]:fixed_product(name,'ombrelloni',tech,tech)

def sqm(name,price,page,minimum=1.5,minheight=0,minwidth=0):
    p=dict(id=slug(name),name=name,categoryId='tecniche',type='sqm',image=picture(page,'tecniche-'+str(page)),description='Prezzo al metro quadro con minimo fatturabile del produttore.',pages=[page],technicalPage=page,review='checked',reviewNote='Tariffa e minimo fatturabile trascritti dalla pagina indicata.',variants=[],fixed=[],colors=[colors[0].copy()],options=[],notes=[],sqmCents=round(price*100),minSqm=minimum,minHeightCm=minheight,minWidthCm=minwidth)
    if name.startswith('Zanzariera'):p['notes'].append('Misure FINITE. Per misure LUCE confermare la detrazione di 3 mm prima dell’ordine.')
    products.append(p)

sqm('Veneziana 35 mm',39,234,1.5,0,40);sqm('Veneziana 50 mm',29,234)
for size,rates in [(15,[41,42,41,49]),(25,[34,35,34,42])]:
    for label,rate in zip(['Standard','Metallizzato','Star','Traforato'],rates):sqm(f'Veneziana {size} mm {label}',rate,235)
sqm('Veneziana 25 mm Legno',63,235)
for name,rate in [('Shantung F.R. ignifugo',32),('Shantung poliestere',29),('Polishantung F.R.',34),('Ancona / Rimini / Capri',41),('Atene',34),('Solar Shade',49),('Linea Morbida',48)]:sqm('Verticale '+name,rate,236,2.5,200)
sqm('Cristal Port',100,237,0)
for name,rate in [('Standard',40),('Flower',46),('Fantasy',52),('Oscurante',86),('Metallizzato',55)]:sqm('Plissè '+name,rate,238)
for name,rate in [('Magique Screen / Metal Series',110),('Sara Blackout FR',98),('Toka Blackout',104),('Toka Art / Toka Fan',100),('Toka 1 / Toka 3',92),('Toka 5 / Toka 10',85),('Duplex / Duplex 5',94),('Duplex 1 / Duplex 3',98),('HGlass',100),('HGlass Blackout',110),('Notte Vinyl H 183',90),('Notte Vinyl H 300',94),('Microscreen',97)]:sqm('Rullo '+name,rate,239)
for name,rate,page,minimum in [('Battente 1 anta',130,242,2.8),('Battente 2 ante',130,242,3.1),('Trasversale',57,242,2.1),('Diana Scorrevole',123,242,2),('Molla',40,242,1.5),('Catena',40,242,1.5),('Fissa 90',31,242,1),('Scorrevole Eco',84,243,2),('Smart 1 anta',100,243,1.5),('Smart 2 ante',100,243,3),('Diva 1 anta',135,244,2),('Diva 2 ante',135,244,4)]:sqm('Zanzariera '+name,rate,page,minimum)

# Full source notes accompany every table; incomplete technical review stays explicit.
data=dict(version='ic-tende-2023-v1',manufacturer='IC Tende',source=dict(name=SOURCE.name,sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),pages=257,edition='Listino IC Tende 2023 · validità prezzi da confermare'),categories=categories,products=products)
(ROOT/'data').mkdir(exist_ok=True)
(ROOT/'data/catalog.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
(ROOT/'data/extraction-report.json').write_text(json.dumps(dict(source=data['source'],products=len(products),tables=report),ensure_ascii=False,indent=2))
(ROOT/'docs/source-pages').mkdir(parents=True,exist_ok=True)
used=sorted(set(pg for p in products for pg in [*p['pages'],p['technicalPage']]))
for page in used:(ROOT/f'docs/source-pages/{page:03}.txt').write_text(text[page])
print(json.dumps(dict(products=len(products),categories=len(categories),variants=sum(len(p['variants']) for p in products),cells=sum(len(v['cells']) for p in products for v in p['variants']),fixed=sum(len(p['fixed']) for p in products),checked=sum(p['review']=='checked' for p in products)),indent=2))
