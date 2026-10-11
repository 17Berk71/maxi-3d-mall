// Рендер галереи: canvas, WebGLRenderer, сцена, камера, эффекты (fx.js), окружение, небо, свет.
import * as THREE from 'three';
import {makeFX} from './fx.js';
import {$, LIN} from '../core/helpers.js';
import {canvasTex} from './canvas.js';
import {app} from '../core/state.js';
export let canvas, coarse, renderer, scene, FX, DEC, cam, maxAniso, hemi, skyMesh, MERGED, floorMats, floorMatsF, sun;
let QS0, FOG;

// по порядку, при запуске
export function init() {

/* ---------- Рендер ---------- */
canvas = $('c');
coarse = matchMedia('(pointer:coarse)').matches;
renderer = new THREE.WebGLRenderer({canvas,antialias:!coarse,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,coarse?1.5:2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=0.9;
renderer.physicallyCorrectLights=false;
scene = new THREE.Scene();
FX = makeFX(renderer,scene,coarse);QS0 = new URLSearchParams(location.search); DEC = true;
FOG = LIN('#e9ecef');scene.fog=new THREE.Fog(FOG,140,620);
cam = new THREE.PerspectiveCamera(64,innerWidth/innerHeight,0.1,3000);cam.rotation.order='YXZ';
maxAniso = renderer.capabilities.getMaxAnisotropy();
// окружение для отражений: светлый зал с полосами света
{const env=new THREE.Scene();const box=new THREE.Mesh(new THREE.BoxGeometry(60,20,60),new THREE.MeshBasicMaterial({color:LIN('#cfd3d6'),side:THREE.BackSide}));env.add(box);
 const lm=new THREE.MeshBasicMaterial({color:new THREE.Color(6,6,5.6)});
 for(let i=-2;i<=2;i++){const p=new THREE.Mesh(new THREE.PlaneGeometry(50,1.6),lm);p.rotation.x=Math.PI/2;p.position.set(0,9.8,i*10);env.add(p);}
 const warm=new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,1.9,1.5)});[[-29.8,Math.PI/2],[29.8,-Math.PI/2]].forEach(([x,r])=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(50,5),warm);p.position.set(x,2.5,0);p.rotation.y=r;env.add(p);});
 const floorE=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshBasicMaterial({color:LIN('#e8e2d8')}));floorE.rotation.x=-Math.PI/2;floorE.position.y=-9.9;env.add(floorE);
 const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(env,0.02).texture;pm.dispose();}
hemi = new THREE.HemisphereLight(LIN('#ffffff'),LIN('#bfb4a4'),0.55);scene.add(hemi);
skyMesh = null; app.FOGW = [120,520];MERGED = {walls:[],fascia:[],interior:[],inWalls:[],inFloor:[],inCeil:[]}; floorMats = []; floorMatsF = [];
sun = new THREE.DirectionalLight(LIN('#fff4e6'),0.55);sun.position.set(-80,160,-60);scene.add(sun);
// небо
{const sky=new THREE.Mesh(new THREE.SphereGeometry(1800,32,16),new THREE.MeshBasicMaterial({side:THREE.BackSide,depthWrite:false,fog:false,map:canvasTex(16,256,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#6f9cc9');gr.addColorStop(.45,'#a9c7e2');gr.addColorStop(.5,'#dde6ec');gr.addColorStop(1,'#c9ccce');g.fillStyle=gr;g.fillRect(0,0,w,h);})}));scene.add(sky);skyMesh=sky;}
}
