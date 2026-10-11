// Большая карта на весь экран: сдвиг, масштаб, этажи, «Где я», выбор магазина или места.
import {D, D2} from '../app.js';
import {locked, releaseLock} from '../controls/input.js';
import {player} from '../controls/player.js';
import {bb} from '../controls/view.js';
import {$} from '../core/helpers.js';
import {CATS} from '../mall/categories.js';
import {S} from '../mall/stores.js';
import {world} from '../mall/world.js';
import {moveTo, walkTo, walkToDoor} from '../nav/travel.js';
import {inPoly, isFloorF, nearestFree, voidPolys} from '../nav/walkgrid.js';
import {coarse} from '../render/scene.js';
import {exitShop} from '../shop/enter-exit.js';
import {requestLockIfNeeded} from '../shop/panel.js';
import {closeCard, openCard} from './card.js';
import {floorName} from './pick.js';
import {app} from '../core/state.js';
let BM, bmC, bg, bmW, bmUp;

export function openBigMap(){if(locked)releaseLock();closeCard();BM.f=app.curFloor;BM.sel=null;$('bigmap').hidden=false;$('bmSel').hidden=true;$('bmHint').hidden=false;bmSize();bmFit();if(coarse&&app.mode!=='store')bmCenterOn(player.x,player.z,BM.s*2.4);bmDraw();updateBMFloors();}
export function closeBigMap(){$('bigmap').hidden=true;BM.ptrs.clear();}
function bmSize(){const r=bmC.getBoundingClientRect(),d=Math.min(devicePixelRatio,2);bmC.width=Math.max(1,Math.round(r.width*d));bmC.height=Math.max(1,Math.round(r.height*d));}
// вписать здание и показать игрока ближе к центру
function bmFit(){const r=bmC.getBoundingClientRect(),pad=24,top=70,bot=40;const s=Math.min((r.width-2*pad)/(bb.x1-bb.x0),(r.height-top-bot)/(bb.z1-bb.z0));BM.s=s;BM.ox=(r.width-(bb.x1-bb.x0)*s)/2-bb.x0*s;BM.oz=top+(r.height-top-bot-(bb.z1-bb.z0)*s)/2-bb.z0*s;}
function bmCenterOn(x,z,minS){const r=bmC.getBoundingClientRect();if(minS)BM.s=Math.max(BM.s,minS);BM.ox=r.width/2-x*BM.s;BM.oz=r.height/2-z*BM.s;}
function updateBMFloors(){document.querySelectorAll('.bm-floors button').forEach(b=>b.classList.toggle('on',+b.dataset.f===BM.f));}
function bmDraw(){const d=Math.min(devicePixelRatio,2),w=bmC.width,h=bmC.height;const dark=matchMedia('(prefers-color-scheme: dark)').matches&&document.documentElement.dataset.theme!=='light';
 bg.setTransform(1,0,0,1,0,0);bg.fillStyle=dark?'#0e1419':'#e9eef2';bg.fillRect(0,0,w,h);bg.setTransform(d*BM.s,0,0,d*BM.s,d*BM.ox,d*BM.oz);
 const poly=(pts,fill,stroke)=>{bg.beginPath();pts.forEach((p,i)=>i?bg.lineTo(p[0],p[1]):bg.moveTo(p[0],p[1]));bg.closePath();if(fill){bg.fillStyle=fill;bg.fill();}if(stroke){bg.strokeStyle=stroke;bg.lineWidth=1.2/BM.s;bg.stroke();}};
 const f=BM.f;D.bld.forEach(b=>poly(b,f===2?(dark?'#2a3138':'#cfccc6'):(dark?'#3a434b':'#f4f2ee')));
 if(f===2){D2.bld.forEach(b=>poly(b,dark?'#3a434b':'#f4f2ee'));voidPolys.forEach(v=>poly(v,dark?'#1d3a4a':'#cfe6f1'));}
 const list=S.filter(st=>st.floor===f);
 list.forEach(st=>{if(st.kind==='store')poly(st.poly,(app.filter&&st.cat!==app.filter)?'#dde1e5':st.colHex,BM.sel&&BM.sel.s===st?'#0f172a':'rgba(255,255,255,.65)');});
 list.forEach(st=>{if(st.kind!=='kiosk')return;bg.fillStyle=st.colHex;bg.beginPath();bg.arc(st.c[0],st.c[1],Math.max(0.9,1.1),0,7);bg.fill();});
 (world.lifts||[]).forEach(L=>{bg.fillStyle='#0e7490';bg.fillRect(L.c.x-1.4,L.c.z-1.4,2.8,2.8);});
 D2.esc.forEach(e=>{bg.save();bg.translate(e.p[0],e.p[1]);bg.rotate(e.a);bg.fillStyle='#475569';bg.fillRect(-3.5,-0.9,7,1.8);bg.restore();});
 // подписи: только те, что помещаются в помещение при текущем масштабе
 bg.setTransform(d,0,0,d,0,0);bg.textAlign='center';bg.textBaseline='middle';
 list.forEach(st=>{if(st.cat==='tbd'||st.cat==='wc')return;let x0=1e9,x1=-1e9;if(st.kind==='store')st.poly.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);});else{x0=st.c[0]-2;x1=st.c[0]+2;}
  const wpx=(x1-x0)*BM.s;const fs=Math.max(10,Math.min(15,wpx/7));bg.font=`700 ${fs}px Manrope, system-ui, sans-serif`;const tw=bg.measureText(st.name).width;
  if(st.kind==='store'&&tw>wpx*0.95)return;if(st.kind==='kiosk'&&BM.s<5)return;const lp=st.lp||st.c;const cx=lp[0]*BM.s+BM.ox,cy=lp[1]*BM.s+BM.oz+(st.kind==='kiosk'?12:0);
  bg.lineWidth=3;bg.strokeStyle='rgba(255,255,255,.85)';bg.strokeText(st.name,cx,cy);bg.fillStyle='#14202b';bg.fillText(st.name,cx,cy);});
 // выбранное место
 if(BM.sel&&BM.sel.pt){const [x,z]=BM.sel.pt,cx=x*BM.s+BM.ox,cy=z*BM.s+BM.oz;bg.fillStyle='#0e7490';bg.beginPath();bg.arc(cx,cy-14,9,Math.PI,0);bg.lineTo(cx,cy);bg.closePath();bg.fill();bg.fillStyle='#fff';bg.beginPath();bg.arc(cx,cy-14,3.5,0,7);bg.fill();}
 // игрок
 if(f===app.curFloor&&app.mode!=='store'){const px=player.x*BM.s+BM.ox,pz=player.z*BM.s+BM.oz,fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),L=13;
  bg.fillStyle='rgba(225,29,72,.18)';bg.beginPath();bg.arc(px,pz,18,0,7);bg.fill();bg.fillStyle='#e11d48';bg.strokeStyle='#fff';bg.lineWidth=2;bg.beginPath();bg.moveTo(px+fx*L,pz+fz*L);bg.lineTo(px-fz*L*.6-fx*L*.5,pz+fx*L*.6-fz*L*.5);bg.lineTo(px+fz*L*.6-fx*L*.5,pz-fx*L*.6-fz*L*.5);bg.closePath();bg.fill();bg.stroke();}}
