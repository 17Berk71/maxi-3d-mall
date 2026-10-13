// Манекен: туловище, шея, голова, ноги, руки в плечевых суставах.
import * as THREE from 'three';
import {armPose, armX, bodyDims, limb, loft, sx, sz, torsoR} from './body.js';
import {armRad} from './geometry.js';
import {mhBuild, mhHas, mhTables} from './mh-body.js';

// ---------- тело ----------
export function buildBody(b, skinMat, d0) {
  const d = d0 || bodyDims(b), g = new THREE.Group(), H = d.H;
  // витринный манекен MakeHuman по меркам (mh-body.js), если данные загружены; иначе — прежняя фигура из простых форм
  if (mhHas(b.sex)) { const B = mhBuild(b, d.armA || 0.16); if (B) { d.armA = B.armA; d.mh = mhTables(B); mhDims(d); g.add(mhMesh(B, d, skinMat)); return {g, d}; } }
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
    const a = armPose(d, side), capV = typeof window !== 'undefined' && window.__armCap === 0 ? 0 : 2;
    // верх руки скруглён так же, как в теле для ткани (collider.js): торец сточен по эллипсу на половину радиуса
    const r0 = armRad(d, 0) + 0.007, hD = r0 * 0.5, topP = capV === 2 ? [0.002, 0.03, 0.1, 0.25, 0.45, 0.7, 1].map(u => [u * hD / a.L, (r0 - 0.02) * Math.sqrt(1 - (1 - u) ** 2)]) : [[0, 0.042 * d.k * d.s]];
    const arm = new THREE.Mesh(limb(topP.concat([[0.07, 0.05 * d.k * d.s], [0.14, 0.046 * d.k * d.s], [0.47, 0.034 * d.k * d.s], [0.55, 0.036 * d.k * d.s], [1, 0.025 * d.s]]).filter((p, i, A) => i === 0 || p[0] > A[i - 1][0]), a.L), skinMat);
    // рука, купол и кисть — в «плечевом суставе» (pivot): для анимации примерки руку можно отвести (rotation.z)
    const pivot = new THREE.Group(); pivot.position.copy(a.pos); pivot.rotation.z = a.rot; pivot.userData.armPivot = {side, rot: a.rot}; g.add(pivot);
    arm.userData.part = 'arm'; arm.userData.L = a.L; pivot.add(arm);
    // торец руки у сустава закрыт пологим куполом: иначе край трубы выступал из шара плеча — «шарнир куклы» (при скруглённом верхе руки купол не нужен)
    { const rr = 0.042 * d.k * d.s, cap = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), skinMat);
      cap.scale.set(rr, rr * 0.45, rr); cap.userData.part = 'arm'; cap.userData.L = a.L; if (capV !== 2) pivot.add(cap); }
    const hand = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skinMat); hand.scale.set(0.022 * d.s, 0.06 * d.s, 0.04 * d.s);
    hand.position.set(0, -(a.L + 0.05 * d.s), 0); pivot.add(hand);
  });
  const sh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), skinMat); sh.scale.set(Math.max(d.chest * d.shX * 0.98, armX(d) + 0.02) * 0.97, d.chest * 0.41, Math.min(d.chest * 0.57, torsoR(d, 0.83) * sz(d, 0.83) * 0.95)); sh.position.y = 0.8 * H; sh.userData.part = 'sh'; g.add(sh);   // по глубине не толще груди: иначе спереди «кокетка» со складкой   // чуть меньше, чем в расчёте ткани: между узлами сетки тело не просвечивает
  return {g, d};
}

