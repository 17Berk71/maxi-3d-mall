# Второй этаж, шаг 2: разметка по цвету заливки, помещения, привязка к метрам карты первого этажа.
# Вход: source/f2_*.png, work_f2/reg.json (f2reg.py), f2labels.py, src/data/maxi-data.json (первый этаж).
# Выход: src/data/maxi-floor2.json и work_f2/preview.png для сверки.
import json, base64, math
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage as ndi
from scipy.signal import fftconvolve
exec(open('f2labels.py').read())

ROOT = '../../'
D1 = json.load(open(ROOT + 'src/data/maxi-data.json'))
reg = json.load(open('work_f2/reg.json'))
reg['f2_all'] = {'s': 1.0, 't': [0.0, 0.0]}
U = 3                                   # холст = обзорный снимок ×3
H0, W0 = 787, 1122
CH, CW = H0 * U, W0 * U
# классы: 1 коридор, 2 проём, 3 магазин, 4 тёмное помещение, 5 развлечения, 6 кино, 7 зал фуд-корта, 8 кафе, 9 касса, 10 снаружи
REF = [((124, 132, 152), 1), ((120, 132, 152), 1), ((124, 132, 148), 1), ((96, 116, 144), 2), ((100, 116, 144), 2),
       ((40, 84, 120), 3), ((44, 84, 124), 3), ((44, 84, 120), 3), ((40, 84, 124), 3),
       ((56, 68, 88), 4), ((56, 68, 84), 4), ((52, 64, 84), 4), ((52, 68, 84), 4), ((48, 60, 76), 4), ((52, 68, 88), 4), ((60, 68, 84), 4),
       ((84, 72, 108), 5), ((84, 60, 100), 6), ((132, 120, 108), 7), ((112, 92, 80), 8), ((116, 92, 80), 8), ((44, 84, 88), 9),
       ((36, 44, 64), 10), ((84, 104, 144), 10), ((88, 108, 148), 10), ((92, 112, 152), 10), ((36, 72, 68), 10), ((28, 68, 64), 10),
       ((64, 84, 124), 10), ((24, 28, 28), 0)]
RC = np.array([r[0] for r in REF], float) + 1.5
RK = np.array([r[1] for r in REF], np.uint8)
ROOM = (3, 4, 5, 6, 8, 9)

# таблица «цвет → класс» по цветам с шагом 2
_q = np.stack(np.meshgrid(np.arange(128), np.arange(128), np.arange(128), indexing='ij'), -1).reshape(-1, 3) * 2.0 + 1
LUT = np.zeros(len(_q), np.uint8)
for i in range(0, len(_q), 262144):
    d = np.abs(_q[i:i + 262144, None, :] - RC[None]).sum(2)
    LUT[i:i + 262144] = np.where(d.min(1) <= 9, RK[d.argmin(1)], 0)

def classify(name):
    a = np.array(Image.open('source/%s.png' % name).convert('RGB')).astype(np.int32) // 2
    h, w = a.shape[:2]
    c = LUT[(a[..., 0] * 128 + a[..., 1]) * 128 + a[..., 2]].astype(np.uint8)
    if name != 'f2_all':  # кнопки и подписи Яндекс Карт
        c[:75, w - 420:] = 255; c[140:620, w - 75:] = 255; c[h - 75:, w - 540:] = 255; c[:60, :60] = 255
    else:
        c[:12, 970:] = 255
    return c

def src2canvas(name):
    r = reg[name]; s, t = r['s'], r['t']
    return np.float32([[s * U, 0, t[0] * U], [0, s * U, t[1] * U]])

# 1. составной холст: подробные снимки поверх обзорного
canvas = np.full((CH, CW), 255, np.uint8)
for n in ['f2_food', 'f2_east', 'f2_mid', 'f2_west', 'f2_all']:
    c = classify(n)
    wc = cv2.warpAffine(c, src2canvas(n), (CW, CH), flags=cv2.INTER_NEAREST, borderValue=255)
    sel = (canvas == 255) & (wc != 255)
    canvas[sel] = wc[sel]
canvas[canvas == 255] = 0
# 2. помещения: связные области одного цвета (границы и подписи между ними не входят)
lab = np.zeros((CH, CW), np.int32)
rooms = {}
nid = 100
for k in ROOM:
    n, cc, st, _ = cv2.connectedComponentsWithStats((canvas == k).astype(np.uint8), connectivity=4)
    for i in range(1, n):
        if st[i, 4] < 150: continue
        lab[cc == i] = nid; rooms[nid] = {'cls': k}; nid += 1
