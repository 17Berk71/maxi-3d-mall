// anim.mjs NAME '["id1","id2"]' — надеть с анимацией и снять кадры → shots/anim_NAME_###.png
// STEP=4 (каждый какой кадр) · K0, KEND — диапазон · KS=0,10,20 — список кадров · VW/VH — размер страницы · DPR
// ROT=0.5, Z=0.6, ZH=0.5 — вид · BODY=m|f|JSON (по умолчанию f) · WAIT=500 мс на кадр
import {browser, bodyFromEnv, URL0, ensureShots} from './common.mjs';
const name = process.argv[2], prods = JSON.parse(process.argv[3] || '[]'), STEP = +(process.env.STEP || 4), dir = ensureShots();
const b = await browser(), pg = await b.newPage({viewport: {width: +(process.env.VW || 620), height: +(process.env.VH || 920)}, deviceScaleFactor: +(process.env.DPR || 1)}); pg.setDefaultTimeout(300000);
pg.on('pageerror', e => console.log('PAGEERR', e.message));
await pg.goto(URL0 + (process.env.PAGE || 'index.html'));
const t0 = Date.now();
const nf = await pg.evaluate(async ([prods, body, rot, z, h]) => { localStorage.clear(); Object.assign(PREFS.body, body); await FIT.addPack('wardrobe/'); FIT.setAnim(true); FIT.open(); FIT.setRot(rot); FIT.setZoom(z, h);
  FIT.wear(prods.map(p => 'w-' + p), {}); await FIT.ready(); await new Promise(r => setTimeout(r, 200)); await FIT.ready(); return FIT._frame(0);
}, [prods, bodyFromEnv('f'), +(process.env.ROT || 0.5), +(process.env.Z || 0.6), +(process.env.ZH || 0.5)]);
console.log('расчёт', ((Date.now() - t0) / 1000).toFixed(1), 'с, кадров', nf);
const bb = await pg.locator('#fitC').boundingBox(), ks = process.env.KS ? process.env.KS.split(',').map(Number) : [];
if (!ks.length) for (let k = +(process.env.K0 || 0); k < +(process.env.KEND || nf - 1); k += STEP) ks.push(k);
for (const k of ks) { await pg.evaluate(k => FIT._frame(k), k); await pg.waitForTimeout(+(process.env.WAIT || 500)); await pg.screenshot({path: `${dir}/anim_${name}_${String(k).padStart(3, '0')}.png`, clip: bb}); }
console.log('кадров снято', ks.length);
await b.close();
