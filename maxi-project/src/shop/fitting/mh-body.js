// Витринный манекен MakeHuman (CC0) по меркам — прямо в браузере. Данные — public/body (tools/body/mh_export.py):
// базовая форма своего пола и смещения (вес, обхваты груди/талии/бёдер). Здесь: смешивание по весу, рост, подгонка обхватов
// к меркам (3 итерации Ньютона по сечениям сетки), поза (руки вниз под углом armA, локоть чуть согнут, стопы под бёдрами —
// линейное скиннинг-смешивание по весам костей MH) и таблицы для выкроек и тела для расчёта ткани (mhTables).
const BASE = 'body/';
const ST = {meta: null, common: null, sex: {}, wait: {}};

async function getBin(url) {
  const r = await fetch(url, {priority: 'high'}); if (!r.ok) throw new Error(url + ' ' + r.status);
  let buf = await r.arrayBuffer(); const u = new Uint8Array(buf, 0, 2);
  // .gz без Content-Encoding (хостинг отдал как есть) — распаковать
  if (u[0] === 0x1f && u[1] === 0x8b && globalThis.DecompressionStream) buf = await new globalThis.Response(new Blob([buf]).stream().pipeThrough(new globalThis.DecompressionStream('gzip'))).arrayBuffer();
  return buf;
}
// загрузить данные пола (один раз): общее + своя форма
export function mhLoad(sex) {
  const s = sex === 'f' ? 'f' : 'm';
  if (ST.sex[s]) return Promise.resolve(true);
  if (ST.wait[s]) return ST.wait[s];
  return (ST.wait[s] = (async () => {
    if (!ST.meta) { const [m, c] = await Promise.all([fetch(BASE + 'mh.json', {priority: 'high'}).then(r => r.json()), getBin(BASE + 'mh_common.bin')]); ST.common = unpackCommon(m, c); ST.meta = m; }
    const b = await getBin(BASE + 'mh_' + s + '.bin'), M = ST.meta, n = (M.nv + M.nj) * 3, A = {};
    M.arrays.forEach((k, i) => { const a = new Int16Array(b, i * n * 2, n), f = new Float32Array(n); for (let j = 0; j < n; j++) f[j] = a[j] * M.q; A[k] = f; });
    ST.sex[s] = A; return true;
  })().catch(e => { console.warn('манекен MakeHuman: нет данных', e); ST.wait[s] = null; return false; }));
}
export const mhHas = sex => !!ST.sex[sex === 'f' ? 'f' : 'm'] && !(typeof window !== 'undefined' && window.__oldBody);

function unpackCommon(M, buf) {
  const tri = new Uint16Array(buf, 0, M.ntri * 3), part = new Uint8Array(buf, M.part_off, M.nv), W = {};
  let o = M.w_off; M.groups.forEach((g, i) => { const c = M.gcount[i], idx = new Uint16Array(buf.slice(o, o + c * 2)); o += c * 2; const w = new Uint8Array(buf, o, c); o += c;
    const full = new Float32Array(M.nv); for (let j = 0; j < c; j++) full[idx[j]] = w[j] / 255; W[g] = full; });
  // рёбра (для сечений): каждое один раз
  const es = new Set(), E = []; for (let t = 0; t < tri.length; t += 3) for (let k = 0; k < 3; k++) { const a = tri[t + k], b = tri[t + (k + 1) % 3], key = a < b ? a * 65536 + b : b * 65536 + a; if (!es.has(key)) { es.add(key); E.push(a < b ? a : b, a < b ? b : a); } }
  // соседи точек головы (для сглаживания: на месте глаз и рта у сетки остались мелкие складки)
  const hn = new Map(); for (let e = 0; e < E.length; e += 2) { const a = E[e], b = E[e + 1]; if (part[a] === 1 && part[b] === 1) { if (!hn.has(a)) hn.set(a, []); if (!hn.has(b)) hn.set(b, []); hn.get(a).push(b); hn.get(b).push(a); } }
  // соседи точек груди (для сглаживания)
  let bn = null; if (W.breast) { const nbm = new Map(); for (let e = 0; e < E.length; e += 2) { const a = E[e], b = E[e + 1]; for (const [p, q] of [[a, b], [b, a]]) if (W.breast[p] > 0.05) { if (!nbm.has(p)) nbm.set(p, []); nbm.get(p).push(q); } }
    bn = {idx: [...nbm.keys()], nb: [...nbm.values()]}; }
  return {tri, part, W, E: Uint32Array.from(E), hn, bn};
}

