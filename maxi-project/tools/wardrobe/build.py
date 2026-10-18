#!/usr/bin/env python3
"""Фабрика вещей из фото: каталожное фото вещи → выпрямленная текстура и мерки для примерочной.

Шаги для каждой вещи (спереди и сзади отдельно):
 1. вырезать вещь из фона (GrabCut: фон — края кадра и цвет стены/ковра; вещь — середина кадра);
 2. найти части: у верха — корпус и рукава (корпус = центральная полоса, ширина по низу вещи),
    у низа — пояс и две штанины (где маска делится на два куска — шаг);
 3. выпрямить: каждая строка корпуса (от горловины до низа) растягивается на ширину текстуры —
    принт и ткань ложатся на шаблон строка в строку, фон за краями не попадает;
    дырки (горловина, фон между рукавом и корпусом) закрашиваются тканью;
 4. мерки в долях: длина к ширине корпуса, длина рукава, где шаг у брюк, ширина штанины внизу;
 5. записать текстуры (webp) и meta.json.

Запуск: python3 tools/wardrobe/build.py [id ...]   (результат — tools/wardrobe/out/, в репозиторий не попадает)

Модули фабрики: wardrobe_paths (пути), photo_io (чтение фото), cutout (вырезание), parts_top / parts_bottom (части и мерки),
drape_cut (выкройка для расчёта ткани), color_balance, model_photo (фото на человеке), debug_view.
"""
import json, os, sys, glob
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from items import ITEMS  # noqa: E402
from color_balance import apply_gain, wall_gain  # noqa: E402,F401
from cutout import segment, studio_mask  # noqa: E402,F401
from debug_view import overlay  # noqa: E402,F401
from drape_cut import cut_for_drape  # noqa: E402,F401
from model_photo import load_model_photo  # noqa: E402,F401
from parts_bottom import bottom_parts  # noqa: E402,F401
from parts_top import top_parts  # noqa: E402,F401
from photo_io import load, studio_load, load_any  # noqa: E402,F401
from wardrobe_paths import HANG_K, OUT, TEX_H, TEX_W, TOPS  # noqa: E402,F401
import model_photo  # noqa: E402


