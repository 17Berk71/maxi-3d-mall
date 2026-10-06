"""Загрузчик выгрузок товаров (YML — формат Яндекс Маркета, его же отдают Admitad, Яндекс Маркет и большинство сетей).

  python3 tools/feeds/import_feed.py ФАЙЛ_ИЛИ_ССЫЛКА [ещё...] [--out public/feeds] [--per-shop 300] [--source "Lamoda через Admitad"] [--demo]

Что делает:
 1. читает выгрузку (файл или ссылка), склеивает размеры одного товара (одинаковый group_id);
 2. оставляет только бренды, у которых есть магазин в «Макси» (имя магазина или вариант из brands.py);
    кафе, услуги и автоматы не берутся — у них нет смысла в онлайн-витрине (src/shop/online.js);
 3. раскладывает товары по отделам: тип (верхняя одежда, брюки…) × для кого (женщинам, мужчинам, детям);
 4. фото: скачивает, вырезает светлый однотонный фон (как у студийных снимков), уменьшает и сохраняет в webp —
    такие вещи висят на вешалах в зале; если фон вырезать не получилось, фото остаётся только в карточке;
 5. пишет по файлу на магазин (feeds/<магазин>.json) и общий список feeds/index.json.
Запускать раз в сутки (GitHub Actions, cron) — цены и наличие в выгрузках меняются каждый день.
"""
import argparse, collections, datetime, hashlib, io, json, os, re, sys, urllib.request
import xml.etree.ElementTree as ET
from urllib.parse import urljoin

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
sys.path.insert(0, HERE)
from brands import ALIASES, NOT_ONLINE  # noqa: E402

# ---------- магазины «Макси» ----------
def maxi_shops():
    names = {}
    for fn in ('maxi-data.json', 'maxi-floor2.json'):
        d = json.load(open(os.path.join(ROOT, 'src', 'data', fn), encoding='utf-8'))
        for s in d['stores'] + d['kiosks']:
            if s['name'] and s['cat'] not in ('tbd', 'wc', 'food', 'serv') and s['name'] not in NOT_ONLINE:
                names[s['name']] = s['cat']
    return names

def norm(t): return re.sub(r'[^0-9a-zа-яё]+', '', (t or '').lower().replace('ё', 'е'))

def brand_index(shops):
    idx = {}
    for name in shops:
        idx[norm(name)] = name
        for a in ALIASES.get(name, []): idx[norm(a)] = name
    return idx

# ---------- отделы ----------
# тип отдела (ключ из DEPT в src/shop/catalog.js) и слова, по которым он узнаётся в категории или названии
TYPES = [
    ('linen', 'бель[её]|купальн|бюстгальт|трусы|пижам'),
    ('jackets', 'пуховик|куртк|пальто|парк[аи]|ветровк|жилет|верхняя одежда|плащ|бомбер'),
    ('dresses', 'плат[ьи]|юбк|сарафан'),
    ('pants', 'брюк|джинс|шорт|леггин|джоггер|карго|чинос'),
    ('tshirts', 'футболк|топ|худи|свитшот|свитер|джемпер|кардиган|рубашк|лонгслив|поло|толстовк|блуз'),
    ('shoes', 'обувь|кроссов|кед|ботин|туфл|сапог|лофер|сандал|сабо|слипон|мокасин'),
    ('bags', 'сумк|рюкзак|клатч|кошел'),
    ('accbox', 'ремен|ремн|шарф|шапк|перчат|варежк|носки|галстук|аксессуар'),
    ('perfume', 'парфюм|туалетная вода|аромат'), ('makeup', 'помад|тушь|тональн|макияж'), ('care', 'крем|сыворотк|уход|маск'),
    ('jewel', 'кольц|серьг|цепоч|подвеск|браслет|украшен'), ('watch', 'часы'), ('glasses', 'очки|оправ'),
    ('phones', 'смартфон|телефон|планшет'), ('laptops', 'ноутбук'), ('tv', 'телевизор'), ('phoneacc', 'наушник|чехол|заряд|кабел'),
    ('toys', 'игрушк|конструктор|настольн'), ('books', 'книг'), ('kitchen', 'посуд|кастрюл|сковород|кухн'),
    ('textile', 'постельн|плед|полотенц|подушк'), ('sofa', 'диван|кресл'), ('bed', 'кроват|матрас'),
]
TYPE_TITLE = {'linen': 'Бельё', 'jackets': 'Верхняя одежда', 'dresses': 'Платья и юбки', 'pants': 'Брюки и джинсы', 'tshirts': 'Футболки, худи, свитеры',
              'shoes': 'Обувь', 'bags': 'Сумки', 'accbox': 'Аксессуары', 'perfume': 'Парфюмерия', 'makeup': 'Макияж', 'care': 'Уход', 'jewel': 'Украшения',
              'watch': 'Часы', 'glasses': 'Оптика', 'phones': 'Смартфоны', 'laptops': 'Ноутбуки', 'tv': 'Телевизоры', 'phoneacc': 'Аксессуары',
              'toys': 'Игрушки', 'books': 'Книги', 'kitchen': 'Посуда и кухня', 'textile': 'Текстиль', 'sofa': 'Диваны и кресла', 'bed': 'Кровати и матрасы', 'generic': 'Товары'}
