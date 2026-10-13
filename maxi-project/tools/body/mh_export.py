#!/usr/bin/env python3
"""База тела для сайта: витринный манекен MakeHuman (CC0), который подстраивается под мерки прямо в браузере.

python3 mh_export.py MH_DATA OUT_DIR      (OUT_DIR — обычно public/body)

Пишет:
  mh.json      — описание: число узлов, порядок массивов, суставы, масштаб чисел
  mh_common.bin — треугольники (Uint16), части тела (Uint8), веса поворота рук и ног (разреженно)
  mh_m.bin, mh_f.bin — для мужской и женской фигуры (Int16, шаг 0.1 мм, метры): базовая форма (средний вес) и смещения:
      вес меньше / больше, обхват груди, талии, бёдер больше / меньше (цели MakeHuman measure-*-circ).
Всё в покое MakeHuman (A-поза); поза рук и ног, рост и подгонка обхватов — в браузере (src/shop/fitting/mh-body.js).
Голова гладкая (лица нет), глазницы и рот закрыты, соски и пупок сглажены — как у витринного манекена.
"""
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mh_body import load_obj, load_target, macro, neighbors, taubin, smooth_soft, weight_of, joint_pos

Q = 1e-4   # шаг чисел в файле (м)
JOINTS = [f'{b}.{s}____head' for s in 'LR' for b in ('clavicle', 'shoulder01', 'upperarm01', 'lowerarm01', 'wrist', 'upperleg01', 'foot')]


def sh_basis(u, L=4):
    x, y, z = u[:, 0], u[:, 1], u[:, 2]; B = [np.ones_like(x)]
    for l in range(2, L + 1):
        for i in range(l + 1):
            for j in range(l + 1 - i): B.append(x ** i * y ** j * z ** (l - i - j))
    return np.stack(B + [x, y, z], 1)


def boundary_loops(F):
    """края дыр: рёбра без пары, обход по свободным рёбрам (в вершине «восьмёрки» — по очереди)"""
    he = set((f[i], f[(i + 1) % len(f)]) for f in F for i in range(len(f))); out = {}
    for (a_, b_) in he:
        if (b_, a_) not in he: out.setdefault(a_, []).append(b_)
    loops = []
    while out:
        st = next(iter(out)); loop = [st]; x_ = st
        while True:
            nx = out[x_].pop()
            if not out[x_]: del out[x_]
            if nx == st: break
            loop.append(nx); x_ = nx
            if x_ not in out: loop = None; break
        if loop and len(loop) >= 3: loops.append(loop)
    return loops


