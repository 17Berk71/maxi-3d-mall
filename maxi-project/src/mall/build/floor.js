// Пол галереи (мрамор, цветные полосы у проёмов), парковка, туалеты (у них нет входов в магазины).
import * as THREE from 'three';
import {mulberry} from '../../core/utils.js';
import {D, D2} from '../../app.js';
import {bb} from '../../controls/view.js';
import {LIN, V3} from '../../core/helpers.js';
import {world} from '../world.js';
import {voidPolys} from '../../nav/walkgrid.js';
import {canvasTex} from '../../render/canvas.js';
import {Merger, flatShape, shapeOf} from '../../render/merger.js';
import {floorMats, floorMatsF, scene} from '../../render/scene.js';
import {buildAtlases} from '../../render/sign-atlases.js';
import {marble} from '../../render/textures.js';
export let bpoly, e3, nearWC, doors, wood;
let ground, fg, floor, band, OR, GRN, park, lot, WC_R;

// по порядку, при запуске
export function init() {
 bpoly = D.bld.reduce((a,b)=>b.length>a.length?b:a,D.bld[0]);
 ground = new THREE.Mesh((()=>{const cx=(bb.x0+bb.x1)/2,cz=(bb.z0+bb.z1)/2,R=1500;return new THREE.ShapeGeometry(shapeOf([[cx-R,cz-R],[cx+R,cz-R],[cx+R,cz+R],[cx-R,cz+R]],D.bld));})(),new THREE.MeshStandardMaterial({color:LIN('#7d8388'),roughness:.95}));ground.rotation.x=-Math.PI/2;ground.position.y=-0.06;scene.add(ground);
 // пол: полированный мрамор
 fg = flatShape(bpoly,0.01);
 {const P=fg.attributes.position.array,U=new Float32Array(P.length/3*2);for(let i=0;i<P.length/3;i++){U[i*2]=P[i*3]/4.8;U[i*2+1]=P[i*3+2]/4.8;}fg.setAttribute('uv',new THREE.BufferAttribute(U,2));}
 floor = new THREE.Mesh(fg,new THREE.MeshStandardMaterial({map:marble,roughness:.16,metalness:0,envMapIntensity:.55}));floor.renderOrder=-1;scene.add(floor);floorMats.push(floor.material);floorMatsF.push([floor.material,1]);
 // цветные полосы вдоль проёмов (как на фото)
 band = new Merger();OR = LIN('#ef7d35'); GRN = LIN('#7ab04f');
 voidPolys.forEach(v=>{for(let i=0;i<v.length;i++){const a=v[i],b=v[(i+1)%v.length];const A=new V3(a[0],0.025,a[1]),B=new V3(b[0],0.025,b[1]);const L=A.distanceTo(B);if(L<0.05)continue;
  const n=new V3(-(B.z-A.z)/L,0,(B.x-A.x)/L);[[0,0.3,OR],[0.3,0.75,GRN]].forEach(([o0,o1,col])=>{[1,-1].forEach(sg=>{
   const p0=A.clone().addScaledVector(n,sg*o0),p1=B.clone().addScaledVector(n,sg*o0),p2=B.clone().addScaledVector(n,sg*o1),p3=A.clone().addScaledVector(n,sg*o1);band.quad(p0,p1,p2,p3,[0,0,1,1],col);});});}});
 scene.add(band.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.2,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1})));
 // парковка
 park = canvasTex(512,256,(g,w,h)=>{g.fillStyle='#6f757a';g.fillRect(0,0,w,h);const r=mulberry(3);for(let i=0;i<900;i++){g.fillStyle=`rgba(${r()<.5?0:255},${r()<.5?0:255},${r()<.5?0:255},.04)`;g.fillRect(r()*w,r()*h,2,2);}g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=4;for(let x=10;x<w;x+=36){g.beginPath();g.moveTo(x,20);g.lineTo(x,110);g.moveTo(x,146);g.lineTo(x,236);g.stroke();}});
 park.wrapS=park.wrapT=THREE.RepeatWrapping;park.repeat.set(12,3);
 e3 = D.ents.find(e=>e.n===3)||D.ents[0];
 lot = new THREE.Mesh(new THREE.PlaneGeometry(320,70),new THREE.MeshStandardMaterial({map:park,roughness:.9}));lot.rotation.x=-Math.PI/2;lot.rotation.z=-Math.atan2(e3.d[0],-e3.d[1]);
 lot.position.set(e3.p[0]+e3.d[0]*48,-0.02,e3.p[1]+e3.d[1]*48);scene.add(lot);

 buildAtlases();

 // ---- магазины: витрины, двери, интерьер за стеклом — одинаково для обоих этажей
 // туалеты: у их дверей и проёмов входов в магазины быть не должно (значки туалетов — из карты)
 WC_R = 7; nearWC = (f,x,z)=>((f===1?D.wc:D2&&D2.wc)||[]).some(w=>Math.hypot(w[0]-x,w[1]-z)<WC_R);
 doors = [];world.doors=doors;world.tint={};world.tintColors={};
 wood = canvasTex(256,256,(g,w,h)=>{const r=mulberry(9);g.fillStyle='#cdb190';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=32){g.fillStyle=`rgba(90,60,30,${.05+r()*.06})`;g.fillRect(0,y,w,32);g.fillStyle='rgba(80,50,20,.25)';g.fillRect(0,y,w,1);for(let i=0;i<14;i++){g.fillStyle=`rgba(120,80,40,${r()*.08})`;g.fillRect(0,y+r()*32,w,1);}}});
 wood.wrapS=wood.wrapT=THREE.RepeatWrapping;
}
