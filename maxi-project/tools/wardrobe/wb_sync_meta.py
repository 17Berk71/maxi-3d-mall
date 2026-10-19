#!/usr/bin/env python3
"""Перенести в собранные вещи (out/<id>/meta.json) поля из raw/wb_items.json, которые не требуют пересборки фото:
мерки по размерам, флаги кроя (без рукавов, стёганый, состояния), рост модели не нужен (он уже в длине). Быстро, без сети вырезания."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wardrobe_paths import RAW, OUT
FLAGS = ('sleeveless', 'puffer', 'pleats', 'puff', 'stand', 'collar', 'hood', 'zip', 'lining')
n = 0
for it in json.load(open(os.path.join(RAW, 'wb_items.json'))):
    p = os.path.join(OUT, it['id'], 'meta.json')
    if not os.path.exists(p): continue
    m = json.load(open(p)); old = json.dumps(m, sort_keys=True)
    if it.get('sizes'): m['sizes'] = it['sizes']
    for f in FLAGS:
        if it.get(f): m[f] = it[f]
    if it.get('states'): m['states'] = it['states']
    card = {k[5:]: v for k, v in it.items() if k.startswith('card_')}
    if card: m['card'] = card   # детали и ткань из характеристик карточки (wb_details.py)
    for k in ('crop', 'elastic'):
        if it.get(k): m['shape'][k] = it[k]
    if json.dumps(m, sort_keys=True) != old: json.dump(m, open(p, 'w'), ensure_ascii=False, indent=1); n += 1
idx = [json.load(open(os.path.join(OUT, d, 'meta.json'))) for d in sorted(os.listdir(OUT)) if os.path.exists(os.path.join(OUT, d, 'meta.json'))]
json.dump(idx, open(os.path.join(OUT, 'index.json'), 'w'), ensure_ascii=False, indent=1)
print('обновлено', n)
