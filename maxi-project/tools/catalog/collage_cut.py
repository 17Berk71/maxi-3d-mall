"""Вырезка вещи для холста-коллажа (PLAN, этап 2; PRD, принцип 1 — правдоподобие).

python3 tools/catalog/collage_cut.py ПАПКА_КАРТОЧКИ ВИД ВЫХОД [--id wb-123]

ПАПКА_КАРТОЧКИ — фото карточки 01.webp, 02.webp… (как в tools/wardrobe/raw/wb_*/).
Пишет в ВЫХОД: <id>_f.webp и <id>_b.webp (RGBA, не выше 800 px), <id>_t.webp (миниатюра 240 px)
и <id>.json (что взято, оценки, флаги, итог: ok / review / reject).

Отличие от фабрики под манекен: ничего не дорисовываем. Кожа, волосы, кисти, чужая одежда в середине
расстёгнутой вещи уходят в прозрачность, а не закрашиваются «тканью вокруг». Если после этого вещь выглядит
дырявой или её мало видно — она не годится (reject или review), и решает человек.
"""
import json, os, sys, glob
import numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'wardrobe'))
sys.path.insert(0, HERE)

MAXH, THUMB = 800, 240
TOP_KINDS = {'tee', 'longsleeve', 'tank', 'polo', 'top', 'blouse', 'shirt', 'hoodie', 'sweatshirt', 'cardigan', 'sweater',
             'jacket', 'coat', 'puffer', 'raincoat', 'blazer', 'vest', 'dress', 'jumpsuit'}
OPENABLE = {'coat', 'jacket', 'puffer', 'raincoat', 'blazer', 'vest', 'cardigan', 'hoodie', 'shirt'}
# ключи каталога → ключи фабрики (её сеть и выбор снимков знают только эти виды)
TO_FACTORY = {'longsleeve': 'tee', 'tank': 'tee', 'polo': 'tee', 'top': 'tee', 'blouse': 'shirt', 'sweatshirt': 'sweater',
              'cardigan': 'sweater', 'raincoat': 'coat', 'blazer': 'jacket', 'leggings': 'pants', 'jumpsuit': 'dress'}
NOT_CLOTH = {'sneakers', 'boots', 'high_boots', 'sandals', 'shoes', 'bag', 'backpack', 'shopper', 'hat', 'scarf', 'belt', 'gloves', 'glasses'}


def photos_of(folder):
    fs = sorted(glob.glob(os.path.join(folder, '[0-9][0-9].webp')) + glob.glob(os.path.join(folder, '[0-9][0-9].jpg')))
    return fs


def _largest(m):
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8))
    if n <= 1: return m.astype(np.uint8)
    return (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)


def edge_touch(m):
    """Какие края кадра задевает вещь (доля длины края, где маска касается): вещь обрезана кадром."""
    h, w = m.shape
    return {'top': float(m[0].mean()), 'bottom': float(m[-1].mean()), 'left': float(m[:, 0].mean()), 'right': float(m[:, -1].mean())}


def light_rim(im, m):
    """Доля края вещи (полоса 6 px внутри маски), которая заметно светлее и бесцветнее ткани — ореол фона, остатки
    белых полей, светлое пятно у горловины."""
    if m.sum() < 2000: return 0.0
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    core = cv2.erode(m, np.ones((15, 15), np.uint8)) > 0
    if core.sum() < 500: return 0.0
    ref = np.median(lab[core], 0)
    band = (m > 0) & ~(cv2.erode(m, np.ones((13, 13), np.uint8)) > 0)
    L, a, b = lab[..., 0], lab[..., 1] - 128, lab[..., 2] - 128
    pale = band & (L > max(ref[0] + 25, 200)) & (np.hypot(a, b) < 10)
    return float(pale.sum() / max(1, band.sum()))


