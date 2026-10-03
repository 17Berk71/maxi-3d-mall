// Настройки посетителя: чувствительность обзора, качество графики, параметры фигуры для примерочной.
// Хранятся в браузере (localStorage); если хранилище недоступно — работают до перезагрузки.
const KEY = 'maxi-prefs';
export const BODY0 = { sex: 'f', height: 168, chest: 90, waist: 72, hips: 98, build: 0.5, skin: 1 };
export const PREFS = { sens: 1, gfx: 'auto', body: { ...BODY0 } };
try {
  const v = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (v) { if (v.sens) PREFS.sens = v.sens; if (v.gfx) PREFS.gfx = v.gfx; if (v.body) Object.assign(PREFS.body, v.body); }
} catch (e) {}
const subs = [];
export function onPref(fn) { subs.push(fn); }
export function setPref(k, v) {
  if (k === 'body') Object.assign(PREFS.body, v); else PREFS[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(PREFS)); } catch (e) {}
  subs.forEach(f => { try { f(k, PREFS[k]); } catch (e) { console.warn(e); } });
}
