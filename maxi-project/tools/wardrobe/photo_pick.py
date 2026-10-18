#!/usr/bin/env python3
"""Выбор лучших снимков вещи из всех фото карточки магазина (для больших партий, без ручной разметки).

Для каждого фото: студийное ли (светлый ровный фон по краю, почти нет кожи), карточка-таблица/реклама (много мелкого
текста), и — для фото на модели — маска вещи сетью cloth-seg: какая доля кадра, касается ли края кадра (обрезана),
симметрия (спереди/сзади, а не боком), сколько кожи внутри рамки вещи (открытая грудь, руки поверх).

Оценка снимка «на модели»: крупно и целиком в кадре, симметрично, мало кожи и чужих вещей. Спинка — тот же
силуэт, но без лица (кожа в верхней части головы почти нет) или явная пометка в разметке.
Результат: {'front': путь, 'back': путь, 'src': 'studio'|'model', 'scores': [...]}; кэш — pick.json в папке вещи.
"""
import json, os, sys, glob
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wardrobe_paths import TOPS  # noqa: E402

BOTTOMS = {'pants', 'jeans', 'shorts', 'skirt'}


def basic(im):
    small = cv2.resize(im, (225, 300), interpolation=cv2.INTER_AREA).astype(np.float32)
    b = 12; border = np.concatenate([small[:b].reshape(-1, 3), small[-b:].reshape(-1, 3), small[:, :b].reshape(-1, 3), small[:, -b:].reshape(-1, 3)])
    ycc = cv2.cvtColor(small.astype(np.uint8), cv2.COLOR_BGR2YCrCb).astype(np.float32)
    skin = ((ycc[..., 1] > 137) & (ycc[..., 1] < 173) & (ycc[..., 2] > 77) & (ycc[..., 2] < 127))
    g = cv2.Canny(cv2.cvtColor(small.astype(np.uint8), cv2.COLOR_BGR2GRAY), 80, 160)
    return dict(bmean=float(border.mean()), bstd=float(border.std(0).mean()), skin=float(skin.mean()), edges=float((g > 0).mean())), skin


def garment_mask(ms, kind):
    if kind == 'dress': return ms['full'] | ms['upper'] | ms['lower']
    if kind in BOTTOMS:
        m = ms['lower']
        if kind == 'skirt' and m.sum() < 0.5 * ms['full'].sum(): m = m | ms['full']
        return m
    m = ms['upper']
    if (ms['full'].sum() > 0.5 * max(1, m.sum()) and kind in ('coat', 'puffer')) or m.sum() < 0.25 * ms['full'].sum(): m = m | ms['full']
    return m


def score_model(im, kind):
    from seg_person import cloth_masks
    h, w = im.shape[:2]
    ms = cloth_masks(im); m = garment_mask(ms, kind).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    if n < 2: return dict(ok=False, score=-1, why='нет вещи')
    k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])); m = (lab == k).astype(np.uint8)
    x, y, bw, bh = st[k, :4]; area = m.sum() / (h * w)
    cut_top = y <= 2; cut_bot = y + bh >= h - 3; cut_side = x <= 2 or x + bw >= w - 3
    # симметрия силуэта относительно его середины (боком — несимметрично)
    sub = m[y:y + bh, x:x + bw]; sym = 1 - float(np.abs(sub.astype(np.int8) - sub[:, ::-1].astype(np.int8)).mean())
    # чужие вещи внутри рамки (другой класс одежды поверх/рядом)
    other = sum(int(ms[c][y:y + bh, x:x + bw].sum()) for c in ('upper', 'lower', 'full')) - int(sub.sum())
    other_k = other / max(1, sub.sum())
    _, skin = basic(im[y:y + bh, x:x + bw]); skin_k = float(skin.mean())
    # лицо над вещью (спереди видно лицо и шею, сзади — затылок): доля кожи в полосе над верхом вещи по ширине её середины
    face = 0.0
    if y > 20:
        y0, y1 = max(0, y - int(0.22 * bh)), max(1, y - int(0.08 * bh)); xa, xb = x + bw // 4, x + 3 * bw // 4   # выше шеи: лицо или затылок
        if y1 > y0 + 4:   # кожа лица светлая, тёмно-русые волосы на затылке в тот же диапазон цвета попадают — их отсекаем по яркости
            yc = cv2.cvtColor(im[y0:y1, xa:xb], cv2.COLOR_BGR2YCrCb).astype(np.int16)
            face = float(((yc[..., 0] > 115) & (yc[..., 1] > 135) & (yc[..., 1] < 173) & (yc[..., 2] > 77) & (yc[..., 2] < 127)).mean())
    s = area * 100 * (0.25 if cut_top else 1) * (0.35 if cut_bot and kind not in BOTTOMS | {'coat', 'dress'} else 0.7 if cut_bot else 1) * (0.5 if cut_side else 1)
    s *= (0.4 + 0.6 * sym) * max(0.2, 1 - 2.5 * skin_k) * max(0.3, 1 - 0.8 * min(1, other_k))
    # человек в полный рост на ровном фоне — по нему фабрика меряет длину вещи в см (рост модели из карточки)
    from model_photo import person_scale
    full_fig = person_scale(im, 175) is not None
    if full_fig: s *= 1.2
    return dict(ok=not cut_top and not cut_side, score=round(s, 2), face=round(face, 3), area=round(area, 3), sym=round(sym, 3), skin=round(skin_k, 3), other=round(other_k, 2),
                full=full_fig, cut=''.join(c for c, f in (('t', cut_top), ('b', cut_bot), ('s', cut_side)) if f))


