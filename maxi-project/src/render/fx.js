// Эффекты картинки: отражения в полу, свечение ламп и вывесок, цветокоррекция и виньетка.
// Качество выбирается само по замеру времени кадра: уровень 0 (без эффектов) … 3 (полный).
// Телефон стартует с 1, компьютер с 3; если кадры тяжёлые — уровень падает, если есть запас — растёт
// (уровень, на котором было тяжело, больше не включается). Для проверки: ?q=0..3 фиксирует уровень.
// На телефоне живого отражения нет никогда: вместо него «поддельный» блеск — пол отражает снимок окружения
// (кубическая карта 6×128 px вокруг игрока, по одной грани за кадр, обновляется, когда отошёл на 10 м).
// Режимы для настроек: setMode('auto' | 'best' | 'fast').
import * as THREE from 'three';

const QUAD_V = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';

export function makeFX(renderer, scene, coarse) {
  const gl2 = renderer.capabilities.isWebGL2;
  const o = { refl: true, bloom: true, grade: true, reflK: .38, bloomK: .35, thr: .96, auto: true, mirror: true, mirK: .3, onMirror: null };
  const dpr = window.devicePixelRatio || 1;
  const TIERS = [
    { pr: 1 },
    { pr: Math.min(dpr, 1.25), ms: false, bs: 3, bi: 1, rs: 0 },
    coarse ? { pr: Math.min(dpr, 1.6), ms: false, bs: 2, bi: 1, rs: 0 } : { pr: Math.min(dpr, 1.75), ms: true, bs: 2, bi: 1, rs: 2, every: 2, far: 45, rms: false },
    coarse ? { pr: Math.min(dpr, 2), ms: true, bs: 2, bi: 2, rs: 0 } : { pr: Math.min(dpr, 2), ms: true, bs: 2, bi: 2, rs: 1, every: 1, far: 0, rms: true },
  ];
  let mode = 'auto';
  let tier = coarse ? 1 : 3, cfg = TIERS[tier], ban = 4, frameNo = 0;
  const size = new THREE.Vector2();
  const mk = (w, h, ms) => {
    const C = ms && gl2 ? THREE.WebGLMultisampleRenderTarget : THREE.WebGLRenderTarget;
    const t = new C(Math.max(1, w), Math.max(1, h), { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
    t.texture.encoding = THREE.sRGBEncoding; if (ms && gl2) t.samples = 4; return t;
  };
  let rtMain = null, rtA = null, rtB = null, rtR = null, W = 0, H = 0, key = '';
  function ensure() {
    renderer.getDrawingBufferSize(size); const k = size.x + 'x' + size.y + ':' + tier;
    if (k === key && rtMain) return; key = k; W = size.x; H = size.y;
    [rtMain, rtA, rtB, rtR].forEach(t => t && t.dispose());
    if (tier < 1) { rtMain = rtA = rtB = rtR = null; return; }
    rtMain = mk(W, H, cfg.ms); rtA = mk(W >> cfg.bs, H >> cfg.bs); rtB = mk(W >> cfg.bs, H >> cfg.bs);
    rtR = cfg.rs ? mk(W >> cfg.rs, H >> cfg.rs, cfg.rms) : mk(4, 4);
  }
  function setTier(t) {
    tier = Math.max(0, Math.min(3, t)); cfg = TIERS[tier]; warm = 40; acc = 0; n = 0;
    renderer.setPixelRatio(cfg.pr); renderer.setSize(innerWidth, innerHeight);
  }
  // автоподбор качества по времени кадра
  let last = 0, last0 = false, acc = 0, n = 0, warm = 90;
  document.addEventListener('visibilitychange', () => { last0 = false; });
  function measure() {
    const t = performance.now(), dt = Math.min(t - last, 1500); last = t;
    if (!o.auto || dt <= 0 || !last0 || document.hidden) { last0 = true; return; }
    if (warm > 0) { warm--; return; }
    acc += dt; n++;
    if (n === 45 && acc / n > (tier === 1 ? 38 : 25) && tier > 0) { ban = tier; setTier(tier - 1); return; }
    if (n >= 180) { if (acc / n < 18.5 && tier + 1 < ban) setTier(tier + 1); else { acc = 0; n = 0; } }
  }
  const qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), qscene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); qscene.add(quad);
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qscene, qcam); };
  const bright = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, thr: { value: .7 } }, vertexShader: QUAD_V, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D t;uniform float thr;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb;float l=max(c.r,max(c.g,c.b));float k=smoothstep(thr,thr+.08,l);gl_FragColor=vec4(c*k,1.);}' });
  const blur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, d: { value: new THREE.Vector2() } }, vertexShader: QUAD_V, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D t;uniform vec2 d;varying vec2 vUv;void main(){vec3 c=texture2D(t,vUv).rgb*.227;c+=(texture2D(t,vUv+d*1.38).rgb+texture2D(t,vUv-d*1.38).rgb)*.316;c+=(texture2D(t,vUv+d*3.23).rgb+texture2D(t,vUv-d*3.23).rgb)*.07;gl_FragColor=vec4(c,1.);}' });
  const comp = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, b: { value: null }, bk: { value: 0 }, gr: { value: 0 } }, vertexShader: QUAD_V, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D t,b;uniform float bk,gr;varying vec2 vUv;
    void main(){vec3 c=texture2D(t,vUv).rgb;c+=texture2D(b,vUv).rgb*bk;
     if(gr>0.){float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,1.1);c=c*c*(3.-2.*c)*.18+c*.82;c*=vec3(1.0,1.0,1.01);c*=.97;
      vec2 q=vUv-.5;c*=1.-dot(q,q)*.55;}
     gl_FragColor=vec4(clamp(c,0.,1.),1.);}` });

  // ---- отражения в полу текущего этажа
  const U = { 1: mkU(), 2: mkU() };
  function mkU() { return { tRefl: { value: null }, tmRefl: { value: new THREE.Matrix4() }, reflK: { value: 0 }, mirK: { value: 0 } }; }
  function patch(mat, f) {
    const u = U[f]; mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPr;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWPr=(modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tRefl;uniform mat4 tmRefl;uniform float reflK;uniform float mirK;varying vec3 vWPr;')
        .replace('#include <dithering_fragment>', `if(reflK>0.){vec4 rc=tmRefl*vec4(vWPr,1.0);vec2 ru=rc.xy/rc.w;vec2 o=vec2(.0016,.0022);
          vec3 r=texture2D(tRefl,ru).rgb*.4+(texture2D(tRefl,ru+o).rgb+texture2D(tRefl,ru-o).rgb+texture2D(tRefl,ru+vec2(o.x,-o.y)).rgb+texture2D(tRefl,ru-vec2(o.x,-o.y)).rgb)*.15;
          vec3 V=normalize(cameraPosition-vWPr);float fr=reflK*(.3+.7*pow(1.-clamp(V.y,0.,1.),3.));gl_FragColor.rgb=mix(gl_FragColor.rgb,r,fr);}
          if(mirK>0.){vec3 V2=normalize(cameraPosition-vWPr);gl_FragColor.a=1.-mirK*(.32+.68*pow(1.-clamp(V2.y,0.,1.),2.5));}
          #include <dithering_fragment>`);
    };
    mat.customProgramCacheKey = () => 'refl' + f; mat.needsUpdate = true;
  }
  const vcam = new THREE.PerspectiveCamera(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const _n = new THREE.Vector3(0, 1, 0), _p = new THREE.Vector3(), _c = new THREE.Vector3(), _v = new THREE.Vector3(), _t = new THREE.Vector3(), _la = new THREE.Vector3(), _m = new THREE.Matrix4();
  function renderRefl(cam, h, f) {
    _p.set(0, h, 0); _c.setFromMatrixPosition(cam.matrixWorld); if (_c.y <= h) return;
    _v.subVectors(_p, _c); _v.reflect(_n).negate(); _v.add(_p);
    _m.extractRotation(cam.matrixWorld); _la.set(0, 0, -1).applyMatrix4(_m).add(_c);
    _t.subVectors(_p, _la); _t.reflect(_n).negate(); _t.add(_p);
    vcam.position.copy(_v); vcam.up.set(0, 1, 0).applyMatrix4(_m).reflect(_n); vcam.lookAt(_t);
    vcam.fov = cam.fov; vcam.aspect = cam.aspect; vcam.near = cam.near; vcam.far = cfg.far || cam.far; vcam.updateProjectionMatrix(); vcam.updateMatrixWorld();
    const tm = U[f].tmRefl.value; tm.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1); tm.multiply(vcam.projectionMatrix); tm.multiply(vcam.matrixWorldInverse);
    plane.constant = -(h + 0.02); const oc = renderer.clippingPlanes; renderer.clippingPlanes = [plane];
    renderer.setRenderTarget(rtR); renderer.clear(); renderer.render(scene, vcam); renderer.clippingPlanes = oc;
  }

  // ---- поддельный блеск пола: снимок окружения вокруг игрока
  const FL = [];   // [материал, этаж, исходная интенсивность, исходная шероховатость]
  const pmrem = new THREE.PMREMGenerator(renderer);
  const cubeRT = new THREE.WebGLCubeRenderTarget(128, { format: THREE.RGBAFormat, generateMipmaps: false, minFilter: THREE.LinearFilter });
  cubeRT.texture.encoding = THREE.sRGBEncoding;
  const faceCams = [[1, 0, 0, 0, -1, 0], [-1, 0, 0, 0, -1, 0], [0, 1, 0, 0, 0, 1], [0, -1, 0, 0, 0, -1], [0, 0, 1, 0, -1, 0], [0, 0, -1, 0, -1, 0]].map(([x, y, z, ux, uy, uz]) => {
    const c = new THREE.PerspectiveCamera(90, 1, 0.3, 160); c.up.set(ux, uy, uz); c.userData.d = new THREE.Vector3(x, y, z); return c; });
  let probe = null, probeAt = null, cap = null, fakeOn = false;
  const fakeWanted = () => o.fake !== false && !(o.refl && cfg.rs > 0);
  // поддельное отражение: блеск от снимка окружения + «зеркальная» копия витрин под прозрачным полом 1 этажа
  // (её строит app.js и включает через opts.onMirror; на 2 этаже под полом — первый этаж, там только блеск)
  function applyFake(on) {
    fakeOn = on; const env = on && probe;
    FL.forEach(r => { r[0].envMap = env ? probe : null; r[0].envMapIntensity = env ? r[2] * 1.3 : r[2]; r[0].roughness = env ? Math.min(r[3], .13) : r[3];
      const mir = on && r[1] === 1 && o.mirror; r[0].transparent = !!mir; r[0].depthWrite = true; U[r[1]].mirK.value = mir ? o.mirK : 0; r[0].needsUpdate = true; });
    if (o.onMirror) o.onMirror(on && !!o.mirror);
  }
  function stepProbe(pos, sc) {
    if (!cap) {
      if (probeAt && probeAt.distanceTo(pos) < 10) return;
      cap = { face: 0, p: pos.clone().setY(pos.y + 0.6) };
    }
    const c = faceCams[cap.face]; c.position.copy(cap.p); c.lookAt(_t.copy(cap.p).add(c.userData.d));
    const fog = sc.fog; sc.fog = null; const oc = renderer.clippingPlanes; renderer.clippingPlanes = [];
    const hid = (o.probeHide || []).filter(g => g && g.visible); hid.forEach(g => { g.visible = false; });
    renderer.setRenderTarget(cubeRT, cap.face); renderer.clear(); renderer.render(sc, c);
    hid.forEach(g => { g.visible = true; }); sc.fog = fog; renderer.clippingPlanes = oc; renderer.setRenderTarget(null);
    if (++cap.face < 6) return;
    const old = probe; probe = pmrem.fromCubemap(cubeRT.texture).texture; if (old) old.dispose();
    probeAt = cap.p.clone().setY(pos.y); cap = null; applyFake(true);
  }

  return {
    opts: o,
    get mode() { return mode; },
    // режим из настроек: авто (по скорости кадра), лучше (максимум для устройства), быстрее (без тяжёлого)
    setMode(m) {
      mode = m; if (m === 'best') { o.auto = false; setTier(3); } else if (m === 'fast') { o.auto = false; setTier(1); }
      else { o.auto = true; ban = 4; setTier(coarse ? 1 : 3); }
      key = ''; applyFake(fakeWanted() && !!probe);
    },
    get fake() { return fakeOn; },
    set(p) { Object.assign(o, p); },
    patchFloors(list) { list.forEach(([m, f]) => { patch(m, f); FL.push([m, f, m.envMapIntensity, m.roughness]); }); },
    // стиль мог поменять пол — запомнить новые исходные значения
    refreshFloors() { FL.forEach(r => { if (!fakeOn) { r[2] = r[0].envMapIntensity; r[3] = r[0].roughness; } }); },
    init() { setTier(tier); },
    get tier() { return tier; },
    setTier(t) { o.auto = false; setTier(t); },
    get active() { return true; },
    render(sc, cam, floor, floorY, walking) {
      measure(); ensure(); frameNo++;
      const fw = fakeWanted() && sc === scene;
      if (fw && walking) stepProbe(cam.position, sc);
      if (fw !== fakeOn) applyFake(fw);
      if (fakeOn && o.mirror) U[1].mirK.value = !o.mirrorGate || o.mirrorGate() ? o.mirK : 0;
      const refl = o.refl && cfg.rs > 0 && sc === scene;
      [1, 2].forEach(f => { U[f].reflK.value = refl && f === floor ? o.reflK : 0; U[f].tRefl.value = rtR ? rtR.texture : null; });
      if (refl && frameNo % cfg.every === 0) renderRefl(cam, floorY, floor);
      if (tier < 1) { renderer.setRenderTarget(null); renderer.render(sc, cam); return; }
      const bloom = o.bloom;
      renderer.setRenderTarget(rtMain); renderer.clear(); renderer.render(sc, cam);
      if (bloom) {
        bright.uniforms.t.value = rtMain.texture; bright.uniforms.thr.value = o.thr; pass(bright, rtA);
        for (let i = 0; i < cfg.bi; i++) {
          blur.uniforms.t.value = rtA.texture; blur.uniforms.d.value.set((1 + i) / rtA.width, 0); pass(blur, rtB);
          blur.uniforms.t.value = rtB.texture; blur.uniforms.d.value.set(0, (1 + i) / rtA.height); pass(blur, rtA);
        }
      }
      comp.uniforms.t.value = rtMain.texture; comp.uniforms.b.value = rtA.texture; comp.uniforms.bk.value = bloom ? o.bloomK : 0; comp.uniforms.gr.value = o.grade ? 1 : 0;
      pass(comp, null);
    },
  };
}
