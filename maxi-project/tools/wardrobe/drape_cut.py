"""Выкройка для расчёта ткани: вырезанное фото по силуэту, сетка силуэта, молния и линия пуговиц."""
import json, os, sys, glob
import numpy as np, cv2


DRAPE_ROWS = 64


def cut_for_drape(im, m, info, kind, od, side, zip_=False):
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
    cv2.floodFill(ff, None, (0, 0), 128); mc = ((ff[1:-1, 1:-1] != 128) | (mc > 0)).astype(mc.dtype)
    # края маски чуть растянуть цветом вещи, чтобы по краю выкройки не было фона
    # край вещи на фото смешан с фоном (светлый ореол): краевые 3 px тоже заменяем продолжением ткани, иначе по швам
    # выкройки, которые ложатся на край фото, видны светлые точки
    inv = (cv2.erode(mc.astype(np.uint8), np.ones((7, 7), np.uint8)) == 0).astype(np.uint8) * 255
    filled = cv2.inpaint(crop, inv, 5, cv2.INPAINT_TELEA)
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
    if not zc and side == 'front' and kind in ('dress', 'shirt', 'coat', 'jacket'): zc = find_buttons(filled, mc, a['cx'])
    if zc: a['zipc'] = zc
    return dict(img=side + '_cut.webp', W=W, H=H, gw=gw, gh=gh, grid=grid, a={k_: (v if isinstance(v, list) else round(float(v), 4)) for k_, v in a.items()})


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


def find_buttons(rgb, mc, cx):
    """Пуговицы на фото переда: небольшие круглые пятна, заметно светлее или темнее ткани вокруг, у середины вещи,
    не меньше четырёх на одной прямой. Возвращает середину переда по прямой через них (доля ширины по DRAPE_ROWS строкам)."""
    H, W = mc.shape
    g = cv2.cvtColor(rgb, cv2.COLOR_BGR2GRAY).astype(np.float32)
    k = max(5, int(W * 0.08) | 1)
    bg = cv2.medianBlur(np.clip(g, 0, 255).astype(np.uint8), k).astype(np.float32)
    best = None
    for sgn in (1, -1):
        m = (((g - bg) * sgn > 30) & (mc > 0)).astype(np.uint8)
        n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
        pts = []
        for i in range(1, n):
            x, y, w, h, area = st[i]
            if area < (W * 0.008) ** 2 or area > (W * 0.06) ** 2 or max(w, h) > 2.2 * min(w, h): continue
            if abs(cen[i][0] / W - cx) > 0.16: continue
            pts.append(cen[i])
        if len(pts) < 4: continue
        P = np.array(pts); keep = np.ones(len(P), bool)
        for _ in range(3):
            p = np.polyfit(P[keep, 1], P[keep, 0], 1); r = np.abs(np.polyval(p, P[:, 1]) - P[:, 0]); keep = r < W * 0.02
            if keep.sum() < 4: break
        if keep.sum() >= 4 and abs(p[0]) < 0.15 and (best is None or keep.sum() > best[1]): best = (p, int(keep.sum()))
    if best is None: return None
    rows = (np.arange(DRAPE_ROWS) + 0.5) / DRAPE_ROWS * H
    return [round(float(v) / W, 4) for v in np.polyval(best[0], rows)]
