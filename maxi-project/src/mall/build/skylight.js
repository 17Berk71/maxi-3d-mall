// Стеклянная крыша с фермами.
import * as THREE from 'three';
import {LIN} from '../../core/helpers.js';
import {G, MAT, ROOF_Y, mtx} from '../world.js';
import {inPoly, voidPolys} from '../../nav/walkgrid.js';
import {Merger, flatShape} from '../../render/merger.js';
let skyG, truss;

// по порядку, при запуске
export function init() {

 // стеклянная крыша с фермами
 skyG = new THREE.MeshStandardMaterial({color:LIN('#dbe8f2'),transparent:true,opacity:.35,roughness:.05,metalness:.5,side:THREE.DoubleSide,depthWrite:false});
 truss = new Merger();
 voidPolys.forEach(v=>{const m=new THREE.Mesh(flatShape(v,ROOF_Y+0.55),skyG);G('roof').add(m);
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;v.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[1]);z1=Math.max(z1,p[1]);});
  const along=(x1-x0)>(z1-z0);const step=3.2;
  if(along){for(let x=x0+step/2;x<x1;x+=step){let a=null,b=null;for(let z=z0;z<=z1;z+=0.5){if(inPoly(v,x,z)){if(a===null)a=z;b=z;}}if(a!==null&&b-a>1){mtx.makeTranslation(x,ROOF_Y+0.4,(a+b)/2);truss.add(new THREE.BoxGeometry(0.12,0.3,b-a),null,null,mtx);}}}
  else{for(let z=z0+step/2;z<z1;z+=step){let a=null,b=null;for(let x=x0;x<=x1;x+=0.5){if(inPoly(v,x,z)){if(a===null)a=x;b=x;}}if(a!==null&&b-a>1){mtx.makeTranslation((a+b)/2,ROOF_Y+0.4,z);truss.add(new THREE.BoxGeometry(b-a,0.3,0.12),null,null,mtx);}}}});
 G('roof').add(truss.mesh(MAT.white));
}
