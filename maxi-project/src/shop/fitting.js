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
// телосложение: если задан вес — по индексу массы тела (18 → худощавое, 30 → плотное), иначе ползунок
const buildOf = b => b.weight ? Math.max(0, Math.min(1, (b.weight / Math.pow(b.height / 100, 2) - 18) / 12)) : (b.build == null ? 0.5 : b.build);
function bodyDims(b) {
  b = Object.assign({}, b, {build: buildOf(b)});
  const H = b.height / 100, s = H / 1.7, k = 0.86 + b.build * 0.34, R = c => c / 100 / (2 * Math.PI);
  const m = b.sex === 'm';
  return {
    H, s, k, m, b,
    chest: R(b.chest), waist: R(b.waist), hips: R(b.hips),
    neck: 0.052 * s * (m ? 1.12 : 1) * (0.9 + b.build * 0.2),
    shX: m ? 1.42 : 1.3,           // ширина плеч относительно груди
    legX: R(b.hips) * 0.55,
    // бёдра ног заполняют таз: верх ног не уже нижней части туловища (иначе туловище «сидит» на тонких ногах, как на палочках)
    thigh: R(b.hips) * 0.63 * (0.92 + b.build * 0.16),
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
// у мужской фигуры грудная клетка шире и площе (V-силуэт), таз уже; у женской — как было
function sx(d, yf) {
  const base = d.m ? 1.15 + 0.15 * Math.max(0, Math.min(1, (yf - 0.6) / 0.1)) : 1.2;
  const t = Math.max(0, Math.min(1, (yf - 0.72) / 0.08)); return base + (d.shX - base) * t * (yf < 0.82 ? 1 : Math.max(0, 1 - (yf - 0.82) / 0.03));
}
function sz(d, yf) { return d.m ? (yf > 0.64 && yf < 0.8 ? 0.7 : 0.78) : yf > 0.66 && yf < 0.78 ? 0.84 : 0.78; }

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
// плечевой сустав: рука висит вплотную к боку, но не входит в грудную клетку (иначе ткань не может сойтись под рукой)
function armX(d) {
  const th = d.armA || 0.16, dy = 0.08 * d.H, aCh = torsoR(d, 0.72) * sx(d, 0.72);
  return Math.max(d.chest * d.shX * 0.86, aCh + 0.012 + armRad(d, dy / (0.335 * d.H)) - dy * Math.tan(th));
}
function armPose(d, side) {
  const y = 0.8 * d.H, x = side * armX(d);
  return {pos: new THREE.Vector3(x, y, 0), rot: side * (d.armA || 0.16), L: 0.335 * d.H};
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
function buildBody(b, skinMat, d0) {
  const d = d0 || bodyDims(b), g = new THREE.Group(), H = d.H;
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
  const sh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), skinMat); sh.scale.set(Math.max(d.chest * d.shX * 0.98, armX(d) + 0.02), d.chest * 0.42, d.chest * 0.62); sh.position.y = 0.8 * H; g.add(sh);
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
  // без тональной кривой: цвет фото не уходит в розовый/серый; свет кабины лишь чуть оттеняет складки
  const m = new THREE.MeshStandardMaterial({map: t, color: new THREE.Color(0.3, 0.3, 0.3), emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.78, roughness: 0.9, metalness: 0, side: THREE.DoubleSide});
  m.toneMapped = false; return m;
}
// UV половины лофта. Вещь на фото лежит или висит плоско, ширина на фото — половина обхвата,
// поэтому u растёт по дуге (линейно по углу): перед — от правого бока (−90°) к левому (+90°),
// спина — на фото сзади видна зеркально (слева на фото — левый бок человека, +x)
const uFront = ph => 0.5 + Math.max(-Math.PI / 2, Math.min(Math.PI / 2, ph)) / Math.PI;
const uBack = ph => { const ps = ph > 0 ? ph - Math.PI : ph + Math.PI; return 0.5 + Math.max(-Math.PI / 2, Math.min(Math.PI / 2, ps)) / Math.PI; };
// ---------- посадка вещи по её собственному силуэту ----------
// Вещь — не «кожа» фигуры. С фото берётся силуэт: ширина корпуса по высоте, длина, рукав; у брюк — ширина штанины
// вдоль её оси. Сечение вещи — эллипс с периметром = 2 × ширина лёжа (вещь лёжа — две половины обхвата).
// Тело только ограничивает снизу: вещь не может быть уже тела и нижних слоёв. Где ткани больше, чем тела, она
// висит: прямо от плеч и груди, складками; у широких брюк — трубой до пола, лишняя длина собирается внизу.
const ellP = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
function solve(f, lo, hi, target) { for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (f(m) < target) lo = m; else hi = m; } return (lo + hi) / 2; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function interp(arr, t) { t = clamp(t, 0, 1) * (arr.length - 1); const i = Math.min(arr.length - 2, Math.floor(t)), f = t - i; return arr[i] + (arr[i + 1] - arr[i]) * f; }
// сечение тела на высоте yf: полуширина a и полуглубина b (как у фигуры), с плечевым «шаром»
function bodyAB(d, yf) {
  let r = yf < 0.53 ? Math.max(torsoR(d, Math.max(0.47, yf)), d.hips * (yf < 0.5 ? 0.99 : 0.97)) : torsoR(d, yf);
  let a = r * (sx(d, Math.max(0.6, yf)) * 0.98 + 0.02), b = r * (sz(d, yf) + (yf < 0.6 ? 0.04 : 0));
  const dy = (yf - 0.8) * d.H / (d.chest * 0.42);
  if (Math.abs(dy) < 1) { const k = Math.sqrt(1 - dy * dy); a = Math.max(a, Math.max(d.chest * d.shX * 0.98, armX(d) + 0.02) * k); b = Math.max(b, d.chest * 0.62 * k); }
  if (yf < 0.47) { a = Math.max(a, d.legX + d.thigh); b = Math.max(b, d.thigh); }
  return {a, b};
}
// рука: ось от плечевого сустава под углом armA, радиус по длине
const armJ = d => ({x: armX(d), y: 0.8 * d.H, L: 0.335 * d.H, th: d.armA || 0.16});
const armRad = (d, t) => (t < 0.12 ? 0.052 : t < 0.47 ? 0.046 - (t - 0.12) * 0.034 : 0.035 - (t - 0.47) * 0.018) * d.k * d.s;
function armInner(d, y) {
  const j = armJ(d), dy = j.y - y; if (dy < 0.05 || dy > j.L * Math.cos(j.th) + 0.08) return 9;
  return j.x + dy * Math.tan(j.th) - armRad(d, dy / (j.L * Math.cos(j.th))) / Math.cos(j.th) - 0.004;
}
// подобрать эллипс по периметру: сначала пропорция ρ, потом ограничения (тело, нижние слои, руки)
function fitAB(P, amin, bmin, amax, rho) {
  let a = solve(x => ellP(x, x * rho), 0.01, 1.2, P), b = a * rho;
  if (a > amax) { a = Math.max(amax, amin); b = solve(x => ellP(a, x), 0.005, 1.2, P); }
  if (b < bmin) { b = bmin; a = Math.max(amin, Math.min(amax, solve(x => ellP(x, b), 0.005, 1.2, P))); }
  if (a < amin) { a = amin; b = Math.max(bmin, solve(x => ellP(a, x), 0.005, 1.2, P)); }
  return [a, Math.max(b, bmin)];
}
// слои: ширина/глубина надетых ниже вещей по высоте (1% роста)
function layerAB(yf, a, b, gap) {
  if (UNDER) { const u = uget(UNDER, yf), uz = uget(UNDERZ, yf), g = gap == null ? 0.008 : gap; if (u) a = Math.max(a, u + g); if (uz) b = Math.max(b, uz + g); const i = ui(yf); PEND[i] = Math.max(PEND[i] || 0, a); PENDZ[i] = Math.max(PENDZ[i] || 0, b); }
  return [a, b];
}
function noteAB(yf, a, b) { if (!UNDER) return; const i = ui(yf); PEND[i] = Math.max(PEND[i] || 0, a); PENDZ[i] = Math.max(PENDZ[i] || 0, b); }
// складки: смещение по нормали, амплитуда A (м); узор свой у каждой вещи (seed)
function foldAt(phi, y, A, seed) {
  if (A <= 0) return 0;
  return A * (0.5 * Math.sin(7 * phi + seed + 1.7 * Math.sin(y * 7 + seed)) + 0.32 * Math.sin(12 * phi + seed * 2.3 + y * 11) + 0.18 * Math.sin(19 * phi + y * 23 + seed * 0.7));
}
// поверхность из колец {y, a, b, f(складки), cx}: φ от φ0 на длину φL; uvf(φ, кольцо, доля по φ) → [u, v]
function ringMesh(rings, phi0, phiL, segs, uvf, seed, gapf) {
  const n = rings.length, cols = segs + 1, pos = new Float32Array(n * cols * 3), uv = new Float32Array(n * cols * 2), idx = [];
  rings.forEach((r, i) => {
    for (let j = 0; j < cols; j++) {
      const t = j / segs; let p0 = phi0, pl = phiL;
      if (gapf) { const g = gapf(r); if (phi0 < 0) pl = phiL - g; else { p0 = phi0 + g; pl = phiL - g; } }
      const phi = p0 + pl * t, f = foldAt(phi, r.y, r.f || 0, seed) * (r.fk ? r.fk(phi) : 1);
      const x = (r.cx || 0) + (r.a + f) * Math.sin(phi), z = (r.b + f) * Math.cos(phi);
      let y = r.y; if (r.dy) y += r.dy(phi);
      const k = (i * cols + j); pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      const [u, v] = uvf(phi, r, t); uv[k * 2] = u; uv[k * 2 + 1] = 1 - clamp(v, 0, 1);
    }
  });
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < segs; j++) { const a = i * cols + j, b = a + 1, c = a + cols, e = c + 1; idx.push(a, b, c, b, e, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// труба вдоль оси (рукав): от S0 по направлению D, профиль rad(s) (s — метры от S0), складки
function tubeMesh(S0, D, len, rad, segs, rings, uvf, foldf, side, cap) {
  cap = cap || 0.035;
  const e1 = new THREE.Vector3(-D.y, D.x, 0).normalize().multiplyScalar(side || 1), e2 = new THREE.Vector3(0, 0, 1);
  const cols = segs + 1, pos = new Float32Array(rings * cols * 3), uv = new Float32Array(rings * cols * 2), idx = [];
  for (let i = 0; i < rings; i++) {
    const s = -cap + (len + cap) * i / (rings - 1), C = S0.clone().addScaledVector(D, s), r = rad(s);
    for (let j = 0; j < cols; j++) {
      const ps = j / segs * Math.PI * 2, f = foldf ? foldf(ps, s) : 0, rr = r + f;
      const P = C.clone().addScaledVector(e1, Math.cos(ps) * rr).addScaledVector(e2, Math.sin(ps) * rr), k = i * cols + j;
      pos[k * 3] = P.x; pos[k * 3 + 1] = P.y; pos[k * 3 + 2] = P.z;
      const [u, v] = uvf(ps, s); uv[k * 2] = u; uv[k * 2 + 1] = 1 - clamp(v, 0, 1);
    }
  }
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < segs; j++) { const a = i * cols + j, b = a + 1, c = a + cols, e = c + 1; idx.push(a, c, b, b, c, e); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  // нормали наружу: если вышло внутрь — перевернуть треугольники
  const N = g.attributes.normal, mid = Math.floor(rings / 2) * cols, Pm = new THREE.Vector3().fromBufferAttribute(g.attributes.position, mid), Cm = S0.clone().addScaledVector(D, -cap + (len + cap) * Math.floor(rings / 2) / (rings - 1));
  if (new THREE.Vector3().fromBufferAttribute(N, mid).dot(Pm.sub(Cm)) < 0) { const I = g.index.array; for (let q = 0; q < I.length; q += 3) { const t = I[q + 1]; I[q + 1] = I[q + 2]; I[q + 2] = t; } g.index.needsUpdate = true; g.computeVertexNormals(); }
  return g;
}
// изнанка: та же поверхность, тёмная, видна в проёмах (низ, рукава, расстёгнутый перед)
function addShell(g, geo, mat, inner, role) {
  const m = new THREE.Mesh(geo, mat); if (role) m.userData.role = role; g.add(m);
  if (inner) { const mi = new THREE.Mesh(geo, inner); g.add(mi); }
  return m;
}

// ---------- размеры из таблицы магазина ----------
// item.sizesT: [{name, ru, cm:{len, chest | waist, hip, inseam, outseam, hem}, body:{chest:[от,до], waist, hips}}]; item.size — выбранный (или подбор по фигуре)
function recommendSize(item, b) {
  const S = item.sizesT; if (!S || !S.length) return null;
  const top = ['tee', 'sweater', 'hoodie', 'jacket', 'shirt'].includes(item.kind);
  const fits = sz => {
    if (sz.body) { const r = top ? sz.body.chest : sz.body.waist; return r && (top ? b.chest : b.waist) <= r[1]; }
    if (top && sz.cm.chest) return sz.cm.chest * 2 >= b.chest + 6;
    if (!top && sz.cm.waist) return sz.cm.waist * 2 >= b.waist - 1;
    return false;
  };
  return (S.find(fits) || S[S.length - 1]).name;
}
const sizeOf = (item, b) => item.sizesT ? item.sizesT.find(z => z.name === (item.size || recommendSize(item, b))) || item.sizesT[0] : null;
function itemCm(item, b) { const sz = b && sizeOf(item, b); return Object.assign({}, (item.shape && item.shape.cm) || {}, sz ? sz.cm : {}); }
// как сядет: сравнение мерок вещи с фигурой (простыми словами)
function fitNote(item, b) {
  const sz = sizeOf(item, b); if (!sz) return '';
  const c = sz.cm, out = [], top = ['tee', 'sweater', 'hoodie', 'jacket', 'shirt'].includes(item.kind);
  if (sz.body && sz.body.chest && top) { const [lo, hi] = sz.body.chest; out.push(b.chest > hi ? 'мало в груди по таблице (' + lo + '–' + hi + ' см)' : b.chest < lo - 4 ? 'велико по таблице' : 'твой размер по таблице магазина'); }
  if (top && c.chest) { const e = c.chest * 2 - b.chest; out.push(e < 0 ? 'в обтяжку' : e < 8 ? 'по фигуре' : e < 18 ? 'свободно' : 'оверсайз'); }
  if (!top && c.waist) { const e = c.waist * 2 - b.waist; out.push(e < -2 ? 'пояс мал (' + c.waist * 2 + ' см при талии ' + b.waist + ')' : e <= 4 ? 'пояс по талии' : 'пояс свободный — с ремнём'); }
  if (!top && c.hip) { const e = c.hip * 2 - b.hips; out.push(e > 25 ? 'очень свободно в бёдрах' : e > 10 ? 'свободно в бёдрах' : 'по бёдрам'); }
  if (!top && c.outseam) { const need = b.height * 0.595 - 2, dl = Math.round(c.outseam - need); out.push(dl > 4 ? 'длинные: ~' + dl + ' см ложится на обувь' : dl < -6 ? 'укороченные' : 'до обуви'); }
  return out.join(' · ');
}

// длина вещи по спинке (м), если мерок нет: типичная для своего размера, чуть зависит от роста
const LEN0 = {tee: 0.71, sweater: 0.68, hoodie: 0.68, jacket: 0.68, shirt: 0.76};
function cleanTail(arr) {
  const a = arr.slice(), med = a.slice(2, -3).sort((x, y) => x - y)[Math.floor((a.length - 5) / 2)] || a[0];
  for (let i = a.length - 1; i > a.length - 5; i--) if (a[i] < med * 0.86) a[i] = Math.max(a[i], (a[i - 1] || med) * 0.97);
  for (let i = a.length - 3; i < a.length; i++) a[i] = Math.max(a[i], a[i - 1] * 0.975);   // низ вещи прямой, не «собран»
  return a;
}
// параметры верха на этой фигуре
function topSpec(item, d) {
  const sh = item.shape || {}, cm = itemCm(item, d.b), k = item.kind, H = d.H;
  let L = cm.len ? cm.len / 100 : (LEN0[k] || 0.7) * (sh.crop ? 0.84 : 1) * Math.pow(H / 1.8, 0.6);
  // вещь снята на модели: длину берём с фото — где низ относительно пояса брюк (hem_waist), разница размеров — по таблице
  if (sh.worn && sh.hem_waist != null) {
    const yW = 0.595 * H, yN = 0.858 * H, yHemPhoto = yW - sh.hem_waist * (yN - yW) - 0.012 * H;
    L = 0.848 * H - yHemPhoto + (cm.len && sh.ref_len ? (cm.len - sh.ref_len) / 100 : 0);
  }
  // на вешалке вещь сужается (калибровка — футболка Zolla лёжа и на вешалке); у вязаных и плотных — меньше
  const hk = !sh.hang ? 1 : k === 'jacket' ? 0.86 : sh.merged ? 0.8 : 0.72;
  // рукава висят вдоль корпуса и закрывают боковые швы: корпус ≈ 85% общей ширины (у пиджака плечи жёсткие — 92%)
  let Fs = sh.merged && sh.full ? new Array(16).fill(sh.full * (k === 'jacket' ? 0.92 : 0.85) / hk * L) : cleanTail(sh.tw || [0.62]).map(v => v / hk * L);
  if (cm.chest) { const f = cm.chest / 100 / Fs[1]; Fs = Fs.map(v => v * f); }
  const yHPS = 0.848 * H, yHem = yHPS - L, yN = 0.858 * H;
  const bc = bodyAB(d, 0.72), Fbody = ellP(bc.a, bc.b) / 2;
  const loose = clamp((Fs[1] - Fbody) / (0.24 * Fbody), 0, 1.5);
  const yArm = Math.min(yHPS - (0.25 + 0.07 * loose) * L, 0.758 * H);
  const F = y => y >= yArm ? Fs[0] * 0.6 + Fs[1] * 0.4 : interp(Fs, (yArm - y) / (yArm - yHem));
  const ease = (EASE[k] || 0.014) * 0.6 + 0.006;
  // плечевая точка: у свободной вещи плечо «спущено» — шов ниже по руке
  const Sx = Math.max(d.chest * d.shX * 0.98, armX(d) + 0.02), aFree = solve(x => ellP(x, x * 0.6), 0.01, 1.2, 2 * F(yArm - 0.03));
  const xS = Math.max(Sx * 0.92 + ease, aFree * 0.98, armX(d) - 0.005);   // плечо вещи накрывает плечевой сустав
  const ySh = xS < Sx ? 0.8 * H + d.chest * 0.42 * Math.sqrt(1 - (xS / Sx) ** 2) + ease : 0.8 * H - (xS - Sx) * 1.1 + ease;
  return {L, Fs, F, yHPS, yHem, yN, yArm, loose, ease, xS, ySh: Math.max(ySh, yArm + 0.05), aFree, hk};
}
function bottomSpec(item, d) {
  const sh = item.shape || {}, cm = itemCm(item, d.b), k = item.kind, H = d.H;
  let yW = 0.595 * H; const bw = bodyAB(d, 0.595), Fw = ellP(bw.a, bw.b) / 2;
  // масштаб: пояс садится на талию (на резинке лёжа собран ~в 1.2 раза); у длинных брюк ещё и длина «до пола» — берём среднее
  const kW = (cm.waist ? cm.waist / 100 : (Fw + 0.012) / (sh.elastic ? 1.1 : 1));
  const tot = (sh.rise || 0.75) + (sh.leg_len || 1.6), full = k !== 'shorts' && !/укороч|кюлот|капри/i.test(item.name || '');
  const kk = cm.outseam ? cm.outseam / 100 / tot : kW;
  // длинные брюки шьют «до пола»: если по фото вышли короче щиколотки — дотянуть
  const T = full && !cm.outseam ? Math.max(tot * kk, yW - 0.025 * H) : tot * kk;
  let yC = 0.47 * H - 0.015;                                  // шаг: по фото лёжа не виден (штанины лежат вплотную), берём по фигуре
  // по таблице размеров: шаг = длина − шаговый шов; короткий шаг сажает брюки ниже на бёдрах, длинный — «спущенный» шаг
  // длина − шаговый шов = посадка по ткани (по изгибу спереди); по вертикали она ≈ на 20% короче
  if (cm.outseam && cm.inseam) { const rise = (cm.outseam - cm.inseam) / 100 * 0.8, bodyC = 0.47 * H - 0.012; yC = Math.min(yW - rise, bodyC); yW = yC + rise; }
  let legLen = T - (yW - yC), yHem = yC - legLen, stack = 0;
  if (yHem < 0.012) { stack = 0.012 - yHem; yHem = 0.012; legLen = yC - yHem; }
  let lw = (sh.leg || [0.6]).slice(); if (lw.length > 2 && lw[lw.length - 1] < lw[lw.length - 2] * 0.8) lw[lw.length - 1] = lw[lw.length - 2] * 0.96;
  lw = lw.map(v => v * kk);
  // мерки таблицы: низ штанины и бёдра точные, профиль между ними — по фото
  // низ на фото шумный (обувь, тень): опора — медиана нижней трети без двух последних точек; последние две = мерка низа
  // масштаб штанины: от бедра (полуобхват бёдер × 0.55 ≈ ширина штанины у шага лёжа), форма книзу — по фото;
  // «низ» из таблицы — только если нет бёдер (его часто меряют по-разному: по кругу или лёжа)
  if (cm.hip) { const f = cm.hip / 100 * 0.55 / lw[0]; lw = lw.map(v => v * f); const n = lw.length; lw[n - 1] = Math.max(lw[n - 1], lw[n - 3] * 0.9); lw[n - 2] = Math.max(lw[n - 2], lw[n - 3] * 0.95); }
  else if (cm.hem) { const n = lw.length, ref = lw.slice(Math.max(0, n - 6), n - 2).sort((a, b) => a - b)[1] || lw[n - 1], f = cm.hem / 100 / ref;
    lw = lw.map(v => v * f); lw[n - 1] = lw[n - 2] = cm.hem / 100; }
  for (let i = 1; i < lw.length - 1 && cm.hip; i++) lw[i] = Math.min(lw[i], lw[0] * 1.15);
  // бёдра (полуобхват): по таблице или по фото (середина посадки; ниже на фото лёжа уже расходятся штанины)
  const hip = cm.hip ? cm.hip / 100 : sh.hip && sh.hip.length > 3 ? sh.hip[3] * kk : 0;
  return {yW, yC, yHem, legLen, stack, lw, kk, ww: kW, T, hip};
}
// насколько вещь раздвигает руки (широкая вещь — руки лежат на ней, а не протыкают)
function armSpread(items, d) {
  let th = 0.13; const j = armJ({...d, armA: 0.13});
  items.forEach(it => {
    if (!it.tex || !it.shape) return;
    const tops = ['tee', 'sweater', 'hoodie', 'jacket', 'shirt'].includes(it.kind);
    const ys = tops ? [0.7, 0.64, 0.58] : [0.55, 0.5];
    let sp = null; if (tops) sp = topSpec(it, d); else sp = bottomSpec(it, d);
    ys.forEach(yf => {
      const y = yf * d.H; let a;
      if (tops) { if (y < sp.yHem) return; a = solve(x => ellP(x, x * 0.66), 0.01, 1.2, 2 * sp.F(y)); }
      else { const bw = bodyAB(d, yf); a = bw.a + 0.02; }
      const dy = j.y - y, need = a + armRad(d, dy / j.L) * 1.0 + 0.004;
      th = Math.max(th, Math.atan((need - j.x) / dy));
    });
  });
  return clamp(th, 0.13, 0.22);
}

function photoGarment(item, d) {
  const g = new THREE.Group(), H = d.H, T = item.tex, k = item.kind, st = item.state || '', base = item.color || '#888';
  const mF = photoMat(T.front, base), mB = photoMat(T.back || T.front, base), mS = T.sleeve ? photoMat(T.sleeve, base) : photoMat(null, base);
  [mF, mB, mS].forEach(m => { m.side = THREE.FrontSide; });
  const inner = new THREE.MeshStandardMaterial({color: LIN(base).multiplyScalar(0.45), roughness: 0.95, side: THREE.BackSide});
  const metal = new THREE.MeshStandardMaterial({color: LIN('#c9ccd0'), roughness: 0.3, metalness: 0.9});
  const seed = [...(item.id || 'x')].reduce((s, c) => s + c.charCodeAt(0), 0) % 17 * 0.37;
  if (['tee', 'sweater', 'hoodie', 'jacket', 'shirt'].includes(k)) {
    const sp = topSpec(item, d), {ease} = sp, long = k !== 'tee';
    let yHem = sp.yHem; const tucked = st === 'tucked';
    const band = (k === 'sweater' || k === 'hoodie') && !tucked ? 0.055 : 0;
    if (tucked) yHem = Math.max(yHem, 0.585 * H);
    const rings = [];
    // корпус: от низа до проймы — по ширине с фото
    const rho = k === 'jacket' ? 0.66 : 0.6;
    const ySt = []; for (let y = yHem; y < sp.yArm; y += 0.012) ySt.push(y); ySt.push(sp.yArm);
    ySt.forEach(y => {
      const yf = y / H, bd = bodyAB(d, yf); let P = 2 * sp.F(y);
      let [a, b] = fitAB(P, bd.a + ease, bd.b + ease, Math.max(bd.a + ease, armInner(d, y)), rho);
      if (band && y < yHem + band) { const t = 1 - (y - yHem) / band, aa = bd.a + ease + 0.012, bb = bd.b + ease + 0.012; a = lerp(a, Math.max(aa, Math.min(a, aa + 0.02)), smooth(t * 1.6) * 0.75); b = lerp(b, Math.max(bb, Math.min(b, bb + 0.02)), smooth(t * 1.6) * 0.75); }
      if (tucked) { const t = clamp((0.64 * H - y) / (0.64 * H - yHem), 0, 1); a = lerp(a, bd.a + ease, smooth(t)); b = lerp(b, bd.b + ease, smooth(t)); if (y < 0.635 * H && y > 0.6 * H) { a += 0.012; b += 0.01; } }
      [a, b] = layerAB(yf, a, b, tucked && y < 0.6 * H ? 0.002 : 0.008);
      const loose = Math.max(0, a - bd.a - ease) * 0.35 + Math.max(0, b - bd.b - ease) * 0.3;
      const f = clamp(loose, 0, 0.016) * smooth((sp.yArm - y) / 0.1) * (band && y < yHem + band ? 0.4 : 1) + 0.0015;
      // складки уходят и внутрь — над нижней вещью отступаем на их глубину, чтобы она не проступала
      if (UNDER && !(tucked && y < 0.6 * H)) { const u = uget(UNDER, yf), uz = uget(UNDERZ, yf); if (u) a = Math.max(a, u + 0.006 + f * 1.1); if (uz) b = Math.max(b, uz + 0.006 + f * 1.1); noteAB(yf, a + f, b + f); }
      rings.push({y, a, b, f});
    });
    // ткань не делает «ступенек»: если внизу её что-то распирает (широкие брюки), выше она расходится плавно, как трапеция
    for (let i = 1; i < rings.length; i++) { const r = rings[i], q = rings[i - 1], dy = r.y - q.y; r.a = Math.max(r.a, q.a - dy * 0.9); r.b = Math.max(r.b, q.b - dy * 0.9); }
    // кокетка: от проймы до плечевой точки, потом плечо к горловине
    const last = rings[rings.length - 1], rnx = d.neck * 1.32 + 0.012, rnz = d.neck * 1.18 + 0.012;
    const yoke = 6; for (let i = 1; i <= yoke; i++) { const t = i / yoke, y = lerp(sp.yArm, sp.ySh, t), yf = y / H, bd = bodyAB(d, yf);
      let a = Math.max(lerp(last.a, sp.xS, smooth(t)), bd.a + ease), b = Math.max(lerp(last.b, last.b * 0.9, t), bd.b + ease); [a, b] = layerAB(yf, a, b); rings.push({y, a, b, f: 0.0015}); }
    const cap = 12; for (let i = 1; i <= cap; i++) { const t = i / cap, y = lerp(sp.ySh, sp.yN, t), yf = y / H, bd = bodyAB(d, yf);
      const nb = yf > 0.84 ? {a: d.neck + ease, b: d.neck + ease} : bd;
      let a = Math.max(lerp(sp.xS, rnx, Math.pow(t, 0.85)), nb.a + ease * 0.7), b = Math.max(lerp(rings[rings.length - 1].b, rnz, Math.pow(t, 1.4)), nb.b + ease * 0.7);
      if (t === 1) { a = Math.max(rnx, a); b = Math.max(rnz, b); }
      [a, b] = layerAB(yf, a, b, 0.004); rings.push({y, a, b, f: 0}); }
    // горловина спереди ниже
    const yTop = sp.yN, nDrop = (item.collar ? 0.012 : 0.032) * d.s;
    rings.forEach(r => { if (r.y > yTop - 0.04) { const w = (r.y - (yTop - 0.04)) / 0.04; r.dy = phi => -nDrop * w * Math.pow(Math.max(0, Math.cos(phi)), 2); } });
    const vOf = y => (yTop - y) / (yTop - yHem) * 0.985;
    const open = st === 'open', gapf = open ? (r => (k === 'jacket' ? 0.3 : 0.3) + (k === 'jacket' ? 0.3 : 0.3) * (1 - smooth((r.y - yHem) / (yTop - yHem)))) : null;
    const uvF = (phi, r, t) => [open ? (phi < 0 ? t * 0.5 : 0.5 + t * 0.5) : uFront(phi), vOf(r.y)];
    const uvB = (phi, r, t) => [t, vOf(r.y)];
    if (open) { addShell(g, ringMesh(rings, -Math.PI / 2, Math.PI / 2, 22, uvF, seed, gapf), mF, inner, 'front'); addShell(g, ringMesh(rings, 0, Math.PI / 2, 22, uvF, seed, gapf), mF, inner, 'front'); }
    else addShell(g, ringMesh(rings, -Math.PI / 2, Math.PI, 44, uvF, seed), mF, inner, 'front');
    addShell(g, ringMesh(rings, Math.PI / 2, Math.PI, 44, uvB, seed + 3), mB, inner, 'back');
    // рукава
    const j = armJ(d), armDepth = sp.yHPS - sp.yArm;
    const drop = Math.max(0, sp.xS - d.chest * d.shX * 0.92);
    // рукав у проймы: обхват ≈ 2 × глубина проймы; не уже руки
    const r0 = Math.max(armRad(d, 0) + 0.007, armDepth * 0.9 / Math.PI);
    const sl = item.shape && item.shape.sl_len ? item.shape.sl_len * sp.L * 0.78 : 0.24;
    const Ls = long ? j.L + 0.035 + drop * 0.5 : clamp(sl + drop, 0.12, 0.42);
    const r1 = long ? (k === 'jacket' ? 0.056 : 0.043) * d.s : Math.max(r0 * 0.86, armRad(d, Ls / j.L) + 0.014);
    [-1, 1].forEach(side => {
      const D = new THREE.Vector3(Math.sin(j.th) * side, -Math.cos(j.th), 0);
      const out = new THREE.Vector3(Math.cos(j.th) * side, Math.sin(j.th), 0), S0 = new THREE.Vector3(j.x * side, j.y, 0).addScaledVector(D, r0 * 0.4).addScaledVector(out, Math.max(0, r0 - armRad(d, 0) - ease) * 0.45 + drop * 0.25);
      // верх рукава — округлый (как плечо), уходит под кокетку
      const rad = s => s < 0 ? r0 * Math.sqrt(Math.max(0.04, 1 - (s / (r0 * 0.95)) ** 2)) :
        long ? Math.max(armRad(d, s / j.L) + 0.01, lerp(r0, r1 * 1.25, smooth(s / (Ls * 0.9))) - (s > Ls - 0.05 ? (s - (Ls - 0.05)) / 0.05 * r1 * 0.25 : 0)) : lerp(r0, r1, s / Ls);
      const looseS = Math.max(0, r0 - armRad(d, 0) - ease);
      const foldf = (ps, s) => s < 0 ? 0 : (long ? 0.004 * smooth((s - Ls * 0.6) / (Ls * 0.4)) * Math.sin(s * 95 + ps * 2 + seed) : 0) + looseS * 0.18 * Math.sin(ps * 5 + seed + s * 6) * smooth(s / 0.08);
      const geo = tubeMesh(S0, D, Ls, rad, 28, 30, (ps, s) => [Math.abs(((ps / Math.PI + (side > 0 ? 0 : 1)) % 2) - 1), Math.max(0, s) / Ls], foldf, side, r0 * 0.95);
      addShell(g, geo, mS, inner);
    });
    if (item.zip && !open) {
      const pts = rings.filter(r => r.y < yTop - 0.03).map(r => new THREE.Vector3(0, r.y, r.b + 0.003));
      if (pts.length > 2) g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0035, 6, false), metal));
    }
    if (k === 'hoodie' || item.hood) {
      const hs = Math.max(0.13 * d.s, rnx * 1.6);
      if (st === 'hood') {
        const hood = new THREE.Mesh(new THREE.SphereGeometry(hs, 28, 18, Math.PI * 0.86, Math.PI * 1.28, 0.0, Math.PI * 0.74), mS);
        hood.position.set(0, 0.928 * H, -0.006 * d.s); hood.scale.set(1.0, 1.18, 1.08); g.add(hood);
        const hi = new THREE.Mesh(hood.geometry, inner); hi.position.copy(hood.position); hi.scale.copy(hood.scale); g.add(hi);
      } else {
        // капюшон снят: валик вокруг шеи сзади и полотно, лежащее на спине
        const plain = new THREE.MeshStandardMaterial({color: LIN(base), roughness: 0.9});
        const roll = new THREE.Mesh(new THREE.TorusGeometry(1, 0.3, 10, 24, Math.PI * 1.1), plain);
        roll.rotation.set(Math.PI / 2, 0, Math.PI * 0.95); roll.scale.set(rnx + 0.02, rnz + 0.03, 0.1); roll.position.set(0, yTop - 0.006, -0.004); g.add(roll);
        const yb = yTop - 0.13 * d.s, rb = rings.reduce((m, r) => Math.abs(r.y - yb) < Math.abs(m.y - yb) ? r : m, rings[0]);
        const pan = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), plain);
        pan.rotation.x = -Math.PI / 2 + 0.1; pan.scale.set(rnx * 1.35, 0.022, hs * 0.72); pan.position.set(0, yTop - hs * 0.68, -rb.b - 0.002); g.add(pan);
      }
    }
    if (item.collar || k === 'jacket') {
      const col = new THREE.Mesh(new THREE.TorusGeometry(1, 0.016 / rnx, 8, 28), mS); col.rotation.x = Math.PI / 2; col.position.y = yTop + 0.004; col.scale.set(rnx + 0.004, rnz + 0.004, rnx); g.add(col);
    }
  } else {
    // низ: пояс → бёдра → две штанины-трубы по ширине с фото, лишняя длина — гармошкой у пола
    const sp = bottomSpec(item, d), cv = clamp((item.fit && item.fit.crotch) || 0.42, 0.15, 0.75), ease = 0.008;
    const vHip = y => (sp.yW - y) / (sp.yW - sp.yC) * cv;
    const vLeg = y => cv + (sp.yC - y) / (sp.yC - sp.yHem) * (1 - cv);
    // штанины
    const legR = t => sp.lw.length ? interp(sp.lw, t) / Math.PI : 0.07;     // t: 0 — у шага, 1 — низ
    const bodyLeg = y => { const yf = y / H, tab = [[0.04, 0.034], [0.07, 0.038], [0.15, 0.058 * d.k], [0.24, 0.05 * d.k], [0.28, 0.053 * d.k], [0.38, d.thigh * 0.88], [0.47, d.thigh], [0.5, d.thigh * 0.98]];
      for (let i = 1; i < tab.length; i++) if (yf <= tab[i][0]) { const t = (yf - tab[i - 1][0]) / (tab[i][0] - tab[i - 1][0]); return (tab[i - 1][1] + (tab[i][1] - tab[i - 1][1]) * t) * (yf > 0.3 ? 1 : d.s); } return d.thigh; };
    // штанины висят от бёдер и касаются друг друга у шага; книзу чуть расходятся
    const rTop = Math.max(legR(0), d.thigh + ease), hipA = bodyAB(d, 0.5).a + ease + 0.004;
    // широкие брюки не облегают: зад и бёдра — по мерке вещи (сколько ткани, столько и ширины), тело только не даёт уйти внутрь
    const hb = bodyAB(d, 0.53);
    // лишняя ткань в заду не держит форму овала: висит складками. Вширь — не больше ~4.5 см на сторону, вглубь ~5 см, остальное — складки
    let [aH, bH] = sp.hip ? fitAB(2 * sp.hip, hb.a + ease, hb.b + ease, 9, 0.66) : [hipA, hb.b + ease];
    const seatExtra = sp.hip ? Math.max(0, ellP(aH, bH) - ellP(Math.min(aH, hb.a + ease + 0.008), Math.min(bH, hb.b + ease + 0.035))) : 0;
    aH = Math.min(aH, hb.a + ease + 0.008); bH = Math.min(bH, hb.b + ease + 0.035);
    const xcTop = Math.max(d.legX, Math.min(rTop * 0.96 + 0.004, Math.max(hipA, aH) - rTop * 0.9));
    const aSeat = Math.max(hipA, aH);                             // полуширина зада: верх штанин её продолжает
    const seatB = Math.max(bH, hb.b + ease) * 0.95;               // полуглубина зада (ось штанины на той же линии, что и центр тела)
    const stackH = sp.stack ? Math.min(0.22, 0.05 + sp.stack * 1.6) : 0;
    [-1, 1].forEach(side => {
      const rings = [];
      for (let y = sp.yHem; y <= sp.yC + 0.06 + 1e-6; y += 0.012) {
        const t = clamp((sp.yC - y) / sp.legLen, 0, 1);
        let r = Math.max(legR(t), bodyLeg(y) + ease);
        if (y > sp.yC) r = Math.max(r, rTop);
        let st_ = 0;
        if (stackH && y < sp.yHem + stackH) { st_ = smooth(1 - (y - sp.yHem) / stackH); r += 0.008 * st_; }
        // у шага штанины могут заходить друг на друга, ниже (с ~15% длины) — висят рядом, каждая своей ширины
        // штанины висят от линии бёдер: если зад шире двух штанин — между ними просвет, но не уже зада снаружи
        // у шага штанины касаются друг друга (без просвета), а ткань зада продолжается в них: верх штанины не уже половины зада
        r = Math.max(r, lerp(aSeat / 2 + 0.003, r, smooth(t / 0.35)));
        // спереди верх штанин не шире зада (широкая штанина у бедра уходит вглубь и в складки), ниже колена — своей ширины
        const aLeg = Math.max(bodyLeg(y) + ease, Math.min(r, lerp(aSeat / 2 + 0.003, r, smooth((t - 0.15) / 0.45))));
        const bLeg = Math.max(aLeg < r ? solve(x => ellP(aLeg, x), aLeg, 1, 2 * Math.PI * r) : r, lerp(seatB, r, smooth(t / 0.35)));
        const xc = side * (Math.max(d.legX, aLeg * 0.96 + 0.004) + 0.03 * smooth(t));
        const loose = Math.max(0, r - bodyLeg(y) - ease);
        const ripple = st_ ? 0.006 * st_ * Math.sin(y * 120 + seed) : 0;
        rings.push({y, a: aLeg + ripple, b: bLeg + ripple, cx: xc, f: clamp(loose * 0.22, 0, 0.012) + 0.0015});
        { const fl = clamp(loose * 0.22, 0, 0.012) + 0.0015; noteAB(y / H, Math.abs(xc) + aLeg + fl, bLeg * 1.2 + fl); }   // ширина штанин со складками — для верха, что надет поверх
      }
      const leftHalf = f => (f ? side < 0 : side > 0);
      [[-Math.PI / 2, mF, true], [Math.PI / 2, mB, false]].forEach(([p0, mat, front]) => {
        const geo = ringMesh(rings, p0, Math.PI, 26, (phi, r, t) => [(leftHalf(front) ? 0 : 0.5) + t * 0.5, vLeg(Math.min(r.y, sp.yC))], seed + side);
        addShell(g, geo, mat, inner, front ? 'front' : 'back');
      });
    });
    // бёдра: от пояса (по фигуре + припуск) вниз к ширине двух штанин
    const rings = [], bw = bodyAB(d, sp.yW / H);
    const [aW, bW] = fitAB(2 * Math.max(sp.ww, ellP(bw.a, bw.b) / 2 + ease), bw.a + ease, bw.b + ease, 9, bw.b / bw.a);
    const aBot = Math.max(hipA, aH), bBot = Math.max(rTop, bH, bodyAB(d, 0.5).b + ease);
    // снизу бёдра переходят в «перемычку» у шага: закрывает просвет между штанинами
    for (let y = sp.yC - 0.045; y <= sp.yW + 1e-6; y += 0.012) {
      const yf = y / H, bd = bodyAB(d, yf), t = smooth((sp.yW - y) / (sp.yW - sp.yC)), lo = clamp((sp.yC - y) / 0.045, 0, 1);
      // пояс по талии → зад по мерке бёдер (к середине посадки) → ширина двух штанин у шага
      const t1 = smooth(t / 0.5);
      let a = Math.max(lerp(aW, Math.max(aH, aW), t1), lerp(aW, aBot, t), bd.a + ease), b = Math.max(lerp(bW, Math.max(bH, bW), t1), lerp(bW, bBot, t), bd.b + ease);
      if (lo > 0) { a = aBot * (1 - 0.25 * lo); b = bBot * (1 - 0.35 * lo); }
      [a, b] = layerAB(yf, a, b);
      const fz = clamp((a - bd.a) * 0.08 + seatExtra * 0.03 * t1, 0, 0.012) * Math.max(t, t1 * 0.6);
      noteAB(yf, a + fz, b + fz);                                  // складки зада тоже учитываем: верх не должен их «протыкать»
      rings.push({y, a, b, f: fz});
    }
    addShell(g, ringMesh(rings, -Math.PI / 2, Math.PI, 40, (phi, r) => [uFront(phi), vHip(r.y)], seed), mF, inner, 'front');
    addShell(g, ringMesh(rings, Math.PI / 2, Math.PI, 40, (phi, r, t) => [t, vHip(r.y)], seed + 1), mB, inner, 'back');
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------- симуляция ткани (вариант «В», прототип) ----------
// Плоский силуэт вещи с фото — это её выкройка: перед и спинка, сшитые по краю (кроме горловины, низа, рукавов; у брюк — пояса и низа).
// Выкройку растягиваем до настоящих размеров, ставим один слой перед фигурой, другой за ней, «сшиваем» края и опускаем под тяжестью.
// Ткань: точки и связи (Position Based Dynamics) — не тянется сверх длины, легко сжимается (так и появляются складки), чуть сопротивляется изгибу;
// не проходит сквозь тело, нижние слои и пол. Картинка — само вырезанное фото, без выпрямления.
// пока прототип: на сайте включается адресом ?drape=1 (в лаборатории — всегда)
let DRAPE_ON = typeof location !== 'undefined' && /[?&]drape=1/.test(location.search);
export function setDrape(v) { DRAPE_ON = !!v; }
// фигура для столкновений: туловище — эллипсы по высоте, ноги — круги, руки — капсулы, шея и голова, пол
function makeCollider(d, under) {
  const H = d.H, N = 400, A = new Float32Array(N), B = new Float32Array(N), LR = new Float32Array(N);
  const legTab = [[0.04, 0.032], [0.07, 0.036], [0.15, 0.056 * d.k], [0.24, 0.047 * d.k], [0.28, 0.05 * d.k], [0.38, d.thigh * 0.86], [0.47, d.thigh], [0.5, d.thigh * 0.98]];
  const legAt = yf => { if (yf > 0.5) return 0; for (let i = 1; i < legTab.length; i++) if (yf <= legTab[i][0]) { const t = (yf - legTab[i - 1][0]) / (legTab[i][0] - legTab[i - 1][0]); return (legTab[i - 1][1] + (legTab[i][1] - legTab[i - 1][1]) * t) * (yf > 0.3 ? 1 : d.s); } return legTab[0][1] * d.s; };
  for (let i = 0; i < N; i++) {
    const yf = i / N;
    // туловище без плечевого шара (его ниже — как объёмное тело, иначе ткань соскальзывает с плеч вбок)
    if (yf >= 0.47 && yf <= 0.835) { const r = yf < 0.53 ? Math.max(torsoR(d, Math.max(0.47, yf)), d.hips * (yf < 0.5 ? 0.99 : 0.97)) : torsoR(d, yf); A[i] = r * (sx(d, Math.max(0.6, yf)) * 0.98 + 0.02); B[i] = r * (sz(d, yf) + (yf < 0.6 ? 0.04 : 0)); }
    LR[i] = legAt(yf);
    if (under) { const u = under.a[Math.round(yf * 100)] || 0, uz = under.b[Math.round(yf * 100)] || 0; if (u > A[i]) { A[i] = u; B[i] = Math.max(B[i], uz); } }
  }
  const j = armJ(d), arms = [-1, 1].map(side => ({x0: j.x * side, y0: j.y, dx: Math.sin(j.th) * side, dy: -Math.cos(j.th), L: j.L}));
  const m = 0.007, hr = 0.098 * d.s, SX = Math.max(d.chest * d.shX * 0.98, armX(d) + 0.02), SY = d.chest * 0.42, SZ = d.chest * 0.62;
  return function push(P, i) {
    let x = P[i], y = P[i + 1], z = P[i + 2], hit = false;
    if (y < 0.004) { y = 0.004; hit = true; }
    const k = Math.max(0, Math.min(N - 1, Math.round(y / H * N)));
    if (A[k] > 0) { const a = A[k] + m, b = B[k] + m, q = (x / a) ** 2 + (z / b) ** 2; if (q < 1) { const s = 1 / Math.sqrt(Math.max(q, 1e-6)); x *= s; z *= s; hit = true; } }
    if (LR[k] > 0) for (const side of [-1, 1]) { const cx = side * d.legX, r = LR[k] + m, dx = x - cx, dd = Math.hypot(dx, z); if (dd < r) { const s = r / Math.max(dd, 1e-5); x = cx + dx * s; z *= s; hit = true; } }
    { // плечи: эллипсоид, выталкивание по нормали (с верха плеча — вверх)
      const ex = x / (SX + m), ey = (y - 0.8 * H) / (SY + m), ez = z / (SZ + m), q = ex * ex + ey * ey + ez * ez;
      if (q < 1) { const s = 1 / Math.sqrt(Math.max(q, 1e-6)); x *= s; y = 0.8 * H + (y - 0.8 * H) * s; z *= s; hit = true; } }
    const yf = y / H;
    if (yf > 0.83 && yf < 0.9) { const r = d.neck + m, dd = Math.hypot(x, z); if (dd < r) { const s = r / Math.max(dd, 1e-5); x *= s; z *= s; hit = true; } }
    { const ex = x / (hr * 0.9 + m), ey = (y - 0.93 * H) / (hr * 1.16 + m), ez = z / (hr + m), q = ex * ex + ey * ey + ez * ez; if (q < 1) { const s = 1 / Math.sqrt(q); x *= s; y = 0.93 * H + (y - 0.93 * H) * s; z *= s; hit = true; } }
    for (const a of arms) {
      const t = Math.max(0, Math.min(a.L, (x - a.x0) * a.dx + (y - a.y0) * a.dy)), px = a.x0 + a.dx * t, py = a.y0 + a.dy * t;
      const dx = x - px, dy = y - py, dd = Math.hypot(dx, dy, z), r = armRad(d, t / a.L) + m;
      if (dd < r) { const s = r / Math.max(dd, 1e-5); x = px + dx * s; y = py + dy * s; z *= s; hit = true; }
    }
    P[i] = x; P[i + 1] = y; P[i + 2] = z; return hit;
  };
}
// выкройка из сетки силуэта: точки внутри, связи, край (для шва)
function buildPattern(dr, step, close) {
  const gw = dr.gw, gh = dr.gh;
  let G = dr.grid.map(row => [...row].map(ch => ch === '1'));
  // щель между висящим рукавом и боком (на фото с вешалки) — закрыть: иначе под мышкой получится дыра
  if (close) { const R = close, dil = G.map((row, r) => row.map((_, c) => { for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) { const rr = r + a, cc = c + b; if (rr >= 0 && cc >= 0 && rr < gh && cc < gw && G[rr][cc]) return true; } return false; }));
    const A_ = dr.a, zone = (r, c) => { const v = (r + 0.5) / gh, du = Math.abs((c + 0.5) / gw - A_.cx); return v > A_.arm * 0.55 && v < A_.arm + 0.2 && du > A_.hw * 0.8 && du < A_.hw * 1.5; };
    G = dil.map((row, r) => row.map((v, c) => { if (G[r][c]) return true; if (!v || !zone(r, c)) return false;
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) { const rr = r + a, cc = c + b; if (rr >= 0 && cc >= 0 && rr < gh && cc < gw && !dil[rr][cc]) return false; } return true; })); }
  const inside = (r, c) => r >= 0 && c >= 0 && r < gh && c < gw && G[r][c];
  const idx = new Map(), pts = [];
  for (let r = 0; r < gh; r += step) for (let c = 0; c < gw; c += step) if (inside(r, c)) { idx.set(r * 10000 + c, pts.length); pts.push({r, c, u: (c + 0.5) / gw, v: (r + 0.5) / gh}); }
  const at = (r, c) => idx.get(r * 10000 + c);
  pts.forEach(p => { p.edge = [[-step, 0], [step, 0], [0, -step], [0, step]].some(([dr_, dc]) => at(p.r + dr_, p.c + dc) == null); });
  const tris = [];
  pts.forEach((p, i) => { const a = i, b = at(p.r, p.c + step), c = at(p.r + step, p.c), e = at(p.r + step, p.c + step);
    if (b != null && c != null && e != null) { tris.push(a, c, b, b, c, e); } else if (b != null && e != null) tris.push(a, e, b); else if (c != null && e != null) tris.push(a, c, e); else if (b != null && c != null) tris.push(a, c, b); });
  return {pts, at, tris, step};
}

