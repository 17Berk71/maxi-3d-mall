// Мини-карта текущего этажа.
import {D, D2} from '../app.js';
import {player} from '../controls/player.js';
import {bb} from '../controls/view.js';
import {$} from '../core/helpers.js';
import {S} from '../mall/stores.js';
import {world} from '../mall/world.js';
import {voidPolys} from '../nav/walkgrid.js';
import {openBigMap} from './bigmap.js';
import {floorName} from './pick.js';
import {app} from '../core/state.js';
let mini, mg, miniBase, miniT;

export function sizeMini(){const r=mini.getBoundingClientRect();const d=Math.min(devicePixelRatio,2);mini.width=Math.max(1,Math.round(r.width*d));mini.height=Math.max(1,Math.round(r.height*d));drawMiniBase();}
export function drawMiniBase(){const w=mini.width,h=mini.height,dp=Math.min(devicePixelRatio,2),pad=6*dp;const s=Math.min((w-2*pad)/(bb.x1-bb.x0),(h-2*pad)/(bb.z1-bb.z0));
 miniT={s,ox:(w-(bb.x1-bb.x0)*s)/2-bb.x0*s,oz:(h-(bb.z1-bb.z0)*s)/2-bb.z0*s};
 const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');const X=p=>[p[0]*s+miniT.ox,p[1]*s+miniT.oz];
 const poly=(pts,fill)=>{g.beginPath();pts.forEach((p,i)=>{const q=X(p);i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]);});g.closePath();g.fillStyle=fill;g.fill();};
 D.bld.forEach(b=>poly(b,'#e7e5e0'));
 if(app.curFloor===2){D.bld.forEach(b=>poly(b,'#cfccc6'));D2.bld.forEach(b=>poly(b,'#e7e5e0'));voidPolys.forEach(v=>poly(v,'#cfe6f1'));}
 S.forEach(st=>{if(st.kind!=='store'||st.floor!==app.curFloor)return;poly(st.poly,(app.filter&&st.cat!==app.filter)?'#dde1e5':st.colHex);});
 // лифты и эскалаторы
 (world.lifts||[]).forEach(L=>{const q=X([L.c.x,L.c.z]);g.fillStyle='#0e7490';g.fillRect(q[0]-3.5*dp,q[1]-3.5*dp,7*dp,7*dp);g.fillStyle='#fff';g.fillRect(q[0]-1*dp,q[1]-2.5*dp,2*dp,5*dp);});
 D2.esc.forEach(e=>{const q=X(e.p);g.save();g.translate(q[0],q[1]);g.rotate(e.a);g.fillStyle='#475569';g.fillRect(-5*dp,-1.5*dp,10*dp,3*dp);g.restore();});
 g.font=`800 ${11*dp}px Manrope, system-ui, sans-serif`;g.textBaseline='top';const lw=g.measureText(floorName(app.curFloor)).width;g.fillStyle='rgba(255,255,255,.9)';g.fillRect(w-lw-pad-8*dp,h-pad-17*dp,lw+8*dp,17*dp);g.fillStyle='#0e7490';g.fillText(floorName(app.curFloor),w-lw-pad-4*dp,h-pad-14*dp);
 miniBase=c;}
export function drawMini(){if(!miniBase)return;const w=mini.width,h=mini.height;mg.clearRect(0,0,w,h);mg.drawImage(miniBase,0,0);const s=miniT.s,X=(x,z)=>[x*s+miniT.ox,z*s+miniT.oz],dp=Math.min(devicePixelRatio,2);
 if(app.target&&app.target.floor===app.curFloor){const p=X(app.target.c[0],app.target.c[1]);mg.strokeStyle='#0e7490';mg.lineWidth=2*dp;mg.beginPath();mg.arc(p[0],p[1],6*dp,0,7);mg.stroke();}
 const [px,pz]=X(player.x,player.z),fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),L=8*dp;
 mg.fillStyle='#e11d48';mg.beginPath();mg.moveTo(px+fx*L,pz+fz*L);mg.lineTo(px-fz*L*.55-fx*L*.4,pz+fx*L*.55-fz*L*.4);mg.lineTo(px+fz*L*.55-fx*L*.4,pz-fx*L*.55-fz*L*.4);mg.closePath();mg.fill();}

// по порядку, при запуске
export function init() {

/* ---------- Мини-карта текущего этажа ---------- */
mini = $('mini'); mg = mini.getContext('2d');miniBase = null; miniT = {s:1,ox:0,oz:0};
mini.addEventListener('click',()=>{if(app.ride)return;openBigMap();});
}
