// Выкройка вещи целиком: верх, юбка, брюки; швы, начальное положение, сборка сетки после расчёта.
import * as THREE from 'three';
import {armX} from './body.js';
import {fabricType, photoMat} from './cloth-material.js';
import {clothMeshes} from './cloth-mesh.js';
import {addHood, addStand} from './collars.js';
import {DRAPE_ON, legR, makeCollider} from './collider.js';
import {armJ, armRad, bodyAB, ellP, interp, solve} from './geometry.js';
import {topMeasures} from './measures.js';
import {FABRIC, addPanel, addTube, makeCloth, mirrorPoly, segDist} from './pattern.js';
import {QC, qcCloth} from './qc.js';
import {runCloth} from './sim.js';
import {itemCm} from './sizes.js';
import {TOPK, bottomSpec, rowSpans, skirtProf, trueHem} from './specs.js';
import {seamBend} from './worker.js';
import {shoulderRound} from './shoulder-round.js';
import {fit} from './state.js';

// подготовка расчёта ткани: выкройка, швы, начальное положение. Сам расчёт (runCloth) — отдельно: в фоновом потоке
// (garmentMeshAsync) или сразу (drapeTemplate). finish(P) — по готовым точкам собирает сетку, слой, автопроверку
export function drapePrepare(item, d, under) {
  if (!DRAPE_ON || !item.tex) return null;
  const k = item.kind, top = TOPK.has(k), bottom = ['jeans', 'pants', 'shorts', 'skirt'].includes(k);
  if (!top && !bottom) return null;
  const st = item.state || '', open = st === 'open', tucked = st === 'tucked', hoodUp = st === 'hood', hooded = k === 'hoodie' || item.hood;
  // заправленный верх: ниже пояса брюк не отталкивается от них — край уходит внутрь, пояс брюк виден поверх
  if (tucked && under && fit.BOT_YW) { const lim = Math.round(fit.BOT_YW / d.H * 100) + 1; under = {a: under.a.map((v, i) => i <= lim ? 0 : v), b: under.b.map((v, i) => i <= lim ? 0 : v)}; }
  const H = d.H, C = makeCloth(), fab = (k === 'skirt' && item.pleats ? FABRIC.skirtP : FABRIC[k]) || FABRIC.tee, push = makeCollider(d, under, fab.margin), base = item.color || '#888', chains = [];
  const dr = item.drape || {}, aF = (dr.front && dr.front.a) || {cx: 0.5}, aB = (dr.back && dr.back.a) || aF;
  // декор с фото переда (пуговицы) — объёмными деталями на детали «перед» (decor.js)
  C.decor = (aF.buttons || []).map(b => Object.assign({role: 'front'}, b));
  const ft = fabricType(item), flatT = !!item.pleats, mF = photoMat(item.tex.frontCut || item.tex.front, base, ft, flatT), mB = photoMat(item.tex.backCut || item.tex.back || item.tex.front, base, ft, flatT);
  [mF, mB].forEach(m => { m.side = THREE.DoubleSide; });
  const zo = 0.21 * d.s, cell = (typeof window !== 'undefined' && window.__cell) || 0.022;
  let yPin = 0, info = {}, cover = null;
  if (top) {
    const M = topMeasures(item, d), yTop = 0.858 * H + 0.012; info = M;
    // длина в мерках считается от 0.848H (старая геометрия), а верх выкройки — выше: низ вещи с фото на модели должен остаться на своём месте
    if (item.shape && item.shape.worn && item.shape.hem_waist != null) M.L += yTop - 0.848 * H;
    // утеплитель съедает длину (ткань идёт в обход груди и плеч на толщине): выкройке — запас, проверке — длина из каталога
    M.L0 = M.L; if (fab.margin) M.L += fab.margin * 2.5;
    // заправлена: низ уходит под пояс брюк, сверху небольшой напуск (низ закреплён на поясе)
    const yTuck = (fit.BOT_YW || 0.595 * H) - 0.035;   // ниже пояса брюк: край внутри
    if (tucked) { M.L = Math.min(M.L, yTop - yTuck + 0.045); yPin = yTuck; }
    // скат плеча по фигуре: плечевая точка выкройки ложится на плечо (верх руки), а не висит над ним — иначе у плеча «погоны»
    { const xs = M.S / 2, ax = armX(d), r = armRad(d, 0) + 0.004, SXb = Math.max(d.chest * d.shX * 0.98, ax + 0.02), SYb = d.chest * 0.42;
      const yArmTop = Math.abs(xs - ax) < r ? 0.8 * H + Math.sqrt(r * r - (xs - ax) ** 2) : xs < ax ? 0.8 * H + SYb * Math.sqrt(Math.max(0, 1 - (xs / SXb) ** 2)) : 0.8 * H;
      M.SD = Math.max(0.04, Math.min(0.11, yTop - yArmTop - 0.006)); M.AD = Math.max(M.AD, M.SD + 0.16); }
    // что закрывает вещь на теле (для окраски тела под ней, см. paintBody): корпус от низа до шеи, рука — на длину рукава
    cover = {y0: tucked ? yTuck + 0.03 : yTop - M.L + 0.06 + (fab.margin || 0) * 2, y1: yTop - M.ND - 0.012, nx: M.NW / 2 - 0.01, torso: !open, arm: M.noSleeve ? 0 : ((M.S / 2 - armX(d)) + M.SL) / (0.335 * H)};
    // контур половины (x ≥ 0) и метки отрезков; зеркалим
    const arm = [], nA = 6; for (let i = 0; i <= nA; i++) { const t = i / nA, x = M.S / 2 + (M.W / 2 - M.S / 2) * Math.pow(t, 2.2) - 0.012 * Math.sin(t * Math.PI), y = M.SD + (M.AD - M.SD) * t; arm.push([x, y]); }
    // бок от проймы до низа — по ширине вещи на фото (приталенная, прямая, расклешённая книзу — у платья, пальто),
    // но не уже тела на этой высоте (у длинных вещей ниже шага — бёдра)
    const flare = k === 'dress' || k === 'coat';
    const sideTail = (pts, labs) => { const n_ = flare ? 10 : 6, rib = k === 'sweater' || k === 'hoodie' || k === 'puffer', i0 = pts.length;
      for (let i = 1; i <= n_; i++) { const t = i / n_, y = M.AD + (M.L - M.AD) * t, yw = Math.max(0.5, (yTop - y) / H), ab = bodyAB(d, yw), bodyF = ellP(ab.a, ab.b) / 2 + 0.012;
        let w = Math.max(interp(M.sp.Fs, t), bodyF); if (rib && i === n_) w = Math.max(bodyF, Math.min(w, M.HW)); if (i === 1) w = Math.max(w, Math.min(M.W, w * 1.04));
        pts.push([w / 2, y]); labs.push(i < n_ ? 'side' : 'hem'); }
      // клёш от талии: бок длиннее середины — низ у боков поднять (иначе по бокам «углы» ниже подола), низ к середине — дугой
      if (flare) { let iw = i0; for (let i = i0; i < pts.length; i++) if (pts[i][0] < pts[iw][0] - 1e-4) iw = i;
        trueHem(pts, iw); const [hx, hy] = pts[pts.length - 1];
        if (M.L - hy > 0.004) for (let i = 1; i <= 3; i++) { const t = i / 4; pts.push([hx * (1 - t), hy + (M.L - hy) * Math.sin(t * Math.PI / 2)]); labs.push('hem'); } } };
    const mk = nd => { const pts = [], labs = [];
      for (let i = 0; i <= 5; i++) { const t = i / 5; pts.push([M.NW / 2 * Math.sin(t * Math.PI / 2), nd * Math.cos(t * Math.PI / 2)]); labs.push(i < 5 ? 'neck' : 'shoulder'); }
      arm.forEach((p, i) => { pts.push(p); labs.push(i < nA ? 'arm' : 'side'); });
      sideTail(pts, labs); pts.push([0, M.L]);
      return mirrorPoly(pts, labs); };
    // uv: корпус на фото — между cx±hw, по высоте 0..1
    // верхний край выкройки (горловина, плечо) совпадает с верхним краем вещи на фото в том же столбце:
    // иначе вырез горловины с фото (прозрачный) ложится на ткань ниже выреза и видна щель
    const topY = (x, nd) => { const t = Math.abs(x); if (t < M.NW / 2) return nd * Math.cos(Math.asin(Math.min(1, t / (M.NW / 2)))); return Math.min(M.SD, M.SD * (t - M.NW / 2) / Math.max(0.01, M.S / 2 - M.NW / 2)); };
    const photoTop = g => { if (!g) return () => 0; const T = []; for (let c = 0; c < g.gw; c++) { let r = 0; while (r < g.gh && g.grid[r][c] !== '1') r++; T.push(r < g.gh ? r / g.gh : 1); }
      return u => { const c = Math.max(0, Math.min(g.gw - 1, Math.floor(u * g.gw))), w = [T[c - 1], T[c], T[c + 1]].filter(v => v != null && v < 1).sort((a, b) => a - b); return w.length ? w[w.length >> 1] : 0; }; };
    // низ корпуса на фото: у длинных рукавов на вешалке рукава свисают ниже корпуса — низ сетки не подол
    const photoHem = (g, a) => { if (!g) return 1; const cc = Math.round(a.cx * g.gw); let r = Math.floor((a.arm || 0.3) * g.gh); while (r + 1 < g.gh && g.grid[r + 1][cc] === '1') r++; return Math.min(1, (r + 1) / g.gh); };
    // середина переда — по молнии на фото (если найдена): на фото вещь висит чуть наискось, а в примерочной молния должна идти ровно посередине
    const cAt = (a, v) => { const z = a.zipc; if (!z) return a.cx; const f = Math.max(0, Math.min(z.length - 1, v * z.length - 0.5)), i = Math.min(z.length - 2, Math.floor(f)); return z[i] + (z[i + 1] - z[i]) * (f - i); };
    // ниже проймы — построчно: край выкройки ↔ край вещи на фото в той же строке (у расклешённой вещи низ шире верха;
    // при одной ширине на всю высоту края выкройки внизу попадали за силуэт на фото — принт «плыл», по бокам пятна фона)
    let SQ = null; const sideR = y => (SQ = SQ || (() => { const q = F.P.filter(([x, y]) => x > 1e-4 && y >= M.AD - 1e-6).sort((a_, b_) => a_[1] - b_[1]); return y => { if (!q.length || y <= q[0][1]) return M.W / 2; for (let i = 1; i < q.length; i++) if (y <= q[i][1]) { const t = (y - q[i - 1][1]) / Math.max(1e-6, q[i][1] - q[i - 1][1]); return q[i - 1][0] + (q[i][0] - q[i - 1][0]) * t; } return q[q.length - 1][0]; }; })())(y);
    const photoRows = (g, a) => { if (!g) return null; const R = [], c0 = Math.round(a.cx * g.gw);
      for (let r = 0; r < g.gh; r++) { const row = g.grid[r]; if (row[c0] !== '1') { R.push(null); continue; } let l = c0, rr = c0; while (l > 0 && row[l - 1] === '1') l--; while (rr < g.gw - 1 && row[rr + 1] === '1') rr++; R.push([(l + 0.5) / g.gw, (rr + 0.5) / g.gw]); }
      // сглаживание по строкам (медиана из 5): выбросы края — шум выреза
      return R.map((_, r) => { const w = []; for (let k = -2; k <= 2; k++) if (R[r + k]) w.push(R[r + k]); if (!w.length) return null; const m = i => w.map(e => e[i]).sort((p_, q_) => p_ - q_)[w.length >> 1]; return [m(0), m(1)]; }); };
    const uvT = (a, mirror, g, nd) => { const pt = photoTop(g), hv = photoHem(g, a), PR = photoRows(g, a), arm = a.arm || 0.3, t0 = Math.min(0.3, pt(a.cx + (mirror ? -1 : 1) * M.NW / M.W * (a.hw || 0.3))); return (x, y) => { const sx_ = x / (M.W / 2) * (a.hw || 0.3), u0 = mirror ? a.cx - sx_ : a.cx + sx_, py = topY(x, nd), tv = Math.min(0.3, pt(u0));
      // строки фото — прямые строки выкройки: по одной линейной шкале от точки у основания шеи до низа.
      // По своему столбцу (верхний край фото) — только у самого верха (горловина, плечо), ниже — плавно в общую шкалу;
      // иначе у столбцов над плечом и над вырезом разная шкала, и клетка/полоска на груди изгибалась «галочкой»
      const vCol = tv + Math.max(0, y - py) / Math.max(0.05, M.L - py) * (hv - tv), vS = t0 + y / M.L * (hv - t0), bw = Math.max(0, 1 - Math.max(0, y - py) / 0.09);
      const v = Math.min(hv - 0.01, Math.max(vS + (vCol - vS) * bw * bw, tv + 0.012));   // не выше края вещи на фото в этом столбце (крутое плечо — иначе фон)
      if (PR && y > M.AD && v > arm) { const e = PR[Math.max(0, Math.min(PR.length - 1, Math.floor(v * PR.length)))];
        if (e) { const hw_ = (e[1] - e[0]) / 2, c_ = (e[0] + e[1]) / 2, t = Math.min(1, (y - M.AD) / 0.06), f = Math.min(1, Math.abs(x) / sideR(y));
          // плавный переход от проймы (прежняя ширина) к построчной
          // середина — по средней линии вещи (застёжка, пуговицы, принт по центру остаются прямыми), ширина — по строке фото;
          // середина строки силуэта на фото «гуляет» (модель стоит чуть боком) — по ней планка пуговиц изгибалась
          const cl = mirror ? a.cx : cAt(a, v), side_ = Math.sign(x) * (mirror ? -1 : 1), edge = side_ > 0 ? e[1] : e[0];
          const uRow = cl + (edge - cl) * f * (item.shape && item.shape.worn ? 0.92 : 0.985), uOld = mirror ? u0 : cAt(a, v) + sx_; return [uOld + (uRow - uOld) * t, v]; } }
      return [mirror ? u0 : cAt(a, v) + sx_, v]; }; };
    const F = mk(M.ND), B = mk(M.NDb);
    // половина переда (расстёгнута): контур до середины, край по середине — свободный (молния/борт)
    const mkHalf = (nd, sgn) => { const pts = [], labs = [];
      for (let i = 0; i <= 5; i++) { const t = i / 5; pts.push([M.NW / 2 * Math.sin(t * Math.PI / 2), nd * Math.cos(t * Math.PI / 2)]); labs.push(i < 5 ? 'neck' : 'shoulder'); }
      arm.forEach((p, i) => { pts.push(p); labs.push(i < nA ? 'arm' : 'side'); });
      sideTail(pts, labs); pts.push([0, M.L]); labs.push('cf');
      return {P: pts.map(([x, y]) => [sgn * (x + 0.004), y]), L: labs}; };
    // края по тому, какого соседа нет: сверху — плечо (или горловина у середины), сбоку выше подмышки — пройма, ниже — бок, снизу — низ
    const cls = nd => (p, m) => {
      if (m.down && p.y > M.L - cell * 1.5 && !(m.side && p.y > M.AD)) return 'hem';   // нижний угол бока — в шов, иначе у подола «крылышко»
      if (Math.abs(p.x) < M.NW / 2 + cell * 0.6 && p.y < nd + cell) return 'neck';
      if (m.side && p.y > M.SD - 0.01 && p.y < M.AD + cell * 0.5 && Math.abs(p.x) > M.S / 2 - cell) return 'arm';
      if (m.up && p.y < M.SD + 0.03) return 'shoulder';
      if (m.side && p.y >= M.AD) return 'side';
      return null; };
    const clsF = (p, m) => (open && m.side && Math.abs(p.x) < 0.004 + cell * 1.2) ? 'cf' : cls(M.ND)(p, m);
    const placeF = (x, y) => [x, yTop - y, zo], uvF = uvT(aF, false, dr.front, M.ND);
    const fronts = open ? [-1, 1].map(sg => { const Hf = mkHalf(M.ND, sg); return addPanel(C, Hf.P, Hf.L, cell, placeF, uvF, mF, 'front', null, clsF); })
      : [addPanel(C, F.P, F.L, cell, placeF, uvF, mF, 'front', null, cls(M.ND))];
    const pb = addPanel(C, B.P, B.L, cell, (x, y) => [x, yTop - y, -zo], uvT(aB, true, dr.back || dr.front, M.NDb), mB, 'back', null, cls(M.NDb));
    // швы: плечи и бока — перед со спинкой (ближайшая точка края спинки с той же меткой)
    // угол плеча (плечевая точка) может попасть в метку «пройма» у одной детали и «плечо» у другой — шьём и его, иначе на плече дырка
    const lb_ = q => q.lab === 'arm' && q.y < M.SD + cell * 0.9 ? 'shoulder' : q.lab;
    const bEdge = pb.pts.filter(p => p.edge && (lb_(p) === 'shoulder' || p.lab === 'side'));
    fronts.forEach(pf => pf.pts.forEach(p => { if (!p.edge || (lb_(p) !== 'shoulder' && p.lab !== 'side')) return; let best = cell * 0.8, q = null;
      for (const b of bEdge) { if (lb_(b) !== lb_(p)) continue; const dd = Math.abs(b.x - p.x) + Math.abs(b.y - p.y); if (dd < best) { best = dd; q = b; } } if (q) C.seams.push([p.g, q.g]); }));
    // точки края, оставшиеся без пары (ступенька сетки на наклонном плече, разная глубина горловины переда и спинки), — к ближайшей
    // точке другой детали: иначе между пришитыми точками шов расходится ромбиками (тёмные «треугольники» на плечах)
    { const sewn = new Set(C.seams.flatMap(([i, j]) => [i, j])), fEdge = fronts.flatMap(pf => pf.pts).filter(p => p.edge && (lb_(p) === 'shoulder' || p.lab === 'side'));
      const tie = (A_, B_) => A_.forEach(p => { if (sewn.has(p.g)) return; let best = cell * 1.6, q = null; for (const b of B_) { if (lb_(b) !== lb_(p)) continue; const dd = Math.hypot(b.x - p.x, b.y - p.y); if (dd < best) { best = dd; q = b; } } if (q) { C.seams.push([p.g, q.g]); sewn.add(p.g); } });
      tie(fEdge, bEdge); tie(bEdge, fEdge); }
    // расстёгнутые полочки: пока шьём, край у середины стоит на месте (как сметан) — иначе мягкую на сжатие ткань стягивает к боковому шву
    // застёгнутая вещь симметрична: середина переда и спинки (молния, планка, принт) остаётся ровно посередине, не виляет
    // (ближайший к середине столбец или пара столбцов по обе стороны: их середина держится на x = 0)
    if (!open) C.mid = fronts.concat([pb]).flatMap(P_ => { const mn = Math.min(...P_.pts.map(p => Math.abs(p.x))), col = P_.pts.filter(p => Math.abs(Math.abs(p.x) - mn) < 1e-4);
      return col.filter(p => p.x >= -1e-4).map(p => { const q = col.find(o => o.r === p.r && Math.abs(o.x + p.x) < 1e-4) || p; return [p.g, q.g]; }); });
    if (open) C.hold = fronts.flatMap(pf => pf.pts.filter(p => p.edge && p.lab === 'cf').map(p => p.g));
    if (tucked) fronts.concat([pb]).forEach(P_ => P_.pts.forEach(p => { if (p.edge && p.lab === 'hem') C.pin[p.g] = 1; }));
    // рукава: трубы вдоль руки, верхнее кольцо вшито в пройму (перед: от плеча к подмышке — спереди трубы; спинка — сзади)
    // нет отдельного фото рукава — ткань берём с бока корпуса на фото (узкая полоса): цвет и фактура как у корпуса
    // на фото с человеком «рукав» с бока корпуса — это рука, фон и край вещи (пятна и треугольник на рукаве): ткань рукава
    // берём с чистого места переда — между серединой (планка, пуговицы) и боком, ниже груди
    const merged = item.shape && item.shape.merged, worn = item.shape && item.shape.worn, ownS = item.tex.sleeve && !merged && !worn, j = armJ(d), sTex = ownS ? item.tex.sleeve : item.tex.frontCut || item.tex.front, mS = photoMat(sTex, base, ft); mS.side = THREE.DoubleSide;
    const sK = merged ? 0.3 : 0.62, sUV = ownS ? (u, v) => [u, v] : worn ? (u, v) => [aF.cx + (aF.hw || 0.3) * (0.32 + 0.1 * Math.abs(Math.sin(u * Math.PI))), 0.5 + 0.2 * v] : (u, v) => [aF.cx + (aF.hw || 0.3) * (sK + 0.1 * Math.abs(Math.sin(u * Math.PI))), 0.3 + 0.45 * v];   // рукава слились с корпусом на фото — ткань ближе к середине (с края там рука и блик)
    let armLen = 0; for (let i = 1; i < arm.length; i++) armLen += Math.hypot(arm[i][0] - arm[i - 1][0], arm[i][1] - arm[i - 1][1]);
    // окат = длине проймы по выкройке (перед + спинка); иначе шов растягивает верх рукава («рожки» на плечах)
    // ×1.1 — запас оката, как у настоящего рукава: пройма на теле растягивается, и без запаса верх рукава натянут (автопроверка «натяжение» 3–10% у рукавов)
    const hole = Math.max((M.AD + 0.01) * 2.1, armLen * 2 * 0.97) * 1.1, r0 = Math.max(hole / (2 * Math.PI), armRad(d, 0) + 0.015), r1 = Math.max(M.SO / Math.PI, armRad(d, Math.min(1, M.SL / j.L)) + 0.008);
    (M.noSleeve ? [] : [-1, 1]).forEach(side => {   // платье без рукавов (сарафан) — пройма остаётся открытой
      const D = new THREE.Vector3(Math.sin(j.th) * side, -Math.cos(j.th), 0);
      // начало рукава — в середине проймы (между плечевой точкой и подмышкой), чтобы шов сошёлся без натяжки
      const S0 = new THREE.Vector3(side * Math.max(j.x * 0.9, (M.S / 2 + M.W / 2) / 2), yTop - (M.SD + M.AD) / 2, 0);
      // окат: эллипс в плоскости проймы — по высоте от плеча до подмышки, по глубине — чтобы длина совпала с проймой
      // окат лежит вдоль линии проймы — от плечевой точки вниз к подмышке (наклонно), а не стоит вертикально снаружи от плеча:
      // иначе верх рукава оставался на высоте плеча над опущенной рукой — плечо выходило квадратным («погоны»)
      const aU = new THREE.Vector2(side * (M.S / 2 - M.W / 2), M.AD - M.SD), aLen = aU.length(); aU.normalize();
      const ry = aLen / 2 + 0.008, rz = solve(z => ellP(ry, z), 0.02, 0.3, hole);
      const cap = {center: new THREE.Vector3(side * (M.S / 2 + M.W / 2) / 2, yTop - (M.SD + M.AD) / 2, 0), ry, rz, up: new THREE.Vector3(aU.x, aU.y, 0)};
      // окат широкий (= пройме), но сразу под ним рукав сужается до ширины по бицепсу (как у настоящего рукава): иначе лишняя ткань
      // стоит над плечом колом («погоны», у жёсткого пуховика — особенно)
      const sB = Math.min(0.1, M.SL * 0.4), rB = Math.min(r0, Math.max(r1, armRad(d, 0.12) + 0.022 + (fab.margin || 0), r0 * 0.8));
      // рукав-фонарик: ткань рукава шире проймы (шов собирает её в сборку на плече), объём держится до манжеты, манжета — по руке
      const rP = Math.max(r0 * 0.95, armRad(d, 0.1) + 0.022), rC = armRad(d, Math.min(1, M.SL / j.L)) + 0.012;
      const radS = item.puff ? s => { const u = s / M.SL; return u < 0.82 ? rP * (1 - 0.18 * u * u) : rP * 0.88 + (rC - rP * 0.88) * Math.min(1, (u - 0.82) / 0.12); }
        : s => s < sB ? r0 + (rB - r0) * (s / sB) * (s / sB) * (3 - 2 * s / sB) : rB + (r1 - rB) * Math.pow((s - sB) / Math.max(0.01, M.SL - sB), 0.8);
      const tube = addTube(C, S0, D, M.SL, radS, 20, Math.max(6, Math.round(M.SL / 0.025)), mS, side, sUV, cap);
      const ring = tube.top, segs = ring.length;
      const loop = (P_, front) => P_.pts.filter(p => p.edge && p.lab === 'arm' && Math.sign(p.x) === side).sort((a, b) => a.y - b.y).map(p => p.g);
      const lf = fronts.flatMap(pf => pf.pts).filter(p => p.edge && p.lab === 'arm' && Math.sign(p.x) === side).sort((a, b) => a.y - b.y).map(p => p.g), lb = loop(pb, false);
      // плечевая точка (угол детали, метка «плечо») — тоже в шов оката: иначе угол не пришит к рукаву, торчит треугольником,
      // а над рукавом видна щель
      const corner = pts_ => { let best = null, bs = -1e9; for (const p of pts_) { if (!p.edge || Math.sign(p.x) !== side || (p.lab !== 'shoulder' && p.lab !== 'arm') || p.y > M.SD + cell * 1.5) continue; const sc = Math.abs(p.x) - 0.5 * p.y; if (sc > bs) { bs = sc; best = p; } } return best; };
      [[fronts.flatMap(pf => pf.pts), lf], [pb.pts, lb]].forEach(([pts_, L_]) => { const c = corner(pts_); if (c && !L_.includes(c.g)) L_.unshift(c.g); });
      // спереди: угол 0 (плечо) → π (подмышка) через π/2 (перед); сзади: через 3π/2
      lf.forEach((g_, t) => { const a = Math.PI * (lf.length > 1 ? t / (lf.length - 1) : 0.5); C.seams.push([g_, ring[Math.round(a / (2 * Math.PI) * segs) % segs]]); });
      lb.forEach((g_, t) => { const a = 2 * Math.PI - Math.PI * (lb.length > 1 ? t / (lb.length - 1) : 0.5); C.seams.push([g_, ring[Math.round(a / (2 * Math.PI) * segs) % segs]]); });
      if (lf.length > 1 && lb.length > 1) chains.push({ring, lf, lb, rings: tube.rings});
    });
    if (hooded) addHood(C, d, M, fronts, pb, mS, hoodUp, cell, ownS ? null : sUV);
    else if (item.stand) addStand(C, d, yTop, fronts, pb, mF, aF);
    // отложной воротник (поло, рубашка) — объёмной деталью по горловине на показе (collar3d.js)
    if (item.collar && !item.stand && !hooded) C.collar = {ring: fronts.concat([pb]).flatMap(P_ => P_.pts.filter(p => p.edge && p.lab === 'neck').map(p => p.g)), a: aF, hs: 0.028 * d.s, fw: 0.044 * d.s};
  } else if (k === 'skirt') {
    // юбка: перед и спинка во всю ширину, сшиты по бокам; пояс на талии, книзу — по ширине на фото (прямая, трапеция, клёш)
    const {yW, WW, Lk, wvis} = skirtProf(item, d);
    // складки (item.pleats): ткань заложена гармошкой — у пояса круто (угол α0), книзу раскрываются (α1);
    // ширина ткани = видимая / cos α; у сгибов изгиб «помнит» сложенную форму (заутюженные складки)
    const pleat = false, cs = cell, a0 = 0.95, a1 = 0.35, half = 3 * cs;   // складки — рельефом на показе (pleatRelief), расчёт — гладкая трапеция
    const alpha = y => pleat ? a0 + (a1 - a0) * Math.pow(Math.min(1, y / Lk), 0.7) : 0;
    const pts = [[0, 0], [WW / Math.cos(alpha(0)) / 2, 0]], labs = ['waist'];
    const N = 10; for (let i = 1; i <= N; i++) { const y = Lk * i / N; pts.push([wvis(y) / Math.cos(alpha(y)) / 2, y]); labs.push('side'); }
    // наклонный бок длиннее середины: на конусе бока свисали бы «углами» ниже подола (у настоящей юбки-трапеции низ выкройки —
    // дуга, к бокам выше). Точку бока поднимаем на лишнюю длину бока; низ от бока к середине — плавно
    trueHem(pts, 1);
    labs[labs.length - 1] = 'hem'; for (let i = 1; i <= 3; i++) { const t = i / 4, [hx, hy] = pts[pts.length - 1]; pts.push([hx * (1 - t), hy + (Lk - hy) * Math.sin(t * Math.PI / 2)]); labs.push('hem'); }
    pts.push([0, Lk]); labs.push('hem');
    const {P: poly, L: lab} = mirrorPoly(pts, labs);
    yPin = yW; fit.BOT_YW = yW; info = {WW, L: Lk};
    cover = {y0: yW - Lk + 0.03, y1: yW - 0.005, torso: true, legs: true};
    // «подъюбник» в расчёте: расклешённая юбка держит конус жёсткостью ткани (а эта — ещё и подкладом-шортами). Изгиб в расчёте
    // местный (через точку) — лишняя ширина у подола иначе проваливается между ног. Невидимый конус ниже бёдер чуть меньше юбки
    { const ua = under ? Array.from(under.a) : new Array(101).fill(0), ub = under ? Array.from(under.b) : new Array(101).fill(0), kf = item.pleats ? 0.99 : 0.85;   /* плиссе: конус по ширине юбки — лишней ширине некуда уходить «плавником» у боковых швов */
      for (let i = 0; i <= 100; i++) { const yy = i / 100 * H, y = yW - yy; if (y < Lk * 0.35 || y > Lk) continue;
        const r = wvis(y) / Math.PI * kf * Math.min(1, (y - Lk * 0.35) / (Lk * 0.25)); if (r <= 0) continue; ua[i] = Math.max(ua[i] || 0, r * 1.08); ub[i] = Math.max(ub[i] || 0, r * 0.86); }
      under = {a: ua, b: ub, raw: 1}; }
    // гармошка: x ткани → видимый x (x·cos α) и глубина складки (треугольная волна по ткани, амплитуда ~ sin α)
    const tri = x => { const q = Math.abs(x) % (2 * half); return q < half ? q : 2 * half - q; };
    const fold = (x, y) => { const al = alpha(y); return [x * Math.cos(al), tri(x) * Math.sin(al)]; };
    // принт — построчно: видимый край ↔ край вещи в той же строке фото
    const PRf = rowSpans(dr.front, aF, 4), PRb = rowSpans(dr.back || dr.front, aB, 4);
    // низ на фото может быть «рваным» (концы складок, из-под них подклад): последняя сплошная строка — не уже 85% самой широкой
    const vMax = PR => { if (!PR) return 0.99; let mx = 0; PR.forEach(e => { if (e) mx = Math.max(mx, e[1] - e[0]); }); let r = PR.length - 1; while (r > 0 && (!PR[r] || PR[r][1] - PR[r][0] < 0.85 * mx)) r--; return Math.max(0.5, (r + 0.5) / PR.length); };
    const vmF = vMax(PRf), vmB = vMax(PRb);
    const uvS = (mirror, PR, a) => (x, y) => { const v = Math.min(0.99, y / Lk) * (mirror ? vmB : vmF), [xv] = fold(x, y), f = Math.max(-1, Math.min(1, xv / (wvis(y) / 2)));
      const e = PR && PR[Math.max(0, Math.min(PR.length - 1, Math.floor(v * PR.length)))];
      if (e) { const c_ = (e[0] + e[1]) / 2, hw_ = ((e[1] - e[0]) / 2 - 0.004) * (item.shape && item.shape.worn ? 0.92 : 1);   /* на фото с человеком край — бок вещи в тени: на шов ложилась тёмная полоса */ return [c_ + (mirror ? -1 : 1) * f * hw_, v]; }
      return [mirror ? a.cx - x / WW * 0.5 : a.cx + x / WW * 0.5, v]; };
    const placeS = zs => (x, y) => { const [xv, zf] = fold(x, y); return [xv, yW - y, zs * (zo * 0.9 + zf)]; };
    const e0 = C.E.length;
    const pf = addPanel(C, poly, lab, cs, placeS(1), uvS(false, PRf, aF), mF, 'front', null, null, 0);
    const pb = addPanel(C, poly, lab, cs, placeS(-1), uvS(true, PRb, aB), mB, 'back', null, null, 0);
    // сложенные складки: диагонали и изгиб — по сложенной форме (растяжение по основе и утку — по ткани, она не тянется)
    if (pleat) for (let e = e0; e < C.E.length; e += 4) { const kd = C.E[e + 3]; if (kd !== 1 && kd !== 2) continue; const i = C.E[e] * 3, j = C.E[e + 1] * 3;
      C.E[e + 2] = Math.hypot(C.P[j] - C.P[i], C.P[j + 1] - C.P[i + 1], C.P[j + 2] - C.P[i + 2]); }
    // складки (плиссе/заложенные): рельеф на показе — ступенчатый сдвиг по нормали вдоль ткани, у пояса заутюжены (мелко), книзу раскрыты
    // складки (плиссе/заложенные) — формой на мелкой сетке показа (pleats.js); та же сетка — у юбки с нижним слоем (лента подклада по её низу)
    if (item.pleats || item.lining) [pf, pb].forEach((P_, j) => { const m = C.meshes[C.meshes.length - 2 + j]; m.relief = {rc: P_.pts.map(p => [p.r, p.c]), px: P_.pts.map(p => p.x), py: P_.pts.map(p => p.y), L: Lk, depth: item.pleats ? 0.013 : 0}; });
    if (item.lining) C.lining = {color: item.lining, len: 0.032};   // белые шорты-подклад, подъюбник: выглядывает из-под юбки
    // бок: и нижний угол (у подола) — точки без соседа слева или справа; иначе у подола торчат «крылышки»
    // (только у линии бока выкройки: концы короткой нижней строки у скруглённого низа — это низ, не бок)
    const sideSegs = []; for (let i = 0; i < poly.length; i++) if (lab[i] === 'side') sideSegs.push([poly[i], poly[(i + 1) % poly.length]]);
    const nearSide = p => sideSegs.some(([a_, b_]) => segDist(p.x, p.y, a_, b_) < cs * 1.3);
    pf.pts.forEach(p => { if (!p.edge || p.y < cs * 1.1 || (pf.at(p.r, p.c - 1) && pf.at(p.r, p.c + 1)) || !nearSide(p)) return; const q = pb.at(p.r, p.c); if (q && q.edge) C.seams.push([p.g, q.g]); });
    [pf, pb].forEach(P_ => P_.pts.forEach(p => { if (p.y < cs * 1.1) C.pin[p.g] = 1; }));
    // перед остаётся спереди, спинка — сзади: у боков низ переда и спинки (не шов — скруглённый низ) заходил друг за друга «плавником»
    C.sector = pf.pts.map(p => [p.g, 1, 0, 0]).concat(pb.pts.map(p => [p.g, -1, 0, 0]));
  } else {
    C.tether = null;   // брюки: висят на поясе, вытягивания нет — привязи только мешали штанинам
    const sp = bottomSpec(item, d), cm = itemCm(item, d.b), sh = item.shape || {};
    const WW = Math.max(sp.ww, ellP(bodyAB(d, sp.yW / H).a, bodyAB(d, sp.yW / H).b) / 2 + 0.01), R = sp.yW - sp.yC, IN = sp.legLen + sp.stack;
    const HP = Math.max(sp.hip || WW * 1.15, ellP(bodyAB(d, 0.53).a, bodyAB(d, 0.53).b) / 2 + 0.03);
    const lw = sp.lw.slice(), TW = Math.max(lw[0], HP * 0.55, d.thigh * Math.PI + 0.02);
    // штанина не уже ноги (+ ~1 см по полуобхвату сверх зазора): иначе тесная труба в расчёте соскакивает с ноги вбок
    const legW = t => { const yf = (sp.yW - R - IN * t) / H, r = Math.min(legR(d, Math.max(0, yf)), d.legX - 0.002) + 0.007; return Math.max(interp(lw, t) * (TW / lw[0]), 0.12, Math.PI * r + 0.012); };   /* r уже с зазором 7 мм; было +3 см по полуобхвату — у бедра штанина выходила шире настоящей (бочка становилась ромбом) */
    yPin = sp.yW; info = {WW, HP, R, IN, TW, sp}; fit.BOT_YW = sp.yW;
    cover = {y0: sp.yHem + 0.03, y1: sp.yW - 0.005, torso: true, legs: true};
    // выкройка как у настоящих брюк: четыре детали (перед и спинка, левая и правая). Штанина — вокруг своей ноги (ось на legX):
    // у широкой штанины внутренний край заходит за середину — это «шаговый язычок», он уходит между ног вглубь.
    // Раньше перед был одной деталью с внутренним швом у самой середины: штанина висела снаружи от ноги, к низу сходилась к ноге
    // конусом и «липла», а по глубине оставалась узкой.
    const cxL = d.legX + 0.01, N = 10, xo = t => Math.max(cxL + legW(t) / 2, t < 0.35 ? HP / 2 * (1 - t / 0.35) + (cxL + legW(t) / 2) * (t / 0.35) : 0), xi = t => cxL - legW(t) / 2;
    // бок от пояса до шага — по форме вещи на фото (sh.hip: ширина по 8 строкам от пояса к шагу): плавно, как у настоящей выкройки.
    // Раньше бок шёл от пояса сразу к точке бёдер HP на 0.55 посадки и дальше отвесно: у широких брюк (HP намного больше бёдер)
    // это давало резкую «полку» на бёдрах и прямые стенки ниже — надутый каркас
    const hp = sh.hip && sh.hip.length > 2 ? sh.hip : null, hipMin = (HP0 => HP0 / 2)(ellP(bodyAB(d, 0.53).a, bodyAB(d, 0.53).b) / 2 + 0.03);
    const grow = f => { if (!hp) { const t = Math.min(1, f / 0.7); return t * (2 - t); } const n = hp.length, q = Math.max(0, Math.min(n - 1, (f - 0.02) / 0.96 * (n - 1))), i = Math.min(n - 2, Math.floor(q)), v = hp[i] + (hp[i + 1] - hp[i]) * (q - i);
      return Math.max(0, Math.min(1, (v - hp[0]) / ((hp[n - 1] - hp[0]) || 1))); };
    const xTop = xo(0), sideAt = f => Math.max(WW / 2 + (xTop - WW / 2) * grow(f), f >= 0.45 ? Math.min(xTop, hipMin) : 0);
    // метка hl[i] — отрезок от half[i] к half[i+1] (последний — к half[0]); число меток = числу точек
    const half = [[0, 0], [WW / 2, 0]], hl = ['waist', 'side'];
    for (const f of [0.2, 0.4, 0.6, 0.8]) { half.push([sideAt(f), R * f]); hl.push('side'); }
    for (let i = 0; i <= N; i++) { const t = i / N; half.push([xo(t), R + IN * t]); if (i < N) hl.push('side'); }
    hl.push('hem');                                                     // от внешнего угла низа к внутреннему
    for (let i = N; i >= 0; i--) { const t = i / N; half.push([xi(t), R + IN * t]); if (i > 0) hl.push('inner'); }
    // от шага к середине — сидение и ширинка (шов посередине), плавной кривой
    const x0 = xi(0); half.push([x0 * 0.45, R * 0.93], [0, R * 0.72]); hl.push('rise', 'rise', 'rise');
    const polyOf = sg => half.map(([x, y]) => [sg * x, y]);
    const spansOf = poly => y => { const xs = []; for (let i = 0; i < poly.length; i++) { const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length]; if ((ay > y) !== (by > y)) xs.push(ax + (bx - ax) * (y - ay) / (by - ay)); } xs.sort((a, b) => a - b); return xs.length >= 2 ? [xs[0], xs[xs.length - 1]] : null; };
    const runs = (g, v) => { const row = g.grid[Math.max(0, Math.min(g.gh - 1, Math.floor(v * g.gh)))], r = []; let c = 0; while (c < g.gw) { if (row[c] === '1') { const c0 = c; while (c < g.gw && row[c] === '1') c++; if (c - c0 > 1) r.push([c0 / g.gw, c / g.gw]); } else c++; } return r; };
    // uv по строкам: деталь ↔ своя половина вещи на фото (выше шага — от середины к боку, ниже — своя штанина от внутреннего края к внешнему)
    const uvP = (a, mirror, g, sg, poly) => { const sp_ = spansOf(poly), ph = mirror ? -sg : sg, cr = a.crotch || 0.4; return (x, y) => {
      const v = y < R ? y / R * cr : cr + (y - R) / IN * (1 - cr), iv = sp_(y), wpx = a.ww || 0.6; let u = a.cx + ph * Math.abs(x) / WW * wpx;
      if (g && iv) { const Rn = runs(g, v), inn = sg > 0 ? iv[0] : iv[1], out = sg > 0 ? iv[1] : iv[0], t = Math.max(0.02, Math.min(0.98, (x - inn) / ((out - inn) || 1e-4)));
        let r = null; if (y < R) { const c = Rn.find(([p, q]) => p <= a.cx && q >= a.cx) || Rn[0]; if (c) r = ph > 0 ? [a.cx, c[1]] : [a.cx, c[0]]; }
        else { const sideRuns = Rn.filter(([p, q]) => ph > 0 ? q > a.cx : p < a.cx); let c = ph > 0 ? sideRuns[sideRuns.length - 1] : sideRuns[0];
          if (c) { if (c[0] < a.cx && c[1] > a.cx) c = ph > 0 ? [a.cx, c[1]] : [c[0], a.cx]; r = ph > 0 ? [c[0], c[1]] : [c[1], c[0]]; } }
        if (r) u = r[0] + (r[1] - r[0]) * t; }
      return [u, v]; }; };
    if (dr.front) { const row = dr.front.grid[1] || dr.front.grid[0]; aF.ww = (row.lastIndexOf('1') - row.indexOf('1') + 1) / dr.front.gw; }
    if (dr.back) { const row = dr.back.grid[1] || dr.back.grid[0]; aB.ww = (row.lastIndexOf('1') - row.indexOf('1') + 1) / dr.back.gw; }
    // у спинки в заду ткани больше: связи по горизонтали длиннее до шага
    const seat = (x, y) => y < R * 1.05 ? 1 + 0.14 * Math.sin(Math.min(1, y / R) * Math.PI * 0.9) : 1;
    const parts = {};
    // в начале шаговые язычки левой и правой штанины лежат друг на друге (деталь центрована на своей ноге — так при сшивании
    // штанина сворачивается вокруг ноги); разводятся по сторонам, когда штанина уже обняла ногу (C.half в runCloth)
    // лишняя длина (ляжет на обувь и пол) в начале не должна уходить под пол: прижатая к полу ткань сжата и выталкивает
    // штанину вверх, а потом её держит трение о ноги — брюки выходили короткими, как шорты. Ниже шага сжимаем по высоте
    const kY = Math.min(1, (sp.yW - R - 0.012) / IN), yOf = y => y <= R ? y : R + (y - R) * kY;
    [1, -1].forEach(sg => { const poly = polyOf(sg), L = hl.slice(), pl = z => (x, y) => [x, sp.yW - yOf(y), z];
      parts['f' + sg] = addPanel(C, poly, L, cell, pl(zo * 0.95), uvP(aF, false, dr.front, sg, poly), mF, 'front', null, null, 0);
      parts['b' + sg] = addPanel(C, poly, L, cell, pl(-zo * 0.95), uvP(aB, true, dr.back, sg, poly), mB, 'back', seat, null, 0); });
    // швы: бок и шаговый — перед со спинкой своей стороны (одинаковая выкройка — одинаковые ячейки); сидение — левая с правой (зеркально)
    [1, -1].forEach(sg => { const pf = parts['f' + sg], pb = parts['b' + sg]; pf.pts.forEach(p => { if (!p.edge || (p.lab !== 'side' && p.lab !== 'inner')) return; const q = pb.at(p.r, p.c); if (q && q.edge && q.lab === p.lab) C.seams.push([p.g, q.g]); }); });
    // (у самого шага сходятся четыре детали — туда же берём начало шаговых швов, иначе в развилке остаётся дырка)
    const crotchJoin = p => p.edge && (p.lab === 'rise' || (p.lab === 'inner' && p.y < R + cell * 4));
    ['f', 'b'].forEach(k => { const A = parts[k + '1'], B = parts[k + '-1'], eb = B.pts.filter(crotchJoin);
      // (шов сидения и ширинки: у середины столбцы на ±cell/2 — пара по зеркалу; ниже по кривой шага — ближайшая точка)
      A.pts.forEach(p => { if (!crotchJoin(p)) return; let best = cell * 1.3, q = null; for (const o of eb) { const dd = Math.abs(o.x + p.x) + Math.abs(o.y - p.y); if (dd < best) { best = dd; q = o; } } if (q) C.seams.push([p.g, q.g]); }); });
    // штанины не проходят друг сквозь друга: ниже шага каждая держится своей стороны от середины
    // (только верх штанины, где язычки: ниже ноги манекена сами разводят штанины, а у пола лишняя длина должна ложиться свободно —
    // иначе её выталкивает наружу и низ штанины стаскивает с ноги)
    C.half = []; [1, -1].forEach(sg => ['f', 'b'].forEach(k => parts[k + sg].pts.forEach(p => { if (p.y > R + cell && p.y < R + IN * 0.4) C.half.push([p.g, sg]); })));
    Object.values(parts).forEach(P_ => P_.pts.forEach(p => { if (p.y < cell * 1.1) C.pin[p.g] = 1; }));
    C.fr = 0.1;
    // штанина держится вокруг своей ноги: перед — спереди (z ≥ 0), спинка — сзади, внутренняя половина детали — с внутренней стороны
    // от оси ноги, внешняя — с внешней. Без этого труба штанины под тяжестью проворачивалась вокруг ноги и соскакивала с неё
    C.sector = []; [1, -1].forEach(sg => { const sp_ = spansOf(polyOf(sg)); ['f', 'b'].forEach(k => parts[k + sg].pts.forEach(p => { if (p.y <= R + cell) return; const iv = sp_(p.y); if (!iv) return;
      const inn = sg > 0 ? iv[0] : iv[1], out = sg > 0 ? iv[1] : iv[0], t = (p.x - inn) / ((out - inn) || 1e-4); C.sector.push([p.g, k === 'f' ? 1 : -1, t < 0.3 ? -sg : t > 0.7 ? sg : 0, sg * (d.legX + 0.01)]); })); });
  }
  const finish = P => { if (typeof window !== 'undefined' && window.__dbgC) window.__dbgC.push({k, C, P, item, info, d});
  // окат рукава после расчёта кладём точно на край проймы (между сшитыми точками кольцо рукава иначе отходит — видна щель)
  if (!item.puff) shoulderRound(C, P, chains, push);   // плечевая точка без острого угла (до укладки оката на пройму); у рукава-фонарика сборка на плече — задумана
  chains.forEach(({ring, lf, lb, rings}) => { const segs = ring.length;
    // концы проймы (у плеча и под мышкой) у переда и спинки — одна точка: сводим к середине
    [[lf[0], lb[0]], [lf[lf.length - 1], lb[lb.length - 1]]].forEach(([a, b]) => { for (let k = 0; k < 3; k++) { const m = (P[a * 3 + k] + P[b * 3 + k]) / 2; P[a * 3 + k] = m; P[b * 3 + k] = m; } });
    const along = (L, t) => { const f = t * (L.length - 1), i = Math.min(L.length - 2, Math.floor(f)), w = f - i, a = L[i] * 3, b = L[i + 1] * 3; return [0, 1, 2].map(k => P[a + k] * (1 - w) + P[b + k] * w); };
    // те же пары, что у швов: точка проймы k ↔ вершина кольца idx(k); между ними — по длине проймы (без сдвига вдоль шва)
    const idxF = k => Math.round(k / (lf.length - 1) * segs / 2), idxB = k => Math.round((2 * Math.PI - Math.PI * k / (lb.length - 1)) / (2 * Math.PI) * segs);
    const param = (j, n, idx) => { for (let k = 0; k < n - 1; k++) { const a = idx(k), b = idx(k + 1), lo = Math.min(a, b), hi = Math.max(a, b); if (j >= lo && j <= hi) return (k + (hi === lo ? 0 : (a < b ? (j - a) / (b - a) : (a - j) / (a - b)))) / (n - 1); } return null; };
    for (let j = 0; j <= segs; j++) { const t = j <= segs / 2 ? param(j, lf.length, idxF) : param(j, lb.length, idxB); if (t == null) continue; const q = along(j <= segs / 2 ? lf : lb, t), r = ring[j % segs] * 3; P[r] = q[0]; P[r + 1] = q[1]; P[r + 2] = q[2]; }
    // верх рукава вдоль руки сглаживаем: запас оката иначе встаёт «погоном» над плечом
    const G = rings || []; for (let pass = 0; pass < 4; pass++) for (let i = 1; i < Math.min(4, G.length - 1); i++) for (let j = 0; j < segs; j++) { const a = G[i - 1][j] * 3, b = G[i][j] * 3, c = G[i + 1][j] * 3;
      for (let k = 0; k < 3; k++) P[b + k] += ((P[a + k] + P[c + k]) / 2 - P[b + k]) * 0.6; push(P, b); } });
  C.ringSewn = chains.flatMap(ch => ch.ring);   // всё верхнее кольцо рукава вшито в пройму (в швах — только часть точек)
  const g = clothMeshes(C, P, H);
  g.userData.measures = info; if (cover) g.userData.cover = Object.assign(cover, {color: base});
  if (typeof window !== 'undefined' && window.__keep) window.__last = {C, P};
  try { QC[item.id] = qcCloth(C, P, d, item, dr, info, top, aF, aB); g.userData.qc = QC[item.id]; } catch (e) { QC[item.id] = null; }
  return g; };
  seamBend(C);
  return {C, fab, yPin, d, under, margin: fab.margin || 0, finish, run: () => finish(runCloth(C, makeCollider(d, under, fab.margin), fab, yPin))};
}
export function drapeTemplate(item, d, under) { const j = drapePrepare(item, d, under); return j ? j.run() : null; }
