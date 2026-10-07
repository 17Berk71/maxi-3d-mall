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
  const d = bodyDims0(b); d.legX = Math.max(d.hips * 0.55, d.thigh + 0.013); return d;   // зазор между бёдрами ~2.5 см — для шагового шва
}
function bodyDims0(b) {
  b = Object.assign({}, b, {build: buildOf(b)});
  const H = b.height / 100, s = H / 1.7, k = 0.86 + b.build * 0.34, R = c => c / 100 / (2 * Math.PI);
  const m = b.sex === 'm';
  return {
    H, s, k, m, b,
    chest: R(b.chest), waist: R(b.waist), hips: R(b.hips),
    neck: 0.052 * s * (m ? 1.12 : 1) * (0.9 + b.build * 0.2),
    shX: m ? 1.42 : 1.3,           // ширина плеч относительно груди
    legX: 0,   // ниже: ноги стоят с небольшим зазором (между бёдрами проходит шаговый шов брюк)
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
// плавно, без ступенек: ступенька между узлами профиля проступала сквозь ткань щелью
function sz(d, yf) { const ss = (a, b, y) => { const t = Math.max(0, Math.min(1, (y - a) / (b - a))); return t * t * (3 - 2 * t); };
  const t = ss(d.m ? 0.6 : 0.62, d.m ? 0.66 : 0.68, yf) * (1 - ss(d.m ? 0.77 : 0.75, d.m ? 0.83 : 0.81, yf)); return 0.78 + ((d.m ? 0.7 : 0.84) - 0.78) * t; }

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
  // верх туловища закрыт пологим скатом к шее: открытый край кольца выступал из шара плеч волнистой «кокеткой»
  { const [y0, r0] = yProf[yProf.length - 1], rn = d.neck * 0.85 / Math.max(0.5, sx(d, 0.86)); /* верх ската — внутри шеи: иначе кольцо вокруг шеи видно над воротом */ [[0.003, 0.8], [0.0055, 0.55], [0.0075, 0.3]].forEach(([dy, k]) => yProf.push([y0 + dy * H, Math.max(rn, r0 * k)])); }
  const torso = new THREE.Mesh(loft(yProf, 40, y => sx(d, y / H), y => sz(d, y / H)), skinMat); torso.userData.part = 'torso'; g.add(torso);
  // шея и голова (манекен без лица)
  // шея расширяется к плечам (без «трубы»), голова — гладкая форма витринного манекена: шире у темени, уже к подбородку
  const nk = d.neck, neck = new THREE.Mesh(new THREE.LatheGeometry([[nk * 1.3, -0.05], [nk * 1.1, -0.03], [nk * 0.98, -0.005], [nk * 0.93, 0.025], [nk * 0.9, 0.05]].map(([r, y]) => new THREE.Vector2(r, y * d.s)), 28), skinMat);
  neck.position.y = 0.862 * H; neck.scale.z = 0.86; neck.userData.part = 'neck';   // основание шеи по глубине не шире верха туловища (сбоку торчали «крылья») neck.userData.s = d.s; g.add(neck);
  const hp = [[0.0, -0.113], [0.03, -0.111], [0.052, -0.1], [0.07, -0.075], [0.083, -0.04], [0.089, -0.005], [0.09, 0.03], [0.085, 0.065], [0.071, 0.095], [0.045, 0.115], [0.0, 0.126]];
  const head = new THREE.Mesh(new THREE.LatheGeometry(hp.map(([r, y]) => new THREE.Vector2(r * d.s, y * d.s)), 40), skinMat); head.scale.set(0.98, 1, 1.1); head.position.set(0, 0.93 * H, 0.006); g.add(head);
  // ноги
  [-1, 1].forEach(side => {
    const prof = [[0.04, 0.032], [0.07, 0.036], [0.15, 0.056 * d.k], [0.24, 0.047 * d.k], [0.28, 0.05 * d.k], [0.38, d.thigh * 0.86], [0.47, d.thigh], [0.5, d.thigh * 0.98]].map(([y, r]) => [y * H, r * (y > 0.3 ? 1 : d.s)]);
    const leg = new THREE.Mesh(loft(prof, 22), skinMat); leg.position.x = side * d.legX; leg.userData.part = 'leg'; g.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), skinMat); foot.scale.set(0.045 * d.s, 0.035 * d.s, 0.12 * d.s); foot.position.set(side * d.legX, 0.03 * H, 0.05 * d.s); g.add(foot);
    // рука
    const a = armPose(d, side), arm = new THREE.Mesh(limb([[0, 0.042 * d.k * d.s], [0.07, 0.05 * d.k * d.s], [0.14, 0.046 * d.k * d.s], [0.47, 0.034 * d.k * d.s], [0.55, 0.036 * d.k * d.s], [1, 0.025 * d.s]], a.L), skinMat);
    // рука, купол и кисть — в «плечевом суставе» (pivot): для анимации примерки руку можно отвести (rotation.z)
    const pivot = new THREE.Group(); pivot.position.copy(a.pos); pivot.rotation.z = a.rot; pivot.userData.armPivot = {side, rot: a.rot}; g.add(pivot);
    arm.userData.part = 'arm'; arm.userData.L = a.L; pivot.add(arm);
    // торец руки у сустава закрыт пологим куполом: иначе край трубы выступал из шара плеча — «шарнир куклы»
    { const rr = 0.042 * d.k * d.s, cap = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), skinMat);
      cap.scale.set(rr, rr * 0.45, rr); cap.userData.part = 'arm'; cap.userData.L = a.L; pivot.add(cap); }
    const hand = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skinMat); hand.scale.set(0.022 * d.s, 0.06 * d.s, 0.04 * d.s);
    hand.position.set(0, -(a.L + 0.05 * d.s), 0); pivot.add(hand);
  });
  const sh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), skinMat); sh.scale.set(Math.max(d.chest * d.shX * 0.98, armX(d) + 0.02) * 0.97, d.chest * 0.41, Math.min(d.chest * 0.57, torsoR(d, 0.83) * sz(d, 0.83) * 0.95)); sh.position.y = 0.8 * H; sh.userData.part = 'sh'; g.add(sh);   // по глубине не толще груди: иначе спереди «кокетка» со складкой   // чуть меньше, чем в расчёте ткани: между узлами сетки тело не просвечивает
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
  // ткань: больше рассеянного света (видны складки и объём), меньше «свечения»; лёгкий ворс по краям силуэта (sheen)
  const m = new THREE.MeshPhysicalMaterial({map: t, color: new THREE.Color(0.62, 0.62, 0.62), emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.5, roughness: 0.88, metalness: 0, side: THREE.DoubleSide, sheen: new THREE.Color(0.18, 0.18, 0.18)});
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
  const top = TOPK.has(item.kind);
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
  const c = sz.cm, out = [], top = TOPK.has(item.kind);
  if (sz.body && sz.body.chest && top) { const [lo, hi] = sz.body.chest; out.push(b.chest > hi ? 'мало в груди по таблице (' + lo + '–' + hi + ' см)' : b.chest < lo - 4 ? 'велико по таблице' : 'твой размер по таблице магазина'); }
  if (top && c.chest) { const e = c.chest * 2 - b.chest; out.push(e < 0 ? 'в обтяжку' : e < 8 ? 'по фигуре' : e < 18 ? 'свободно' : 'оверсайз'); }
  if (!top && c.waist) { const e = c.waist * 2 - b.waist; out.push(e < -2 ? 'пояс мал (' + c.waist * 2 + ' см при талии ' + b.waist + ')' : e <= 4 ? 'пояс по талии' : 'пояс свободный — с ремнём'); }
  if (!top && c.hip) { const e = c.hip * 2 - b.hips; out.push(e > 25 ? 'очень свободно в бёдрах' : e > 10 ? 'свободно в бёдрах' : 'по бёдрам'); }
  if (!top && c.outseam) { const need = b.height * 0.595 - 2, dl = Math.round(c.outseam - need); out.push(dl > 4 ? 'длинные: ~' + dl + ' см ложится на обувь' : dl < -6 ? 'укороченные' : 'до обуви'); }
  return out.join(' · ');
}

// длина вещи по спинке (м), если мерок нет: типичная для своего размера, чуть зависит от роста
const LEN0 = {tee: 0.71, sweater: 0.68, hoodie: 0.68, jacket: 0.68, shirt: 0.76, coat: 1.0, puffer: 0.74, dress: 0.95, skirt: 0.62};
// вещи «верха» в расчёте ткани (корпус + рукава): к ним относятся и пальто, пуховик, платье
const TOPK = new Set(['tee', 'sweater', 'hoodie', 'jacket', 'shirt', 'coat', 'puffer', 'dress']);
function cleanTail(arr) {
  const a = arr.slice(), med = a.slice(2, -3).sort((x, y) => x - y)[Math.floor((a.length - 5) / 2)] || a[0];
  for (let i = a.length - 1; i > a.length - 5; i--) if (a[i] < med * 0.86) a[i] = Math.max(a[i], (a[i - 1] || med) * 0.97);
  for (let i = a.length - 3; i < a.length; i++) a[i] = Math.max(a[i], a[i - 1] * 0.975);   // низ вещи прямой, не «собран»
  return a;
}
// параметры верха на этой фигуре
// «настоящий низ» расклешённой детали: точки бока начиная с i0 поднимаются на столько, на сколько бок длиннее прямой по середине
function trueHem(pts, i0, i1) { const o = pts.map(p => p.slice()), e = i1 == null ? pts.length - 1 : i1; let s = 0;
  for (let i = i0 + 1; i <= e; i++) { s += Math.hypot(o[i][0] - o[i - 1][0], o[i][1] - o[i - 1][1]); pts[i] = [o[i][0], o[i][1] - Math.max(0, s - (o[i][1] - o[i0][1])) * 0.9]; } }
// края вещи на фото по строкам (сетка выреза): [левый, правый] в долях ширины для каждой строки; медиана по 5 строкам
function rowSpans(g, a) { if (!g || !g.grid) return null; const R = [], c0 = Math.round((a && a.cx != null ? a.cx : 0.5) * g.gw);
  for (let r = 0; r < g.gh; r++) { const row = g.grid[r]; if (row[c0] !== '1') { R.push(null); continue; } let l = c0, rr = c0; while (l > 0 && row[l - 1] === '1') l--; while (rr < g.gw - 1 && row[rr + 1] === '1') rr++; R.push([(l + 0.5) / g.gw, (rr + 0.5) / g.gw]); }
  return R.map((_, r) => { const w = []; for (let k = -2; k <= 2; k++) if (R[r + k]) w.push(R[r + k]); if (!w.length) return null; const m = i => w.map(e => e[i]).sort((p_, q_) => p_ - q_)[w.length >> 1]; return [m(0), m(1)]; }); }
