// Эскалаторы: вход на ленту, поездка, подход по нажатию.
import {PREFS} from '../core/settings.js';
import {SENS_BASE, updateCross} from '../controls/input.js';
import {blocked, setFloor, updateFloorUI, updateJoy} from '../controls/move.js';
import {applyPose, keys, player, walkPose} from '../controls/player.js';
import {setVis} from '../controls/view.js';
import {hideLiftPanel} from './lifts.js';
import {FY, world} from './world.js';
import {moveTo} from '../nav/travel.js';
import {nearestFree} from '../nav/walkgrid.js';
import {closeCard} from '../ui/card.js';
import {hideGoHere} from '../ui/go-here.js';
import {showHint} from '../ui/hint.js';
import {drawMiniBase} from '../ui/minimap.js';
import {floorName} from '../ui/pick.js';
import {app} from '../core/state.js';

/* ---------- Эскалаторы: встань на ленту — поедешь на другой этаж ---------- */
// вверх — правая лента (со стороны r), вниз — левая; точки входа — перед гребёнкой
export function escEntry(E,up){return up?E.bot.clone().addScaledVector(E.d,-0.9).addScaledVector(E.r,0.72):E.top.clone().addScaledVector(E.d,0.9).addScaledVector(E.r,-0.72);}
export function startEsc(E,up){if(app.ride||app.mode!=='walk')return;closeCard();hideLiftPanel(false);hideGoHere();
 const to=up?2:1,lane=up?0.72:-0.72,a=up?E.bot:E.top,b=up?E.top:E.bot,dir=up?E.d:E.d.clone().negate();
 const off=b.clone().addScaledVector(dir,1.7).addScaledVector(E.r,lane),yaw=Math.atan2(-dir.x,-dir.z);
 if(app.calm){setFloor(to,{x:off.x,z:off.z,yaw});player.pitch=0;app.anim=null;applyPose(walkPose());showHint('Ты на '+(to===2?'втором':'первом')+' этаже');return;}
 player.vx=player.vz=0;
 app.ride={kind:'esc',E,up,to,t:0,phase:0,x0:player.x,z0:player.z,yaw0:player.yaw,yaw,
  a:a.clone().addScaledVector(E.r,lane),b:b.clone().addScaledVector(E.r,lane),off,y:FY[up?1:2]};
 updateJoy();updateCross();showHint(up?'Эскалатор едет на второй этаж…':'Эскалатор едет на первый этаж…');}
export function updateEscRide(dt){const r=app.ride,e=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;r.t+=dt;const yA=r.up?0:FY[2],yB=r.up?FY[2]:0;
 if(app.lookDX||app.lookDY){player.yaw-=app.lookDX*SENS_BASE*PREFS.sens;player.pitch=Math.max(-1.2,Math.min(1.2,player.pitch-app.lookDY*SENS_BASE*PREFS.sens));app.lookDX=app.lookDY=0;}
 if(r.phase===0){const k=Math.min(1,r.t/0.3),q=e(k);player.x=r.x0+(r.a.x-r.x0)*q;player.z=r.z0+(r.a.z-r.z0)*q;
  let da=((r.yaw-r.yaw0+Math.PI*3)%(Math.PI*2))-Math.PI;player.yaw=r.yaw0+da*q;r.y=yA+0.05;if(k>=1){r.phase=1;r.t=0;}}
 else if(r.phase===1){const fwd=keys.KeyW||keys.ArrowUp||app.joyV.y<-0.3,rate=fwd?((keys.ShiftLeft||keys.ShiftRight||app.joyV.run>0.5)?6:3.6):1;r.k=(r.k||0)+dt*rate/7.5;const k=Math.min(1,r.k);// лента едет сама; идёшь вперёд — бежишь по ней быстрее
  const q=k<0.08?k*k/0.16:k>0.92?1-(1-k)*(1-k)/0.16:k-0.04;player.x=r.a.x+(r.b.x-r.a.x)*q;player.z=r.a.z+(r.b.z-r.a.z)*q;r.y=yA+(yB-yA)*q+0.25;
  if(k>=1){r.phase=2;r.t=0;app.curFloor=r.to;updateFloorUI();setVis();drawMiniBase();}}
 else{const k=Math.min(1,r.t/0.3),q=e(k);player.x=r.b.x+(r.off.x-r.b.x)*q;player.z=r.b.z+(r.off.z-r.b.z)*q;r.y=yB+0.25*(1-q);
  if(k>=1){app.ride=null;player.x=r.off.x;player.z=r.off.z;if(blocked(player.x,player.z)){const w=nearestFree(player.x,player.z,20);if(w){player.x=w[0];player.z=w[1];}}updateJoy();updateCross();showHint('Приехали: '+floorName(app.curFloor));}}}
// подошёл к ленте лицом по ходу — поехал
export function updateEscalators(dt){if(!world.escs)return;
 if(!app.calm)world.stepTex.forEach(({t,dir})=>{t.offset.x=(t.offset.x-dir*dt*0.5)%1;});
 if(app.mode!=='walk'||app.ride||app.anim)return;const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
 const moving=Math.hypot(player.vx||0,player.vz||0)>0.4;
 for(const E of world.escs){const up=app.curFloor===1;const end=up?E.bot:E.top,dir=up?E.d:E.d.clone().negate();
  // просто подойди к эскалатору: в любую из двух лент, лицом к нему — и поедешь
  const px=player.x-end.x,pz=player.z-end.z,sOut=-(px*dir.x+pz*dir.z),lat=px*E.r.x+pz*E.r.z;
  if(sOut>-0.4&&sOut<1.5&&Math.abs(lat)<1.5&&fx*dir.x+fz*dir.z>0.25&&(moving||sOut<1.0)){startEsc(E,up);return;}}}
// нажатие на эскалатор: подойти к нужной ленте и поехать
export function goEscalator(E){const up=app.curFloor===1,p=escEntry(E,up),dir=up?E.d:E.d.clone().negate();
 const back=p.clone().addScaledVector(dir,-1.2);moveTo(app.curFloor,back.x,back.z,Math.atan2(-dir.x,-dir.z),0);
 setTimeout(()=>{if(app.mode==='walk'&&!app.ride)startEsc(E,up);},app.calm?0:950);}