WHO = [('kids', 'дет|девоч|мальч|малыш|школ'), ('men', 'мужч|мужск'), ('women', 'женщ|женск')]
WHO_TITLE = {'women': 'Женщинам', 'men': 'Мужчинам', 'kids': 'Детям', '': ''}
WEAR = {'linen', 'jackets', 'dresses', 'pants', 'tshirts', 'shoes'}
# высота вещи в метрах — чтобы фото висело на вешале в настоящем размере
HEIGHT = {'jackets': 0.8, 'tshirts': 0.72, 'pants': 1.02, 'dresses': 1.05, 'linen': 0.5}
HEIGHT_KIDS = 0.72

COLORS = {'черн': '#1e1f22', 'бел': '#f2f0ea', 'молоч': '#ecebe7', 'сер': '#9ea2a6', 'графит': '#3b3e44', 'темно-син': '#243447', 'син': '#2f5d8a',
          'голуб': '#9fb8cf', 'красн': '#b03a3a', 'бордо': '#6e2433', 'роз': '#d8a7b0', 'беж': '#cbb89d', 'корич': '#6b4a35', 'хаки': '#5b6146',
          'олив': '#7a8a6c', 'зел': '#3c6e4f', 'желт': '#e0b23a', 'оранж': '#e57a1c', 'фиолет': '#6b3a8b', 'кэмел': '#b08855'}
def color_hex(name):
    n = (name or '').lower().replace('ё', 'е')
    for k, v in COLORS.items():
        if k in n: return v
    return '#8b98a8'

def kind_of(text):
    t = text.lower()
    for k, rx in TYPES:
        if re.search(rx, t): return k
    return 'generic'
def who_of(text):
    t = text.lower()
    for k, rx in WHO:
        if re.search(rx, t): return k
    return ''

# ---------- фото ----------
def fetch(src, base):
    if re.match(r'^https?://', src):
        req = urllib.request.Request(src, headers={'User-Agent': 'maxi-feed/1.0'})
        return urllib.request.urlopen(req, timeout=30).read()
    path = src if os.path.isabs(src) else os.path.join(base, src)
    return open(path, 'rb').read()

