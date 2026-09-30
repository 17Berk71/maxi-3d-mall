// 3D-модели товаров из нескольких деталей разных материалов (ткань, кожа, резина, металл, стекло, экран).
// Деталь { g: геометрия, tint: 1 — цвет товара | c: '#hex' — свой цвет, m: материал }.
// Модели процедурные: без внешних файлов. Настоящие GLB-модели можно подключить позже (см. CLAUDE.md).
import * as THREE from 'three';

const V2 = THREE.Vector2;
const LIN = hex => new THREE.Color(hex).convertSRGBToLinear();

// скруглённая «подушка»: силуэт → объём с фаской
function puff(shape, depth, bevel, segs) {
  const g = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: segs || 3, curveSegments: 10});
  g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g;
}
function rrect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function lathe(pts, seg) { const g = new THREE.LatheGeometry(pts.map(p => new V2(p[0], p[1])), seg || 32); g.computeVertexNormals(); return g; }
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x || 0, y || 0, z || 0);
const cyl = (r1, r2, h, x, y, z, s) => new THREE.CylinderGeometry(r1, r2, h, s || 24).translate(x || 0, y || 0, z || 0);
function merge(gs) {
  // простая склейка неиндексированных геометрий (position, normal, uv)
  const P = [], N = [], U = [];
  gs.forEach(g0 => { const g = g0.index ? g0.toNonIndexed() : g0; if (!g.attributes.normal) g.computeVertexNormals();
    P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array);
    if (g.attributes.uv) U.push(...g.attributes.uv.array); else for (let i = 0; i < g.attributes.position.count; i++) U.push(0, 0); });
  const b = new THREE.BufferGeometry();
  b.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); b.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); b.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  return b;
}

