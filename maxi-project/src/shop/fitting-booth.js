// Кабина примерочной в зале и вход в неё; связь с примерочной (FIT).
import * as THREE from 'three';
import {siteOf, catalogOf, fmtPrice} from './catalog.js';
import {createFitting} from './fitting.js';
import {releaseLock, updateCross} from '../controls/input.js';
import {applyPose, player, walkPose} from '../controls/player.js';
import {$, LIN} from '../core/helpers.js';
import {MAT} from '../mall/world.js';
import {canvasTex, rr} from '../render/canvas.js';
import {coarse} from '../render/scene.js';
import {closeShopPanel, requestLockIfNeeded} from './panel.js';
import {thumbURL} from './product.js';
import {closeCard} from '../ui/card.js';
import {app} from '../core/state.js';
export let FIT;
let fitArmed;

// Примерочная в зале: заметная кабина в левом переднем углу (видна сразу от входа), открытой стороной к залу.
// Светящаяся арка, световой короб «Примерочная» на две стороны, шторка, зеркало внутри, пятно света на полу.
// Зашёл внутрь или нажал на неё — открывается примерочная с фигурой (src/shop/fitting.js).
export function buildFittingBooth(sc,s,W,D,brand,brandHex,colliders,pick){
 const cx=-W/2+1.55,cz=D/2-4.3,hw=1.35,hd=1.25,H=2.55,g=new THREE.Group();g.position.set(cx,0,cz);sc.add(g);
 const wall=new THREE.MeshStandardMaterial({color:brand.clone().lerp(LIN('#ffffff'),0.12),roughness:.7});
 const inner=new THREE.MeshStandardMaterial({color:LIN('#efe7dc'),roughness:.85});
 const led=new THREE.MeshBasicMaterial({color:new THREE.Color(2.4,2.1,1.7),toneMapped:false});
 const box=(w,h,d,x,y,z,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);g.add(o);return o;};
 // боковые стены (снаружи — цвет магазина, внутри — светлые) и крыша
 [-1,1].forEach(k=>{box(2*hw,H,0.08,0,H/2,k*hd,wall);box(2*hw-0.1,H-0.1,0.01,0,H/2,k*(hd-0.05),inner);});
 box(0.08,H,2*hd,-hw,H/2,0,inner);box(2*hw+0.1,0.1,2*hd+0.1,0,H+0.05,0,wall);
 // светящаяся арка по проёму
 [-1,1].forEach(k=>box(0.06,H,0.06,hw,H/2,k*(hd-0.02),led));box(0.06,0.06,2*hd,hw,H-0.02,0,led);
 // световой короб: на крыше лицом в зал и на стене лицом ко входу
 const signT=canvasTex(1024,200,(c,w,h)=>{c.fillStyle='#16181b';rr(c,0,0,w,h,36);c.fill();c.fillStyle=brandHex;c.fillRect(0,h-16,w,16);
  c.strokeStyle='#fff';c.lineWidth=12;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(120,62);c.quadraticCurveTo(120,40,142,40);c.quadraticCurveTo(162,40,162,60);c.quadraticCurveTo(162,76,142,86);c.lineTo(62,140);c.lineTo(222,140);c.closePath();c.stroke();
  c.fillStyle='#fff';c.textAlign='left';c.textBaseline='middle';c.font='800 92px Manrope, sans-serif';c.fillText('Примерочная',270,96);});
 const signM=new THREE.MeshBasicMaterial({map:signT,toneMapped:false});
 const s1=new THREE.Mesh(new THREE.PlaneGeometry(2.5,0.49),signM);s1.position.set(hw+0.06,H+0.42,0);s1.rotation.y=Math.PI/2;g.add(s1);
 const s2=new THREE.Mesh(new THREE.PlaneGeometry(2.5,0.49),signM);s2.position.set(0,H+0.42,hd+0.06);g.add(s2);
 box(0.08,0.55,2.6,hw+0.01,H+0.42,0,MAT.darkMetal);box(2.6,0.55,0.08,0,H+0.42,hd+0.01,MAT.darkMetal);
 // шторка, собранная у одной стороны проёма
 {const cg=new THREE.PlaneGeometry(0.7,2.3,20,1);const P=cg.attributes.position;for(let i=0;i<P.count;i++)P.setZ(i,Math.sin(P.getX(i)*30)*0.05);cg.computeVertexNormals();
  const cu=new THREE.Mesh(cg,new THREE.MeshStandardMaterial({color:brand.clone().multiplyScalar(0.6),roughness:.95,side:THREE.DoubleSide}));cu.rotation.y=Math.PI/2;cu.position.set(hw-0.1,1.2,-hd+0.42);g.add(cu);
  box(0.03,0.03,2*hd,hw-0.1,2.38,0,MAT.darkMetal);}
 // зеркало с подсветкой, крючок, коврик
 const mir=new THREE.Mesh(new THREE.PlaneGeometry(0.85,1.9),new THREE.MeshStandardMaterial({color:LIN('#d5dde2'),roughness:.03,metalness:1}));mir.position.set(-hw+0.06,1.15,0);mir.rotation.y=Math.PI/2;g.add(mir);
 [-1,1].forEach(k=>box(0.02,1.95,0.025,-hw+0.06,1.15,k*0.45,led));
 const rug=new THREE.Mesh(new THREE.CircleGeometry(0.7,40),new THREE.MeshStandardMaterial({color:LIN('#d9cdbd'),roughness:.95}));rug.rotation.x=-Math.PI/2;rug.position.set(-0.1,0.012,0);g.add(rug);
 // пятно света на полу перед проёмом
 const glowT=canvasTex(256,256,(c,w,h)=>{const gr=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gr.addColorStop(0,'rgba(255,236,200,.55)');gr.addColorStop(1,'rgba(255,236,200,0)');c.fillStyle=gr;c.fillRect(0,0,w,h);});
 const glow=new THREE.Mesh(new THREE.PlaneGeometry(3.6,3.6),new THREE.MeshBasicMaterial({map:glowT,transparent:true,depthWrite:false,toneMapped:false}));glow.rotation.x=-Math.PI/2;glow.position.set(hw+0.9,0.014,0);g.add(glow);
 const lamp=new THREE.PointLight(LIN('#ffe3bd'),6,6,2);lamp.position.set(0,2.2,0);g.add(lamp);
 // невидимая коробка для нажатия
 const hit=new THREE.Mesh(new THREE.BoxGeometry(2*hw+0.3,H+1,2*hd+0.3),new THREE.MeshBasicMaterial({visible:false}));hit.position.set(0,(H+1)/2,0);hit.userData.fit=true;g.add(hit);pick.push(hit);
 colliders.push([cx-hw-0.1,cx+hw+0.05,cz+hd-0.06,cz+hd+0.06],[cx-hw-0.1,cx+hw+0.05,cz-hd-0.06,cz-hd+0.06],[cx-hw-0.1,cx-hw+0.06,cz-hd,cz+hd]);
 return{cx,cz,x0:cx-hw+0.15,x1:cx+hw-0.25,z0:cz-hd+0.15,z1:cz+hd-0.15,out:{x:cx+hw+1.6,z:cz}};}
