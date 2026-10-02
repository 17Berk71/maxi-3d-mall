"""Тестовая выгрузка в формате YML (как у партнёрских сетей) для проверки загрузчика.
Товары, цены и ссылки — НЕНАСТОЯЩИЕ. Фото — три наших примера вещей, перекрашенные в разные цвета;
часть фото положена на светлый фон, как студийные снимки в настоящих выгрузках, чтобы проверить вырезание фона.
Запуск: python3 tools/feeds/make_demo.py → tools/feeds/demo/demo_feed.yml и tools/feeds/demo/img/*.
"""
import os, colorsys
import numpy as np
from PIL import Image
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', 'src', 'assets', 'products')
OUT = os.path.join(HERE, 'demo'); IMG = os.path.join(OUT, 'img'); os.makedirs(IMG, exist_ok=True)

def recolor(name, hue=None, sat=1.0, val=1.0, add=0.0):
    im = np.asarray(Image.open(os.path.join(SRC, name + '.webp')).convert('RGBA')).astype(np.float32) / 255
    rgb = im[..., :3]; a = im[..., 3:]
    mx = rgb.max(-1); mn = rgb.min(-1); v = mx; s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    if hue is None:
        out = np.clip(rgb * val + add, 0, 1)
    else:
        # оттенок меняем, светотень (v) сохраняем
        r, g, b = colorsys.hsv_to_rgb(hue / 360, 1, 1)
        base = np.array([r, g, b], np.float32)
        ss = np.clip(s * sat, 0, 1)[..., None]; vv = np.clip(v * val + add, 0, 1)[..., None]
        out = vv * (1 - ss + ss * base)
    return Image.fromarray((np.concatenate([out, a], -1) * 255).astype(np.uint8), 'RGBA')

def save(img, fn, packshot):
    if packshot:  # как в настоящей выгрузке: вещь на светлом фоне, без прозрачности
        bg = Image.new('RGBA', img.size, (244, 243, 241, 255)); bg.alpha_composite(img); bg.convert('RGB').save(os.path.join(IMG, fn + '.jpg'), quality=90); return fn + '.jpg'
    img.save(os.path.join(IMG, fn + '.png')); return fn + '.png'

PICS = {}
def pic(key, base, packshot=False, **kw):
    PICS[key] = save(recolor(base, **kw), key, packshot)
pic('puffer_red', 'puffer_red', hue=None)
pic('puffer_navy', 'puffer_red', hue=222, sat=0.75, val=0.55, packshot=True)
pic('puffer_black', 'puffer_red', hue=220, sat=0.12, val=0.35)
pic('puffer_olive', 'puffer_red', hue=75, sat=0.55, val=0.75, packshot=True)
pic('puffer_milk', 'puffer_red', hue=40, sat=0.10, val=0.55, add=0.42)
pic('tee_black', 'tee_black', hue=None)
pic('tee_grey', 'tee_black', val=1.0, add=0.42, packshot=True)
pic('tee_navy', 'tee_black', hue=222, sat=0.9, val=1.0, add=0.12)
pic('trousers_beige', 'trousers_beige', hue=None)
pic('trousers_grey', 'trousers_beige', hue=220, sat=0.08, val=0.85, packshot=True)
pic('trousers_khaki', 'trousers_beige', hue=70, sat=0.55, val=0.7)
pic('trousers_navy', 'trousers_beige', hue=222, sat=0.7, val=0.45, packshot=True)

CATS = [(1, None, 'Женщинам'), (2, None, 'Мужчинам'), (3, None, 'Детям'),
        (11, 1, 'Верхняя одежда'), (12, 1, 'Брюки'), (13, 1, 'Футболки и топы'), (14, 1, 'Платья'), (15, 1, 'Обувь'),
        (21, 2, 'Куртки и пуховики'), (22, 2, 'Брюки и джинсы'), (23, 2, 'Футболки'), (25, 2, 'Обувь'),
        (31, 3, 'Верхняя одежда'), (33, 3, 'Футболки')]
CAT_PATH = {c[0]: c for c in CATS}
COLOR_RU = {'red': 'бордовый', 'navy': 'тёмно-синий', 'black': 'чёрный', 'olive': 'оливковый', 'milk': 'молочный', 'grey': 'серый', 'beige': 'бежевый', 'khaki': 'хаки'}
SZ_W = ['XS', 'S', 'M', 'L', 'XL']; SZ_M = ['S', 'M', 'L', 'XL', 'XXL']; SZ_K = ['110', '122', '134', '146']
SZ_P = ['42', '44', '46', '48', '50']; SZ_SH = ['36', '37', '38', '39', '40', '41']

