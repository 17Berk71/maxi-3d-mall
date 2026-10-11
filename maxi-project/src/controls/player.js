// Игрок и камера: положение, режим (прогулка, сверху, магазин), позы камеры, режим без анимации.
import * as THREE from 'three';
import {D} from '../app.js';
import {V3} from '../core/helpers.js';
import {FY} from '../mall/world.js';
import {cam} from '../render/scene.js';
import {app} from '../core/state.js';
export let player, topv, keys;
let eS, EYE, dummy;

function eyeY(){if(app.ride)return app.ride.y+EYE;return (app.mode==='store'?0:FY[app.curFloor])+EYE;}
export function walkPose(){return{p:new V3(player.x,eyeY(),player.z),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(player.pitch,player.yaw,0,'YXZ'))};}
export function topPose(){const p=new V3(topv.x,topv.h,topv.z+0.001);dummy.position.copy(p);dummy.up.set(0,0,-1);dummy.lookAt(topv.x,0,topv.z);return{p,q:dummy.quaternion.clone()};}
export function applyPose(o){cam.position.copy(o.p);cam.quaternion.copy(o.q);}

// по порядку, при запуске
export function init() {

/* ---------- Состояние и управление ---------- */
eS = D.ents.find(e=>e.n===2)||D.ents[0];
player = {x:eS.p[0]-eS.d[0]*6,z:eS.p[1]-eS.d[1]*6,yaw:Math.atan2(eS.d[0],eS.d[1]),pitch:0.02,vx:0,vz:0};
topv = {x:0,z:0,h:300};
app.mode = 'walk'; app.anim = null; app.filter = null; app.target = null; app.ride = null;
keys = {};app.joyV = {x:0,y:0,run:0};EYE = 1.65;
// режим без анимации: из настроек системы или по кнопке; выбор запоминается
app.calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
try{const v=localStorage.getItem('maxi-calm');if(v!==null)app.calm=v==='1';}catch(e){}
dummy = new THREE.PerspectiveCamera();
}
