// Толщина ткани на открытых краях (низ, манжеты, горловина, борта): у сетки ткани один слой — край выглядел
// бумажным. Вдоль каждого края детали, не пришитого к другой детали, — узкий скруглённый бортик: от лица ткани
// через закруглённый срез к изнанке на толщину ткани. Строится по сетке показа и в кадрах анимации едет вместе с ней.
import * as THREE from 'three';

// толщина края (м) по виду ткани: подгибка — два слоя
const THICK = {jersey: 0.0026, rib: 0.003, fleece: 0.004, chunky: 0.0055, woven: 0.0024, suiting: 0.003, twill: 0.0036, nylon: 0.0016, suede: 0.0032};
export function edgeThickness(FT, ft) { const k = Object.keys(FT).find(k => FT[k] === ft); return THICK[k] || 0.0026; }

const ROWS = [[0, 0], [0.5, 0.42], [1, 0]];   // по профилю среза: доля толщины внутрь и выпуклость наружу (в долях толщины)

// mesh — деталь показа (userData.cm), sewn(k) — вершина показа k пришита к другой детали
export function buildEdge(mesh, sewn, t) {
  const geo = mesh.geometry, idx = geo.index.array, cnt = new Map(), third = new Map();
  for (let q = 0; q < idx.length; q += 3) for (const [x, y, z] of [[0, 1, 2], [1, 2, 0], [2, 0, 1]]) {
    const a = idx[q + x], b = idx[q + y], key = a < b ? a * 1e6 + b : b * 1e6 + a; cnt.set(key, (cnt.get(key) || 0) + 1); third.set(key, [a, b, idx[q + z]]); }
  // край — в порядке обхода своего треугольника: у всех кусков бортика одна сторона лица (иначе нормали вразнобой — тёмный пунктир)
  const edges = []; cnt.forEach((c, key) => { if (c !== 1) return; const [a, b, z] = third.get(key); if (sewn(a) && sewn(b)) return; edges.push([a, b, z]); });
  if (!edges.length) return null;
  const vs = [...new Set(edges.flatMap(e => [e[0], e[1]]))], at = new Map(vs.map((v, i) => [v, i])), K = vs.length, R = ROWS.length;
  const index = []; for (const [a, b] of edges) for (let r = 0; r < R - 1; r++) { const A = r * K + at.get(a), B = r * K + at.get(b), C = (r + 1) * K + at.get(a), D = (r + 1) * K + at.get(b); index.push(A, B, C, B, D, C); }
  const g = new THREE.BufferGeometry(), n = K * R, src = geo.attributes;
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  for (const name of ['uv', 'uvm', 'wrk', 'color']) if (src[name]) { const s = src[name].itemSize, A = new Float32Array(n * s);
    for (let r = 0; r < R; r++) vs.forEach((v, i) => { for (let c = 0; c < s; c++) A[(r * K + i) * s + c] = src[name].array[v * s + c]; }); g.setAttribute(name, new THREE.Float32BufferAttribute(A, s)); }
  g.setIndex(index);
  const out = new THREE.Mesh(g, mesh.material); out.castShadow = false; out.receiveShadow = true;
  out.userData.edge = {src: mesh, vs, edges, at, K, t}; edgeUpdate(out);
  return out;
}
// пересчитать бортик по текущей сетке показа (после clothUpdate)
export function edgeUpdate(out) {
  const {src, vs, edges, at, K, t} = out.userData.edge, P = src.geometry.attributes.position.array, N = src.geometry.attributes.normal.array;
  const away = new Float32Array(K * 3);   // наружу от ткани по её поверхности (поперёк края)
  for (const [a, b, c] of edges) { const ex = P[b * 3] - P[a * 3], ey = P[b * 3 + 1] - P[a * 3 + 1], ez = P[b * 3 + 2] - P[a * 3 + 2];
    const nx = N[a * 3] + N[b * 3], ny = N[a * 3 + 1] + N[b * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2];
    let wx = ey * nz - ez * ny, wy = ez * nx - ex * nz, wz = ex * ny - ey * nx;
    const mx = (P[a * 3] + P[b * 3]) / 2, my = (P[a * 3 + 1] + P[b * 3 + 1]) / 2, mz = (P[a * 3 + 2] + P[b * 3 + 2]) / 2;
    if (wx * (mx - P[c * 3]) + wy * (my - P[c * 3 + 1]) + wz * (mz - P[c * 3 + 2]) < 0) { wx = -wx; wy = -wy; wz = -wz; }
    const l = Math.hypot(wx, wy, wz) || 1; for (const v of [a, b]) { const i = at.get(v) * 3; away[i] += wx / l; away[i + 1] += wy / l; away[i + 2] += wz / l; } }
  const pos = out.geometry.attributes.position.array;
  vs.forEach((v, i) => { const l = Math.hypot(away[i * 3], away[i * 3 + 1], away[i * 3 + 2]) || 1, ax = away[i * 3] / l, ay = away[i * 3 + 1] / l, az = away[i * 3 + 2] / l;
    ROWS.forEach(([inn, bulge], r) => { const q = (r * K + i) * 3;
      pos[q] = P[v * 3] - N[v * 3] * inn * t + ax * bulge * t; pos[q + 1] = P[v * 3 + 1] - N[v * 3 + 1] * inn * t + ay * bulge * t; pos[q + 2] = P[v * 3 + 2] - N[v * 3 + 2] * inn * t + az * bulge * t; }); });
  out.geometry.computeVertexNormals(); out.geometry.attributes.position.needsUpdate = true; out.geometry.attributes.normal.needsUpdate = true;
  const col = out.geometry.attributes.color, sc = src.geometry.attributes.color;
  if (col && sc) { for (let r = 0; r < ROWS.length; r++) vs.forEach((v, i) => { for (let c = 0; c < 3; c++) col.array[(r * K + i) * 3 + c] = sc.array[v * 3 + c] * (r === 2 ? 0.9 : 1); }); col.needsUpdate = true; }
  out.geometry.computeBoundingSphere();
}
