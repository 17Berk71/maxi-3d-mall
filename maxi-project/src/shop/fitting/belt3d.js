// Пояс и ремень — отдельной объёмной деталью поверх ткани (пользователь: «пояс влип в куртку», «ремень — не часть брюк»).
// Фабрика находит пояс на фото переда (drape_cut.find_belt → drape.front.a.belt: v0, v1 — доли высоты выреза, rgb, buckle)
// и стирает его с ткани. Здесь: какие точки ткани под поясом (по uv детали «перед» → высота → все точки корпуса на этой высоте),
// в расчёте пояс стягивает их к телу (C.belt, sim.js), на показе — лента по внешнему краю ткани и пряжка спереди.
import * as THREE from 'three';
import {LIN} from './common.js';
import {bodyAB} from './geometry.js';

// выбрать точки ткани под поясом и задать стяжку (до расчёта): C.belt = [i, a, b, …] — полуоси эллипса, за который точку не пускаем
export function beltPrepare(C, item, d, margin, roles) {
  const aF = (item.drape && item.drape.front && item.drape.front.a) || {}, b = aF.belt;
  if (!b || (item.state || '') === 'open' || (typeof window !== 'undefined' && window.__noBelt)) return;
  roles = roles || ['front', 'back'];
  let y0 = 1e9, y1 = -1e9;
  C.meshes.forEach(m => { if (m.role !== 'front') return; m.verts.forEach((v, k) => { const vv = m.uv[k][1]; if (vv >= b.v0 && vv <= b.v1) { const y = C.P[v * 3 + 1]; y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }); });
  if (!(y1 > y0)) return;
  const cell = 0.022; y0 -= cell * 0.3; y1 += cell * 0.3;
  const ids = [], cinch = item.kind !== 'pants' && item.kind !== 'jeans' && item.kind !== 'shorts' && item.kind !== 'skirt';
  C.meshes.forEach(m => { if (!roles.includes(m.role)) return; m.verts.forEach(v => { const y = C.P[v * 3 + 1]; if (y >= y0 && y <= y1) ids.push(v); }); });
  if (!ids.length) return;
  const H = d.H, yc = (y0 + y1) / 2;
  C.beltInfo = {ids, h: Math.max(0.018, Math.min(0.09, y1 - y0 - cell * 0.6)), rgb: b.rgb || item.color || '#777', buckle: b.buckle || null, fabric: item.color, kind: item.kind};
  if (!cinch) return;
  // стягивает к телу, но не туже тела с утеплителем и небольшим зазором (пуховик под поясом сжат, а не продавлен)
  const arr = []; ids.forEach(i => { const yy = C.P[i * 3 + 1], ab = bodyAB(d, yy / H), g = (margin || 0) * 0.6 + 0.012; arr.push(i, ab.a + g, ab.b + g); });
  C.belt = arr; C.beltY = yc;
}

const MAT = new Map();
function beltMat(hex, fabric, metal) {
  const key = hex + '|' + metal; if (MAT.has(key)) return MAT.get(key);
  const c = new THREE.Color(hex), f = new THREE.Color(fabric || hex), hc = {}, hf = {}; c.getHSL(hc); f.getHSL(hf);
  const leather = Math.abs(hc.l - hf.l) > 0.12 || Math.min(Math.abs(hc.h - hf.h), 1 - Math.abs(hc.h - hf.h)) > 0.06;   // другого цвета — кожаный ремень
  const m = metal ? new THREE.MeshPhysicalMaterial({color: LIN('#b9b6ae'), roughness: 0.3, metalness: 0.9, envMapIntensity: 0.9})
    : new THREE.MeshPhysicalMaterial({color: LIN(hex).multiplyScalar(0.92), roughness: leather ? 0.45 : 0.8, metalness: 0, clearcoat: leather ? 0.35 : 0, clearcoatRoughness: 0.5,
      sheen: leather ? null : new THREE.Color(0.12, 0.12, 0.12), envMapIntensity: leather ? 0.35 : 0.15});
  m.userData.leather = leather; MAT.set(key, m); return m;
}

const NA = 72;
// радиус ткани по углу на высоте пояса (наибольший из точек пояса в секторе, пустые секторы — по соседям)
function ringOf(B, P) {
  const R = new Float32Array(NA).fill(-1); let ys = 0;
  for (const i of B.ids) { const x = P[i * 3], z = P[i * 3 + 2], a = Math.atan2(x, z), k = ((Math.round(a / (2 * Math.PI) * NA) % NA) + NA) % NA, r = Math.hypot(x, z); if (r > R[k]) R[k] = r; ys += P[i * 3 + 1]; }
  const yc = ys / B.ids.length;
  for (let pass = 0; pass < NA; pass++) { let left = false; for (let k = 0; k < NA; k++) if (R[k] < 0) { const a = R[(k + NA - 1) % NA], b = R[(k + 1) % NA]; if (a >= 0 || b >= 0) R[k] = a >= 0 && b >= 0 ? (a + b) / 2 : Math.max(a, b); else left = true; } if (!left) break; }
  const S = new Float32Array(NA); for (let k = 0; k < NA; k++) S[k] = (R[(k + NA - 2) % NA] + 2 * R[(k + NA - 1) % NA] + 3 * R[k] + 2 * R[(k + 1) % NA] + R[(k + 2) % NA]) / 9;
  return {R: S, yc};
}
// лента: прямоугольное сечение h × t со скруглением, по кругу NA сегментов
function bandGeo(B, P, geo) {
  const {R, yc} = ringOf(B, P), h = B.h, t = B.t, prof = [[0, -h / 2], [t * 0.7, -h / 2], [t, -h / 2 + t * 0.3], [t, h / 2 - t * 0.3], [t * 0.7, h / 2], [0, h / 2]], np_ = prof.length;
  const pos = new Float32Array((NA + 1) * np_ * 3);
  for (let k = 0; k <= NA; k++) { const a = k / NA * 2 * Math.PI, sx = Math.sin(a), cz = Math.cos(a), r0 = R[k % NA] + 0.0015;
    prof.forEach(([dr, dy], j) => { const q = (k * np_ + j) * 3; pos[q] = sx * (r0 + dr); pos[q + 1] = yc + dy; pos[q + 2] = cz * (r0 + dr); }); }
  if (!geo) { geo = new THREE.BufferGeometry(); const idx = [];
    for (let k = 0; k < NA; k++) for (let j = 0; j < np_ - 1; j++) { const a = k * np_ + j, b = (k + 1) * np_ + j; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    geo.setIndex(idx); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); }
  else { geo.attributes.position.array.set(pos); geo.attributes.position.needsUpdate = true; }
  geo.computeVertexNormals(); geo.computeBoundingSphere();
  return {geo, R, yc};
}
// пряжка: рамка (четыре бруска) спереди на ленте
function buckleGroup(B, mat) {
  const g = new THREE.Group(), w = B.bw, h = B.h * 1.25, s = Math.max(0.005, B.h * 0.18), d = 0.006;
  [[0, h / 2 - s / 2, w, s], [0, -h / 2 + s / 2, w, s], [-w / 2 + s / 2, 0, s, h], [w / 2 - s / 2, 0, s, h]].forEach(([x, y, ww, hh]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, d), mat); m.position.set(x, y, d / 2); g.add(m); });
  return g;
}
function placeBuckle(B, ring) {
  if (!B.bk) return; const a = B.ua, k = ((Math.round(a / (2 * Math.PI) * NA) % NA) + NA) % NA, r = ring.R[k] + B.t + 0.002;
  B.bk.position.set(Math.sin(a) * r, ring.yc, Math.cos(a) * r); B.bk.rotation.set(0, a, 0);
}
export function buildBelt(g, C, P) {
  const I = C.beltInfo; if (!I) return;
  const B = {ids: I.ids, h: I.h, t: I.kind === 'puffer' ? 0.006 : 0.004};
  const mat = beltMat(I.rgb, I.fabric, false), r = bandGeo(B, P, null), mesh = new THREE.Mesh(r.geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.belt = B; g.add(mesh);
  // пряжка: с фото (u — доля ширины выреза; середина 0.5 → спереди по центру), у кожаного ремня — металлическая
  const wantBk = I.buckle || mat.userData.leather;
  if (wantBk) { const metal = mat.userData.leather; B.bw = Math.max(B.h * 1.1, Math.min(B.h * 2.4, I.buckle ? B.h * 1.6 : B.h * 1.3));
    B.ua = I.buckle ? (I.buckle.u - 0.5) * 1.2 : 0; B.bk = buckleGroup(B, metal ? beltMat('#b9b6ae', null, true) : beltMat('#' + new THREE.Color(I.rgb).offsetHSL(0, 0, -0.04).getHexString(), I.rgb, false)); B.bk.userData.beltBk = true; g.add(B.bk); placeBuckle(B, r); }
  B.final = {pos: r.geo.attributes.position.array.slice(), bk: B.bk ? {p: B.bk.position.clone(), r: B.bk.rotation.clone()} : null};
}
// конец анимации — итоговое положение (как у пуговиц)
export function beltFinal(g) {
  g.children.forEach(o => { const B = o.userData.belt; if (!B || !B.final) return; o.geometry.attributes.position.array.set(B.final.pos); o.geometry.attributes.position.needsUpdate = true; o.geometry.computeVertexNormals();
    if (B.bk && B.final.bk) { B.bk.position.copy(B.final.bk.p); B.bk.rotation.copy(B.final.bk.r); } });
}
export function beltUpdate(g, P) {
  g.children.forEach(o => { const B = o.userData.belt; if (!B) return; const r = bandGeo(B, P, o.geometry); placeBuckle(B, r); });
}
