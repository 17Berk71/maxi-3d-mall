// Текстуры с фото вещи: загрузка и снятие своей светотени снимка (delight).
import * as THREE from 'three';

// ---------- вещь из фото («фабрика», tools/wardrobe/build.py) ----------
// Текстуры выпрямлены по строкам: левый край текстуры — левый край вещи на фото, правый — правый, верх — горловина или пояс.
// Поэтому на шаблоне перед берётся из фото спереди, спина — из фото сзади, а боковые швы приходятся на края фото.
// Мерки (длина к ширине, длина рукава, шаг, ширина штанины) подгоняют шаблон под эту вещь.
export const PTEX = {};
if (typeof window !== 'undefined') window.__ptex = PTEX;   // отладка: обработанные текстуры фото
// Фото без своей светотени: на снимке вещь освещена неровно (бок темнее, тень от руки, блик) — в 3D это пятна,
// потому что складки и свет у нас свои. Крупная светотень оценивается только по пикселям цвета самой ткани
// (принт и пуговицы не в счёт) и делится; мелкий рисунок, принт и фактура остаются.
function delight(img) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height; if (!w || !h) return img;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  let D; try { D = g.getImageData(0, 0, w, h); } catch (e) { return img; }
  const a = D.data, n = w * h, L = new Float32Array(n);
  // основной цвет ткани — медиана по непрозрачным пикселям (по 4096 точкам)
  const sr = [], sg = [], sb = []; for (let k = 0; k < 4096; k++) { const i = ((k * 2654435761) >>> 0) % n; if (a[i * 4 + 3] < 200) continue; sr.push(a[i * 4]); sg.push(a[i * 4 + 1]); sb.push(a[i * 4 + 2]); }
  if (sr.length < 200) return img;
  const med = v => { v.sort((x, y) => x - y); return v[v.length >> 1]; }, R0 = med(sr) + 1, G0 = med(sg) + 1, B0 = med(sb) + 1, L0 = (R0 + G0 + B0) / 3;
  const GW = 32, GH = Math.max(8, Math.round(32 * h / w)), SW = new Float32Array(GW * GH), SL = new Float32Array(GW * GH);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, q = i * 4; if (a[q + 3] < 200) continue; const r = a[q] + 1, gg = a[q + 1] + 1, b = a[q + 2] + 1, l = (r + gg + b) / 3, k = l / L0;
    L[i] = k; if (k < 0.35 || k > 2.6) continue;
    const dc = Math.abs(r / l - R0 / L0) + Math.abs(gg / l - G0 / L0) + Math.abs(b / l - B0 / L0); if (dc > 0.35) continue;
    const c = Math.min(GW - 1, Math.floor(x / w * GW)) + Math.min(GH - 1, Math.floor(y / h * GH)) * GW, wt = 1 - dc / 0.35; SW[c] += wt; SL[c] += wt * k; }
  // размытие с весами (пустые клетки — по соседям)
  for (let pass = 0; pass < 3; pass++) { const W2 = SW.slice(), L2 = SL.slice();
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { let sw = 0, sl = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue; const kk = dx || dy ? 0.6 : 1; sw += W2[yy * GW + xx] * kk; sl += L2[yy * GW + xx] * kk; }
      SW[y * GW + x] = sw; SL[y * GW + x] = sl; } }
  const S = new Float32Array(GW * GH); for (let c = 0; c < S.length; c++) S[c] = SW[c] > 1e-3 ? SL[c] / SW[c] : 1;
  for (let y = 0; y < h; y++) { const fy = Math.min(GH - 1.001, Math.max(0, (y + 0.5) / h * GH - 0.5)), y0 = Math.floor(fy), ty = fy - y0;
    for (let x = 0; x < w; x++) { const q = (y * w + x) * 4; if (a[q + 3] < 8) continue; const fx = Math.min(GW - 1.001, Math.max(0, (x + 0.5) / w * GW - 0.5)), x0 = Math.floor(fx), tx = fx - x0;
      const s = (S[y0 * GW + x0] * (1 - tx) + S[y0 * GW + x0 + 1] * tx) * (1 - ty) + (S[(y0 + 1) * GW + x0] * (1 - tx) + S[(y0 + 1) * GW + x0 + 1] * tx) * ty;
      const f = Math.max(0.72, Math.min(1.4, Math.pow(1 / Math.max(0.2, s), 0.85)));
      a[q] = Math.min(255, a[q] * f); a[q + 1] = Math.min(255, a[q + 1] * f); a[q + 2] = Math.min(255, a[q + 2] * f); } }
  // прозрачные пиксели (фон за краем вещи) — цветом ткани: у края детали и в мипмапах не проступает чёрная кайма
  // (холст хранит цвет умноженным на прозрачность — пиксель делаем непрозрачным; прозрачность фото нигде не используется)
  for (let i = 0; i < n; i++) { const q = i * 4; if (a[q + 3] >= 128) continue; a[q] = R0 - 1; a[q + 1] = G0 - 1; a[q + 2] = B0 - 1; a[q + 3] = 255; }
  g.putImageData(D, 0, 0); return cv;
}
// flat — ровная ткань: складки, тени и блики с фото убираются совсем (остаются нити и мелкая фактура). Для вещей,
// у которых рельеф строится формой (плиссе): иначе нарисованные складки поверх настоящих — «смятая» юбка
// Точнее (вторая версия, по умолчанию): светотень снимка = плавная часть яркости. Перепады яркости между соседними
// пикселями делятся на «свет» (мягкие, тот же цвет — складка, тень, блик) и «рисунок» (резкие или со сменой цвета — принт,
// шов, пуговица, край вставки). Из мягких перепадов собирается карта света (уравнение Пуассона, 256 px по большей стороне),
// размывается на ~1% ширины (фактура нитей остаётся в фото) и делится. Тени складок уходят, принт и фактура остаются.
// Заодно — рельеф: средние по размеру складки той же карты света (без самых крупных пятен) → наклоны → карта рельефа
// (R, G — наклон по u, v; B — высота): в 3D мелкие заломы со снимка освещаются нашим светом и движутся при повороте.
export const PREL = {};
// пока снимок грузится — ровный рельеф (наклон 0)
let FLATR = null; function flatRelief() { if (!FLATR) { FLATR = document.createElement('canvas'); FLATR.width = FLATR.height = 2; const g = FLATR.getContext('2d'); g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, 2, 2); } return FLATR; }
function delight2(img) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height; if (!w || !h) return null;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  let D; try { D = g.getImageData(0, 0, w, h); } catch (e) { return null; }
  const a = D.data, n = w * h;
  // основной цвет ткани — медиана по непрозрачным
  const sr = [], sg = [], sb = []; for (let k = 0; k < 4096; k++) { const i = ((k * 2654435761) >>> 0) % n; if (a[i * 4 + 3] < 200) continue; sr.push(a[i * 4]); sg.push(a[i * 4 + 1]); sb.push(a[i * 4 + 2]); }
  if (sr.length < 200) return null;
  const med = v => { v.sort((x, y) => x - y); return v[v.length >> 1]; }, R0 = med(sr), G0 = med(sg), B0 = med(sb);
  // рабочее разрешение
  const sc = Math.min(1, 256 / Math.max(w, h)), W = Math.max(8, Math.round(w * sc)), Hh = Math.max(8, Math.round(h * sc)), N = W * Hh;
  const LL = new Float32Array(N), CR = new Float32Array(N), CG = new Float32Array(N), M = new Uint8Array(N), cnt = new Float32Array(N), sR = new Float32Array(N), sG = new Float32Array(N), sB = new Float32Array(N);
  for (let y = 0; y < h; y++) { const yy = Math.min(Hh - 1, Math.floor(y * sc)); for (let x = 0; x < w; x++) { const q = (y * w + x) * 4; if (a[q + 3] < 200) continue; const i = yy * W + Math.min(W - 1, Math.floor(x * sc)); sR[i] += a[q]; sG[i] += a[q + 1]; sB[i] += a[q + 2]; cnt[i]++; } }
  for (let i = 0; i < N; i++) { if (cnt[i] < 1) continue; const r = sR[i] / cnt[i] + 2, gg = sG[i] / cnt[i] + 2, b = sB[i] / cnt[i] + 2, l = (r + gg + b) / 3; M[i] = 1; LL[i] = Math.log(l); CR[i] = r / l; CG[i] = gg / l; }
  // мягкие перепады (свет): не больше 0.12 за пиксель и без смены цвета; остальное — рисунок (0)
  // перепады — по чуть размытой яркости (σ ≈ 1 px): контрастная фактура (деним, вязка) не должна выглядеть «резким краем»
  const LB = new Float32Array(N); for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!M[i]) continue; let s_ = 0, ww = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= Hh) continue; const j = yy * W + xx; if (!M[j]) continue; const k = dx || dy ? (dx && dy ? 0.37 : 0.6) : 1; s_ += LL[j] * k; ww += k; } LB[i] = s_ / ww; }
  const GX = new Float32Array(N), GY = new Float32Array(N), soft = (i, j) => { if (!M[i] || !M[j]) return 0; const d = LB[j] - LB[i], dc = Math.abs(CR[j] - CR[i]) + Math.abs(CG[j] - CG[i]); return Math.abs(d) < 0.12 && dc < 0.07 ? d : 0; };
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (x < W - 1) GX[i] = soft(i, i + 1); if (y < Hh - 1) GY[i] = soft(i, i + W); }
  // уравнение Пуассона (Гаусс–Зейдель с перерелаксацией), граница маски — свободная
  const S = new Float32Array(N); for (let i = 0; i < N; i++) S[i] = M[i] ? LL[i] : 0;
  { let m0 = 0, c0 = 0; for (let i = 0; i < N; i++) if (M[i]) { m0 += LL[i]; c0++; } m0 /= c0; for (let i = 0; i < N; i++) S[i] = m0; }
  for (let it = 0; it < 400; it++) for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!M[i]) continue; let s_ = 0, k = 0;
    if (x > 0 && M[i - 1]) { s_ += S[i - 1] + GX[i - 1]; k++; } if (x < W - 1 && M[i + 1]) { s_ += S[i + 1] - GX[i]; k++; }
    if (y > 0 && M[i - W]) { s_ += S[i - W] + GY[i - W]; k++; } if (y < Hh - 1 && M[i + W]) { s_ += S[i + W] - GY[i]; k++; }
    if (k) S[i] += 1.93 * (s_ / k - S[i]); }
  // размытие по маске (нормированное): σ1 — карта света без фактуры, σ2 — самые крупные пятна (для рельефа их убираем)
  const blurM = (src, r) => { const t = new Float32Array(N), tw = new Float32Array(N), o = new Float32Array(N), ow = new Float32Array(N);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { let s_ = 0, ww = 0; for (let d = -r; d <= r; d++) { const xx = x + d; if (xx < 0 || xx >= W) continue; const j = y * W + xx; if (!M[j]) continue; const k = Math.exp(-d * d / (2 * r * r / 4)); s_ += src[j] * k; ww += k; } t[y * W + x] = s_; tw[y * W + x] = ww; }
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { let s_ = 0, ww = 0; for (let d = -r; d <= r; d++) { const yy = y + d; if (yy < 0 || yy >= Hh) continue; const j = yy * W + x, k = Math.exp(-d * d / (2 * r * r / 4)); s_ += t[j] * k; ww += tw[j] * k; } o[y * W + x] = ww > 1e-6 ? s_ / ww : 0; ow[y * W + x] = ww; }
    return o; };
  const r1 = Math.max(2, Math.round(Math.max(W, Hh) * (typeof window !== 'undefined' && window.__dlR || 0.008))), S1 = blurM(S, r1), S2 = blurM(S, Math.max(6, Math.round(Math.max(W, Hh) * 0.08)));
  let mean = 0, c0 = 0; for (let i = 0; i < N; i++) if (M[i]) { mean += S1[i]; c0++; } mean /= c0;
  const F = new Float32Array(N); for (let i = 0; i < N; i++) F[i] = M[i] ? Math.max(0.6, Math.min(1.7, Math.exp(-(S1[i] - mean) * 0.9))) : 1;
  if (typeof window !== 'undefined' && window.__dlDbg) { let f0 = 9, f1 = 0, s0 = 9, s1 = -9, l0 = 9, l1 = -9; for (let i = 0; i < N; i++) if (M[i]) { f0 = Math.min(f0, F[i]); f1 = Math.max(f1, F[i]); s0 = Math.min(s0, S1[i]); s1 = Math.max(s1, S1[i]); l0 = Math.min(l0, LL[i]); l1 = Math.max(l1, LL[i]); } let sd = 0; for (let i = 0; i < N; i++) if (M[i]) sd += (S1[i] - mean) ** 2; sd = Math.sqrt(sd / c0); (window.__dlStats = window.__dlStats || []).push({W, Hh, f0, f1, sd, l0, l1, mean}); }
  // поправка — на полное разрешение (билинейно)
  const at = (A_, fx, fy) => { fx = Math.max(0, Math.min(W - 1.001, fx)); fy = Math.max(0, Math.min(Hh - 1.001, fy)); const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0; return (A_[y0 * W + x0] * (1 - tx) + A_[y0 * W + x0 + 1] * tx) * (1 - ty) + (A_[(y0 + 1) * W + x0] * (1 - tx) + A_[(y0 + 1) * W + x0 + 1] * tx) * ty; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = (y * w + x) * 4; if (a[q + 3] < 8) continue; const f = at(F, (x + 0.5) * sc - 0.5, (y + 0.5) * sc - 0.5); a[q] = Math.min(255, a[q] * f); a[q + 1] = Math.min(255, a[q + 1] * f); a[q + 2] = Math.min(255, a[q + 2] * f); }
  for (let i = 0; i < n; i++) { const q = i * 4; if (a[q + 3] >= 128) continue; a[q] = R0; a[q + 1] = G0; a[q + 2] = B0; a[q + 3] = 255; }
  g.putImageData(D, 0, 0);
  // рельеф: высота = (S1 − S2) (средние складки; светлое — выпуклое), наклоны по пикселям рабочей сетки
  const rc = document.createElement('canvas'); rc.width = W; rc.height = Hh; const rg = rc.getContext('2d'), RD = rg.createImageData(W, Hh), HT = new Float32Array(N);
  for (let i = 0; i < N; i++) HT[i] = M[i] ? Math.max(-0.5, Math.min(0.5, S1[i] - S2[i])) : 0;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const i = y * W + x, q = i * 4, hx = (HT[y * W + Math.min(W - 1, x + 1)] - HT[y * W + Math.max(0, x - 1)]) / 2, hy = (HT[Math.min(Hh - 1, y + 1) * W + x] - HT[Math.max(0, y - 1) * W + x]) / 2;
    RD.data[q] = Math.max(0, Math.min(255, 128 + hx * W * 2)); RD.data[q + 1] = Math.max(0, Math.min(255, 128 + hy * Hh * 2));   /* наклон на единицу координаты фото ×2 */ RD.data[q + 2] = 128 + HT[i] * 255; RD.data[q + 3] = 255; }
  rg.putImageData(RD, 0, 0);
  return {img: cv, relief: rc, res: W};
}
// мелкая фактура: высота — лог. яркость минус её размытие (~2 px при ≤ 768 px), наклоны на единицу координаты фото
// хранятся как (наклон / разрешение) × 127.5 × 4 + 128; в шейдере ×(2 × amp) → наклон на единицу uv × amp / (2 × res) … т.е. amp ≈ доля рельефа
export const PDET = {};
function detailRelief(img) {
  const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height; if (!w0 || !h0) return null;
  const sc = Math.min(1, 768 / Math.max(w0, h0)), w = Math.max(8, Math.round(w0 * sc)), h = Math.max(8, Math.round(h0 * sc));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.drawImage(img, 0, 0, w, h);
  let D; try { D = g.getImageData(0, 0, w, h); } catch (e) { return null; }
  const a = D.data, n = w * h, L = new Float32Array(n), M = new Uint8Array(n);
  for (let i = 0; i < n; i++) { L[i] = Math.log((a[i * 4] + a[i * 4 + 1] + a[i * 4 + 2]) / 3 + 4); M[i] = a[i * 4 + 3] > 128 ? 1 : 0; }
  const box = (src, r) => { const t = new Float32Array(n), o = new Float32Array(n);
    for (let y = 0; y < h; y++) { let s = 0, c = 0; for (let x = -r; x < w; x++) { if (x + r < w) { s += src[y * w + x + r]; c++; } if (x - r - 1 >= 0) { s -= src[y * w + x - r - 1]; c--; } if (x >= 0) t[y * w + x] = s / c; } }
    for (let x = 0; x < w; x++) { let s = 0, c = 0; for (let y = -r; y < h; y++) { if (y + r < h) { s += t[(y + r) * w + x]; c++; } if (y - r - 1 >= 0) { s -= t[(y - r - 1) * w + x]; c--; } if (y >= 0) o[y * w + x] = s / c; } }
    return o; };
  const B = box(box(L, 2), 2), Hh = new Float32Array(n);
  for (let i = 0; i < n; i++) Hh[i] = M[i] ? Math.max(-0.25, Math.min(0.25, L[i] - B[i])) : 0;
  const out = g.createImageData(w, h), o = out.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, q = i * 4;
    const hx = (Hh[y * w + Math.min(w - 1, x + 1)] - Hh[y * w + Math.max(0, x - 1)]) / 2, hy = (Hh[Math.min(h - 1, y + 1) * w + x] - Hh[Math.max(0, y - 1) * w + x]) / 2;
    o[q] = Math.max(0, Math.min(255, 128 + hx * 4 * 127.5)); o[q + 1] = Math.max(0, Math.min(255, 128 + hy * 4 * 127.5)); o[q + 2] = 128; o[q + 3] = 255; }
  g.putImageData(out, 0, 0); return cv;
}
export function photoTex(url, flat) {
  if (!url) return null;
  const key = flat ? url + '|' + (flat === true ? 'flat' : flat) : url;   // flat: true — ровная ткань (плиссе), 'gentle' — рисунок пятнами (мягкое снятие света)
  if (!PTEX[key]) { const t = new THREE.Texture(); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; PTEX[key] = t; const rt = new THREE.Texture(flatRelief()); rt.needsUpdate = true; PREL[key] = rt; t.relief = rt; const dt = new THREE.Texture(flatRelief()); dt.needsUpdate = true; dt.anisotropy = 8; PDET[key] = dt; t.detail = dt;   // у Texture в r128 нет userData
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { const W_ = typeof window !== 'undefined' ? window : {}; let r = im, rel = null;
      if (!W_.__noDelight) { const o = !W_.__delight1 && flat !== 'gentle' && delight2(im); if (o) { r = o.img; rel = o.relief; } else r = delight(im); }
      if (flat === true) { r = flatten(r); rel = null; }
      t.image = r; t.needsUpdate = true; if (rel && !W_.__noRelief2) { rt.image = rel; rt.needsUpdate = true; }
      if (flat !== true && !W_.__noDetail) { const dr = detailRelief(im); if (dr) { dt.image = dr; dt.needsUpdate = true; } } }; im.src = url; }
  return PTEX[key];
}
// ровная ткань: основной цвет × чуть-чуть мелкой фактуры (отношение яркости к размытой в ~4 px), без светотени и линий сгибов
function flatten(img) {
  const w = img.width, h = img.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  let D; try { D = g.getImageData(0, 0, w, h); } catch (e) { return img; }
  const a = D.data, n = w * h, L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = (a[i * 4] + a[i * 4 + 1] + a[i * 4 + 2]) / 3 + 1;
  const sr = [], sg = [], sb = []; for (let k = 0; k < 4096; k++) { const i = ((k * 2654435761) >>> 0) % n; sr.push(a[i * 4]); sg.push(a[i * 4 + 1]); sb.push(a[i * 4 + 2]); }
  const med = v => { v.sort((x, y) => x - y); return v[v.length >> 1]; }, R0 = med(sr), G0 = med(sg), B0 = med(sb);
  const blur = (src, rad) => { const t = new Float32Array(n), o = new Float32Array(n);
    for (let y = 0; y < h; y++) { let s = 0, c = 0; for (let x = -rad; x < w; x++) { if (x + rad < w) { s += src[y * w + x + rad]; c++; } if (x - rad - 1 >= 0) { s -= src[y * w + x - rad - 1]; c--; } if (x >= 0) t[y * w + x] = s / c; } }
    for (let x = 0; x < w; x++) { let s = 0, c = 0; for (let y = -rad; y < h; y++) { if (y + rad < h) { s += t[(y + rad) * w + x]; c++; } if (y - rad - 1 >= 0) { s -= t[(y - rad - 1) * w + x]; c--; } if (y >= 0) o[y * w + x] = s / c; } }
    return o; };
  const B = blur(L, 4);
  for (let i = 0; i < n; i++) { const k = Math.max(0.93, Math.min(1.07, Math.pow(L[i] / B[i], 0.35)));   /* слабо: линии сгибов с фото не должны читаться как складки — их дают форма и шейдер ткани */ a[i * 4] = Math.min(255, R0 * k); a[i * 4 + 1] = Math.min(255, G0 * k); a[i * 4 + 2] = Math.min(255, B0 * k); a[i * 4 + 3] = 255; }
  g.putImageData(D, 0, 0); return cv;
}