def cut_background(im):
    """Вырезает однотонный светлый фон, связанный с краями картинки. Возвращает RGBA или None, если фон не однотонный."""
    im = im.convert('RGBA'); a = np.asarray(im).astype(np.int16)
    if a[..., 3].min() < 250 and (a[0, :, 3].max() < 20 or a[:, 0, 3].max() < 20):
        return im  # уже с прозрачным фоном
    rgb = a[..., :3]; H, W = rgb.shape[:2]
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, 0)
    if np.abs(border - bg).max(1).mean() > 18 or bg.mean() < 180: return None  # фон не однотонный или тёмный — не трогаем
    near = np.abs(rgb - bg).max(-1) < 22
    # заливка от краёв: фоном считается только то, что связано с краем
    import cv2
    mask = np.zeros((H + 2, W + 2), np.uint8); fill = near.astype(np.uint8)
    reach = np.zeros_like(fill)
    for (x, y) in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1), (W // 2, 0), (W // 2, H - 1), (0, H // 2), (W - 1, H // 2)]:
        if fill[y, x]:
            tmp = fill.copy(); mask[:] = 0
            cv2.floodFill(tmp, mask, (x, y), 2)
            reach |= (tmp == 2)
    alpha = np.where(reach, 0, 255).astype(np.uint8)
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
    if (alpha > 128).mean() < 0.08: return None
    out = np.asarray(im).copy(); out[..., 3] = alpha
    return Image.fromarray(out, 'RGBA')

_PIC_DONE = {}
def process_picture(src, base, outdir, key):
    # одно и то же фото у нескольких товаров (цвета, размеры) обрабатываем один раз
    key = hashlib.md5(src.encode()).hexdigest()[:12]
    if key in _PIC_DONE: return _PIC_DONE[key]
    _PIC_DONE[key] = r = _process_picture(src, base, outdir, key)
    return r

def _process_picture(src, base, outdir, key):
    try:
        raw = fetch(src, base)
        im = Image.open(io.BytesIO(raw)); im.load()
    except Exception as e:
        print('  фото не скачалось:', src, e); return None
    cut = cut_background(im)
    img = cut if cut is not None else im.convert('RGB')
    if cut is not None:
        bb = cut.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
        if bb: img = cut.crop(bb)
    img.thumbnail((420, 560))
    fn = key + '.webp'; img.save(os.path.join(outdir, fn), quality=82, method=5)
    return {'pic': 'img/' + fn, 'aspect': round(img.width / img.height, 4), 'cut': cut is not None}

# ---------- выгрузка ----------
def read_feed(src):
    raw = fetch(src, os.getcwd())
    root = ET.fromstring(raw)
    shop = root.find('shop')
    cats = {}
    for c in shop.find('categories') or []:
        cats[c.get('id')] = (c.get('parentId'), (c.text or '').strip())
    def path(cid):
        out = []; seen = set()
        while cid and cid in cats and cid not in seen:
            seen.add(cid); par, name = cats[cid]; out.append(name); cid = par
        return ' / '.join(reversed(out))
    date = root.get('date', '')
    base = os.path.dirname(os.path.abspath(src)) if not re.match(r'^https?://', src) else src
    for o in shop.find('offers'):
        if o.get('available', 'true') == 'false': continue
        params = collections.defaultdict(list)
        for p in o.findall('param'): params[(p.get('name') or '').strip()].append((p.text or '').strip())
        g = lambda t: (o.findtext(t) or '').strip()
        yield {'id': o.get('id'), 'group': o.get('group_id') or o.get('id'), 'url': g('url'), 'price': g('price'), 'oldprice': g('oldprice'),
               'pic': g('picture'), 'pics': [(x.text or '').strip() for x in o.findall('picture') if (x.text or '').strip()][:6], 'desc': re.sub(r'<[^>]+>', ' ', g('description'))[:600].strip(), 'vendor': g('vendor') or g('brand'), 'name': g('name') or g('model'), 'cat': path(g('categoryId')),
               'color': (params.get('Цвет') or params.get('Color') or [''])[0], 'sizes': params.get('Размер') or params.get('Size') or [],
               'gender': (params.get('Пол') or [''])[0], 'pickup': (params.get('Самовывоз') or [''])[0].lower() in ('да', 'true', '1') or g('pickup') == 'true',
               'base': base, 'date': date}

# ---------- пакеты примерки ----------
CACHE = os.path.join(HERE, 'cache')
def local_copy(src, base):
    """Фото для конвейера примерки — локальным файлом (ссылки скачиваются один раз в tools/feeds/cache)."""
    if not re.match(r'^https?://', src):
        p = src if os.path.isabs(src) else os.path.join(base, src)
        return p if os.path.isfile(p) else None
    os.makedirs(CACHE, exist_ok=True)
    fn = os.path.join(CACHE, hashlib.md5(src.encode()).hexdigest()[:16] + os.path.splitext(src.split('?')[0])[1][:5])
    if not os.path.exists(fn):
        try: open(fn, 'wb').write(fetch(src, ''))
        except Exception as e: print('  фото не скачалось:', src, e); return None
    return fn

def fit_pack(of, iid, out, who, shop):
    from fitpack import make_pack
    base = of['base'] if not re.match(r'^https?://', of['base']) else ''
    paths = [p for p in (local_copy(s, base) for s in of['pics']) if p]
    return make_pack(of, iid, out, who=who, brand=shop, paths=paths) if paths else None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('feeds', nargs='+'); ap.add_argument('--out', default=os.path.join(ROOT, 'public', 'feeds'))
    ap.add_argument('--per-shop', type=int, default=300); ap.add_argument('--source', default='')
    ap.add_argument('--demo', action='store_true', help='пометить как тестовую выгрузку (ненастоящие товары)')
    ap.add_argument('--fit', action='store_true', help='собрать пакеты примерки (выкройка и ткань) для одежды — fitpack.py')
    a = ap.parse_args()
    shops = maxi_shops(); idx = brand_index(shops)
    os.makedirs(os.path.join(a.out, 'img'), exist_ok=True)
    groups = collections.OrderedDict(); skipped = collections.Counter()
    for src in a.feeds:
        for of in read_feed(src):
            shop = idx.get(norm(of['vendor']))
            if not shop: skipped[of['vendor']] += 1; continue
            key = (shop, of['group'])
            if key not in groups: groups[key] = dict(of, shop=shop, sizes=list(of['sizes']))
            else:
                for s in of['sizes']:
                    if s not in groups[key]['sizes']: groups[key]['sizes'].append(s)
    by_shop = collections.defaultdict(list)
    for (shop, _), of in groups.items(): by_shop[shop].append(of)
    today = datetime.date.today().isoformat()
    index = {'updated': today, 'demo': a.demo, 'source': a.source, 'shops': {}}
    for shop, offers in by_shop.items():
        offers = offers[:a.per_shop]
        depts = collections.OrderedDict()
        for of in offers:
            text = of['cat'] + ' ' + of['name']
            t = kind_of(text); w = who_of(of['gender'] + ' ' + of['cat'] + ' ' + of['name']) if t in WEAR or t == 'generic' else ''
            dk = (w + '-' if w else '') + t
            if dk not in depts:
                depts[dk] = {'key': dk, 'type': t, 'who': w, 'title': (WHO_TITLE[w] + ' · ' if w else '') + TYPE_TITLE.get(t, 'Товары'), 'items': []}
            try: price = int(float(of['price']))
            except ValueError: price = 0
            iid = hashlib.md5((shop + '|' + of['group']).encode()).hexdigest()[:10]
            item = {'id': iid, 'name': of['name'], 'price': price, 'color': color_hex(of['color']), 'colorName': of['color'].lower(),
                    'sizes': of['sizes'], 'url': of['url'], 'pickup': of['pickup']}
            if of.get('desc'): item['desc'] = of['desc']
            if of['oldprice']:
                try: item['oldPrice'] = int(float(of['oldprice']))
                except ValueError: pass
            if of['pic']:
                ph = process_picture(of['pic'], of['base'] if not re.match(r'^https?://', of['base']) else '', os.path.join(a.out, 'img'), iid)
                if ph:
                    item.update(ph); item['h'] = HEIGHT_KIDS if w == 'kids' and t in HEIGHT else HEIGHT.get(t, 0.6)
            if a.fit and t in ('tshirts', 'pants', 'jackets') and w != 'kids' and of.get('pics'):   # фигура в примерочной — взрослая
                pk = fit_pack(of, iid, os.path.join(a.out, 'fit'), w, shop)
                if pk: item['fit'] = 'fit/' + iid + '/'; item['fitKind'] = pk['kind']
            depts[dk]['items'].append(item)
        # порядок отделов: женщинам, мужчинам, детям; внутри — как в зале (верхняя одежда первой)
        order = {'women': 0, 'men': 1, 'kids': 2, '': 3}; torder = {k: i for i, (k, _) in enumerate(TYPES)}
        dl = sorted(depts.values(), key=lambda d: (order[d['who']], torder.get(d['type'], 99)))
        slug = re.sub(r'[^a-z0-9а-я]+', '-', shop.lower()).strip('-') or iid
        data = {'shop': shop, 'updated': today, 'feedDate': offers[0]['date'] if offers else '', 'demo': a.demo, 'source': a.source, 'depts': dl}
        json.dump(data, open(os.path.join(a.out, slug + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        n = sum(len(d['items']) for d in dl)
        # для витрины в галерее: до трёх вещей с вырезанным фоном (сначала верх: куртки, футболки, платья)
        pri = {'jackets': 0, 'tshirts': 1, 'dresses': 2, 'pants': 3}
        win, seen, types = [], set(), set()
        for rnd in (0, 1):  # сначала по одной вещи каждого типа, потом что осталось
            for t in sorted(pri, key=pri.get):
                for d in dl:
                    if d['type'] != t: continue
                    for i in d['items']:
                        if len(win) == 3 or not i.get('cut') or i['pic'] in seen or (rnd == 0 and t in types): continue
                        seen.add(i['pic']); types.add(t); win.append({'pic': i['pic'], 'aspect': i['aspect'], 'h': i['h'], 'color': i['color']})
        index['shops'][shop] = {'file': slug + '.json', 'n': n, 'win': win}
        print(f'{shop}: {n} товаров, отделы: ' + ', '.join(f"{d['title']} ({len(d['items'])})" for d in dl))
    json.dump(index, open(os.path.join(a.out, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if a.fit and os.path.isdir(os.path.join(a.out, 'fit')):
        # список пакетов примерки — для автопроверки (tools/wardrobe/qc/run.sh с PACKS=…/fit)
        fd = os.path.join(a.out, 'fit')
        metas = [json.load(open(os.path.join(fd, d, 'meta.json'))) for d in sorted(os.listdir(fd)) if os.path.isfile(os.path.join(fd, d, 'meta.json'))]
        json.dump(metas, open(os.path.join(fd, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        print('пакетов примерки:', len(metas))
    if skipped: print('не из «Макси» (пропущены):', ', '.join(f'{k or "без бренда"} ×{v}' for k, v in skipped.most_common(10)))

if __name__ == '__main__':
    main()
