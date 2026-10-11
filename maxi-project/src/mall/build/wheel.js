// Колесо обозрения и метка «Перейти сюда».
import * as THREE from 'three';
import {LIN} from '../../core/helpers.js';
import {sprite} from '../sprite.js';
import {world} from '../world.js';
import {scene} from '../../render/scene.js';
import {e3} from './floor.js';
let wheel, wM, R, cab, cc, WX, WZ, WR, wg, wsp, tm, pm, cone, dot;

// по порядку, при запуске
export function init() {

 // ---- колесо обозрения
 wheel = new THREE.Group();wM = new THREE.MeshStandardMaterial({color:LIN('#f2f2f2'),roughness:.35,metalness:.4});
 R = 25;wheel.add(new THREE.Mesh(new THREE.TorusGeometry(R,.45,8,96),wM));wheel.add(new THREE.Mesh(new THREE.TorusGeometry(R-2,.25,6,96),wM));
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2;const sp=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,R,6),wM);sp.position.set(Math.cos(a)*R/2,Math.sin(a)*R/2,0);sp.rotation.z=a-Math.PI/2;wheel.add(sp);}
 cab = [];cc = ['#e85d5d','#3fa7d6','#f2b33d','#59b36b'];
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2;const c=new THREE.Mesh(new THREE.BoxGeometry(2.2,2.4,2.2),new THREE.MeshStandardMaterial({color:LIN(cc[i%4]),roughness:.4}));c.position.set(Math.cos(a)*R,Math.sin(a)*R-1.3,0);wheel.add(c);cab.push(c);}
 WX = e3.p[0]+e3.d[0]*70-e3.d[1]*40; WZ = e3.p[1]+e3.d[1]*70+e3.d[0]*40; WR = Math.atan2(e3.d[0],e3.d[1])+Math.PI/2;
 wg = new THREE.Group();wg.position.set(WX,30,WZ);wg.rotation.y=WR;wg.add(wheel);scene.add(wg);
 [-1,1].forEach(sg=>{const leg=new THREE.Mesh(new THREE.CylinderGeometry(.5,.8,32,8),wM);leg.position.set(WX+sg*9*Math.cos(WR),15,WZ-sg*9*Math.sin(WR));leg.rotation.y=WR;leg.rotateZ(sg*0.3);scene.add(leg);});
 wsp = sprite('Колесо обозрения · 55 м','#0e7490');wsp.position.set(WX,60,WZ);wsp.scale.set(18,4,1);scene.add(wsp);
 world.wheel=wheel;world.cabins=cab;

 tm = new THREE.Mesh(new THREE.OctahedronGeometry(0.6),new THREE.MeshBasicMaterial({color:LIN('#0e7490')}));tm.visible=false;scene.add(tm);world.target=tm;
 pm = new THREE.Group();cone = new THREE.Mesh(new THREE.ConeGeometry(3,7,3),new THREE.MeshBasicMaterial({color:LIN('#e11d48')}));cone.rotation.x=-Math.PI/2;cone.position.z=-1;pm.add(cone);
 dot = new THREE.Mesh(new THREE.CircleGeometry(4.5,32),new THREE.MeshBasicMaterial({color:LIN('#e11d48'),transparent:true,opacity:.25}));dot.rotation.x=-Math.PI/2;dot.position.y=-0.5;pm.add(dot);
 pm.visible=false;scene.add(pm);world.pmark=pm;

}
