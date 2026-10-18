#!/usr/bin/env python3
"""Отчёт для глаз по вещам Wildberries: фото из карточки, вещь на фигуре в 3 ракурсах, автопроверка, мерки.
Один HTML-файл с картинками внутри (base64) — открывается без интернета. В нём фото из магазинов: только
для внутренней проверки, не публиковать.

python3 wb_report.py OUT.html [папка_снимков ...]   (снимки — от batch.mjs: <id>_<угол>.jpg и qc.jsonl)
"""
import base64, html, io, json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(ROOT, 'tools/wardrobe/raw'); OUT = os.path.join(ROOT, 'tools/wardrobe/out')
KIND = dict(tee='Футболка', sweater='Свитер', hoodie='Худи', jacket='Куртка, жакет', shirt='Рубашка', coat='Пальто', puffer='Пуховик',
            dress='Платье', vest='Жилет', pants='Брюки', jeans='Джинсы', shorts='Шорты', skirt='Юбка')
HOW = dict(studio='студийное фото', model='фото на модели', photo='на вешалке / на полу')


def b64(path, w, q=72):
    im = Image.open(path).convert('RGB'); im.thumbnail((w, w * 2))
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=q); return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def crop_shot(path):
    """Снимок кабины 600×900: обрезать пустые поля сверху/снизу, оставить фигуру."""
    im = Image.open(path).convert('RGB'); w, h = im.size
    return im.crop((int(w * 0.12), int(h * 0.04), int(w * 0.88), int(h * 0.96)))


