// texdump.mjs id1,id2 — текстуры ткани после обработки (delight — без светотени фото, flatten — ровная ткань плиссе) → shots/tex_*.png
import fs from 'node:fs'; import {browser, URL0, ensureShots} from './common.mjs';
const ids = (process.argv[2] || '').split(',').filter(Boolean), dir = ensureShots();
const b = await browser(), pg = await b.newPage({viewport: {width: 620, height: 920}}); pg.setDefaultTimeout(300000);
pg.on('pageerror', e => console.log('PAGEERR', e.message));
await pg.goto(URL0 + (process.env.PAGE || 'index.html'));
const r = await pg.evaluate(async ids => { localStorage.clear(); await FIT.addPack('wardrobe/'); FIT.setAnim(false); FIT.open(); FIT.wear(ids.map(i => 'w-' + i), {}); await FIT.ready(); await new Promise(r => setTimeout(r, 1500));
  const o = {}; for (const [k, t] of Object.entries(window.__ptex || {})) { const im = t.image; if (!im || !im.width) continue; let cv = im;
    if (!(im instanceof HTMLCanvasElement)) { cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; cv.getContext('2d').drawImage(im, 0, 0); } o[k] = cv.toDataURL('image/png'); } return o; }, ids);
for (const [k, v] of Object.entries(r)) { const f = `${dir}/tex_${k.replace(/[^a-z0-9]/gi, '_')}.png`; fs.writeFileSync(f, Buffer.from(v.split(',')[1], 'base64')); console.log(f); }
await b.close();
