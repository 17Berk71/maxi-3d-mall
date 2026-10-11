// qc.mjs id1,id2,… — быстрая автопроверка посадки списка вещей гардероба (без снимков): «id балл [что не прошло]».
// BODY=m|f|JSON (по умолчанию m) · PAGE=other.html · X=__flag1,__flag2 — выставить window-флаги (отладочные переключатели)
import {browser, bodyFromEnv, URL0} from './common.mjs';
const ids = (process.argv[2] || '').split(',').filter(Boolean); if (!ids.length) { console.log('qc.mjs id1,id2'); process.exit(1); }
const b = await browser(), pg = await b.newPage({viewport: {width: 300, height: 400}}); pg.setDefaultTimeout(300000);
pg.on('pageerror', e => console.log('PAGEERR', e.message));
await pg.addInitScript(x => { (x || '').split(',').filter(Boolean).forEach(k => { window[k] = 1; }); }, process.env.X || '');
await pg.goto(URL0 + (process.env.PAGE || 'index.html'));
await pg.evaluate(async body => { localStorage.clear(); Object.assign(PREFS.body, body); await FIT.addPack('wardrobe/'); FIT.setAnim(false); FIT.open(); }, bodyFromEnv('m'));
for (const id of ids) console.log(await pg.evaluate(async id => { FIT.wear(['w-' + id], {}); await FIT.ready(); await new Promise(r => setTimeout(r, 200)); await FIT.ready();
  const q = FIT.qc('w-' + id) || {checks: []}; return id + ' ' + q.score + ' ' + JSON.stringify(q.checks.filter(c => !c.ok).map(c => c.name + ':' + c.val)); }, id));
await b.close();
