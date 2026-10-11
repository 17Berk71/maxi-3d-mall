// Вещь из фото как поверхность (прежний способ, без расчёта ткани).
import * as THREE from 'three';
import {photoMat} from './cloth-material.js';
import {LIN} from './common.js';
import {addShell, armInner, armJ, armRad, bodyAB, clamp, ellP, fitAB, interp, layerAB, lerp, noteAB, ringMesh, smooth, solve, tubeMesh, uFront} from './geometry.js';
import {uget} from './simple-garment.js';
import {bottomSpec, topSpec} from './specs.js';
import {fit} from './state.js';

export function photoGarment(item, d) {
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
      if (fit.UNDER && !(tucked && y < 0.6 * H)) { const u = uget(fit.UNDER, yf), uz = uget(fit.UNDERZ, yf); if (u) a = Math.max(a, u + 0.006 + f * 1.1); if (uz) b = Math.max(b, uz + 0.006 + f * 1.1); noteAB(yf, a + f, b + f); }
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