def b64im(im, w, q=72):
    im = im.copy(); im.thumbnail((w, w * 2)); buf = io.BytesIO(); im.save(buf, 'JPEG', quality=q)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def main():
    out_html = sys.argv[1]; dirs = [a for a in sys.argv[2:] if not a.startswith('--before=')]
    before = {}
    for a in sys.argv[2:]:
        if a.startswith('--before='):
            for d in a.split('=', 1)[1].split(','):
                for line in open(os.path.join(d, 'qc.jsonl')):
                    if line.strip(): r = json.loads(line); before[r['id']] = r
    items = {i['id']: i for i in json.load(open(os.path.join(RAW, 'wb_items.json')))}
    qc = {}
    for d in dirs:
        for line in open(os.path.join(d, 'qc.jsonl')):
            r = json.loads(line); r['dir'] = d; qc[r['id']] = r
    cards = []
    for iid, it in items.items():
        r = qc.get(iid); meta_p = os.path.join(OUT, iid, 'meta.json')
        g = None
        src_photo = os.path.join(RAW, it['front'])
        gp = os.path.join(os.path.dirname(src_photo), 'garment.json')
        if os.path.exists(gp): g = json.load(open(gp))
        front_model = None
        if g and g['photos'].get('front'):
            front_model = os.path.join(os.path.dirname(src_photo), '%02d.webp' % g['photos']['front'][0])
        cards.append((iid, it, r, g, src_photo, front_model, os.path.exists(meta_p)))
    # порядок: сначала проблемные (низкий балл), без снимков — в конце
    cards.sort(key=lambda c: (c[2] is None or 'error' in (c[2] or {}), (c[2] or {}).get('score', 999)))
    rows = []
    stores = sorted({c[1].get('brand', '') for c in cards}); kinds = sorted({c[1]['kind'] for c in cards})
    for iid, it, r, g, src_photo, front_model, built in cards:
        score = (r or {}).get('score'); err = (r or {}).get('error')
        cls = 'bad' if score is not None and score < 65 else 'mid' if score is not None and score < 80 else 'good' if score is not None else 'none'
        imgs = []
        imgs.append(f'<figure><img loading=lazy src="{b64(src_photo, 260)}"><figcaption>{HOW.get(it.get("how"), "")}</figcaption></figure>')
        if front_model and front_model != src_photo and os.path.exists(front_model):
            imgs.append(f'<figure><img loading=lazy src="{b64(front_model, 260)}"><figcaption>на модели</figcaption></figure>')
        if r and r.get('files'):
            for f, lab in zip(r['files'], ('спереди', 'сбоку', 'сзади')):
                imgs.append(f'<figure class=sim><img loading=lazy src="{b64im(crop_shot(os.path.join(r["dir"], f)), 300)}"><figcaption>{lab}</figcaption></figure>')
        checks = ''
        if r and r.get('checks'):
            li = []
            for c in r['checks']:
                li.append(f'<li class="{"ok" if c["ok"] else "no"}"><b>{html.escape(c["name"])}</b>{" −" + str(c["pen"]) if c["pen"] else ""}: {html.escape(str(c["val"]))}</li>')
            checks = '<ul class=checks>' + ''.join(li) + '</ul>'
        sizes = ''
        if it.get('sizes'):
            keys = sorted({k for s in it['sizes'] for k in s['cm']})
            th = ''.join(f'<th>{k}</th>' for k in keys)
            tr = ''.join('<tr><td>' + html.escape(s['name']) + '</td>' + ''.join(f'<td>{s["cm"].get(k, "")}</td>' for k in keys) + '</tr>' for s in it['sizes'])
            sizes = f'<details><summary>Мерки вещи из таблицы продавца (см, ширина лёжа)</summary><table><tr><th>размер</th>{th}</tr>{tr}</table></details>'
        else:
            sizes = '<p class=muted>Таблицы мерок вещи нет — размеры по пропорциям фото.</p>'
        b0 = before.get(iid, {}).get('score')
        delta = f'<span class=was>было {b0}</span>' if b0 is not None and score is not None else ''
        status = (f'<span class="score {cls}">{score}</span>{delta}' if score is not None else
                  f'<span class="score none">{"сбой" if err else "нет"}</span>')
        note = html.escape((r or {}).get('note') or '')
        rows.append(f'''<article class="card {cls}" data-kind="{it['kind']}" data-store="{html.escape(it.get('brand', ''))}" data-score="{score if score is not None else -1}" data-body="{'f' if it.get('who') == 'women' else 'm'}">
<header>{status}<div><h2>{html.escape(it['name'])}</h2>
<p class=meta>{KIND.get(it['kind'], it['kind'])} · фигура {'женская 173/56' if it.get('who') == 'women' else 'мужская 186/83'} · {HOW.get(it.get('how'), '')} · <a href="{it['url']}" target=_blank>карточка ↗</a> · <code>{iid}</code></p>
{f'<p class=fit>Посадка: {note}</p>' if note else ''}{f'<p class=err>Сбой: {html.escape(err)}</p>' if err else ''}{'' if built else '<p class=err>Фабрика не собрала вещь</p>'}</div></header>
<div class=imgs>{''.join(imgs)}</div>
{checks}{sizes}
<div class=verdict><label><input type=radio name="v-{iid}" value=ok> похоже</label><label><input type=radio name="v-{iid}" value=meh> так себе</label><label><input type=radio name="v-{iid}" value=bad> плохо</label><input class=cmt placeholder="что не так (для меня)"></div>
</article>''')
    n = len(cards); ns = [c[2]['score'] for c in cards if c[2] and c[2].get('score') is not None]
    bs = [before[c[0]]['score'] for c in cards if c[0] in before and before[c[0]].get('score') is not None]
    bsum = f' Прошлый прогон: средний балл {round(sum(bs) / len(bs))}, 80+: {sum(1 for x in bs if x >= 80)}, ниже 65: {sum(1 for x in bs if x < 65)}.' if bs else ''
    avg = round(sum(ns) / len(ns)) if ns else 0
    good = sum(1 for s in ns if s >= 80); mid = sum(1 for s in ns if 65 <= s < 80); bad = sum(1 for s in ns if s < 65)
    opts_store = ''.join(f'<option>{html.escape(s)}</option>' for s in stores)
    opts_kind = ''.join(f'<option value={k}>{KIND.get(k, k)}</option>' for k in kinds)
    doc = f'''<!doctype html><html lang=ru><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Проверка вещей Wildberries</title>
<style>
:root{{--bg:#f4f2ee;--card:#fff;--ink:#1d1d1b;--mut:#77736b;--line:#e3dfd7;--good:#2f7d4f;--mid:#b07a12;--bad:#b3362c}}
@media (prefers-color-scheme:dark){{:root{{--bg:#161614;--card:#21211e;--ink:#ecebe6;--mut:#9a968c;--line:#34332e}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}}
.top{{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 16px}}
h1{{font-size:20px;margin:0 0 4px}}.sum{{color:var(--mut);margin:0 0 8px}}.sum b{{color:var(--ink)}}
.f{{display:flex;flex-wrap:wrap;gap:8px;align-items:center}}select,button,input.cmt{{font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink)}}
main{{max-width:1500px;margin:0 auto;padding:12px 16px 60px;display:grid;gap:14px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}}
.card header{{display:flex;gap:12px;align-items:flex-start}}h2{{font-size:16px;margin:0}}.meta{{margin:2px 0;color:var(--mut);font-size:13px}}.meta a{{color:inherit}}
.fit{{margin:4px 0 0;font-size:14px}}.err{{color:var(--bad);margin:4px 0 0}}.muted{{color:var(--mut);font-size:13px}}
.score{{flex:none;min-width:54px;text-align:center;font-weight:700;font-size:22px;border-radius:10px;padding:6px 8px;color:#fff}}
.was{{display:block;font-size:11px;color:var(--mut);text-align:center;margin-top:2px}}header>span{{flex:none}}.score.good{{background:var(--good)}}.score.mid{{background:var(--mid)}}.score.bad{{background:var(--bad)}}.score.none{{background:var(--mut);font-size:14px}}
.imgs{{display:flex;gap:8px;overflow-x:auto;margin:10px 0 6px}}figure{{margin:0;flex:none}}figure img{{height:300px;border-radius:8px;display:block;background:#ddd}}
figure.sim img{{background:#e9e6e0}}figcaption{{font-size:12px;color:var(--mut);text-align:center}}
.checks{{columns:2 420px;margin:6px 0;padding-left:18px;font-size:13px}}.checks li{{break-inside:avoid;margin:2px 0}}.checks li.ok{{color:var(--mut)}}.checks li.no b{{color:var(--bad)}}
details{{font-size:13px;margin:4px 0}}table{{border-collapse:collapse;margin-top:6px}}td,th{{border:1px solid var(--line);padding:2px 6px;text-align:right}}
.verdict{{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:8px;font-size:14px}}.verdict .cmt{{flex:1;min-width:200px}}
@media (max-width:600px){{figure img{{height:220px}}.checks{{columns:1}}}}
</style></head><body>
<div class=top><h1>Проверка вещей Wildberries на манекене</h1>
<p class=sum>Вещей: <b>{n}</b> · снято: <b>{len(ns)}</b> · балл 80+: <b>{good}</b> · 65–79: <b>{mid}</b> · ниже 65: <b>{bad}</b>. Средний балл: <b>{avg}</b>.{bsum} Сначала самые проблемные. Балл автопроверки — подсказка, решает глаз.</p>
<div class=f><select id=fs><option value="">все магазины</option>{opts_store}</select><select id=fk><option value="">все виды</option>{opts_kind}</select>
<select id=fb><option value="">обе фигуры</option><option value=m>мужская</option><option value=f>женская</option></select>
<select id=fq><option value="">любой балл</option><option value=bad>ниже 65</option><option value=mid>65–79</option><option value=good>80+</option></select>
<button id=exp>Скачать мои отметки</button><span id=cnt class=muted></span></div></div>
<main>{''.join(rows)}</main>
<script>
const $=s=>document.querySelector(s), cards=[...document.querySelectorAll('.card')];
function flt(){{const s=$('#fs').value,k=$('#fk').value,b=$('#fb').value,q=$('#fq').value;let n=0;
 cards.forEach(c=>{{const show=(!s||c.dataset.store===s)&&(!k||c.dataset.kind===k)&&(!b||c.dataset.body===b)&&(!q||c.classList.contains(q));c.style.display=show?'':'none';n+=show}});$('#cnt').textContent='показано: '+n}}
['#fs','#fk','#fb','#fq'].forEach(s=>$(s).onchange=flt);flt();
const KEY='wb-report-verdicts';let saved={{}};try{{saved=JSON.parse(localStorage.getItem(KEY)||'{{}}')}}catch(e){{}}
cards.forEach(c=>{{const id=c.querySelector('code').textContent,v=saved[id]||{{}};
 c.querySelectorAll('input[type=radio]').forEach(r=>{{if(r.value===v.v)r.checked=true;r.onchange=()=>{{saved[id]={{...saved[id],v:r.value}};try{{localStorage.setItem(KEY,JSON.stringify(saved))}}catch(e){{}}}}}});
 const t=c.querySelector('.cmt');t.value=v.c||'';t.oninput=()=>{{saved[id]={{...saved[id],c:t.value}};try{{localStorage.setItem(KEY,JSON.stringify(saved))}}catch(e){{}}}}}});
$('#exp').onclick=()=>{{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(saved,null,1)],{{type:'application/json'}}));a.download='wb_verdicts.json';a.click()}};
</script></body></html>'''
    open(out_html, 'w').write(doc)
    print(out_html, round(os.path.getsize(out_html) / 1e6, 1), 'МБ;', n, 'вещей;', len(ns), 'с баллом')


if __name__ == '__main__':
    main()
