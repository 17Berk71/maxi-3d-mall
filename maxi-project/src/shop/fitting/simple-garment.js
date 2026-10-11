// Простые формы вещей (вариант «Б») и слои: вещь не уже той, что под ней.
import * as THREE from 'three';
import {armPose, limb, loft, sx, sz, torsoR} from './body.js';
import {fit} from './state.js';

// ---------- вещи ----------
export const EASE = {tee: .012, sweater: .018, hoodie: .026, shirt: .014, jacket: .036, coat: .044, puffer: .06, vest: .04, dress: .012, pants: .009, jeans: .008, shorts: .012, skirt: .014};
// слои: каждая вещь на туловище не уже той, что под ней (иначе нижняя «протыкает» верхнюю)
fit.UNDER = null; fit.UNDERZ = null;   // ширина и глубина по высоте (шаг 1% роста) от уже надетых вещей, метры
export const ui = yf => Math.max(0, Math.min(100, Math.round(yf * 100)));
export const uget = (A, yf) => { const i = ui(yf); return Math.max(A[i - 1] || 0, A[i] || 0, A[i + 1] || 0); };
// подогнать радиус под нижние слои и записать свой слой; fx, fz — масштаб сечения по X и Z на этой высоте
function layer(yf, r, fx, fz) {
  if (!fit.UNDER) return r;
  const u = uget(fit.UNDER, yf), uz = uget(fit.UNDERZ, yf);
  if (u) r = Math.max(r, (u + 0.007) / fx); if (uz) r = Math.max(r, (uz + 0.007) / fz);
  // свой слой пишем отдельно: вещь не должна «отталкиваться» сама от себя
  const i = ui(yf); fit.PEND[i] = Math.max(fit.PEND[i] || 0, r * fx); fit.PENDZ[i] = Math.max(fit.PENDZ[i] || 0, r * fz);
  return r;
}
fit.PEND = []; fit.PENDZ = [];
export function commitLayer() { fit.PEND.forEach((v, i) => { fit.UNDER[i] = Math.max(fit.UNDER[i] || 0, v || 0); }); fit.PENDZ.forEach((v, i) => { fit.UNDERZ[i] = Math.max(fit.UNDERZ[i] || 0, v || 0); }); fit.PEND = []; fit.PENDZ = []; }
export function torsoPiece(d, y0, y1, off, flare, mat, segs) {
  const H = d.H, prof = [], fx = y => sx(d, Math.max(0.6, y)) * 0.98 + 0.02, fz = y => sz(d, y) + (y < 0.6 ? 0.04 : 0);
  for (let yf = y0; yf <= y1 + 1e-6; yf += 0.012) {
    // ниже бёдер длинная вещь закрывает обе ноги — не сужается к промежности
    let r = (yf < 0.53 ? Math.max(torsoR(d, Math.max(0.47, yf)), d.hips * (yf < 0.5 ? 0.99 : 0.97)) : torsoR(d, yf)) + off;
    if (flare && yf < 0.6) r += flare * (0.6 - yf) / 0.6 * 2.2; if (yf > 0.83) r = Math.max(r, d.neck + off * 0.8);
    prof.push([yf * H, layer(yf, r, fx(yf), fz(yf))]);
  }
  return new THREE.Mesh(loft(prof, segs || 40, y => fx(y / H), y => fz(y / H)), mat);
}
// юбка (и низ платья): от пояса расширяется к подолу плавно, спереди-сзади тоже раскрывается
export function flarePiece(d, yTop, hem, off, amount, mat) {
  const H = d.H, prof = [], tOf = yf => Math.max(0, Math.min(1, (yTop - yf) / (yTop - hem)));
  for (let yf = hem; yf <= yTop + 1e-6; yf += 0.012) {
    const t = tOf(yf), base = yf >= 0.53 ? torsoR(d, yf) : d.hips;
    prof.push([yf * H, layer(yf, base + off + amount * Math.pow(t, 1.4), 1.2, 0.8 + 0.2 * t)]);
  }
  return new THREE.Mesh(loft(prof, 48, () => 1.2, y => 0.8 + 0.2 * tOf(y / H)), mat);
}
export function sleeves(d, len, off0, mat, g, cuff) {
  const off = Math.min(off0, 0.012 + off0 * 0.45);
  [-1, 1].forEach(side => {
    const a = armPose(d, side), r = t => (t < 0.12 ? 0.052 : t < 0.47 ? 0.046 - (t - 0.12) * 0.034 : 0.035 - (t - 0.47) * 0.018) * d.k * d.s + off;
    const prof = [[-0.07, r(0) * 0.3], [-0.035, r(0) * 0.85]]; for (let t = 0; t <= len + 1e-6; t += 0.05) prof.push([t, r(t)]);
    if (cuff && len > 0.9) prof.push([len, r(len) * 0.92]);
    const m = new THREE.Mesh(limb(prof, a.L), mat); m.position.copy(a.pos); m.rotation.z = a.rot; g.add(m);
  });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), mat);
  cap.scale.set(d.chest * d.shX * 0.97 + off * 0.7, d.chest * 0.42 + off * 0.7, d.chest * 0.7 + off * 0.7); cap.position.y = 0.8 * d.H; g.add(cap);
}
export function legPieces(d, yLow, off, mat, g, flare) {
  const H = d.H;
  [-1, 1].forEach(side => {
    const prof = [[0.04, 0.034], [0.07, 0.038], [0.15, 0.058 * d.k], [0.24, 0.05 * d.k], [0.28, 0.053 * d.k], [0.38, d.thigh * 0.88], [0.47, d.thigh], [0.5, d.thigh * 0.98]]
      .filter(([y]) => y >= yLow - 0.001).map(([y, r]) => [y * H, r * (y > 0.3 ? 1 : d.s) + off + (flare ? flare * Math.max(0, 0.3 - y) : 0)]);
    if (prof[0][0] > yLow * H + 0.001) prof.unshift([yLow * H, prof[0][1]]);
    const m = new THREE.Mesh(loft(prof, 22), mat); m.position.x = side * d.legX; g.add(m);
  });
}
// линия по передней поверхности вещи (молния, планка рубашки): повторяет изгиб груди и живота
export function frontLine(d, y0, y1, off, r, mat, g, flat) {
  const pts = []; for (let yf = y0; yf <= y1 + 1e-6; yf += 0.02) pts.push(new THREE.Vector3(0, yf * d.H, frontZ(d, yf, off) + r * 0.6));
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 6, false), mat); if (flat) m.scale.x = flat; g.add(m); return m;
}
function strip(w, h, depth, x, y, z, mat, g) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), mat); m.position.set(x, y, z); g.add(m); return m; }
export const frontZ = (d, yf, off) => {
  const zs = sz(d, yf) + (yf < 0.6 ? 0.04 : 0), uz = fit.PEND.length ? fit.PENDZ[ui(yf)] : fit.UNDERZ && fit.UNDERZ[ui(yf)];
  return uz ? uz : (torsoR(d, yf) + off) * zs;
};
