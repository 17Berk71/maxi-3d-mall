// Ограждение проёмов: стекло, стойки, поручень, светодиодная линия; проход к эскалаторам.
import * as THREE from 'three';
import {D2} from '../../app.js';
import {LIN, V3} from '../../core/helpers.js';
import {FLOOR_H, G, MAT, SLAB, mtx, world} from '../world.js';
import {voidPolys} from '../../nav/walkgrid.js';
import {Merger} from '../../render/merger.js';
let rail, hand, led, posts, escGap, inEscGap, cutSeg, gapEnds, railMat, railMesh;

// по порядку, при запуске
export function init() {

 // ограждение: стекло, стойки, поручень; светодиодная линия под кромкой
 rail = new Merger(); hand = new Merger(); led = new Merger();posts = [];
 // у верхних площадок эскалаторов ограждения нет — там проход на ленту
 escGap = D2.esc.map(e=>({x:e.top[0],z:e.top[1],dx:Math.cos(e.a),dz:Math.sin(e.a)}));
 inEscGap = (x,z)=>escGap.some(g=>{const px=x-g.x,pz=z-g.z,s=px*g.dx+pz*g.dz,l=-px*g.dz+pz*g.dx;return s>-4&&s<1.3&&Math.abs(l)<1.62;});
 cutSeg = (A,B)=>{const L=A.distanceTo(B),n=Math.max(1,Math.ceil(L/0.05)),out=[];let st=null;
  for(let k=0;k<=n;k++){const t=k/n,x=A.x+(B.x-A.x)*t,z=A.z+(B.z-A.z)*t,ins=inEscGap(x,z);if(!ins&&st===null)st=t;if((ins||k===n)&&st!==null){const te=ins?(k-1)/n:t;if(te-st>1e-3)out.push([A.clone().lerp(B,st),A.clone().lerp(B,te),st>0,ins]);st=null;}}
  return out;};
 gapEnds = [];
 voidPolys.forEach(v=>{let acc=0;for(let i=0;i<v.length;i++){const a=v[i],b=v[(i+1)%v.length];const A0=new V3(a[0],0,a[1]),B0=new V3(b[0],0,b[1]);if(A0.distanceTo(B0)<0.05)continue;
  for(const [A,B,cutA,cutB] of cutSeg(A0,B0)){const L=A.distanceTo(B);if(L<0.05)continue;if(cutA)gapEnds.push(A.clone());if(cutB)gapEnds.push(B.clone());
  const y0=FLOOR_H+SLAB,y1=y0+1.05;rail.quad(new V3(A.x,y0+0.05,A.z),new V3(B.x,y0+0.05,B.z),new V3(B.x,y1,B.z),new V3(A.x,y1,A.z),[0,0,1,1]);
  const ry=-Math.atan2(B.z-A.z,B.x-A.x);
  const m1=new THREE.Matrix4().makeRotationY(ry);m1.setPosition((A.x+B.x)/2,y1+0.03,(A.z+B.z)/2);hand.add(new THREE.CylinderGeometry(0.035,0.035,L,8).rotateZ(Math.PI/2),null,null,m1);
  const m2=new THREE.Matrix4().makeRotationY(ry);m2.setPosition((A.x+B.x)/2,FLOOR_H+0.25,(A.z+B.z)/2);hand.add(new THREE.BoxGeometry(L,0.52,0.06),null,null,m2);
  const m3=new THREE.Matrix4().makeRotationY(ry);m3.setPosition((A.x+B.x)/2,FLOOR_H-0.02,(A.z+B.z)/2);led.add(new THREE.BoxGeometry(L,0.04,0.1),null,null,m3);
  let d=(1.6-acc%1.6);while(d<L){posts.push(A.clone().lerp(B,d/L));d+=1.6;}acc+=L;}}});
 gapEnds.forEach(p=>posts.push(p));
 railMat = new THREE.MeshStandardMaterial({color:LIN('#cfe3ea'),transparent:true,opacity:.22,roughness:.04,metalness:.6,depthWrite:false,side:THREE.DoubleSide});world.railMat=railMat;railMesh = rail.mesh(railMat);railMesh.renderOrder=2;G('slab').add(railMesh);
 G('slab').add(hand.mesh(MAT.metal));G('slab').add(led.mesh(MAT.light));
 {const pg=new THREE.CylinderGeometry(0.025,0.025,1.05,6);pg.translate(0,FLOOR_H+SLAB+0.52,0);const pi=new THREE.InstancedMesh(pg,MAT.metal,Math.max(1,posts.length));posts.forEach((p,i)=>{mtx.makeTranslation(p.x,0,p.z);pi.setMatrixAt(i,mtx);});G('slab').add(pi);}
}
