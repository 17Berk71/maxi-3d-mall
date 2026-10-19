// batch.mjs id1,id2,… — каждую вещь отдельно надеть и снять в 3 ракурсах + полная автопроверка → OUTD/<id>_<угол>.jpg и OUTD/qc.jsonl
// Для отчёта по большому набору вещей (одна страница на все вещи, браузер не перезапускается).
// BODY=m|f|JSON · OUTD=папка (по умолчанию shots/batch) · V=0,1.57,3.14 · DPR=1 · T=180 (секунд на вещь, потом — пропуск) · PACK=wardrobe/
import fs from 'node:fs'; import path from 'node:path';
import {browser, bodyFromEnv, URL0, ensureShots} from './common.mjs';
const ids = (process.argv[2] || '').split(',').filter(Boolean); if (!ids.length) { console.log('batch.mjs id1,id2'); process.exit(1); }
const OUTD = process.env.OUTD || path.join(ensureShots(), 'batch'); fs.mkdirSync(OUTD, {recursive: true});
const V = (process.env.V || '0,1.57,3.14').split(',').map(Number), T = +(process.env.T || 300) * 1000, body = bodyFromEnv('m');
const ST = process.env.ST || '';
const log = fs.createWriteStream(path.join(OUTD, 'qc.jsonl'), {flags: 'a'});
let b, pg;
async function open() {
  if (b) await b.close().catch(() => {});
  b = await browser(); pg = await b.newPage({viewport: {width: 620, height: 920}, deviceScaleFactor: +(process.env.DPR || 1)}); pg.setDefaultTimeout(T);
  pg.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 200)));
  await pg.addInitScript(st => { window.__ST = st; }, ST);
  await pg.addInitScript(() => { window.__maskPass = on => { const R = FIT._R(); if (!R) return;
    if (on) { R.__sv = []; R.__bg = R.scene.background; R.__fog = R.scene.fog; R.scene.background = new THREE.Color(0); R.scene.fog = null;
      const wm = new THREE.MeshBasicMaterial({color: 0xffffff, side: THREE.DoubleSide}); wm.toneMapped = false; wm.skinning = false;
      const inAv = new Set(); R.avatar.traverse(o => inAv.add(o));
      R.scene.traverse(o => { if (!(o.isMesh || o.isLine || o.isPoints || o.isSprite)) return; R.__sv.push([o, o.visible, o.material]);
        const bm = new THREE.MeshBasicMaterial({color: 0x000000}); bm.toneMapped = false;   /* манекен — чёрный (закрывает вещь, как на обычном снимке) */
        if (inAv.has(o) && o.isMesh) { const mm = o.userData.part ? bm : wm; o.material = o.isSkinnedMesh ? Object.assign(mm.clone(), {skinning: true}) : mm; } else o.visible = false; });
    } else if (R.__sv) { R.__sv.forEach(([o, v, m]) => { o.visible = v; o.material = m; }); R.scene.background = R.__bg; R.scene.fog = R.__fog; R.__sv = null; } }; });
  await pg.goto(URL0 + (process.env.PAGE || 'index.html'));
  await pg.evaluate(async ([body, pack]) => { localStorage.clear(); Object.assign(PREFS.body, body); await FIT.addPack(pack); FIT.setAnim(false); FIT.open(); }, [body, process.env.PACK || 'wardrobe/']);
}
await open();
for (const id of ids) {
  const t0 = Date.now(); let rec;
  try {
    rec = await Promise.race([pg.evaluate(async id => {
      FIT.wear(['w-' + id], window.__ST ? {['w-' + id]: window.__ST} : {}); await FIT.ready(); await new Promise(r => setTimeout(r, 200)); await FIT.ready();
      const q = FIT.qc('w-' + id) || {checks: []};
      return {score: q.score, ok: q.ok, warn: q.warn, checks: q.checks.map(c => ({name: c.name, ok: c.ok, pen: c.pen, val: c.val})), note: FIT.fitNote('w-' + id)};
    }, id), new Promise((_, rej) => setTimeout(() => rej(new Error('время вышло')), T))]);
    const files = [];
    for (const v of V) {
      await pg.evaluate(v => { FIT.setRot(v); FIT.setZoom(0.6, 0.5); }, v); await pg.waitForTimeout(700);
      const f = path.join(OUTD, `${id}_${v}.jpg`), bb = await pg.locator('#fitC').boundingBox();
      await pg.screenshot({path: f, clip: bb, type: 'jpeg', quality: 82}); files.push(path.basename(f));
      // маска вещи в том же кадре (вещь белая, всё остальное чёрное) — для проверки внешнего вида (appearance.py)
      if (!process.env.NOMASK) { await pg.evaluate(() => window.__maskPass(true)); await pg.waitForTimeout(250);
        await pg.screenshot({path: f.replace(/\.jpg$/, '_m.png'), clip: bb, type: 'png'}); await pg.evaluate(() => window.__maskPass(false)); await pg.waitForTimeout(150); } }
    rec.files = files;
  } catch (e) { rec = {error: String(e.message || e).slice(0, 200)}; console.log('СБОЙ', id, rec.error); await open(); }
  rec.id = id; rec.body = process.env.BODY || 'm'; rec.sec = Math.round((Date.now() - t0) / 1000);
  log.write(JSON.stringify(rec) + '\n'); console.log(id, rec.score ?? '—', rec.sec + ' c');
}
log.end(); await b.close();
