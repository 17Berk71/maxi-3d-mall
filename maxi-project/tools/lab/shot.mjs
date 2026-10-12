// shot.mjs NAME id1,id2 — надеть вещи гардероба (www/wardrobe = tools/wardrobe/out) и снять кабину → shots/w_NAME_<угол>.png
// Печатает автопроверку каждой вещи (балл, что не прошло) и подсказку посадки.
// Переменные: V=0,0.8,1.57 (углы поворота, рад) · Z=0.6 (приближение) · ZH=0.5 (высота взгляда) · BODY=m|f|JSON (по умолчанию m)
//   HIDE=1 — спрятать тело (видны дыры в ткани) · NR=1 — без рельефа складок · PD=0.013 — глубина плиссе (м)
//   CELL=0.02 — шаг сетки ткани · FAB='{"…"}' — проба параметров ткани · PAGE=other.html — другая сборка (make.mjs OUT=…)
//   X=__flag1,__flag2=0.5 — window-флаги (отладочные переключатели) · DPR=2 — масштаб снимка · PACK=feeds/fit/ — пакеты выгрузки вместо гардероба (id — номер пакета)
import {browser, bodyFromEnv, URL0, ensureShots} from './common.mjs';
const name = process.argv[2], ids = (process.argv[3] || '').split(',').filter(Boolean);
if (!name || !ids.length) { console.log('shot.mjs NAME id1,id2'); process.exit(1); }
const dir = ensureShots(), V = (process.env.V || '0,0.6,1.57').split(',').map(Number);
const b = await browser(), pg = await b.newPage({viewport: {width: 620, height: 920}, deviceScaleFactor: +(process.env.DPR || 2)}); pg.setDefaultTimeout(300000);
pg.on('pageerror', e => console.log('PAGEERR', e.message)); pg.on('console', m => { if (m.text().startsWith('T ')) console.log(m.text()); });
await pg.addInitScript(x => { (x || '').split(',').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); window[k] = v == null ? 1 : +v; }); }, process.env.X || '');   // X=__flag1,__flag2=0.5 — отладочные переключатели
await pg.addInitScript(([h, c, f, n, pd]) => { window.HIDE = h; if (c) window.__cell = c; if (f) window.__fab = JSON.parse(f); window.__noRelief = !!n; if (pd !== '') window.__pd = +pd; },
  [+(process.env.HIDE || 0), +(process.env.CELL || 0), process.env.FAB || '', +(process.env.NR || 0), process.env.PD || '']);
await pg.goto(URL0 + (process.env.PAGE || 'index.html'));
const r = await pg.evaluate(async ([ids, body, pack]) => {
  localStorage.clear(); Object.assign(PREFS.body, body); await FIT.addPack(pack); FIT.setAnim(false); FIT.open();
  const t0 = performance.now(); FIT.wear(ids.map(i => 'w-' + i), {}); await FIT.ready(); console.log('T расчёт ' + (performance.now() - t0).toFixed(0) + ' мс');
  await new Promise(r => setTimeout(r, 300)); await FIT.ready();
  if (window.HIDE) FIT._avatar().traverse(o => { if (o.isMesh && !(o.userData.cm || o.userData.pg || o.userData.lining || o.userData.decor || o.userData.edge || o.userData.collar)) o.visible = false; });
  return ids.map(i => { const q = FIT.qc('w-' + i) || {checks: []}; return i + ' ' + q.score + ' ' + JSON.stringify(q.checks.filter(c => !c.ok).map(c => c.name + ':' + c.val)) + ' | ' + FIT.fitNote('w-' + i); }).join('\n');
}, [ids, bodyFromEnv('m'), process.env.PACK || 'wardrobe/']);
console.log(r); const files = [];
for (const v of V) {
  await pg.evaluate(([v, z, h]) => { FIT.setRot(v); FIT.setZoom(z, h); }, [v, +(process.env.Z || 0.6), +(process.env.ZH || 0.5)]); await pg.waitForTimeout(1200);
  const f = `${dir}/w_${name}_${v}.png`, bb = await pg.locator('#fitC').boundingBox(); await pg.screenshot({path: f, clip: bb}); files.push(f); }
console.log('FILES ' + files.join(','));
await b.close();