for k in (1, 2, 7, 10):
    lab[canvas == k] = k
# неизвестные пиксели (границы, подписи, значки) — по ближайшему известному
unk = lab == 0
_, ind = ndi.distance_transform_edt(unk, return_indices=True)
lab = lab[ind[0], ind[1]]
# 3. привязка к метрам: коридоры и проёмы второго этажа ложатся на коридоры первого
GR = D1['grid']; CELL = GR['cell']; GW, GHt = GR['W'], GR['H']
raw = base64.b64decode(GR['b64']); bits = np.unpackbits(np.frombuffer(raw, np.uint8))[:GW * GHt]
walk1 = bits.reshape(GHt, GW).astype(np.float32)
f2walk = ((lab == 1) | (lab == 2) | (lab == 7)).astype(np.float32)
# магазины второго этажа (цветные помещения) должны стоять над помещениями первого этажа
f2shop = np.isin(canvas, (3, 5, 6, 8, 9)).astype(np.float32)
bld1 = np.zeros((GHt, GW), np.uint8)
for p in D1['bld']:
    cv2.fillPoly(bld1, [np.array([[(x - GR['x0']) / CELL, (z - GR['z0']) / CELL] for x, z in p], np.int32)], 1)
shop1 = ((bld1 > 0) & (walk1 < 0.5)).astype(np.float32)
best = None
for kpx in np.linspace(0.116, 0.140, 25):   # метров на пиксель холста (по линейке 0,128)
    f = kpx / CELL
    sw = (cv2.resize(f2walk, (int(CW * f), int(CH * f)), interpolation=cv2.INTER_AREA) > 0.5).astype(np.float32)
    ss = (cv2.resize(f2shop, (int(CW * f), int(CH * f)), interpolation=cv2.INTER_AREA) > 0.5).astype(np.float32)
    corr = fftconvolve(walk1 * 2 - 1, sw[::-1, ::-1], mode='full') + fftconvolve(shop1 * 2 - 1, ss[::-1, ::-1], mode='full')
    j, i = np.unravel_index(np.argmax(corr), corr.shape)
    sc = corr[j, i] / (sw.sum() + ss.sum())
    oy, ox = j - (sw.shape[0] - 1), i - (sw.shape[1] - 1)
    print('  %.4f  %.3f' % (kpx, sc))
    if best is None or sc > best[0]: best = (sc, kpx, ox, oy)
sc, KPX, ox, oy = best
TX = GR['x0'] + ox * CELL; TZ = GR['z0'] + oy * CELL
print('привязка: %.4f м/пикс, сдвиг (%.1f, %.1f), совпадение %.3f' % (KPX, TX, TZ, sc))
W = lambda x, y: [round(float(x * KPX + TX), 2), round(float(y * KPX + TZ), 2)]
def to_canvas(name, x, y):
    r = reg[name]; return ((r['t'][0] + r['s'] * x) * U, (r['t'][1] + r['s'] * y) * U)

# 4. подписи → помещения
stores = []; kiosks = []
for (nm, src, x, y, cat, what, kind) in L:
    cx, cy = to_canvas(src, x, y)
    if kind == 'kiosk':
        p = W(cx, cy)
        if any(k['name'] == nm and math.dist(k['p'], p) < 4 for k in kiosks): continue
        kiosks.append({'name': nm, 'cat': cat, 'what': what, 'p': p, 'w': 1.6, 'h': 1.6, 'a': 0}); continue
    xi, yi = int(round(cx)), int(round(cy))
    rid = None
    for r in range(0, 40, 2):  # значок может стоять у границы — ищем ближайшее помещение
        ys, xs = np.mgrid[max(0, yi - r):min(CH, yi + r + 1), max(0, xi - r):min(CW, xi + r + 1)]
        v = lab[ys, xs]; m = v >= 100
        if m.any():
            dd = (xs[m] - xi) ** 2 + (ys[m] - yi) ** 2; rid = int(v[m][dd.argmin()]); break
    if rid is None: print('не нашлось помещение для', nm); continue
    R = rooms[rid]
    R.setdefault('names', [])
    if nm not in [q[0] for q in R['names']]: R['names'].append((nm, cat, what))
