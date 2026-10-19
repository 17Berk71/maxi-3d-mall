#!/usr/bin/env python3
"""Детали и ткань вещи по характеристикам карточки Wildberries (card.json → options, description).

Раньше воротник, капюшон, стойку, стёжку угадывали по словам в названии, а название их часто не называет (вязаное платье-поло
без слова «воротник»). В карточке это есть прямо: «Вырез горловины — отложной воротник», «Опции капюшона — несъемный»,
«Мех опушки — искусственный», «Особенности модели — стеганая; дутый; с высокой стойкой», «Фактура — вязаный».

details(card, name) → словарь деталей; flags(det, kind) → флаги вещи для примерочной (wb_items.py);
missing(det, item, meta) → каких деталей из карточки нет у вещи на манекене (проверка внешнего вида, tools/lab/appearance.py).
"""
import json, os, re, glob

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')


def _opts(card):
    o = {}
    for x in card.get('options', []) or []:
        o[x.get('name', '')] = str(x.get('value', '')).lower().replace('ё', 'е')
    return o


def details(card, name=''):
    o = _opts(card); n = (name or '').lower().replace('ё', 'е'); desc = (card.get('description') or '').lower().replace('ё', 'е')
    get = lambda *keys: ' ; '.join(o.get(k, '') for k in keys)
    neck = get('Вырез горловины', 'Воротник', 'Тип воротника'); feat = get('Особенности модели'); deco = get('Декоративные элементы')
    tex = get('Фактура материала', 'Материал верха', 'Состав'); allt = ' '.join([n, neck, feat, deco, tex, get('Покрой'), get('Вид застежки')])
    d = {}
    # воротник: отложной / стойка (гольф, высокая стойка) / нет
    if re.search(r'отложн|воротник-рубашк|классический|поло\b|апаш', neck) or re.search(r'отложн|рубашечн|воротник-поло|\bполо\b', n) \
            or ('воротник' in deco and 'стойк' not in allt): d['collar'] = 'turn'
    if re.search(r'стойк|гольф|водолазк', neck + ' ' + feat + ' ' + n): d['collar'] = 'stand'
    if 'бретел' in neck or re.search(r'бретел|комбинац|сарафан', n): d['straps'] = True
    m = re.search(r'круглый|округл|v-образн|квадратн|лодочк', neck)
    if m: d['neckline'] = {'круглый': 'round', 'округл': 'round', 'v-образн': 'v', 'квадратн': 'square', 'лодочк': 'boat'}[m.group(0)]
    hood = get('Опции капюшона')
    if re.search(r'несъемн|съемн', hood) and 'без' not in hood or ('капюш' in n and 'без капюш' not in n): d['hood'] = True
    fur = get('Опции опушки', 'Мех опушки/отделки')
    if re.search(r'несъемная опушка|съемная опушка|мех искусств|натуральн', fur) or re.search(r'мех', deco) or re.search(r'мехов|с мехом|экомех|опушк', n): d['fur'] = True
    if re.search(r'стеган|дут|пухов', feat + ' ' + tex + ' ' + n) or re.search(r'пух', get('Утеплитель')) and 'без' not in get('Утеплитель'): d['quilted'] = True
    cl = get('Вид застежки')
    d['closure'] = 'zip' if 'молни' in cl else 'buttons' if re.search(r'пуговиц', cl) else 'snaps' if 'кнопк' in cl else 'none' if 'без' in cl else ''
    pk = get('Тип карманов')
    if re.search(r'накладн', pk): d['pockets'] = 'patch'
    elif re.search(r'клапан', pk): d['pockets'] = 'flap'
    elif re.search(r'прорезн|в шве|на шве|потайн|отрезным', pk): d['pockets'] = 'inset'
    if re.search(r'пояс', cl + ' ' + deco) or re.search(r'с поясом|под пояс', n): d['belt'] = True
    if re.search(r'цеп', deco + ' ' + n): d['chain'] = True
    if re.search(r'пряжк', deco): d['buckle'] = True
    if re.search(r'складк|плиссе', deco + ' ' + get('Модель юбки') + ' ' + n): d['pleats'] = True
    if re.search(r'разрез', feat + ' ' + n): d['slit'] = True
    if re.search(r'драпир', feat + ' ' + n): d['drape'] = True
    # ткань: вязка (крупная), рубчик «лапша», трикотаж, атлас, деним, кожа, кружево, сетка, плащёвка, стёжка
    fb = None
    if re.search(r'лапш|рубчик|в рубчик', n + ' ' + desc + ' ' + tex): fb = 'rib'
    elif re.search(r'крупная вязка|крупной вязки', feat + ' ' + n + ' ' + desc): fb = 'chunky'
    elif re.search(r'вязан', tex + ' ' + n): fb = 'knit'
    elif re.search(r'атлас|сатин|шелк', tex + ' ' + n): fb = 'satin'
    elif re.search(r'джинс|деним', n + ' ' + tex): fb = 'denim'
    elif re.search(r'кожа|кожан|экокож', n + ' ' + tex): fb = 'leather'
    elif re.search(r'кружев', n + ' ' + tex): fb = 'lace'
    elif re.search(r'плащев|нейлон', tex) and d.get('quilted'): fb = 'nylon'
    elif re.search(r'трикотаж', tex + ' ' + n): fb = 'jersey'
    elif re.search(r'шерст|драп|пальтов', tex + ' ' + n): fb = 'wool'
    if fb: d['fabric'] = fb
    if re.search(r'глянц', feat + ' ' + tex): d['gloss'] = True
    if re.search(r'матов', feat + ' ' + tex): d['matte'] = True
    cut = get('Покрой')
    if cut: d['cut'] = cut.split(' ; ')[0]
    return d


