#!/usr/bin/env python3
"""Витринный манекен из открытой модели тела MakeHuman (CC0): анатомия, мерки, руки опущены, лицо гладкое.

python3 mh_body.py MH_DATA OUT.json --sex m --height 186 --weight 83 --chest 110 --waist 82 --hips 98
MH_DATA — папка makehuman/data из https://github.com/makehumancommunity/makehuman (нужны 3dobjs/base.obj,
rigs/default.mhskel, rigs/default_weights.mhw, targets/macrodetails, targets/measure).
Выход — JSON {p: [x,y,z...] в метрах, i: [треугольники], y-вверх, лицом к +z, пол на y=0}.
"""
import argparse, json, os, sys
import numpy as np

ARM_A = 0.16   # угол руки от вертикали (рад) — как у прежнего манекена (body.js armPose)


def load_obj(path):
    V, F, grp = [], [], None
    for l in open(path):
        if l.startswith('v '): V.append([float(t) for t in l.split()[1:4]])
        elif l.startswith('g '): grp = l.split()[1]
        elif l.startswith('f ') and grp == 'body': F.append([int(t.split('/')[0]) - 1 for t in l.split()[1:]])
    return np.array(V), F


def load_target(path, n):
    D = np.zeros((n, 3))
    for l in open(path):
        if l.startswith('#') or not l.strip(): continue
        t = l.split(); D[int(t[0])] = [float(t[1]), float(t[2]), float(t[3])]
    return D


def tri(v, lo, hi):
    """доли трёх узлов слайдера MakeHuman: v=0 → lo, 0.5 → среднее, 1 → hi"""
    if v < 0.5: return {lo: 1 - 2 * v, 'average': 2 * v}
    return {'average': 2 - 2 * v, hi: 2 * v - 1}


def macro(V, T, sex, muscle, weight):
    """универсальные цели MakeHuman (молодой возраст, 25 лет): пол × мускулатура × вес"""
    gen = {'female': 1 - sex, 'male': sex}
    mus, wei = tri(muscle, 'min', 'max'), tri(weight, 'min', 'max')
    out = V.copy()
    for g, wg in gen.items():   # пол: этническая цель с полом и возрастом (европейский тип) — от неё мужская/женская форма
        if wg > 1e-6: out += wg * T(f'macrodetails/caucasian-{g}-young.target')
    for g, wg in gen.items():
        for m, wm in mus.items():
            for w, ww in wei.items():
                k = wg * wm * ww
                if k < 1e-6: continue
                out += k * T(f'macrodetails/universal-{g}-young-{m}muscle-{w}weight.target')
    return out


def hull_perim(pts):
    if len(pts) < 3: return 0.0
    P = sorted(map(tuple, pts))
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in P:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(P):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    H = np.array(lo[:-1] + up[:-1]); return float(np.sum(np.linalg.norm(H - np.roll(H, -1, 0), axis=1)))


def section(V, E, y, xmax):
    """точки сечения поверхности плоскостью y (рёбра сетки), |x| < xmax — без рук"""
    a, b = V[E[:, 0]], V[E[:, 1]]
    s = (a[:, 1] - y) * (b[:, 1] - y) < 0
    a, b = a[s], b[s]; t = (y - a[:, 1]) / (b[:, 1] - a[:, 1]); p = a + (b - a) * t[:, None]
    p = p[np.abs(p[:, 0]) < xmax]; return p[:, [0, 2]]


def girths(V, E, H, xmax):
    ys = lambda a, b: np.linspace(a * H, b * H, 24)
    g = lambda y: hull_perim(section(V, E, y, xmax))
    ch = max((g(y), y) for y in ys(0.68, 0.76))
    wa = min((g(y), y) for y in ys(0.58, 0.66))
    hi = max((g(y), y) for y in ys(0.47, 0.55))
    girths.lv = {'chest': ch[1] / H, 'waist': wa[1] / H, 'hips': hi[1] / H}   # на какой доле роста
    return {'chest': ch[0], 'waist': wa[0], 'hips': hi[0]}


def joint_pos(V, sk, name):
    return V[sk['joints'][name]].mean(0)


def rodrigues(axis, ang):
    k = axis / (np.linalg.norm(axis) + 1e-12); K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + np.sin(ang) * K + (1 - np.cos(ang)) * K @ K