# 5. контуры помещений в метрах
def polys_of(mask, eps):
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    for c in cs:
        if cv2.contourArea(c) * KPX * KPX < 2.0: continue
        a = cv2.approxPolyDP(c, eps, True)[:, 0, :]
        if len(a) >= 3: out.append(a)
    return out
area_px = KPX * KPX
ROOF = set()
_f0 = (lab != 10); _f0 = cv2.morphologyEx(_f0.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
n0, cc0, st0, _ = cv2.connectedComponentsWithStats(_f0, connectivity=4); FOOT0 = cc0 == 1 + np.argmax(st0[1:, 4])
for rid, R in rooms.items():
    if R['cls'] == 4 and not R.get('names'):
        a = (lab == rid).sum() * area_px
        if a > 450: ROOF.add(rid); print('крыша (нет второго этажа): %.0f м²' % a)
for rid, R in rooms.items():
    if rid in ROOF: continue
    m = lab == rid
    ps = polys_of(m, 2.2)
    if not ps: continue
    p = max(ps, key=lambda q: cv2.contourArea(q.reshape(-1, 1, 2).astype(np.int32)))
    poly = [W(x, y) for x, y in p]
    area = float(m.sum() * area_px)
    if area < 6: continue
    ys, xs = np.nonzero(m)
    if not FOOT0[int(ys.mean()), int(xs.mean())]: continue
    c = W(xs.mean(), ys.mean())
    # точка подписи: самая «глубокая» точка помещения
    dt = cv2.distanceTransform(m.astype(np.uint8), cv2.DIST_L2, 5); yy, xx = np.unravel_index(dt.argmax(), dt.shape)
    names = R.get('names', [])
    cls = R['cls']
    if names:
        nm, cat, what = names[0]
    else:
        nm, cat, what = '', 'tbd', ''
    stores.append({'name': nm, 'names': [q[0] for q in names], 'cat': cat, 'what': what, 'poly': poly, 'area': round(area, 1),
                   'c': c, 'lp': W(xx, yy), 'fit': {'1': [min(3.0, dt.max() * KPX * 0.8), 0]}, 'fill': int(cls)})
# 6. контур этажа, проёмы
foot = (lab != 10) & ~np.isin(lab, list(ROOF))
foot = cv2.morphologyEx(foot.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
n, cc, st, _ = cv2.connectedComponentsWithStats(foot, connectivity=4)
big = 1 + np.argmax(st[1:, 4]); foot = cc == big
bld = [[W(x, y) for x, y in p] for p in polys_of(foot, 3.0)]
voids = []
for p in polys_of((lab == 2) & foot, 1.6):
    if cv2.contourArea(p.reshape(-1, 1, 2).astype(np.int32)) * area_px < 8: continue
    voids.append([W(x, y) for x, y in p])
# сетка второго этажа в той же сетке, что и первый этаж
gx = GR['x0'] + (np.arange(GW) + 0.5) * CELL; gz = GR['z0'] + (np.arange(GHt) + 0.5) * CELL
PX = ((gx[None, :] - TX) / KPX).repeat(GHt, 0); PY = ((gz[:, None] - TZ) / KPX).repeat(GW, 1)
inside = (PX >= 0) & (PY >= 0) & (PX < CW - 1) & (PY < CH - 1)
g = np.zeros((GHt, GW), np.int32)
g[inside] = lab[PY[inside].astype(int), PX[inside].astype(int)]
fg = np.zeros((GHt, GW), bool); fg[inside] = foot[PY[inside].astype(int), PX[inside].astype(int)]
fg &= bld1 > 0
# проём оставляем только над коридором первого этажа (с запасом 1 м); остальное — пол второго этажа
w1d = cv2.dilate((walk1 > 0.5).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
void = (g == 2) & fg
voidc = void & w1d
voidc = cv2.morphologyEx(voidc.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0
voidc = cv2.morphologyEx(voidc.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
# край проёма на карте — обводка; сужаем проём на 0,6 м, чтобы вдоль ограждения был удобный проход
voidc = cv2.erode(voidc.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=2) > 0
voidc = cv2.morphologyEx(voidc.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
print('проёмы: %.0f м², из них над коридором первого этажа %.0f м²' % (void.sum() * CELL * CELL, voidc.sum() * CELL * CELL))
walk2 = (((g == 1) | (g == 7)) | (void & ~voidc)) & fg
# чистка: срезаем «усы» и щели уже ~1,3 м (артефакты разметки у витрин и краёв проёмов)
walk2 = cv2.morphologyEx(walk2.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
n, cc, st, _ = cv2.connectedComponentsWithStats(walk2, connectivity=4)
big = 1 + np.argmax(st[1:, 4]); walk2 = (cc == big) & ~voidc
print('галерея второго этажа: %.0f м², отброшено мелких частей: %d' % (walk2.sum() * CELL * CELL, n - 2))
hall = (g == 7) & walk2
def gpolys(mask, eps, amin):
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    res = []
    for c in cs:
        if cv2.contourArea(c) * CELL * CELL < amin: continue
        a = cv2.approxPolyDP(c, eps, True)[:, 0, :]
        if len(a) >= 3: res.append([[round(float(GR['x0'] + (x + 0.5) * CELL), 2), round(float(GR['z0'] + (y + 0.5) * CELL), 2)] for x, y in a])
    return res
voids = gpolys(voidc, 1.2, 8)
# эскалаторы: по значкам с карты — внутри проёма, верх у края галереи второго этажа, низ на коридоре первого
icons = [W(*to_canvas(s, x, y)) for s, x, y in ESC]
cl = []
for p in icons:
    for c in cl:
        if math.dist(c['c'], p) < 9: c['pts'].append(p); c['c'] = list(np.mean(c['pts'], 0)); break
    else: cl.append({'c': list(p), 'pts': [p]})
RUN, HW = 9.8, 1.55
def cell(x, z): return int((z - GR['z0']) / CELL), int((x - GR['x0']) / CELL)
def ok(mask, x, z):
    j, i = cell(x, z); return 0 <= j < GHt and 0 <= i < GW and mask[j, i]
w1b = walk1 > 0.5
esc = []; used = np.zeros((GHt, GW), bool)
for c in cl:
    best = None
    for ang in np.arange(0, 360, 5):
        a = math.radians(ang); d = (math.cos(a), math.sin(a)); r = (-d[1], d[0])
        for dx in np.arange(-18, 18.1, 1.0):
            for dz in np.arange(-18, 18.1, 1.0):
                top = (c['c'][0] + dx, c['c'][1] + dz)
                # верх: над краем проёма, дальше — пол второго этажа
                if not all(ok(walk2, top[0] + d[0] * t + r[0] * s, top[1] + d[1] * t + r[1] * s) for t in (0.6, 1.6, 2.4) for s in (-1.2, 0, 1.2)): continue
                good = True
                for t in np.arange(0.5, RUN, 0.7):
                    for s in (-HW, 0, HW):
                        x, z = top[0] - d[0] * t + r[0] * s, top[1] - d[1] * t + r[1] * s
                        if not ok(w1b, x, z) or ok(used, x, z): good = False; break
                        xv, zv = top[0] - d[0] * t + r[0] * s * 0.8, top[1] - d[1] * t + r[1] * s * 0.8
                        if t > 1.2 and not ok(voidc, xv, zv): good = False; break
                    if not good: break
                if not good: continue
                # рядом с эскалатором на первом этаже остаётся проход не уже 2,4 м хотя бы с одной стороны
                side = [all(ok(w1b, top[0] - d[0] * t + r[0] * sg * (HW + 2.6), top[1] - d[1] * t + r[1] * sg * (HW + 2.6)) for t in np.arange(0, RUN + 2.5, 0.7)) for sg in (-1, 1)]
                if not any(side): continue
                # низ: площадка на первом этаже
                bot = (top[0] - d[0] * RUN, top[1] - d[1] * RUN)
                if not all(ok(w1b, bot[0] - d[0] * t + r[0] * s, bot[1] - d[1] * t + r[1] * s) for t in (0.6, 1.6, 2.6) for s in (-1.4, 0, 1.4)): continue
                sc = -math.hypot(dx, dz)
                if best is None or sc > best[0]: best = (sc, top, bot, a)
    if best is None: print('эскалатор у', [round(v, 1) for v in c['c']], 'не поместился'); continue
    _, top, bot, a = best
    p = ((top[0] + bot[0]) / 2, (top[1] + bot[1]) / 2)
    esc.append({'p': [round(p[0], 2), round(p[1], 2)], 'a': round(a, 4), 'top': [round(top[0], 2), round(top[1], 2)], 'bot': [round(bot[0], 2), round(bot[1], 2)]})
    ca, sa = math.cos(a), math.sin(a)
    for j in range(GHt):
        pass
    ys, xs = np.mgrid[0:GHt, 0:GW]
    lx = (GR['x0'] + (xs + 0.5) * CELL - p[0]) * ca + (GR['z0'] + (ys + 0.5) * CELL - p[1]) * sa
    lz = -(GR['x0'] + (xs + 0.5) * CELL - p[0]) * sa + (GR['z0'] + (ys + 0.5) * CELL - p[1]) * ca
    used |= (np.abs(lx) < RUN / 2 + 3) & (np.abs(lz) < HW + 1.5)
    print('эскалатор', esc[-1])
wc = [W(*to_canvas(s, x, y)) for s, x, y in WC]
b64 = base64.b64encode(np.packbits(walk2.astype(np.uint8).ravel()).tobytes()).decode()
hb64 = base64.b64encode(np.packbits(hall.astype(np.uint8).ravel()).tobytes()).decode()
out = {'src': 'Яндекс Карты, 2 этаж; привязка по коридорам первого этажа',
       'xf': {'kpx': KPX, 'tx': TX, 'tz': TZ, 'U': U},
       'walk': {'W': GW, 'H': GHt, 'b64': b64}, 'hall': {'b64': hb64},
       'stores': stores, 'kiosks': kiosks, 'voids': voids, 'bld': bld, 'esc': esc, 'escIcons': icons, 'wc': wc}
json.dump(out, open(ROOT + 'src/data/maxi-floor2.json', 'w'), ensure_ascii=False, separators=(',', ':'))
named = [s for s in stores if s['name']]
print('помещений %d, с названием %d, островков %d, проёмов %d' % (len(stores), len(named), len(kiosks), len(voids)))
# 7. превью для сверки: второй этаж поверх коридоров первого
S = 4.0; x0, z0 = -240, -135
img = np.full((int(270 * S), int(480 * S), 3), 30, np.uint8)
w1 = cv2.resize((walk1 * 255).astype(np.uint8), (int(GW * CELL * S), int(GHt * CELL * S)), interpolation=cv2.INTER_NEAREST)
oxp, ozp = int((GR['x0'] - x0) * S), int((GR['z0'] - z0) * S)
sub = img[ozp:ozp + w1.shape[0], oxp:oxp + w1.shape[1]]
sub[w1[:sub.shape[0], :sub.shape[1]] > 0] = (70, 70, 70)
def P(p): return (int((p[0] - x0) * S), int((p[1] - z0) * S))
rng = np.random.default_rng(3)
for s in stores:
    col = (150, 150, 150) if not s['name'] else tuple(int(v) for v in rng.integers(60, 230, 3))
    cv2.fillPoly(img, [np.array([P(p) for p in s['poly']], np.int32)], col)
for v in voids: cv2.polylines(img, [np.array([P(p) for p in v], np.int32)], True, (255, 220, 0), 2)
for b in bld: cv2.polylines(img, [np.array([P(p) for p in b], np.int32)], True, (0, 255, 255), 2)
for e in icons: cv2.circle(img, P(e), 6, (255, 0, 255), -1)
for e in esc:
    cv2.line(img, P(e['bot']), P(e['top']), (255, 80, 255), 10); cv2.circle(img, P(e['top']), 7, (255, 255, 255), -1)
for k in kiosks: cv2.circle(img, P(k['p']), 4, (0, 255, 0), -1)
for s in named: cv2.putText(img, s['name'][:14], P(s['lp']), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
Image.fromarray(img).save('work_f2/preview.png')
Image.fromarray((np.array([[0, 0, 0], [200, 200, 210], [120, 160, 255], [40, 90, 140], [60, 60, 70], [150, 90, 170], [200, 60, 200], [210, 190, 150], [150, 90, 60], [40, 160, 150], [20, 20, 30]], np.uint8))[np.clip(canvas, 0, 10)]).resize((CW // 2, CH // 2), Image.NEAREST).save('work_f2/classes.png')

ov = np.zeros((GHt, GW, 3), np.uint8)
ov[..., 2] = (walk1 > 0.5) * 200; ov[..., 0] = walk2 * 200; ov[..., 1] = (bld1 > 0) * 50
Image.fromarray(ov[:, :, ::-1]).save('work_f2/overlay.png')
