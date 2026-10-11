// Мерки вещи по фото: длина и ширина, профиль силуэта, юбка, отведение рук.
import {armX} from './body.js';
import {armJ, armRad, bodyAB, clamp, ellP, interp, solve} from './geometry.js';
import {EASE} from './simple-garment.js';
import {itemCm, sizeOf} from './sizes.js';

// длина вещи по спинке (м), если мерок нет: типичная для своего размера, чуть зависит от роста
const LEN0 = {tee: 0.71, sweater: 0.68, hoodie: 0.68, jacket: 0.68, shirt: 0.76, coat: 1.0, puffer: 0.74, dress: 0.95, skirt: 0.62};
// вещи «верха» в расчёте ткани (корпус + рукава): к ним относятся и пальто, пуховик, платье
export const TOPK = new Set(['tee', 'sweater', 'hoodie', 'jacket', 'shirt', 'coat', 'puffer', 'dress']);
function cleanTail(arr) {
  const a = arr.slice(), med = a.slice(2, -3).sort((x, y) => x - y)[Math.floor((a.length - 5) / 2)] || a[0];
  for (let i = a.length - 1; i > a.length - 5; i--) if (a[i] < med * 0.86) a[i] = Math.max(a[i], (a[i - 1] || med) * 0.97);
  for (let i = a.length - 3; i < a.length; i++) a[i] = Math.max(a[i], a[i - 1] * 0.975);   // низ вещи прямой, не «собран»
  return a;
}
// параметры верха на этой фигуре
// «настоящий низ» расклешённой детали: точки бока начиная с i0 поднимаются на столько, на сколько бок длиннее прямой по середине
export function trueHem(pts, i0, i1) { const o = pts.map(p => p.slice()), e = i1 == null ? pts.length - 1 : i1; let s = 0;
  for (let i = i0 + 1; i <= e; i++) { s += Math.hypot(o[i][0] - o[i - 1][0], o[i][1] - o[i - 1][1]); pts[i] = [o[i][0], o[i][1] - Math.max(0, s - (o[i][1] - o[i0][1])) * 0.9]; } }
// края вещи на фото по строкам (сетка выреза): [левый, правый] в долях ширины для каждой строки; медиана по 5 строкам
export function rowSpans(g, a, avg = 0) { if (!g || !g.grid) return null; const R = [], c0 = Math.round((a && a.cx != null ? a.cx : 0.5) * g.gw);
  for (let r = 0; r < g.gh; r++) { const row = g.grid[r]; if (row[c0] !== '1') { R.push(null); continue; } let l = c0, rr = c0; while (l > 0 && row[l - 1] === '1') l--; while (rr < g.gw - 1 && row[rr + 1] === '1') rr++; R.push([(l + 0.5) / g.gw, (rr + 0.5) / g.gw]); }
  const M = R.map((_, r) => { const w = []; for (let k = -2; k <= 2; k++) if (R[r + k]) w.push(R[r + k]); if (!w.length) return null; const m = i => w.map(e => e[i]).sort((p_, q_) => p_ - q_)[w.length >> 1]; return [m(0), m(1)]; });
  if (!avg) return M;
  // ещё и среднее по ±avg строкам: край по клеткам сетки идёт ступеньками, и прямая линия на фото (середина, строчка) ложилась зигзагом
  return M.map((e, r) => { if (!e) return null; let a0 = 0, a1 = 0, c = 0; for (let k = -avg; k <= avg; k++) { const q = M[r + k]; if (q) { a0 += q[0]; a1 += q[1]; c++; } } return [a0 / c, a1 / c]; }); }
