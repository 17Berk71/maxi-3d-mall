// Кадки с деревьями, лавочки, столики фуд-корта.
import * as THREE from 'three';
import {mulberry} from '../../core/utils.js';
import {LIN, V3} from '../../core/helpers.js';
import {S} from '../stores.js';
import {FY, G, MAT, mtx, world} from '../world.js';
import {CELL, GH, GRIDS, GW, blockRect, clearance, fromPx, hall2, isWalkF} from '../../nav/walkgrid.js';
import {DEC, scene} from '../../render/scene.js';
import {B, Cy, mergeG} from '../../shop/goods.js';

// по порядку, при запуске
export function init() {

 // ---- кадки с деревьями и скамейки (как на фото ТРЦ) и столики фуд-корта — там, где просторно
 {const lat=(pts,seg)=>new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg||24);
  const potG=lat([[0,0],[0.42,0],[0.5,0.55],[0.47,0.56],[0,0.5]],28),trunkG=Cy(0.05,0.07,1.3,0,1.1,0,8);
  const leafG=mergeG([[0,2.05,0,0.62],[0.34,1.8,0.1,0.42],[-0.3,1.85,-0.1,0.45],[0.1,2.4,-0.18,0.4],[-0.12,1.7,0.3,0.38]].map(([x,y,z,r])=>new THREE.IcosahedronGeometry(r,1).translate(x,y,z)));
  const seatG=mergeG([B(1.6,0.06,0.42,0,0.45,0),B(1.6,0.34,0.05,0,0.7,-0.2)]),legsG=mergeG([-0.65,0.65].map(x=>B(0.06,0.42,0.4,x,0.21,0)));
  const topG=Cy(0.45,0.45,0.035,0,0.74,0,28),stemG=mergeG([Cy(0.035,0.035,0.72,0,0.36,0,8),Cy(0.25,0.25,0.02,0,0.01,0,20)]);
  const chairG=mergeG([B(0.42,0.05,0.42,0,0.45,0),B(0.42,0.42,0.04,0,0.68,-0.19),...[[-0.18,-0.18],[0.18,-0.18],[-0.18,0.18],[0.18,0.18]].map(([x,z])=>Cy(0.015,0.015,0.45,x,0.22,z,6))]);
  const near=(f,x,z,R)=>world.doors.some(s=>s.door.floor===f&&Math.hypot(s.door.c.x-x,s.door.c.z-z)<R)||world.escs.some(E=>{const dx=x-E.p[0],dz=z-E.p[1];return Math.abs(dx*E.d.x+dz*E.d.z)<E.run/2+R&&Math.abs(dx*E.r.x+dz*E.r.z)<1.6+R;})||world.lifts.some(L=>Math.hypot(L.c.x-x,L.c.z-z)<R+1.5)||S.some(k=>k.kind==='kiosk'&&k.floor===f&&Math.hypot(k.p[0]-x,k.p[1]-z)<3);
  const freeDisk=(f,x,z,r)=>{for(let a=0;a<8;a++)for(const d of [0,r*0.5,r]){if(!isWalkF(f,x+Math.cos(a*0.785)*d,z+Math.sin(a*0.785)*d))return false;}return true;};
  [1,2].forEach(f=>{const y0=FY[f],grp=f===1?scene:G('f2'),rnd=mulberry(31+f),plants=[],tables=[],st=Math.round(2.5/CELL);
   // столики фуд-корта
   if(f===2)for(let j=0;j<GH;j+=Math.round(4.0/CELL))for(let i=0;i<GW;i+=Math.round(4.0/CELL)){if(!hall2[j*GW+i])continue;const [x,z]=fromPx(i,j);
    if(clearance(2,x,z,3)<2.6||!freeDisk(2,x,z,1.3)||near(2,x,z,3.5))continue;tables.push({x,z,a:rnd()*0.4});blockRect(x,z,0,0.95,0.95,2);}
   for(let j=0;j<GH;j+=st)for(let i=0;i<GW;i+=st){if(!GRIDS[f][j*GW+i])continue;const [x,z]=fromPx(i,j);
    if(f===2&&hall2[j*GW+i])continue;if(clearance(f,x,z,6)<2.8||!freeDisk(f,x,z,1.2))continue;if(plants.some(q=>Math.hypot(q.x-x,q.z-z)<(DEC?13:16)))continue;
    // ось коридора: направление, вдоль которого дальше всего свободно; группа «кадка + лавочка» ставится по центру коридора вдоль оси
    const run=(x0,z0,dx,dz,mx)=>{let t=0;for(;t<mx;t+=0.3){if(!isWalkF(f,x0+dx*t,z0+dz*t))break;}return t;};
    let bestA=0,bestL=-1;for(let k=0;k<36;k++){const a=k*Math.PI/36,dx=Math.cos(a),dz=Math.sin(a);const L=run(x,z,dx,dz,14)+run(x,z,-dx,-dz,14);if(L>bestL){bestL=L;bestA=a;}}
    const ax=Math.cos(bestA),az=Math.sin(bestA),px_=-az,pz_=ax;const wl=run(x,z,px_,pz_,12),wr=run(x,z,-px_,-pz_,12);
    if(wl+wr<6.2||bestL<8)continue;const sh=(wl-wr)/2,cx=x+px_*sh,cz=z+pz_*sh;
    // всё место под группой и по 2.4 м по бокам должно быть свободно
    let ok=true;for(let t=-1.9;t<=1.9&&ok;t+=0.3)for(const o of [-2.4,0,2.4]){if(!isWalkF(f,cx+ax*t+px_*o,cz+az*t+pz_*o)){ok=false;break;}}
    if(!ok||near(f,cx,cz,6)||plants.some(q=>Math.hypot(q.x-cx,q.z-cz)<(DEC?13:16)))continue;
    plants.push({x:cx-ax*1.25,z:cz-az*1.25,a:bestA,bx:cx+ax*0.35,bz:cz+az*0.35});}
   plants.forEach(p=>{blockRect(p.x,p.z,0,0.6,0.6,f);blockRect(p.bx,p.bz,p.a,0.85,0.35,f);});
   const N=Math.max(1,plants.length),q=new THREE.Quaternion(),Y=new V3(0,1,0),one=new V3(1,1,1);
   const pot=new THREE.InstancedMesh(potG,new THREE.MeshStandardMaterial({color:LIN('#e9e6e0'),roughness:.4}),N),trunk=new THREE.InstancedMesh(trunkG,new THREE.MeshStandardMaterial({color:LIN('#6b5139'),roughness:.9}),N);
   const leaf=new THREE.InstancedMesh(leafG,new THREE.MeshStandardMaterial({color:LIN('#4f7a44'),roughness:.85,flatShading:true}),N);
   const seat=new THREE.InstancedMesh(seatG,new THREE.MeshStandardMaterial({color:LIN('#a47b52'),roughness:.6}),N),bl=new THREE.InstancedMesh(legsG,MAT.darkMetal,N);
   plants.forEach((p,i)=>{mtx.makeTranslation(p.x,y0,p.z);pot.setMatrixAt(i,mtx);trunk.setMatrixAt(i,mtx);q.setFromAxisAngle(Y,p.a);mtx.compose(new V3(p.x,y0,p.z),q,one);leaf.setMatrixAt(i,mtx);leaf.setColorAt(i,LIN(['#4f7a44','#5b8a4c','#44703f'][i%3]));
    q.setFromAxisAngle(Y,-p.a);mtx.compose(new V3(p.bx,y0,p.bz),q,one);seat.setMatrixAt(i,mtx);bl.setMatrixAt(i,mtx);});
   [pot,trunk,leaf,seat,bl].forEach(m=>{m.count=plants.length;if(m.instanceColor)m.instanceColor.needsUpdate=true;grp.add(m);});
   if(tables.length){const T=tables.length,top=new THREE.InstancedMesh(topG,MAT.white,T),stem=new THREE.InstancedMesh(stemG,MAT.darkMetal,T),ch=new THREE.InstancedMesh(chairG,new THREE.MeshStandardMaterial({color:LIN('#8a6a4a'),roughness:.6}),T*4);
    tables.forEach((t,i)=>{mtx.makeTranslation(t.x,y0,t.z);top.setMatrixAt(i,mtx);stem.setMatrixAt(i,mtx);for(let k=0;k<4;k++){const a=t.a+k*Math.PI/2;q.setFromAxisAngle(Y,a+Math.PI);mtx.compose(new V3(t.x+Math.sin(a)*0.72,y0,t.z+Math.cos(a)*0.72),q,one);ch.setMatrixAt(i*4+k,mtx);}});
    [top,stem,ch].forEach(m=>grp.add(m));}
   world['decor'+f]={plants:plants.length,tables:tables.length,list:plants.map(p=>({x:+p.x.toFixed(2),z:+p.z.toFixed(2),a:+p.a.toFixed(3),bx:+p.bx.toFixed(2),bz:+p.bz.toFixed(2)}))};});}
}
