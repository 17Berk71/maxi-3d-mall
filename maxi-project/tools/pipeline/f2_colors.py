# Основные цвета заливки на снимках второго этажа (для настройки f2seg.py)
import sys
from PIL import Image
import numpy as np
import cv2
f = sys.argv[1] if len(sys.argv) > 1 else 'source/f2_all.png'
a = np.array(Image.open(f).convert('RGB'))
mx = cv2.dilate(a, np.ones((5, 5), np.uint8)).astype(int); mn = cv2.erode(a, np.ones((5, 5), np.uint8)).astype(int)
flat = (mx - mn).max(2) <= 3
q = (a[flat] // 4) * 4
cols, cnt = np.unique(q.reshape(-1, 3), axis=0, return_counts=True)
o = np.argsort(-cnt)
tot = flat.sum()
for i in o[:24]:
    ys, xs = np.nonzero(flat & (np.abs((a // 4) * 4 - cols[i]).sum(2) == 0))
    print(tuple(cols[i]), cnt[i], round(cnt[i] / tot * 100, 1), 'e.g.', (xs[len(xs) // 2], ys[len(ys) // 2]))
