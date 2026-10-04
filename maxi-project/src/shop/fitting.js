// Примерочная: фигура по параметрам тела и вещи из любых магазинов «Макси» в одном образе.
//
// Вариант «Б»: вещи — простые 3D-формы по типу (футболка, худи, рубашка, свитер, куртка, пальто, жилет,
// брюки, джинсы, шорты, юбка, платье, кроссовки, ботинки, туфли), окрашенные в цвет вещи, с фактурой ткани.
// Форма подстраивается под фигуру: вещь строится по тем же обхватам, что и тело, с припуском на посадку.
//
// Как перейти к варианту «В» (настоящие 3D-модели вещей): у вещи появится поле `glb` (ссылка на модель).
// Тогда `garmentMesh` должен загрузить модель (GLTFLoader) и подогнать её под фигуру; сейчас вместо неё
// строится простая форма. Остальное — гардероб, слои, образы, интерфейс — остаётся как есть.
//
// Гардероб общий для всех магазинов и хранится в браузере: вещь, взятая в Gloria Jeans, остаётся в списке
// в примерочной Zolla. Слои: обувь → низ → верх → верхняя одежда; платье заменяет верх и низ.
import * as THREE from 'three';
import {PREFS, setPref, onPref, BODY0} from '../settings.js';

const WKEY = 'maxi-wardrobe', LKEY = 'maxi-looks';
const LIN = h => new THREE.Color(h).convertSRGBToLinear();
const SLOT_T = {top: 'Верх', outer: 'Верхняя одежда', bottom: 'Низ', dress: 'Платье', shoes: 'Обувь'};
const SLOT_ORDER = ['outer', 'dress', 'top', 'bottom', 'shoes'];

// ---------- что это за вещь: слот и форма ----------
const KIND_SLOT = {tee: 'top', sweater: 'top', shirt: 'top', hoodie: 'top', jacket: 'outer', coat: 'outer', puffer: 'outer', vest: 'outer', dress: 'dress',
  pants: 'bottom', jeans: 'bottom', shorts: 'bottom', skirt: 'bottom', sneaker: 'shoes', boot: 'shoes', shoe: 'shoes'};
export function classify(p) {
  // зипка (худи на молнии) носится поверх футболки — это верхний слой, а не «верх»
  if (p.kind && KIND_SLOT[p.kind]) return {slot: p.kind === 'hoodie' && p.zip ? 'outer' : KIND_SLOT[p.kind], kind: p.kind};
  const n = (p.name || '').toLowerCase(), m = p.model;
  const has = re => re.test(n);
  if (m === 'shoe' || has(/кроссов|кед|слипон|ботин|сапог|туфл|лофер|бутс|мокасин|сандал|босонож/))
    return {slot: 'shoes', kind: has(/ботин|сапог/) ? 'boot' : has(/туфл|лофер|мокасин/) ? 'shoe' : 'sneaker'};
  if (has(/платье|сарафан/)) return {slot: 'dress', kind: 'dress'};
  if (has(/юбк/)) return {slot: 'bottom', kind: 'skirt'};
  if (has(/шорт/)) return {slot: 'bottom', kind: 'shorts'};
  if (has(/джинс/)) return {slot: 'bottom', kind: 'jeans'};
  if (m === 'pants' || has(/брюк|джоггер|карго|чинос|штан|леггин|легинс/)) return {slot: 'bottom', kind: 'pants'};
  if (has(/пуховик|парк|пальто|тренч|комбинезон/)) return {slot: 'outer', kind: has(/пуховик|комбинезон/) ? 'puffer' : 'coat'};
  if (has(/жилет/)) return {slot: 'outer', kind: 'vest'};
  if (m === 'jacket' || has(/куртк|бомбер|ветровк|софтшелл|пиджак|жакет|косух/)) return {slot: 'outer', kind: 'jacket'};
  if (has(/худи|толстовк|зипк/)) return {slot: 'top', kind: 'hoodie'};
  if (has(/рубаш|блуз/)) return {slot: 'top', kind: 'shirt'};
  if (m === 'longsleeve' || has(/свитер|свитшот|джемпер|лонгслив|кардиган|водолазк|пижам/)) return {slot: 'top', kind: 'sweater'};
  if (m === 'tshirt' || has(/футболк|поло|майк|топ|форма/)) return {slot: 'top', kind: 'tee'};
  if (m === 'dress') return {slot: 'dress', kind: 'dress'};
  return null;
}
export const isWearable = p => !!classify(p);

// ---------- размеры: ориентир по обхватам (российская сетка) ----------
function sizeHint(b) {
  const top = Math.max(38, Math.min(66, Math.round(b.chest / 4) * 2));
  const bottom = b.sex === 'f' ? Math.max(38, Math.min(66, Math.round((b.hips - 8) / 4) * 2)) : top;
  return {top, bottom};
}

// ---------- фигура: профиль туловища и конечностей по параметрам ----------
function bodyDims(b) {
  const H = b.height / 100, s = H / 1.7, k = 0.86 + b.build * 0.34, R = c => c / 100 / (2 * Math.PI);
  const m = b.sex === 'm';
  return {
    H, s, k, m,
    chest: R(b.chest), waist: R(b.waist), hips: R(b.hips),
    neck: 0.052 * s * (m ? 1.12 : 1) * (0.9 + b.build * 0.2),
    shX: m ? 1.42 : 1.3,           // ширина плеч относительно груди
    legX: R(b.hips) * 0.55,
    thigh: R(b.hips) * 0.57 * (0.92 + b.build * 0.16),
  };
}
// радиус туловища на высоте yf (доля роста)
function torsoR(d, yf) {
  const T = [[0.465, d.hips * 0.8], [0.5, d.hips * 0.97], [0.53, d.hips], [0.585, d.hips * 0.45 + d.waist * 0.55], [0.625, d.waist],
    [0.67, d.waist * 0.4 + d.chest * 0.6], [0.72, d.chest], [0.765, d.chest * 0.97], [0.8, d.chest * 0.86], [0.826, d.chest * 0.58], [0.842, d.neck * 1.5], [0.852, d.neck]];
  if (yf <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++) if (yf <= T[i][0]) { const [y0, r0] = T[i - 1], [y1, r1] = T[i], t = (yf - y0) / (y1 - y0); return r0 + (r1 - r0) * (t * t * (3 - 2 * t)); }
  return T[T.length - 1][1];
}
// туловище не круглое: шире, чем глубже; плечи шире груди
function sx(d, yf) { const t = Math.max(0, Math.min(1, (yf - 0.72) / 0.08)); return 1.2 + (d.shX - 1.2) * t * (yf < 0.82 ? 1 : Math.max(0, 1 - (yf - 0.82) / 0.03)); }
function sz(d, yf) { return yf > 0.66 && yf < 0.78 && !d.m ? 0.84 : 0.78; }

// лофт вдоль оси Y по профилю [[y, r], ...] (y по возрастанию), с эллиптическим сечением
function loft(prof, segs, fx, fz, phi0, phiLen) {
  const pts = prof.map(([y, r]) => new THREE.Vector2(Math.max(0.002, r), y));
  const g = new THREE.LatheGeometry(pts, segs, phi0 || 0, phiLen || Math.PI * 2);
  if (fx || fz) { const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i); P.setX(i, P.getX(i) * (fx ? fx(y) : 1)); P.setZ(i, P.getZ(i) * (fz ? fz(y) : 1)); } g.computeVertexNormals(); }
  return g;
}
// труба вдоль конечности: профиль [[t 0..1, r]], длина L, сверху вниз; потом поворот и перенос
function limb(prof, L, segs) {
  const pr = prof.map(([t, r]) => [-t * L, r]).reverse();
  return loft(pr, segs || 20);
}
function armPose(d, side) {
  const y = 0.8 * d.H, x = side * d.chest * d.shX * 0.86;
  return {pos: new THREE.Vector3(x, y, 0), rot: side * 0.16, L: 0.335 * d.H};
}

