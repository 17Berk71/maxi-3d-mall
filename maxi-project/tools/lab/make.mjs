// make.mjs [W H] — страница лаборатории примерочной (только кабина) → www/index.html (OUT=имя.html — другое имя).
// SRC=папка src — собрать другую версию (например, выгруженную из git для сравнения «до/после»).
// Заодно готовит www/: three.min.js, ссылки wardrobe → tools/wardrobe/out (ваши вещи), feeds → public/feeds.
import fs from 'node:fs'; import path from 'node:path'; import {bundle} from './esb.mjs'; import {ROOT, WWW} from './common.mjs';
const SRC = process.env.SRC || path.join(ROOT, 'src');
fs.mkdirSync(WWW, {recursive: true});
const three = [process.env.THREE_MIN, path.join(ROOT, 'node_modules/three/build/three.min.js'), path.join(path.dirname(WWW), 'vendor/three.min.js')]   // vendor — та же r128 (MIT)
 .find(p => p && fs.existsSync(p));
if (three) fs.copyFileSync(three, path.join(WWW, 'three.min.js'));
else if (!fs.existsSync(path.join(WWW, 'three.min.js'))) console.log('нет three.min.js (r128): npm install в maxi-project или THREE_MIN=путь');
for (const [name, to] of [['wardrobe', path.join(ROOT, 'tools/wardrobe/out')], ['feeds', path.join(ROOT, 'public/feeds')], ['body', path.join(ROOT, 'public/body')]]) {
  const p = path.join(WWW, name); try { fs.lstatSync(p); } catch (e) { fs.symlinkSync(to, p); } }
const js = await bundle(`import * as F from './shop/fitting.js'; import * as St from './core/settings.js'; import * as MH from './shop/fitting/mh-body.js';
Object.assign(window, F, {PREFS: St.PREFS, MH});
window.FIT = F.createFitting({fmtPrice: x => x + '', thumb: p => p.pic || '', siteOf: () => '', coarse: false, catalogOf: () => []});`, SRC);
const html = `<!doctype html><html><head><meta charset=utf-8><style>body{margin:0;background:#222}#fitC{width:${process.argv[2] || 600}px;height:${process.argv[3] || 900}px;display:block}.hid{display:none}</style></head><body>
<div id=fitting><canvas id=fitC></canvas><div class=hid><b id=fitShop></b><button id=fitX></button><div id=fitTabs></div><div id=fitViews></div><div id=fitBody></div></div></div>
<script src="three.min.js"></script><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
fs.writeFileSync(path.join(WWW, process.env.OUT || 'index.html'), html);
console.log('www/' + (process.env.OUT || 'index.html'));
