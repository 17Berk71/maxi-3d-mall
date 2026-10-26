"""Проверка каталога (формат v1, tools/catalog/README.md).

python3 tools/catalog/validate.py [папка=public/feeds] [--quiet]

Опубликованная вещь без цены, фото, вырезки или размеров со статусом и датой — ошибка (PRD, принцип 1:
лучше меньше вещей, чем вещь, которая вводит в заблуждение). Выход с кодом 1, если есть ошибки.
"""
import json, os, re, sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from taxonomy import KINDS, COLORS  # noqa: E402

STATUS = {'in_stock', 'out_of_stock', 'unknown'}
ITEM_STATUS = {'published', 'review', 'rejected'}


def is_date(s):
    if not isinstance(s, str):
        return False
    try:
        datetime.fromisoformat(s.replace('Z', '+00:00'))
        return True
    except ValueError:
        return False


def check_item(it, root, seen):
    err, warn = [], []
    iid = it.get('id')
    if not isinstance(iid, str) or not re.fullmatch(r'[a-z]+-[\w-]+', iid or ''):
        err.append('id «%s» не вида «источник-номер»' % iid)
    elif iid in seen:
        err.append('id повторяется (уже в %s)' % seen[iid])
    src = it.get('src') or {}
    if not src.get('kind') or not src.get('id') or not is_date(src.get('collected')):
        err.append('src: нужны kind, id и дата collected')
    for f in ('brand', 'name'):
        if not (it.get(f) or '').strip():
            err.append('нет поля %s' % f)
    st = it.get('status')
    if st not in ITEM_STATUS:
        err.append('status «%s» не из %s' % (st, sorted(ITEM_STATUS)))
    if not isinstance(it.get('hidden'), bool):
        err.append('hidden должно быть true или false')
    if st != 'published':
        return err, warn

    if it.get('kind') not in KINDS:
        err.append('вид «%s» не из списка видов' % it.get('kind'))
    if it.get('sex') not in ('f', 'm', 'u'):
        err.append('sex «%s» — нужно f, m или u' % it.get('sex'))
    cols = it.get('colors') or []
    if not cols:
        err.append('нет цвета')
    for c in cols:
        if c not in COLORS:
            err.append('цвет «%s» не из списка цветов' % c)

    pr = it.get('price') or {}
    if not isinstance(pr.get('now'), (int, float)) or pr['now'] <= 0:
        err.append('нет цены')
    elif pr.get('old') is not None and (not isinstance(pr['old'], (int, float)) or pr['old'] < pr['now']):
        err.append('старая цена меньше текущей')
    if pr and not is_date(pr.get('at')):
        err.append('у цены нет даты проверки')
    if pr and pr.get('cur', 'RUB') != 'RUB':
        warn.append('валюта %s' % pr.get('cur'))

    sizes = it.get('sizes') or []
    if not sizes:
        err.append('нет размеров')
    names = set()
    for s in sizes:
        n = s.get('name')
        if not n:
            err.append('размер без названия')
        elif n in names:
            err.append('размер %s повторяется' % n)
        names.add(n)
        if s.get('status') not in STATUS:
            err.append('у размера %s статус «%s»' % (n, s.get('status')))
        if not is_date(s.get('at')):
            err.append('у размера %s нет даты проверки' % n)
    if sizes and not any(s.get('status') == 'in_stock' for s in sizes):
        warn.append('ни одного размера в наличии')

    photos = it.get('photos') or []
    if not photos:
        err.append('нет фото')
    cut = it.get('cut') or {}
    if not cut.get('front'):
        err.append('нет вырезки спереди')
    if not cut.get('back'):
        warn.append('нет вырезки сзади (кнопки «Повернуть» не будет)')
    if not it.get('thumb'):
        err.append('нет миниатюры')
    for rel in photos + [cut.get('front'), cut.get('back'), it.get('thumb')]:
        if rel and not os.path.isfile(os.path.join(root, rel)):
            err.append('нет файла %s' % rel)
    if cut.get('front'):
        p = os.path.join(root, cut['front'])
        if os.path.isfile(p) and os.path.getsize(p) > 160_000:
            warn.append('вырезка %d КБ (цель ~80)' % (os.path.getsize(p) // 1000))

    if not (it.get('desc') or '').strip():
        warn.append('нет описания')
    if not it.get('composition'):
        warn.append('нет состава')
    return err, warn


def validate(root, quiet=False):
    idx_p = os.path.join(root, 'index.json')
    if not os.path.isfile(idx_p):
        print('нет %s' % idx_p)
        return 1
    idx = json.load(open(idx_p, encoding='utf-8'))
    if idx.get('version') != 1:
        print('index.json: формат не v1 (version=%s) — это старая выгрузка?' % idx.get('version'))
        return 1
    seen, n_err, n_warn, n_pub, n_all = {}, 0, 0, 0, 0
    for key, sh in (idx.get('shops') or {}).items():
        p = os.path.join(root, sh.get('file', ''))
        if not os.path.isfile(p):
            print('%s: нет файла %s' % (key, sh.get('file')))
            n_err += 1
            continue
        data = json.load(open(p, encoding='utf-8'))
        items = data.get('items') or []
        pub = [it for it in items if it.get('status') == 'published' and not it.get('hidden')]
        if sh.get('items') != len(pub):
            print('%s: в index.json items=%s, опубликовано и не скрыто %d' % (key, sh.get('items'), len(pub)))
            n_warn += 1
        for it in items:
            n_all += 1
            e, w = check_item(it, root, seen)
            seen.setdefault(it.get('id'), key)
            if it.get('status') == 'published':
                n_pub += 1
            n_err += len(e)
            n_warn += len(w)
            if e or (w and not quiet):
                print('%s / %s «%s»' % (key, it.get('id'), (it.get('name') or '')[:50]))
                for x in e:
                    print('   ошибка: ' + x)
                if not quiet:
                    for x in w:
                        print('   замечание: ' + x)
    print('\nвещей %d, опубликовано %d; ошибок %d, замечаний %d' % (n_all, n_pub, n_err, n_warn))
    return 1 if n_err else 0


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    sys.exit(validate(args[0] if args else 'public/feeds', '--quiet' in sys.argv))