// силуэт вещи по сетке вырезанного фото: ширина средней полосы (в долях длины вещи) в 16 строках от подмышки до низа
function photoProfile(item) {
  const g = item.drape && item.drape.front; if (!g || !g.grid) return null; const a = g.a || {cx: 0.5}, cw = g.W / g.gw, ch = g.H / g.gh;
  const c0 = Math.round(a.cx * g.gw), run = r => { const row = g.grid[r]; if (!row || row[c0] !== '1') return 0; let p = c0, q = c0; while (p > 0 && row[p - 1] === '1') p--; while (q < g.gw - 1 && row[q + 1] === '1') q++; return q - p + 1; };
  let top = 0; while (top < g.gh && !run(top)) top++; let bot = g.gh - 1; while (bot > top && !run(bot)) bot--;
  // скруглённый край низа (последние строки уже) — не силуэт
  while (bot > top + 10 && run(bot) < 0.85 * Math.max(run(bot - 1), run(bot - 2), run(bot - 3))) bot--;
  const L = (bot - top + 1) * ch, r0 = Math.round(top + (a.arm || 0.3) * (bot - top)) + 1; if (bot - r0 < 8) return null;
  const out = []; for (let i = 0; i < 16; i++) { const r = Math.round(r0 + (bot - r0) * i / 15); const w3 = [run(r - 1), run(r), run(r + 1)].sort((x, y) => x - y)[1]; out.push(w3 * cw / L); }
  return out.some(v => !v) ? null : out;
}
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
  // платье/пальто на модели: руки вдоль корпуса — по ширине с рукавами силуэт прямой. Сам силуэт вещи (без рук) — в сетке фото:
  // ширина центральной полосы по строкам от подмышки до низа (приталенное, клёш)
  const gp = (k === 'dress' || k === 'coat') && sh.merged ? photoProfile(item) : null;
  if (gp) {
    // спереди ширины груди и талии на человеке различаются меньше, чем обхваты: лиф — по таблице (талия/грудь с припуском),
    // юбка — по фото от талии вниз (как видно спереди; поправка «на круглое сечение» давала лишний клёш — бока торчали)
    // талия — последняя узкая строка перед расширением юбки (не первая под рукавом)
    let mn = 9; for (let i = 1; i < 10; i++) mn = Math.min(mn, gp[i]); let iw = 1; for (let i = 1; i < 10; i++) if (gp[i] <= mn * 1.04) iw = i; iw = Math.max(2, iw);
    const sz = sizeOf(item, d.b), bw = sz && sz.body, mid = r => (r[0] + r[1]) / 2;
    const tr = bw && bw.chest && bw.waist ? (mid(bw.waist) + 6) / (mid(bw.chest) + 8) : Math.pow(gp[iw] / gp[0], 1.6);
    const sm = t => t * t * (3 - 2 * t);
    // грудь — строка под рукавом (в строке подмышки на фото ещё рукава); юбка книзу не сужается (скруглённый край фото — не силуэт)
    const c1 = gp[1]; let prev = 0;
    Fs = gp.map((v, i) => { let w = i === 0 ? Math.max(gp[0], c1) : i <= iw ? c1 * (1 - (1 - tr) * sm((i - 1) / Math.max(1, iw - 1))) : c1 * tr * (v / gp[iw]);
      if (i > iw) w = Math.max(w, prev); prev = w; return w / hk * L; });
  }
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
  let lw = (sh.leg || [0.6]).slice();
  // хвост с резким сужением — шум фото (тень, обувь, загнутый край): дальше первой такой точки держим ширину
  for (let i = Math.max(1, lw.length >> 1); i < lw.length; i++) if (lw[i] < lw[i - 1] * 0.8) { for (let j = i; j < lw.length; j++) lw[j] = lw[i - 1] * 0.97; break; }
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
// юбка: пояс, длина и ширина лёжа по высоте (y — от пояса вниз). Профиль с фото лёжа — это и есть ширина лёжа; с фото на модели
// спереди видно ≈ диаметр — книзу (круглое сечение) ширина лёжа больше видимой (до ×1.16); книзу не сужается (скруглённый край фото)
function skirtProf(item, d) {
  const H = d.H, sp = bottomSpec(item, d), cm = itemCm(item, d.b), sh = item.shape || {};
  const yW = Math.max(sp.yW, 0.585 * H), abW = bodyAB(d, yW / H), WW = Math.max(sp.ww, ellP(abW.a, abW.b) / 2 + 0.01);
  const Lk = cm.len ? cm.len / 100 : (LEN0.skirt) * Math.pow(H / 1.8, 0.6), HPb = ellP(bodyAB(d, 0.53).a, bodyAB(d, 0.53).b) / 2 + 0.03;
  let prof = sh.hip && sh.hip.length ? sh.hip.slice() : [1, 1.15, 1.2]; for (let i = 1; i < prof.length; i++) prof[i] = Math.max(prof[i], prof[i - 1]);
  if (sh.worn) prof = prof.map((v, i) => v * (1 + 0.16 * i / Math.max(1, prof.length - 1)));
  const kk = WW / (prof[0] || 1);
  const wvis = y => { const t = y / Lk, yw = (yW - y) / H, ab = bodyAB(d, Math.max(0.5, yw)); const body = yw > 0.47 ? ellP(ab.a, ab.b) / 2 + 0.012 : HPb;
    return Math.max(interp(prof, t) * kk, body, t > 0.25 ? HPb : 0); };
  return {yW, WW, Lk, wvis};
}
function armSpread(items, d) {
  let th = 0.13; const j = armJ({...d, armA: 0.13});
  items.forEach(it => {
    if (!it.tex || !it.shape) return;
    const tops = TOPK.has(it.kind);
    const ys = tops ? [0.7, 0.64, 0.58] : it.kind === 'skirt' ? [0.55, 0.5, 0.46, 0.42] : [0.55, 0.5];
    let sp = null; if (tops) sp = topSpec(it, d); else sp = bottomSpec(it, d);
    ys.forEach(yf => {
      const y = yf * d.H; let a;
      if (tops) { if (y < sp.yHem) return; a = solve(x => ellP(x, x * 0.66), 0.01, 1.2, 2 * sp.F(y)); }
      else { const bw = bodyAB(d, yf); a = bw.a + 0.02;
        // расклешённая юбка: кисти — снаружи конуса юбки (ширина лёжа / π, сечение чуть шире по бокам)
        if (it.kind === 'skirt') { const sk = skirtProf(it, d), yy = sk.yW - y; if (yy > 0 && yy <= sk.Lk) a = Math.max(a, sk.wvis(yy) / Math.PI * 1.12 + 0.01); } }
      const dy = j.y - y, need = a + armRad(d, dy / j.L) * 1.0 + 0.004;
      th = Math.max(th, Math.atan((need - j.x) / dy));
    });
  });
  return clamp(th, 0.13, items.some(i => i.kind === 'skirt') ? 0.32 : 0.22);
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
// ткань по выкройке — основной способ; ?drape=0 — прежние простые формы (для сравнения)
let DRAPE_ON = !(typeof location !== 'undefined' && /[?&]drape=0/.test(location.search));
export function setDrape(v) { DRAPE_ON = !!v; }
// фигура для столкновений: туловище — эллипсы по высоте, ноги — круги, руки — капсулы, шея и голова, пол
// радиус ноги манекена на высоте yf (как у видимой ноги)
function legR(d, yf) {
  const legTab = [[0.04, 0.032], [0.07, 0.036], [0.15, 0.056 * d.k], [0.24, 0.047 * d.k], [0.28, 0.05 * d.k], [0.38, d.thigh * 0.86], [0.47, d.thigh], [0.5, d.thigh * 0.98]];
  if (yf > 0.5) return 0; for (let i = 1; i < legTab.length; i++) if (yf <= legTab[i][0]) { const t = (yf - legTab[i - 1][0]) / (legTab[i][0] - legTab[i - 1][0]); return (legTab[i - 1][1] + (legTab[i][1] - legTab[i - 1][1]) * t) * (yf > 0.3 ? 1 : d.s); } return legTab[0][1] * d.s;
}
function makeCollider(d, under, margin) {
  const H = d.H, N = 400, A = new Float32Array(N), B = new Float32Array(N), LR = new Float32Array(N);
  // нижний слой (пояс брюк, юбка) — ступенька: ткань выше неё не должна сразу прыгать наружу («как под ремнём»).
  // Над ступенькой — пологий скат (как ткань ложится поверх пояса): ширина спадает не быстрее ~0.45 по высоте
  if (under && !under.raw) { const ra = Float32Array.from(under.a), rb = Float32Array.from(under.b), st = 0.45 * H / 100;
    for (let i = 1; i < ra.length; i++) { ra[i] = Math.max(ra[i] || 0, (ra[i - 1] || 0) - st); rb[i] = Math.max(rb[i] || 0, (rb[i - 1] || 0) - st); }
    under = {a: ra, b: rb}; }
  const legAt = yf => legR(d, yf);
  for (let i = 0; i < N; i++) {
    const yf = i / N;
    // туловище без плечевого шара (его ниже — как объёмное тело, иначе ткань соскальзывает с плеч вбок)
    if (yf >= 0.47 && yf <= 0.853) { const r = yf < 0.53 ? Math.max(torsoR(d, Math.max(0.47, yf)), d.hips * (yf < 0.5 ? 0.99 : 0.97)) : torsoR(d, yf); A[i] = r * (sx(d, Math.max(0.6, yf)) * 0.98 + 0.02); B[i] = r * (sz(d, yf) + (yf < 0.6 ? 0.04 : 0)); }
    LR[i] = legAt(yf);
    if (under) { const u = under.a[Math.round(yf * 100)] || 0, uz = under.b[Math.round(yf * 100)] || 0; if (u > A[i]) { A[i] = u; B[i] = Math.max(B[i], uz); } }
  }
  const j = armJ(d); let arms = [];
  // руки можно отвести (анимация примерки): delta — на сколько радиан дальше от тела
  const setArm = delta => { arms = [-1, 1].map(side => ({x0: j.x * side, y0: j.y, dx: Math.sin(j.th + delta) * side, dy: -Math.cos(j.th + delta), L: j.L})); }; setArm(0);
  const m = 0.007 + (margin || 0), hr = 0.098 * d.s, SX = Math.max(d.chest * d.shX * 0.98, armX(d) + 0.02), SY = d.chest * 0.42, SZ = d.chest * 0.62;
  // noArm: точка детали корпуса (не рукава). Рука ниже подмышки её не толкает: рука лежит поверх бока вещи,
  // а не вдавливает его внутрь (иначе широкая вещь у кистей «перетянута ремнём»)
  const push = function (P, i, noArm) {
    let x = P[i], y = P[i + 1], z = P[i + 2], hit = false;
    if (y < 0.004) { y = 0.004; hit = true; }
    const k = Math.max(0, Math.min(N - 1, Math.round(y / H * N)));
    if (A[k] > 0) { const a = A[k] + m, b = B[k] + m, q = (x / a) ** 2 + (z / b) ** 2; if (q < 1) {
      // верх плеч (скат к шее): выталкиваем вверх, на поверхность — иначе ткань соскальзывает по скату вниз и видно тело
      let up = -1; if (k > 0.8 * N) for (let k2 = k + 1; k2 < N && k2 <= k + 8; k2++) { if (!(A[k2] > 0) || (x / (A[k2] + m)) ** 2 + (z / (B[k2] + m)) ** 2 >= 1) { up = k2; break; } }
      // по нормали к эллипсу, а не по радиусу: радиальный толчок на плоском (широком) туловище сдвигает ткань вбок, к бокам
      if (up > 0) y = up / N * H; else { const s = 1 / Math.sqrt(Math.max(q, 1e-6)), sx_ = x * s, sz_ = z * s; let nx = sx_ / (a * a), nz = sz_ / (b * b); const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
        const dd = (sx_ - x) * nx + (sz_ - z) * nz; x += nx * dd; z += nz * dd; if ((x / a) ** 2 + (z / b) ** 2 < 0.999) { x = sx_; z = sz_; } } hit = true; } }
    // бёдра манекена касаются — для ткани оставляем между ними зазор, иначе шаговому шву негде пройти
    if (LR[k] > 0) for (const side of [-1, 1]) { const cx = side * d.legX, r = Math.min(LR[k], d.legX - 0.002) + m, dx = x - cx, dd = Math.hypot(dx, z); if (dd < r) { const s = r / Math.max(dd, 1e-5); x = cx + dx * s; z *= s; hit = true; } }
    { // плечи: эллипсоид, выталкивание по нормали (с верха плеча — вверх)
      const ex = x / (SX + m), ey = (y - 0.8 * H) / (SY + m), ez = z / (SZ + m), q = ex * ex + ey * ey + ez * ez;
      if (q < 1) { // по нормали: радиальный толчок на плоском эллипсоиде плеч стаскивает ткань со ската к руке
        const s = 1 / Math.sqrt(Math.max(q, 1e-6)), A_ = SX + m, B_ = SY + m, C_ = SZ + m, px = x * s, py = (y - 0.8 * H) * s, pz = z * s;
        let nx = px / (A_ * A_), ny = py / (B_ * B_), nz = pz / (C_ * C_); const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        const dd = (px - x) * nx + (py - (y - 0.8 * H)) * ny + (pz - z) * nz; let x2 = x + nx * dd, y2 = y + ny * dd, z2 = z + nz * dd;
        if ((x2 / A_) ** 2 + ((y2 - 0.8 * H) / B_) ** 2 + (z2 / C_) ** 2 < 0.995) { x2 = px; y2 = 0.8 * H + py; z2 = pz; }
        x = x2; y = y2; z = z2; hit = true; } }
    const yf = y / H;
    if (yf > 0.83 && yf < 0.9) { const r = d.neck + m, dd = Math.hypot(x, z); if (dd < r) { const s = r / Math.max(dd, 1e-5); x *= s; z *= s; hit = true; } }
    { const ex = x / (hr * 0.9 + m), ey = (y - 0.93 * H) / (hr * 1.16 + m), ez = z / (hr + m), q = ex * ex + ey * ey + ez * ez; if (q < 1) { const s = 1 / Math.sqrt(q); x *= s; y = 0.93 * H + (y - 0.93 * H) * s; z *= s; hit = true; } }
    // рука — капсула без шара сверху: выше сустава плечо задаёт эллипсоид (как у видимого тела); шар сустава торчал на ~5 см
    // над видимым плечом — ткань ложилась на невидимый бугор, плечи выходили квадратными
    if (!(noArm && y < j.y - 0.07)) for (const a of arms) {
      const tt = (x - a.x0) * a.dx + (y - a.y0) * a.dy; if (tt < -0.01) continue;
      const t = Math.max(0, Math.min(a.L, tt)), px = a.x0 + a.dx * t, py = a.y0 + a.dy * t;
      const dx = x - px, dy = y - py, dd = Math.hypot(dx, dy, z), r = armRad(d, t / a.L) + m;
      if (dd < r) { const s = r / Math.max(dd, 1e-5); x = px + dx * s; y = py + dy * s; z *= s; hit = true; }
    }
    P[i] = x; P[i + 1] = y; P[i + 2] = z; return hit;
  };
  push.setArm = setArm; return push;
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

// ---------- библиотека выкроек (шаблоны) + симуляция ----------
// Вещь собирается из деталей кроя по меркам: фото задаёт форму и рисунок, таблица размеров (или оценка) — масштаб.
// Футболка/свитшот/худи: перед и спинка (плечевые и боковые швы) + два рукава-трубы, вшитые в проймы.
// Брюки/джинсы/шорты: перед и спинка во всю ширину (обе штанины), сшиты по боковым и шаговым швам; у спинки в заду ткани больше.
// Ткань — пресеты по виду вещи (деним жёсткий, трикотаж мягкий).
const FABRIC = {
  tee: {bend: 0.3, comp: 0.05, stretch: 0.9}, sweater: {bend: 0.4, comp: 0.08, stretch: 0.85}, hoodie: {bend: 0.45, comp: 0.08, stretch: 0.85},
  shirt: {bend: 0.45, comp: 0.06, stretch: 1}, jacket: {bend: 0.7, comp: 0.15, stretch: 1},
  jeans: {bend: 0.7, comp: 0.18, stretch: 1}, pants: {bend: 0.45, comp: 0.08, stretch: 1}, shorts: {bend: 0.6, comp: 0.12, stretch: 1},
  // пальто — плотное; пуховик — толстый: стоит от тела на margin (объём утеплителя); платье и юбка — мягкие
  coat: {bend: 0.8, comp: 0.2, stretch: 1, compW: 0.6}, puffer: {bend: 0.9, comp: 0.35, stretch: 1, compW: 0.8, margin: 0.028}, dress: {bend: 0.18, comp: 0.05, stretch: 0.9, compW: 0.95}, skirt: {bend: 0.22, comp: 0.06, stretch: 0.95, compW: 0.95}, skirtP: {bend: 0.7, comp: 0.25, stretch: 1, compW: 0.95, mem: true},   // заутюженные складки: изгиб держит форму в обе стороны   // уток не сжимается: лишняя ширина клёша уходит в волны у подола
};
const pip = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const segDist = (px, py, [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(px - ax - dx * t, py - ay - dy * t); };
// правая половина контура (от точки на оси до точки на оси) + метки отрезков → весь контур зеркально
function mirrorPoly(pts, labs) {
  const n = pts.length, P = pts.slice(), L = labs.slice(0, n - 1);
  L.push(labs[n - 2]);                                               // отрезок через ось внизу (низ/шаг) — та же метка
  for (let i = n - 2; i >= 1; i--) { P.push([-pts[i][0], pts[i][1]]); L.push(labs[i - 1]); }
  return {P, L};
}
// ткань из частиц: детали (плоские слои) и трубы (рукава), связи, швы, закреплённые точки
function makeCloth() {
  return {P: [], E: [], seams: [], pin: [], meshes: [], tether: [],
    add(x, y, z) { this.P.push(x, y, z); this.pin.push(0); return this.pin.length - 1; },
    link(i, j, rest, kind, sc) { if (i == null || j == null) return; this.E.push(i, j, rest * (sc || 1), kind); },
  };
}
// плоская деталь по многоугольнику (метры, y вниз от верха): сетка cell, края помечены ближайшим отрезком контура (метки labels[i])
function addPanel(C, poly, labels, cell, place, uvf, mat, role, restScale, classify, ox) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; poly.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
  // ox: сетка привязана к этой линии (столбцы на ox ± cell/2) — у зеркальных деталей точки шва по середине совпадают
  if (ox != null) x0 = ox - Math.ceil((ox - x0) / cell) * cell;
  const gw = Math.ceil((x1 - x0) / cell) + 1, gh = Math.ceil((y1 - y0) / cell) + 1, id = new Map(), pts = [];
  // точки внутри выкройки; «висящие» (меньше двух прямых соседей — угол у скруглённого низа, зубец края) убираем: держатся только
  // по диагонали, в расчёте болтаются и после сшивания торчат «крылышками»
  const inside = new Set(); for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) if (pip(poly, x0 + (c + 0.5) * cell, y0 + (r + 0.5) * cell)) inside.add(r * 10000 + c);
  for (let pass = 0; pass < 3; pass++) for (const key of [...inside]) { const r = Math.floor(key / 10000), c = key % 10000; let nb = 0;
    for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (inside.has((r + a) * 10000 + c + b)) nb++; if (nb < 2) inside.delete(key); }
  for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) { const x = x0 + (c + 0.5) * cell, y = y0 + (r + 0.5) * cell; if (inside.has(r * 10000 + c)) { const [px, py, pz] = place(x, y); id.set(r * 10000 + c, pts.length); pts.push({r, c, x, y, g: C.add(px, py, pz)}); } }
  const at = (r, c) => { const k = id.get(r * 10000 + c); return k == null ? null : pts[k]; };
  const rs = (a, b) => restScale ? restScale((a.x + b.x) / 2, (a.y + b.y) / 2) : 1;
  // крайняя точка сбоку — на край выкройки по горизонтали: иначе наклонный край (юбка, клёш, штанина) — «лесенка» сетки,
  // и после сшивания по боку торчат зубцы
  pts.forEach(p => { const L = !at(p.r, p.c - 1), R = !at(p.r, p.c + 1); if (L === R) return; let best = null;
    for (let i = 0; i < poly.length; i++) { const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length]; if ((ay > p.y) === (by > p.y) || ay === by) continue;
      const x = ax + (bx - ax) * (p.y - ay) / (by - ay); if ((R && x >= p.x - 1e-6) || (L && x <= p.x + 1e-6)) { if (best == null || Math.abs(x - p.x) < Math.abs(best - p.x)) best = x; } }
    if (best != null && Math.abs(best - p.x) < cell) { p.x = best + (R ? -1 : 1) * cell * 0.05; const [px, py, pz] = place(p.x, p.y); C.P[p.g * 3] = px; C.P[p.g * 3 + 1] = py; C.P[p.g * 3 + 2] = pz; } });
  pts.forEach(p => {
    // поперечные связи (уток) — вид 3: ткань почти не сжимается поперёк (иначе труба штанины «усыхает» по обхвату и липнет к ноге)
    for (const [dr, dc, kind] of [[0, 1, 3], [1, 0, 0], [1, 1, 1], [1, -1, 1], [0, 2, 2], [2, 0, 2]]) { const q = at(p.r + dr, p.c + dc); if (q) C.link(p.g, q.g, Math.hypot(q.x - p.x, q.y - p.y), kind, rs(p, q)); }
    p.edge = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([a, b]) => !at(p.r + a, p.c + b));
    if (p.edge) { let best = 1e9, lab = null; for (let i = 0; i < poly.length; i++) { const dd = segDist(p.x, p.y, poly[i], poly[(i + 1) % poly.length]); if (dd < best) { best = dd; lab = labels[i]; } } p.lab = lab;
      if (classify) p.lab = classify(p, {up: !at(p.r - 1, p.c), down: !at(p.r + 1, p.c), side: !at(p.r, p.c - 1) || !at(p.r, p.c + 1)}) || lab; }
  });
  // привязи (long-range): точка не уходит от верхней точки своего столбца дальше, чем по выкройке.
  // Без них длинная тяжёлая вещь (платье, пальто) за несколько итераций расчёта «вытекает» вниз — связи вверху растянуты на 10–40%
  if (C.tether) { const top = new Map(); pts.forEach(p => { const t = top.get(p.c); if (!t || p.r < t.r) top.set(p.c, p); });
    pts.forEach(p => { const t = top.get(p.c); if (t && p !== t && p.r - t.r > 2) C.tether.push(p.g, t.g, Math.hypot(p.x - t.x, p.y - t.y) * (restScale ? restScale((p.x + t.x) / 2, (p.y + t.y) / 2) : 1) * 1.02); }); }
  const tris = [];
  pts.forEach((p, k) => { p.k = k; });
  // треугольники — в местных номерах вершин этой детали
  pts.forEach(p => { const b = at(p.r, p.c + 1), c = at(p.r + 1, p.c), e = at(p.r + 1, p.c + 1);
    if (b && c && e) tris.push(p.k, c.k, b.k, b.k, c.k, e.k); else if (b && e) tris.push(p.k, e.k, b.k); else if (c && e) tris.push(p.k, c.k, e.k); else if (b && c) tris.push(p.k, c.k, b.k); });
  C.meshes.push({verts: pts.map(p => p.g), uv: pts.map(p => uvf(p.x, p.y)), tris, mat, role});
  return {pts, at};
}
// труба (рукав) вдоль оси от S0 по D: кольца, радиус rad(s); возвращает верхнее кольцо (угол 0 — сверху-снаружи, π/2 — спереди)
function addTube(C, S0, D, len, rad, segs, rings, mat, side, uvf, cap) {
  // cap: {center, ry, rz} — верхнее кольцо (окат) лежит в плоскости проймы; ниже рукав плавно становится трубой вокруг руки
  const e1 = new THREE.Vector3(-D.y, D.x, 0).normalize().multiplyScalar(side), e2 = new THREE.Vector3(0, 0, 1), up = new THREE.Vector3(0, 1, 0);
  const g = [], pos = [];
  for (let i = 0; i < rings; i++) { const s = len * i / (rings - 1), C0 = S0.clone().addScaledVector(D, s), r = rad(s), row = [], prow = [], t = cap ? Math.min(1, s / 0.09) : 1;
    for (let j = 0; j < segs; j++) { const a = j / segs * Math.PI * 2;
      const tube = C0.clone().addScaledVector(e1, Math.cos(a) * r).addScaledVector(e2, Math.sin(a) * r);
      const P = t < 1 ? cap.center.clone().addScaledVector(cap.up || up, Math.cos(a) * cap.ry).addScaledVector(e2, Math.sin(a) * cap.rz).lerp(tube, t * t * (3 - 2 * t)) : tube;
      row.push(C.add(P.x, P.y, P.z)); prow.push(P); }
    g.push(row); pos.push(prow); }
  const dist = (i1, j1, i2, j2) => pos[i1][j1 % segs].distanceTo(pos[i2][j2 % segs]);
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = g[i][j];
    C.link(a, g[i][(j + 1) % segs], dist(i, j, i, j + 1), 3); C.link(a, g[i][(j + 2) % segs], dist(i, j, i, j + 2), 2);
    // у оката запас по высоте (как у настоящего рукава): иначе пройма на теле уже выкройки и верх рукава натянут «рожками»
    // запас — в основном снизу (к подмышке); сверху, у плечевой точки, малый: лишняя ткань там стоит «фонариком» над плечом
    const aw = 0.3 + 0.7 * (1 - Math.cos(j / segs * Math.PI * 2)) / 2, ease = (v, k) => cap && i < 2 ? Math.max(v, (i === 0 ? 0.04 : 0.03) * k * aw) : v;
    if (i + 1 < rings) { C.link(a, g[i + 1][j], ease(dist(i, j, i + 1, j), 1), 0); C.link(a, g[i + 1][(j + 1) % segs], ease(dist(i, j, i + 1, j + 1), 1.15), 1); if (i + 2 < rings) C.link(a, g[i + 2][j], dist(i, j, i + 2, j), 2); } }
  const verts = [], uv = [], tris = [];
  for (let i = 0; i < rings; i++) for (let j = 0; j <= segs; j++) { verts.push(g[i][j % segs]); uv.push(uvf(j / segs, i / (rings - 1))); }
  const W = segs + 1;
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < segs; j++) { const a = i * W + j, b = a + 1, c = a + W, e = c + 1; tris.push(a, c, b, b, c, e); }
  C.meshes.push({verts, uv, tris, mat, local: true});
  return {top: g[0], bottom: g[rings - 1], rings: g};
}
// расчёт: тяжесть, связи (растяжение/сжатие/изгиб — по пресету ткани), швы стягиваются постепенно, столкновения
// движение манекена для анимации примерки: поворот корпуса (рад) и отведение рук по доле u ∈ [0,1] фазы движения
// (плавно с нуля и до нуля: начало и конец без рывка)
function motionAt(u) { const w = Math.sin(Math.PI * u); return {yaw: 0.32 * Math.sin(2 * Math.PI * u) * w, arm: 0.2 * w * w}; }
// opt.rec — записать кадры (каждые 3 шага с момента, когда вещь сшита) и добавить фазу движения (MOT шагов) и успокоения
function runCloth(C, push, fab, yPin, opt) {
  const n = C.pin.length, P = new Float32Array(C.P), V = new Float32Array(n * 3), prev = new Float32Array(n * 3), E = C.E, S = C.seams, hit = new Uint8Array(n);
  const NA = C.noArm || (C.meshes ? armFlags(C) : null);
  const TH = C.tether && C.tether.length ? C.tether : null;
  const S0 = S.map(([i, j]) => Math.hypot(P[j * 3] - P[i * 3], P[j * 3 + 1] - P[i * 3 + 1], P[j * 3 + 2] - P[i * 3 + 2]));
  let FIX = null; const HX = C.hold ? P.slice() : null;
  // капюшон на голове: касающиеся точки не скользят (держится на волосах), иначе тяжесть стаскивает его назад
  const STK = C.stickyIds ? new Uint8Array(n) : null; if (STK) C.stickyIds.forEach(i => { STK[i] = 1; });
  const DBG = typeof window !== 'undefined' ? window : {};   // __dsteps — остановить расчёт раньше (отладка)
  const REC = opt && opt.rec, base = DBG.__dsteps || 320, MOT = REC ? 144 : 0, steps = base + (REC ? MOT + 66 : 0), iters = 7, dt = 1 / 90, sewEnd = 128;
  const frames = REC ? [] : null, fmeta = REC ? [] : null; let yawPrev = 0, still = null;   // still — покой до движения (итог)
  for (let s = 0; s < steps; s++) {
    const ramp = Math.min(1, s / sewEnd), gk = s < sewEnd ? 0 : Math.min(1, (s - sewEnd) / 25);
    // фаза движения: тело поворачивается на Δψ — в системе тела ткань по инерции поворачивается на −Δψ (точки и прошлые точки вместе)
    if (MOT && s === base) still = P.slice();
    let mo = null; if (MOT && s >= base && s < base + MOT) { mo = motionAt((s - base + 1) / MOT); const dpsi = mo.yaw - yawPrev; yawPrev = mo.yaw;
      if (dpsi) { const c = Math.cos(-dpsi), sn = Math.sin(-dpsi); for (let i = 0; i < n; i++) { if (C.pin[i]) continue; const q = i * 3;
        let x = P[q], z = P[q + 2]; P[q] = x * c + z * sn; P[q + 2] = -x * sn + z * c; x = V[q]; z = V[q + 2]; V[q] = x * c + z * sn; V[q + 2] = -x * sn + z * c; } }
      if (push.setArm) push.setArm(mo.arm); }
    else if (MOT && s === base + MOT && push.setArm) { push.setArm(0); yawPrev = 0; }
    prev.set(P);
    // пояс: пока шьём — держится только по высоте, потом застёгнут (не съезжает и не проворачивается)
    if (s === Math.round(sewEnd)) { FIX = P.slice(); }
    if (C.force && s >= sewEnd) for (const F of C.force) if (F.all || s < sewEnd + 90) for (const i of F.ids) { V[i * 3] += F.f[0] * dt; V[i * 3 + 1] += F.f[1] * dt; V[i * 3 + 2] += F.f[2] * dt; }
    for (let i = 0; i < n; i++) { const q = i * 3; V[q + 1] -= 9.8 * gk * dt; P[q] += V[q] * dt; P[q + 1] += V[q + 1] * dt; P[q + 2] += V[q + 2] * dt; if (C.pin[i]) { P[q + 1] = yPin; if (FIX) { P[q] = FIX[q]; P[q + 2] = FIX[q + 2]; } } }
    for (let it = 0; it < iters; it++) {
      for (let e = 0; e < E.length; e += 4) {
        const i = E[e], j = E[e + 1], rest = E[e + 2], kind = E[e + 3], a3 = i * 3, b3 = j * 3;
        const dx = P[b3] - P[a3], dy = P[b3 + 1] - P[a3 + 1], dz = P[b3 + 2] - P[a3 + 2], len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6, diff = len - rest;
        const k = kind === 2 ? (diff > 0 || fab.mem ? fab.bend : fab.bend * 0.4) : (diff > 0 ? fab.stretch : kind === 3 ? (fab.compW || 0.5) : fab.comp); if (!k) continue;
        const c = k * diff / len * 0.5, wa = C.pin[i] ? 0 : 1, wb = C.pin[j] ? 0 : 1;
        P[a3] += dx * c; P[a3 + 1] += dy * c * wa; P[a3 + 2] += dz * c; P[b3] -= dx * c; P[b3 + 1] -= dy * c * wb; P[b3 + 2] -= dz * c;
      }
      for (let rep = 0; rep < 2; rep++) for (let k = 0; k < S.length; k++) { const [i, j] = S[k], a3 = i * 3, b3 = j * 3, gx = P[b3] - P[a3], gy = P[b3 + 1] - P[a3 + 1], gz = P[b3 + 2] - P[a3 + 2], len = Math.hypot(gx, gy, gz) || 1e-6, rest = S0[k] * (1 - ramp), diff = len - rest;
        if (diff > 0) { const c = 0.5 * diff / len; P[a3] += gx * c; P[a3 + 1] += gy * c; P[a3 + 2] += gz * c; P[b3] -= gx * c; P[b3 + 1] -= gy * c; P[b3 + 2] -= gz * c; } }
      if (TH && s >= sewEnd) for (let t = 0; t < TH.length; t += 3) { const i = TH[t] * 3, a = TH[t + 1] * 3, r = TH[t + 2], dx = P[i] - P[a], dy = P[i + 1] - P[a + 1], dz = P[i + 2] - P[a + 2], l = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (l > r) { const k = (l - r) / l; P[i] -= dx * k; P[i + 1] -= dy * k; P[i + 2] -= dz * k; } }
      if (C.hold && s < sewEnd + 20) for (const i of C.hold) P[i * 3] = HX[i * 3];
      if (C.mid) for (const [a, b] of C.mid) { const m = (P[a * 3] + P[b * 3]) / 2; P[a * 3] -= m; if (b !== a) P[b * 3] -= m; }
      if (C.sector && s > sewEnd * 0.6) for (const [i, fz, sx_, cx] of C.sector) { const q = i * 3;
        if (P[q + 2] * fz < -0.005) P[q + 2] += (-0.005 * fz - P[q + 2]) * 0.3;
        if (sx_ && (P[q] - cx) * sx_ < 0) P[q] += (cx - P[q]) * 0.3; }
      if (C.half && s > sewEnd * 0.6) for (const [i, sg] of C.half) if (P[i * 3] * sg < 0.004) P[i * 3] += (sg * 0.004 - P[i * 3]) * 0.3;
      for (let i = 0; i < n; i++) { if (push(P, i * 3, NA && NA[i])) hit[i] = 1; if (C.pin[i]) { P[i * 3 + 1] = yPin; if (FIX) { P[i * 3] = FIX[i * 3]; P[i * 3 + 2] = FIX[i * 3 + 2]; } } }
    }
    // трение о тело: касающаяся точка почти не скользит (иначе тяжёлые рукава стаскивают вещь с плеч)
    // у брюк трение о ноги сильнее: иначе тесная штанина под своей тяжестью проворачивается вокруг ноги и соскакивает с неё
    const FR = C.fr || 0.3;
    if (FR < 1) for (let i = 0; i < n; i++) if (hit[i] && !C.pin[i]) { const q = i * 3, fr = STK && STK[i] && s >= sewEnd ? 0 : FR; for (let k = 0; k < 3; k++) P[q + k] = prev[q + k] + (P[q + k] - prev[q + k]) * fr; push(P, q, NA && NA[i]); }
    for (let i = 0; i < n * 3; i++) V[i] = (P[i] - prev[i]) / dt * 0.985;
    for (let i = 0; i < n; i++) if (hit[i]) { V[i * 3] *= 0.4; V[i * 3 + 1] *= 0.4; V[i * 3 + 2] *= 0.4; hit[i] = 0; }
    // после движения ткань плавно возвращается в покой до движения: жёсткая ткань «помнит» случайные заломы, и итог хуже исходного
    if (REC && s >= sewEnd + 9 && (s - sewEnd) % 3 === 0) { let Fr = P.slice(); if (still && s >= base + MOT) { const w = Math.min(1, (s - base - MOT) / ((steps - base - MOT) * 0.85)), ww = w * w * (3 - 2 * w); for (let i = 0; i < Fr.length; i++) Fr[i] += (still[i] - Fr[i]) * ww; }
      frames.push(Fr); const m_ = MOT && s >= base && s < base + MOT ? motionAt((s - base + 1) / MOT) : {yaw: 0, arm: 0}; fmeta.push(m_.yaw, m_.arm); }
  }
  if (still) P.set(still);   // итог — покой до движения (тот же, что без анимации)
  // сглаживание «лесенки» сетки (2 прохода) с повторной проверкой столкновений
  const nb = Array.from({length: n}, () => []); for (let e = 0; e < E.length; e += 4) if (E[e + 3] === 0 || E[e + 3] === 3) { nb[E[e]].push(E[e + 1]); nb[E[e + 1]].push(E[e]); }
  for (const [i, j] of S) { nb[i].push(j); nb[j].push(i); }
  for (let pass = 0; pass < 2; pass++) { const Q = P.slice(); for (let i = 0; i < n; i++) { const L = nb[i]; if (!L.length) continue; let x = 0, y = 0, z = 0; for (const t of L) { x += Q[t * 3]; y += Q[t * 3 + 1]; z += Q[t * 3 + 2]; }
    P[i * 3] = (Q[i * 3] + x / L.length) / 2; P[i * 3 + 1] = (Q[i * 3 + 1] + y / L.length) / 2; P[i * 3 + 2] = (Q[i * 3 + 2] + z / L.length) / 2; push(P, i * 3, NA && NA[i]); } }
  // швы: сшитые точки сводим вместе (остаток зазора после расчёта — иначе виден просвет по шву)
  for (let pass = 0; pass < 2; pass++) for (const [i, j] of S) { const d2 = Math.hypot(P[j * 3] - P[i * 3], P[j * 3 + 1] - P[i * 3 + 1], P[j * 3 + 2] - P[i * 3 + 2]); if (d2 > 0.05) continue;
    for (let k = 0; k < 3; k++) { const m = (P[i * 3 + k] + P[j * 3 + k]) / 2; P[i * 3 + k] = m; P[j * 3 + k] = m; } }
  if (REC) { frames.push(P.slice()); fmeta.push(0, 0); const F = new Float32Array(frames.length * P.length); frames.forEach((f, k) => F.set(f, k * P.length)); opt.frames = F; opt.meta = Float32Array.from(fmeta); opt.nf = frames.length; }
  return P;
}
function clothAO(C, P, N, n) {
  const sx_ = new Float32Array(n * 3), cnt = new Uint16Array(n), el = new Float32Array(n);
  for (let e = 0; e < C.E.length; e += 4) { const k = C.E[e + 3]; if (k !== 0 && k !== 3) continue; const i = C.E[e], j = C.E[e + 1];
    for (let a = 0; a < 3; a++) { sx_[i * 3 + a] += P[j * 3 + a]; sx_[j * 3 + a] += P[i * 3 + a]; } cnt[i]++; cnt[j]++; el[i] += C.E[e + 2]; el[j] += C.E[e + 2]; }
  let A = new Float32Array(n).fill(1);
  for (let i = 0; i < n; i++) { if (!cnt[i]) continue; let c = 0; for (let a = 0; a < 3; a++) c += (sx_[i * 3 + a] / cnt[i] - P[i * 3 + a]) * N[i * 3 + a];
    const r = c / (el[i] / cnt[i]); A[i] = r > 0 ? Math.max(0.5, 1 - 2.6 * r) : Math.min(1.08, 1 - 0.8 * r); }
  // два прохода размытия по соседям — тень мягкая
  for (let pass = 0; pass < 2; pass++) { const B = A.slice(), acc = new Float32Array(n), c2 = new Uint16Array(n);
    for (let e = 0; e < C.E.length; e += 4) { const k = C.E[e + 3]; if (k !== 0 && k !== 3) continue; const i = C.E[e], j = C.E[e + 1]; acc[i] += B[j]; acc[j] += B[i]; c2[i]++; c2[j]++; }
    for (let i = 0; i < n; i++) if (c2[i]) A[i] = (B[i] + acc[i] / c2[i]) / 2; }
  return A;
}
// затенение складок действует и на «свечение» фото (основной цвет вещи), а не только на рассеянный свет
function aoEmissive(mat) {
  mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor;\n#endif'); };
}
// сетка вещи для показа: нормали общие для всех деталей (по точкам ткани — через швы без ступеньки света),
// каждая деталь повёрнута лицом наружу, и одно сглаживающее деление треугольников (край силуэта не «гранёный»)
function clothNormals(C, P, flips, N) {
  const sub = (i, j) => [P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2]];
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  N.fill(0); const n = P.length / 3;
  C.meshes.forEach((m, mi) => { for (let t = 0; t < m.tris.length; t += 3) { let a = m.verts[m.tris[t]], b = m.verts[m.tris[t + 1]], c = m.verts[m.tris[t + 2]]; if (flips[mi]) { const x = b; b = c; c = x; }
    const f = cross(sub(b, a), sub(c, a)); for (const v of [a, b, c]) { N[v * 3] += f[0]; N[v * 3 + 1] += f[1]; N[v * 3 + 2] += f[2]; } } });
  // сшитые точки — одна нормаль
  for (const [i, j] of C.seams) for (let k = 0; k < 3; k++) { const s_ = N[i * 3 + k] + N[j * 3 + k]; N[i * 3 + k] = s_; N[j * 3 + k] = s_; }
  for (let i = 0; i < n; i++) { const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1; N[i * 3] /= l; N[i * 3 + 1] /= l; N[i * 3 + 2] /= l; }
}
// рельеф складок: base-вершины по координатам выкройки (px, py), середины рёбер — среднее концов; нормали пересчитываются (грани складок
// ловят свет), впадины темнее
function pleatRelief(geo, rl, edges, nbase) {
  if (typeof window !== 'undefined' && window.__noRelief) return;
  const pos = geo.attributes.position.array, nor = geo.attributes.normal.array, col = geo.attributes.color ? geo.attributes.color.array : null;
  const n = pos.length / 3, px = new Float32Array(n), py = new Float32Array(n);
  for (let k = 0; k < nbase; k++) { px[k] = rl.px[k]; py[k] = rl.py[k]; }
  let r = nbase; for (const [i, j] of edges) { px[r] = (px[i] + px[j]) / 2; py[r] = (py[i] + py[j]) / 2; r++; }
  const n0 = nor.slice();
  for (let k = 0; k < n; k++) { const w = Math.cos(Math.abs(px[k]) / rl.half * Math.PI), t = Math.min(1, Math.max(0, py[k] / rl.L));
    const a = rl.amp * (0.25 + 0.75 * t) * w; pos[k * 3] += nor[k * 3] * a; pos[k * 3 + 1] += nor[k * 3 + 1] * a; pos[k * 3 + 2] += nor[k * 3 + 2] * a;
    if (col) { const f = 0.8 + 0.2 * (w + 1) / 2; col[k * 3] *= f; col[k * 3 + 1] *= f; col[k * 3 + 2] *= f; } }
  // нормали: грани складок ловят свет, но не до бликов на рёбрах — смесь с гладкими
  geo.computeVertexNormals(); for (let k = 0; k < n * 3; k += 3) { const x = nor[k] * 0.6 + n0[k] * 0.4, y = nor[k + 1] * 0.6 + n0[k + 1] * 0.4, z = nor[k + 2] * 0.6 + n0[k + 2] * 0.4, l = Math.hypot(x, y, z) || 1; nor[k] = x / l; nor[k + 1] = y / l; nor[k + 2] = z / l; }
}
// кадр анимации: та же сетка (порядок вершин как в clothMeshes), новые точки ткани P — без пересборки
function clothUpdate(g, P) {
  const cl = g.userData.cloth; if (!cl) return; const C = cl.C, n = P.length / 3, N = cl.N || (cl.N = new Float32Array(n * 3));
  clothNormals(C, P, cl.flips, N); const AO = clothAO(C, P, N, n);
  g.children.forEach(mesh => { const cm = mesh.userData.cm; if (!cm) return; const m = C.meshes[cm.mi], pa = mesh.geometry.attributes.position, na = mesh.geometry.attributes.normal, ca = mesh.geometry.attributes.color;
    const pos = pa.array, nor = na.array, col = ca ? ca.array : null;
    m.verts.forEach((v, k) => { pos[k * 3] = P[v * 3]; pos[k * 3 + 1] = P[v * 3 + 1]; pos[k * 3 + 2] = P[v * 3 + 2]; nor[k * 3] = N[v * 3]; nor[k * 3 + 1] = N[v * 3 + 1]; nor[k * 3 + 2] = N[v * 3 + 2]; if (col) col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = AO[v]; });
    let r = m.verts.length; for (const [i, j] of cm.edges) {
      const dx = pos[j * 3] - pos[i * 3], dy = pos[j * 3 + 1] - pos[i * 3 + 1], dz = pos[j * 3 + 2] - pos[i * 3 + 2], nix = nor[i * 3], niy = nor[i * 3 + 1], niz = nor[i * 3 + 2], njx = nor[j * 3], njy = nor[j * 3 + 1], njz = nor[j * 3 + 2];
      const v_ = 2 * ((dx * (nix + njx) + dy * (niy + njy) + dz * (niz + njz)) / Math.max(1e-9, dx * dx + dy * dy + dz * dz)), hx = nix + njx - v_ * dx, hy = niy + njy - v_ * dy, hz = niz + njz - v_ * dz, hl = Math.hypot(hx, hy, hz) || 1;
      const off = ((njx - nix) * dx + (njy - niy) * dy + (njz - niz) * dz) / 8;
      pos[r * 3] = (pos[i * 3] + pos[j * 3]) / 2 + (nix + njx) / 2 * off; pos[r * 3 + 1] = (pos[i * 3 + 1] + pos[j * 3 + 1]) / 2 + (niy + njy) / 2 * off; pos[r * 3 + 2] = (pos[i * 3 + 2] + pos[j * 3 + 2]) / 2 + (niz + njz) / 2 * off;
      nor[r * 3] = hx / hl; nor[r * 3 + 1] = hy / hl; nor[r * 3 + 2] = hz / hl; if (col) col[r * 3] = col[r * 3 + 1] = col[r * 3 + 2] = (col[i * 3] + col[j * 3]) / 2; r++; }
    if (m.relief) pleatRelief(mesh.geometry, m.relief, cm.edges, m.verts.length);
    pa.needsUpdate = true; na.needsUpdate = true; if (ca) ca.needsUpdate = true; mesh.geometry.computeBoundingSphere(); });
}
function clothMeshes(C, P, H) {
  const g = new THREE.Group(), n = P.length / 3, N = new Float32Array(n * 3);
  const sub = (i, j) => [P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2]];
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  // лицом наружу: нормаль треугольника смотрит от середины детали (у трубы рукава — от её оси)
  const flips = C.meshes.map(m => { let cx = 0, cy = 0, cz = 0; m.verts.forEach(v => { cx += P[v * 3]; cy += P[v * 3 + 1]; cz += P[v * 3 + 2]; }); const k = m.verts.length || 1; cx /= k; cy /= k; cz /= k;
    let sgn = 0; for (let t = 0; t < m.tris.length; t += 3) { const a = m.verts[m.tris[t]], b = m.verts[m.tris[t + 1]], c = m.verts[m.tris[t + 2]], f = cross(sub(b, a), sub(c, a));
      sgn += f[0] * (P[a * 3] - cx) + f[1] * (P[a * 3 + 1] - cy) + f[2] * (P[a * 3 + 2] - cz); } return sgn < 0; });
  clothNormals(C, P, flips, N);
  // затенение складок (как ambient occlusion): во впадине точка ниже соседей по нормали — темнее, на гребне — чуть светлее
  const AO = clothAO(C, P, N, n);
  g.userData.cloth = {C, flips};
  C.meshes.forEach((m, mi) => {
    const pos = [], nor = [], uv = [], col = [], idx = [], mid = new Map();
    m.verts.forEach((v, k) => { pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); nor.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); uv.push(m.uv[k][0], 1 - m.uv[k][1]); col.push(AO[v], AO[v], AO[v]); });
    // середина ребра — по кривой (PN-треугольники): точка сдвинута по нормалям концов, а не лежит на прямой
    const edge = (i, j) => { const key = i < j ? i * 100000 + j : j * 100000 + i; let r = mid.get(key); if (r != null) return r;
      const pi = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], pj = [pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]], ni = [nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]], nj = [nor[j * 3], nor[j * 3 + 1], nor[j * 3 + 2]];
      const d = [pj[0] - pi[0], pj[1] - pi[1], pj[2] - pi[2]], v = 2 * ((d[0] * (ni[0] + nj[0]) + d[1] * (ni[1] + nj[1]) + d[2] * (ni[2] + nj[2])) / Math.max(1e-9, d[0] * d[0] + d[1] * d[1] + d[2] * d[2]));
      const hn = [ni[0] + nj[0] - v * d[0], ni[1] + nj[1] - v * d[1], ni[2] + nj[2] - v * d[2]], hl = Math.hypot(...hn) || 1;
      const off = ((nj[0] - ni[0]) * d[0] + (nj[1] - ni[1]) * d[1] + (nj[2] - ni[2]) * d[2]) / 8;   // прогиб дуги над хордой
      r = pos.length / 3;
      pos.push((pi[0] + pj[0]) / 2 + (ni[0] + nj[0]) / 2 * off, (pi[1] + pj[1]) / 2 + (ni[1] + nj[1]) / 2 * off, (pi[2] + pj[2]) / 2 + (ni[2] + nj[2]) / 2 * off);
      nor.push(hn[0] / hl, hn[1] / hl, hn[2] / hl); uv.push((uv[i * 2] + uv[j * 2]) / 2, (uv[i * 2 + 1] + uv[j * 2 + 1]) / 2); const ao = (col[i * 3] + col[j * 3]) / 2; col.push(ao, ao, ao); mid.set(key, r); return r; };
    for (let t = 0; t < m.tris.length; t += 3) { let a = m.tris[t], b = m.tris[t + 1], c = m.tris[t + 2]; if (flips[mi]) { const x = b; b = c; c = x; }
      const ab = edge(a, b), bc = edge(b, c), ca = edge(c, a); idx.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
    if (!m.mat.vertexColors) { m.mat.vertexColors = true; aoEmissive(m.mat); m.mat.needsUpdate = true; }
    const mesh = new THREE.Mesh(geo, m.mat); mesh.castShadow = true; mesh.receiveShadow = true; if (m.role) mesh.userData.role = m.role;
    mesh.userData.cm = {mi, edges: [...mid.entries()].sort((a_, b_) => a_[1] - b_[1]).map(([key]) => [Math.floor(key / 100000), key % 100000])}; g.add(mesh);
    if (m.relief) pleatRelief(geo, m.relief, mesh.userData.cm.edges, m.verts.length);
  });
  // слой для следующих вещей — только корпус (перед, спинка); рукава и капюшон не расширяют «туловище» верхней вещи
  if (UNDER) C.meshes.forEach(m => { if (m.role !== 'front' && m.role !== 'back') return; m.verts.forEach(i => noteAB(P[i * 3 + 1] / H, Math.abs(P[i * 3]) + 0.004, Math.abs(P[i * 3 + 2]) + 0.004)); });
  return g;
}
// мерки верха (м): ширина лёжа W, длина L, плечи S, пройма AD, рукав SL/SO, горловина
function topMeasures(item, d) {
  const sp = topSpec(item, d), sh = item.shape || {}, k = item.kind, cm = itemCm(item, d.b);
  // рукава: у платья — по фото (длинные, короткие или без рукавов), у остальных — по виду вещи
  const long = k === 'dress' ? (sh.sl_len || 0) > 0.45 : k !== 'tee', noSleeve = k === 'dress' && sh.sl_len != null && sh.sl_len < 0.06;
  // вещь меньше тела не наденется: трикотаж тянется, поэтому не уже груди + 1.5 см (а «мало» честно пишет подсказка размера)
  // утеплитель (пуховик) съедает ширину: толщина m по кругу — это π·m от ширины лёжа; это не «оверсайз», плечо не спускаем
  const ins = Math.PI * ((FABRIC[k] && FABRIC[k].margin) || 0);
  const bodyHalf = d.b.chest / 200, W = Math.max(sp.Fs[1], bodyHalf + 0.015 + ins), L = sp.L, loose = Math.max(0, W - bodyHalf - 0.03 - ins);
  const S = cm.shoulder ? cm.shoulder / 100 : Math.min(W * 1.02, W * 0.84 + loose * 0.9);            // оверсайз — спущенное плечо
  const AD = Math.min(0.34, 0.215 + loose * 0.6) * Math.pow(d.H / 1.8, 0.5);
  const SL = cm.sleeve ? cm.sleeve / 100 : long ? 0.335 * d.H * 0.98 + 0.03 - (S / 2 - armX(d)) : Math.max(0.16, Math.min(0.3, (sh.sl_len ? sh.sl_len * L * 0.6 : 0.2) + loose * 0.4));
  const SO = long ? (k === 'jacket' || k === 'coat' ? 0.15 : k === 'puffer' ? 0.17 : 0.11) : Math.max(0.15, 0.17 + loose * 0.5);
  const HW = sp.Fs[sp.Fs.length - 3] || W;
  return {W, L, S, AD, SL, SO, HW: long && (k === 'sweater' || k === 'hoodie') ? Math.max(bodyHalf * 1.02, W * 0.86) : Math.max(HW, W * 0.95), NW: 0.155 * Math.pow(d.H / 1.8, 0.5), ND: item.collar ? 0.035 : 0.06, NDb: 0.018, sp, noSleeve};
}
// пояс надетых брюк (для заправленного верха); сбрасывается при каждой сборке образа
let BOT_YW = 0;
// капюшон: две боковины, сшитые по затылку и макушке, низ вшит в горловину (перед и спинка); лицевой край свободный
// up — на голове; иначе лежит на спине (боковины сложены, макушка внизу)
// воротник-стойка: невысокая лента вокруг шеи, низ вшит в горловину (перед и спинка), ткань — с верха переда на фото
function addStand(C, d, yTop, fronts, pb, mat, a) {
  const neck = fronts.concat([pb]).flatMap(P_ => P_.pts.filter(p => p.edge && p.lab === 'neck').map(p => p.g)); if (neck.length < 6) return;
  const segs = 24, h = 0.034 * d.s, r = d.neck + 0.011, yb = yTop - 0.008;
  const tube = addTube(C, new THREE.Vector3(0, yb, 0), new THREE.Vector3(0, 1, 0), h, s => r - s * 0.08, segs, 3, mat, 1, (u, v) => [a.cx + (u - 0.5) * 0.12, 0.01 + v * 0.03]);
  // шов: каждая точка горловины — к ближайшей по углу точке нижнего кольца стойки
  neck.forEach(g_ => { const x = C.P[g_ * 3], z = C.P[g_ * 3 + 2]; let best = 9, q = null;
    tube.top.forEach(t => { const ax = Math.atan2(C.P[t * 3 + 2], C.P[t * 3]) - Math.atan2(z, x), da = Math.abs(Math.atan2(Math.sin(ax), Math.cos(ax))); if (da < best) { best = da; q = t; } });
    if (q != null) C.seams.push([g_, q]); });
}
function addHood(C, d, M, fronts, pb, mat, up, cell, uvS) {
  const H = d.H, k = Math.pow(H / 1.8, 0.5), Hh = 0.355 * k;
  // горловина: точки края «neck» переда и спинки — по половинам, от середины переда к середине спинки
  const neckF = fronts.flatMap(pf => pf.pts).filter(p => p.edge && p.lab === 'neck'), neckB = pb.pts.filter(p => p.edge && p.lab === 'neck');
  [-1, 1].forEach(side => {
    const chain = neckF.filter(p => p.x * side >= -1e-4).sort((a, b) => Math.abs(a.x) - Math.abs(b.x)).concat(neckB.filter(p => p.x * side > 0).sort((a, b) => Math.abs(b.x) - Math.abs(a.x))).map(p => p.g);
    if (chain.length < 3) return;
    const Lb = (ellP(M.NW / 2, M.ND) + ellP(M.NW / 2, M.NDb)) / 4 * 1.05;
    const poly = [[0, 0], [Lb, 0], [Lb + 0.045, 0.1 * k], [Lb + 0.03, 0.22 * k], [Lb - 0.03, 0.31 * k], [Lb - 0.12, Hh - 0.005], [0.07, Hh], [0, Hh - 0.04]];
    const labs = ['neck', 'crown', 'crown', 'crown', 'crown', 'crown', 'face', 'face'];
    const Ub = Lb + 0.045, yTop = 0.858 * H + 0.012;
    // начальное положение: низ — на горловине вокруг шеи (перед ниже, спинка выше), выше — стенкой вверх и чуть наружу;
    // капюшон «на спине» получается из того же положения: после сшивания его сдувает назад (сила), и он ложится на спину
    // выше горловины лицевой край расходится к бокам лица (иначе вырез для лица закрыт)
    const hc = 0.93 * H, Rh = 0.098 * d.s * 1.16 + 0.035;
    const place = (u, v) => { if (up) { // на голове: как шлем — низ у шеи, верх по макушке, лицевой край у боков лица, затылок сзади
        const e = (-55 + 140 * Math.min(1, v / Hh)) * Math.PI / 180, a = (48 + 132 * Math.min(1, u / Ub)) * Math.PI / 180, ce = Math.cos(e);
        return [side * Math.sin(a) * ce * Rh * 0.92, hc + Math.sin(e) * Rh, Math.cos(a) * ce * Rh]; }
      const p0 = Math.min(1, v / 0.12) * 0.8, ph = p0 + (Math.PI - p0) * Math.min(1, u / Lb), c = Math.cos(ph), sn = Math.sin(ph), out = Math.min(v, 0.12) * 0.35 + (u > Lb ? u - Lb : 0);
      const rx = M.NW / 2 + 0.008 + out, rz = (c > 0 ? d.neck + 0.035 : d.neck + 0.012) + out;
      return [side * sn * rx, yTop - (M.ND * (1 + c) / 2 + M.NDb * (1 - c) / 2) - 0.004 + v, c * rz]; };
    const hp = addPanel(C, poly, labs, cell * 0.9, place, (u, v) => uvS ? uvS(u / Ub, v / Hh) : [0.5 + side * u / (Ub * 2.2), v / Hh], mat, 'hood');
    // низ капюшона → горловина по доле длины
    const bot = hp.pts.filter(p => p.edge && p.lab === 'neck').sort((a, b) => a.x - b.x);
    bot.forEach((p, i) => { const t = bot.length > 1 ? i / (bot.length - 1) : 0; C.seams.push([p.g, chain[Math.round(t * (chain.length - 1))]]); });
    (C.hood = C.hood || []).push(hp);
    if (!up) (C.force = C.force || []).push({ids: hp.pts.map(p => p.g), f: [0, -2, -14]});
    // на голове: лицевой край держится у лба (в жизни — трение о волосы и форма капюшона), иначе капюшон съезжает назад
    else { hp.pts.forEach(p => { (C.stickyIds = C.stickyIds || []).push(p.g); }); }
  });
  // затылок и макушка: левая боковина с правой (точки края «crown» с одинаковыми координатами выкройки)
  if (C.hood && C.hood.length === 2) { const [A, B] = C.hood, eb = B.pts.filter(p => p.edge && p.lab === 'crown');
    A.pts.forEach(p => { if (!p.edge || p.lab !== 'crown') return; let best = cell, q = null; for (const b of eb) { const dd = Math.abs(b.x - p.x) + Math.abs(b.y - p.y); if (dd < best) { best = dd; q = b; } } if (q) C.seams.push([p.g, q.g]); }); }
}
// подготовка расчёта ткани: выкройка, швы, начальное положение. Сам расчёт (runCloth) — отдельно: в фоновом потоке
// (garmentMeshAsync) или сразу (drapeTemplate). finish(P) — по готовым точкам собирает сетку, слой, автопроверку
export function drapePrepare(item, d, under) {
  if (!DRAPE_ON || !item.tex) return null;
  const k = item.kind, top = TOPK.has(k), bottom = ['jeans', 'pants', 'shorts', 'skirt'].includes(k);
  if (!top && !bottom) return null;
  const st = item.state || '', open = st === 'open', tucked = st === 'tucked', hoodUp = st === 'hood', hooded = k === 'hoodie' || item.hood;
  // заправленный верх: ниже пояса брюк не отталкивается от них — край уходит внутрь, пояс брюк виден поверх
  if (tucked && under && BOT_YW) { const lim = Math.round(BOT_YW / d.H * 100) + 1; under = {a: under.a.map((v, i) => i <= lim ? 0 : v), b: under.b.map((v, i) => i <= lim ? 0 : v)}; }
  const H = d.H, C = makeCloth(), fab = (k === 'skirt' && item.pleats ? FABRIC.skirtP : FABRIC[k]) || FABRIC.tee, push = makeCollider(d, under, fab.margin), base = item.color || '#888', chains = [];
  const dr = item.drape || {}, aF = (dr.front && dr.front.a) || {cx: 0.5}, aB = (dr.back && dr.back.a) || aF;
  const mF = photoMat(item.tex.frontCut || item.tex.front, base), mB = photoMat(item.tex.backCut || item.tex.back || item.tex.front, base);
  [mF, mB].forEach(m => { m.side = THREE.DoubleSide; });
  const zo = 0.21 * d.s, cell = (typeof window !== 'undefined' && window.__cell) || 0.022;
  let yPin = 0, info = {}, cover = null;
  if (top) {
    const M = topMeasures(item, d), yTop = 0.858 * H + 0.012; info = M;
    // длина в мерках считается от 0.848H (старая геометрия), а верх выкройки — выше: низ вещи с фото на модели должен остаться на своём месте
    if (item.shape && item.shape.worn && item.shape.hem_waist != null) M.L += yTop - 0.848 * H;
    // утеплитель съедает длину (ткань идёт в обход груди и плеч на толщине): выкройке — запас, проверке — длина из каталога
    M.L0 = M.L; if (fab.margin) M.L += fab.margin * 2.5;
    // заправлена: низ уходит под пояс брюк, сверху небольшой напуск (низ закреплён на поясе)
    const yTuck = (BOT_YW || 0.595 * H) - 0.035;   // ниже пояса брюк: край внутри
    if (tucked) { M.L = Math.min(M.L, yTop - yTuck + 0.045); yPin = yTuck; }
    // скат плеча по фигуре: плечевая точка выкройки ложится на плечо (верх руки), а не висит над ним — иначе у плеча «погоны»
    { const xs = M.S / 2, ax = armX(d), r = armRad(d, 0) + 0.004, SXb = Math.max(d.chest * d.shX * 0.98, ax + 0.02), SYb = d.chest * 0.42;
      const yArmTop = Math.abs(xs - ax) < r ? 0.8 * H + Math.sqrt(r * r - (xs - ax) ** 2) : xs < ax ? 0.8 * H + SYb * Math.sqrt(Math.max(0, 1 - (xs / SXb) ** 2)) : 0.8 * H;
      M.SD = Math.max(0.04, Math.min(0.11, yTop - yArmTop - 0.006)); M.AD = Math.max(M.AD, M.SD + 0.16); }
    // что закрывает вещь на теле (для окраски тела под ней, см. paintBody): корпус от низа до шеи, рука — на длину рукава
    cover = {y0: tucked ? yTuck + 0.03 : yTop - M.L + 0.06 + (fab.margin || 0) * 2, y1: yTop - M.ND - 0.012, nx: M.NW / 2 - 0.01, torso: !open, arm: M.noSleeve ? 0 : ((M.S / 2 - armX(d)) + M.SL) / (0.335 * H)};
    // контур половины (x ≥ 0) и метки отрезков; зеркалим
    const arm = [], nA = 6; for (let i = 0; i <= nA; i++) { const t = i / nA, x = M.S / 2 + (M.W / 2 - M.S / 2) * Math.pow(t, 2.2) - 0.012 * Math.sin(t * Math.PI), y = M.SD + (M.AD - M.SD) * t; arm.push([x, y]); }
    // бок от проймы до низа — по ширине вещи на фото (приталенная, прямая, расклешённая книзу — у платья, пальто),
    // но не уже тела на этой высоте (у длинных вещей ниже шага — бёдра)
    const flare = k === 'dress' || k === 'coat';
    const sideTail = (pts, labs) => { const n_ = flare ? 10 : 6, rib = k === 'sweater' || k === 'hoodie' || k === 'puffer', i0 = pts.length;
      for (let i = 1; i <= n_; i++) { const t = i / n_, y = M.AD + (M.L - M.AD) * t, yw = Math.max(0.5, (yTop - y) / H), ab = bodyAB(d, yw), bodyF = ellP(ab.a, ab.b) / 2 + 0.012;
        let w = Math.max(interp(M.sp.Fs, t), bodyF); if (rib && i === n_) w = Math.max(bodyF, Math.min(w, M.HW)); if (i === 1) w = Math.max(w, Math.min(M.W, w * 1.04));
        pts.push([w / 2, y]); labs.push(i < n_ ? 'side' : 'hem'); }
      // клёш от талии: бок длиннее середины — низ у боков поднять (иначе по бокам «углы» ниже подола), низ к середине — дугой
      if (flare) { let iw = i0; for (let i = i0; i < pts.length; i++) if (pts[i][0] < pts[iw][0] - 1e-4) iw = i;
        trueHem(pts, iw); const [hx, hy] = pts[pts.length - 1];
        if (M.L - hy > 0.004) for (let i = 1; i <= 3; i++) { const t = i / 4; pts.push([hx * (1 - t), hy + (M.L - hy) * Math.sin(t * Math.PI / 2)]); labs.push('hem'); } } };
    const mk = nd => { const pts = [], labs = [];
      for (let i = 0; i <= 5; i++) { const t = i / 5; pts.push([M.NW / 2 * Math.sin(t * Math.PI / 2), nd * Math.cos(t * Math.PI / 2)]); labs.push(i < 5 ? 'neck' : 'shoulder'); }
      arm.forEach((p, i) => { pts.push(p); labs.push(i < nA ? 'arm' : 'side'); });
      sideTail(pts, labs); pts.push([0, M.L]);
      return mirrorPoly(pts, labs); };
    // uv: корпус на фото — между cx±hw, по высоте 0..1
    // верхний край выкройки (горловина, плечо) совпадает с верхним краем вещи на фото в том же столбце:
    // иначе вырез горловины с фото (прозрачный) ложится на ткань ниже выреза и видна щель
    const topY = (x, nd) => { const t = Math.abs(x); if (t < M.NW / 2) return nd * Math.cos(Math.asin(Math.min(1, t / (M.NW / 2)))); return Math.min(M.SD, M.SD * (t - M.NW / 2) / Math.max(0.01, M.S / 2 - M.NW / 2)); };
    const photoTop = g => { if (!g) return () => 0; const T = []; for (let c = 0; c < g.gw; c++) { let r = 0; while (r < g.gh && g.grid[r][c] !== '1') r++; T.push(r < g.gh ? r / g.gh : 1); }
      return u => { const c = Math.max(0, Math.min(g.gw - 1, Math.floor(u * g.gw))), w = [T[c - 1], T[c], T[c + 1]].filter(v => v != null && v < 1).sort((a, b) => a - b); return w.length ? w[w.length >> 1] : 0; }; };
    // низ корпуса на фото: у длинных рукавов на вешалке рукава свисают ниже корпуса — низ сетки не подол
    const photoHem = (g, a) => { if (!g) return 1; const cc = Math.round(a.cx * g.gw); let r = Math.floor((a.arm || 0.3) * g.gh); while (r + 1 < g.gh && g.grid[r + 1][cc] === '1') r++; return Math.min(1, (r + 1) / g.gh); };
    // середина переда — по молнии на фото (если найдена): на фото вещь висит чуть наискось, а в примерочной молния должна идти ровно посередине
    const cAt = (a, v) => { const z = a.zipc; if (!z) return a.cx; const f = Math.max(0, Math.min(z.length - 1, v * z.length - 0.5)), i = Math.min(z.length - 2, Math.floor(f)); return z[i] + (z[i + 1] - z[i]) * (f - i); };
    // ниже проймы — построчно: край выкройки ↔ край вещи на фото в той же строке (у расклешённой вещи низ шире верха;
    // при одной ширине на всю высоту края выкройки внизу попадали за силуэт на фото — принт «плыл», по бокам пятна фона)
    let SQ = null; const sideR = y => (SQ = SQ || (() => { const q = F.P.filter(([x, y]) => x > 1e-4 && y >= M.AD - 1e-6).sort((a_, b_) => a_[1] - b_[1]); return y => { if (!q.length || y <= q[0][1]) return M.W / 2; for (let i = 1; i < q.length; i++) if (y <= q[i][1]) { const t = (y - q[i - 1][1]) / Math.max(1e-6, q[i][1] - q[i - 1][1]); return q[i - 1][0] + (q[i][0] - q[i - 1][0]) * t; } return q[q.length - 1][0]; }; })())(y);
    const photoRows = (g, a) => { if (!g) return null; const R = [], c0 = Math.round(a.cx * g.gw);
      for (let r = 0; r < g.gh; r++) { const row = g.grid[r]; if (row[c0] !== '1') { R.push(null); continue; } let l = c0, rr = c0; while (l > 0 && row[l - 1] === '1') l--; while (rr < g.gw - 1 && row[rr + 1] === '1') rr++; R.push([(l + 0.5) / g.gw, (rr + 0.5) / g.gw]); }
      // сглаживание по строкам (медиана из 5): выбросы края — шум выреза
      return R.map((_, r) => { const w = []; for (let k = -2; k <= 2; k++) if (R[r + k]) w.push(R[r + k]); if (!w.length) return null; const m = i => w.map(e => e[i]).sort((p_, q_) => p_ - q_)[w.length >> 1]; return [m(0), m(1)]; }); };
    const uvT = (a, mirror, g, nd) => { const pt = photoTop(g), hv = photoHem(g, a), PR = photoRows(g, a), arm = a.arm || 0.3, t0 = Math.min(0.3, pt(a.cx + (mirror ? -1 : 1) * M.NW / M.W * (a.hw || 0.3))); return (x, y) => { const sx_ = x / (M.W / 2) * (a.hw || 0.3), u0 = mirror ? a.cx - sx_ : a.cx + sx_, py = topY(x, nd), tv = Math.min(0.3, pt(u0));
      // строки фото — прямые строки выкройки: по одной линейной шкале от точки у основания шеи до низа.
      // По своему столбцу (верхний край фото) — только у самого верха (горловина, плечо), ниже — плавно в общую шкалу;
      // иначе у столбцов над плечом и над вырезом разная шкала, и клетка/полоска на груди изгибалась «галочкой»
      const vCol = tv + Math.max(0, y - py) / Math.max(0.05, M.L - py) * (hv - tv), vS = t0 + y / M.L * (hv - t0), bw = Math.max(0, 1 - Math.max(0, y - py) / 0.09);
      const v = Math.min(hv - 0.01, Math.max(vS + (vCol - vS) * bw * bw, tv + 0.012));   // не выше края вещи на фото в этом столбце (крутое плечо — иначе фон)
      if (PR && y > M.AD && v > arm) { const e = PR[Math.max(0, Math.min(PR.length - 1, Math.floor(v * PR.length)))];
        if (e) { const hw_ = (e[1] - e[0]) / 2, c_ = (e[0] + e[1]) / 2, t = Math.min(1, (y - M.AD) / 0.06), f = Math.min(1, Math.abs(x) / sideR(y));
          // плавный переход от проймы (прежняя ширина) к построчной
          // середина — по средней линии вещи (застёжка, пуговицы, принт по центру остаются прямыми), ширина — по строке фото;
          // середина строки силуэта на фото «гуляет» (модель стоит чуть боком) — по ней планка пуговиц изгибалась
          const cl = mirror ? a.cx : cAt(a, v), side_ = Math.sign(x) * (mirror ? -1 : 1), edge = side_ > 0 ? e[1] : e[0];
          const uRow = cl + (edge - cl) * f * 0.985, uOld = mirror ? u0 : cAt(a, v) + sx_; return [uOld + (uRow - uOld) * t, v]; } }
      return [mirror ? u0 : cAt(a, v) + sx_, v]; }; };
    const F = mk(M.ND), B = mk(M.NDb);
    // половина переда (расстёгнута): контур до середины, край по середине — свободный (молния/борт)
    const mkHalf = (nd, sgn) => { const pts = [], labs = [];
      for (let i = 0; i <= 5; i++) { const t = i / 5; pts.push([M.NW / 2 * Math.sin(t * Math.PI / 2), nd * Math.cos(t * Math.PI / 2)]); labs.push(i < 5 ? 'neck' : 'shoulder'); }
      arm.forEach((p, i) => { pts.push(p); labs.push(i < nA ? 'arm' : 'side'); });
      sideTail(pts, labs); pts.push([0, M.L]); labs.push('cf');
      return {P: pts.map(([x, y]) => [sgn * (x + 0.004), y]), L: labs}; };
    // края по тому, какого соседа нет: сверху — плечо (или горловина у середины), сбоку выше подмышки — пройма, ниже — бок, снизу — низ
    const cls = nd => (p, m) => {
      if (m.down && p.y > M.L - cell * 1.5 && !(m.side && p.y > M.AD)) return 'hem';   // нижний угол бока — в шов, иначе у подола «крылышко»
      if (Math.abs(p.x) < M.NW / 2 + cell * 0.6 && p.y < nd + cell) return 'neck';
      if (m.side && p.y > M.SD - 0.01 && p.y < M.AD + cell * 0.5 && Math.abs(p.x) > M.S / 2 - cell) return 'arm';
      if (m.up && p.y < M.SD + 0.03) return 'shoulder';
      if (m.side && p.y >= M.AD) return 'side';
      return null; };
    const clsF = (p, m) => (open && m.side && Math.abs(p.x) < 0.004 + cell * 1.2) ? 'cf' : cls(M.ND)(p, m);
    const placeF = (x, y) => [x, yTop - y, zo], uvF = uvT(aF, false, dr.front, M.ND);
    const fronts = open ? [-1, 1].map(sg => { const Hf = mkHalf(M.ND, sg); return addPanel(C, Hf.P, Hf.L, cell, placeF, uvF, mF, 'front', null, clsF); })
      : [addPanel(C, F.P, F.L, cell, placeF, uvF, mF, 'front', null, cls(M.ND))];
    const pb = addPanel(C, B.P, B.L, cell, (x, y) => [x, yTop - y, -zo], uvT(aB, true, dr.back || dr.front, M.NDb), mB, 'back', null, cls(M.NDb));
    // швы: плечи и бока — перед со спинкой (ближайшая точка края спинки с той же меткой)
    // угол плеча (плечевая точка) может попасть в метку «пройма» у одной детали и «плечо» у другой — шьём и его, иначе на плече дырка
    const lb_ = q => q.lab === 'arm' && q.y < M.SD + cell * 0.9 ? 'shoulder' : q.lab;
    const bEdge = pb.pts.filter(p => p.edge && (lb_(p) === 'shoulder' || p.lab === 'side'));
    fronts.forEach(pf => pf.pts.forEach(p => { if (!p.edge || (lb_(p) !== 'shoulder' && p.lab !== 'side')) return; let best = cell * 0.8, q = null;
      for (const b of bEdge) { if (lb_(b) !== lb_(p)) continue; const dd = Math.abs(b.x - p.x) + Math.abs(b.y - p.y); if (dd < best) { best = dd; q = b; } } if (q) C.seams.push([p.g, q.g]); }));
    // расстёгнутые полочки: пока шьём, край у середины стоит на месте (как сметан) — иначе мягкую на сжатие ткань стягивает к боковому шву
    // застёгнутая вещь симметрична: середина переда и спинки (молния, планка, принт) остаётся ровно посередине, не виляет
    // (ближайший к середине столбец или пара столбцов по обе стороны: их середина держится на x = 0)
    if (!open) C.mid = fronts.concat([pb]).flatMap(P_ => { const mn = Math.min(...P_.pts.map(p => Math.abs(p.x))), col = P_.pts.filter(p => Math.abs(Math.abs(p.x) - mn) < 1e-4);
      return col.filter(p => p.x >= -1e-4).map(p => { const q = col.find(o => o.r === p.r && Math.abs(o.x + p.x) < 1e-4) || p; return [p.g, q.g]; }); });
    if (open) C.hold = fronts.flatMap(pf => pf.pts.filter(p => p.edge && p.lab === 'cf').map(p => p.g));
    if (tucked) fronts.concat([pb]).forEach(P_ => P_.pts.forEach(p => { if (p.edge && p.lab === 'hem') C.pin[p.g] = 1; }));
    // рукава: трубы вдоль руки, верхнее кольцо вшито в пройму (перед: от плеча к подмышке — спереди трубы; спинка — сзади)
    // нет отдельного фото рукава — ткань берём с бока корпуса на фото (узкая полоса): цвет и фактура как у корпуса
    const merged = item.shape && item.shape.merged, j = armJ(d), sTex = (!merged && item.tex.sleeve) || item.tex.frontCut || item.tex.front, mS = photoMat(sTex, base); mS.side = THREE.DoubleSide;
    const sK = merged ? 0.3 : 0.62, sUV = item.tex.sleeve && !merged ? (u, v) => [u, v] : (u, v) => [aF.cx + (aF.hw || 0.3) * (sK + 0.1 * Math.abs(Math.sin(u * Math.PI))), 0.3 + 0.45 * v];   // рукава слились с корпусом на фото — ткань ближе к середине (с края там рука и блик)
    let armLen = 0; for (let i = 1; i < arm.length; i++) armLen += Math.hypot(arm[i][0] - arm[i - 1][0], arm[i][1] - arm[i - 1][1]);
    // окат = длине проймы по выкройке (перед + спинка); иначе шов растягивает верх рукава («рожки» на плечах)
    const hole = Math.max((M.AD + 0.01) * 2.1, armLen * 2 * 0.97), r0 = Math.max(hole / (2 * Math.PI), armRad(d, 0) + 0.015), r1 = Math.max(M.SO / Math.PI, armRad(d, Math.min(1, M.SL / j.L)) + 0.008);
    (M.noSleeve ? [] : [-1, 1]).forEach(side => {   // платье без рукавов (сарафан) — пройма остаётся открытой
      const D = new THREE.Vector3(Math.sin(j.th) * side, -Math.cos(j.th), 0);
      // начало рукава — в середине проймы (между плечевой точкой и подмышкой), чтобы шов сошёлся без натяжки
      const S0 = new THREE.Vector3(side * Math.max(j.x * 0.9, (M.S / 2 + M.W / 2) / 2), yTop - (M.SD + M.AD) / 2, 0);
      // окат: эллипс в плоскости проймы — по высоте от плеча до подмышки, по глубине — чтобы длина совпала с проймой
      // окат лежит вдоль линии проймы — от плечевой точки вниз к подмышке (наклонно), а не стоит вертикально снаружи от плеча:
      // иначе верх рукава оставался на высоте плеча над опущенной рукой — плечо выходило квадратным («погоны»)
      const aU = new THREE.Vector2(side * (M.S / 2 - M.W / 2), M.AD - M.SD), aLen = aU.length(); aU.normalize();
      const ry = aLen / 2 + 0.008, rz = solve(z => ellP(ry, z), 0.02, 0.3, hole);
      const cap = {center: new THREE.Vector3(side * (M.S / 2 + M.W / 2) / 2, yTop - (M.SD + M.AD) / 2, 0), ry, rz, up: new THREE.Vector3(aU.x, aU.y, 0)};
      // окат широкий (= пройме), но сразу под ним рукав сужается до ширины по бицепсу (как у настоящего рукава): иначе лишняя ткань
      // стоит над плечом колом («погоны», у жёсткого пуховика — особенно)
      const sB = Math.min(0.1, M.SL * 0.4), rB = Math.min(r0, Math.max(r1, armRad(d, 0.12) + 0.022 + (fab.margin || 0), r0 * 0.8));
      // рукав-фонарик: ткань рукава шире проймы (шов собирает её в сборку на плече), объём держится до манжеты, манжета — по руке
      const rP = Math.max(r0 * 1.04, armRad(d, 0.1) + 0.026), rC = armRad(d, Math.min(1, M.SL / j.L)) + 0.012;
      const radS = item.puff ? s => { const u = s / M.SL; return u < 0.82 ? rP * (1 - 0.18 * u * u) : rP * 0.88 + (rC - rP * 0.88) * Math.min(1, (u - 0.82) / 0.12); }
        : s => s < sB ? r0 + (rB - r0) * (s / sB) * (s / sB) * (3 - 2 * s / sB) : rB + (r1 - rB) * Math.pow((s - sB) / Math.max(0.01, M.SL - sB), 0.8);
      const tube = addTube(C, S0, D, M.SL, radS, 20, Math.max(6, Math.round(M.SL / 0.025)), mS, side, sUV, cap);
      const ring = tube.top, segs = ring.length;
      const loop = (P_, front) => P_.pts.filter(p => p.edge && p.lab === 'arm' && Math.sign(p.x) === side).sort((a, b) => a.y - b.y).map(p => p.g);
      const lf = fronts.flatMap(pf => pf.pts).filter(p => p.edge && p.lab === 'arm' && Math.sign(p.x) === side).sort((a, b) => a.y - b.y).map(p => p.g), lb = loop(pb, false);
      // спереди: угол 0 (плечо) → π (подмышка) через π/2 (перед); сзади: через 3π/2
      lf.forEach((g_, t) => { const a = Math.PI * (lf.length > 1 ? t / (lf.length - 1) : 0.5); C.seams.push([g_, ring[Math.round(a / (2 * Math.PI) * segs) % segs]]); });
      lb.forEach((g_, t) => { const a = 2 * Math.PI - Math.PI * (lb.length > 1 ? t / (lb.length - 1) : 0.5); C.seams.push([g_, ring[Math.round(a / (2 * Math.PI) * segs) % segs]]); });
      if (lf.length > 1 && lb.length > 1) chains.push({ring, lf, lb, rings: tube.rings});
    });
    if (hooded) addHood(C, d, M, fronts, pb, mS, hoodUp, cell, item.tex.sleeve && !merged ? null : sUV);
    else if (item.stand) addStand(C, d, yTop, fronts, pb, mF, aF);
  } else if (k === 'skirt') {
    // юбка: перед и спинка во всю ширину, сшиты по бокам; пояс на талии, книзу — по ширине на фото (прямая, трапеция, клёш)
    const {yW, WW, Lk, wvis} = skirtProf(item, d);
    // складки (item.pleats): ткань заложена гармошкой — у пояса круто (угол α0), книзу раскрываются (α1);
    // ширина ткани = видимая / cos α; у сгибов изгиб «помнит» сложенную форму (заутюженные складки)
    const pleat = false, cs = cell, a0 = 0.95, a1 = 0.35, half = 3 * cs;   // складки — рельефом на показе (pleatRelief), расчёт — гладкая трапеция
    const alpha = y => pleat ? a0 + (a1 - a0) * Math.pow(Math.min(1, y / Lk), 0.7) : 0;
    const pts = [[0, 0], [WW / Math.cos(alpha(0)) / 2, 0]], labs = ['waist'];
    const N = 10; for (let i = 1; i <= N; i++) { const y = Lk * i / N; pts.push([wvis(y) / Math.cos(alpha(y)) / 2, y]); labs.push('side'); }
    // наклонный бок длиннее середины: на конусе бока свисали бы «углами» ниже подола (у настоящей юбки-трапеции низ выкройки —
    // дуга, к бокам выше). Точку бока поднимаем на лишнюю длину бока; низ от бока к середине — плавно
    trueHem(pts, 1);
    labs[labs.length - 1] = 'hem'; for (let i = 1; i <= 3; i++) { const t = i / 4, [hx, hy] = pts[pts.length - 1]; pts.push([hx * (1 - t), hy + (Lk - hy) * Math.sin(t * Math.PI / 2)]); labs.push('hem'); }
    pts.push([0, Lk]); labs.push('hem');
    const {P: poly, L: lab} = mirrorPoly(pts, labs);
    yPin = yW; BOT_YW = yW; info = {WW, L: Lk};
    cover = {y0: yW - Lk + 0.03, y1: yW - 0.005, torso: true, legs: true};
    // «подъюбник» в расчёте: расклешённая юбка держит конус жёсткостью ткани (а эта — ещё и подкладом-шортами). Изгиб в расчёте
    // местный (через точку) — лишняя ширина у подола иначе проваливается между ног. Невидимый конус ниже бёдер чуть меньше юбки
    { const ua = under ? Array.from(under.a) : new Array(101).fill(0), ub = under ? Array.from(under.b) : new Array(101).fill(0), kf = item.pleats ? 0.93 : 0.85;
      for (let i = 0; i <= 100; i++) { const yy = i / 100 * H, y = yW - yy; if (y < Lk * 0.35 || y > Lk) continue;
        const r = wvis(y) / Math.PI * kf * Math.min(1, (y - Lk * 0.35) / (Lk * 0.25)); if (r <= 0) continue; ua[i] = Math.max(ua[i] || 0, r * 1.08); ub[i] = Math.max(ub[i] || 0, r * 0.86); }
      under = {a: ua, b: ub, raw: 1}; }
    // гармошка: x ткани → видимый x (x·cos α) и глубина складки (треугольная волна по ткани, амплитуда ~ sin α)
    const tri = x => { const q = Math.abs(x) % (2 * half); return q < half ? q : 2 * half - q; };
    const fold = (x, y) => { const al = alpha(y); return [x * Math.cos(al), tri(x) * Math.sin(al)]; };
    // принт — построчно: видимый край ↔ край вещи в той же строке фото
    const PRf = rowSpans(dr.front, aF), PRb = rowSpans(dr.back || dr.front, aB);
    // низ на фото может быть «рваным» (концы складок, из-под них подклад): последняя сплошная строка — не уже 85% самой широкой
    const vMax = PR => { if (!PR) return 0.99; let mx = 0; PR.forEach(e => { if (e) mx = Math.max(mx, e[1] - e[0]); }); let r = PR.length - 1; while (r > 0 && (!PR[r] || PR[r][1] - PR[r][0] < 0.85 * mx)) r--; return Math.max(0.5, (r + 0.5) / PR.length); };
    const vmF = vMax(PRf), vmB = vMax(PRb);
    const uvS = (mirror, PR, a) => (x, y) => { const v = Math.min(0.99, y / Lk) * (mirror ? vmB : vmF), [xv] = fold(x, y), f = Math.max(-1, Math.min(1, xv / (wvis(y) / 2)));
      const e = PR && PR[Math.max(0, Math.min(PR.length - 1, Math.floor(v * PR.length)))];
      if (e) { const c_ = (e[0] + e[1]) / 2, hw_ = (e[1] - e[0]) / 2 - 0.004; return [c_ + (mirror ? -1 : 1) * f * hw_, v]; }
      return [mirror ? a.cx - x / WW * 0.5 : a.cx + x / WW * 0.5, v]; };
    const placeS = zs => (x, y) => { const [xv, zf] = fold(x, y); return [xv, yW - y, zs * (zo * 0.9 + zf)]; };
    const e0 = C.E.length;
    const pf = addPanel(C, poly, lab, cs, placeS(1), uvS(false, PRf, aF), mF, 'front', null, null, 0);
    const pb = addPanel(C, poly, lab, cs, placeS(-1), uvS(true, PRb, aB), mB, 'back', null, null, 0);
    // сложенные складки: диагонали и изгиб — по сложенной форме (растяжение по основе и утку — по ткани, она не тянется)
    if (pleat) for (let e = e0; e < C.E.length; e += 4) { const kd = C.E[e + 3]; if (kd !== 1 && kd !== 2) continue; const i = C.E[e] * 3, j = C.E[e + 1] * 3;
      C.E[e + 2] = Math.hypot(C.P[j] - C.P[i], C.P[j + 1] - C.P[i + 1], C.P[j + 2] - C.P[i + 2]); }
    // складки (плиссе/заложенные): рельеф на показе — ступенчатый сдвиг по нормали вдоль ткани, у пояса заутюжены (мелко), книзу раскрыты
    if (item.pleats) [pf, pb].forEach((P_, j) => { const m = C.meshes[C.meshes.length - 2 + j]; m.relief = {px: P_.pts.map(p => p.x), py: P_.pts.map(p => p.y), half: 0.026, L: Lk, amp: 0.011}; });
    // бок: и нижний угол (у подола) — точки без соседа слева или справа; иначе у подола торчат «крылышки»
    // (только у линии бока выкройки: концы короткой нижней строки у скруглённого низа — это низ, не бок)
    const sideSegs = []; for (let i = 0; i < poly.length; i++) if (lab[i] === 'side') sideSegs.push([poly[i], poly[(i + 1) % poly.length]]);
    const nearSide = p => sideSegs.some(([a_, b_]) => segDist(p.x, p.y, a_, b_) < cs * 1.3);
    pf.pts.forEach(p => { if (!p.edge || p.y < cs * 1.1 || (pf.at(p.r, p.c - 1) && pf.at(p.r, p.c + 1)) || !nearSide(p)) return; const q = pb.at(p.r, p.c); if (q && q.edge) C.seams.push([p.g, q.g]); });
    [pf, pb].forEach(P_ => P_.pts.forEach(p => { if (p.y < cs * 1.1) C.pin[p.g] = 1; }));
  } else {
    C.tether = null;   // брюки: висят на поясе, вытягивания нет — привязи только мешали штанинам
    const sp = bottomSpec(item, d), cm = itemCm(item, d.b), sh = item.shape || {};
    const WW = Math.max(sp.ww, ellP(bodyAB(d, sp.yW / H).a, bodyAB(d, sp.yW / H).b) / 2 + 0.01), R = sp.yW - sp.yC, IN = sp.legLen + sp.stack;
    const HP = Math.max(sp.hip || WW * 1.15, ellP(bodyAB(d, 0.53).a, bodyAB(d, 0.53).b) / 2 + 0.03);
    const lw = sp.lw.slice(), TW = Math.max(lw[0], HP * 0.55, d.thigh * Math.PI + 0.02);
    // штанина не уже ноги (+ свободное облегание ~3 см по полуобхвату): иначе тесная труба в расчёте соскакивает с ноги вбок
    const legW = t => { const yf = (sp.yW - R - IN * t) / H, r = Math.min(legR(d, Math.max(0, yf)), d.legX - 0.002) + 0.007; return Math.max(interp(lw, t) * (TW / lw[0]), 0.12, Math.PI * r + 0.03); };
    yPin = sp.yW; info = {WW, HP, R, IN, TW}; BOT_YW = sp.yW;
    cover = {y0: sp.yHem + 0.03, y1: sp.yW - 0.005, torso: true, legs: true};
    // выкройка как у настоящих брюк: четыре детали (перед и спинка, левая и правая). Штанина — вокруг своей ноги (ось на legX):
    // у широкой штанины внутренний край заходит за середину — это «шаговый язычок», он уходит между ног вглубь.
    // Раньше перед был одной деталью с внутренним швом у самой середины: штанина висела снаружи от ноги, к низу сходилась к ноге
    // конусом и «липла», а по глубине оставалась узкой.
    const cxL = d.legX + 0.01, N = 10, xo = t => Math.max(cxL + legW(t) / 2, t < 0.35 ? HP / 2 * (1 - t / 0.35) + (cxL + legW(t) / 2) * (t / 0.35) : 0), xi = t => cxL - legW(t) / 2;
    // метка hl[i] — отрезок от half[i] к half[i+1] (последний — к half[0]); число меток = числу точек
    const half = [[0, 0], [WW / 2, 0], [HP / 2, R * 0.55]], hl = ['waist', 'side', 'side'];
    for (let i = 0; i <= N; i++) { const t = i / N; half.push([xo(t), R + IN * t]); if (i < N) hl.push('side'); }
    hl.push('hem');                                                     // от внешнего угла низа к внутреннему
    for (let i = N; i >= 0; i--) { const t = i / N; half.push([xi(t), R + IN * t]); if (i > 0) hl.push('inner'); }
    // от шага к середине — сидение и ширинка (шов посередине), плавной кривой
    const x0 = xi(0); half.push([x0 * 0.45, R * 0.93], [0, R * 0.72]); hl.push('rise', 'rise', 'rise');
    const polyOf = sg => half.map(([x, y]) => [sg * x, y]);
    const spansOf = poly => y => { const xs = []; for (let i = 0; i < poly.length; i++) { const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length]; if ((ay > y) !== (by > y)) xs.push(ax + (bx - ax) * (y - ay) / (by - ay)); } xs.sort((a, b) => a - b); return xs.length >= 2 ? [xs[0], xs[xs.length - 1]] : null; };
    const runs = (g, v) => { const row = g.grid[Math.max(0, Math.min(g.gh - 1, Math.floor(v * g.gh)))], r = []; let c = 0; while (c < g.gw) { if (row[c] === '1') { const c0 = c; while (c < g.gw && row[c] === '1') c++; if (c - c0 > 1) r.push([c0 / g.gw, c / g.gw]); } else c++; } return r; };
    // uv по строкам: деталь ↔ своя половина вещи на фото (выше шага — от середины к боку, ниже — своя штанина от внутреннего края к внешнему)
    const uvP = (a, mirror, g, sg, poly) => { const sp_ = spansOf(poly), ph = mirror ? -sg : sg, cr = a.crotch || 0.4; return (x, y) => {
      const v = y < R ? y / R * cr : cr + (y - R) / IN * (1 - cr), iv = sp_(y), wpx = a.ww || 0.6; let u = a.cx + ph * Math.abs(x) / WW * wpx;
      if (g && iv) { const Rn = runs(g, v), inn = sg > 0 ? iv[0] : iv[1], out = sg > 0 ? iv[1] : iv[0], t = Math.max(0.02, Math.min(0.98, (x - inn) / ((out - inn) || 1e-4)));
        let r = null; if (y < R) { const c = Rn.find(([p, q]) => p <= a.cx && q >= a.cx) || Rn[0]; if (c) r = ph > 0 ? [a.cx, c[1]] : [a.cx, c[0]]; }
        else { const sideRuns = Rn.filter(([p, q]) => ph > 0 ? q > a.cx : p < a.cx); let c = ph > 0 ? sideRuns[sideRuns.length - 1] : sideRuns[0];
          if (c) { if (c[0] < a.cx && c[1] > a.cx) c = ph > 0 ? [a.cx, c[1]] : [c[0], a.cx]; r = ph > 0 ? [c[0], c[1]] : [c[1], c[0]]; } }
        if (r) u = r[0] + (r[1] - r[0]) * t; }
      return [u, v]; }; };
    if (dr.front) { const row = dr.front.grid[1] || dr.front.grid[0]; aF.ww = (row.lastIndexOf('1') - row.indexOf('1') + 1) / dr.front.gw; }
    if (dr.back) { const row = dr.back.grid[1] || dr.back.grid[0]; aB.ww = (row.lastIndexOf('1') - row.indexOf('1') + 1) / dr.back.gw; }
    // у спинки в заду ткани больше: связи по горизонтали длиннее до шага
    const seat = (x, y) => y < R * 1.05 ? 1 + 0.14 * Math.sin(Math.min(1, y / R) * Math.PI * 0.9) : 1;
    const parts = {};
    // в начале шаговые язычки левой и правой штанины лежат друг на друге (деталь центрована на своей ноге — так при сшивании
    // штанина сворачивается вокруг ноги); разводятся по сторонам, когда штанина уже обняла ногу (C.half в runCloth)
    // лишняя длина (ляжет на обувь и пол) в начале не должна уходить под пол: прижатая к полу ткань сжата и выталкивает
    // штанину вверх, а потом её держит трение о ноги — брюки выходили короткими, как шорты. Ниже шага сжимаем по высоте
    const kY = Math.min(1, (sp.yW - R - 0.012) / IN), yOf = y => y <= R ? y : R + (y - R) * kY;
    [1, -1].forEach(sg => { const poly = polyOf(sg), L = hl.slice(), pl = z => (x, y) => [x, sp.yW - yOf(y), z];
      parts['f' + sg] = addPanel(C, poly, L, cell, pl(zo * 0.95), uvP(aF, false, dr.front, sg, poly), mF, 'front', null, null, 0);
      parts['b' + sg] = addPanel(C, poly, L, cell, pl(-zo * 0.95), uvP(aB, true, dr.back, sg, poly), mB, 'back', seat, null, 0); });
    // швы: бок и шаговый — перед со спинкой своей стороны (одинаковая выкройка — одинаковые ячейки); сидение — левая с правой (зеркально)
    [1, -1].forEach(sg => { const pf = parts['f' + sg], pb = parts['b' + sg]; pf.pts.forEach(p => { if (!p.edge || (p.lab !== 'side' && p.lab !== 'inner')) return; const q = pb.at(p.r, p.c); if (q && q.edge && q.lab === p.lab) C.seams.push([p.g, q.g]); }); });
    // (у самого шага сходятся четыре детали — туда же берём начало шаговых швов, иначе в развилке остаётся дырка)
    const crotchJoin = p => p.edge && (p.lab === 'rise' || (p.lab === 'inner' && p.y < R + cell * 4));
    ['f', 'b'].forEach(k => { const A = parts[k + '1'], B = parts[k + '-1'], eb = B.pts.filter(crotchJoin);
      // (шов сидения и ширинки: у середины столбцы на ±cell/2 — пара по зеркалу; ниже по кривой шага — ближайшая точка)
      A.pts.forEach(p => { if (!crotchJoin(p)) return; let best = cell * 1.3, q = null; for (const o of eb) { const dd = Math.abs(o.x + p.x) + Math.abs(o.y - p.y); if (dd < best) { best = dd; q = o; } } if (q) C.seams.push([p.g, q.g]); }); });
    // штанины не проходят друг сквозь друга: ниже шага каждая держится своей стороны от середины
    // (только верх штанины, где язычки: ниже ноги манекена сами разводят штанины, а у пола лишняя длина должна ложиться свободно —
    // иначе её выталкивает наружу и низ штанины стаскивает с ноги)
    C.half = []; [1, -1].forEach(sg => ['f', 'b'].forEach(k => parts[k + sg].pts.forEach(p => { if (p.y > R + cell && p.y < R + IN * 0.4) C.half.push([p.g, sg]); })));
    Object.values(parts).forEach(P_ => P_.pts.forEach(p => { if (p.y < cell * 1.1) C.pin[p.g] = 1; }));
    C.fr = 0.1;
    // штанина держится вокруг своей ноги: перед — спереди (z ≥ 0), спинка — сзади, внутренняя половина детали — с внутренней стороны
    // от оси ноги, внешняя — с внешней. Без этого труба штанины под тяжестью проворачивалась вокруг ноги и соскакивала с неё
    C.sector = []; [1, -1].forEach(sg => { const sp_ = spansOf(polyOf(sg)); ['f', 'b'].forEach(k => parts[k + sg].pts.forEach(p => { if (p.y <= R + cell) return; const iv = sp_(p.y); if (!iv) return;
      const inn = sg > 0 ? iv[0] : iv[1], out = sg > 0 ? iv[1] : iv[0], t = (p.x - inn) / ((out - inn) || 1e-4); C.sector.push([p.g, k === 'f' ? 1 : -1, t < 0.3 ? -sg : t > 0.7 ? sg : 0, sg * (d.legX + 0.01)]); })); });
  }
  const finish = P => { if (typeof window !== 'undefined' && window.__dbgC) window.__dbgC.push({k, C, P});
  // окат рукава после расчёта кладём точно на край проймы (между сшитыми точками кольцо рукава иначе отходит — видна щель)
  chains.forEach(({ring, lf, lb, rings}) => { const segs = ring.length;
    // концы проймы (у плеча и под мышкой) у переда и спинки — одна точка: сводим к середине
    [[lf[0], lb[0]], [lf[lf.length - 1], lb[lb.length - 1]]].forEach(([a, b]) => { for (let k = 0; k < 3; k++) { const m = (P[a * 3 + k] + P[b * 3 + k]) / 2; P[a * 3 + k] = m; P[b * 3 + k] = m; } });
    const along = (L, t) => { const f = t * (L.length - 1), i = Math.min(L.length - 2, Math.floor(f)), w = f - i, a = L[i] * 3, b = L[i + 1] * 3; return [0, 1, 2].map(k => P[a + k] * (1 - w) + P[b + k] * w); };
    // те же пары, что у швов: точка проймы k ↔ вершина кольца idx(k); между ними — по длине проймы (без сдвига вдоль шва)
    const idxF = k => Math.round(k / (lf.length - 1) * segs / 2), idxB = k => Math.round((2 * Math.PI - Math.PI * k / (lb.length - 1)) / (2 * Math.PI) * segs);
    const param = (j, n, idx) => { for (let k = 0; k < n - 1; k++) { const a = idx(k), b = idx(k + 1), lo = Math.min(a, b), hi = Math.max(a, b); if (j >= lo && j <= hi) return (k + (hi === lo ? 0 : (a < b ? (j - a) / (b - a) : (a - j) / (a - b)))) / (n - 1); } return null; };
    for (let j = 0; j <= segs; j++) { const t = j <= segs / 2 ? param(j, lf.length, idxF) : param(j, lb.length, idxB); if (t == null) continue; const q = along(j <= segs / 2 ? lf : lb, t), r = ring[j % segs] * 3; P[r] = q[0]; P[r + 1] = q[1]; P[r + 2] = q[2]; }
    // верх рукава вдоль руки сглаживаем: запас оката иначе встаёт «погоном» над плечом
    const G = rings || []; for (let pass = 0; pass < 4; pass++) for (let i = 1; i < Math.min(4, G.length - 1); i++) for (let j = 0; j < segs; j++) { const a = G[i - 1][j] * 3, b = G[i][j] * 3, c = G[i + 1][j] * 3;
      for (let k = 0; k < 3; k++) P[b + k] += ((P[a + k] + P[c + k]) / 2 - P[b + k]) * 0.6; push(P, b); } });
  const g = clothMeshes(C, P, H);
  g.userData.measures = info; if (cover) g.userData.cover = Object.assign(cover, {color: base});
  if (typeof window !== 'undefined' && window.__keep) window.__last = {C, P};
  try { QC[item.id] = qcCloth(C, P, d, item, dr, info, top, aF, aB); g.userData.qc = QC[item.id]; } catch (e) { QC[item.id] = null; }
  return g; };
  seamBend(C);
  return {C, fab, yPin, d, under, margin: fab.margin || 0, finish, run: () => finish(runCloth(C, makeCollider(d, under, fab.margin), fab, yPin))};
}
export function drapeTemplate(item, d, under) { const j = drapePrepare(item, d, under); return j ? j.run() : null; }

