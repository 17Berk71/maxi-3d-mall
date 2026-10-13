// Воротник-стойка и капюшон.
import * as THREE from 'three';
import {ellP} from './geometry.js';
import {addPanel, addTube} from './pattern.js';

// капюшон: две боковины, сшитые по затылку и макушке, низ вшит в горловину (перед и спинка); лицевой край свободный
// up — на голове; иначе лежит на спине (боковины сложены, макушка внизу)
// воротник-стойка: невысокая лента вокруг шеи, низ вшит в горловину (перед и спинка), ткань — с верха переда на фото
export function addStand(C, d, yTop, fronts, pb, mat, a) {
  const neck = fronts.concat([pb]).flatMap(P_ => P_.pts.filter(p => p.edge && p.lab === 'neck').map(p => p.g)); if (neck.length < 6) return;   // точки выреза (для проверки, что вырез есть)
  // длина стойки = длина выреза горловины (по выкройке переда и спинки): кольцо «шея + 1.1 см» было ~44 см при вырезе ~33 —
  // вырез растягивался вдвое у середины переда и спинки; но не теснее шеи
  let neckLen = 0; fronts.concat([pb]).forEach(P_ => { const q = P_.pts.filter(p => p.edge && p.lab === 'neck').sort((a_, b_) => a_.x - b_.x); for (let i = 1; i < q.length; i++) neckLen += Math.hypot(q[i].x - q[i - 1].x, q[i].y - q[i - 1].y); });
  const segs = 24, h = 0.034 * d.s, r = Math.max(d.neck + 0.006, neckLen / (2 * Math.PI)), yb = yTop - 0.008;
  const tube = addTube(C, new THREE.Vector3(0, yb, 0), new THREE.Vector3(0, 1, 0), h, s => r - s * 0.08, segs, 3, mat, 1, (u, v) => [a.cx + (u - 0.5) * 0.12, 0.01 + v * 0.03]);
  C.meshes[C.meshes.length - 1].role = 'stand';   // пуговицы, что на фото на стойке, пришиваются к ней (decor.js)
  // шов: точка горловины — к точке нижнего кольца стойки по месту вдоль выреза: передний вырез (слева направо) — на переднюю
  // половину кольца, задний — на заднюю. Раньше — по углу начального положения: перед и спинка в начале лежат плоско далеко
  // впереди и позади фигуры, все точки выреза попадали в переднюю/заднюю четверть кольца, бока стойки оставались без пары, а угол
  // выреза у плеча растягивался вдвое
  fronts.concat([pb]).forEach(P_ => { const back = P_ === pb, q = P_.pts.filter(p => p.edge && p.lab === 'neck').sort((a_, b_) => a_.x - b_.x); if (q.length < 2) return;
    const cum = [0]; for (let i = 1; i < q.length; i++) cum.push(cum[i - 1] + Math.hypot(q[i].x - q[i - 1].x, q[i].y - q[i - 1].y)); const tot = cum[cum.length - 1] || 1;
    q.forEach((p, i) => { const th = Math.PI * (1 - cum[i] / tot), want = back ? -th : th; let best = 9, tq = null;   /* x слева (−) → угол π, справа → 0; спереди z > 0 */
      tube.top.forEach(t => { const ax = Math.atan2(C.P[t * 3 + 2], C.P[t * 3]) - want, da = Math.abs(Math.atan2(Math.sin(ax), Math.cos(ax))); if (da < best) { best = da; tq = t; } });
      if (tq != null) C.seams.push([p.g, tq]); }); });
}
export function addHood(C, d, M, fronts, pb, mat, up, cell, uvS) {
  const H = d.H, k = Math.pow(H / 1.8, 0.5), Hh = 0.355 * k;
  // горловина: точки края «neck» переда и спинки — по половинам, от середины переда к середине спинки
  const neckF = fronts.flatMap(pf => pf.pts).filter(p => p.edge && p.lab === 'neck'), neckB = pb.pts.filter(p => p.edge && p.lab === 'neck');
  [-1, 1].forEach(side => {
    const chain = neckF.filter(p => p.x * side >= -1e-4).sort((a, b) => Math.abs(a.x) - Math.abs(b.x)).concat(neckB.filter(p => p.x * side > 0).sort((a, b) => Math.abs(b.x) - Math.abs(a.x))).map(p => p.g);
    if (chain.length < 3) return;
    const Lb = (ellP(M.NW / 2, M.ND) + ellP(M.NW / 2, M.NDb)) / 4 * 1.05;
    const poly = [[0, 0], [Lb, 0], [Lb + 0.045, 0.1 * k], [Lb + 0.03, 0.22 * k], [Lb - 0.03, 0.31 * k], [Lb - 0.12, Hh - 0.005], [0.07, Hh], [0, Hh - 0.04]];
    const labs = ['neck', 'crown', 'crown', 'crown', 'crown', 'crown', 'face', 'face'];
    const Ub = Lb + 0.045, yTop = d.fN * H + 0.012;
    // начальное положение: низ — на горловине вокруг шеи (перед ниже, спинка выше), выше — стенкой вверх и чуть наружу;
    // капюшон «на спине» получается из того же положения: после сшивания его сдувает назад (сила), и он ложится на спину
    // выше горловины лицевой край расходится к бокам лица (иначе вырез для лица закрыт)
    const hc = 0.93 * H, Rh = 0.098 * d.s * 1.16 + 0.035;
    const place = (u, v) => { if (up) { // на голове: как шлем — низ у шеи, верх по макушке, лицевой край у боков лица, затылок сзади
        const e = (-55 + 140 * Math.min(1, v / Hh)) * Math.PI / 180, a = (48 + 132 * Math.min(1, u / Ub)) * Math.PI / 180, ce = Math.cos(e);
        return [side * Math.sin(a) * ce * Rh * 0.92, hc + Math.sin(e) * Rh, Math.cos(a) * ce * Rh]; }
      const p0 = Math.min(1, v / 0.12) * 0.8, ph = p0 + (Math.PI - p0) * Math.min(1, u / Lb), c = Math.cos(ph), sn = Math.sin(ph), out = Math.min(v, 0.12) * 0.35 + (u > Lb ? u - Lb : 0);
      const rx = M.NW / 2 + 0.008 + out, rz = (c > 0 ? d.neck + 0.035 : d.neck + 0.012) + out;
      return [side * sn * rx, yTop - (M.ND * (1 + c) / 2 + M.NDb * (1 - c) / 2) - 0.004 + v, c * rz]; };
    const hp = addPanel(C, poly, labs, cell * 0.9, place, (u, v) => uvS ? uvS(u / Ub, v / Hh) : [0.5 + side * u / (Ub * 2.2), v / Hh], mat, 'hood');
    // низ капюшона → горловина по доле длины
    const bot = hp.pts.filter(p => p.edge && p.lab === 'neck').sort((a, b) => a.x - b.x);
    bot.forEach((p, i) => { const t = bot.length > 1 ? i / (bot.length - 1) : 0; C.seams.push([p.g, chain[Math.round(t * (chain.length - 1))]]); });
    (C.hood = C.hood || []).push(hp);
    if (!up) (C.force = C.force || []).push({ids: hp.pts.map(p => p.g), f: [0, -2, -14]});
    // на голове: лицевой край держится у лба (в жизни — трение о волосы и форма капюшона), иначе капюшон съезжает назад
    else { hp.pts.forEach(p => { (C.stickyIds = C.stickyIds || []).push(p.g); }); }
  });
  // затылок и макушка: левая боковина с правой (точки края «crown» с одинаковыми координатами выкройки)
  if (C.hood && C.hood.length === 2) { const [A, B] = C.hood, eb = B.pts.filter(p => p.edge && p.lab === 'crown');
    A.pts.forEach(p => { if (!p.edge || p.lab !== 'crown') return; let best = cell, q = null; for (const b of eb) { const dd = Math.abs(b.x - p.x) + Math.abs(b.y - p.y); if (dd < best) { best = dd; q = b; } } if (q) C.seams.push([p.g, q.g]); }); }
}
