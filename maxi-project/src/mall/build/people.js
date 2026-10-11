// Посетители галереи (фигуры и маршруты).
import * as THREE from 'three';
import {mulberry} from '../../core/utils.js';
import {blockedF} from '../../controls/move.js';
import {LIN} from '../../core/helpers.js';
import {humanParts} from '../people-parts.js';
import {updatePeople} from '../people.js';
import {G, world} from '../world.js';
import {GH, GW, fromPx, isWalkF} from '../../nav/walkgrid.js';
import {coarse} from '../../render/scene.js';
import {blobTex} from '../../render/textures.js';

// по порядку, при запуске
export function init() {

 // ---- посетители: гуляют по галереям обоих этажей
 {const parts=humanParts();const NP=(coarse?48:110)*1;const r=mulberry(77);
  const cloth=['#2f3a4a','#6b7a8f','#7a3a3a','#3f5e4a','#c9b79c','#1f1f24','#8b6a4a','#4d4f7c','#d9d4cc','#5e3b4f','#9ea2a6','#e7e2d8'].map(LIN),pants=['#23262c','#3b4252','#5a5148','#2c3440','#6b6e73'].map(LIN),skin=['#e6c3a5','#d9b08c','#c6946b','#f0d2bb'].map(LIN);
  const torso=new THREE.InstancedMesh(parts.torso,new THREE.MeshStandardMaterial({roughness:.85}),NP),legs=new THREE.InstancedMesh(parts.legs,new THREE.MeshStandardMaterial({roughness:.8}),NP),arms=new THREE.InstancedMesh(parts.arms,new THREE.MeshStandardMaterial({roughness:.85}),NP),head=new THREE.InstancedMesh(parts.head,new THREE.MeshStandardMaterial({roughness:.6}),NP);
  const hair=new THREE.InstancedMesh(parts.hair,new THREE.MeshStandardMaterial({roughness:.7}),NP),shoes=new THREE.InstancedMesh(parts.shoes,new THREE.MeshStandardMaterial({roughness:.6}),NP);
  const hairC=['#2a1f18','#4a3426','#1b1b1b','#7a5a3a','#b89a6e','#5e5e5e'].map(LIN),shoeC=['#1e1f22','#f0eee8','#5a4636','#3b3e44'].map(LIN);
  const shG=new THREE.PlaneGeometry(0.9,0.9);shG.rotateX(-Math.PI/2);const sh=new THREE.InstancedMesh(shG,new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false}),NP);
  const people=[];
  for(let i=0;i<NP;i++){const f=i%3===2?2:1;let x=0,z=0,tries=0;do{const j=Math.floor(r()*GH),k=Math.floor(r()*GW);[x,z]=fromPx(k,j);tries++;}while((!isWalkF(f,x,z)||blockedF(f,x,z))&&tries<600);
   const c=cloth[Math.floor(r()*cloth.length)];torso.setColorAt(i,c);arms.setColorAt(i,c);legs.setColorAt(i,pants[Math.floor(r()*pants.length)]);head.setColorAt(i,skin[Math.floor(r()*skin.length)]);hair.setColorAt(i,hairC[Math.floor(r()*hairC.length)]);shoes.setColorAt(i,shoeC[Math.floor(r()*shoeC.length)]);
   const sc=0.92+r()*0.16;people.push({f,x,z,tx:x,tz:z,sp:(1.0+r()*0.5),sc,a:r()*6.28,wait:r()*4,ph:r()*6.28});}
  [torso,legs,arms,head,hair,shoes].forEach(m=>{if(m.instanceColor)m.instanceColor.needsUpdate=true;G('people').add(m);});G('people').add(sh);
  world.people={list:people,meshes:[torso,legs,arms,head,hair,shoes],sh,r};updatePeople(0,0);}
}