def to_rgba(im, m, feather=1):
    m = m.astype(np.uint8)
    a = (m * 255).astype(np.uint8)
    if feather:
        a = cv2.GaussianBlur(a, (0, 0), feather)
        a[cv2.erode(m, np.ones((3, 3), np.uint8)) > 0] = 255
    ys, xs = np.where(m > 0)
    pad = 6
    y0, y1 = max(0, ys.min() - pad), min(m.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(m.shape[1], xs.max() + pad + 1)
    rgba = np.dstack([im[y0:y1, x0:x1], a[y0:y1, x0:x1]])
    h = rgba.shape[0]
    if h > MAXH:
        k = MAXH / h
        rgba = cv2.resize(rgba, (max(1, int(rgba.shape[1] * k)), MAXH), interpolation=cv2.INTER_AREA)
    return rgba


def write_webp(path, rgba, q=82):
    cv2.imwrite(path, rgba, [cv2.IMWRITE_WEBP_QUALITY, q])
    return os.path.getsize(path)


def cut_studio(path):
    """Студийный снимок или вещь отдельно с рекламной картинки: маска ISNet/по прозрачности, как у фабрики."""
    from photo_io import studio_load
    im, m = studio_load(path)
    return im, _largest(m), {}


def cut_model(path, kind):
    """Снимок на человеке: маска сети одежды (как у фабрики, но без дорисовки), потом убираем в прозрачность
    кожу, волосы, руки поверх вещи и середину расстёгнутой вещи."""
    import model_photo, pose, contam
    fk = TO_FACTORY.get(kind, kind)
    im, m = model_photo.load_model_photo(path, fk, paint=False)
    info = {}
    try: kp = pose.keypoints(im)
    except Exception: kp = None
    m = m.copy()
    removed = np.zeros_like(m)
    if kp:
        occ, om = pose.occlusion(m, kp, im.shape)
        info['occ'] = None if occ is None else round(float(occ), 3)
        # руки в рукавах — это и есть рукава вещи: по позе ничего не вырезаем, доля закрытого корпуса — только для оценки
        if kind in OPENABLE or fk in OPENABLE:
            sp, _ = contam.inner_span(im, m, kp)
            if sp is not None:
                info['open'] = True
                removed |= (sp.astype(np.uint8) & m)
        info['cont'] = None if contam.contamination(im, m, kp) is None else round(float(contam.contamination(im, m, kp)), 3)
        tx = contam.text_mask(im, m)
        info['text'] = bool(tx is not None and tx.sum() > 200)
    sk = model_photo.skin_mask(im, m)
    if sk is not None: removed |= (sk & m)
    hm = model_photo.hair_mask(im, m)
    if hm is not None: removed |= (hm & m)
    base = int(m.sum())
    m = (m & (1 - removed)).astype(np.uint8)
    # края после удаления кожи и волос рваные: сгладить (открытие убирает «бахрому», закрытие — мелкие щели)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    m = _largest(m)
    info['removed'] = round(float(removed.sum() / max(1, base)), 3)
    return im, m, info


def verdict(src, kind, info, m, im):
    """Итог: ok — можно на холст без вопросов; review — показать человеку; reject — не берём."""
    why = []
    h, w = m.shape
    area = m.sum() / (h * w)
    et = edge_touch(m)
    if area < 0.04: why.append(('reject', 'вещь мелкая на снимке (%.0f%% кадра)' % (area * 100)))
    cut_side = max(et['left'], et['right'])
    if et['top'] > 0.04 and kind not in ('dress', 'jumpsuit') and src == 'model': why.append(('review', 'верх вещи у края кадра'))
    if et['bottom'] > 0.05: why.append(('reject' if et['bottom'] > 0.2 else 'review', 'низ вещи обрезан кадром'))
    if cut_side > 0.05: why.append(('reject' if cut_side > 0.2 else 'review', 'бок вещи обрезан кадром'))
    if info.get('occ') is not None and info['occ'] > 0.12: why.append(('reject' if info['occ'] > 0.3 else 'review', 'вещь закрыта руками (%.0f%%)' % (info['occ'] * 100)))
    if info.get('removed', 0) > 0.06: why.append(('reject' if info['removed'] > 0.18 else 'review', 'вырезано много чужого (%.0f%%): кожа, волосы, руки, одежда под вещью' % (info['removed'] * 100)))
    if info.get('open'): why.append(('review', 'вещь расстёгнута на снимке, середина прозрачная'))
    if info.get('cont') is not None and info['cont'] > 0.12: why.append(('review', 'на корпусе есть чужое (%.0f%%)' % (info['cont'] * 100)))
    if info.get('text'): why.append(('review', 'на снимке надпись поверх вещи'))
    rim = light_rim(im, m)
    info['rim'] = round(rim, 3)
    if rim > 0.08: why.append(('review', 'светлый ореол или пятна по краю (%.0f%%)' % (rim * 100)))
    if src == 'model': why.append(('review', 'снимок на человеке: проверить глазами'))
    level = 'reject' if any(l == 'reject' for l, _ in why) else 'review' if why else 'ok'
    return level, [t for _, t in why]


def run(folder, kind, out, iid=None):
    from photo_pick import pick
    iid = iid or 'wb-' + os.path.basename(os.path.normpath(folder)).split('_')[-1]
    os.makedirs(out, exist_ok=True)
    res = {'id': iid, 'kind': kind, 'folder': folder}
    if kind in NOT_CLOTH:
        res.update(level='review', why=['обувь, сумки и аксессуары: вырезание ещё не сделано'], src=None)
        json.dump(res, open(os.path.join(out, iid + '.json'), 'w'), ensure_ascii=False, indent=1)
        return res
    ph = photos_of(folder)
    pk_path = os.path.join(folder, 'pick.json')
    pk = json.load(open(pk_path)) if os.path.isfile(pk_path) else None
    if not pk or not pk.get('src'):
        pk = pick(ph, TO_FACTORY.get(kind, kind))
    res['src'] = pk.get('src')
    if not pk.get('src'):
        res.update(level='reject', why=['нет подходящего снимка: ни студийного, ни на человеке целиком'])
        json.dump(res, open(os.path.join(out, iid + '.json'), 'w'), ensure_ascii=False, indent=1)
        return res
    sides = {}
    for side in ('front', 'back'):
        p = pk.get(side)
        if not p or (side == 'back' and p == pk.get('front')):
            continue
        if not os.path.isabs(p) and not os.path.exists(p): p = os.path.join(folder, os.path.basename(p))
        im, m, info = (cut_studio(p) if pk['src'] == 'studio' else cut_model(p, kind))
        lvl, why = verdict(pk['src'], kind, info, m, im)
        rgba = to_rgba(im, m)
        fn = '%s_%s.webp' % (iid, side[0])
        size = write_webp(os.path.join(out, fn), rgba)
        sides[side] = dict(file=fn, photo=os.path.basename(p), w=int(rgba.shape[1]), h=int(rgba.shape[0]), kb=round(size / 1000), level=lvl, why=why, info=info)
        if side == 'front':
            t = rgba.copy(); k = THUMB / max(t.shape[:2])
            t = cv2.resize(t, (max(1, int(t.shape[1] * k)), max(1, int(t.shape[0] * k))), interpolation=cv2.INTER_AREA)
            write_webp(os.path.join(out, iid + '_t.webp'), t, 80)
    res['sides'] = sides
    f = sides.get('front')
    if not f:
        res.update(level='reject', why=['не получилась вырезка спереди'])
    else:
        res['level'], res['why'] = f['level'], f['why']
        b = sides.get('back')
        if b and b['level'] == 'reject':
            res['why'] = res['why'] + ['спинка не годится — поворота не будет']
            os.remove(os.path.join(out, b['file'])); del sides['back']
    json.dump(res, open(os.path.join(out, iid + '.json'), 'w'), ensure_ascii=False, indent=1)
    return res


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    iid = next((x.split('=', 1)[1] for x in sys.argv[1:] if x.startswith('--id=')), None)
    r = run(a[0], a[1], a[2], iid)
    print(json.dumps({k: r.get(k) for k in ('id', 'src', 'level', 'why')}, ensure_ascii=False))
