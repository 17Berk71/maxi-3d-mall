#!/usr/bin/env python3
"""Чужое на снимке вещи: кофта в расстёгнутой куртке, сумка, руки, надписи и логотипы поверх кадра.

Пользователь по набору Wildberries: «топики и кожа девушки впечатались в пиджак», «свитер впечатался в пуховик»,
«впечаталась сумка», «впечатались руки». Сеть одежды (U2Net) честно отдаёт «верх» — вместе с тем, что под ним и на нём.

contamination(im, m, kp) → доля корпуса (четырёхугольник плечи–бёдра по позе), где вместо ткани вещи что-то другое:
  цвет далёк от ткани с боков корпуса или дырка в маске. Для выбора снимка (photo_pick: застёгнутая вещь без сумки лучше).
inner_span(im, m, kp) → маска середины расстёгнутой вещи (между полочками) — по строкам, сглажено по высоте.
text_mask(im, m) → надписи и логотипы поверх вещи (белые/чёрные тонкие штрихи рядком).
"""
import numpy as np, cv2
_DBG = False


def _torso(kp, shape, shrink=0.9):
    import pose
    poly = pose.torso_poly(kp)
    if poly is None: return None, None
    c = poly.mean(0); poly2 = c + (poly - c) * shrink
    tm = np.zeros(shape[:2], np.uint8); cv2.fillPoly(tm, [poly2.astype(np.int32)], 1)
    return tm > 0, poly


def side_ref(lab, m, poly):
    """цвет ткани — медиана по боковым полосам корпуса (по 22% ширины у боков): посередине бывает кофта под вещью."""
    x0, x1 = sorted([poly[0][0], poly[1][0]]); y0 = int(max(0, min(poly[0][1], poly[1][1])))
    y1 = int(min(m.shape[0], max(poly[2][1], poly[3][1]))); wd = x1 - x0
    if wd < 20 or y1 < y0 + 20: return None
    sides = np.zeros(m.shape, bool)
    sides[y0:y1, int(x0):int(x0 + wd * 0.22)] = True; sides[y0:y1, int(x1 - wd * 0.22):int(x1)] = True; sides &= m > 0
    if sides.sum() < 300: return None
    ref = np.median(lab[sides], 0); d = _dist(lab[sides], ref)
    return ref, float(np.percentile(d, 85)), (x0, x1, y0, y1)


def _dist(lab, ref):
    """разница цвета, яркость вполсилы: блестящая плащёвка и складки меняют яркость, а не оттенок"""
    d = lab - ref; d[..., 0] *= 0.5
    return np.linalg.norm(d, axis=-1)


def _thr(spread): return max(16, min(36, spread * 1.6))


