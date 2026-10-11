// Мир галереи: группы сцены, высоты этажей, материалы, двери (анимация), цвета стендов и брендов.
import * as THREE from 'three';
import {LIN, V3} from '../core/helpers.js';
import {scene} from '../render/scene.js';
export let world, G, pickables, FLOOR_H, SLAB, ROOF_Y, GLASS_H, FY, FLOORS, mtx, MAT;
let UP_H, _dq, _ds, _dp, _dY;

export function rayDist(P,ox,oz,dx,dz){let best=1e9;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];const ex=b[0]-a[0],ez=b[1]-a[1];const den=dx*ez-dz*ex;if(Math.abs(den)<1e-9)continue;
 const t=((a[0]-ox)*ez-(a[1]-oz)*ex)/den,u=((a[0]-ox)*dz-(a[1]-oz)*dx)/den;if(t>0.05&&u>=-1e-6&&u<=1+1e-6&&t<best)best=t;}return best;}
export function updateDoors(){if(!world.doorSets)return;
 world.doorSets.forEach(({list,leaves:L,handles:H})=>{list.forEach((s,i)=>{const d=s.door,half=d.w/2,o=d.open;
  [-1,1].forEach((sg,k)=>{const off=sg*(half/2+o*half*0.92);_dp.copy(d.c).addScaledVector(d.R,off).addScaledVector(d.n,0.06);
   _dq.setFromAxisAngle(_dY,Math.atan2(d.n.x,d.n.z));_ds.set(half,1,1);mtx.compose(_dp,_dq,_ds);L.setMatrixAt(i*2+k,mtx);
   _dp.copy(d.c).addScaledVector(d.R,sg*(0.12+o*half*0.92)).addScaledVector(d.n,0.06);_ds.set(1,1,1);mtx.compose(_dp,_dq,_ds);H.setMatrixAt(i*2+k,mtx);});});
  L.count=H.count=list.length*2;L.instanceMatrix.needsUpdate=true;H.instanceMatrix.needsUpdate=true;});}
export function kioskBody(s){return LIN('#eceae6');}
// основной цвет бренда для фасада: фон вывески, а если он почти белый — цвет букв
export function brandCol(s){const st=s.sign;const c=LIN(st.bg);return c.r+c.g+c.b>2.4?LIN(st.fg):c;}
export function kioskGlow(s){const c=s.cat==='tbd'?LIN('#9aa3ab'):s.col;return c.clone().lerp(new THREE.Color(1,1,1),0.3).multiplyScalar(1.3);}

// по порядку, при запуске
export function init() {

/* ---------- Сцена ---------- */
world = {groups:{}};
G = name=>{if(!world.groups[name]){const g=new THREE.Group();scene.add(g);world.groups[name]=g;}return world.groups[name];};
pickables = [];
FLOOR_H = 8.6; SLAB = 0.6; UP_H = 5.6; ROOF_Y = FLOOR_H+SLAB+UP_H+0.3; GLASS_H = 5.0;
// уровень пола каждого этажа, высота витрин и потолка магазинов
FY = {1:0,2:FLOOR_H+SLAB};
FLOORS = {1:{f:1,y0:0,GH:GLASS_H,FH:FLOOR_H,group:'stores'},2:{f:2,y0:FLOOR_H+SLAB,GH:4.2,FH:ROOF_Y-(FLOOR_H+SLAB),group:'f2'}};
mtx = new THREE.Matrix4();
MAT = {
 glass:new THREE.MeshStandardMaterial({color:LIN('#dfeaee'),transparent:true,opacity:.16,roughness:.03,metalness:.9,envMapIntensity:1.4,depthWrite:false,side:THREE.DoubleSide}),
 metal:new THREE.MeshStandardMaterial({color:LIN('#b9bec2'),roughness:.28,metalness:.85}),
 darkMetal:new THREE.MeshStandardMaterial({color:LIN('#3b4046'),roughness:.4,metalness:.7}),
 white:new THREE.MeshStandardMaterial({color:LIN('#f7f7f5'),roughness:.45,metalness:0}),
 wall:new THREE.MeshStandardMaterial({color:LIN('#e7e3dc'),roughness:.8}),
 light:new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.58,1.5)}),
};

_dq = new THREE.Quaternion(); _ds = new V3(); _dp = new V3(); _dY = new V3(0,1,0);
}