function bmSelect(cx,cy){const [x,z]=bmW(cx,cy),f=BM.f;$('bmHint').hidden=true;
 let st=S.find(o=>o.floor===f&&o.kind==='kiosk'&&Math.hypot(o.c[0]-x,o.c[1]-z)<Math.max(2,10/BM.s));
 if(!st)st=S.find(o=>o.floor===f&&o.kind==='store'&&inPoly(o.poly,x,z));
 const b=$('bmBtns');b.innerHTML='';const btn=(t,pri,fn)=>{const e=document.createElement('button');e.className='btn'+(pri?' pri':'');e.textContent=t;e.onclick=fn;b.appendChild(e);};
 if(st&&st.cat!=='tbd'){const lp=st.lp||st.c;BM.sel={s:st,pt:[lp[0],lp[1]]};$('bmDot').style.background=st.colHex;$('bmName').textContent=st.name;$('bmWhat').textContent=(st.what||CATS[st.cat].n)+' · '+floorName(st.floor);
  if(st.door)btn(st.cat==='wc'?'Подойти':'Подойти к входу',true,()=>{closeBigMap();walkToDoor(st);requestLockIfNeeded();});else btn('Подойти',true,()=>{closeBigMap();walkTo(st);requestLockIfNeeded();});
  if(st.cat!=='wc')btn('Карточка',false,()=>{closeBigMap();openCard(st);});}
 else{const w=nearestFree(x,z,10,f);if(!w||!isFloorF(f,w[0],w[1])){BM.sel=null;$('bmSel').hidden=true;bmDraw();return;}
  BM.sel={pt:[w[0],w[1]]};$('bmDot').style.background='#0e7490';$('bmName').textContent=st?'Помещение без подписи':'Проход';$('bmWhat').textContent=floorName(f);
  btn(f===app.curFloor?'Перейти сюда':'Перейти сюда · '+floorName(f),true,()=>{closeBigMap();if(app.mode==='store')exitShop();const yaw=Math.atan2(player.x-w[0],player.z-w[1]);moveTo(f,w[0],w[1],f===app.curFloor&&Math.hypot(player.x-w[0],player.z-w[1])>1?yaw:player.yaw,0);requestLockIfNeeded();});}
 $('bmSel').hidden=false;bmDraw();}