export function drapeGarment(item, d, under) {
  const dr = item.drape && item.drape.front; if (!dr || !DRAPE_ON) return null;
  if (item.shape && (item.shape.worn || item.shape.merged)) return null;   // длинные рукава на вешалке слились с корпусом — выкройку рукава не выделить, пока старый способ   // силуэт с фото на человеке — не выкройка (ткань там уже обернула тело); пока старый способ
  const drB = item.drape.back || dr, H = d.H, k = item.kind, top = ['tee', 'sweater', 'hoodie', 'jacket', 'shirt'].includes(k);
  const pat = buildPattern(dr, 2, top && item.shape && item.shape.hang ? 3 : 0), np_ = pat.pts.length, a = dr.a;
  // масштаб выкройки (м на долю кадра): верх — длина и ширина корпуса по спецификации; низ — ширина пояса
  let Wr, Hr, yTop, sp;
  if (top) { sp = topSpec(item, d); Wr = sp.Fs[1] / (2 * a.hw); Hr = sp.L; yTop = 0.866 * H; }
  else { sp = bottomSpec(item, d); const row0 = dr.grid[1] || dr.grid[0], wpx = (row0.lastIndexOf('1') - row0.indexOf('1') + 1) / dr.gw; Wr = sp.ww / Math.max(0.1, wpx); Hr = Wr * dr.H / dr.W; yTop = sp.yW + 0.01; }
  // координаты выкройки в метрах: x вправо от середины, y вниз от верха
  const X = new Float32Array(np_), Y = new Float32Array(np_);
  pat.pts.forEach((p, i) => { X[i] = (p.u - a.cx) * Wr; Y[i] = p.v * Hr; });
  const j = armJ(d);
  if (top) {
    // рукава: повернуть к руке (на фото они торчат в стороны или висят на вешалке), у корпуса — плавно
    const hwR = a.hw * Wr, armY = a.arm * Hr;
    [-1, 1].forEach(side => {
      const S = {x: side * hwR, y: 0.04 * Hr}; let tip = null, far = 0;
      pat.pts.forEach((p, i) => { if (X[i] * side > hwR * 0.98 && Y[i] < armY + 0.05) { const dd = Math.hypot(X[i] - S.x, Y[i] - S.y); if (dd > far) { far = dd; tip = i; } } });
      if (tip == null) return;
      const cur = Math.atan2(Y[tip] - S.y, (X[tip] - S.x) * side), want = Math.PI / 2 - j.th - 0.06, da = (want - cur) * side;
      pat.pts.forEach((p, i) => { const ox = X[i] - S.x, oy = Y[i] - S.y; if (X[i] * side <= hwR * 0.9 || Y[i] > armY + 0.08) return;
        const w = Math.min(1, (X[i] * side - hwR * 0.9) / (0.06 + hwR * 0.1)), ang = da * w, c = Math.cos(ang), s = Math.sin(ang);
        X[i] = S.x + ox * c - oy * s; Y[i] = S.y + ox * s + oy * c; });
    });
  } else if (a.crotch != null) {
    // штанины лёжа расходятся «домиком» — поставить вертикально (поворот вокруг шага)
    const cy = a.crotch * Hr, ang = (item.shape && item.shape.leg_ang) || [0, 0];
    [-1, 1].forEach((side, si) => { const t = -(ang[si] || 0) * Math.PI / 180;
      pat.pts.forEach((p, i) => { if (Y[i] <= cy || X[i] * side < 0) return; const ox = X[i], oy = Y[i] - cy, w = Math.min(1, oy / 0.1), c = Math.cos(t * w), s = Math.sin(t * w); X[i] = ox * c - oy * s; Y[i] = cy + ox * s + oy * c; });
    });
  }
  // частицы: перед (z>0) и спинка (z<0); стартуют плоскими слоями снаружи фигуры
  const n = np_ * 2, P = new Float32Array(n * 3), V = new Float32Array(n * 3), pinY = new Uint8Array(n);
  const zOff = 0.24 * d.s;
  for (let i = 0; i < np_; i++) for (let l = 0; l < 2; l++) { const q = (i + l * np_) * 3; P[q] = X[i]; P[q + 1] = yTop - Y[i]; P[q + 2] = l ? -zOff : zOff; }
  // связи: растяжение (жёстко), сжатие (мягко — складки), изгиб (через точку)
  const E = [];
  const link = (i, j_, kind) => { if (i == null || j_ == null) return; for (let l = 0; l < 2; l++) E.push(i + l * np_, j_ + l * np_, Math.hypot(X[i] - X[j_], Y[i] - Y[j_]), kind); };
  const st = pat.step;
  pat.pts.forEach((p, i) => { link(i, pat.at(p.r, p.c + st), 0); link(i, pat.at(p.r + st, p.c), 0); link(i, pat.at(p.r + st, p.c + st), 1); link(pat.at(p.r, p.c + st), pat.at(p.r + st, p.c), 1);
    link(i, pat.at(p.r, p.c + 2 * st), 2); link(i, pat.at(p.r + 2 * st, p.c), 2); });
  // швы: край переда с краем спинки, кроме проёмов
  const isOpen = (p, i) => {
    if (top) {
      if (p.v < 0.08 && Math.abs(X[i]) < d.neck * 1.9) return true;                 // горловина
      if (p.v > 0.965) return true;                                                  // низ
      if (Math.abs(X[i]) > a.hw * Wr * 1.02 && Y[i] < a.arm * Hr + 0.1) {           // край рукава: дальняя от плеча часть
        const side = Math.sign(X[i]), dd = Math.hypot(X[i] - side * a.hw * Wr, Y[i]);
        return dd > FAR[side > 0 ? 1 : 0] - 0.035;
      }
      return false;
    }
    if (p.v < 0.04) return true;                                                     // пояс
    return p.v > 0.97;                                                               // низ штанин
  };
  const FAR = [0, 0]; if (top) pat.pts.forEach((q, t) => { if (Math.abs(X[t]) > a.hw * Wr) { const si = X[t] > 0 ? 1 : 0, sd = si ? 1 : -1; FAR[si] = Math.max(FAR[si], Math.hypot(X[t] - sd * a.hw * Wr, Y[t])); } });
  const seams = []; pat.pts.forEach((p, i) => { if (p.edge && !isOpen(p, i)) seams.push(i); });
  // пояс брюк держится на талии
  if (!top) pat.pts.forEach((p, i) => { if (p.v < 0.04) { pinY[i] = 1; pinY[i + np_] = 1; } });
  const push = makeCollider(d, under);
  const steps = 300, iters = 6, dt = 1 / 90, g = 9.8, hit = new Uint8Array(n);
  const solve = (i, j_, rest, ks, kc) => {
    const a3 = i * 3, b3 = j_ * 3, dx = P[b3] - P[a3], dy = P[b3 + 1] - P[a3 + 1], dz = P[b3 + 2] - P[a3 + 2], len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, diff = len - rest;
    const kk = diff > 0 ? ks : kc; if (!kk) return; const c = kk * diff / len * 0.5;
    const wy1 = pinY[i] ? 0 : 1, wy2 = pinY[j_] ? 0 : 1;
    P[a3] += dx * c; P[a3 + 1] += dy * c * wy1; P[a3 + 2] += dz * c;
    P[b3] -= dx * c; P[b3 + 1] -= dy * c * wy2; P[b3 + 2] -= dz * c;
  };
  const prev = new Float32Array(n * 3);
  for (let s = 0; s < steps; s++) {
    const ramp = Math.min(1, s / (steps * 0.35));
    prev.set(P);
    const gk = ramp < 1 ? 0 : Math.min(1, (s - steps * 0.35) / 20);                                   // пока шьём — почти без тяжести, иначе вещь упадёт мимо плеч
    for (let i = 0; i < n; i++) { const q = i * 3; if (!pinY[i]) V[q + 1] -= g * gk * dt; P[q] += V[q] * dt; P[q + 1] += V[q + 1] * dt; P[q + 2] += V[q + 2] * dt; if (pinY[i]) P[q + 1] = yTop; }
    for (let it = 0; it < iters; it++) {
      for (let e = 0; e < E.length; e += 4) { const kind = E[e + 3]; solve(E[e], E[e + 1], E[e + 2], kind === 2 ? 0.5 : 1, kind === 2 ? 0.2 : 0.03); }
      // шов стягивается постепенно: от исходного зазора к нулю
      for (const i of seams) { const a3 = i * 3, b3 = (i + np_) * 3, gx = P[b3] - P[a3], gy = P[b3 + 1] - P[a3 + 1], gz = P[b3 + 2] - P[a3 + 2], len = Math.hypot(gx, gy, gz) || 1e-6, rest = 2 * zOff * (1 - ramp) + 0.004, diff = len - rest;
        if (diff > 0) { const c = 0.5 * diff / len; P[a3] += gx * c; P[a3 + 1] += gy * c; P[a3 + 2] += gz * c; P[b3] -= gx * c; P[b3 + 1] -= gy * c; P[b3 + 2] -= gz * c; } }
      for (let i = 0; i < n; i++) { hit[i] = push(P, i * 3) ? 1 : hit[i]; if (pinY[i]) P[i * 3 + 1] = yTop; }
    }
    for (let i = 0; i < n * 3; i++) V[i] = (P[i] - prev[i]) / dt * 0.985;
    for (let i = 0; i < n; i++) if (hit[i]) { V[i * 3] *= 0.5; V[i * 3 + 1] *= 0.5; V[i * 3 + 2] *= 0.5; hit[i] = 0; }
  }
  // сгладить «лесенку» сетки: два прохода усреднения по соседям (форма сохраняется, мелкие зубцы уходят)
  { const nb = Array.from({length: n}, () => []); for (let e = 0; e < E.length; e += 4) if (E[e + 3] !== 2) { nb[E[e]].push(E[e + 1]); nb[E[e + 1]].push(E[e]); }
    for (const i of seams) { nb[i].push(i + np_); nb[i + np_].push(i); }
    for (let pass = 0; pass < 3; pass++) { const Q = P.slice(); for (let i = 0; i < n; i++) { const L = nb[i]; if (!L.length) continue; let x = 0, y = 0, z = 0; for (const t of L) { x += Q[t * 3]; y += Q[t * 3 + 1]; z += Q[t * 3 + 2]; } const w = 0.5;
      P[i * 3] = Q[i * 3] * (1 - w) + x / L.length * w; P[i * 3 + 1] = Q[i * 3 + 1] * (1 - w) + y / L.length * w; P[i * 3 + 2] = Q[i * 3 + 2] * (1 - w) + z / L.length * w; push(P, i * 3); } } }
  // слой для следующих вещей
  if (UNDER) for (let i = 0; i < n; i++) { const yf = P[i * 3 + 1] / H; noteAB(yf, Math.abs(P[i * 3]) + 0.004, Math.abs(P[i * 3 + 2]) + 0.004); }
  // меш: перед и спинка со своими фото
  const g3 = new THREE.Group(), base = item.color || '#888';
  const sc = drB.a.hw && a.hw ? a.hw / drB.a.hw : 1;
  [0, 1].forEach(l => {
    const pos = new Float32Array(np_ * 3), uv = new Float32Array(np_ * 2);
    for (let i = 0; i < np_; i++) { const q = (i + l * np_) * 3; pos[i * 3] = P[q]; pos[i * 3 + 1] = P[q + 1]; pos[i * 3 + 2] = P[q + 2];
      const p = pat.pts[i]; let u = p.u; if (l) u = drB.a.cx - (p.u - a.cx) * sc;   // спинка на фото сзади — зеркально
      uv[i * 2] = u; uv[i * 2 + 1] = 1 - p.v; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(l ? pat.tris.slice() : pat.tris.slice()); geo.computeVertexNormals();
    const mat = photoMat(l ? (item.tex.backCut || item.tex.frontCut) : item.tex.frontCut, base); mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.userData.role = l ? 'back' : 'front'; g3.add(mesh);
  });
  return g3;
}

// одна вещь на фигуре; если у вещи будет glb — здесь подменить на загруженную модель (вариант «В»)
export function garmentMesh(item, d) {
  if (item.tex) { const g = item.drape ? drapeGarment(item, d, UNDER ? {a: UNDER, b: UNDERZ} : null) : null; return g || photoGarment(item, d); }
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
      tex: p.tex || null, drape: p.drape || null, fit: p.fit || null, shape: p.shape || null, sizesT: p.sizesT || null, size: null, brand: p.brand || '', note: p.note || '', states: p.states || null, state: p.states ? p.states[0][0] : '', zip: !!p.zip, collar: !!p.collar, hood: !!p.hood};
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
    if (!R) return; const b = PREFS.body, key = JSON.stringify(b) + '|' + worn().map(i => i.id + ':' + (i.state || '') + ':' + (i.size || '')).join(',');
    if (key === built.key) return; built.key = key;
    R.avatar.children.slice().forEach(o => { R.avatar.remove(o); o.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material && m.material !== R.skinMat) { if (m.material.map && !Object.values(TEX).includes(m.material.map)) m.material.map.dispose(); m.material.dispose(); } }); });
    R.skinMat.color.copy(LIN(SKIN[b.skin | 0] || SKIN[0])); R.skinMat.roughness = (b.skin | 0) === 0 ? 0.35 : 0.6;
    // широкая вещь отводит руки: они лежат на ткани, а не проходят сквозь неё
    const d0 = bodyDims(b); d0.armA = armSpread(worn(), d0);
    const body = buildBody(b, R.skinMat, d0); body.g.traverse(o => { if (o.isMesh) { o.castShadow = true; } }); R.avatar.add(body.g); R.d = body.d;
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
      // размер по таблице магазина: подбор по фигуре и подсказка, как сядет
      wn.filter(it => it.sizesT && it.sizesT.length).forEach(it => {
        const b = PREFS.body, rec = recommendSize(it, b), cur = it.size || rec;
        const row = h('div', 'fit-states'); row.appendChild(h('small', '', 'Размер · ' + it.name + ':'));
        it.sizesT.forEach(z => { const bt = h('button', 'sh-tab' + (z.name === cur ? ' on' : ''), z.name + (z.name === rec ? ' ✓' : '')); bt.title = (z.ru ? 'RU ' + z.ru : '') + (z.name === rec ? ' · подходит по фигуре' : ''); bt.onclick = () => { it.size = z.name === rec ? null : z.name; persist(); render(); }; row.appendChild(bt); });
        top.appendChild(row);
        const note = fitNote(it, b); if (note) top.appendChild(h('p', 'sh-note', note + (it.note ? ' (' + it.note + ')' : '')));
      });
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
  const SL = [['height', 'Рост', 140, 205, 1, 'см'], ['weight', 'Вес', 40, 150, 1, 'кг'], ['chest', 'Обхват груди', 70, 135, 1, 'см'], ['waist', 'Обхват талии', 55, 130, 1, 'см'], ['hips', 'Обхват бёдер', 75, 140, 1, 'см']];
  function renderBodyControls(box) {
    const b = PREFS.body, wrap = h('div', 'fit-body');
    const sx_ = h('div', 'seg3'); [['f', 'Женская'], ['m', 'Мужская']].forEach(([v, t]) => { const bt = h('button', b.sex === v ? 'on' : '', t); bt.onclick = () => { const dflt = v === 'm' ? {sex: 'm', height: 180, weight: 78, chest: 98, waist: 84, hips: 100} : {sex: 'f', height: 168, weight: 60, chest: 90, waist: 72, hips: 98}; setPref('body', dflt); }; sx_.appendChild(bt); });
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
      const p = {name: mt.name, kind: mt.kind, color: mt.color, fit: mt.fit, shape: mt.shape, sizesT: mt.sizes || null, brand: mt.brand, note: mt.note, states: mt.states, zip: mt.zip, collar: mt.collar, id: 'w-' + mt.id, feed: true,
        tex: {front: dir + 'front.webp', back: dir + 'back.webp', sleeve: mt.sleeve ? dir + 'sleeve.webp' : null, frontCut: dir + 'front_cut.webp', backCut: dir + 'back_cut.webp'}, drape: mt.drape || null, pic: dir + 'front.webp'};
      const it = toItem(p, s); if (!it) return; it.thumb = p.pic;
      const old = W.items.findIndex(i => i.id === it.id); if (old >= 0) W.items[old] = Object.assign(it, {state: W.items[old].state || it.state}); else W.items.push(it);
    });
    persist(); return list.length;
  }

  return {
    setView: kind => { if (R) view(kind); }, setRot: r => { if (R) { R.view.rot = r; R.avatar.rotation.y = r; } }, setZoom: (z, hh) => { if (R) { R.view.z = z; if (hh != null) R.view.h = hh; } },
    addPack, wear(ids, states, sizes) { W.worn = []; ids.forEach(id => putOn(id, true)); Object.entries(states || {}).forEach(([id, st]) => { const it = W.items.find(i => i.id === id); if (it) it.state = st; });
      W.items.forEach(it => { if (it.sizesT) it.size = (sizes && sizes[it.id]) || null; }); persist(); render(); },
    fitNote: id => { const it = W.items.find(i => i.id === id); return it ? fitNote(it, PREFS.body) + ' | размер ' + ((sizeOf(it, PREFS.body) || {}).name || '-') : ''; },
    setState(id, st) { const it = W.items.find(i => i.id === id); if (it) { it.state = st; persist(); render(); } },
    open: openRoom, close: closeRoom, get isOpen() { return open; },
    add, has, count: () => W.items.length, onChange: f => subs.push(f),
    mountBodyControls, isWearable, classify,
    get items() { return W.items; }, get worn() { return worn(); },
  };
}
