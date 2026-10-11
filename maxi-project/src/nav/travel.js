// Перемещение: точка перед дверью, перелёт в точку любого этажа, подойти к двери, вид сверху на магазин.
import {clampH} from '../controls/input.js';
import {blockedF, setFloor} from '../controls/move.js';
import {applyPose, player, topv, walkPose} from '../controls/player.js';
import {setMode, topY} from '../controls/view.js';
import {$} from '../core/helpers.js';
import {nearestFree} from './walkgrid.js';
import {cam, coarse} from '../render/scene.js';
import {fadeThen} from '../shop/enter-exit.js';
import {closeCard, openCard} from '../ui/card.js';
import {showHint} from '../ui/hint.js';
import {app} from '../core/state.js';

function standPoint(s){
 if(s.kind==='kiosk'){for(let r=2.2;r<7;r+=0.8)for(let k=0;k<8;k++){const a=k/8*Math.PI*2,x=s.p[0]+Math.sin(a)*(r+s.w/2),z=s.p[1]+Math.cos(a)*(r+s.h/2);if(!blockedF(s.floor,x,z))return{x,z,yaw:Math.atan2(x-s.p[0],z-s.p[1])};}}
 if(s.fp){for(let d=3;d<14;d+=0.5){const p=s.fp.clone().addScaledVector(s.fn,d);if(!blockedF(s.floor,p.x,p.z))return{x:p.x,z:p.z,yaw:Math.atan2(s.fn.x,s.fn.z)};}}
 const c=nearestFree(s.fp?s.fp.x:s.c[0],s.fp?s.fp.z:s.c[1],200,s.floor);if(!c)return null;return{x:c[0],z:c[1],yaw:Math.atan2(c[0]-s.c[0],c[1]-s.c[1])};
}
// перенестись к точке (на любом этаже): плавный перелёт на своём этаже, затемнение — при смене этажа
export function moveTo(f,x,z,yaw,pitch){const other=f!==app.curFloor;
 const put=()=>{if(other)setFloor(f,{x,z,yaw});player.x=x;player.z=z;player.yaw=yaw;player.pitch=pitch||0;player.vx=player.vz=0;
  if(app.mode!=='walk')setMode('walk');else if(other||app.calm){app.anim=null;applyPose(walkPose());}else app.anim={t:0,from:{p:cam.position.clone(),q:cam.quaternion.clone()},m:'walk'};};
 if(other&&!app.calm&&app.mode!=='top')fadeThen(put);else put();}
export function walkTo(s){const sp=standPoint(s);if(!sp)return;
 moveTo(s.floor,sp.x,sp.z,sp.yaw,0.08);openCard(s);if(coarse)$('card').hidden=true;}
export function walkToDoor(s){const d=s.door,r=2.2+(d.gap||0);closeCard();moveTo(d.floor,d.c.x+d.n.x*r,d.c.z+d.n.z*r,Math.atan2(d.n.x,d.n.z),0);showHint('Двери открыты — пройди вперёд, чтобы войти');}
export function showTop(s){if(s.floor!==app.curFloor)setFloor(s.floor);topv.x=s.c[0];topv.z=s.c[1];topv.h=clampH(topY()+Math.max(45,Math.min(160,Math.sqrt(s.area||40)*4)));setMode('top',{keep:true});openCard(s);}
