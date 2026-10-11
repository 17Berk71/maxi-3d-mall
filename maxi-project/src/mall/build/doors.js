// Двери магазинов: раздвижные створки и проём в сетке проходимости.
import * as THREE from 'three';
import {FLOORS, G, MAT, pickables, updateDoors, world} from '../world.js';
import {setRect} from '../../nav/walkgrid.js';
import {doors} from './floor.js';

// по порядку, при запуске
export function init() {

 // двери: раздвижные створки, проём в сетке проходимости своего этажа
 {const lg=new THREE.BoxGeometry(1,2.62,0.04);lg.translate(0,1.33,0);const hG=new THREE.BoxGeometry(0.03,0.5,0.06);hG.translate(0,1.1,0.05);
  world.doorSets=[1,2].map(f=>{const list=doors.filter(s=>s.door.floor===f);const N=Math.max(1,list.length*2);
   const leaves=new THREE.InstancedMesh(lg,MAT.glass,N);leaves.renderOrder=2;const handles=new THREE.InstancedMesh(hG,MAT.metal,N);
   const ids=[];list.forEach(s=>{ids.push(s.id,s.id);});leaves.userData.kiosks=ids;pickables.push(leaves);G(FLOORS[f].group).add(leaves,handles);
   return{list,leaves,handles};});
  doors.forEach(s=>{const d=s.door;const c=d.c.clone().addScaledVector(d.n,-0.2);setRect(c.x,c.z,Math.atan2(d.R.z,d.R.x),d.w/2-0.12,0.75,1,d.floor);
   if(d.gap){const pc=d.c.clone().addScaledVector(d.n,d.gap/2+0.2);setRect(pc.x,pc.z,Math.atan2(d.R.z,d.R.x),d.w/2-0.12,d.gap/2+0.45,1,d.floor);}});
  updateDoors();}
 G('toplabels1').visible=false;G('toplabels2').visible=false;
}
