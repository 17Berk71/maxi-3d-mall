// Тело для расчёта ткани (столкновения): туловище, плечи, руки, ноги, нижние слои.
import {armX, sx, sz, torsoR} from './body.js';
import {armJ, armRad} from './geometry.js';

// ---------- симуляция ткани (вариант «В», прототип) ----------
// Плоский силуэт вещи с фото — это её выкройка: перед и спинка, сшитые по краю (кроме горловины, низа, рукавов; у брюк — пояса и низа).
// Выкройку растягиваем до настоящих размеров, ставим один слой перед фигурой, другой за ней, «сшиваем» края и опускаем под тяжестью.
// Ткань: точки и связи (Position Based Dynamics) — не тянется сверх длины, легко сжимается (так и появляются складки), чуть сопротивляется изгибу;
// не проходит сквозь тело, нижние слои и пол. Картинка — само вырезанное фото, без выпрямления.
// пока прототип: на сайте включается адресом ?drape=1 (в лаборатории — всегда)
// ткань по выкройке — основной способ; ?drape=0 — прежние простые формы (для сравнения)
export let DRAPE_ON = !(typeof location !== 'undefined' && /[?&]drape=0/.test(location.search));
export function setDrape(v) { DRAPE_ON = !!v; }
// фигура для столкновений: туловище — эллипсы по высоте, ноги — круги, руки — капсулы, шея и голова, пол
// радиус ноги манекена на высоте yf (как у видимой ноги)
export function legR(d, yf) {
  const legTab = [[0.04, 0.032], [0.07, 0.036], [0.15, 0.056 * d.k], [0.24, 0.047 * d.k], [0.28, 0.05 * d.k], [0.38, d.thigh * 0.86], [0.47, d.thigh], [0.5, d.thigh * 0.98]];
  if (yf > 0.5) return 0; for (let i = 1; i < legTab.length; i++) if (yf <= legTab[i][0]) { const t = (yf - legTab[i - 1][0]) / (legTab[i][0] - legTab[i - 1][0]); return (legTab[i - 1][1] + (legTab[i][1] - legTab[i - 1][1]) * t) * (yf > 0.3 ? 1 : d.s); } return legTab[0][1] * d.s;
}
export function makeCollider(d, under, margin) {
  const H = d.H, N = 400, A = new Float32Array(N), B = new Float32Array(N), LR = new Float32Array(N);
  // нижний слой (пояс брюк, юбка) — ступенька: ткань выше неё не должна сразу прыгать наружу («как под ремнём»).
  // Над ступенькой — пологий скат (как ткань ложится поверх пояса): ширина спадает не быстрее ~0.45 по высоте
  if (under && !under.raw) { const ra = Float32Array.from(under.a), rb = Float32Array.from(under.b), st = 0.45 * H / 100;
    for (let i = 1; i < ra.length; i++) { ra[i] = Math.max(ra[i] || 0, (ra[i - 1] || 0) - st); rb[i] = Math.max(rb[i] || 0, (rb[i - 1] || 0) - st); }
    under = {a: ra, b: rb}; }
  const legAt = yf => legR(d, yf);
  for (let i = 0; i < N; i++) {
    const yf = i / N;
    // туловище без плечевого шара (его ниже — как объёмное тело, иначе ткань соскальзывает с плеч вбок)
    if (yf >= 0.47 && yf <= 0.853) { const r = yf < 0.53 ? Math.max(torsoR(d, Math.max(0.47, yf)), d.hips * (yf < 0.5 ? 0.99 : 0.97)) : torsoR(d, yf); A[i] = r * (sx(d, Math.max(0.6, yf)) * 0.98 + 0.02); B[i] = r * (sz(d, yf) + (yf < 0.6 ? 0.04 : 0)); }
    LR[i] = legAt(yf);
    if (under) { const u = under.a[Math.round(yf * 100)] || 0, uz = under.b[Math.round(yf * 100)] || 0; if (u > A[i]) { A[i] = u; B[i] = Math.max(B[i], uz); } }
  }
  const j = armJ(d); let arms = [];
  // руки можно отвести (анимация примерки): delta — на сколько радиан дальше от тела
  const setArm = delta => { arms = [-1, 1].map(side => ({x0: j.x * side, y0: j.y, dx: Math.sin(j.th + delta) * side, dy: -Math.cos(j.th + delta), L: j.L})); }; setArm(0);
  const m = 0.007 + (margin || 0), hr = 0.098 * d.s, SX = Math.max(d.chest * d.shX * 0.98, armX(d) + 0.02), SY = d.chest * 0.42, SZ = d.chest * 0.62;
  // noArm: точка детали корпуса (не рукава). Рука ниже подмышки её не толкает: рука лежит поверх бока вещи,
  // а не вдавливает его внутрь (иначе широкая вещь у кистей «перетянута ремнём»)
  const push = function (P, i, noArm) {
    let x = P[i], y = P[i + 1], z = P[i + 2], hit = false;
    if (y < 0.004) { y = 0.004; hit = true; }
    const k = Math.max(0, Math.min(N - 1, Math.round(y / H * N)));
    if (A[k] > 0) { const a = A[k] + m, b = B[k] + m, q = (x / a) ** 2 + (z / b) ** 2; if (q < 1) {
      // верх плеч (скат к шее): выталкиваем вверх, на поверхность — иначе ткань соскальзывает по скату вниз и видно тело
      let up = -1; if (k > 0.8 * N) for (let k2 = k + 1; k2 < N && k2 <= k + 8; k2++) { if (!(A[k2] > 0) || (x / (A[k2] + m)) ** 2 + (z / (B[k2] + m)) ** 2 >= 1) { up = k2; break; } }
      // по нормали к эллипсу, а не по радиусу: радиальный толчок на плоском (широком) туловище сдвигает ткань вбок, к бокам
      if (up > 0) y = up / N * H; else { const s = 1 / Math.sqrt(Math.max(q, 1e-6)), sx_ = x * s, sz_ = z * s; let nx = sx_ / (a * a), nz = sz_ / (b * b); const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
        const dd = (sx_ - x) * nx + (sz_ - z) * nz; x += nx * dd; z += nz * dd; if ((x / a) ** 2 + (z / b) ** 2 < 0.999) { x = sx_; z = sz_; } } hit = true; } }
    // бёдра манекена касаются — для ткани оставляем между ними зазор, иначе шаговому шву негде пройти
    if (LR[k] > 0) for (const side of [-1, 1]) { const cx = side * d.legX, r = Math.min(LR[k], d.legX - 0.002) + m, dx = x - cx, dd = Math.hypot(dx, z); if (dd < r) { const s = r / Math.max(dd, 1e-5); x = cx + dx * s; z *= s; hit = true; } }
    { // плечи: эллипсоид, выталкивание по нормали (с верха плеча — вверх)
      const ex = x / (SX + m), ey = (y - 0.8 * H) / (SY + m), ez = z / (SZ + m), q = ex * ex + ey * ey + ez * ez;
      if (q < 1) { // по нормали: радиальный толчок на плоском эллипсоиде плеч стаскивает ткань со ската к руке
        const s = 1 / Math.sqrt(Math.max(q, 1e-6)), A_ = SX + m, B_ = SY + m, C_ = SZ + m, px = x * s, py = (y - 0.8 * H) * s, pz = z * s;
        let nx = px / (A_ * A_), ny = py / (B_ * B_), nz = pz / (C_ * C_); const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        const dd = (px - x) * nx + (py - (y - 0.8 * H)) * ny + (pz - z) * nz; let x2 = x + nx * dd, y2 = y + ny * dd, z2 = z + nz * dd;
        if ((x2 / A_) ** 2 + ((y2 - 0.8 * H) / B_) ** 2 + (z2 / C_) ** 2 < 0.995) { x2 = px; y2 = 0.8 * H + py; z2 = pz; }
        x = x2; y = y2; z = z2; hit = true; } }
    const yf = y / H;
    if (yf > 0.83 && yf < 0.9) { const r = d.neck + m, dd = Math.hypot(x, z); if (dd < r) { const s = r / Math.max(dd, 1e-5); x *= s; z *= s; hit = true; } }
    { const ex = x / (hr * 0.9 + m), ey = (y - 0.93 * H) / (hr * 1.16 + m), ez = z / (hr + m), q = ex * ex + ey * ey + ez * ez; if (q < 1) { const s = 1 / Math.sqrt(q); x *= s; y = 0.93 * H + (y - 0.93 * H) * s; z *= s; hit = true; } }
    // рука — капсула без шара сверху: выше сустава плечо задаёт эллипсоид (как у видимого тела); шар сустава торчал на ~5 см
    // над видимым плечом — ткань ложилась на невидимый бугор, плечи выходили квадратными
    if (!(noArm && y < j.y - 0.07)) for (const a of arms) {
      const tt = (x - a.x0) * a.dx + (y - a.y0) * a.dy; if (tt < -0.01) continue;
      const t = Math.max(0, Math.min(a.L, tt)), px = a.x0 + a.dx * t, py = a.y0 + a.dy * t;
      const dx = x - px, dy = y - py, dd = Math.hypot(dx, dy, z), r = armRad(d, t / a.L) + m;
      if (dd < r) { const s = r / Math.max(dd, 1e-5); x = px + dx * s; y = py + dy * s; z *= s; hit = true; }
    }
    P[i] = x; P[i + 1] = y; P[i + 2] = z; return hit;
  };
  push.setArm = setArm; return push;
}
