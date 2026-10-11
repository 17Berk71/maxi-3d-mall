// Лифты: шахта, кабина, двери на обоих этажах.
import * as THREE from 'three';
import {LIFTS_PLAN} from '../lifts-plan.js';
import {LIN, V3} from '../../core/helpers.js';
import {sprite} from '../sprite.js';
import {FLOOR_H, FY, G, MAT, ROOF_Y, pickables, world} from '../world.js';
import {blockRect, isFloorF, isWalkF} from '../../nav/walkgrid.js';
import {scene} from '../../render/scene.js';

// по порядку, при запуске
export function init() {

 // ---- лифты: по официальной схеме ТРЦ, у стены, дверью в галерею на обоих этажах
 world.lifts=[];
 {const shaftM=new THREE.MeshStandardMaterial({color:LIN('#d7e8ee'),transparent:true,opacity:.28,roughness:.04,metalness:.6,depthWrite:false,side:THREE.DoubleSide});
  const cabM=new THREE.MeshStandardMaterial({color:LIN('#c9ced3'),roughness:.3,metalness:.8});const cabFloor=new THREE.MeshStandardMaterial({color:LIN('#3a3f45'),roughness:.6});
  const HL=1.3;// половина стороны шахты
  const okCell=(x,z)=>isFloorF(1,x,z)&&isFloorF(2,x,z)&&isWalkF(1,x,z)&&isWalkF(2,x,z);
  function fits(cx,cz,a){const ca=Math.cos(a),sa=Math.sin(a);const n=[sa,ca],R=[ca,-sa];
   for(let u=-HL;u<=HL;u+=0.3)for(let v=-HL;v<=HL+2.6;v+=0.3){const x=cx+R[0]*u+n[0]*v,z=cz+R[1]*u+n[1]*v;if(!okCell(x,z))return -1;}
   // по бокам — стена вплотную или свободно не меньше 2,1 м: без узких щелей
   for(const sg of [-1,1])for(let v=-HL;v<=HL;v+=0.4)for(const f of [1,2]){let open=null;for(let w=0.3;w<=2.4;w+=0.3){const x=cx+R[0]*sg*(HL+w)+n[0]*v,z=cz+R[1]*sg*(HL+w)+n[1]*v;
    const fl=isFloorF(f,x,z);if(open===null){open=fl;if(!fl)break;}else if(!fl||!isWalkF(f,x,z))return -1;if(fl&&!isWalkF(f,x,z))return -1;}}
   let wall=0;for(let u=-HL;u<=HL;u+=0.3){const x=cx-n[0]*(HL+0.5)+R[0]*u,z=cz-n[1]*(HL+0.5)+R[1]*u;if(!isFloorF(2,x,z))wall++;}return wall;}
  LIFTS_PLAN.forEach((lp,li)=>{let best=null;
   for(let a=0;a<Math.PI*2-0.01;a+=Math.PI/12)for(let dx=-16;dx<=16;dx+=0.8)for(let dz=-16;dz<=16;dz+=0.8){const d=Math.hypot(dx,dz);if(d>16)continue;const cx=lp[0]+dx,cz=lp[1]+dz;const w=fits(cx,cz,a);if(w<0)continue;
    const sc=w*1.5-d*0.35;if(!best||sc>best.sc)best={cx,cz,a,sc};}
   if(!best)return;const {cx,cz,a}=best;const n=new V3(Math.sin(a),0,Math.cos(a)),R=new V3(Math.cos(a),0,-Math.sin(a));
   const g=new THREE.Group();g.position.set(cx,0,cz);g.rotation.y=a;scene.add(g);
   // шахта: угловые стойки, стекло с трёх сторон, над дверями — стекло
   [[-HL,-HL],[HL,-HL],[-HL,HL],[HL,HL]].forEach(([x,z])=>{const p=new THREE.Mesh(new THREE.BoxGeometry(0.14,ROOF_Y,0.14),MAT.white);p.position.set(x,ROOF_Y/2,z);g.add(p);});
   const wallG=new THREE.PlaneGeometry(HL*2,ROOF_Y);
   [[0,-HL,0],[-HL,0,Math.PI/2],[HL,0,Math.PI/2]].forEach(([x,z,r])=>{const m=new THREE.Mesh(wallG,shaftM);m.position.set(x,ROOF_Y/2,z);m.rotation.y=r;m.renderOrder=2;m.userData.lift=li;g.add(m);pickables.push(m);});
   [1,2].forEach(f=>{const y0=FY[f],top=f===1?FLOOR_H:ROOF_Y;const m=new THREE.Mesh(new THREE.PlaneGeometry(HL*2,top-y0-2.4),shaftM);m.position.set(0,y0+2.4+(top-y0-2.4)/2,HL);m.renderOrder=2;g.add(m);
    const fr=new THREE.Mesh(new THREE.BoxGeometry(HL*2+0.1,0.14,0.16),MAT.darkMetal);fr.position.set(0,y0+2.4,HL);g.add(fr);
    const sp=sprite('Лифт · '+f+' этаж','#0e7490');sp.position.set(cx+n.x*(HL+0.05),y0+3.05,cz+n.z*(HL+0.05));sp.scale.set(2.6,0.57,1);scene.add(sp);
    const tsp=sprite('Лифт','#0e7490');tsp.position.set(cx,(f===1?FLOOR_H:ROOF_Y)+4,cz);tsp.scale.set(8,1.8,1);G('toponly'+f).add(tsp);});
   // кабина
   const cab=new THREE.Group();const cf=new THREE.Mesh(new THREE.BoxGeometry(HL*2-0.2,0.12,HL*2-0.2),cabFloor);cf.position.y=0.06;cab.add(cf);
   const cc=new THREE.Mesh(new THREE.BoxGeometry(HL*2-0.2,0.1,HL*2-0.2),cabM);cc.position.y=2.45;cab.add(cc);
   const cl=new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.2),MAT.light);cl.rotation.x=Math.PI/2;cl.position.y=2.39;cab.add(cl);
   const cb=new THREE.Mesh(new THREE.BoxGeometry(HL*2-0.2,2.4,0.05),cabM);cb.position.set(0,1.25,-HL+0.12);cab.add(cb);
   const hr=new THREE.Mesh(new THREE.BoxGeometry(HL*2-0.4,0.05,0.06),MAT.metal);hr.position.set(0,0.95,-HL+0.2);cab.add(hr);
   g.add(cab);
   // двери на каждом этаже
   const leafG=new THREE.BoxGeometry(HL-0.05,2.35,0.05);leafG.translate(0,1.175,0);const leafM=new THREE.MeshStandardMaterial({color:LIN('#aeb4ba'),roughness:.25,metalness:.9});
   const leaves={};[1,2].forEach(f=>{leaves[f]=[-1,1].map(sg=>{const l=new THREE.Mesh(leafG,leafM);l.position.set(sg*(HL/2),FY[f],HL+0.04);g.add(l);return l;});});
   blockRect(cx,cz,a,HL+0.15,HL+0.15,1);blockRect(cx,cz,a,HL+0.15,HL+0.15,2);
   world.lifts.push({id:li,c:new V3(cx,0,cz),n,R,a,g,cab,leaves,open:{1:0,2:0},cabY:FY[1],at:1,HL});});}
}