// размеры для выкроек по сетке манекена без построения сетки показа (для armSpread — насколько отвести руки)
export function mhPrepDims(b, d) { if (!mhHas(b.sex)) return false; const B = mhBuild(b, d.armA || 0.16); if (!B) return false; d.armA = B.armA; d.mh = mhTables(B); mhDims(d); return true; }
// размеры прежней фигуры, которыми пользуются выкройки, — по сетке манекена
function mhDims(d) {
  const T = d.mh, row = yf => Math.max(0, Math.min(T.N - 1, Math.floor(yf * T.N)));
  d.legX = Math.abs(T.LC[row(0.35) * 4]) || d.legX; d.thigh = T.LEQ[row(T.crotch / d.H - 0.02)] || d.thigh; d.neck = T.neck;
  d.shX = T.A[row(T.jL[1] / d.H)] / (d.chest * 0.98);
  // плечевая точка у шеи — верх плеча чуть дальше шеи; верх выкройки у шеи сзади — на 1% роста выше (как у прежней фигуры)
  const xi = Math.min(T.shTop.length - 1, Math.floor((d.neck + 0.015) / T.shBin)); d.fHPS = T.shTop[xi] / d.H; d.fN = d.fHPS + 0.01;
  // пояс брюк — на 3% роста ниже самого узкого места туловища (талии)
  let kw = row(0.62), best = 9; for (let k = row(0.56); k < row(0.7); k++) if (T.A[k] && T.A[k] + T.B[k] < best) { best = T.A[k] + T.B[k]; kw = k; } d.fW = (kw + 0.5) / T.N - 0.03;
}
// сетка манекена: руки в «плечевых суставах» (кости), чтобы в анимации примерки руку можно было отвести
function mhMesh(B, d, skinMat) {
  const nv = B.P.length / 3, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(B.P, 3)); // голова: мелкие треугольники, оставшиеся «изнанкой» наружу после сглаживания лица (складки у глаз и рта), — развернуть
  const tri = B.tri.slice(); { const P = B.P; let cx = 0, cy = 0, cz = 0, n = 0; for (let v = 0; v < nv; v++) if (B.part[v] === 1) { cx += P[v * 3]; cy += P[v * 3 + 1]; cz += P[v * 3 + 2]; n++; } cx /= n; cy /= n; cz /= n;
    for (let t = 0; t < tri.length; t += 3) { const a = tri[t], b = tri[t + 1], c = tri[t + 2]; if (B.part[a] !== 1 || B.part[b] !== 1 || B.part[c] !== 1) continue;
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      const d = (uy * vz - uz * vy) * (P[a * 3] - cx) + (uz * vx - ux * vz) * (P[a * 3 + 1] - cy) + (ux * vy - uy * vx) * (P[a * 3 + 2] - cz); if (d < 0) { tri[t + 1] = c; tri[t + 2] = b; } } }
  geo.setIndex(new THREE.BufferAttribute(tri, 1)); geo.computeVertexNormals();
  // голова: нормали сглажены по соседям (на месте глаз и рта у сетки остались тонкие складки — на гладкой голове их не видно)
  { const N = geo.attributes.normal.array, nb = new Map(), T = B.tri; for (let t = 0; t < T.length; t += 3) for (let k = 0; k < 3; k++) { const a = T[t + k]; if (B.part[a] !== 1) continue; if (!nb.has(a)) nb.set(a, new Set()); nb.get(a).add(T[t + (k + 1) % 3]); nb.get(a).add(T[t + (k + 2) % 3]); }
    for (let it = 0; it < 12; it++) { const M = new Float32Array(N); nb.forEach((s_, a) => { let x = N[a * 3], y = N[a * 3 + 1], z = N[a * 3 + 2]; s_.forEach(b => { x += N[b * 3]; y += N[b * 3 + 1]; z += N[b * 3 + 2]; }); const l = Math.hypot(x, y, z) || 1; M[a * 3] = x / l; M[a * 3 + 1] = y / l; M[a * 3 + 2] = z / l; }); nb.forEach((_, a) => { N[a * 3] = M[a * 3]; N[a * 3 + 1] = M[a * 3 + 1]; N[a * 3 + 2] = M[a * 3 + 2]; }); } }
  geo.setAttribute('mhpart', new THREE.BufferAttribute(B.part, 1));
  const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), W = B.W;
  for (let v = 0; v < nv; v++) for (const [s, bi] of [['L', 1], ['R', 2]]) {
    const w = Math.min(1, W['up' + s][v] + W['low' + s][v] + 0.5 * W['sh' + s][v] + 0.15 * W['clav' + s][v]); if (w <= 0) continue;
    si[v * 4] = bi; sw[v * 4] = w; sw[v * 4 + 1] = 1 - w; }
  for (let v = 0; v < nv; v++) if (!sw[v * 4]) sw[v * 4 + 1] = 1;
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  const root = new THREE.Bone(), bones = [root];
  for (const [s, side] of [['L', 1], ['R', -1]]) { const j = s === 'L' ? d.mh.jL : d.mh.jR, bn = new THREE.Bone(); bn.position.set(j[0], j[1], j[2]); bn.userData.armPivot = {side, rot: 0}; root.add(bn); bones.push(bn); }
  skinMat.skinning = true;   // r128: у несшитых с костями мешей флаг не действует (maxBones = 0)
  const mesh = new THREE.SkinnedMesh(geo, skinMat); mesh.add(root); mesh.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones));
  // кости в «покое» — в своих точках, поэтому обратные матрицы — сдвиг на −сустав
  mesh.userData.part = 'mh'; mesh.userData.mh = {jL: d.mh.jL, jR: d.mh.jR, L: d.mh.arms[0].Lu + d.mh.arms[0].Ll, yNb: d.mh.yNeckBase}; mesh.castShadow = true; mesh.frustumCulled = false;
  return mesh;
}
