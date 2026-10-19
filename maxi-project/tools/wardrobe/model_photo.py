"""Фото вещи на человеке (карточка магазина): обрезка интерфейса, маска одежды нейросетью, низ платья/юбки по цвету."""
import json, os, sys, glob
import numpy as np, cv2
from photo_io import find
from wardrobe_paths import TOPS


LAST_HEM = None


def drop_leg_gap(im, m):
    """Фон в просвете между штанинами (на фото с человеком сеть часто захватывает его вместе с брюками: асфальт, дверь):
    куски ниже середины вещи у её средней линии, далёкие по цвету от ткани (цвета ткани — по верхней трети маски, где фона нет)
    и того же цвета, что фон рядом за краем маски."""
    h, w = m.shape
    ys = np.where(m.any(1))[0]
    if len(ys) < 50: return m
    y0, y1 = ys[0], ys[-1]
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    top = lab[y0:y0 + int(.35 * (y1 - y0))][m[y0:y0 + int(.35 * (y1 - y0))] > 0].reshape(-1, 3)
    if len(top) < 200: return m
    smp = top[np.random.default_rng(0).choice(len(top), min(len(top), 4000), replace=False)]
    _, _, cen = cv2.kmeans(smp, 6, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 3, cv2.KMEANS_PP_CENTERS)
    ya = y0 + int(.3 * (y1 - y0))   # от шага (у брюк ~0.3 высоты вещи)
    sub = lab[ya:y1 + 1]
    dist = np.min(np.stack([np.linalg.norm(sub - c, axis=2) for c in cen]), 0)
    # цветная ткань (деним, даже выбеленный, — синий): бесцветные куски (асфальт, дверь, стена) — не она, даже если по яркости близки
    chr_top = np.hypot(top[:, 1] - 128, top[:, 2] - 128)
    allm = lab[m > 0]; chr_all = np.hypot(allm[:, 1] - 128, allm[:, 2] - 128)
    medC = float(max(np.median(chr_top), np.median(chr_all)))   # по всей вещи: у выбеленных сверху джинсов верх почти бесцветный
    chr_sub = np.hypot(sub[..., 1] - 128, sub[..., 2] - 128)
    bad = (dist > 20) | ((chr_sub < max(4.0, .4 * medC)) if medC > 10 else False)
    far = np.zeros_like(m); far[ya:y1 + 1] = (bad & (m[ya:y1 + 1] > 0)).astype(np.uint8)
    far = cv2.morphologyEx(far, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    cols = np.where(m[ya:y1 + 1].any(0))[0]
    if not len(cols): return m
    cx, ww = (cols[0] + cols[-1]) / 2, cols[-1] - cols[0]
    out = m.copy(); dropped = 0
    # цветная ткань: по строкам ниже шага от середины в обе стороны до первого насыщенного пикселя (внутренний край штанины);
    # если в середине строки бесцветно — всё между краями штанин фон (асфальт, дверь между ногами). Штанины сходятся
    # (в середине ткань) — строку не трогаем
    if medC > 10:
        ic = int(round(cx)); thr = .6 * medC
        for y in range(ya, y1 + 1):
            if not m[y, max(0, ic - 2):ic + 3].any() or np.median(chr_sub[y - ya, max(0, ic - 2):ic + 3]) >= .4 * medC: continue
            l = ic; r = ic
            while l > 0 and m[y, l - 1] and chr_sub[y - ya, l - 1] < thr: l -= 1
            while r < w - 1 and m[y, r + 1] and chr_sub[y - ya, r + 1] < thr: r += 1
            if r - l > 4 and l > cols[0] + 5 and r < cols[-1] - 5: out[y, l:r + 1] = 0; dropped += 1
    n, lb, st, cc = cv2.connectedComponentsWithStats(far)
    area = m.sum()
    for k in range(1, n):
        if st[k, cv2.CC_STAT_AREA] < area * .002 or abs(cc[k][0] - cx) > .22 * ww: continue
        comp = lb == k
        ring = (cv2.dilate(comp.astype(np.uint8), np.ones((15, 15), np.uint8)) > 0) & (m == 0)
        cm_ = np.median(lab[comp], 0)
        # тот же цвет, что фон рядом за краем маски, — или кусок доходит до низа вещи (просвет между ногами открыт снизу)
        same = ring.sum() >= 40 and (np.linalg.norm(lab[ring] - cm_, axis=1) < 18).mean() > .12
        if same or st[k, cv2.CC_STAT_TOP] + st[k, cv2.CC_STAT_HEIGHT] >= y1 - 3:
            out[comp] = 0; dropped += 1
    if not dropped: return m
    out = cv2.morphologyEx(out, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lb, st, _ = cv2.connectedComponentsWithStats(out)
    return (lb == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8) if n > 1 else out


def load_model_photo(key, kind):
    """Фото из карточки магазина (вещь на человеке): обрезать интерфейс скриншота, маска вещи — нейросетью (seg_person.py)."""
    from seg_person import crop_rows, cloth_masks
    im0 = cv2.imread(find(key))
    r0, r1 = crop_rows(im0)
    # сеть смотрит кадр в 768×768, и результат зависит от кадрирования: берём объединение масок по скриншоту целиком,
    # по самому фото и по его нижней половине (мелкие брюки внизу кадра иначе теряются)
    full = cloth_masks(im0)
    im = im0[r0:r1]; h, w = im.shape[:2]
    crop = cloth_masks(im)
    lo = cloth_masks(im[h // 2:])
    ms = {}
    for k in ('upper', 'lower', 'full'):
        mk = full[k][r0:r1] | crop[k]
        mk[h // 2:] |= lo[k]
        ms[k] = mk
    if h > 1400:
        k_ = 1400 / h; im = cv2.resize(im, (int(w * k_), 1400), interpolation=cv2.INTER_AREA)
        ms = {k: cv2.resize(v, (im.shape[1], 1400), interpolation=cv2.INTER_NEAREST) for k, v in ms.items()}
        h, w = im.shape[:2]
    # платье сеть делит на «целиком», «верх» и «низ» (лиф и юбка у отрезного) — берём всё вместе
    m = (ms['full'] | ms['upper'] | ms['lower']) if kind == 'dress' else ms['upper'] if kind in TOPS else ms['lower']
    # длинное пальто, плащ, удлинённый пуховик сеть часто относит к «целиком» (как платье), а «верх» — только плечи:
    # у верхней одежды, если «целиком» много, берём оба класса
    # у остальных верхних вещей — только если «верх» почти не найден (белый жакет на белом: всё в «целиком»);
    # иначе к пиджаку цеплялась юбка или платье под ним, и низ вещи выходил у колена
    long_top = kind in ('coat', 'puffer') and ms['full'].sum() > 0.5 * max(1, ms['upper'].sum())
    tiny_top = kind in TOPS and kind != 'dress' and ms['upper'].sum() < 0.25 * ms['full'].sum()
    if long_top or tiny_top:
        m = ms['upper'] | ms['full']
    elif kind in TOPS and kind != 'dress' and ms['full'].sum() > 0.15 * max(1, ms['upper'].sum()) and ms['upper'].sum() > 500:
        # светлая куртка или пуховик: сеть делит одну вещь между «верхом» и «целиком» кусками (Zolla 551585075 — от куртки
        # осталась полоса). Берём из «целиком» только то, что цветом как «верх» и касается его: юбка/платье под пиджаком
        # почти всегда другого цвета и остаётся в стороне
        lab_im = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32); up = ms['upper'] > 0
        ref = np.median(lab_im[up], 0); dl = lab_im - ref; dl[..., 0] *= 0.4   # по яркости мягче: тени стёжки и складок
        near = ((np.linalg.norm(dl, axis=2) < 16) & (ms['full'] > 0)).astype(np.uint8)
        n_, lab2, st2, _ = cv2.connectedComponentsWithStats(near)
        touch = cv2.dilate(up.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
        keep = [i for i in range(1, n_) if st2[i, cv2.CC_STAT_AREA] > 300 and touch[lab2 == i].any()]
        if keep:
            add = np.isin(lab2, keep)
            if add.sum() > 0.1 * up.sum():
                m = cv2.morphologyEx((up | add).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((21, 21), np.uint8)) & ((ms['full'] | ms['upper']) > 0).astype(np.uint8)
                tiny_top = True   # дальше — как с объединением (низ вещи по маске)
    # длинную юбку (атлас, макси) сеть тоже бывает относит к «целиком»: если «низа» мало — берём и «целиком»,
    # верх (кофта, жилет) потом отрезается по резкому сужению у пояса
    if kind == 'skirt' and ms['lower'].sum() < 0.5 * ms['full'].sum():
        m = ms['lower'] | ms['full']
    # юбку под блузкой навыпуск сеть часто считает «платьем» (вместе с рукавами блузки): низ — это область цвета вещи
    # под краем верха по середине кадра (рукава другого цвета отпадают), связная с серединой
    if kind not in TOPS and m.sum() < 0.2 * max(1, (ms['full'] | ms['upper']).sum()) and (ms['full'] | ms['upper']).sum() > 2000:
        U = (ms['full'] | ms['upper'] | ms['lower']) > 0; cx = w // 2
        yy = np.where(U[:, cx - 25:cx + 25].any(1))[0]
        if len(yy):
            # низ — самая нижняя вещь: цвет берём в нижней трети одежды по середине кадра
            ya, yb = int(yy[0] + (yy[-1] - yy[0]) * 0.62), int(yy[0] + (yy[-1] - yy[0]) * 0.9)
            lab_im = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32); strip = U[ya:yb, cx - 25:cx + 25]
            if strip.sum() > 50:
                ref = np.median(lab_im[ya:yb, cx - 25:cx + 25][strip], 0)
                near = (np.linalg.norm(lab_im - ref, axis=2) < 22) & U
                near = cv2.morphologyEx(near.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
                n_, lab2, st2, _ = cv2.connectedComponentsWithStats(near)
                yc = (ya + yb) // 2
                if n_ > 1 and near[yc, cx]: m = (lab2 == lab2[yc, cx]).astype(np.uint8)
    # где кончается верх на модели: доля «от низа вещи до пояса брюк» к «от горловины до пояса» (0 — ровно по поясу, >0 — ниже)
    global LAST_HEM
    LAST_HEM = None
    if kind in TOPS and ms['lower'].sum() > 1000:
        cx = w // 2; yu = np.where((m if (long_top or tiny_top) else ms['upper'])[:, cx - 40:cx + 40].any(1))[0]; yl = np.where(ms['lower'][:, cx - 60:cx + 60].any(1))[0]
        if len(yu) and len(yl) and yl[0] > yu[0]: LAST_HEM = round(float((yu[-1] - yl[0]) / (yl[0] - yu[0])), 3)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab_, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1: m = (lab_ == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    # сверху к низу может прилипнуть край кофты (сеть иногда относит его к низу): кофта шире пояса —
    # ищем самое узкое место в верхней трети (пояс), всё выше него, если оно заметно шире, — не брюки
    if kind not in TOPS:
        # снизу к штанинам прилипает обувь: строки, цвет которых далёк от цвета штанин, — долой
        lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
        ys = np.where(m.any(1))[0]; y0, y1 = ys[0], ys[-1]
        mid = lab[y0 + (y1 - y0) // 2:y0 + 3 * (y1 - y0) // 4][m[y0 + (y1 - y0) // 2:y0 + 3 * (y1 - y0) // 4] > 0]; g = np.median(mid, 0)
        y = y1
        while y > y0 + (y1 - y0) * .8:
            px = lab[y][m[y] > 0]
            if len(px) and (np.linalg.norm(np.median(px, 0) - g) > 28): m[y] = 0; y -= 1
            else: break
        wid = cv2.blur(m.sum(1).astype(np.float32).reshape(-1, 1), (1, 9)).ravel()
        ys = np.where(wid > wid.max() * .3)[0]; y0, y1 = ys[0], ys[-1]
        # пояс — там, где ширина резко падает (низ кофты шире пояса брюк)
        dd = 10
        seg = range(y0 + dd, y0 + int((y1 - y0) * .35))
        if len(seg):
            yw = max(seg, key=lambda y: wid[y - dd] - wid[y + dd])
            if wid[yw - dd] - wid[yw + dd] > 0.15 * wid[yw + dd]: m[:yw + dd // 2] = 0
        if kind != 'skirt': m = drop_leg_gap(im, m)
    im, m = pose_cleanup(im, m, kind)
    im = paint_over_skin(im, m)
    im = paint_over_hair(im, m)
    # paint_over_inner (середина расстёгнутой вещи) — проба не удалась: у жилета на модели маска «верх» захватывает и кофту под ним,
    # «основным» цветом выходила кофта; у пуховика с красным свитером и джинсами цветов больше двух. Не включено.
    return im, m


def paint_over_skin(im, m):
    """Кожа внутри силуэта вещи (кисти поверх ткани, грудь в вырезе, пальцы на поясе) — закрасить тканью вокруг,
    силуэт не трогаем. Вещь телесного цвета (бежевая, пудровая) — не трогаем совсем: кожу от ткани не отличить."""
    ycc = cv2.cvtColor(im, cv2.COLOR_BGR2YCrCb)
    cr, cb = ycc[..., 1].astype(np.int16), ycc[..., 2].astype(np.int16)
    skin = (cr > 137) & (cr < 173) & (cb > 77) & (cb < 127) & (ycc[..., 0] > 60)
    inside = m > 0
    if inside.sum() < 1000: return im
    if skin[inside].mean() > 0.35: return im
    sk = (skin & inside).astype(np.uint8)
    sk = cv2.morphologyEx(sk, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(sk)
    keep = np.zeros_like(sk)
    for k in range(1, n):
        if st[k, cv2.CC_STAT_AREA] >= 60: keep[lab == k] = 1      # мелкие точки цвета кожи на принте — не трогаем
    if not keep.any(): return im
    keep = cv2.dilate(keep, np.ones((7, 7), np.uint8))
    return cv2.inpaint(im, keep, 9, cv2.INPAINT_TELEA)


def paint_over_inner(im, m):
    """Верхняя одежда на модели расстёгнута: посередине видна кофта/рубашка под ней (жилет Телодвижения — бежевый свитер
    в коричневом жилете). На манекене вещь застёгнута — середину закрашиваем тканью вещи. Узнаём по двум цветам внутри силуэта:
    второй цвет (8–45% площади) собран у середины, основной — по бокам."""
    inside = m > 0
    if inside.sum() < 3000: return im
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    ys, xs = np.where(inside); sel = np.linspace(0, len(ys) - 1, min(len(ys), 20000)).astype(int)
    px = lab[ys[sel], xs[sel]]
    _, lb, cen = cv2.kmeans(px, 2, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.5), 3, cv2.KMEANS_PP_CENTERS)
    lb = lb.ravel(); big = int(np.bincount(lb, minlength=2).argmax()); f = float((lb != big).mean())
    if not (0.08 < f < 0.45) or np.linalg.norm(cen[0] - cen[1]) < 25: return im
    x0, x1 = xs.min(), xs.max(); cx, bw = (x0 + x1) / 2, max(1, x1 - x0)
    xm, xb = xs[sel][lb != big], xs[sel][lb == big]
    if (np.abs(xm - cx) < 0.22 * bw).mean() < 0.6 or (np.abs(xb - cx) < 0.22 * bw).mean() > 0.4: return im
    dm = np.linalg.norm(lab - cen[1 - big], axis=2) < np.linalg.norm(lab - cen[big], axis=2)
    band = np.zeros_like(inside); band[:, int(cx - 0.3 * bw):int(cx + 0.3 * bw) + 1] = True
    k = (dm & inside & band).astype(np.uint8); k = cv2.morphologyEx(k, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab2, st, _ = cv2.connectedComponentsWithStats(k); keep = np.zeros_like(k)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 0.02 * inside.sum(): keep[lab2 == i] = 1
    if not keep.any(): return im
    keep = cv2.dilate(keep, np.ones((9, 9), np.uint8))
    # большую область Telea размазывает полосами: сначала основной цвет вещи, по краю — плавный переход
    out = im.copy(); col = cv2.cvtColor(np.uint8([[np.clip(cen[big], 0, 255)]]), cv2.COLOR_LAB2BGR)[0, 0]
    out[keep > 0] = col
    edge = cv2.dilate(keep, np.ones((15, 15), np.uint8)) - cv2.erode(keep, np.ones((15, 15), np.uint8))
    return cv2.inpaint(out, edge, 7, cv2.INPAINT_TELEA)


LAST_OCC = None   # доля корпуса вещи, закрытая руками на последнем фото (для meta и проверки внешнего вида)
LAST_SLEEVE = None  # ткань рукава, снятая вдоль руки по позе (u — поперёк рукава, v — от плеча к манжете)
LAST_OPEN = False  # на фото вещь расстёгнута (посередине видна кофта под ней) — в примерочной сначала «нараспашку»


def sleeve_strip(im, m, kp, H=256, W=96):
    """Ткань рукава по позе: полоса вдоль руки (плечо → локоть → запястье) внутри маски вещи, выпрямленная в прямоугольник.
    Раньше у фото на модели рукав брал ткань с чистого места переда — рисунок и фактура рукава пропадали (пользователь:
    «рисунок на рукавах должен совпадать с рисунком на теле»). Берём руку, у которой больше ткани в маске; рукав короче руки —
    полоса до его конца."""
    best = None
    sl, sr = np.array(kp['sh_l'][:2]), np.array(kp['sh_r'][:2]); shw = np.linalg.norm(sl - sr)
    if shw < 20: return None
    for s_ in ('l', 'r'):
        pts = [kp[f'{j}_{s_}'] for j in ('sh', 'el', 'wr')]
        if min(p[2] for p in pts[:2]) < 0.3: continue
        P = [np.array(p[:2]) for p in pts if p[2] >= 0.3]
        seg = [np.linalg.norm(P[i + 1] - P[i]) for i in range(len(P) - 1)]; Ltot = sum(seg)
        if Ltot < shw * 0.4: continue
        rows = []
        for k in range(H):
            d = Ltot * (k + 0.5) / H; i = 0
            while i < len(seg) - 1 and d > seg[i]: d -= seg[i]; i += 1
            t = (P[i + 1] - P[i]) / max(seg[i], 1e-6); p = P[i] + t * min(d, seg[i]); nrm = np.array([-t[1], t[0]])
            lim = shw * 0.32; hw = [0, 0]
            for sgn_i, sg in enumerate((1, -1)):
                r = 0
                while r < lim:
                    q = (p + nrm * sg * (r + 1)).astype(int)
                    if not (0 <= q[0] < m.shape[1] and 0 <= q[1] < m.shape[0]) or not m[q[1], q[0]]: break
                    r += 1
                hw[sgn_i] = r
            rows.append((p, nrm, hw))
        cov = np.array([min(h[0], h[1]) > shw * 0.04 for _, _, h in rows])
        if cov[:H // 3].mean() < 0.6: continue
        last = H - 1
        while last > H // 4 and not cov[last]: last -= 1
        score = cov[:last + 1].mean() * last
        if best is None or score > best[0]: best = (score, rows[:last + 1])
    if best is None: return None
    rows = best[1]; mx = np.zeros((len(rows), W), np.float32); my = np.zeros_like(mx)
    hwm = np.median([h[0] + h[1] for _, _, h in rows]) / 2
    for k, (p, nrm, h) in enumerate(rows):
        c = p + nrm * (h[0] - h[1]) / 2; hk = max(3, min((h[0] + h[1]) / 2, hwm * 1.3))
        for j in range(W):
            o = (j / (W - 1) * 2 - 1) * hk * 0.85; q = c + nrm * o; mx[k, j] = q[0]; my[k, j] = q[1]
    strip = cv2.remap(im, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    inside = cv2.remap((m > 0).astype(np.uint8) * 255, mx, my, cv2.INTER_NEAREST, borderValue=0)
    ycc = cv2.cvtColor(strip, cv2.COLOR_BGR2YCrCb)   # кисть, фон за краем рукава — не ткань: заливаем тканью вокруг
    skin = (ycc[..., 1] > 137) & (ycc[..., 1] < 173) & (ycc[..., 2] > 77) & (ycc[..., 2] < 127) & (ycc[..., 0] > 60)
    bad = ((inside < 128) | (skin if skin.mean() < 0.35 else False)).astype(np.uint8)
    if bad.mean() > 0.5: return None
    if bad.any(): strip = cv2.inpaint(strip, cv2.dilate(bad, np.ones((3, 3), np.uint8)), 5, cv2.INPAINT_TELEA)
    return cv2.resize(strip, (128, 256), interpolation=cv2.INTER_AREA)


def pose_cleanup(im, m, kind):
    """По позе человека (pose.py, MoveNet): 1) у жилета руки — это рукава кофты под ним: из маски долой;
    2) руки поверх корпуса (скрещены, в карманах, держат полу) — закрасить тканью вокруг;
    3) у расстёгнутой верхней одежды посередине видна кофта под ней — закрасить цветом вещи с боков корпуса
    (на манекене вещь застёгнута)."""
    global LAST_OCC, LAST_OPEN, LAST_SLEEVE
    LAST_OCC = None; LAST_OPEN = False; LAST_SLEEVE = None
    if kind not in TOPS: return im, m
    try:
        import pose
        kp = pose.keypoints(im)
    except Exception: kp = None
    if not kp: return im, m
    am = pose.arm_mask(im.shape, kp)
    if kind == 'vest' and am.any():
        m2 = m.copy(); m2[cv2.dilate(am, np.ones((9, 9), np.uint8)) > 0] = 0
        n, lb, st, _ = cv2.connectedComponentsWithStats(m2)
        if n > 1 and st[1:, cv2.CC_STAT_AREA].max() > 0.4 * m.sum(): m = (lb == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    occ, om = pose.occlusion(m, kp, im.shape)
    if kind != 'vest':
        try: LAST_SLEEVE = sleeve_strip(im, m, kp)
        except Exception: LAST_SLEEVE = None
    LAST_OCC = occ
    if om is not None and om.any() and kind != 'vest' and occ < 0.35:
        k = cv2.dilate(om.astype(np.uint8), np.ones((7, 7), np.uint8)) & m
        im = cv2.inpaint(im, k, 9, cv2.INPAINT_TELEA)
    if kind in ('coat', 'jacket', 'puffer', 'vest', 'hoodie'):
        # середина расстёгнутой вещи (кофта, топ, кожа, юбка под пиджаком — бывает несколько цветов сразу): промежуток между
        # полочками по строкам (contam.inner_span), каждая строка заливается переходом от цвета левого края к правому —
        # горизонтальная стёжка и светотень строки сохраняются, на манекене середина — ткань вещи
        import contam
        sp, col = contam.inner_span(im, m, kp)
        if sp is not None:
            LAST_OPEN = True
            im = fill_rows(im, sp)
            m = (m | sp).astype(np.uint8)
    try:
        import contam
        tx = contam.text_mask(im, m)
        if tx is not None: im = cv2.inpaint(im, tx, 7, cv2.INPAINT_TELEA)
    except Exception: pass
    return im, m


def fill_rows(im, sp, k=7):
    """Закрасить маску sp построчно: переход от цвета слева от промежутка к цвету справа. Цвета краёв сглажены по высоте
    (медиана по 7 строкам и плавно): иначе блик или шов на краю одной строки даёт горизонтальную полосу; горизонтальная
    стёжка (шире нескольких строк) остаётся."""
    from scipy.ndimage import median_filter, gaussian_filter1d
    out = im.astype(np.float32).copy(); H, W = sp.shape
    rows = np.where(sp.any(1))[0]
    if not len(rows): return im
    segs = {}
    for y in rows:   # самый широкий промежуток строки
        xs = np.where(sp[y])[0]; parts = np.split(xs, np.where(np.diff(xs) > 1)[0] + 1)
        segs[y] = max(parts, key=len)
    CL = np.zeros((H, 3), np.float32); CR = np.zeros((H, 3), np.float32); ok = np.zeros(H, bool)
    for y, sg in segs.items():
        a, b = sg[0], sg[-1]
        L = im[y, max(0, a - 4 * k):max(0, a - k)]; R = im[y, min(W, b + 1 + k):min(W, b + 1 + 4 * k)]   # отступ от края: там планка, тень
        if not len(L) and not len(R): continue
        CL[y] = np.median(L if len(L) else R, 0); CR[y] = np.median(R if len(R) else L, 0); ok[y] = True
    yy = np.where(ok)[0]
    if not len(yy): return im
    for C in (CL, CR):
        for c in range(3):
            v = np.interp(np.arange(H), yy, C[yy, c]); v = median_filter(v, 9); C[:, c] = gaussian_filter1d(v, 3)
    for y, sg in segs.items():
        a, b = sg[0], sg[-1]; t = np.linspace(0, 1, b - a + 1)[:, None]
        out[y, a:b + 1] = CL[y] * (1 - t) + CR[y] * t
    sm = cv2.GaussianBlur(out, (5, 5), 0)
    out[sp > 0] = sm[sp > 0]
    return np.clip(out, 0, 255).astype(np.uint8)


def pose_len(im, m):
    """Где верх и низ вещи на модели в долях тела по позе (MoveNet): 0 — плечи, 1 — бёдра (тазобедренный сустав), 2 — колени,
    3 — щиколотки. Пользователь: «на фото платье ниже колена, на манекене выше» — длину переносим на манекен по тем же точкам тела,
    без масштаба кадра (кадр часто обрезан, роста модели в кадре нет). → {'top','hem'} или None."""
    try:
        import pose
        kp = pose.keypoints(im)
    except Exception: kp = None
    if not kp: return None
    lv = []
    for a, b in (('sh_l', 'sh_r'), ('hip_l', 'hip_r'), ('kn_l', 'kn_r'), ('an_l', 'an_r')):
        c = [kp[x] for x in (a, b) if kp[x][2] >= 0.3]
        lv.append(np.mean([p[1] for p in c]) if c else None)
    if lv[0] is None or lv[1] is None or lv[1] <= lv[0]: return None
    def s_of(y):
        pts = [(i, v) for i, v in enumerate(lv) if v is not None]
        for (i0, y0), (i1, y1) in zip(pts, pts[1:]):
            if y1 <= y0: return None
            if y <= y1 or (i1, y1) == pts[-1]:
                t = (y - y0) / (y1 - y0)
                if (i1, y1) == pts[-1] and t > 1.4: return None   # ниже последней видной точки далеко — не угадываем
                return i0 + t * (i1 - i0)
        return None
    ys = np.where(m.any(1))[0]
    if not len(ys): return None
    # низ — нижняя строка, где вещь ещё шире трети своей медианной ширины (концы пояса, бахрома не в счёт)
    wid = m.sum(1); med = np.median(wid[ys]); yy = ys[wid[ys] > med * 0.33]
    if not len(yy) or yy[-1] >= m.shape[0] - 3: return None   # низ за краем кадра
    top, hem = s_of(float(yy[0])), s_of(float(yy[-1]))
    if hem is None: return None
    return dict(top=None if top is None else round(float(top), 3), hem=round(float(hem), 3))


def person_scale(im, model_h):
    """См на пиксель по росту модели: человек целиком в кадре на ровном фоне (стена-циклорама, в т.ч. с плавным переходом в пол).
    Фон оценивается по каждой строке отдельно — по краям строки (у циклорамы низ темнее верха). Человек — строки, где середина
    заметно отличается от краёв своей строки. None — если макушка или стопы за краем кадра, или фон пёстрый (улица, интерьер)."""
    if not model_h: return None
    h, w = im.shape[:2]; a = im.astype(np.int16)
    # фон строки — по тому краю кадра, который ровнее (на другом часто надпись: бренд, размерный ряд)
    sides = []
    for S_ in (a[:, :int(w * 0.07)], a[:, int(w * 0.93):]):
        bg_ = np.median(S_, 1); sides.append((np.median(np.abs(S_ - bg_[:, None]).max(2).mean(1)), bg_))
    var, rowbg = min(sides, key=lambda t: t[0])
    if var > 18: return None                                                  # пёстрый фон
    x0, x1 = int(w * 0.2), int(w * 0.8)
    diff = np.abs(a[:, x0:x1] - rowbg[:, None]).max(2) > 40
    cnt = diff.sum(1)
    rows = np.where(cnt > max(4, 0.01 * (x1 - x0)))[0]
    if len(rows) < h * 0.4: return None
    top, bot = rows[0], rows[-1]
    if top < 0.008 * h or bot > 0.996 * h: return None                         # макушка или стопы за краем кадра
    return model_h / float(bot - top)


def garment_len_cm(m, scale):
    ys = np.where(m.any(1))[0]
    return round(float(ys[-1] - ys[0]) * scale, 1) if len(ys) and scale else None


def paint_over_hair(im, m):
    """Волосы модели на плечах и груди поверх однотонной вещи: тёмные куски у верхнего края вещи, далёкие по цвету
    от ткани, — закрасить тканью вокруг. Только у однотонных вещей (у принта тёмные места — рисунок) и только в верхней трети."""
    ys = np.where(m.any(1))[0]
    if len(ys) < 50: return im
    y0, y1 = ys[0], ys[-1]; top = y0 + (y1 - y0) // 3
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    inside = m > 0; core = lab[top:y1][inside[top:y1]]
    if len(core) < 500: return im
    med = np.median(core, 0); spread = np.percentile(np.linalg.norm(core - med, axis=1), 80)
    if spread > 36: return im                                                   # пёстрая ткань — не трогаем
    d = np.linalg.norm(lab - med, axis=2)
    cand = inside & (d > max(30, spread * 1.4)) & (lab[..., 0] < med[0] - 20)   # заметно темнее и другого цвета
    cand[top:] = False
    cand = cv2.morphologyEx(cand.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lb, st, _ = cv2.connectedComponentsWithStats(cand)
    keep = np.zeros_like(cand)
    for k in range(1, n):
        x, y, w_, h_, a = st[k]
        if a >= 80 and y <= y0 + (top - y0) * 0.6: keep[lb == k] = 1           # кусок начинается у верха вещи (волосы падают сверху)
    if not keep.any(): return im
    return cv2.inpaint(im, cv2.dilate(keep, np.ones((7, 7), np.uint8)), 9, cv2.INPAINT_TELEA)
