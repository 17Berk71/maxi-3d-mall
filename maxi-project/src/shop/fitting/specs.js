// Мерки вещи по фото: длина и ширина, профиль силуэта, юбка, отведение рук.
import {armX} from './body.js';
import {armJ, armRad, bodyAB, clamp, ellP, interp, shTopAt, smooth, solve} from './geometry.js';
import {EASE} from './simple-garment.js';
import {itemCm, sizeOf} from './sizes.js';

// длина вещи по спинке (м), если мерок нет: типичная для своего размера, чуть зависит от роста
const LEN0 = {tee: 0.71, sweater: 0.68, hoodie: 0.68, jacket: 0.68, shirt: 0.76, coat: 1.0, puffer: 0.74, dress: 0.95, skirt: 0.62, vest: 0.62};
// вещи «верха» в расчёте ткани (корпус + рукава): к ним относятся и пальто, пуховик, платье
// пиджак (жакет, блейзер) сидит иначе, чем куртка: жёсткая ткань с прокладкой, плечо по плечу фигуры с подплечником,
// приталенный — с вытачками по талии (пользователь: «посадка пиджака должна отличаться от посадки куртки»)
export const isBlazer = item => item.kind === 'jacket' && /пиджак|жакет|блейзер|blazer/i.test(item.name || '');
export const TOPK = new Set(['tee', 'sweater', 'hoodie', 'jacket', 'shirt', 'coat', 'puffer', 'dress', 'vest']);
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
// длина по точкам тела модели на фото (фабрика: shape.pose_len — 0 плечи, 1 бёдра, 2 колени, 3 щиколотки; model_photo.pose_len)
// → высота на манекене по тем же точкам (доли роста: плечевой сустав 0.818, тазобедренный 0.53, колено 0.285, щиколотка 0.045).
// Пользователь: «на фото платье ниже колена, на манекене выше». Нет позы — по названию: мини, до колена, миди, макси
const LMK = [0.818, 0.53, 0.285, 0.045];
export function poseY(s, H) { if (s <= 0) return (LMK[0] - s * (LMK[0] - LMK[1])) * H; if (s >= 3) return Math.max(0.01, (LMK[3] - (s - 3) * 0.04)) * H; const i = Math.floor(s), t = s - i; return (LMK[i] + (LMK[i + 1] - LMK[i]) * t) * H; }
export function hemByName(item) { const n = (item.name || '').toLowerCase();
  if (/макси|в пол\b|длинн(ое|ая) (платье|юбка)|maxi/.test(n)) return 2.95; if (/миди|midi/.test(n)) return 2.5; if (/до колен|knee/.test(n)) return 2.0; if (/мини\b|mini/.test(n)) return 1.45; return null; }
