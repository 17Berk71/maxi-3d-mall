// Ввод: захват мыши, мышь, касания, щипок, джойстик, клавиатура.
import * as THREE from 'three';
import {PREFS} from '../core/settings.js';
import {goFloor, tryMove} from './move.js';
import {keys, player, topv} from './player.js';
import {bb, setMode, topY} from './view.js';
import {$} from '../core/helpers.js';
import {hideLiftPanel} from '../mall/lifts.js';
import {walkTo, walkToDoor} from '../nav/travel.js';
import {cam, canvas, coarse} from '../render/scene.js';
import {closeCart} from '../shop/cart-ui.js';
import {fitOpen} from '../shop/fitting-booth.js';
import {shopPick} from '../shop/hall-pick.js';
import {closeShopPanel} from '../shop/panel.js';
import {closeBigMap} from '../ui/bigmap.js';
import {closeCard} from '../ui/card.js';
import {hideGoHere} from '../ui/go-here.js';
import {hideHint, showHint} from '../ui/hint.js';
import {pick} from '../ui/pick.js';
import {closeSearch, openSearch} from '../ui/search.js';
import {app} from '../core/state.js';
export let ptrs, locked, lockFailed, mouse, SENS_BASE;
let downInfo, pinch0, lockErrors, joy, knob, joyId, joyEnd;

function lockError(){lockErrors++;if(lockErrors>=3)lockFailed=true;updateCross();showHint(lockFailed?'Браузер не даёт скрыть курсор — обзор поворачивается, когда уводишь мышь от центра. Клик по сцене снова попробует скрыть курсор.':'Кликни по сцене ещё раз, чтобы продолжить прогулку');}
export function requestLock(){try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(lockError);}catch(e){lockError();}}
export function releaseLock(){if(document.pointerLockElement)document.exitPointerLock();}
export function isFP(){return app.mode==='walk'||app.mode==='store';}
export function panelsClosed(){return $('card').hidden&&$('shop').hidden&&$('lift').hidden&&$('cartBox').hidden&&$('bigmap').hidden&&$('info').hidden&&!fitOpen();}
export function updateCross(){$('cross').hidden=!(locked&&isFP());$('aim').hidden=!(locked&&isFP());$('lockTip').hidden=!(!coarse&&!locked&&isFP()&&panelsClosed()&&!app.ride);}
function endPtr(e){ptrs.delete(e.pointerId);if(ptrs.size<2)pinch0=0;
 if(ptrs.size===0&&downInfo){if(downInfo.moved<8&&performance.now()-downInfo.t<450)pick(e.clientX,e.clientY);downInfo=null;}}
export function clampH(h){return Math.max(topY()+12,Math.min(1100,h));}
// джойстик: внутри круга — шаг, палец за краем круга — бег (плавно, до скорости Shift на компьютере)
function joyAt(e){const r=joy.getBoundingClientRect(),R=r.width/2;let x=(e.clientX-r.left-R)/R,y=(e.clientY-r.top-R)/R;const l=Math.hypot(x,y);
 const run=Math.max(0,Math.min(1,(l-1.02)/0.45));if(l>1){x/=l;y/=l;}app.joyV={x,y,run};const kr=R*0.58+run*R*0.3;knob.style.transform=`translate(${x*kr}px,${y*kr}px)`;joy.classList.toggle('run',run>0.05);
 if(run>0.05&&!joyAt.told){joyAt.told=true;try{localStorage.setItem('maxi-runtip','1');}catch(_){}}}

// по порядку, при запуске
export function init() {

ptrs = new Map();downInfo = null; pinch0 = 0;
// ---- управление мышью без курсора (захват указателя)
locked = false; lockFailed = !('requestPointerLock' in HTMLCanvasElement.prototype); lockErrors = 0; mouse = {in:false,x:0,y:0};
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;if(locked){lockErrors=0;lockFailed=false;hideHint();}updateCross();});
document.addEventListener('pointerlockerror',lockError);
canvas.addEventListener('pointerdown',e=>{
 if(app.ride&&app.ride.kind!=='esc')return;
 if(app.ride){canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});return;}
 if(e.pointerType==='mouse'&&!coarse&&isFP()){
  if(locked){if(e.button===0)pick(innerWidth/2,innerHeight/2,true);return;}
  if(!$('card').hidden)closeCard();if(!$('shop').hidden)closeShopPanel(false);if(!$('lift').hidden)hideLiftPanel(true);
  requestLock();if(!lockFailed)return;}
 canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(ptrs.size===1)downInfo={t:performance.now(),moved:0};
 if(ptrs.size===2){const a=[...ptrs.values()];pinch0=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(downInfo)downInfo.moved=99;}});
