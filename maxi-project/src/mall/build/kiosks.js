// Островки-стенды: прилавок, стойки, вывеска, товар, продавец.
import * as THREE from 'three';
import {LIN, V3} from '../../core/helpers.js';
import {humanParts} from '../people-parts.js';
import {S} from '../stores.js';
import {FLOOR_H, FY, G, MAT, ROOF_Y, kioskBody, kioskGlow, mtx, pickables, world} from '../world.js';
import {blockRect, isWalkF} from '../../nav/walkgrid.js';
import {Merger} from '../../render/merger.js';
import {scene} from '../../render/scene.js';
import {CH_, CW_, labelAtlases, signAtlases} from '../../render/sign-atlases.js';
import {blobTex} from '../../render/textures.js';
import {B, Cy, mergeG} from '../../shop/goods.js';
let kList;

// по порядку, при запуске
export function init() {

 // ---- островки: квадратные стенды с прилавком по периметру и продавцом в центре (на каждом этаже свои)
 kList = S.filter(s=>s.kind==='kiosk');world.kSets=[];
 [1,2].forEach(f=>{const kl=kList.filter(s=>s.floor===f);if(!kl.length)return;const y0=FY[f],grp=f===1?scene:G('f2');
  const SZ=1.6,CH=1.0,PH=2.45,d=SZ/2;
  const counterG=mergeG([B(SZ,CH,0.36,0,CH/2,d-0.18),B(SZ,CH,0.36,0,CH/2,-d+0.18),B(0.36,CH,SZ-0.72,d-0.18,CH/2,0),B(0.36,CH,SZ-0.72,-d+0.18,CH/2,0)]);
  const topG=mergeG([B(SZ+0.05,0.05,0.42,0,CH+0.025,d-0.19),B(SZ+0.05,0.05,0.42,0,CH+0.025,-d+0.19),B(0.42,0.05,SZ-0.8,d-0.19,CH+0.025,0),B(0.42,0.05,SZ-0.8,-d+0.19,CH+0.025,0)]);
  const stripG=mergeG([B(SZ+0.014,0.06,0.014,0,CH-0.14,d),B(SZ+0.014,0.06,0.014,0,CH-0.14,-d),B(0.014,0.06,SZ+0.014,d,CH-0.14,0),B(0.014,0.06,SZ+0.014,-d,CH-0.14,0)]);
  const postG=mergeG([[1,1],[1,-1],[-1,1],[-1,-1]].map(([a,b])=>Cy(0.028,0.028,PH-CH,a*(d-0.06),CH+(PH-CH)/2,b*(d-0.06),8)));
  const crownG=mergeG([B(SZ,0.34,0.05,0,PH+0.17,d-0.03),B(SZ,0.34,0.05,0,PH+0.17,-d+0.03),B(0.05,0.34,SZ,d-0.03,PH+0.17,0),B(0.05,0.34,SZ,-d+0.03,PH+0.17,0)]);
  const goodsG=mergeG([[-0.45,d-0.18],[0.05,d-0.19],[0.48,d-0.18],[-0.4,-d+0.18],[0.38,-d+0.19],[d-0.18,0.28],[-d+0.18,-0.25]].map(([x,z],k)=>B(0.16+(k%3)*0.05,0.1+(k%2)*0.08,0.13,x,CH+0.05+(0.1+(k%2)*0.08)/2,z)));
  const N=kl.length;
  const body=new THREE.InstancedMesh(counterG,new THREE.MeshStandardMaterial({roughness:.45,metalness:.05}),N);
  const top=new THREE.InstancedMesh(topG,new THREE.MeshStandardMaterial({color:LIN('#f7f5f1'),roughness:.3}),N);
  const glow=new THREE.MeshBasicMaterial({toneMapped:false});const strip=new THREE.InstancedMesh(stripG,glow,N);
  const posts=new THREE.InstancedMesh(postG,MAT.darkMetal,N);
  const crown=new THREE.InstancedMesh(crownG,new THREE.MeshStandardMaterial({color:LIN('#2a2d31'),roughness:.45,metalness:.35}),N);
  const goods=new THREE.InstancedMesh(goodsG,new THREE.MeshStandardMaterial({roughness:.6}),N);
  const shG=new THREE.PlaneGeometry(3.2,3.2);shG.rotateX(-Math.PI/2);const sh=new THREE.InstancedMesh(shG,new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false}),N);
  const q=new THREE.Quaternion(),one=new V3(1,1,1),Yax=new V3(0,1,0);
  const sellers=kl.filter(s=>s.cat!=='tbd'&&s.cat!=='wc');
  const parts=humanParts();const sm=[parts.torso,parts.legs,parts.arms,parts.head].map((g,i)=>new THREE.InstancedMesh(g,new THREE.MeshStandardMaterial({roughness:i===3?.6:.8}),Math.max(1,sellers.length)));
  // размер стенда по месту: с каждой стороны либо стена вплотную, либо проход не уже 1.4 м; рядом нет дверей
  const fits=(s,h)=>{const a=s.a||0,ca=Math.cos(a),sa=Math.sin(a);if(S.some(t=>t.door&&t.door.floor===f&&Math.hypot(t.door.c.x-s.p[0],t.door.c.z-s.p[1])<h+2.2))return false;
   for(const [nx,nz] of [[1,0],[-1,0],[0,1],[0,-1]]){const wx=nx*ca-nz*sa,wz=nx*sa+nz*ca,tx=-wz,tz=wx;
    for(const u of [-0.8,-0.4,0,0.4,0.8]){const bx=s.p[0]+wx*(h+0.05)+tx*u*h,bz=s.p[1]+wz*(h+0.05)+tz*u*h;if(!isWalkF(f,bx+wx*0.15,bz+wz*0.15))continue;
     for(let e=0.45;e<=1.45;e+=0.25)if(!isWalkF(f,bx+wx*e,bz+wz*e))return false;}}return true;};
  kl.forEach(s=>{s.standK=[1,0.8,0.65].find(k=>fits(s,d*k))||0.65;s.standSolid=fits(s,d*s.standK);});
  kl.forEach((s,i)=>{const a=s.a||0,k=s.standK;q.setFromAxisAngle(Yax,-a);mtx.compose(new V3(s.p[0],y0,s.p[1]),q,new V3(k,1,k));
   [body,top,strip,posts,crown,goods].forEach(m=>m.setMatrixAt(i,mtx));
   body.setColorAt(i,kioskBody(s));strip.setColorAt(i,kioskGlow(s));goods.setColorAt(i,s.cat==='tbd'?LIN('#cfd3d6'):s.col.clone().lerp(LIN('#ffffff'),0.35));
   mtx.makeTranslation(s.p[0],y0+0.025,s.p[1]);sh.setMatrixAt(i,mtx);
   s.headW=SZ*k;if(s.standSolid)blockRect(s.p[0],s.p[1],a,d*k+0.05,d*k+0.05,f);});
  sellers.forEach((s,i)=>{const a=s.a||0;q.setFromAxisAngle(Yax,-a);mtx.compose(new V3(s.p[0],y0,s.p[1]),q,one);sm.forEach(m=>m.setMatrixAt(i,mtx));
   const shirt=s.col.clone().lerp(LIN('#2b2f36'),0.35);sm[0].setColorAt(i,shirt);sm[2].setColorAt(i,shirt);sm[1].setColorAt(i,LIN('#2c3440'));sm[3].setColorAt(i,LIN(['#e6c3a5','#c6946b','#f0d2bb'][s.id%3]));});
  sm.forEach(m=>{m.count=sellers.length;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.userData.kiosks=sellers.map(s=>s.id);m.userData.seller=true;grp.add(m);pickables.push(m);});
  [body,strip,goods].forEach(m=>{if(m.instanceColor)m.instanceColor.needsUpdate=true;});
  const ids=kl.map(s=>s.id);[body,top,strip,crown,goods].forEach(m=>{m.userData.kiosks=ids;grp.add(m);pickables.push(m);});grp.add(posts);grp.add(sh);
  world.kSets.push({body,rings:[strip],ids});
  signAtlases.forEach((t,ai)=>{const m=new Merger();kl.forEach(s=>{if(s.atlas!==ai||s.cat==='tbd')return;const w=SZ*s.standK,h=Math.min(0.3,w/7),y=y0+PH+0.17,c=new V3(s.p[0],0,s.p[1]),a=s.a||0,ca=Math.cos(a),sa=Math.sin(a);
    [[0,1],[0,-1],[1,0],[-1,0]].forEach(([nx,nz])=>{const n=new V3(nx*ca-nz*sa,0,nx*sa+nz*ca);m.panel(c.clone().addScaledVector(n,w/2+0.01),n,w*0.96,y-h/2,y+h/2,s.uv,null,s.id);});});
   if(m.p.length){const mesh=m.mesh(new THREE.MeshBasicMaterial({map:t,toneMapped:false,transparent:true,alphaTest:.02}));grp.add(mesh);pickables.push(mesh);}});
  kl.forEach(s=>{s.fp=new V3(s.p[0],y0,s.p[1]);s.fn=new V3(0,0,1);});
  const ty=(f===1?FLOOR_H:ROOF_Y)+0.1;
  labelAtlases.forEach((t,ai)=>{const m=new Merger();kl.forEach(s=>{if(s.atlas!==ai||s.cat==='tbd'||!s.lfs)return;const h=1.0,cw=h*CW_/(s.lfs*1.1),chh=h*CH_/(s.lfs*1.1),x=s.p[0],z=s.p[1]-1.2,y=ty;
   m.quad(new V3(x-cw/2,y,z+chh/2),new V3(x+cw/2,y,z+chh/2),new V3(x+cw/2,y,z-chh/2),new V3(x-cw/2,y,z-chh/2),s.uv,null,s.id);});
   if(m.p.length){const mesh=m.mesh(new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,toneMapped:false}));mesh.renderOrder=3;G('toplabels'+f).add(mesh);pickables.push(mesh);}});
  {// точки островков в виде сверху
   const dg=new THREE.CircleGeometry(1.2,20);dg.rotateX(-Math.PI/2);const dm=new THREE.InstancedMesh(dg,new THREE.MeshBasicMaterial({toneMapped:false}),N);
   kl.forEach((s,i)=>{mtx.makeTranslation(s.p[0],ty-0.04,s.p[1]);dm.setMatrixAt(i,mtx);dm.setColorAt(i,s.cat==='tbd'?LIN('#9aa3ab'):s.col);});if(dm.instanceColor)dm.instanceColor.needsUpdate=true;
   dm.userData.kiosks=ids;G('toponly'+f).add(dm);pickables.push(dm);}});
}
