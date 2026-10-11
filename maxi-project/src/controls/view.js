// Вид сверху: вписать здание, какой этаж показывать, переключение режима.
import * as THREE from 'three';
import {D} from '../app.js';
import {clampH, releaseLock, updateCross} from './input.js';
import {updateJoy} from './move.js';
import {topv} from './player.js';
import {$} from '../core/helpers.js';
import {FLOOR_H, G, ROOF_Y, world} from '../mall/world.js';
import {cam, scene} from '../render/scene.js';
import {openCard} from '../ui/card.js';
import {hideGoHere} from '../ui/go-here.js';
import {app} from '../core/state.js';
export let bb;

function fitTop(){const t=Math.tan(THREE.MathUtils.degToRad(cam.fov/2));const hw=(bb.x1-bb.x0)/2/(t*cam.aspect),hz=(bb.z1-bb.z0)/2/t;topv.x=(bb.x0+bb.x1)/2;topv.z=(bb.z0+bb.z1)/2;topv.h=Math.min(1100,Math.max(hw,hz)*1.06);}
// вид сверху показывает один этаж: для первого снимаем перекрытие, для второго — крышу
export function setVis(){const top=app.mode==='top',f=app.curFloor;
 G('shell').visible=!top;G('roof').visible=!top;G('spots').visible=!top;G('slab').visible=!top||f===2;G('f2').visible=!top||f===2;
 G('toplabels1').visible=top&&f===1;G('toplabels2').visible=top&&f===2;G('toponly1').visible=top&&f===1;G('toponly2').visible=top&&f===2;
 world.pmark.visible=top;
 scene.fog.near=top?3000:app.FOGW[0];scene.fog.far=top?5000:app.FOGW[1];}
export function topY(){return app.curFloor===1?FLOOR_H:ROOF_Y;}
export function setMode(m,opts){
 if(m===app.mode&&!opts)return;const from={p:cam.position.clone(),q:cam.quaternion.clone()};
 app.mode=m;$('bWalk').classList.toggle('on',m==='walk');$('bTop').classList.toggle('on',m==='top');
 if(m==='top'){if(!opts||!opts.keep)fitTop();topv.h=clampH(topv.h);setVis();}else hideGoHere();
 app.anim={t:app.calm?1:0,from,m};updateJoy();if(m==='top')releaseLock();updateCross();if(app.target)openCard(app.target);
}

// по порядку, при запуске
export function init() {

bb = (()=>{let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;D.bld.forEach(p=>p.forEach(q=>{x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}));return{x0,x1,z0,z1};})();
}