def skin(V, sk, W, shares, axis, ang):
    """поворот цепочки костей (линейное скиннинг-смешивание): кость n из shares поворачивается на долю угла вокруг своей головы,
    дочерние кости — вместе с родителем. Возвращает новые точки (все узлы, включая вспомогательные суставы)"""
    bones = sk['bones']; kids = {}
    for n, b in bones.items(): kids.setdefault(b['parent'], []).append(n)
    root = next(n for n in shares if bones[n]['parent'] not in shares)
    T = {}
    def walk(n, M):
        if n in shares:
            R = rodrigues(axis, ang * shares[n]); p = joint_pos(V, sk, bones[n]['head'])
            L = np.eye(4); L[:3, :3] = R; L[:3, 3] = p - R @ p; M = M @ L
        T[n] = M
        for c in kids.get(n, []): walk(c, M)
    walk(root, np.eye(4))
    acc = np.zeros_like(V)
    for n, M in T.items():
        if n not in W: continue
        idx = np.array([i for i, _ in W[n]]); w = np.array([x for _, x in W[n]])
        p = V[idx] @ M[:3, :3].T + M[:3, 3]
        np.add.at(acc, idx, (p - V[idx]) * w[:, None])
    # вспомогательные точки суставов (без весов) — вместе с костью, к которой относятся
    for jn, ids in sk['joints'].items():
        bn = jn.split('____')[0]
        if bn in T and not any(i in set(x for x, _ in W.get(bn, [])) for i in ids[:1]):
            M = T[bn] if not jn.endswith('head') or bones[bn]['parent'] not in T else T[bones[bn]['parent']]
            ids = np.array(ids); acc[ids] = V[ids] @ M[:3, :3].T + M[:3, 3] - V[ids]
    return V + acc


def align(V, sk, W, shares, j0, j1, want, iters=3):
    """повернуть цепочку так, чтобы направление сустав j0 → j1 стало want"""
    for _ in range(iters):
        a = joint_pos(V, sk, j1) - joint_pos(V, sk, j0); a /= np.linalg.norm(a); w = want / np.linalg.norm(want)
        ang = np.arccos(np.clip(a @ w, -1, 1))
        if ang < 1e-3: break
        V = skin(V, sk, W, shares, np.cross(a, w), ang)
    return V


def pose(V, sk, W, H, legx):
    """витринная поза: руки опущены вдоль тела (угол ARM_A от вертикали, локоть чуть согнут), стопы под бёдрами"""
    for sd, sg in (('L', 1), ('R', -1)):
        V = align(V, sk, W, {f'clavicle.{sd}': 0.1, f'shoulder01.{sd}': 0.25, f'upperarm01.{sd}': 0.65}, f'upperarm01.{sd}____head', f'lowerarm01.{sd}____head', np.array([sg * np.sin(ARM_A), -np.cos(ARM_A), -0.04]))
        V = align(V, sk, W, {f'lowerarm01.{sd}': 1.0}, f'lowerarm01.{sd}____head', f'wrist.{sd}____head', np.array([sg * np.sin(ARM_A * 0.6), -1, 0.1]))
        hip = joint_pos(V, sk, f'upperleg01.{sd}____head'); ank = joint_pos(V, sk, f'foot.{sd}____head')
        V = align(V, sk, W, {f'upperleg01.{sd}': 1.0}, f'upperleg01.{sd}____head', f'foot.{sd}____head', np.array([sg * legx - hip[0], ank[1] - hip[1], 0.0]))
    return V


def neighbors(F, n):
    nb = [set() for _ in range(n)]
    for f in F:
        for k in range(len(f)): a, b = f[k], f[(k + 1) % len(f)]; nb[a].add(b); nb[b].add(a)
    return [np.array(sorted(s), dtype=int) for s in nb]


def taubin(V, nb, mask, iters, lam=0.5, mu=-0.53):
    V = V.copy(); idx = np.where(mask)[0]
    for _ in range(iters):
        for f in (lam, mu):
            L = np.array([V[nb[i]].mean(0) - V[i] if len(nb[i]) else np.zeros(3) for i in idx])
            V[idx] += f * L
    return V


def smooth_soft(V, nb, k, iters):
    """сглаживание с весом k по точке (0 — стоит, 1 — полностью): черты лица уходят, край области без шва"""
    V = V.copy(); idx = np.array([i for i in np.where(k > 0)[0] if len(nb[i])], dtype=int); kk = k[idx][:, None]
    for _ in range(iters):
        L = np.array([V[nb[i]].mean(0) - V[i] for i in idx]); V[idx] += 0.5 * kk * L
    return V


