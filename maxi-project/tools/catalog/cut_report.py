"""Отчёт по вырезкам для холста (КТ-2а/2б): один HTML-файл, картинки внутри.

python3 tools/catalog/cut_report.py ПАПКА_ВЫРЕЗОК ВЫХОД.html [--verdicts=отметки.json]

Рядом с каждой вырезкой — исходный снимок, оценка программы и причины. Кнопки «годится / переделать / не брать»,
поле для комментария, «Скачать отметки» — JSON, который потом читает следующий прогон.
Фото магазинов внутри: файл не публикуется, отдаётся владельцу как файл.
"""
import base64, glob, html, io, json, os, sys
from PIL import Image

LEVEL = {'ok': 'годится по программе', 'review': 'проверить глазами', 'reject': 'не берём', 'error': 'ошибка'}


def data_uri(path, maxw=None, fmt='WEBP', q=80):
    im = Image.open(path)
    if maxw and im.width > maxw:
        im = im.resize((maxw, int(im.height * maxw / im.width)))
    if fmt == 'JPEG': im = im.convert('RGB')
    b = io.BytesIO(); im.save(b, fmt, quality=q)
    return 'data:image/%s;base64,%s' % (fmt.lower(), base64.b64encode(b.getvalue()).decode())


def main(folder, out, verdicts=None):
    old = json.load(open(verdicts)) if verdicts and os.path.isfile(verdicts) else {}
    runs = {}
    rl = os.path.join(folder, 'run.jsonl')
    if os.path.isfile(rl):
        for l in open(rl, encoding='utf-8'):
            r = json.loads(l); runs[r['id']] = r
    items = []
    for jp in sorted(glob.glob(os.path.join(folder, '*.json'))):
        r = json.load(open(jp, encoding='utf-8'))
        if 'id' not in r: continue
        r.update({k: v for k, v in runs.get(r['id'], {}).items() if k in ('brand', 'name')})
        items.append(r)
    order = {'review': 0, 'ok': 1, 'reject': 2, 'error': 3}
    items.sort(key=lambda r: ((r.get('brand') or '').lower(), order.get(r.get('level'), 9)))
    cards = []
    for n, r in enumerate(items, 1):
        sides = r.get('sides') or {}
        imgs = []
        for s, lab in (('front', 'спереди'), ('back', 'сзади')):
            if s in sides and os.path.isfile(os.path.join(folder, sides[s]['file'])):
                imgs.append('<figure class="cut"><img src="%s"><figcaption>%s · %s КБ</figcaption></figure>' % (data_uri(os.path.join(folder, sides[s]['file'])), lab, sides[s]['kb']))
        src = None
        if sides.get('front'):
            p = os.path.join(r['folder'], sides['front']['photo'])
            if os.path.isfile(p): src = data_uri(p, 260, 'JPEG', 70)
        if src: imgs.insert(0, '<figure class="src"><img src="%s"><figcaption>снимок %s</figcaption></figure>' % (src, sides['front']['photo']))
        v = old.get(r['id'], {})
        why = ''.join('<li>%s</li>' % html.escape(w) for w in (r.get('why') or []))
        cards.append('''<article data-id="%s" data-level="%s"><header><span class="n">%d</span> <b>%s</b> · %s · <span class="lv %s">%s</span></header>
<p class="nm">%s</p><div class="row">%s</div><ul>%s</ul>
<div class="act"><button data-v="good">годится</button><button data-v="redo">переделать</button><button data-v="drop">не брать</button>
<input placeholder="что не так (необязательно)" value="%s"></div></article>''' % (
            r['id'], r.get('level'), n, html.escape(r.get('brand') or ''), html.escape(r.get('kind') or ''), r.get('level'), LEVEL.get(r.get('level'), r.get('level')),
            html.escape(r.get('name') or ''), ''.join(imgs) or '<p>вырезки нет</p>', why, html.escape(v.get('note', ''))))
    page = '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вырезки для холста</title>
