// Первый прототип расчёта ткани по силуэту фото (drapeGarment).
import * as THREE from 'three';
import {photoMat} from './cloth-material.js';
import {DRAPE_ON, makeCollider} from './collider.js';
import {armJ, noteAB} from './geometry.js';
import {bottomSpec, topSpec} from './specs.js';
import {fit} from './state.js';

// выкройка из сетки силуэта: точки внутри, связи, край (для шва)
function buildPattern(dr, step, close) {
  const gw = dr.gw, gh = dr.gh;
  let G = dr.grid.map(row => [...row].map(ch => ch === '1'));
  // щель между висящим рукавом и боком (на фото с вешалки) — закрыть: иначе под мышкой получится дыра
  if (close) { const R = close, dil = G.map((row, r) => row.map((_, c) => { for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) { const rr = r + a, cc = c + b; if (rr >= 0 && cc >= 0 && rr < gh && cc < gw && G[rr][cc]) return true; } return false; }));
    const A_ = dr.a, zone = (r, c) => { const v = (r + 0.5) / gh, du = Math.abs((c + 0.5) / gw - A_.cx); return v > A_.arm * 0.55 && v < A_.arm + 0.2 && du > A_.hw * 0.8 && du < A_.hw * 1.5; };
    G = dil.map((row, r) => row.map((v, c) => { if (G[r][c]) return true; if (!v || !zone(r, c)) return false;
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) { const rr = r + a, cc = c + b; if (rr >= 0 && cc >= 0 && rr < gh && cc < gw && !dil[rr][cc]) return false; } return true; })); }
  const inside = (r, c) => r >= 0 && c >= 0 && r < gh && c < gw && G[r][c];
  const idx = new Map(), pts = [];
  for (let r = 0; r < gh; r += step) for (let c = 0; c < gw; c += step) if (inside(r, c)) { idx.set(r * 10000 + c, pts.length); pts.push({r, c, u: (c + 0.5) / gw, v: (r + 0.5) / gh}); }
  const at = (r, c) => idx.get(r * 10000 + c);
  pts.forEach(p => { p.edge = [[-step, 0], [step, 0], [0, -step], [0, step]].some(([dr_, dc]) => at(p.r + dr_, p.c + dc) == null); });
  const tris = [];
  pts.forEach((p, i) => { const a = i, b = at(p.r, p.c + step), c = at(p.r + step, p.c), e = at(p.r + step, p.c + step);
    if (b != null && c != null && e != null) { tris.push(a, c, b, b, c, e); } else if (b != null && e != null) tris.push(a, e, b); else if (c != null && e != null) tris.push(a, c, e); else if (b != null && c != null) tris.push(a, c, b); });
  return {pts, at, tris, step};
}

