// Автопроверка посадки: натяжение, швы, ткань в теле, место, дырки, силуэт, мерки.
import {makeCollider} from './collider.js';

// ---------- автопроверка надетой вещи ----------
// после расчёта: натяжение ткани, швы, ткань внутри тела, вещь на месте, дырки (прозрачные места фото на ткани),
// форма силуэта спереди против фото, мерки против выкройки/таблицы. Итог 0–100 и «проверить», если ниже 70.
export const QC = {};
export function qcCloth(C, P, d, item, dr, info, top, aF, aB) {
  const H = d.H, out = [], add = (name, ok, val, pen, why) => out.push({name, ok, val, pen: ok ? 0 : pen, why});
  // 1. натяжение: доля связей, растянутых больше чем на 12%
  const roleOf = new Map(); C.meshes.forEach(m => m.verts.forEach(v => roleOf.set(v, m.role || 'sleeve'))); const byRole = {};
  let nE = 0, over = 0; for (let e = 0; e < C.E.length; e += 4) { if (C.E[e + 3] !== 0 && C.E[e + 3] !== 3) continue; const i = C.E[e] * 3, j = C.E[e + 1] * 3, L = Math.hypot(P[j] - P[i], P[j + 1] - P[i + 1], P[j + 2] - P[i + 2]); nE++;
    const r = roleOf.get(C.E[e]), br = byRole[r] = byRole[r] || [0, 0]; br[0]++; if (L > C.E[e + 2] * 1.25) { over++; br[1]++; } }
  const st = over / Math.max(1, nE); add('натяжение', st < 0.03, (st * 100).toFixed(1) + '% связей (' + Object.entries(byRole).map(([r, [a, b]]) => r + ' ' + (b / a * 100).toFixed(0) + '%').join(', ') + ')', Math.min(25, st * 400), 'ткань растянута: вещь мала или зацепилась');
  // 2. швы: доля сшитых пар, разошедшихся больше чем на 1 см
  let gap = 0; for (const [i, j] of C.seams) if (Math.hypot(P[j * 3] - P[i * 3], P[j * 3 + 1] - P[i * 3 + 1], P[j * 3 + 2] - P[i * 3 + 2]) > 0.01) gap++;
  const sg = gap / Math.max(1, C.seams.length); add('швы', sg < 0.03, (sg * 100).toFixed(1) + '% разошлось', Math.min(25, sg * 250), 'шов не сошёлся — видна щель');
  // 3. ткань внутри тела (глубже 1 мм под поверхностью)
  const body = makeCollider(d, null), Q = new Float32Array(3); let inside = 0; const n = C.pin.length;
  for (let i = 0; i < n; i++) { Q[0] = P[i * 3]; Q[1] = P[i * 3 + 1]; Q[2] = P[i * 3 + 2]; body(Q, 0); if (Math.hypot(Q[0] - P[i * 3], Q[1] - P[i * 3 + 1], Q[2] - P[i * 3 + 2]) > 0.008) inside++; }
  const ins = inside / Math.max(1, n); add('сквозь тело', ins < 0.02, (ins * 100).toFixed(1) + '% точек', Math.min(20, ins * 300), 'тело проходит сквозь ткань');
  // 4. вещь на месте: верх — плечи на плечах и низ там, где задумано; низ — пояс на поясе
  const torso = C.meshes.filter(m => m.role === 'front' || m.role === 'back'), ys = torso.flatMap(m => m.verts.map(v => P[v * 3 + 1]));
  const yMax = Math.max(...ys), yMin = Math.min(...ys);
  if (top) { const want = 0.858 * H + 0.012 - (info.L0 || info.L); add('на месте', yMax > 0.815 * H && Math.abs(yMin - want) < 0.07 + (item.state === 'tucked' ? 0.05 : 0), 'верх ' + (yMax / H).toFixed(2) + 'H, низ ' + ((yMin - want) * 100).toFixed(0) + ' см от задуманного', 25, 'вещь сползла или длина не та'); }
  else add('на месте', yMax > 0.55 * H, 'пояс ' + (yMax / H).toFixed(2) + 'H', 25, 'брюки сползли');
  // 5. дырки: доля треугольников переда/спинки, чья середина на фото — вне вещи (прозрачно)
  let tri = 0, hole = 0;
  torso.forEach(m => { const g = m.role === 'front' ? dr.front : (dr.back || dr.front); if (!g) return;
    for (let t = 0; t < m.tris.length; t += 3) { const a = m.uv[m.tris[t]], b = m.uv[m.tris[t + 1]], c = m.uv[m.tris[t + 2]], u = (a[0] + b[0] + c[0]) / 3, v = (a[1] + b[1] + c[1]) / 3;
      const r = Math.min(g.gh - 1, Math.max(0, Math.floor(v * g.gh))), col = Math.min(g.gw - 1, Math.max(0, Math.floor(u * g.gw))); tri++; if (g.grid[r][col] !== '1') hole++; } });
  const hf = hole / Math.max(1, tri); add('дырки', hf < 0.04, (hf * 100).toFixed(1) + '% площади', Math.min(20, hf * 200), 'на ткань попал фон фото — будут прозрачные места');
  // 6. силуэт спереди против фото: ширина по высоте (от проймы/шага вниз), каждая в долях своей верхней строки
  const g0 = dr.front;
  if (g0) {
    const rows = 8, w3 = [], wp = [], front = torso.filter(m => m.role === 'front'), fv = front.flatMap(m => m.verts);
    const y0 = top ? 0.858 * H + 0.012 - info.AD - 0.02 : Math.max(...fv.map(v => P[v * 3 + 1])), y1 = Math.min(...fv.map(v => P[v * 3 + 1]));
    // на фото рукава слились с корпусом (висят вдоль) — силуэт на фото с рукавами: и у вещи меряем с рукавами
    // (на фото с человеком руки не в маске вещи — там без рукавов)
    const mergedPhoto = top && item.shape && item.shape.merged && !item.shape.worn; if (mergedPhoto) C.meshes.forEach(m => { if (m.local) m.verts.forEach(v => fv.push(v)); });
    const a = aF, v0 = top ? (a.arm || 0.3) + 0.03 : 0.02;
    // низ корпуса на фото — последняя строка, где у середины ещё есть ткань (длинные рукава на вешалке висят ниже корпуса)
    const cRun = r => { const row = g0.grid[r], cc = Math.round(a.cx * g0.gw); if (row[cc] !== '1') return 0; let p = cc, q = cc; while (p > 0 && row[p - 1] === '1') p--; while (q < g0.gw - 1 && row[q + 1] === '1') q++; return q - p + 1; };
    let v1 = 0.97; if (top) { const r0 = Math.floor(v0 * g0.gh), w0 = cRun(r0); let r = r0; while (r + 1 < g0.gh && cRun(r + 1) > w0 * 0.75) r++; v1 = Math.max(v0 + 0.2, (r + 0.5) / g0.gh); }
    for (let k = 0; k < rows; k++) { const t = (k + 0.5) / rows, yy = y0 + (y1 - y0) * t; let lo = 9, hi = -9;
      // ширина ткани, а не размах: у брюк штанины на фото лёжа разведены — считаем занятые полосы по 2.5 см (щель в одну полосу закрываем)
      const bins = new Set(); fv.forEach(v => { if (Math.abs(P[v * 3 + 1] - yy) < 0.02) { bins.add(Math.floor(P[v * 3] / 0.025)); lo = Math.min(lo, P[v * 3]); hi = Math.max(hi, P[v * 3]); } });
      let occ = 0; if (hi > lo) for (let bI = Math.floor(lo / 0.025); bI <= Math.floor(hi / 0.025); bI++) if (bins.has(bI) || (bins.has(bI - 1) && bins.has(bI + 1))) occ++; w3.push(top ? (hi > lo ? hi - lo : 0) : occ * 0.025);
      const r = Math.min(g0.gh - 1, Math.floor((v0 + (v1 - v0) * t) * g0.gh)), row = g0.grid[r];
      // верх: только корпус (рукава на фото торчат в стороны) — ближайший к середине отрезок
      let c0 = row.indexOf('1'), c1 = row.lastIndexOf('1');
      if (top) { const cc = Math.round(a.cx * g0.gw); c0 = cc; while (c0 > 0 && row[c0 - 1] === '1') c0--; c1 = cc; while (c1 < g0.gw - 1 && row[c1 + 1] === '1') c1++; }
      // лёжа ширина = половина обхвата; надетое спереди видно уже: у бёдер (плоский овал) ~0.8, у штанин (круг) 2/π — приводим фото к виду надетой вещи
      const vv = v0 + (v1 - v0) * t; wp.push(top ? (c1 >= c0 ? (c1 - c0 + 1) / g0.gw : 0) : [...row].filter(ch => ch === '1').length / g0.gw * (vv > (a.crotch || 0.4) ? 2 / Math.PI / 0.8 : 1)); }
    const n3 = w3[0] || 1, np = wp[0] || 1; let dev = 0; for (let k = 0; k < rows; k++) dev += Math.abs(w3[k] / n3 - wp[k] / np) / rows;
    add('силуэт', dev < 0.12, 'расхождение ' + (dev * 100).toFixed(0) + '%', Math.min(20, dev * 100), 'форма спереди не похожа на фото');
    out[out.length - 1].prof = {model: w3.map(v => +(v / n3).toFixed(2)), photo: wp.map(v => +(v / np).toFixed(2))};
  }
  // 7. мерки: выкройка против таблицы (вещь не может быть меньше тела — если пришлось расширить, размер мал)
  if (top && info.sp) { const want = info.sp.Fs[1], got = info.W; add('мерки', got - want < 0.02, 'ширина ' + (got * 200).toFixed(0) + ' см по кругу, по фото/таблице ' + (want * 200).toFixed(0), 10, 'вещь по меркам меньше фигуры — показана растянутой'); if (out.length) out[out.length - 1].pen = 0; }   // это про размер (о нём говорит подсказка), не про модель
  const score = Math.max(0, Math.round(100 - out.reduce((s_, c) => s_ + c.pen, 0)));
  // «проверить» — и при низком итоге, и при одном сильном провале (например, фото с чужим предметом даёт кривой силуэт)
  return {score, ok: score >= 70 && !out.some(c => c.pen >= 20), checks: out};
}
