// Выкройка: пресеты ткани, детали по контуру (addPanel), трубы-рукава (addTube).
import * as THREE from 'three';

// ---------- библиотека выкроек (шаблоны) + симуляция ----------
// Вещь собирается из деталей кроя по меркам: фото задаёт форму и рисунок, таблица размеров (или оценка) — масштаб.
// Футболка/свитшот/худи: перед и спинка (плечевые и боковые швы) + два рукава-трубы, вшитые в проймы.
// Брюки/джинсы/шорты: перед и спинка во всю ширину (обе штанины), сшиты по боковым и шаговым швам; у спинки в заду ткани больше.
// Ткань — пресеты по виду вещи (деним жёсткий, трикотаж мягкий).
export const FABRIC = {
  tee: {bend: 0.3, comp: 0.05, stretch: 0.9}, sweater: {bend: 0.4, comp: 0.08, stretch: 0.85}, hoodie: {bend: 0.45, comp: 0.08, stretch: 0.85},
  shirt: {bend: 0.45, comp: 0.06, stretch: 1}, jacket: {bend: 0.7, comp: 0.15, stretch: 1},
  jeans: {bend: 0.7, comp: 0.18, stretch: 1}, pants: {bend: 0.45, comp: 0.08, stretch: 1}, shorts: {bend: 0.6, comp: 0.12, stretch: 1},
  // пальто — плотное; пуховик — толстый: стоит от тела на margin (объём утеплителя); платье и юбка — мягкие
  coat: {bend: 0.8, comp: 0.2, stretch: 1, compW: 0.6}, puffer: {bend: 0.9, comp: 0.35, stretch: 1, compW: 0.8, margin: 0.028}, vest: {bend: 0.7, comp: 0.15, stretch: 1}, dress: {bend: 0.18, comp: 0.05, stretch: 0.9, compW: 0.95}, skirt: {bend: 0.22, comp: 0.06, stretch: 0.95, compW: 0.95}, skirtP: {bend: 0.7, comp: 0.25, stretch: 1, compW: 0.95, mem: true},   // заутюженные складки: изгиб держит форму в обе стороны   // уток не сжимается: лишняя ширина клёша уходит в волны у подола
};
const pip = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
export const segDist = (px, py, [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(px - ax - dx * t, py - ay - dy * t); };
// правая половина контура (от точки на оси до точки на оси) + метки отрезков → весь контур зеркально
export function mirrorPoly(pts, labs) {
  const n = pts.length, P = pts.slice(), L = labs.slice(0, n - 1);
  L.push(labs[n - 2]);                                               // отрезок через ось внизу (низ/шаг) — та же метка
  for (let i = n - 2; i >= 1; i--) { P.push([-pts[i][0], pts[i][1]]); L.push(labs[i - 1]); }
  return {P, L};
}
// ткань из частиц: детали (плоские слои) и трубы (рукава), связи, швы, закреплённые точки
export function makeCloth() {
  return {P: [], E: [], seams: [], pin: [], meshes: [], tether: [],
    add(x, y, z) { this.P.push(x, y, z); this.pin.push(0); return this.pin.length - 1; },
    link(i, j, rest, kind, sc) { if (i == null || j == null) return; this.E.push(i, j, rest * (sc || 1), kind); },
  };
}
// плоская деталь по многоугольнику (метры, y вниз от верха): сетка cell, края помечены ближайшим отрезком контура (метки labels[i])
export function addPanel(C, poly, labels, cell, place, uvf, mat, role, restScale, classify, ox) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; poly.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
  // ox: сетка привязана к этой линии (столбцы на ox ± cell/2) — у зеркальных деталей точки шва по середине совпадают
  if (ox != null) x0 = ox - Math.ceil((ox - x0) / cell) * cell;
  const gw = Math.ceil((x1 - x0) / cell) + 1, gh = Math.ceil((y1 - y0) / cell) + 1, id = new Map(), pts = [];
  // точки внутри выкройки; «висящие» (меньше двух прямых соседей — угол у скруглённого низа, зубец края) убираем: держатся только
  // по диагонали, в расчёте болтаются и после сшивания торчат «крылышками»
  const inside = new Set(); for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) if (pip(poly, x0 + (c + 0.5) * cell, y0 + (r + 0.5) * cell)) inside.add(r * 10000 + c);
  for (let pass = 0; pass < 3; pass++) for (const key of [...inside]) { const r = Math.floor(key / 10000), c = key % 10000; let nb = 0;
    for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (inside.has((r + a) * 10000 + c + b)) nb++; if (nb < 2) inside.delete(key); }
  for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) { const x = x0 + (c + 0.5) * cell, y = y0 + (r + 0.5) * cell; if (inside.has(r * 10000 + c)) { const [px, py, pz] = place(x, y); id.set(r * 10000 + c, pts.length); pts.push({r, c, x, y, g: C.add(px, py, pz)}); } }
  const at = (r, c) => { const k = id.get(r * 10000 + c); return k == null ? null : pts[k]; };
  const rs = (a, b) => restScale ? restScale((a.x + b.x) / 2, (a.y + b.y) / 2) : 1;
  // крайняя точка сбоку — на край выкройки по горизонтали: иначе наклонный край (юбка, клёш, штанина) — «лесенка» сетки,
  // и после сшивания по боку торчат зубцы
  pts.forEach(p => { const L = !at(p.r, p.c - 1), R = !at(p.r, p.c + 1); if (L === R) return; let best = null;
    for (let i = 0; i < poly.length; i++) { const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length]; if ((ay > p.y) === (by > p.y) || ay === by) continue;
      const x = ax + (bx - ax) * (p.y - ay) / (by - ay); if ((R && x >= p.x - 1e-6) || (L && x <= p.x + 1e-6)) { if (best == null || Math.abs(x - p.x) < Math.abs(best - p.x)) best = x; } }
    if (best != null && Math.abs(best - p.x) < cell) { p.x = best + (R ? -1 : 1) * cell * 0.05; const [px, py, pz] = place(p.x, p.y); C.P[p.g * 3] = px; C.P[p.g * 3 + 1] = py; C.P[p.g * 3 + 2] = pz; } });
  // так же по вертикали: верхняя (плечо, горловина) и нижняя (низ) крайняя точка столбца — на линию выкройки. Иначе наклонное плечо —
  // «лесенка», у переда и спинки ступеньки разные, и шов между пришитыми точками расходится ромбиками
  pts.forEach(p => { const U = !at(p.r - 1, p.c), D = !at(p.r + 1, p.c); if (U === D) return; let best = null;
    for (let i = 0; i < poly.length; i++) { const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length]; if ((ax > p.x) === (bx > p.x) || ax === bx || Math.abs(by - ay) > Math.abs(bx - ax)) continue;   /* только пологие края (низ, плечо, горловина): крутой бок — дело горизонтальной подгонки */
      const y = ay + (by - ay) * (p.x - ax) / (bx - ax); if ((U && y <= p.y + 1e-6) || (D && y >= p.y - 1e-6)) { if (best == null || Math.abs(y - p.y) < Math.abs(best - p.y)) best = y; } }
    if (best != null && Math.abs(best - p.y) < cell) { p.y = best + (U ? 1 : -1) * cell * 0.05; const [px, py, pz] = place(p.x, p.y); C.P[p.g * 3] = px; C.P[p.g * 3 + 1] = py; C.P[p.g * 3 + 2] = pz; } });
  pts.forEach(p => {
    // поперечные связи (уток) — вид 3: ткань почти не сжимается поперёк (иначе труба штанины «усыхает» по обхвату и липнет к ноге)
    for (const [dr, dc, kind] of [[0, 1, 3], [1, 0, 0], [1, 1, 1], [1, -1, 1], [0, 2, 2], [2, 0, 2]]) { const q = at(p.r + dr, p.c + dc); if (q) C.link(p.g, q.g, Math.hypot(q.x - p.x, q.y - p.y), kind, rs(p, q)); }
    p.edge = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([a, b]) => !at(p.r + a, p.c + b));
    if (p.edge) { let best = 1e9, lab = null; for (let i = 0; i < poly.length; i++) { const dd = segDist(p.x, p.y, poly[i], poly[(i + 1) % poly.length]); if (dd < best) { best = dd; lab = labels[i]; } } p.lab = lab;
      if (classify) p.lab = classify(p, {up: !at(p.r - 1, p.c), down: !at(p.r + 1, p.c), side: !at(p.r, p.c - 1) || !at(p.r, p.c + 1)}) || lab; }
  });
  // привязи (long-range): точка не уходит от верхней точки своего столбца дальше, чем по выкройке.
  // Без них длинная тяжёлая вещь (платье, пальто) за несколько итераций расчёта «вытекает» вниз — связи вверху растянуты на 10–40%
  if (C.tether) { const top = new Map(); pts.forEach(p => { const t = top.get(p.c); if (!t || p.r < t.r) top.set(p.c, p); });
    pts.forEach(p => { const t = top.get(p.c); if (t && p !== t && p.r - t.r > 2) C.tether.push(p.g, t.g, Math.hypot(p.x - t.x, p.y - t.y) * (restScale ? restScale((p.x + t.x) / 2, (p.y + t.y) / 2) : 1) * 1.02); }); }
  const tris = [];
  pts.forEach((p, k) => { p.k = k; });
  // треугольники — в местных номерах вершин этой детали
  pts.forEach(p => { const b = at(p.r, p.c + 1), c = at(p.r + 1, p.c), e = at(p.r + 1, p.c + 1);
    // диагонали квадратов — «ёлочкой» (через одну в другую сторону): иначе вся деталь гнётся по одной диагонали — косые полосы-складки
    if (b && c && e) { if ((p.r + p.c) & 1) tris.push(p.k, c.k, e.k, p.k, e.k, b.k); else tris.push(p.k, c.k, b.k, b.k, c.k, e.k); } else if (b && e) tris.push(p.k, e.k, b.k); else if (c && e) tris.push(p.k, c.k, e.k); else if (b && c) tris.push(p.k, c.k, b.k); });
  // угол «лесенки» без левой верхней точки: треугольник из трёх остальных (иначе у края дырка-ромбик)
  pts.forEach(e => { const b = at(e.r - 1, e.c), c = at(e.r, e.c - 1); if (!b || !c || at(e.r - 1, e.c - 1)) return; tris.push(b.k, c.k, e.k); });
  C.meshes.push({verts: pts.map(p => p.g), uv: pts.map(p => uvf(p.x, p.y)), uvm: pts.map(p => [p.x, p.y]), tris, mat, role});
  return {pts, at};
}
// труба (рукав) вдоль оси от S0 по D: кольца, радиус rad(s); возвращает верхнее кольцо (угол 0 — сверху-снаружи, π/2 — спереди)
export function addTube(C, S0, D, len, rad, segs, rings, mat, side, uvf, cap) {
  // cap: {center, ry, rz} — верхнее кольцо (окат) лежит в плоскости проймы; ниже рукав плавно становится трубой вокруг руки
  const e1 = new THREE.Vector3(-D.y, D.x, 0).normalize().multiplyScalar(side), e2 = new THREE.Vector3(0, 0, 1), up = new THREE.Vector3(0, 1, 0);
  const g = [], pos = [];
  for (let i = 0; i < rings; i++) { const s = len * i / (rings - 1), C0 = S0.clone().addScaledVector(D, s), r = rad(s), row = [], prow = [], t = cap ? Math.min(1, s / 0.09) : 1;
    for (let j = 0; j < segs; j++) { const a = j / segs * Math.PI * 2;
      const tube = C0.clone().addScaledVector(e1, Math.cos(a) * r).addScaledVector(e2, Math.sin(a) * r);
      const P = t < 1 ? cap.center.clone().addScaledVector(cap.up || up, Math.cos(a) * cap.ry).addScaledVector(e2, Math.sin(a) * cap.rz).lerp(tube, t * t * (3 - 2 * t)) : tube;
      row.push(C.add(P.x, P.y, P.z)); prow.push(P); }
    g.push(row); pos.push(prow); }
  const dist = (i1, j1, i2, j2) => pos[i1][j1 % segs].distanceTo(pos[i2][j2 % segs]);
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = g[i][j];
    C.link(a, g[i][(j + 1) % segs], dist(i, j, i, j + 1), 3); C.link(a, g[i][(j + 2) % segs], dist(i, j, i, j + 2), 2);
    // у оката запас по высоте (как у настоящего рукава): иначе пройма на теле уже выкройки и верх рукава натянут «рожками»
    // запас — в основном снизу (к подмышке); сверху, у плечевой точки, малый: лишняя ткань там стоит «фонариком» над плечом
    const aw = 0.3 + 0.7 * (1 - Math.cos(j / segs * Math.PI * 2)) / 2, ease = (v, k) => cap && i < 2 ? Math.max(v, (i === 0 ? 0.04 : 0.03) * k * aw) : v;
    if (i + 1 < rings) { C.link(a, g[i + 1][j], ease(dist(i, j, i + 1, j), 1), 0); C.link(a, g[i + 1][(j + 1) % segs], ease(dist(i, j, i + 1, j + 1), 1.15), 1); if (i + 2 < rings) C.link(a, g[i + 2][j], dist(i, j, i + 2, j), 2); } }
  const verts = [], uv = [], uvm = [], tris = [];
  for (let i = 0; i < rings; i++) { const s = len * i / (rings - 1), circ = 2 * Math.PI * rad(s); for (let j = 0; j <= segs; j++) { verts.push(g[i][j % segs]); uv.push(uvf(j / segs, i / (rings - 1))); uvm.push([j / segs * circ, s]); } }
  const W = segs + 1;
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < segs; j++) { const a = i * W + j, b = a + 1, c = a + W, e = c + 1; if ((i + j) & 1) tris.push(a, c, e, a, e, b); else tris.push(a, c, b, b, c, e); }
  C.meshes.push({verts, uv, uvm, tris, mat, local: true});
  return {top: g[0], bottom: g[rings - 1], rings: g};
}
