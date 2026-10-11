// Сцена кабины: рендерер, свет, фон-циклорама, шторки, камера, вращение и приближение фигуры.
import * as THREE from 'three';
import {LIN} from './common.js';
import {fit} from './state.js';
export let R, el, SKIN, built;

  export function ensureScene() {
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
    const key = new THREE.SpotLight(LIN('#fffaf3'), 70, 9, 0.6, 0.6, 2); key.position.set(1.2, 3.2, 2.4); key.castShadow = true; { const sm = typeof window !== 'undefined' && window.__shadowMap || 2048; key.shadow.mapSize.set(sm, sm); }   /* __shadowMap — проверки без видеокарты (быстрее кадр) */ key.shadow.bias = -0.0003; key.shadow.normalBias = 0.01; scene.add(key, key.target);
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

// по порядку, при запуске
export function init() {

  // ---------- сцена кабины ----------
  R = null; fit.open = false; fit.shopNow = null; fit.raf = 0; fit.tab = 'items';
  el = id => document.getElementById(id);
  SKIN = ['#e8e2da', '#f1d3bd', '#d9a882', '#a8714f', '#6e4630'];
  built = {key: ''};
}