canvas.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
 if(downInfo)downInfo.moved+=Math.abs(dx)+Math.abs(dy);
 if(ptrs.size===2&&app.mode==='top'){const a=[...ptrs.values()];const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinch0>0)topv.h=clampH(topv.h*pinch0/d);pinch0=d;return;}
 if(app.anim||(app.ride&&app.ride.kind!=='esc'))return;
 if(isFP()){const k=(coarse?0.0105:0.0045)*PREFS.sens;player.yaw-=dx*k;player.pitch=Math.max(-1.2,Math.min(1.2,player.pitch-dy*k));hideHint();}
 else{const sc=2*(topv.h-topY())*Math.tan(THREE.MathUtils.degToRad(cam.fov/2))/innerHeight;topv.x-=dx*sc;topv.z-=dy*sc;topv.x=Math.max(bb.x0-60,Math.min(bb.x1+60,topv.x));topv.z=Math.max(bb.z0-60,Math.min(bb.z1+80,topv.z));hideGoHere();}});
SENS_BASE = 0.0021;app.lookDX = 0; app.lookDY = 0;
document.addEventListener('mousemove',e=>{
 if(e.target===canvas){mouse.in=true;mouse.x=e.clientX;mouse.y=e.clientY;}
 if(coarse||!isFP()||app.anim||(app.ride&&app.ride.kind!=='esc'))return;
 if(locked){app.lookDX+=(e.movementX||0);app.lookDY+=(e.movementY||0);}});
canvas.addEventListener('mouseleave',()=>{mouse.in=false;});
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('wheel',e=>{e.preventDefault();if(app.ride)return;if(app.mode==='top'){topv.h=clampH(topv.h*Math.exp(e.deltaY*0.0012));hideGoHere();}else{const f=-Math.sign(e.deltaY)*2;tryMove(-Math.sin(player.yaw)*f,-Math.cos(player.yaw)*f);}},{passive:false});

joy = $('joy'); knob = $('knob');joyId = null;
joy.addEventListener('pointerdown',e=>{joyId=e.pointerId;joy.setPointerCapture(e.pointerId);joyAt(e);hideHint();});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)joyAt(e);});
joyEnd = e=>{if(e.pointerId!==joyId)return;joyId=null;app.joyV={x:0,y:0,run:0};knob.style.transform='';joy.classList.remove('run');};
joy.addEventListener('pointerup',joyEnd);joy.addEventListener('pointercancel',joyEnd);

addEventListener('keydown',e=>{
 if(app.ride&&e.target.tagName!=='INPUT'&&(e.code==='KeyW'||e.code==='ArrowUp'||e.code==='ShiftLeft'||e.code==='ShiftRight'))keys[e.code]=true;// на эскалаторе: зажал W — бежишь по ленте
 if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT'){if(e.key==='Escape'){closeSearch();closeCart();}if(e.key==='Enter'&&e.target.id==='q'){const f=$('results').querySelector('li[data-id]');if(f)f.click();}return;}
 if(e.key==='/'){e.preventDefault();openSearch();return;}
 if(e.key==='Escape'){if(!$('bigmap').hidden){closeBigMap();return;}if(!$('cartBox').hidden){closeCart();return;}if(!$('lift').hidden){hideLiftPanel(false);return;}if(!locked)closeCard();$('info').hidden=true;hideGoHere();if(!$('shop').hidden&&!locked)closeShopPanel(false);return;}
 if(app.ride||!$('bigmap').hidden||fitOpen())return;
 if(e.key==='Enter'&&app.mode==='store'){shopPick(innerWidth/2,innerHeight/2);return;}
 if(e.key==='Enter'&&app.target&&app.mode==='walk'){if(app.target.door)walkToDoor(app.target);else walkTo(app.target);return;}
 if(e.code==='KeyV'){if(app.mode!=='store')setMode(app.mode==='walk'?'top':'walk');return;}
 if(e.code==='Digit1'||e.code==='Digit2'){goFloor(e.code==='Digit1'?1:2);return;}
 keys[e.code]=true;if(e.code.startsWith('Arrow'))e.preventDefault();});
addEventListener('keyup',e=>{keys[e.code]=false;});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
}
