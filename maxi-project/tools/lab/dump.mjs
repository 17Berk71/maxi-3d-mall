// dump.mjs id 'выражение' — посчитать выражение по расчёту ткани вещи: C — выкройка (meshes, seams, E — связи [i, j, длина, вид]…),
// P — точки ткани после расчёта (x, y, z подряд). Пример: node dump.mjs sk-pleat "C.seams.length + ' швов'". BODY=m|f|JSON (по умолчанию m)
import {browser, bodyFromEnv, URL0} from './common.mjs';
const b = await browser(), pg = await b.newPage({viewport: {width: 420, height: 620}}); pg.setDefaultTimeout(300000);
pg.on('pageerror', e => console.log('PAGEERR', e.message));
await pg.goto(URL0 + (process.env.PAGE || 'index.html'));
console.log(await pg.evaluate(async ([id, expr, body]) => { localStorage.clear(); window.__dbgC = []; Object.assign(PREFS.body, body); await FIT.addPack('wardrobe/'); FIT.setAnim(false); FIT.open();
  FIT.wear(['w-' + id], {}); await FIT.ready(); await new Promise(r => setTimeout(r, 200)); await FIT.ready();
  const {C, P} = window.__dbgC[window.__dbgC.length - 1]; return String(eval(expr)); }, [process.argv[2], process.argv[3], bodyFromEnv('m')]));
await b.close();