def build(it, out=None, debug=True):
    od = os.path.join(out or OUT, it['id']); os.makedirs(od, exist_ok=True)
    meta = dict(id=it['id'], name=it['name'], kind=it['kind'], states=it.get('states'), zip=it.get('zip', False), collar=it.get('collar', False), hood=it.get('hood', False))
    if it.get('pleats'): meta['pleats'] = True
    if it.get('lining'): meta['lining'] = it['lining']   # нижний слой у подола (цвет): шорты-подклад, подъюбник
    if it.get('puff'): meta['puff'] = True
    if it.get('puffer'): meta['puffer'] = True   # стёганый жилет: объём утеплителя, как у пуховика
    if it.get('stand'): meta['stand'] = True   # воротник-стойка   # рукав-фонарик: окат шире проймы, собран в неё; внизу — манжета
    if it.get('who'): meta['who'] = it['who']
    ovs = []
    for side in ('front', 'back'):
        if it.get('src') == 'model':
            im, m = load_model_photo(it[side], it['kind'])
            flat = False
        elif it.get('src') == 'studio':      # студийное фото магазина (лёжа или на невидимом манекене)
            im, m = studio_load(it[side]); flat = True
        else:
            im = load(it[side])
            m, flat = segment(im)
        part = top_parts if it['kind'] in TOPS else bottom_parts
        cf = None
        if part is bottom_parts and it['kind'] == 'skirt': cf = 0.97     # у юбки нет шага: вся длина — «посадка», профиль ширины по ней
        if it.get('sizes') and part is bottom_parts and it['kind'] != 'skirt':
            c0 = it['sizes'][0]['cm']
            if c0.get('outseam') and c0.get('inseam'): cf = (c0['outseam'] - c0['inseam']) / c0['outseam']
        tex, sleeve, mm, info = part(im, m, it['kind'], flat, cf, flat and it.get('src') != 'studio') if part is bottom_parts else part(im, m, it['kind'])
        if it.get('src') == 'model' and side == 'front' and model_photo.LAST_HEM is not None: meta['hem_waist'] = model_photo.LAST_HEM
        if not flat and it.get('src') != 'model':
            g = wall_gain(im); tex = apply_gain(tex, g)
            if sleeve is not None: sleeve = apply_gain(sleeve, g)
            mm['color'] = tuple(int(c) for c in np.clip(np.array(mm['color']) * g, 0, 255))
        cv2.imwrite(os.path.join(od, side + '.webp'), tex, [cv2.IMWRITE_WEBP_QUALITY, 88])
        meta.setdefault('drape', {})[side] = cut_for_drape(apply_gain(im, wall_gain(im)) if (not flat and it.get('src') != 'model') else im, m, info, it['kind'], od, side, bool(it.get('zip')), bool(it.get('collar')) and not it.get('stand'))
        if sleeve is not None and side == 'front': cv2.imwrite(os.path.join(od, 'sleeve.webp'), sleeve, [cv2.IMWRITE_WEBP_QUALITY, 85])
        meta[side] = dict((k, (round(v, 3) if isinstance(v, float) else v)) for k, v in mm.items())
        meta[side]['flat'] = bool(flat)
        ovs.append(cv2.resize(overlay(im, m, info, it['kind']), (360, int(360 * im.shape[0] / im.shape[1]))))
        ovs.append(cv2.resize(tex, (360, int(360 * TEX_H / TEX_W))))
    hmax = max(o.shape[0] for o in ovs)
    sheet = np.hstack([np.vstack([o, np.full((hmax - o.shape[0], o.shape[1], 3), 255, np.uint8)]) for o in ovs])
    if debug: cv2.imwrite(os.path.join(od, 'debug.jpg'), sheet, [cv2.IMWRITE_JPEG_QUALITY, 80])
    # мерки — из фото спереди (сзади — запасной вариант)
    f = meta['front']
    meta['fit'] = dict((k, f[k]) for k in f if k in ('len_w', 'sleeve', 'crotch', 'hem', 'knee', 'full_w'))
    meta['shape'] = f.pop('shape'); meta['back'].pop('shape', None)
    meta['shape']['hang'] = not f.get('flat')
    for k in ('elastic', 'crop', 'cm', 'fitname'):
        if it.get(k): meta['shape'][k] = it[k]
    if it.get('src') == 'model': meta['shape']['hang'] = False; meta['shape']['worn'] = True   # ширины сняты с вещи на человеке
    if meta.get('hem_waist') is not None: meta['shape']['hem_waist'] = meta.pop('hem_waist')
    if it.get('ref_len'): meta['shape']['ref_len'] = it['ref_len']
    if it.get('sizes'): meta['sizes'] = it['sizes']
    for k in ('brand', 'url', 'price', 'note'):
        if it.get(k): meta[k] = it[k]
    # вещь на вешалке тянется вниз и сужается: у футболки Zolla на вешалке длина/ширина 1.82, она же лёжа — 1.31.
    # Поправка 0.72 для всех верхних вещей, снятых на вешалке (лёжа — без поправки)
    if it['kind'] in TOPS and not f.get('flat'): meta['fit']['len_w'] = round(meta['fit']['len_w'] * HANG_K, 3)
    meta['color'] = '#%02x%02x%02x' % tuple(f['color'])
    meta['sleeve'] = it['kind'] in TOPS
    json.dump(meta, open(os.path.join(od, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
    return meta


if __name__ == '__main__':
    want = set(sys.argv[1:])
    idx = []
    for it in ITEMS:
        if want and it['id'] not in want: continue
        try:
            mt = build(it); idx.append(mt); print('ok', it['id'], mt['fit'])
        except Exception as e:
            import traceback; traceback.print_exc(); print('FAIL', it['id'], e)
    # индекс — по всем собранным вещям (и при сборке части)
    idx = [json.load(open(os.path.join(OUT, it['id'], 'meta.json'))) for it in ITEMS if os.path.exists(os.path.join(OUT, it['id'], 'meta.json'))]
    json.dump(idx, open(os.path.join(OUT, 'index.json'), 'w'), ensure_ascii=False, indent=1)
