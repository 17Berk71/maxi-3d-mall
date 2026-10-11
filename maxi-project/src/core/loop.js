// Главный цикл: кадр (frame → frameBody в try/catch), обновление всех систем.
import {PREFS} from './settings.js';
import {SENS_BASE, isFP, lockFailed, locked, mouse, panelsClosed, ptrs} from '../controls/input.js';
import {tryMove} from '../controls/move.js';
import {applyPose, keys, player, topPose, topv, walkPose} from '../controls/player.js';
import {setVis, topY} from '../controls/view.js';
import {$} from './helpers.js';
import {updateEscRide, updateEscalators} from '../mall/escalators.js';
import {updateLifts, updateRide} from '../mall/lifts.js';
import {updatePeople} from '../mall/people.js';
import {FY, GLASS_H, world} from '../mall/world.js';
import {FX, cam, coarse, renderer, scene} from '../render/scene.js';
import {updateMallDoors, updateShopExit} from '../shop/enter-exit.js';
import {fitOpen} from '../shop/fitting-booth.js';
import {updateShopPeople} from '../shop/hall-people.js';
import {shopAimText} from '../shop/hall-pick.js';
import {closeShopPanel, kioskHasGoods} from '../shop/panel.js';
import {hideHint, showHint} from '../ui/hint.js';
import {drawMini} from '../ui/minimap.js';
import {aimAt} from '../ui/pick.js';
import {app} from './state.js';
let last, miniAt;

