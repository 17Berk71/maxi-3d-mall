"""Выкройка для расчёта ткани: вырезанное фото по силуэту, сетка силуэта, молния и линия пуговиц."""
import json, os, sys, glob
import numpy as np, cv2


DRAPE_ROWS = 64
_BDBG = None


def find_neck(mc, cx, hw):
    """Вырез спереди по контуру вещи на фото: глубина (доля высоты выреза от линии плеч), полуширина (доля полуширины
    корпуса hw) и форма (V — края прямые, круглый — пологий у середины). Раньше вырез у всех вещей был одной формы:
    V-вырез, декольте, бретели не передавались."""
    H, W = mc.shape; c = int(cx * W); hwp = hw * W
    if hwp < 20: return None
    top = np.full(W, np.nan)
    for x in range(max(0, int(c - hwp)), min(W, int(c + hwp) + 1)):
        ys = np.where(mc[:, x] > 0)[0]
        if len(ys): top[x] = ys[0]
    xs = np.arange(W); prof = lambda f: np.nanmedian(top[max(0, int(c + f * hwp) - 2):int(c + f * hwp) + 3]) if True else 0
    sh = np.nanmin([np.nanmedian(top[max(0, int(c - f * hwp) - 3):int(c - f * hwp) + 4]) for f in (0.55, 0.7, 0.85)] +
                   [np.nanmedian(top[int(c + f * hwp) - 3:int(c + f * hwp) + 4]) for f in (0.55, 0.7, 0.85)])
    mid = np.nanmedian(top[c - 2:c + 3])
    if not np.isfinite(sh) or not np.isfinite(mid): return None
    depth = mid - sh
    if depth < H * 0.02: return None
    # полуширина выреза: где край поднимается почти до линии плеч (в среднем по двум сторонам)
    wds = []
    for sg in (1, -1):
        for k in range(1, int(hwp)):
            x = c + sg * k
            if 0 <= x < W and np.isfinite(top[x]) and top[x] - sh < depth * 0.15: wds.append(k); break
    if not wds: return None
    wd = float(np.mean(wds))
    half = []
    for sg in (1, -1):
        x = int(c + sg * wd / 2)
        if 0 <= x < W and np.isfinite(top[x]): half.append((top[x] - sh) / depth)
    vness = float(np.mean(half)) if half else 0.8
    return dict(d=round(float(depth / H), 4), w=round(float(wd / hwp), 3), v=round(float(vness), 2))


