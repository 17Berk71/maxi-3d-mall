// Складки юбки настоящей формой, а не рисунком. Ткань в расчёте — гладкая трапеция (сетка 2.2 см складку не держит),
// а на показе каждая клетка детали делится мельче (S×S, по кривой поверхности PN-треугольников — без граней), точки ткани
// перед этим чуть сглажены (без ряби и «смятости»), и по мелкой сетке заложены складки: ровная грань, резкий сгиб с тенью,
// у пояса прострочены (плоско), к подолу раскрываются глубже. Спереди и сзади середина без складок, складки смотрят от
// середины к бокам. В кадрах анимации мелкая сетка пересчитывается по новым точкам ткани.
import * as THREE from 'three';

const S = 4;   // делений на ребро клетки ткани
// профиль складки: x — по выкройке (м) от середины, y — от пояса вниз (м); h — сдвиг по нормали (м), sh — тень у сгиба
function pleatAt(x, y, P) {
  const ax = Math.abs(x) - P.flat; if (ax <= 0 || P.d1 <= 0) return [0, 1];
  const top = Math.min(1, Math.max(0, (y - P.sewn) / 0.05)), sm = top * top * (3 - 2 * top), depth = (P.d0 + (P.d1 - P.d0) * Math.min(1, y / P.L)) * sm;
  const u = (ax / P.period) % 1;                                               // 0 — сгиб складки, к 1 — грань
  const ramp = u < 0.1 ? u / 0.1 : 1 - (u - 0.1) / 0.9 * 0.9;                  // короткий подъём у сгиба, длинная пологая грань
  return [depth * (ramp - 0.5), 1 - 0.25 * sm * Math.max(0, 1 - u / 0.16) * Math.min(1, depth / P.d1)];
}
// мелкая сетка детали m (verts, tris, uvm — координаты выкройки в метрах, uv), rel — параметры складок
export function pleatGrid(m, rel) {
  const keyE = (a, b, i) => a < b ? `${a}_${b}_${i}` : `${b}_${a}_${S - i}`;
  const map = new Map(), V = [], idx = [];   // V: [треугольник, j, i] — точка мелкой сетки как барицентрика треугольника
  const add = (key, tri, j, i) => { let v = map.get(key); if (v == null) { v = V.length; map.set(key, v); V.push([tri, j, i]); } return v; };
  const nT = m.tris.length / 3;
  for (let t = 0; t < nT; t++) { const a = m.tris[t * 3], b = m.tris[t * 3 + 1], c = m.tris[t * 3 + 2], id = [];
    for (let i = 0; i <= S; i++) { id.push([]); for (let j = 0; j <= S - i; j++) { const k = S - i - j;   // веса: a — k/S, b — j/S, c — i/S
      let key; if (i === 0 && j === 0) key = 'v' + a; else if (i === 0 && k === 0) key = 'v' + b; else if (j === 0 && k === 0) key = 'v' + c;
      else if (i === 0) key = keyE(a, b, j); else if (k === 0) key = keyE(b, c, i); else if (j === 0) key = keyE(a, c, i); else key = `t${t}_${i}_${j}`;
      id[i].push(add(key, t, j, i)); } }
    for (let i = 0; i < S; i++) for (let j = 0; j < S - i; j++) { idx.push(id[i][j], id[i][j + 1], id[i + 1][j]); if (j < S - i - 1) idx.push(id[i][j + 1], id[i + 1][j + 1], id[i + 1][j]); } }
  const nv = V.length, PX = new Float32Array(nv), PY = new Float32Array(nv), uv = new Float32Array(nv * 2), uvm = new Float32Array(nv * 2);
  V.forEach(([t, j, i], v) => { const a = m.tris[t * 3], b = m.tris[t * 3 + 1], c = m.tris[t * 3 + 2], wb = j / S, wc = i / S, wa = 1 - wb - wc;
    const um = (k, q) => m.uvm ? m.uvm[k][q] : 0; PX[v] = um(a, 0) * wa + um(b, 0) * wb + um(c, 0) * wc; PY[v] = um(a, 1) * wa + um(b, 1) * wb + um(c, 1) * wc;
    uvm[v * 2] = PX[v]; uvm[v * 2 + 1] = PY[v]; uv[v * 2] = m.uv[a][0] * wa + m.uv[b][0] * wb + m.uv[c][0] * wc; uv[v * 2 + 1] = 1 - (m.uv[a][1] * wa + m.uv[b][1] * wb + m.uv[c][1] * wc); });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(nv * 3), 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(nv * 3), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('uvm', new THREE.Float32BufferAttribute(uvm, 2));
  geo.setAttribute('wrk', new THREE.Float32BufferAttribute(new Float32Array(nv * 2), 2));   // складки держат форму — мелких заломов нет
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(nv * 3).fill(1), 3));
  geo.setIndex(idx);
  const prof = {flat: rel.flat != null ? rel.flat : 0.045, period: rel.period || 0.052, sewn: rel.sewn != null ? rel.sewn : 0.07,
    d0: rel.depth === 0 ? 0 : 0.003, d1: typeof window !== 'undefined' && window.__pd != null ? window.__pd : rel.depth != null ? rel.depth : 0.013, L: rel.L};   /* __pd — проба глубины (отладка) */
  // боковой край детали (шов): складки к нему сходят на нет, иначе перед и спинка на шве расходятся «лесенкой» и торчат плавниками
  const side = []; { const cnt = new Map(); for (let t = 0; t < m.tris.length; t += 3) for (const [x, y] of [[0, 1], [1, 2], [2, 0]]) { const a = m.tris[t + x], b = m.tris[t + y], k = a < b ? a + '_' + b : b + '_' + a; cnt.set(k, (cnt.get(k) || 0) + 1); }
    if (m.uvm) cnt.forEach((c, k) => { if (c !== 1) return; const [a, b] = k.split('_').map(Number), A = m.uvm[a], B = m.uvm[b]; if (Math.abs(B[1] - A[1]) > Math.abs(B[0] - A[0])) side.push(A, B); }); }
  const TAPER = 0.025, H = new Float32Array(nv), SH = new Float32Array(nv);
  for (let v = 0; v < nv; v++) { const p = pleatAt(PX[v], PY[v], prof); let d = 9; for (const q of side) d = Math.min(d, Math.hypot(q[0] - PX[v], q[1] - PY[v]));
    const t = Math.min(1, d / TAPER), k = t * t * (3 - 2 * t); H[v] = p[0] * k; SH[v] = 1 - (1 - p[1]) * k; }
  // соседи точек ткани внутри детали (для сглаживания перед показом)
  const nb = new Map(); for (let t = 0; t < m.tris.length; t += 3) for (const [x, y] of [[0, 1], [1, 2], [2, 0]]) { const a = m.verts[m.tris[t + x]], b = m.verts[m.tris[t + y]]; if (!nb.has(a)) nb.set(a, new Set()); if (!nb.has(b)) nb.set(b, new Set()); nb.get(a).add(b); nb.get(b).add(a); }
  // низ детали (для нижнего слоя): рёбра края, у которых третья точка треугольника выше (меньше y выкройки)
  const cnt = new Map(), third = new Map(); for (let t = 0; t < m.tris.length; t += 3) for (const [x, y, z] of [[0, 1, 2], [1, 2, 0], [2, 0, 1]]) { const a = m.tris[t + x], b = m.tris[t + y], k = a < b ? a + '_' + b : b + '_' + a; cnt.set(k, (cnt.get(k) || 0) + 1); third.set(k, m.tris[t + z]); }
  const hem = new Set(); cnt.forEach((n, k) => { if (n !== 1 || !m.uvm) return; const [a, b] = k.split('_').map(Number), c = third.get(k); if (m.uvm[c][1] < (m.uvm[a][1] + m.uvm[b][1]) / 2 - 1e-4) { hem.add(a); hem.add(b); } });
  const hemPts = [...hem].sort((p, q) => m.uvm[p][0] - m.uvm[q][0]).map(k => m.verts[k]);
  return {geo, V, H, SH, m, nv, nb, hemPts, Ps: null};
}
// сглаживание юбки целиком (перед и спинка вместе, через боковые швы): сетка расчёта 2.2 см даёт бугры и «стёганость»,
// а плиссе держит форму — ровный расклёшенный конус. Каждая точка ставится на плоскость, проведённую по соседям в радиусе
// ~σ (взвешенная линейная регрессия радиуса и высоты по дуге и по длине выкройки): бугры уходят, а край, клёш и длина
// остаются (у края плоскость не тянет точку внутрь, как простое усреднение)
export function pleatSmooth(pgs, P, sig = 0.04) {
  let J = pgs[0].jointData;
  if (!J) { const ids = [], vv = [], seen = new Set();
    pgs.forEach(pg => pg.m.verts.forEach((g, k) => { if (seen.has(g)) return; seen.add(g); ids.push(g); vv.push(pg.m.uvm ? pg.m.uvm[k][1] : 0); }));
    J = {ids, vv, nb: []}; pgs.forEach(pg => { pg.jointData = J; pg.joint = true; }); }
  const {ids, vv} = J, n = ids.length; let cx = 0, cz = 0; ids.forEach(g => { cx += P[g * 3]; cz += P[g * 3 + 2]; }); cx /= n; cz /= n;
  const th = new Float64Array(n), r = new Float64Array(n), y = new Float64Array(n);
  for (let i = 0; i < n; i++) { const g = ids[i], x = P[g * 3] - cx, z = P[g * 3 + 2] - cz; th[i] = Math.atan2(x, z); r[i] = Math.hypot(x, z); y[i] = P[g * 3 + 1]; }
  const wrap = a => a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a, R = 2.5 * sig;
  if (!J.nb.length) for (let i = 0; i < n; i++) { const L = []; for (let j = 0; j < n; j++) if (Math.abs(vv[j] - vv[i]) < R && Math.abs(wrap(th[j] - th[i])) * r[i] < R) L.push(j); J.nb.push(L); }
  const out = new Map(), s2 = 1 / (2 * sig * sig);
  for (let i = 0; i < n; i++) { let S0 = 0, Ss = 0, Sv = 0, Sss = 0, Ssv = 0, Svv = 0, R0 = 0, Rs = 0, Rv = 0, Y0 = 0, Ys = 0, Yv = 0;
    for (const j of J.nb[i]) { const ds = wrap(th[j] - th[i]) * r[i], dv = vv[j] - vv[i], w = Math.exp(-(ds * ds + dv * dv) * s2);
      S0 += w; Ss += w * ds; Sv += w * dv; Sss += w * ds * ds; Ssv += w * ds * dv; Svv += w * dv * dv; R0 += w * r[j]; Rs += w * r[j] * ds; Rv += w * r[j] * dv; Y0 += w * y[j]; Ys += w * y[j] * ds; Yv += w * y[j] * dv; }
    // 3×3: [S0 Ss Sv; Ss Sss Ssv; Sv Ssv Svv] · [a b c] = [Σwq, Σwq·ds, Σwq·dv] — нужен только свободный член a (Крамер)
    const det = S0 * (Sss * Svv - Ssv * Ssv) - Ss * (Ss * Svv - Ssv * Sv) + Sv * (Ss * Ssv - Sss * Sv);
    const a = (q0, qs, qv) => (q0 * (Sss * Svv - Ssv * Ssv) - Ss * (qs * Svv - Ssv * qv) + Sv * (qs * Ssv - Sss * qv)) / det;
    const ok = Math.abs(det) > 1e-14 * S0 * S0 * S0, rr = ok ? a(R0, Rs, Rv) : R0 / S0, yy = ok ? a(Y0, Ys, Yv) : Y0 / S0;
    out.set(ids[i], [cx + rr * Math.sin(th[i]), yy, cz + rr * Math.cos(th[i])]); }
  pgs.forEach(pg => { const Ps = pg.Ps || (pg.Ps = new Map()); pg.m.verts.forEach(g => Ps.set(g, out.get(g))); });
}
// PN-треугольник: точка кубической поверхности по вершинам и нормалям (кривая, а не плоская грань)
function pn(p1, p2, p3, n1, n2, n3, u, v, w, out) {
  const e = (pi, pj, ni) => { const d = (pj[0] - pi[0]) * ni[0] + (pj[1] - pi[1]) * ni[1] + (pj[2] - pi[2]) * ni[2]; return [(2 * pi[0] + pj[0] - d * ni[0]) / 3, (2 * pi[1] + pj[1] - d * ni[1]) / 3, (2 * pi[2] + pj[2] - d * ni[2]) / 3]; };
  const b210 = e(p1, p2, n1), b120 = e(p2, p1, n2), b021 = e(p2, p3, n2), b012 = e(p3, p2, n3), b102 = e(p3, p1, n3), b201 = e(p1, p3, n1);
  for (let q = 0; q < 3; q++) { const E = (b210[q] + b120[q] + b021[q] + b012[q] + b102[q] + b201[q]) / 6, Vv = (p1[q] + p2[q] + p3[q]) / 3, b111 = E + (E - Vv) / 2;
    out[q] = p1[q] * w * w * w + p2[q] * u * u * u + p3[q] * v * v * v + 3 * (b210[q] * w * w * u + b120[q] * w * u * u + b201[q] * w * w * v + b021[q] * u * u * v + b102[q] * w * v * v + b012[q] * u * v * v) + 6 * b111 * w * u * v; }
}
// пересчитать мелкую сетку по точкам ткани P (нормали N), затенение складок AO
export function pleatUpdate(pg, P, N, AO) {
  const {geo, V, H, SH, m, nv, nb} = pg, pos = geo.attributes.position.array, col = geo.attributes.color.array;
  // точки ткани — уже сглаженные вместе с другими деталями юбки (pleatSmooth); без неё — как есть
  const Ps = pg.Ps || (pg.Ps = new Map()); if (!pg.joint) m.verts.forEach(g => Ps.set(g, [P[g * 3], P[g * 3 + 1], P[g * 3 + 2]]));
  // нормали — по сглаженной поверхности (нормали расчёта повторяют его бугры), наружу — как у расчёта
  const NS = new Map(); m.verts.forEach(g => NS.set(g, [0, 0, 0]));
  for (let t = 0; t < m.tris.length; t += 3) { const a = m.verts[m.tris[t]], b = m.verts[m.tris[t + 1]], c = m.verts[m.tris[t + 2]], A = Ps.get(a), B = Ps.get(b), Cc = Ps.get(c);
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [Cc[0] - A[0], Cc[1] - A[1], Cc[2] - A[2]], f = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const g of [a, b, c]) { const q = NS.get(g); q[0] += f[0]; q[1] += f[1]; q[2] += f[2]; } }
  let sd = 0; NS.forEach((q, g) => { sd += q[0] * N[g * 3] + q[1] * N[g * 3 + 1] + q[2] * N[g * 3 + 2]; });
  const sg = sd < 0 ? -1 : 1; NS.forEach(q => { const l = (Math.hypot(q[0], q[1], q[2]) || 1) * sg; q[0] /= l; q[1] /= l; q[2] /= l; });
  const nrm = g => NS.get(g), o = [0, 0, 0], bn = new Float32Array(nv * 3);
  V.forEach(([t, j, i], v) => { const a = m.verts[m.tris[t * 3]], b = m.verts[m.tris[t * 3 + 1]], c = m.verts[m.tris[t * 3 + 2]], u = j / S, vv = i / S, w = 1 - u - vv;
    pn(Ps.get(a), Ps.get(b), Ps.get(c), nrm(a), nrm(b), nrm(c), u, vv, w, o);
    const na = NS.get(a), nb_ = NS.get(b), nc = NS.get(c), nx = na[0] * w + nb_[0] * u + nc[0] * vv, ny = na[1] * w + nb_[1] * u + nc[1] * vv, nz = na[2] * w + nb_[2] * u + nc[2] * vv, l = Math.hypot(nx, ny, nz) || 1;
    bn[v * 3] = nx / l; bn[v * 3 + 1] = ny / l; bn[v * 3 + 2] = nz / l;
    pos[v * 3] = o[0] + bn[v * 3] * H[v]; pos[v * 3 + 1] = o[1] + bn[v * 3 + 1] * H[v]; pos[v * 3 + 2] = o[2] + bn[v * 3 + 2] * H[v];
    const ao = AO ? AO[a] * w + AO[b] * u + AO[c] * vv : 1; col[v * 3] = col[v * 3 + 1] = col[v * 3 + 2] = ao * SH[v]; });
  geo.computeVertexNormals();
  const nor = geo.attributes.normal.array; let s = 0; for (let v = 0; v < nv; v += 5) s += nor[v * 3] * bn[v * 3] + nor[v * 3 + 1] * bn[v * 3 + 1] + nor[v * 3 + 2] * bn[v * 3 + 2];
  // порядок треугольников детали (у спинки — зеркальный) мог смотреть внутрь: развернуть сами треугольники, а не только нормали —
  // у двусторонней ткани шейдер по обходу треугольника считает, какая сторона видна, и снаружи показывал изнанку (блики, пятна тени)
  if (s < 0) { const ix = geo.index.array; for (let k = 0; k < ix.length; k += 3) { const x = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = x; } geo.index.needsUpdate = true; geo.computeVertexNormals(); }
  geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.computeBoundingSphere();
}
// нижний слой у подола (белые шорты-подклад, подъюбник): лента под юбкой по линии низа переда и спинки, выглядывает на len
export function liningBand(pgs, len, mat) {
  // кольцо по низу переда и спинки — по углу вокруг оси юбки (порядок выкроек у деталей может быть зеркальным)
  const all = []; pgs.forEach((pg, pi) => pg.hemPts.forEach(g => all.push([pi, g]))); let cx = 0, cz = 0; all.forEach(([pi, g]) => { const p = pgs[pi].Ps.get(g); cx += p[0]; cz += p[2]; }); cx /= all.length; cz /= all.length;
  const seen = new Set(), ring = all.map(([pi, g]) => { const p = pgs[pi].Ps.get(g); return [pi, g, Math.atan2(p[0] - cx, p[2] - cz)]; }).sort((a, b) => a[2] - b[2]).filter(([, g]) => !seen.has(g) && seen.add(g)).map(([pi, g]) => [pi, g]);
  const K = ring.length, RINGS = 5, geo = new THREE.BufferGeometry(), uvm = [], idx = [];
  for (let i = 0; i < RINGS; i++) for (let k = 0; k <= K; k++) uvm.push(k / K * 2.2, i / (RINGS - 1) * (len + 0.02));
  for (let i = 0; i < RINGS - 1; i++) for (let k = 0; k < K; k++) { const a = i * (K + 1) + k, b = a + 1, c = a + K + 1, e = c + 1; idx.push(a, b, c, b, e, c); }
  const n = RINGS * (K + 1);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('uvm', new THREE.Float32BufferAttribute(uvm, 2)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvm, 2));
  geo.setAttribute('wrk', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2)); geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.lining = {pgs, ring, K, RINGS, len};
  return mesh;
}
export function liningUpdate(mesh) {
  const {pgs, ring, K, RINGS, len} = mesh.userData.lining, pos = mesh.geometry.attributes.position.array;
  for (let k = 0; k <= K; k++) { const [pi, g] = ring[k % K], p = pgs[pi].Ps.get(g), x = p[0], y = p[1], z = p[2], rl = Math.hypot(x, z) || 1, ix = -x / rl, iz = -z / rl;
    for (let i = 0; i < RINGS; i++) { const t = i / (RINGS - 1), drop = -0.004 + t * (len + 0.004), inn = 0.017 - t * 0.011,   /* верх — под низом юбки, глубже впадин складок */ wave = t * 0.003 * Math.sin(k / K * Math.PI * 2 * 16), q = (i * (K + 1) + k) * 3;
      pos[q] = x + ix * (inn - wave); pos[q + 1] = y - drop; pos[q + 2] = z + iz * (inn - wave); } }
  mesh.geometry.computeVertexNormals(); mesh.geometry.attributes.position.needsUpdate = true; mesh.geometry.attributes.normal.needsUpdate = true; mesh.geometry.computeBoundingSphere();
}