// ---------- геометрия ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function rodr(ax, ang) { const [x, y, z] = norm(ax), c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c]; }
const mulM = (A, B) => { const C = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return C; };
// аффинное: {R, t}: p → R p + t; поворот R вокруг точки c
const affRot = (R, c) => ({R, t: [c[0] - (R[0] * c[0] + R[1] * c[1] + R[2] * c[2]), c[1] - (R[3] * c[0] + R[4] * c[1] + R[5] * c[2]), c[2] - (R[6] * c[0] + R[7] * c[1] + R[8] * c[2])]});
const affMul = (A, B) => { const R = mulM(A.R, B.R), t = apply(A, B.t); return {R, t}; };
function apply(T, p) { const R = T.R; return [R[0] * p[0] + R[1] * p[1] + R[2] * p[2] + T.t[0], R[3] * p[0] + R[4] * p[1] + R[5] * p[2] + T.t[1], R[6] * p[0] + R[7] * p[1] + R[8] * p[2] + T.t[2]]; }
const ID = {R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0]};
// цепочка: группы весов g[i] с поворотами вокруг суставов c[i], у каждой — доля угла f[i]; дочерние едут с родителем
function skinChain(P, nv, J, W, groups, joints, fr, axis, ang, childJ) {
  let T = ID; const Ts = groups.map((g, i) => { T = affMul(T, affRot(rodr(axis, ang * fr[i]), J[joints[i]])); return T; });
  for (let v = 0; v < nv; v++) { let dx = 0, dy = 0, dz = 0, any = false; const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
    for (let i = 0; i < groups.length; i++) { const w = W[groups[i]][v]; if (!w) continue; any = true; const q = apply(Ts[i], p); dx += w * (q[0] - p[0]); dy += w * (q[1] - p[1]); dz += w * (q[2] - p[2]); }
    if (any) { P[v * 3] += dx; P[v * 3 + 1] += dy; P[v * 3 + 2] += dz; } }
  // суставы ниже по цепочке — с последним звеном, до которого они относятся
  childJ.forEach(([j, gi]) => { J[j] = apply(Ts[gi], J[j]); });
}
function align(P, nv, J, W, groups, joints, fr, j0, j1, want, childJ) {
  for (let it = 0; it < 3; it++) { const a = norm(sub(J[j1], J[j0])), w = norm(want), c = Math.max(-1, Math.min(1, dot(a, w))), ang = Math.acos(c);
    if (ang < 1e-3) break; skinChain(P, nv, J, W, groups, joints, fr, cross(a, w), ang, childJ); }
}

// ---------- обхваты по сечениям ----------
function hullPerim(pts) {
  if (pts.length < 6) return 0; const n = pts.length / 2, I = Array.from({length: n}, (_, i) => i).sort((a, b) => pts[a * 2] - pts[b * 2] || pts[a * 2 + 1] - pts[b * 2 + 1]);
  const cr = (o, a, b) => (pts[a * 2] - pts[o * 2]) * (pts[b * 2 + 1] - pts[o * 2 + 1]) - (pts[a * 2 + 1] - pts[o * 2 + 1]) * (pts[b * 2] - pts[o * 2]);
  const lo = [], up = []; for (const i of I) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], i) <= 0) lo.pop(); lo.push(i); }
  for (let k = I.length - 1; k >= 0; k--) { const i = I[k]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], i) <= 0) up.pop(); up.push(i); }
  const h = lo.slice(0, -1).concat(up.slice(0, -1)); let s = 0; for (let k = 0; k < h.length; k++) { const a = h[k], b = h[(k + 1) % h.length]; s += Math.hypot(pts[a * 2] - pts[b * 2], pts[a * 2 + 1] - pts[b * 2 + 1]); } return s;
}
// точки сечения плоскостью y по рёбрам, у которых обе точки проходят фильтр ok(v)
function slice(P, E, y, ok) { const out = []; for (let e = 0; e < E.length; e += 2) { const a = E[e], b = E[e + 1], ya = P[a * 3 + 1], yb = P[b * 3 + 1]; if ((ya - y) * (yb - y) >= 0 || !ok(a) || !ok(b)) continue;
  const t = (y - ya) / (yb - ya); out.push(P[a * 3] + (P[b * 3] - P[a * 3]) * t, P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * t); } return out; }
