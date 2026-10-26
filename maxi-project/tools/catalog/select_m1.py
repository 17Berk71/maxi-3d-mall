"""Отбор списка вещей М1 (PLAN, этап 1, п. 4): по 10–14 вещей на бренд из кандидатов (work/briefs.json).

python3 tools/catalog/select_m1.py work/briefs.json work/m1.json [work/m1.html]

Правила отбора:
- только взрослые вещи (у карточки нет «Детский»), не бельё, не носки, не украшения;
- осень–зима: летние вещи (сезон «лето», шорты, сарафаны, сандалии) — нет;
- у карточки есть описание и не меньше 4 фото;
- в каждом бренде: верхняя одежда, верх, низ; платье — у женских брендов; обувь и сумки, если бренд их продаёт;
- мужское — у брендов, у которых оно есть (не меньше трети списка);
- вещи из уже собранных карточек (tools/wardrobe/raw) — в приоритете: по ним есть мерки и прошлые вырезки.
"""
import json, os, sys, glob, re, html
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from taxonomy import kind_of, group_of, color_of, KINDS, COLORS

BRANDS = {'befree': 'befree', 'zarina': 'Zarina', "colin's": "Colin's", 'tom tailor': 'Tom Tailor', 'zolla': 'Zolla',
          'love republic': 'Love Republic', 'gloria jeans': 'Gloria Jeans', "o'stin": 'Ostin'}
SKIP_SUBJ = re.compile(r'бель|трус|бюстгальт|носк|колгот|купальн|пижам|халат|ночн|колье|серьг|браслет|кольц|брош|чехл|заколк|резинк|маск', re.I)
SUMMER = re.compile(r'лет|пляж', re.I)
SUMMER_NAME = re.compile(r'летн|льнян|сарафан|выпускн|коротк\w* рукав|пляж', re.I)
SKIP_NAME = re.compile(r'больш\w* размер|детск|школьн|talking tom', re.I)
SUMMER_KINDS = {'shorts', 'sandals', 'tank'}
# сколько брать в группе: (женские, мужские)
PLAN = {'outer': (2, 1), 'top': (2, 1), 'bottom': (2, 1), 'full': (1, 0), 'shoes': (1, 0), 'bag': (1, 0)}
MAX_PER_BRAND = 14


def raw_ids():
    here = os.path.dirname(os.path.abspath(__file__))
    return {int(os.path.basename(p).split('_')[1]) for p in glob.glob(os.path.join(here, '../wardrobe/raw/wb_2026-10-18*/wb_*'))}


def sex_of(kinds):
    k = ' '.join(kinds or []).lower()
    if 'детск' in k or 'мальчик' in k or 'девоч' in k: return None
    m, f = 'мужск' in k, 'женск' in k
    return 'u' if (m and f) else 'm' if m else 'f' if f else 'u'


def candidates(briefs):
    have = raw_ids(); out = []
    for b in briefs:
        if 'error' in b: continue
        br = BRANDS.get((b.get('brand') or '').lower())
        if not br: continue
        if SKIP_SUBJ.search((b.get('subj') or '') + ' ' + (b.get('name') or '')): continue
        sex = sex_of(b.get('kinds'))
        if not sex: continue
        k = kind_of(b.get('subj') or '', b.get('name') or '')
        if not k: continue
        if k in SUMMER_KINDS or SUMMER.search(b.get('season') or '') and 'демисез' not in (b.get('season') or '').lower(): continue
        if not b.get('desc') or (b.get('pics') or 0) < 4: continue
        if SUMMER_NAME.search(b.get('name') or '') or SKIP_NAME.search(b.get('name') or ''): continue
        col = color_of(b.get('color') or '')
        out.append(dict(nm=b['nm'], brand=br, name=b.get('name'), subj=b.get('subj'), kind=k, group=group_of(k), sex=sex, color=col,
                        color_name=b.get('color'), season=b.get('season'), pics=b.get('pics'), table=b.get('table'), base=b.get('base'),
                        known=b['nm'] in have))
    return out


