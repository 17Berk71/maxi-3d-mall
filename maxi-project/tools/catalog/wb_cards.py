"""Карточки Wildberries из открытого хранилища (basket-NN.wbbasket.ru): card.json и фото по артикулу.
Домен должен быть разрешён в настройках сети (Settings → Capabilities: *.wbbasket.ru).

python3 tools/catalog/wb_cards.py ВЫХОД.json АРТИКУЛ...   — краткие сведения о карточках (для отбора)
"""
import json, sys, urllib.request, threading, concurrent.futures as cf

UA = {'User-Agent': 'Mozilla/5.0'}
_known = {}            # vol → номер хоста
_lock = threading.Lock()


def get(u, t=10):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t) as r:
            return r.read()
    except Exception:
        return None


def base(nm):
    """Адрес папки карточки. Хост зависит от диапазона vol; соседние vol лежат на том же или соседнем хосте."""
    vol, part = nm // 100000, nm // 1000
    tail = f'/vol{vol}/part{part}/{nm}'
    with _lock:
        near = sorted(_known.items(), key=lambda kv: abs(kv[0] - vol))
    order, seen = [], set()
    for _, b in near[:3]:
        for d in (0, 1, -1, 2):
            if 1 <= b + d <= 80 and b + d not in seen: order.append(b + d); seen.add(b + d)
    order += [b for b in range(1, 81) if b not in seen]
    for b in order:
        u = f'https://basket-{b:02d}.wbbasket.ru{tail}'
        if get(u + '/info/ru/card.json', 5):
            with _lock: _known[vol] = b
            return u
    return None


def card(nm):
    b = base(nm)
    if not b: return None, None
    raw = get(b + '/info/ru/card.json')
    return b, (json.loads(raw) if raw else None)


def brief(nm):
    b, c = card(nm)
    if not c: return {'nm': nm, 'error': 'нет карточки'}
    opts = {o.get('name'): o.get('value') for o in (c.get('options') or [])}
    return {'nm': nm, 'base': b, 'name': c.get('imt_name'), 'subj': c.get('subj_name'), 'root': c.get('subj_root_name'),
            'brand': (c.get('selling') or {}).get('brand_name'), 'kinds': c.get('kinds'), 'color': c.get('nm_colors_names') or opts.get('Цвет'),
            'pics': (c.get('media') or {}).get('photo_count'), 'season': opts.get('Сезон'), 'desc': bool(c.get('description')),
            'comp': c.get('compositions'), 'table': bool(c.get('sizes_table'))}


if __name__ == '__main__':
    out, nms = sys.argv[1], [int(x) for x in sys.argv[2:]]
    # сначала по одному на каждый «сотый» vol — чтобы набрать карту хостов, потом всё параллельно
    res = []
    with cf.ThreadPoolExecutor(12) as ex:
        res = list(ex.map(brief, nms))
    json.dump(res, open(out, 'w'), ensure_ascii=False, indent=0)
    print(len(res), 'карточек,', sum(1 for r in res if 'error' in r), 'без карточки')
