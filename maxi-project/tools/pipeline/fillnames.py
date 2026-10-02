"""Названия помещений, которых не было на исходных скриншотах, — по скриншотам Яндекс Карт пользователя (октябрь 2026).

Запускать после `npm run map` / `npm run map2` (и healf2.py). Идемпотентно.
Помещение ищется по точке (x, z) в метрах: берётся то, в чей контур попадает точка.
Островок — ближайший к точке (до 4 м). Новые островки добавляются, если рядом ещё нет островка с таким именем.
Помещения, которые и на Яндекс Картах без подписи, остаются без названия.
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', '..', 'src', 'data')

# этаж, точка, название, категория, что продают
STORES = [
    (1, (-104.6, -35.4), 'Офисмаг', 'home', 'Канцтовары и товары для офиса'),
    (1, (-94.0, -35.4), 'Копицентр Офисмаг', 'serv', 'Копицентр и печать'),
    (1, (-64.2, -10.8), 'Парикмахерский магазин', 'beauty', 'Товары для парикмахеров'),
    (1, (-117.6, -4.5), 'Цвет диванов', 'furn', 'Диваны'),
    (1, (-93.7, 8.85), 'Бизон', 'fashion', 'Одежда'),          # раньше здесь стояло «Вуаля» — на Яндексе это островок
    (1, (-56.4, 10.4), 'Samsung', 'tech', 'Техника Samsung'),
    (1, (-24.3, -19.7), 'Bretelle', 'fashion', 'Одежда'),
    (1, (-16.9, -18.2), 'U.S. Polo Assn', 'fashion', 'Одежда и обувь'),
    (1, (-43.6, 8.5), 'G-Store', 'fashion', 'Одежда'),
    (1, (-50.0, 17.0), 'Business Line', 'fashion', 'Мужская одежда'),
    (1, (-11.4, 19.3), 'Gerry Weber', 'fashion', 'Женская одежда'),  # «Et.b Parfum» на Яндексе — островок
    (1, (26.0, 0.4), 'Colins', 'fashion', 'Джинсовая одежда'),
    (1, (64.4, 12.1), 'Incanto', 'fashion', 'Бельё и купальники'),
    (1, (89.2, 7.2), 'Ijevan', 'misc', 'Магазин'),
    (1, (70.2, -21.8), 'Hello!', 'tech', 'Аксессуары для телефонов'),
    (2, (-16.7, -14.5), 'Джинс@', 'fashion', 'Джинсовая одежда'),
    (2, (-22.3, 22.0), 'PrOspect', 'fashion', 'Одежда'),
    (2, (-26.7, -3.7), 'Frodo', 'fashion', 'Одежда'),
    (2, (-9.0, -0.6), 'Evita', 'fashion', 'Женская одежда'),
    (2, (26.8, 5.4), 'Aidini', 'fashion', 'Одежда'),
    (2, (66.3, -3.2), 'Boodo', 'fashion', 'Одежда'),           # раньше «Смешик» — на Яндексе это островок
]
# помещения, где на Яндексе тёмная ячейка без подписи (наше название было перенесено с островка)
CLEAR = [
    (1, 'Авточехлы'),
]
KIOSKS = [  # существующие безымянные островки
    (1, (-122.0, -16.0), 'Чугунный дом', 'home', 'Чугунная посуда', 'store'),   # маленькое открытое помещение
    (1, (-56.0, 0.0), 'Q Store', 'misc', 'Магазин', 'store'),
    (1, (-13.1, 9.65), 'Et.b Parfum', 'beauty', 'Косметика и парфюмерия', 'kiosk'),
    (1, (23.9, 17.9), 'Alise', 'misc', 'Магазин', 'kiosk'),
    (1, (65.6, 38.2), 'David Jones', 'misc', 'Сумки и аксессуары', 'kiosk'),
    (1, (111.2, 3.2), 'НеобыЧайный магазин', 'food', 'Чай', 'kiosk'),
]
NEW_KIOSKS = [  # островки, которых не было в данных
    (1, (-82.7, -7.1), 'Вуаля', 'misc', 'Магазин'),
    (1, (-74.2, -4.9), 'Авточехлы', 'home', 'Авточехлы'),
    (1, (-39.7, 2.9), 'Феникс', 'misc', 'Магазин'),
    (1, (69.8, -4.3), 'Time of Prestige', 'acc', 'Часы'),
    (2, (69.3, -10.0), 'Смешик', 'misc', 'Магазин'),
]


def inpoly(P, x, z):
    c = False
    for i in range(len(P)):
        a, b = P[i], P[i - 1]
        if (a[1] > z) != (b[1] > z) and x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]:
            c = not c
    return c


def name_it(s, name, cat, what):
    s['name'] = name; s['names'] = [name]; s['cat'] = cat; s['what'] = what


def main():
    files = {1: os.path.join(DATA, 'maxi-data.json'), 2: os.path.join(DATA, 'maxi-floor2.json')}
    D = {f: json.load(open(p, encoding='utf-8')) for f, p in files.items()}
    n = 0
    for f, (x, z), name, cat, what in STORES:
        hit = [s for s in D[f]['stores'] if inpoly(s['poly'], x, z)]
        if not hit: print('  не найдено помещение для', name); continue
        hit.sort(key=lambda s: s['area']); name_it(hit[0], name, cat, what); n += 1
    for f, name in CLEAR:
        for s in D[f]['stores']:
            if s['name'] == name: name_it(s, '', 'tbd', 'Название не найдено'); s['names'] = []
    for f, (x, z), name, cat, what, kind in KIOSKS:
        if kind == 'store':
            hit = [s for s in D[f]['stores'] if math.hypot(s['lp'][0] - x, s['lp'][1] - z) < 4 and s['area'] < 15]
        else:
            hit = [k for k in D[f]['kiosks'] if math.hypot(k['p'][0] - x, k['p'][1] - z) < 4]
        if not hit: print('  не найден островок для', name); continue
        name_it(hit[0], name, cat, what); n += 1
    for f, (x, z), name, cat, what in NEW_KIOSKS:
        ks = D[f]['kiosks']
        if any(k['name'] == name for k in ks): continue
        near = min(ks, key=lambda k: math.hypot(k['p'][0] - x, k['p'][1] - z))
        ks.append({'name': name, 'cat': cat, 'what': what, 'p': [x, z], 'w': 2.6, 'h': 2.2, 'a': near['a']}); n += 1
    for k in (1, 2):
        for s in D[k]['stores'] + D[k]['kiosks']:
            s.pop('names', None) if 'poly' not in s else None
        json.dump(D[k], open(files[k], 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('готово, применено', n)


if __name__ == '__main__':
    main()