def select(cands):
    by = defaultdict(list)
    for c in cands: by[c['brand']].append(c)
    res = {}
    for br, cs in by.items():
        seen, uniq = set(), []
        for c in sorted(cs, key=lambda c: (not c['known'], not c['table'], -(c['pics'] or 0))):
            key = (c['name'] or '').lower().strip()
            if key in seen: continue
            seen.add(key); uniq.append(c)
        cs = uniq
        has_m = sum(1 for c in cs if c['sex'] == 'm') >= 3
        # приоритет: уже собранные, есть таблица размеров, больше фото
        cs.sort(key=lambda c: (not c['known'], not c['table'], -(c['pics'] or 0)))
        pick, used_kinds = [], set()
        for g, (nf, nm_) in PLAN.items():
            for sex, n in (('f', nf), ('m', nm_ if has_m else 0)):
                pool = [c for c in cs if c['group'] == g and c['sex'] in (sex, 'u') and c not in pick]
                # разнообразие: сначала виды, которых в бренде ещё нет
                pool.sort(key=lambda c: (c['kind'] in used_kinds,))
                for c in pool[:n]:
                    pick.append(c); used_kinds.add(c['kind'])
        # добрать до 12 тем, чего меньше всего, без повторов вида
        # добираем по одной: из группы, которой в списке меньше всего, вид — новый для бренда
        while len(pick) < 12:
            # обувь, сумки и аксессуары добором не берём: их хватает по плану, иначе у бренда три сумки
            rest = [c for c in cs if c not in pick and c['group'] not in ('bag', 'shoes', 'acc')]
            if not rest: break
            gc = defaultdict(int)
            for c in pick: gc[c['group']] += 1
            rest.sort(key=lambda c: (gc[c['group']] >= 3, c['kind'] in used_kinds, gc[c['group']], not c['known'], not c['table']))
            pick.append(rest[0]); used_kinds.add(rest[0]['kind'])
        res[br] = pick[:MAX_PER_BRAND]
    return res


def report_html(sel, path):
    rows = []; n = 0
    for br, items in sel.items():
        cards = []
        for c in items:
            n += 1
            img = (c['base'] or '') + '/images/c246x328/1.webp'
            cards.append('<figure><span class="n">%d</span><img loading="lazy" src="%s" alt=""><figcaption><b>%s</b> · %s%s<br>%s<br><small>%s · %s · <a href="https://www.wildberries.ru/catalog/%d/detail.aspx" target="_blank">карточка</a>%s</small></figcaption></figure>' % (
                n, html.escape(img), html.escape(KINDS[c['kind']][0]), {'f': 'женское', 'm': 'мужское', 'u': 'унисекс'}[c['sex']],
                '' if not c['color'] else ' · ' + COLORS[c['color']][0], html.escape(c['name'] or ''), html.escape(c['subj'] or ''), html.escape(c['season'] or 'сезон не указан'),
                c['nm'], ' · уже собрана' if c['known'] else ''))
        rows.append('<h2>%s — %d</h2><div class="g">%s</div>' % (html.escape(br), len(items), ''.join(cards)))
    page = '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Список М1</title>
<style>body{font:14px/1.4 system-ui,sans-serif;margin:0;padding:16px;background:#f6f4f1;color:#222}h1{font-size:22px}h2{margin:28px 0 8px;font-size:18px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}figure{margin:0;background:#fff;border-radius:10px;overflow:hidden;position:relative;box-shadow:0 1px 3px #0001}
figure img{width:100%;aspect-ratio:3/4;object-fit:cover;background:#eee;display:block}figcaption{padding:8px 10px}small{color:#666}.n{position:absolute;top:6px;left:6px;background:#222;color:#fff;border-radius:12px;padding:1px 8px;font-weight:600}
p.note{max-width:760px;color:#444}</style>
<h1>Список вещей М1 — на утверждение</h1><p class="note">Картинки грузятся с Wildberries (файл для внутренней проверки, не публикуется). Напишите номера, которые убрать или заменить, и чего не хватает. Цены и размеры здесь не показаны: их снимаю в момент сбора, с датой.</p>''' + ''.join(rows)
    open(path, 'w', encoding='utf-8').write(page)
    return n


if __name__ == '__main__':
    briefs = json.load(open(sys.argv[1]))
    sel = select(candidates(briefs))
    json.dump(sel, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
    for br, items in sel.items():
        g = defaultdict(int)
        for c in items: g[c['group'] + ':' + c['sex']] += 1
        print('%-14s %2d  %s' % (br, len(items), dict(g)))
    if len(sys.argv) > 3: print('всего', report_html(sel, sys.argv[3]))
