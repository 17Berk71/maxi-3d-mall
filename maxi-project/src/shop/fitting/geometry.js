// Геометрия для посадки: сечения тела, эллипсы по периметру, кольца, трубы, изнанка.
import * as THREE from 'three';
import {armX, sx, sz, torsoR} from './body.js';
import {uget, ui} from './simple-garment.js';
import {fit} from './state.js';

// UV половины лофта. Вещь на фото лежит или висит плоско, ширина на фото — половина обхвата,
// поэтому u растёт по дуге (линейно по углу): перед — от правого бока (−90°) к левому (+90°),
// спина — на фото сзади видна зеркально (слева на фото — левый бок человека, +x)
export const uFront = ph => 0.5 + Math.max(-Math.PI / 2, Math.min(Math.PI / 2, ph)) / Math.PI;
const uBack = ph => { const ps = ph > 0 ? ph - Math.PI : ph + Math.PI; return 0.5 + Math.max(-Math.PI / 2, Math.min(Math.PI / 2, ps)) / Math.PI; };
// ---------- посадка вещи по её собственному силуэту ----------
// Вещь — не «кожа» фигуры. С фото берётся силуэт: ширина корпуса по высоте, длина, рукав; у брюк — ширина штанины
// вдоль её оси. Сечение вещи — эллипс с периметром = 2 × ширина лёжа (вещь лёжа — две половины обхвата).
// Тело только ограничивает снизу: вещь не может быть уже тела и нижних слоёв. Где ткани больше, чем тела, она
// висит: прямо от плеч и груди, складками; у широких брюк — трубой до пола, лишняя длина собирается внизу.
export const ellP = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
export function solve(f, lo, hi, target) { for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(m) < target) lo = m; else hi = m; } return (lo + hi) / 2; }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export function interp(arr, t) { t = clamp(t, 0, 1) * (arr.length - 1); const i = Math.min(arr.length - 2, Math.floor(t)), f = t - i; return arr[i] + (arr[i + 1] - arr[i]) * f; }
// сечение тела на высоте yf: полуширина a и полуглубина b (как у фигуры), с плечевым «шаром»
export function bodyAB(d, yf) {
  if (d.mh) { const T = d.mh, k = Math.max(0, Math.min(T.N - 1, Math.floor(yf * T.N)));
    if (T.A[k]) { const a = T.A[k], b = T.B[k], f = T.G[k] / ellP(a, b); return {a: a * f, b: b * f}; }   // тот же обхват, что у тела (по ленте)
    const l = T.LEQ[k] || d.thigh; return {a: Math.abs(T.LC[k * 4]) + l, b: l}; }
  let r = yf < 0.53 ? Math.max(torsoR(d, Math.max(0.47, yf)), d.hips * (yf < 0.5 ? 0.99 : 0.97)) : torsoR(d, yf);
  let a = r * (sx(d, Math.max(0.6, yf)) * 0.98 + 0.02), b = r * (sz(d, yf) + (yf < 0.6 ? 0.04 : 0));
  const dy = (yf - 0.8) * d.H / (d.chest * 0.42);
  if (Math.abs(dy) < 1) { const k = Math.sqrt(1 - dy * dy); a = Math.max(a, Math.max(d.chest * d.shX * 0.98, armX(d) + 0.02) * k); b = Math.max(b, d.chest * 0.62 * k); }
  if (yf < 0.47) { a = Math.max(a, d.legX + d.thigh); b = Math.max(b, d.thigh); }
  return {a, b};
}
// верх плеч на расстоянии x от середины (манекен по сетке — по точкам тела, иначе — по прежней фигуре: шар плеч и рука)
export function shTopAt(d, x) {
  const T = d.mh, ax = Math.abs(x); if (!T) return null;
  const f = ax / T.shBin - 0.5, i = Math.max(0, Math.min(T.shTop.length - 2, Math.floor(f))), a = T.shTop[i], b = T.shTop[i + 1];
  if (!b) { let j = i; while (j > 0 && !T.shTop[j]) j--; return T.shTop[j] - Math.max(0, ax - (j + 0.5) * T.shBin) * 1.2; }
  return a + (b - a) * Math.max(0, Math.min(1, f - i));
}
// рука: ось от плечевого сустава под углом armA, радиус по длине
export const armJ = d => d.mh ? (g => ({x: g.x0, y: g.y0, z: g.z0, dz: g.dz, L: d.mh.arms[0].Lu + d.mh.arms[0].Ll, th: Math.atan2(Math.abs(g.dx), -g.dy)}))(d.mh.arms[0].segs[0]) /* по оси плечевого звена (подогнана по сечениям руки) */ : {x: armX(d), y: 0.8 * d.H, L: 0.335 * d.H, th: d.armA || 0.16};
export const armRad = (d, t) => d.mh ? (A => { const s = Math.max(0, Math.min(1, t)) * (A.Lu + A.Ll), g = s < A.Lu ? A.segs[0] : A.segs[1], u = s < A.Lu ? s / A.Lu : (s - A.Lu) / g.L; return g.rad[Math.min(15, Math.floor(u * 16))]; })(d.mh.arms[0]) : (t < 0.12 ? 0.052 : t < 0.47 ? 0.046 - (t - 0.12) * 0.034 : 0.035 - (t - 0.47) * 0.018) * d.k * d.s;
export function armInner(d, y) {
  const j = armJ(d), dy = j.y - y; if (dy < 0.05 || dy > j.L * Math.cos(j.th) + 0.08) return 9;
  return j.x + dy * Math.tan(j.th) - armRad(d, dy / (j.L * Math.cos(j.th))) / Math.cos(j.th) - 0.004;
}
// подобрать эллипс по периметру: сначала пропорция ρ, потом ограничения (тело, нижние слои, руки)
export function fitAB(P, amin, bmin, amax, rho) {
  let a = solve(x => ellP(x, x * rho), 0.01, 1.2, P), b = a * rho;
  if (a > amax) { a = Math.max(amax, amin); b = solve(x => ellP(a, x), 0.005, 1.2, P); }
  if (b < bmin) { b = bmin; a = Math.max(amin, Math.min(amax, solve(x => ellP(x, b), 0.005, 1.2, P))); }
  if (a < amin) { a = amin; b = Math.max(bmin, solve(x => ellP(a, x), 0.005, 1.2, P)); }
  return [a, Math.max(b, bmin)];
}
// слои: ширина/глубина надетых ниже вещей по высоте (1% роста)
export function layerAB(yf, a, b, gap) {
  if (fit.UNDER) { const u = uget(fit.UNDER, yf), uz = uget(fit.UNDERZ, yf), g = gap == null ? 0.008 : gap; if (u) a = Math.max(a, u + g); if (uz) b = Math.max(b, uz + g); const i = ui(yf); fit.PEND[i] = Math.max(fit.PEND[i] || 0, a); fit.PENDZ[i] = Math.max(fit.PENDZ[i] || 0, b); }
  return [a, b];
}
export function noteAB(yf, a, b) { if (!fit.UNDER) return; const i = ui(yf); fit.PEND[i] = Math.max(fit.PEND[i] || 0, a); fit.PENDZ[i] = Math.max(fit.PENDZ[i] || 0, b); }
// складки: смещение по нормали, амплитуда A (м); узор свой у каждой вещи (seed)
function foldAt(phi, y, A, seed) {
  if (A <= 0) return 0;
  return A * (0.5 * Math.sin(7 * phi + seed + 1.7 * Math.sin(y * 7 + seed)) + 0.32 * Math.sin(12 * phi + seed * 2.3 + y * 11) + 0.18 * Math.sin(19 * phi + y * 23 + seed * 0.7));
}
// поверхность из колец {y, a, b, f(складки), cx}: φ от φ0 на длину φL; uvf(φ, кольцо, доля по φ) → [u, v]
export function ringMesh(rings, phi0, phiL, segs, uvf, seed, gapf) {
  const n = rings.length, cols = segs + 1, pos = new Float32Array(n * cols * 3), uv = new Float32Array(n * cols * 2), idx = [];
  rings.forEach((r, i) => {
    for (let j = 0; j < cols; j++) {
      const t = j / segs; let p0 = phi0, pl = phiL;
      if (gapf) { const g = gapf(r); if (phi0 < 0) pl = phiL - g; else { p0 = phi0 + g; pl = phiL - g; } }
      const phi = p0 + pl * t, f = foldAt(phi, r.y, r.f || 0, seed) * (r.fk ? r.fk(phi) : 1);
      const x = (r.cx || 0) + (r.a + f) * Math.sin(phi), z = (r.b + f) * Math.cos(phi);
      let y = r.y; if (r.dy) y += r.dy(phi);
      const k = (i * cols + j); pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      const [u, v] = uvf(phi, r, t); uv[k * 2] = u; uv[k * 2 + 1] = 1 - clamp(v, 0, 1);
    }
  });
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < segs; j++) { const a = i * cols + j, b = a + 1, c = a + cols, e = c + 1; idx.push(a, b, c, b, e, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// труба вдоль оси (рукав): от S0 по направлению D, профиль rad(s) (s — метры от S0), складки
export function tubeMesh(S0, D, len, rad, segs, rings, uvf, foldf, side, cap) {
  cap = cap || 0.035;
  const e1 = new THREE.Vector3(-D.y, D.x, 0).normalize().multiplyScalar(side || 1), e2 = new THREE.Vector3(0, 0, 1);
  const cols = segs + 1, pos = new Float32Array(rings * cols * 3), uv = new Float32Array(rings * cols * 2), idx = [];
  for (let i = 0; i < rings; i++) {
    const s = -cap + (len + cap) * i / (rings - 1), C = S0.clone().addScaledVector(D, s), r = rad(s);
    for (let j = 0; j < cols; j++) {
      const ps = j / segs * Math.PI * 2, f = foldf ? foldf(ps, s) : 0, rr = r + f;
      const P = C.clone().addScaledVector(e1, Math.cos(ps) * rr).addScaledVector(e2, Math.sin(ps) * rr), k = i * cols + j;
      pos[k * 3] = P.x; pos[k * 3 + 1] = P.y; pos[k * 3 + 2] = P.z;
      const [u, v] = uvf(ps, s); uv[k * 2] = u; uv[k * 2 + 1] = 1 - clamp(v, 0, 1);
    }
  }
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < segs; j++) { const a = i * cols + j, b = a + 1, c = a + cols, e = c + 1; idx.push(a, c, b, b, c, e); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  // нормали наружу: если вышло внутрь — перевернуть треугольники
  const N = g.attributes.normal, mid = Math.floor(rings / 2) * cols, Pm = new THREE.Vector3().fromBufferAttribute(g.attributes.position, mid), Cm = S0.clone().addScaledVector(D, -cap + (len + cap) * Math.floor(rings / 2) / (rings - 1));
  if (new THREE.Vector3().fromBufferAttribute(N, mid).dot(Pm.sub(Cm)) < 0) { const I = g.index.array; for (let q = 0; q < I.length; q += 3) { const t = I[q + 1]; I[q + 1] = I[q + 2]; I[q + 2] = t; } g.index.needsUpdate = true; g.computeVertexNormals(); }
  return g;
}
// изнанка: та же поверхность, тёмная, видна в проёмах (низ, рукава, расстёгнутый перед)
export function addShell(g, geo, mat, inner, role) {
  const m = new THREE.Mesh(geo, mat); if (role) m.userData.role = role; g.add(m);
  if (inner) { const mi = new THREE.Mesh(geo, inner); g.add(mi); }
  return m;
}
