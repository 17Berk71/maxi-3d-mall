// страница только с примерочной (без ТЦ) — для автопроверки. Модули примерочной собираются esbuild
// (он ставится вместе с Vite: npm install; другой путь — ESBUILD_PATH=...). THREE — глобальный из three.min.js
import fs from 'node:fs'; import {createRequire} from 'node:module';
const P = new URL('../../../src/', import.meta.url).pathname, out = process.argv[2] || 'work';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const esbuild = require(process.env.ESBUILD_PATH || 'esbuild');
const threeGlobal = {name: 'three-global', setup(b) { b.onResolve({filter: /^three$/}, () => ({path: 'three', namespace: 'tg'})); b.onLoad({filter: /.*/, namespace: 'tg'}, () => ({contents: 'module.exports = window.THREE;', loader: 'js'})); }};
const entry = `import * as F from './shop/fitting.js'; import {PREFS} from './core/settings.js';
Object.assign(window, F, {PREFS});
window.FIT = F.createFitting({fmtPrice: x => x + '', thumb: p => p.pic || '', siteOf: () => '', coarse: false, catalogOf: () => []});`;
const js = (await esbuild.build({stdin: {contents: entry, resolveDir: P, loader: 'js'}, bundle: true, format: 'iife', write: false, plugins: [threeGlobal], logLevel: 'error', charset: 'utf8', target: 'es2020'})).outputFiles[0].text;
fs.writeFileSync(out + '/index.html', `<!doctype html><html><head><meta charset=utf-8><style>body{margin:0;background:#222}#fitC{width:600px;height:900px;display:block}.hid{display:none}</style></head><body>
<div id=fitting><canvas id=fitC></canvas><div class=hid><b id=fitShop></b><button id=fitX></button><div id=fitTabs></div><div id=fitViews></div><div id=fitBody></div></div></div>
<script src="three.min.js"></script><script>
${js.replace(/<\/script/gi, '<\\/script')}
</script></body></html>`);
