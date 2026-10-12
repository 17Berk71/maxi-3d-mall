// Автопроверка посадки (вторая версия, октябрь 2026): натяжение, швы, ткань в теле, место, дырки, обхват по высоте против фото
// в сантиметрах, замеры рулеткой/таблицы, размер против фигуры.
//
// Первая версия ставила 100, если ни одна проверка не провалена, даже на самой границе; допуски были мягкие (растяжение 25%,
// шов 1 см, низ ±7 см), а силуэт сравнивался в долях верхней строки по 8 строкам и среднему — пропускал «каркас» на бёдрах
// (84) и ромб у джинсов (100). Теперь:
// - штраф плавный: от «чисто» до «плохо» растёт линейно (ramp), балл 100 — только у вещи без замечаний;
// - допуски строже и по виду ткани (трикотаж тянется, тканое — почти нет);
// - силуэт: в каждой из 20–24 строк обхват надетой вещи (половина периметра выпуклой оболочки сечения ткани — то, что лёжа
//   было шириной) против ширины вещи на фото, переведённой в метры; штраф и за среднее, и за худшую строку;
// - замеры рулеткой или из таблицы (`cm`) сверяются с надетой вещью в сантиметрах.
import {makeCollider, legR} from './collider.js';
import {FT, fabricType} from './cloth-material.js';
import {bodyAB, ellP} from './geometry.js';
import {itemCm} from './sizes.js';