// ---------- фактуры ткани (серые, цвет даёт материал) ----------
const TEX = {};
function fabricTex(kind) {
  if (TEX[kind]) return TEX[kind];
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, 256, 256);
  const rnd = (() => { let a = 7; return () => (a = (a * 16807) % 2147483647) / 2147483647; })();
  if (kind === 'knit') { for (let x = 0; x < 256; x += 8) { g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(x, 0, 3, 256); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 4, 0, 2, 256); } }
  else if (kind === 'denim') { g.fillStyle = '#d9dde2'; g.fillRect(0, 0, 256, 256); for (let i = -256; i < 256; i += 4) { g.strokeStyle = `rgba(255,255,255,${0.12 + rnd() * 0.12})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); } }
  else if (kind === 'quilt') { for (let y = 0; y < 256; y += 32) { const gr = g.createLinearGradient(0, y, 0, y + 32); gr.addColorStop(0, 'rgba(0,0,0,.28)'); gr.addColorStop(.25, 'rgba(255,255,255,.22)'); gr.addColorStop(.6, 'rgba(255,255,255,.05)'); gr.addColorStop(1, 'rgba(0,0,0,.30)'); g.fillStyle = gr; g.fillRect(0, y, 256, 32); } }
  else if (kind === 'leather') { for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`; g.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 3, 1 + rnd() * 2); } }
  else { for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${rnd() > .5 ? '0,0,0' : '255,255,255'},${rnd() * 0.07})`; g.fillRect(rnd() * 256, rnd() * 256, 1.5, 1.5); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  TEX[kind] = t; return t;
}
function fabricMat(item, kind, rep) {
  const t = fabricTex(kind).clone(); t.needsUpdate = true; t.repeat.set(rep || 6, rep ? rep * 1.5 : kind === 'quilt' ? 11 : 8);
  const rough = kind === 'leather' ? 0.45 : kind === 'quilt' ? 0.55 : 0.85;
  return new THREE.MeshStandardMaterial({color: LIN(item.color || '#888888'), map: t, roughness: rough, metalness: 0, side: THREE.DoubleSide});
}

// ---------- тело ----------
function buildBody(b, skinMat) {
  const d = bodyDims(b), g = new THREE.Group(), H = d.H;
  const yProf = []; for (let yf = 0.465; yf <= 0.8521; yf += 0.0129) yProf.push([yf * H, torsoR(d, yf)]);
  g.add(new THREE.Mesh(loft(yProf, 40, y => sx(d, y / H), y => sz(d, y / H)), skinMat));
  // шея и голова (манекен без лица)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(d.neck * 0.92, d.neck, 0.07 * d.s, 20), skinMat); neck.position.y = 0.866 * H; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.098 * d.s, 32, 24), skinMat); head.scale.set(0.9, 1.16, 1); head.position.y = 0.93 * H; g.add(head);
  // ноги
  [-1, 1].forEach(side => {
    const prof = [[0.04, 0.032], [0.07, 0.036], [0.15, 0.056 * d.k], [0.24, 0.047 * d.k], [0.28, 0.05 * d.k], [0.38, d.thigh * 0.86], [0.47, d.thigh], [0.5, d.thigh * 0.98]].map(([y, r]) => [y * H, r * (y > 0.3 ? 1 : d.s)]);
    const leg = new THREE.Mesh(loft(prof, 22), skinMat); leg.position.x = side * d.legX; g.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), skinMat); foot.scale.set(0.045 * d.s, 0.035 * d.s, 0.12 * d.s); foot.position.set(side * d.legX, 0.03 * H, 0.05 * d.s); g.add(foot);
    // рука
    const a = armPose(d, side), arm = new THREE.Mesh(limb([[0, 0.052 * d.k * d.s], [0.12, 0.046 * d.k * d.s], [0.47, 0.034 * d.k * d.s], [0.55, 0.036 * d.k * d.s], [1, 0.025 * d.s]], a.L), skinMat);
    arm.position.copy(a.pos); arm.rotation.z = a.rot; g.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skinMat); hand.scale.set(0.022 * d.s, 0.06 * d.s, 0.04 * d.s);
    hand.position.copy(a.pos).add(new THREE.Vector3(Math.sin(a.rot) * (a.L + 0.05 * d.s), -Math.cos(a.rot) * (a.L + 0.05 * d.s), 0)); hand.rotation.z = a.rot; g.add(hand);
  });
  const sh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), skinMat); sh.scale.set(d.chest * d.shX * 0.98, d.chest * 0.42, d.chest * 0.72); sh.position.y = 0.8 * H; g.add(sh);
  return {g, d};
}

// ---------- вещи ----------
const EASE = {tee: .012, sweater: .018, hoodie: .026, shirt: .014, jacket: .036, coat: .044, puffer: .06, vest: .04, dress: .012, pants: .009, jeans: .008, shorts: .012, skirt: .014};
// слои: каждая вещь на туловище не уже той, что под ней (иначе нижняя «протыкает» верхнюю)
let UNDER = null, UNDERZ = null;   // ширина и глубина по высоте (шаг 1% роста) от уже надетых вещей, метры
const ui = yf => Math.max(0, Math.min(100, Math.round(yf * 100)));
const uget = (A, yf) => { const i = ui(yf); return Math.max(A[i - 1] || 0, A[i] || 0, A[i + 1] || 0); };
// подогнать радиус под нижние слои и записать свой слой; fx, fz — масштаб сечения по X и Z на этой высоте
function layer(yf, r, fx, fz) {
  if (!UNDER) return r;
  const u = uget(UNDER, yf), uz = uget(UNDERZ, yf);
  if (u) r = Math.max(r, (u + 0.007) / fx); if (uz) r = Math.max(r, (uz + 0.007) / fz);
  // свой слой пишем отдельно: вещь не должна «отталкиваться» сама от себя
  const i = ui(yf); PEND[i] = Math.max(PEND[i] || 0, r * fx); PENDZ[i] = Math.max(PENDZ[i] || 0, r * fz);
  return r;
}
let PEND = [], PENDZ = [];
function commitLayer() { PEND.forEach((v, i) => { UNDER[i] = Math.max(UNDER[i] || 0, v || 0); }); PENDZ.forEach((v, i) => { UNDERZ[i] = Math.max(UNDERZ[i] || 0, v || 0); }); PEND = []; PENDZ = []; }
function torsoPiece(d, y0, y1, off, flare, mat, segs) {
  const H = d.H, prof = [], fx = y => sx(d, Math.max(0.6, y)) * 0.98 + 0.02, fz = y => sz(d, y) + (y < 0.6 ? 0.04 : 0);
  for (let yf = y0; yf <= y1 + 1e-6; yf += 0.012) {
    // ниже бёдер длинная вещь закрывает обе ноги — не сужается к промежности
    let r = (yf < 0.53 ? Math.max(torsoR(d, Math.max(0.47, yf)), d.hips * (yf < 0.5 ? 0.99 : 0.97)) : torsoR(d, yf)) + off;
    if (flare && yf < 0.6) r += flare * (0.6 - yf) / 0.6 * 2.2; if (yf > 0.83) r = Math.max(r, d.neck + off * 0.8);
    prof.push([yf * H, layer(yf, r, fx(yf), fz(yf))]);
  }
  return new THREE.Mesh(loft(prof, segs || 40, y => fx(y / H), y => fz(y / H)), mat);
}
// юбка (и низ платья): от пояса расширяется к подолу плавно, спереди-сзади тоже раскрывается
function flarePiece(d, yTop, hem, off, amount, mat) {
  const H = d.H, prof = [], tOf = yf => Math.max(0, Math.min(1, (yTop - yf) / (yTop - hem)));
  for (let yf = hem; yf <= yTop + 1e-6; yf += 0.012) {
    const t = tOf(yf), base = yf >= 0.53 ? torsoR(d, yf) : d.hips;
    prof.push([yf * H, layer(yf, base + off + amount * Math.pow(t, 1.4), 1.2, 0.8 + 0.2 * t)]);
  }
  return new THREE.Mesh(loft(prof, 48, () => 1.2, y => 0.8 + 0.2 * tOf(y / H)), mat);
}
function sleeves(d, len, off0, mat, g, cuff) {
  const off = Math.min(off0, 0.012 + off0 * 0.45);
  [-1, 1].forEach(side => {
    const a = armPose(d, side), r = t => (t < 0.12 ? 0.052 : t < 0.47 ? 0.046 - (t - 0.12) * 0.034 : 0.035 - (t - 0.47) * 0.018) * d.k * d.s + off;
    const prof = [[-0.07, r(0) * 0.3], [-0.035, r(0) * 0.85]]; for (let t = 0; t <= len + 1e-6; t += 0.05) prof.push([t, r(t)]);
    if (cuff && len > 0.9) prof.push([len, r(len) * 0.92]);
    const m = new THREE.Mesh(limb(prof, a.L), mat); m.position.copy(a.pos); m.rotation.z = a.rot; g.add(m);
  });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), mat);
  cap.scale.set(d.chest * d.shX * 0.97 + off * 0.7, d.chest * 0.42 + off * 0.7, d.chest * 0.7 + off * 0.7); cap.position.y = 0.8 * d.H; g.add(cap);
}
function legPieces(d, yLow, off, mat, g, flare) {
  const H = d.H;
  [-1, 1].forEach(side => {
    const prof = [[0.04, 0.034], [0.07, 0.038], [0.15, 0.058 * d.k], [0.24, 0.05 * d.k], [0.28, 0.053 * d.k], [0.38, d.thigh * 0.88], [0.47, d.thigh], [0.5, d.thigh * 0.98]]
      .filter(([y]) => y >= yLow - 0.001).map(([y, r]) => [y * H, r * (y > 0.3 ? 1 : d.s) + off + (flare ? flare * Math.max(0, 0.3 - y) : 0)]);
    if (prof[0][0] > yLow * H + 0.001) prof.unshift([yLow * H, prof[0][1]]);
    const m = new THREE.Mesh(loft(prof, 22), mat); m.position.x = side * d.legX; g.add(m);
  });
}
// линия по передней поверхности вещи (молния, планка рубашки): повторяет изгиб груди и живота
function frontLine(d, y0, y1, off, r, mat, g, flat) {
  const pts = []; for (let yf = y0; yf <= y1 + 1e-6; yf += 0.02) pts.push(new THREE.Vector3(0, yf * d.H, frontZ(d, yf, off) + r * 0.6));
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 6, false), mat); if (flat) m.scale.x = flat; g.add(m); return m;
}
function strip(w, h, depth, x, y, z, mat, g) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), mat); m.position.set(x, y, z); g.add(m); return m; }
const frontZ = (d, yf, off) => {
  const zs = sz(d, yf) + (yf < 0.6 ? 0.04 : 0), uz = PEND.length ? PENDZ[ui(yf)] : UNDERZ && UNDERZ[ui(yf)];
  return uz ? uz : (torsoR(d, yf) + off) * zs;
};

// ---------- вещь из фото («фабрика», tools/wardrobe/build.py) ----------
// Текстуры выпрямлены по строкам: левый край текстуры — левый край вещи на фото, правый — правый, верх — горловина или пояс.
// Поэтому на шаблоне перед берётся из фото спереди, спина — из фото сзади, а боковые швы приходятся на края фото.
// Мерки (длина к ширине, длина рукава, шаг, ширина штанины) подгоняют шаблон под эту вещь.
const PTEX = {};
const texLoader = new THREE.TextureLoader();
function photoTex(url) {
  if (!url) return null;
  if (!PTEX[url]) { const t = texLoader.load(url); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; PTEX[url] = t; }
  return PTEX[url];
}
function photoMat(url, color) {
  const t = photoTex(url);
  // светотень уже есть на самом фото: часть цвета светится сама (emissive), часть даёт свет кабины — форма видна, цвет не уходит
  if (!t) return new THREE.MeshStandardMaterial({color: LIN(color || '#888'), roughness: 0.86, side: THREE.DoubleSide});
  return new THREE.MeshStandardMaterial({map: t, color: new THREE.Color(0.72, 0.72, 0.72), emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.42, roughness: 0.9, metalness: 0, side: THREE.DoubleSide});
}
// UV половины лофта. Вещь на фото лежит или висит плоско, ширина на фото — половина обхвата,
// поэтому u растёт по дуге (линейно по углу): перед — от правого бока (−90°) к левому (+90°),
// спина — на фото сзади видна зеркально (слева на фото — левый бок человека, +x)
const uFront = ph => 0.5 + Math.max(-Math.PI / 2, Math.min(Math.PI / 2, ph)) / Math.PI;
const uBack = ph => { const ps = ph > 0 ? ph - Math.PI : ph + Math.PI; return 0.5 + Math.max(-Math.PI / 2, Math.min(Math.PI / 2, ps)) / Math.PI; };
function halfUV(geo, front, fx, fz, vOf) {
  const P = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ph = Math.atan2(x / fx(y), z / fz(y));
    uv.setXY(i, front ? uFront(ph) : uBack(ph), 1 - Math.max(0, Math.min(1, vOf(y))));
  }
  uv.needsUpdate = true;
}
// корпус из двух половин (перед и спина), перед можно разрезать по центру (расстёгнутая молния)
function photoTorso(d, y0, y1, off, matF, matB, g, opt) {
  opt = opt || {};
  const H = d.H, prof = [], fx = y => sx(d, Math.max(0.6, y / H)) * 0.98 + 0.02, fz = y => sz(d, y / H) + (y / H < 0.6 ? 0.04 : 0);
  for (let yf = y0; yf <= y1 + 1e-6; yf += 0.012) {
    let r = (yf < 0.53 ? Math.max(torsoR(d, Math.max(0.47, yf)), d.hips * (yf < 0.5 ? 0.99 : 0.97)) : torsoR(d, yf)) + off;
    if (opt.blouse && yf > 0.55 && yf < 0.66) r += opt.blouse * Math.sin((yf - 0.55) / 0.11 * Math.PI);
    if (opt.flare && yf < 0.6) r += opt.flare * (0.6 - yf) / 0.6 * 2.2;
    if (yf > 0.83) r = Math.max(r, d.neck + off * 0.8);
    prof.push([yf * H, layer(yf, r, fx(yf * H), fz(yf * H))]);
  }
  const vOf = opt.vOf || (y => (y1 * H - y) / ((y1 - y0) * H));
  const gap = opt.gap || 0;
  const pieces = gap ? [[-Math.PI / 2, Math.PI / 2 - gap, matF, true], [gap, Math.PI / 2 - gap, matF, true]] : [[-Math.PI / 2, Math.PI, matF, true]];
  pieces.push([Math.PI / 2, Math.PI, matB, false]);
  pieces.forEach(([p0, pl, mat, front]) => {
    const geo = loft(prof, 24, fx, fz, p0, pl); halfUV(geo, front, fx, fz, vOf);
    const m = new THREE.Mesh(geo, mat); m.userData.role = front ? 'front' : 'back'; g.add(m);
  });
}
// рукава с текстурой рукава (вокруг руки — зеркально), плечо — шар с той же тканью
function photoSleeves(d, len, off0, mat, g, cuff) {
  const off = Math.min(off0, 0.012 + off0 * 0.45);
  [-1, 1].forEach(side => {
    const a = armPose(d, side), r = t => (t < 0.12 ? 0.052 : t < 0.47 ? 0.046 - (t - 0.12) * 0.034 : 0.035 - (t - 0.47) * 0.018) * d.k * d.s + off;
    const prof = [[-0.07, r(0) * 0.3], [-0.035, r(0) * 0.85]]; for (let t = 0; t <= len + 1e-6; t += 0.05) prof.push([t, r(t)]);
    if (cuff && len > 0.9) prof.push([len, r(len) * 0.92]);
    const geo = limb(prof, a.L), P = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ph = Math.atan2(x, z); uv.setXY(i, 0.5 + 0.5 * Math.sin(ph) * side, 1 - Math.max(0, Math.min(1, -y / (len * a.L)))); }
    uv.needsUpdate = true;
    const m = new THREE.Mesh(geo, mat); m.position.copy(a.pos); m.rotation.z = a.rot; g.add(m);
  });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), mat);
  cap.scale.set(d.chest * d.shX * 0.97 + off * 0.7, d.chest * 0.42 + off * 0.7, d.chest * 0.7 + off * 0.7); cap.position.y = 0.8 * d.H; g.add(cap);
}
// плоская ширина (половина обхвата) сечения корпуса на высоте yf — с ней сравниваются пропорции фото
function flatW(d, yf, off) { const r = torsoR(d, yf) + off, a = r * (sx(d, Math.max(0.6, yf)) * 0.98 + 0.02), b = r * (sz(d, yf) + (yf < 0.6 ? 0.04 : 0)); return Math.PI * (a + b) / 2; }

function photoGarment(item, d) {
  const g = new THREE.Group(), H = d.H, T = item.tex, f = item.fit || {}, k = item.kind, st = item.state || '';
  const off = EASE[k] || 0.014, base = item.color || '#888';
  const mF = photoMat(T.front, base), mB = photoMat(T.back || T.front, base), mS = T.sleeve ? photoMat(T.sleeve, base) : photoMat(null, base);
  const metal = new THREE.MeshStandardMaterial({color: LIN('#c9ccd0'), roughness: 0.3, metalness: 0.9});
  if (['tee', 'sweater', 'hoodie', 'jacket', 'shirt'].includes(k)) {
    const top = 0.862, W = flatW(d, 0.7, off);
    let hem = top - (f.len_w || 1.6) * W / H;
    hem = Math.max(0.41, Math.min(0.62, hem));
    const tucked = st === 'tucked';
    if (tucked) hem = Math.max(hem, 0.555);
    const gap = st === 'open' ? (k === 'jacket' ? 0.42 : 0.2) : 0;
    photoTorso(d, hem, top, off, mF, mB, g, {gap, blouse: tucked ? 0.012 : 0});
    const long = k !== 'tee';
    const sl = long ? 1 : Math.max(0.22, Math.min(0.75, (f.sleeve || 0.45) * (top - hem) * H / (0.335 * H) * 0.95));
    photoSleeves(d, sl, off, mS, g, long);
    if (item.zip && st !== 'open') frontLine(d, hem + 0.01, 0.85, off, 0.0035, metal, g);
    if (k === 'hoodie' || item.hood) {
      if (st === 'hood') {
        // капюшон надет: оболочка вокруг головы, лицо открыто
        const hood = new THREE.Mesh(new THREE.SphereGeometry(0.128 * d.s, 28, 18, Math.PI * 0.86, Math.PI * 1.28, 0.0, Math.PI * 0.74), mS);
        hood.position.set(0, 0.928 * H, -0.006 * d.s); hood.scale.set(1.0, 1.18, 1.08); g.add(hood);
      } else {
        const hood = new THREE.Mesh(new THREE.SphereGeometry(0.13 * d.s, 24, 16, Math.PI * 0.15, Math.PI * 1.7, 0.2, Math.PI * 0.62), mS);
        hood.position.set(0, 0.845 * H, -0.075 * d.s); hood.rotation.y = Math.PI; hood.scale.set(1.0, 0.48, 0.62); g.add(hood);
      }
    }
    if (item.collar || k === 'jacket') {
      const col = new THREE.Mesh(new THREE.TorusGeometry(d.neck + off * 0.9, 0.016, 8, 24), mS); col.rotation.x = Math.PI / 2; col.position.y = 0.864 * H; col.scale.set(1.15, 1.05, 1); g.add(col);
    }
  } else {
    // низ: пояс → шаг → низ штанины; разметка v по фото (где шаг на фото — там шаг на фигуре)
    const waist = 0.6, crotchY = 0.47, Wh = flatW(d, 0.53, off);
    let hemY = waist - (f.len_w || 1.8) * Wh / H;
    hemY = Math.max(k === 'shorts' ? 0.25 : 0.03, Math.min(k === 'shorts' ? 0.4 : 0.3, hemY));
    // длинные брюки по фото лёжа выходят короче: широкий крой на фото шире, чем пояс на фигуре.
    // Пока брюки (не укороченные по названию) — до щиколотки; длину возьмём из размерной сетки, когда она будет в выгрузке
    if (k !== 'shorts' && !/укороч|кюлот|капри/i.test(item.name || '')) hemY = Math.min(hemY, 0.06);
    const cv = Math.max(0.15, Math.min(0.75, f.crotch || 0.42));
    const vOf = y => { const yf = y / H; return yf >= crotchY ? (waist - yf) / (waist - crotchY) * cv : cv + (crotchY - yf) / (crotchY - hemY) * (1 - cv); };
    photoTorso(d, crotchY - 0.005, waist, off, mF, mB, g, {vOf});
    // штанины: ширина у шага, у колена и внизу — из фото (плоская ширина штанины = π·r)
    const legFlat = r => r / Math.PI;
    const rC = Math.max(d.thigh + off, legFlat(Wh * 0.5)), rK = Math.max(0.05 * d.k + off, legFlat(Wh * (f.knee || 0.45))), rH = Math.max(0.036 + off, legFlat(Wh * Math.max(f.hem || 0.3, 0.26)));
    [-1, 1].forEach(side => {
      const body = y => { const tab = [[0.04, 0.034], [0.07, 0.038], [0.15, 0.058 * d.k], [0.24, 0.05 * d.k], [0.28, 0.053 * d.k], [0.38, d.thigh * 0.88], [0.47, d.thigh], [0.5, d.thigh * 0.98]];
        for (let i = 1; i < tab.length; i++) if (y <= tab[i][0]) { const t = (y - tab[i - 1][0]) / (tab[i][0] - tab[i - 1][0]); return (tab[i - 1][1] + (tab[i][1] - tab[i - 1][1]) * t) * (y > 0.3 ? 1 : d.s); } return d.thigh; };
      const kneeY = (crotchY + hemY) / 2, prof = [];
      for (let yf = hemY; yf <= crotchY + 0.03 + 1e-6; yf += 0.015) {
        const t = yf < kneeY ? (yf - hemY) / (kneeY - hemY) : (yf - kneeY) / (crotchY - kneeY);
        const r = yf < kneeY ? rH + (rK - rH) * (t * t * (3 - 2 * t)) : rK + (rC - rK) * (t * t * (3 - 2 * t));
        prof.push([yf * H, Math.max(r, body(yf) + off)]);
      }
      const one = () => 1;
      // перед штанины: на фото левая штанина (side −1) — левая половина нижней части текстуры
      [[-Math.PI / 2, Math.PI, mF, true], [Math.PI / 2, Math.PI, mB, false]].forEach(([p0, pl, mat, front]) => {
        const geo = loft(prof, 20, one, one, p0, pl), P = geo.attributes.position, uv = geo.attributes.uv;
        for (let i = 0; i < P.count; i++) {
          const x = P.getX(i), y = P.getY(i), z = P.getZ(i), ph = Math.atan2(x, z), u = front ? uFront(ph) : uBack(ph);
          const leftHalf = front ? side < 0 : side > 0;              // на фото сзади штанины меняются местами
          uv.setXY(i, (leftHalf ? 0 : 0.5) + u * 0.5, 1 - Math.min(1, vOf(y)));
        }
        uv.needsUpdate = true;
        const m = new THREE.Mesh(geo, mat); m.position.x = side * d.legX; g.add(m);
      });
    });
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// одна вещь на фигуре; если у вещи будет glb — здесь подменить на загруженную модель (вариант «В»)
export function garmentMesh(item, d) {
  if (item.tex) return photoGarment(item, d);
  const c = classify(item) || {slot: 'top', kind: 'tee'}, k = c.kind, g = new THREE.Group(), H = d.H, off = EASE[k] || 0.012;
  const fab = k === 'jeans' ? 'denim' : k === 'puffer' ? 'quilt' : (k === 'sweater' || k === 'hoodie') ? 'knit' : k === 'jacket' && /кож|косух/i.test(item.name) ? 'leather' : 'plain';
  const mat = fabricMat(item, fab), dark = new THREE.MeshStandardMaterial({color: LIN(item.color || '#888').multiplyScalar(0.55), roughness: 0.8});
  const metal = new THREE.MeshStandardMaterial({color: LIN('#c9ccd0'), roughness: 0.3, metalness: 0.9});
  if (k === 'tee') { g.add(torsoPiece(d, 0.5, 0.85, off, 0, mat)); sleeves(d, 0.38, off, mat, g); }
  else if (k === 'sweater') { g.add(torsoPiece(d, 0.49, 0.86, off, 0, mat)); sleeves(d, 1, off, mat, g, true); g.add(torsoPiece(d, 0.485, 0.505, off + 0.004, 0, dark)); }
  else if (k === 'shirt') {
    g.add(torsoPiece(d, 0.48, 0.855, off, 0, mat)); sleeves(d, 1, off, mat, g, true);
    const col = new THREE.Mesh(new THREE.TorusGeometry(d.neck + 0.012, 0.012, 8, 24), mat); col.rotation.x = Math.PI / 2; col.position.y = 0.855 * H; col.scale.set(1.1, 1, 1); g.add(col);
    frontLine(d, 0.5, 0.84, off, 0.006, dark, g, 2.2);
  }
  else if (k === 'hoodie') {
    g.add(torsoPiece(d, 0.48, 0.86, off, 0, mat)); sleeves(d, 1, off, mat, g, true);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.13 * d.s, 24, 16, Math.PI * 0.15, Math.PI * 1.7, 0.2, Math.PI * 0.62), mat); hood.position.set(0, 0.86 * H, -0.06 * d.s); hood.rotation.y = Math.PI; hood.scale.set(1.05, 0.62, 0.8); g.add(hood);
    g.add(torsoPiece(d, 0.475, 0.5, off + 0.006, 0, dark));
  }
  else if (k === 'jacket' || k === 'coat' || k === 'puffer' || k === 'vest') {
    const low = k === 'coat' ? 0.3 : k === 'puffer' && /длин|пальто/i.test(item.name) ? 0.32 : 0.45;
    g.add(torsoPiece(d, low, 0.865, off, k === 'coat' ? 0.03 : 0.006, mat));
    if (k !== 'vest') sleeves(d, 1, off + 0.004, mat, g, true);
    frontLine(d, Math.max(0.47, low + 0.01), 0.85, off, 0.0045, k === 'coat' ? dark : metal, g);
    if (k === 'coat') [0.7, 0.62, 0.54, 0.46].forEach(y => { const bt = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), dark); bt.position.set(0.035, y * H, frontZ(d, y, off) + 0.01); g.add(bt); });
    const col = new THREE.Mesh(new THREE.TorusGeometry(d.neck + off * 0.9, 0.022, 8, 24), mat); col.rotation.x = Math.PI / 2; col.position.y = 0.862 * H; col.scale.set(1.15, 1, 1); g.add(col);
    if (k === 'puffer' && /капюш/i.test(item.name)) { const hood = new THREE.Mesh(new THREE.SphereGeometry(0.14 * d.s, 24, 16, Math.PI * 0.15, Math.PI * 1.7, 0.2, Math.PI * 0.6), mat); hood.position.set(0, 0.86 * H, -0.07 * d.s); hood.rotation.y = Math.PI; hood.scale.set(1.08, 0.62, 0.82); g.add(hood); }
  }
  else if (k === 'dress') {
    const hem = /макси|вечерн/i.test(item.name) ? 0.08 : /мини/i.test(item.name) ? 0.38 : 0.26;
    g.add(torsoPiece(d, 0.6, 0.84, off, 0, mat));
    g.add(flarePiece(d, 0.612, hem, off, (/трикотаж|футляр/i.test(item.name) ? 0.03 : 0.1) * d.s, mat));
    if (!/сарафан/i.test(item.name)) sleeves(d, 0.3, off, mat, g);
  }
  else if (k === 'pants' || k === 'jeans' || k === 'shorts') {
    const yLow = k === 'shorts' ? 0.33 : 0.045;
    legPieces(d, yLow, off, mat, g, k === 'pants' && /широк|клёш|палаццо/i.test(item.name) ? 0.2 : 0.02);
    g.add(torsoPiece(d, 0.465, 0.6, off, 0, mat));
    g.add(torsoPiece(d, 0.585, 0.605, off + 0.003, 0, k === 'jeans' ? mat : dark));
  }
  else if (k === 'skirt') {
    const hem = /макси|длин/i.test(item.name) ? 0.1 : /мини/i.test(item.name) ? 0.4 : 0.28;
    g.add(flarePiece(d, 0.605, hem, off, (/карандаш/i.test(item.name) ? 0.02 : 0.09) * d.s, mat));
    g.add(torsoPiece(d, 0.59, 0.612, off + 0.004, 0, dark));
  }
  else if (c.slot === 'shoes') {
    const sole = new THREE.MeshStandardMaterial({color: LIN(k === 'sneaker' ? '#f2f0ea' : '#2a2421'), roughness: 0.6});
    [-1, 1].forEach(side => {
      const x = side * d.legX, up = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), mat);
      up.scale.set(0.052 * d.s, k === 'shoe' ? 0.035 * d.s : 0.045 * d.s, 0.135 * d.s); up.position.set(x, 0.042 * H, 0.05 * d.s); g.add(up);
      const so = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 20), sole); so.scale.set(0.054 * d.s, 0.022 * d.s, 0.14 * d.s); so.position.set(x, 0.011 * d.s, 0.05 * d.s); g.add(so);
      if (k === 'boot') { const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * d.s, 0.052 * d.s, 0.12 * H, 18, 1, true), mat); sh.position.set(x, 0.1 * H, 0); g.add(sh); }
    });
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

// ---------- гардероб ----------
function load(key, def) { try { return JSON.parse(localStorage.getItem(key) || 'null') || def; } catch (e) { return def; } }
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

export function createFitting(ctx) {
  // ctx: {fmtPrice, thumb(p) → url, siteOf(s), onOpen(), onClose(), coarse, catalogOf(s)}
  const W = load(WKEY, {items: [], worn: []});
  let looks = load(LKEY, []);
  const subs = [];
  const persist = () => { save(WKEY, W); subs.forEach(f => f()); };
  const idOf = (p, s) => p.feed && p.id ? p.id : (s ? s.name : '') + '|' + p.name + '|' + (p.color || '');
  function toItem(p, s) {
    const c = classify(p); if (!c) return null;
    return {id: idOf(p, s), name: p.name, shop: s ? s.name : '', shopCol: s ? s.colHex : '#888', price: p.price || 0, oldPrice: p.oldPrice || 0, url: p.url || (s && ctx.siteOf(s)) || '',
      color: p.color || '#888888', colorName: p.colorName || '', thumb: ctx.thumb(p), model: p.model, slot: c.slot, kind: c.kind, sizes: p.sizes || null, feed: !!p.feed, glb: p.glb || null,
      tex: p.tex || null, fit: p.fit || null, states: p.states || null, state: p.states ? p.states[0][0] : '', zip: !!p.zip, collar: !!p.collar, hood: !!p.hood};
  }
  const has = (p, s) => W.items.some(i => i.id === idOf(p, s));
  function add(p, s, wear) {
    const it = toItem(p, s); if (!it) return false;
    if (!W.items.some(i => i.id === it.id)) W.items.unshift(it);
    if (W.items.length > 60) { const drop = W.items.pop(); W.worn = W.worn.filter(id => id !== drop.id); }
    if (wear) putOn(it.id, true);
    persist(); return true;
  }
  function putOn(id, quiet) {
    const it = W.items.find(i => i.id === id); if (!it) return;
    const clash = sl => sl === it.slot || (it.slot === 'dress' && (sl === 'top' || sl === 'bottom')) || ((it.slot === 'top' || it.slot === 'bottom') && sl === 'dress');
    W.worn = W.worn.filter(w => { const o = W.items.find(i => i.id === w); return o && !clash(o.slot); });
    W.worn.push(id); if (!quiet) persist();
  }
  function takeOff(id) { W.worn = W.worn.filter(w => w !== id); persist(); }
  function remove(id) { W.items = W.items.filter(i => i.id !== id); W.worn = W.worn.filter(w => w !== id); persist(); }
  const worn = () => W.worn.map(id => W.items.find(i => i.id === id)).filter(Boolean);

  // ---------- сцена кабины ----------
  let R = null, open = false, shopNow = null, raf = 0, tab = 'items';
  const el = id => document.getElementById(id);
  function ensureScene() {
    if (R) return R;
    const canvas = el('fitC');
    const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.physicallyCorrectLights = true; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene(); scene.background = LIN('#2a2522');
    // мягкое окружение для блеска ткани и зеркала
    { const es = new THREE.Scene(), bx = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 10), new THREE.MeshBasicMaterial({color: LIN('#5a524b'), side: THREE.BackSide})); es.add(bx);
      [[0, 2.9, 0, 6, 0.1, 3, 6], [-4.9, 1.5, 0, 0.1, 2, 6, 2.5], [4.9, 1.5, 0, 0.1, 2, 6, 2.5]].forEach(([x, y, z, w, h, dd, k]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), new THREE.MeshBasicMaterial({color: new THREE.Color(k, k * 0.95, k * 0.88)})); m.position.set(x, y, z); es.add(m); });
      const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, 0.03).texture; pm.dispose(); }
    scene.add(new THREE.HemisphereLight(LIN('#ffffff'), LIN('#6d6862'), 1.0));
    const key = new THREE.SpotLight(LIN('#fffaf3'), 70, 9, 0.6, 0.6, 2); key.position.set(1.2, 3.2, 2.4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; scene.add(key, key.target);
    const rim = new THREE.PointLight(LIN('#f4efe8'), 10, 6, 2); rim.position.set(-1.4, 2.2, -1.2); scene.add(rim);
    // кабина: пол, стены, зеркало с подсветкой, шторка
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.MeshStandardMaterial({color: LIN('#b89a7a'), roughness: 0.5})); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(0.62, 48), new THREE.MeshStandardMaterial({color: LIN('#e9e2d6'), roughness: 0.95})); rug.rotation.x = -Math.PI / 2; rug.position.y = 0.003; rug.receiveShadow = true; scene.add(rug);
    const wallM = new THREE.MeshStandardMaterial({color: LIN('#d8cfc4'), roughness: 0.9});
    const back = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3), wallM); back.position.set(0, 1.5, -1.25); back.receiveShadow = true; scene.add(back);
    const curtM = new THREE.MeshStandardMaterial({color: LIN('#6b2f3a'), roughness: 0.95, side: THREE.DoubleSide});
    [-1, 1].forEach(sd => { const cg = new THREE.PlaneGeometry(1.4, 2.6, 28, 1); const P = cg.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, Math.sin(P.getX(i) * 22) * 0.04); cg.computeVertexNormals();
      const cu = new THREE.Mesh(cg, curtM); cu.rotation.y = -sd * Math.PI / 2; cu.position.set(sd * 1.5, 1.3, -0.5); scene.add(cu); });
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.0), new THREE.MeshStandardMaterial({color: LIN('#c7d2d8'), roughness: 0.04, metalness: 1, envMapIntensity: 1.2})); mirror.position.set(0, 1.2, -1.23); scene.add(mirror);
    const led = new THREE.MeshBasicMaterial({color: new THREE.Color(2.2, 1.9, 1.5), toneMapped: false});
    [[-0.5, 1.2, 0.03, 2.1], [0.5, 1.2, 0.03, 2.1], [0, 2.25, 1.03, 0.03], [0, 0.15, 1.03, 0.03]].forEach(([x, y, w, h]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), led); m.position.set(x, y, -1.22); scene.add(m); });
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 16, Math.PI), new THREE.MeshStandardMaterial({color: LIN('#c8a464'), metalness: 1, roughness: 0.3})); hook.position.set(1.0, 1.75, -1.2); scene.add(hook);
    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
    const avatar = new THREE.Group(); scene.add(avatar);
    const skinMat = new THREE.MeshStandardMaterial({color: LIN('#e8e2da'), roughness: 0.55});
    R = {renderer, scene, cam, avatar, skinMat, view: {rot: 0.35, dist: 0, h: 0.55, z: 1, drag: null, ptr: new Map(), pinch: 0}};
    // вращение фигуры, приближение
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); R.view.ptr.set(e.pointerId, {x: e.clientX, y: e.clientY}); if (R.view.ptr.size === 2) { const a = [...R.view.ptr.values()]; R.view.pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); } });
    canvas.addEventListener('pointermove', e => { const p = R.view.ptr.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (R.view.ptr.size === 2) { const a = [...R.view.ptr.values()], dd = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); if (R.view.pinch) R.view.z = Math.max(0.45, Math.min(1.25, R.view.z * R.view.pinch / dd)); R.view.pinch = dd; return; }
      R.view.rot += dx * 0.012; R.view.h = Math.max(0.15, Math.min(0.92, R.view.h - dy * 0.0025)); });
    const up = e => { R.view.ptr.delete(e.pointerId); if (R.view.ptr.size < 2) R.view.pinch = 0; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { e.preventDefault(); R.view.z = Math.max(0.45, Math.min(1.25, R.view.z * Math.exp(e.deltaY * 0.001))); }, {passive: false});
    return R;
  }
  const SKIN = ['#e8e2da', '#f1d3bd', '#d9a882', '#a8714f', '#6e4630'];
  let built = {key: ''};
  function rebuild() {
    if (!R) return; const b = PREFS.body, key = JSON.stringify(b) + '|' + worn().map(i => i.id + ':' + (i.state || '')).join(',');
    if (key === built.key) return; built.key = key;
    R.avatar.children.slice().forEach(o => { R.avatar.remove(o); o.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material && m.material !== R.skinMat) { if (m.material.map && !Object.values(TEX).includes(m.material.map)) m.material.map.dispose(); m.material.dispose(); } }); });
    R.skinMat.color.copy(LIN(SKIN[b.skin | 0] || SKIN[0])); R.skinMat.roughness = (b.skin | 0) === 0 ? 0.35 : 0.6;
    const body = buildBody(b, R.skinMat); body.g.traverse(o => { if (o.isMesh) { o.castShadow = true; } }); R.avatar.add(body.g); R.d = body.d;
    const order = {shoes: 0, bottom: 1, dress: 2, top: 3, outer: 4};
    UNDER = []; UNDERZ = []; worn().sort((a, c) => order[a.slot] - order[c.slot]).forEach(it => { R.avatar.add(garmentMesh(it, body.d)); commitLayer(); }); UNDER = UNDERZ = null;
  }
  function frame() {
    if (!open) return; raf = requestAnimationFrame(frame);
    const c = el('fitC'), w = c.clientWidth, h = c.clientHeight; if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio, ctx.coarse ? 1.75 : 2);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { R.renderer.setPixelRatio(dpr); R.renderer.setSize(w, h, false); R.cam.aspect = w / h; R.cam.updateProjectionMatrix(); }
    rebuild();
    const H = (R.d ? R.d.H : 1.7), v = R.view, fitH = H * 1.32 * v.z, dist = Math.max(fitH / 2 / Math.tan(THREE.MathUtils.degToRad(R.cam.fov / 2)), (fitH * 0.55) / (R.cam.aspect * Math.tan(THREE.MathUtils.degToRad(R.cam.fov / 2))));
    const ty = H * (v.z < 0.9 ? v.h : 0.5 + (v.h - 0.55) * 0.3);
    R.cam.position.set(Math.sin(0.0) * dist, ty + 0.08, dist); R.cam.lookAt(0, ty, 0);
    R.avatar.rotation.y += (v.rot - R.avatar.rotation.y) * 0.25;
    R.renderer.render(R.scene, R.cam);
  }
  function view(kind) { const v = R.view; if (kind === 'all') { v.z = 1; v.h = 0.55; } else if (kind === 'top') { v.z = 0.55; v.h = 0.72; } else if (kind === 'bottom') { v.z = 0.6; v.h = 0.28; } else if (kind === 'turn') v.rot += Math.PI; }

  // ---------- интерфейс ----------
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const price = it => it.price ? ctx.fmtPrice(it.price) : '';
  function itemRow(it, opts) {
    const li = h('li', 'fit-it' + (W.worn.includes(it.id) ? ' on' : ''));
    const img = h('img'); img.src = it.thumb; img.alt = ''; img.loading = 'lazy'; li.appendChild(img);
    const t = h('div', 'fit-t'); t.appendChild(h('b', '', it.name));
    const meta = h('small'); const dot = h('i'); dot.style.background = it.shopCol; meta.appendChild(dot); meta.appendChild(document.createTextNode(it.shop + (price(it) ? ' · ' + price(it) : '') + ' · ' + SLOT_T[it.slot].toLowerCase())); t.appendChild(meta); li.appendChild(t);
    const bx = h('div', 'fit-b');
    if (opts && opts.take) { const b = h('button', 'btn pri', 'Примерить'); b.onclick = () => { add(opts.p, shopNow, true); render(); }; bx.appendChild(b); }
    else {
      const on = W.worn.includes(it.id), b = h('button', on ? 'btn' : 'btn pri', on ? 'Снять' : 'Надеть'); b.onclick = () => { on ? takeOff(it.id) : putOn(it.id); render(); }; bx.appendChild(b);
      if (it.url) { const a = h('a', 'btn', 'На сайт ↗'); a.href = it.url; a.target = '_blank'; a.rel = 'noopener'; bx.appendChild(a); }
      const x = h('button', 'btn fit-del', '×'); x.title = 'Убрать из примерочной'; x.setAttribute('aria-label', 'Убрать «' + it.name + '» из примерочной'); x.onclick = () => { remove(it.id); render(); }; bx.appendChild(x);
    }
    li.appendChild(bx); return li;
  }
  function renderItems(body) {
    const wn = worn();
    const top = h('div', 'fit-worn'); top.appendChild(h('div', 'sh-lab', 'Сейчас на фигуре'));
    if (!wn.length) top.appendChild(h('p', 'sh-note', 'Пока ничего. Нажми «Надеть» у вещи ниже.'));
    else { const chips = h('div', 'fit-chips'); wn.forEach(it => { const c = h('button', 'chip on'); const i = h('i'); i.style.background = it.color; c.appendChild(i); c.appendChild(document.createTextNode(it.name + ' ×')); c.title = 'Снять'; c.onclick = () => { takeOff(it.id); render(); }; chips.appendChild(c); }); top.appendChild(chips);
      // состояния вещи: расстёгнута / капюшон / заправлен — одна и та же вещь носится по-разному
      wn.filter(it => it.states && it.states.length > 1).forEach(it => {
        const row = h('div', 'fit-states'); row.appendChild(h('small', '', it.name + ':'));
        it.states.forEach(([key, label]) => { const b = h('button', 'sh-tab' + ((it.state || it.states[0][0]) === key ? ' on' : ''), label); b.onclick = () => { it.state = key; persist(); render(); }; row.appendChild(b); });
        top.appendChild(row); });
      const sum = wn.reduce((a, it) => a + (it.price || 0), 0); if (sum) top.appendChild(h('p', 'sh-note', 'Образ целиком: ' + ctx.fmtPrice(sum) + ' · вещи из ' + new Set(wn.map(i => i.shop)).size + ' магаз.')); }
    body.appendChild(top);
    // вещи из всех магазинов
    body.appendChild(h('div', 'sh-lab', 'Взятые вещи · ' + W.items.length));
    if (!W.items.length) body.appendChild(h('p', 'sh-note', 'Здесь собираются вещи из всех магазинов. В карточке вещи нажимай «В примерочную» — и примеряй вещи из разных магазинов вместе.'));
    else { const byShop = {}; W.items.forEach(it => (byShop[it.shop] = byShop[it.shop] || []).push(it)); const ul = h('ul', 'fit-list');
      Object.entries(byShop).forEach(([shop, arr]) => { ul.appendChild(h('li', 'fit-shop', shop)); arr.forEach(it => ul.appendChild(itemRow(it))); }); body.appendChild(ul); }
    // вещи этого магазина — можно сразу примерить
    if (shopNow) {
      const cat = ctx.catalogOf(shopNow) || [], pool = [];
      cat.forEach(dep => { const n = Math.min(dep.items.length, 8); for (let i = 0; i < n; i++) { const p = dep.items[i]; if (isWearable(p) && !has(p, shopNow)) pool.push(p); } });
      if (pool.length) { body.appendChild(h('div', 'sh-lab', 'Из «' + shopNow.name + '» · примерить сразу')); const ul = h('ul', 'fit-list');
        pool.slice(0, 24).forEach(p => { const it = toItem(p, shopNow); ul.appendChild(itemRow(it, {take: true, p})); }); body.appendChild(ul); }
    }
  }
  function renderBody(body) {
    const sz = sizeHint(PREFS.body);
    body.appendChild(h('p', 'sh-note', 'Ориентир размера по обхватам: верх ' + sz.top + ', низ ' + sz.bottom + '. Сверяй с таблицей размеров на сайте магазина.'));
    renderBodyControls(body);
  }
  function renderLooks(body) {
    const wn = worn();
    const sv = h('button', 'btn pri sh-more', 'Сохранить образ' + (wn.length ? ' (' + wn.length + ' вещ.)' : '')); sv.disabled = !wn.length;
    sv.onclick = () => { looks.unshift({name: 'Образ ' + (looks.length + 1), ids: W.worn.slice(), at: Date.now()}); looks = looks.slice(0, 20); save(LKEY, looks); render(); };
    body.appendChild(sv);
    if (!looks.length) { body.appendChild(h('p', 'sh-note', 'Собери образ на фигуре и сохрани — потом его можно будет надеть снова одной кнопкой и открыть вещи на сайтах магазинов.')); return; }
    const ul = h('ul', 'fit-list');
    looks.forEach((lk, i) => {
      const items = lk.ids.map(id => W.items.find(x => x.id === id)).filter(Boolean);
      const li = h('li', 'fit-look'); li.appendChild(h('b', '', lk.name)); li.appendChild(h('small', '', items.map(x => x.name).join(' · ') || 'вещи убраны из примерочной'));
      const sum = items.reduce((a, it) => a + (it.price || 0), 0); if (sum) li.appendChild(h('small', '', 'Всего ' + ctx.fmtPrice(sum)));
      const bx = h('div', 'fit-b');
      const on = h('button', 'btn pri', 'Надеть'); on.disabled = !items.length; on.onclick = () => { W.worn = []; items.forEach(it => putOn(it.id, true)); persist(); tab = 'items'; render(); }; bx.appendChild(on);
      items.filter(it => it.url).slice(0, 4).forEach(it => { const a = h('a', 'btn', it.shop + ' ↗'); a.href = it.url; a.target = '_blank'; a.rel = 'noopener'; a.title = it.name; bx.appendChild(a); });
      const del = h('button', 'btn fit-del', '×'); del.setAttribute('aria-label', 'Удалить образ'); del.onclick = () => { looks.splice(i, 1); save(LKEY, looks); render(); }; bx.appendChild(del);
      li.appendChild(bx); ul.appendChild(li);
    });
    body.appendChild(ul);
  }
  function render() {
    if (!open) return;
    el('fitShop').textContent = shopNow ? 'Примерочная · ' + shopNow.name : 'Примерочная';
    document.querySelectorAll('#fitTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    const body = el('fitBody'); const st = body.scrollTop; body.innerHTML = '';
    if (tab === 'items') renderItems(body); else if (tab === 'body') renderBody(body); else renderLooks(body);
    body.scrollTop = st;
  }
  // ползунки фигуры: и в примерочной, и в «О проекте» → «Настройки»
  const SL = [['height', 'Рост', 140, 205, 1, 'см'], ['chest', 'Обхват груди', 70, 135, 1, 'см'], ['waist', 'Обхват талии', 55, 130, 1, 'см'], ['hips', 'Обхват бёдер', 75, 140, 1, 'см'], ['build', 'Телосложение', 0, 1, 0.01, '']];
  function renderBodyControls(box) {
    const b = PREFS.body, wrap = h('div', 'fit-body');
    const sx_ = h('div', 'seg3'); [['f', 'Женская'], ['m', 'Мужская']].forEach(([v, t]) => { const bt = h('button', b.sex === v ? 'on' : '', t); bt.onclick = () => { const dflt = v === 'm' ? {sex: 'm', height: 180, chest: 98, waist: 84, hips: 100} : {sex: 'f', height: 168, chest: 90, waist: 72, hips: 98}; setPref('body', dflt); }; sx_.appendChild(bt); });
    wrap.appendChild(h('div', 'sh-lab', 'Фигура')); wrap.appendChild(sx_);
    SL.forEach(([k, t, mn, mx, st, u]) => {
      const row = h('label', 'fit-sl'); const top = h('span'); top.appendChild(h('b', '', t)); const val = h('small', '', k === 'build' ? (b[k] < 0.33 ? 'худощавое' : b[k] > 0.66 ? 'плотное' : 'среднее') : b[k] + ' ' + u); top.appendChild(val); row.appendChild(top);
      const r = h('input'); r.type = 'range'; r.min = mn; r.max = mx; r.step = st; r.value = b[k];
      r.oninput = () => { const v = +r.value; val.textContent = k === 'build' ? (v < 0.33 ? 'худощавое' : v > 0.66 ? 'плотное' : 'среднее') : v + ' ' + u; setPref('body', {[k]: v}); };
      row.appendChild(r); wrap.appendChild(row);
    });
    wrap.appendChild(h('div', 'sh-lab', 'Тон фигуры'));
    const tone = h('div', 'fit-tones'); SKIN.forEach((c, i) => { const bt = h('button', (b.skin | 0) === i ? 'on' : ''); bt.style.background = c; bt.setAttribute('aria-label', i ? 'Тон ' + i : 'Как манекен'); bt.title = i ? 'Тон ' + i : 'Как манекен'; bt.onclick = () => setPref('body', {skin: i}); tone.appendChild(bt); }); wrap.appendChild(tone);
    const rs = h('button', 'btn', 'Сбросить'); rs.onclick = () => setPref('body', {...BODY0}); wrap.appendChild(rs);
    box.appendChild(wrap);
    return wrap;
  }
  // перерисовать ползунки, если параметры поменяли в другом месте
  const boxes = [];
  function mountBodyControls(box) { boxes.push(box); box.innerHTML = ''; renderBodyControls(box); }
  onPref(k => { if (k !== 'body') return; boxes.forEach(b => { if (!b.contains(document.activeElement) || document.activeElement.type !== 'range') { b.innerHTML = ''; renderBodyControls(b); } }); if (open && tab === 'body' && !(document.activeElement && document.activeElement.type === 'range')) render(); });

  function openRoom(s) {
    shopNow = s || null; ensureScene(); open = true; el('fitting').hidden = false; tab = W.items.length || !shopNow ? 'items' : 'items';
    built.key = ''; render(); cancelAnimationFrame(raf); frame(); ctx.onOpen && ctx.onOpen();
  }
  function closeRoom() { open = false; cancelAnimationFrame(raf); el('fitting').hidden = true; ctx.onClose && ctx.onClose(); }
  // кнопки
  el('fitX').onclick = closeRoom;
  document.querySelectorAll('#fitTabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
  document.querySelectorAll('#fitViews button').forEach(b => b.onclick = () => view(b.dataset.v));
  addEventListener('keydown', e => { if (open && e.key === 'Escape') { e.stopPropagation(); closeRoom(); } }, true);

  // набор вещей с текстурами из фабрики (index.json + папки с front/back/sleeve.webp)
  async function addPack(base, shopName) {
    const r = await fetch(base + 'index.json'); if (!r.ok) throw new Error('нет ' + base);
    const list = await r.json(), s = {name: shopName || 'Мой гардероб', colHex: '#0e7490'};
    list.forEach(mt => {
      const dir = base + mt.id + '/';
      const p = {name: mt.name, kind: mt.kind, color: mt.color, fit: mt.fit, states: mt.states, zip: mt.zip, collar: mt.collar, id: 'w-' + mt.id, feed: true,
        tex: {front: dir + 'front.webp', back: dir + 'back.webp', sleeve: mt.sleeve ? dir + 'sleeve.webp' : null}, pic: dir + 'front.webp'};
      const it = toItem(p, s); if (!it) return; it.thumb = p.pic;
      const old = W.items.findIndex(i => i.id === it.id); if (old >= 0) W.items[old] = Object.assign(it, {state: W.items[old].state || it.state}); else W.items.push(it);
    });
    persist(); return list.length;
  }

  return {
    setView: kind => { if (R) view(kind); }, setZoom: (z, hh) => { if (R) { R.view.z = z; if (hh != null) R.view.h = hh; } },
    addPack, wear(ids, states) { W.worn = []; ids.forEach(id => putOn(id, true)); Object.entries(states || {}).forEach(([id, st]) => { const it = W.items.find(i => i.id === id); if (it) it.state = st; }); persist(); render(); },
    setState(id, st) { const it = W.items.find(i => i.id === id); if (it) { it.state = st; persist(); render(); } },
    open: openRoom, close: closeRoom, get isOpen() { return open; },
    add, has, count: () => W.items.length, onChange: f => subs.push(f),
    mountBodyControls, isWearable, classify,
    get items() { return W.items; }, get worn() { return worn(); },
  };
}