class Topo:
    """общая для всех форм топология: какие грани у головы убраны (глазницы, рот), какие дыры закрыты веером"""
    def __init__(self, X, F, W, sk, n0):
        kids = {}
        for bn, bb in sk['bones'].items(): kids.setdefault(bb['parent'], []).append(bn)
        under = lambda bn: [bn] + [x for c in kids.get(bn, []) for x in under(c)]
        self.n0 = n0; self.used0 = sorted({i for f in F for i in f})
        isu = np.zeros(n0, bool); isu[self.used0] = True
        hj = np.clip(weight_of(W, under('head'), n0), 0, 1)
        self.k = np.clip((hj - 0.15) / 0.6, 0, 1) * isu; self.k = self.k * self.k * (3 - 2 * self.k); self.hd = (hj > 0.5) & isu
        self.toes = weight_of(W, [b for b in W if b.startswith('toe')], n0)
        self.torso = weight_of(W, ['breast.L', 'breast.R', 'spine01', 'spine02', 'spine03'], n0)
        self.br = weight_of(W, ['breast.L', 'breast.R'], n0)
        Xp, cen, co = self.head_proj(X)
        F = list(F); loops = []
        for _ in range(3):   # грани «изнанкой» к взгляду после переноса на поверхность — убрать, дыры — закрыть
            def bad(f):
                if self.k[f].min() < 0.6: return False
                a_, b_, c_ = Xp[f[0]], Xp[f[1]], Xp[f[2]]; nn = np.cross(b_ - a_, c_ - a_); l_ = np.linalg.norm(nn)
                if l_ < 1e-12: return True
                u_ = (a_ + b_ + c_) / 3 - cen; return nn @ u_ / l_ / np.linalg.norm(u_) < 0.35
            F = [f for f in F if (max(f) >= n0) or not bad(f)]
            for loop in boundary_loops(F):
                ci = n0 + len(loops); loops.append(loop)
                Xp = np.vstack([Xp, Xp[loop].mean(0)])
                for i in range(len(loop)): F.append([loop[(i + 1) % len(loop)], loop[i], ci])
        self.F, self.loops = F, loops; self.n = n0 + len(loops)
        self.used = sorted({i for f in F for i in f}); self.nb = neighbors(F, self.n)
        print('топология: дыр закрыто', len(loops), 'узлов', len(self.used), file=sys.stderr)

    def head_proj(self, X):
        hd, k = self.hd, self.k
        cen = (X[hd].min(0) + X[hd].max(0)) / 2; cen[1] -= 0.1   # единицы MH — дециметры
        U = X - cen; R = np.linalg.norm(U, axis=1); U = U / R[:, None]; fit = hd.copy()
        for _ in range(3):
            co = np.linalg.lstsq(sh_basis(U[fit]), R[fit], rcond=None)[0]; Rs = sh_basis(U) @ co; fit = hd & (R > Rs - 0.06)
        return X + (cen + U * Rs[:, None] - X) * k[:, None], cen, co

    def process(self, X):
        """форма MakeHuman (единицы MH, дециметры) → витринный манекен в метрах (покой, A-поза)"""
        X, cen, co = self.head_proj(X)
        Xa = np.vstack([X, np.array([X[l].mean(0) for l in self.loops])])
        k = np.r_[self.k, np.ones(len(self.loops))]; nb = self.nb; n = self.n
        surf = lambda P: cen + (P - cen) / np.linalg.norm(P - cen, axis=1)[:, None] * (sh_basis((P - cen) / np.linalg.norm(P - cen, axis=1)[:, None]) @ co)[:, None]
        # голова: сетку выравниваем по поверхности (среднее соседей → снова на поверхность) — без тонких складок у глаз и рта
        hv = np.array([i for i in np.where(k > 0.9)[0] if len(nb[i])], dtype=int)
        for _ in range(12):
            M = np.array([Xa[nb[i]].mean(0) for i in hv]); Xa[hv] = surf(M)
        Xa = smooth_soft(Xa, nb, np.clip(k * 1.2, 0, 1) * (k > 0.02), 8)
        pad = lambda w: np.r_[w, np.zeros(n - self.n0)]
        isu = np.zeros(n, bool); isu[self.used] = True
        Xa = taubin(Xa, nb, (pad(self.toes) > 0.3) & isu, 15)
        Xa = taubin(Xa, nb, (pad(self.torso) > 0.3) & isu, 3)
        br = pad(self.br); Xa = taubin(Xa, nb, (br > 0.25) & isu, 30)
        for sg in (1, -1):
            cand = np.where((br > 0.25) & (np.sign(Xa[:, 0]) == sg))[0]
            if not len(cand): continue
            tip = Xa[cand[np.argmax(Xa[cand, 2])]]; kn = np.exp(-np.sum((Xa - tip) ** 2, 1) / (2 * 0.5 ** 2))
            Xa = smooth_soft(Xa, nb, np.where(kn > 0.05, kn, 0), 90)
        Xa = taubin(Xa, nb, (pad(self.torso) > 0.3) & isu & (Xa[:, 2] > 0), 12)
        return Xa * 0.1


