// Фигура по меркам: размеры тела, профиль туловища по высоте, суставы рук.
import * as THREE from 'three';
import {armRad} from './geometry.js';

// ---------- размеры: ориентир по обхватам (российская сетка) ----------
export function sizeHint(b) {
  const top = Math.max(38, Math.min(66, Math.round(b.chest / 4) * 2));
  const bottom = b.sex === 'f' ? Math.max(38, Math.min(66, Math.round((b.hips - 8) / 4) * 2)) : top;
  return {top, bottom};
}

// ---------- фигура: профиль туловища и конечностей по параметрам ----------
// телосложение: если задан вес — по индексу массы тела (18 → худощавое, 30 → плотное), иначе ползунок
const buildOf = b => b.weight ? Math.max(0, Math.min(1, (b.weight / Math.pow(b.height / 100, 2) - 18) / 12)) : (b.build == null ? 0.5 : b.build);
export function bodyDims(b) {
  const d = bodyDims0(b); d.legX = Math.max(d.hips * 0.55, d.thigh + 0.013);
  // уровни (доли роста): верх выкройки у шеи сзади, плечевая точка у шеи, пояс брюк; у манекена по сетке — по нему (mannequin.js)
  d.fN = 0.858; d.fHPS = 0.848; d.fW = 0.595; return d;   // зазор между бёдрами ~2.5 см — для шагового шва
}
function bodyDims0(b) {
  b = Object.assign({}, b, {build: buildOf(b)});
  const H = b.height / 100, s = H / 1.7, k = 0.86 + b.build * 0.34, R = c => c / 100 / (2 * Math.PI);
  const m = b.sex === 'm';
  return {
    H, s, k, m, b,
    chest: R(b.chest), waist: R(b.waist), hips: R(b.hips),
    neck: 0.052 * s * (m ? 1.12 : 1) * (0.9 + b.build * 0.2),
    shX: m ? 1.42 : 1.3,           // ширина плеч относительно груди
    legX: 0,   // ниже: ноги стоят с небольшим зазором (между бёдрами проходит шаговый шов брюк)
    // бёдра ног заполняют таз: верх ног не уже нижней части туловища (иначе туловище «сидит» на тонких ногах, как на палочках)
    thigh: R(b.hips) * 0.63 * (0.92 + b.build * 0.16),
  };
}
// радиус туловища на высоте yf (доля роста)
export function torsoR(d, yf) {
  // манекен по сетке (mhTables): радиус круга того же периметра, что эллипс полуширины A и полуглубины B строки
  if (d.mh) { const T = d.mh; let k = Math.max(0, Math.min(T.N - 1, Math.floor(yf * T.N))); while (k < T.N - 1 && !T.A[k]) k++; return T.G[k] / (2 * Math.PI); }
  const T = [[0.465, d.hips * 0.8], [0.5, d.hips * 0.97], [0.53, d.hips], [0.585, d.hips * 0.45 + d.waist * 0.55], [0.625, d.waist],
    [0.67, d.waist * 0.4 + d.chest * 0.6], [0.72, d.chest], [0.765, d.chest * 0.97], [0.8, d.chest * 0.86], [0.826, d.chest * 0.58], [0.842, d.neck * 1.5], [0.852, d.neck]];
  if (yf <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (yf <= T[i][0]) { const [y0, r0] = T[i - 1], [y1, r1] = T[i], t = (yf - y0) / (y1 - y0); return r0 + (r1 - r0) * (t * t * (3 - 2 * t)); }
  return T[T.length - 1][1];
}
// туловище не круглое: шире, чем глубже; плечи шире груди
// у мужской фигуры грудная клетка шире и площе (V-силуэт), таз уже; у женской — как было
export function sx(d, yf) {
  if (d.mh) { const T = d.mh; let k = Math.max(0, Math.min(T.N - 1, Math.floor(yf * T.N))); while (k < T.N - 1 && !T.A[k]) k++; const a = T.A[k], b = T.B[k] || a * 0.7; return a / (Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))) / (2 * Math.PI)); }
  const base = d.m ? 1.15 + 0.15 * Math.max(0, Math.min(1, (yf - 0.6) / 0.1)) : 1.2;
  const t = Math.max(0, Math.min(1, (yf - 0.72) / 0.08)); return base + (d.shX - base) * t * (yf < 0.82 ? 1 : Math.max(0, 1 - (yf - 0.82) / 0.03));
}
// плавно, без ступенек: ступенька между узлами профиля проступала сквозь ткань щелью
export function sz(d, yf) {
  if (d.mh) { const T = d.mh; let k = Math.max(0, Math.min(T.N - 1, Math.floor(yf * T.N))); while (k < T.N - 1 && !T.A[k]) k++; const a = T.A[k], b = T.B[k] || a * 0.7; return b / (Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))) / (2 * Math.PI)); }
  const ss = (a, b, y) => { const t = Math.max(0, Math.min(1, (y - a) / (b - a))); return t * t * (3 - 2 * t); };
  const t = ss(d.m ? 0.6 : 0.62, d.m ? 0.66 : 0.68, yf) * (1 - ss(d.m ? 0.77 : 0.75, d.m ? 0.83 : 0.81, yf)); return 0.78 + ((d.m ? 0.7 : 0.84) - 0.78) * t; }

// лофт вдоль оси Y по профилю [[y, r], ...] (y по возрастанию), с эллиптическим сечением
export function loft(prof, segs, fx, fz, phi0, phiLen) {
  const pts = prof.map(([y, r]) => new THREE.Vector2(Math.max(0.002, r), y));
  const g = new THREE.LatheGeometry(pts, segs, phi0 || 0, phiLen || Math.PI * 2);
  if (fx || fz) { const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i); P.setX(i, P.getX(i) * (fx ? fx(y) : 1)); P.setZ(i, P.getZ(i) * (fz ? fz(y) : 1)); } g.computeVertexNormals(); }
  return g;
}
// труба вдоль конечности: профиль [[t 0..1, r]], длина L, сверху вниз; потом поворот и перенос
export function limb(prof, L, segs) {
  const pr = prof.map(([t, r]) => [-t * L, r]).reverse();
  return loft(pr, segs || 20);
}
// плечевой сустав: рука висит вплотную к боку, но не входит в грудную клетку (иначе ткань не может сойтись под рукой)
export function armX(d) {
  if (d.mh) return d.mh.jL[0];
  const th = d.armA || 0.16, dy = 0.08 * d.H, aCh = torsoR(d, 0.72) * sx(d, 0.72);
  return Math.max(d.chest * d.shX * 0.86, aCh + 0.012 + armRad(d, dy / (0.335 * d.H)) - dy * Math.tan(th));
}
export function armPose(d, side) {
  const y = 0.8 * d.H, x = side * armX(d);
  return {pos: new THREE.Vector3(x, y, 0), rot: side * (d.armA || 0.16), L: 0.335 * d.H};
}