def find_quilt(img, mc, cx):
    """Строчки стёжки на фото (пуховик, стёганая куртка): по строкам — медиана яркости в средней полосе вещи, тонкие тёмные
    провалы с почти ровным шагом. → доли высоты выреза (0..1) или None."""
    H, W = mc.shape
    if H < 80: return None
    L = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)[..., 0].astype(np.float32)
    x0, x1 = int(max(0, (cx - 0.28) * W)), int(min(W, (cx + 0.28) * W)); prof = np.full(H, np.nan, np.float32)
    for y in range(H):
        row = mc[y, x0:x1] > 0
        if row.mean() > 0.6: prof[y] = np.median(L[y, x0:x1][row])
    ok = ~np.isnan(prof)
    if ok.sum() < H * 0.5: return None
    ys = np.arange(H); prof = np.interp(ys, ys[ok], prof[ok])
    hp = cv2.GaussianBlur(prof.reshape(-1, 1), (1, 0), sigmaX=1, sigmaY=H / 120).ravel() - cv2.GaussianBlur(prof.reshape(-1, 1), (1, 0), sigmaX=1, sigmaY=H / 25).ravel()
    sd = hp[ok].std()
    if sd < 1.5: return None   # почти ровно — строчек на фото не видно (дутый без прострочек): рельеф не рисуем
    mins = [y for y in range(2, H - 2) if ok[y] and hp[y] < -0.8 * sd and hp[y] == hp[max(0, y - H // 30):y + H // 30].min()]
    if len(mins) < 4: return None
    d = np.diff(mins)
    if d.mean() < H * 0.04 or d.std() / d.mean() > 0.45: return None
    return [round(y / H, 4) for y in mins]


def cut_for_drape(im, m, info, kind, od, side, zip_=False, collar=False, belt=False):
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
    # крупная залитая «дырка» у верха — это не ткань: топ под расстёгнутым пиджаком, кожа в вырезе (сеть их не считает вещью).
    # Пиксели там чужие (пользователь: «топики и кожа впечатались в пиджак») — закрашиваем построчно тканью с краёв
    if kind not in ('pants', 'jeans', 'shorts'):
        big = np.zeros_like(holes)
        for k in range(1, n_h):
            if st_h[k, cv2.CC_STAT_AREA] > 0.004 * max(1, int((mc > 0).sum())): big[lb_h == k] = 1
        if big.any():
            from model_photo import fill_rows
            filled = fill_rows(filled, cv2.dilate(big, np.ones((5, 5), np.uint8)))
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
    # пояс/ремень (по карточке): в примерочной — отдельная объёмная деталь (belt3d.js), с ткани стираем
    bl = None
    if belt and kind not in ('tee', 'shirt', 'sweater', 'hoodie', 'vest'):
        try: bl = find_belt(filled, mc, cxa, info['hw'] / W if 'hw' in info else 0.35, kind)
        except Exception: bl = None
        if bl: filled = erase_belt(filled, mc, bl)
    cord = None
    if side == 'front' and kind in ('dress', 'tee', 'shirt', 'sweater', 'hoodie') and not bl:
        try: cord, cm_ = find_cord(filled, mc, cxa)
        except Exception: cord = None
        if cord: filled = cv2.inpaint(filled, cm_, 7, cv2.INPAINT_TELEA)
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
    if side == 'front' and kind in ('tee', 'shirt', 'sweater', 'dress', 'vest', 'jacket', 'coat', 'hoodie', 'puffer') and a.get('hw'):
        nk = find_neck(mc, a['cx'], a['hw'])
        if nk: a['neck'] = nk
    if kind in ('puffer', 'vest', 'jacket', 'coat'):
        q = find_quilt(filled, mc, a['cx'])
        if q: a['quilt'] = q
    if col_: a['collar'] = dict(rgb=col_['rgb'])
    if side == 'front' and kind in ('vest', 'shirt', 'jacket', 'tee', 'sweater', 'coat') and a.get('hw'):
        hp = find_hem_prof(mc, a['cx'], a['hw'])
        if hp: a['hemp'] = hp
    if cord: a['cord'] = cord
    if bl: a['belt'] = {k_: (float(v) if isinstance(v, (float, np.floating)) else ({kk: float(vv) for kk, vv in v.items()} if isinstance(v, dict) else v)) for k_, v in bl.items() if k_ != 'score'}
    return dict(img=side + '_cut.webp', W=W, H=H, gw=gw, gh=gh, grid=grid, a={k_: (v if isinstance(v, (list, dict)) else round(float(v), 4)) for k_, v in a.items()})


def find_belt(img, mc, cx, hw, kind):
    """Пояс/ремень на фото переда (по характеристикам карточки он есть): горизонтальная полоса поперёк вещи — два резких
    горизонтальных края на расстоянии 2–9% высоты, внутри ровно; или полоса другого цвета (кожаный ремень на брюках).
    → {'v0','v1' (доли высоты выреза), 'rgb', 'buckle': {'u','w'} | None} или None. Пользователь: «пояс влип в куртку»,
    «ремень — не часть брюк»: в примерочной пояс — отдельная объёмная деталь, с ткани стираем."""
    H, W = mc.shape
    if H < 120: return None
    lab = cv2.cvtColor(cv2.GaussianBlur(img, (3, 3), 0), cv2.COLOR_BGR2LAB).astype(np.float32)
    c = int(cx * W); hwp = max(10, int((hw or 0.3) * W))
    xa, xb = max(0, c - int(0.75 * hwp)), min(W, c + int(0.75 * hwp))
    gy = np.abs(cv2.Sobel(lab[..., 0], cv2.CV_32F, 0, 1, ksize=3))
    bottoms = kind in ('pants', 'jeans', 'shorts', 'skirt')
    ya, yb = (0, int(0.16 * H)) if bottoms else (int(0.28 * H), int(0.78 * H))
    rows = np.arange(H); E = np.zeros(H, np.float32); Cm = np.zeros((H, 3), np.float32); ok = np.zeros(H, bool)
    for y in range(H):
        r = mc[y, xa:xb] > 0
        if r.mean() < 0.7: continue
        E[y] = np.median(gy[y, xa:xb][r]); Cm[y] = np.median(lab[y, xa:xb][r], 0); ok[y] = True
    body = ok.copy(); body[:int(0.1 * H)] = False
    if body.sum() < 0.3 * H: return None
    ref = np.median(Cm[body], 0); D = np.linalg.norm((Cm - ref) * [0.5, 1, 1], axis=1)
    Emed = np.median(E[ok]) + 0.5; Dsp = np.percentile(D[body], 70) + 2
    best = None
    if bottoms:   # ремень на брюках — сверху, другого цвета: от верха вещи вниз, пока цвет строки далёк от ткани
        ys = np.where(ok)[0]
        if len(ys):
            y0 = int(ys[0]); y1 = y0
            while y1 < int(0.14 * H) and ok[y1] and D[y1] > max(12, 2 * Dsp): y1 += 1
            if y1 - y0 >= max(4, int(0.015 * H)):
                best = (9.0, y0, y1, 9.0, 0.0, float(D[y0:y1].mean() / Dsp))
    for y0 in ([] if best else range(max(ya, 1), yb)):
        if not ok[y0]: continue
        for g in range(max(4, int(0.02 * H)), int(0.11 * H)):
            y1 = y0 + g
            if y1 >= H - 1 or not ok[y1] or not ok[y0:y1].all(): continue
            e = min(E[y0 - 1:y0 + 2].max(), E[y1 - 1:y1 + 2].max()) / Emed
            inner = E[y0 + 2:y1 - 1].mean() / Emed if g > 4 else 1
            col = D[y0 + 1:y1].mean() / Dsp
            o = max(3, int(0.03 * H)); outer = (E[max(0, y0 - o):max(1, y0 - 2)].mean() + E[y1 + 2:min(H, y1 + o)].mean()) / 2 / Emed if y1 + 3 < H else 9
            # за краями пояса — ровная ткань вещи (на поясе бывают свои строчки: стёганый пояс)
            sc = e - 0.15 * inner - 0.5 * outer + (1.5 * col if col > 1.5 else 0) + 0.4 * g / (0.05 * H)
            if _BDBG is not None: _BDBG.append((round(float(sc),2), round(y0/H,3), round(y1/H,3), round(float(e),2), round(float(inner),2), round(float(outer),2)))
            if best is None or sc > best[0]: best = (sc, y0, y1, e, inner, col)
    if best is None: return None
    sc, y0, y1, e, inner, col = best
    if not ((e > 2.2 and inner < 0.9 * e) or col > 2.5): return None
    # пояс со своими строчками (стёганый): лучшей парой бывает строчка и нижний край — расширяем до края, за которым ткань ровнее
    if not bottoms:
        o = max(3, int(0.03 * H)); rough = lambda a_, b_: E[max(0, a_):max(a_ + 1, b_)].mean() / Emed
        for _ in range(2):
            cand = [y for y in range(max(1, y0 - int(0.06 * H)), y0 - int(0.012 * H)) if ok[y] and E[y - 1:y + 2].max() >= 0.6 * E[y0 - 1:y0 + 2].max()
                    and rough(y - o, y - 2) < 0.7 * rough(y0 - o, y0 - 2) and y1 - y < 0.12 * H]
            if cand: y0 = min(cand, key=lambda y: rough(y - o, y - 2))
            cand = [y for y in range(y1 + int(0.012 * H), min(H - 2, y1 + int(0.06 * H))) if ok[y] and E[y - 1:y + 2].max() >= 0.6 * E[y1 - 1:y1 + 2].max()
                    and rough(y + 2, y + o) < 0.7 * rough(y1 + 2, y1 + o) and y - y0 < 0.12 * H]
            if cand: y1 = min(cand, key=lambda y: rough(y + 2, y + o))
    band = (mc[y0 + 1:y1] > 0)
    rgb = np.median(img[y0 + 1:y1][band].reshape(-1, 3), 0)
    # пряжка: у середины пояса — вертикальные края рамки (резкий перепад по x) или пятно другого цвета
    gx = np.abs(cv2.Sobel(lab[..., 0], cv2.CV_32F, 1, 0, ksize=3))[y0 + 1:y1].mean(0)
    seg = gx[max(0, c - hwp // 2):min(W, c + hwp // 2)]; buckle = None
    if len(seg) > 10:
        thr = np.median(gx[xa:xb]) * 3 + 2; peaks = np.where(seg > thr)[0]
        if len(peaks) >= 2:   # группы пиков (рамка пряжки — 2–4 края рядом); берём группу ближе к середине
            grp = np.split(peaks, np.where(np.diff(peaks) > 0.12 * hwp)[0] + 1); cc = c - max(0, c - hwp // 2)
            grp = [g_ for g_ in grp if len(g_) >= 2 and 0.6 * (y1 - y0) < g_[-1] - g_[0] < 3 * (y1 - y0)]
            if grp:
                g_ = min(grp, key=lambda g_: abs((g_[0] + g_[-1]) / 2 - cc))
                x0 = max(0, c - hwp // 2) + g_[0]; x1 = max(0, c - hwp // 2) + g_[-1]
                buckle = dict(u=round((x0 + x1) / 2 / W, 4), w=round((x1 - x0 + 4) / W, 4))
    if bottoms and y0 < 0.05 * H: y0 = 0   # ремень по верху брюк: от самого края
    return dict(v0=round(y0 / H, 4), v1=round(y1 / H, 4), rgb='#%02x%02x%02x' % tuple(int(v) for v in rgb[::-1]), buckle=buckle,
                score=round(float(sc), 2))


def find_cord(img, mc, cx):
    """Шнурок-завязка или бант у талии (платье Colin's: белые шнурки на кулиске) — на однотонной ткани тонкие линии другого цвета
    в одном месте у середины. → ({'u','v','len','rgb'}, маска) или (None, None). Пользователь: «бантик на талии влип в платье»."""
    H, W = mc.shape
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32); inside = mc > 0
    if inside.sum() < 2000: return None, None
    ref = np.median(lab[inside], 0); dist = np.linalg.norm((lab - ref) * [0.6, 1, 1], axis=2)
    if np.percentile(dist[inside], 80) > 16: return None, None     # пёстрая ткань — шнурок от рисунка не отличить
    far = (dist > 38) & inside
    reg = np.zeros_like(far); reg[int(0.25 * H):int(0.75 * H), max(0, int((cx - 0.22) * W)):int((cx + 0.22) * W)] = True   # выше — вырез горловины
    far = (far & reg).astype(np.uint8)
    n, lb, st, cen = cv2.connectedComponentsWithStats(far)
    keep = [i for i in range(1, n) if st[i, 4] > 15 and st[i, 4] < 0.45 * st[i, 2] * st[i, 3] + 40]   # тонкое, не сплошное пятно (не пуговица)
    if not keep: return None, None
    mid = [i for i in keep if abs(cen[i][0] / W - cx) < 0.1]   # завязка — у середины, в одном месте: компоненты рядом с самой большой из средних
    if not mid: return None, None
    big = max(mid, key=lambda i: st[i, 4])
    keep = [i for i in keep if abs(cen[i][1] - cen[big][1]) < 0.15 * H and abs(cen[i][0] - cen[big][0]) < 0.15 * W]
    m = np.isin(lb, keep); ys, xs = np.where(m)
    area = m.sum() / inside.sum()
    if not (0.0008 < area < 0.03) or ys.max() - ys.min() > 0.3 * H or xs.max() - xs.min() > 0.3 * W: return None, None
    rgb = np.median(img[m], 0)
    info = dict(u=round(float(np.median(xs) / W), 4), v=round(float(ys.min() / H), 4), len=round(float((ys.max() - ys.min()) / H), 4),
                w=round(float((xs.max() - xs.min()) / W), 4), rgb='#%02x%02x%02x' % tuple(int(v) for v in rgb[::-1]))
    # ореол шнурка (светлая кайма, тень под ним) — тоже стираем: в рамке шнурка всё, что заметно отличается от ткани
    y0_, y1_, x0_, x1_ = max(0, ys.min() - 8), min(H, ys.max() + 9), max(0, xs.min() - 8), min(W, xs.max() + 9)
    halo = np.zeros_like(m); halo[y0_:y1_, x0_:x1_] = (dist[y0_:y1_, x0_:x1_] > 18) & inside[y0_:y1_, x0_:x1_]
    return info, cv2.dilate((m | halo).astype(np.uint8) * 255, np.ones((9, 9), np.uint8))


def find_hem_prof(mc, cx, hw):
    """Форма низа переда: насколько низ ниже, чем у бока, от середины (f=0) к боку (f=1), в долях высоты выреза.
    Жилет с уголками посередине, рубашка с полукруглым низом. Пользователь: «нет скошенных углов снизу посередине»."""
    H, W = mc.shape; c = cx * W; hwp = hw * W
    if hwp < 15: return None
    out = []
    for f in np.linspace(0, 0.8, 9):
        bs = []
        for sg in (-1, 1):
            x = int(round(c + sg * f * hwp))
            if 0 <= x < W:
                ys = np.where(mc[:, x] > 0)[0]
                if len(ys): bs.append(ys[-1])
        out.append(np.mean(bs) if bs else np.nan)
    out = np.array(out, float)
    if np.isnan(out).any(): return None
    d = (out - np.median(out[5:])) / H   # от низа у бока (средняя полоса к боку; у самого бока бывает рукав или разрез)
    d[5:] = np.clip(d[5:], -0.006, 0.006)   # у бока — ровно (там рукав, разрез, рука)
    if np.abs(d[:5]).max() < 0.02 or np.abs(np.diff(d)).max() > 0.06: return None   # ровный низ или зубцы (рука, край кадра)
    return [round(float(v), 4) for v in d]


def erase_belt(img, mc, b):
    """стереть пояс с ткани: каждый столбец полосы — переход от цвета над поясом к цвету под ним (стёжка, складки
    по вертикали продолжаются)."""
    H, W = mc.shape; y0 = max(1, int(b['v0'] * H) - 2); y1 = min(H - 2, int(b['v1'] * H) + 2)
    out = img.astype(np.float32).copy()
    if b['v0'] <= 0.001: y0 = 0
    bot = np.median(img[y1 + 1:y1 + 7].astype(np.float32), 0); top = np.median(img[max(0, y0 - 6):y0].astype(np.float32), 0) if y0 >= 3 else bot
    t = np.linspace(0, 1, y1 - y0 + 1)[:, None, None]
    out[y0:y1 + 1] = top[None] * (1 - t) + bot[None] * t
    out[y0:y1 + 1] = cv2.GaussianBlur(out[y0:y1 + 1], (9, 1), 0)
    bk = b.get('buckle')
    if bk:   # пряжка выше и ниже пояса — стираем коробку пошире
        g = y1 - y0; ya, yb = max(0, y0 - int(0.35 * g)), min(H - 2, y1 + int(0.35 * g)); xa, xb = max(0, int((bk['u'] - bk['w'] * 0.85) * W)), min(W, int((bk['u'] + bk['w'] * 0.85) * W))
        top = out[max(0, ya - 5):ya, xa:xb].mean(0) if ya >= 5 else out[yb + 1:yb + 6, xa:xb].mean(0); bot = out[yb + 1:yb + 6, xa:xb].mean(0)
        t = np.linspace(0, 1, yb - ya + 1)[:, None, None]; out[ya:yb + 1, xa:xb] = top[None] * (1 - t) + bot[None] * t
    return np.clip(out, 0, 255).astype(np.uint8)


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
    placket = kind in ('dress', 'shirt', 'coat', 'jacket', 'vest'); waist = kind in ('skirt', 'pants', 'jeans', 'shorts')
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