// ---------- расчёт ткани в фоновом потоке и кэш ----------
// Расчёт вещи — 1.5–2.5 с на компьютере и в 2–3 раза дольше на телефоне. В фоне страница не замирает,
// а готовый результат (точки ткани) хранится: та же вещь на той же фигуре во второй раз надевается сразу.
// Версия расчёта: менять при любой правке выкроек, швов или расчёта — старый кэш станет недействительным.
export const CLOTH_VER = 'c44';
// анимация надевания (FIT.setAnim(false) — выключить, для автопроверок); «без анимации» на сайте и системная настройка — тоже выключают
const ANIM = {on: true};
function calmNow() { try { const v = localStorage.getItem('maxi-calm'); if (v !== null) return v === '1'; } catch (e) {} try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
let WORKER = null, WSEQ = 0; const WJOBS = new Map();
function clothWorker() {
  if (WORKER !== null) return WORKER;
  try {
    // код расчёта берём из этих же функций (toString): отдельный файл не нужен ни Vite, ни сборке артефакта
    const src = [torsoR, sx, sz, armRad, armX, armJ, legR, makeCollider, motionAt, runCloth].map(f => { const t = f.toString(); return /^function[\s*(]/.test(t) ? t : 'const ' + f.name + ' = ' + t + ';'; }).join('\n')
      + '\nself.onmessage = e => { const {id, C, d, under, fab, yPin, margin, rec} = e.data; try { const o = {rec}; const P = runCloth(C, makeCollider(d, under, margin), fab, yPin, o); self.postMessage({id, P, F: o.frames, M: o.meta, nf: o.nf}, o.frames ? [P.buffer, o.frames.buffer] : [P.buffer]); } catch (err) { self.postMessage({id, err: String(err && err.message || err)}); } };';
    WORKER = new Worker(URL.createObjectURL(new Blob([src], {type: 'text/javascript'})));
    WORKER.onmessage = e => { const j = WJOBS.get(e.data.id); if (!j) return; WJOBS.delete(e.data.id); if (e.data.err) { console.warn('расчёт ткани в фоне не удался, считаю здесь:', e.data.err); WORKER = false; j.reject(new Error(e.data.err)); } else { if (e.data.F) e.data.P.anim = {F: e.data.F, M: e.data.M, nf: e.data.nf}; j.resolve(e.data.P); } };
    WORKER.onerror = () => { WJOBS.forEach(j => j.reject(new Error('worker'))); WJOBS.clear(); WORKER = false; };
  } catch (e) { WORKER = false; }
  return WORKER;
}
// изгиб через шов деталь–деталь (бок, плечо, шаг, сидение, капюшон): без него шов — шарнир, и бок под тяжестью
// складывается внутрь острой складкой — сбоку вещь выглядит «перетянутой». Связь — между соседями шва внутри деталей,
// длина покоя — как у ровного шва. Пройму (рукав к корпусу) не трогаем: там угол настоящий.
function seamBend(C) {
  const n = C.pin.length, panel = new Uint8Array(n), inSeam = new Uint8Array(n), adj = Array.from({length: n}, () => []);
  C.meshes.forEach(m => { if (!m.local) m.verts.forEach(v => { panel[v] = 1; }); });
  C.seams.forEach(([i, j]) => { inSeam[i] = 1; inSeam[j] = 1; });
  for (let e = 0; e < C.E.length; e += 4) { const k = C.E[e + 3]; if (k === 0 || k === 3) { adj[C.E[e]].push([C.E[e + 1], C.E[e + 2], k]); adj[C.E[e + 1]].push([C.E[e], C.E[e + 2], k]); } }
  // сосед внутрь детали: у бокового шва — по утку (горизонтальный), иначе по основе; ровно один
  const inner = i => { const L = adj[i].filter(([q]) => !inSeam[q]); const w = L.filter(e => e[2] === 3); return (w.length ? w : L).slice(0, 1); };
  C.seams.forEach(([i, j]) => { if (!panel[i] || !panel[j]) return;
    for (const [a, la] of inner(i)) for (const [b, lb] of inner(j)) C.link(a, b, (la + lb) * 0.98, 2); });
}
// точки деталей корпуса (не труб рукавов) — для makeCollider (noArm)
function armFlags(C) { const f = new Uint8Array(C.pin.length); C.meshes.forEach(m => { if (!m.local) m.verts.forEach(v => { f[v] = 1; }); }); return f; }
function solveInWorker(job) {
  const w = clothWorker(); if (!w) return Promise.resolve(null);
  const id = ++WSEQ, C = job.C, msg = {id, C: {P: Float32Array.from(C.P), E: C.E, seams: C.seams, pin: C.pin, hold: C.hold, mid: C.mid, half: C.half, sector: C.sector, force: C.force, stickyIds: C.stickyIds, fr: C.fr, noArm: C.noArm || armFlags(C), tether: Float32Array.from(C.tether || [])}, d: job.d, under: job.under, fab: typeof window !== 'undefined' && window.__fab ? Object.assign({}, job.fab, window.__fab) : job.fab, yPin: job.yPin, margin: job.margin, rec: !!job.rec};   // __fab — проба ткани (отладка)
  return new Promise((resolve, reject) => { WJOBS.set(id, {resolve, reject}); w.postMessage(msg); }).catch(() => null);
}
// кэш: в памяти (последние 40) и в IndexedDB браузера (последние 300, ~50 КБ каждый)
const MEMC = new Map();
let IDB = null;
function idb() {
  if (IDB) return IDB;
  IDB = new Promise(res => { try { const r = indexedDB.open('maxi-fit', 1); r.onupgradeneeded = () => r.result.createObjectStore('drape'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } });
  return IDB;
}
async function cacheGet(key) {
  if (MEMC.has(key)) return MEMC.get(key);
  const db = await idb(); if (!db) return null;
  return new Promise(res => { try { const q = db.transaction('drape').objectStore('drape').get(key); q.onsuccess = () => { const v = q.result; if (v && v.p) { MEMC.set(key, v.p); res(v.p); } else res(null); }; q.onerror = () => res(null); } catch (e) { res(null); } });
}
async function cachePut(key, P) {
  MEMC.set(key, P); if (MEMC.size > 40) MEMC.delete(MEMC.keys().next().value);
  const db = await idb(); if (!db) return;
  try { const tx = db.transaction('drape', 'readwrite'), st = tx.objectStore('drape'); st.put({p: P, t: Date.now()}, key);
    // изредка чистим: оставляем 300 самых свежих
    if (Math.random() < 0.1) { const all = st.getAll(), keys = st.getAllKeys(); tx.oncomplete = null;
      keys.onsuccess = () => { all.onsuccess = () => { const L = keys.result.map((k, i) => [k, all.result[i].t]).sort((a, b) => b[1] - a[1]); if (L.length > 300) { const t2 = db.transaction('drape', 'readwrite').objectStore('drape'); L.slice(300).forEach(([k]) => t2.delete(k)); } }; }; } } catch (e) {}
}
// одна вещь: подготовка здесь, расчёт — из кэша, в фоне или (если фон недоступен) здесь же
export async function garmentMeshAsync(item, d, key, alive, opts) {
  if (!item.tex) return garmentMesh(item, d);
  delete QC[item.id];
  const un = UNDER ? {a: UNDER.slice(), b: UNDERZ.slice()} : null, job = drapePrepare(item, d, un);
  if (!job) return garmentMesh(item, d);
  // anim: показать надевание в движении — только при новом расчёте (из кэша вещь сразу на месте); ключ кэша свой: итог после движения
  const anim = !!(opts && opts.anim); if (key && anim) key += '|a';
  let P = key && !(opts && opts.fresh) ? await cacheGet(key) : null, A = null;
  if (!P) { job.rec = anim; P = await solveInWorker(job); if (alive && !alive()) return null;
    if (!P) { const o = {rec: anim}; P = runCloth(job.C, makeCollider(job.d, job.under, job.margin), job.fab, job.yPin, o); if (o.frames) P.anim = {F: o.frames, M: o.meta, nf: o.nf}; }
    A = P.anim || null; if (key) cachePut(key, P); }
  if (alive && !alive()) return null;
  const g = job.finish(Float32Array.from(P)); if (g && A) g.userData.anim = Object.assign(A, {C: job.C}); return g;
}

// ---------- автопроверка надетой вещи ----------
// после расчёта: натяжение ткани, швы, ткань внутри тела, вещь на месте, дырки (прозрачные места фото на ткани),
// форма силуэта спереди против фото, мерки против выкройки/таблицы. Итог 0–100 и «проверить», если ниже 70.
export const QC = {};
function qcCloth(C, P, d, item, dr, info, top, aF, aB) {
  const H = d.H, out = [], add = (name, ok, val, pen, why) => out.push({name, ok, val, pen: ok ? 0 : pen, why});
  // 1. натяжение: доля связей, растянутых больше чем на 12%
  const roleOf = new Map(); C.meshes.forEach(m => m.verts.forEach(v => roleOf.set(v, m.role || 'sleeve'))); const byRole = {};
  let nE = 0, over = 0; for (let e = 0; e < C.E.length; e += 4) { if (C.E[e + 3] !== 0 && C.E[e + 3] !== 3) continue; const i = C.E[e] * 3, j = C.E[e + 1] * 3, L = Math.hypot(P[j] - P[i], P[j + 1] - P[i + 1], P[j + 2] - P[i + 2]); nE++;
    const r = roleOf.get(C.E[e]), br = byRole[r] = byRole[r] || [0, 0]; br[0]++; if (L > C.E[e + 2] * 1.25) { over++; br[1]++; } }
  const st = over / Math.max(1, nE); add('натяжение', st < 0.03, (st * 100).toFixed(1) + '% связей (' + Object.entries(byRole).map(([r, [a, b]]) => r + ' ' + (b / a * 100).toFixed(0) + '%').join(', ') + ')', Math.min(25, st * 400), 'ткань растянута: вещь мала или зацепилась');
  // 2. швы: доля сшитых пар, разошедшихся больше чем на 1 см
  let gap = 0; for (const [i, j] of C.seams) if (Math.hypot(P[j * 3] - P[i * 3], P[j * 3 + 1] - P[i * 3 + 1], P[j * 3 + 2] - P[i * 3 + 2]) > 0.01) gap++;
  const sg = gap / Math.max(1, C.seams.length); add('швы', sg < 0.03, (sg * 100).toFixed(1) + '% разошлось', Math.min(25, sg * 250), 'шов не сошёлся — видна щель');
  // 3. ткань внутри тела (глубже 1 мм под поверхностью)
  const body = makeCollider(d, null), Q = new Float32Array(3); let inside = 0; const n = C.pin.length;
  for (let i = 0; i < n; i++) { Q[0] = P[i * 3]; Q[1] = P[i * 3 + 1]; Q[2] = P[i * 3 + 2]; body(Q, 0); if (Math.hypot(Q[0] - P[i * 3], Q[1] - P[i * 3 + 1], Q[2] - P[i * 3 + 2]) > 0.008) inside++; }
  const ins = inside / Math.max(1, n); add('сквозь тело', ins < 0.02, (ins * 100).toFixed(1) + '% точек', Math.min(20, ins * 300), 'тело проходит сквозь ткань');
  // 4. вещь на месте: верх — плечи на плечах и низ там, где задумано; низ — пояс на поясе
  const torso = C.meshes.filter(m => m.role === 'front' || m.role === 'back'), ys = torso.flatMap(m => m.verts.map(v => P[v * 3 + 1]));
  const yMax = Math.max(...ys), yMin = Math.min(...ys);
  if (top) { const want = 0.858 * H + 0.012 - (info.L0 || info.L); add('на месте', yMax > 0.815 * H && Math.abs(yMin - want) < 0.07 + (item.state === 'tucked' ? 0.05 : 0), 'верх ' + (yMax / H).toFixed(2) + 'H, низ ' + ((yMin - want) * 100).toFixed(0) + ' см от задуманного', 25, 'вещь сползла или длина не та'); }
  else add('на месте', yMax > 0.55 * H, 'пояс ' + (yMax / H).toFixed(2) + 'H', 25, 'брюки сползли');
  // 5. дырки: доля треугольников переда/спинки, чья середина на фото — вне вещи (прозрачно)
  let tri = 0, hole = 0;
  torso.forEach(m => { const g = m.role === 'front' ? dr.front : (dr.back || dr.front); if (!g) return;
    for (let t = 0; t < m.tris.length; t += 3) { const a = m.uv[m.tris[t]], b = m.uv[m.tris[t + 1]], c = m.uv[m.tris[t + 2]], u = (a[0] + b[0] + c[0]) / 3, v = (a[1] + b[1] + c[1]) / 3;
      const r = Math.min(g.gh - 1, Math.max(0, Math.floor(v * g.gh))), col = Math.min(g.gw - 1, Math.max(0, Math.floor(u * g.gw))); tri++; if (g.grid[r][col] !== '1') hole++; } });
  const hf = hole / Math.max(1, tri); add('дырки', hf < 0.04, (hf * 100).toFixed(1) + '% площади', Math.min(20, hf * 200), 'на ткань попал фон фото — будут прозрачные места');
  // 6. силуэт спереди против фото: ширина по высоте (от проймы/шага вниз), каждая в долях своей верхней строки
  const g0 = dr.front;
  if (g0) {
    const rows = 8, w3 = [], wp = [], front = torso.filter(m => m.role === 'front'), fv = front.flatMap(m => m.verts);
    const y0 = top ? 0.858 * H + 0.012 - info.AD - 0.02 : Math.max(...fv.map(v => P[v * 3 + 1])), y1 = Math.min(...fv.map(v => P[v * 3 + 1]));
    // на фото рукава слились с корпусом (висят вдоль) — силуэт на фото с рукавами: и у вещи меряем с рукавами
    const mergedPhoto = top && item.shape && item.shape.merged; if (mergedPhoto) C.meshes.forEach(m => { if (m.local) m.verts.forEach(v => fv.push(v)); });
    const a = aF, v0 = top ? (a.arm || 0.3) + 0.03 : 0.02;
    // низ корпуса на фото — последняя строка, где у середины ещё есть ткань (длинные рукава на вешалке висят ниже корпуса)
    const cRun = r => { const row = g0.grid[r], cc = Math.round(a.cx * g0.gw); if (row[cc] !== '1') return 0; let p = cc, q = cc; while (p > 0 && row[p - 1] === '1') p--; while (q < g0.gw - 1 && row[q + 1] === '1') q++; return q - p + 1; };
    let v1 = 0.97; if (top) { const r0 = Math.floor(v0 * g0.gh), w0 = cRun(r0); let r = r0; while (r + 1 < g0.gh && cRun(r + 1) > w0 * 0.75) r++; v1 = Math.max(v0 + 0.2, (r + 0.5) / g0.gh); }
    for (let k = 0; k < rows; k++) { const t = (k + 0.5) / rows, yy = y0 + (y1 - y0) * t; let lo = 9, hi = -9;
      // ширина ткани, а не размах: у брюк штанины на фото лёжа разведены — считаем занятые полосы по 2.5 см (щель в одну полосу закрываем)
      const bins = new Set(); fv.forEach(v => { if (Math.abs(P[v * 3 + 1] - yy) < 0.02) { bins.add(Math.floor(P[v * 3] / 0.025)); lo = Math.min(lo, P[v * 3]); hi = Math.max(hi, P[v * 3]); } });
      let occ = 0; if (hi > lo) for (let bI = Math.floor(lo / 0.025); bI <= Math.floor(hi / 0.025); bI++) if (bins.has(bI) || (bins.has(bI - 1) && bins.has(bI + 1))) occ++; w3.push(top ? (hi > lo ? hi - lo : 0) : occ * 0.025);
      const r = Math.min(g0.gh - 1, Math.floor((v0 + (v1 - v0) * t) * g0.gh)), row = g0.grid[r];
      // верх: только корпус (рукава на фото торчат в стороны) — ближайший к середине отрезок
      let c0 = row.indexOf('1'), c1 = row.lastIndexOf('1');
      if (top) { const cc = Math.round(a.cx * g0.gw); c0 = cc; while (c0 > 0 && row[c0 - 1] === '1') c0--; c1 = cc; while (c1 < g0.gw - 1 && row[c1 + 1] === '1') c1++; }
      // лёжа ширина = половина обхвата; надетое спереди видно уже: у бёдер (плоский овал) ~0.8, у штанин (круг) 2/π — приводим фото к виду надетой вещи
      const vv = v0 + (v1 - v0) * t; wp.push(top ? (c1 >= c0 ? (c1 - c0 + 1) / g0.gw : 0) : [...row].filter(ch => ch === '1').length / g0.gw * (vv > (a.crotch || 0.4) ? 2 / Math.PI / 0.8 : 1)); }
    const n3 = w3[0] || 1, np = wp[0] || 1; let dev = 0; for (let k = 0; k < rows; k++) dev += Math.abs(w3[k] / n3 - wp[k] / np) / rows;
    add('силуэт', dev < 0.12, 'расхождение ' + (dev * 100).toFixed(0) + '%', Math.min(20, dev * 100), 'форма спереди не похожа на фото');
    out[out.length - 1].prof = {model: w3.map(v => +(v / n3).toFixed(2)), photo: wp.map(v => +(v / np).toFixed(2))};
  }
  // 7. мерки: выкройка против таблицы (вещь не может быть меньше тела — если пришлось расширить, размер мал)
  if (top && info.sp) { const want = info.sp.Fs[1], got = info.W; add('мерки', got - want < 0.02, 'ширина ' + (got * 200).toFixed(0) + ' см по кругу, по фото/таблице ' + (want * 200).toFixed(0), 10, 'вещь по меркам меньше фигуры — показана растянутой'); if (out.length) out[out.length - 1].pen = 0; }   // это про размер (о нём говорит подсказка), не про модель
  const score = Math.max(0, Math.round(100 - out.reduce((s_, c) => s_ + c.pen, 0)));
  // «проверить» — и при низком итоге, и при одном сильном провале (например, фото с чужим предметом даёт кривой силуэт)
  return {score, ok: score >= 70 && !out.some(c => c.pen >= 20), checks: out};
}

// одна вещь на фигуре; если у вещи будет glb — здесь подменить на загруженную модель (вариант «В»)
export function garmentMesh(item, d) {
  delete QC[item.id];
  if (item.tex) { const un = UNDER ? {a: UNDER, b: UNDERZ} : null; const g = drapeTemplate(item, d, un) || (item.drape ? drapeGarment(item, d, un) : null); return g || photoGarment(item, d); }
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

// тело под одеждой окрашено в цвет изнанки вещи (тёмный тон её цвета): если ткань где-то не легла вплотную
// (шов, складка у ширинки, плечо), в просвете видна «тень внутри вещи», а не белый манекен
function paintBody(g, covers, skin) {
  if (!covers.length) return;
  const mat = new THREE.MeshStandardMaterial({color: 0xffffff, vertexColors: true, roughness: 0.6}), cs = covers.map(c => LIN(c.color || '#888').multiplyScalar(0.42));
  // верх плеча (в стороне от шеи) выше линии горловины — тоже под вещью, иначе на плече белое пятно
  const pick = (part, y, t, ax) => { for (let i = covers.length - 1; i >= 0; i--) { const c = covers[i];
    if (part === 'arm') { if (c.arm && t < c.arm - 0.04) return i; continue; }
    if (part === 'leg' && !c.legs) continue;
    if ((part === 'torso' || part === 'sh') && !c.torso && !(part === 'sh' && c.arm)) continue;
    // шея: нижние кольца расширения (к плечам) — под плечевым швом; спереди в вырезе горловины — кожа
    if (part === 'neck') { if (c.torso && !c.legs && t < -0.035 && ax > (c.nx || 0.07)) return i; continue; }
    // верх туловища под закрытой вещью — весь: кольца сетки редкие, белая вершина у шеи размазалась бы клином до плеча
    // (из выреза видна только узкая полоса — как тень внутри воротника)
    if (y > c.y0 + 0.015 && (y < c.y1 - 0.004 || (c.torso && !c.legs))) return i; } return -1; };
  g.traverse(m => { const part = m.userData.part; if (!part || !m.isMesh) return;
    const P = m.geometry.attributes.position, col = new Float32Array(P.count * 3); let any = false;
    for (let i = 0; i < P.count; i++) {
      const y = part === 'sh' ? m.position.y + P.getY(i) * m.scale.y : m.position.y + P.getY(i), t = part === 'arm' ? -P.getY(i) / m.userData.L : part === 'neck' ? P.getY(i) / (m.userData.s || 1) : 0;
      const ax = Math.abs(m.position.x + P.getX(i) * (part === 'sh' ? m.scale.x : 1));
      const k = pick(part, y, t, ax), c = k >= 0 ? cs[k] : skin; if (k >= 0) any = true;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    if (!any) return;
    m.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3)); m.material = mat; });
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
      tex: p.tex || null, pack: p.fitPack || null, drape: p.drape || null, fit: p.fit || null, shape: p.shape || null, sizesT: p.sizesT || null, size: null, brand: p.brand || '', note: p.note || '', states: p.states || null, state: p.states ? p.states[0][0] : '', zip: !!p.zip, pleats: !!p.pleats, puff: !!p.puff, stand: !!p.stand, collar: !!p.collar, hood: !!p.hood, who: p.who || ''};
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
    const scene = new THREE.Scene(); scene.background = LIN('#d6d1c9');
    // мягкое окружение для блеска ткани и зеркала
    { const es = new THREE.Scene(), bx = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 10), new THREE.MeshBasicMaterial({color: LIN('#5a524b'), side: THREE.BackSide})); es.add(bx);
      [[0, 2.9, 0, 6, 0.1, 3, 6], [-4.9, 1.5, 0, 0.1, 2, 6, 2.5], [4.9, 1.5, 0, 0.1, 2, 6, 2.5]].forEach(([x, y, z, w, h, dd, k]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), new THREE.MeshBasicMaterial({color: new THREE.Color(k, k * 0.95, k * 0.88)})); m.position.set(x, y, z); es.add(m); });
      const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, 0.03).texture; pm.dispose(); }
    scene.add(new THREE.HemisphereLight(LIN('#ffffff'), LIN('#6d6862'), 1.0));
    const key = new THREE.SpotLight(LIN('#fffaf3'), 70, 9, 0.6, 0.6, 2); key.position.set(1.2, 3.2, 2.4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.01; scene.add(key, key.target);
    // мягкий заполняющий свет спереди-слева: тени в складках не проваливаются в черноту
    const fill = new THREE.DirectionalLight(LIN('#e9eef5'), 0.9); fill.position.set(-2, 1.6, 2.5); scene.add(fill);
    const rim = new THREE.PointLight(LIN('#f4efe8'), 10, 6, 2); rim.position.set(-1.4, 2.2, -1.2); scene.add(rim);
    // кабина как фотостудия: бесшовный светлый фон (пол плавно переходит в стену — нет линии горизонта), мягкие тени,
    // по бокам шторки кабины. Фон светлый и ровный — вещь читается, как на хорошей карточке товара
    const cycM = new THREE.MeshStandardMaterial({color: LIN('#dcd7cf'), roughness: 0.95});
    { const prof = []; for (let i = 0; i <= 10; i++) prof.push([0, 2.6 - i * 0.26]);          // пол: z от 2.6 до 0
      for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI / 2; prof.push([0.7 - Math.cos(a) * 0.7, -Math.sin(a) * 0.7]); }   // изгиб радиусом 0.7 м
      for (let i = 1; i <= 8; i++) prof.push([0.7 + i * 0.3, -0.7]);                               // стена до 3.1 м
      const pos = [], idx = [], NX = 24, X0 = -3.2, X1 = 3.2;
      prof.forEach(([y, z]) => { for (let ix = 0; ix <= NX; ix++) pos.push(X0 + (X1 - X0) * ix / NX, y, z - 0.6); });
      for (let r = 0; r < prof.length - 1; r++) for (let ix = 0; ix < NX; ix++) { const a0 = r * (NX + 1) + ix, b0 = a0 + 1, c0 = a0 + NX + 1, d0 = c0 + 1; idx.push(a0, b0, c0, b0, d0, c0); }
      const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setIndex(idx); cg.computeVertexNormals();
      const cyc = new THREE.Mesh(cg, cycM); cyc.receiveShadow = true; scene.add(cyc); }
    const curtM = new THREE.MeshStandardMaterial({color: LIN('#7a3a45'), roughness: 0.95, side: THREE.DoubleSide});
    [-1, 1].forEach(sd => { const cg = new THREE.PlaneGeometry(1.4, 2.6, 28, 1); const P = cg.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, Math.sin(P.getX(i) * 22) * 0.04); cg.computeVertexNormals();
      const cu = new THREE.Mesh(cg, curtM); cu.rotation.y = -sd * Math.PI / 2; cu.position.set(sd * 1.7, 1.3, -0.3); scene.add(cu); });
    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
    const avatar = new THREE.Group(); scene.add(avatar);
    // манекен: матовый «сатин» с лёгким лаком, как у витринных манекенов
    const skinMat = new THREE.MeshPhysicalMaterial({color: LIN('#e8e2da'), roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.45});
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
  // сборка образа: тело сразу, вещи по очереди (снизу вверх — каждая ложится на предыдущие); ткань считается в фоне.
  // Пока считается, виден прежний образ и надпись «Надеваю…»; новая сборка ждёт окончания прежней (слои — общие)
  const disposeObj = o => o.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material && m.material !== R.skinMat) { if (m.material.map && !Object.values(TEX).includes(m.material.map) && !Object.values(PTEX).includes(m.material.map)) m.material.map.dispose(); m.material.dispose(); } });
  function setBusy(on) {
    let e = el('fitBusy'); const c = el('fitC');
    if (!e && on && c && c.parentNode) { e = document.createElement('div'); e.id = 'fitBusy'; e.textContent = 'Надеваю…';
      e.style.cssText = 'position:absolute;left:50%;top:14px;transform:translateX(-50%);padding:6px 14px;border-radius:999px;background:rgba(20,18,16,.72);color:#fff;font:600 13px/1.3 system-ui,sans-serif;pointer-events:none;z-index:5';
      if (getComputedStyle(c.parentNode).position === 'static') c.parentNode.style.position = 'relative'; c.parentNode.appendChild(e); }
    if (e) e.hidden = !on;
  }
  built.chain = Promise.resolve(); built.tok = 0;
  function rebuild() {
    if (!R) return; const b = PREFS.body, wn = worn(), key = JSON.stringify(b) + '|' + wn.map(i => i.id + ':' + (i.state || '') + ':' + (i.size || '')).join(',');
    if (key === built.key) return; built.key = key; const tok = ++built.tok;
    built.chain = built.chain.then(() => buildOutfit(tok, b, wn)).catch(e => console.error(e));
  }
  async function buildOutfit(tok, b, wn) {
    const alive = () => tok === built.tok && R;
    if (!alive()) return;
    // у вещей из выгрузки сначала скачать пакеты примерки; после этого меняются состояние и размеры — образ соберётся заново со следующего кадра
    if (wn.some(i => i.pack && !i.tex)) { await Promise.all(wn.map(loadPack)); if (alive()) { built.key = ''; render(); } return; }
    // широкая вещь отводит руки: они лежат на ткани, а не проходят сквозь неё
    const d0 = bodyDims(b); d0.armA = armSpread(wn, d0);
    const body = buildBody(b, R.skinMat, d0), next = new THREE.Group(); body.g.traverse(o => { if (o.isMesh) { o.castShadow = true; } }); next.add(body.g);
    const order = {shoes: 0, bottom: 1, dress: 2, top: 3, outer: 4}, bodyKey = JSON.stringify(b) + '|' + d0.armA.toFixed(3);
    const busy = setTimeout(() => { if (alive()) setBusy(true); }, 120);
    // анимация надевания: вещь ложится на тело, манекен чуть поворачивается и отводит руки (не в режиме «без анимации»)
    const anim = ANIM.on && !calmNow(), fresh = built.fresh; built.fresh = false;
    UNDER = []; UNDERZ = []; BOT_YW = 0; let below = '', ok = true;
    try {
      for (const it of wn.slice().sort((a, c) => order[a.slot] - order[c.slot])) {
        const me = it.id + ':' + (it.state || '') + ':' + (it.size || '');
        const g = await garmentMeshAsync(it, body.d, DRAPE_ON && it.tex ? CLOTH_VER + '|' + bodyKey + '|' + below + '|' + me : null, alive, {anim, fresh});
        if (!alive() || !g) { ok = false; if (g) disposeObj(g); break; }
        next.add(g); commitLayer(); below += me + ',';
      }
    } finally { UNDER = UNDERZ = null; PEND = []; PENDZ = []; clearTimeout(busy); }
    if (!ok || !alive()) { disposeObj(next); return; }
    setBusy(false);
    R.skinMat.color.copy(LIN(SKIN[b.skin | 0] || SKIN[0])); R.skinMat.roughness = 0.55;
    paintBody(body.g, next.children.map(o => o.userData && o.userData.cover).filter(Boolean), R.skinMat.color);
    R.avatar.children.slice().forEach(o => { R.avatar.remove(o); disposeObj(o); });
    const rig = new THREE.Group(); next.children.slice().forEach(o => rig.add(o)); R.avatar.add(rig); R.rig = rig; R.d = body.d; R.play = null;
    const list = rig.children.filter(o => o.userData && o.userData.anim && o.userData.cloth);
    if (list.length) { const pivots = []; body.g.traverse(o => { if (o.userData.armPivot) pivots.push(o); });
      const saved = list.map(g => g.children.filter(m => m.userData.cm).map(m => ['position', 'normal', 'color'].map(a => m.geometry.attributes[a] ? m.geometry.attributes[a].array.slice() : null)));
      R.play = {t0: performance.now(), list, saved, pivots, nf: Math.min(...list.map(g => g.userData.anim.nf)), k: -1}; }
    document.querySelectorAll('[data-qc]').forEach(qcLine);
  }
  // строка автопроверки под вещью: только если вещь показана неточно (балл ниже 70) — что именно не так
  function qcLine(e) { const q = QC[e.dataset.qc]; const bad = q && !q.ok; e.hidden = !bad; if (!bad) { e.textContent = ''; return; }
    const worst = q.checks.filter(c => !c.ok).sort((a, c) => c.pen - a.pen)[0]; e.textContent = 'Показано приблизительно (автопроверка ' + q.score + '/100): ' + (worst ? worst.why : ''); }
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
    if (R.play) playStep();
    R.renderer.render(R.scene, R.cam);
  }
  // кадры записаны каждые 3 шага расчёта (1/30 с) — проигрываем в реальном времени
  function playStep() {
    const P_ = R.play, k = P_.fixedK != null ? Math.min(P_.fixedK, P_.nf - 2) : Math.floor((performance.now() - P_.t0) / (1000 / 30));
    if (k >= P_.nf - 1) { // конец: точная итоговая сетка (после доводки швов и оката), поза манекена — исходная
      P_.list.forEach((g, gi) => g.children.filter(m => m.userData.cm).forEach((m, mi) => ['position', 'normal', 'color'].forEach((a, ai) => { const src = P_.saved[gi][mi][ai]; if (src) { m.geometry.attributes[a].array.set(src); m.geometry.attributes[a].needsUpdate = true; } })));
      R.rig.rotation.y = 0; P_.pivots.forEach(p => { p.rotation.z = p.userData.armPivot.rot; }); R.play = null; return; }
    if (k === P_.k) return; P_.k = k;
    P_.list.forEach(g => { const A = g.userData.anim, n3 = A.F.length / A.nf; clothUpdate(g, A.F.subarray(k * n3, (k + 1) * n3)); });
    const M = P_.list[0].userData.anim.M, yaw = M[k * 2], arm = M[k * 2 + 1];
    R.rig.rotation.y = yaw; P_.pivots.forEach(p => { const a = p.userData.armPivot; p.rotation.z = a.rot + a.side * arm; });
  }
  function replay() { built.key = ''; built.fresh = true; }
  function view(kind) { if (kind === 'motion') return replay(); const v = R.view; if (kind === 'all') { v.z = 1; v.h = 0.55; } else if (kind === 'top') { v.z = 0.55; v.h = 0.72; } else if (kind === 'bottom') { v.z = 0.6; v.h = 0.28; } else if (kind === 'turn') v.rot += Math.PI; }

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
        const qe = h('p', 'sh-note'); qe.dataset.qc = it.id; top.appendChild(qe); qcLine(qe);
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
  // поля вещи из пакета примерки (фабрика tools/wardrobe или конвейер выгрузок tools/feeds/fitpack.py)
  function packFields(mt, dir) {
    return {kind: mt.kind, fit: mt.fit, shape: mt.shape, sizesT: mt.sizes || null, states: mt.states, zip: mt.zip, collar: mt.collar, hood: !!mt.hood, pleats: !!mt.pleats, puff: !!mt.puff, stand: !!mt.stand, drape: mt.drape || null,
      tex: {front: dir + 'front.webp', back: dir + 'back.webp', sleeve: mt.sleeve ? dir + 'sleeve.webp' : null, frontCut: dir + 'front_cut.webp', backCut: dir + 'back_cut.webp'}};
  }
  // вещь из выгрузки магазина: пакет примерки (выкройка, вырезанное фото, сетка размеров) скачивается, когда вещь надевают
  const PACKS = {};
  async function loadPack(it) {
    if (!it.pack || it.tex) return;
    try {
      const mt = await (PACKS[it.pack] = PACKS[it.pack] || fetch(it.pack + 'meta.json').then(r => r.ok ? r.json() : null).catch(() => null));
      if (!mt) { it.pack = null; return; }
      // картинки могут лежать в папке другого пакета (тот же снимок у товаров разных цветов/названий) — files
      const f = packFields(mt, mt.files ? it.pack.replace(/[^/]+\/$/, mt.files + '/') : it.pack); Object.assign(it, f, {sizesT: it.sizesT || f.sizesT});
      if (!it.state && it.states) it.state = it.states[0][0];
      const c = classify(it); if (c) it.slot = c.slot;
      persist();
    } catch (e) { it.pack = null; }
  }
  async function addPack(base, shopName) {
    const r = await fetch(base + 'index.json'); if (!r.ok) throw new Error('нет ' + base);
    const list = await r.json(), s = {name: shopName || 'Мой гардероб', colHex: '#0e7490'};
    list.forEach(mt => {
      const dir = base + (mt.files || mt.id) + '/', p = Object.assign(packFields(mt, dir), {name: mt.name, color: mt.color, brand: mt.brand, note: mt.note, who: mt.who || '', id: 'w-' + mt.id, feed: true, pic: dir + 'front.webp'});
      const it = toItem(p, s); if (!it) return; it.thumb = p.pic;
      const old = W.items.findIndex(i => i.id === it.id); if (old >= 0) W.items[old] = Object.assign(it, {state: W.items[old].state || it.state}); else W.items.push(it);
    });
    persist(); return list.length;
  }

  return {
    setView: kind => { if (R) view(kind); }, _avatar: () => R && R.avatar, setAnim: on => { ANIM.on = !!on; }, replay: () => replay(), playing: () => !!(R && R.play), _frame: k => { if (R && R.play) R.play.fixedK = k; return R && R.play ? R.play.nf : 0; }, setRot: r => { if (R) { R.view.rot = r; R.avatar.rotation.y = r; } }, setZoom: (z, hh) => { if (R) { R.view.z = z; if (hh != null) R.view.h = hh; } },
    addPack, wear(ids, states, sizes) { W.worn = []; ids.forEach(id => putOn(id, true)); Object.entries(states || {}).forEach(([id, st]) => { const it = W.items.find(i => i.id === id); if (it) it.state = st; });
      W.items.forEach(it => { if (it.sizesT) it.size = (sizes && sizes[it.id]) || null; }); persist(); render(); },
    qc: id => QC[id] || null,
    ready: () => { rebuild(); return built.chain; },          // для проверок: дождаться, пока образ соберётся
    fitNote: id => { const it = W.items.find(i => i.id === id); return it ? fitNote(it, PREFS.body) + ' | размер ' + ((sizeOf(it, PREFS.body) || {}).name || '-') : ''; },
    setState(id, st) { const it = W.items.find(i => i.id === id); if (it) { it.state = st; persist(); render(); } },
    open: openRoom, close: closeRoom, get isOpen() { return open; },
    add, has, count: () => W.items.length, onChange: f => subs.push(f),
    mountBodyControls, isWearable, classify,
    get items() { return W.items; }, get worn() { return worn(); },
  };
}
