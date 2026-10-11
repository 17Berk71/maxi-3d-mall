// Общее для проверочных скриптов лаборатории: пути, поиск зависимостей, браузер, фигуры для примерки.
import {createRequire} from 'node:module'; import fs from 'node:fs'; import path from 'node:path';

export const LAB = path.dirname(new URL(import.meta.url).pathname);   // tools/lab
export const ROOT = path.resolve(LAB, '../..');                       // maxi-project
export const WWW = path.join(LAB, 'www');                             // страницы лаборатории (не в git)
export const SHOTS = path.join(LAB, 'shots');                         // снимки (не в git)
export const PORT = +(process.env.PORT || 8091);
export const URL0 = `http://localhost:${PORT}/`;

const req = createRequire(path.join(ROOT, 'package.json'));
// модуль из node_modules проекта; иначе путь из переменной окружения; иначе — известные места в облачной песочнице
export function need(name, envVar, extra = []) {
  for (const p of [process.env[envVar], name, ...extra].filter(Boolean)) { try { return req(p); } catch (e) { /* дальше */ } }
  throw new Error(`нет модуля ${name}: npm install в maxi-project или ${envVar}=путь`);
}
export const esbuild = () => need('esbuild', 'ESBUILD_PATH', ['/home/claude/.npm-global/lib/node_modules/tsx/node_modules/esbuild', '/opt/node-tools/node_modules/esbuild']);

// Chromium без видеокарты (swiftshader). Своя сборка браузера — PW_CHROMIUM=путь
export async function browser() {
  const {chromium} = need('playwright', 'PLAYWRIGHT_PATH', ['/home/claude/.npm-global/lib/node_modules/playwright']);
  const exe = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  return chromium.launch({executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
}

// фигуры: m — пользователь для проверок посадки (186/83, грудь 110, талия 82, бёдра 98), f — женская для юбок и платьев
export const BODIES = {
  m: {sex: 'm', height: 186, weight: 83, chest: 110, waist: 82, hips: 98, skin: 0},
  f: {sex: 'f', height: 173, weight: 56, chest: 82, waist: 62, hips: 92, skin: 0},
};
// BODY=m | f | {"sex":…} (JSON)
export function bodyFromEnv(def = 'm') { const b = process.env.BODY || def; return BODIES[b] || JSON.parse(b); }
export function ensureShots() { fs.mkdirSync(SHOTS, {recursive: true}); return SHOTS; }