# магазин, сайт (проверенная главная страница — в демо вместо ссылки на товар), можно ли забрать в магазине (для примера кнопки)
SHOPS = [('Gloria Jeans', 'https://www.gloria-jeans.ru/', True, 'gj'), ('Ostin', 'https://ostin.com/', True, 'os'), ('Zolla', 'https://zolla.com/', False, 'zl')]
# [категория, название, цена, фото или None, размеры]
LINES = [
    (11, 'Пуховик с капюшоном', 7999, 'puffer_navy', SZ_W), (11, 'Пуховик с капюшоном', 7999, 'puffer_milk', SZ_W),
    (11, 'Куртка стёганая', 5499, 'puffer_red', SZ_W), (12, 'Брюки прямые', 2999, 'trousers_beige', SZ_P),
    (12, 'Брюки широкие', 3299, 'trousers_grey', SZ_P), (13, 'Футболка базовая', 899, 'tee_black', SZ_W),
    (13, 'Футболка оверсайз', 1199, 'tee_grey', SZ_W), (14, 'Платье миди', 3499, None, SZ_W), (14, 'Платье трикотажное', 2799, None, SZ_W),
    (15, 'Кеды', 2999, None, SZ_SH),
    (21, 'Пуховик мужской', 8999, 'puffer_black', SZ_M), (21, 'Куртка мужская', 6499, 'puffer_olive', SZ_M),
    (22, 'Брюки карго', 3499, 'trousers_khaki', SZ_P), (22, 'Брюки чинос', 2999, 'trousers_navy', SZ_P),
    (23, 'Футболка мужская', 999, 'tee_navy', SZ_M), (23, 'Футболка мужская', 999, 'tee_black', SZ_M), (25, 'Кроссовки', 4499, None, SZ_SH),
    (31, 'Куртка детская', 3999, 'puffer_red', SZ_K), (33, 'Футболка детская', 599, 'tee_grey', SZ_K),
]
def color_of(p): return COLOR_RU.get(p.split('_')[1], 'как на фото') if p else ['чёрный', 'молочный', 'тёмно-синий'][len(LINES) % 3]

lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<yml_catalog date="2026-10-02 10:00">', '<shop>', '<name>Тестовая выгрузка</name>',
         '<company>Демо для проекта «Прогулка по Макси»</company>', '<url>https://example.com/</url>', '<currencies><currency id="RUR" rate="1"/></currencies>', '<categories>']
for cid, par, name in CATS:
    lines.append(f'<category id="{cid}"' + (f' parentId="{par}"' if par else '') + f'>{escape(name)}</category>')
lines += ['</categories>', '<offers>']
n = 0
for si, (shop, site, pickup, pre) in enumerate(SHOPS):
    for li, (cid, name, price, p0, sizes) in enumerate(LINES):
      fam = [k for k in PICS if p0 and k.split('_')[0] == p0.split('_')[0]]
      variants = ([p0] + [k for k in fam if k != p0])[:3] if p0 else [None]  # каждая модель в 2–3 цветах
      for vi, p in enumerate(variants):
        if (li + si + vi) % 7 == 6: continue  # у каждого магазина немного свой набор
        pr = int(round(price * (0.9 + 0.08 * ((li * 3 + si) % 4)) / 100) * 100 - 1)
        gid = f'{pre}-{li:03d}-{vi}'; col = color_of(p) if p else ['чёрный', 'молочный', 'тёмно-синий'][li % 3]
        for k, sz in enumerate(sizes):
            if (k + li + si) % 5 == 4: continue  # части размеров нет в наличии
            n += 1
            o = [f'<offer id="{gid}-{sz}" group_id="{gid}" available="true">', f'<url>{escape(site)}</url>', f'<price>{pr}</price>', '<currencyId>RUR</currencyId>',
                 f'<categoryId>{cid}</categoryId>']
            if p: o.append(f'<picture>img/{PICS[p]}</picture>')
            o += [f'<vendor>{escape(shop)}</vendor>', f'<name>{escape(name)}</name>', f'<param name="Цвет">{col}</param>', f'<param name="Размер">{sz}</param>',
                  f'<param name="Самовывоз">{"да" if pickup else "нет"}</param>', '</offer>']
            lines.append(''.join(o))
lines += ['</offers>', '</shop>', '</yml_catalog>']
open(os.path.join(OUT, 'demo_feed.yml'), 'w', encoding='utf-8').write('\n'.join(lines))
print('offers', n, 'pics', len(PICS))
