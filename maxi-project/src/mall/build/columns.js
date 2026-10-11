// Колонны: только там, где просторно.
import * as THREE from 'three';
import {D} from '../../app.js';
import {LIN} from '../../core/helpers.js';
import {G, MAT, ROOF_Y, mtx, world} from '../world.js';
import {blockRect, keepColumn} from '../../nav/walkgrid.js';

// по порядку, при запуске
export function init() {

 // колонны — только в атриумах, на перекрёстках и у эскалаторов; проходят через оба этажа
 {const colG=new THREE.CylinderGeometry(0.42,0.42,ROOF_Y,24);colG.translate(0,ROOF_Y/2,0);const baseG=new THREE.CylinderGeometry(0.55,0.55,0.12,24);baseG.translate(0,0.06,0);
  const colMat=new THREE.MeshStandardMaterial({color:LIN('#fafaf8'),roughness:.25,envMapIntensity:.7});world.colMat=colMat;const cols=new THREE.InstancedMesh(colG,colMat,Math.max(1,D.cols.length));
  const bases=new THREE.InstancedMesh(baseG,MAT.metal,Math.max(1,D.cols.length));
  const keep=D.cols.filter(keepColumn);world.colsKept=keep.length;world.colsDropped=D.cols.length-keep.length;
  keep.forEach((p,i)=>{mtx.makeTranslation(p[0],0,p[1]);cols.setMatrixAt(i,mtx);bases.setMatrixAt(i,mtx);blockRect(p[0],p[1],0,0.55,0.55,1);blockRect(p[0],p[1],0,0.55,0.55,2);});
  cols.count=bases.count=keep.length;G('roof').add(cols);G('roof').add(bases);}
}
