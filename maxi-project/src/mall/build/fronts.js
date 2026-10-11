// Фасады помещений этажа: витрины, интерьер за стеклом, световые короба, вывески, двери, крыша для вида сверху.
import * as THREE from 'three';
import {mulberry} from '../../core/utils.js';
import {PHOTOS} from '../../shop/catalog.js';
import {LIN, V3} from '../../core/helpers.js';
import {humanParts} from '../people-parts.js';
import {G, MAT, brandCol, mtx, pickables, rayDist, world} from '../world.js';
import {clearance, inPoly, isFloorF} from '../../nav/walkgrid.js';
import {Merger, flatShape} from '../../render/merger.js';
import {MERGED} from '../../render/scene.js';
import {CH_, CW_, bladeAtlases, labelAtlases, signAtlases} from '../../render/sign-atlases.js';
import {WEAR_COLS, aoTex, pictoAtlas, pictoUV, shelfAtlas, shelfUV} from '../../render/textures.js';
import {photoGeo, photoKeysFor, photoMat} from '../../shop/goods.js';
import {doors, nearWC, wood} from './floor.js';

 export function fronts(F,list){
  const y0=F.y0,GH_=F.GH,FH=F.FH,TOP=y0+FH;const grp=G(F.group);
  const tint=new Merger(),fascia=new Merger(),walls=new Merger(),interior=new Merger(),inWalls=new Merger(),inFloor=new Merger(),inCeil=new Merger(),lights=new Merger(),glass=new Merger(),mull=new Merger(),ao=new Merger(),mats=new Merger(),posters=new Merger();
  const signs=signAtlases.map(()=>new Merger()),labels=labelAtlases.map(()=>new Merger()),blades=bladeAtlases.map(()=>new Merger()),brandM=new Merger();
  const CEIL=LIN('#f4f3f0');const fixtures=[],mannequins=[],winPhotos=[],fixturesPosts=[],fixturesBars=[];
  // открытый островок: прилавок по периметру, стойки по углам, фриз на половине высоты, без стекла и потолка
  function islandBooth(s){const P=s.poly,HI=FH/2,cCol=LIN('#e6e1d8'),topCol=LIN('#f7f5f1'),fasC=LIN('#c9a27a');let best=null;
   const ctr=P.reduce((a,p)=>[a[0]+p[0]/P.length,a[1]+p[1]/P.length],[0,0]);
   for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<0.3)continue;
    const t=new V3((b[0]-a[0])/L,0,(b[1]-a[1])/L);let n=new V3(-t.z,0,t.x);const mid=new V3((a[0]+b[0])/2,y0,(a[1]+b[1])/2);
    if(inPoly(P,mid.x+n.x*0.3,mid.z+n.z*0.3))n.negate();
    const at=(dx,y)=>{mtx.makeRotationY(-Math.atan2(t.z,t.x));mtx.setPosition(mid.x-n.x*dx,y,mid.z-n.z*dx);return mtx;};
    walls.add(new THREE.BoxGeometry(L,1.0,0.5),()=>cCol,s.id,at(0.25,y0+0.5));
    walls.add(new THREE.BoxGeometry(L+0.04,0.05,0.58),()=>topCol,s.id,at(0.27,y0+1.025));
    fascia.panel(mid.clone().addScaledVector(n,0.02),n,L,y0+HI-0.55,y0+HI,[0,0,1,1],fasC,s.id);
    fascia.panel(mid.clone().addScaledVector(n,-0.06),n.clone().negate(),L,y0+HI-0.55,y0+HI,[0,0,1,1],fasC,s.id);
    mtx.makeTranslation(a[0],y0+HI/2,a[1]);mull.add(new THREE.BoxGeometry(0.09,HI,0.09),null,null,mtx);
    // у островка с названием — вывеска на каждой стороне фриза
    if(s.cat!=='tbd'&&s.uv&&L>=1.2){const sw=Math.min(L*0.86,3.2),sh=Math.min(0.42,sw/7);signs[s.atlas].panel(mid.clone().addScaledVector(n,0.04),n,sw,y0+HI-0.275-sh/2,y0+HI-0.275+sh/2,s.uv,null,s.id);}
    if(!best||L>best.L)best={L,mid,n};}
   // в середине — стол с товаром
   if(s.area>=4){walls.add(new THREE.BoxGeometry(0.9,0.75,0.6),()=>topCol,s.id,mtx.makeTranslation(ctr[0],y0+0.375,ctr[1]));}
   if(best){s.fp=best.mid.clone().addScaledVector(best.n,0.02);s.fn=best.n.clone();}}
  list.forEach(s=>{
   if(s.island){islandBooth(s);return;}
   // крыша помещения (цвет для вида сверху)
   try{tint.add(flatShape(s.poly,TOP+0.02+Math.max(0,(3000-s.area))/3000*0.03),()=>s.col,s.id);}catch(e){}
   const wallCol=LIN('#d9d4cc'),inCol=s.col.clone().lerp(LIN('#f1eee8'),0.82),fasCol=s.cat==='tbd'?LIN('#d6d3cd'):LIN(['#ebe8e2','#e4e0d8','#eeece7','#dedad2'][s.id%4]);
   const P=s.poly;let best=null;const rnd=mulberry(s.id*7+F.f);
   const depth0=Math.max(1.6,Math.min(5,Math.sqrt(s.area)*0.45));
   // главная витрина (самая длинная сторона в коридор) — в ней будет вход
   let doorEdge=-1,doorL=0,doorU=0;
   const isWC=s.cat==='wc';
   if(s.cat!=='tbd'&&!isWC){for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<2.6)continue;const tx=(b[0]-a[0])/L,tz=(b[1]-a[1])/L,mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
    if(nearWC(F.f,mx,mz))continue;
    const w1=isFloorF(F.f,mx-tz*0.7,mz+tx*0.7),w2=isFloorF(F.f,mx+tz*0.7,mz-tx*0.7);if(w1===w2||L<=doorL)continue;
    // перед дверью должно быть просторно, иначе в неё не войти: ищем такое место вдоль витрины, ближе к середине
    const sg=w1?1:-1,dw=Math.min(2.8,Math.max(1.8,L*0.45),L-0.4),us=[];for(let u=dw/2+0.2;u<=L-dw/2-0.2+1e-6;u+=0.4)us.push(u);if(!us.length)us.push(L/2);us.sort((p,q)=>Math.abs(p-L/2)-Math.abs(q-L/2));
    const ok=us.find(u=>{const px=a[0]+tx*u,pz=a[1]+tz*u;return isFloorF(F.f,px-tz*0.7*sg,pz+tx*0.7*sg)&&clearance(F.f,px-tz*1.6*sg,pz+tx*1.6*sg,2)>=1.0;});
    if(ok==null)continue;doorL=L;doorEdge=i;doorU=ok;}}
   // запасной вариант: магазин касается коридора только углом или через узкую полосу стены —
   // дверь в ближайшей к коридору стене, короткий проход до коридора (не длиннее 2,4 м)
   let doorGap=0,doorSg=0;
   if(doorEdge<0&&s.cat!=='tbd'&&!isWC){let bestG=9;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<2.2)continue;
     const tx=(b[0]-a[0])/L,tz=(b[1]-a[1])/L,mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;if(nearWC(F.f,mx,mz))continue;const sg=inPoly(P,mx-tz*0.3,mz+tx*0.3)?-1:1;
     const dw=Math.min(2.8,Math.max(1.8,L*0.45),L-0.4),us=[];for(let u=dw/2+0.2;u<=L-dw/2-0.2+1e-6;u+=0.4)us.push(u);if(!us.length)us.push(L/2);
     for(const u of us){const px=a[0]+tx*u,pz=a[1]+tz*u;for(let r=0.3;r<=2.4&&r<bestG;r+=0.15){const qx=px-tz*r*sg,qz=pz+tx*r*sg;
      if(isFloorF(F.f,qx,qz)&&clearance(F.f,px-tz*(r+1.0)*sg,pz+tx*(r+1.0)*sg,2)>=1.0){bestG=r;doorEdge=i;doorL=L;doorU=u;doorGap=r;doorSg=sg;break;}}}}}
   const DW=Math.min(2.8,Math.max(1.8,doorL*0.45),doorL-0.4);
   // туалет: закрытая комната, проём — в стороне, обращённой к проходу (снаружи), внутрь не заходим
   let wcEdge=-1;if(isWC){let bl=0;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1.2||L<=bl)continue;
     const tx=(b[0]-a[0])/L,tz=(b[1]-a[1])/L,mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
     if(isFloorF(F.f,mx-tz*0.7,mz+tx*0.7)!==isFloorF(F.f,mx+tz*0.7,mz-tx*0.7)){bl=L;wcEdge=i;}}}
   for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];const A=new V3(a[0],y0,a[1]),B=new V3(b[0],y0,b[1]);const L=A.distanceTo(B);if(L<0.05)continue;
    const t=new V3().subVectors(B,A).divideScalar(L);let n=new V3(-t.z,0,t.x);const mid=A.clone().lerp(B,.5);
    const isDoor=i===doorEdge,du0=doorU-DW/2,du1=doorU+DW/2;
    if(isWC){const nn=new V3(-t.z,0,t.x),wcCol=LIN('#d3d9dc');
     if(i!==wcEdge){walls.panel(mid,nn,L,y0,TOP,[0,0,1,1],wcCol,s.id);walls.panel(mid,nn.clone().negate(),L,y0,TOP,[0,0,1,1],wcCol,s.id);continue;}
     const w1=isFloorF(F.f,mid.x+nn.x*0.7,mid.z+nn.z*0.7),out=w1?nn.clone():nn.clone().negate(),Rt=new V3(out.z,0,-out.x);
     const ow=Math.min(1.7,L-0.7),o0=L/2-ow/2,o1=L/2+ow/2,HD=2.5,deep=0.6,dark=LIN('#20262b');
     [[0,o0],[o1,L]].forEach(([q0,q1])=>{const cc=A.clone().addScaledVector(t,(q0+q1)/2);walls.panel(cc,nn,q1-q0,y0,TOP,[0,0,1,1],wcCol,s.id);walls.panel(cc,nn.clone().negate(),q1-q0,y0,TOP,[0,0,1,1],wcCol,s.id);});
     const oc=A.clone().addScaledVector(t,L/2);
     walls.panel(oc,out,ow,y0+HD,TOP,[0,0,1,1],wcCol,s.id);walls.panel(oc,out.clone().negate(),ow,y0+HD,TOP,[0,0,1,1],wcCol,s.id);
     inWalls.panel(oc.clone().addScaledVector(out,-deep),out,ow,y0,y0+HD,[0,0,1,1],dark,s.id);
     [-1,1].forEach(sg=>inWalls.panel(oc.clone().addScaledVector(t,sg*ow/2).addScaledVector(out,-deep/2),t.clone().multiplyScalar(-sg),deep,y0,y0+HD,[0,0,1,1],dark,s.id));
     const fl=(u,v)=>new V3(oc.x+t.x*u+out.x*v,y0+0.024,oc.z+t.z*u+out.z*v);
     mats.quad(fl(ow/2,-deep),fl(-ow/2,-deep),fl(-ow/2,0.4),fl(ow/2,0.4),[0,0,1,1]);
     const ps=0.8,pc=oc.clone().addScaledVector(out,0.03);posters.panel(pc,out,ps,y0+HD+0.3,y0+HD+0.3+ps,pictoUV('wc'),null,s.id);
     mull.add(new THREE.BoxGeometry(ow+0.16,0.1,0.14),null,null,mtx.makeRotationY(Math.atan2(out.x,out.z)).setPosition(oc.x+out.x*0.04,y0+HD,oc.z+out.z*0.04));
     [-1,1].forEach(sg=>{const pp=oc.clone().addScaledVector(t,sg*ow/2);mull.add(new THREE.BoxGeometry(0.1,HD,0.1),null,null,mtx.makeTranslation(pp.x+out.x*0.04,y0+HD/2,pp.z+out.z*0.04));});
     if(!best||L>best.L)best={L,mid,n:out,t};continue;}
    const w1=L>=0.9&&isFloorF(F.f,mid.x+n.x*0.7,mid.z+n.z*0.7),w2=L>=0.9&&isFloorF(F.f,mid.x-n.x*0.7,mid.z-n.z*0.7);
    const forced=isDoor&&doorGap>0;if(forced&&doorSg<0)n.negate();
    if(w1===w2&&!forced){ // глухая стена между помещениями / наружу / над проёмом
     const nn=new V3(-t.z,0,t.x);walls.panel(mid,nn,L,y0,TOP,[0,0,1,1],wallCol,s.id);walls.panel(mid,nn.clone().negate(),L,y0,TOP,[0,0,1,1],wallCol,s.id);
     continue;}
    if(w2&&!forced)n.negate();
    const pieces=Math.max(1,Math.round(L/5));const pw=L/pieces;
    for(let k=0;k<pieces;k++){const c=A.clone().lerp(B,(k+.5)/pieces);
     // глубина интерьера не больше реальной глубины помещения
     let depth=depth0;{const Rt=new V3(n.z,0,-n.x);for(const f of [-0.45,0,0.45]){const o=c.clone().addScaledVector(Rt,f*pw).addScaledVector(n,-0.02);depth=Math.min(depth,rayDist(P,o.x,o.z,-n.x,-n.z)-0.15);}}
     depth=Math.max(0.5,depth);
     // фриз над витриной
     fascia.panel(c.clone().addScaledVector(n,0.02),n,pw,y0+GH_,TOP,[0,0,1,1],fasCol,s.id);
     // тонкая линия подсветки под фризом — единственный цветовой акцент
     if(s.cat!=='tbd')fascia.panel(c.clone().addScaledVector(n,0.035),n,pw,y0+GH_+0.1,y0+GH_+0.16,[0,0,1,1],s.col.clone().lerp(new THREE.Color(1,1,1),0.25),s.id);
     const u0=k*pw,u1=(k+1)*pw;
     const segs=isDoor?[[u0,Math.min(u1,du0)],[Math.max(u0,du1),u1]].filter(q=>q[1]-q[0]>0.05):[[u0,u1]];
     segs.forEach(([q0,q1])=>{const cc=A.clone().addScaledVector(t,(q0+q1)/2).addScaledVector(n,0.02);glass.panel(cc,n,q1-q0,y0+0.02,y0+GH_,[0,0,1,1],null,s.id);});
     if(isDoor&&u0<du1&&u1>du0){const q0=Math.max(u0,du0),q1=Math.min(u1,du1);const cc=A.clone().addScaledVector(t,(q0+q1)/2).addScaledVector(n,0.02);glass.panel(cc,n,q1-q0,y0+2.75,y0+GH_,[0,0,1,1],null,s.id);}
     const e0=A.clone().addScaledVector(t,u0);
     if(!(isDoor&&u0>du0-0.1&&u0<du1+0.1)){mtx.makeTranslation(e0.x,y0+GH_/2,e0.z);mull.add(new THREE.BoxGeometry(0.07,GH_,0.07),null,null,mtx);}
     mtx.makeRotationY(Math.atan2(n.x,n.z));mtx.setPosition(c.x+n.x*0.02,y0+GH_,c.z+n.z*0.02);mull.add(new THREE.BoxGeometry(pw,0.08,0.09),null,null,mtx);
     mtx.makeRotationY(Math.atan2(n.x,n.z));mtx.setPosition(c.x+n.x*0.03,y0+0.06,c.z+n.z*0.03);mull.add(new THREE.BoxGeometry(pw,0.12,0.06),null,null,mtx);
     // интерьер за стеклом: задняя стена со стеллажами, боковые стены, пол, потолок со светом
     const back=c.clone().addScaledVector(n,-depth);
     interior.panel(back,n,pw,y0,y0+GH_+0.3,shelfUV(s.cat),null,s.id);
     const R=new V3(n.z,0,-n.x);
     const sL=c.clone().addScaledVector(R,-pw/2).addScaledVector(n,-depth/2),sR=c.clone().addScaledVector(R,pw/2).addScaledVector(n,-depth/2);
     if(k===0)inWalls.panel(sL,R,depth,y0,y0+GH_+0.3,[0,0,1,1],inCol,s.id);
     if(k===pieces-1)inWalls.panel(sR,R.clone().negate(),depth,y0,y0+GH_+0.3,[0,0,1,1],inCol,s.id);
     const f0=c.clone().addScaledVector(R,-pw/2),f1=c.clone().addScaledVector(R,pw/2),b0=f0.clone().addScaledVector(n,-depth),b1=f1.clone().addScaledVector(n,-depth);
     inFloor.quad(new V3(f0.x,y0+0.012,f0.z),new V3(f1.x,y0+0.012,f1.z),new V3(b1.x,y0+0.012,b1.z),new V3(b0.x,y0+0.012,b0.z),[0,0,pw/1.2,depth/1.2],null,s.id);
     const cy=y0+GH_+0.3;inCeil.quad(new V3(b0.x,cy,b0.z),new V3(b1.x,cy,b1.z),new V3(f1.x,cy,f1.z),new V3(f0.x,cy,f0.z),[0,0,1,1],CEIL,s.id);
     // линейные светильники
     for(let q=0;q<2;q++){const lc=c.clone().addScaledVector(n,-depth*(0.3+q*0.4));const l0=lc.clone().addScaledVector(R,-pw*0.35),l1=lc.clone().addScaledVector(R,pw*0.35);const h=0.09,ly=cy-0.02;
      lights.quad(new V3(l0.x-n.x*h,ly,l0.z-n.z*h),new V3(l1.x-n.x*h,ly,l1.z-n.z*h),new V3(l1.x+n.x*h,ly,l1.z+n.z*h),new V3(l0.x+n.x*h,ly,l0.z+n.z*h),[0,0,1,1]);}
     // стойки с товаром внутри
     const nearDoor=isDoor&&u0<du1+1.2&&u1>du0-1.2;
     const ph=photoKeysFor(s);
     if(false&&!nearDoor&&(s.cat==='fashion'||s.cat==='sport'||s.cat==='kids')&&depth>1.6&&pw>2.2){// манекены в витринах убраны: окрашенная фигура не показывала вещь
const Rm=new V3(n.z,0,-n.x);[-0.25,0.25].forEach((f,mi)=>{if(pw<3.5&&mi)return;const tops=ph.filter(q=>q!=='trousers_beige'),pc=tops.length?PHOTOS[tops[(mi+k)%tops.length]].color:null;mannequins.push({x:c.x-n.x*0.9+Rm.x*f*pw,z:c.z-n.z*0.9+Rm.z*f*pw,y:y0,a:Math.atan2(n.x,n.z),col:LIN(pc||WEAR_COLS[(s.id*3+mi*5+k)%WEAR_COLS.length])});});}
     // магазины одежды: в витрине висят настоящие вещи (фото) на вешале, а не условные коробки
     if(!nearDoor&&ph.length&&depth>2.2&&pw>2.4)winPhotos.push({x:c.x-n.x*depth*0.5,z:c.z-n.z*depth*0.5,y:y0,a:Math.atan2(n.x,n.z),R:new V3(n.z,0,-n.x),w:Math.min(2.2,pw*0.55),keys:ph,id:s.id});
     else if(!nearDoor&&s.cat!=='tbd'&&depth>2.2&&pw>2.4)fixtures.push({x:c.x-n.x*depth*0.45,z:c.z-n.z*depth*0.45,y:y0,a:Math.atan2(n.x,n.z),w:Math.min(1.6,pw*0.35),col:LIN(['#b9a489','#8f7a62','#d9d4cc','#6f6a64'][(s.id+k)%4]),cat:s.cat});
     // световой знак с пиктограммой категории — один на витрину, в стороне от двери
     if(!s._pic&&s.cat!=='tbd'&&pw>1.4&&depth>0.6&&!(isDoor&&u0<du1+0.6&&u1>du0-0.6)){s._pic=1;const ps=0.72,pc=c.clone().addScaledVector(n,-0.22);
      posters.panel(pc,n,ps,y0+GH_-1.05,y0+GH_-1.05+ps,pictoUV(s.cat),null,s.id);}
     // мягкая тень на полу у витрины (снаружи)
     const o0=c.clone().addScaledVector(R,-pw/2),o1=c.clone().addScaledVector(R,pw/2);
     ao.quad(new V3(o1.x,y0+0.02,o1.z),new V3(o0.x,y0+0.02,o0.z),new V3(o0.x+n.x*0.9,y0+0.02,o0.z+n.z*0.9),new V3(o1.x+n.x*0.9,y0+0.02,o1.z+n.z*0.9),[0,1,1,0]);
    }
    if(isDoor){const dc=A.clone().addScaledVector(t,doorU);s.door={c:dc,n:n.clone(),R:new V3(n.z,0,-n.x),w:DW,open:0,floor:F.f,gap:doorGap};doors.push(s);
     // рамка проёма, ригель над дверью, коврик
     [-1,1].forEach(sg=>{const pp=dc.clone().addScaledVector(s.door.R,sg*DW/2);mtx.makeTranslation(pp.x+n.x*0.03,y0+GH_/2,pp.z+n.z*0.03);mull.add(new THREE.BoxGeometry(0.12,GH_,0.12),null,null,mtx);});
     mtx.makeRotationY(Math.atan2(n.x,n.z));mtx.setPosition(dc.x+n.x*0.03,y0+2.7,dc.z+n.z*0.03);mull.add(new THREE.BoxGeometry(DW+0.1,0.1,0.14),null,null,mtx);
     const m0=dc.clone().addScaledVector(s.door.R,-DW/2),m1=dc.clone().addScaledVector(s.door.R,DW/2);
     mats.quad(new V3(m1.x+n.x*0.05,y0+0.022,m1.z+n.z*0.05),new V3(m0.x+n.x*0.05,y0+0.022,m0.z+n.z*0.05),new V3(m0.x+n.x*1.3,y0+0.022,m0.z+n.z*1.3),new V3(m1.x+n.x*1.3,y0+0.022,m1.z+n.z*1.3),[0,0,1,1]);
     if(s.sign){const mc=brandCol(s).multiplyScalar(0.8),e=0.12;const q0=m0.clone().addScaledVector(s.door.R,e),q1=m1.clone().addScaledVector(s.door.R,-e);
      brandM.quad(new V3(q1.x+n.x*0.17,y0+0.032,q1.z+n.z*0.17),new V3(q0.x+n.x*0.17,y0+0.032,q0.z+n.z*0.17),new V3(q0.x+n.x*1.18,y0+0.032,q0.z+n.z*1.18),new V3(q1.x+n.x*1.18,y0+0.032,q1.z+n.z*1.18),[0,0,1,1],mc,s.id);}}
    if(!best||L>best.L)best={L,mid,n,t};}
   if(best){s.fp=best.mid.clone().addScaledVector(best.n,0.02);s.fn=best.n.clone();
    if(!best.t)best.t=new V3(best.n.z,0,-best.n.x);
    if(s.cat!=='tbd'){const sw=Math.min(best.L-0.5,Math.max(2.6,Math.min(13,s.name.length*0.8+2))),sh=Math.min(1.5,sw/7,(FH-GH_)*0.7),sy=y0+(GH_+FH)/2;
    signs[s.atlas].panel(s.fp.clone().addScaledVector(best.n,0.05),best.n,sw,sy-sh/2,sy+sh/2,s.uv,null,s.id);
    if(s.sign){const bc=brandCol(s);
     // буквы на фризе — на панели фасада в цвете магазина
     if(s.sign.shape==='letters'){const ph=Math.min((FH-GH_)*0.78,sh*2.6+0.5);brandM.panel(s.fp.clone().addScaledVector(best.n,0.035),best.n,Math.min(best.L-0.2,sw+1.4),sy-ph/2,sy+ph/2,[0,0,1,1],LIN(s.sign.bg),s.id);}
     // полоса цвета бренда под фризом во всю главную витрину
     brandM.panel(best.mid.clone().addScaledVector(best.n,0.05),best.n,best.L,y0+GH_+0.02,y0+GH_+0.24,[0,0,1,1],bc,s.id);
     // консольная табличка поперёк коридора — у дальнего от двери края витрины
     if(best.L>=3.2){let sg=1;if(s.door){const dd=(s.door.c.x-best.mid.x)*best.t.x+(s.door.c.z-best.mid.z)*best.t.z;sg=dd>0?-1:1;}
      const base=best.mid.clone().addScaledVector(best.t,sg*(best.L/2-0.45)),yB=y0+GH_-0.1,yA=yB-0.72,bw=1.44,c=base.clone().addScaledVector(best.n,0.12+bw/2);
      blades[s.atlas].panel(c.clone().addScaledVector(best.t,0.012),best.t,bw,yA,yB,s.buv,null,s.id);
      blades[s.atlas].panel(c.clone().addScaledVector(best.t,-0.012),best.t.clone().negate(),bw,yA,yB,s.buv,null,s.id);
      const dk=LIN('#2a2d31');mtx.makeRotationY(Math.atan2(best.n.x,best.n.z));mtx.setPosition(c.x,yB+0.04,c.z);brandM.add(new THREE.BoxGeometry(0.05,0.05,bw+0.12),()=>dk,s.id,mtx);
      mtx.makeRotationY(Math.atan2(best.n.x,best.n.z));mtx.setPosition(base.x+best.n.x*0.06,yB-0.3,base.z+best.n.z*0.06);brandM.add(new THREE.BoxGeometry(0.16,0.62,0.1),()=>dk,s.id,mtx);}}}}
   // подпись для вида сверху
   if(s.cat!=='tbd'&&s.lfs){const fs=s.lfs,ta=s.ltw/(fs*1.1);const ks=Object.keys(s.fit).map(Number).sort((a,b)=>a-b);
    let h=0,ang=0;for(const k of ks){if(k>=ta){[h,ang]=s.fit[k];break;}}
    if(!h){const k=ks[ks.length-1];h=s.fit[k][0]*k/ta;ang=s.fit[k][1];}
    h=Math.max(0.35,Math.min(3.4,h));
    const cellW=h*CW_/(fs*1.1),cellH=h*CH_/(fs*1.1);const U=new V3(Math.cos(ang),0,Math.sin(ang)),Vv=new V3(-Math.sin(ang),0,Math.cos(ang));
    const c=new V3(s.lp[0],TOP+0.08,s.lp[1]);const P0=(u,v)=>c.clone().addScaledVector(U,u).addScaledVector(Vv,v);
    labels[s.atlas].quad(P0(-cellW/2,cellH/2),P0(cellW/2,cellH/2),P0(cellW/2,-cellH/2),P0(-cellW/2,-cellH/2),s.uv,null,s.id);}
  });
  const tintMesh=tint.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6,side:THREE.DoubleSide}));grp.add(tintMesh);pickables.push(tintMesh);world.tint[F.f]=tintMesh;world.tintColors[F.f]=tintMesh.geometry.attributes.color.array.slice();
  const wm=walls.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7}));grp.add(wm);MERGED.walls.push(wm);
  const fm=fascia.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:.05}));grp.add(fm);pickables.push(fm);MERGED.fascia.push(fm);
  const inTex=interior.mesh(new THREE.MeshStandardMaterial({map:shelfAtlas,roughness:.8}));grp.add(inTex);pickables.push(inTex);MERGED.interior.push(inTex);
  const iw=inWalls.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85}));grp.add(iw);MERGED.inWalls.push(iw);
  const ifl=inFloor.mesh(new THREE.MeshStandardMaterial({map:wood,roughness:.35}));grp.add(ifl);MERGED.inFloor.push(ifl);
  const ic=inCeil.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9}));grp.add(ic);MERGED.inCeil.push(ic);
  grp.add(lights.mesh(MAT.light));
  if(posters.p.length){const pm=posters.mesh(new THREE.MeshBasicMaterial({map:pictoAtlas,toneMapped:false}));grp.add(pm);pickables.push(pm);}
  const glassMesh=glass.mesh(MAT.glass);glassMesh.renderOrder=2;grp.add(glassMesh);pickables.push(glassMesh);
  grp.add(mull.mesh(MAT.darkMetal));
  grp.add(ao.mesh(new THREE.MeshBasicMaterial({map:aoTex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2})));
  grp.add(mats.mesh(new THREE.MeshStandardMaterial({color:LIN('#2c2f33'),roughness:.95,polygonOffset:true,polygonOffsetFactor:-2})));
  signs.forEach((m,i)=>{if(!m.p.length)return;const mesh=m.mesh(new THREE.MeshBasicMaterial({map:signAtlases[i],toneMapped:false,transparent:true,alphaTest:.02}));grp.add(mesh);pickables.push(mesh);});
  blades.forEach((m,i)=>{if(!m.p.length)return;const mesh=m.mesh(new THREE.MeshBasicMaterial({map:bladeAtlases[i],toneMapped:false,side:THREE.DoubleSide}));grp.add(mesh);pickables.push(mesh);});
  if(brandM.p.length){const bm=brandM.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5}));grp.add(bm);pickables.push(bm);}
  labels.forEach((m,i)=>{if(!m.p.length)return;const mesh=m.mesh(new THREE.MeshBasicMaterial({map:labelAtlases[i],transparent:true,depthWrite:false,toneMapped:false}));mesh.renderOrder=3;G('toplabels'+F.f).add(mesh);pickables.push(mesh);});
  // стойки с товаром внутри магазинов
  {const tg=new THREE.BoxGeometry(1,0.9,0.7);tg.translate(0,0.45,0);const top=new THREE.BoxGeometry(1,0.5,0.5);top.translate(0,1.15,0);
   const im1=new THREE.InstancedMesh(tg,new THREE.MeshStandardMaterial({color:LIN('#ece7df'),roughness:.5}),Math.max(1,fixtures.length));
   const im2=new THREE.InstancedMesh(top,new THREE.MeshStandardMaterial({roughness:.6}),Math.max(1,fixtures.length));
   const q=new THREE.Quaternion(),sc=new V3();
   fixtures.forEach((f,i)=>{q.setFromAxisAngle(new V3(0,1,0),f.a);sc.set(f.w,1,1);mtx.compose(new V3(f.x,f.y,f.z),q,sc);im1.setMatrixAt(i,mtx);
    sc.set(f.w*0.85,1,1);mtx.compose(new V3(f.x,f.y,f.z),q,sc);im2.setMatrixAt(i,mtx);im2.setColorAt(i,f.col);});
   im1.count=im2.count=fixtures.length;if(im2.instanceColor)im2.instanceColor.needsUpdate=true;grp.add(im1);grp.add(im2);}
  {// вещи-фото в витринах: вешало (две стойки и перекладина) и вещи лицом к галерее
   const byK={};winPhotos.forEach(W_=>{const L=W_.w,top=W_.y+1.95;
    const k0=W_.keys;const n_=Math.max(1,Math.min(4,Math.floor(L/0.62)));
    for(let i=0;i<n_;i++){const k=k0[i%k0.length],P=PHOTOS[k];const u=(i-(n_-1)/2)*(L/n_);(byK[k]=byK[k]||[]).push({x:W_.x+W_.R.x*u,z:W_.z+W_.R.z*u,y:top-P.h/2-0.06,a:W_.a,id:W_.id});}
    [-1,1].forEach(sg=>{const px=W_.x+W_.R.x*sg*L/2,pz=W_.z+W_.R.z*sg*L/2;fixturesPosts.push([px,W_.y,pz,top]);});
    fixturesBars.push([W_.x-W_.R.x*L/2,W_.z-W_.R.z*L/2,W_.x+W_.R.x*L/2,W_.z+W_.R.z*L/2,top]);});
   const q=new THREE.Quaternion();
   Object.entries(byK).forEach(([k,arr])=>{const im=new THREE.InstancedMesh(photoGeo(k),photoMat(k),arr.length);
    arr.forEach((o,i)=>{q.setFromAxisAngle(new V3(0,1,0),o.a);mtx.compose(new V3(o.x,o.y,o.z),q,new V3(1,1,1));im.setMatrixAt(i,mtx);});
    im.userData.kiosks=arr.map(o=>o.id);grp.add(im);pickables.push(im);});
   if(fixturesPosts.length){const pg=new THREE.CylinderGeometry(0.018,0.018,1,8);pg.translate(0,0.5,0);const pi_=new THREE.InstancedMesh(pg,MAT.metal,fixturesPosts.length);
    fixturesPosts.forEach(([x,y,z,t],i)=>{mtx.compose(new V3(x,y,z),new THREE.Quaternion(),new V3(1,t-y,1));pi_.setMatrixAt(i,mtx);});grp.add(pi_);
    const bg=new THREE.CylinderGeometry(0.014,0.014,1,8);bg.rotateZ(Math.PI/2);const bi=new THREE.InstancedMesh(bg,MAT.metal,fixturesBars.length);
    fixturesBars.forEach(([x0,z0,x1,z1,t],i)=>{const L=Math.hypot(x1-x0,z1-z0);q.setFromAxisAngle(new V3(0,1,0),-Math.atan2(z1-z0,x1-x0));mtx.compose(new V3((x0+x1)/2,t,(z0+z1)/2),q,new V3(L,1,1));bi.setMatrixAt(i,mtx);});grp.add(bi);}}
  {// манекены в витринах магазинов одежды
   const parts=humanParts();const N=Math.max(1,mannequins.length);const q=new THREE.Quaternion();
   const white=new THREE.MeshStandardMaterial({color:LIN('#f1efeb'),roughness:.25,metalness:.05});
   const torso=new THREE.InstancedMesh(parts.torso,new THREE.MeshStandardMaterial({roughness:.7}),N),legs=new THREE.InstancedMesh(parts.legs,white,N),head=new THREE.InstancedMesh(parts.head,white,N),arms=new THREE.InstancedMesh(parts.arms,white,N),stand=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22,0.22,0.03,16).translate(0,0.015,0),MAT.darkMetal,N);
   mannequins.forEach((m,i)=>{q.setFromAxisAngle(new V3(0,1,0),m.a);mtx.compose(new V3(m.x,m.y,m.z),q,new V3(1,1,1));[torso,legs,head,arms,stand].forEach(o=>o.setMatrixAt(i,mtx));torso.setColorAt(i,m.col);});
   [torso,legs,head,arms,stand].forEach(o=>{o.count=mannequins.length;grp.add(o);});if(torso.instanceColor)torso.instanceColor.needsUpdate=true;}
 }
