// Эскалаторы: ленты со ступенями, поручни, площадки.
import * as THREE from 'three';
import {D2} from '../../app.js';
import {LIN, V3} from '../../core/helpers.js';
import {sprite} from '../sprite.js';
import {FLOOR_H, FY, G, ROOF_Y, SLAB, pickables, world} from '../world.js';
import {blockRect, isFloorF} from '../../nav/walkgrid.js';
import {canvasTex} from '../../render/canvas.js';
import {scene} from '../../render/scene.js';
let stepCanvas, escSide, railM, escBand, combM;

// по порядку, при запуске
export function init() {

 // ---- эскалаторы: по карте второго этажа; правая лента едет вверх, левая — вниз, ступени движутся
 stepCanvas = canvasTex(256,64,(g,w,h)=>{g.fillStyle='#4a5056';g.fillRect(0,0,w,h);for(let x=0;x<w;x+=16){g.fillStyle='#8f969c';g.fillRect(x,0,11,h);g.fillStyle='rgba(0,0,0,.25)';for(let y=2;y<h;y+=4)g.fillRect(x,y,11,1);}g.fillStyle='#d9b53c';g.fillRect(0,0,w,4);g.fillRect(0,h-4,w,4);});
 escSide = new THREE.MeshStandardMaterial({color:LIN('#dcebf1'),transparent:true,opacity:.26,roughness:.04,metalness:.5,depthWrite:false,side:THREE.DoubleSide}); railM = new THREE.MeshStandardMaterial({color:LIN('#15181b'),roughness:.5});
 escBand = new THREE.MeshStandardMaterial({color:LIN('#b9bec3'),roughness:.3,metalness:.8}); combM = new THREE.MeshStandardMaterial({color:LIN('#9aa0a6'),roughness:.4,metalness:.8});
 world.escs=[];world.stepTex=[];
 D2.esc.forEach((e,ei)=>{const g=new THREE.Group();const run=9.8,rise=FLOOR_H+SLAB,ang=Math.atan2(rise,run),len=Math.hypot(run,rise);
  const d=new V3(Math.cos(e.a),0,Math.sin(e.a)),r=new V3(-Math.sin(e.a),0,Math.cos(e.a));
  [[0.72,1],[-0.72,-1]].forEach(([off,dir])=>{const t=stepCanvas.clone();t.needsUpdate=true;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(len/0.42,1);world.stepTex.push({t,dir});
   const b=new THREE.Mesh(new THREE.BoxGeometry(len,0.8,1.2),[escBand,escBand,new THREE.MeshStandardMaterial({map:t,roughness:.45,metalness:.6}),escBand,escBand,escBand]);b.position.set(0,rise/2,off);b.rotation.z=ang;b.userData.esc=ei;g.add(b);pickables.push(b);
   [-0.62,0.62].forEach(s=>{const side=new THREE.Mesh(new THREE.PlaneGeometry(len,1.0),escSide);side.position.set(0,rise/2+0.85,off+s);side.rotation.z=ang;g.add(side);
    const hr=new THREE.Mesh(new THREE.BoxGeometry(len,0.09,0.11),railM);hr.position.set(0,rise/2+1.38,off+s);hr.rotation.z=ang;g.add(hr);
    // поручень не торчит в проход: на площадках он уходит в горизонталь и кончается у гребёнки
    [[-run/2-0.35,1.38],[run/2+0.35,rise+1.38]].forEach(([x,y])=>{const h2=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.09,0.11),railM);h2.position.set(x,y,off+s);g.add(h2);});});
   // гребёнки на площадках
   [[-run/2-0.45,0.02],[run/2+0.45,rise+0.02]].forEach(([x,y])=>{const c=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.04,1.2),combM);c.position.set(x,y,off);g.add(c);});});
  g.position.set(e.p[0],0,e.p[1]);g.rotation.y=-e.a;scene.add(g);
  // под лентой можно пройти там, где до её низа не меньше 2.2 м; закрыта только низкая часть у нижней площадки
  const lowL=Math.min(run,(2.2+0.45)*run/rise),lc=-run/2-0.4+(lowL+0.4)/2,lh=(lowL+0.4)/2;
  blockRect(e.p[0]+Math.cos(e.a)*lc,e.p[1]+Math.sin(e.a)*lc,e.a,lh,1.55,1);
  // узкую щель между эскалатором и стеной закрываем ограждением — чтобы не протискиваться
  {const dd=[Math.cos(e.a),Math.sin(e.a)],rr_=[-Math.sin(e.a),Math.cos(e.a)];[-1,1].forEach(sg=>{let gap=9;
    for(let t=-run/2;t<=-run/2+lowL;t+=0.7){let g_=0;for(let w=0.1;w<3;w+=0.15){const x=e.p[0]+dd[0]*t+rr_[0]*sg*(1.55+w),z=e.p[1]+dd[1]*t+rr_[1]*sg*(1.55+w);if(!isFloorF(1,x,z))break;g_=w;}gap=Math.min(gap,g_);}
    if(gap<2.0){const off=1.55+gap/2+0.1;blockRect(e.p[0]+dd[0]*lc+rr_[0]*sg*off,e.p[1]+dd[1]*lc+rr_[1]*sg*off,e.a,lh,gap/2+0.25,1);
     const gl=new THREE.Mesh(new THREE.BoxGeometry(lowL+0.4,1.05,0.04),escSide);gl.position.set(e.p[0]+dd[0]*lc+rr_[0]*sg*(1.55+0.05),0.53,e.p[1]+dd[1]*lc+rr_[1]*sg*(1.55+0.05));gl.rotation.y=-e.a;scene.add(gl);}});}
  const top=new V3(e.top[0],FY[2],e.top[1]),bot=new V3(e.bot[0],0,e.bot[1]);
  world.escs.push({i:ei,p:e.p,a:e.a,d,r,top,bot,run,rise,ang});
  // указатели у площадок
  const up=sprite('Эскалатор ↑ 2 этаж','#475569');up.position.copy(bot).addScaledVector(d,-1.2).addScaledVector(r,0.72);up.position.y=2.9;up.scale.set(3.2,0.7,1);scene.add(up);
  const dn=sprite('Эскалатор ↓ 1 этаж','#475569');dn.position.copy(top).addScaledVector(d,1.2).addScaledVector(r,-0.72);dn.position.y=FY[2]+2.9;dn.scale.set(3.2,0.7,1);G('f2').add(dn);
  const sp=sprite('Эскалатор','#6b7785');sp.position.set(e.p[0],FLOOR_H+3,e.p[1]);sp.scale.set(9,2,1);G('toponly1').add(sp);
  const sp3=sprite('Эскалатор','#6b7785');sp3.position.set(e.p[0],ROOF_Y+3,e.p[1]);sp3.scale.set(9,2,1);G('toponly2').add(sp3);});
}
