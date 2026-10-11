// Посетители галереи: ходьба по коридорам.
import * as THREE from 'three';
import {blockedF} from '../controls/move.js';
import {V3} from '../core/helpers.js';
import {FY, mtx, world} from './world.js';
import {isWalkF} from '../nav/walkgrid.js';
import {app} from '../core/state.js';
let _q, _s, _p, _Y;

export function updatePeople(dt,now){const W_=world.people,r=W_.r;const top=app.mode==='top';
 W_.list.forEach((p,i)=>{
  if(dt>0){if(p.wait>0){p.wait-=dt;}else{
   let dx=p.tx-p.x,dz=p.tz-p.z,d=Math.hypot(dx,dz);
   if(d<0.4){p.wait=r()<0.3?1+r()*5:0;for(let t=0;t<12;t++){const a=r()*6.28,L=4+r()*22;const x=p.x+Math.cos(a)*L,z=p.z+Math.sin(a)*L;if(isWalkF(p.f,x,z)&&!blockedF(p.f,x,z)){p.tx=x;p.tz=z;break;}}}
   else{const st=Math.min(d,p.sp*dt),nx=p.x+dx/d*st,nz=p.z+dz/d*st;
    if(isWalkF(p.f,nx,nz)&&!blockedF(p.f,nx,nz)){p.x=nx;p.z=nz;const ta=Math.atan2(dx,dz);let da=((ta-p.a+Math.PI*3)%(Math.PI*2))-Math.PI;p.a+=da*Math.min(1,dt*6);}
    else{p.tx=p.x;p.tz=p.z;}}}}
  const bob=p.wait>0||dt===0?0:Math.abs(Math.sin(now/1000*p.sp*5+p.ph))*0.03;const hide=top&&p.f!==app.curFloor;const y0=FY[p.f];
  _q.setFromAxisAngle(_Y,p.a);const sc=hide?0.0001:p.sc;_s.set(sc,sc,sc);_p.set(p.x,y0+bob,p.z);mtx.compose(_p,_q,_s);W_.meshes.forEach(m=>m.setMatrixAt(i,mtx));
  _p.set(p.x,y0+0.02,p.z);_s.setScalar(hide?0.0001:1);_q.identity();mtx.compose(_p,_q,_s);W_.sh.setMatrixAt(i,mtx);});
 W_.meshes.forEach(m=>m.instanceMatrix.needsUpdate=true);W_.sh.instanceMatrix.needsUpdate=true;W_.placed=top?'top'+app.curFloor:'walk';}

// по порядку, при запуске
export function init() {

_q = new THREE.Quaternion(); _s = new V3(); _p = new V3(); _Y = new V3(0,1,0);
}
