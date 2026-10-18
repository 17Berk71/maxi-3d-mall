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
    if kind in TOPS and kind != 'dress' and ms['full'].sum() > 0.5 * max(1, ms['upper'].sum()):
        m = ms['upper'] | ms['full']
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
        cx = w // 2; yu = np.where(m[:, cx - 40:cx + 40].any(1))[0]; yl = np.where(ms['lower'][:, cx - 60:cx + 60].any(1))[0]
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
    return im, m
