// Декор вещи отдельными объёмными деталями (пуговицы): не нарисован на ткани, а пришит к ней.
// Положение, размер и цвет — с фото переда (tools/wardrobe/drape_cut.py → drape.front.a.buttons: u, v — доли кадра
// выреза, r — доля ширины). На ткани пуговица держится за треугольник детали «перед» (весовые доли трёх точек ткани):
// в кадрах анимации она двигается и поворачивается вместе с тканью.
import * as THREE from 'three';
import {LIN} from './common.js';

// форма пуговицы — профиль вращения (ось — z, по нормали ткани): светлая «жемчужная» — полусфера,
// тёмная (пластик, рог) — невысокий диск со скруглённым краем и лёгкой выпуклостью
const GEO = {};
function buttonGeo(pearl) {
  const k = pearl ? 'p' : 'd'; if (GEO[k]) return GEO[k];
  const prof = pearl ? [[0, 0.78], [0.38, 0.72], [0.66, 0.58], [0.86, 0.38], [0.97, 0.16], [1, 0], [0.9, -0.1], [0, -0.1]]
    : [[0, 0.3], [0.45, 0.29], [0.72, 0.24], [0.9, 0.15], [1, 0.03], [0.96, -0.08], [0.85, -0.12], [0, -0.12]];
  const g = new THREE.LatheGeometry(prof.slice().reverse().map(([r, z]) => new THREE.Vector2(r, z)), 24)   /* снизу вверх: иначе грани смотрят внутрь и видна изнанка */; g.rotateX(Math.PI / 2); g.computeVertexNormals();
  return (GEO[k] = g);
}
const MATS = new Map();
// цвет с фото — среднее по пятну пуговицы вместе с бликом: чуть темнее, блеск дадут свет и лак
function buttonMat(hex, pearl) {
  const key = hex + pearl;
  if (!MATS.has(key)) MATS.set(key, new THREE.MeshPhysicalMaterial({color: LIN(hex).multiplyScalar(pearl ? 0.72 : 0.85), roughness: pearl ? 0.28 : 0.55, metalness: 0,
    clearcoat: pearl ? 1 : 0.15, clearcoatRoughness: pearl ? 0.2 : 0.45, sheen: pearl ? new THREE.Color(0.25, 0.22, 0.26) : null, envMapIntensity: pearl ? 0.45 : 0.15}));
  return MATS.get(key);
}
// где на ткани: треугольник детали с этой uv (координаты фото) и масштаб uv → метры выкройки
function locate(C, role, u, v) {
  for (const m of C.meshes) { if (m.role !== role) continue;
    for (let t = 0; t < m.tris.length; t += 3) { const ia = m.tris[t], ib = m.tris[t + 1], ic = m.tris[t + 2], A = m.uv[ia], B = m.uv[ib], Cc = m.uv[ic];
      const d = (B[1] - Cc[1]) * (A[0] - Cc[0]) + (Cc[0] - B[0]) * (A[1] - Cc[1]); if (Math.abs(d) < 1e-12) continue;
      const w0 = ((B[1] - Cc[1]) * (u - Cc[0]) + (Cc[0] - B[0]) * (v - Cc[1])) / d, w1 = ((Cc[1] - A[1]) * (u - Cc[0]) + (A[0] - Cc[0]) * (v - Cc[1])) / d, w2 = 1 - w0 - w1;
      if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
      // метров выкройки на единицу u: по рёбрам треугольника (uvm — координаты выкройки в метрах)
      let k = 0; if (m.uvm) { const e = [[A, B, m.uvm[ia], m.uvm[ib]], [B, Cc, m.uvm[ib], m.uvm[ic]], [A, Cc, m.uvm[ia], m.uvm[ic]]]; let s = 0, n = 0;
        for (const [p, q, P_, Q_] of e) { const du = Math.hypot(q[0] - p[0], q[1] - p[1]); if (du > 1e-6) { s += Math.hypot(Q_[0] - P_[0], Q_[1] - P_[1]) / du; n++; } } k = n ? s / n : 0; }
      return {v: [m.verts[ia], m.verts[ib], m.verts[ic]], w: [w0, w1, w2], k}; } }
  return null;
}
function place(mesh, d, P, N) {
  const [a, b, c] = d.v, [w0, w1, w2] = d.w, n = new THREE.Vector3(N[a * 3] * w0 + N[b * 3] * w1 + N[c * 3] * w2, N[a * 3 + 1] * w0 + N[b * 3 + 1] * w1 + N[c * 3 + 1] * w2, N[a * 3 + 2] * w0 + N[b * 3 + 2] * w1 + N[c * 3 + 2] * w2).normalize();
  const off = d.r * (d.pearl ? 0.45 : 0.22) + 0.0016;   /* над тканью: сетка показа между узлами выпуклее, чем плоскость треугольника, — иначе пуговица наполовину в ткани */
  mesh.position.set(P[a * 3] * w0 + P[b * 3] * w1 + P[c * 3] * w2 + n.x * off, P[a * 3 + 1] * w0 + P[b * 3 + 1] * w1 + P[c * 3 + 1] * w2 + n.y * off, P[a * 3 + 2] * w0 + P[b * 3 + 2] * w1 + P[c * 3 + 2] * w2 + n.z * off);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
}
// пришить декор к сетке ткани g (C.decor из выкройки, P — точки ткани, N — нормали)
export function buildDecor(g, C, P, N) {
  if (!C.decor || !C.decor.length) return;
  const list = [], found = [];
  for (const b of C.decor) { const d = locate(C, b.role || 'front', b.u, b.v); if (d && d.k) found.push([b, d, b.r * d.k]); }
  if (!found.length) return;
  // у ряда пуговиц размер один: по медиане (масштаб выкройки у горловины и ниже немного разный)
  const rMed = Math.max(0.0035, Math.min(0.011, found.map(f => f[2]).sort((a, b) => a - b)[found.length >> 1]));
  const stand = C.meshes.find(m => m.role === 'stand');
  for (const [b, d] of found) { d.r = rMed;   // радиус в метрах: доля ширины фото → метры выкройки
    // пуговица под воротником-стойкой (на фото — на самой стойке): пришить к ближайшей точке стойки, иначе её режет воротник
    if (stand) { const [a0, b0, c0] = d.v, [w0, w1, w2] = d.w, px = P[a0 * 3] * w0 + P[b0 * 3] * w1 + P[c0 * 3] * w2, py = P[a0 * 3 + 1] * w0 + P[b0 * 3 + 1] * w1 + P[c0 * 3 + 1] * w2, pz = P[a0 * 3 + 2] * w0 + P[b0 * 3 + 2] * w1 + P[c0 * 3 + 2] * w2;
      let yMin = 9, yMax = -9, rMax = 0; stand.verts.forEach(v => { yMin = Math.min(yMin, P[v * 3 + 1]); yMax = Math.max(yMax, P[v * 3 + 1]); rMax = Math.max(rMax, Math.hypot(P[v * 3], P[v * 3 + 2])); });
      if (py > yMin - d.r && Math.hypot(px, pz) < rMax + d.r) { let best = 9, bi = -1; stand.verts.forEach(v => { const yy = Math.min(yMax - d.r * 1.3, Math.max(yMin + d.r * 1.3, py)), dd = Math.hypot(P[v * 3] - px, P[v * 3 + 1] - yy, P[v * 3 + 2] - pz); if (dd < best) { best = dd; bi = v; } });
        if (bi < 0) continue; d.v = [bi, bi, bi]; d.w = [1, 0, 0]; } }
    const hsl = {}; new THREE.Color(b.rgb || '#e8e4dc').getHSL(hsl); const pearl = hsl.l > 0.55; d.pearl = pearl;
    const mesh = new THREE.Mesh(buttonGeo(pearl), buttonMat(b.rgb || '#e8e4dc', pearl)); mesh.scale.setScalar(d.r); mesh.castShadow = false; mesh.receiveShadow = false; mesh.userData.decor = d;   /* мелочь: своя тень на шарике давала «полумесяцы» */
    place(mesh, d, P, N); mesh.userData.final = {p: mesh.position.clone(), q: mesh.quaternion.clone()}; g.add(mesh); list.push(mesh); }
  g.userData.decor = list;
}
// кадр анимации: декор вслед за тканью
export function decorUpdate(g, P, N) { (g.userData.decor || []).forEach(mesh => place(mesh, mesh.userData.decor, P, N)); }
