"""Размеры из выгрузки → мерки тела (см), по которым примерочная подбирает размер под фигуру.

В выгрузках обычно только подписи размеров (S, M, 48, 46-48, W30 L32), без сантиметров. Поэтому:
 - если для бренда есть своя сетка (BRANDS ниже — заполнять по таблицам размеров на сайтах брендов) — берём её;
 - иначе — российская сетка: номер размера = половина обхвата груди (верх) / бёдер (женский низ).
У джинсов W/L — обхват пояса и длина по шаговому шву в дюймах: это мерки самой вещи (cm.waist, cm.inseam).
"""
import re

LETTER_M = {'XXS': 42, 'XS': 44, 'S': 46, 'M': 48, 'L': 50, 'XL': 52, 'XXL': 54, '2XL': 54, 'XXXL': 56, '3XL': 56, '4XL': 58, '5XL': 60}
LETTER_F = {'XXS': 38, 'XS': 40, 'S': 42, 'M': 44, 'L': 46, 'XL': 48, 'XXL': 50, '2XL': 50, 'XXXL': 52, '3XL': 52, '4XL': 54, '5XL': 56}

# сетки брендов: имя магазина → {подпись: {'chest': [от, до], 'waist': [...], 'hips': [...]}} (см, мерки тела)
BRANDS = {}

BOTTOMS = {'jeans', 'pants', 'shorts', 'skirt'}


def ru_body(n, who, kind):
    """Мерки тела по российскому номеру размера (ГОСТ-подобно, ±2 см)."""
    if who == 'women':
        return {'chest': [2 * n - 2, 2 * n + 2], 'waist': [2 * n - 22, 2 * n - 18], 'hips': [2 * n + 6, 2 * n + 10]}
    return {'chest': [2 * n - 2, 2 * n + 2], 'waist': [2 * n - 14, 2 * n - 10], 'hips': [2 * n + 2, 2 * n + 6]}


def parse(label, who, kind):
    """Одна подпись размера → (номер RU | None, мерки вещи cm, мерки тела | None)."""
    s = (label or '').upper().replace(' ', '').replace('Х', 'X')   # кириллическая Х в «ХL»
    # дюймы: W30, W30L32, 30/32; у джинсов и просто 30…38 (русские размеры чётные и от 40)
    m = re.match(r'^(W)?(\d{2})(?:[/X]?L?(\d{2}))?$', s) if kind in ('jeans', 'pants', 'shorts') else None
    if m and 24 <= int(m.group(2)) <= 44 and (m.group(1) or (m.group(3) and 26 <= int(m.group(3)) <= 38) or (kind == 'jeans' and int(m.group(2)) <= 38)):
        girth = int(m.group(2)) * 2.54                            # обхват пояса вещи
        cm = {'waist': round(girth / 2, 1)}                       # в примерочной мерки вещи — как лёжа (половина обхвата)
        if m.group(3): cm['inseam'] = round(int(m.group(3)) * 2.54, 1)
        # пояс вещи ≈ талия тела + 2 см
        body = {'waist': [round(girth - 6), round(girth)], 'hips': [round(girth + 12), round(girth + 20)]}
        return int(round((girth - 2 + (20 if who == 'women' else 12)) / 4) * 2), cm, body
    m = re.match(r'^(\d{2})(?:[-/](\d{2}))?$', s)
    if m:
        a = int(m.group(1)); b = int(m.group(2) or a)
        if 36 <= a <= 70: return (a + b) // 2, {}, None
    letters = LETTER_F if who == 'women' else LETTER_M
    if s in letters: return letters[s], {}, None
    m = re.match(r'^([X\d]*[SML])[-/]([X\d]*[SML])$', s)
    if m and m.group(1) in letters and m.group(2) in letters: return (letters[m.group(1)] + letters[m.group(2)]) // 2, {}, None
    return None, {}, None


# свободное облегание (см по обхвату) по виду вещи и по словам в названии; длина вещи для базового размера
EASE = {'tee': 10, 'sweater': 12, 'hoodie': 16, 'shirt': 10, 'jacket': 16}
LEN = {'tee': (70, 64), 'sweater': (68, 62), 'hoodie': (70, 64), 'shirt': (76, 70), 'jacket': (70, 64)}   # мужск., женск. (размер 48 / 44)
OUTSEAM = {'jeans': (106, 102), 'pants': (106, 102), 'shorts': (52, 44)}


def fit_words(name):
    n = (name or '').lower()
    if re.search(r'оверсайз|oversize|свободн|широк|багги|baggy|relax|бочк|wide', n): return 'loose'
    if re.search(r'slim|скинни|skinny|облега|приталенн|узк', n): return 'slim'
    return ''


def garment_cm(e, kind, who, fit):
    """Мерки вещи (как лёжа: половина обхвата), если в выгрузке их нет: от мерок тела размера + облегание.
    Без них выбор размера в примерочной ничего бы не менял — ширина бралась бы только из пропорций фото."""
    n, b = e['ru'] or (44 if who == 'women' else 48), e['body']
    mid = lambda k: sum(b[k]) / 2 if k in b else None
    step = (n - (44 if who == 'women' else 48)) / 2
    cm = dict(e['cm'])
    if kind in EASE:
        ease = EASE[kind] + (14 if fit == 'loose' else -6 if fit == 'slim' else 0)
        if mid('chest') and 'chest' not in cm: cm['chest'] = round((mid('chest') + ease) / 2, 1)
        if 'len' not in cm: cm['len'] = round(LEN[kind][1 if who == 'women' else 0] + 1.5 * step, 1)
    elif kind in OUTSEAM:
        if mid('waist') and 'waist' not in cm: cm['waist'] = round((mid('waist') + 2) / 2, 1)
        if mid('hips') and 'hip' not in cm: cm['hip'] = round((mid('hips') + (22 if fit == 'loose' else 4 if fit == 'slim' else 10)) / 2, 1)
        if 'outseam' not in cm: cm['outseam'] = round(cm['inseam'] + 27, 1) if 'inseam' in cm else round(OUTSEAM[kind][1 if who == 'women' else 0] + 0.8 * step, 1)
    return cm


def size_table(labels, kind, who='', brand='', name=''):
    """Таблица размеров для примерочной: [{name, ru, body, cm}] по возрастанию (cm с пометкой est — оценка)."""
    out = []
    grid = BRANDS.get(brand) or {}
    for lab in labels:
        n, cm, b0 = parse(lab, who, kind)
        body = grid.get(lab) or b0 or (ru_body(n, who, kind) if n else None)
        if not body: continue
        if kind in BOTTOMS: body = {k: v for k, v in body.items() if k in ('waist', 'hips')}
        else: body = {k: v for k, v in body.items() if k in ('chest', 'waist')}
        out.append({'name': lab, 'ru': n, 'body': body, 'cm': cm})
    out.sort(key=lambda e: (e['ru'] or 0, e['cm'].get('waist', 0)))
    fit = fit_words(name)
    for e in out:
        cm = garment_cm(e, kind, who, fit)
        if cm != e['cm']: e['cm'] = cm; e['est'] = True
    return out
