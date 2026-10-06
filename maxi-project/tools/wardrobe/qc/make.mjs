// страница только с примерочной (без ТЦ) — для автопроверки
import fs from 'fs';
const P = new URL('../../../src/', import.meta.url).pathname, out = process.argv[2] || 'work';
const set = fs.readFileSync(P + 'settings.js', 'utf8').replace(/export /g, '');
const fit = fs.readFileSync(P + 'shop/fitting.js', 'utf8').replace(/^import .*$/mg, '').replace(/^export /mg, '');
fs.writeFileSync(out + '/index.html', `<!doctype html><html><head><meta charset=utf-8><style>body{margin:0;background:#222}#fitC{width:600px;height:900px;display:block}.hid{display:none}</style></head><body>
<div id=fitting><canvas id=fitC></canvas><div class=hid><b id=fitShop></b><button id=fitX></button><div id=fitTabs></div><div id=fitViews></div><div id=fitBody></div></div></div>
<script src="three.min.js"></script><script>
${set}
${fit}
window.FIT=createFitting({fmtPrice:x=>x+'',thumb:p=>p.pic||'',siteOf:()=>'',coarse:false,catalogOf:()=>[]});
window.PREFS=PREFS;
</script></body></html>`);
