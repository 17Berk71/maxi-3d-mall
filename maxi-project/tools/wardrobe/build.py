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
"""
import json, os, sys, glob
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(__file__))
from items import ITEMS

HERE = os.path.dirname(os.path.abspath(__file__))
RAW, OUT = os.path.join(HERE, 'raw'), os.path.join(HERE, 'out')
TOPS = {'tee', 'sweater', 'hoodie', 'jacket', 'shirt'}
TEX_W, TEX_H = 512, 640
HANG_K = 0.72          # калибровка по футболке Zolla: лёжа 1.31, на вешалке 1.82


def find(key):
    f = glob.glob(os.path.join(RAW, key + '*'))
    return f[0] if f else None


def load(key, maxh=1400):
    im = cv2.imread(find(key))
    h, w = im.shape[:2]
    # скриншоты с телефона: чёрные поля сверху и снизу — обрезать
    rows = np.where(im.reshape(h, -1).max(1) > 18)[0]
    im = im[rows[0]:rows[-1] + 1]
    h, w = im.shape[:2]
    k = maxh / h
    return cv2.resize(im, (int(w * k), maxh), interpolation=cv2.INTER_AREA) if k < 1 else im


def segment(im):
    """Маска вещи. Фон бывает двух видов: стена с полкой и диваном (вещь на вешалке) или зелёный ковёр (вещь лёжа)."""
    h, w = im.shape[:2]
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    H, S, V = [hsv[..., i].astype(int) for i in range(3)]
    green = (H > 18) & (H < 58) & (S > 70) & (V > 50)          # ковёр (OpenCV: H 0..180)
    flat = green.mean() > 0.35
    gc = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    if flat:
        gc[green] = cv2.GC_BGD
        gc[~green] = cv2.GC_PR_FGD
        gc[int(h * .82):] = np.where(green[int(h * .82):], cv2.GC_BGD, cv2.GC_PR_BGD)  # ноги внизу кадра
    else:
        # вещь на вешалке: сверху полка, снизу диван — по строкам, где «не стена» почти во всю ширину
        lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
        band = np.concatenate([lab[int(h * .35):int(h * .65), :int(w * .04)].reshape(-1, 3), lab[int(h * .35):int(h * .65), -int(w * .04):].reshape(-1, 3)])
        wall = np.median(band, 0)
        dab = np.linalg.norm(lab[..., 1:] - wall[1:], axis=2)          # цветность: стена бирюзовая, вещь — нет
        dL = np.abs(lab[..., 0] - wall[0])
        dist = np.sqrt(dab ** 2 * 4 + dL ** 2 * .25)
        nonwall = (dist > 14).mean(1)
        rows = np.arange(h)
        # полка — последняя «сплошная» строка в верхней трети; диван — сплошной блок строк от низа кадра
        shelf = [y for y in range(int(h * .03), int(h * .35)) if nonwall[y] > .88]
        y0 = (max(shelf) + 4) if shelf else int(h * .12)
        y1 = h
        while y1 > h * .55 and nonwall[y1 - 1] > .85: y1 -= 1
        y1 = max(int(h * .55), y1 - 2)
        gc[:y0] = cv2.GC_BGD; gc[y1:] = cv2.GC_BGD
        gc[y0:y1, int(w * .04):int(w * .96)] = cv2.GC_PR_FGD
        sure_wall = (dab < 3.5) & (dL < 18)
        gc[sure_wall & (gc != cv2.GC_BGD)] = cv2.GC_BGD
    gc[:, :3] = gc[:, -3:] = cv2.GC_BGD
    cy0, cy1, cx0, cx1 = int(h * .42), int(h * .58), int(w * .44), int(w * .56)
    gc[cy0:cy1, cx0:cx1] = cv2.GC_FGD
    bg, fg = np.zeros((1, 65)), np.zeros((1, 65))
    small = 2 if h > 900 else 1
    ims = cv2.resize(im, (w // small, h // small)); gcs = cv2.resize(gc, (w // small, h // small), interpolation=cv2.INTER_NEAREST)
    cv2.grabCut(ims, gcs, None, bg, fg, 8, cv2.GC_INIT_WITH_MASK)
    m = cv2.resize(((gcs == cv2.GC_FGD) | (gcs == cv2.GC_PR_FGD)).astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
    if flat: m[green] = 0
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    # одна связная вещь, содержащая центр кадра
    n, lab_, st, _ = cv2.connectedComponentsWithStats(m)
    c = lab_[h // 2, w // 2]
    if c == 0: c = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    m = (lab_ == c).astype(np.uint8)
    # закрыть дырки внутри вещи
    ff = m.copy(); cv2.floodFill(ff, None, (0, 0), 1)
    holes = (1 - ff)
    if flat: holes[green] = 0          # просвет ковра между штанинами — не дырка
    m = m | holes
    return m, flat


def runs(row):
    d = np.diff(np.concatenate([[0], row, [0]]))
    s, e = np.where(d == 1)[0], np.where(d == -1)[0]
    return list(zip(s, e))


def central_run(row, cx):
    rs = runs(row)
    if not rs: return None
    for s, e in rs:
        if s <= cx < e: return s, e
    return min(rs, key=lambda r: min(abs(r[0] - cx), abs(r[1] - cx)))


def fill_holes_with_cloth(img, m):
    """Пиксели вне маски внутри выпрямленной области закрасить тканью (горловина, щели)."""
    inv = (1 - m).astype(np.uint8)
    if inv.sum() == 0: return img
    return cv2.inpaint(img, inv * 255, 7, cv2.INPAINT_TELEA)


def rect_rows(im, m, y0, y1, spans, W, Hh):
    """Каждая строка y из [y0,y1] — отрезок spans(y) → строка текстуры шириной W."""
    out = np.zeros((Hh, W, 3), np.uint8); om = np.zeros((Hh, W), np.uint8)
    for j in range(Hh):
        y = int(round(y0 + (y1 - y0) * j / (Hh - 1)))
        s, e = spans(y)
        xs = np.linspace(s, e - 1, W).astype(np.float32)
        out[j] = cv2.remap(im, xs.reshape(1, -1), np.full((1, W), y, np.float32), cv2.INTER_LINEAR)[0]
        om[j] = cv2.remap(m * 255, xs.reshape(1, -1), np.full((1, W), y, np.float32), cv2.INTER_NEAREST)[0] > 127
    return fill_holes_with_cloth(out, om), om


def top_parts(im, m, kind):
    h, w = m.shape
    ys = np.where(m.any(1))[0]
    # крючок вешалки сверху — тонкий: начало вещи там, где ширина > 15% максимальной
    wid = m.sum(1)
    big = np.where(wid > wid.max() * .15)[0]
    top, bot = big[0], big[-1]
    # снизу к вещи может прилипнуть светлое пятно стены (блик от окна): строки, цвет которых далёк от цвета вещи, — не вещь
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    L0 = bot - top
    core = lab[top + int(L0 * .3):top + int(L0 * .7)][m[top + int(L0 * .3):top + int(L0 * .7)] > 0]
    gmed = np.median(core, 0)
    while bot > top + L0 * .5:
        px = lab[bot][m[bot] > 0]
        if len(px) and np.linalg.norm(np.median(px, 0) - gmed) > 32: m[bot] = 0; bot -= 1
        else: break
    # сверху — вешалка (серый пластик) и стена над плечами: убрать пиксели, далёкие по цвету от вещи
    yh = top + int(L0 * .14)
    dtop = np.linalg.norm(lab[top:yh] - gmed, axis=2)
    if not (dtop[m[top:yh] > 0] > 34).mean() > .6:          # если почти вся верхушка «другого цвета» — это вещь пэчворк, не трогаем
        m[top:yh][dtop > 34] = 0
    wid = m.sum(1)
    big2 = np.where(wid[:bot + 1] > wid.max() * .35)[0]
    if len(big2): top = max(top, big2[0])
    L = bot - top
    cx = int(np.median([np.mean(np.where(m[y])[0]) for y in range(top + int(L * .6), bot - int(L * .05)) if m[y].any()]))
    # ширина корпуса: центральная полоса в нижней части вещи (у футболок рукава выше)
    cw = []
    for y in range(top + int(L * .55), bot - int(L * .04)):
        r = central_run(m[y], cx)
        if r: cw.append(r[1] - r[0])
    body_w = float(np.median(cw))
    full_w = float(np.percentile(wid[top:top + int(L * .5)], 90))
    long = kind in ('sweater', 'hoodie', 'jacket', 'shirt')
    if long and body_w > full_w * .8:
        # рукава висят вдоль корпуса и сливаются с ним: корпус ≈ 62% общей ширины в плечах
        body_w = full_w * .62
    hw = body_w / 2
    # рукав: у футболки — где ширина резко падает к ширине корпуса
    sleeve_end = None
    if not long:
        wide = [y for y in range(top + int(L * .05), top + int(L * .75)) if wid[y] > body_w * 1.15]
        sleeve_end = (max(wide) + 1) if wide else None
    sleeve_len = ((sleeve_end - top) / L) if sleeve_end else (1.0 if long else .35)
    # ширина корпуса — сразу под рукавами (внизу висящая вещь сужается и занижает ширину)
    if sleeve_end:
        cw2 = [central_run(m[y], cx) for y in range(sleeve_end + int(L * .03), sleeve_end + int(L * .16))]
        cw2 = [r[1] - r[0] for r in cw2 if r]
        if cw2: body_w = max(body_w, float(np.percentile(cw2, 75))); hw = body_w / 2
    spans = lambda y: (int(cx - hw), int(cx + hw))
    tex, tm = rect_rows(im, m, top, bot, spans, TEX_W, TEX_H)
    # рукав: ткань с бока корпуса (там обычно нет принта), без фона; у рукава на фото слишком мало чистых пикселей
    side = tex[int(TEX_H * .35):int(TEX_H * .75), int(TEX_W * .04):int(TEX_W * .2)]
    sleeve = cv2.resize(np.hstack([side, side[:, ::-1]]), (256, 256), interpolation=cv2.INTER_LINEAR)
    meta = dict(len_w=L / body_w, sleeve=round(min(1.0, sleeve_len), 3), full_w=full_w / body_w,
                color=tuple(int(c) for c in np.median(im[m > 0].reshape(-1, 3), 0)[::-1]))
    return tex, sleeve, meta, dict(top=top, bot=bot, cx=cx, hw=hw)


def bottom_parts(im, m, kind):
    h, w = m.shape
    wid = m.sum(1)
    big = np.where(wid > wid.max() * .25)[0]
    top, bot = big[0], big[-1]
    L = bot - top
    cx = int(np.median([np.mean(np.where(m[y])[0]) for y in range(top, top + int(L * .2)) if m[y].any()]))
    # шаг: первая строка, где маска делится на две штанины (два куска шире 15% ширины в бёдрах)
    hip0 = float(np.median(wid[top + int(L * .03):top + int(L * .15)]))
    crotch = None
    # снизу вверх: пока у центра щель между штанинами — это ещё ноги; первая строка без щели — шаг
    def gap_at(y):
        rs = [r for r in runs(m[y]) if r[1] - r[0] > hip0 * .12]
        return len(rs) >= 2
    y = bot - int(L * .08)
    while y > top + L * .12 and gap_at(y): y -= 1
    crotch = y + 1 if y < bot - int(L * .08) else None
    if crotch is None: crotch = top + int(L * .38)
    rs = [r for r in runs(m[crotch + 3]) if r[1] - r[0] > hip0 * .15]
    if len(rs) >= 2: cx = int((rs[0][1] + rs[1][0]) / 2)
    hip_w = float(np.median(wid[top + int(L * .05):crotch]))
    cs = (crotch - top) / L

    def spans_hip(y):
        r = central_run(m[y], cx) or (cx - 5, cx + 5); return r
    hip, _ = rect_rows(im, m, top, crotch, spans_hip, TEX_W, max(8, int(TEX_H * cs)))

    def leg_span(side):
        def f(y):
            rs = runs(m[y])
            rs = [r for r in rs if ((r[0] + r[1]) / 2 < cx) == (side < 0)]
            if not rs: return (cx - 10, cx) if side < 0 else (cx, cx + 10)
            return max(rs, key=lambda q: q[1] - q[0])
        return f
    lh = TEX_H - hip.shape[0]
    legL, _ = rect_rows(im, m, crotch, bot, leg_span(-1), TEX_W // 2, lh)
    legR, _ = rect_rows(im, m, crotch, bot, leg_span(1), TEX_W // 2, lh)
    tex = np.vstack([hip, np.hstack([legL, legR])])
    hem_w = np.mean([leg_span(-1)(bot - 3)[1] - leg_span(-1)(bot - 3)[0], leg_span(1)(bot - 3)[1] - leg_span(1)(bot - 3)[0]])
    knee = crotch + int((bot - crotch) * .45)
    knee_w = np.mean([leg_span(-1)(knee)[1] - leg_span(-1)(knee)[0], leg_span(1)(knee)[1] - leg_span(1)(knee)[0]])
    meta = dict(len_w=L / hip_w, crotch=round(cs, 3), hem=round(hem_w / hip_w, 3), knee=round(knee_w / hip_w, 3),
                color=tuple(int(c) for c in np.median(im[m > 0].reshape(-1, 3), 0)[::-1]))
    return tex, None, meta, dict(top=top, bot=bot, cx=cx, crotch=crotch)


def overlay(im, m, info, kind):
    o = im.copy()
    o[m == 0] = (o[m == 0] * .25).astype(np.uint8)
    cv2.line(o, (0, info['top']), (o.shape[1], info['top']), (0, 255, 255), 3)
    cv2.line(o, (0, info['bot']), (o.shape[1], info['bot']), (0, 255, 255), 3)
    if 'hw' in info:
        for x in (info['cx'] - info['hw'], info['cx'] + info['hw']):
            cv2.line(o, (int(x), info['top']), (int(x), info['bot']), (255, 0, 255), 3)
    if 'crotch' in info:
        cv2.line(o, (0, info['crotch']), (o.shape[1], info['crotch']), (255, 0, 255), 3)
    return o


def build(it):
    od = os.path.join(OUT, it['id']); os.makedirs(od, exist_ok=True)
    meta = dict(id=it['id'], name=it['name'], kind=it['kind'], states=it.get('states'), zip=it.get('zip', False), collar=it.get('collar', False))
    ovs = []
    for side in ('front', 'back'):
        im = load(it[side])
        m, flat = segment(im)
        part = top_parts if it['kind'] in TOPS else bottom_parts
        tex, sleeve, mm, info = part(im, m, it['kind'])
        cv2.imwrite(os.path.join(od, side + '.webp'), tex, [cv2.IMWRITE_WEBP_QUALITY, 88])
        if sleeve is not None and side == 'front': cv2.imwrite(os.path.join(od, 'sleeve.webp'), sleeve, [cv2.IMWRITE_WEBP_QUALITY, 85])
        meta[side] = dict((k, (round(v, 3) if isinstance(v, float) else v)) for k, v in mm.items())
        meta[side]['flat'] = bool(flat)
        ovs.append(cv2.resize(overlay(im, m, info, it['kind']), (360, int(360 * im.shape[0] / im.shape[1]))))
        ovs.append(cv2.resize(tex, (360, int(360 * TEX_H / TEX_W))))
    hmax = max(o.shape[0] for o in ovs)
    sheet = np.hstack([np.vstack([o, np.full((hmax - o.shape[0], o.shape[1], 3), 255, np.uint8)]) for o in ovs])
    cv2.imwrite(os.path.join(od, 'debug.jpg'), sheet, [cv2.IMWRITE_JPEG_QUALITY, 80])
    # мерки — из фото спереди (сзади — запасной вариант)
    f = meta['front']
    meta['fit'] = dict((k, f[k]) for k in f if k in ('len_w', 'sleeve', 'crotch', 'hem', 'knee', 'full_w'))
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
    if not want:
        json.dump(idx, open(os.path.join(OUT, 'index.json'), 'w'), ensure_ascii=False, indent=1)
