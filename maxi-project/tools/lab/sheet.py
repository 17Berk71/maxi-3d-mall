#!/usr/bin/env python3
"""sheet.py OUT.jpg 'подпись1=a.png,b.png' 'подпись2=c.png,d.png' … — лист сравнения: каждая строка — подпись и снимки в ряд.
CROP=x0,y0,x1,y1 — обрезать каждый снимок; H=500 — высота строки. Пример «до/после»:
  python3 sheet.py cmp.jpg "ДО=shots/w_old_0.png,shots/w_old_3.14.png" "ПОСЛЕ=shots/w_new_0.png,shots/w_new_3.14.png"
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

def main():
    out, rows = sys.argv[1], sys.argv[2:]
    crop = tuple(map(int, os.environ['CROP'].split(','))) if os.environ.get('CROP') else None
    H = int(os.environ.get('H', 500)); pad = 40
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
    except OSError: font = ImageFont.load_default()
    built = []
    for r in rows:
        label, files = r.split('=', 1) if '=' in r else ('', r)
        ims = []
        for f in files.split(','):
            im = Image.open(f).convert('RGB')
            if crop: im = im.crop(crop)
            ims.append(im.resize((round(im.width * H / im.height), H)))
        built.append((label, ims))
    W = max(sum(i.width for i in ims) for _, ims in built)
    sheet = Image.new('RGB', (W, len(built) * (H + pad)), 'white'); d = ImageDraw.Draw(sheet)
    for k, (label, ims) in enumerate(built):
        y = k * (H + pad); d.text((8, y + 6), label, fill='black', font=font); x = 0
        for im in ims: sheet.paste(im, (x, y + pad)); x += im.width
    sheet.save(out, quality=88); print(out, sheet.size)

if __name__ == '__main__': main()
