// Вид сверху: нажатие на коридор — кнопка «Перейти сюда».
import * as THREE from 'three';
import {player} from '../controls/player.js';
import {$} from '../core/helpers.js';
import {FY} from '../mall/world.js';
import {moveTo} from '../nav/travel.js';
import {isFloorF, nearestFree} from '../nav/walkgrid.js';
import {cam} from '../render/scene.js';
import {showHint} from './hint.js';
import {floorName, ray} from './pick.js';
import {app} from '../core/state.js';
let goHereP;

export function topTap(x,y){ray.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-(y/innerHeight)*2+1),cam);const o=ray.ray.origin,d=ray.ray.direction;if(Math.abs(d.y)<1e-6)return;
 const t=(FY[app.curFloor]-o.y)/d.y;if(t<=0)return;const px=o.x+d.x*t,pz=o.z+d.z*t;
 if(!isFloorF(app.curFloor,px,pz)){hideGoHere();return;}
 goHereP={x:px,z:pz};const el=$('goHere');el.hidden=false;el.style.left=Math.min(innerWidth-170,Math.max(10,x-80))+'px';el.style.top=Math.min(innerHeight-60,Math.max(70,y-64))+'px';}
export function hideGoHere(){$('goHere').hidden=true;goHereP=null;}

// по порядку, при запуске
export function init() {

/* ---------- Вид сверху: нажми на коридор — «Перейти сюда» ---------- */
goHereP = null;
$('goHere').onclick=()=>{if(!goHereP)return;const w=nearestFree(goHereP.x,goHereP.z,40,app.curFloor);hideGoHere();if(!w)return;const yaw=player.yaw;moveTo(app.curFloor,w[0],w[1],yaw,0);showHint('Ты здесь · '+floorName(app.curFloor)+'. Вернуться к виду сверху — кнопка «Сверху»');};
}
