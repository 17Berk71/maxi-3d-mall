// Сетка ткани для показа: нормали, затенение складок, сжатие (заломы), рельеф плиссе, кадры.
import * as THREE from 'three';
import {noteAB} from './geometry.js';
import {buildDecor, decorUpdate} from './decor.js';
import {pleatGrid, pleatUpdate, pleatSmooth, liningBand, liningUpdate} from './pleats.js';
import {clothify, FT} from './cloth-material.js';
import {LIN} from './common.js';
import {fit} from './state.js';

function clothAO(C, P, N, n) {
  const sx_ = new Float32Array(n * 3), cnt = new Uint16Array(n), el = new Float32Array(n);
  for (let e = 0; e < C.E.length; e += 4) { const k = C.E[e + 3]; if (k !== 0 && k !== 3) continue; const i = C.E[e], j = C.E[e + 1];
    for (let a = 0; a < 3; a++) { sx_[i * 3 + a] += P[j * 3 + a]; sx_[j * 3 + a] += P[i * 3 + a]; } cnt[i]++; cnt[j]++; el[i] += C.E[e + 2]; el[j] += C.E[e + 2]; }
  let A = new Float32Array(n).fill(1);
  for (let i = 0; i < n; i++) { if (!cnt[i]) continue; let c = 0; for (let a = 0; a < 3; a++) c += (sx_[i * 3 + a] / cnt[i] - P[i * 3 + a]) * N[i * 3 + a];
    const r = c / (el[i] / cnt[i]); A[i] = r > 0 ? Math.max(0.6, 1 - 2.2 * r) : Math.min(1.06, 1 - 0.6 * r); }
  // два прохода размытия по соседям — тень мягкая
  for (let pass = 0; pass < 2; pass++) { const B = A.slice(), acc = new Float32Array(n), c2 = new Uint16Array(n);
    for (let e = 0; e < C.E.length; e += 4) { const k = C.E[e + 3]; if (k !== 0 && k !== 3) continue; const i = C.E[e], j = C.E[e + 1]; acc[i] += B[j]; acc[j] += B[i]; c2[i]++; c2[j]++; }
    for (let i = 0; i < n; i++) if (c2[i]) A[i] = (B[i] + acc[i] / c2[i]) / 2; }
  return A;
}
// сжатие ткани в расчёте (лишняя ткань, которую сетка 2 см не может показать складками) → мелкие заломы в шейдере:
// по точке √(1 − длина/покой) отдельно по утку (x) и по основе (y), сглажено по соседям
function clothWrk(C, P, n) {
  const W = new Float32Array(n * 2), cnt = new Float32Array(n * 2), nb = [];
  for (let e = 0; e < C.E.length; e += 4) { const k = C.E[e + 3]; if (k !== 0 && k !== 3) continue; const i = C.E[e], j = C.E[e + 1], rest = C.E[e + 2];
    const l = Math.hypot(P[j * 3] - P[i * 3], P[j * 3 + 1] - P[i * 3 + 1], P[j * 3 + 2] - P[i * 3 + 2]), c = Math.max(0, 1 - l / Math.max(1e-6, rest)), ch = k === 3 ? 0 : 1;
    W[i * 2 + ch] += c; W[j * 2 + ch] += c; cnt[i * 2 + ch]++; cnt[j * 2 + ch]++; nb.push(i, j); }
  for (let q = 0; q < n * 2; q++) W[q] = cnt[q] ? Math.min(0.38, Math.sqrt(Math.max(0, W[q] / cnt[q] - 0.04))) : 0;   // до 4% — ровно (ткань чуть «садится»)
  for (let pass = 0; pass < 2; pass++) { const A = W.slice(), S = new Float32Array(n * 2), K = new Float32Array(n);
    for (let t = 0; t < nb.length; t += 2) { const i = nb[t], j = nb[t + 1]; S[i * 2] += A[j * 2]; S[i * 2 + 1] += A[j * 2 + 1]; S[j * 2] += A[i * 2]; S[j * 2 + 1] += A[i * 2 + 1]; K[i]++; K[j]++; }
    for (let i = 0; i < n; i++) if (K[i]) { W[i * 2] = (A[i * 2] + S[i * 2] / K[i]) / 2; W[i * 2 + 1] = (A[i * 2 + 1] + S[i * 2 + 1] / K[i]) / 2; } }
  return W;
}
// затенение складок действует и на «свечение» фото (основной цвет вещи), а не только на рассеянный свет
function aoEmissive(mat) {
  mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor;\n#endif'); };
}
// сетка вещи для показа: нормали общие для всех деталей (по точкам ткани — через швы без ступеньки света),
// каждая деталь повёрнута лицом наружу, и одно сглаживающее деление треугольников (край силуэта не «гранёный»)
function clothNormals(C, P, flips, N) {
  const sub = (i, j) => [P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2]];
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  N.fill(0); const n = P.length / 3;
  C.meshes.forEach((m, mi) => { for (let t = 0; t < m.tris.length; t += 3) { let a = m.verts[m.tris[t]], b = m.verts[m.tris[t + 1]], c = m.verts[m.tris[t + 2]]; if (flips[mi]) { const x = b; b = c; c = x; }
    const f = cross(sub(b, a), sub(c, a)); for (const v of [a, b, c]) { N[v * 3] += f[0]; N[v * 3 + 1] += f[1]; N[v * 3 + 2] += f[2]; } } });
  // сшитые точки — одна нормаль
  for (const [i, j] of C.seams) for (let k = 0; k < 3; k++) { const s_ = N[i * 3 + k] + N[j * 3 + k]; N[i * 3 + k] = s_; N[j * 3 + k] = s_; }
  for (let i = 0; i < n; i++) { const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1; N[i * 3] /= l; N[i * 3 + 1] /= l; N[i * 3 + 2] /= l; }
}
// рельеф складок: base-вершины по координатам выкройки (px, py), середины рёбер — среднее концов; нормали пересчитываются (грани складок
// ловят свет), впадины темнее
function pleatRelief(geo, rl, edges, nbase) {
  if (typeof window !== 'undefined' && window.__noRelief) return;
  const pos = geo.attributes.position.array, nor = geo.attributes.normal.array, col = geo.attributes.color ? geo.attributes.color.array : null;
  const n = pos.length / 3, px = new Float32Array(n), py = new Float32Array(n);
  for (let k = 0; k < nbase; k++) { px[k] = rl.px[k]; py[k] = rl.py[k]; }
  let r = nbase; for (const [i, j] of edges) { px[r] = (px[i] + px[j]) / 2; py[r] = (py[i] + py[j]) / 2; r++; }
  const n0 = nor.slice();
  for (let k = 0; k < n; k++) { const w = Math.cos(Math.abs(px[k]) / rl.half * Math.PI), t = Math.min(1, Math.max(0, py[k] / rl.L));
    const a = rl.amp * (0.25 + 0.75 * t) * w; pos[k * 3] += nor[k * 3] * a; pos[k * 3 + 1] += nor[k * 3 + 1] * a; pos[k * 3 + 2] += nor[k * 3 + 2] * a;
    if (col) { const f = 0.8 + 0.2 * (w + 1) / 2; col[k * 3] *= f; col[k * 3 + 1] *= f; col[k * 3 + 2] *= f; } }
  // нормали: грани складок ловят свет, но не до бликов на рёбрах — смесь с гладкими
  geo.computeVertexNormals(); for (let k = 0; k < n * 3; k += 3) { const x = nor[k] * 0.6 + n0[k] * 0.4, y = nor[k + 1] * 0.6 + n0[k + 1] * 0.4, z = nor[k + 2] * 0.6 + n0[k + 2] * 0.4, l = Math.hypot(x, y, z) || 1; nor[k] = x / l; nor[k + 1] = y / l; nor[k + 2] = z / l; }
}
// кадр анимации: та же сетка (порядок вершин как в clothMeshes), новые точки ткани P — без пересборки
export function clothUpdate(g, P) {
  const cl = g.userData.cloth; if (!cl) return; const C = cl.C, n = P.length / 3, N = cl.N || (cl.N = new Float32Array(n * 3));
  clothNormals(C, P, cl.flips, N); const AO = clothAO(C, P, N, n), WR = clothWrk(C, P, n);
  g.children.forEach(mesh => { const cm = mesh.userData.cm; if (!cm) return; const m = C.meshes[cm.mi], pa = mesh.geometry.attributes.position, na = mesh.geometry.attributes.normal, ca = mesh.geometry.attributes.color, wa = mesh.geometry.attributes.wrk;
    if (wa) { const w = wa.array; m.verts.forEach((v, k) => { w[k * 2] = WR[v * 2]; w[k * 2 + 1] = WR[v * 2 + 1]; }); let r = m.verts.length; for (const [i, j] of cm.edges) { w[r * 2] = (w[i * 2] + w[j * 2]) / 2; w[r * 2 + 1] = (w[i * 2 + 1] + w[j * 2 + 1]) / 2; r++; } wa.needsUpdate = true; }
    const pos = pa.array, nor = na.array, col = ca ? ca.array : null;
    m.verts.forEach((v, k) => { pos[k * 3] = P[v * 3]; pos[k * 3 + 1] = P[v * 3 + 1]; pos[k * 3 + 2] = P[v * 3 + 2]; nor[k * 3] = N[v * 3]; nor[k * 3 + 1] = N[v * 3 + 1]; nor[k * 3 + 2] = N[v * 3 + 2]; if (col) col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = AO[v]; });
    let r = m.verts.length; for (const [i, j] of cm.edges) {
      const dx = pos[j * 3] - pos[i * 3], dy = pos[j * 3 + 1] - pos[i * 3 + 1], dz = pos[j * 3 + 2] - pos[i * 3 + 2], nix = nor[i * 3], niy = nor[i * 3 + 1], niz = nor[i * 3 + 2], njx = nor[j * 3], njy = nor[j * 3 + 1], njz = nor[j * 3 + 2];
      const v_ = 2 * ((dx * (nix + njx) + dy * (niy + njy) + dz * (niz + njz)) / Math.max(1e-9, dx * dx + dy * dy + dz * dz)), hx = nix + njx - v_ * dx, hy = niy + njy - v_ * dy, hz = niz + njz - v_ * dz, hl = Math.hypot(hx, hy, hz) || 1;
      const off = ((njx - nix) * dx + (njy - niy) * dy + (njz - niz) * dz) / 8;
      pos[r * 3] = (pos[i * 3] + pos[j * 3]) / 2 + (nix + njx) / 2 * off; pos[r * 3 + 1] = (pos[i * 3 + 1] + pos[j * 3 + 1]) / 2 + (niy + njy) / 2 * off; pos[r * 3 + 2] = (pos[i * 3 + 2] + pos[j * 3 + 2]) / 2 + (niz + njz) / 2 * off;
      nor[r * 3] = hx / hl; nor[r * 3 + 1] = hy / hl; nor[r * 3 + 2] = hz / hl; if (col) col[r * 3] = col[r * 3 + 1] = col[r * 3 + 2] = (col[i * 3] + col[j * 3]) / 2; r++; }
    if (m.relief) pleatRelief(mesh.geometry, m.relief, cm.edges, m.verts.length);
    pa.needsUpdate = true; na.needsUpdate = true; if (ca) ca.needsUpdate = true; mesh.geometry.computeBoundingSphere(); });
  const pgs = g.children.filter(o => o.userData.pg).map(o => o.userData.pg); if (pgs.length) { pleatSmooth(pgs, P); pgs.forEach(pg => pleatUpdate(pg, P, N, AO)); }
  g.children.forEach(o => { if (o.userData.lining) liningUpdate(o); });
  decorUpdate(g, P, N);
}
export function clothMeshes(C, P, H) {
  const g = new THREE.Group(), n = P.length / 3, N = new Float32Array(n * 3);
  const sub = (i, j) => [P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2]];
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  // лицом наружу: нормаль треугольника смотрит от середины детали (у трубы рукава — от её оси)
  const flips = C.meshes.map(m => { let cx = 0, cy = 0, cz = 0; m.verts.forEach(v => { cx += P[v * 3]; cy += P[v * 3 + 1]; cz += P[v * 3 + 2]; }); const k = m.verts.length || 1; cx /= k; cy /= k; cz /= k;
    let sgn = 0; for (let t = 0; t < m.tris.length; t += 3) { const a = m.verts[m.tris[t]], b = m.verts[m.tris[t + 1]], c = m.verts[m.tris[t + 2]], f = cross(sub(b, a), sub(c, a));
      sgn += f[0] * (P[a * 3] - cx) + f[1] * (P[a * 3 + 1] - cy) + f[2] * (P[a * 3 + 2] - cz); } return sgn < 0; });
  clothNormals(C, P, flips, N);
  // затенение складок (как ambient occlusion): во впадине точка ниже соседей по нормали — темнее, на гребне — чуть светлее
  const AO = clothAO(C, P, N, n), WR = clothWrk(C, P, n);
  g.userData.cloth = {C, flips};
  C.meshes.forEach((m, mi) => {
    if (m.relief && m.relief.rc) {   // складки формой (pleats.js): своя мелкая сетка
      if (!m.mat.vertexColors) { m.mat.vertexColors = true; m.mat.needsUpdate = true; }
      const pg = pleatGrid(m, m.relief); const mesh = new THREE.Mesh(pg.geo, m.mat); mesh.castShadow = true; mesh.receiveShadow = true; if (m.role) mesh.userData.role = m.role; mesh.userData.pg = pg; g.add(mesh); return; }
    const pos = [], nor = [], uv = [], col = [], uvm = [], wrk = [], idx = [], mid = new Map();
    m.verts.forEach((v, k) => { pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); nor.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); uv.push(m.uv[k][0], 1 - m.uv[k][1]); col.push(AO[v], AO[v], AO[v]);
      const um = m.uvm ? m.uvm[k] : [0, 0]; uvm.push(um[0], um[1]); wrk.push(WR[v * 2], WR[v * 2 + 1]); });
    // середина ребра — по кривой (PN-треугольники): точка сдвинута по нормалям концов, а не лежит на прямой
    const edge = (i, j) => { const key = i < j ? i * 100000 + j : j * 100000 + i; let r = mid.get(key); if (r != null) return r;
      const pi = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], pj = [pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]], ni = [nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]], nj = [nor[j * 3], nor[j * 3 + 1], nor[j * 3 + 2]];
      const d = [pj[0] - pi[0], pj[1] - pi[1], pj[2] - pi[2]], v = 2 * ((d[0] * (ni[0] + nj[0]) + d[1] * (ni[1] + nj[1]) + d[2] * (ni[2] + nj[2])) / Math.max(1e-9, d[0] * d[0] + d[1] * d[1] + d[2] * d[2]));
      const hn = [ni[0] + nj[0] - v * d[0], ni[1] + nj[1] - v * d[1], ni[2] + nj[2] - v * d[2]], hl = Math.hypot(...hn) || 1;
      const off = ((nj[0] - ni[0]) * d[0] + (nj[1] - ni[1]) * d[1] + (nj[2] - ni[2]) * d[2]) / 8;   // прогиб дуги над хордой
      r = pos.length / 3;
      pos.push((pi[0] + pj[0]) / 2 + (ni[0] + nj[0]) / 2 * off, (pi[1] + pj[1]) / 2 + (ni[1] + nj[1]) / 2 * off, (pi[2] + pj[2]) / 2 + (ni[2] + nj[2]) / 2 * off);
      nor.push(hn[0] / hl, hn[1] / hl, hn[2] / hl); uv.push((uv[i * 2] + uv[j * 2]) / 2, (uv[i * 2 + 1] + uv[j * 2 + 1]) / 2); uvm.push((uvm[i * 2] + uvm[j * 2]) / 2, (uvm[i * 2 + 1] + uvm[j * 2 + 1]) / 2); wrk.push((wrk[i * 2] + wrk[j * 2]) / 2, (wrk[i * 2 + 1] + wrk[j * 2 + 1]) / 2); const ao = (col[i * 3] + col[j * 3]) / 2; col.push(ao, ao, ao); mid.set(key, r); return r; };
    for (let t = 0; t < m.tris.length; t += 3) { let a = m.tris[t], b = m.tris[t + 1], c = m.tris[t + 2]; if (flips[mi]) { const x = b; b = c; c = x; }
      const ab = edge(a, b), bc = edge(b, c), ca = edge(c, a); idx.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('uvm', new THREE.Float32BufferAttribute(uvm, 2)); geo.setAttribute('wrk', new THREE.Float32BufferAttribute(wrk, 2)); geo.setIndex(idx);
    if (!m.mat.vertexColors) { m.mat.vertexColors = true; if (!m.mat.userData.ft) aoEmissive(m.mat); m.mat.needsUpdate = true; }
    const mesh = new THREE.Mesh(geo, m.mat); mesh.castShadow = true; mesh.receiveShadow = true; if (m.role) mesh.userData.role = m.role;
    mesh.userData.cm = {mi, edges: [...mid.entries()].sort((a_, b_) => a_[1] - b_[1]).map(([key]) => [Math.floor(key / 100000), key % 100000])}; g.add(mesh);
    if (m.relief) pleatRelief(geo, m.relief, mesh.userData.cm.edges, m.verts.length);
  });
  { const pgs = g.children.filter(o => o.userData.pg).map(o => o.userData.pg); if (pgs.length) { pleatSmooth(pgs, P); pgs.forEach(pg => pleatUpdate(pg, P, N, AO)); } }
  // слой для следующих вещей — только корпус (перед, спинка); рукава и капюшон не расширяют «туловище» верхней вещи
  // нижний слой у подола (шорты-подклад, подъюбник) — лента по низу переда и спинки
  if (C.lining) { const pgs = g.children.filter(o => o.userData.pg).map(o => o.userData.pg); if (pgs.length === 2) { const lm = new THREE.MeshPhysicalMaterial({color: LIN(C.lining.color), roughness: 0.9, side: THREE.DoubleSide, sheen: new THREE.Color(0.1, 0.1, 0.1), envMapIntensity: 0.3, reflectivity: 0.15}); clothify(lm, FT.woven);
    const band = liningBand(pgs, C.lining.len, lm); liningUpdate(band); g.add(band); } }
  buildDecor(g, C, P, N);   // пуговицы — объёмные детали на ткани
  if (fit.UNDER) C.meshes.forEach(m => { if (m.role !== 'front' && m.role !== 'back') return; m.verts.forEach(i => noteAB(P[i * 3 + 1] / H, Math.abs(P[i * 3]) + 0.004, Math.abs(P[i * 3 + 2]) + 0.004)); });
  return g;
}
