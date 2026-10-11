"""Части верха: корпус и рукава, выпрямление по строкам, мерки (длина к ширине, рукав)."""
import json, os, sys, glob
import numpy as np, cv2
from cutout import central_run, fill_holes_with_cloth
from wardrobe_paths import TEX_H, TEX_W


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
            # у прямых вещей ±12% от средней (убирает пятна фона), у расклешённых книзу (платье, пальто) — плавный тренд по высоте
            mw = float(np.median(rs - ls)); c = (ls + rs) / 2
            if kind in ('dress', 'coat'):
                w0 = rs - ls; tr = np.polyval(np.polyfit(np.arange(len(w0)), w0, 2), np.arange(len(w0))); wd = np.clip(w0, tr * .9, tr * 1.1)
            else: wd = np.clip(rs - ls, mw * .88, mw * 1.12)
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
