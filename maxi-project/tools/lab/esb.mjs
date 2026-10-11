// Сборщик модулей сайта для проверок (esbuild): «three» — глобальный THREE из three.min.js (r128), стили — отдельно.
import path from 'node:path'; import {ROOT, esbuild} from './common.mjs';
export const R = ROOT + '/';
const threeGlobal = {name: 'three-global', setup(b) { b.onResolve({filter: /^three$/}, () => ({path: 'three', namespace: 'tg'})); b.onLoad({filter: /.*/, namespace: 'tg'}, () => ({contents: 'module.exports = window.THREE;', loader: 'js'})); }};
const noCss = {name: 'no-css', setup(b) { b.onResolve({filter: /\.css$/}, a => ({path: a.path, namespace: 'nocss'})); b.onLoad({filter: /.*/, namespace: 'nocss'}, () => ({contents: '', loader: 'js'})); }};
export async function bundle(entrySrc, resolveDir) {
  const r = await esbuild().build({stdin: {contents: entrySrc, resolveDir: resolveDir || path.join(ROOT, 'src'), loader: 'js', sourcefile: 'entry.js'}, bundle: true, format: 'iife', write: false,
    plugins: [threeGlobal, noCss], loader: {'.json': 'json'}, define: {'import.meta.env': '{}'}, logLevel: 'error', charset: 'utf8', target: 'es2020'});
  return r.outputFiles[0].text;
}