function girths(P, H, C) {
  const ok = v => C.part[v] !== 2, g = y => hullPerim(slice(P, C.E, y, ok)), rng = (a, b, f) => { let best = null; for (let i = 0; i <= 14; i++) { const y = (a + (b - a) * i / 14) * H, v = g(y); if (best === null || f(v, best)) best = v; } return best; };
  return {chest: rng(0.68, 0.77, (v, b) => v > b), waist: rng(0.58, 0.67, (v, b) => v < b), hips: rng(0.48, 0.56, (v, b) => v > b)};
}

const JI = name => ST.meta.joints.indexOf(name);
// тело по меркам b {sex, height, weight, chest, waist, hips} и углу рук armA → {P (Float32Array узлов), J (суставы), H, tri, part}
const CACHE = new Map();
export function mhBuild(b, armA = 0.16) {
  const s = b.sex === 'f' ? 'f' : 'm', A = ST.sex[s]; if (!A) return null;
  const key = JSON.stringify([s, b.height, b.weight, b.chest, b.waist, b.hips, +armA.toFixed(4)]); if (CACHE.has(key)) return CACHE.get(key);
  const M = ST.meta, C = ST.common, nv = M.nv, nj = M.nj, n = (nv + nj) * 3, H = b.height / 100;
  const bmi = b.weight ? b.weight / Math.pow(H, 2) : 22, w01 = Math.max(0, Math.min(1, 0.5 + (bmi - 22) / 16));
  const wv = {}; const mix = () => { const P = Float32Array.from(A.base), ww = w01 < 0.5 ? ['wlo', 1 - 2 * w01] : ['whi', 2 * w01 - 1];
    const add = (k, f) => { if (!f) return; const D = A[k]; for (let i = 0; i < n; i++) P[i] += D[i] * f; };
    add(ww[0], ww[1]); for (const m of ['bust', 'waist', 'hips']) { const x = wv[m] || 0; add(m + (x >= 0 ? '+' : '-'), Math.abs(x)); }
    // рост: пол на 0, масштаб по высоте сетки
    let y0 = 1e9, y1 = -1e9; for (let v = 0; v < nv; v++) { const y = P[v * 3 + 1]; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const k = H / (y1 - y0); for (let i = 0; i < n; i += 3) { P[i] *= k; P[i + 1] = (P[i + 1] - y0) * k; P[i + 2] *= k; }
    const J = []; for (let j = 0; j < nj; j++) J.push([P[(nv + j) * 3], P[(nv + j) * 3 + 1], P[(nv + j) * 3 + 2]]);
    return {P, J}; };
  const poseLegs = (P, J) => { for (const [sd, sg] of [['L', 1], ['R', -1]]) { const hip = J[JI(`upperleg01.${sd}____head`)], ft = J[JI(`foot.${sd}____head`)];
    align(P, nv, J, C.W, ['leg' + sd], [JI(`upperleg01.${sd}____head`)], [1], JI(`upperleg01.${sd}____head`), JI(`foot.${sd}____head`), [sg * 0.055 * H - hip[0], ft[1] - hip[1], 0], [[JI(`foot.${sd}____head`), 0]]); } };
  // подгонка обхватов к меркам: веса целей груди/талии/бёдер (якобиан численно)
  const want = {bust: b.chest / 100, waist: b.waist / 100, hips: b.hips / 100}, ks = Object.keys(want).filter(k => want[k] > 0.3);
  const measure = () => { const {P, J} = mix(); poseLegs(P, J); const g = girths(P, H, C); return {bust: g.chest, waist: g.waist, hips: g.hips, P, J}; };
  let cur = measure();
  for (let it = 0; it < 4 && ks.length; it++) {
    const err = ks.map(k => want[k] - cur[k]); if (Math.max(...err.map(Math.abs)) < 0.004) break;
    const Jm = ks.map(() => new Array(ks.length).fill(0));
    ks.forEach((k, j) => { const save = wv[k] || 0; wv[k] = save + 0.15; const g2 = measure(); wv[k] = save; ks.forEach((kk, i) => { Jm[i][j] = (g2[kk] - cur[kk]) / 0.15; }); });
    const dw = solveLin(Jm, err); ks.forEach((k, j) => { wv[k] = Math.max(-1.6, Math.min(1.6, (wv[k] || 0) + dw[j])); }); cur = measure();
  }
  // руки вниз: плечевая кость — под углом от вертикали, предплечье почти по той же линии (рукав надевается прямой трубой).
  // Рука не прижата к боку: между внутренней стороной руки и туловищем ≥ 6 мм (ткани бока нужно где пройти) — у плотной
  // фигуры угол больше заданного
  const poseArms = ang => { const P = cur.P.slice(), J = cur.J.map(j => j.slice());
    for (const [sd, sg] of [['L', 1], ['R', -1]]) {
      const jc = JI(`clavicle.${sd}____head`), js = JI(`shoulder01.${sd}____head`), ju = JI(`upperarm01.${sd}____head`), jl = JI(`lowerarm01.${sd}____head`), jw = JI(`wrist.${sd}____head`);
      align(P, nv, J, C.W, ['clav' + sd, 'sh' + sd, 'up' + sd, 'low' + sd], [jc, js, ju, ju], [0.1, 0.25, 0.65, 0], ju, jl, [sg * Math.sin(ang), -Math.cos(ang), -0.04], [[js, 0], [ju, 1], [jl, 2], [jw, 3]]);
      align(P, nv, J, C.W, ['low' + sd], [jl], [1], jl, jw, [sg * Math.sin(ang * 0.85), -Math.cos(ang * 0.85), 0.02], [[jw, 0]]); }
    return {P, J}; };
  const armGap = (P, J) => { let g = 9; const y1 = J[JI('upperarm01.L____head')][1] - 0.13, y0 = J[JI('lowerarm01.L____head')][1];
    for (let y = y0; y < y1; y += 0.01) for (const sg of [1, -1]) { let ax = 9, tx = -9;
      for (let v = 0; v < nv; v++) { const yy = P[v * 3 + 1]; if (Math.abs(yy - y) > 0.006) continue; const x = P[v * 3] * sg; if (x <= 0) continue; if (C.part[v] === 2) ax = Math.min(ax, x); else if (C.part[v] === 0) tx = Math.max(tx, x); }
      if (ax < 9 && tx > -9) g = Math.min(g, ax - tx); }
    return g; };
  let ang = armA, posed = poseArms(ang);
  for (let it = 0; it < 10 && !(typeof window !== 'undefined' && window.__noArmGap) && armGap(posed.P, posed.J) < 0.004; it++) { ang += 0.02; posed = poseArms(ang); }
  const {P, J} = posed;
  // грудь витринного манекена — округлая, без «конуса» к соску: сглаживание с весом кости груди
  if (C.W.breast && C.bn && !(typeof window !== 'undefined' && window.__noBS)) for (let it = 0; it < 40; it++) { const M = new Float32Array(C.bn.idx.length * 3);
    C.bn.idx.forEach((a, i) => { let x = 0, y = 0, z = 0; const nb = C.bn.nb[i]; nb.forEach(b => { x += P[b * 3]; y += P[b * 3 + 1]; z += P[b * 3 + 2]; }); const n_ = nb.length, w = Math.min(1, C.W.breast[a] * 4) * 0.6; M[i * 3] = P[a * 3] + (x / n_ - P[a * 3]) * w; M[i * 3 + 1] = P[a * 3 + 1] + (y / n_ - P[a * 3 + 1]) * w; M[i * 3 + 2] = P[a * 3 + 2] + (z / n_ - P[a * 3 + 2]) * w; });
    C.bn.idx.forEach((a, i) => { P[a * 3] = M[i * 3]; P[a * 3 + 1] = M[i * 3 + 1]; P[a * 3 + 2] = M[i * 3 + 2]; }); }
  // сосок: вокруг самой выступающей точки груди (r < 2 см) — гладкая поверхность (край закреплён), без бугорка
  if (C.W.breast && C.bn && !(typeof window !== 'undefined' && window.__noBS)) for (const sg of [1, -1]) { let tip = -1, mz = -9; C.bn.idx.forEach(a => { if (C.W.breast[a] > 0.3 && P[a * 3] * sg > 0 && P[a * 3 + 2] > mz) { mz = P[a * 3 + 2]; tip = a; } }); if (tip < 0) continue;
    const R = 0.02 * H / 1.75, T0 = [P[tip * 3], P[tip * 3 + 1], P[tip * 3 + 2]], sel = []; C.bn.idx.forEach((a, i) => { if (Math.hypot(P[a * 3] - T0[0], P[a * 3 + 1] - T0[1], P[a * 3 + 2] - T0[2]) < R) sel.push(i); });
    for (let it = 0; it < 25; it++) sel.forEach(i => { const a = C.bn.idx[i], nb = C.bn.nb[i]; let x = 0, y = 0, z = 0; nb.forEach(b => { x += P[b * 3]; y += P[b * 3 + 1]; z += P[b * 3 + 2]; }); const n_ = nb.length; P[a * 3] = x / n_; P[a * 3 + 1] = y / n_; P[a * 3 + 2] = z / n_; }); }
  // голова: сглаживание Таубина (форма сохраняется, мелкие складки у глаз и рта уходят)
  for (let it = 0; it < 20; it++) for (const f of [0.5, -0.53]) { const M = new Map(); C.hn.forEach((nb, a) => { let x = 0, y = 0, z = 0; nb.forEach(b => { x += P[b * 3]; y += P[b * 3 + 1]; z += P[b * 3 + 2]; }); const n_ = nb.length; M.set(a, [x / n_ - P[a * 3], y / n_ - P[a * 3 + 1], z / n_ - P[a * 3 + 2]]); });
    M.forEach((L, a) => { P[a * 3] += f * L[0]; P[a * 3 + 1] += f * L[1]; P[a * 3 + 2] += f * L[2]; }); }
  // туловище по глубине — к середине (z = 0 на уровне груди): выкройки ставят перед и спинку от z = 0
  { let z0 = 1e9, z1 = -1e9; const y = 0.72 * H; for (let v = 0; v < nv; v++) if (C.part[v] === 0 && Math.abs(P[v * 3 + 1] - y) < 0.01) { z0 = Math.min(z0, P[v * 3 + 2]); z1 = Math.max(z1, P[v * 3 + 2]); }
    const dz = (z0 + z1) / 2; if (isFinite(dz)) { for (let v = 0; v < nv; v++) P[v * 3 + 2] -= dz; J.forEach(j => { j[2] -= dz; }); } }
  const out = {P: P.slice(0, nv * 3), J, H, tri: C.tri, part: C.part, W: C.W, E: C.E, girth: {chest: cur.bust, waist: cur.waist, hips: cur.hips}, wv: {...wv}, armA: ang};
  if (CACHE.size > 6) CACHE.delete(CACHE.keys().next().value); CACHE.set(key, out); return out;
}
function solveLin(A, b) { const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
  for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c] || 1e-9;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / d; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } }
  return M.map((r, i) => r[n] / (r[i] || 1e-9)); }
