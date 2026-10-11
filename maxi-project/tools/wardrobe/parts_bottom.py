"""Части низа: пояс, шаг, штанины, мерки; поправка перспективы для фото на полу."""
import json, os, sys, glob
import numpy as np, cv2
from cutout import central_run, runs
from parts_top import rect_rows
from wardrobe_paths import TEX_H, TEX_W


PERSP = 0.3            # вещь на полу снята сверху наискосок: низ кадра ближе к камере и крупнее (≈30% на всю вещь)


def bottom_parts(im, m, kind, flat=False, crotch_frac=None, persp=None):
    persp = flat if persp is None else persp   # поправка перспективы — только фото на полу (студийное снято прямо)
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
    pk = (lambda y: 1 / (1 + PERSP * (y - top) / L)) if persp else (lambda y: 1.0)
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