// силуэт вещи по сетке вырезанного фото: ширина средней полосы (в долях длины вещи) в 16 строках от подмышки до низа
function photoProfile(item) {
  const g = item.drape && item.drape.front; if (!g || !g.grid) return null; const a = g.a || {cx: 0.5}, cw = g.W / g.gw, ch = g.H / g.gh;
  const c0 = Math.round(a.cx * g.gw), run = r => { const row = g.grid[r]; if (!row || row[c0] !== '1') return 0; let p = c0, q = c0; while (p > 0 && row[p - 1] === '1') p--; while (q < g.gw - 1 && row[q + 1] === '1') q++; return q - p + 1; };
  let top = 0; while (top < g.gh && !run(top)) top++; let bot = g.gh - 1; while (bot > top && !run(bot)) bot--;
  // скруглённый край низа (последние строки уже) — не силуэт
  while (bot > top + 10 && run(bot) < 0.85 * Math.max(run(bot - 1), run(bot - 2), run(bot - 3))) bot--;
  const L = (bot - top + 1) * ch, r0 = Math.round(top + (a.arm || 0.3) * (bot - top)) + 1; if (bot - r0 < 8) return null;
  const out = []; for (let i = 0; i < 16; i++) { const r = Math.round(r0 + (bot - r0) * i / 15); const w3 = [run(r - 1), run(r), run(r + 1)].sort((x, y) => x - y)[1]; out.push(w3 * cw / L); }
  return out.some(v => !v) ? null : out;
}
export function topSpec(item, d) {
  const sh = item.shape || {}, cm = itemCm(item, d.b), k = item.kind, H = d.H;
  let L = cm.len ? cm.len / 100 : (LEN0[k] || 0.7) * (sh.crop ? 0.84 : 1) * Math.pow(H / 1.8, 0.6);
  // вещь снята на модели: длину берём с фото — где низ относительно пояса брюк (hem_waist), разница размеров — по таблице
  if (sh.worn && sh.hem_waist != null) {
    const yW = 0.595 * H, yN = 0.858 * H, yHemPhoto = yW - sh.hem_waist * (yN - yW) - 0.012 * H;
    L = 0.848 * H - yHemPhoto + (cm.len && sh.ref_len ? (cm.len - sh.ref_len) / 100 : 0);
  }
  // на вешалке вещь сужается (калибровка — футболка Zolla лёжа и на вешалке); у вязаных и плотных — меньше
  const hk = !sh.hang ? 1 : k === 'jacket' ? 0.86 : sh.merged ? 0.8 : 0.72;
  // рукава висят вдоль корпуса и закрывают боковые швы: корпус ≈ 85% общей ширины (у пиджака плечи жёсткие — 92%)
  let Fs = sh.merged && sh.full ? new Array(16).fill(sh.full * (k === 'jacket' ? 0.92 : 0.85) / hk * L) : cleanTail(sh.tw || [0.62]).map(v => v / hk * L);
  // платье/пальто на модели: руки вдоль корпуса — по ширине с рукавами силуэт прямой. Сам силуэт вещи (без рук) — в сетке фото:
  // ширина центральной полосы по строкам от подмышки до низа (приталенное, клёш)
  const gp = (k === 'dress' || k === 'coat') && sh.merged ? photoProfile(item) : null;
  if (gp) {
    // спереди ширины груди и талии на человеке различаются меньше, чем обхваты: лиф — по таблице (талия/грудь с припуском),
    // юбка — по фото от талии вниз (как видно спереди; поправка «на круглое сечение» давала лишний клёш — бока торчали)
    // талия — последняя узкая строка перед расширением юбки (не первая под рукавом)
    let mn = 9; for (let i = 1; i < 10; i++) mn = Math.min(mn, gp[i]); let iw = 1; for (let i = 1; i < 10; i++) if (gp[i] <= mn * 1.04) iw = i; iw = Math.max(2, iw);
    const sz = sizeOf(item, d.b), bw = sz && sz.body, mid = r => (r[0] + r[1]) / 2;
    const tr = bw && bw.chest && bw.waist ? (mid(bw.waist) + 6) / (mid(bw.chest) + 8) : Math.pow(gp[iw] / gp[0], 1.6);
    const sm = t => t * t * (3 - 2 * t);
    // грудь — строка под рукавом (в строке подмышки на фото ещё рукава); юбка книзу не сужается (скруглённый край фото — не силуэт)
    const c1 = gp[1]; let prev = 0;
    Fs = gp.map((v, i) => { let w = i === 0 ? Math.max(gp[0], c1) : i <= iw ? c1 * (1 - (1 - tr) * sm((i - 1) / Math.max(1, iw - 1))) : c1 * tr * (v / gp[iw]);
      if (i > iw) w = Math.max(w, prev); prev = w; return w / hk * L; });
  }
  if (cm.chest) { const f = cm.chest / 100 / Fs[1]; Fs = Fs.map(v => v * f); }
  const yHPS = 0.848 * H, yHem = yHPS - L, yN = 0.858 * H;
  const bc = bodyAB(d, 0.72), Fbody = ellP(bc.a, bc.b) / 2;
  const loose = clamp((Fs[1] - Fbody) / (0.24 * Fbody), 0, 1.5);
  const yArm = Math.min(yHPS - (0.25 + 0.07 * loose) * L, 0.758 * H);
  const F = y => y >= yArm ? Fs[0] * 0.6 + Fs[1] * 0.4 : interp(Fs, (yArm - y) / (yArm - yHem));
  const ease = (EASE[k] || 0.014) * 0.6 + 0.006;
  // плечевая точка: у свободной вещи плечо «спущено» — шов ниже по руке
  const Sx = Math.max(d.chest * d.shX * 0.98, armX(d) + 0.02), aFree = solve(x => ellP(x, x * 0.6), 0.01, 1.2, 2 * F(yArm - 0.03));
  const xS = Math.max(Sx * 0.92 + ease, aFree * 0.98, armX(d) - 0.005);   // плечо вещи накрывает плечевой сустав
  const ySh = xS < Sx ? 0.8 * H + d.chest * 0.42 * Math.sqrt(1 - (xS / Sx) ** 2) + ease : 0.8 * H - (xS - Sx) * 1.1 + ease;
  return {L, Fs, F, yHPS, yHem, yN, yArm, loose, ease, xS, ySh: Math.max(ySh, yArm + 0.05), aFree, hk};
}
export function bottomSpec(item, d) {
  const sh = item.shape || {}, cm = itemCm(item, d.b), k = item.kind, H = d.H;
  let yW = 0.595 * H; const bw = bodyAB(d, 0.595), Fw = ellP(bw.a, bw.b) / 2;
  // масштаб: пояс садится на талию (на резинке лёжа собран ~в 1.2 раза); у длинных брюк ещё и длина «до пола» — берём среднее
  const kW = (cm.waist ? cm.waist / 100 : (Fw + 0.012) / (sh.elastic ? 1.1 : 1));
  const tot = (sh.rise || 0.75) + (sh.leg_len || 1.6), full = k !== 'shorts' && !/укороч|кюлот|капри/i.test(item.name || '');
  const kk = cm.outseam ? cm.outseam / 100 / tot : kW;
  // длинные брюки шьют «до пола»: если по фото вышли короче щиколотки — дотянуть
  const T = full && !cm.outseam ? Math.max(tot * kk, yW - 0.025 * H) : tot * kk;
  let yC = 0.47 * H - 0.015;                                  // шаг: по фото лёжа не виден (штанины лежат вплотную), берём по фигуре
  // по таблице размеров: шаг = длина − шаговый шов; короткий шаг сажает брюки ниже на бёдрах, длинный — «спущенный» шаг
  // длина − шаговый шов = посадка по ткани (по изгибу спереди); по вертикали она ≈ на 20% короче
  if (cm.outseam && cm.inseam) { const rise = (cm.outseam - cm.inseam) / 100 * 0.8, bodyC = 0.47 * H - 0.012; yC = Math.min(yW - rise, bodyC); yW = yC + rise; }
  let legLen = T - (yW - yC), yHem = yC - legLen, stack = 0;
  if (yHem < 0.012) { stack = 0.012 - yHem; yHem = 0.012; legLen = yC - yHem; }
  let lw = (sh.leg || [0.6]).slice();
  // хвост с резким сужением — шум фото (тень, обувь, загнутый край): дальше первой такой точки держим ширину
  for (let i = Math.max(1, lw.length >> 1); i < lw.length; i++) if (lw[i] < lw[i - 1] * 0.8) { for (let j = i; j < lw.length; j++) lw[j] = lw[i - 1] * 0.97; break; }
  lw = lw.map(v => v * kk);
  // мерки таблицы: низ штанины и бёдра точные, профиль между ними — по фото
  // низ на фото шумный (обувь, тень): опора — медиана нижней трети без двух последних точек; последние две = мерка низа
  // масштаб штанины: от бедра (полуобхват бёдер × 0.55 ≈ ширина штанины у шага лёжа), форма книзу — по фото;
  // «низ» из таблицы — только если нет бёдер (его часто меряют по-разному: по кругу или лёжа)
  if (cm.hip) { const f = cm.hip / 100 * 0.55 / lw[0]; lw = lw.map(v => v * f); const n = lw.length; lw[n - 1] = Math.max(lw[n - 1], lw[n - 3] * 0.9); lw[n - 2] = Math.max(lw[n - 2], lw[n - 3] * 0.95); }
  else if (cm.hem) { const n = lw.length, ref = lw.slice(Math.max(0, n - 6), n - 2).sort((a, b) => a - b)[1] || lw[n - 1], f = cm.hem / 100 / ref;
    lw = lw.map(v => v * f); lw[n - 1] = lw[n - 2] = cm.hem / 100; }
  // штанина книзу не шире 1.6 ширины у шага (выбросы фото); бочки и клёш расширяются до ~1.4–1.5 — их не срезать
  for (let i = 1; i < lw.length - 1 && cm.hip; i++) lw[i] = Math.min(lw[i], lw[0] * 1.6);
  // бёдра (полуобхват): по таблице или по фото (середина посадки; ниже на фото лёжа уже расходятся штанины)
  const hip = cm.hip ? cm.hip / 100 : sh.hip && sh.hip.length > 3 ? sh.hip[3] * kk : 0;
  return {yW, yC, yHem, legLen, stack, lw, kk, ww: kW, T, hip};
}
// насколько вещь раздвигает руки (широкая вещь — руки лежат на ней, а не протыкают)
// юбка: пояс, длина и ширина лёжа по высоте (y — от пояса вниз). Профиль с фото лёжа — это и есть ширина лёжа; с фото на модели
// спереди видно ≈ диаметр — книзу (круглое сечение) ширина лёжа больше видимой (до ×1.16); книзу не сужается (скруглённый край фото)
export function skirtProf(item, d) {
  const H = d.H, sp = bottomSpec(item, d), cm = itemCm(item, d.b), sh = item.shape || {};
  const yW = Math.max(sp.yW, 0.585 * H), abW = bodyAB(d, yW / H), WW = Math.max(sp.ww, ellP(abW.a, abW.b) / 2 + 0.01);
  const Lk = cm.len ? cm.len / 100 : (LEN0.skirt) * Math.pow(H / 1.8, 0.6), HPb = ellP(bodyAB(d, 0.53).a, bodyAB(d, 0.53).b) / 2 + 0.03;
  let prof = sh.hip && sh.hip.length ? sh.hip.slice() : [1, 1.15, 1.2]; for (let i = 1; i < prof.length; i++) prof[i] = Math.max(prof[i], prof[i - 1]);
  if (sh.worn) prof = prof.map((v, i) => v * (1 + 0.16 * i / Math.max(1, prof.length - 1)));
  const kk = WW / (prof[0] || 1);
  const wvis = y => { const t = y / Lk, yw = (yW - y) / H, ab = bodyAB(d, Math.max(0.5, yw)); const body = yw > 0.47 ? ellP(ab.a, ab.b) / 2 + 0.012 : HPb;
    return Math.max(interp(prof, t) * kk, body, t > 0.25 ? HPb : 0); };
  return {yW, WW, Lk, wvis};
}
export function armSpread(items, d) {
  let th = 0.13; const j = armJ({...d, armA: 0.13});
  items.forEach(it => {
    if (!it.tex || !it.shape) return;
    const tops = TOPK.has(it.kind);
    const ys = tops ? [0.7, 0.64, 0.58] : it.kind === 'skirt' ? [0.55, 0.5, 0.46, 0.42] : [0.55, 0.5];
    let sp = null; if (tops) sp = topSpec(it, d); else sp = bottomSpec(it, d);
    ys.forEach(yf => {
      const y = yf * d.H; let a;
      if (tops) { if (y < sp.yHem) return; a = solve(x => ellP(x, x * 0.66), 0.01, 1.2, 2 * sp.F(y)); }
      else { const bw = bodyAB(d, yf); a = bw.a + 0.02;
        // расклешённая юбка: кисти — снаружи конуса юбки (ширина лёжа / π, сечение чуть шире по бокам)
        if (it.kind === 'skirt') { const sk = skirtProf(it, d), yy = sk.yW - y; if (yy > 0 && yy <= sk.Lk) a = Math.max(a, sk.wvis(yy) / Math.PI * 1.12 + 0.01); } }
      const dy = j.y - y, need = a + armRad(d, dy / j.L) * 1.0 + 0.004;
      th = Math.max(th, Math.atan((need - j.x) / dy));
    });
  });
  return clamp(th, 0.13, items.some(i => i.kind === 'skirt') ? 0.32 : 0.22);
}