def flags(det, kind):
    """флаги вещи для примерочной из деталей карточки (то, что примерочная уже умеет показывать)."""
    f = {}
    if det.get('collar') == 'turn' and kind in ('shirt', 'tee', 'sweater', 'dress', 'jacket', 'coat', 'vest'): f['collar'] = True
    if det.get('collar') == 'stand' and kind in ('dress', 'shirt', 'sweater', 'jacket', 'puffer', 'vest', 'tee', 'coat'): f['stand'] = True
    if det.get('hood') and kind not in ('pants', 'jeans', 'shorts', 'skirt', 'dress'): f['hood'] = True
    if det.get('quilted') and kind in ('vest', 'jacket', 'coat'): f['puffer'] = True
    if det.get('closure') == 'zip' and kind in ('hoodie', 'jacket', 'puffer', 'vest', 'coat', 'sweater'): f['zip'] = True
    if det.get('straps') and kind in ('dress', 'tee', 'shirt'): f['sleeveless'] = True
    if det.get('pleats') and kind in ('skirt', 'dress'): f['pleats'] = True
    for k in ('fur', 'quilted', 'fabric', 'belt', 'chain', 'pockets', 'neckline'):
        if det.get(k): f['card_' + k] = det[k]
    return f


SUPPORTED_SOON = {'fur': 'мех', 'quilted': 'стёжка', 'belt': 'пояс', 'chain': 'цепочка'}


def missing(det, item, meta=None):
    """детали из карточки, которых у вещи на манекене нет."""
    k = item.get('kind'); out = []
    if det.get('collar') == 'turn' and k not in ('pants', 'jeans', 'shorts', 'skirt') and not (item.get('collar') and not item.get('stand')): out.append('отложной воротник')
    if det.get('collar') == 'stand' and k not in ('pants', 'jeans', 'shorts', 'skirt') and not (item.get('stand') or item.get('hood')): out.append('стойка')
    if det.get('hood') and k not in ('pants', 'jeans', 'shorts', 'skirt', 'dress') and not item.get('hood'): out.append('капюшон')
    if det.get('closure') == 'buttons' and k in ('shirt', 'dress', 'coat', 'jacket', 'vest') and meta is not None:
        btn = (((meta.get('drape') or {}).get('front') or {}).get('a') or {}).get('buttons')
        if not btn: out.append('пуговицы')
    # пока не умеем совсем — честно считаем отсутствующими
    if det.get('fur') and not item.get('fur3d'): out.append('мех')
    if det.get('quilted') and k in ('puffer', 'vest', 'jacket', 'coat') and not item.get('quilt3d'): out.append('стёжка')
    if det.get('belt') and k not in ('pants', 'jeans', 'shorts', 'skirt') and not item.get('belt3d'): out.append('пояс')
    if det.get('chain') and not item.get('chain3d'): out.append('цепочка')
    return out


def card_of(nm):
    p = glob.glob(os.path.join(RAW, 'wb_*', 'wb_%s' % nm, 'card.json'))
    return json.load(open(p[0])) if p else None


def missing_all(L):
    """{id: [нет деталей]} по всем вещам wb_items (для appearance.py)."""
    res = {}
    for id_, it in L.items():
        if not id_.startswith('wb-'): continue
        c = card_of(id_[3:])
        if not c: continue
        mp = os.path.join(HERE, 'out', id_, 'meta.json'); meta = json.load(open(mp)) if os.path.exists(mp) else None
        res[id_] = missing(details(c, it.get('name', '')), it, meta)
    return res


if __name__ == '__main__':
    L = {x['id']: x for x in json.load(open(os.path.join(RAW, 'wb_items.json')))}
    from collections import Counter
    C = Counter(); M = Counter()
    for id_, it in L.items():
        c = card_of(id_[3:])
        if not c: continue
        d = details(c, it['name']); C.update(k if not isinstance(v, str) else k + '=' + v for k, v in d.items() if k != 'cut')
        mm = missing(d, it); M.update(mm)
    print('детали:', dict(C.most_common())); print('нет у вещей сейчас:', dict(M.most_common()))
