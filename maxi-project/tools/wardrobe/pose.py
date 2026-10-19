#!/usr/bin/env python3
"""Поза человека на фото (MoveNet Thunder, 17 точек) и где руки закрывают вещь.

Модель: movenet_singlepose_thunder_4.onnx из репозитория Kazuhito00/MoveNet-Python-Example (папка onnx) →
tools/wardrobe/models/movenet_thunder.onnx (в .gitignore). Нет модели — функции возвращают None.

keypoints(im) → {имя: (x, y, уверенность)} в пикселях кадра;
arm_mask(im.shape, kp) → маска рук (плечо–локоть–запястье капсулами, кисть кружком);
occlusion(m, kp, shape) → доля корпуса вещи, закрытая руками спереди (руки поверх живота, в карманах, скрещены),
и маска этих мест. Рука, висящая сбоку, — это рукав, не помеха.
"""
import os
import numpy as np, cv2

NAMES = ['nose', 'eye_l', 'eye_r', 'ear_l', 'ear_r', 'sh_l', 'sh_r', 'el_l', 'el_r', 'wr_l', 'wr_r', 'hip_l', 'hip_r', 'kn_l', 'kn_r', 'an_l', 'an_r']
_S = None


def _sess():
    global _S
    if _S is None:
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models', 'movenet_thunder.onnx')
        if not os.path.exists(p): _S = False
        else:
            import onnxruntime as ort
            so = ort.SessionOptions(); so.intra_op_num_threads = 2
            _S = ort.InferenceSession(p, so, providers=['CPUExecutionProvider'])
    return _S or None


def keypoints(im):
    s = _sess()
    if s is None: return None
    h, w = im.shape[:2]; side = max(h, w)
    pad = np.zeros((side, side, 3), np.uint8); oy, ox = (side - h) // 2, (side - w) // 2; pad[oy:oy + h, ox:ox + w] = im
    x = cv2.resize(cv2.cvtColor(pad, cv2.COLOR_BGR2RGB), (256, 256)).astype(np.int32)[None]
    o = s.run(None, {'input': x})[0][0, 0]
    return {n: (float(o[i, 1] * side - ox), float(o[i, 0] * side - oy), float(o[i, 2])) for i, n in enumerate(NAMES)}


def _ok(kp, *names, t=0.25): return all(kp[n][2] >= t for n in names)


def arm_mask(shape, kp, t=0.25):
    h, w = shape[:2]; m = np.zeros((h, w), np.uint8)
    if not _ok(kp, 'sh_l', 'sh_r'): return m
    shw = np.hypot(kp['sh_l'][0] - kp['sh_r'][0], kp['sh_l'][1] - kp['sh_r'][1])
    for s in ('l', 'r'):
        pts = [kp[f'{j}_{s}'] for j in ('sh', 'el', 'wr')]
        for a, b, r in ((pts[0], pts[1], 0.17), (pts[1], pts[2], 0.14)):
            if a[2] >= t and b[2] >= t: cv2.line(m, (int(a[0]), int(a[1])), (int(b[0]), int(b[1])), 1, max(2, int(shw * r * 2)))
        if pts[2][2] >= t:   # кисть — дальше запястья по направлению предплечья
            e, wr = pts[1], pts[2]; d = np.array([wr[0] - e[0], wr[1] - e[1]]); d = d / (np.linalg.norm(d) + 1e-6)
            c = (int(wr[0] + d[0] * shw * 0.18), int(wr[1] + d[1] * shw * 0.18)); cv2.circle(m, c, int(shw * 0.2), 1, -1)
    return m


def torso_poly(kp, t=0.25):
    """четырёхугольник корпуса: плечи и бёдра (бёдер не видно — по длине корпуса ~1.5 ширины плеч)."""
    if not _ok(kp, 'sh_l', 'sh_r', t=t): return None
    sl, sr = np.array(kp['sh_l'][:2]), np.array(kp['sh_r'][:2]); shw = np.linalg.norm(sl - sr)
    if _ok(kp, 'hip_l', 'hip_r', t=t): hl, hr = np.array(kp['hip_l'][:2]), np.array(kp['hip_r'][:2])
    else:
        down = np.array([0, 1.5 * shw]); hl, hr = sl + down * 1.0 + (sr - sl) * 0.1, sr + down - (sr - sl) * 0.1
    return np.array([sl, sr, hr, hl], np.float32)


def occlusion(m, kp, shape):
    """доля корпуса вещи (внутри четырёхугольника плечи–бёдра, ужатого на 8% к середине), закрытая руками."""
    if kp is None: return None, None
    poly = torso_poly(kp)
    if poly is None: return None, None
    c = poly.mean(0); poly2 = c + (poly - c) * 0.92
    tm = np.zeros(shape[:2], np.uint8); cv2.fillPoly(tm, [poly2.astype(np.int32)], 1)
    body = (tm > 0) & (m > 0)
    if body.sum() < 500: return None, None
    occ = body & (arm_mask(shape, kp) > 0)
    return float(occ.sum() / body.sum()), occ


if __name__ == '__main__':
    import sys
    for p in sys.argv[1:]:
        im = cv2.imread(p); kp = keypoints(im)
        print(p, {k: tuple(round(v, 2) if i == 2 else int(v) for i, v in enumerate(x)) for k, x in kp.items() if x[2] > 0.25} if kp else None)
