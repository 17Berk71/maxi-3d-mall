#!/usr/bin/env python3
"""Выбрать снимки (photo_pick) для всех карточек Wildberries → pick.json в папке вещи (кэш). Повторный запуск — только новые."""
import glob, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from photo_pick import pick
from wardrobe_paths import RAW
MAXN = int(os.environ.get('MAXN', 10))
for gp in sorted(glob.glob(os.path.join(RAW, 'wb_*', 'wb_*', 'garment.json'))):
    d = os.path.dirname(gp); out = os.path.join(d, 'pick.json')
    if os.path.exists(out): continue
    g = json.load(open(gp)); kind = g['kind']
    if kind == 'jumpsuit': continue
    p = g['photos']; table = [x for x in (g.get('garment_table_photo'), g.get('size_table_photo')) if x]
    nums = list(range(1, (p.get('count') or 0) + 1))
    # сначала размеченные вручную, потом остальные по порядку; не больше MAXN фото на модели
    first = [n for n in (p.get('studio') or []) + (p.get('front') or []) + (p.get('back') or []) if n in nums]
    order = first + [n for n in nums if n not in first]
    order = [n for n in order if n not in table][:MAXN]
    photos = [os.path.join(d, '%02d.webp' % n) for n in order]
    r = pick(photos, kind, hints=dict(studio=p.get('studio') or [], back=p.get('back') or []), table=())
    # лучший снимок спереди с чужим на корпусе (расстёгнут, кофта под ним), а фото в карточке больше MAXN — смотрим остальные:
    # застёгнутый снимок часто в конце карточки (пуховик Телодвижения: 15–16 из 16)
    rest = [n for n in nums if n not in table and n not in order]
    if r.get('src') == 'model' and rest:
        fr = next((s_ for s_ in r['scores'] if s_.get('path') == r.get('front')), {})
        if (fr.get('cont') or 0) > 0.1:
            r2 = pick(photos + [os.path.join(d, '%02d.webp' % n) for n in rest], kind, hints=dict(studio=p.get('studio') or [], back=p.get('back') or []), table=())
            if r2.get('front'): r = r2
    r['scores'] = [{k: (float(v) if hasattr(v, 'item') else v) for k, v in s.items()} for s in r['scores']]
    json.dump(r, open(out, 'w'), ensure_ascii=False, indent=1)
    print(g['nm'], kind, r['src'], os.path.basename(r.get('front') or '-'), os.path.basename(r.get('back') or '-'), flush=True)
