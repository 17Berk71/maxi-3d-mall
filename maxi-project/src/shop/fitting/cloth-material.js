// Ткань как материал: вид ткани, переплетение, ворс, мелкие заломы (шейдер), материал по фото.
import * as THREE from 'three';
import {LIN} from './common.js';
import {photoTex} from './photo-texture.js';
import {TOPK} from './specs.js';

// ---------- ткань как материал: переплетение, ворс, мелкие заломы ----------
// Виды ткани (по виду вещи и словам в названии). tile — размер плитки фактуры (м), wAmp — рельеф нитей,
// nAmp — неровность полотна, rough/sheen — матовость и ворс, wrL — шаг заломов там, где ткань в расчёте сжата (м),
// wrG — их глубина, cav — темнее во впадинах
const FT = {
  jersey: {weave: 'knit', tile: 0.011, wAmp: 0.22, nAmp: 0.5, rough: 0.9, sheen: 0.22, wrL: 0.042, wrG: 0.45, cav: 0.08},
  rib: {weave: 'rib', tile: 0.014, wAmp: 1.1, nAmp: 0.4, rough: 0.9, sheen: 0.2, wrL: 0.045, wrG: 0.42, cav: 0.08},
  fleece: {weave: 'knit', tile: 0.014, wAmp: 0.15, nAmp: 0.6, rough: 0.96, sheen: 0.32, wrL: 0.05, wrG: 0.39, cav: 0.07},
  chunky: {weave: 'chunky', tile: 0.04, wAmp: 1.3, nAmp: 0.4, rough: 0.95, sheen: 0.28, wrL: 0.06, wrG: 0.33, cav: 0.06},
  woven: {weave: 'plain', tile: 0.007, wAmp: 0.3, nAmp: 0.55, rough: 0.8, sheen: 0.12, wrL: 0.036, wrG: 0.48, cav: 0.09},
  suiting: {weave: 'plain', tile: 0.009, wAmp: 0.25, nAmp: 0.4, rough: 0.72, sheen: 0.14, wrL: 0.045, wrG: 0.39, cav: 0.07},
  twill: {weave: 'twill', tile: 0.012, wAmp: 1.0, nAmp: 0.55, rough: 0.86, sheen: 0.08, wrL: 0.05, wrG: 0.42, cav: 0.09},
  nylon: {weave: 'ripstop', tile: 0.022, wAmp: 0.35, nAmp: 0.35, rough: 0.42, sheen: 0.04, wrL: 0.04, wrG: 0.48, cav: 0.10},
  suede: {weave: 'none', tile: 0.01, wAmp: 0, nAmp: 0.8, rough: 0.97, sheen: 0.5, wrL: 0.045, wrG: 0.36, cav: 0.07},
};
export function fabricType(item) {
  const n = ((item.name || '') + ' ' + (item.desc || '')).toLowerCase(), k = item.kind;
  if (/нейлон|плащев|ветровк|болонь/.test(n) || k === 'puffer') return FT.nylon;
  if (/замш|велюр|бархат/.test(n)) return FT.suede;
  if (/рубчик|лапша|резинк/.test(n) && TOPK.has(k)) return FT.rib;
  if (/вязан|крупн.*вязк|свитер/.test(n)) return FT.chunky;
  if (k === 'jeans' || /джинс|деним|вельвет|карго|чинос/.test(n)) return FT.twill;
  if (k === 'hoodie' || /свитшот|худи|толстовк|флис|зипк/.test(n) || k === 'sweater') return FT.fleece;
  if (k === 'tee' || /футболк|лонгслив|поло|трикотаж/.test(n)) return FT.jersey;
  if (k === 'coat' || k === 'jacket' || /пиджак|жакет|костюм/.test(n)) return FT.suiting;
  if (k === 'pants' || k === 'shorts') return FT.twill;
  return FT.woven;   // рубашка, платье, юбка
}
// плитка рельефа нитей (высота 0..1) → карта нормалей; плитка повторяется без шва
const WEAVE = {};
function weaveTex(kind) {
  if (WEAVE[kind]) return WEAVE[kind];
  const S = 128, H = new Float32Array(S * S), sm = t => t * t * (3 - 2 * t), at = (x, y) => H[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const u = x / S, v = y / S; let h = 0;
    if (kind === 'knit' || kind === 'chunky') {   // гладь: столбики петель «ёлочкой» (две наклонные дольки)
      const nw = kind === 'chunky' ? 4 : 8, nc = kind === 'chunky' ? 5 : 10, cu = u * nw, cv = v * nc, fu = cu - Math.floor(cu), fv = cv - Math.floor(cv);
      const side = fu < 0.5 ? -1 : 1, lx = (fu < 0.5 ? fu : 1 - fu) * 2, ly = fv;   // долька: эллипс наклонён к середине столбика
      const ex = (lx - 0.55 - (ly - 0.5) * 0.5) / 0.42, ey = (ly - 0.5) / 0.62; h = Math.max(0, 1 - ex * ex - ey * ey); h = Math.sqrt(h); void side;
    } else if (kind === 'rib') { const cu = u * 8, fu = cu - Math.floor(cu); h = Math.pow(Math.max(0, Math.sin(fu * Math.PI * 2)), 0.6) * 0.8 + 0.2 * Math.max(0, Math.sin((v * 16) * Math.PI * 2));
    } else if (kind === 'plain' || kind === 'ripstop') {   // полотняное: нити по очереди сверху/снизу
      const N = 16, cu = u * N, cv = v * N, iu = Math.floor(cu), iv = Math.floor(cv), fu = cu - iu, fv = cv - iv, over = (iu + iv) & 1;
      const warp = Math.sin(fu * Math.PI), weft = Math.sin(fv * Math.PI); h = over ? warp * (0.6 + 0.4 * Math.sin(fv * Math.PI)) : weft * (0.6 + 0.4 * Math.sin(fu * Math.PI));
      if (kind === 'ripstop') { const gu = (u * 4) % 1, gv = (v * 4) % 1; h = h * 0.4 + (gu < 0.06 || gv < 0.06 ? 1 : 0) * 0.8; }
    } else if (kind === 'twill') {   // саржа: диагональ 3/1
      const N = 16, cu = u * N, cv = v * N, iu = Math.floor(cu), iv = Math.floor(cv), fu = cu - iu, fv = cv - iv, ph = ((iu - iv) % 4 + 4) % 4;
      h = ph < 3 ? Math.sin(fu * Math.PI) * (0.75 + 0.25 * Math.cos((ph - 1) * 0.9)) : Math.sin(fv * Math.PI) * 0.55;
    } else h = 0.5;
    H[y * S + x] = sm(Math.max(0, Math.min(1, h))); }
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), D = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2, dy = (at(x, y + 1) - at(x, y - 1)) * 2.2, l = Math.hypot(dx, dy, 1), q = (y * S + x) * 4;
    D.data[q] = (-dx / l * 0.5 + 0.5) * 255; D.data[q + 1] = (-dy / l * 0.5 + 0.5) * 255; D.data[q + 2] = (1 / l * 0.5 + 0.5) * 255; D.data[q + 3] = H[y * S + x] * 255; }
  g.putImageData(D, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return (WEAVE[kind] = t);
}
// шум (бесшовный): NOISE — неровность полотна: R — высота, G/B — её наклон по x/y (готовый, без лишних выборок в шейдере);
// NOISE2 — крупный: R/G — фаза заломов по утку/основе, B — где заломы есть (пятнами)
let NOISE = null, NOISE2 = null;
function noiseLat(seed, N) { const v = new Float32Array(N * N); let a = seed; for (let i = 0; i < v.length; i++) { a = (a * 16807) % 2147483647; v[i] = a / 2147483647; } return v; }
function noiseVal(O, x, y) { let s = 0, w = 0, k = 1; for (const [N, v] of O) { const fx = x * N, fy = y * N, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx_ = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const g_ = (i, j) => v[((j % N) + N) % N * N + ((i % N) + N) % N]; s += k * ((g_(ix, iy) * (1 - sx_) + g_(ix + 1, iy) * sx_) * (1 - sy) + (g_(ix, iy + 1) * (1 - sx_) + g_(ix + 1, iy + 1) * sx_) * sy); w += k; k *= 0.55; } return s / w; }
function noiseCanvas(S, fill) { const cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), D = g.createImageData(S, S); fill(D.data); g.putImageData(D, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function noiseTex() {
  if (NOISE) return NOISE;
  const S = 128, O = [[4, noiseLat(11, 4)], [8, noiseLat(23, 8)], [16, noiseLat(37, 16)], [32, noiseLat(51, 32)]], Hh = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) Hh[y * S + x] = noiseVal(O, x / S, y / S);
  const at = (x, y) => Hh[((y + S) % S) * S + ((x + S) % S)];
  return (NOISE = noiseCanvas(S, a => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const q = (y * S + x) * 4, dx = (at(x + 1, y) - at(x - 1, y)) / 2 * S, dy = (at(x, y + 1) - at(x, y - 1)) / 2 * S;
    a[q] = Hh[y * S + x] * 255; a[q + 1] = Math.max(0, Math.min(255, 128 + dx * 12)); a[q + 2] = Math.max(0, Math.min(255, 128 + dy * 12)); a[q + 3] = 255; } }));
}
function noiseTex2() {
  if (NOISE2) return NOISE2;
  const S = 128, A = [[3, noiseLat(71, 3)], [6, noiseLat(83, 6)], [12, noiseLat(97, 12)]], B = [[3, noiseLat(113, 3)], [6, noiseLat(127, 6)], [12, noiseLat(131, 12)]], M = [[2, noiseLat(139, 2)], [4, noiseLat(149, 4)], [8, noiseLat(151, 8)]];
  return (NOISE2 = noiseCanvas(S, a => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const q = (y * S + x) * 4;
    a[q] = noiseVal(A, x / S, y / S) * 255; a[q + 1] = noiseVal(B, x / S, y / S) * 255; a[q + 2] = noiseVal(M, x / S, y / S) * 255; a[q + 3] = 255; } }));
}
// шейдер ткани: нормаль возмущается по координатам выкройки в метрах (атрибут uvm): нити, неровность полотна и
// мелкие заломы там, где расчёт сжал ткань (атрибут wrk: √сжатия по утку и по основе). Всё считается один раз (3 выборки
// текстур) — на телефоне и в слабой графике кадр не тяжелеет. Затенение складок (цвет вершин) действует и на «свечение» фото
const CLOTH_GLSL = `
uniform sampler2D clWeave; uniform sampler2D clNoise; uniform sampler2D clNoise2; uniform float clTile; uniform float clWAmp; uniform float clNAmp; uniform float clWrL; uniform float clWrG; uniform float clCav;
varying vec2 vUvm; varying vec2 vWrk;
vec2 clSl; float clCv;
void clEval(vec2 u) {
  vec3 wn = texture2D(clWeave, u / clTile).xyz * 2.0 - 1.0; clSl = -wn.xy / max(wn.z, 0.35) * clWAmp * 0.35;
  vec3 nz = texture2D(clNoise, u / 0.06).xyz; clSl += (nz.yz - 0.5) * (255.0 / 12.0) / 0.06 * 0.0009 * clNAmp;
  vec3 n2 = texture2D(clNoise2, u / 0.3).xyz; float m = smoothstep(0.3, 0.7, n2.z), kx = 6.2832 / (clWrL * (0.8 + 0.5 * n2.y)), ky = 6.2832 / (clWrL * (0.8 + 0.5 * n2.x));
  float px = kx * u.x + n2.x * 14.0, py = ky * u.y + n2.y * 14.0, ax = vWrk.x * (0.35 + 0.65 * m), ay = vWrk.y * (0.35 + 0.65 * m);
  clSl += clWrG * 1.3 * vec2(ax * cos(px), ay * cos(py));
  clCv = 1.0 - clCav * (ax * (0.5 - 0.5 * sin(px)) + ay * (0.5 - 0.5 * sin(py)));
}
vec3 clPerturb(vec3 eye_pos, vec3 N, vec2 sl, vec2 uv, float fd) {
  vec3 q0 = dFdx(eye_pos), q1 = dFdy(eye_pos); vec2 st0 = dFdx(uv), st1 = dFdy(uv);
  vec3 q1perp = cross(q1, N), q0perp = cross(N, q0), T = q1perp * st0.x + q0perp * st1.x, B = q1perp * st0.y + q0perp * st1.y;
  float det = max(dot(T, T), dot(B, B)); if (det <= 0.0) return N;
  float sc = fd * inversesqrt(det); return normalize(N - T * (sl.x * sc) - B * (sl.y * sc));
}`;
function clothify(mat, ft) {
  ft = ft || FT.woven; mat.userData.ft = ft;
  mat.extensions = Object.assign(mat.extensions || {}, {derivatives: true});
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, {clWeave: {value: weaveTex(ft.weave)}, clNoise: {value: noiseTex()}, clNoise2: {value: noiseTex2()}, clTile: {value: ft.tile}, clWAmp: {value: ft.wAmp}, clNAmp: {value: ft.nAmp}, clWrL: {value: ft.wrL}, clWrG: {value: ft.wrG}, clCav: {value: ft.cav}});
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 uvm; attribute vec2 wrk; varying vec2 vUvm; varying vec2 vWrk;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvUvm = uvm; vWrk = wrk;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + CLOTH_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\nclEval(vUvm); diffuseColor.rgb *= clCv;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = clPerturb(-vViewPosition, normal, clSl, vUvm, faceDirection);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor;\n#endif\ntotalEmissiveRadiance *= clCv;');
  };
  mat.customProgramCacheKey = () => 'cloth:' + ft.weave + ft.tile + ft.wAmp + ft.wrL;
  return mat;
}
// фото — основной цвет ткани (без своей светотени, см. delight); свет кабины даёт объём и складки;
// немного «свечения» фото — чтобы тёмные ткани в тени не уходили в черноту и цвет оставался как на снимке
export function photoMat(url, color, ft) {
  const t = photoTex(url);
  if (!t) return new THREE.MeshStandardMaterial({color: LIN(color || '#888'), roughness: 0.86, side: THREE.DoubleSide});
  ft = ft || FT.woven;
  const m = new THREE.MeshPhysicalMaterial({map: t, color: new THREE.Color(0.6, 0.6, 0.6), emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.1, roughness: ft.rough, metalness: 0, side: THREE.DoubleSide,
    sheen: new THREE.Color(ft.sheen, ft.sheen, ft.sheen), envMapIntensity: 0.7});
  return clothify(m, ft);
}
