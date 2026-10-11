// Ходьба: джойстик, столкновения со стенами, смена этажа.
import {clampH} from './input.js';
import {applyPose, player, topv, walkPose} from './player.js';
import {setVis} from './view.js';
import {$} from '../core/helpers.js';
import {isWalkF, nearestAny, nearestFree} from '../nav/walkgrid.js';
import {coarse} from '../render/scene.js';
import {fadeThen} from '../shop/enter-exit.js';
import {shopBlocked} from '../shop/hall-people.js';
import {closeCard} from '../ui/card.js';
import {showHint} from '../ui/hint.js';
import {drawMiniBase} from '../ui/minimap.js';
import {app} from '../core/state.js';
let PR;

export function updateJoy(){$('joy').hidden=!(coarse&&(app.mode==='walk'||app.mode==='store')&&!app.ride);}
export function blockedF(f,x,z){return !(isWalkF(f,x+PR,z)&&isWalkF(f,x-PR,z)&&isWalkF(f,x,z+PR)&&isWalkF(f,x,z-PR));}
export function blocked(x,z){if(app.mode==='store'&&app.SHOP)return shopBlocked(x,z);return blockedF(app.curFloor,x,z);}
export function tryMove(dx,dz){const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/0.1));for(let i=0;i<n;i++){if(!blocked(player.x+dx/n,player.z))player.x+=dx/n;if(!blocked(player.x,player.z+dz/n))player.z+=dz/n;}}
// смена этажа: та же точка плана на другом этаже (или заданная)
export function setFloor(f,at){if(f===app.curFloor&&!at)return;app.curFloor=f;
 if(at){player.x=at.x;player.z=at.z;if(at.yaw!=null)player.yaw=at.yaw;}
 if(blockedF(f,player.x,player.z)){const w=nearestFree(player.x,player.z,160,f)||nearestAny(f,player.x,player.z);if(w){player.x=w[0];player.z=w[1];}}
 if(app.target&&app.target.floor!==f)closeCard();
 updateFloorUI();setVis();drawMiniBase();}
export function updateFloorUI(){$('bF1').classList.toggle('on',app.curFloor===1);$('bF2').classList.toggle('on',app.curFloor===2);$('brandFloor').textContent=app.curFloor+' этаж · Тула';}
export function goFloor(f){if(f===app.curFloor||app.mode==='store'||app.ride)return;
 if(app.mode==='top'){setFloor(f);topv.h=clampH(topv.h);return;}
 const go=()=>{setFloor(f);app.anim=null;applyPose(walkPose());showHint(f===2?'Второй этаж: кино, фуд-корт, ДНС, Детский мир и другие магазины':'Первый этаж: входы, гипермаркеты и большинство магазинов');};
 if(app.calm)go();else fadeThen(go);}

// по порядку, при запуске
export function init() {

PR = 0.35;
}
