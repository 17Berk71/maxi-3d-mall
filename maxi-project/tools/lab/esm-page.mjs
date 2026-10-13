// esm-page.mjs — страница сайта на исходных модулях без сборки (как в Vite dev): www-esm/ (index.html, src → ../../src, feeds, three)
// Нужна для полной проверки сайта (site-check.sh), когда Vite не установлен.
import fs from 'node:fs'; import path from 'node:path'; import {LAB, ROOT, WWW} from './common.mjs';
const D = path.join(LAB, 'www-esm'); fs.mkdirSync(D, {recursive: true});
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), body = idx.slice(idx.indexOf('<body>') + 6, idx.indexOf('<script type="module"')).trim();
fs.writeFileSync(path.join(D, 'index.html'), `<!doctype html><meta charset="utf-8"><title>esm</title><link rel=stylesheet href="src/style.css">
${body}
<script src="three.min.js"></script>
<script type="importmap">{"imports":{"three":"./three-shim.js"}}</script>
<script type="module">
const [d, d2] = await Promise.all([fetch("src/data/maxi-data.json").then(r=>r.json()), fetch("src/data/maxi-floor2.json").then(r=>r.json())]);
const {startApp} = await import("./src/app.js");
startApp(d, d2);
</script>
`);
fs.copyFileSync(path.join(LAB, 'three-shim.js'), path.join(D, 'three-shim.js'));
const three = path.join(WWW, 'three.min.js'); if (fs.existsSync(three)) fs.copyFileSync(three, path.join(D, 'three.min.js')); else console.log('сначала node make.mjs (кладёт three.min.js)');
for (const [name, to] of [['src', path.join(ROOT, 'src')], ['feeds', path.join(ROOT, 'public/feeds')], ['body', path.join(ROOT, 'public/body')], ['wardrobe', path.join(ROOT, 'tools/wardrobe/out')]]) {
  const p = path.join(D, name); try { fs.lstatSync(p); } catch (e) { fs.symlinkSync(to, p); } }
console.log(D);
