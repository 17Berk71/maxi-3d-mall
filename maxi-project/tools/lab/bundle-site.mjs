// bundle-site.mjs OUT.html [cdn] — весь сайт (галерея ТЦ) одной страницей через esbuild: быстрая проверка, что модули собираются.
// Без cdn — three.min.js должен лежать рядом с OUT.html.
import fs from 'node:fs'; import path from 'node:path'; import {bundle, R} from './esb.mjs';
const out = process.argv[2]; if (!out) { console.log('bundle-site.mjs OUT.html [cdn]'); process.exit(1); }
const js = await bundle(`import data from './data/maxi-data.json'; import floor2 from './data/maxi-floor2.json'; import {startApp} from './app.js'; startApp(data, floor2);`);
const idx = fs.readFileSync(R + 'index.html', 'utf8'), body = idx.slice(idx.indexOf('<body>') + 6, idx.indexOf('<script type="module"')).trim();
const css = fs.readFileSync(R + 'src/style.css', 'utf8'), cdn = process.argv[3] === 'cdn';
fs.writeFileSync(out, `<!doctype html><meta charset="utf-8"><title>Прогулка по Макси</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Nunito:wght@900&family=Oswald:wght@600&family=Pacifico&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
<style>\n${css}\n</style>
${body}
<script src="${cdn ? 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js' : 'three.min.js'}"></script>
<script>
${js.replace(/<\/script/gi, '<\\/script')}
</script>
`);
console.log(path.resolve(out), fs.statSync(out).size, 'байт');