export const QC = {};
// 0 до a, 1 от b, между — линейно
const ramp = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
const med = arr => { const s = arr.filter(v => v != null && isFinite(v)).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
// предельное растяжение связи по виду ткани: трикотаж тянется, тканое — почти нет
const KNIT = new Set(['knit', 'rib', 'chunky']);
const stretchLim = ft => (ft && KNIT.has(ft.weave) ? 1.1 : 1.06);   /* тканое — 6%, как порог расслабления (relax.js): по косой тканое тянется на несколько процентов */

// сечение ткани плоскостью y: точки пересечения рёбер сетки (основа, уток, диагонали) [x, z]; keep — маска вершин
function slicePts(C, P, y, keep) {
  const out = [];
  for (let e = 0; e < C.E.length; e += 4) { const kd = C.E[e + 3]; if (kd !== 0 && kd !== 1 && kd !== 3) continue;
    const i = C.E[e], j = C.E[e + 1]; if (keep && !(keep[i] && keep[j])) continue;
    const yi = P[i * 3 + 1], yj = P[j * 3 + 1]; if ((yi - y) * (yj - y) > 0 || yi === yj) continue;
    const t = (y - yi) / (yj - yi); out.push([P[i * 3] + (P[j * 3] - P[i * 3]) * t, P[i * 3 + 2] + (P[j * 3 + 2] - P[i * 3 + 2]) * t]); }
  return out;
}
// половина периметра выпуклой оболочки (≈ ширина вещи лёжа: обхват без складок / 2)
function hullHalf(pts) {
  if (pts.length < 3) return 0; const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
  for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length > 1 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  const h = lo.slice(0, -1).concat(hi.slice(0, -1)); let s = 0; for (let i = 0; i < h.length; i++) { const a = h[i], b = h[(i + 1) % h.length]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return s / 2;
}
const xExtent = pts => { if (!pts.length) return 0; let lo = 9, hi = -9; pts.forEach(([x]) => { lo = Math.min(lo, x); hi = Math.max(hi, x); }); return hi - lo; };
// отрезки ткани в строке фото: [начало, конец] в столбцах; щели в 1–2 столбца закрываются
function runsOf(row) {
  const R = []; let s = -1; for (let c = 0; c <= row.length; c++) { const on = c < row.length && row[c] === '1'; if (on && s < 0) s = c; if (!on && s >= 0) { R.push([s, c - 1]); s = -1; } }
  for (let i = R.length - 1; i > 0; i--) if (R[i][0] - R[i - 1][1] <= 3) { R[i - 1][1] = R[i][1]; R.splice(i, 1); }
  return R;
}
const runW = r => r[1] - r[0] + 1, runC = r => (r[0] + r[1]) / 2;
// строки фото: отрезок у середины (корпус верха), весь размах, две штанины (ширина поперёк своей оси — штанины лежат «домиком»)
function photoRows(g, a) {
  const cc = Math.round((a.cx != null ? a.cx : 0.5) * g.gw), ar = g.H / g.gh / (g.W / g.gw);   // высота строки в ширинах столбца
  const R = g.grid.map(runsOf);
  const center = r => { const q = R[r]; if (!q || !q.length) return 0; const hit = q.find(e => e[0] <= cc && e[1] >= cc); return hit ? runW(hit) : 0; };
  const full = r => { const q = R[r]; return q && q.length ? q[q.length - 1][1] - q[0][0] + 1 : 0; };
  const legs = r => { const q = (R[r] || []).slice().sort((x, y) => runW(y) - runW(x)).slice(0, 2).sort((x, y) => x[0] - y[0]); if (!q.length) return null;
    if (q.length === 1) return [runW(q[0]) / 2, runW(q[0]) / 2];   // штанины лежат вплотную — поровну
    const ang = i => { const c = [r - 3, r + 3].map(rr => { const qq = (R[rr] || []).slice().sort((x, y) => runW(y) - runW(x)).slice(0, 2).sort((x, y) => x[0] - y[0]); return qq.length === 2 ? runC(qq[i]) : null; });
      if (c[0] == null || c[1] == null) return 1; const dx = c[1] - c[0], dy = 6 * ar; return dy / Math.hypot(dx, dy); };
    return [runW(q[0]) * ang(0), runW(q[1]) * ang(1)]; };
  const m3 = f => r => med([f(r - 1), f(r), f(r + 1)].map(v => v || null)) || 0;
  let rT = 0; while (rT < g.gh && !full(rT)) rT++; let rB = g.gh - 1; while (rB > rT && !full(rB)) rB--;
  return {center: m3(center), full: m3(full), legs, rT, rB, ar};
}
// где на вещи строка t (0 — верх участка, 1 — низ)
const whereTop = t => (t < 0.3 ? 'в груди' : t < 0.65 ? 'в талии' : 'внизу');
const whereLeg = t => (t < 0.3 ? 'вверху штанины' : t < 0.62 ? 'у колена' : 'внизу штанины');

export function qcCloth(C, P, d, item, dr, info, top, aF, aB) {
  const H = d.H, out = [], add = (name, ok, val, pen, why, x) => out.push(Object.assign({name, ok, val, pen: Math.round(pen * 10) / 10, why}, x || {}));
  const ft = fabricType(item), ftKey = Object.keys(FT).find(k_ => FT[k_] === ft) || '', sh = item.shape || {}, k = item.kind;
  const roleOf = new Map(); C.meshes.forEach(m => m.verts.forEach(v => roleOf.set(v, m.role || 'sleeve')));
  const nV = C.pin.length, mask = f => { const M = new Uint8Array(nV); C.meshes.forEach(m => { if (f(m)) m.verts.forEach(v => { M[v] = 1; }); }); return M; };
  const torsoM = C.meshes.filter(m => m.role === 'front' || m.role === 'back'), torsoK = mask(m => m.role === 'front' || m.role === 'back'), allK = mask(() => true);
  const ysT = torsoM.flatMap(m => m.verts.map(v => P[v * 3 + 1])), yMax = Math.max(...ysT), yMin = Math.min(...ysT);
  const bodyHalf = y => { const yf = y / H; if (yf > 0.5) { const ab = bodyAB(d, yf); return ellP(ab.a, ab.b) / 2; } return Math.PI * legR(d, yf); };

  // 1. натяжение — три части:
  //    поперёк (уток) сверх предела ткани — вещь тесная, обтягивает;
  //    вдоль (основа) — провис под тяжестью: в расчёте у всех вещей основа тянется на 3–9%, глазом это почти не видно, допуск мягче;
  //    очаги — связи длиннее ×1.3 в одном месте (плечо, подмышка): там ткань «размазана» и бывают дырочки
  const lim = stretchLim(ft), byRole = {}, hot = {}; let nW = 0, oW = 0, nU = 0, oU = 0, nHot = 0;
  for (let e = 0; e < C.E.length; e += 4) { const kd = C.E[e + 3]; if (kd !== 0 && kd !== 3) continue; const i = C.E[e] * 3, j = C.E[e + 1] * 3, L = Math.hypot(P[j] - P[i], P[j + 1] - P[i + 1], P[j + 2] - P[i + 2]) / C.E[e + 2];
    const r = roleOf.get(C.E[e]), br = byRole[r] = byRole[r] || [0, 0]; br[0]++;
    if (kd === 3) { nW++; if (L > lim) { oW++; br[1]++; } } else { nU++; if (L > lim + 0.07) { oU++; br[1]++; } }
    if (L > 1.3) { nHot++; const y = P[i + 1] / H, x = Math.abs(P[i]), w = y > 0.79 && x < 0.32 && top ? 'плечо' : y > 0.72 && y <= 0.79 && top && x > 0.2 ? 'подмышка' : r === 'sleeve' ? 'рукав' : r === 'front' ? 'перед' : r === 'back' ? 'спинка' : r; hot[w] = (hot[w] || 0) + 1; } }
  const fW = oW / Math.max(1, nW), fU = oU / Math.max(1, nU), fH = nHot / Math.max(1, nW + nU), hotW = Object.entries(hot).sort((x, y) => y[1] - x[1]).map(([w, n]) => w + ' ' + n).join(', ');
  const stR = Object.entries(byRole).map(([r, [x, y]]) => r + ' ' + (y / x * 100).toFixed(0) + '%').join(', ');
  const stPen = 10 * ramp(fW, 0.04, 0.15) + 5 * ramp(fU, 0.05, 0.2) + 10 * ramp(fH, 0.001, 0.008);
  add('натяжение', stPen < 4, 'поперёк ' + (fW * 100).toFixed(1) + '% длиннее ×' + lim + ', вдоль ' + (fU * 100).toFixed(1) + '% длиннее ×' + (lim + 0.07).toFixed(2) + ', очаги ×1.3: ' + (nHot ? nHot + ' (' + hotW + ')' : 'нет') + ' · ' + stR,
    stPen, fH > 0.002 && nHot ? 'ткань растянута ' + ({плечо: 'на плече', подмышка: 'под мышкой'}[hotW.split(' ')[0]] || 'местами') : 'ткань растянута: вещь мала или зацепилась');

  // 2. швы: доля сшитых пар, разошедшихся больше 4 мм, и самая большая щель
  let gap = 0, gMax = 0; for (const [i, j] of C.seams) { const L = Math.hypot(P[j * 3] - P[i * 3], P[j * 3 + 1] - P[i * 3 + 1], P[j * 3 + 2] - P[i * 3 + 2]); if (L > 0.004) gap++; gMax = Math.max(gMax, L); }
  const sg = gap / Math.max(1, C.seams.length);
  add('швы', sg < 0.03 && gMax < 0.015, (sg * 100).toFixed(1) + '% пар шире 4 мм, макс ' + (gMax * 100).toFixed(1) + ' см', 15 * ramp(sg, 0.01, 0.12) + 5 * ramp(gMax, 0.01, 0.03), 'шов не сошёлся — видна щель');

  // 3. ткань внутри тела глубже 3 мм
  const body = makeCollider(d, null), Q = new Float32Array(3); let inside = 0;
  for (let i = 0; i < nV; i++) { Q[0] = P[i * 3]; Q[1] = P[i * 3 + 1]; Q[2] = P[i * 3 + 2]; body(Q, 0); if (Math.hypot(Q[0] - P[i * 3], Q[1] - P[i * 3 + 1], Q[2] - P[i * 3 + 2]) > 0.003) inside++; }
  const ins = inside / Math.max(1, nV);
  add('сквозь тело', ins < 0.015, (ins * 100).toFixed(1) + '% точек глубже 3 мм', 15 * ramp(ins, 0.005, 0.05), 'тело проходит сквозь ткань');

  // 4. на месте: верх — плечи на плечах и низ на задуманной высоте (±2.5 см без штрафа); низ — пояс на поясе
  if (top) { const want = 0.858 * H + 0.012 - (info.L0 || info.L), tuck = item.state === 'tucked', dv = tuck ? 0 : yMin - want, shOk = yMax > 0.815 * H;
    add('на месте', shOk && Math.abs(dv) < 0.04, 'верх ' + (yMax / H).toFixed(2) + 'H, низ ' + (dv * 100).toFixed(1) + ' см от задуманного', (shOk ? 0 : 25) + 15 * ramp(Math.abs(dv), 0.025, 0.08), 'вещь сползла или длина не та'); }
  else { const yW = info.sp ? info.sp.yW : info.yW || 0.595 * H, dv = yMax - yW;
    add('на месте', Math.abs(dv) < 0.03, 'пояс ' + (dv * 100).toFixed(1) + ' см от талии', 15 * ramp(Math.abs(dv), 0.02, 0.07), 'брюки сползли или сидят выше пояса'); }

  // 5. дырки: доля треугольников переда/спинки, чья середина на фото — вне вещи (прозрачно)
  let tri = 0, hole = 0;
  torsoM.forEach(m => { const g = m.role === 'front' ? dr.front : (dr.back || dr.front); if (!g) return;
    for (let t = 0; t < m.tris.length; t += 3) { const a = m.uv[m.tris[t]], b = m.uv[m.tris[t + 1]], c = m.uv[m.tris[t + 2]], u = (a[0] + b[0] + c[0]) / 3, v = (a[1] + b[1] + c[1]) / 3;
      const r = Math.min(g.gh - 1, Math.max(0, Math.floor(v * g.gh))), col = Math.min(g.gw - 1, Math.max(0, Math.floor(u * g.gw))); tri++; if (g.grid[r][col] !== '1') hole++; } });
  const hf = hole / Math.max(1, tri);
  add('дырки', hf < 0.015, (hf * 100).toFixed(1) + '% площади', 15 * ramp(hf, 0.005, 0.05), 'на ткань попал фон фото — будут прозрачные места');

  // 6. силуэт: обхват по высоте против фото (в метрах); у фото на модели и слившихся рукавов — видимая ширина спереди
  const g0 = dr.front, sil = g0 && g0.grid ? silhouette(C, P, d, item, info, top, aF, g0, {torsoK, allK, yMin, yMax, bodyHalf, k, sh}) : null;
  if (sil) {
    const {rows, mode} = sil, e = rows.map(r => r.model / r.want - 1), es = e.map((_, i) => med([e[i - 1], e[i], e[i + 1]].filter(v => v != null)));
    const mean = es.reduce((s, v) => s + Math.abs(v), 0) / es.length; let wi = 0; es.forEach((v, i) => { if (Math.abs(v) > Math.abs(es[wi])) wi = i; });
    const w = rows[wi], dcm = (w.model - w.want) * 100 * (mode === 'girth' ? 2 : 1);
    const where = w.where + ' ' + (dcm > 0 ? 'шире' : 'уже') + ' на ' + Math.abs(dcm).toFixed(1) + ' см' + (mode === 'girth' ? ' по кругу' : ' спереди');
    add('силуэт', mean < 0.05 && Math.abs(es[wi]) < 0.12, 'в среднем ' + (mean * 100).toFixed(0) + '%, хуже всего ' + (es[wi] * 100).toFixed(0) + '% — ' + where,
      14 * ramp(mean, 0.03, 0.1) + 10 * ramp(Math.abs(es[wi]), 0.07, 0.2), 'форма не как на фото: ' + where,
      {mode, prof: {t: rows.map(r => +r.t.toFixed(2)), model: rows.map(r => +(r.model * 100).toFixed(1)), photo: rows.map(r => +(r.want * 100).toFixed(1))}});
  }

  if (sil && sil.aspect) { const A = sil.aspect, e = A.lM / A.want - 1, dL = (A.lM - A.want) * 100, cm0 = itemCm(item, d.b);
    // на вешалке вещь уже, чем лёжа, на сколько — зависит от ткани (поправка hk подобрана по одной футболке): без замера длины или
    // ширины пропорция фото на вешалке ненадёжна — только к сведению
    const sure = !sh.hang || cm0.chest || cm0.len;
    add('длина', !sure || Math.abs(e) < 0.06, (A.lM * 100).toFixed(1) + ' см, по пропорции фото ' + (A.want * 100).toFixed(1) + ' (' + (e > 0 ? 'длиннее' : 'короче') + ' на ' + Math.abs(dL).toFixed(1) + ' см)' + (sure ? '' : ' — на вешалке без замеров, оценка'), sure ? 12 * ramp(Math.abs(e), 0.04, 0.16) : 0,
      'вещь ' + (e > 0 ? 'длиннее' : 'короче') + ', чем на фото, примерно на ' + Math.abs(dL).toFixed(0) + ' см'); }
  // 6б. форма спереди у брюк: ромб и «каркас» у шага. Там фото лёжа ничего не говорит (штанины расходятся «домиком»), а обхват
  // почти не меняется — меняется ширина спереди. Ожидаемая ширина спереди: посадка — эллипс по обхвату с фото (глубина 0.7 ширины),
  // штанины — у своей оси (legX), эллипс по обхвату с фото или замерам (0.6), между ними — по прямой. Штраф за «выпирает»
  if (sil && !top && k !== 'skirt' && sil.mode === 'girth' && info.sp) { const fs = frontShape(C, P, d, item, info, sil.rows, allK);
    if (fs) add('форма спереди', fs.max < 0.06, 'выпирает до ' + (fs.max * 100).toFixed(0) + '% ' + fs.where + ' (' + (fs.dcm > 0 ? '+' : '') + fs.dcm.toFixed(1) + ' см)', 14 * ramp(fs.max, 0.04, 0.14),
      'силуэт спереди шире, чем у вещи на фото, ' + fs.where + ' — «каркас» или ромб вместо формы вещи', {front: fs.rows}); }

  // 7. замеры (рулетка или таблица магазина; оценки по подписи размера — нет) против надетой вещи, см
  const cm = itemCm(item, d.b);
  if (!cm.est) { const ms = measures(C, P, d, info, top, cm, {torsoK, allK, yMin, yMax, bodyHalf, tuck: item.state === 'tucked'});
    if (ms.length) { let wd = 0; ms.forEach(m => { wd = Math.max(wd, Math.abs(m.got - m.want)); });
      add('замеры', wd < 0.02, ms.map(m => m.name + ' ' + (m.got * 100).toFixed(1) + '/' + (m.want * 100).toFixed(1)).join(', ') + ' см', 15 * ramp(wd, 0.015, 0.05), 'размеры надетой вещи не совпадают с замерами'); } }

  // 8. размер: выкройка против таблицы (вещь не может быть меньше тела — если пришлось расширить, размер мал); к сведению, без штрафа
  if (top && info.sp) { const want = info.sp.Fs[1], got = info.W; add('размер', got - want < 0.02, 'ширина ' + (got * 200).toFixed(0) + ' см по кругу, по фото/таблице ' + (want * 200).toFixed(0), 0, 'вещь по меркам меньше фигуры — показана растянутой'); }

  if (typeof window !== 'undefined' && window.__qcProf) { const fr = [], st = []; for (let y = yMax - 0.01; y > Math.max(0.03, yMin); y -= 0.015) { const pts = slicePts(C, P, y, allK); fr.push([+(y / H).toFixed(3), +(xExtent(pts) * 100).toFixed(1), +(hullHalf(pts) * 100).toFixed(1)]); }
    const L = []; for (let e = 0; e < C.E.length; e += 4) if (C.E[e + 3] === 0 || C.E[e + 3] === 3) { const i = C.E[e] * 3, j = C.E[e + 1] * 3; L.push([C.E[e + 3], Math.hypot(P[j] - P[i], P[j + 1] - P[i + 1], P[j + 2] - P[i + 2]) / C.E[e + 2]]); }
    const pc = (kd, q) => { const a = L.filter(x => x[0] === kd).map(x => x[1]).sort((x, y) => x - y); return a.length ? +a[Math.floor(q * (a.length - 1))].toFixed(3) : 0; };
    const hot = {}; for (let e = 0; e < C.E.length; e += 4) if (C.E[e + 3] === 0 || C.E[e + 3] === 3) { const i = C.E[e] * 3, j = C.E[e + 1] * 3, Lr = Math.hypot(P[j] - P[i], P[j + 1] - P[i + 1], P[j + 2] - P[i + 2]) / C.E[e + 2]; if (Lr < 1.25) continue;
      const key = (C.E[e + 3] ? 'п' : 'в') + (Math.round(P[i + 1] / H * 20) / 20).toFixed(2) + (Math.abs(P[i]) < 0.06 ? 'с' : 'б'); hot[key] = (hot[key] || 0) + 1; }
    const hotS = Object.entries(hot).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k_, n]) => k_ + ':' + n).join(' ');
    out.push({name: 'отладка', ok: true, pen: 0, val: 'растяжение вдоль p50/p90/p99 ' + [0.5, 0.9, 0.99].map(q => pc(0, q)).join('/') + ', поперёк ' + [0.5, 0.9, 0.99].map(q => pc(3, q)).join('/') + '; очаги >25%: ' + hotS, front: fr}); }
  const score = Math.max(0, Math.round(100 - out.reduce((s_, c) => s_ + c.pen, 0)));
  // «проверить» — при итоге ниже 80 или одном сильном провале (пункт потерял 8 баллов и больше: ромб у джинсов терял 10.6 при итоге 82)
  // warn — строка «Показано приблизительно…» под вещью у посетителя: только серьёзное (итог ниже 65 или пункт потерял 14+)
  return {score, ok: score >= 80 && !out.some(c => c.pen >= 8), warn: score < 65 || out.some(c => c.pen >= 14), checks: out, v: 2};
}
// форма спереди у брюк: [{y, model, want}] (м) от середины посадки до колена; max — наибольшее «выпирает» (доля)
const P07 = ellP(1, 0.7), P06 = ellP(1, 0.6);
function frontShape(C, P, d, item, info, rows, allK) {
  const sp = info.sp, H = d.H, seat = rows.filter(r => r.t < 0.25), leg = rows.filter(r => r.t >= 0.25); if (seat.length < 2 || leg.length < 4) return null;
  const cm = itemCm(item, d.b), tape = Array.isArray(cm.leg) && cm.leg.length > 1 ? cm.leg : null, legT = y => (sp.yC - y) / (sp.yC - sp.yHem);
  const tapeAt = t => { let i = 0; while (i < tape.length - 2 && tape[i + 1][0] < t) i++; const [t0, v0] = tape[i], [t1, v1] = tape[i + 1]; return (v0 + (v1 - v0) * Math.max(0, Math.min(1, (t - t0) / ((t1 - t0) || 1)))) / 100; };
  const cx = d.legX + 0.01, Wseat = G => 4 * G / P07, Wleg = G => 2 * cx + 4 * G / P06;
  const ys = Math.min(...seat.map(r => r.y)), yl = Math.max(...leg.map(r => r.y)), gAt = (R, y) => { const q = R.slice().sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y)); return q[0].want; };
  const legG = y => (tape ? tapeAt(legT(y)) : gAt(leg, y));   /* замер точнее фото */
  // пояс на резинке лёжа собран — посадка с фото уже, чем на теле: там ожидаемая ширина — линия штанин или бёдра фигуры с запасом
  const elastic = item.shape && item.shape.elastic, bodyF = y => { const ab = bodyAB(d, Math.max(0.5, y / H)); return 2 * ab.a + 0.02; };
  const Wl = Wleg(legG(yl)), Ws = elastic ? Math.max(Wl, bodyF(ys)) : Wseat(gAt(seat, ys)), yK = Math.max(sp.yC - 0.45 * (sp.yC - sp.yHem), sp.yHem + 0.03), out = [];
  for (let y = ys; y >= yK; y -= 0.015) { const want = y >= yl ? (elastic ? Math.max(Wl, bodyF(y)) : Ws + (Wl - Ws) * (ys - y) / Math.max(1e-3, ys - yl)) : Wleg(legG(y)), model = xExtent(slicePts(C, P, y, allK)); if (model) out.push({y, model, want}); }
  if (out.length < 4) return null;
  // и форма без масштаба — обе ширины в долях своей ширины у колена: ромб (шире всего у бедра, к колену уже, а на фото — наоборот)
  // по сантиметрам отличается на 3–4 см, по форме — на 7–10%
  const K = out[out.length - 1], ev = r => Math.max(r.model / r.want - 1, (r.model / K.model) / (r.want / K.want) - 1 - 0.03);   /* форма: 3% без штрафа */
  let w = out[0]; out.forEach(r => { if (ev(r) > ev(w)) w = r; });
  const yr = w.y / H, where = w.y > sp.yC + 0.03 ? 'на бёдрах' : w.y > sp.yC - 0.06 ? 'у шага' : 'вверху штанины';
  return {max: Math.max(0, ev(w)), dcm: (w.model / K.model * K.want - w.want) * 100, where: where + ' (' + yr.toFixed(2) + ' роста)', rows: out.map(r => [+(r.y / H).toFixed(3), +(r.model * 100).toFixed(1), +(r.want * 100).toFixed(1)])};
}
// строки силуэта: {t, y, model, want, where}
function silhouette(C, P, d, item, info, top, a, g, o) {
  const H = d.H, ph = photoRows(g, a), rows = [], {sh, k} = o;
  const worn = !!sh.worn, merged = top && sh.merged && !worn, front = worn || merged, tuck = item.state === 'tucked';
  if (top) {
    if (tuck) return null;
    // от проймы до низа; на фото — от подмышки (a.arm) до низа корпуса (у длинных рукавов на вешалке рукава свисают ниже)
    const v0 = (a.arm || 0.3) + 0.03, r0 = Math.floor(v0 * g.gh), w0 = ph.center(r0); let r = r0; while (r + 1 < g.gh && ph.center(r + 1) > w0 * 0.75) r++;
    const v1 = Math.max(v0 + 0.2, (r + 0.5) / g.gh), y0 = 0.858 * H + 0.012 - info.AD - 0.02, y1 = o.yMin + 0.015, N = 20;
    const keep = merged ? o.allK : o.torsoK;
    // у фото на модели низ скруглён, у слившихся рукавов на вешалке внизу рукава кончаются — нижние строки не сравниваем
    // на фото с моделью руки закрывают бока лифа — верхнюю четверть (у подмышек) не сравниваем
    const tE = front ? 0.85 : 0.96, tS = worn ? 0.25 : 0.04;
    for (let i = 0; i < N; i++) { const t = tS + (tE - tS) * i / (N - 1), y = y0 + (y1 - y0) * t, rr = Math.min(g.gh - 1, Math.floor((v0 + (v1 - v0) * t) * g.gh));
      const pts = slicePts(C, P, y, keep), pw = merged ? ph.full(rr) : ph.center(rr); if (pts.length < 6 || !pw) continue;
      rows.push({t, y, model: front ? xExtent(pts) : hullHalf(pts), px: pw, where: whereTop(t)}); }
    if (rows.length < 8) return null;
    // масштаб фото: по выкройке (ширина по фото/таблице, info.sp.Fs) — одна цифра на всю вещь; у вида спереди — по самой вещи
    const Fs = info.sp && info.sp.Fs, fsAt = t => { const f = Math.max(0, Math.min(1, t)) * (Fs.length - 1), i = Math.min(Fs.length - 2, Math.floor(f)); return Fs[i] + (Fs[i + 1] - Fs[i]) * (f - i); };
    const s = front || !Fs ? med(rows.map(r => r.model / r.px)) : med(rows.map(r => fsAt(r.t) / r.px));
    rows.forEach(r => { r.want = r.px * s; if (!front) r.want = Math.max(r.want, o.bodyHalf(r.y) + 0.006); });
    // пропорция «длина / ширина по груди» — без масштаба: короткая вещь, «укороченный топ» вместо футболки (на вешалке вещь уже, ×hk)
    // ожидаемая длина: длина вещи на фото (от плечевой точки до низа, в столбцах) × тот же масштаб фото, что у силуэта (медиана по
    // строкам, ×hk: на вешалке уже только ширина). Пропорция по одной строке у подмышки обманывала у спущенного плеча (там уже рукав)
    let aspect = null;
    if (!front && Fs) { let rT = 0; while (rT < g.gh && !g.grid[rT].includes('1')) rT++; const lP = (v1 * g.gh - rT) * ph.ar, lM = backLen(C, P, info) || o.yMax - o.yMin;
      if (lP > 0) aspect = {lM, want: lP * s * (info.sp.hk || 1)}; }
    return {rows, mode: front ? 'front' : 'girth', aspect};
  }
  // низ: масштаб — по поясу (ширина пояса выкройки ↔ ширина верхних строк фото)
  const {rT, rB} = ph, waistPx = med([1, 2, 3].map(i => ph.full(rT + i))); if (!waistPx || rB - rT < 20) return null;
  // своя ширина пояса лёжа (замер или по фото), а не расширенная под фигуру: иначе всё фото «раздувается» на столько же
  const cmw = itemCm(item, d.b).waist, s = (cmw ? cmw / 100 : info.sp ? info.sp.ww : info.WW || 0.4) / waistPx;
  if (k === 'skirt') {
    const yW = o.yMax, y1 = o.yMin + 0.015, N = 18;
    for (let i = 0; i < N; i++) { const t = 0.08 + 0.84 * i / (N - 1), y = yW - (yW - y1) * t, rr = Math.round(rT + (rB - rT) * t), pts = slicePts(C, P, y, o.allK), pw = ph.full(rr);
      if (pts.length < 6 || !pw) continue; rows.push({t, y, model: worn ? xExtent(pts) : hullHalf(pts), want: pw * s, px: pw, where: t < 0.35 ? 'в бёдрах' : t < 0.7 ? 'посередине' : 'у подола'}); }
    if (worn) { const sc = med(rows.map(r => r.model / r.px)); rows.forEach(r => { r.want = r.px * sc; }); }
    return rows.length >= 8 ? {rows, mode: worn ? 'front' : 'girth'} : null;
  }
  const sp = info.sp; if (!sp) return null;
  const rC = Math.round(rT + (a.crotch || 0.4) * (rB - rT)), yW = sp.yW, yC = sp.yC;
  // масштаб фото брюк надёжен не всегда: пояс на резинке лёжа собран, у шага штанины расходятся «домиком». Поэтому:
  // посадка — по строкам фото до середины посадки, масштаб — по самой вещи в верхних строках (там «каркаса» ещё нет);
  // штанины — ширина вдоль оси штанины с фабрики (sh.leg), масштаб — по самой вещи (сравнивается форма: сужение, расширение,
  // низ); абсолютный размер штанины — пункт «замеры», если есть рулетка или таблица
  const seat = [];
  for (const t of [0.15, 0.25, 0.35, 0.45, 0.55]) { const y = yW - (yW - yC) * t, rr = Math.round(rT + (rC - rT) * t), pts = slicePts(C, P, y, o.allK), pw = ph.full(rr);
    if (pts.length < 6 || !pw) continue; seat.push({t: t * 0.25, y, model: worn ? xExtent(pts) : hullHalf(pts), px: pw, where: 'в бёдрах'}); }
  const s0 = seat.length ? med(seat.slice(0, 2).map(r => r.model / r.px)) : s; seat.forEach(r => { r.want = r.px * s0; }); rows.push(...seat);
  let lw = (sh.leg || []).slice(); if (lw.length < 4) return seat.length >= 3 ? {rows, mode: 'girth'} : null;
  for (let i = Math.max(1, lw.length >> 1); i < lw.length; i++) if (lw[i] < lw[i - 1] * 0.8) { for (let j = i; j < lw.length; j++) lw[j] = lw[i - 1] * 0.97; break; }   // хвост с резким сужением — шум фото (как в bottomSpec)
  const at = t => { const f = Math.max(0, Math.min(1, t)) * (lw.length - 1), i = Math.min(lw.length - 2, Math.floor(f)); return lw[i] + (lw[i + 1] - lw[i]) * (f - i); };
  // ниже трети штанины — ширина прямо с фото (каждая штанина поперёк своей оси): фабрика могла ошибиться (так было с поправкой
  // перспективы — ромб); выше — с фабрики (у шага на фото развилка), в тех же единицах (подгонка по строкам 0.3–0.5)
  const gL1 = t => { const lg = ph.legs(Math.round(rC + (rB - rC) * t)); return lg ? (lg[0] + lg[1]) / 2 : null; };
  const gL = t => med([t - 0.04, t - 0.02, t, Math.min(0.88, t + 0.02)].map(gL1));   /* по соседним строкам: клапан, загнутый край */
  const kF = med([0.3, 0.35, 0.4, 0.45, 0.5].map(t => { const v = gL(t); return v ? v / at(t) : null; })) || 1, TS = []; for (let t = 0.3; t <= 0.8401; t += 0.03) TS.push(gL(t) || at(t) * kF);
  // низ — та же очистка, что у выкройки (specs.js bottomSpec): провал больше 10% за шаг у самого низа — скруглённый край выреза
  for (let i = Math.max(1, TS.length - 4); i < TS.length; i++) if (TS[i] < TS[i - 1] * 0.9) { for (let j = i; j < TS.length; j++) TS[j] = TS[i - 1] * 0.98; break; }
  const truth = t => { if (t < 0.3) return at(t) * kF; const f = Math.min(TS.length - 1, (Math.min(t, 0.84) - 0.3) / 0.03), i = Math.min(TS.length - 2, Math.floor(f)); return TS[i] + (TS[i + 1] - TS[i]) * (f - i); };
  const IN = sp.legLen + (sp.stack || 0), legs = [];
  for (let i = 0; i < 16; i++) { const t = 0.1 + 0.87 * i / 15, y = yC - IN * t; if (y < sp.yHem + 0.02) continue;   // часть на полу (гармошка) — не сравниваем
    const pts = slicePts(C, P, y, o.allK), L = pts.filter(p => p[0] < 0), R = pts.filter(p => p[0] > 0); if (L.length < 4 || R.length < 4) continue;
    legs.push({t: 0.25 + 0.75 * t, y, model: worn ? (xExtent(L) + xExtent(R)) / 2 : (hullHalf(L) + hullHalf(R)) / 2, px: truth(t), where: whereLeg(t)}); }
  if (worn) for (let i = legs.length - 1; i >= 0; i--) if (legs[i].t > 0.25 + 0.75 * 0.8) legs.splice(i, 1);   // на фото с человеком внизу обувь
  if (legs.length < 6) return null;
  // замер ширины штанины по всей длине (рулетка, лист A4) — точнее фото: сравнение прямо в сантиметрах
  const cmL = itemCm(item, d.b).leg, tape = Array.isArray(cmL) && cmL.length > 2 ? cmL : null;
  const tapeAt = t => { let i = 0; while (i < tape.length - 2 && tape[i + 1][0] < t) i++; const [t0, v0] = tape[i], [t1, v1] = tape[i + 1]; return (v0 + (v1 - v0) * Math.max(0, Math.min(1, (t - t0) / ((t1 - t0) || 1)))) / 100; };
  const sL = med(legs.map(r => r.model / r.px)); legs.forEach(r => { r.want = Math.max(tape ? tapeAt((r.t - 0.25) / 0.75) : r.px * sL, o.bodyHalf(r.y) + 0.005); }); rows.push(...legs);
  return {rows, mode: worn ? 'front' : 'girth'};
}