export function updateFittingBooth(){if(app.mode!=='store'||!app.SHOP||!app.SHOP.fit||fitOpen()||app.anim)return;const f=app.SHOP.fit,inside=player.x>f.x0&&player.x<f.x1&&player.z>f.z0&&player.z<f.z1;
 if(!inside){fitArmed=true;return;}if(fitArmed){fitArmed=false;openFitting();}}
export function fitOpen(){return FIT.isOpen;}
export function openFitting(){if(fitOpen())return;if(!$('shop').hidden)closeShopPanel(false);closeCard();releaseLock();FIT.open(app.mode==='store'&&app.SHOP?app.SHOP.s:(app.PS&&app.PS.s)||null);}

// по порядку, при запуске
export function init() {

// вход в кабину ногами: стоишь внутри — открывается примерочная; после выхода нужно выйти из кабины
fitArmed = true;
FIT = createFitting({fmtPrice,thumb:p=>thumbURL(p),siteOf,coarse,catalogOf,
 onOpen:()=>{releaseLock();updateCross();},
 onClose:()=>{if(app.mode==='store'&&app.SHOP&&app.SHOP.fit){const f=app.SHOP.fit,inside=player.x>f.x0-0.3&&player.x<f.x1+0.3&&player.z>f.z0-0.3&&player.z<f.z1+0.3;if(inside){player.x=f.out.x;player.z=f.out.z;player.yaw=-Math.PI/2;player.pitch=-0.05;player.vx=player.vz=0;applyPose(walkPose());}fitArmed=false;}requestLockIfNeeded();}});
FIT.mountBodyControls($('bodyPrefs'));
}
