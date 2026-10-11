// Лифты: панель у дверей, поездка, автоматический вход.
import {releaseLock, updateCross} from '../controls/input.js';
import {setFloor, updateFloorUI, updateJoy} from '../controls/move.js';
import {applyPose, player, walkPose} from '../controls/player.js';
import {setVis} from '../controls/view.js';
import {$} from '../core/helpers.js';
import {FY, world} from './world.js';
import {moveTo} from '../nav/travel.js';
import {requestLockIfNeeded} from '../shop/panel.js';
import {closeCard} from '../ui/card.js';
import {showHint} from '../ui/hint.js';
import {drawMiniBase} from '../ui/minimap.js';
import {floorName} from '../ui/pick.js';
import {app} from '../core/state.js';
let liftCur, liftAuto;

function liftFront(L,f){return{x:L.c.x+L.n.x*(L.HL+1.6),z:L.c.z+L.n.z*(L.HL+1.6)};}
export function openLiftPanel(L,byClick){liftCur=L;const el=$('lift');el.hidden=false;
 const near=Math.hypot(player.x-L.c.x,player.z-L.c.z)<L.HL+4&&app.mode==='walk';
 $('liftNow').textContent=app.mode==='top'?'Лифт соединяет 1 и 2 этажи':'Ты на '+(app.curFloor===1?'первом':'втором')+' этаже'+(near?'':' · лифт в '+Math.round(Math.hypot(player.x-L.c.x,player.z-L.c.z))+' м');
 [1,2].forEach(f=>{const b=$('liftB'+f);b.disabled=f===app.curFloor&&app.mode!=='top';b.classList.toggle('on',f===app.curFloor);});
 if(byClick)releaseLock();updateCross();}
export function hideLiftPanel(relock){$('lift').hidden=true;liftCur=null;if(relock)requestLockIfNeeded();else updateCross();}
export function startRide(L,f){if(app.ride||app.mode==='store')return;if(f===app.curFloor){showHint('Ты уже на этом этаже');return;}
 closeCard();hideLiftPanel(false);const from=app.curFloor,p=liftFront(L,f),yawOut=Math.atan2(-L.n.x,-L.n.z);
 if(app.calm){L.at=f;L.cab.position.y=FY[f];setFloor(f,{x:p.x,z:p.z,yaw:yawOut});player.pitch=0;app.anim=null;applyPose(walkPose());showHint('Лифт приехал: '+floorName(f));return;}
 L.at=from;L.cab.position.y=FY[from];player.vx=player.vz=0;
 app.ride={L,from,to:f,t:0,phase:0,y:FY[from],x0:player.x,z0:player.z,yaw0:player.yaw,p0:player.pitch,yawOut};updateJoy();updateCross();showHint('Лифт едет на '+floorName(f)+'…');}
export function updateRide(dt){const r=app.ride;if(!r)return;const L=r.L;r.t+=dt;
 const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
 const cx=L.c.x+L.n.x*0.1,cz=L.c.z+L.n.z*0.1;
 if(r.phase===0){const k=Math.min(1,r.t/0.3),e=ease(k);player.x=r.x0+(cx-r.x0)*e;player.z=r.z0+(cz-r.z0)*e;
  let da=((r.yawOut-r.yaw0+Math.PI*3)%(Math.PI*2))-Math.PI;player.yaw=r.yaw0+da*e;player.pitch=r.p0*(1-e);if(k>=1){r.phase=1;r.t=0;}}
 else if(r.phase===1){if(r.t>0.08){r.phase=2;r.t=0;}}
 else if(r.phase===2){const k=Math.min(1,r.t/0.35),e=ease(k);r.y=FY[r.from]+(FY[r.to]-FY[r.from])*e;L.cab.position.y=r.y;if(k>=1){r.phase=3;r.t=0;L.at=r.to;app.curFloor=r.to;updateFloorUI();setVis();drawMiniBase();}}
 else if(r.phase===3){if(r.t>0.08){r.phase=4;r.t=0;}}
 else if(r.phase===4){const p=liftFront(L,r.to),k=Math.min(1,r.t/0.3),e=ease(k);player.x=cx+(p.x-cx)*e;player.z=cz+(p.z-cz)*e;
  if(k>=1){app.ride=null;player.x=p.x;player.z=p.z;updateJoy();updateCross();showHint('Приехали: '+floorName(app.curFloor)+(app.curFloor===2?' · кино, фуд-корт, ДНС, Детский мир':''));}}}
