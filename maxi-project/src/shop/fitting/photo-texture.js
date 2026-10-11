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
export function photoTex(url) {
  if (!url) return null;
  if (!PTEX[url]) { const t = new THREE.Texture(); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; PTEX[url] = t;
    const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { t.image = typeof window !== 'undefined' && window.__noDelight ? im : delight(im); t.needsUpdate = true; }; im.src = url; }
  return PTEX[url];
}
