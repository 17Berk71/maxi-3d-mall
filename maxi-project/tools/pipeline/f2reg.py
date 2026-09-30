# Второй этаж, шаг 1: привязка подробных снимков к обзорному (f2_all) по совпадающим деталям.
# Снимки Яндекс Карт ориентированы на север, поэтому ищем только масштаб и сдвиг.
import json
import numpy as np
import cv2
from PIL import Image

def load(n):
    return np.array(Image.open('source/%s.png' % n).convert('L'))

def ui_mask(img, name):
    # кнопки карт и подпись Яндекса не участвуют в сопоставлении
    m = np.full(img.shape, 255, np.uint8)
    h, w = img.shape
    m[:70, w - 400:] = 0; m[150:600, w - 90:] = 0; m[h - 60:, w - 520:] = 0; m[:60, :60] = 0
    return m

base = load('f2_all')
sift = cv2.SIFT_create(nfeatures=12000, contrastThreshold=0.02)
kb, db = sift.detectAndCompute(base, ui_mask(base, 'f2_all'))
out = {}
for n in ['f2_west', 'f2_mid', 'f2_east', 'f2_food']:
    im = load(n)
    k, d = sift.detectAndCompute(im, ui_mask(im, n))
    m = cv2.BFMatcher().knnMatch(d, db, k=2)
    good = [a for a, b in m if a.distance < 0.8 * b.distance]
    src = np.float32([k[a.queryIdx].pt for a in good]); dst = np.float32([kb[a.trainIdx].pt for a in good])
    # масштаб + сдвиг (без поворота) через RANSAC по парам точек
    best = None; rng = np.random.default_rng(1)
    for _ in range(4000):
        i, j = rng.choice(len(src), 2, replace=False)
        ds = np.linalg.norm(src[i] - src[j])
        if ds < 40: continue
        s = np.linalg.norm(dst[i] - dst[j]) / ds
        if not (0.2 < s < 1.2): continue
        t = dst[i] - s * src[i]
        err = np.linalg.norm(src * s + t - dst, axis=1)
        inl = err < 2.5
        if best is None or inl.sum() > best[2].sum(): best = (s, t, inl)
    s, t, inl = best
    # уточнение по всем inliers
    A = np.zeros((inl.sum() * 2, 3)); bvec = np.zeros(inl.sum() * 2)
    S, Dd = src[inl], dst[inl]
    A[0::2, 0] = S[:, 0]; A[0::2, 1] = 1; A[1::2, 0] = S[:, 1]; A[1::2, 2] = 1
    bvec[0::2] = Dd[:, 0]; bvec[1::2] = Dd[:, 1]
    sol = np.linalg.lstsq(A, bvec, rcond=None)[0]
    res = np.linalg.norm(S * sol[0] + sol[1:] - Dd, axis=1)
    print(n, 'matches', len(good), 'inliers', int(inl.sum()), 'scale %.4f' % sol[0], 't', sol[1:].round(1), 'rms %.2f' % np.sqrt((res ** 2).mean()))
    out[n] = {'s': float(sol[0]), 't': [float(sol[1]), float(sol[2])]}
json.dump(out, open('work_f2/reg.json', 'w'), indent=1)
