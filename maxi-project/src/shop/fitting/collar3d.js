// Отложной воротник (поло, рубашка) объёмом: на фото он лежал плоско и был нарисован на ткани. Здесь — отдельная деталь
// по линии горловины: стойка вверх вдоль шеи, сгиб и отлёт вниз, на плечи; спереди концы воротника уголками,
// у середины — разрез планки. Цвет и рисунок — с фото (место воротника у горловины). Деталь не считается в расчёте
// ткани: держится за точки горловины и в кадрах анимации едет вместе с ними.
import * as THREE from 'three';

// профиль поперёк воротника: [вверх от горловины (доля стойки), наружу (м), доля отлёта (для фото)]
const PROF = [[0, 0, 0], [0, 0, 0.05], [0, 0, 0.16], [0, 0, 0.45], [0, 0, 0.75], [0, 0, 1]];   // шесть рядов поперёк воротника; третье число — доля отлёта (для фото)

export function buildCollar(g, C, P, N, mat) {
  const cl = C.collar; if (!cl || !cl.ring || cl.ring.length < 6) return;
  // точки горловины по кругу: угол от середины переда (0) через бок (±π/2) к середине спинки (±π)
  const ring = [...new Set(cl.ring)].map(i => [i, Math.atan2(P[i * 3], P[i * 3 + 2])]).sort((a, b) => a[1] - b[1]);
  const gap = 0.05;   // разрез у середины переда (рад): концы воротника по сторонам планки
  const pts = ring.filter(([, th]) => Math.abs(th) > gap);
  // от левого края разреза вокруг спины к правому: углы −π..−gap и gap..π — склеиваем через спину (±π)
  const left = pts.filter(([, th]) => th < 0), right = pts.filter(([, th]) => th > 0);
  const order = right.concat(left.map(([i, th]) => [i, th + 2 * Math.PI]));   // gap…π, π…2π−gap
  const K = order.length, R = PROF.length, n = K * R;
  const geo = new THREE.BufferGeometry(), uv = new Float32Array(n * 2), uvm = new Float32Array(n * 2), idx = [];
  const a = cl.a || {cx: 0.5, hw: 0.3}, [pu, pv] = collarUV(mat.map, a);
  // цвет воротника — одна точка фото (воротник однотонный; рисунок фото у горловины — тень и края ткани, полосы), фактура — от шейдера ткани
  order.forEach(([, th], k) => { PROF.forEach(([, , f], r) => { const q = r * K + k; uv[q * 2] = pu; uv[q * 2 + 1] = 1 - pv; uvm[q * 2] = th * 0.07; uvm[q * 2 + 1] = f * 0.06; }); });
  for (let r = 0; r < R - 1; r++) for (let k = 0; k < K - 1; k++) { const A = r * K + k, B = A + 1, Cc = A + K, D = Cc + 1; idx.push(A, Cc, B, B, Cc, D); }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('uvm', new THREE.Float32BufferAttribute(uvm, 2));
  geo.setAttribute('wrk', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  geo.setIndex(idx);
  const m = mat.clone(); m.side = THREE.DoubleSide; if (mat.onBeforeCompile) m.onBeforeCompile = mat.onBeforeCompile; m.userData = Object.assign({}, mat.userData);
  // воротник другого цвета: на фото его убрали с ткани (drape_cut.find_collar) — цвет из выкройки, как у материала по фото
  // (основной цвет ×0.7 и немного свечения), фактура — от шейдера ткани
  if (a.collar && a.collar.rgb) { const c = new THREE.Color(a.collar.rgb).convertSRGBToLinear(); m.map = null; m.emissiveMap = null; m.color.copy(c).multiplyScalar(0.7 * 1.25); m.emissive.copy(c); m.needsUpdate = true; }
  const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.collar = {order, K, hs: cl.hs || 0.028, fw: cl.fw || 0.042}; collarUpdate(mesh, P, N); g.add(mesh);
}
// где на фото взять цвет воротника: у горловины — заметно другой цвет, чем у ткани корпуса (белый воротник поло);
// если такого нет (воротник из той же ткани) или фото ещё не загружено — точка ткани корпуса
function collarUV(tex, a) {
  const body = [a.cx + a.hw * 0.3, 0.4], im = tex && tex.image; if (!im || !im.width) return body;
  const W = 64, H = Math.max(8, Math.round(64 * im.height / im.width)), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); let D; try { g.drawImage(im, 0, 0, W, H); D = g.getImageData(0, 0, W, H).data; } catch (e) { return body; }
  const px = (u, v) => { const i = (Math.min(H - 1, Math.floor(v * H)) * W + Math.min(W - 1, Math.floor(u * W))) * 4; return [D[i], D[i + 1], D[i + 2], D[i + 3]]; };
  const ref = []; for (let v = 0.3; v < 0.6; v += 0.03) for (let u = -0.5; u <= 0.5; u += 0.1) ref.push(px(a.cx + u * a.hw, v));
  const med = q => ref.map(c => c[q]).sort((x, y) => x - y)[ref.length >> 1], B = [med(0), med(1), med(2)];
  const cand = []; let all = 0;
  for (let v = 0.005; v < 0.1; v += 0.006) for (let u = -0.45; u <= 0.45; u += 0.04) { const uu = a.cx + u * a.hw, c = px(uu, v); if (c[3] < 200) continue; all++;
    if (Math.hypot(c[0] - B[0], c[1] - B[1], c[2] - B[2]) > 70 && c[0] + c[1] + c[2] > (B[0] + B[1] + B[2]) * 0.85) cand.push([uu, v, c]); }   // тени и щели у горловины темнее — не воротник
  if (!all || cand.length < all * 0.12) return body;
  const m = [0, 1, 2].map(q => cand.map(c => c[2][q]).sort((x, y) => x - y)[cand.length >> 1]);
  let best = cand[0], bd = 1e9; for (const c of cand) { const dd = Math.hypot(c[2][0] - m[0], c[2][1] - m[1], c[2][2] - m[2]); if (dd < bd) { bd = dd; best = c; } }
  return [best[0], best[1]];
}
// по точкам горловины P и нормалям ткани N (кадр анимации или итог): стойка — вверх вдоль шеи, отлёт — по поверхности
// ткани вниз от горловины (на грудь, плечи, спину) с зазором на толщину, а не горизонтально в воздух
export function collarUpdate(mesh, P, N) {
  const {order, K, hs, fw} = mesh.userData.collar, pos = mesh.geometry.attributes.position.array, col = mesh.geometry.attributes.color.array;
  let cx = 0, cz = 0; order.forEach(([i]) => { cx += P[i * 3]; cz += P[i * 3 + 2]; }); cx /= K; cz /= K;
  order.forEach(([i, th], k) => { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], ox = x - cx, oz = z - cz, l = Math.hypot(ox, oz) || 1, rx = ox / l, rz = oz / l;
    let nx = N ? N[i * 3] : rx, ny = N ? N[i * 3 + 1] : 0.3, nz = N ? N[i * 3 + 2] : rz; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    if (nx * rx + nz * rz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    // от горловины по ткани: наружу и вниз, без составляющей вдоль нормали
    let tx = rx, ty = -0.8, tz = rz; const dn = tx * nx + ty * ny + tz * nz; tx -= dn * nx; ty -= dn * ny; tz -= dn * nz; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    const c = Math.cos(th), front = Math.max(0, c), tip = c > 0.8 ? Math.pow((c - 0.8) / 0.2, 2) : 0, w = fw * (1 + 0.9 * front + 0.8 * tip), hs_ = hs * (1 - 0.45 * tip);   /* спереди отлёт шире (на фото он лежит ниже горловины), у концов стойка ниже */
    // [вверх (доля стойки), по ткани от горловины (доля ширины отлёта), над тканью (м)]
    const rows = [[0, 0, 0.002], [0.92, 0, 0.001], [1.04, 0, 0.005], [0.55, 0.12, 0.008], [0.12, 0.55, 0.008], [0, 1, 0.006]];
    rows.forEach(([u, t, o], r) => { const q = (r * K + k) * 3;
      const inw = r < 3 ? 0.002 * u : 0;   // стойка чуть к шее
      pos[q] = x + t * w * tx + o * nx - rx * inw; pos[q + 1] = y + u * hs_ + t * w * ty + o * ny; pos[q + 2] = z + t * w * tz + o * nz - rz * inw;
      col[q] = col[q + 1] = col[q + 2] = r < 2 ? 0.8 : 1; }); });
  mesh.geometry.computeVertexNormals(); mesh.geometry.attributes.position.needsUpdate = true; mesh.geometry.attributes.normal.needsUpdate = true; mesh.geometry.attributes.color.needsUpdate = true;
  mesh.geometry.computeBoundingSphere();
}
