// надевает каждую вещь гардероба (верх — с джинсами, низ — с футболкой), собирает автопроверку, пишет отчёт
import fs from 'fs';
let chromium; try { ({chromium} = await import('playwright')); } catch (e) { ({chromium} = await import(process.env.PLAYWRIGHT || '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs')); }
const exe = process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const b = await chromium.launch({executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const pg = await b.newPage({viewport: {width: 620, height: 920}}); pg.setDefaultTimeout(180000);
pg.on('pageerror', e => console.log('PAGEERR', e.message));
await pg.goto(process.env.URL);
const body = JSON.parse(process.env.BODY || '{"sex":"m","height":186,"weight":83,"chest":110,"waist":82,"hips":98,"skin":0}');
await pg.evaluate(async body => { localStorage.clear(); Object.assign(PREFS.body, body); await FIT.addPack('wardrobe/'); setDrape(true); FIT.open(); }, body);
await pg.waitForTimeout(800);
const items = await pg.evaluate(() => FIT.items.map(i => ({id: i.id, slot: i.slot, states: (i.states || []).map(s => s[0]), name: i.name, who: i.who || '', sig: i.kind + '|' + JSON.stringify(i.drape && i.drape.front && i.drape.front.grid)})));
// пакеты из выгрузки: каждая вещь отдельно, на типовой фигуре своего пола; одинаковые пакеты (то же фото) — один раз
const PACKS = !!process.env.PACKS, REP = process.env.REPORT || process.env.OUT; fs.mkdirSync(REP, {recursive: true});
const REF = {m: {sex: 'm', height: 178, weight: 76, chest: 100, waist: 84, hips: 98, skin: 0}, f: {sex: 'f', height: 166, weight: 58, chest: 88, waist: 68, hips: 96, skin: 0}};
const sigDone = {};
const ids = items.map(i => i.id), tee = ids.find(i => /tee/.test(i)), jeans = ids.find(i => /jeans|baggy/.test(i));
const rows = [];
for (const it of items) {
  if (!['top', 'outer', 'bottom'].includes(it.slot)) continue;
  if (PACKS && sigDone[it.sig]) { rows.push(Object.assign({}, sigDone[it.sig], {id: it.id, name: it.name, copy: true})); continue; }
  if (PACKS) await pg.evaluate(b => Object.assign(PREFS.body, b), it.who === 'women' ? REF.f : REF.m);
  for (const st of PACKS ? [it.states[0] || ''] : it.states.length ? it.states : ['']) {
    const wear = PACKS ? [it.id] : it.slot === 'bottom' ? [tee, it.id] : [it.id, jeans], t0 = Date.now();
    await pg.evaluate(([w, id, st]) => FIT.wear(w, st ? {[id]: st} : {}), [wear, it.id, st]);
    await pg.waitForTimeout(50); await pg.evaluate(() => FIT.ready());
    const q = await pg.evaluate(id => FIT.qc(id), it.id), shot = 'qc_' + it.id.replace(/\W/g, '_') + (st ? '_' + st : '') + '.jpg';
    await pg.locator('#fitC').screenshot({path: REP + '/' + shot, type: 'jpeg', quality: 70});
    rows.push({id: it.id, name: it.name, state: st, q, shot, ms: Date.now() - t0});
    if (PACKS) sigDone[it.sig] = rows[rows.length - 1];
    console.log(it.id, st || '-', q ? q.score + (q.ok ? '' : ' ПРОВЕРИТЬ') : 'прежний способ', q ? q.checks.filter(c => !c.ok).map(c => c.name + ': ' + c.val).join('; ') : '');
  }
}
await b.close();
fs.writeFileSync(REP + '/qc.json', JSON.stringify(rows, null, 1));
// итог проверки — в meta.json пакета (примерочная и загрузчик выгрузок видят его без повторной проверки)
if (PACKS) rows.forEach(r => { const f = process.env.OUT + '/' + r.id.replace(/^w-/, '') + '/meta.json'; if (!r.q || !fs.existsSync(f)) return;
  const m = JSON.parse(fs.readFileSync(f, 'utf8')); m.qc = {score: r.q.score, ok: r.q.ok, bad: r.q.checks.filter(c => !c.ok).map(c => c.name)}; fs.writeFileSync(f, JSON.stringify(m, null, 1)); });
const esc = s => String(s).replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[c]);
const tr = r => `<tr class="${!r.q ? 'old' : r.q.ok ? 'ok' : 'bad'}"><td><img src="${r.shot}"></td><td><b>${esc(r.name)}</b><br><small>${esc(r.id)} ${esc(r.state)}</small></td><td class=sc>${r.q ? r.q.score : '—'}</td><td>${r.q ? r.q.checks.map(c => `<div class="${c.ok ? '' : 'f'}">${c.ok ? '✓' : '✗'} ${esc(c.name)}: ${esc(c.val)}${c.ok ? '' : ' — ' + esc(c.why)}</div>`).join('') : 'показано прежним способом, без расчёта ткани'}</td></tr>`;
fs.writeFileSync(REP + '/qc_report.html', `<!doctype html><meta charset=utf-8><title>Автопроверка гардероба</title><style>body{font:14px system-ui;margin:16px}table{border-collapse:collapse}td{border-bottom:1px solid #ddd;padding:6px;vertical-align:top}img{height:220px}.sc{font-size:22px;font-weight:700}.bad .sc{color:#b42318}.ok .sc{color:#067647}.f{color:#b42318}</style>
<h1>Автопроверка гардероба</h1><p>Фигура: ${esc(JSON.stringify(body))}. Балл 0–100; «проверить» — ниже 70 или один сильный провал.</p><table>${rows.map(tr).join('')}</table>`);
console.log('отчёт:', REP + '/qc_report.html');
