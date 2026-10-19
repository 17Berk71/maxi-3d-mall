#!/usr/bin/env python3
"""Карточки, где выбранный снимок спереди «с чужим» (cont > 0.1), а фото в карточке больше просмотренных, — выбрать заново (pick_all)."""
import glob, json, os
n = 0
for f in glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'raw', 'wb_*', 'wb_*', 'pick.json')):
    r = json.load(open(f)); g = json.load(open(f.replace('pick.json', 'garment.json')))
    fr = next((s for s in r['scores'] if s.get('path') == r.get('front')), {})
    if r.get('src') == 'model' and (fr.get('cont') or 0) > 0.1 and (g['photos'].get('count') or 0) > len(r['scores']):
        os.rename(f, f.replace('pick.json', 'pick_old.json')); n += 1; print(os.path.basename(os.path.dirname(f)))
print('к пересмотру:', n)
