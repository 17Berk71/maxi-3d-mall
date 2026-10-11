// Перекрытие, пол второго этажа с проёмами, кровля над частями без второго этажа.
import * as THREE from 'three';
import {mulberry} from '../../core/utils.js';
import {D2} from '../../app.js';
import {LIN} from '../../core/helpers.js';
import {FLOOR_H, FY, G, ROOF_Y, SLAB, world} from '../world.js';
import {inPoly, voidPolys} from '../../nav/walkgrid.js';
import {canvasTex} from '../../render/canvas.js';
import {extrude, shapeOf} from '../../render/merger.js';
import {floorMats, floorMatsF} from '../../render/scene.js';
import {marble} from '../../render/textures.js';
import {bpoly} from './floor.js';
let slabMat, holesIn, roofMat;

// по порядку, при запуске
export function init() {

 // ---- перекрытие и галерея второго этажа
 slabMat = new THREE.MeshStandardMaterial({color:LIN('#fbfbfa'),roughness:.6});world.slabMat=slabMat;
 G('slab').add(new THREE.Mesh(extrude(shapeOf(bpoly,voidPolys),FLOOR_H,SLAB),slabMat));
 // кровля над частями без второго этажа
 {const rt=canvasTex(256,256,(g,w,h)=>{const r=mulberry(21);g.fillStyle='#9a9c9e';g.fillRect(0,0,w,h);for(let i=0;i<2500;i++){const v=120+Math.floor(r()*60);g.fillStyle=`rgba(${v},${v},${v},.35)`;g.fillRect(r()*w,r()*h,2,2);}});rt.wrapS=rt.wrapT=THREE.RepeatWrapping;
  const g=new THREE.ShapeGeometry(shapeOf(bpoly,voidPolys));g.rotateX(-Math.PI/2);g.translate(0,FY[2]+0.002,0);const P=g.attributes.position.array,U=new Float32Array(P.length/3*2);for(let i=0;i<P.length/3;i++){U[i*2]=P[i*3]/6;U[i*2+1]=P[i*3+2]/6;}g.setAttribute('uv',new THREE.BufferAttribute(U,2));
  G('slab').add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:rt,roughness:.95})));}
 holesIn = poly=>voidPolys.filter(v=>{let x=0,z=0;v.forEach(p=>{x+=p[0];z+=p[1];});return inPoly(poly,x/v.length,z/v.length);});
 // пол второго этажа: тот же мрамор, с проёмами — только там, где второй этаж есть
 D2.bld.forEach(bp=>{const g=new THREE.ShapeGeometry(shapeOf(bp,holesIn(bp)));g.rotateX(-Math.PI/2);g.translate(0,FY[2]+0.006,0);const P=g.attributes.position.array,U=new Float32Array(P.length/3*2);for(let i=0;i<P.length/3;i++){U[i*2]=P[i*3]/4.8;U[i*2+1]=P[i*3+2]/4.8;}g.setAttribute('uv',new THREE.BufferAttribute(U,2));
  const fm2=new THREE.MeshStandardMaterial({map:marble,roughness:.16,metalness:0,envMapIntensity:.55});floorMats.push(fm2);floorMatsF.push([fm2,2]);G('slab').add(new THREE.Mesh(g,fm2));});
 roofMat = new THREE.MeshStandardMaterial({color:LIN('#f3f3f1'),roughness:1});world.roofMat=roofMat;
 D2.bld.forEach(bp=>{G('roof').add(new THREE.Mesh(extrude(shapeOf(bp,holesIn(bp)),ROOF_Y,0.6),roofMat));});
}
