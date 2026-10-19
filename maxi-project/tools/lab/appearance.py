#!/usr/bin/env python3
"""Проверка внешнего вида: вещь на манекене против фото магазина (дополняет автопроверку расчёта qc.js).

Автопроверка в браузере меряет физику (растяжение, швы, размеры) и не видит, похожа ли вещь: с чужой текстурой и правильными
размерами она ставила 90. Здесь сравниваются снимок манекена (batch.mjs: <id>_0.jpg спереди, <id>_3.14.jpg сзади и маски
<id>_<угол>_m.png — вещь белая, остальное чёрное) с вырезанным фото вещи (фабрика: out/<id>/front_cut.webp, back_cut.webp).

Пункты (штраф плавный, как в qc.js):
  цвет       — разница основного цвета вещи (ΔE по Lab, медианы);
  фактура    — сколько мелкой фактуры (рельеф, вязка, принт) на манекене против фото: пропала или добавилась лишняя;
  рисунок    — раскладка цвета по сетке 6×8 (без общего сдвига цвета): уехавший или пропавший рисунок, чужие пятна;
  силуэт     — длина к ширине корпуса (у студийного фото лёжа ширина больше видимой на фигуре);
  исходник   — насколько вещь на фото закрыта: кожа (руки) и чужая одежда внутри рамки вещи, обрезана кадром;
  детали     — детали из характеристик карточки (воротник, капюшон, мех…), которых нет у вещи (wb_details.py).
Итог «похожесть» = 100 − штрафы; общий балл = меньшее из расчёта и похожести.

python3 appearance.py ПАПКА_СНИМКОВ [...]   → <папка>/look.jsonl (по строке на вещь)
"""
import json, os, sys, glob
import numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '../wardrobe/out')
RAW = os.path.join(HERE, '../wardrobe/raw')
sys.path.insert(0, os.path.join(HERE, '../wardrobe'))
GW, GH = 96, 128


def ramp(v, a, b): return 0.0 if v <= a else 1.0 if v >= b else (v - a) / (b - a)


def lab_of(bgr):
    return cv2.cvtColor(bgr.astype(np.float32) / 255.0, cv2.COLOR_BGR2LAB)   # L 0..100, a/b ±


def crop(img, m):
    ys, xs = np.where(m)
    if len(ys) < 200: return None, None
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return img[y0:y1, x0:x1], m[y0:y1, x0:x1]


def photo_side(id_, side):
    p = os.path.join(OUT, id_, side + '_cut.webp')
    if not os.path.exists(p): return None, None
    im = cv2.imread(p, cv2.IMREAD_UNCHANGED)
    if im is None: return None, None
    if im.ndim == 3 and im.shape[2] == 4: return crop(im[..., :3], im[..., 3] > 128)
    # у низа вырез без прозрачности (вещь на белом) — маска сетью ISNet, как у студийного фото
    from cutout import isnet_mask, studio_mask_color
    m = isnet_mask(im)
    if m is None or not (0.02 < m.mean() < 0.95): m = studio_mask_color(im)
    return crop(im, m > 0)


def render_side(d, id_, v):
    f = os.path.join(d, f'{id_}_{v}.jpg'); fm = os.path.join(d, f'{id_}_{v}_m.png')
    if not (os.path.exists(f) and os.path.exists(fm)): return None, None
    im = cv2.imread(f); m = cv2.imread(fm, cv2.IMREAD_GRAYSCALE)
    if im is None or m is None or im.shape[:2] != m.shape[:2]: return None, None
    m = cv2.erode((m > 128).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0     # край маски — смесь с фоном
    return crop(im, m)


def torso_ratio(m):
    """длина вещи к ширине корпуса (отрезок строки через середину, 35–65% высоты): рукава не в счёт.
    Щель посередине (вещь нараспашку, видно манекен) закрываем — иначе «корпус» был одной полочкой."""
    h, w = m.shape; cx = w // 2; ws = []
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((1, max(3, int(w * 0.3))), np.uint8)) > 0
    for y in range(int(h * 0.35), int(h * 0.65)):
        row = m[y]
        if not row[cx]:
            xs = np.where(row)[0]
            if not len(xs): continue
            cx2 = xs[np.argmin(np.abs(xs - cx))]
        else: cx2 = cx
        l = cx2
        while l > 0 and row[l - 1]: l -= 1
        r = cx2
        while r < w - 1 and row[r + 1]: r += 1
        ws.append(r - l + 1)
    return h / max(1, np.median(ws)) if ws else None


