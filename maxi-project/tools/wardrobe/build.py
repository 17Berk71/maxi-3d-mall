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
        med = np.median(px, 0) if len(px) else gmed
        # далеко по цвету — или та же светлота, но оттенок стены (белая вещь на бирюзовой стене)
        if len(px) and (np.linalg.norm(med - gmed) > 32 or np.linalg.norm(med[1:] - gmed[1:]) > 7): m[bot] = 0; bot -= 1
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
    # силуэт корпуса: ширина по строкам ниже проймы (у футболок рукав отдельно — корпус виден честно)
    arm = sleeve_end if sleeve_end else top + int(L * .3)
    rowspan = {}
    if sleeve_end:
        for y in range(arm, bot + 1):
            r = central_run(m[y], cx)
            if r and (r[1] - r[0]) > body_w * .55: rowspan[y] = r
        ys_ = sorted(rowspan)
        if ys_:
            # края по высоте: медиана (выбросы — пятна стены у низа), потом сглаживание; ширина не дальше ±12% от средней
            ls = np.array([rowspan[y][0] for y in ys_], np.float32); rs = np.array([rowspan[y][1] for y in ys_], np.float32)
            k = max(5, int(L * .09)) | 1
            ls = cv2.medianBlur(ls.reshape(-1, 1), 5).ravel() if k > 5 else ls
            from scipy.ndimage import median_filter
            ls = median_filter(ls, k, mode='nearest'); rs = median_filter(rs, k, mode='nearest')
            mw = float(np.median(rs - ls)); c = (ls + rs) / 2; wd = np.clip(rs - ls, mw * .88, mw * 1.12)
            c = median_filter(c, k, mode='nearest')
            k2 = max(3, int(L * .04)) | 1
            c = cv2.blur(c.reshape(-1, 1), (1, k2)).ravel(); wd = cv2.blur(wd.reshape(-1, 1).astype(np.float32), (1, k2)).ravel()
            rowspan = {y: (int(a - b / 2), int(a + b / 2)) for y, a, b in zip(ys_, c, wd)}
    def spans(y):
        if y in rowspan: return rowspan[y]
        if rowspan and y > max(rowspan): return rowspan[max(rowspan)]
        if rowspan: return rowspan[min(rowspan)]          # выше проймы — та же ширина, что у проймы (без ступеньки)
        return (int(cx - hw), int(cx + hw))
    tex, tm = rect_rows(im, m, top, bot, spans, TEX_W, TEX_H)
    # форма вещи для примерочной (всё в долях длины L): пройма, ширина корпуса по высоте, рукав
    tw = []
    for t in np.linspace(0, 1, 16):
        y = int(arm + (bot - 2 - arm) * t)
        a, b = spans(y); tw.append(round((b - a) / L, 4))
    shape = dict(arm=round((arm - top) / L, 3), tw=tw, merged=not bool(sleeve_end))
    if sleeve_end:
        sl = []
        for sd in (-1, 1):
            edge = int(cx + sd * hw)
            xs = range(edge + sd * 3, (w if sd > 0 else -1), sd)
            cols = []
            for x in xs:
                col = np.where(m[top:arm + int(L * .1), x])[0]
                if len(col) < 3: break
                cols.append((x, col[0] + top, col[-1] + top))
            if len(cols) < 5: continue
            out = abs(cols[-1][0] - edge)
            tail = cols[-max(2, len(cols) // 7):]
            open_ = float(np.median([c[2] - c[1] for c in tail]))
            ah = cols[0][2] - cols[0][1]
            # длина рукава по оси: от плечевой точки до середины края рукава
            x1, ymid = cols[-1][0], (tail[-1][1] + tail[-1][2]) / 2
            ln = float(np.hypot(x1 - edge, ymid - cols[0][1]))
            sl.append((out, open_, ah, ln, (ymid - cols[0][1]) / max(1, abs(x1 - edge))))
        if sl:
            sl = np.median(np.array(sl), 0)
            shape.update(sl_out=round(sl[0] / L, 3), sl_open=round(sl[1] / L, 3), sl_ah=round(sl[2] / L, 3), sl_len=round(sl[3] / L, 3), sl_slope=round(float(sl[4]), 3))
    # рукав: ткань с бока корпуса (там обычно нет принта), без фона; у рукава на фото слишком мало чистых пикселей
    side = tex[int(TEX_H * .35):int(TEX_H * .75), int(TEX_W * .04):int(TEX_W * .2)]
    sleeve = cv2.resize(np.hstack([side, side[:, ::-1]]), (256, 256), interpolation=cv2.INTER_LINEAR)
    shape['full'] = round(full_w / L, 3)
    meta = dict(len_w=L / body_w, sleeve=round(min(1.0, sleeve_len), 3), full_w=full_w / body_w, shape=shape,
                color=tuple(int(c) for c in np.median(im[m > 0].reshape(-1, 3), 0)[::-1]))
    return tex, sleeve, meta, dict(top=top, bot=bot, cx=cx, hw=hw, arm=arm, spans=spans)


PERSP = 0.3            # вещь на полу снята сверху наискосок: низ кадра ближе к камере и крупнее (≈30% на всю вещь)


def bottom_parts(im, m, kind, flat=False, crotch_frac=None):
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
    # вещь на человеке: широкие штанины касаются друг друга почти до низа — шаг берём из таблицы размеров (длина − шаговый шов)
    if crotch_frac: crotch = top + int(L * crotch_frac)
    rs = [r for r in runs(m[crotch + 3]) if r[1] - r[0] > hip0 * .15]
    if len(rs) >= 2: cx = int((rs[0][1] + rs[1][0]) / 2)
    hip_w = float(np.median(wid[top + int(L * .05):crotch]))
    cs = (crotch - top) / L

    def spans_hip(y):
        r = central_run(m[y], cx) or (cx - 5, cx + 5); return r
    hip, _ = rect_rows(im, m, top, crotch, spans_hip, TEX_W, max(8, int(TEX_H * cs)))

    def leg_span(side):
        def f(y):
            rs = []
            for r in runs(m[y]):          # кусок через середину (штанины слились) — делим по середине
                if r[0] < cx < r[1]: rs += [(r[0], cx), (cx, r[1])]
                else: rs.append(r)
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
    # форма для примерочной (в долях ширины пояса): лёжа штанины расходятся «домиком» —
    # длину и ширину штанины меряем вдоль её оси, а не по вертикали кадра
    ww = float(np.median(wid[top:top + max(3, int(L * .03))]))
    pk = (lambda y: 1 / (1 + PERSP * (y - top) / L)) if flat else (lambda y: 1.0)
    hipw = [round(float(np.median(wid[int(top + (crotch - top) * t) - 1:int(top + (crotch - top) * t) + 2])) * pk(top + (crotch - top) * t) / ww, 4) for t in np.linspace(.02, .98, 8)]
    legs = []
    for sd in (-1, 1):
        f = leg_span(sd); ys_ = np.arange(crotch + 2, bot - 1)
        sp = np.array([f(y) for y in ys_], float); c = (sp[:, 0] + sp[:, 1]) / 2; wdt = sp[:, 1] - sp[:, 0]
        k_ = np.polyfit(ys_ - crotch, c, 1)[0]; cosa = 1 / np.sqrt(1 + k_ * k_)
        prof = [float(np.median(wdt[max(0, int(len(wdt) * t) - 2):int(len(wdt) * t) + 3])) * cosa * pk(crotch + (bot - crotch) * t) / ww for t in np.linspace(0, .99, 14)]
        lk = float(np.mean([pk(y) ** 1.5 for y in range(crotch, bot)]))
        legs.append(dict(len=(bot - crotch) / cosa * lk / ww, w=prof, ang=float(np.degrees(np.arctan(k_)))))
    rk = float(np.mean([pk(y) ** 1.5 for y in range(top, crotch)]))
    shape = dict(rise=round((crotch - top) * rk / ww, 3), hip=hipw, leg_len=round(float(np.mean([l['len'] for l in legs])), 3),
                 leg=[round(float(v), 4) for v in np.mean([l['w'] for l in legs], 0)], leg_ang=[round(l['ang'], 1) for l in legs])
    meta = dict(len_w=L / hip_w, crotch=round(cs, 3), hem=round(hem_w / hip_w, 3), knee=round(knee_w / hip_w, 3), shape=shape,
                color=tuple(int(c) for c in np.median(im[m > 0].reshape(-1, 3), 0)[::-1]))
    return tex, None, meta, dict(top=top, bot=bot, cx=cx, crotch=crotch)


def overlay(im, m, info, kind):
    o = im.copy()
    o[m == 0] = (o[m == 0] * .25).astype(np.uint8)
    cv2.line(o, (0, info['top']), (o.shape[1], info['top']), (0, 255, 255), 3)
    cv2.line(o, (0, info['bot']), (o.shape[1], info['bot']), (0, 255, 255), 3)
    if 'spans' in info:
        for y in range(info['top'], info['bot'], 3):
            a, b = info['spans'](y)
            cv2.circle(o, (int(a), y), 2, (255, 0, 255), -1); cv2.circle(o, (int(b), y), 2, (255, 0, 255), -1)
        cv2.line(o, (0, info['arm']), (o.shape[1], info['arm']), (0, 160, 255), 2)
    elif 'hw' in info:
        for x in (info['cx'] - info['hw'], info['cx'] + info['hw']):
            cv2.line(o, (int(x), info['top']), (int(x), info['bot']), (255, 0, 255), 3)
    if 'crotch' in info:
        cv2.line(o, (0, info['crotch']), (o.shape[1], info['crotch']), (255, 0, 255), 3)
    return o


WALL_REF = np.array([140., 148., 140.])   # стена в комнате на фото «на человеке» (RGB): к ней приводим яркость и цвет фото вещей


def wall_gain(im):
    """Фото на вешалке: стена по краям кадра → множители по каналам, чтобы стена совпала с эталоном (выдержка и баланс белого)."""
    h, w = im.shape[:2]
    band = np.concatenate([im[int(h * .35):int(h * .65), :int(w * .04)].reshape(-1, 3), im[int(h * .35):int(h * .65), -int(w * .04):].reshape(-1, 3)])
    wall = np.median(band, 0)[::-1].astype(float)
    g = WALL_REF / np.maximum(wall, 1)
    return np.clip(g, 0.45, 1.6)


def apply_gain(img, g):
    return np.clip(img.astype(np.float32) * g[::-1].reshape(1, 1, 3), 0, 255).astype(np.uint8)


def load_model_photo(key, kind):
    """Фото из карточки магазина (вещь на человеке): обрезать интерфейс скриншота, маска вещи — нейросетью (seg_person.py)."""
    from seg_person import crop_screen, cloth_masks
    im = cv2.imread(find(key))
    im = crop_screen(im)
    h, w = im.shape[:2]
    if h > 1400: im = cv2.resize(im, (int(w * 1400 / h), 1400), interpolation=cv2.INTER_AREA); h, w = im.shape[:2]
    ms = cloth_masks(im)
    m = ms['upper'] if kind in TOPS else ms['lower']
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab_, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1: m = (lab_ == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    # сверху к низу может прилипнуть край кофты (сеть иногда относит его к низу): кофта шире пояса —
    # ищем самое узкое место в верхней трети (пояс), всё выше него, если оно заметно шире, — не брюки
    if kind not in TOPS:
        wid = cv2.blur(m.sum(1).astype(np.float32).reshape(-1, 1), (1, 9)).ravel()
        ys = np.where(wid > wid.max() * .3)[0]; y0, y1 = ys[0], ys[-1]
        # пояс — там, где ширина резко падает (низ кофты шире пояса брюк)
        dd = 10
        seg = range(y0 + dd, y0 + int((y1 - y0) * .35))
        yw = max(seg, key=lambda y: wid[y - dd] - wid[y + dd])
        if wid[yw - dd] - wid[yw + dd] > 0.15 * wid[yw + dd]: m[:yw + dd // 2] = 0
    return im, m


def build(it):
    od = os.path.join(OUT, it['id']); os.makedirs(od, exist_ok=True)
    meta = dict(id=it['id'], name=it['name'], kind=it['kind'], states=it.get('states'), zip=it.get('zip', False), collar=it.get('collar', False))
    ovs = []
    for side in ('front', 'back'):
        if it.get('src') == 'model':
            im, m = load_model_photo(it[side], it['kind'])
            flat = False
        else:
            im = load(it[side])
            m, flat = segment(im)
        part = top_parts if it['kind'] in TOPS else bottom_parts
        cf = None
        if it.get('sizes') and part is bottom_parts:
            c0 = it['sizes'][0]['cm']
            if c0.get('outseam') and c0.get('inseam'): cf = (c0['outseam'] - c0['inseam']) / c0['outseam']
        tex, sleeve, mm, info = part(im, m, it['kind'], flat, cf) if part is bottom_parts else part(im, m, it['kind'])
        if not flat and it.get('src') != 'model':
            g = wall_gain(im); tex = apply_gain(tex, g)
            if sleeve is not None: sleeve = apply_gain(sleeve, g)
            mm['color'] = tuple(int(c) for c in np.clip(np.array(mm['color']) * g, 0, 255))
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
    meta['shape'] = f.pop('shape'); meta['back'].pop('shape', None)
    meta['shape']['hang'] = not f.get('flat')
    for k in ('elastic', 'crop', 'cm', 'fitname'):
        if it.get(k): meta['shape'][k] = it[k]
    if it.get('src') == 'model': meta['shape']['hang'] = False; meta['shape']['worn'] = True   # ширины сняты с вещи на человеке
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
