// Манекен: туловище, шея, голова, ноги, руки в плечевых суставах.
import * as THREE from 'three';
import {armPose, armX, bodyDims, limb, loft, sx, sz, torsoR} from './body.js';
import {armRad} from './geometry.js';

// ---------- тело ----------
export function buildBody(b, skinMat, d0) {
  const d = d0 || bodyDims(b), g = new THREE.Group(), H = d.H;
  // проба: тело из MakeHuman (tools/body/mh_body.py → JSON {p, i}), только для показа в лаборатории
  if (typeof window !== 'undefined' && window.__mhBody) { const M = window.__mhBody, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(M.p, 3)); geo.setIndex(M.i); if (M.n) geo.setAttribute('normal', new THREE.Float32BufferAttribute(M.n, 3)); else geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, skinMat); m.userData.part = 'mh'; m.castShadow = true; g.add(m); return {g, d}; }
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
