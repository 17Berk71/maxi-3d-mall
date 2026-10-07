"""Конвейер каталога для примерочной: товар из выгрузки → «пакет примерки» (как у вещей фабрики tools/wardrobe).

Что делает для одного товара:
 1. вид вещи по названию и категории (футболка, свитшот, худи, рубашка, пиджак/куртка, джинсы, брюки, шорты);
    для остальных видов (платья, пуховики, пальто…) выкроек пока нет — пакет не делается, в примерочной прежний способ;
 2. фото: из всех фото товара выбирает студийные (вещь на однотонном светлом фоне) — перед и спинку;
    если студийных нет — фото на модели (нужна нейросеть tools/wardrobe/models/u2net_cloth_seg.onnx);
 3. размеры: размеры из выгрузки (XS…4XL, 44…58, 46-48, W30/L32) → мерки тела по российской сетке
    (или по сетке бренда из sizes.py) — по ним примерочная подбирает размер под фигуру;
 4. состояния (застёгнута/расстёгнута, капюшон, заправлена) — по виду вещи и названию;
 5. собирает пакет тем же кодом, что и вещи из фото пользователя (tools/wardrobe/build.py):
    вырезанное фото, сетка силуэта (выкройка), мерки, молния → <out>/fit/<id>/ (meta.json, *_cut.webp …).
Проверка качества (автопроверка ткани на типовых фигурах) — tools/wardrobe/qc (пакеты из выгрузки — тоже).
"""
import os, re, sys
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'wardrobe'))
sys.path.insert(0, HERE)
import build as W  # noqa: E402
from sizes import size_table  # noqa: E402

_DONE = {}
TEMPLATE_KINDS = {'tee', 'sweater', 'hoodie', 'shirt', 'jacket', 'jeans', 'pants', 'shorts', 'coat', 'puffer', 'dress', 'skirt'}


def garment_kind(name, cat=''):
    """Как classify() в src/shop/fitting.js: вид вещи по словам в названии (и категории)."""
    n = (name or '').lower().replace('ё', 'е')
    c = (cat or '').lower().replace('ё', 'е')
    has = lambda rx, t=n: re.search(rx, t) is not None
    if has(r'кроссов|кед|слипон|ботин|сапог|туфл|лофер|бутс|мокасин|сандал|босонож'): return None
    if has(r'платье|сарафан'): return 'dress'
    if has(r'юбк'): return 'skirt'
    if has(r'шорт'): return 'shorts'
    if has(r'джинс') and not has(r'куртк|рубаш|жилет'): return 'jeans'
    if has(r'брюк|джоггер|карго|чинос|штан|леггин|легинс'): return 'pants'
    if has(r'пуховик|парк[аи]?\b|пальто|тренч|комбинезон'): return 'puffer' if has(r'пуховик|комбинезон') else 'coat'
    if has(r'жилет'): return 'vest'
    if has(r'куртк|бомбер|ветровк|софтшелл|пиджак|жакет|косух'): return 'jacket'
    if has(r'худи|толстовк|зипк'): return 'hoodie'
    if has(r'рубаш|блуз'): return 'shirt'
    if has(r'свитер|свитшот|джемпер|лонгслив|кардиган|водолазк'): return 'sweater'
    if has(r'футболк|поло|майк|\bтоп\b'): return 'tee'
    # по категории — если в названии вид не указан
    for rx, k in ((r'футболк', 'tee'), (r'брюк', 'pants'), (r'джинс', 'jeans'), (r'худи|толстовк', 'hoodie'), (r'рубаш', 'shirt'), (r'свитер|джемпер', 'sweater')):
        if has(rx, c): return k
    return None


def states_of(kind, name):
    n = (name or '').lower()
    z = kind == 'hoodie' and re.search(r'молни|зип|zip', n) is not None
    hood = kind == 'hoodie' or 'капюш' in n
    if kind == 'hoodie' and z: return z, [['closed', 'Застёгнута'], ['open', 'Расстёгнута'], ['hood', 'Капюшон']]
    if kind == 'hoodie' and hood: return False, [['closed', 'Капюшон снят'], ['hood', 'Капюшон']]
    if kind in ('coat', 'puffer'): return False, [['closed', 'Застёгнут'], ['open', 'Нараспашку']]
    if kind == 'jacket':   # пиджак обычно носят нараспашку, куртку — застёгнутой
        return False, ([['open', 'Нараспашку'], ['closed', 'Застёгнут']] if re.search(r'пиджак|жакет|блейзер', n) else [['closed', 'Застёгнута'], ['open', 'Нараспашку']])
    if kind in ('tee', 'shirt', 'sweater'): return False, [['loose', 'Навыпуск'], ['tucked', 'Заправлен']]
    return False, None


# ---------- фото ----------
def photo_info(path):
    """Студийное ли фото: края кадра — однотонный светлый фон (или прозрачность). Возвращает (тип, маска|None, фото)."""
    try: im, am = W.load_any(path, with_alpha=True)
    except Exception: return None, None, None
    if am is not None and 0.05 < am.mean() < 0.95: return 'studio', W.studio_load(path)[1], im   # PNG без фона
    h, w = im.shape[:2]
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    border = np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])
    bg = np.median(border, 0)
    uniform = np.linalg.norm(border - bg, axis=1).mean() < 6 and bg[0] > 170
    if uniform:
        m = W.studio_mask(im)
        area = m.mean()
        if 0.08 < area < 0.92:
            # на модели: в маске есть кожа (лицо, руки, ноги) — такие фото не студийные
            ycc = cv2.cvtColor(im, cv2.COLOR_BGR2YCrCb)
            skin = ((ycc[..., 1] > 135) & (ycc[..., 1] < 175) & (ycc[..., 2] > 85) & (ycc[..., 2] < 130) & (m > 0)).sum() / max(1, m.sum())
            # кожа — лишь часть силуэта (лицо, руки, ноги) → человек; почти вся «кожа» — это вещь телесного цвета
            if skin < 0.04 or skin > 0.5: return 'studio', m, im
    return 'model', None, im


