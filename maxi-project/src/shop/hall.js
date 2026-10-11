// Зал магазина: отдельная сцена (отделы, стеллажи, вешала, касса, дверь с видом на галерею).
import * as THREE from 'three';
import {mulberry, shade} from '../core/utils.js';
import {PALETTE, catalogOf, PHOTOS} from './catalog.js';
import {INTERIORS, pickInterior} from './interiors.js';
import {LIN, V3} from '../core/helpers.js';
import {humanParts} from '../mall/people-parts.js';
import {MAT, mtx} from '../mall/world.js';
import {canvasTex, fitFont, rr} from '../render/canvas.js';
import {scene} from '../render/scene.js';
import {marble} from '../render/textures.js';
import {disposeShop, updateShopDoor} from './enter-exit.js';
import {FIT, buildFittingBooth} from './fitting-booth.js';
import {B, Cy, CyX, GARM, MOD, SLOT, mergeG, models, photoGeo, photoMat} from './goods.js';
import {shopDecor, shopDecorLights, shopFloorPlan} from './hall-decor.js';
import {shopBlockedRaw} from './hall-people.js';
import {app} from '../core/state.js';
let shopStyle;

export function setShopStyle(n){shopStyle=INTERIORS[n]||n==='auto'?n:'auto';if(app.SHOP&&app.mode==='store'){const s=app.SHOP.s;disposeShop();app.SHOP=buildShop(s);app.PS=app.SHOP;app.SHOP.doorOpen=1;updateShopDoor();}return shopStyle;}
export function buildShop(s){
 const cat=catalogOf(s);const nd=cat.length;const big=nd>=6;
 const W=big?40:nd>=4?30:nd>=2?22:15,D=big?30:nd>=4?22:nd>=2?17:12,H=5.2;
 const ST=pickInterior(s,shopStyle),SX=ST.key!=='base';
 const sc=new THREE.Scene();const bgc=SX?ST.bg:'#efece6';sc.background=LIN(bgc);sc.environment=scene.environment;sc.fog=new THREE.Fog(LIN(bgc),30,90);
 {const hm=SX?ST.hemi:['#fffaf2','#b9ad9c',0.55],dr=SX?ST.dir:['#fff2e0',0.45];sc.add(new THREE.HemisphereLight(LIN(hm[0]),LIN(hm[1]),hm[2]));const dl=new THREE.DirectionalLight(LIN(dr[0]),dr[1]);dl.position.set(10,20,8);sc.add(dl);}
 // цвет бренда внутри зала — приглушённый, чтобы не резал глаза
 const brand=s.col.clone().lerp(LIN('#8d8a84'),0.35),brandHex='#'+new THREE.Color(s.colHex).lerp(new THREE.Color('#8d8a84'),0.35).getHexString();
 const colliders=[],pick=[],zones=[];
 const floorTex=canvasTex(512,512,(g,w,h)=>{const r=mulberry(s.id);const food=s.cat==='food'||s.cat==='furn';
  if(food||s.cat==='fashion'){g.fillStyle='#cfae88';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=32){const off=(y/32%2)*96;for(let x=-off;x<w;x+=192){g.fillStyle=`rgba(${110+r()*30},${70+r()*20},${30+r()*15},${0.12+r()*0.1})`;g.fillRect(x,y,190,31);}g.fillStyle='rgba(60,35,15,.3)';g.fillRect(0,y,w,1);}}
  else{g.fillStyle='#c4c5c6';g.fillRect(0,0,w,h);for(let i=0;i<2;i++)for(let j=0;j<2;j++){g.fillStyle=`rgba(0,0,0,${0.02+r()*0.03})`;g.fillRect(i*256,j*256,256,256);}g.strokeStyle='rgba(0,0,0,.15)';g.lineWidth=2;g.strokeRect(0,0,256,256);g.strokeRect(256,256,256,256);g.strokeRect(256,0,256,256);g.strokeRect(0,256,256,256);}});
 floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping;floorTex.repeat.set(W/4,D/4);
 let flTex=floorTex,flRough=.3;if(SX){floorTex.dispose();flTex=canvasTex(1024,1024,(g,w,h)=>ST.floor(g,w,h,mulberry(s.id+1)));flTex.wrapS=flTex.wrapT=THREE.RepeatWrapping;flTex.repeat.set(W/ST.floorM,D/ST.floorM);flRough=ST.floorRough;}
 const fl=new THREE.Mesh(new THREE.PlaneGeometry(W,D),new THREE.MeshStandardMaterial({map:flTex,roughness:flRough,envMapIntensity:SX?(ST.floorEnv||.12):1}));fl.rotation.x=-Math.PI/2;sc.add(fl);
 const wallMat=new THREE.MeshStandardMaterial({color:LIN(SX?ST.wall:'#e9e6e0'),roughness:.85,side:THREE.BackSide});
 const room=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),[wallMat,wallMat,new THREE.MeshStandardMaterial({color:LIN(SX?ST.ceil:'#f7f7f5'),roughness:.9,side:THREE.BackSide}),wallMat,wallMat,wallMat]);room.position.y=H/2;sc.add(room);
 if(SX){const bm=ST.backM||4,wt=canvasTex(1024,1024,(g,w,h)=>ST.back(g,w,h,mulberry(s.id+2)));wt.wrapS=wt.wrapT=THREE.RepeatWrapping;
  const wmat=len=>{const t=wt.clone();t.needsUpdate=true;t.repeat.set(len/bm,H/bm);return new THREE.MeshStandardMaterial({map:t,roughness:.85,side:THREE.BackSide});};
  room.material[5]=wmat(W);if(ST.side==='brick'){room.material[0]=wmat(D);room.material[1]=wmat(D);}}
 // цветная полоса по стенам и светильники
 if(!SX){const bm=new THREE.MeshStandardMaterial({color:brand,roughness:.5,side:THREE.DoubleSide});[[0,-D/2+0.02,W,0],[0,D/2-0.02,W,Math.PI],[-W/2+0.02,0,D,Math.PI/2],[W/2-0.02,0,D,-Math.PI/2]].forEach(([x,z,l,r])=>{const b=new THREE.Mesh(new THREE.PlaneGeometry(l,0.5),bm);b.position.set(x,H-0.45,z);b.rotation.y=r;sc.add(b);});}
 if(SX)shopDecorLights(sc,ST,W,D,H);else{const lp=new THREE.PlaneGeometry(2.6,0.3);lp.rotateX(Math.PI/2);const nL=Math.floor(W/5)*Math.floor(D/4);const lights=new THREE.InstancedMesh(lp,new THREE.MeshBasicMaterial({color:new THREE.Color(1.5,1.48,1.42),toneMapped:false}),Math.max(1,nL));let li=0;
 for(let x=-W/2+3;x<W/2-1;x+=5)for(let z=-D/2+2;z<D/2-1;z+=4){if(li<nL){mtx.makeTranslation(x,H-0.02,z);lights.setMatrixAt(li++,mtx);}}lights.count=li;sc.add(lights);}
 // логотип на задней стене
 const logoT=canvasTex(1024,160,(g,w,h)=>{g.fillStyle=SX?ST.sign[0]:brandHex;g.fillRect(0,0,w,h);if(SX){g.fillStyle=ST.sign[2];g.fillRect(0,h-10,w,10);}g.fillStyle=SX?ST.sign[1]:'#fff';g.textAlign='center';g.textBaseline='middle';fitFont(g,s.name,w-80,110,800);g.fillText(s.name,w/2,h/2+4);});
 const logo=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(W*0.5,14),Math.min(W*0.5,14)*160/1024),new THREE.MeshBasicMaterial({map:logoT,toneMapped:false}));logo.position.set(0,3.6,-D/2+0.03);sc.add(logo);
 // кинотеатр: двери залов (по открытым данным: IMAX, 3D, KIDS, RELAX) и указатель расписания — без выдуманных афиш
 if(s.name==='Синема Парк'){const deptT=cat.findIndex(d=>d.key==='movies'),tick=deptT>=0?cat[deptT].items:null;
  const bt=canvasTex(1024,512,g=>{g.fillStyle='#16181b';g.fillRect(0,0,1024,512);g.strokeStyle='#8b5cf6';g.lineWidth=6;g.strokeRect(12,12,1000,488);g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';
   g.font='800 64px Manrope, system-ui, sans-serif';g.fillText('Сеансы и билеты',512,170);g.font='600 40px Manrope, system-ui, sans-serif';g.fillStyle='#c4b5fd';g.fillText('расписание — на сайте кинотеатра',512,260);g.fillStyle='#e5e7eb';g.fillText('8 залов · IMAX · 3D · KIDS · RELAX',512,350);});
  [-1,1].forEach(side=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.6),new THREE.MeshBasicMaterial({map:bt,toneMapped:false}));m.position.set(side*(W/2-0.05),2.4,-D/4);m.rotation.y=-side*Math.PI/2;if(tick){m.userData.prod=tick[0];pick.push(m);}sc.add(m);});
  const HALLS=['Зал 1','Зал 2','Зал 3','Зал 4'];
  HALLS.forEach((t,i)=>{const x=-W/2+2+i*2.4;const dt=canvasTex(256,384,g=>{g.fillStyle='#5b1a2b';g.fillRect(0,0,256,384);g.fillStyle='#1f0a10';g.fillRect(126,70,4,314);g.fillStyle='#111';g.fillRect(0,0,256,70);g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';fitFont(g,t,236,34,800);g.fillText(t,128,36);g.fillStyle='#d4af37';g.fillRect(100,210,8,40);g.fillRect(148,210,8,40);});
   const d=new THREE.Mesh(new THREE.PlaneGeometry(1.7,2.55),new THREE.MeshBasicMaterial({map:dt,toneMapped:false}));d.position.set(x,1.28,-D/2+0.04);sc.add(d);if(tick){d.userData.prod=tick[i%tick.length];pick.push(d);}});}
 // вход/выход на передней стене: проём шириной как у двери в галерее, за стеклом — галерея
 const DWs=s.door?s.door.w:2.6;
 {const fw=new THREE.MeshStandardMaterial({color:LIN(SX?ST.wall:'#f4f2ee'),roughness:.8});const side=(W-DWs)/2;
  [[-(DWs/2+side/2)],[DWs/2+side/2]].forEach(([x])=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(side,H),fw);p.position.set(x,H/2,D/2-0.01);p.rotation.y=Math.PI;sc.add(p);});
  const top=new THREE.Mesh(new THREE.PlaneGeometry(DWs,H-2.75),fw);top.position.set(0,2.75+(H-2.75)/2,D/2-0.01);top.rotation.y=Math.PI;sc.add(top);
  room.material[4]=new THREE.MeshBasicMaterial({visible:false});room.material[3]=room.material[4];}
 const galT=canvasTex(1024,512,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#f7f7f5');gr.addColorStop(.55,'#efeeea');gr.addColorStop(.56,'#e8e2d6');gr.addColorStop(1,'#d9d1c3');g.fillStyle=gr;g.fillRect(0,0,w,h);
  const r=mulberry(s.id+3);for(let i=0;i<7;i++){const x=i*150+20,c=PALETTE[Math.floor(r()*PALETTE.length)];g.fillStyle=c;g.fillRect(x,120,130,34);g.fillStyle='rgba(200,220,230,.7)';g.fillRect(x,154,130,130);g.fillStyle='rgba(255,255,255,.35)';g.fillRect(x+10,160,20,118);}
  g.fillStyle='#ffffff';g.fillRect(0,40,w,18);g.fillStyle='rgba(239,125,53,.8)';g.fillRect(0,330,w,8);g.fillStyle='rgba(122,176,79,.8)';g.fillRect(0,338,w,12);
  for(let i=0;i<5;i++){g.fillStyle='rgba(40,50,60,.35)';const x=80+r()*860;g.beginPath();g.arc(x,262,10,0,7);g.fill();g.fillRect(x-10,272,20,56);}});
 const gal=new THREE.Mesh(new THREE.PlaneGeometry(30,15),new THREE.MeshBasicMaterial({map:galT}));gal.position.set(0,5.2,D/2+9);gal.rotation.y=Math.PI;sc.add(gal);
 const galFloor=new THREE.Mesh(new THREE.PlaneGeometry(30,9),new THREE.MeshStandardMaterial({map:marble,roughness:.15}));galFloor.rotation.x=-Math.PI/2;galFloor.position.set(0,0,D/2+4.5);sc.add(galFloor);
 const exitDoor=new THREE.Group();
 const lvG=new THREE.BoxGeometry(DWs/2,2.62,0.04);lvG.translate(0,1.33,0);const lvM=MAT.glass;
 const lv1=new THREE.Mesh(lvG,lvM),lv2=new THREE.Mesh(lvG,lvM);exitDoor.add(lv1,lv2);
 const df=new THREE.Mesh(new THREE.BoxGeometry(DWs+0.2,0.12,0.14),MAT.darkMetal);df.position.y=2.7;exitDoor.add(df);
 [-1,1].forEach(k=>{const p=new THREE.Mesh(new THREE.BoxGeometry(0.1,2.7,0.12),MAT.darkMetal);p.position.set(k*DWs/2,1.35,0);exitDoor.add(p);});
 const exitT=canvasTex(512,112,(g,w,h)=>{rr(g,4,8,w-8,h-16,24);g.fillStyle='#0e7490';g.fill();g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';g.font='700 44px Manrope, sans-serif';g.fillText('Выход в галерею',w/2,h/2+2);});
 const es=new THREE.Mesh(new THREE.PlaneGeometry(2.2,0.48),new THREE.MeshBasicMaterial({map:exitT,toneMapped:false,side:THREE.DoubleSide}));es.position.y=3.15;exitDoor.add(es);
 exitDoor.position.set(0,0,D/2-0.02);sc.add(exitDoor);es.userData.exit=true;pick.push(es);
 const matE=new THREE.Mesh(new THREE.PlaneGeometry(DWs,1.4),new THREE.MeshStandardMaterial({color:LIN('#2c2f33'),roughness:.95}));matE.rotation.x=-Math.PI/2;matE.position.set(0,0.01,D/2-0.8);sc.add(matE);
 // касса у входа
 if(s.cat!=='food'){const desk=new THREE.Mesh(B(3,1.05,0.8,0,0.525,0),new THREE.MeshStandardMaterial({color:SX?LIN(ST.desk):brand,roughness:.4}));desk.position.set(W/2-4,0,D/2-3.2);sc.add(desk);colliders.push([W/2-5.6,W/2-2.4,D/2-3.7,D/2-2.7]);
  const top=new THREE.Mesh(B(3.1,0.05,0.9,0,1.07,0),SX?new THREE.MeshStandardMaterial({color:LIN(ST.deskTop),roughness:.35}):MAT.white);top.position.copy(desk.position);sc.add(top);}
 // отделы по сетке
 const cols=nd<=1?1:nd<=4?2:4,rows=Math.ceil(nd/cols);
 const x0=-W/2+1.2,x1=W/2-1.2,z0=-D/2+1.2,z1=D/2-5.5;const zw=(x1-x0)/cols,zd=(z1-z0)/rows;
 const inst={};const addInst=(model,x,y,z,ry,color,prod,scale)=>{(inst[model]=inst[model]||[]).push({x,y,z,ry,color,prod,scale:scale||1});};
 const pinst={};const addPhoto=(p,x,yTop,z,ry)=>{(pinst[p.photo]=pinst[p.photo]||[]).push({x,y:yTop-PHOTOS[p.photo].h/2-0.05,z,ry,prod:p,top:yTop});};
 cat.forEach((dep,di)=>{const c=di%cols,rI=Math.floor(di/cols);const zx0=x0+c*zw+0.6,zx1=x0+(c+1)*zw-0.6,zz0=z0+rI*zd+0.6,zz1=z0+(rI+1)*zd-0.6;const cx=(zx0+zx1)/2,cz=(zz0+zz1)/2,w=zx1-zx0,d=zz1-zz0;
  zones.push({dep,cx,cz,w,d});
  // коврик отдела и подвесная табличка
  if(!SX||ST.deptMat){const mat=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshStandardMaterial({color:LIN(SX?ST.deptMat[0]:shade(brandHex,.82)),roughness:.6,transparent:true,opacity:SX?ST.deptMat[1]:.55}));mat.rotation.x=-Math.PI/2;mat.position.set(cx,0.012,cz);sc.add(mat);}
  const signT=canvasTex(512,112,(g,W_,H_)=>{g.fillStyle=SX?ST.sign[0]:'#1f2226';rr(g,2,2,W_-4,H_-4,14);g.fill();g.fillStyle=SX?ST.sign[2]:brandHex;g.fillRect(2,H_-12,W_-4,10);g.fillStyle=SX?ST.sign[1]:'#fff';g.textAlign='center';g.textBaseline='middle';fitFont(g,dep.title,W_-40,48,800);g.fillText(dep.title,W_/2,H_/2-2);});
  const sgM=new THREE.MeshBasicMaterial({map:signT,toneMapped:false});[0,Math.PI].forEach(ry=>{const sg=new THREE.Mesh(new THREE.PlaneGeometry(3.4,0.74),sgM);sg.position.set(cx,3.7,cz+d/2-0.4);sg.rotation.y=ry;sg.userData.dept=di;sc.add(sg);pick.push(sg);});
  [-1,1].forEach(k=>{const w_=new THREE.Mesh(Cy(0.008,0.008,H-4.07,cx+k*1.5,3.7+0.37+(H-4.07)/2,cz+d/2-0.4,4),MAT.darkMetal);sc.add(w_);});
  const items=dep.items;let pi=0;const next=()=>dep.itemAt(pi++);
  const lay=dep.lay;
  // ряд товаров вдоль полки: у каждого своё место, ширина — по товару
  const fillRow=(x0_,x1_,place)=>{let x=x0_;for(let guard=0;guard<400;guard++){const p=next();const wdt=(SLOT[p.model]||0.3)*(p.scale||1);if(x+wdt>x1_){pi--;break;}place(x+wdt/2,p);x+=wdt+0.035;}};
  const wallUnit=(ux,uz,ry,len)=>{// стеллаж: 4 полки (для телевизоров — 2 яруса)
   const tall=dep.model==='tv'||dep.model==='appliance',lv=tall?[0.06,1.12]:[0.37,0.87,1.37,1.87];
   const g=new THREE.Group();const body=new THREE.Mesh(B(len,2.2,0.5,0,1.1,-0.2),new THREE.MeshStandardMaterial({color:LIN(SX?ST.unit[0]:'#f2f0ec'),roughness:.6}));g.add(body);
   lv.forEach(y=>{const sh=new THREE.Mesh(B(len,0.03,0.45,0,y-0.02,0.05),SX&&ST.shelf?new THREE.MeshStandardMaterial({color:LIN(ST.shelf),roughness:.5}):MAT.white);g.add(sh);});
   const back=new THREE.Mesh(B(len,2.2,0.02,0,1.1,-0.19),new THREE.MeshStandardMaterial({color:LIN(SX?ST.unit[1]:shade(brandHex,.55)),roughness:.7}));g.add(back);
   g.position.set(ux,0,uz);g.rotation.y=ry;sc.add(g);
   const ca=Math.cos(ry),sa=Math.sin(ry);const hx=Math.abs(len/2*ca)+Math.abs(0.35*sa),hz=Math.abs(len/2*sa)+Math.abs(0.35*ca);colliders.push([ux-hx,ux+hx,uz-hz,uz+hz]);
   lv.forEach(y=>fillRow(-len/2+0.12,len/2-0.08,(lx,p)=>addInst(p.model,ux+lx*ca+0.05*sa,y,uz-lx*sa+0.05*ca,ry,p.color,p,p.scale)));};
  if(lay==='wall'){const len=Math.min(4,w-0.4);const n=Math.max(1,Math.floor((d-1)/2.2));for(let k=0;k<n;k++){wallUnit(cx,zz0+0.8+k*2.2,0,len);}}
  else if(lay==='racks'){const nR=Math.max(1,Math.floor((d-0.6)/1.9));for(let k=0;k<nR;k++){const rz=zz0+0.9+k*1.9,len=Math.min(4.4,w-0.6);
    // вешало: две стойки и перекладина
    const rmat=SX?new THREE.MeshStandardMaterial({color:LIN(ST.rack[0]),roughness:ST.rack[1],metalness:ST.rack[2]}):MAT.metal;const g=new THREE.Group();[-len/2,len/2].forEach(px=>g.add(new THREE.Mesh(Cy(0.025,0.025,1.6,px,0.8,0,8),rmat)));const rail=new THREE.Mesh(CyX(0.015,len,0,1.58,0,8),rmat);g.add(rail);
    g.add(new THREE.Mesh(B(len+0.1,0.04,0.5,0,0.02,0),MAT.darkMetal));g.position.set(cx,0,rz);sc.add(g);colliders.push([cx-len/2-0.2,cx+len/2+0.2,rz-0.3,rz+0.3]);
    // одежда висит плотно, боком к проходу, как в магазине; крайняя — лицом
    // вещи с настоящим фото висят лицом к проходу (слева), остальные — плотно боком
    {const pk=[],L0=cx-len/2+0.2,L1=cx+len/2-0.2;let used=0;
     for(let guard=0;guard<400;guard++){const p=next();const wd=p.photo?PHOTOS[p.photo].h*PHOTOS[p.photo].aspect*0.86:(SLOT[p.model]||0.3)*(p.scale||1)+0.035;if(used+wd>L1-L0){pi--;break;}pk.push([p,wd]);used+=wd;}
     pk.sort((a,b)=>(b[0].photo?1:0)-(a[0].photo?1:0));let x=L0;
     pk.forEach(([p,wd],j)=>{if(p.photo)addPhoto(p,x+wd/2,1.56,rz+(j%2?0.012:-0.012),0);else addInst(p.model,x+wd/2,1.56,rz,Math.PI/2+(((pi+j)*37%7)-3)*0.02,p.color,p,p.scale);x+=wd;});}
    {const p=next();if(p.photo)addPhoto(p,cx+len/2+0.05,1.56,rz,Math.PI/2);else addInst(p.model,cx+len/2+0.05,1.56,rz,0,p.color,p,p.scale);}}
   // манекен у отдела
   }
  else if(lay==='football'||lay==='basketball'){const ball=lay;
   // корзины с мячами
   [[cx-w/4,cz],[cx+w/4,cz+d/6]].forEach(([bx,bz])=>{const bin=new THREE.Mesh(Cy(0.5,0.45,0.6,0,0.3,0,20),new THREE.MeshStandardMaterial({color:LIN('#2b2e33'),roughness:.5,wireframe:false,transparent:true,opacity:.85}));bin.position.set(bx,0,bz);sc.add(bin);colliders.push([bx-0.6,bx+0.6,bz-0.6,bz+0.6]);
    for(let k=0;k<9;k++){const a=k*2.4,rr_=k<6?0.26:0.1;const p=items[0];addInst(ball,bx+Math.cos(a)*rr_,0.62+(k<6?0:0.18),bz+Math.sin(a)*rr_,a,'#ffffff',p);}});
   if(ball==='football'){// ворота
    const gl=new THREE.Group();const gm=MAT.white;[[-1.5,0],[1.5,0]].forEach(([px])=>gl.add(new THREE.Mesh(Cy(0.04,0.04,1.5,px,0.75,0,8),gm)));gl.add(new THREE.Mesh(CyX(0.04,3,0,1.5,0,8),gm));
    const net=new THREE.Mesh(new THREE.PlaneGeometry(3,1.5),new THREE.MeshStandardMaterial({color:LIN('#ffffff'),transparent:true,opacity:.25,side:THREE.DoubleSide}));net.position.set(0,0.75,-0.6);gl.add(net);
    gl.position.set(cx,0,zz0+0.8);sc.add(gl);colliders.push([cx-1.6,cx+1.6,zz0+0.1,zz0+1.0]);
    const p=items[5];const hit=new THREE.Mesh(B(3,1.5,0.8,0,0.75,-0.3),new THREE.MeshBasicMaterial({visible:false}));hit.position.copy(gl.position);hit.userData.prod=p;sc.add(hit);pick.push(hit);}
   else{// стойка с кольцом
    const hp=new THREE.Group();hp.add(new THREE.Mesh(Cy(0.06,0.06,3,0,1.5,0,10),MAT.darkMetal));hp.add(new THREE.Mesh(B(1.2,0.8,0.04,0,3.1,0.3),new THREE.MeshStandardMaterial({color:LIN('#ffffff'),transparent:true,opacity:.7})));
    const ring=new THREE.Mesh(new THREE.TorusGeometry(0.23,0.015,6,24),new THREE.MeshStandardMaterial({color:LIN('#e0501e')}));ring.rotation.x=Math.PI/2;ring.position.set(0,2.9,0.55);hp.add(ring);hp.add(new THREE.Mesh(B(0.6,0.1,0.9,0,0.05,0.2),MAT.darkMetal));
    hp.position.set(cx,0,zz0+0.5);sc.add(hp);colliders.push([cx-0.5,cx+0.5,zz0,zz0+1.1]);
    const p=items[1];const hit=new THREE.Mesh(B(1.2,3.4,1,0,1.7,0.2),new THREE.MeshBasicMaterial({visible:false}));hit.position.copy(hp.position);hit.userData.prod=p;sc.add(hit);pick.push(hit);}
   // стол с экипировкой
   const tx=cx+w/4,tz=zz0+1.0;const tb=new THREE.Mesh(B(1.8,0.8,0.8,0,0.4,0),new THREE.MeshStandardMaterial({color:LIN('#f2f0ec'),roughness:.5}));tb.position.set(tx,0,tz);sc.add(tb);colliders.push([tx-1,tx+1,tz-0.5,tz+0.5]);
   for(let j=0;j<4;j++){const p=items[1+j%4];addInst('shoe',tx-0.6+j*0.4,0.8,tz,Math.PI/2,p.color,p);}}
  else if(lay==='bikes'){const nPer=Math.max(2,Math.floor((w-0.6)/1.25));for(let row=0;row<2;row++){const bz=zz0+1+row*Math.max(1.6,(d-2)/1);if(bz>zz1-0.5)break;
    for(let j=0;j<nPer;j++){const p=items[j%3];const bx=zx0+0.7+j*1.25;addInst('bike',bx,0,bz,Math.PI/2,p.color,p);}colliders.push([zx0+0.1,zx0+0.7+nPer*1.25,bz-0.65,bz+0.65]);}}
  else if(lay==='fitness'){// стойки с гантелями и скамья
   [cz-d/4,cz+d/6].forEach((rz,ri)=>{const len=Math.min(3,w-0.8);const g=new THREE.Group();g.add(new THREE.Mesh(B(len,0.06,0.5,0,0.5,0),MAT.darkMetal));g.add(new THREE.Mesh(B(len,0.06,0.5,0,0.9,0),MAT.darkMetal));[-len/2,len/2].forEach(px=>g.add(new THREE.Mesh(B(0.06,0.95,0.5,px,0.47,0),MAT.darkMetal)));g.position.set(cx,0,rz);sc.add(g);colliders.push([cx-len/2-0.1,cx+len/2+0.1,rz-0.35,rz+0.35]);
    for(let k=0;k<2;k++)for(let j=0;j<Math.floor(len/0.45);j++){const p=items[0];addInst('dumbbell',cx-len/2+0.25+j*0.45,0.6+k*0.4,rz,0,ri?'#3b3f45':'#e0b23a',p);}});
   const bench=new THREE.Group();bench.add(new THREE.Mesh(B(1.3,0.08,0.34,0,0.46,0),new THREE.MeshStandardMaterial({color:LIN('#1f2226')})));bench.add(new THREE.Mesh(B(0.08,0.44,0.3,-0.5,0.22,0),MAT.metal));bench.add(new THREE.Mesh(B(0.08,0.44,0.3,0.5,0.22,0),MAT.metal));
   const bx=cx+w/4,bz=zz1-0.8;bench.position.set(bx,0,bz);sc.add(bench);colliders.push([bx-0.7,bx+0.7,bz-0.25,bz+0.25]);const hit=new THREE.Mesh(B(1.3,0.6,0.4,0,0.3,0),new THREE.MeshBasicMaterial({visible:false}));hit.position.copy(bench.position);hit.userData.prod=items[5];sc.add(hit);pick.push(hit);
   // коврики
   for(let j=0;j<3;j++){const p=items[1];const m=new THREE.Mesh(CyX(0.08,0.6,0,0.08,0,12),new THREE.MeshStandardMaterial({color:LIN(PALETTE[j+2]),roughness:.8}));m.position.set(cx-w/4+j*0.3,0,zz1-0.8);m.userData.prod=p;sc.add(m);pick.push(m);}}
  else if(lay==='counters'){const n=Math.max(1,Math.floor((d-0.8)/2));for(let k=0;k<n;k++){const vz=zz0+1+k*2,len=Math.min(3.4,w-1);
    const base=new THREE.Mesh(B(len,0.9,0.6,0,0.45,0),new THREE.MeshStandardMaterial({color:LIN(SX&&ST.table||'#f2f0ec'),roughness:.4}));base.position.set(cx,0,vz);sc.add(base);
    const gl=new THREE.Mesh(B(len,0.3,0.6,0,1.05,0),new THREE.MeshStandardMaterial({color:LIN('#dcecf2'),transparent:true,opacity:.25,roughness:.02,metalness:.6}));gl.position.set(cx,0,vz);sc.add(gl);colliders.push([cx-len/2-0.1,cx+len/2+0.1,vz-0.4,vz+0.4]);
    [-0.14,0.14].forEach(dz=>fillRow(cx-len/2+0.15,cx+len/2-0.1,(x,p)=>addInst(p.model,x,0.91,vz+dz,0,p.color,p,p.scale)));}
   wallUnit(cx,zz1-0.3,Math.PI,Math.min(4,w-0.4));}
  else if(lay==='tables'){const n=Math.max(1,Math.floor((d-0.6)/1.8));for(let k=0;k<n;k++){const tz=zz0+0.9+k*1.8,len=Math.min(2.4,w-1);
    const tb=new THREE.Mesh(B(len,0.85,0.9,0,0.425,0),new THREE.MeshStandardMaterial({color:LIN(SX&&ST.table||'#e9e4dc'),roughness:.4}));tb.position.set(cx,0,tz);sc.add(tb);colliders.push([cx-len/2-0.15,cx+len/2+0.15,tz-0.55,tz+0.55]);
    const rows=(SLOT[dep.model]||0.3)>0.35?[0]:[-0.2,0.2];rows.forEach(dz=>fillRow(cx-len/2+0.15,cx+len/2-0.1,(x,p)=>addInst(p.model,x,0.86,tz+dz,0,p.color,p,p.scale)));}}
  else if(lay==='floor'){const m=dep.model;const sx=m==='sofa'?2.6:m==='bed'?2.3:m==='appliance'?1.0:1.2,sz=m==='sofa'?1.6:m==='bed'?2.6:m==='appliance'?1.0:1.2;
   const nx=Math.max(1,Math.floor(w/sx)),nz=Math.max(1,Math.floor(d/sz));for(let a=0;a<nx;a++)for(let b=0;b<nz;b++){if(nx*nz>1&&(a+b)%2&&m!=='appliance'&&m!=='toy')continue;const p=next();const px=zx0+sx/2+a*sx,pz=zz0+sz/2+b*sz;addInst(p.model,px,0,pz,0,p.color,p,p.model==='toy'?2.2:1);
    const hw=(m==='sofa'?1.15:m==='bed'?0.9:m==='appliance'?0.35:0.3),hd=(m==='sofa'?0.5:m==='bed'?1.1:0.35);colliders.push([px-hw,px+hw,pz-hd,pz+hd]);}}
  else if(lay==='cafe'){// стойка, меню, столики
   const cxz=zz0+0.6;const ct=new THREE.Mesh(B(Math.min(5,w-1),1.1,0.8,0,0.55,0),new THREE.MeshStandardMaterial({color:LIN('#3b2f28'),roughness:.5}));ct.position.set(cx,0,cxz);sc.add(ct);colliders.push([cx-Math.min(5,w-1)/2-0.1,cx+Math.min(5,w-1)/2+0.1,cxz-0.5,cxz+0.5]);
   const menuT=canvasTex(512,256,(g,W_,H_)=>{g.fillStyle='#1f1b18';g.fillRect(0,0,W_,H_);g.fillStyle='#fff';g.font='800 30px Manrope, sans-serif';g.fillText('Меню',24,40);g.font='600 22px Manrope, sans-serif';items.forEach((it,i)=>{g.fillStyle='#eee';g.fillText(it.name,24,80+i*28);});g.fillStyle='#b9b2aa';g.font='600 18px Manrope, sans-serif';g.fillText('Цены — на кассе',24,H_-18);});
   const mb=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.6),new THREE.MeshBasicMaterial({map:menuT,toneMapped:false}));mb.position.set(cx,2.6,-D/2+0.05);sc.add(mb);mb.userData.prod=items[0];pick.push(mb);
   for(let j=0;j<5;j++){const p=items[j];addInst('cup',cx-1.5+j*0.7,1.1,cxz,0,'#ffffff',p);}
   const nT=Math.max(1,Math.floor(w/2.2)),rowsT=Math.max(1,Math.floor((d-2)/2.2));for(let a=0;a<nT;a++)for(let b=0;b<rowsT;b++){const tx=zx0+1.1+a*2.2,tz=cxz+2+b*2.2;if(tz>zz1)continue;
    const t=new THREE.Group();t.add(new THREE.Mesh(Cy(0.4,0.4,0.04,0,0.74,0,20),MAT.white));t.add(new THREE.Mesh(Cy(0.04,0.04,0.72,0,0.36,0,8),MAT.darkMetal));
    [[0.6,0],[-0.6,0]].forEach(([ox])=>{t.add(new THREE.Mesh(B(0.42,0.05,0.42,ox,0.45,0),new THREE.MeshStandardMaterial({color:LIN('#8a6a4a')})));t.add(new THREE.Mesh(B(0.42,0.5,0.05,ox+Math.sign(ox)*0.2,0.7,0).rotateY(Math.PI/2),new THREE.MeshStandardMaterial({color:LIN('#8a6a4a')})));});
    t.position.set(tx,0,tz);sc.add(t);colliders.push([tx-0.9,tx+0.9,tz-0.45,tz+0.45]);addInst('cup',tx+0.12,0.76,tz,0,'#ffffff',items[a%items.length]);}}
 });
 if(SX&&ST.floorPlan)shopFloorPlan(sc,ST.floorPlan,W,D,zones,{x0,x1,z0,z1,cols,rows,zw,zd,dw:DWs},s);
 // вешалки-плечики для одежды, ценники у товаров на полках и столах
 {const hangers=[],tags=[];
  Object.values(pinst).forEach(arr=>arr.forEach(o=>hangers.push({x:o.x,y:o.top,z:o.z,ry:o.ry+Math.PI/2})));
  Object.entries(inst).forEach(([model,arr])=>arr.forEach(o=>{if(GARM[model])hangers.push(o);else if(o.y>0.3&&!['bike','sofa','bed','appliance','cup','football','basketball'].includes(model))tags.push(o);}));
  const hg=mergeG([CyX(0.008,0.42,0,0,0,6),Cy(0.006,0.006,0.1,0,0.05,0,6)]);hg.rotateY(Math.PI/2);const him=new THREE.InstancedMesh(hg,SX&&ST.key==='wood'?new THREE.MeshStandardMaterial({color:LIN('#c9a477'),roughness:.5}):MAT.metal,Math.max(1,hangers.length));
  const q=new THREE.Quaternion();hangers.forEach((o,i)=>{q.setFromAxisAngle(new V3(0,1,0),o.ry);mtx.compose(new V3(o.x,o.y,o.z),q,new V3(1,1,1));him.setMatrixAt(i,mtx);});sc.add(him);
  const tg=B(0.07,0.035,0.004,0,-0.01,0);const tim=new THREE.InstancedMesh(tg,new THREE.MeshBasicMaterial({color:LIN('#ffffff')}),Math.max(1,tags.length));
  tags.forEach((o,i)=>{q.setFromAxisAngle(new V3(0,1,0),o.ry);const fx=Math.sin(o.ry)*0.2,fz=Math.cos(o.ry)*0.2;mtx.compose(new V3(o.x+fx,o.y,o.z+fz),q,new V3(1,1,1));tim.setMatrixAt(i,mtx);});sc.add(tim);}
 // примерочная (в зале одежды манекенов нет: окрашенная фигура вместо одетой вещи только путала)
 let fit=null;{
  if(zones.some(z=>z.dep.lay==='racks'||z.dep.items.some(p=>FIT.isWearable(p))))fit=buildFittingBooth(sc,s,W,D,brand,brandHex,colliders,pick);}
 // инстансы товаров
 const M=models();const byModel={};
 Object.entries(inst).forEach(([model,arr])=>{
  const q=new THREE.Quaternion(),sc_=new V3(),prods=arr.map(o=>o.prod);byModel[model]=arr;
  (M[model]||M.box).forEach(pt=>{const im=new THREE.InstancedMesh(pt.g,MOD.partMat(pt),arr.length);
   arr.forEach((o,i)=>{q.setFromAxisAngle(new V3(0,1,0),o.ry);sc_.setScalar(o.scale);mtx.compose(new V3(o.x,o.y,o.z),q,sc_);im.setMatrixAt(i,mtx);if(pt.tint)im.setColorAt(i,LIN(o.color));});
   if(im.instanceColor)im.instanceColor.needsUpdate=true;im.userData.prods=prods;sc.add(im);pick.push(im);});});
 // вещи на фото
 Object.entries(pinst).forEach(([k,arr])=>{const im=new THREE.InstancedMesh(photoGeo(k),photoMat(k),arr.length);const q=new THREE.Quaternion();
  arr.forEach((o,i)=>{q.setFromAxisAngle(new V3(0,1,0),o.ry);mtx.compose(new V3(o.x,o.y,o.z),q,new V3(1,1,1));im.setMatrixAt(i,mtx);});
  im.userData.prods=arr.map(o=>o.prod);sc.add(im);pick.push(im);});
 if(SX)shopDecor(sc,ST,W,D,H,colliders,DWs,s);
 // несколько покупателей
 {const parts=humanParts();const n=big?8:4;const r=mulberry(s.id+5);const mats=[new THREE.MeshStandardMaterial({roughness:.8}),new THREE.MeshStandardMaterial({roughness:.8}),new THREE.MeshStandardMaterial({roughness:.8}),new THREE.MeshStandardMaterial({roughness:.6})];
  const ms=[parts.torso,parts.legs,parts.arms,parts.head].map((g,i)=>new THREE.InstancedMesh(g,mats[i],n));const cl=['#2f3a4a','#8a3b3b','#3f5e4a','#c9b79c','#4d4f7c'],sk=['#e6c3a5','#c6946b','#f0d2bb'];
  const ppl=[];for(let i=0;i<n;i++){let x,z,t=0;do{x=(r()-.5)*(W-3);z=(r()-.5)*(D-3);t++;}while(shopBlockedRaw(colliders,W,D,x,z,0)&&t<100);ppl.push({x,z,tx:x,tz:z,a:r()*6,sp:0.7+r()*0.5,wait:r()*3,ph:r()*6});
   ms[0].setColorAt(i,LIN(cl[i%cl.length]));ms[2].setColorAt(i,LIN(cl[i%cl.length]));ms[1].setColorAt(i,LIN('#2c3440'));ms[3].setColorAt(i,LIN(sk[i%sk.length]));}
  ms.forEach(m=>{if(m.instanceColor)m.instanceColor.needsUpdate=true;sc.add(m);});
  app.SHOP_PEOPLE={list:ppl,meshes:ms,r};}
 return{s,scene:sc,colliders,pick,zones,W,D,cat,dw:DWs,leaves:[lv1,lv2],doorOpen:0,fit};}

// по порядку, при запуске
export function init() {

/* ---------- Зал магазина ---------- */
app.SHOP = null;// текущий магазин {s,scene,col,pick,zones,W,D,exit}
shopStyle = new URLSearchParams(location.search).get('shop')||'auto';
}
