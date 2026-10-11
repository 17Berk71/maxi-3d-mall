// Покупатели в зале.
import * as THREE from 'three';
import {V3} from '../core/helpers.js';
import {mtx} from '../mall/world.js';
import {app} from '../core/state.js';

export function noise(g,w,h,r,n,a){for(let i=0;i<n;i++){g.fillStyle=`rgba(80,60,40,${a*r()})`;g.fillRect(r()*w,r()*h,2,2);}}
export function shopBlockedRaw(cols,W,D,x,z,dw){const r=0.35;const inDoor=dw&&Math.abs(x)<dw/2-0.3&&z>0&&z<D/2+0.9;if(Math.abs(x)>W/2-0.3-r||(!inDoor&&Math.abs(z)>D/2-0.3-r)||z>D/2+0.9)return true;for(const c of cols){if(x>c[0]-r&&x<c[1]+r&&z>c[2]-r&&z<c[3]+r)return true;}return false;}
export function shopBlocked(x,z){return shopBlockedRaw(app.SHOP.colliders,app.SHOP.W,app.SHOP.D,x,z,app.SHOP.dw);}
export function updateShopPeople(dt,now){const P=app.SHOP_PEOPLE;if(!P)return;const r=P.r;const q=new THREE.Quaternion(),sc_=new V3(),p_=new V3();
 P.list.forEach((p,i)=>{if(p.wait>0)p.wait-=dt;else{const dx=p.tx-p.x,dz=p.tz-p.z,d=Math.hypot(dx,dz);
   if(d<0.3){p.wait=1+r()*4;for(let t=0;t<10;t++){const x=p.x+(r()-.5)*10,z=p.z+(r()-.5)*10;if(!shopBlocked(x,z)){p.tx=x;p.tz=z;break;}}}
   else{const st=Math.min(d,p.sp*dt),nx=p.x+dx/d*st,nz=p.z+dz/d*st;if(!shopBlocked(nx,nz)){p.x=nx;p.z=nz;p.a=Math.atan2(dx,dz);}else{p.tx=p.x;p.tz=p.z;}}}
  q.setFromAxisAngle(new V3(0,1,0),p.a);sc_.set(1,1,1);p_.set(p.x,p.wait>0?0:Math.abs(Math.sin(now/1000*p.sp*5+p.ph))*0.03,p.z);mtx.compose(p_,q,sc_);P.meshes.forEach(m=>m.setMatrixAt(i,mtx));});
 P.meshes.forEach(m=>m.instanceMatrix.needsUpdate=true);}
