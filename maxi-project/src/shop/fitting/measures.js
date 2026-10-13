// Мерки верха для выкройки: ширина, длина, плечи, пройма, рукав.
import {armX} from './body.js';
import {armJ} from './geometry.js';
import {FABRIC} from './pattern.js';
import {itemCm} from './sizes.js';
import {topSpec} from './specs.js';
import {fit} from './state.js';

// мерки верха (м): ширина лёжа W, длина L, плечи S, пройма AD, рукав SL/SO, горловина (у стойки вырез спереди неглубокий:
// стойка — ровное кольцо у шеи, при глубине 6 см она тянула вырез вверх, ткань у середины переда растягивалась вдвое)
export function topMeasures(item, d) {
  const sp = topSpec(item, d), sh = item.shape || {}, k = item.kind, cm = itemCm(item, d.b);
  // рукава: у платья — по фото (длинные, короткие или без рукавов), у остальных — по виду вещи
  const long = k === 'dress' ? (sh.sl_len || 0) > 0.45 : k !== 'tee', noSleeve = k === 'dress' && sh.sl_len != null && sh.sl_len < 0.06;
  // вещь меньше тела не наденется: не уже груди + 1.5 см (трикотаж тянется и садится по фигуре — +0.8 см; «мало» честно пишет подсказка размера).
  // Калибровка: футболка Zolla L лёжа 54 см (рулетка) при груди 110 — на фигуре в обтяжку, а не свободная
  // утеплитель (пуховик) съедает ширину: толщина m по кругу — это π·m от ширины лёжа; это не «оверсайз», плечо не спускаем
  const ins = Math.PI * ((FABRIC[k] && FABRIC[k].margin) || 0);
  const knit = k === 'tee' || k === 'sweater' || k === 'hoodie', bodyHalf = d.b.chest / 200, W = Math.max(sp.Fs[1], bodyHalf + (knit ? 0.008 : 0.015) + ins), L = sp.L, loose = Math.max(0, W - bodyHalf - 0.03 - ins);
  const S = cm.shoulder ? cm.shoulder / 100 : Math.min(W * 1.02, W * 0.84 + loose * 0.9);            // оверсайз — спущенное плечо
  const AD = Math.min(0.34, 0.215 + loose * 0.6) * Math.pow(d.H / 1.8, 0.5);
  const SL = cm.sleeve ? cm.sleeve / 100 : long ? armJ(d).L * 0.98 + 0.03 - (S / 2 - armX(d)) : Math.max(0.16, Math.min(0.3, (sh.sl_len ? sh.sl_len * L * 0.6 : 0.2) + loose * 0.4));
  const SO = long ? (k === 'jacket' || k === 'coat' ? 0.15 : k === 'puffer' ? 0.17 : 0.11) : Math.max(0.15, 0.17 + loose * 0.5);
  const HW = sp.Fs[sp.Fs.length - 3] || W;
  return {W, L, S, AD, SL, SO, HW: long && (k === 'sweater' || k === 'hoodie') ? Math.max(bodyHalf * 1.02, W * 0.86) : Math.max(HW, W * 0.95), NW: 0.155 * Math.pow(d.H / 1.8, 0.5), ND: item.stand ? 0.03 : item.collar ? 0.035 : 0.06, NDb: 0.018, sp, noSleeve};
}
// пояс надетых брюк (для заправленного верха); сбрасывается при каждой сборке образа
fit.BOT_YW = 0;
