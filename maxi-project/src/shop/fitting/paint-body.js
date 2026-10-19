// Тело под вещью окрашено в тёмный тон вещи (в просветах не белое).
import * as THREE from 'three';
import {LIN} from './common.js';

// тело под одеждой окрашено в цвет изнанки вещи (тёмный тон её цвета): если ткань где-то не легла вплотную
// (шов, складка у ширинки, плечо), в просвете видна «тень внутри вещи», а не белый манекен
export function paintBody(g, covers, skin) {
  if (!covers.length) return;
  const mat = new THREE.MeshStandardMaterial({color: 0xffffff, vertexColors: true, roughness: 0.6}), cs = covers.map(c => LIN(c.color || '#888').multiplyScalar(0.42));
  // верх плеча (в стороне от шеи) выше линии горловины — тоже под вещью, иначе на плече белое пятно
  const pick = (part, y, t, ax) => { for (let i = covers.length - 1; i >= 0; i--) { const c = covers[i];
    if (part === 'arm') { if (c.arm && t < c.arm - 0.04) return i; continue; }
    if (part === 'leg' && !c.legs) continue;
    if ((part === 'torso' || part === 'sh') && !c.torso && !(part === 'sh' && c.arm)) continue;
    // без рукавов (жилет, сарафан): плечо манекена дальше плеча вещи — открыто (было тёмно-серое «плечико» ступеньками)
    if (part === 'torso' && c.sx && ax > c.sx - 0.004) continue;
    // шея: нижние кольца расширения (к плечам) — под плечевым швом; спереди в вырезе горловины — кожа
    if (part === 'neck') { if (c.torso && !c.legs && t < -0.035 && ax > (c.nx || 0.07)) return i; continue; }
    // верх туловища под закрытой вещью — весь: кольца сетки редкие, белая вершина у шеи размазалась бы клином до плеча
    // (из выреза видна только узкая полоса — как тень внутри воротника)
    if (y > c.y0 + 0.015 && (y < c.y1 - 0.004 || (c.torso && !c.legs && !c.neckOpen))) return i; } return -1; };   /* глубокий вырез (декольте, бретели): выше выреза тело не красим */
  g.traverse(m => { const part = m.userData.part; if (!part || !m.isMesh) return;
    // манекен по сетке: часть тела — у каждой точки (0 туловище, 1 голова, 2 рука, 3 нога), доля длины руки — от плечевого сустава
    if (part === 'mh') { const P = m.geometry.attributes.position, pa = m.geometry.attributes.mhpart.array, U = m.userData.mh, col = new Float32Array(P.count * 3); let any = false;
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), q = pa[i]; let k = -1;
        if (q === 2) { const j = x > 0 ? U.jL : U.jR; k = pick('arm', y, Math.hypot(x - j[0], y - j[1], z - j[2]) / U.L, 0); }
        else if (q === 3) k = pick('leg', y, 0, 0);
        else if (q === 0) k = y > U.yNb ? pick('neck', y, y - U.yNb - 0.04, Math.abs(x)) : pick('torso', y, 0, Math.abs(x));
        const c = k >= 0 ? cs[k] : skin; if (k >= 0) any = true; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      if (any) { m.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3)); const sm = mat.clone(); sm.skinning = true; m.material = sm; }
      return; }
    const P = m.geometry.attributes.position, col = new Float32Array(P.count * 3); let any = false;
    for (let i = 0; i < P.count; i++) {
      const y = part === 'sh' ? m.position.y + P.getY(i) * m.scale.y : m.position.y + P.getY(i), t = part === 'arm' ? -P.getY(i) / m.userData.L : part === 'neck' ? P.getY(i) / (m.userData.s || 1) : 0;
      const ax = Math.abs(m.position.x + P.getX(i) * (part === 'sh' ? m.scale.x : 1));
      const k = pick(part, y, t, ax), c = k >= 0 ? cs[k] : skin; if (k >= 0) any = true;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    if (!any) return;
    m.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3)); m.material = mat; });
}
