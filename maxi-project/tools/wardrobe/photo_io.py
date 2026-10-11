"""Чтение фото вещи: поиск файла по ключу, загрузка с уменьшением, PNG с прозрачностью, студийное фото."""
import json, os, sys, glob
import numpy as np, cv2
from cutout import studio_mask
from wardrobe_paths import RAW


def find(key):
    if os.path.isfile(key): return key          # путь к файлу (конвейер каталога), иначе — имя фото в raw/
    f = glob.glob(os.path.join(RAW, key + '*'))
    return f[0] if f else None


def load(key, maxh=1400):
    im = cv2.imread(find(key))
    h, w = im.shape[:2]
    # скриншоты с телефона: чёрные поля сверху и снизу — обрезать
    rows = np.where(im.reshape(h, -1).max(1) > 18)[0]
    im = im[rows[0]:rows[-1] + 1]
    h, w = im.shape[:2]
    k = maxh / h
    return cv2.resize(im, (int(w * k), maxh), interpolation=cv2.INTER_AREA) if k < 1 else im


def load_any(key, maxh=1400, with_alpha=False):
    """Фото из выгрузки: может быть PNG с прозрачным фоном — кладём на светлый фон (with_alpha — вернуть и маску из прозрачности)."""
    im = cv2.imread(find(key), cv2.IMREAD_UNCHANGED); am = None
    if im.ndim == 3 and im.shape[2] == 4:
        a = im[..., 3:4].astype(np.float32) / 255
        if a.min() < 0.1: am = (a[..., 0] > 0.5).astype(np.uint8)
        im = (im[..., :3] * a + 244 * (1 - a)).astype(np.uint8)
    elif im.ndim == 2: im = cv2.cvtColor(im, cv2.COLOR_GRAY2BGR)
    h, w = im.shape[:2]; k = maxh / h
    if k < 1:
        im = cv2.resize(im, (int(w * k), maxh), interpolation=cv2.INTER_AREA)
        if am is not None: am = cv2.resize(am, (int(w * k), maxh), interpolation=cv2.INTER_NEAREST)
    return (im, am) if with_alpha else im


def studio_load(key):
    """Студийное фото и маска вещи: из прозрачности PNG, если она есть, иначе — вырезанием фона."""
    im, am = load_any(key, with_alpha=True)
    if am is not None and 0.05 < am.mean() < 0.95:
        n, lab_, st, _ = cv2.connectedComponentsWithStats(am)
        if n > 1: am = (lab_ == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
        return im, am
    return im, studio_mask(im)