export function createModels(canvasTex) {
  // ---- фактуры
  const weave = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(0,0,0,${0.035 + (y % 4 ? 0.02 : 0)})`; g.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 2) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); } });
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping; weave.repeat.set(6, 6);
  const leather = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, Math.random() * 1.6, 0, 7); g.fill(); } });
  leather.wrapS = leather.wrapT = THREE.RepeatWrapping; leather.repeat.set(3, 3);
  const knit = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#eeeeee'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 1.5;
    for (let x = 0; x < w; x += 8) for (let y = 0; y < h; y += 8) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y + 8); g.lineTo(x + 8, y); g.stroke(); } });
  knit.wrapS = knit.wrapT = THREE.RepeatWrapping; knit.repeat.set(8, 8);
  const label = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#f6f4ef'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(24, 30, 150, 12); g.fillRect(24, 54, 200, 7); g.fillRect(24, 70, 170, 7); g.fillRect(24, 96, 60, 10); });
  const screen = canvasTex(256, 160, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#1c2733'); gr.addColorStop(0.55, '#0b0f14'); gr.addColorStop(1, '#16202b'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.45, 0); g.lineTo(w * 0.2, h); g.lineTo(0, h); g.fill(); });
  // ---- материалы по типу (цвет — белый: цвет товара задаётся на экземпляре)
  const MATS = {
    fabric: () => new THREE.MeshStandardMaterial({map: weave, roughness: 0.92, metalness: 0}),
    knit: () => new THREE.MeshStandardMaterial({map: knit, roughness: 0.95, metalness: 0}),
    leather: () => new THREE.MeshStandardMaterial({map: leather, roughness: 0.48, metalness: 0}),
    rubber: () => new THREE.MeshStandardMaterial({roughness: 0.9, metalness: 0}),
    plastic: () => new THREE.MeshStandardMaterial({roughness: 0.42, metalness: 0}),
    matte: () => new THREE.MeshStandardMaterial({roughness: 0.75, metalness: 0}),
    metal: () => new THREE.MeshStandardMaterial({roughness: 0.28, metalness: 0.85}),
    glass: () => new THREE.MeshStandardMaterial({roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, envMapIntensity: 1.4}),
    liquid: () => new THREE.MeshStandardMaterial({roughness: 0.1, metalness: 0, transparent: true, opacity: 0.85}),
    screen: () => new THREE.MeshStandardMaterial({map: screen, roughness: 0.08, metalness: 0.2, envMapIntensity: 1.2}),
    label: () => new THREE.MeshStandardMaterial({map: label, roughness: 0.7}),
    paper: () => new THREE.MeshStandardMaterial({roughness: 0.85})
  };
  const T = (g, m) => ({g, tint: 1, m}), F = (g, c, m) => ({g, c, m});

  // ---- кроссовок: верх, светлая подошва, шнурки, проём
  function shoe() {
    const s = new THREE.Shape(); s.moveTo(-0.14, 0.026); s.lineTo(0.12, 0.026); s.quadraticCurveTo(0.155, 0.03, 0.15, 0.055); s.quadraticCurveTo(0.12, 0.075, 0.06, 0.082);
    s.lineTo(-0.02, 0.105); s.quadraticCurveTo(-0.08, 0.125, -0.11, 0.118); s.quadraticCurveTo(-0.145, 0.11, -0.148, 0.07); s.closePath();
    const upper = puff(s, 0.07, 0.016, 3);
    const so = new THREE.Shape(); so.moveTo(-0.15, 0); so.lineTo(0.13, 0); so.quadraticCurveTo(0.165, 0.004, 0.158, 0.03); so.lineTo(-0.152, 0.032); so.closePath();
    const sole = puff(so, 0.09, 0.006, 2);
    const laces = merge([0, 1, 2, 3].map(i => box(0.012, 0.006, 0.07, 0.035 - i * 0.026, 0.09 + i * 0.006, 0).rotateZ(-0.12)));
    const hole = cyl(0.036, 0.036, 0.01, -0.085, 0.118, 0, 20).scale(1.2, 1, 0.75);
    return [T(upper, 'leather'), F(sole, '#ecebe6', 'rubber'), F(laces, '#f4f2ee', 'fabric'), F(hole, '#1d1d1f', 'fabric')];
  }
  // ---- одежда на вешалке: объёмный силуэт; верх — у крючка (y=0), вниз — минус
  function jacket() {
    const s = new THREE.Shape(); s.moveTo(-0.1, 0); s.lineTo(0.1, 0); s.quadraticCurveTo(0.2, 0.0, 0.25, -0.05); s.lineTo(0.3, -0.62); s.lineTo(0.22, -0.64); s.lineTo(0.19, -0.2);
    s.lineTo(0.19, -0.74); s.lineTo(-0.19, -0.74); s.lineTo(-0.19, -0.2); s.lineTo(-0.22, -0.64); s.lineTo(-0.3, -0.62); s.lineTo(-0.25, -0.05); s.quadraticCurveTo(-0.2, 0, -0.1, 0);
    const body = puff(s, 0.09, 0.035, 4);
    const quilt = merge([-0.22, -0.38, -0.54].map(y => box(0.4, 0.008, 0.17, 0, y, 0)));
    const zip = box(0.012, 0.72, 0.172, 0, -0.38, 0);
    const collar = puff(rrect(0.24, 0.07, 0.03), 0.12, 0.02, 2).translate(0, -0.01, 0);
    return [T(body, 'fabric'), T(collar, 'fabric'), F(zip, '#2b2c2f', 'metal'), F(quilt, '#000000', 'matte')].slice(0, 3);
  }
  function tshirt(long) {
    const L = long ? 0.66 : 0.68, sl = long ? 0.6 : 0.2;
    const s = new THREE.Shape(); s.moveTo(-0.07, 0); s.quadraticCurveTo(0, -0.05, 0.07, 0); s.lineTo(0.17, 0.0); s.lineTo(0.2 + sl * 0.3, -sl); s.lineTo(0.14 + sl * 0.2, -sl - 0.04);
    s.lineTo(0.17, -0.18); s.lineTo(0.17, -L); s.lineTo(-0.17, -L); s.lineTo(-0.17, -0.18); s.lineTo(-0.14 - sl * 0.2, -sl - 0.04); s.lineTo(-0.2 - sl * 0.3, -sl); s.lineTo(-0.17, 0); s.closePath();
    return [T(puff(s, 0.02, 0.012, 2), long ? 'knit' : 'fabric')];
  }
  function pants(denim) {
    const s = new THREE.Shape(); s.moveTo(-0.2, 0); s.lineTo(0.2, 0); s.lineTo(0.22, -0.95); s.lineTo(0.03, -0.95); s.lineTo(0.0, -0.28); s.lineTo(-0.03, -0.95); s.lineTo(-0.22, -0.95); s.closePath();
    return [T(puff(s, 0.035, 0.014, 2), 'fabric'), F(box(0.4, 0.05, 0.065, 0, -0.03, 0), '#2a2b2e', 'leather')];
  }
  function dress() {
    const s = new THREE.Shape(); s.moveTo(-0.06, 0); s.quadraticCurveTo(0, -0.05, 0.06, 0); s.lineTo(0.14, 0); s.lineTo(0.15, -0.3); s.quadraticCurveTo(0.14, -0.36, 0.13, -0.38);
    s.quadraticCurveTo(0.26, -0.8, 0.3, -1.05); s.lineTo(-0.3, -1.05); s.quadraticCurveTo(-0.26, -0.8, -0.13, -0.38); s.quadraticCurveTo(-0.14, -0.36, -0.15, -0.3); s.lineTo(-0.14, 0); s.closePath();
    return [T(puff(s, 0.03, 0.015, 3), 'fabric')];
  }
  // ---- косметика
  function bottle() {
    const glass = lathe([[0, 0], [0.034, 0], [0.036, 0.004], [0.036, 0.085], [0.028, 0.1], [0.011, 0.104], [0.011, 0.112], [0, 0.112]], 28).scale(1.25, 1, 0.75);
    const liquid = lathe([[0, 0.006], [0.031, 0.006], [0.031, 0.07], [0, 0.07]], 24).scale(1.25, 1, 0.75);
    const cap = cyl(0.017, 0.017, 0.034, 0, 0.129, 0, 20);
    return [F(glass, '#dfe8ec', 'glass'), T(liquid, 'liquid'), F(cap, '#c8a45a', 'metal')];
  }
  function jar() {
    return [T(lathe([[0, 0], [0.046, 0], [0.05, 0.006], [0.05, 0.05], [0, 0.05]], 32), 'plastic'), F(cyl(0.052, 0.052, 0.022, 0, 0.061, 0, 32), '#eceae4', 'plastic')];
  }
  function tube() {
    const body = lathe([[0, 0], [0.018, 0], [0.018, 0.11], [0.006, 0.125], [0, 0.125]], 20);
    return [T(body.scale(1.3, 1, 0.8), 'plastic'), F(cyl(0.008, 0.008, 0.016, 0, 0.132, 0, 16), '#1f1f22', 'plastic')];
  }
  // ---- украшения и часы: футляр и изделие
  function small() {
    const caseG = puff(rrect(0.1, 0.07, 0.01), 0.04, 0.006, 2).rotateX(-Math.PI / 2).translate(0, 0.02, 0);
    const ring = new THREE.TorusGeometry(0.018, 0.004, 10, 36).translate(0, 0.055, 0);
    const stone = new THREE.OctahedronGeometry(0.006).translate(0, 0.076, 0);
    return [F(caseG, '#2d2a33', 'fabric'), T(ring, 'metal'), F(stone, '#f4f7fb', 'glass')];
  }
  // ---- техника
  function phone() {
    const body = puff(rrect(0.074, 0.155, 0.012), 0.006, 0.0015, 2);
    const scr = new THREE.PlaneGeometry(0.068, 0.148).translate(0, 0, 0.0052);
    const g = [T(body, 'metal'), F(scr, '#ffffff', 'screen')];
    g.forEach(p => p.g.rotateX(-0.3).translate(0, 0.085, 0)); return g;
  }
  function laptop() {
    const base = puff(rrect(0.36, 0.25, 0.012), 0.012, 0.003, 2).rotateX(-Math.PI / 2).translate(0, 0.009, 0);
    const lid = puff(rrect(0.36, 0.24, 0.012), 0.006, 0.002, 2).translate(0, 0.12, 0).rotateX(-0.28).translate(0, 0.012, -0.125);
    const scr = new THREE.PlaneGeometry(0.33, 0.2).translate(0, 0.12, 0.0042).rotateX(-0.28).translate(0, 0.012, -0.125);
    const keys = box(0.3, 0.002, 0.11, 0, 0.018, -0.02);
    return [T(base, 'metal'), T(lid, 'metal'), F(scr, '#ffffff', 'screen'), F(keys, '#1f2023', 'plastic')];
  }
  function tv() {
    const panel = puff(rrect(1.12, 0.66, 0.01), 0.03, 0.004, 2).translate(0, 0.52, 0);
    const scr = new THREE.PlaneGeometry(1.09, 0.62).translate(0, 0.52, 0.0192);
    const stand = merge([box(0.05, 0.19, 0.03, 0, 0.1, -0.02), box(0.34, 0.012, 0.2, 0, 0.006, 0)]);
    return [F(panel, '#141518', 'plastic'), F(scr, '#ffffff', 'screen'), F(stand, '#2a2c30', 'metal')];
  }
  function appliance() {
    const body = puff(rrect(0.6, 1.72, 0.04), 0.58, 0.02, 3).translate(0, 0.86, 0);
    const gap = box(0.62, 0.008, 0.02, 0, 1.18, 0.3);
    const handle = merge([box(0.025, 0.32, 0.03, 0.24, 1.42, 0.31), box(0.025, 0.42, 0.03, 0.24, 0.8, 0.31)]);
    return [T(body, 'plastic'), F(gap, '#3b3e44', 'plastic'), F(handle, '#bfc4c9', 'metal')];
  }
  // ---- мебель
  function sofa() {
    const seat = puff(rrect(1.9, 0.8, 0.12), 0.22, 0.06, 3).rotateX(-Math.PI / 2).translate(0, 0.32, 0.04);
    const back = puff(rrect(2.1, 0.5, 0.12), 0.24, 0.06, 3).translate(0, 0.66, -0.36);
    const arms = merge([-1, 1].map(s => puff(rrect(0.24, 0.9, 0.08), 0.46, 0.06, 3).rotateY(Math.PI / 2).translate(s * 1.0, 0.46, 0)));
    const base = box(2.1, 0.14, 0.86, 0, 0.14, 0);
    const legs = merge([[-0.95, -0.35], [0.95, -0.35], [-0.95, 0.35], [0.95, 0.35]].map(([x, z]) => cyl(0.025, 0.02, 0.08, x, 0.04, z, 10)));
    return [T(seat, 'fabric'), T(back, 'fabric'), T(arms, 'fabric'), T(base, 'fabric'), F(legs, '#2b2622', 'metal')];
  }
  function bed() {
    const frame = puff(rrect(1.72, 2.08, 0.06), 0.3, 0.03, 2).rotateX(-Math.PI / 2).translate(0, 0.16, 0);
    const head = puff(rrect(1.72, 0.9, 0.08), 0.12, 0.05, 3).translate(0, 0.62, -1.04);
    const mat = puff(rrect(1.6, 1.98, 0.08), 0.2, 0.04, 3).rotateX(-Math.PI / 2).translate(0, 0.42, 0.03);
    const pil = merge([-0.4, 0.4].map(x => puff(rrect(0.6, 0.36, 0.1), 0.1, 0.05, 3).rotateX(-Math.PI / 2).translate(x, 0.58, -0.78)));
    return [T(frame, 'fabric'), T(head, 'fabric'), F(mat, '#f1efea', 'fabric'), F(pil, '#f7f6f2', 'fabric')];
  }
  // ---- спорт
  function bike() {
    const bars = [];
    const bar = (ax, ay, bx, by, r) => { const L = Math.hypot(bx - ax, by - ay); const g = new THREE.CylinderGeometry(r || 0.018, r || 0.018, L, 10); g.rotateZ(-Math.atan2(bx - ax, by - ay)); g.translate((ax + bx) / 2, (ay + by) / 2, 0); bars.push(g); };
    bar(-0.5, 0.35, -0.15, 0.8); bar(-0.15, 0.8, 0.35, 0.8); bar(0.35, 0.8, 0.5, 0.35, 0.014); bar(-0.15, 0.8, 0, 0.35); bar(0, 0.35, 0.35, 0.8); bar(-0.5, 0.35, 0, 0.35, 0.012); bar(0.35, 0.8, 0.38, 0.97, 0.014);
    const frame = merge(bars);
    const wheel = merge([-0.5, 0.5].map(x => new THREE.TorusGeometry(0.33, 0.026, 10, 40).translate(x, 0.35, 0)));
    const rims = merge([-0.5, 0.5].map(x => new THREE.TorusGeometry(0.3, 0.008, 6, 40).translate(x, 0.35, 0)));
    const extra = merge([box(0.22, 0.05, 0.1, -0.19, 0.93, 0), box(0.04, 0.04, 0.5, 0.38, 0.98, 0), cyl(0.05, 0.05, 0.03, 0, 0.35, 0, 16).rotateX(Math.PI / 2)]);
    return [T(frame, 'metal'), F(wheel, '#1b1c1e', 'rubber'), F(rims, '#b8bdc2', 'metal'), F(extra, '#202124', 'leather')];
  }
  function dumbbell() {
    return [F(cyl(0.017, 0.017, 0.34, 0, 0, 0, 12).rotateZ(Math.PI / 2), '#a7adb3', 'metal'),
      T(merge([-0.14, 0.14].map(x => cyl(0.06, 0.06, 0.07, x, 0, 0, 8).rotateZ(Math.PI / 2))), 'rubber')];
  }
  // ---- прочее
  function goods() { return [T(puff(rrect(0.24, 0.2, 0.01), 0.16, 0.006, 1).translate(0, 0.106, 0), 'matte'), F(new THREE.PlaneGeometry(0.2, 0.1).translate(0, 0.11, 0.0875), '#ffffff', 'label')]; }
  function book() { return [T(box(0.04, 0.24, 0.17, 0, 0.12, 0), 'matte'), F(box(0.034, 0.23, 0.162, 0.004, 0.12, 0.004), '#f3efe4', 'paper')]; }
  function toy() {
    const b = [new THREE.SphereGeometry(0.1, 20, 14).scale(1, 1.1, 0.9).translate(0, 0.1, 0), new THREE.SphereGeometry(0.075, 20, 14).translate(0, 0.24, 0),
      new THREE.SphereGeometry(0.03, 12, 10).translate(-0.055, 0.3, 0), new THREE.SphereGeometry(0.03, 12, 10).translate(0.055, 0.3, 0),
      new THREE.SphereGeometry(0.035, 12, 10).translate(-0.09, 0.14, 0.03), new THREE.SphereGeometry(0.035, 12, 10).translate(0.09, 0.14, 0.03),
      new THREE.SphereGeometry(0.04, 12, 10).translate(-0.05, 0.02, 0.05), new THREE.SphereGeometry(0.04, 12, 10).translate(0.05, 0.02, 0.05)];
    return [T(merge(b), 'knit'), F(new THREE.SphereGeometry(0.03, 12, 10).scale(1, 0.8, 0.6).translate(0, 0.225, 0.065), '#e8dcc8', 'knit'), F(merge([-0.025, 0.025].map(x => new THREE.SphereGeometry(0.008, 8, 6).translate(x, 0.255, 0.068))), '#141414', 'plastic')];
  }
  function cup() { return [F(lathe([[0, 0], [0.032, 0], [0.042, 0.11], [0, 0.11]], 24), '#f4f1ea', 'paper'), T(lathe([[0.037, 0.04], [0.04, 0.075], [0.0405, 0.078], [0.0375, 0.043]], 24), 'paper'), F(cyl(0.044, 0.044, 0.01, 0, 0.115, 0, 24), '#2b2b2d', 'plastic')]; }
  function ticket() { return [T(box(0.2, 0.004, 0.08, 0, 0.002, 0), 'paper')]; }

  const M = {shoe: shoe(), jacket: jacket(), tshirt: tshirt(false), longsleeve: tshirt(true), pants: pants(), dress: dress(), bottle: bottle(), jar: jar(), tube: tube(), small: small(),
    phone: phone(), laptop: laptop(), tv: tv(), appliance: appliance(), sofa: sofa(), bed: bed(), bike: bike(), dumbbell: dumbbell(), box: goods(), book: book(), toy: toy(), cup: cup(), ticket: ticket(),
    football: [{g: new THREE.SphereGeometry(0.11, 24, 16), ball: 'football'}], basketball: [{g: new THREE.SphereGeometry(0.12, 24, 16), ball: 'basketball'}]};
  const ballTex = type => canvasTex(256, 128, (g, w, h) => { if (type === 'football') { g.fillStyle = '#fafafa'; g.fillRect(0, 0, w, h); g.fillStyle = '#1c1c1c'; for (let i = 0; i < 14; i++) { const x = (i * 53) % w, y = 16 + ((i * 37) % (h - 32)); g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283; g.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); } g.fill(); } }
    else { g.fillStyle = '#c8642a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); } g.strokeStyle = '#2a160a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); for (let x = 0; x <= w; x += 64) { g.moveTo(x, 0); g.lineTo(x, h); } g.stroke(); } });
  const balls = {football: ballTex('football'), basketball: ballTex('basketball')};
  // материал детали: для инстансов (цвет товара — на экземпляре) и для просмотра товара
  function partMat(p, color) {
    if (p.ball) return new THREE.MeshStandardMaterial({map: balls[p.ball], roughness: 0.5});
    const m = MATS[p.m || 'matte']();
    if (p.c) m.color = LIN(p.c); else if (color) m.color = LIN(color);
    return m;
  }
  // группа для одного товара (просмотр, манекен)
  function group(name, color) {
    const g = new THREE.Group(); (M[name] || M.box).forEach(p => g.add(new THREE.Mesh(p.g, partMat(p, color)))); return g;
  }
  const geos = new Set(); Object.values(M).forEach(ps => ps.forEach(p => geos.add(p.g)));
  const texs = new Set([weave, leather, knit, label, screen, balls.football, balls.basketball]);
  return {M, partMat, group, geos, texs};
}