def silhouette(m, n=48):
    ys, xs = np.where(m > 0)
    if not len(ys): return None
    c = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1].astype(np.float32)
    return cv2.resize(c, (n, n), interpolation=cv2.INTER_AREA) > 0.5, (xs.max() - xs.min() + 1) / (ys.max() - ys.min() + 1)


def pick_photos(paths):
    """Перед и спинка: первое студийное фото — перед; спинка — следующее студийное с похожим силуэтом
    (та же форма, зеркально: вещь развёрнута). Детали (воротник, ткань крупно) — силуэт другой, не берутся."""
    infos = [(p,) + photo_info(p) for p in paths]
    studio = [(p, m) for p, t, m, _ in infos if t == 'studio']
    if studio:
        f, mf = studio[0]; sf = silhouette(mf); back = f
        for p, m in studio[1:]:
            s = silhouette(m)
            if not s or not sf: continue
            iou = max(((s[0] & a).sum() / max(1, (s[0] | a).sum())) for a in (sf[0], sf[0][:, ::-1]))
            if iou > 0.72 and abs(s[1] - sf[1]) / sf[1] < 0.15: back = p; break
        return 'studio', f, back
    model = [p for p, t, _, _ in infos if t == 'model']
    if model and os.path.exists(os.path.join(HERE, '..', 'wardrobe', 'models', 'u2net_cloth_seg.onnx')):
        return 'model', model[0], model[1] if len(model) > 1 else model[0]
    return None, None, None


def pack_key(offer, paths):
    """Одинаковый ключ — один и тот же пакет (то же фото, тот же вид вещи): считается один раз, остальным копируется."""
    kind = garment_kind(offer.get('name'), offer.get('cat'))
    return (tuple(paths or []), kind, bool(re.search(r'резинк|джоггер|спортивн', (offer.get('name') or '').lower())))


def offer_fields(offer, who, brand):
    kind = garment_kind(offer.get('name'), offer.get('cat'))
    zip_, states = states_of(kind, offer.get('name'))
    sizes = size_table(offer.get('sizes') or [], kind, who, brand or offer.get('vendor', ''), offer.get('name', ''))
    return dict(name=offer.get('name', ''), kind=kind, zip=zip_, states=states, brand=brand or offer.get('vendor', ''), url=offer.get('url', ''), who=who,
                hood=kind == 'hoodie' or 'капюш' in (offer.get('name') or '').lower(), sizes=sizes)


def clone_pack(src_iid, offer, iid, out, who='', brand=''):
    """Копия готового пакета для другого товара с тем же фото: картинки и выкройка те же, название, размеры, состояния — свои."""
    import json, shutil
    sd = os.path.join(out, src_iid); od = os.path.join(out, iid)
    if not os.path.isfile(os.path.join(sd, 'meta.json')): return None
    os.makedirs(od, exist_ok=True)
    meta = json.load(open(os.path.join(sd, 'meta.json')))
    # картинки не копируем: пакет ссылается на папку исходного (files) — при тысячах товаров это в разы меньше места
    meta['files'] = meta.get('files') or src_iid
    f = offer_fields(offer, who, brand); sizes = f.pop('sizes'); f.pop('kind')
    meta.update(f, id=iid)
    if sizes: meta['sizes'] = sizes
    else: meta.pop('sizes', None)
    meta.pop('qc', None)
    json.dump(meta, open(os.path.join(od, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
    return {'kind': meta['kind'], 'src': meta.get('src', 'studio')}


def make_pack(offer, iid, out, who='', brand='', paths=None, debug=False):
    """Пакет примерки для товара выгрузки. paths — локальные файлы фото (скачанные). Возвращает словарь для каталога или None."""
    import json
    key = pack_key(offer, paths)
    if key[1] not in TEMPLATE_KINDS: return None
    if key in _DONE: return clone_pack(_DONE[key], offer, iid, out, who, brand)
    src, front, back = pick_photos(paths or [])
    if not src: return None
    f = offer_fields(offer, who, brand); sizes = f.pop('sizes')
    it = dict(f, id=iid, src=src, front=front, back=back)
    if sizes: it['sizes'] = sizes
    if key[2] and f['kind'] in ('pants', 'jeans', 'shorts'): it['elastic'] = True
    try: W.build(it, out=out, debug=debug)
    except Exception as e:
        print('  пакет примерки не собрался:', offer.get('name'), e); return None
    mf = os.path.join(out, iid, 'meta.json'); meta = json.load(open(mf)); meta['src'] = src; json.dump(meta, open(mf, 'w'), ensure_ascii=False, indent=1)
    _DONE[key] = iid
    if not debug and os.path.exists(os.path.join(out, iid, 'debug.jpg')): os.remove(os.path.join(out, iid, 'debug.jpg'))
    return {'kind': f['kind'], 'src': src}