export function frame(now){
 try{frameBody(now);}catch(err){console.error(err);if(!frame.err){frame.err=1;showHint('Ошибка отрисовки: '+err.message);}}
 requestAnimationFrame(frame);
}
function frameBody(now){
 const rawDt=Math.min(1,Math.max(0,(now-last)/1000)),dt=Math.min(0.05,rawDt);last=now;
 if((app.mode==='walk'||app.mode==='store')&&!app.anim&&!app.ride){
  let f=0,r=0,turn=0;
  // обзор мышью: захваченный курсор — плавно, по смещению мыши
  if(app.lookDX||app.lookDY){const kx=app.calm?1:Math.min(1,dt*30);const mx=app.lookDX*kx,my=app.lookDY*kx;app.lookDX-=mx;app.lookDY-=my;if(Math.abs(app.lookDX)<0.05)app.lookDX=0;if(Math.abs(app.lookDY)<0.05)app.lookDY=0;
   player.yaw-=mx*SENS_BASE*PREFS.sens;player.pitch=Math.max(-1.2,Math.min(1.2,player.pitch-my*SENS_BASE*PREFS.sens));}
  // запасной режим, если браузер не даёт скрыть курсор: поворот по положению мыши относительно центра
  if(lockFailed&&mouse.in&&!coarse&&!ptrs.size&&panelsClosed()){const ox=(mouse.x/innerWidth-0.5)*2,oy=(mouse.y/innerHeight-0.5)*2;const dz=0.18;
   const ax=Math.abs(ox)>dz?(Math.abs(ox)-dz)/(1-dz)*Math.sign(ox):0;turn-=ax*Math.abs(ax)*1.4;
   const tp=-oy*0.6;player.pitch+=(tp-player.pitch)*Math.min(1,dt*3);}
  if(keys.KeyW||keys.ArrowUp)f+=1;if(keys.KeyS||keys.ArrowDown)f-=1;if(keys.KeyD)r+=1;if(keys.KeyA)r-=1;
  if(keys.ArrowLeft||keys.KeyQ)turn+=1;if(keys.ArrowRight||keys.KeyE)turn-=1;
  f+=-app.joyV.y;r+=app.joyV.x;player.yaw+=turn*1.9*dt;
  // плавный разгон и торможение (без анимации — сразу)
  const runK=(keys.ShiftLeft||keys.ShiftRight)?1:(app.joyV.run||0);const maxV=(7+9*runK)*(coarse?1.1:1);const l=Math.hypot(f,r);let tx=0,tz=0;
  if(l>0.05){const k=Math.min(1,l)/l;f*=k;r*=k;const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),rx=Math.cos(player.yaw),rz=-Math.sin(player.yaw);tx=(fx*f+rx*r)*maxV;tz=(fz*f+rz*r)*maxV;hideHint();}
  const acc=app.calm?1:Math.min(1,dt*(l>0.05?7:10));player.vx+=(tx-player.vx)*acc;player.vz+=(tz-player.vz)*acc;
  if(Math.abs(player.vx)+Math.abs(player.vz)>0.01){const ox=player.x,oz=player.z;tryMove(player.vx*dt,player.vz*dt);if(Math.abs(player.x-ox)<1e-4)player.vx*=0.5;if(Math.abs(player.z-oz)<1e-4)player.vz*=0.5;}
 }
 if(app.ride)(app.ride.kind==='esc'?updateEscRide:updateRide)(rawDt);
 const goal=app.mode==='top'?topPose():walkPose();
 if(app.anim){app.anim.t=app.calm?1:Math.min(1,app.anim.t+Math.min(0.3,rawDt)/0.9);const e=app.anim.t<.5?4*app.anim.t**3:1-Math.pow(-2*app.anim.t+2,3)/2;
  cam.position.copy(app.anim.from.p).lerp(goal.p,e);cam.quaternion.copy(app.anim.from.q).slerp(goal.q,e);
  if(app.anim.t>=1){app.anim=null;if(app.mode==='walk')setVis();}}
 else applyPose(goal);
 world.pmark.position.set(player.x,topY()+1,player.z);world.pmark.rotation.y=player.yaw;world.pmark.scale.setScalar(app.mode==='top'?Math.max(0.4,(topv.h-topY())/160):1);
 {const pk=app.mode==='top'?'top'+app.curFloor:'walk';if(world.people&&app.mode!=='store'&&(!app.calm||world.people.placed!==pk))updatePeople(app.calm?0:dt,now);}
 if(app.PS&&(app.PS.s.kind==='kiosk'||app.PS.s.island)&&!$('shop').hidden&&(app.mode!=='walk'||app.curFloor!==app.PS.s.floor||Math.hypot(player.x-(app.PS.s.p||app.PS.s.c)[0],player.z-(app.PS.s.p||app.PS.s.c)[1])>8))closeShopPanel(false);
 updateMallDoors(dt);updateLifts(rawDt);updateEscalators(rawDt);if(app.mode==='store'){updateShopExit(dt);if(!app.calm)updateShopPeople(dt,now);}
 if(!app.calm){world.wheel.rotation.z+=dt*0.04;world.cabins.forEach(c=>{c.rotation.z=-world.wheel.rotation.z;});}
 if(world.target.visible){const b=app.mode==='top'?topY()+3:(world.target.userData.base||GLASS_H+1.4);world.target.position.y=b+(app.calm?0:Math.sin(now/300)*0.3);if(!app.calm)world.target.rotation.y+=dt*1.5;world.target.scale.setScalar(app.mode==='top'?Math.max(1,(topv.h-topY())/50):1);}
 if(locked&&isFP()&&now-(frame.aimAt||0)>120){frame.aimAt=now;const el=$('aim');let txt='';if(app.mode==='store'&&app.SHOP){txt=shopAimText();}else{const t=aimAt();txt=!t?'':t.esc?(app.curFloor===1?'Эскалатор на 2 этаж · нажми или встань на ленту':'Эскалатор на 1 этаж · нажми или встань на ленту'):t.lift?'Лифт · нажми, чтобы выбрать этаж':(t.s.cat==='tbd'?t.s.name:t.s.name+(t.s.door?' · нажми или зайди в дверь':kioskHasGoods(t.s)?' · нажми, чтобы посмотреть товары':' · нажми, чтобы открыть'));}if(el.textContent!==txt)el.textContent=txt;el.style.opacity=txt?1:0;}
 if(world.mirror)world.mirror.visible=!!world.mirrorOn&&app.curFloor===1&&app.mode==='walk';
 if(!fitOpen()){const sc_=app.mode==='store'&&app.SHOP?app.SHOP.scene:scene;if(FX.active)FX.render(sc_,cam,app.curFloor,FY[app.curFloor],app.mode==='walk'&&!app.ride);else renderer.render(sc_,cam);}
 if(now-miniAt>80){drawMini();miniAt=now;}
}

// по порядку, при запуске
export function init() {

/* ---------- Цикл ---------- */
last = performance.now(); miniAt = 0;
}