def person_free(im, kind):
    """Студийное фото — без человека: нет второй вещи (брюки, обувь под пальто) и нет кожи выше вещи (лицо, шея)."""
    from seg_person import cloth_masks
    ms = cloth_masks(im); m = garment_mask(ms, kind)
    if m.sum() < 500: return True
    # «вторая вещь» на человеке: у верха — брюки/юбка («низ»), у низа — кофта («верх»); «целиком» — та же вещь (длинная часть)
    other = int(ms['upper'].sum()) if kind in BOTTOMS else int(ms['lower'].sum()) if kind != 'dress' else 0
    m = m | ms['full']
    ys = np.where(m.any(1))[0]; y0 = ys[0]
    _, skin = basic(im); h = im.shape[0]; s0 = int(y0 / h * skin.shape[0])
    face = float(skin[:max(1, s0)].mean()) if s0 > 3 else 0.0
    # ноги и обувь под вещью: ниже вещи на студийном фото — только фон
    y1 = ys[-1]; below = im[min(h - 1, y1 + 15):]
    legs = 0.0
    if below.shape[0] > 0.1 * h:      # вещь почти до низа кадра — ног не видно, нечего проверять
        bg = np.median(np.concatenate([im[:8].reshape(-1, 3), im[-8:].reshape(-1, 3)]), 0)
        legs = float((np.abs(below.astype(np.int16) - bg).max(2) > 40).mean())
    return other < 0.12 * m.sum() and face < 0.004 and legs < 0.03


def promo_card(im):
    """Рекламная картинка карточки (светлый фон, вещь маленькая, вокруг надписи и значки): у студийного снимка один предмет.
    Считаем отдельные предметы сетью ISNet: три и больше заметных (≥0.3% кадра) или главный меньше 8% кадра — не студия."""
    from cutout import isnet_mask
    m = isnet_mask(im)
    if m is None: return False
    n, lab, st, _ = cv2.connectedComponentsWithStats(m); a = st[1:, cv2.CC_STAT_AREA] / m.size if n > 1 else np.array([0.0])
    return (a > 0.003).sum() >= 3 or a.max() < 0.08


def pick(photos, kind, hints=None, table=()):
    """photos — список путей; hints — {'studio': [...], 'back': [...]} номера из ручной разметки (если есть)."""
    hints = hints or {}; res = []
    for i, p in enumerate(photos):
        im = cv2.imread(p)
        if im is None: continue
        f, _ = basic(im); bn = os.path.basename(p)[:2]; nr = int(bn) if bn.isdigit() else i + 1
        studio = f['bmean'] > 212 and f['bstd'] < 16 and f['skin'] < 0.02 and f['edges'] < 0.07
        texty = f['edges'] > 0.11 and f['skin'] < 0.05
        r = dict(n=nr, path=p, studio=studio or nr in hints.get('studio', []), texty=texty or nr in table)
        if r['studio'] and not r['texty'] and not person_free(im, kind): r['studio'] = False; r['person'] = True   # модель на белом фоне
        if r['studio'] and not r['texty'] and promo_card(im): r['studio'] = False; r['texty'] = True   # картинка-реклама: вещь + надписи и значки
        if not r['studio'] and not r['texty']: r.update(score_model(im, kind))
        res.append(r)
    st = [r for r in res if r['studio'] and not r['texty']]
    if st:
        back = st[1] if len(st) > 1 else st[0]
        return dict(src='studio', front=st[0]['path'], back=back['path'], scores=res)
    mod = sorted([r for r in res if r.get('score', -1) > 0], key=lambda r: -r['score'])
    if not mod: return dict(src=None, scores=res)
    # спереди — с лицом (у низа лица часто не видно — тогда как есть), спинка — без лица
    fr = [r for r in mod if r['ok'] and (r.get('face', 0) > 0.12 or kind in BOTTOMS)]
    front = fr[0] if fr else next((r for r in mod if r['ok'] and r['n'] not in hints.get('back', [])), mod[0])
    hb = [r for r in mod if r['ok'] and r is not front and r['score'] > 0.3 * front['score'] and (r['n'] in hints.get('back', []) or (r.get('face', 1) < 0.06 and kind not in BOTTOMS))]
    back = hb[0] if hb else front
    return dict(src='model', front=front['path'], back=back['path'], scores=res)


if __name__ == '__main__':
    d = sys.argv[1]; kind = sys.argv[2]
    ph = sorted(glob.glob(os.path.join(d, '[0-9][0-9].webp')))
    r = pick(ph, kind)
    for s in r['scores']: print({k: v for k, v in s.items() if k != 'path'})
    print('ВЫБОР', r['src'], r.get('front'), r.get('back'))
