// Светильники-кольца под перекрытием и под крышей.
import * as THREE from 'three';
import {FLOOR_H, FY, G, MAT, ROOF_Y, mtx} from '../world.js';
import {CELL, GH, GW, fromPx, inVoid, isWalkPx, walk2} from '../../nav/walkgrid.js';
import {canvasTex} from '../../render/canvas.js';

// по порядку, при запуске
export function init() {

 // светильники-кольца: под перекрытием первого этажа, под крышей второго и большие — в атриумах
 {const ringsLow=[],ringsHigh=[];const st=Math.round(6.5/CELL);
  for(let j=2;j<GH;j+=st)for(let i=2;i<GW;i+=st){if(!isWalkPx(i,j))continue;const [x,z]=fromPx(i,j);if(inVoid(x,z)){if(((i+j)/st)%2===0)ringsHigh.push([x,z]);}else ringsLow.push([x,z]);}
  const rg1=new THREE.TorusGeometry(0.9,0.05,4,28);rg1.rotateX(Math.PI/2);
  const r1=new THREE.InstancedMesh(rg1,MAT.light,Math.max(1,ringsLow.length));ringsLow.forEach((p,i)=>{mtx.makeTranslation(p[0],FLOOR_H-0.04,p[1]);r1.setMatrixAt(i,mtx);});G('slab').add(r1);
  // светильники второго этажа — над его собственной галереей
  const rings2=[];for(let j=2;j<GH;j+=st)for(let i=2;i<GW;i+=st){if(walk2[j*GW+i])rings2.push(fromPx(i,j));}
  const r3=new THREE.InstancedMesh(rg1,MAT.light,Math.max(1,rings2.length));rings2.forEach((p,i)=>{mtx.makeTranslation(p[0],ROOF_Y-0.04,p[1]);r3.setMatrixAt(i,mtx);});G('roof').add(r3);
  const rg2=new THREE.TorusGeometry(2.2,0.1,6,56);rg2.rotateX(Math.PI/2);const r2=new THREE.InstancedMesh(rg2,MAT.light,Math.max(1,ringsHigh.length));ringsHigh.forEach((p,i)=>{mtx.makeTranslation(p[0],ROOF_Y-0.8,p[1]);r2.setMatrixAt(i,mtx);});G('roof').add(r2);
  // пятна света на полу под кольцами
  const spot=canvasTex(64,64,(g,w,h)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,250,235,.22)');gr.addColorStop(1,'rgba(255,250,235,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
  const sg=new THREE.PlaneGeometry(4.5,4.5);sg.rotateX(-Math.PI/2);const spm=new THREE.MeshBasicMaterial({map:spot,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const sm=new THREE.InstancedMesh(sg,spm,Math.max(1,ringsLow.length));ringsLow.forEach((p,i)=>{mtx.makeTranslation(p[0],0.03,p[1]);sm.setMatrixAt(i,mtx);});G('spots').add(sm);
  const sm2=new THREE.InstancedMesh(sg,spm,Math.max(1,rings2.length));rings2.forEach((p,i)=>{mtx.makeTranslation(p[0],FY[2]+0.03,p[1]);sm2.setMatrixAt(i,mtx);});G('spots').add(sm2);}
}