def compare(P, Pm, Rr, Rm, flat):
    out = {}
    lp, lr = lab_of(P), lab_of(Rr)
    cp, cr = np.median(lp[Pm], 0), np.median(lr[Rm], 0)
    out['dE'] = float(np.linalg.norm(cp - cr)); out['col_p'] = [round(float(x), 1) for x in cp]; out['col_r'] = [round(float(x), 1) for x in cr]
    # фактура: энергия мелких деталей яркости внутри маски (обе картинки в одном масштабе — по ширине вещи 160 px)
    def detail(img, m):
        k = 160 / img.shape[1]; g = cv2.resize(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32), None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
        mm = cv2.resize(m.astype(np.uint8), (g.shape[1], g.shape[0]), interpolation=cv2.INTER_NEAREST)
        mm = cv2.erode(mm, np.ones((7, 7), np.uint8)) > 0
        hp = g - cv2.GaussianBlur(g, (0, 0), 2.0)
        return float(hp[mm].std()) if mm.sum() > 100 else None
    dp, dr = detail(P, Pm), detail(Rr, Rm)
    if dp is not None and dr is not None: out['detail'] = round((dr + 1.5) / (dp + 1.5), 2)
    # пятна и блики среднего размера (полоса σ 3–8 px при ширине 160): «мятый пакет», лишний блеск, кольчуга вместо вязки
    def band(img, m):
        k = 160 / img.shape[1]; g = cv2.resize(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32), None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
        mm = cv2.erode(cv2.resize(m.astype(np.uint8), (g.shape[1], g.shape[0]), interpolation=cv2.INTER_NEAREST), np.ones((9, 9), np.uint8)) > 0
        b = cv2.GaussianBlur(g, (0, 0), 3) - cv2.GaussianBlur(g, (0, 0), 8)
        return float(b[mm].std()) if mm.sum() > 100 else None
    bp, br = band(P, Pm), band(Rr, Rm)
    if bp is not None and br is not None: out['mid'] = round((br + 3) / (bp + 3), 2)
    # дырки на снимке: фон сквозь вещь внутри её контура (дыры у плеч, разошедшиеся швы)
    mm = cv2.copyMakeBorder(Rm.astype(np.uint8), 2, 2, 2, 2, cv2.BORDER_CONSTANT, value=0); ff = mm.copy(); cv2.floodFill(ff, None, (0, 0), 1)   # снаружи и всё, что связано с краем через не-вещь (манекен в том числе)
    hole = (ff == 0); hole = cv2.morphologyEx(hole.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0; out['holes'] = round(float(hole.sum() / max(1, mm.sum())), 4)
    # рисунок: сетка по рамке вещи, в каждой клетке — медиана Lab минус общий цвет своей картинки
    def grid(img, m):
        s = cv2.resize(lab_of(img), (GW, GH), interpolation=cv2.INTER_AREA); mm = cv2.resize(m.astype(np.uint8), (GW, GH), interpolation=cv2.INTER_NEAREST) > 0
        g0 = np.median(s[mm], 0); cells = {}
        for gy in range(8):
            for gx in range(6):
                sl = (slice(gy * GH // 8, (gy + 1) * GH // 8), slice(gx * GW // 6, (gx + 1) * GW // 6))
                c = mm[sl]
                if c.mean() > 0.6: cells[(gy, gx)] = np.median(s[sl][c], 0) - g0
        return cells, mm
    gp, mp_ = grid(P, Pm); gr, mr = grid(Rr, Rm)
    com = [k for k in gp if k in gr]
    if len(com) >= 6:
        d = np.array([np.linalg.norm(gp[k] - gr[k]) for k in com]); out['layout'] = round(float(np.mean(d)), 1); out['layout_max'] = round(float(np.percentile(d, 90)), 1)
        # что видно на фото, но не на манекене: насколько «пёстрое» фото и манекен (разброс клеток)
        out['var_p'] = round(float(np.mean([np.linalg.norm(gp[k]) for k in com])), 1); out['var_r'] = round(float(np.mean([np.linalg.norm(gr[k]) for k in com])), 1)
    out['iou'] = round(float((mp_ & mr).sum() / max(1, (mp_ | mr).sum())), 2)
    tp, tr = torso_ratio(Pm), torso_ratio(Rm)
    if tp and tr: out['ratio'] = round(float(tr / (tp / (0.78 if flat else 1.0))), 2)   # лёжа видимая ширина больше, чем на фигуре
    return out


def source_quality(id_, item):
    """насколько закрыта вещь на выбранном фото спереди (pick.json: кожа и чужая одежда в рамке вещи, обрезка кадром)."""
    q = {}
    pk = glob.glob(os.path.join(RAW, 'wb_*', 'wb_' + id_[3:], 'pick.json'))
    if pk:
        r = json.load(open(pk[0])); fr = os.path.basename(r.get('front') or '')
        s = next((x for x in r.get('scores', []) if os.path.basename(x.get('path', '')) == fr), None)
        if s and r.get('src') == 'model':
            q['skin'] = s.get('skin'); q['other'] = s.get('other'); q['cut'] = s.get('cut', '')
    mp = os.path.join(OUT, id_, 'meta.json')
    if os.path.exists(mp):
        mt = json.load(open(mp))
        if mt.get('occ') is not None: q['arms'] = mt['occ']   # руки поверх вещи по позе (pose.py) на выбранном фото
    # кожа, оставшаяся в вырезе после закраски (кисти, пальцы поверх ткани)
    p = os.path.join(OUT, id_, 'front_cut.webp'); im = cv2.imread(p, cv2.IMREAD_UNCHANGED) if os.path.exists(p) else None
    if im is not None and im.shape[2] == 4:
        m = im[..., 3] > 128; ycc = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2YCrCb)
        sk = (ycc[..., 1] > 137) & (ycc[..., 1] < 173) & (ycc[..., 2] > 77) & (ycc[..., 2] < 127) & (ycc[..., 0] > 60) & m
        q['skin_left'] = round(float(sk.sum() / max(1, m.sum())), 3)
    return q


def score(f, src, q, det):
    pens = {}
    if 'dE' in f: pens['цвет'] = 25 * ramp(f['dE'], 6, 22)
    # средняя полоса: надетая вещь в складках, а вещь на студийном фото лежит ровно — на манекене складок больше и это нормально (×1.6)
    tx = max(abs(np.log2(max(f.get('detail', 1), 0.05))), abs(np.log2(max(f.get('mid', 1), 0.05) / (1.6 if src in ('studio', 'photo') else 1.0))))
    pens['фактура'] = 20 * ramp(tx, 0.3, 1.3)
    if 'holes' in f: pens['дырки'] = 20 * ramp(f['holes'], 0.002, 0.02)
    if 'layout' in f: pens['рисунок'] = 25 * ramp(f['layout'], 5, 16)
    if 'ratio' in f: pens['силуэт'] = 15 * ramp(abs(np.log(max(f['ratio'], 0.05))), 0.15, 0.5)
    occ = 0.0
    if src == 'model':
        occ = max((q.get('skin') or 0) * 1.5, (q.get('skin_left') or 0) * 1.5, (q.get('arms') or 0) * 1.2) + min(1, q.get('other') or 0) * 0.3 + (0.1 if 'b' in (q.get('cut') or '') or 't' in (q.get('cut') or '') else 0)
    else: occ = (q.get('skin_left') or 0) * 1.5
    pens['исходник'] = 20 * ramp(occ, 0.04, 0.25)
    if det is not None: pens['детали'] = min(40, sum(20 if x in ('стёжка', 'мех', 'капюшон', 'отложной воротник') else 10 for x in det))   # главные детали вида весят вдвое
    return max(0, round(100 - sum(pens.values()))), {k: round(v, 1) for k, v in pens.items()}, round(occ, 3)


def main():
    L = {x['id']: x for x in json.load(open(os.path.join(RAW, 'wb_items.json')))}
    try:
        import wb_details
        DET = wb_details.missing_all(L)
    except Exception as e:
        print('детали из карточек недоступны:', e); DET = {}
    for d in sys.argv[1:]:
        recs = {}
        for l in open(os.path.join(d, 'qc.jsonl')):
            if l.strip(): r = json.loads(l); recs[r['id']] = r
        out = open(os.path.join(d, 'look.jsonl'), 'w'); n = 0
        for id_, r in recs.items():
            if id_ not in L or not r.get('files'): continue
            it = L[id_]; src = it.get('src') or it.get('how'); flat = src in ('studio', 'photo'); res = {'id': id_, 'views': {}}
            for side, v in (('front', '0'), ('back', '3.14')):
                P, Pm = photo_side(id_, side); Rr, Rm = render_side(d, id_, v)
                if P is None or Rr is None: continue
                res['views'][side] = compare(P, Pm, Rr, Rm, flat)
            if not res['views']: continue
            f = res['views'].get('front') or next(iter(res['views'].values()))
            # сзади — только цвет и рисунок (у фото на модели спинка часто та же картинка)
            b = res['views'].get('back')
            if b and 'layout' in b and 'layout' in f: f = dict(f, layout=round((f['layout'] * 2 + b['layout']) / 3, 1))
            q = source_quality(id_, it); det = DET.get(id_)
            res['look'], res['pens'], res['occ'] = score(f, src, q, det); res['src_q'] = q
            if det is not None: res['missing'] = det
            res['phys'] = r.get('score'); res['final'] = min(res['look'], r['score']) if r.get('score') is not None else res['look']
            # на ручную проверку: плохой исходник, низкая похожесть или сложный крой
            nm = it['name'].lower(); why = []
            if res['occ'] >= 0.12: why.append('вещь на фото закрыта (руки, другая одежда)')
            if res['look'] < 70: why.append('мало похожа на фото')
            if any(w in nm for w in ('запах', 'асимметр', 'драпир', 'корсет', 'баска')): why.append('сложный крой')
            if why: res['review'] = why
            out.write(json.dumps(res, ensure_ascii=False) + '\n'); n += 1
        out.close(); print(d, n, 'вещей')


if __name__ == '__main__':
    main()