export function updateLifts(dt){if(!world.lifts)return;
 world.lifts.forEach(L=>{[1,2].forEach(f=>{let want=0;
  if(app.ride&&app.ride.L===L)want=((app.ride.phase===0&&f===app.ride.from)||(app.ride.phase>=3&&f===app.ride.to))?1:0;
  else if(app.mode==='walk'&&f===app.curFloor&&Math.hypot(player.x-L.c.x,player.z-L.c.z)<L.HL+3.2){want=1;if(L.at!==f){L.at=f;L.cab.position.y=FY[f];}}
  const o=L.open[f];const n=app.calm?want:o+(want-o)*Math.min(1,dt*5);L.open[f]=n;
  L.leaves[f].forEach((l,k)=>{const sg=k?1:-1,w=1-n*0.85;l.scale.x=w;l.position.x=sg*(L.HL-(L.HL-0.05)*w/2-0.02);});});});
 // панель лифта появляется сама, когда подходишь к дверям
 // лифт: шагнул в открытые двери — поехал на другой этаж (этажей два, выбирать нечего)
 if(app.mode==='walk'&&!app.ride&&!app.anim){const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),mv=Math.hypot(player.vx||0,player.vz||0)>0.3;
  for(const L of world.lifts){const dx=player.x-L.c.x,dz=player.z-L.c.z,a=dx*L.n.x+dz*L.n.z,lat=Math.abs(dx*L.R.x+dz*L.R.z);
   if(a>L.HL-0.2&&a<L.HL+1.1&&lat<L.HL-0.05&&-(fx*L.n.x+fz*L.n.z)>0.5&&mv&&L.open[app.curFloor]>0.6){hideLiftPanel(false);startRide(L,app.curFloor===1?2:1);return;}}}
 if(app.mode==='walk'&&!app.ride){let near=null;world.lifts.forEach(L=>{const dx=player.x-L.c.x,dz=player.z-L.c.z;const a=dx*L.n.x+dz*L.n.z;if(a>L.HL&&a<L.HL+2.8&&Math.abs(dx*L.R.x+dz*L.R.z)<L.HL+0.6)near=L;});
  if(near&&liftAuto!==near&&$('lift').hidden){liftAuto=near;openLiftPanel(near,false);}
  if(!near){if(liftAuto&&liftCur===liftAuto&&!$('lift').hidden)hideLiftPanel(false);liftAuto=null;}}}

// по порядку, при запуске
export function init() {

/* ---------- Лифты ---------- */
liftCur = null; liftAuto = null;
[1,2].forEach(f=>{$('liftB'+f).onclick=()=>{const L=liftCur;if(!L)return;hideLiftPanel(false);
 if(app.mode==='top'||Math.hypot(player.x-L.c.x,player.z-L.c.z)>L.HL+4){// сначала подойти к лифту
  const from=app.mode==='top'?app.curFloor:app.curFloor;const p=liftFront(L,from);moveTo(from,p.x,p.z,Math.atan2(L.n.x,L.n.z),0);if(f===from){showHint('Ты у лифта');return;}
  setTimeout(()=>startRide(L,f),app.calm?0:950);return;}
 startRide(L,f);};});
$('liftX').onclick=()=>{hideLiftPanel(true);liftAuto=liftCur;};
}
