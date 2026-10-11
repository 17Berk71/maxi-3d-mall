"""Вырезание вещи из фона: GrabCut по фото на вешалке/полу, маска студийного фото, сплошные отрезки строк, заливка дыр тканью."""
import json, os, sys, glob
import numpy as np, cv2


def segment(im):
    """Маска вещи. Фон бывает двух видов: стена с полкой и диваном (вещь на вешалке) или зелёный ковёр (вещь лёжа)."""
    h, w = im.shape[:2]
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    H, S, V = [hsv[..., i].astype(int) for i in range(3)]
    green = (H > 18) & (H < 58) & (S > 70) & (V > 50)          # ковёр (OpenCV: H 0..180)
    flat = green.mean() > 0.35
    gc = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    if flat:
        gc[green] = cv2.GC_BGD
        gc[~green] = cv2.GC_PR_FGD
        gc[int(h * .82):] = np.where(green[int(h * .82):], cv2.GC_BGD, cv2.GC_PR_BGD)  # ноги внизу кадра
    else:
        # вещь на вешалке: сверху полка, снизу диван — по строкам, где «не стена» почти во всю ширину
        lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
        band = np.concatenate([lab[int(h * .35):int(h * .65), :int(w * .04)].reshape(-1, 3), lab[int(h * .35):int(h * .65), -int(w * .04):].reshape(-1, 3)])
        wall = np.median(band, 0)
        dab = np.linalg.norm(lab[..., 1:] - wall[1:], axis=2)          # цветность: стена бирюзовая, вещь — нет
        dL = np.abs(lab[..., 0] - wall[0])
        dist = np.sqrt(dab ** 2 * 4 + dL ** 2 * .25)
        nonwall = (dist > 14).mean(1)
        rows = np.arange(h)
        # полка — последняя «сплошная» строка в верхней трети; диван — сплошной блок строк от низа кадра
        shelf = [y for y in range(int(h * .03), int(h * .35)) if nonwall[y] > .88]
        y0 = (max(shelf) + 4) if shelf else int(h * .12)
        y1 = h
        while y1 > h * .55 and nonwall[y1 - 1] > .85: y1 -= 1
        y1 = max(int(h * .55), y1 - 2)
        gc[:y0] = cv2.GC_BGD; gc[y1:] = cv2.GC_BGD
        gc[y0:y1, int(w * .04):int(w * .96)] = cv2.GC_PR_FGD
        sure_wall = (dab < 3.5) & (dL < 18)
        gc[sure_wall & (gc != cv2.GC_BGD)] = cv2.GC_BGD
    gc[:, :3] = gc[:, -3:] = cv2.GC_BGD
    cy0, cy1, cx0, cx1 = int(h * .42), int(h * .58), int(w * .44), int(w * .56)
    gc[cy0:cy1, cx0:cx1] = cv2.GC_FGD
    bg, fg = np.zeros((1, 65)), np.zeros((1, 65))
    small = 2 if h > 900 else 1
    ims = cv2.resize(im, (w // small, h // small)); gcs = cv2.resize(gc, (w // small, h // small), interpolation=cv2.INTER_NEAREST)
    cv2.grabCut(ims, gcs, None, bg, fg, 8, cv2.GC_INIT_WITH_MASK)
    m = cv2.resize(((gcs == cv2.GC_FGD) | (gcs == cv2.GC_PR_FGD)).astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
    if flat: m[green] = 0
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    # одна связная вещь, содержащая центр кадра
    n, lab_, st, _ = cv2.connectedComponentsWithStats(m)
    c = lab_[h // 2, w // 2]
    if c == 0: c = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
    m = (lab_ == c).astype(np.uint8)
    # закрыть дырки внутри вещи
    ff = m.copy(); cv2.floodFill(ff, None, (0, 0), 1)
    holes = (1 - ff)
    if flat: holes[green] = 0          # просвет ковра между штанинами — не дырка
    m = m | holes
    return m, flat


def runs(row):
    d = np.diff(np.concatenate([[0], row, [0]]))
    s, e = np.where(d == 1)[0], np.where(d == -1)[0]
    return list(zip(s, e))


def central_run(row, cx):
    rs = runs(row)
    if not rs: return None
    for s, e in rs:
        if s <= cx < e: return s, e
    return min(rs, key=lambda r: min(abs(r[0] - cx), abs(r[1] - cx)))


def fill_holes_with_cloth(img, m):
    """Пиксели вне маски внутри выпрямленной области закрасить тканью (горловина, щели)."""
    inv = (1 - m).astype(np.uint8)
    if inv.sum() == 0: return img
    return cv2.inpaint(img, inv * 255, 7, cv2.INPAINT_TELEA)


def studio_mask(im):
    """Студийное фото из выгрузки магазина: вещь на однотонном светлом фоне (или уже без фона).
    Маска — всё, что не фон, связанный с краями кадра; одна самая большая деталь, дырки внутри закрыты."""
    h, w = im.shape[:2]
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    border = np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])
    bg = np.median(border, 0)
    d = np.linalg.norm(lab - bg, axis=2)
    near = (d < 9).astype(np.uint8)
    reach = np.zeros((h, w), np.uint8)
    for (x, y) in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if near[y, x] and not reach[y, x]:
            tmp = near.copy(); mk = np.zeros((h + 2, w + 2), np.uint8); cv2.floodFill(tmp, mk, (x, y), 2); reach |= (tmp == 2)
    m = (1 - reach).astype(np.uint8)
    # светлая вещь на светлом фоне: часть вещи «похожа на фон» и отрезается. Уточняем GrabCut: явный фон — только очень
    # близкий к фону цвет у краёв, остальное решают цветовые модели вещи и фона
    if m.mean() > 0.03:
        gc = np.where(reach > 0, cv2.GC_PR_BGD, cv2.GC_PR_FGD).astype(np.uint8)
        gc[(reach > 0) & (d < 3)] = cv2.GC_BGD
        core = cv2.erode(m, np.ones((15, 15), np.uint8)); gc[core > 0] = cv2.GC_FGD
        gc[:, :2] = gc[:, -2:] = gc[:2] = gc[-2:] = cv2.GC_BGD
        k = 2 if h > 900 else 1
        g2 = cv2.resize(gc, (w // k, h // k), interpolation=cv2.INTER_NEAREST)
        try:
            cv2.grabCut(cv2.resize(im, (w // k, h // k)), g2, None, np.zeros((1, 65)), np.zeros((1, 65)), 5, cv2.GC_INIT_WITH_MASK)
            m2 = cv2.resize(((g2 == cv2.GC_FGD) | (g2 == cv2.GC_PR_FGD)).astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
            if m2.sum() >= m.sum() * 0.9: m = m2
        except cv2.error: pass
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, lab_, st, _ = cv2.connectedComponentsWithStats(m)
    if n > 1: m = (lab_ == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
    ff = m.copy(); cv2.floodFill(ff, None, (0, 0), 1); m = m | (1 - ff)
    return m
