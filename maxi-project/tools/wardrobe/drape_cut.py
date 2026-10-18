"""Выкройка для расчёта ткани: вырезанное фото по силуэту, сетка силуэта, молния и линия пуговиц."""
import json, os, sys, glob
import numpy as np, cv2


DRAPE_ROWS = 64


def cut_for_drape(im, m, info, kind, od, side, zip_=False, collar=False):
    """Для симуляции ткани: вырезанное фото (RGBA) по силуэту вещи и грубая сетка силуэта — это «выкройка» перед/спинки.
    Координаты якорей — в долях кадра выреза (0..1)."""
    top, bot = info['top'], info['bot']
    mm = m.copy(); mm[:top] = 0; mm[bot + 1:] = 0
    xs = np.where(mm.any(0))[0]; x0, x1 = max(0, xs[0] - 2), min(m.shape[1], xs[-1] + 3)
    crop = im[top:bot + 1, x0:x1]; mc = mm[top:bot + 1, x0:x1]
    H, W = crop.shape[:2]
    # дырки внутри силуэта (пуговицы, блик, принт другого цвета — сеть их не считает вещью) — это вещь: заливаем
    # всё, что не связано с краем кадра (иначе на ткани прозрачные пятна, сквозь них видно тело)
    pad = np.pad((mc > 0).astype(np.uint8), 1); ff = pad.copy() * 0 + (pad == 0).astype(np.uint8) * 255
    cv2.floodFill(ff, None, (0, 0), 128)
    # только мелкие дырки (до 1.5% площади вещи): большая «дырка» — просвет между штанинами, замкнутый обрезом снизу (фон там
    # убран намеренно: model_photo.drop_leg_gap), её не заливать
    holes = ((ff[1:-1, 1:-1] != 128) & (mc == 0)).astype(np.uint8); n_h, lb_h, st_h, _ = cv2.connectedComponentsWithStats(holes)
    # у верха (не штаны и не шорты) просвет между рукой и корпусом на фото с человеком — тоже «дырка»: ткань там есть, заливаем любые
    small = np.zeros_like(holes, bool); lim_h = 0.015 * max(1, int((mc > 0).sum())) if kind in ('pants', 'jeans', 'shorts') else 1e12
    for k in range(1, n_h):
        if st_h[k, cv2.CC_STAT_AREA] < lim_h: small |= lb_h == k
    mc = (small | (mc > 0)).astype(mc.dtype)
    # края маски чуть растянуть цветом вещи, чтобы по краю выкройки не было фона
    # край вещи на фото смешан с фоном (светлый ореол): краевые 3 px тоже заменяем продолжением ткани, иначе по швам
    # выкройки, которые ложатся на край фото, видны светлые точки
    inv = (cv2.erode(mc.astype(np.uint8), np.ones((7, 7), np.uint8)) == 0).astype(np.uint8) * 255
    filled = cv2.inpaint(crop, inv, 5, cv2.INPAINT_TELEA)
    # пуговицы — отдельные объёмные детали в примерочной: на ткани их не рисуем (заливаем тканью вокруг),
    # а положение, размер и цвет пишем в выкройку (a.buttons)
    cxa = (info['cx'] - x0) / W
    btn = find_buttons(filled, mc, cxa, kind) if side == 'front' and not zip_ else None
    if btn and btn['buttons']:
        bm = np.zeros(mc.shape, np.uint8)
        for b_ in btn['buttons']: cv2.circle(bm, (int(b_['u'] * W), int(b_['v'] * H)), int(b_['r'] * W * 1.8) + 3, 255, -1)
        filled = cv2.inpaint(filled, bm, 7, cv2.INPAINT_TELEA)
    # отложной воротник другого цвета (белый у тёмного поло) — в примерочной отдельная объёмная деталь (collar3d.js):
    # с ткани его убираем (иначе под объёмным воротником виден нарисованный), цвет пишем в выкройку (a.collar)
    col_ = find_collar(filled, mc, cxa) if collar else None
    if col_:
        filled = cv2.inpaint(filled, col_['mask'], 9, cv2.INPAINT_TELEA)
    rgba = np.dstack([filled, (cv2.GaussianBlur(mc.astype(np.float32), (3, 3), 0) * 255).clip(0, 255).astype(np.uint8)])
    k = 720 / H if H > 720 else 1
    if k < 1: rgba = cv2.resize(rgba, (int(W * k), int(H * k)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(os.path.join(od, side + '_cut.webp'), rgba, [cv2.IMWRITE_WEBP_QUALITY, 88])
    gh = DRAPE_ROWS; gw = max(8, int(round(gh * W / H)))
    g = cv2.resize(mc.astype(np.float32), (gw, gh), interpolation=cv2.INTER_AREA) > 0.5
    grid = [''.join('1' if v else '0' for v in row) for row in g]
    a = dict(cx=(info['cx'] - x0) / W)
    if 'hw' in info: a.update(hw=info['hw'] / W, arm=(info['arm'] - top) / H)
    if 'crotch' in info: a.update(crotch=(info['crotch'] - top) / H)
    zc = find_zip(filled, mc, a['cx'], a.get('arm', 0.25)) if zip_ and side == 'front' else None
    # без молнии — планка с пуговицами (платье, рубашка): середина переда по линии пуговиц, иначе на фото вполоборота
    # пуговицы в примерочной уезжают вбок от середины
    if not zc and btn and btn['line']: zc = btn['line']
    if zc: a['zipc'] = zc
    if btn and btn['buttons']: a['buttons'] = btn['buttons']
    if col_: a['collar'] = dict(rgb=col_['rgb'])
    return dict(img=side + '_cut.webp', W=W, H=H, gw=gw, gh=gh, grid=grid, a={k_: (v if isinstance(v, (list, dict)) else round(float(v), 4)) for k_, v in a.items()})


def find_zip(rgb, mc, cx, arm):
    """Молния на фото: по строкам — столбец с самым резким узким перепадом яркости у середины вещи.
    Возвращает положение молнии (доля ширины) для DRAPE_ROWS строк — прямая (по МНК с отбросом выбросов), иначе None.
    В примерочной середина переда берётся по ней: молния ложится ровно посередине и остаётся прямой."""
    H, W = mc.shape
    g = cv2.cvtColor(rgb, cv2.COLOR_BGR2GRAY).astype(np.float32)
    # узкая полоса, отличающаяся от соседей: |яркость − медиана в окне 9% ширины|
    k = max(5, int(W * 0.09) | 1)
    bg = cv2.blur(g, (k, 1)); feat = np.abs(g - bg) * (mc > 0)
    feat = cv2.blur(feat, (3, max(3, H // 60)))
    ys, xs = [], []
    for y in range(int(H * max(0.08, arm * 0.5)), int(H * 0.92), max(1, H // 120)):
        c0, c1 = int(W * (cx - 0.12)), int(W * (cx + 0.12)); row = feat[y, max(0, c0):min(W, c1)]
        if row.size == 0 or row.max() < 12: continue
        ys.append(y); xs.append(max(0, c0) + int(row.argmax()))
    if len(ys) < 20: return None
    ys, xs = np.array(ys, float), np.array(xs, float)
    keep = np.ones(len(ys), bool)
    for _ in range(4):
        p = np.polyfit(ys[keep], xs[keep], 1); r = np.abs(np.polyval(p, ys) - xs); keep = r < max(4, np.median(r[keep]) * 2.5)
    if keep.mean() < 0.6: return None
    # молния на фото не прямая (вещь висит/лежит с изгибом): по точкам без выбросов — плавная кривая 3-й степени,
    # тогда в примерочной молния ложится точно на середину в каждой строке и выходит прямой
    p3 = np.polyfit(ys[keep], xs[keep], 3)
    rows = np.clip((np.arange(DRAPE_ROWS) + 0.5) / DRAPE_ROWS * H, ys[keep].min(), ys[keep].max())
    return [round(float(v) / W, 4) for v in np.polyval(p3, rows)]


def find_buttons(rgb, mc, cx, kind):
    """Пуговицы на фото переда: небольшие круглые пятна, заметно светлее или темнее ткани вокруг, у середины вещи.
    Планка (платье, рубашка, пальто, пиджак): не меньше четырёх на одной прямой — середина переда по ней (line).
    Низ (юбка, брюки, шорты): пуговица на поясе — у середины в верхней части.
    Возвращает {line: [доля ширины по DRAPE_ROWS строкам] | None, buttons: [{u, v, r, rgb}]} (доли кадра выреза, r — доля ширины)."""
    H, W = mc.shape
    g = cv2.cvtColor(rgb, cv2.COLOR_BGR2GRAY).astype(np.float32)
    k = max(5, int(W * 0.08) | 1)
    bg = cv2.medianBlur(np.clip(g, 0, 255).astype(np.uint8), k).astype(np.float32)
    inner = cv2.erode((mc > 0).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0   # не у края силуэта
    placket = kind in ('dress', 'shirt', 'coat', 'jacket'); waist = kind in ('skirt', 'pants', 'jeans', 'shorts')
    if not placket and not waist: return None
    best = None
    for sgn in (1, -1):
        for thr in ((30,) if placket else (30, 18)):
            m = (((g - bg) * sgn > thr) & inner).astype(np.uint8)
            n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
            pts = []
            for i in range(1, n):
                x, y, w, h, area = st[i]
                if area < (W * 0.008) ** 2 or area > (W * 0.06) ** 2 or max(w, h) > 2.2 * min(w, h): continue
                if area < 0.45 * w * h: continue                       # пуговица — сплошное круглое пятно, не штрих
                if abs(cen[i][0] / W - cx) > (0.16 if placket else 0.1): continue
                if waist and cen[i][1] / H > 0.2: continue
                col = rgb[lab == i].mean(0)[::-1]
                pts.append((cen[i][0], cen[i][1], max(w, h) / 2, col))
            if placket:
                if len(pts) < 4: continue
                P = np.array([(p[0], p[1]) for p in pts]); keep = np.ones(len(P), bool)
                for _ in range(3):
                    pf = np.polyfit(P[keep, 1], P[keep, 0], 1); r = np.abs(np.polyval(pf, P[:, 1]) - P[:, 0]); keep = r < W * 0.02
                    if keep.sum() < 4: break
                if keep.sum() >= 4 and abs(pf[0]) < 0.15 and (best is None or keep.sum() > len(best[1])): best = (pf, [p for p, kk in zip(pts, keep) if kk])
            elif 1 <= len(pts) <= 2 and best is None:
                # на тёмной ткани порог берёт только блик пуговицы: сама пуговица — пятно со слабым отличием вокруг блика
                ref = []
                for (px, py, pr, pc) in pts:
                    x0_, y0_, R_ = int(px), int(py), int(max(6, pr * 5))
                    win = np.abs(g - bg)[max(0, y0_ - R_):y0_ + R_, max(0, x0_ - R_):x0_ + R_] > 8
                    n2, lab2, st2, cen2 = cv2.connectedComponentsWithStats(win.astype(np.uint8), 8)
                    ly, lx = min(R_, y0_), min(R_, x0_); kk = lab2[ly, lx] if 0 <= ly < win.shape[0] and 0 <= lx < win.shape[1] else 0
                    if kk > 0 and st2[kk][4] < (pr * 5) ** 2 * 2:
                        x_, y_, w_, h_ = st2[kk][:4]; px, py, pr = max(0, x0_ - R_) + x_ + w_ / 2, max(0, y0_ - R_) + y_ + h_ / 2, max(pr, min(w_, h_) / 2)
                    ref.append((px, py, pr, rgb[int(py), int(px)][::-1].astype(float)))
                best = (None, ref)
            if best: break
        if best and (not placket or len(best[1]) >= 6): break
    if best is None: return None
    rows = (np.arange(DRAPE_ROWS) + 0.5) / DRAPE_ROWS * H
    line = [round(float(v) / W, 4) for v in np.polyval(best[0], rows)] if best[0] is not None else None
    # размер — медиана (у ряда пуговицы одинаковые), цвет — средний
    rr = float(np.median([p[2] for p in best[1]])); col = np.mean([p[3] for p in best[1]], 0)
    btns = [dict(u=round(float(p[0]) / W, 4), v=round(float(p[1]) / H, 4), r=round(rr / W, 4)) for p in sorted(best[1], key=lambda p: p[1])]
    hexc = '#%02x%02x%02x' % tuple(int(np.clip(c, 0, 255)) for c in col)
    for b_ in btns: b_['rgb'] = hexc
    return dict(line=line, buttons=btns)


def find_collar(rgb, mc, cx):
    """Воротник другого цвета у горловины: в верхней пятой части вещи, у шеи, заметно отличается от ткани корпуса и не темнее
    её (тени и щели у горловины темнее). Планку посередине не трогаем. Возвращает маску (для заливки тканью) и цвет — или None."""
    H, W = mc.shape
    lab = cv2.cvtColor(rgb, cv2.COLOR_BGR2LAB).astype(np.float32)
    band = (slice(int(H * .35), int(H * .6)), slice(int(W * max(0, cx - .2)), int(W * min(1, cx + .2))))
    ref = lab[band][mc[band] > 0]
    if len(ref) < 50: return None
    c0 = np.median(ref, 0)
    yy, xx = np.mgrid[0:H, 0:W]
    zone = (yy < H * .22) & (np.abs(xx / W - cx) < .42) & (np.abs(xx / W - cx) > .045) & (mc > 0)
    far = (np.linalg.norm(lab - c0, axis=2) > 40) & (lab[..., 0] >= c0[0] * .85) & zone
    far = cv2.morphologyEx(far.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    if far.sum() < zone.sum() * .08: return None
    # только куски, что доходят до горловины (верхние 8% вещи): принт на груди — не воротник
    n, lb, st, _ = cv2.connectedComponentsWithStats(far)
    keep = np.zeros_like(far)
    for k in range(1, n):
        if st[k, cv2.CC_STAT_TOP] < H * .08 and st[k, cv2.CC_STAT_AREA] > zone.sum() * .01: keep[lb == k] = 1
    if keep.sum() < zone.sum() * .06: return None
    bgr = np.median(rgb[keep > 0], 0)
    mask = cv2.dilate(keep, np.ones((7, 7), np.uint8)) * 255
    return dict(mask=mask, rgb='#%02x%02x%02x' % (int(bgr[2]), int(bgr[1]), int(bgr[0])))
