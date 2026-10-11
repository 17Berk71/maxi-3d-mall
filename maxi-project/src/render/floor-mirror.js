// Отражение пола без второго прохода рендера (зеркальная копия первого этажа).
import * as THREE from 'three';
import {bb} from '../controls/view.js';
import {LIN} from '../core/helpers.js';
import {world} from '../mall/world.js';
import {FX, scene} from './scene.js';
import {app} from '../core/state.js';

// Поддельное отражение пола 1 этажа: зеркальная копия витрин, перекрытия и светильников под полом (те же
// геометрия и материалы, без второго прохода рендера), пол становится чуть прозрачным. Под копией — подложка
// цвета пола, чтобы сквозь пол не было видно неба. Включает fx.js, когда живого отражения нет (телефон, «Быстрее»).
export function buildFloorMirror(){const grp=new THREE.Group();grp.scale.y=-1;grp.visible=false;let n=0;
 ['stores','slab','roof'].forEach(name=>{const src=world.groups[name];if(!src)return;src.updateMatrixWorld(true);src.traverse(o=>{if(!o.isMesh||!o.visible||o.material.visible===false)return;let p=o.parent;while(p){if(!p.visible)return;p=p.parent;}
  let m;if(o.isInstancedMesh){m=new THREE.InstancedMesh(o.geometry,o.material,o.count);m.instanceMatrix=o.instanceMatrix;if(o.instanceColor)m.instanceColor=o.instanceColor;}else m=new THREE.Mesh(o.geometry,o.material);
  m.matrixAutoUpdate=false;m.matrix.copy(o.matrixWorld);m.renderOrder=-5;grp.add(m);n++;});});
 const base=new THREE.Mesh(new THREE.PlaneGeometry(bb.x1-bb.x0+200,bb.z1-bb.z0+200),new THREE.MeshBasicMaterial({color:LIN('#cdbfa8'),fog:true}));base.rotation.x=Math.PI/2;base.position.set((bb.x0+bb.x1)/2,12,(bb.z0+bb.z1)/2);base.renderOrder=-6;grp.add(base);
 scene.add(grp);world.mirror=grp;world.mirrorN=n;
 // в снимок окружения для блеска пола не попадают люди, сама зеркальная копия и подписи вида сверху — так дешевле
 FX.set({onMirror:on=>{world.mirrorOn=on;},mirrorGate:()=>app.curFloor===1&&app.mode==='walk',probeHide:[world.groups.people,grp,world.groups.spots,world.groups.toplabels1,world.groups.toplabels2]});}
