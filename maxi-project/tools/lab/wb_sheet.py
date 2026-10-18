#!/usr/bin/env python3
"""Обзорные листы: все вещи спереди с баллом, по видам (для быстрого взгляда на весь набор).
python3 wb_sheet.py OUT_PREFIX папка_снимков [...]   → OUT_PREFIX_0.jpg, OUT_PREFIX_1.jpg …"""
import json, os, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
L = {x['id']: x for x in json.load(open(os.path.join(HERE, '../wardrobe/raw/wb_items.json')))}
out = sys.argv[1]; recs = {}
for d in sys.argv[2:]:
    for l in open(os.path.join(d, 'qc.jsonl')):
        if l.strip(): r = json.loads(l); r['d'] = d; recs[r['id']] = r
items = sorted([r for r in recs.values() if r.get('files') and r['id'] in L], key=lambda r: (L[r['id']]['kind'], r['score']))
W, H, cols, per = 150, 215, 11, 66
for part in range(0, len(items), per):
    grp = items[part:part + per]; rows = (len(grp) + cols - 1) // cols
    sh = Image.new('RGB', (cols * W, rows * H), 'white'); dr = ImageDraw.Draw(sh)
    for i, r in enumerate(grp):
        im = Image.open(os.path.join(r['d'], r['files'][0])).convert('RGB'); w, h = im.size
        im = im.crop((int(w * .12), int(h * .06), int(w * .88), int(h * .95))).resize((W, H - 15))
        x, y = (i % cols) * W, (i // cols) * H; sh.paste(im, (x, y + 15))
        dr.text((x + 2, y + 2), f"{r['id'][3:]} {L[r['id']]['kind']} {r['score']}", fill='black')
    sh.save(f'{out}_{part // per}.jpg', quality=82)
print(len(items))