def weight_of(W, names, n):
    w = np.zeros(n)
    for b in names:
        for i, x in W.get(b, []): w[i] += x
    return np.clip(w, 0, 1)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('mh'); ap.add_argument('out')
    ap.add_argument('--sex', default='m'); ap.add_argument('--height', type=float, default=176)
    ap.add_argument('--weight', type=float, default=0); ap.add_argument('--chest', type=float, default=0)
    ap.add_argument('--waist', type=float, default=0); ap.add_argument('--hips', type=float, default=0)
    ap.add_argument('--obj', default='')
    a = ap.parse_args(); D = a.mh
    V0, F = load_obj(os.path.join(D, '3dobjs/base.obj')); n = len(V0)
    T = lambda p: load_target(os.path.join(D, 'targets', p), n)
    sk = json.load(open(os.path.join(D, 'rigs/default.mhskel')))
    W = json.load(open(os.path.join(D, 'rigs/default_weights.mhw')))['weights']
    sex = 1.0 if a.sex == 'm' else 0.0
    bmi = a.weight / (a.height / 100) ** 2 if a.weight else 22
    weight01 = float(np.clip(0.5 + (bmi - 22) / 16, 0, 1))
    V = macro(V0, T, sex, 0.55 if sex else 0.5, weight01)
    used = sorted({i for f in F for i in f}); ymin = V[used, 1].min(); ymax = V[used, 1].max()
    s = a.height / 100 / (ymax - ymin)
    sc = lambda X: (X - [0, ymin, 0]) * s
    E = np.array(sorted({(min(f[k], f[(k + 1) % len(f)]), max(f[k], f[(k + 1) % len(f)])) for f in F for k in range(len(f))}))
    H = a.height / 100
    # плечевые суставы — граница «без рук» для замеров в A-позе
    xmax = lambda X: 0.85 * abs(joint_pos(X, sk, 'upperarm01.L____head')[0])
    want = {k: getattr(a, k) / 100 for k in ('chest', 'waist', 'hips') if getattr(a, k)}
    tg = {'chest': 'measure/measure-bust-circ', 'waist': 'measure/measure-waist-circ', 'hips': 'measure/measure-hips-circ'}
    dT = {k: T(tg[k] + '-incr.target') - 0 for k in want}; dTm = {k: T(tg[k] + '-decr.target') for k in want}
    w = {k: 0.0 for k in want}
    def apply(w):
        X = V.copy()
        for k, x in w.items(): X += (x * dT[k] if x >= 0 else -x * dTm[k])
        return X
    for it in range(6):
        X = sc(apply(w)); g = girths(X, E, H, xmax(X))
        err = {k: want[k] - g[k] for k in want}
        if not want or max(abs(e) for e in err.values()) < 0.003: break
        # якобиан численно
        J = np.zeros((len(want), len(want))); ks = list(want)
        for j, k in enumerate(ks):
            w2 = dict(w); w2[k] += 0.1; g2 = girths(sc(apply(w2)), E, H, xmax(X))
            for i, kk in enumerate(ks): J[i, j] = (g2[kk] - g[kk]) / 0.1
        dw = np.linalg.lstsq(J, np.array([err[k] for k in ks]), rcond=None)[0]
        for j, k in enumerate(ks): w[k] = float(np.clip(w[k] + dw[j], -1.5, 1.5))
    X = sc(apply(w)); g = girths(X, E, H, xmax(X))
    print('мерки:', {k: round(v * 100, 1) for k, v in g.items()}, 'цели:', {k: round(v * 100, 1) for k, v in want.items()}, 'веса:', {k: round(v, 2) for k, v in w.items()}, 'уровни:', {k: round(v, 3) for k, v in girths.lv.items()}, file=sys.stderr)
    X = pose(X, sk, W, H, 0.055 * H)
    for sd in 'LR':
        sh = joint_pos(X, sk, f'upperarm01.{sd}____head'); el = joint_pos(X, sk, f'lowerarm01.{sd}____head')
        print('рука', sd, 'угол от вертикали', round(float(np.degrees(np.arctan2(abs(el[0] - sh[0]), sh[1] - el[1]))), 1), file=sys.stderr)
    # витринный манекен: лицо, соски, пальцы ног — гладкие
    nb = neighbors(F, n)
    face = weight_of(W, [b for b in W if any(t in b for t in ('jaw', 'eye', 'lid', 'tongue', 'levator', 'oris', 'nose', 'cheek', 'temporalis', 'risorius', 'mouth'))], n)
    head = weight_of(W, ['head'], n)
    hc = joint_pos(X, sk, 'head____head')
    # голова витринного манекена: радиус головы по направлениям сглажен сферическими гармониками до 4-го порядка —
    # остаётся форма черепа, челюсти и подбородка, уходят нос, губы, глаза, уши (впадины глаз и рта — на поверхность)
    kids = {}
    for bn, bb in sk['bones'].items(): kids.setdefault(bb['parent'], []).append(bn)
    def under(bn): return [bn] + [x for c in kids.get(bn, []) for x in under(c)]
    hj = np.clip(weight_of(W, under('head'), n), 0, 1)   # голова и всё лицо (веки, губы, челюсть, глаза)
    isu = np.isin(np.arange(n), used); hd = (hj > 0.5) & isu
    cen = (X[hd].min(0) + X[hd].max(0)) / 2; cen[1] -= 0.01 * H / 1.8
    def sh_basis(u, L=4):
        x, y, z = u[:, 0], u[:, 1], u[:, 2]; B = [np.ones_like(x)]
        P = [x, y, z]
        for l in range(2, L + 1):   # полиномы по x, y, z степени l (их линейная оболочка содержит гармоники порядка ≤ L)
            for i in range(l + 1):
                for j in range(l + 1 - i): B.append(x ** i * y ** j * z ** (l - i - j))
        return np.stack(B + P, 1)
    U = X - cen; R = np.linalg.norm(U, axis=1); U /= R[:, None]
    fit = hd.copy()
    for _ in range(3):
        co = np.linalg.lstsq(sh_basis(U[fit]), R[fit], rcond=None)[0]; Rs = sh_basis(U) @ co
        fit = hd & (R > Rs - 0.006)   # впадины (глаза, рот внутри) не тянут форму внутрь
    k = np.clip((hj - 0.15) / 0.6, 0, 1) * isu; k = k * k * (3 - 2 * k)
    X = X + (cen + U * Rs[:, None] - X) * k[:, None]
    # глазницы, веки и рот: после переноса на поверхность их грани лежат «изнанкой» или ребром к взгляду — убираем такие
    # грани (только там, где голова полностью гладкая), края дыр закрываем веером из новой точки на поверхности головы
    X = list(X); holes = 0
    for _ in range(3):
        Xa = np.array(X); kk = np.r_[k, np.ones(len(Xa) - len(k))]
        def bad(f):
            if kk[f].min() < 0.6: return False
            a_, b_, c_ = Xa[f[0]], Xa[f[1]], Xa[f[2]]; nn = np.cross(b_ - a_, c_ - a_); l_ = np.linalg.norm(nn)
            if l_ < 1e-12: return True
            u_ = (a_ + b_ + c_) / 3 - cen; return nn @ u_ / l_ / np.linalg.norm(u_) < 0.35
        F = [f for f in F if not bad(f)]
        he = set((f[i], f[(i + 1) % len(f)]) for f in F for i in range(len(f)))
        nxt = {}
        for (a_, b_) in he:
            if (b_, a_) not in he: nxt.setdefault(a_, b_)
        seen = set()
        for st in list(nxt):
            if st in seen: continue
            loop = [st]; seen.add(st); x_ = nxt[st]
            while x_ != st and x_ in nxt and x_ not in seen: loop.append(x_); seen.add(x_); x_ = nxt[x_]
            if x_ != st or len(loop) < 3: continue
            P_ = np.array([X[i] for i in loop]); c_ = P_.mean(0); u_ = c_ - cen; u_ /= np.linalg.norm(u_)
            r_ = (sh_basis(u_[None]) @ co)[0]; X.append(cen + u_ * r_); ci = len(X) - 1; holes += 1
            for i in range(len(loop)): F.append([loop[(i + 1) % len(loop)], loop[i], ci])
    X = np.array(X); n = len(X); used = sorted({i for f in F for i in f})
    k = np.r_[k, np.ones(n - len(k))]; nb = neighbors(F, n)
    print('закрыто дыр (глаза, рот):', holes, file=sys.stderr)
    X = smooth_soft(X, nb, np.clip(k * 1.2, 0, 1) * (k > 0.02), 8)
    toes = np.r_[weight_of(W, [b for b in W if b.startswith('toe')], len(V0)), np.zeros(n - len(V0))]; X = taubin(X, nb, (toes > 0.3) & np.isin(np.arange(n), used), 15)
    torso = np.r_[weight_of(W, ['breast.L', 'breast.R', 'spine01', 'spine02', 'spine03'], len(V0)), np.zeros(n - len(V0))]; X = taubin(X, nb, (torso > 0.3) & np.isin(np.arange(n), used), 3)
    # соски и пупок у витринного манекена гладкие: мягкое сглаживание с сохранением формы груди и живота
    br = np.r_[weight_of(W, ['breast.L', 'breast.R'], len(V0)), np.zeros(n - len(V0))]; X = taubin(X, nb, (br > 0.25) & np.isin(np.arange(n), used), 30)
    for sg in (1, -1):   # сосок — самая выступающая вперёд точка груди; вокруг (радиус ~3.5 см) сглаживаем сильнее
        cand = np.where((br > 0.25) & (np.sign(X[:, 0]) == sg))[0]
        if not len(cand): continue
        tip = X[cand[np.argmax(X[cand, 2])]]; kn = np.exp(-np.sum((X - tip) ** 2, 1) / (2 * (0.035 * H / 1.75) ** 2))
        X = smooth_soft(X, nb, np.where(kn > 0.05, kn, 0), 40)
    X = taubin(X, nb, (torso > 0.3) & np.isin(np.arange(n), used) & (X[:, 2] > 0), 12)
    # нормали: по сетке (по площади граней), на голове — по гладкой поверхности (тонкие складки сетки у глаз и рта не видны)
    Nm = np.zeros_like(X)
    for f in F:
        for t_ in ([f[0], f[1], f[2]], [f[0], f[2], f[3]]) if len(f) == 4 else ([f[0], f[1], f[2]],):
            nn = np.cross(X[t_[1]] - X[t_[0]], X[t_[2]] - X[t_[0]]); Nm[t_] += nn
    Nm /= np.linalg.norm(Nm, axis=1)[:, None] + 1e-12
    surf = lambda u: cen + u * (sh_basis(u) @ co)[:, None]
    hv = np.where(k > 0.02)[0]; u0 = X[hv] - cen; u0 /= np.linalg.norm(u0, axis=1)[:, None]
    t1 = np.cross(u0, [0, 1, 0]); t1 /= np.linalg.norm(t1, axis=1)[:, None] + 1e-9; t2 = np.cross(u0, t1); e_ = 1e-3
    nh = np.cross(surf(u0 + e_ * t1) - surf(u0 - e_ * t1), surf(u0 + e_ * t2) - surf(u0 - e_ * t2)); nh /= np.linalg.norm(nh, axis=1)[:, None]
    nh *= np.sign(np.sum(nh * u0, 1))[:, None]
    kw = np.clip(k[hv] * 1.5, 0, 1)[:, None]; Nm[hv] = Nm[hv] * (1 - kw) + nh * kw; Nm /= np.linalg.norm(Nm, axis=1)[:, None] + 1e-12
    # компактная сетка: только узлы тела
    remap = -np.ones(n, int); remap[used] = np.arange(len(used))
    tris = []
    for f in F:
        f = [remap[i] for i in f]; tris += [f[0], f[1], f[2]] + ([f[0], f[2], f[3]] if len(f) == 4 else [])
    P = X[used]
    json.dump({'p': [round(float(v), 4) for v in P.ravel()], 'n': [round(float(v), 3) for v in Nm[used].ravel()], 'i': [int(t) for t in tris], 'girth': {k: round(v * 100, 1) for k, v in g.items()}}, open(a.out, 'w'), separators=(',', ':'))
    if a.obj:
        with open(a.obj, 'w') as o:
            for p in P: o.write('v %.4f %.4f %.4f\n' % tuple(p))
            for t in range(0, len(tris), 3): o.write('f %d %d %d\n' % (tris[t] + 1, tris[t + 1] + 1, tris[t + 2] + 1))
    print('узлов', len(P), 'треугольников', len(tris) // 3, file=sys.stderr)


if __name__ == '__main__':
    main()