// длина ткани по кругу в сечении y (половина — как ширина лёжа): сумма отрезков пересечения треугольников с плоскостью; side — только
// штанина с этой стороны (знак x). Для сверки с рулеткой: выпуклая оболочка «срезает» складки и впадины широкой штанины
function clothHalf(C, P, y, keep, side) {
  let L = 0; const cut = (a, b) => { const ya = P[a * 3 + 1], yb = P[b * 3 + 1]; if ((ya - y) * (yb - y) > 0 || ya === yb) return null; const t = (y - ya) / (yb - ya); return [P[a * 3] + (P[b * 3] - P[a * 3]) * t, P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * t]; };
  C.meshes.forEach(m => { for (let t = 0; t < m.tris.length; t += 3) { const v = [m.verts[m.tris[t]], m.verts[m.tris[t + 1]], m.verts[m.tris[t + 2]]]; if (keep && !v.every(q => keep[q])) continue;
    const q = [cut(v[0], v[1]), cut(v[1], v[2]), cut(v[2], v[0])].filter(Boolean); if (q.length < 2) continue; if (side && Math.sign(q[0][0] + q[1][0]) !== side) continue;
    L += Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]); } });
  return L / 2;
}
// длина по спинке по самой ткани: средний столбец выкройки спинки сверху вниз + вырез горловины сзади (как меряют лёжа — от плечевой
// точки у шеи); null — нет спинки
function backLen(C, P, info) {
  const bm = C.meshes.find(m_ => m_.role === 'back'); if (!bm || !bm.uvm) return null; const mn = Math.min(...bm.uvm.map(u => Math.abs(u[0])));
  const col = bm.verts.map((v, k) => [v, bm.uvm[k]]).filter(([, u]) => Math.abs(Math.abs(u[0]) - mn) < 1e-4).sort((a, b) => a[1][1] - b[1][1]); if (col.length < 4) return null;
  let L = 0; for (let k = 1; k < col.length; k++) { const a = col[k - 1][0] * 3, b = col[k][0] * 3; L += Math.hypot(P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]); }
  return L + (info.NDb || 0);
}
// замеры надетой вещи: [{name, got, want}] в метрах (половина обхвата — как лёжа)
function measures(C, P, d, info, top, cm, o) {
  const H = d.H, res = [], half = (y, keep) => clothHalf(C, P, y, keep);
  const legs = y => (clothHalf(C, P, y, o.allK, -1) + clothHalf(C, P, y, o.allK, 1)) / 2;
  if (top) {
    // ширина по груди лёжа — чуть ниже проймы; меньше тела вещь быть не может (это «размер мал», а не ошибка посадки)
    if (cm.chest) { const y = 0.858 * H + 0.012 - info.AD - 0.03; res.push({name: 'грудь', got: half(y, o.torsoK), want: Math.max(cm.chest / 100, o.bodyHalf(y) + 0.006)}); }
    // длина по спинке — по ткани (на теле по вертикали вещь короче: ткань огибает лопатки и плечи)
    if (cm.len && !o.tuck) { const L = backLen(C, P, info); if (L) res.push({name: 'длина по спинке', got: L, want: cm.len / 100}); }
    return res;
  }
  const sp = info.sp; if (!sp) { const g = cm.waist && info.WW ? half(Math.min(info.yW || o.yMax, o.yMax) - 0.008, o.allK) : 0; if (g) res.push({name: 'пояс', got: g, want: Math.max(cm.waist / 100, info.WW)}); return res; }
  const legY = t => sp.yC - (sp.yC - sp.yHem) * t;
  if (cm.waist) res.push({name: 'пояс', got: half(sp.yW - 0.015, o.allK), want: Math.max(cm.waist / 100, info.WW)});
  if (cm.hip) { let mx = 0; for (let y = sp.yC + 0.03; y < sp.yW - 0.05; y += 0.01) mx = Math.max(mx, half(y, o.allK)); res.push({name: 'бёдра', got: mx, want: cm.hip / 100}); }
  if (cm.knee) res.push({name: 'колено', got: legs(legY(0.42)), want: Math.max(cm.knee / 100, Math.PI * legR(d, legY(0.42) / H) + 0.005)});
  if (Array.isArray(cm.leg)) cm.leg.filter(([t]) => t > 0.03 && t < (sp.stack > 0.005 ? 0.82 : 0.95)).forEach(([t, v]) => res.push({name: 'штанина ' + Math.round(t * 100) + '%', got: legs(legY(t)), want: Math.max(v / 100, Math.PI * legR(d, legY(t) / H) + 0.005)}));
  if (cm.outseam) res.push({name: 'длина', got: o.yMax - Math.max(0.012, o.yMin) + (sp.stack || 0), want: cm.outseam / 100});
  return res;
}
