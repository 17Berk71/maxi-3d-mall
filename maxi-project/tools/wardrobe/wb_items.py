#!/usr/bin/env python3
"""Вещи из карточек Wildberries → записи для фабрики вещей (как в items.py).

Читает raw/wb_*/wb_<артикул>/garment.json (разметка снимков и мерки вещи, переписанные с таблиц продавца)
и пишет raw/wb_items.json. items.py подхватывает этот файл, если он есть. Фото и список — только для внутренней
проверки: обе папки raw/ и out/ в .gitignore, в публичный репозиторий и на сайт не попадают.

Запуск: python3 tools/wardrobe/wb_items.py   (потом build.py wb-<артикул> …)
"""
import glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wardrobe_paths import RAW  # noqa: E402

SKIP = {'jumpsuit'}                                    # комбинезонов в примерочной пока нет
TOP_KEYS = ('chest', 'len', 'shoulder', 'sleeve')      # что понимает выкройка верха (specs.js, measures.js)
BOTTOM_KEYS = ('waist', 'hip', 'hem', 'outseam', 'inseam')
SKIRT_KEYS = ('waist', 'len')


def has(n, rx): return re.search(rx, n) is not None


def flags(kind, name):
    n = name.lower().replace('ё', 'е'); out = {}
    if kind == 'hoodie':
        z = has(n, r'молни|зип|zip')
        out.update(zip=z, hood=True, states=[['closed', 'Застёгнута'], ['open', 'Расстёгнута'], ['hood', 'Капюшон']] if z else [['closed', 'Капюшон снят'], ['hood', 'Капюшон']])
    elif kind in ('coat', 'puffer'): out['states'] = [['closed', 'Застёгнут'], ['open', 'Нараспашку']]
    elif kind == 'jacket':
        out['states'] = [['open', 'Нараспашку'], ['closed', 'Застёгнут']] if has(n, r'пиджак|жакет|блейзер') else [['closed', 'Застёгнута'], ['open', 'Нараспашку']]
        if has(n, r'молни|зип') and not has(n, r'пиджак|жакет'): out['zip'] = True
    elif kind in ('tee', 'shirt', 'sweater'): out['states'] = [['loose', 'Навыпуск'], ['tucked', 'Заправлен']]
    elif kind == 'vest':
        out['states'] = [['closed', 'Застёгнут'], ['open', 'Нараспашку']]
        if has(n, r'стеган|дут|пухов|утепл'): out['puffer'] = True
    if kind not in ('hoodie',) and has(n, r'капюш'): out['hood'] = True
    if kind in ('shirt', 'tee', 'sweater', 'dress', 'jacket', 'coat') and has(n, r'рубашк|поло|воротник|отложн'): out['collar'] = True
    if kind in ('dress', 'shirt', 'sweater', 'jacket', 'puffer', 'vest') and has(n, r'стойк'): out['stand'] = True
    if kind in ('skirt', 'dress') and has(n, r'плиссе|складк|гофре'): out['pleats'] = True
    if kind in ('dress', 'shirt', 'tee') and has(n, r'фонарик|буф'): out['puff'] = True
    if has(n, r'укороч|кроп'): out['crop'] = True
    if kind in ('pants', 'jeans', 'shorts') and has(n, r'резинк|джоггер|спортивн'): out['elastic'] = True
    return out


def rng(v):
    m = re.findall(r'\d+(?:[.,]\d+)?', str(v))
    return [float(m[0].replace(',', '.')), float(m[-1].replace(',', '.'))] if m else None


def body_of(row):
    b = {}
    for k, v in row.items():
        kl = k.lower(); r = rng(v)
        if not r: continue
        if 'груд' in kl: b['chest'] = r
        elif 'тали' in kl: b['waist'] = r
        elif 'бедр' in kl: b['hips'] = r
    return b or None


def sizes_of(g, kind):
    keys = SKIRT_KEYS if kind == 'skirt' else BOTTOM_KEYS if kind in ('pants', 'jeans', 'shorts') else TOP_KEYS
    rows = {r.get('tech_size'): r for r in g.get('body_size_table') or []}
    out = []
    for s in g.get('sizes') or []:
        cm = dict(s['cm']); t = s.get('table', {})
        if kind in ('pants', 'jeans', 'shorts') and 'outseam' not in cm and cm.get('inseam') and cm.get('rise'):
            cm['outseam'] = cm['inseam'] + cm['rise']                     # чинос Tom Tailor: длины по боку нет, есть шаг и посадка
        if kind == 'skirt' and 'waist' not in cm and t.get('body_waist'):  # юбка с одной меркой тела: пояс садится по ней
            lo, hi = rng(t['body_waist']); cm['waist'] = round((lo + hi) / 4, 1)
        cm = {k: v for k, v in cm.items() if k in keys and isinstance(v, (int, float))}
        if not cm: continue
        e = dict(name=s['name'], cm=cm)
        b = body_of(rows[s['name']]) if s['name'] in rows else None
        if b: e['body'] = b
        out.append(e)
    return out


def pick_photos(g, d):
    p = g['photos']; tb = {g.get('garment_table_photo'), g.get('size_table_photo')}
    studio = [k for k in p.get('studio') or [] if k not in tb]
    f = lambda k: os.path.relpath(os.path.join(d, '%02d.webp' % k), RAW)
    note = g.get('note') or ''
    if re.search(r'вешалк|на полу', note) and len(studio) >= 1:      # фото на вешалке / лёжа на полу — как личные фото, обычное вырезание
        return dict(front=f(studio[0]), back=f(studio[1] if len(studio) > 1 else studio[0])), 'photo'
    if studio:
        return dict(src='studio', front=f(studio[0]), back=f(studio[1] if len(studio) > 1 else studio[0])), 'studio'
    if p.get('front'):
        return dict(src='model', front=f(p['front'][0]), back=f((p.get('back') or p['front'])[0])), 'model'
    return None, None


def main():
    items = []; skipped = []
    for gp in sorted(glob.glob(os.path.join(RAW, 'wb_*', 'wb_*', 'garment.json'))):
        g = json.load(open(gp)); d = os.path.dirname(gp); kind = g['kind']
        if kind in SKIP: skipped.append((g['nm'], kind)); continue
        ph, how = pick_photos(g, d)
        if not ph: skipped.append((g['nm'], 'нет фото')); continue
        store = g.get('store') or g.get('brand') or ''
        it = dict(id='wb-%d' % g['nm'], name='%s · %s' % (store, g['name']), kind=kind, worn=[], brand=store, url=g['url'], how=how, **ph)
        it.update(flags(kind, g['name']))
        if g.get('body_for_check') == 'f': it['who'] = 'women'
        sz = sizes_of(g, kind)
        if sz: it['sizes'] = sz
        if g.get('note'): it['note'] = g['note'][:300]
        items.append(it)
    json.dump(items, open(os.path.join(RAW, 'wb_items.json'), 'w'), ensure_ascii=False, indent=1)
    from collections import Counter
    print(len(items), 'вещей;', Counter(i['how'] for i in items), '; с мерками вещи:', sum(1 for i in items if i.get('sizes')))
    print('пропущены:', skipped)


if __name__ == '__main__':
    main()