export function drapeGarment(item, d, under) {
  const dr = item.drape && item.drape.front; if (!dr || !DRAPE_ON) return null;
  if (item.shape && (item.shape.worn || item.shape.merged)) return null;   // длинные рукава на вешалке слились с корпусом — выкройку рукава не выделить, пока старый способ   // силуэт с фото на человеке — не выкройка (ткань там уже обернула тело); пока старый способ
  const drB = item.drape.back || dr, H = d.H, k = item.kind, top = ['tee', 'sweater', 'hoodie', 'jacket', 'shirt'].includes(k);
  const pat = buildPattern(dr, 2, top && item.shape && item.shape.hang ? 3 : 0), np_ = pat.pts.length, a = dr.a;
  // масштаб выкройки (м на долю кадра): верх — длина и ширина корпуса по спецификации; низ — ширина пояса
  let Wr, Hr, yTop, sp;
  if (top) { sp = topSpec(item, d); Wr = sp.Fs[1] / (2 * a.hw); Hr = sp.L; yTop = 0.866 * H; }
  else { sp = bottomSpec(item, d); const row0 = dr.grid[1] || dr.grid[0], wpx = (row0.lastIndexOf('1') - row0.indexOf('1') + 1) / dr.gw; Wr = sp.ww / Math.max(0.1, wpx); Hr = Wr * dr.H / dr.W; yTop = sp.yW + 0.01; }
  // координаты выкройки в метрах: x вправо от середины, y вниз от верха
  const X = new Float32Array(np_), Y = new Float32Array(np_);
  pat.pts.forEach((p, i) => { X[i] = (p.u - a.cx) * Wr; Y[i] = p.v * Hr; });
  const j = armJ(d);
  if (top) {
    // рукава: повернуть к руке (на фото они торчат в стороны или висят на вешалке), у корпуса — плавно
    const hwR = a.hw * Wr, armY = a.arm * Hr;
    [-1, 1].forEach(side => {
      const S = {x: side * hwR, y: 0.04 * Hr}; let tip = null, far = 0;
      pat.pts.forEach((p, i) => { if (X[i] * side > hwR * 0.98 && Y[i] < armY + 0.05) { const dd = Math.hypot(X[i] - S.x, Y[i] - S.y); if (dd > far) { far = dd; tip = i; } } });
      if (tip == null) return;
      const cur = Math.atan2(Y[tip] - S.y, (X[tip] - S.x) * side), want = Math.PI / 2 - j.th - 0.06, da = (want - cur) * side;
      pat.pts.forEach((p, i) => { const ox = X[i] - S.x, oy = Y[i] - S.y; if (X[i] * side <= hwR * 0.9 || Y[i] > armY + 0.08) return;
        const w = Math.min(1, (X[i] * side - hwR * 0.9) / (0.06 + hwR * 0.1)), ang = da * w, c = Math.cos(ang), s = Math.sin(ang);
        X[i] = S.x + ox * c - oy * s; Y[i] = S.y + ox * s + oy * c; });
    });
  } else if (a.crotch != null) {
    // штанины лёжа расходятся «домиком» — поставить вертикально (поворот вокруг шага)
    const cy = a.crotch * Hr, ang = (item.shape && item.shape.leg_ang) || [0, 0];
    [-1, 1].forEach((side, si) => { const t = -(ang[si] || 0) * Math.PI / 180;
      pat.pts.forEach((p, i) => { if (Y[i] <= cy || X[i] * side < 0) return; const ox = X[i], oy = Y[i] - cy, w = Math.min(1, oy / 0.1), c = Math.cos(t * w), s = Math.sin(t * w); X[i] = ox * c - oy * s; Y[i] = cy + ox * s + oy * c; });
    });
  }
  // частицы: перед (z>0) и спинка (z<0); стартуют плоскими слоями снаружи фигуры
  const n = np_ * 2, P = new Float32Array(n * 3), V = new Float32Array(n * 3), pinY = new Uint8Array(n);
  const zOff = 0.24 * d.s;
  for (let i = 0; i < np_; i++) for (let l = 0; l < 2; l++) { const q = (i + l * np_) * 3; P[q] = X[i]; P[q + 1] = yTop - Y[i]; P[q + 2] = l ? -zOff : zOff; }
  // связи: растяжение (жёстко), сжатие (мягко — складки), изгиб (через точку)
  const E = [];
  const link = (i, j_, kind) => { if (i == null || j_ == null) return; for (let l = 0; l < 2; l++) E.push(i + l * np_, j_ + l * np_, Math.hypot(X[i] - X[j_], Y[i] - Y[j_]), kind); };
  const st = pat.step;
  pat.pts.forEach((p, i) => { link(i, pat.at(p.r, p.c + st), 0); link(i, pat.at(p.r + st, p.c), 0); link(i, pat.at(p.r + st, p.c + st), 1); link(pat.at(p.r, p.c + st), pat.at(p.r + st, p.c), 1);
    link(i, pat.at(p.r, p.c + 2 * st), 2); link(i, pat.at(p.r + 2 * st, p.c), 2); });
  // швы: край переда с краем спинки, кроме проёмов
  const isOpen = (p, i) => {
    if (top) {
      if (p.v < 0.08 && Math.abs(X[i]) < d.neck * 1.9) return true;                 // горловина
      if (p.v > 0.965) return true;                                                  // низ
      if (Math.abs(X[i]) > a.hw * Wr * 1.02 && Y[i] < a.arm * Hr + 0.1) {           // край рукава: дальняя от плеча часть
        const side = Math.sign(X[i]), dd = Math.hypot(X[i] - side * a.hw * Wr, Y[i]);
        return dd > FAR[side > 0 ? 1 : 0] - 0.035;
      }
      return false;
    }
    if (p.v < 0.04) return true;                                                     // пояс
    return p.v > 0.97;                                                               // низ штанин
  };
  const FAR = [0, 0]; if (top) pat.pts.forEach((q, t) => { if (Math.abs(X[t]) > a.hw * Wr) { const si = X[t] > 0 ? 1 : 0, sd = si ? 1 : -1; FAR[si] = Math.max(FAR[si], Math.hypot(X[t] - sd * a.hw * Wr, Y[t])); } });
  const seams = []; pat.pts.forEach((p, i) => { if (p.edge && !isOpen(p, i)) seams.push(i); });
  // пояс брюк держится на талии
  if (!top) pat.pts.forEach((p, i) => { if (p.v < 0.04) { pinY[i] = 1; pinY[i + np_] = 1; } });
  const push = makeCollider(d, under);
  const steps = 300, iters = 6, dt = 1 / 90, g = 9.8, hit = new Uint8Array(n);
  const solve = (i, j_, rest, ks, kc) => {
    const a3 = i * 3, b3 = j_ * 3, dx = P[b3] - P[a3], dy = P[b3 + 1] - P[a3 + 1], dz = P[b3 + 2] - P[a3 + 2], len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, diff = len - rest;
    const kk = diff > 0 ? ks : kc; if (!kk) return; const c = kk * diff / len * 0.5;
    const wy1 = pinY[i] ? 0 : 1, wy2 = pinY[j_] ? 0 : 1;
    P[a3] += dx * c; P[a3 + 1] += dy * c * wy1; P[a3 + 2] += dz * c;
    P[b3] -= dx * c; P[b3 + 1] -= dy * c * wy2; P[b3 + 2] -= dz * c;
  };
  const prev = new Float32Array(n * 3);
  for (let s = 0; s < steps; s++) {
    const ramp = Math.min(1, s / (steps * 0.35));
    prev.set(P);
    const gk = ramp < 1 ? 0 : Math.min(1, (s - steps * 0.35) / 20);                                   // пока шьём — почти без тяжести, иначе вещь упадёт мимо плеч
    for (let i = 0; i < n; i++) { const q = i * 3; if (!pinY[i]) V[q + 1] -= g * gk * dt; P[q] += V[q] * dt; P[q + 1] += V[q + 1] * dt; P[q + 2] += V[q + 2] * dt; if (pinY[i]) P[q + 1] = yTop; }
    for (let it = 0; it < iters; it++) {
      for (let e = 0; e < E.length; e += 4) { const kind = E[e + 3]; solve(E[e], E[e + 1], E[e + 2], kind === 2 ? 0.5 : 1, kind === 2 ? 0.2 : 0.03); }
      // шов стягивается постепенно: от исходного зазора к нулю
      for (const i of seams) { const a3 = i * 3, b3 = (i + np_) * 3, gx = P[b3] - P[a3], gy = P[b3 + 1] - P[a3 + 1], gz = P[b3 + 2] - P[a3 + 2], len = Math.hypot(gx, gy, gz) || 1e-6, rest = 2 * zOff * (1 - ramp) + 0.004, diff = len - rest;
        if (diff > 0) { const c = 0.5 * diff / len; P[a3] += gx * c; P[a3 + 1] += gy * c; P[a3 + 2] += gz * c; P[b3] -= gx * c; P[b3 + 1] -= gy * c; P[b3 + 2] -= gz * c; } }
      for (let i = 0; i < n; i++) { hit[i] = push(P, i * 3) ? 1 : hit[i]; if (pinY[i]) P[i * 3 + 1] = yTop; }
    }
    for (let i = 0; i < n * 3; i++) V[i] = (P[i] - prev[i]) / dt * 0.985;
    for (let i = 0; i < n; i++) if (hit[i]) { V[i * 3] *= 0.5; V[i * 3 + 1] *= 0.5; V[i * 3 + 2] *= 0.5; hit[i] = 0; }
  }
  // сгладить «лесенку» сетки: два прохода усреднения по соседям (форма сохраняется, мелкие зубцы уходят)
  { const nb = Array.from({length: n}, () => []); for (let e = 0; e < E.length; e += 4) if (E[e + 3] !== 2) { nb[E[e]].push(E[e + 1]); nb[E[e + 1]].push(E[e]); }
    for (const i of seams) { nb[i].push(i + np_); nb[i + np_].push(i); }
    for (let pass = 0; pass < 3; pass++) { const Q = P.slice(); for (let i = 0; i < n; i++) { const L = nb[i]; if (!L.length) continue; let x = 0, y = 0, z = 0; for (const t of L) { x += Q[t * 3]; y += Q[t * 3 + 1]; z += Q[t * 3 + 2]; } const w = 0.5;
      P[i * 3] = Q[i * 3] * (1 - w) + x / L.length * w; P[i * 3 + 1] = Q[i * 3 + 1] * (1 - w) + y / L.length * w; P[i * 3 + 2] = Q[i * 3 + 2] * (1 - w) + z / L.length * w; push(P, i * 3); } } }
  // слой для следующих вещей
  if (fit.UNDER) for (let i = 0; i < n; i++) { const yf = P[i * 3 + 1] / H; noteAB(yf, Math.abs(P[i * 3]) + 0.004, Math.abs(P[i * 3 + 2]) + 0.004); }
  // меш: перед и спинка со своими фото
  const g3 = new THREE.Group(), base = item.color || '#888';
  const sc = drB.a.hw && a.hw ? a.hw / drB.a.hw : 1;
  [0, 1].forEach(l => {
    const pos = new Float32Array(np_ * 3), uv = new Float32Array(np_ * 2);
    for (let i = 0; i < np_; i++) { const q = (i + l * np_) * 3; pos[i * 3] = P[q]; pos[i * 3 + 1] = P[q + 1]; pos[i * 3 + 2] = P[q + 2];
      const p = pat.pts[i]; let u = p.u; if (l) u = drB.a.cx - (p.u - a.cx) * sc;   // спинка на фото сзади — зеркально
      uv[i * 2] = u; uv[i * 2 + 1] = 1 - p.v; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(l ? pat.tris.slice() : pat.tris.slice()); geo.computeVertexNormals();
    const mat = photoMat(l ? (item.tex.backCut || item.tex.frontCut) : item.tex.frontCut, base); mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.userData.role = l ? 'back' : 'front'; g3.add(mesh);
  });
  return g3;
}