function bmZoom(k,cx,cy){const s0=BM.s,s1=Math.max(1.2,Math.min(40,s0*k));const [x,z]=[(cx-BM.ox)/s0,(cy-BM.oz)/s0];BM.s=s1;BM.ox=cx-x*s1;BM.oz=cy-z*s1;bmDraw();}

// по порядку, при запуске
export function init() {

/* ---------- Большая карта: нажал на мини-карту — карта на весь экран; выбрать магазин или место и перейти ---------- */
BM = {f:1,s:1,ox:0,oz:0,sel:null,ptrs:new Map(),pinch:0,down:null};bmC = $('bmC'); bg = bmC.getContext('2d');
bmW = (cx,cy)=>[(cx-BM.ox)/BM.s,(cy-BM.oz)/BM.s];
bmC.addEventListener('pointerdown',e=>{bmC.setPointerCapture(e.pointerId);BM.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});if(BM.ptrs.size===1)BM.down={x:e.clientX,y:e.clientY,moved:0};else{BM.down=null;const a=[...BM.ptrs.values()];BM.pinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}bmC.classList.add('drag');});
bmC.addEventListener('pointermove',e=>{const p=BM.ptrs.get(e.pointerId);if(!p)return;const r=bmC.getBoundingClientRect();
 if(BM.ptrs.size===2){p.x=e.clientX;p.y=e.clientY;const a=[...BM.ptrs.values()];const dd=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),mx=(a[0].x+a[1].x)/2-r.left,my=(a[0].y+a[1].y)/2-r.top;if(BM.pinch>0)bmZoom(dd/BM.pinch,mx,my);BM.pinch=dd;return;}
 const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;BM.ox+=dx;BM.oz+=dy;if(BM.down)BM.down.moved+=Math.abs(dx)+Math.abs(dy);bmDraw();});
bmUp = e=>{if(!BM.ptrs.has(e.pointerId))return;BM.ptrs.delete(e.pointerId);if(!BM.ptrs.size)bmC.classList.remove('drag');
 if(BM.down&&BM.down.moved<8&&e.type==='pointerup'){const r=bmC.getBoundingClientRect();bmSelect(e.clientX-r.left,e.clientY-r.top);}if(!BM.ptrs.size)BM.down=null;};
bmC.addEventListener('pointerup',bmUp);bmC.addEventListener('pointercancel',bmUp);
bmC.addEventListener('wheel',e=>{e.preventDefault();const r=bmC.getBoundingClientRect();bmZoom(Math.exp(-e.deltaY*0.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
document.querySelectorAll('.bm-floors button').forEach(b=>b.onclick=()=>{BM.f=+b.dataset.f;BM.sel=null;$('bmSel').hidden=true;updateBMFloors();bmDraw();});
$('bmX').onclick=()=>{closeBigMap();requestLockIfNeeded();};
$('bmMe').onclick=()=>{BM.f=app.curFloor;updateBMFloors();if(app.mode!=='store')bmCenterOn(player.x,player.z,6);bmDraw();};
addEventListener('resize',()=>{if(!$('bigmap').hidden){bmSize();bmDraw();}});
}
