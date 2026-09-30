// Пробные стили оформления (превью): «тёплый ТЦ», «яркий игровой», «вечерний».
// Включаются параметром ?style=warm|game|night или __maxi.setStyle(name) в ?debug.
// Базовый вид не меняют: без параметра всё как было.
import * as THREE from 'three';

const LIN = hex => new THREE.Color(hex).convertSRGBToLinear();

function tex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
function rnd(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---- полы
const FLOORS = {
  warm: () => tex(1024, 1024, (g, w, h) => {
    const r = rnd(5), n = 4, ts = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const b = Math.floor(r() * 14); g.fillStyle = `rgb(${226 + b},${203 + b},${168 + b})`; g.fillRect(i * ts, j * ts, ts, ts);
      for (let s = 0; s < 18; s++) { g.strokeStyle = `rgba(170,130,90,${0.04 + r() * 0.06})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const y = j * ts + r() * ts; g.moveTo(i * ts, y); g.bezierCurveTo(i * ts + ts * .3, y + (r() - .5) * 30, i * ts + ts * .7, y + (r() - .5) * 30, i * ts + ts, y + (r() - .5) * 20); g.stroke(); }
      for (let s = 0; s < 300; s++) { g.fillStyle = `rgba(150,110,70,${r() * 0.06})`; g.fillRect(i * ts + r() * ts, j * ts + r() * ts, 2 + r() * 4, 1 + r() * 2); }
    }
    // тёплая полоса-бордюр из тёмного камня
    g.fillStyle = 'rgba(120,82,50,.55)'; g.fillRect(0, 0, w, 10); g.fillRect(0, 0, 10, h);
    g.strokeStyle = 'rgba(120,90,60,.35)'; g.lineWidth = 2; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * ts, 0); g.lineTo(i * ts, h); g.moveTo(0, i * ts); g.lineTo(w, i * ts); g.stroke(); }
  }),
  game: () => tex(1024, 1024, (g, w, h) => {
    const r = rnd(9); g.fillStyle = '#fbf3e6'; g.fillRect(0, 0, w, h);
    const cols = ['#ff6b57', '#2ec4b6', '#ffbf3c', '#7b6cff', '#4aa3ff', '#ff5fa2'];
    for (let s = 0; s < 1400; s++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.globalAlpha = 0.55 + r() * 0.45; g.beginPath(); const x = r() * w, y = r() * h, rr = 2 + r() * 7; g.moveTo(x, y - rr); g.lineTo(x + rr, y); g.lineTo(x + rr * .3, y + rr); g.lineTo(x - rr, y + rr * .2); g.closePath(); g.fill(); }
    g.globalAlpha = 1; g.fillStyle = 'rgba(46,196,182,.9)'; g.fillRect(0, 0, w, 14); g.fillRect(0, 0, 14, h); g.fillStyle = 'rgba(255,191,60,.9)'; g.fillRect(0, 14, w, 8); g.fillRect(14, 0, 8, h);
    g.fillStyle = 'rgba(255,107,87,.18)'; g.fillRect(w / 2 - 90, 22, 180, h - 22);
  }),
  night: () => tex(1024, 1024, (g, w, h) => {
    const r = rnd(3), n = 2, ts = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const b = Math.floor(r() * 6); g.fillStyle = `rgb(${30 + b},${32 + b},${37 + b})`; g.fillRect(i * ts, j * ts, ts, ts);
      for (let s = 0; s < 2200; s++) { const v = 60 + r() * 60; g.fillStyle = `rgba(${v},${v},${v + 8},${r() * 0.18})`; g.fillRect(i * ts + r() * ts, j * ts + r() * ts, 1 + r() * 2, 1 + r() * 2); }
    }
    g.strokeStyle = 'rgba(214,170,96,.85)'; g.lineWidth = 3; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * ts, 0); g.lineTo(i * ts, h); g.moveTo(0, i * ts); g.lineTo(w, i * ts); g.stroke(); }
  }),
};

// ---- дерево для фризов «тёплого» стиля
const woodTex = () => tex(512, 128, (g, w, h) => {
  const r = rnd(12); g.fillStyle = '#b07a48'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(${90 + r() * 40},${55 + r() * 25},${30},${0.1 + r() * 0.2})`; g.fillRect(0, y, w, 1 + r() * 2); }
  for (let x = 0; x < w; x += 128) { g.fillStyle = 'rgba(60,35,15,.35)'; g.fillRect(x, 0, 2, h); }
});

const PRESET = {
  warm: {
    exp: 0.95, env: .55, hemi: ['#ffe6c2', '#8a6444', 0.72], sun: ['#ffc98a', 0.6], fog: '#e9d6bb', sky: ['#7fa7cf', '#f4d9b0', '#f2e3cc'],
    white: '#efdcc0', col: '#e8d2b0', slab: '#ecdcc4', roof: '#eadabf', dark: '#5a3d24', metal: '#c89a58', light: [2.2, 1.7, 1.1], railOp: .22, rail: '#f0d8b0',
    floorRough: .22, floorEnv: .4, floorColor: '#f6e6cc',
    wall: s => LIN('#d9bb92').lerp(s.col, 0.06), fascia: () => LIN('#ffffff'), inWall: s => LIN('#e2c294').lerp(s.col, 0.2),
    pools: { color: '#ffb766', op: .5, size: 7.5, doors: 0.6 },
  },
  game: {
    exp: 1.0, env: .6, hemi: ['#ffffff', '#9fb6ff', 0.85], sun: ['#ffffff', 0.75], fog: '#e8f3ff', sky: ['#3d8bff', '#8fd3ff', '#e8f5ff'],
    white: '#ffffff', col: '#2ec4b6', slab: '#d9efff', roof: '#ffe9c7', dark: '#2b2d42', metal: '#ff6b57', light: [1.8, 1.8, 1.8], railOp: .32, rail: '#9eeaff',
    floorRough: .35, floorEnv: .3, floorColor: '#ffffff',
    wall: s => s.col.clone().lerp(LIN('#ffffff'), 0.55), fascia: s => vivid(s.col), inWall: s => s.col.clone().lerp(LIN('#ffffff'), 0.45),
    signs: true, pools: null,
  },
  night: {
    exp: 1.1, env: .12, hemi: ['#46557a', '#120d0a', 0.22], sun: ['#8fa6ff', 0.06], fog: '#0b0e14', fogNear: 70, fogFar: 300, sky: ['#04060c', '#0d1424', '#1a2236'],
    white: '#34373e', col: '#23252a', slab: '#16181c', roof: '#15171b', dark: '#0d0e10', metal: '#c99a55', light: [3.2, 2.6, 1.9], railOp: .1, rail: '#9cb7c6',
    floorRough: .1, floorEnv: .35, floorColor: '#ffffff',
    wall: () => LIN('#2a2d33'), fascia: () => LIN('#15171a'), inWall: s => LIN('#6e5238').lerp(s.col, 0.3),
    glow: true, pools: { color: '#ffb35c', op: .55, size: 5.5, doors: 1, corridor: '#7aa7ff', corridorOp: .22 },
  },
};
// сочетания тёплого и вечернего
Object.assign(PRESET, {
  // 1 — тёплые сумерки: травертин и дерево, приглушённый тёплый свет, витрины светятся
  dusk: { exp: 0.95, env: .3, hemi: ['#ffd9aa', '#3a2a1c', 0.42], sun: ['#ff9f5a', 0.3], fog: '#3b2f27', fogNear: 90, fogFar: 380, sky: ['#1d2748', '#c9754a', '#f0b27a'],
    white: '#cdb392', col: '#bfa27c', slab: '#4a3a2e', roof: '#3d3028', dark: '#3a2716', metal: '#d0a15e', light: [3, 2.4, 1.6], railOp: .18, rail: '#f0d8b0',
    floorTex: 'warm', floorRough: .15, floorEnv: .35, floorColor: '#e0c9a8', wood: true,
    wall: s => LIN('#c9a57a').lerp(s.col, 0.05), fascia: () => LIN('#ffffff'), inWall: s => LIN('#d8b486').lerp(s.col, 0.15),
    glow: { interior: .3, inWalls: .15, inCeil: .25, inFloor: .35 }, pools: { color: '#ffb766', op: .55, size: 7, doors: 0.8 } },
  // 2 — тёмный камень под ногами и тёмный потолок, стены и фризы тёплые, светлые
  stone: { exp: 1.05, env: .15, hemi: ['#ffe0b8', '#1a120c', 0.35], sun: ['#ffcf99', 0.1], fog: '#16110d', fogNear: 80, fogFar: 320, sky: ['#04060c', '#0d1424', '#1a2236'],
    white: '#d9c3a3', col: '#e3cfb0', slab: '#1c1713', roof: '#171310', dark: '#20150c', metal: '#d4a55c', light: [3.2, 2.5, 1.7], railOp: .12, rail: '#f0d8b0',
    floorTex: 'night', floorRough: .1, floorEnv: .35, floorColor: '#ffffff', wood: true,
    wall: () => LIN('#d7b88c'), fascia: () => LIN('#ffffff'), inWall: s => LIN('#8a6a48').lerp(s.col, 0.25),
    glow: true, pools: { color: '#ffb35c', op: .6, size: 5.5, doors: 1, corridor: '#ffcf8a', corridorOp: .3 } },
  // 3 — лаунж: орех, латунь, тёмные стены, яркие тёплые витрины
  lounge: { exp: 1.1, env: .12, hemi: ['#ffcf99', '#120c08', 0.25], sun: ['#ffb070', 0.05], fog: '#120d0a', fogNear: 70, fogFar: 300, sky: ['#04060c', '#0d1424', '#1a2236'],
    white: '#3b2a1e', col: '#2d2018', slab: '#140f0c', roof: '#110d0a', dark: '#0f0a06', metal: '#e0b060', light: [3.4, 2.5, 1.5], railOp: .1, rail: '#e8c89a',
    floorTex: 'warm', floorRough: .08, floorEnv: .45, floorColor: '#8c7358', wood: true,
    wall: () => LIN('#4a3526'), fascia: () => LIN('#8a6848'), inWall: s => LIN('#7a5838').lerp(s.col, 0.25),
    glow: { interior: .45, inWalls: .28, inCeil: .4, inFloor: .6 }, pools: { color: '#ffb766', op: .6, size: 5.5, doors: 1, corridor: '#ffb766', corridorOp: .35 } },
  // 4 — вечер с тёплым светлым полом: тёмные стены и потолок, пол-травертин отражает витрины
  evening: { exp: 1.1, env: .12, hemi: ['#5a5470', '#140e0a', 0.25], sun: ['#8fa6ff', 0.05], fog: '#0f0d0e', fogNear: 70, fogFar: 300, sky: ['#04060c', '#0d1424', '#1a2236'],
    white: '#2e2a28', col: '#26221f', slab: '#141213', roof: '#121011', dark: '#0d0b0a', metal: '#d4a55c', light: [3.2, 2.6, 1.9], railOp: .1, rail: '#c8b6a0',
    floorTex: 'warm', floorRough: .1, floorEnv: .4, floorColor: '#d8c2a2', wood: true,
    wall: () => LIN('#2a2522'), fascia: () => LIN('#ffffff'), inWall: s => LIN('#6e5238').lerp(s.col, 0.3),
    glow: true, pools: { color: '#ffb35c', op: .55, size: 5.5, doors: 1, corridor: '#ffc98a', corridorOp: .25 } },
});
function vivid(c) { const h = {}; c.getHSL(h); return new THREE.Color().setHSL(h.h, Math.min(1, h.s * 1.35 + 0.15), 0.42); }

export function makeStyler(ctx) {
  const { scene, renderer, hemi, sun, sky, S, MAT, floors, slabMat, roofMat, railMat, colMat, merged, signAtlases, PER, walkPoints, FY, G } = ctx;
  return function applyStyle(name) {
    const P = PRESET[name]; if (!P) return false;
    renderer.toneMappingExposure = P.exp;
    hemi.color.copy(LIN(P.hemi[0])); hemi.groundColor.copy(LIN(P.hemi[1])); hemi.intensity = P.hemi[2];
    sun.color.copy(LIN(P.sun[0])); sun.intensity = P.sun[1];
    scene.fog.color.copy(LIN(P.fog)); if (P.fogNear) { scene.fog.near = P.fogNear; scene.fog.far = P.fogFar; ctx.lockFog && ctx.lockFog(P.fogNear, P.fogFar); }
    sky.material.map = tex(16, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, P.sky[0]); gr.addColorStop(.48, P.sky[1]); gr.addColorStop(1, P.sky[2]); g.fillStyle = gr; g.fillRect(0, 0, w, h); }); sky.material.needsUpdate = true;
    // пол
    scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach(m => { if (m.isMeshStandardMaterial) { if (m.userData.env0 == null) m.userData.env0 = m.envMapIntensity; m.envMapIntensity = m.userData.env0 * P.env; } }); });
    slabMat.color.copy(LIN(P.slab)); roofMat.color.copy(LIN(P.roof)); colMat.color.copy(LIN(P.col || P.white));
    const ft = FLOORS[P.floorTex || name](); floors.forEach(m => { m.map = ft; m.roughness = P.floorRough; m.envMapIntensity = P.floorEnv; m.color.copy(LIN(P.floorColor)); m.needsUpdate = true; });
    MAT.white.color.copy(LIN(P.white)); MAT.darkMetal.color.copy(LIN(P.dark)); MAT.metal.color.copy(LIN(P.metal)); MAT.light.color.setRGB(...P.light);
    railMat.color.copy(LIN(P.rail)); railMat.opacity = P.railOp;
    // стены, фризы, внутренние стены — по магазинам (цвет вершин)
    const byId = {}; S.forEach(s => { byId[s.id] = s; });
    const paint = (mesh, fn) => { const col = mesh.geometry.attributes.color; if (!col) return; const fs = mesh.userData.fs;
      for (let f = 0; f < fs.length; f++) { const s = byId[fs[f]]; if (!s || s.cat === 'tbd' && !P.glow) continue; const c = fn(s); for (let k = 0; k < 3; k++) col.setXYZ(f * 3 + k, c.r, c.g, c.b); } col.needsUpdate = true; };
    merged.walls.forEach(m => paint(m, P.wall));
    merged.inWalls.forEach(m => paint(m, P.inWall));
    merged.fascia.forEach(m => { paint(m, P.fascia); if (name === 'warm' || P.wood) { m.material.map = woodTex(); m.material.roughness = .55; m.material.needsUpdate = true; } });
    if (P.glow) { const GL = Object.assign({ interior: .38, inWalls: .22, inCeil: .3, inFloor: .5 }, P.glow === true ? {} : P.glow);
      merged.interior.forEach(m => { m.material.emissive = LIN('#ffffff'); m.material.emissiveMap = m.material.map; m.material.emissiveIntensity = GL.interior; m.material.needsUpdate = true; });
      merged.inWalls.forEach(m => { m.material.emissive = LIN('#ffc98a'); m.material.emissiveIntensity = GL.inWalls; m.material.needsUpdate = true; });
      merged.inCeil.forEach(m => { m.material.emissive = LIN('#fff1d9'); m.material.emissiveIntensity = GL.inCeil; m.material.needsUpdate = true; });
      merged.inFloor.forEach(m => { m.material.emissive = LIN('#6b4a2a'); m.material.emissiveIntensity = GL.inFloor; m.material.needsUpdate = true; });
    }
    // вывески: цветная плашка с белыми буквами
    if (P.signs) signAtlases.forEach((t, a) => { const g = t.image.getContext('2d'); S.slice(a * PER, (a + 1) * PER).forEach((s, i) => { if (s.cat === 'tbd') return; const x = (i % 4) * 512, y = Math.floor(i / 4) * 64;
      const c = vivid(s.col).clone().convertLinearToSRGB(); g.fillStyle = '#' + c.getHexString(); g.fillRect(x, y, 512, 64); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x, y, 512, 6);
      g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 42; do { g.font = `900 ${fs}px Manrope, system-ui, sans-serif`; fs -= 2; } while (g.measureText(s.name).width > 470 && fs > 10);
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.25)'; g.strokeText(s.name, x + 256, y + 34); g.fillStyle = '#fff'; g.fillText(s.name, x + 256, y + 33); }); t.needsUpdate = true; });
    // световые пятна на полу: под светильниками в галерее и перед входами в магазины
    if (P.pools) {
      const pt = tex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.45, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
      const mk = (pts, color, op, size) => { if (!pts.length) return; const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
        const m = new THREE.MeshBasicMaterial({ map: pt, color: LIN(color), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 });
        const im = new THREE.InstancedMesh(geo, m, pts.length); const mt = new THREE.Matrix4();
        pts.forEach((p, i) => { mt.makeScale(p.s || size, 1, p.s || size); mt.setPosition(p.x, p.y + 0.02, p.z); im.setMatrixAt(i, mt); }); (p => p)(0);
        im.frustumCulled = false; return im; };
      [1, 2].forEach(f => { const pts = walkPoints(f, 6.5).map(([x, z]) => ({ x, z, y: FY[f] })); const im = mk(pts, P.pools.corridor || P.pools.color, P.pools.corridorOp || P.pools.op, P.pools.size); if (im) (f === 1 ? scene : G('f2')).add(im); });
      const dp = []; S.forEach(s => { if (s.door && s.cat !== 'tbd') dp.push({ x: s.door.c.x + s.door.n.x * 1.4, z: s.door.c.z + s.door.n.z * 1.4, y: FY[s.floor], s: 4.2, f: s.floor }); });
      [1, 2].forEach(f => { const im = mk(dp.filter(p => p.f === f), P.pools.color, P.pools.op * P.pools.doors, 4.2); if (im) (f === 1 ? scene : G('f2')).add(im); });
    }
    return true;
  };
}
