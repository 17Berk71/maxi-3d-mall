// Фасад, входы, наружные стены второго этажа.
import * as THREE from 'three';
import {D, D2} from '../../app.js';
import {V3} from '../../core/helpers.js';
import {sprite} from '../sprite.js';
import {FLOOR_H, FY, G, MAT, ROOF_Y} from '../world.js';
import {canvasTex} from '../../render/canvas.js';
import {Merger} from '../../render/merger.js';
import {scene} from '../../render/scene.js';
let wallM, entP, facadeOut;

// по порядку, при запуске
export function init() {

 // ---- фасад и входы
 wallM = new Merger();entP = D.ents.map(e=>new V3(e.p[0],0,e.p[1]));
 facadeOut = canvasTex(256,256,(g,w,h)=>{g.fillStyle='#d4d0c8';g.fillRect(0,0,w,h);g.strokeStyle='rgba(0,0,0,.12)';g.lineWidth=2;for(let x=0;x<=w;x+=64){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}for(let y=0;y<=h;y+=128){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}});
 facadeOut.wrapS=facadeOut.wrapT=THREE.RepeatWrapping;
 D.bld.forEach(bp=>{for(let i=0;i<bp.length;i++){const a=bp[i],b=bp[(i+1)%bp.length];const A=new V3(a[0],0,a[1]),B=new V3(b[0],0,b[1]);const L=A.distanceTo(B);
  const steps=Math.max(1,Math.ceil(L/2));for(let k=0;k<steps;k++){const P0=A.clone().lerp(B,k/steps),P1=A.clone().lerp(B,(k+1)/steps),mid=P0.clone().lerp(P1,.5);
   const y0=entP.some(e=>e.distanceTo(mid)<5.5)?4.2:0,yt=FY[2]+1.1;const u0=(P0.x+P0.z)/4,u1=(P1.x+P1.z)/4;wallM.quad(new V3(P0.x,y0,P0.z),new V3(P1.x,y0,P1.z),new V3(P1.x,yt,P1.z),new V3(P0.x,yt,P0.z),[u0,y0/4,u1,yt/4]);}}});
 // наружные стены второго этажа
 D2.bld.forEach(bp=>{for(let i=0;i<bp.length;i++){const a=bp[i],b=bp[(i+1)%bp.length];const A=new V3(a[0],0,a[1]),B=new V3(b[0],0,b[1]);const L=A.distanceTo(B);if(L<0.05)continue;
  const y0=FY[2],y1=ROOF_Y+0.6,u0=(A.x+A.z)/4,u1=(B.x+B.z)/4;wallM.quad(new V3(A.x,y0,A.z),new V3(B.x,y0,B.z),new V3(B.x,y1,B.z),new V3(A.x,y1,A.z),[u0,y0/4,u1,y1/4]);}});
 G('shell').add(wallM.mesh(new THREE.MeshStandardMaterial({map:facadeOut,roughness:.8,side:THREE.DoubleSide})));
 D.ents.forEach(e=>{const d=new V3(e.d[0],0,e.d[1]).normalize(),p=new V3(e.p[0],0,e.p[1]).addScaledVector(d,0.4);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(9,4.2),MAT.glass);m.position.set(p.x,2.1,p.z);m.rotation.y=Math.atan2(d.x,d.z);scene.add(m);
  const fr=new THREE.Mesh(new THREE.BoxGeometry(9.4,0.3,0.3),MAT.darkMetal);fr.position.set(p.x,4.2,p.z);fr.rotation.y=m.rotation.y;scene.add(fr);
  [-1,1].forEach(sg=>{const R=new V3(d.z,0,-d.x);const pp=p.clone().addScaledVector(R,sg*4.6);const f2=new THREE.Mesh(new THREE.BoxGeometry(0.2,4.2,0.2),MAT.darkMetal);f2.position.set(pp.x,2.1,pp.z);scene.add(f2);});
  const sp=sprite('Вход '+e.n,'#0e7490');sp.position.set(p.x-d.x*1.5,4.9,p.z-d.z*1.5);sp.scale.set(4.4,1.1,1);scene.add(sp);
  const sp2=sprite('Вход '+e.n,'#0e7490');sp2.position.set(p.x+d.x*4,FLOOR_H+3,p.z+d.z*4);sp2.scale.set(14,3.2,1);G('toponly1').add(sp2);});
}