<style>body{font:14px/1.4 system-ui,sans-serif;margin:0;padding:16px;background:#f4f2ee;color:#222}h1{font-size:22px;margin:0 0 6px}
.bar{position:sticky;top:0;background:#f4f2ee;padding:8px 0;z-index:2;display:flex;gap:10px;flex-wrap:wrap;align-items:center;border-bottom:1px solid #ddd}
.bar button,.act button{border:1px solid #bbb;background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer;font:inherit}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:14px;margin-top:12px}
article{background:#fff;border-radius:12px;padding:10px 12px;box-shadow:0 1px 3px #0001}article.good{outline:3px solid #3a9b5c}article.redo{outline:3px solid #e0a020}article.drop{outline:3px solid #c8433a}
.n{background:#222;color:#fff;border-radius:10px;padding:0 7px;font-weight:600}.nm{margin:4px 0;color:#555}
.row{display:flex;gap:8px;align-items:flex-end}figure{margin:0;text-align:center;font-size:12px;color:#777}
.cut img{max-height:260px;max-width:150px;background:repeating-conic-gradient(#e7e7e7 0 25%,#fff 0 50%) 0 0/16px 16px;border-radius:6px}
.src img{max-height:260px;max-width:120px;border-radius:6px;opacity:.9}ul{margin:6px 0;padding-left:18px;color:#8a4b10;font-size:13px}
.lv{font-weight:600}.lv.ok{color:#2d7d48}.lv.review{color:#b07400}.lv.reject{color:#b3372f}.act{display:flex;gap:6px;flex-wrap:wrap}.act input{flex:1;min-width:160px;border:1px solid #ccc;border-radius:8px;padding:6px}
.act button.on{background:#222;color:#fff}@media(max-width:480px){.grid{grid-template-columns:1fr}}</style>
<h1>Вырезки вещей для холста</h1><p>Клетчатый фон — прозрачность. Отметьте каждую вещь: годится, переделать, не брать. В конце — «Скачать отметки» и пришлите файл в чат.</p>
<div class="bar"><span id="cnt"></span><button id="f-all">все</button><button id="f-rev">только «проверить глазами»</button><button id="f-left">неотмеченные</button><button id="dl">Скачать отметки</button></div>
<div class="grid">''' + ''.join(cards) + '''</div>
<script>
const V=''' + json.dumps(old, ensure_ascii=False) + ''';
const arts=[...document.querySelectorAll('article')];
function paint(a){const v=V[a.dataset.id]||{};a.className=v.v||'';a.querySelectorAll('.act button').forEach(b=>b.classList.toggle('on',b.dataset.v===v.v));}
function count(){const n=arts.filter(a=>(V[a.dataset.id]||{}).v).length;document.getElementById('cnt').textContent='отмечено '+n+' из '+arts.length;}
arts.forEach(a=>{paint(a);a.querySelectorAll('.act button').forEach(b=>b.onclick=()=>{V[a.dataset.id]=Object.assign(V[a.dataset.id]||{},{v:b.dataset.v});paint(a);count();});
 a.querySelector('input').oninput=e=>{V[a.dataset.id]=Object.assign(V[a.dataset.id]||{},{note:e.target.value});};});
count();
const show=f=>arts.forEach(a=>a.style.display=f(a)?'':'none');
document.getElementById('f-all').onclick=()=>show(()=>true);
document.getElementById('f-rev').onclick=()=>show(a=>a.dataset.level==='review');
document.getElementById('f-left').onclick=()=>show(a=>!(V[a.dataset.id]||{}).v);
document.getElementById('dl').onclick=()=>{const b=new Blob([JSON.stringify(V,null,1)],{type:'application/json'});const u=URL.createObjectURL(b);const l=document.createElement('a');l.href=u;l.download='cut_verdicts.json';l.click();};
</script>'''
    open(out, 'w', encoding='utf-8').write(page)
    print(out, len(items), 'вещей', round(os.path.getsize(out) / 1e6, 1), 'МБ')


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    vd = next((x.split('=', 1)[1] for x in sys.argv[1:] if x.startswith('--verdicts=')), None)
    main(a[0], a[1], vd)
