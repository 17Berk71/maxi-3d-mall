// qc.mjs id1,id2,… — быстрая автопроверка посадки списка вещей гардероба (без снимков): «id балл [что не прошло]».
// ALL=1 — все пункты с цифрами (а не только непройденные). BODY=m|f|JSON (по умолчанию m) · PACK=feeds/fit/ — пакеты выгрузки вместо гардероба · PAGE=other.html · X=__flag1,__flag2 — выставить window-флаги (отладочные переключатели)
import {browser, bodyFromEnv, URL0} from './common.mjs';
const ids = (process.argv[2] || '').split(',').filter(Boolean); if (!ids.length) { console.log('qc.mjs id1,id2'); process.exit(1); }
const b = await browser(), pg = await b.newPage({viewport: {width: 300, height: 400}}); pg.setDefaultTimeout(300000);
pg.on('pageerror', e => console.log('PAGEERR', e.message));
await pg.addInitScript(x => { (x || '').split(',').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); window[k] = v == null ? 1 : +v; }); }, process.env.X || '');
await pg.goto(URL0 + (process.env.PAGE || 'index.html'));
await pg.evaluate(async ([body, PACK]) => { localStorage.clear(); Object.assign(PREFS.body, body); await FIT.addPack(PACK); FIT.setAnim(false); FIT.open(); }, [bodyFromEnv('m'), process.env.PACK || 'wardrobe/']);
for (const id of ids) console.log(await pg.evaluate(async ([id, all]) => { FIT.wear(['w-' + id], {}); await FIT.ready(); await new Promise(r => setTimeout(r, 200)); await FIT.ready();
  const q = FIT.qc('w-' + id) || {checks: []}; if (all) return id + ' ' + q.score + (q.ok ? '' : ' ПРОВЕРИТЬ') + '\n' + q.checks.map(c => '   ' + (c.ok ? '  ' : '✗ ') + c.name + ' −' + c.pen + ': ' + c.val + (c.prof && window.__qcProf ? '\n      t     ' + c.prof.t.join(' ') + '\n      модель ' + c.prof.model.join(' ') + '\n      фото   ' + c.prof.photo.join(' ') : '') + (c.front ? '\n      спереди [y/H, ширина, полуобхват] ' + JSON.stringify(c.front) : '')).join('\n');
  return id + ' ' + q.score + ' ' + JSON.stringify(q.checks.filter(c => !c.ok).map(c => c.name + ':' + c.val)); }, [id, !!process.env.ALL]));
await b.close();