def contamination(im, m, kp):
    if kp is None: return None
    tm, poly = _torso(kp, im.shape)
    if tm is None or tm.sum() < 800: return None
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    r = side_ref(lab, m, poly)
    if r is None: return None
    ref, spread, _ = r
    far = _dist(lab, ref) > _thr(spread)
    bad = (far & (m > 0)) | (m == 0)
    bad = cv2.morphologyEx((bad & tm).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0   # мелкий принт, пуговицы — не в счёт
    return float(bad.sum() / tm.sum())


def inner_span(im, m, kp, ref=None):
    """Середина расстёгнутой вещи: по строкам корпуса — от первого до последнего «чужого» пикселя у середины
    (кофта, кожа, топ, юбка под пиджаком: цвета бывают разные — берём весь промежуток), промежуток сглажен по высоте.
    Возвращает (маска, ref_bgr) или (None, None)."""
    if kp is None: return None, None
    tm, poly = _torso(kp, im.shape, 1.0)
    if tm is None: return None, None
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    r = side_ref(lab, m, poly)
    if r is None: return None, None
    rf, spread, (x0, x1, y0, y1) = r
    wd = x1 - x0; cx = (x0 + x1) / 2
    far = ((_dist(lab, rf) > _thr(spread)) & (m > 0)) | (m == 0)
    far = cv2.morphologyEx(far.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
    # низ: вещь может быть длиннее бёдер (пальто) — идём до низа маски
    ys = np.where(m.any(1))[0]; yb = int(ys[-1]) if len(ys) else y1
    L = np.full(m.shape[0], np.nan); R = np.full(m.shape[0], np.nan)
    a, b = int(cx - wd * 0.33), int(cx + wd * 0.33)
    for y in range(y0, yb + 1):
        row = far[y, a:b]
        if row.mean() < 0.08: continue
        c0 = int(cx) - a
        # отрезки «чужого» (дырки до 6 px прощаем); берём отрезок, ближайший к середине, не дальше 20% ширины корпуса
        rc = cv2.morphologyEx(row.astype(np.uint8)[None], cv2.MORPH_CLOSE, np.ones((1, 7), np.uint8))[0] > 0
        xs = np.where(rc)[0]
        if not len(xs): continue
        runs = np.split(xs, np.where(np.diff(xs) > 1)[0] + 1)
        best = min(runs, key=lambda r_: 0 if r_[0] <= c0 <= r_[-1] else min(abs(r_[0] - c0), abs(r_[-1] - c0)))
        dist = 0 if best[0] <= c0 <= best[-1] else min(abs(best[0] - c0), abs(best[-1] - c0))
        if dist > 0.2 * wd or len(best) < 0.03 * wd: continue
        L[y], R[y] = a + best[0], a + best[-1]
    ok = ~np.isnan(L)
    if ok.sum() < 0.25 * (y1 - y0): return None, None
    # верх промежутка — у горловины (y0 + 40% корпуса), иначе это не расстёгнутая вещь, а что-то на ней
    first = np.argmax(ok); yy = np.where(ok)[0]
    # расстёгнутая вещь открыта от горловины до низа: промежуток начинается у горловины и доходит до низа корпуса
    # (принт на груди худи, сумка, руки — нет)
    if _DBG: print("span dbg", y0, y1, yb, first, yy[-1], round(float(ok[first:yy[-1] + 1].mean()), 2), "".join("#" if ok[y] else "." for y in range(first, yy[-1] + 1, 8)), int(cx), int(wd))
    if first > y0 + 0.15 * (y1 - y0) or yy[-1] < min(yb, y1) - 0.12 * (y1 - y0): return None, None
    if ok[first:yy[-1] + 1].mean() < 0.7: return None, None
    k = max(5, (y1 - y0) // 12) | 1
    from scipy.ndimage import median_filter
    Ls = median_filter(np.interp(np.arange(len(L)), yy, L[yy]), k); Rs = median_filter(np.interp(np.arange(len(R)), yy, R[yy]), k)
    out = np.zeros(m.shape, np.uint8)
    last = yy[-1]
    for y in range(first, last + 1):
        if Rs[y] - Ls[y] >= 3: out[y, int(Ls[y]):int(Rs[y]) + 1] = 1
    out &= (m > 0).astype(np.uint8) | (far.astype(np.uint8))
    out &= cv2.dilate((m > 0).astype(np.uint8), np.ones((15, 15), np.uint8))
    if out.sum() < 0.02 * m.sum(): return None, None
    col = cv2.cvtColor(np.uint8([[np.clip(rf, 0, 255)]]), cv2.COLOR_LAB2BGR)[0, 0]
    return out, col


def text_mask(im, m):
    """Надписи и логотипы поверх снимка (zolla, ZOH, «ТЕЛОДВИЖЕНИЯ»): почти белые или почти чёрные штрихи
    с резким краем, несколько знаков одной высоты в ряд. Внутри маски вещи → закрасить."""
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    out = np.zeros(m.shape, np.uint8)
    inside = m > 0
    bw = ((g > 236) & (hsv[..., 1] < 40)).astype(np.uint8)   # белые надписи; чёрные — это обычно полоски резинки, складки
    n, lb, st, cen = cv2.connectedComponentsWithStats(bw)
    if n < 3: return None
    H = m.shape[0]
    cand = [i for i in range(1, n) if 0.006 * H < st[i, 3] < 0.08 * H and st[i, 2] < 0.12 * m.shape[1] and 25 < st[i, 4] and
            st[i, 4] < 0.75 * st[i, 2] * st[i, 3]]   # штрих, не сплошное пятно
    used = set()
    for i in cand:   # слово: соседи той же высоты на той же строке
        if i in used: continue
        hi, yi = st[i, 3], cen[i][1]
        word = [i]; grow = True
        while grow:
            grow = False
            for j in cand:
                if j in word: continue
                if any(abs(st[j, 3] - st[k, 3]) < 0.35 * st[k, 3] and abs(cen[j][1] - cen[k][1]) < 0.5 * st[k, 3] and abs(cen[j][0] - cen[k][0]) < 2.5 * st[k, 3] for k in word):
                    word.append(j); grow = True
        used.update(word)
        if len(word) < 3: continue
        wm = np.isin(lb, word)
        # надпись поверх кадра выходит и за вещь (часть букв на фоне или на соседней вещи); целиком внутри — это принт вещи
        if (wm & ~inside).sum() < 0.15 * wm.sum(): continue
        out[wm] = 1
    if not out.any(): return None
    # знак, целиком лежащий в маске вещи, но так же и за её краем — точно надпись поверх кадра; внутри — тоже убираем
    out = cv2.dilate(out, np.ones((5, 5), np.uint8)) & (cv2.dilate((m > 0).astype(np.uint8), np.ones((9, 9), np.uint8)))
    return out if out.sum() > 30 else None