export function topSpec(item, d) {
  const sh = item.shape || {}, cm = itemCm(item, d.b), k = item.kind, H = d.H;
  let L = cm.len ? cm.len / 100 : (LEN0[k] || 0.7) * (sh.crop ? 0.84 : 1) * Math.pow(H / 1.8, 0.6);
  // вещь снята на модели: длину берём с фото — где низ относительно пояса брюк (hem_waist), разница размеров — по таблице
  // но если в таблице есть длина выбранного размера — она точнее: на карточке магазина кадр часто обрезан, низ вещи не виден или
  // закрыт (td-tee: «низ у пояса» по фото — 49 см при 72 по таблице)
  // длина в см по фото с моделью в полный рост (рост модели из карточки → см на пиксель; build.py) — после таблицы
  const lp = !cm.len && sh.len_photo ? sh.len_photo / 100 : 0, L0k = (LEN0[k] || 0.7) * Math.pow(H / 1.8, 0.6);
  if (lp && lp > L0k * 0.5 && lp < L0k * 2.2) L = lp;
  let lenPose = false;
  const lenPhoto0 = !!(sh.worn && sh.hem_waist != null && !cm.len && !(lp && L === lp));
  if (lenPhoto0) {
    const yW = d.fW * H, yN = d.fN * H, yHemPhoto = yW - sh.hem_waist * (yN - yW) - 0.012 * H;
    L = d.fHPS * H - yHemPhoto;
    // низ «по фото» дальше разумного для вида (маска зацепила юбку или платье под вещью) — типовая длина вида
    const L0 = (LEN0[k] || 0.7) * Math.pow(H / 1.8, 0.6); const hi = k === 'coat' || k === 'puffer' || k === 'dress' ? 1.9 : 1.35; if (L > L0 * hi || L < L0 * 0.55) L = L0;
  }
  // по позе модели — точнее «низа у пояса брюк» для длинных вещей (платье, пальто) и для любых, где низ ниже бёдер
  const pl = sh.pose_len, sHem = pl && pl.hem != null ? pl.hem : (k === 'dress' && !cm.len && !lp ? hemByName(item) : null);
  if (sHem != null && !cm.len && !lp && (sh.worn || !pl) && (k === 'dress' || k === 'coat' || k === 'puffer' || sHem > 1.15) && !(typeof window !== 'undefined' && window.__noPoseLen)) {
    const Lp = d.fHPS * H - poseY(sHem, H); if (Lp > L0k * 0.5 && Lp < L0k * 2.4) { L = Lp; if (sh.worn) lenPose = true; } }
  // на вешалке вещь сужается (калибровка — футболка Zolla лёжа и на вешалке); у вязаных и плотных — меньше
  const hk = !sh.hang ? 1 : k === 'jacket' ? 0.86 : sh.merged ? 0.8 : 0.72;
  // рукава висят вдоль корпуса и закрывают боковые швы: корпус ≈ 85% общей ширины (у пиджака плечи жёсткие — 92%)
  // студийное фото лёжа (или на невидимом манекене) с рукавами вдоль корпуса: в «общую ширину» входят оба рукава целиком — корпус ≈ 0.68
  const flatM = sh.merged && !sh.hang && !sh.worn;
  // без рукавов (жилет, сарафан, комбинация) «слившихся рукавов» нет: общая ширина — это корпус. Раньше ×0.68 сужало корпус,
  // и по пропорции фото жилет выходил длиннее (Tom Tailor: «на фото жилет, на манекене куртка, ещё и длиннее»), а комбинация — короче
  const noSl = k === 'vest' || item.sleeveless || !!(item.card && item.card.straps);
  let Fs = sh.merged && sh.full ? new Array(16).fill(sh.full * (noSl ? 1 : flatM ? 0.68 : k === 'jacket' ? 0.92 : 0.85) / hk * L) : cleanTail(sh.tw || [0.62]).map(v => v / hk * L);
  // платье/пальто на модели: руки вдоль корпуса — по ширине с рукавами силуэт прямой. Сам силуэт вещи (без рук) — в сетке фото:
  // ширина центральной полосы по строкам от подмышки до низа (приталенное, клёш)
  const gp = (k === 'dress' || k === 'coat') && sh.merged && !flatM ? photoProfile(item) : null;   // лёжа с рукавами вдоль — строка фото включает рукава: силуэт по ней ложно расширяется книзу
  if (gp) {
    // спереди ширины груди и талии на человеке различаются меньше, чем обхваты: лиф — по таблице (талия/грудь с припуском),
    // юбка — по фото от талии вниз (как видно спереди; поправка «на круглое сечение» давала лишний клёш — бока торчали)
    // талия — последняя узкая строка перед расширением юбки (не первая под рукавом)
    let mn = 9; for (let i = 1; i < 10; i++) mn = Math.min(mn, gp[i]); let iw = 1; for (let i = 1; i < 10; i++) if (gp[i] <= mn * 1.04) iw = i; iw = Math.max(2, iw);
    const sz = sizeOf(item, d.b), bw = sz && sz.body, mid = r => (r[0] + r[1]) / 2;
    // свобода приталенного лифа: по талии ~3 см, по груди ~6 (было 6 и 8 — талия платья с отрезной талией выходила прямой, не затянутой, как на фото)
    const tr = bw && bw.chest && bw.waist ? (mid(bw.waist) + 3) / (mid(bw.chest) + 6) : Math.pow(gp[iw] / gp[0], 1.6);
    const sm = t => t * t * (3 - 2 * t);
    // грудь — строка под рукавом (в строке подмышки на фото ещё рукава); юбка книзу не сужается (скруглённый край фото — не силуэт)
    const c1 = gp[1]; let prev = 0;
    Fs = gp.map((v, i) => { let w = i === 0 ? Math.max(gp[0], c1) : i <= iw ? c1 * (1 - (1 - tr) * sm((i - 1) / Math.max(1, iw - 1))) : c1 * tr * (v / gp[iw]);
      if (i > iw) w = Math.max(w, prev); prev = w; return w / hk * L; });
  }
  // замер ширины по груди: ширины по нему; а если длины в замерах нет и фото не на модели и не со слившимися рукавами —
  // и длину по пропорции фото (типовая длина вида у футболки Zolla давала 72 см при ~69 по фото и замеру ширины; поправка
  // вешалки hk подобрана как раз по ней)
  // студийное фото или вешалка без таблицы у длинных вещей (пальто, пуховик, платье, куртка): длина вида бывает любой (короткое
  // пальто и пальто в пол), а ширина у вещи «своего» размера — фигура плюс обычный припуск вида. Поэтому масштаб — по ширине,
  // длина — по пропорции фото. Раньше длинное пальто и парка выходили короткими, длинный пуховик — широким «пончо»
  if (!cm.chest && !cm.len && !sh.worn && (!sh.merged || flatM) && !lp && ['coat', 'puffer', 'dress', 'jacket', 'vest'].includes(k) && !(typeof window !== 'undefined' && window.__noWAnchor)) {
    const EASEC = {coat: 0.22, puffer: 0.30, dress: 0.08, jacket: 0.16, vest: item.puffer ? 0.16 : 0.08}, over = /оверсайз|oversize|свободн/i.test(item.name || '') ? 0.12 : 0;
    const ab = bodyAB(d, 0.72), half = ellP(ab.a, ab.b) / 2 + (EASEC[k] + over) / 2, f = half / Fs[1];
    // лёжа с рукавами вдоль корпуса пропорция фото ненадёжна (ширина — уже рукавов, а не корпуса): длина не больше ×1.25 типовой
    // (×1.45 у «удлинённых»); иначе удлинённый бомбер Love Republic выходил пальто в пол
    const up = flatM ? (/удлин|макси|в пол|длинн/i.test(item.name || '') ? 1.45 : 1.25) : 1.9;
    // студийный снимок — вещь объёмом (невидимый манекен): спереди видно ~0.88 ширины лёжа, по ширине длина выходила длиннее
    const L1 = clamp(L * f * (flatM && !noSl ? 0.88 : 1), L0k * 0.55, L0k * up), f1 = L1 / L; Fs = Fs.map(v => v * f1); L = L1;
  }
  if (isBlazer(item) && /приталенн|slim|по фигуре/i.test(item.name || '') && !(typeof window !== 'undefined' && window.__noBlazer)) {
    const n = Fs.length; Fs = Fs.map((v, i) => { const t = i / (n - 1), b = Math.exp(-((t - 0.42) ** 2) / 0.03); return v * (1 - 0.08 * b); }); }
  if (cm.chest) { const f = cm.chest / 100 / Fs[1]; Fs = Fs.map(v => v * f); if (!cm.len && !sh.worn && !sh.merged) L *= f; }
  const yHPS = d.fHPS * H, yHem = yHPS - L, yN = d.fN * H;
  const bc = bodyAB(d, 0.72), Fbody = ellP(bc.a, bc.b) / 2;
  const loose = clamp((Fs[1] - Fbody) / (0.24 * Fbody), 0, 1.5);
  const yArm = Math.min(yHPS - (0.25 + 0.07 * loose) * L, 0.758 * H);
  const F = y => y >= yArm ? Fs[0] * 0.6 + Fs[1] * 0.4 : interp(Fs, (yArm - y) / (yArm - yHem));
  const ease = (EASE[k] || 0.014) * 0.6 + 0.006;
  // плечевая точка: у свободной вещи плечо «спущено» — шов ниже по руке
  const Sx = Math.max(d.chest * d.shX * 0.98, armX(d) + 0.02), aFree = solve(x => ellP(x, x * 0.6), 0.01, 1.2, 2 * F(yArm - 0.03));
  const xS = Math.max(Sx * 0.92 + ease, aFree * 0.98, armX(d) - 0.005);   // плечо вещи накрывает плечевой сустав
  const ySh = d.mh ? shTopAt(d, xS) + ease : xS < Sx ? 0.8 * H + d.chest * 0.42 * Math.sqrt(1 - (xS / Sx) ** 2) + ease : 0.8 * H - (xS - Sx) * 1.1 + ease;   // манекен по сетке — верх плеча по точкам тела
  const lenPhoto = lenPhoto0 || lenPose;
  return {L, Fs, F, yHPS, yHem, yN, yArm, loose, ease, xS, ySh: Math.max(ySh, yArm + 0.05), aFree, hk, lenPhoto};
}
export function bottomSpec(item, d) {
  const sh = item.shape || {}, cm = itemCm(item, d.b), k = item.kind, H = d.H;
  let yW = d.fW * H; const bw = bodyAB(d, d.fW), Fw = ellP(bw.a, bw.b) / 2;
  // масштаб: пояс садится на талию (на резинке лёжа собран ~в 1.2 раза); у длинных брюк ещё и длина «до пола» — берём среднее
  const kW = (cm.waist ? cm.waist / 100 : (Fw + 0.012) / (sh.elastic ? 1.1 : 1));
  const tot = (sh.rise || 0.75) + (sh.leg_len || 1.6), full = k !== 'shorts' && !/укороч|кюлот|капри/i.test(item.name || '');
  const outPh = !cm.outseam && sh.len_photo && (k === 'pants' || k === 'jeans' || k === 'shorts') && sh.len_photo > 25 && sh.len_photo < 130 ? sh.len_photo : 0;   // по росту модели
  const kk = (cm.outseam || outPh) ? (cm.outseam || outPh) / 100 / tot : kW;
  // длинные брюки шьют «до пола»: если по фото вышли короче щиколотки — дотянуть
  let T = full && !cm.outseam && !outPh ? Math.max(tot * kk, yW - 0.025 * H) : tot * kk;
  // фото на модели без роста в кадре: масштаб по видимой ширине пояса (часто срезан кадром) ненадёжен — брюки выходили длиннее
  // ног и ложились на пол «клёшем». Длинные — до щиколотки, не длиннее
  if (sh.worn && !cm.outseam && !outPh) T = Math.min(T, yW - (full ? 0.03 : k === 'shorts' ? 0.265 : 0.09) * H);   // укороченные — 7/8, шорты — не ниже колена
  let yC = 0.47 * H - 0.015;                                  // шаг: по фото лёжа не виден (штанины лежат вплотную), берём по фигуре
  // по таблице размеров: шаг = длина − шаговый шов; короткий шаг сажает брюки ниже на бёдрах, длинный — «спущенный» шаг
  // длина − шаговый шов = посадка по ткани (по изгибу спереди); по вертикали она ≈ на 20% короче
  if (cm.outseam && cm.inseam) { const rise = (cm.outseam - cm.inseam) / 100 * 0.8, bodyC = 0.47 * H - 0.012; yC = Math.min(yW - rise, bodyC); yW = yC + rise; }
  let legLen = T - (yW - yC), yHem = yC - legLen, stack = 0;
  if (yHem < 0.012) { stack = 0.012 - yHem; yHem = 0.012; legLen = yC - yHem; }
  let lw = (sh.leg || [0.6]).slice();
  // хвост с резким сужением — шум фото (тень, обувь, загнутый край): дальше первой такой точки держим ширину
  for (let i = Math.max(1, lw.length >> 1); i < lw.length; i++) if (lw[i] < lw[i - 1] * 0.8) { for (let j = i; j < lw.length; j++) lw[j] = lw[i - 1] * 0.97; break; }
  // последние точки — скруглённый край выреза у самого низа: провал больше 10% за шаг — тоже шум (у шорт низ сужался с 38 до 30.5 см
  // — «манжета»); настоящее сужение книзу (бочка, зауженные) идёт плавно по многим точкам
  for (let i = Math.max(1, lw.length - 3); i < lw.length; i++) if (lw[i] < lw[i - 1] * 0.9) { for (let j = i; j < lw.length; j++) lw[j] = lw[i - 1] * 0.98; break; }
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
  // ширина штанины у колена, измеренная лентой (лёжа): масштаб всех ширин штанины по ней, форма — по фото
  if (cm.knee) { const i = Math.round(0.42 * (lw.length - 1)), f = cm.knee / 100 / lw[i]; lw = lw.map(v => v * f); }
  // ширина штанины по всей длине, измеренная по фото с листом A4 (cm.leg: [доля от шага до низа, см]) — точнее профиля с фото без масштаба
  if (Array.isArray(cm.leg) && cm.leg.length > 1) lw = lw.map((_, i) => { const t = i / (lw.length - 1) * 0.99, L = cm.leg; let k = 0; while (k < L.length - 2 && L[k + 1][0] < t) k++;
    const [t0, v0] = L[k], [t1, v1] = L[k + 1], w = Math.max(0, Math.min(1, (t - t0) / ((t1 - t0) || 1))); return (v0 + (v1 - v0) * w) / 100; });
  // фото на модели без мерок бёдер: видимая ширина — это не ширина лёжа (штанина круглая: лёжа шире видимой в ~1.5 раза, пояс — в ~1.3),
  // а пояс часто срезан кадром или закрыт кофтой, и масштаб «по поясу» раздувал бёдра (скинни Colin's — галифе).
  // Бёдра — по фигуре + свобода по виду и названию, ширина штанины у шага — от них, форма книзу — по фото
  let hipW = 0;
  if (sh.worn && !cm.hip && !cm.knee && !Array.isArray(cm.leg)) {
    const nm = (item.name || '').toLowerCase(), ease = /скинни|skinny|super slim|облега|узк/.test(nm) ? 0.006 : /slim|зауж/.test(nm) ? 0.015 : /широк|палаццо|wide|багги|baggy|бочк|клёш|клеш|свобод|оверсайз|карго/.test(nm) ? 0.06 : k === 'jeans' ? 0.025 : 0.04;
    hipW = (d.b.hips || 96) / 200 + ease; const f = hipW * 0.55 / lw[0]; lw = lw.map(v => v * f);
    for (let i = 1; i < lw.length; i++) lw[i] = Math.min(lw[i], lw[0] * (ease >= 0.06 ? 1.6 : 1.15));
  }
  // бёдра (полуобхват): по таблице или по фото (середина посадки; ниже на фото лёжа уже расходятся штанины)
  const hip = cm.hip ? cm.hip / 100 : hipW || (sh.hip && sh.hip.length > 3 ? sh.hip[3] * kk : 0);
  return {yW, yC, yHem, legLen, stack, lw, kk, ww: kW, T, hip};
}
// насколько вещь раздвигает руки (широкая вещь — руки лежат на ней, а не протыкают)
// юбка: пояс, длина и ширина лёжа по высоте (y — от пояса вниз). Профиль с фото лёжа — это и есть ширина лёжа; с фото на модели
// спереди видно ≈ диаметр — книзу (круглое сечение) ширина лёжа больше видимой (до ×1.16); книзу не сужается (скруглённый край фото)
export function skirtProf(item, d) {
  const H = d.H, sp = bottomSpec(item, d), cm = itemCm(item, d.b), sh = item.shape || {};
  // пояс юбки — там, где тело в него помещается: на постоянной высоте 0.595H у женской фигуры тело уже шире пояса по таблице
  // (талия — на 0.625H), и пояс растягивался (юбка-шорты: 41 см при 38.3 по таблице); выше талии не поднимаем
  let yW = Math.max(sp.yW, 0.585 * H); const bodyHalfAt = y => { const ab = bodyAB(d, y / H); return ellP(ab.a, ab.b) / 2; };
  if (cm.waist) while (yW < 0.625 * H && bodyHalfAt(yW) + 0.006 > cm.waist / 100) yW += 0.002 * H;
  const WW = Math.max(sp.ww, bodyHalfAt(yW) + 0.01);
  const sHemS = sh.pose_len && sh.pose_len.hem != null ? sh.pose_len.hem : hemByName(item), LpS = sHemS != null && !(typeof window !== 'undefined' && window.__noPoseLen) ? yW - poseY(sHemS, H) : 0;
  const Lk = cm.len ? cm.len / 100 : sh.len_photo && sh.len_photo > 25 && sh.len_photo < 125 ? sh.len_photo / 100 : LpS > 0.25 && LpS < 1.2 ? LpS : (LEN0.skirt) * Math.pow(H / 1.8, 0.6), HPb = ellP(bodyAB(d, 0.53).a, bodyAB(d, 0.53).b) / 2 + 0.03;
  let prof = sh.hip && sh.hip.length ? sh.hip.slice() : [1, 1.15, 1.2]; for (let i = 1; i < prof.length; i++) prof[i] = Math.max(prof[i], prof[i - 1]);
  if (sh.worn) prof = prof.map((v, i) => v * (1 + 0.16 * i / Math.max(1, prof.length - 1)));
  const kk = WW / (prof[0] || 1);
  // фото на модели (пояс закрыт кофтой или руками) или профиль с невозможным расширением: верхняя строка фото занижена,
  // и «бёдра в 2.5 раза шире пояса» раздували юбку зонтиком. Тогда до бёдер — от пояса к бёдрам фигуры (или по таблице),
  // ниже — только расширение от бёдер по фото (не больше ×1.9) или ширина низа по таблице
  const robust = sh.worn || Math.max(...prof) > 2.1 || cm.hip || cm.hem;
  const tH = Math.min(0.85, 0.1 * H / Lk), hipW = Math.max(HPb, cm.hip ? cm.hip / 100 : 0), pH = interp(prof, tH) || 1;
  const hemW = cm.hem ? Math.max(hipW, cm.hem / 100) : 0;
  const rawP0 = sh.hip && sh.hip.length >= 6 && !(typeof window !== 'undefined' && window.__noMermaid) ? sh.hip : null, pHr = rawP0 ? interp(rawP0, tH) : 0, pEr = rawP0 ? Math.max(...rawP0.slice(-3)) : 0;
  const rawP = rawP0 && hemW && pEr > pHr * 1.15 ? rawP0 : null;
  const flare = t => { const f = clamp(interp(prof, t) / pH, 1, 1.9); if (!hemW) return hipW * f;
    // форма — с фото (юбка-русалка: у колена уже бёдер, книзу клёш), размеры — по таблице (бёдра и низ). Раньше между бёдрами
    // и низом по таблице шла прямая — русалка выходила трапецией
    if (rawP) { const ur = tt => (interp(rawP, tt) - pHr) / (pEr - pHr); let u = ur(t); if (t > 0.8) u = Math.max(u, ur(0.8)); if (t > 0.92) u = Math.max(u, 1 - (1 - u) * (1 - (t - 0.92) / 0.08));
      return hipW + (hemW - hipW) * clamp(u, -0.25, 1); }
    const u = (t - tH) / Math.max(0.05, 1 - tH); return hipW + (hemW - hipW) * clamp(u, 0, 1); };
  const wvis = y => { const t = y / Lk, yw = (yW - y) / H, ab = bodyAB(d, Math.max(0.5, yw)); const body = yw > 0.47 ? ellP(ab.a, ab.b) / 2 + 0.012 : HPb;
    if (robust) return Math.max(t < tH ? WW + (hipW - WW) * smooth(t / tH) : flare(t), body);
    return Math.max(interp(prof, t) * kk, body, t > 0.25 ? HPb : 0); };
  return {yW, WW, Lk, wvis};
}
export function armSpread(items, d) {
  let th = 0.13; const j = armJ({...d, armA: 0.13});
  items.forEach(it => {
    if (!it.tex || !it.shape) return;
    const tops = TOPK.has(it.kind);
    const ys = it.kind === 'dress' ? [0.7, 0.64, 0.58, 0.53, 0.49] : tops ? [0.7, 0.64, 0.58] : it.kind === 'skirt' ? [0.55, 0.5, 0.46, 0.42] : [0.55, 0.5];
    let sp = null; if (tops) sp = topSpec(it, d); else sp = bottomSpec(it, d);
    ys.forEach(yf => {
      const y = yf * d.H; let a;
      if (tops) { if (y < sp.yHem) return; a = solve(x => ellP(x, x * 0.66), 0.01, 1.2, 2 * sp.F(y)); }
      else { const bw = bodyAB(d, yf); a = bw.a + 0.02;
        // расклешённая юбка: кисти — снаружи конуса юбки (ширина лёжа / π, сечение чуть шире по бокам)
        if (it.kind === 'skirt') { const sk = skirtProf(it, d), yy = sk.yW - y; if (yy > 0 && yy <= sk.Lk) a = Math.max(a, sk.wvis(yy) / Math.PI * 1.12 + 0.01); } }
      // утеплитель (FABRIC.puffer.margin 2.8 см) утолщает в расчёте и бок, и руку: руки отводим на обе толщины, иначе рукав
      // зажат между боком и рукой и уезжает вверх к локтю
      const mg = it.kind === 'puffer' ? 0.028 : it.kind === 'vest' && it.puffer ? 0.012 : 0;
      const dy = j.y - y, need = a + armRad(d, dy / j.L) * 1.0 + 0.004 + (it.kind === 'puffer' ? 2 * mg : mg);
      th = Math.max(th, Math.atan((need - j.x) / dy));
    });
  });
  return clamp(th, 0.13, items.some(i => i.kind === 'skirt') ? 0.32 : 0.22);
}