export const mhJoint = (B, name) => B.J[JI(name)];

// ---------- таблицы для выкроек и тела для расчёта ткани ----------
// N строк по высоте (0..H). Туловище, шея, голова — полярный профиль R(θ) по NB углам вокруг оси y (выше подмышки — вместе
// с верхом рук: плечо одно целое); ниже шага — ноги, у каждой свой центр и профиль. Руки — два звена (плечо, предплечье с
// кистью) с радиусом по длине. Профиль — максимум по сечению сетки (тело для ткани не уже видимого тела).
export function mhTables(B) {
  const {P, H, part, E, W, J} = B, nv = P.length / 3, N = 400, NB = 48, NBL = 24, TAU = Math.PI * 2;
  const ju = s => J[JI(`upperarm01.${s}____head`)], jl = s => J[JI(`lowerarm01.${s}____head`)], jw = s => J[JI(`wrist.${s}____head`)];
  // шаг: самая низкая точка тела у средней линии
  let crotch = 0; { let m = 9; for (let v = 0; v < nv; v++) { const y = P[v * 3 + 1]; if (Math.abs(P[v * 3]) < 0.004 && y > 0.3 * H && part[v] !== 2 && y < m) m = y; } crotch = m < 9 ? m : 0.47 * H; }
  // подмышка: самая высокая строка, где рука отделена от туловища (по обе стороны — ниже из двух)
  let armpit = 0.75 * H; {
    const gapAt = (y, sg) => { let ax = 9, tx = -9; for (let v = 0; v < nv; v++) { if (Math.abs(P[v * 3 + 1] - y) > 0.004) continue; const x = P[v * 3] * sg; if (x <= 0) continue; if (part[v] === 2) ax = Math.min(ax, x); else if (part[v] === 0) tx = Math.max(tx, x); } return ax < 9 && tx > -9 ? ax - tx : -1; };
    let best = 9;
    for (const sg of [1, -1]) { const y0 = ju(sg > 0 ? 'L' : 'R')[1] - 0.02;
      for (let y = y0; y > 0.55 * H; y -= 0.003) if (gapAt(y, sg) > 0.002 && gapAt(y - 0.015, sg) > 0.002 && gapAt(y - 0.03, sg) > 0.002) { best = Math.min(best, y); break; } }
    if (best < 9) armpit = best; }
  const rowY = k => (k + 0.5) / N * H;
  // выше этой высоты рука и туловище — одно целое (дельтовидная, плечо): верх руки входит в профиль туловища;
  // ниже рука висит рядом (от подмышки до сустава она касается бока, но это отдельная поверхность)
  const yMerge = Math.min(ju('L')[1], ju('R')[1]) - 0.035;
  const TP = new Float32Array(N * NB), A = new Float32Array(N), Bd = new Float32Array(N), Cz = new Float32Array(N);
  const LC = new Float32Array(N * 4), LP = new Float32Array(N * 2 * NBL), LEQ = new Float32Array(N);
  const fill = (R, o, n) => { // пустые углы — по соседям
    for (let i = 0; i < n; i++) if (!R[o + i]) { let a = 1, b = 1; while (a < n && !R[o + (i - a + n) % n]) a++; while (b < n && !R[o + (i + b) % n]) b++; if (a >= n) return; R[o + i] = (R[o + (i - a + n) % n] * b + R[o + (i + b) % n] * a) / (a + b); } };
  const perim = (R, o, n) => { let s = 0; for (let i = 0; i < n; i++) { const a = i * TAU / n, b = (i + 1) * TAU / n, r0 = R[o + i], r1 = R[o + (i + 1) % n]; s += Math.hypot(r1 * Math.cos(b) - r0 * Math.cos(a), r1 * Math.sin(b) - r0 * Math.sin(a)); } return s; };
  for (let k = 0; k < N; k++) {
    const y = rowY(k), body = y >= crotch - 0.004, legs = y <= crotch + 0.03;
    const ok = v => part[v] !== 2 || P[v * 3 + 1] > yMerge;
    const pts = slice(P, E, y, ok); if (!pts.length) continue;
    if (body) { const o = k * NB; let zmin = 9, zmax = -9, xmax = 0;
      for (let i = 0; i < pts.length; i += 2) { const x = pts[i], z = pts[i + 1], r = Math.hypot(x, z), bi = Math.floor(((Math.atan2(z, x) + TAU) % TAU) / TAU * NB) % NB; if (r > TP[o + bi]) TP[o + bi] = r; zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); xmax = Math.max(xmax, Math.abs(x)); }
      fill(TP, o, NB); A[k] = xmax; Bd[k] = (zmax - zmin) / 2; Cz[k] = (zmax + zmin) / 2; }
    if (legs) for (const [si, sg] of [[0, 1], [1, -1]]) { let x0 = 9, x1 = -9, z0 = 9, z1 = -9, cnt = 0;
      for (let i = 0; i < pts.length; i += 2) if (pts[i] * sg > 0) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); z0 = Math.min(z0, pts[i + 1]); z1 = Math.max(z1, pts[i + 1]); cnt++; }
      if (!cnt) continue; const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, o = (k * 2 + si) * NBL; LC[k * 4 + si * 2] = cx; LC[k * 4 + si * 2 + 1] = cz;
      for (let i = 0; i < pts.length; i += 2) if (pts[i] * sg > 0) { const dx = pts[i] - cx, dz = pts[i + 1] - cz, r = Math.hypot(dx, dz), bi = Math.floor(((Math.atan2(dz, dx) + TAU) % TAU) / TAU * NBL) % NBL; if (r > LP[o + bi]) LP[o + bi] = r; }
      fill(LP, o, NBL); if (si === 0) LEQ[k] = perim(LP, o, NBL) / TAU; }
  }
  // обхват строки «по ленте» (выпуклая оболочка профиля) — для выкроек: эллипс с пропорцией A:B и тем же периметром
  const G = new Float32Array(N); for (let k = 0; k < N; k++) { if (!A[k]) continue; const pts = []; for (let i = 0; i < NB; i++) { const th = (i + 0.5) / NB * TAU, r = TP[k * NB + i]; pts.push(r * Math.cos(th), r * Math.sin(th)); } G[k] = hullPerim(pts); }
  // запас: строка не меньше соседних (между строками тело не выступает)
  const TP2 = TP.slice(); for (let k = 0; k < N; k++) for (let i = 0; i < NB; i++) TP2[k * NB + i] = Math.max(TP[k * NB + i], k > 0 ? TP[(k - 1) * NB + i] : 0, k < N - 1 ? TP[(k + 1) * NB + i] : 0);
  // руки: звенья и радиус по длине (максимум расстояния точек руки до оси)
  const arms = ['L', 'R'].map(s => { const sg = s === 'L' ? 1 : -1, a = ju(s), b = jl(s), w = jw(s); let du = sub(b, a); const Lu = Math.hypot(...du); du = norm(du); let dl = norm(sub(w, b));
    let tip = Math.hypot(...sub(w, b)); for (let v = 0; v < nv; v++) if (part[v] === 2 && P[v * 3] * sg > 0) { const q = sub([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], b), t = dot(q, dl); if (t > tip) tip = t; }
    const segs = [{o: a, d: du, L: Lu}, {o: b, d: dl, L: tip}].map(sg_ => ({x0: sg_.o[0], y0: sg_.o[1], z0: sg_.o[2], dx: sg_.d[0], dy: sg_.d[1], dz: sg_.d[2], L: sg_.L, rad: new Float32Array(16)}));
    // точки руки — к ближайшему звену; ось звена — по центрам сечений (сустав MakeHuman не в середине руки: от оси через
    // сустав расстояния больше настоящих, рука выходила толще); радиус — 85-й процентиль расстояний до оси в отрезке
    const assign = () => { segs.forEach(g => { g.pts = []; });
      for (let v = 0; v < nv; v++) { if (part[v] !== 2 || P[v * 3] * sg <= 0) continue; const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
        let best = null; segs.forEach((g, gi) => { const q = [p[0] - g.x0, p[1] - g.y0, p[2] - g.z0], t = q[0] * g.dx + q[1] * g.dy + q[2] * g.dz; if (t < -0.02 || t > g.L + 0.01) return; const tc = Math.max(0, Math.min(g.L, t)), r = Math.hypot(q[0] - g.dx * tc, q[1] - g.dy * tc, q[2] - g.dz * tc); if (!best || r < best[1]) best = [gi, r, tc]; });
        if (best) segs[best[0]].pts.push([p, best[2]]); } };
    assign();
    segs.forEach((g, gi) => { const lim = gi === 0 ? g.L : Math.hypot(...sub(w, b)), C_ = []; for (let i = 2; i < 14; i++) { const t0 = lim * i / 16, t1 = lim * (i + 1) / 16; let x = 0, y = 0, z = 0, n = 0; g.pts.forEach(([p, t]) => { if (t >= t0 && t < t1) { x += p[0]; y += p[1]; z += p[2]; n++; } }); if (n > 4) C_.push([x / n, y / n, z / n]); }
      if (C_.length < 4) return; const m = [0, 1, 2].map(k => C_.reduce((s_, c) => s_ + c[k], 0) / C_.length); let dd = sub(C_[C_.length - 1], C_[0]); dd = norm(dd); if (dot(dd, [g.dx, g.dy, g.dz]) < 0) dd = dd.map(v => -v);
      const o = [g.x0, g.y0, g.z0], t = dot(sub(o, m), dd), no = [m[0] + dd[0] * t, m[1] + dd[1] * t, m[2] + dd[2] * t];
      g.x0 = no[0]; g.y0 = no[1]; g.z0 = no[2]; g.dx = dd[0]; g.dy = dd[1]; g.dz = dd[2]; });
    assign();
    segs.forEach(g => { const ds = Array.from({length: 16}, () => []); g.pts.forEach(([p, t]) => { const q = [p[0] - g.x0, p[1] - g.y0, p[2] - g.z0], tt = Math.max(0, Math.min(g.L, dot(q, [g.dx, g.dy, g.dz]))); ds[Math.min(15, Math.floor(tt / g.L * 16))].push(Math.hypot(q[0] - g.dx * tt, q[1] - g.dy * tt, q[2] - g.dz * tt)); });
      for (let i = 0; i < 16; i++) { const a_ = ds[i].sort((p, q) => p - q); g.rad[i] = a_.length ? a_[Math.min(a_.length - 1, Math.floor(a_.length * 0.85))] : 0; } delete g.pts;
      for (let i = 0; i < 16; i++) if (!g.rad[i]) g.rad[i] = g.rad[i - 1] || 0.04; });
    // кисть: пальцы на сетке чуть разведены — для ткани кисть не шире 4.2 см от оси (у мужской фигуры 4.5): ладонь плоская, круг такого радиуса
    // по периметру как ладонь. Было 6.5 см — манжета рубашки над кистью растягивалась на 30–45% (очаги «рукав» у всех верхов), юбки цеплялись за «веер»
    for (let i = 0; i < 16; i++) if ((i + 0.5) / 16 * segs[1].L > Math.hypot(...sub(w, b)) - 0.01) segs[1].rad[i] = Math.min(segs[1].rad[i], 0.042 * H / 1.75);
    // верх плечевого звена (дельтовидная, плечо — в профиле туловища): радиус у сустава как чуть ниже
    { const r0 = segs[0].rad, med = Array.from(r0.slice(4, 9)).sort((p, q) => p - q)[2]; for (let i = 0; i < 4; i++) r0[i] = Math.min(r0[i], med * 1.1); }
    return {side: sg, segs, Lu, Ll: Math.hypot(...sub(w, b))}; });
  // шея: самая узкая строка 0.8–0.92H; основание шеи — ниже, где профиль раздаётся в плечи
  const eq = k => perim(TP2, k * NB, NB) / TAU; let kn = Math.round(0.86 * N), rn = 9; for (let k = Math.round(0.8 * N); k < Math.round(0.92 * N); k++) { const r = eq(k); if (r > 0 && r < rn) { rn = r; kn = k; } }
  let kb = kn; while (kb > 0.7 * N && eq(kb) < rn * 1.35) kb--;
  // верх плеч по |x|: самая высокая точка тела (без головы) в полосе x
  const shBin = 0.01, shTop = new Float32Array(40); for (let v = 0; v < nv; v++) { if (part[v] === 1 || P[v * 3 + 1] < armpit) continue; const i = Math.floor(Math.abs(P[v * 3]) / shBin); if (i < 40 && P[v * 3 + 1] > shTop[i]) shTop[i] = P[v * 3 + 1]; }
  return {N, NB, NBL, TP: TP2, A, B: Bd, G, Cz, LC, LP, LEQ, crotch, armpit, arms, neck: rn, yNeck: rowY(kn), yNeckBase: rowY(kb), shTop, shBin,
    jL: ju('L'), jR: ju('R')};
}
