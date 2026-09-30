// Пробные эффекты картинки (превью): отражения в полу, свечение ламп и вывесок, цветокоррекция и виньетка.
// Включаются параметром ?fx=refl,bloom,grade (любой набор) или __maxi.setFX({...}).
import * as THREE from 'three';

const QUAD_V = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';

export function makeFX(renderer, scene) {
  const gl2 = renderer.capabilities.isWebGL2;
  const o = { refl: false, bloom: false, grade: false, reflK: .38, bloomK: .35, thr: .96 };
  const size = new THREE.Vector2();
  const mk = (w, h, ms) => {
    const C = ms && gl2 ? THREE.WebGLMultisampleRenderTarget : THREE.WebGLRenderTarget;
    const t = new C(Math.max(1, w), Math.max(1, h), { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
    t.texture.encoding = THREE.sRGBEncoding; if (ms && gl2) t.samples = 4; return t;
  };
  let rtMain = null, rtA = null, rtB = null, rtR = null, W = 0, H = 0;
  function ensure() {
    renderer.getDrawingBufferSize(size); if (size.x === W && size.y === H && rtMain) return; W = size.x; H = size.y;
    [rtMain, rtA, rtB, rtR].forEach(t => t && t.dispose());
    rtMain = mk(W, H, true); rtA = mk(W >> 2, H >> 2); rtB = mk(W >> 2, H >> 2); rtR = mk(W >> 1, H >> 1, true);
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
  function mkU() { return { tRefl: { value: null }, tmRefl: { value: new THREE.Matrix4() }, reflK: { value: 0 } }; }
  function patch(mat, f) {
    const u = U[f]; mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPr;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWPr=(modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tRefl;uniform mat4 tmRefl;uniform float reflK;varying vec3 vWPr;')
        .replace('#include <dithering_fragment>', `if(reflK>0.){vec4 rc=tmRefl*vec4(vWPr,1.0);vec2 ru=rc.xy/rc.w;vec2 o=vec2(.0016,.0022);
          vec3 r=texture2D(tRefl,ru).rgb*.4+(texture2D(tRefl,ru+o).rgb+texture2D(tRefl,ru-o).rgb+texture2D(tRefl,ru+vec2(o.x,-o.y)).rgb+texture2D(tRefl,ru-vec2(o.x,-o.y)).rgb)*.15;
          vec3 V=normalize(cameraPosition-vWPr);float fr=reflK*(.3+.7*pow(1.-clamp(V.y,0.,1.),3.));gl_FragColor.rgb=mix(gl_FragColor.rgb,r,fr);}
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
    vcam.far = cam.far; vcam.near = cam.near; vcam.updateMatrixWorld(); vcam.projectionMatrix.copy(cam.projectionMatrix); vcam.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
    const tm = U[f].tmRefl.value; tm.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1); tm.multiply(vcam.projectionMatrix); tm.multiply(vcam.matrixWorldInverse);
    plane.constant = -(h + 0.02); const oc = renderer.clippingPlanes; renderer.clippingPlanes = [plane];
    renderer.setRenderTarget(rtR); renderer.clear(); renderer.render(scene, vcam); renderer.clippingPlanes = oc;
  }

  return {
    opts: o,
    set(p) { Object.assign(o, p); },
    patchFloors(list) { list.forEach(([m, f]) => patch(m, f)); },
    get active() { return o.refl || o.bloom || o.grade; },
    render(sc, cam, floor, floorY) {
      ensure();
      [1, 2].forEach(f => { U[f].reflK.value = o.refl && sc === scene && f === floor ? o.reflK : 0; U[f].tRefl.value = rtR.texture; });
      if (o.refl && sc === scene) renderRefl(cam, floorY, floor);
      const post = o.bloom || o.grade;
      if (!post) { renderer.setRenderTarget(null); renderer.render(sc, cam); return; }
      renderer.setRenderTarget(rtMain); renderer.clear(); renderer.render(sc, cam);
      if (o.bloom) {
        bright.uniforms.t.value = rtMain.texture; bright.uniforms.thr.value = o.thr; pass(bright, rtA);
        for (let i = 0; i < 2; i++) {
          blur.uniforms.t.value = rtA.texture; blur.uniforms.d.value.set((1 + i) / rtA.width, 0); pass(blur, rtB);
          blur.uniforms.t.value = rtB.texture; blur.uniforms.d.value.set(0, (1 + i) / rtA.height); pass(blur, rtA);
        }
      }
      comp.uniforms.t.value = rtMain.texture; comp.uniforms.b.value = rtA.texture; comp.uniforms.bk.value = o.bloom ? o.bloomK : 0; comp.uniforms.gr.value = o.grade ? 1 : 0;
      pass(comp, null);
    },
  };
}