def main():
    D, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
    V0, F = load_obj(os.path.join(D, '3dobjs/base.obj')); n0 = len(V0)
    T = lambda p: load_target(os.path.join(D, 'targets', p), n0)
    sk = json.load(open(os.path.join(D, 'rigs/default.mhskel')))
    W = json.load(open(os.path.join(D, 'rigs/default_weights.mhw')))['weights']
    MUS = {'m': 0.55, 'f': 0.5}
    topo = Topo(macro(V0, T, 1.0, MUS['m'], 0.5), F, W, sk, n0)
    used = np.array(topo.used); remap = -np.ones(topo.n, int); remap[used] = np.arange(len(used)); nv = len(used)
    joints_of = lambda X: np.array([joint_pos(X, sk, j) for j in JOINTS]) * 0.1   # суставы — по вспомогательным точкам MH
    meas = ['bust', 'waist', 'hips']; names = ['base', 'wlo', 'whi'] + [f'{m}{s}' for m in meas for s in ('+', '-')]
    for sx, sv in (('m', 1.0), ('f', 0.0)):
        raw = {'base': macro(V0, T, sv, MUS[sx], 0.5), 'wlo': macro(V0, T, sv, MUS[sx], 0.0), 'whi': macro(V0, T, sv, MUS[sx], 1.0)}
        for m in meas:
            raw[m + '+'] = raw['base'] + T(f'measure/measure-{m}-circ-incr.target'); raw[m + '-'] = raw['base'] + T(f'measure/measure-{m}-circ-decr.target')
        P = {k: np.vstack([topo.process(v)[used], joints_of(v)]) for k, v in raw.items()}
        arrs = [P['base']] + [P[k] - P['base'] for k in names[1:]]
        buf = b''.join(np.clip(np.round(a / Q), -32767, 32767).astype('<i2').tobytes() for a in arrs)
        open(os.path.join(OUT, f'mh_{sx}.bin'), 'wb').write(buf)
        print(sx, 'КБ', len(buf) // 1024, 'макс. смещение (см):', {k: round(float(np.abs(P[k] - P['base']).max()) * 100, 1) for k in names[1:]}, file=sys.stderr)
    # треугольники
    tris = []
    for f in topo.F:
        f = [remap[i] for i in f]; tris += [f[0], f[1], f[2]] + ([f[0], f[2], f[3]] if len(f) == 4 else [])
    # веса поворота: ключица, плечо, плечевая кость, предплечье с кистью, нога (по сторонам)
    kids = {}
    for bn, bb in sk['bones'].items(): kids.setdefault(bb['parent'], []).append(bn)
    under = lambda bn: [bn] + [x for c in kids.get(bn, []) for x in under(c)]
    groups = {}
    for s in 'LR':
        groups[f'clav{s}'] = [f'clavicle.{s}']; groups[f'sh{s}'] = [f'shoulder01.{s}']
        groups[f'up{s}'] = [f'upperarm01.{s}', f'upperarm02.{s}']; groups[f'low{s}'] = under(f'lowerarm01.{s}'); groups[f'leg{s}'] = under(f'upperleg01.{s}')
    groups['breast'] = ['breast.L', 'breast.R']
    gw = {g: np.r_[weight_of(W, b, n0), np.zeros(topo.n - n0)][used] for g, b in groups.items()}
    wparts = []; wmeta = {}
    for g, w in gw.items():
        idx = np.where(w > 0.004)[0].astype('<u2'); ww = np.clip(np.round(w[idx] * 255), 0, 255).astype('u1')
        wmeta[g] = [len(idx)]; wparts += [idx.tobytes(), ww.tobytes()]
    # части тела: 0 туловище, 1 голова, 2 рука, 3 нога (для окраски тела под вещью и тела для ткани)
    arm = sum(gw[f'{g}{s}'] for g in ('up', 'low') for s in 'LR'); leg = gw['legL'] + gw['legR']
    hd = np.r_[topo.k, np.ones(topo.n - n0)][used]
    part = np.zeros(nv, 'u1'); part[hd > 0.5] = 1; part[arm > 0.5] = 2; part[leg > 0.5] = 3
    common = np.array(tris, '<u2').tobytes()
    if len(common) % 4: common += b'\0\0'
    common += part.tobytes()
    while len(common) % 4: common += b'\0'
    off_w = len(common); common += b''.join(wparts)
    open(os.path.join(OUT, 'mh_common.bin'), 'wb').write(common)
    meta = {'v': 1, 'nv': nv, 'nj': len(JOINTS), 'joints': JOINTS, 'q': Q, 'arrays': names, 'ntri': len(tris) // 3,
            'part_off': len(tris) * 2 + (2 if len(tris) % 2 else 0), 'w_off': off_w, 'groups': list(gw), 'gcount': [wmeta[g][0] for g in gw],
            'license': 'CC0 1.0 — основа: MakeHuman (makehumancommunity.org), обработка: tools/body/mh_export.py'}
    json.dump(meta, open(os.path.join(OUT, 'mh.json'), 'w'), ensure_ascii=False)
    print('общий КБ', len(common) // 1024, 'узлов', nv, 'треугольников', len(tris) // 3, file=sys.stderr)


if __name__ == '__main__':
    main()
