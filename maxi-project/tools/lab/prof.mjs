// prof.mjs id1,id2 — силуэт вещи против фото по 8 строкам (автопроверка «силуэт»): модель и фото в долях верхней строки
import {browser, bodyFromEnv, URL0} from './common.mjs';
const ids = (process.argv[2] || '').split(',').filter(Boolean);
const b = await browser(), pg = await b.newPage({viewport: {width: 300, height: 400}}); pg.setDefaultTimeout(300000);
await pg.goto(URL0 + (process.env.PAGE || 'index.html'));
await pg.evaluate(async body => { localStorage.clear(); Object.assign(PREFS.body, body); await FIT.addPack('wardrobe/'); FIT.setAnim(false); FIT.open(); }, bodyFromEnv('m'));
for (const id of ids) console.log(await pg.evaluate(async id => { FIT.wear(['w-' + id], {}); await FIT.ready(); await new Promise(r => setTimeout(r, 200)); await FIT.ready();
  const q = FIT.qc('w-' + id) || {checks: []}, s = q.checks.find(c => c.name === 'силуэт'); return id + ' ' + q.score + (s && s.prof ? '\n  модель ' + s.prof.model.join(' ') + '\n  фото   ' + s.prof.photo.join(' ') + '  (' + s.val + ')' : ''); }, id));
await b.close();
