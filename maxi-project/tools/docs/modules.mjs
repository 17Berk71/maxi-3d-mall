// Карта модулей сайта: node tools/docs/modules.mjs > docs/modules.md
// Для каждого файла src — что он делает (первые строки комментария) и что отдаёт другим (export).
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../src');
const files = []; (function w(d) { for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (!['data', 'assets'].includes(f)) w(p); } else if (f.endsWith('.js')) files.push(p); } })(root);
const groups = new Map();
for (const f of files) {
  const rel = path.relative(root, f), dir = path.dirname(rel) === '.' ? '(корень)' : path.dirname(rel), s = fs.readFileSync(f, 'utf8');
  const head = []; for (const line of s.split('\n')) { if (/^\s*\/\//.test(line)) head.push(line.replace(/^\s*\/\/\s?/, '')); else if (head.length || line.trim()) break; }
  const ex = [...s.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([\w$]+)/gm)].map(m => m[1]);
  [...s.matchAll(/^export\s+(?:let|const)\s+([\w$,\s]+);/gm)].forEach(m => m[1].split(',').map(x => x.trim()).filter(Boolean).forEach(x => ex.includes(x) || ex.push(x)));
  [...s.matchAll(/^export\s*\{([^}]+)\}/gm)].forEach(m => m[1].split(',').map(x => x.trim().split(/\s+as\s+/).pop()).filter(Boolean).forEach(x => ex.includes(x) || ex.push(x)));
  const kb = (fs.statSync(f).size / 1024).toFixed(1);
  if (!groups.has(dir)) groups.set(dir, []);
  groups.get(dir).push(`- \`${rel}\` (${kb} КБ) — ${head.join(' ') || '—'}${ex.filter(x => x !== 'init').length ? `\n  - отдаёт: ${ex.filter(x => x !== 'init').map(x => '`' + x + '`').join(', ')}` : ''}`);
}
const TITLES = {'(корень)': 'Входные файлы', core: 'core — запуск, цикл, общее состояние, настройки', render: 'render — рендер галереи, текстуры, эффекты', nav: 'nav — сетка проходимости и перемещение', mall: 'mall — галерея: магазины, лифты, эскалаторы, посетители', 'mall/build': 'mall/build — сборка 3D-сцены галереи по частям', controls: 'controls — игрок, камера, ввод', ui: 'ui — панели и карты интерфейса', shop: 'shop — магазины изнутри, каталог, товар, корзина', 'shop/fitting': 'shop/fitting — примерочная'};
let out = '# Карта модулей сайта\n\nСоздано `node tools/docs/modules.mjs > docs/modules.md` — обновляй после переноса или добавления модулей.\nКак устроено и где что менять — `docs/architecture.md`.\n';
for (const [dir, list] of [...groups].sort((a, b) => a[0] === '(корень)' ? -1 : b[0] === '(корень)' ? 1 : a[0].localeCompare(b[0]))) out += `\n## ${TITLES[dir] || dir}\n\n${list.join('\n')}\n`;
process.stdout.write(out);
