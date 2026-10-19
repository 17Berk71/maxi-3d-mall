#!/usr/bin/env python3
"""Пересчитать по готовым вырезам out/<id>/*_cut.webp без пересборки фото: строчки стёжки (drape_cut.find_quilt) и вырез спереди (find_neck)."""
import json, os, sys, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drape_cut import find_quilt, find_neck
from wardrobe_paths import OUT
n = 0
for d in sorted(os.listdir(OUT)):
    p = os.path.join(OUT, d, 'meta.json')
    if not os.path.exists(p): continue
    m = json.load(open(p))
    k = m.get('kind')
    fr = (m.get('drape') or {}).get('front'); imf = cv2.imread(os.path.join(OUT, d, 'front_cut.webp'), cv2.IMREAD_UNCHANGED)
    if fr and imf is not None and imf.shape[2] == 4 and fr['a'].get('hw') and k in ('tee', 'shirt', 'sweater', 'dress', 'vest', 'jacket', 'coat', 'hoodie', 'puffer'):
        nk = find_neck(imf[..., 3] > 128, fr['a']['cx'], fr['a']['hw'])
        if nk: fr['a']['neck'] = {kk: float(v) for kk, v in nk.items()}
        else: fr['a'].pop('neck', None)
    if k not in ('puffer', 'vest', 'jacket', 'coat'): json.dump(m, open(p, 'w'), ensure_ascii=False, indent=1); continue
    for side in ('front', 'back'):
        dr = (m.get('drape') or {}).get(side)
        im = cv2.imread(os.path.join(OUT, d, side + '_cut.webp'), cv2.IMREAD_UNCHANGED)
        if not dr or im is None or im.shape[2] < 4: continue
        q = find_quilt(im[..., :3], im[..., 3] > 128, dr['a']['cx'])
        if q: dr['a']['quilt'] = q
        else: dr['a'].pop('quilt', None)
    json.dump(m, open(p, 'w'), ensure_ascii=False, indent=1); n += 1
idx = [json.load(open(os.path.join(OUT, d, 'meta.json'))) for d in sorted(os.listdir(OUT)) if os.path.exists(os.path.join(OUT, d, 'meta.json'))]
json.dump(idx, open(os.path.join(OUT, 'index.json'), 'w'), ensure_ascii=False, indent=1)
print('пересчитано', n)
