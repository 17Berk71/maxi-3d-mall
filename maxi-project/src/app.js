// Основное приложение: галерея ТРЦ, управление, магазины изнутри.
// Пока один большой модуль — план разбиения описан в CLAUDE.md.
import * as THREE from 'three';
import {mulberry,shade} from './utils.js';
import {SITES,siteOf,mapsOf,DEPT,deptsFor,PALETTE,catalogOf,fmtPrice,PHOTOS} from './shop/catalog.js';
import {iconURL} from './shop/icons.js';
import {LIFTS_PLAN} from './floor2.js';
import {describe} from './shop/describe.js';
import {cart} from './shop/cart.js';
import {createModels} from './shop/models.js';
import {makeStyler} from './styles.js';
import {makeFX} from './fx.js';
import {INTERIORS,pickInterior} from './shop/interiors.js';
import {signStyle,drawSign,drawBlade,FONT_LOADS} from './signs.js';
import {loadFeed,feedIndexReady,feedInfo,winKeys} from './shop/feeds.js';
import {onlineKind,onlineActions,onlineText,ACTIONS} from './shop/online.js';
import {PREFS,setPref} from './settings.js';
import {createFitting} from './shop/fitting.js';

export function startApp(D,D2){

const $=id=>document.getElementById(id);
const V3=THREE.Vector3;
const LIN=hex=>new THREE.Color(hex).convertSRGBToLinear();

/* ---------- Категории ---------- */
const CATS={
 fashion:{n:'Одежда и обувь',c:'#5a55d6',h:232,k:'одежда обувь джинсы куртка платье кроссовки костюм'},
 food:{n:'Кафе и еда',c:'#d9502b',h:14,k:'еда кафе кофе ресторан перекусить суши пекарня продукты'},
 beauty:{n:'Красота',c:'#e0588a',h:338,k:'косметика духи парфюм уход аптека'},
 acc:{n:'Украшения, часы, оптика',c:'#159a8f',h:172,k:'украшения золото серебро кольцо часы очки оптика подарок'},
 tech:{n:'Техника и связь',c:'#2a86c9',h:204,k:'телефон смартфон чехол зарядка связь сим техника apple iphone'},
 kids:{n:'Детям и развлечения',c:'#9b59d0',h:278,k:'дети детское игры аттракционы развлечения'},
 gifts:{n:'Сладости и подарки',c:'#c79a12',h:44,k:'сладости конфеты мармелад подарок'},
 furn:{n:'Мебель',c:'#a0703e',h:30,k:'мебель диван кровать матрас шкаф'},
 home:{n:'Дом и хобби',c:'#6f9a2f',h:86,k:'дом ремонт сад кухня посуда канцтовары зоотовары животные авто'},
 sport:{n:'Спорт',c:'#e57a1c',h:24,k:'спорт кроссовки тренировки протеин спортпит фитнес'},
 serv:{n:'Услуги',c:'#5d7fa3',h:212,k:'услуги банк ремонт ключи ателье'},
 misc:{n:'Другие магазины',c:'#7a7f99',h:236,k:'магазин'},
 wc:{n:'Туалеты',c:'#3a9bb0',h:192,k:'туалет wc уборная мужской женский'},
 tbd:{n:'Без подписи на картах',c:'#c3c9d0',h:0,k:''}
};

/* ---------- Проходимость: своя сетка у каждого этажа ---------- */
const GR=D.grid,CELL=GR.cell,GW=GR.W,GH=GR.H;
const raw=atob(GR.b64);const walk=new Uint8Array(GW*GH);
for(let i=0;i<raw.length;i++){const b=raw.charCodeAt(i);for(let k=0;k<8;k++){const j=i*8+k;if(j<walk.length)walk[j]=(b>>(7-k))&1;}}
const toPx=(x,z)=>[Math.floor((x-GR.x0)/CELL),Math.floor((z-GR.z0)/CELL)];
const fromPx=(i,j)=>[GR.x0+(i+.5)*CELL,GR.z0+(j+.5)*CELL];
// проёмы галереи — по карте второго этажа (над коридорами первого)
const voidPolys=D2.voids;
function inPoly(v,x,z){let ins=false;for(let i=0,j=v.length-1;i<v.length;j=i++){const a=v[i],b=v[j];if(((a[1]>z)!==(b[1]>z))&&(x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1]+1e-9)+a[0]))ins=!ins;}return ins;}
function inVoid(x,z){for(const v of voidPolys)if(inPoly(v,x,z))return true;return false;}
// чистка карты первого этажа: срезаем «усы» и щели уже ~1,3 м (артефакты разметки у витрин)
function openMask(m,r){const t=new Uint8Array(m.length),o=new Uint8Array(m.length);
 for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){let v=1;for(let dj=-r;dj<=r&&v;dj++)for(let di=-r;di<=r;di++){if(di*di+dj*dj>r*r+1)continue;const a=i+di,b=j+dj;if(a<0||b<0||a>=GW||b>=GH||!m[b*GW+a]){v=0;break;}}t[j*GW+i]=v;}
 for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){if(!m[j*GW+i])continue;let v=0;for(let dj=-r;dj<=r&&!v;dj++)for(let di=-r;di<=r;di++){if(di*di+dj*dj>r*r+1)continue;const a=i+di,b=j+dj;if(a>=0&&b>=0&&a<GW&&b<GH&&t[b*GW+a]){v=1;break;}}o[j*GW+i]=v;}
 return o;}
walk.set(openMask(walk,2));
const baseWalk=walk.slice();
// галерея второго этажа — из карты второго этажа (tools/pipeline/f2seg.py), та же сетка
function unpack(b64){const r=atob(b64),o=new Uint8Array(GW*GH);for(let i=0;i<r.length;i++){const b=r.charCodeAt(i);for(let k=0;k<8;k++){const j=i*8+k;if(j<o.length)o[j]=(b>>(7-k))&1;}}return o;}
const walk2=unpack(D2.walk.b64),hall2=unpack(D2.hall.b64);
const base2=walk2.slice();
const GRIDS={1:walk,2:walk2},BASES={1:baseWalk,2:base2};
let curFloor=1;
function isWalkF(f,x,z){const [i,j]=toPx(x,z);return i>=0&&j>=0&&i<GW&&j<GH&&GRIDS[f][j*GW+i]===1;}
function isWalkPx(i,j){return i>=0&&j>=0&&i<GW&&j<GH&&walk[j*GW+i]===1;}
function isWalk(x,z){return isWalkF(curFloor,x,z);}
function isFloorF(f,x,z){const [i,j]=toPx(x,z);return i>=0&&j>=0&&i<GW&&j<GH&&BASES[f][j*GW+i]===1;}
function isFloor(x,z){return isFloorF(1,x,z);}
function setRect(cx,cz,a,hl,hw,val,f){const g=GRIDS[f||1];const ca=Math.cos(a),sa=Math.sin(a),r=Math.hypot(hl,hw)/CELL+1;const [pi,pj]=toPx(cx,cz);
 for(let j=Math.floor(pj-r);j<=pj+r;j++)for(let i=Math.floor(pi-r);i<=pi+r;i++){if(i<0||j<0||i>=GW||j>=GH)continue;const [x,z]=fromPx(i,j);const dx=x-cx,dz=z-cz;const lx=dx*ca+dz*sa,lz=-dx*sa+dz*ca;if(Math.abs(lx)<=hl&&Math.abs(lz)<=hw)g[j*GW+i]=val;}}
function blockRect(cx,cz,a,hl,hw,f){setRect(cx,cz,a,hl,hw,0,f);}
// ближайшая свободная точка этажа где угодно (если рядом этажа нет)
// свободное место вокруг точки: расстояние до ближайшей стены/витрины (по исходной карте этажа), м
function clearance(f,x,z,maxM){const [pi,pj]=toPx(x,z),R=Math.ceil((maxM||5)/CELL);let best=(maxM||5);
 for(let j=-R;j<=R;j++)for(let i=-R;i<=R;i++){const a=pi+i,b=pj+j;const d=Math.hypot(i,j)*CELL;if(d>=best)continue;if(a<0||b<0||a>=GW||b>=GH||!BASES[f][b*GW+a])best=d;}return best;}
// колонна остаётся, только если вокруг неё просторно на обоих этажах и она не пробивает магазин второго этажа
function keepColumn(p){const [x,z]=p;if(!isFloorF(1,x,z)||clearance(1,x,z)<3.2)return false;
 const v=inVoid(x,z),f2=isFloorF(2,x,z);if(!v&&!f2)return false;if(f2&&clearance(2,x,z)<3.2)return false;
 for(const e of D2.esc){const dx=x-e.p[0],dz=z-e.p[1],ca=Math.cos(e.a),sa=Math.sin(e.a);if(Math.abs(dx*ca+dz*sa)<7.5&&Math.abs(-dx*sa+dz*ca)<3.5)return false;}
 return true;}
function nearestAny(f,x,z){let best=null,bd=1e18;for(let j=0;j<GH;j+=2)for(let i=0;i<GW;i+=2){if(!GRIDS[f][j*GW+i])continue;const [cx,cz]=fromPx(i,j);const d=(cx-x)**2+(cz-z)**2;if(d<bd&&!blockedF(f,cx,cz)){bd=d;best=[cx,cz];}}return best;}
function nearestFree(x,z,maxR,f){const [pi,pj]=toPx(x,z);f=f||curFloor;
 for(let r=0;r<(maxR||80);r++){let best=null,bd=1e9;for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const [cx,cz]=fromPx(pi+dx,pj+dy);if(!blockedF(f,cx,cz)){const d=dx*dx+dy*dy;if(d<bd){bd=d;best=[cx,cz];}}}if(best)return best;}return null;}

/* ---------- Данные ---------- */
const S=[];
D.stores.forEach(s=>S.push(Object.assign({kind:'store',floor:1},s)));
D.kiosks.forEach(k=>S.push(Object.assign({kind:'kiosk',floor:1,c:k.p,area:Math.round(k.w*k.h)},k)));
D2.stores.forEach(s=>S.push(Object.assign({kind:'store',floor:2},s)));
D2.kiosks.forEach(k=>S.push(Object.assign({kind:'kiosk',floor:2,c:k.p,area:Math.round(k.w*k.h)},k)));
S.forEach((s,i)=>{s.id=i;if(!s.name)s.name=s.kind==='kiosk'?'Островок':'Помещение без подписи';});
S.forEach(s=>{const v=(s.id*37)%21-10,w=(s.id*53)%7-3;
 const c=new THREE.Color();if(s.cat==='tbd')c.setHSL(210/360,0.08,0.80+w*0.012);else c.setHSL((((CATS[s.cat].h+v)%360)+360)%360/360,0.55,0.55+w*0.03);
 s.colHex='#'+c.getHexString();s.col=c.clone().convertSRGBToLinear();});

/* ---------- Рендер ---------- */
const canvas=$('c');
const coarse=matchMedia('(pointer:coarse)').matches;
const renderer=new THREE.WebGLRenderer({canvas,antialias:!coarse,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,coarse?1.5:2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=0.9;
renderer.physicallyCorrectLights=false;
const scene=new THREE.Scene();
const FX=makeFX(renderer,scene,coarse);const QS0=new URLSearchParams(location.search),DEC=true;
const FOG=LIN('#e9ecef');scene.fog=new THREE.Fog(FOG,140,620);
const cam=new THREE.PerspectiveCamera(64,innerWidth/innerHeight,0.1,3000);cam.rotation.order='YXZ';
const maxAniso=renderer.capabilities.getMaxAnisotropy();
// окружение для отражений: светлый зал с полосами света
{const env=new THREE.Scene();const box=new THREE.Mesh(new THREE.BoxGeometry(60,20,60),new THREE.MeshBasicMaterial({color:LIN('#cfd3d6'),side:THREE.BackSide}));env.add(box);
 const lm=new THREE.MeshBasicMaterial({color:new THREE.Color(6,6,5.6)});
 for(let i=-2;i<=2;i++){const p=new THREE.Mesh(new THREE.PlaneGeometry(50,1.6),lm);p.rotation.x=Math.PI/2;p.position.set(0,9.8,i*10);env.add(p);}
 const warm=new THREE.MeshBasicMaterial({color:new THREE.Color(2.2,1.9,1.5)});[[-29.8,Math.PI/2],[29.8,-Math.PI/2]].forEach(([x,r])=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(50,5),warm);p.position.set(x,2.5,0);p.rotation.y=r;env.add(p);});
 const floorE=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshBasicMaterial({color:LIN('#e8e2d8')}));floorE.rotation.x=-Math.PI/2;floorE.position.y=-9.9;env.add(floorE);
 const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(env,0.02).texture;pm.dispose();}
const hemi=new THREE.HemisphereLight(LIN('#ffffff'),LIN('#bfb4a4'),0.55);scene.add(hemi);
var skyMesh=null,FOGW=[120,520];var MERGED={walls:[],fascia:[],interior:[],inWalls:[],inFloor:[],inCeil:[]},floorMats=[],floorMatsF=[];
const sun=new THREE.DirectionalLight(LIN('#fff4e6'),0.55);sun.position.set(-80,160,-60);scene.add(sun);
// небо
{const sky=new THREE.Mesh(new THREE.SphereGeometry(1800,32,16),new THREE.MeshBasicMaterial({side:THREE.BackSide,depthWrite:false,fog:false,map:canvasTex(16,256,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#6f9cc9');gr.addColorStop(.45,'#a9c7e2');gr.addColorStop(.5,'#dde6ec');gr.addColorStop(1,'#c9ccce');g.fillStyle=gr;g.fillRect(0,0,w,h);})}));scene.add(sky);skyMesh=sky;}

function canvasTex(w,h,draw,linear){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');draw(g,w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=Math.min(8,maxAniso);if(!linear)t.encoding=THREE.sRGBEncoding;return t;}
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
function fitFont(g,text,maxW,size,weight){let s=size;do{g.font=`${weight||800} ${s}px Manrope, system-ui, sans-serif`;s-=2;}while(g.measureText(text).width>maxW&&s>10);return s+2;}

/* ---------- Склейка геометрии ---------- */
function Merger(){this.p=[];this.n=[];this.u=[];this.c=[];this.f=[];}
Merger.prototype.add=function(geo,colorFn,sid,mat4){
 let g=geo.index?geo.toNonIndexed():geo;if(mat4)g.applyMatrix4(mat4);if(!g.attributes.normal)g.computeVertexNormals();
 const P=g.attributes.position.array,N=g.attributes.normal.array,U=g.attributes.uv?g.attributes.uv.array:null,cnt=P.length/3;
 for(let i=0;i<P.length;i++){this.p.push(P[i]);this.n.push(N[i]);}
 for(let i=0;i<cnt;i++){if(U)this.u.push(U[i*2],U[i*2+1]);else this.u.push(0,0);if(colorFn){const c=colorFn(N[i*3+1]);this.c.push(c.r,c.g,c.b);}}
 for(let i=0;i<cnt/3;i++)this.f.push(sid==null?-1:sid);
};
// a=низ-лево, b=низ-право, c=верх-право, d=верх-лево (как видит зритель со стороны лицевой грани)
Merger.prototype.quad=function(a,b,c,d,uv,color,sid){
 const e1=new V3().subVectors(b,a),e2=new V3().subVectors(d,a),nn=new V3().crossVectors(e1,e2).normalize();
 const v=[a,b,c,a,c,d],t=[[uv[0],uv[1]],[uv[2],uv[1]],[uv[2],uv[3]],[uv[0],uv[1]],[uv[2],uv[3]],[uv[0],uv[3]]];
 for(let i=0;i<6;i++){this.p.push(v[i].x,v[i].y,v[i].z);this.n.push(nn.x,nn.y,nn.z);this.u.push(t[i][0],t[i][1]);if(color)this.c.push(color.r,color.g,color.b);}
 this.f.push(sid==null?-1:sid,sid==null?-1:sid);
};
// вертикальная панель, обращённая к зрителю, стоящему со стороны нормали n: левый край — центр − R·w/2
Merger.prototype.panel=function(center,n,w,y0,y1,uv,color,sid){const R=new V3(n.z,0,-n.x);
 const L=center.clone().addScaledVector(R,-w/2),Rr=center.clone().addScaledVector(R,w/2);
 this.quad(new V3(L.x,y0,L.z),new V3(Rr.x,y0,Rr.z),new V3(Rr.x,y1,Rr.z),new V3(L.x,y1,L.z),uv||[0,0,1,1],color,sid);};
Merger.prototype.mesh=function(mat){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(this.u,2));if(this.c.length)g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));const m=new THREE.Mesh(g,mat);m.userData.fs=this.f;return m;};
function shapeOf(poly,holes){const sh=new THREE.Shape(poly.map(p=>new THREE.Vector2(p[0],-p[1])));(holes||[]).forEach(h=>sh.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(p[0],-p[1])))));return sh;}
function extrude(shape,y0,h){const g=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,curveSegments:1});g.rotateX(-Math.PI/2);g.translate(0,y0,0);return g;}
function flatShape(poly,y){const g=new THREE.ShapeGeometry(shapeOf(poly));g.rotateX(-Math.PI/2);g.translate(0,y,0);return g;}

/* ---------- Текстуры ---------- */
const catKeys=Object.keys(CATS);const shelfRows=Math.ceil(catKeys.length/4);
// задняя стена магазина: стеллажи с товаром, тёплый свет
const WEAR_COLS=['#1e1f22','#3b3e44','#243447','#3d5a80','#5b6146','#cbb89d','#b08855','#6e2433','#ecebe7','#9ea2a6','#5c4033','#9fb8cf','#d8b4b8','#7a8a6c'];
const shelfAtlas=canvasTex(1024,256*shelfRows,(g)=>{
 catKeys.forEach((k,idx)=>{const ox=(idx%4)*256,oy=Math.floor(idx/4)*256,col=shade(CATS[k].c,0),r=mulberry(idx*131+7);const soft=c=>'#'+new THREE.Color(c).lerp(new THREE.Color('#b9b3a8'),0.55).getHexString();
  g.save();g.translate(ox,oy);g.beginPath();g.rect(0,0,256,256);g.clip();
  const gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,'#fbf8f2');gr.addColorStop(1,'#e2dccf');g.fillStyle=gr;g.fillRect(0,0,256,256);
  g.fillStyle='#e9e5de';g.fillRect(0,0,256,26);
  if(k==='tbd'){g.fillStyle='#dcd8d0';g.fillRect(0,0,256,256);g.strokeStyle='rgba(0,0,0,.08)';for(let x=0;x<256;x+=32){g.beginPath();g.moveTo(x,0);g.lineTo(x,256);g.stroke();}}
  else if(k==='fashion'||k==='kids'||k==='sport'){for(let rack=0;rack<2;rack++){const y=62+rack*78;g.fillStyle='#8b8f94';g.fillRect(6,y,244,3);let x=12;while(x<240){const w=7+r()*9,h=40+r()*26;const c=WEAR_COLS[Math.floor(r()*WEAR_COLS.length)];const gg=g.createLinearGradient(x,0,x+w,0);gg.addColorStop(0,shade(c,-.25));gg.addColorStop(.5,c);gg.addColorStop(1,shade(c,-.3));g.fillStyle=gg;rr(g,x,y+3,w,h,3);g.fill();x+=w+1.5;}}}
  else if(k==='food'){g.fillStyle='#3a332c';g.fillRect(14,40,228,56);g.fillStyle='rgba(255,240,210,.85)';for(let i=0;i<3;i++){g.fillRect(28+i*72,52,56,4);g.fillRect(28+i*72,62,40,3);g.fillRect(28+i*72,72,48,3);}
   g.fillStyle='#b98b5e';g.fillRect(0,160,256,96);g.fillStyle='#d8b690';g.fillRect(0,160,256,8);for(let i=0;i<6;i++){g.fillStyle=soft(shade(col,(r()-.5)));g.beginPath();g.arc(24+i*42,150,10,0,7);g.fill();}}
  else if(k==='tech'){g.fillStyle='#f4f4f2';g.fillRect(0,40,256,216);for(let row=0;row<3;row++){g.fillStyle='#d4d4d0';g.fillRect(8,96+row*56,240,4);for(let i=0;i<8;i++){const x=14+i*30,y=56+row*56;g.fillStyle='#16181b';rr(g,x,y,20,36,4);g.fill();g.fillStyle='#1c2733';rr(g,x+2,y+3,16,28,2);g.fill();}}}
  else if(k==='furn'){g.fillStyle='#d9cdbd';g.fillRect(0,196,256,60);for(let i=0;i<2;i++){const x=12+i*124,y=118;const c=soft(shade(col,(r()-.5)*.6));g.fillStyle=shade(c,-.15);rr(g,x,y,110,70,12);g.fill();g.fillStyle=c;rr(g,x+6,y+34,98,32,10);g.fill();}}
  else if(k==='beauty'||k==='acc'||k==='gifts'){for(let row=0;row<4;row++){const y=50+row*48;g.fillStyle='rgba(255,255,255,.9)';g.fillRect(6,y+34,244,4);g.fillStyle='rgba(0,0,0,.08)';g.fillRect(6,y+38,244,3);for(let x=12;x<244;x+=10){const h=8+r()*22;g.fillStyle=soft(shade(col,(r()-.5)*1.1));g.fillRect(x,y+34-h,7,h);g.fillStyle='rgba(255,255,255,.35)';g.fillRect(x+1,y+34-h,2,h);}}}
  else{for(let row=0;row<3;row++){const y=56+row*60;g.fillStyle='#cfc8bb';g.fillRect(0,y+44,256,6);let x=6;while(x<248){const w=12+r()*26,h=18+r()*28;g.fillStyle=soft(shade(col,(r()-.5)*.9));g.fillRect(x,y+44-h,w,h);x+=w+3;}}}
  // мягкая виньетка
  const vg=g.createRadialGradient(128,110,40,128,128,200);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(40,30,20,.28)');g.fillStyle=vg;g.fillRect(0,0,256,256);
  g.restore();});
});
function shelfUV(cat){const idx=catKeys.indexOf(cat);const cx=idx%4,cy=Math.floor(idx/4);return[cx/4+.004,1-(cy+1)/shelfRows+.004,(cx+1)/4-.004,1-cy/shelfRows-.004];}
// мраморная плитка пола
const marble=canvasTex(1024,1024,(g,w,h)=>{const r=mulberry(11);
 const tiles=4,ts=w/tiles;
 for(let i=0;i<tiles;i++)for(let j=0;j<tiles;j++){const b=Math.floor(r()*9);g.fillStyle=`rgb(${222+b},${209+b},${186+b})`;g.fillRect(i*ts,j*ts,ts,ts);
  for(let v=0;v<5;v++){g.beginPath();let x=i*ts+r()*ts,y=j*ts;g.moveTo(x,y);for(let s=0;s<14;s++){x+=(r()-.5)*40;y+=ts/14;g.lineTo(x,y);}g.strokeStyle=`rgba(150,140,125,${0.05+r()*0.08})`;g.lineWidth=0.6+r()*1.6;g.stroke();}
  for(let s=0;s<260;s++){g.fillStyle=`rgba(120,110,95,${r()*0.05})`;g.fillRect(i*ts+r()*ts,j*ts+r()*ts,2+r()*5,2+r()*5);}}
 g.strokeStyle='rgba(110,96,76,.35)';g.lineWidth=2;for(let i=0;i<=tiles;i++){g.beginPath();g.moveTo(i*ts,0);g.lineTo(i*ts,h);g.moveTo(0,i*ts);g.lineTo(w,i*ts);g.stroke();}
});
marble.wrapS=marble.wrapT=THREE.RepeatWrapping;
// тень у основания витрин
const aoTex=canvasTex(8,64,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(0,0,0,.30)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
// световые знаки в витринах: пиктограмма категории, без рекламных обещаний
const PICTO_KEYS=Object.keys(CATS);
const pictoAtlas=canvasTex(128*PICTO_KEYS.length,128,(g)=>{PICTO_KEYS.forEach((k,i)=>{const x=i*128,cx=x+64,cy=64;
 g.fillStyle='#23272c';rr(g,x+4,4,120,120,22);g.fill();g.strokeStyle=CATS[k].c;g.lineWidth=4;rr(g,x+8,8,112,112,18);g.stroke();
 g.strokeStyle='#f6f3ec';g.fillStyle='#f6f3ec';g.lineWidth=6;g.lineCap='round';g.lineJoin='round';g.beginPath();
 switch(k){
  case'fashion':g.arc(cx,40,8,Math.PI,0.2);g.moveTo(cx+7,45);g.lineTo(cx,56);g.lineTo(cx-34,82);g.lineTo(cx+34,82);g.lineTo(cx,56);g.stroke();break;
  case'food':g.moveTo(cx-24,40);g.lineTo(cx-24,88);g.moveTo(cx-32,40);g.lineTo(cx-32,56);g.quadraticCurveTo(cx-24,66,cx-16,56);g.lineTo(cx-16,40);g.moveTo(cx+18,88);g.lineTo(cx+18,40);g.quadraticCurveTo(cx+34,48,cx+30,66);g.lineTo(cx+18,66);g.stroke();break;
  case'beauty':g.moveTo(cx,34);g.bezierCurveTo(cx+30,64,cx+22,92,cx,92);g.bezierCurveTo(cx-22,92,cx-30,64,cx,34);g.stroke();break;
  case'acc':g.arc(cx-20,70,14,0,7);g.moveTo(cx+34,70);g.arc(cx+20,70,14,0,7);g.moveTo(cx-6,68);g.lineTo(cx+6,68);g.stroke();break;
  case'tech':rr(g,cx-18,32,36,64,8);g.stroke();g.beginPath();g.arc(cx,86,3,0,7);g.fill();break;
  case'kids':g.arc(cx,52,18,0,7);g.moveTo(cx,70);g.quadraticCurveTo(cx-8,82,cx,94);g.stroke();break;
  case'gifts':g.rect(cx-26,54,52,36);g.moveTo(cx,54);g.lineTo(cx,90);g.moveTo(cx-30,54);g.lineTo(cx+30,54);g.moveTo(cx,54);g.quadraticCurveTo(cx-20,30,cx-14,50);g.moveTo(cx,54);g.quadraticCurveTo(cx+20,30,cx+14,50);g.stroke();break;
  case'furn':g.moveTo(cx-32,84);g.lineTo(cx-32,56);g.lineTo(cx+32,56);g.lineTo(cx+32,84);g.moveTo(cx-24,70);g.lineTo(cx+24,70);g.moveTo(cx-24,56);g.lineTo(cx-24,42);g.lineTo(cx+24,42);g.lineTo(cx+24,56);g.stroke();break;
  case'home':g.moveTo(cx-30,62);g.lineTo(cx,36);g.lineTo(cx+30,62);g.moveTo(cx-22,56);g.lineTo(cx-22,90);g.lineTo(cx+22,90);g.lineTo(cx+22,56);g.stroke();break;
  case'sport':g.arc(cx,64,28,0,7);g.moveTo(cx-28,64);g.lineTo(cx+28,64);g.moveTo(cx,36);g.quadraticCurveTo(cx+18,64,cx,92);g.stroke();break;
  case'wc':g.arc(cx-17,38,7,0,7);g.moveTo(cx-17,50);g.lineTo(cx-17,76);g.moveTo(cx-17,76);g.lineTo(cx-17,94);g.moveTo(cx-28,54);g.lineTo(cx-6,54);g.arc(cx+17,38,7,0,7);g.moveTo(cx+17,50);g.lineTo(cx+8,78);g.lineTo(cx+26,78);g.closePath();g.moveTo(cx,34);g.lineTo(cx,94);g.stroke();break;
  case'serv':g.arc(cx,64,24,0,7);g.moveTo(cx,64);g.lineTo(cx,48);g.moveTo(cx,64);g.lineTo(cx+12,70);g.stroke();break;
  default:g.moveTo(cx-24,48);g.lineTo(cx+24,48);g.lineTo(cx+20,90);g.lineTo(cx-20,90);g.closePath();g.moveTo(cx-10,48);g.arc(cx,48,10,Math.PI,0);g.stroke();}
 });});
const pictoUV=cat=>{const k=Math.max(0,PICTO_KEYS.indexOf(cat));return[k/PICTO_KEYS.length+.002,0.01,(k+1)/PICTO_KEYS.length-.002,0.99];};
const blobTex=canvasTex(64,64,(g,w,h)=>{const gr=g.createRadialGradient(32,32,2,32,32,32);gr.addColorStop(0,'rgba(0,0,0,.35)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});

const CW_=512,CH_=64,PER=4*32;const signAtlases=[],labelAtlases=[],bladeAtlases=[];
function buildAtlases(){
 for(let a=0;a*PER<S.length;a++){
  const list=S.slice(a*PER,(a+1)*PER);
  // вывеска: светящиеся буквы на фризе
  signAtlases.push(canvasTex(2048,2048,(g)=>{list.forEach((s,i)=>{const x=(i%4)*CW_,y=Math.floor(i/4)*CH_;
   if(s.cat!=='tbd'&&s.cat!=='wc'){s.sign=signStyle(s,CATS[s.cat].h);drawSign(g,x,y,CW_,CH_,s,s.sign);s.atlas=a;s.uv=[x/2048+.001,1-(y+CH_)/2048+.002,(x+CW_)/2048-.001,1-y/2048-.002];return;}
   g.fillStyle=s.cat==='tbd'?'#d9d6d0':'#26292d';g.fillRect(x,y,CW_,CH_);
   if(s.cat!=='tbd'){g.fillStyle=CATS[s.cat].c;g.fillRect(x,y+CH_-5,CW_,5);}
   g.textAlign='center';g.textBaseline='middle';fitFont(g,s.name,CW_-40,40,800);
   if(s.cat!=='tbd'){g.shadowColor='rgba(255,250,235,.8)';g.shadowBlur=10;g.fillStyle='#fffaf0';}else{g.fillStyle='#8c96a0';}
   g.fillText(s.name,x+CW_/2,y+CH_/2);g.shadowBlur=0;
   s.atlas=a;s.uv=[x/2048+.001,1-(y+CH_)/2048+.002,(x+CW_)/2048-.001,1-y/2048-.002];});}));
  // консольные таблички поперёк коридора: ячейки 256×128
  bladeAtlases.push(canvasTex(2048,2048,(g)=>{list.forEach((s,i)=>{if(!s.sign)return;const x=(i%8)*256,y=Math.floor(i/8)*128;drawBlade(g,x,y,256,128,s,s.sign);
   s.buv=[x/2048+.002,1-(y+128)/2048+.003,(x+256)/2048-.002,1-y/2048-.003];});}));
  labelAtlases.push(canvasTex(2048,2048,(g)=>{list.forEach((s,i)=>{const x=(i%4)*CW_,y=Math.floor(i/4)*CH_;
   if(s.cat==='tbd')return;
   g.textAlign='center';g.textBaseline='middle';const fs=fitFont(g,s.name,CW_-24,40,800);
   const tw=g.measureText(s.name).width;s.lfs=fs;s.ltw=tw;
   g.lineJoin='round';g.lineWidth=Math.max(3,fs*0.2);g.strokeStyle='rgba(18,26,36,.85)';g.strokeText(s.name,x+CW_/2,y+CH_/2+2);
   g.fillStyle='#ffffff';g.fillText(s.name,x+CW_/2,y+CH_/2+2);});}));
 }
}

/* ---------- Сцена ---------- */
const world={groups:{}};
const G=name=>{if(!world.groups[name]){const g=new THREE.Group();scene.add(g);world.groups[name]=g;}return world.groups[name];};
const pickables=[];
const FLOOR_H=8.6,SLAB=0.6,UP_H=5.6,ROOF_Y=FLOOR_H+SLAB+UP_H+0.3,GLASS_H=5.0;
// уровень пола каждого этажа, высота витрин и потолка магазинов
const FY={1:0,2:FLOOR_H+SLAB};
const FLOORS={1:{f:1,y0:0,GH:GLASS_H,FH:FLOOR_H,group:'stores'},2:{f:2,y0:FLOOR_H+SLAB,GH:4.2,FH:ROOF_Y-(FLOOR_H+SLAB),group:'f2'}};
function rayDist(P,ox,oz,dx,dz){let best=1e9;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];const ex=b[0]-a[0],ez=b[1]-a[1];const den=dx*ez-dz*ex;if(Math.abs(den)<1e-9)continue;
 const t=((a[0]-ox)*ez-(a[1]-oz)*ex)/den,u=((a[0]-ox)*dz-(a[1]-oz)*dx)/den;if(t>0.05&&u>=-1e-6&&u<=1+1e-6&&t<best)best=t;}return best;}
const mtx=new THREE.Matrix4();
const MAT={
 glass:new THREE.MeshStandardMaterial({color:LIN('#dfeaee'),transparent:true,opacity:.16,roughness:.03,metalness:.9,envMapIntensity:1.4,depthWrite:false,side:THREE.DoubleSide}),
 metal:new THREE.MeshStandardMaterial({color:LIN('#b9bec2'),roughness:.28,metalness:.85}),
 darkMetal:new THREE.MeshStandardMaterial({color:LIN('#3b4046'),roughness:.4,metalness:.7}),
 white:new THREE.MeshStandardMaterial({color:LIN('#f7f7f5'),roughness:.45,metalness:0}),
 wall:new THREE.MeshStandardMaterial({color:LIN('#e7e3dc'),roughness:.8}),
 light:new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.58,1.5)}),
};

const _dq=new THREE.Quaternion(),_ds=new V3(),_dp=new V3(),_dY=new V3(0,1,0);
function updateDoors(){if(!world.doorSets)return;
 world.doorSets.forEach(({list,leaves:L,handles:H})=>{list.forEach((s,i)=>{const d=s.door,half=d.w/2,o=d.open;
  [-1,1].forEach((sg,k)=>{const off=sg*(half/2+o*half*0.92);_dp.copy(d.c).addScaledVector(d.R,off).addScaledVector(d.n,0.06);
   _dq.setFromAxisAngle(_dY,Math.atan2(d.n.x,d.n.z));_ds.set(half,1,1);mtx.compose(_dp,_dq,_ds);L.setMatrixAt(i*2+k,mtx);
   _dp.copy(d.c).addScaledVector(d.R,sg*(0.12+o*half*0.92)).addScaledVector(d.n,0.06);_ds.set(1,1,1);mtx.compose(_dp,_dq,_ds);H.setMatrixAt(i*2+k,mtx);});});
  L.count=H.count=list.length*2;L.instanceMatrix.needsUpdate=true;H.instanceMatrix.needsUpdate=true;});}
function kioskBody(s){return LIN('#eceae6');}
// основной цвет бренда для фасада: фон вывески, а если он почти белый — цвет букв
function brandCol(s){const st=s.sign;const c=LIN(st.bg);return c.r+c.g+c.b>2.4?LIN(st.fg):c;}
function kioskGlow(s){const c=s.cat==='tbd'?LIN('#9aa3ab'):s.col;return c.clone().lerp(new THREE.Color(1,1,1),0.3).multiplyScalar(1.3);}
let HP=null;
function humanParts(){if(HP)return HP;
 const lat=(pts,seg)=>new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg||10);
 const torso=lat([[0,0.86],[0.14,0.88],[0.165,0.98],[0.15,1.1],[0.155,1.26],[0.19,1.4],[0.2,1.46],[0.16,1.52],[0.07,1.56],[0,1.57]]);torso.scale(1,1,0.66);
 const leg=x=>[new THREE.CylinderGeometry(0.07,0.058,0.44,7).translate(x,0.66,0),new THREE.SphereGeometry(0.06,7,5).translate(x,0.44,0),new THREE.CylinderGeometry(0.057,0.045,0.38,7).translate(x,0.25,0)];
 const arm=x=>[new THREE.SphereGeometry(0.055,7,5).translate(x,1.45,0),new THREE.CylinderGeometry(0.05,0.043,0.32,7).translate(x,1.28,0),new THREE.CylinderGeometry(0.042,0.035,0.3,7).translate(x,0.99,0.01)];
 const hands=[-1,1].map(s=>new THREE.SphereGeometry(0.045,7,5).scale(0.8,1.1,0.6).translate(s*0.215,0.8,0.015));
 const head=new THREE.SphereGeometry(0.1,12,9);head.scale(0.92,1.12,1);head.translate(0,1.72,0.005);
 const neck=new THREE.CylinderGeometry(0.045,0.05,0.1,7);neck.translate(0,1.6,0);
 const hair=new THREE.SphereGeometry(0.104,12,7,0,Math.PI*2,0,Math.PI*0.55);hair.scale(0.95,1.1,1.05);hair.translate(0,1.735,-0.01);
 const shoes=[-1,1].map(s=>new THREE.SphereGeometry(0.06,8,5).scale(0.85,0.55,1.7).translate(s*0.09,0.035,0.035));
 const merge=(gs)=>{const m=new Merger();gs.forEach(g=>m.add(g));const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(m.p,3));bg.setAttribute('normal',new THREE.Float32BufferAttribute(m.n,3));return bg;};
 HP={torso:merge([torso]),legs:merge([...leg(-0.09),...leg(0.09)]),arms:merge([...arm(-0.215),...arm(0.215)]),head:merge([head,neck,...hands]),hair:merge([hair]),shoes:merge(shoes)};return HP;}
function build(){
 const bpoly=D.bld.reduce((a,b)=>b.length>a.length?b:a,D.bld[0]);
 const ground=new THREE.Mesh((()=>{const cx=(bb.x0+bb.x1)/2,cz=(bb.z0+bb.z1)/2,R=1500;return new THREE.ShapeGeometry(shapeOf([[cx-R,cz-R],[cx+R,cz-R],[cx+R,cz+R],[cx-R,cz+R]],D.bld));})(),new THREE.MeshStandardMaterial({color:LIN('#7d8388'),roughness:.95}));ground.rotation.x=-Math.PI/2;ground.position.y=-0.06;scene.add(ground);
 // пол: полированный мрамор
 const fg=flatShape(bpoly,0.01);
 {const P=fg.attributes.position.array,U=new Float32Array(P.length/3*2);for(let i=0;i<P.length/3;i++){U[i*2]=P[i*3]/4.8;U[i*2+1]=P[i*3+2]/4.8;}fg.setAttribute('uv',new THREE.BufferAttribute(U,2));}
 const floor=new THREE.Mesh(fg,new THREE.MeshStandardMaterial({map:marble,roughness:.16,metalness:0,envMapIntensity:.55}));floor.renderOrder=-1;scene.add(floor);floorMats.push(floor.material);floorMatsF.push([floor.material,1]);
 // цветные полосы вдоль проёмов (как на фото)
 const band=new Merger();const OR=LIN('#ef7d35'),GRN=LIN('#7ab04f');
 voidPolys.forEach(v=>{for(let i=0;i<v.length;i++){const a=v[i],b=v[(i+1)%v.length];const A=new V3(a[0],0.025,a[1]),B=new V3(b[0],0.025,b[1]);const L=A.distanceTo(B);if(L<0.05)continue;
  const n=new V3(-(B.z-A.z)/L,0,(B.x-A.x)/L);[[0,0.3,OR],[0.3,0.75,GRN]].forEach(([o0,o1,col])=>{[1,-1].forEach(sg=>{
   const p0=A.clone().addScaledVector(n,sg*o0),p1=B.clone().addScaledVector(n,sg*o0),p2=B.clone().addScaledVector(n,sg*o1),p3=A.clone().addScaledVector(n,sg*o1);band.quad(p0,p1,p2,p3,[0,0,1,1],col);});});}});
 scene.add(band.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.2,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1})));
 // парковка
 const park=canvasTex(512,256,(g,w,h)=>{g.fillStyle='#6f757a';g.fillRect(0,0,w,h);const r=mulberry(3);for(let i=0;i<900;i++){g.fillStyle=`rgba(${r()<.5?0:255},${r()<.5?0:255},${r()<.5?0:255},.04)`;g.fillRect(r()*w,r()*h,2,2);}g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=4;for(let x=10;x<w;x+=36){g.beginPath();g.moveTo(x,20);g.lineTo(x,110);g.moveTo(x,146);g.lineTo(x,236);g.stroke();}});
 park.wrapS=park.wrapT=THREE.RepeatWrapping;park.repeat.set(12,3);
 const e3=D.ents.find(e=>e.n===3)||D.ents[0];
 const lot=new THREE.Mesh(new THREE.PlaneGeometry(320,70),new THREE.MeshStandardMaterial({map:park,roughness:.9}));lot.rotation.x=-Math.PI/2;lot.rotation.z=-Math.atan2(e3.d[0],-e3.d[1]);
 lot.position.set(e3.p[0]+e3.d[0]*48,-0.02,e3.p[1]+e3.d[1]*48);scene.add(lot);

 buildAtlases();

 // ---- магазины: витрины, двери, интерьер за стеклом — одинаково для обоих этажей
 // туалеты: у их дверей и проёмов входов в магазины быть не должно (значки туалетов — из карты)
 const WC_R=7,nearWC=(f,x,z)=>((f===1?D.wc:D2&&D2.wc)||[]).some(w=>Math.hypot(w[0]-x,w[1]-z)<WC_R);
 const doors=[];world.doors=doors;world.tint={};world.tintColors={};
 const wood=canvasTex(256,256,(g,w,h)=>{const r=mulberry(9);g.fillStyle='#cdb190';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=32){g.fillStyle=`rgba(90,60,30,${.05+r()*.06})`;g.fillRect(0,y,w,32);g.fillStyle='rgba(80,50,20,.25)';g.fillRect(0,y,w,1);for(let i=0;i<14;i++){g.fillStyle=`rgba(120,80,40,${r()*.08})`;g.fillRect(0,y+r()*32,w,1);}}});
 wood.wrapS=wood.wrapT=THREE.RepeatWrapping;
 function fronts(F,list){
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
 // помещения без подписи посреди коридора (со всех сторон проход) — открытые островки в половину высоты
 S.forEach(s=>{if(s.kind!=='store'||s.cat==='wc'||s.area>(s.cat==='tbd'?40:12))return;const P=s.poly;let tot=0,ok=0;
  for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1e-6)continue;const tx=(b[0]-a[0])/L,tz=(b[1]-a[1])/L;
   for(let u=0.25;u<L;u+=0.5){const px=a[0]+tx*u,pz=a[1]+tz*u;let nx=-tz,nz=tx;if(inPoly(P,px+nx*0.3,pz+nz*0.3)){nx=-nx;nz=-nz;}tot++;if(isFloorF(s.floor,px+nx*0.9,pz+nz*0.9))ok++;}}
  if(tot&&ok/tot>=0.7)s.island=true;});
 fronts(FLOORS[1],S.filter(s=>s.kind==='store'&&s.floor===1));
 fronts(FLOORS[2],S.filter(s=>s.kind==='store'&&s.floor===2));
 // двери: раздвижные створки, проём в сетке проходимости своего этажа
 {const lg=new THREE.BoxGeometry(1,2.62,0.04);lg.translate(0,1.33,0);const hG=new THREE.BoxGeometry(0.03,0.5,0.06);hG.translate(0,1.1,0.05);
  world.doorSets=[1,2].map(f=>{const list=doors.filter(s=>s.door.floor===f);const N=Math.max(1,list.length*2);
   const leaves=new THREE.InstancedMesh(lg,MAT.glass,N);leaves.renderOrder=2;const handles=new THREE.InstancedMesh(hG,MAT.metal,N);
   const ids=[];list.forEach(s=>{ids.push(s.id,s.id);});leaves.userData.kiosks=ids;pickables.push(leaves);G(FLOORS[f].group).add(leaves,handles);
   return{list,leaves,handles};});
  doors.forEach(s=>{const d=s.door;const c=d.c.clone().addScaledVector(d.n,-0.2);setRect(c.x,c.z,Math.atan2(d.R.z,d.R.x),d.w/2-0.12,0.75,1,d.floor);
   if(d.gap){const pc=d.c.clone().addScaledVector(d.n,d.gap/2+0.2);setRect(pc.x,pc.z,Math.atan2(d.R.z,d.R.x),d.w/2-0.12,d.gap/2+0.45,1,d.floor);}});
  updateDoors();}
 G('toplabels1').visible=false;G('toplabels2').visible=false;

 // ---- перекрытие и галерея второго этажа
 const slabMat=new THREE.MeshStandardMaterial({color:LIN('#fbfbfa'),roughness:.6});world.slabMat=slabMat;
 G('slab').add(new THREE.Mesh(extrude(shapeOf(bpoly,voidPolys),FLOOR_H,SLAB),slabMat));
 // кровля над частями без второго этажа
 {const rt=canvasTex(256,256,(g,w,h)=>{const r=mulberry(21);g.fillStyle='#9a9c9e';g.fillRect(0,0,w,h);for(let i=0;i<2500;i++){const v=120+Math.floor(r()*60);g.fillStyle=`rgba(${v},${v},${v},.35)`;g.fillRect(r()*w,r()*h,2,2);}});rt.wrapS=rt.wrapT=THREE.RepeatWrapping;
  const g=new THREE.ShapeGeometry(shapeOf(bpoly,voidPolys));g.rotateX(-Math.PI/2);g.translate(0,FY[2]+0.002,0);const P=g.attributes.position.array,U=new Float32Array(P.length/3*2);for(let i=0;i<P.length/3;i++){U[i*2]=P[i*3]/6;U[i*2+1]=P[i*3+2]/6;}g.setAttribute('uv',new THREE.BufferAttribute(U,2));
  G('slab').add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:rt,roughness:.95})));}
 const holesIn=poly=>voidPolys.filter(v=>{let x=0,z=0;v.forEach(p=>{x+=p[0];z+=p[1];});return inPoly(poly,x/v.length,z/v.length);});
 // пол второго этажа: тот же мрамор, с проёмами — только там, где второй этаж есть
 D2.bld.forEach(bp=>{const g=new THREE.ShapeGeometry(shapeOf(bp,holesIn(bp)));g.rotateX(-Math.PI/2);g.translate(0,FY[2]+0.006,0);const P=g.attributes.position.array,U=new Float32Array(P.length/3*2);for(let i=0;i<P.length/3;i++){U[i*2]=P[i*3]/4.8;U[i*2+1]=P[i*3+2]/4.8;}g.setAttribute('uv',new THREE.BufferAttribute(U,2));
  const fm2=new THREE.MeshStandardMaterial({map:marble,roughness:.16,metalness:0,envMapIntensity:.55});floorMats.push(fm2);floorMatsF.push([fm2,2]);G('slab').add(new THREE.Mesh(g,fm2));});
 const roofMat=new THREE.MeshStandardMaterial({color:LIN('#f3f3f1'),roughness:1});world.roofMat=roofMat;
 D2.bld.forEach(bp=>{G('roof').add(new THREE.Mesh(extrude(shapeOf(bp,holesIn(bp)),ROOF_Y,0.6),roofMat));});
 // стеклянная крыша с фермами
 const skyG=new THREE.MeshStandardMaterial({color:LIN('#dbe8f2'),transparent:true,opacity:.35,roughness:.05,metalness:.5,side:THREE.DoubleSide,depthWrite:false});
 const truss=new Merger();
 voidPolys.forEach(v=>{const m=new THREE.Mesh(flatShape(v,ROOF_Y+0.55),skyG);G('roof').add(m);
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;v.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[1]);z1=Math.max(z1,p[1]);});
  const along=(x1-x0)>(z1-z0);const step=3.2;
  if(along){for(let x=x0+step/2;x<x1;x+=step){let a=null,b=null;for(let z=z0;z<=z1;z+=0.5){if(inPoly(v,x,z)){if(a===null)a=z;b=z;}}if(a!==null&&b-a>1){mtx.makeTranslation(x,ROOF_Y+0.4,(a+b)/2);truss.add(new THREE.BoxGeometry(0.12,0.3,b-a),null,null,mtx);}}}
  else{for(let z=z0+step/2;z<z1;z+=step){let a=null,b=null;for(let x=x0;x<=x1;x+=0.5){if(inPoly(v,x,z)){if(a===null)a=x;b=x;}}if(a!==null&&b-a>1){mtx.makeTranslation((a+b)/2,ROOF_Y+0.4,z);truss.add(new THREE.BoxGeometry(b-a,0.3,0.12),null,null,mtx);}}}});
 G('roof').add(truss.mesh(MAT.white));
 // ограждение: стекло, стойки, поручень; светодиодная линия под кромкой
 const rail=new Merger(),hand=new Merger(),led=new Merger();const posts=[];
 // у верхних площадок эскалаторов ограждения нет — там проход на ленту
 const escGap=D2.esc.map(e=>({x:e.top[0],z:e.top[1],dx:Math.cos(e.a),dz:Math.sin(e.a)}));
 const inEscGap=(x,z)=>escGap.some(g=>{const px=x-g.x,pz=z-g.z,s=px*g.dx+pz*g.dz,l=-px*g.dz+pz*g.dx;return s>-4&&s<1.3&&Math.abs(l)<1.62;});
 const cutSeg=(A,B)=>{const L=A.distanceTo(B),n=Math.max(1,Math.ceil(L/0.05)),out=[];let st=null;
  for(let k=0;k<=n;k++){const t=k/n,x=A.x+(B.x-A.x)*t,z=A.z+(B.z-A.z)*t,ins=inEscGap(x,z);if(!ins&&st===null)st=t;if((ins||k===n)&&st!==null){const te=ins?(k-1)/n:t;if(te-st>1e-3)out.push([A.clone().lerp(B,st),A.clone().lerp(B,te),st>0,ins]);st=null;}}
  return out;};
 const gapEnds=[];
 voidPolys.forEach(v=>{let acc=0;for(let i=0;i<v.length;i++){const a=v[i],b=v[(i+1)%v.length];const A0=new V3(a[0],0,a[1]),B0=new V3(b[0],0,b[1]);if(A0.distanceTo(B0)<0.05)continue;
  for(const [A,B,cutA,cutB] of cutSeg(A0,B0)){const L=A.distanceTo(B);if(L<0.05)continue;if(cutA)gapEnds.push(A.clone());if(cutB)gapEnds.push(B.clone());
  const y0=FLOOR_H+SLAB,y1=y0+1.05;rail.quad(new V3(A.x,y0+0.05,A.z),new V3(B.x,y0+0.05,B.z),new V3(B.x,y1,B.z),new V3(A.x,y1,A.z),[0,0,1,1]);
  const ry=-Math.atan2(B.z-A.z,B.x-A.x);
  const m1=new THREE.Matrix4().makeRotationY(ry);m1.setPosition((A.x+B.x)/2,y1+0.03,(A.z+B.z)/2);hand.add(new THREE.CylinderGeometry(0.035,0.035,L,8).rotateZ(Math.PI/2),null,null,m1);
  const m2=new THREE.Matrix4().makeRotationY(ry);m2.setPosition((A.x+B.x)/2,FLOOR_H+0.25,(A.z+B.z)/2);hand.add(new THREE.BoxGeometry(L,0.52,0.06),null,null,m2);
  const m3=new THREE.Matrix4().makeRotationY(ry);m3.setPosition((A.x+B.x)/2,FLOOR_H-0.02,(A.z+B.z)/2);led.add(new THREE.BoxGeometry(L,0.04,0.1),null,null,m3);
  let d=(1.6-acc%1.6);while(d<L){posts.push(A.clone().lerp(B,d/L));d+=1.6;}acc+=L;}}});
 gapEnds.forEach(p=>posts.push(p));
 const railMat=new THREE.MeshStandardMaterial({color:LIN('#cfe3ea'),transparent:true,opacity:.22,roughness:.04,metalness:.6,depthWrite:false,side:THREE.DoubleSide});world.railMat=railMat;const railMesh=rail.mesh(railMat);railMesh.renderOrder=2;G('slab').add(railMesh);
 G('slab').add(hand.mesh(MAT.metal));G('slab').add(led.mesh(MAT.light));
 {const pg=new THREE.CylinderGeometry(0.025,0.025,1.05,6);pg.translate(0,FLOOR_H+SLAB+0.52,0);const pi=new THREE.InstancedMesh(pg,MAT.metal,Math.max(1,posts.length));posts.forEach((p,i)=>{mtx.makeTranslation(p.x,0,p.z);pi.setMatrixAt(i,mtx);});G('slab').add(pi);}
 // колонны — только в атриумах, на перекрёстках и у эскалаторов; проходят через оба этажа
 {const colG=new THREE.CylinderGeometry(0.42,0.42,ROOF_Y,24);colG.translate(0,ROOF_Y/2,0);const baseG=new THREE.CylinderGeometry(0.55,0.55,0.12,24);baseG.translate(0,0.06,0);
  const colMat=new THREE.MeshStandardMaterial({color:LIN('#fafaf8'),roughness:.25,envMapIntensity:.7});world.colMat=colMat;const cols=new THREE.InstancedMesh(colG,colMat,Math.max(1,D.cols.length));
  const bases=new THREE.InstancedMesh(baseG,MAT.metal,Math.max(1,D.cols.length));
  const keep=D.cols.filter(keepColumn);world.colsKept=keep.length;world.colsDropped=D.cols.length-keep.length;
  keep.forEach((p,i)=>{mtx.makeTranslation(p[0],0,p[1]);cols.setMatrixAt(i,mtx);bases.setMatrixAt(i,mtx);blockRect(p[0],p[1],0,0.55,0.55,1);blockRect(p[0],p[1],0,0.55,0.55,2);});
  cols.count=bases.count=keep.length;G('roof').add(cols);G('roof').add(bases);}
 // светильники-кольца: под перекрытием первого этажа, под крышей второго и большие — в атриумах
 {const ringsLow=[],ringsHigh=[];const st=Math.round(6.5/CELL);
  for(let j=2;j<GH;j+=st)for(let i=2;i<GW;i+=st){if(!isWalkPx(i,j))continue;const [x,z]=fromPx(i,j);if(inVoid(x,z)){if(((i+j)/st)%2===0)ringsHigh.push([x,z]);}else ringsLow.push([x,z]);}
  const rg1=new THREE.TorusGeometry(0.9,0.05,4,28);rg1.rotateX(Math.PI/2);
  const r1=new THREE.InstancedMesh(rg1,MAT.light,Math.max(1,ringsLow.length));ringsLow.forEach((p,i)=>{mtx.makeTranslation(p[0],FLOOR_H-0.04,p[1]);r1.setMatrixAt(i,mtx);});G('slab').add(r1);
  // светильники второго этажа — над его собственной галереей
  const rings2=[];for(let j=2;j<GH;j+=st)for(let i=2;i<GW;i+=st){if(walk2[j*GW+i])rings2.push(fromPx(i,j));}
  const r3=new THREE.InstancedMesh(rg1,MAT.light,Math.max(1,rings2.length));rings2.forEach((p,i)=>{mtx.makeTranslation(p[0],ROOF_Y-0.04,p[1]);r3.setMatrixAt(i,mtx);});G('roof').add(r3);
  const rg2=new THREE.TorusGeometry(2.2,0.1,6,56);rg2.rotateX(Math.PI/2);const r2=new THREE.InstancedMesh(rg2,MAT.light,Math.max(1,ringsHigh.length));ringsHigh.forEach((p,i)=>{mtx.makeTranslation(p[0],ROOF_Y-0.8,p[1]);r2.setMatrixAt(i,mtx);});G('roof').add(r2);
  // пятна света на полу под кольцами
  const spot=canvasTex(64,64,(g,w,h)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,250,235,.22)');gr.addColorStop(1,'rgba(255,250,235,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
  const sg=new THREE.PlaneGeometry(4.5,4.5);sg.rotateX(-Math.PI/2);const spm=new THREE.MeshBasicMaterial({map:spot,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const sm=new THREE.InstancedMesh(sg,spm,Math.max(1,ringsLow.length));ringsLow.forEach((p,i)=>{mtx.makeTranslation(p[0],0.03,p[1]);sm.setMatrixAt(i,mtx);});G('spots').add(sm);
  const sm2=new THREE.InstancedMesh(sg,spm,Math.max(1,rings2.length));rings2.forEach((p,i)=>{mtx.makeTranslation(p[0],FY[2]+0.03,p[1]);sm2.setMatrixAt(i,mtx);});G('spots').add(sm2);}

 // ---- фасад и входы
 const wallM=new Merger();const entP=D.ents.map(e=>new V3(e.p[0],0,e.p[1]));
 const facadeOut=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#d4d0c8';g.fillRect(0,0,w,h);g.strokeStyle='rgba(0,0,0,.12)';g.lineWidth=2;for(let x=0;x<=w;x+=64){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}for(let y=0;y<=h;y+=128){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}});
 facadeOut.wrapS=facadeOut.wrapT=THREE.RepeatWrapping;
 D.bld.forEach(bp=>{for(let i=0;i<bp.length;i++){const a=bp[i],b=bp[(i+1)%bp.length];const A=new V3(a[0],0,a[1]),B=new V3(b[0],0,b[1]);const L=A.distanceTo(B);
  const steps=Math.max(1,Math.ceil(L/2));for(let k=0;k<steps;k++){const P0=A.clone().lerp(B,k/steps),P1=A.clone().lerp(B,(k+1)/steps),mid=P0.clone().lerp(P1,.5);
   const y0=entP.some(e=>e.distanceTo(mid)<5.5)?4.2:0,yt=FY[2]+1.1;const u0=(P0.x+P0.z)/4,u1=(P1.x+P1.z)/4;wallM.quad(new V3(P0.x,y0,P0.z),new V3(P1.x,y0,P1.z),new V3(P1.x,yt,P1.z),new V3(P0.x,yt,P0.z),[u0,y0/4,u1,yt/4]);}}});
 // наружные стены второго этажа
 D2.bld.forEach(bp=>{for(let i=0;i<bp.length;i++){const a=bp[i],b=bp[(i+1)%bp.length];const A=new V3(a[0],0,a[1]),B=new V3(b[0],0,b[1]);const L=A.distanceTo(B);if(L<0.05)continue;
  const y0=FY[2],y1=ROOF_Y+0.6,u0=(A.x+A.z)/4,u1=(B.x+B.z)/4;wallM.quad(new V3(A.x,y0,A.z),new V3(B.x,y0,B.z),new V3(B.x,y1,B.z),new V3(A.x,y1,A.z),[u0,y0/4,u1,y1/4]);}});
 G('shell').add(wallM.mesh(new THREE.MeshStandardMaterial({map:facadeOut,roughness:.8,side:THREE.DoubleSide})));
 D.ents.forEach(e=>{const d=new V3(e.d[0],0,e.d[1]).normalize(),p=new V3(e.p[0],0,e.p[1]).addScaledVector(d,0.4);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(9,4.2),MAT.glass);m.position.set(p.x,2.1,p.z);m.rotation.y=Math.atan2(d.x,d.z);scene.add(m);
  const fr=new THREE.Mesh(new THREE.BoxGeometry(9.4,0.3,0.3),MAT.darkMetal);fr.position.set(p.x,4.2,p.z);fr.rotation.y=m.rotation.y;scene.add(fr);
  [-1,1].forEach(sg=>{const R=new V3(d.z,0,-d.x);const pp=p.clone().addScaledVector(R,sg*4.6);const f2=new THREE.Mesh(new THREE.BoxGeometry(0.2,4.2,0.2),MAT.darkMetal);f2.position.set(pp.x,2.1,pp.z);scene.add(f2);});
  const sp=sprite('Вход '+e.n,'#0e7490');sp.position.set(p.x-d.x*1.5,4.9,p.z-d.z*1.5);sp.scale.set(4.4,1.1,1);scene.add(sp);
  const sp2=sprite('Вход '+e.n,'#0e7490');sp2.position.set(p.x+d.x*4,FLOOR_H+3,p.z+d.z*4);sp2.scale.set(14,3.2,1);G('toponly1').add(sp2);});

 // ---- эскалаторы: по карте второго этажа; правая лента едет вверх, левая — вниз, ступени движутся
 const stepCanvas=canvasTex(256,64,(g,w,h)=>{g.fillStyle='#4a5056';g.fillRect(0,0,w,h);for(let x=0;x<w;x+=16){g.fillStyle='#8f969c';g.fillRect(x,0,11,h);g.fillStyle='rgba(0,0,0,.25)';for(let y=2;y<h;y+=4)g.fillRect(x,y,11,1);}g.fillStyle='#d9b53c';g.fillRect(0,0,w,4);g.fillRect(0,h-4,w,4);});
 const escSide=new THREE.MeshStandardMaterial({color:LIN('#dcebf1'),transparent:true,opacity:.26,roughness:.04,metalness:.5,depthWrite:false,side:THREE.DoubleSide}),railM=new THREE.MeshStandardMaterial({color:LIN('#15181b'),roughness:.5});
 const escBand=new THREE.MeshStandardMaterial({color:LIN('#b9bec3'),roughness:.3,metalness:.8}),combM=new THREE.MeshStandardMaterial({color:LIN('#9aa0a6'),roughness:.4,metalness:.8});
 world.escs=[];world.stepTex=[];
 D2.esc.forEach((e,ei)=>{const g=new THREE.Group();const run=9.8,rise=FLOOR_H+SLAB,ang=Math.atan2(rise,run),len=Math.hypot(run,rise);
  const d=new V3(Math.cos(e.a),0,Math.sin(e.a)),r=new V3(-Math.sin(e.a),0,Math.cos(e.a));
  [[0.72,1],[-0.72,-1]].forEach(([off,dir])=>{const t=stepCanvas.clone();t.needsUpdate=true;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(len/0.42,1);world.stepTex.push({t,dir});
   const b=new THREE.Mesh(new THREE.BoxGeometry(len,0.8,1.2),[escBand,escBand,new THREE.MeshStandardMaterial({map:t,roughness:.45,metalness:.6}),escBand,escBand,escBand]);b.position.set(0,rise/2,off);b.rotation.z=ang;b.userData.esc=ei;g.add(b);pickables.push(b);
   [-0.62,0.62].forEach(s=>{const side=new THREE.Mesh(new THREE.PlaneGeometry(len,1.0),escSide);side.position.set(0,rise/2+0.85,off+s);side.rotation.z=ang;g.add(side);
    const hr=new THREE.Mesh(new THREE.BoxGeometry(len,0.09,0.11),railM);hr.position.set(0,rise/2+1.38,off+s);hr.rotation.z=ang;g.add(hr);
    // поручень не торчит в проход: на площадках он уходит в горизонталь и кончается у гребёнки
    [[-run/2-0.35,1.38],[run/2+0.35,rise+1.38]].forEach(([x,y])=>{const h2=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.09,0.11),railM);h2.position.set(x,y,off+s);g.add(h2);});});
   // гребёнки на площадках
   [[-run/2-0.45,0.02],[run/2+0.45,rise+0.02]].forEach(([x,y])=>{const c=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.04,1.2),combM);c.position.set(x,y,off);g.add(c);});});
  g.position.set(e.p[0],0,e.p[1]);g.rotation.y=-e.a;scene.add(g);
  // под лентой можно пройти там, где до её низа не меньше 2.2 м; закрыта только низкая часть у нижней площадки
  const lowL=Math.min(run,(2.2+0.45)*run/rise),lc=-run/2-0.4+(lowL+0.4)/2,lh=(lowL+0.4)/2;
  blockRect(e.p[0]+Math.cos(e.a)*lc,e.p[1]+Math.sin(e.a)*lc,e.a,lh,1.55,1);
  // узкую щель между эскалатором и стеной закрываем ограждением — чтобы не протискиваться
  {const dd=[Math.cos(e.a),Math.sin(e.a)],rr_=[-Math.sin(e.a),Math.cos(e.a)];[-1,1].forEach(sg=>{let gap=9;
    for(let t=-run/2;t<=-run/2+lowL;t+=0.7){let g_=0;for(let w=0.1;w<3;w+=0.15){const x=e.p[0]+dd[0]*t+rr_[0]*sg*(1.55+w),z=e.p[1]+dd[1]*t+rr_[1]*sg*(1.55+w);if(!isFloorF(1,x,z))break;g_=w;}gap=Math.min(gap,g_);}
    if(gap<2.0){const off=1.55+gap/2+0.1;blockRect(e.p[0]+dd[0]*lc+rr_[0]*sg*off,e.p[1]+dd[1]*lc+rr_[1]*sg*off,e.a,lh,gap/2+0.25,1);
     const gl=new THREE.Mesh(new THREE.BoxGeometry(lowL+0.4,1.05,0.04),escSide);gl.position.set(e.p[0]+dd[0]*lc+rr_[0]*sg*(1.55+0.05),0.53,e.p[1]+dd[1]*lc+rr_[1]*sg*(1.55+0.05));gl.rotation.y=-e.a;scene.add(gl);}});}
  const top=new V3(e.top[0],FY[2],e.top[1]),bot=new V3(e.bot[0],0,e.bot[1]);
  world.escs.push({i:ei,p:e.p,a:e.a,d,r,top,bot,run,rise,ang});
  // указатели у площадок
  const up=sprite('Эскалатор ↑ 2 этаж','#475569');up.position.copy(bot).addScaledVector(d,-1.2).addScaledVector(r,0.72);up.position.y=2.9;up.scale.set(3.2,0.7,1);scene.add(up);
  const dn=sprite('Эскалатор ↓ 1 этаж','#475569');dn.position.copy(top).addScaledVector(d,1.2).addScaledVector(r,-0.72);dn.position.y=FY[2]+2.9;dn.scale.set(3.2,0.7,1);G('f2').add(dn);
  const sp=sprite('Эскалатор','#6b7785');sp.position.set(e.p[0],FLOOR_H+3,e.p[1]);sp.scale.set(9,2,1);G('toponly1').add(sp);
  const sp3=sprite('Эскалатор','#6b7785');sp3.position.set(e.p[0],ROOF_Y+3,e.p[1]);sp3.scale.set(9,2,1);G('toponly2').add(sp3);});

 // ---- островки: квадратные стенды с прилавком по периметру и продавцом в центре (на каждом этаже свои)
 const kList=S.filter(s=>s.kind==='kiosk');world.kSets=[];
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


 // ---- лифты: по официальной схеме ТРЦ, у стены, дверью в галерею на обоих этажах
 world.lifts=[];
 {const shaftM=new THREE.MeshStandardMaterial({color:LIN('#d7e8ee'),transparent:true,opacity:.28,roughness:.04,metalness:.6,depthWrite:false,side:THREE.DoubleSide});
  const cabM=new THREE.MeshStandardMaterial({color:LIN('#c9ced3'),roughness:.3,metalness:.8});const cabFloor=new THREE.MeshStandardMaterial({color:LIN('#3a3f45'),roughness:.6});
  const HL=1.3;// половина стороны шахты
  const okCell=(x,z)=>isFloorF(1,x,z)&&isFloorF(2,x,z)&&isWalkF(1,x,z)&&isWalkF(2,x,z);
  function fits(cx,cz,a){const ca=Math.cos(a),sa=Math.sin(a);const n=[sa,ca],R=[ca,-sa];
   for(let u=-HL;u<=HL;u+=0.3)for(let v=-HL;v<=HL+2.6;v+=0.3){const x=cx+R[0]*u+n[0]*v,z=cz+R[1]*u+n[1]*v;if(!okCell(x,z))return -1;}
   // по бокам — стена вплотную или свободно не меньше 2,1 м: без узких щелей
   for(const sg of [-1,1])for(let v=-HL;v<=HL;v+=0.4)for(const f of [1,2]){let open=null;for(let w=0.3;w<=2.4;w+=0.3){const x=cx+R[0]*sg*(HL+w)+n[0]*v,z=cz+R[1]*sg*(HL+w)+n[1]*v;
    const fl=isFloorF(f,x,z);if(open===null){open=fl;if(!fl)break;}else if(!fl||!isWalkF(f,x,z))return -1;if(fl&&!isWalkF(f,x,z))return -1;}}
   let wall=0;for(let u=-HL;u<=HL;u+=0.3){const x=cx-n[0]*(HL+0.5)+R[0]*u,z=cz-n[1]*(HL+0.5)+R[1]*u;if(!isFloorF(2,x,z))wall++;}return wall;}
  LIFTS_PLAN.forEach((lp,li)=>{let best=null;
   for(let a=0;a<Math.PI*2-0.01;a+=Math.PI/12)for(let dx=-16;dx<=16;dx+=0.8)for(let dz=-16;dz<=16;dz+=0.8){const d=Math.hypot(dx,dz);if(d>16)continue;const cx=lp[0]+dx,cz=lp[1]+dz;const w=fits(cx,cz,a);if(w<0)continue;
    const sc=w*1.5-d*0.35;if(!best||sc>best.sc)best={cx,cz,a,sc};}
   if(!best)return;const {cx,cz,a}=best;const n=new V3(Math.sin(a),0,Math.cos(a)),R=new V3(Math.cos(a),0,-Math.sin(a));
   const g=new THREE.Group();g.position.set(cx,0,cz);g.rotation.y=a;scene.add(g);
   // шахта: угловые стойки, стекло с трёх сторон, над дверями — стекло
   [[-HL,-HL],[HL,-HL],[-HL,HL],[HL,HL]].forEach(([x,z])=>{const p=new THREE.Mesh(new THREE.BoxGeometry(0.14,ROOF_Y,0.14),MAT.white);p.position.set(x,ROOF_Y/2,z);g.add(p);});
   const wallG=new THREE.PlaneGeometry(HL*2,ROOF_Y);
   [[0,-HL,0],[-HL,0,Math.PI/2],[HL,0,Math.PI/2]].forEach(([x,z,r])=>{const m=new THREE.Mesh(wallG,shaftM);m.position.set(x,ROOF_Y/2,z);m.rotation.y=r;m.renderOrder=2;m.userData.lift=li;g.add(m);pickables.push(m);});
   [1,2].forEach(f=>{const y0=FY[f],top=f===1?FLOOR_H:ROOF_Y;const m=new THREE.Mesh(new THREE.PlaneGeometry(HL*2,top-y0-2.4),shaftM);m.position.set(0,y0+2.4+(top-y0-2.4)/2,HL);m.renderOrder=2;g.add(m);
    const fr=new THREE.Mesh(new THREE.BoxGeometry(HL*2+0.1,0.14,0.16),MAT.darkMetal);fr.position.set(0,y0+2.4,HL);g.add(fr);
    const sp=sprite('Лифт · '+f+' этаж','#0e7490');sp.position.set(cx+n.x*(HL+0.05),y0+3.05,cz+n.z*(HL+0.05));sp.scale.set(2.6,0.57,1);scene.add(sp);
    const tsp=sprite('Лифт','#0e7490');tsp.position.set(cx,(f===1?FLOOR_H:ROOF_Y)+4,cz);tsp.scale.set(8,1.8,1);G('toponly'+f).add(tsp);});
   // кабина
   const cab=new THREE.Group();const cf=new THREE.Mesh(new THREE.BoxGeometry(HL*2-0.2,0.12,HL*2-0.2),cabFloor);cf.position.y=0.06;cab.add(cf);
   const cc=new THREE.Mesh(new THREE.BoxGeometry(HL*2-0.2,0.1,HL*2-0.2),cabM);cc.position.y=2.45;cab.add(cc);
   const cl=new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.2),MAT.light);cl.rotation.x=Math.PI/2;cl.position.y=2.39;cab.add(cl);
   const cb=new THREE.Mesh(new THREE.BoxGeometry(HL*2-0.2,2.4,0.05),cabM);cb.position.set(0,1.25,-HL+0.12);cab.add(cb);
   const hr=new THREE.Mesh(new THREE.BoxGeometry(HL*2-0.4,0.05,0.06),MAT.metal);hr.position.set(0,0.95,-HL+0.2);cab.add(hr);
   g.add(cab);
   // двери на каждом этаже
   const leafG=new THREE.BoxGeometry(HL-0.05,2.35,0.05);leafG.translate(0,1.175,0);const leafM=new THREE.MeshStandardMaterial({color:LIN('#aeb4ba'),roughness:.25,metalness:.9});
   const leaves={};[1,2].forEach(f=>{leaves[f]=[-1,1].map(sg=>{const l=new THREE.Mesh(leafG,leafM);l.position.set(sg*(HL/2),FY[f],HL+0.04);g.add(l);return l;});});
   blockRect(cx,cz,a,HL+0.15,HL+0.15,1);blockRect(cx,cz,a,HL+0.15,HL+0.15,2);
   world.lifts.push({id:li,c:new V3(cx,0,cz),n,R,a,g,cab,leaves,open:{1:0,2:0},cabY:FY[1],at:1,HL});});}

 // ---- кадки с деревьями и скамейки (как на фото ТРЦ) и столики фуд-корта — там, где просторно
 {const lat=(pts,seg)=>new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg||24);
  const potG=lat([[0,0],[0.42,0],[0.5,0.55],[0.47,0.56],[0,0.5]],28),trunkG=Cy(0.05,0.07,1.3,0,1.1,0,8);
  const leafG=mergeG([[0,2.05,0,0.62],[0.34,1.8,0.1,0.42],[-0.3,1.85,-0.1,0.45],[0.1,2.4,-0.18,0.4],[-0.12,1.7,0.3,0.38]].map(([x,y,z,r])=>new THREE.IcosahedronGeometry(r,1).translate(x,y,z)));
  const seatG=mergeG([B(1.6,0.06,0.42,0,0.45,0),B(1.6,0.34,0.05,0,0.7,-0.2)]),legsG=mergeG([-0.65,0.65].map(x=>B(0.06,0.42,0.4,x,0.21,0)));
  const topG=Cy(0.45,0.45,0.035,0,0.74,0,28),stemG=mergeG([Cy(0.035,0.035,0.72,0,0.36,0,8),Cy(0.25,0.25,0.02,0,0.01,0,20)]);
  const chairG=mergeG([B(0.42,0.05,0.42,0,0.45,0),B(0.42,0.42,0.04,0,0.68,-0.19),...[[-0.18,-0.18],[0.18,-0.18],[-0.18,0.18],[0.18,0.18]].map(([x,z])=>Cy(0.015,0.015,0.45,x,0.22,z,6))]);
  const near=(f,x,z,R)=>world.doors.some(s=>s.door.floor===f&&Math.hypot(s.door.c.x-x,s.door.c.z-z)<R)||world.escs.some(E=>{const dx=x-E.p[0],dz=z-E.p[1];return Math.abs(dx*E.d.x+dz*E.d.z)<E.run/2+R&&Math.abs(dx*E.r.x+dz*E.r.z)<1.6+R;})||world.lifts.some(L=>Math.hypot(L.c.x-x,L.c.z-z)<R+1.5)||S.some(k=>k.kind==='kiosk'&&k.floor===f&&Math.hypot(k.p[0]-x,k.p[1]-z)<3);
  const freeDisk=(f,x,z,r)=>{for(let a=0;a<8;a++)for(const d of [0,r*0.5,r]){if(!isWalkF(f,x+Math.cos(a*0.785)*d,z+Math.sin(a*0.785)*d))return false;}return true;};
  [1,2].forEach(f=>{const y0=FY[f],grp=f===1?scene:G('f2'),rnd=mulberry(31+f),plants=[],tables=[],st=Math.round(2.5/CELL);
   // столики фуд-корта
   if(f===2)for(let j=0;j<GH;j+=Math.round(4.0/CELL))for(let i=0;i<GW;i+=Math.round(4.0/CELL)){if(!hall2[j*GW+i])continue;const [x,z]=fromPx(i,j);
    if(clearance(2,x,z,3)<2.6||!freeDisk(2,x,z,1.3)||near(2,x,z,3.5))continue;tables.push({x,z,a:rnd()*0.4});blockRect(x,z,0,0.95,0.95,2);}
   for(let j=0;j<GH;j+=st)for(let i=0;i<GW;i+=st){if(!GRIDS[f][j*GW+i])continue;const [x,z]=fromPx(i,j);
    if(f===2&&hall2[j*GW+i])continue;if(clearance(f,x,z,6)<2.8||!freeDisk(f,x,z,1.2))continue;if(plants.some(q=>Math.hypot(q.x-x,q.z-z)<(DEC?13:16)))continue;
    // ось коридора: направление, вдоль которого дальше всего свободно; группа «кадка + лавочка» ставится по центру коридора вдоль оси
    const run=(x0,z0,dx,dz,mx)=>{let t=0;for(;t<mx;t+=0.3){if(!isWalkF(f,x0+dx*t,z0+dz*t))break;}return t;};
    let bestA=0,bestL=-1;for(let k=0;k<36;k++){const a=k*Math.PI/36,dx=Math.cos(a),dz=Math.sin(a);const L=run(x,z,dx,dz,14)+run(x,z,-dx,-dz,14);if(L>bestL){bestL=L;bestA=a;}}
    const ax=Math.cos(bestA),az=Math.sin(bestA),px_=-az,pz_=ax;const wl=run(x,z,px_,pz_,12),wr=run(x,z,-px_,-pz_,12);
    if(wl+wr<6.2||bestL<8)continue;const sh=(wl-wr)/2,cx=x+px_*sh,cz=z+pz_*sh;
    // всё место под группой и по 2.4 м по бокам должно быть свободно
    let ok=true;for(let t=-1.9;t<=1.9&&ok;t+=0.3)for(const o of [-2.4,0,2.4]){if(!isWalkF(f,cx+ax*t+px_*o,cz+az*t+pz_*o)){ok=false;break;}}
    if(!ok||near(f,cx,cz,6)||plants.some(q=>Math.hypot(q.x-cx,q.z-cz)<(DEC?13:16)))continue;
    plants.push({x:cx-ax*1.25,z:cz-az*1.25,a:bestA,bx:cx+ax*0.35,bz:cz+az*0.35});}
   plants.forEach(p=>{blockRect(p.x,p.z,0,0.6,0.6,f);blockRect(p.bx,p.bz,p.a,0.85,0.35,f);});
   const N=Math.max(1,plants.length),q=new THREE.Quaternion(),Y=new V3(0,1,0),one=new V3(1,1,1);
   const pot=new THREE.InstancedMesh(potG,new THREE.MeshStandardMaterial({color:LIN('#e9e6e0'),roughness:.4}),N),trunk=new THREE.InstancedMesh(trunkG,new THREE.MeshStandardMaterial({color:LIN('#6b5139'),roughness:.9}),N);
   const leaf=new THREE.InstancedMesh(leafG,new THREE.MeshStandardMaterial({color:LIN('#4f7a44'),roughness:.85,flatShading:true}),N);
   const seat=new THREE.InstancedMesh(seatG,new THREE.MeshStandardMaterial({color:LIN('#a47b52'),roughness:.6}),N),bl=new THREE.InstancedMesh(legsG,MAT.darkMetal,N);
   plants.forEach((p,i)=>{mtx.makeTranslation(p.x,y0,p.z);pot.setMatrixAt(i,mtx);trunk.setMatrixAt(i,mtx);q.setFromAxisAngle(Y,p.a);mtx.compose(new V3(p.x,y0,p.z),q,one);leaf.setMatrixAt(i,mtx);leaf.setColorAt(i,LIN(['#4f7a44','#5b8a4c','#44703f'][i%3]));
    q.setFromAxisAngle(Y,-p.a);mtx.compose(new V3(p.bx,y0,p.bz),q,one);seat.setMatrixAt(i,mtx);bl.setMatrixAt(i,mtx);});
   [pot,trunk,leaf,seat,bl].forEach(m=>{m.count=plants.length;if(m.instanceColor)m.instanceColor.needsUpdate=true;grp.add(m);});
   if(tables.length){const T=tables.length,top=new THREE.InstancedMesh(topG,MAT.white,T),stem=new THREE.InstancedMesh(stemG,MAT.darkMetal,T),ch=new THREE.InstancedMesh(chairG,new THREE.MeshStandardMaterial({color:LIN('#8a6a4a'),roughness:.6}),T*4);
    tables.forEach((t,i)=>{mtx.makeTranslation(t.x,y0,t.z);top.setMatrixAt(i,mtx);stem.setMatrixAt(i,mtx);for(let k=0;k<4;k++){const a=t.a+k*Math.PI/2;q.setFromAxisAngle(Y,a+Math.PI);mtx.compose(new V3(t.x+Math.sin(a)*0.72,y0,t.z+Math.cos(a)*0.72),q,one);ch.setMatrixAt(i*4+k,mtx);}});
    [top,stem,ch].forEach(m=>grp.add(m));}
   world['decor'+f]={plants:plants.length,tables:tables.length,list:plants.map(p=>({x:+p.x.toFixed(2),z:+p.z.toFixed(2),a:+p.a.toFixed(3),bx:+p.bx.toFixed(2),bz:+p.bz.toFixed(2)}))};});}

 // ---- посетители: гуляют по галереям обоих этажей
 {const parts=humanParts();const NP=(coarse?48:110)*1;const r=mulberry(77);
  const cloth=['#2f3a4a','#6b7a8f','#7a3a3a','#3f5e4a','#c9b79c','#1f1f24','#8b6a4a','#4d4f7c','#d9d4cc','#5e3b4f','#9ea2a6','#e7e2d8'].map(LIN),pants=['#23262c','#3b4252','#5a5148','#2c3440','#6b6e73'].map(LIN),skin=['#e6c3a5','#d9b08c','#c6946b','#f0d2bb'].map(LIN);
  const torso=new THREE.InstancedMesh(parts.torso,new THREE.MeshStandardMaterial({roughness:.85}),NP),legs=new THREE.InstancedMesh(parts.legs,new THREE.MeshStandardMaterial({roughness:.8}),NP),arms=new THREE.InstancedMesh(parts.arms,new THREE.MeshStandardMaterial({roughness:.85}),NP),head=new THREE.InstancedMesh(parts.head,new THREE.MeshStandardMaterial({roughness:.6}),NP);
  const hair=new THREE.InstancedMesh(parts.hair,new THREE.MeshStandardMaterial({roughness:.7}),NP),shoes=new THREE.InstancedMesh(parts.shoes,new THREE.MeshStandardMaterial({roughness:.6}),NP);
  const hairC=['#2a1f18','#4a3426','#1b1b1b','#7a5a3a','#b89a6e','#5e5e5e'].map(LIN),shoeC=['#1e1f22','#f0eee8','#5a4636','#3b3e44'].map(LIN);
  const shG=new THREE.PlaneGeometry(0.9,0.9);shG.rotateX(-Math.PI/2);const sh=new THREE.InstancedMesh(shG,new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false}),NP);
  const people=[];
  for(let i=0;i<NP;i++){const f=i%3===2?2:1;let x=0,z=0,tries=0;do{const j=Math.floor(r()*GH),k=Math.floor(r()*GW);[x,z]=fromPx(k,j);tries++;}while((!isWalkF(f,x,z)||blockedF(f,x,z))&&tries<600);
   const c=cloth[Math.floor(r()*cloth.length)];torso.setColorAt(i,c);arms.setColorAt(i,c);legs.setColorAt(i,pants[Math.floor(r()*pants.length)]);head.setColorAt(i,skin[Math.floor(r()*skin.length)]);hair.setColorAt(i,hairC[Math.floor(r()*hairC.length)]);shoes.setColorAt(i,shoeC[Math.floor(r()*shoeC.length)]);
   const sc=0.92+r()*0.16;people.push({f,x,z,tx:x,tz:z,sp:(1.0+r()*0.5),sc,a:r()*6.28,wait:r()*4,ph:r()*6.28});}
  [torso,legs,arms,head,hair,shoes].forEach(m=>{if(m.instanceColor)m.instanceColor.needsUpdate=true;G('people').add(m);});G('people').add(sh);
  world.people={list:people,meshes:[torso,legs,arms,head,hair,shoes],sh,r};updatePeople(0,0);}
 // ---- колесо обозрения
 const wheel=new THREE.Group();const wM=new THREE.MeshStandardMaterial({color:LIN('#f2f2f2'),roughness:.35,metalness:.4});
 const R=25;wheel.add(new THREE.Mesh(new THREE.TorusGeometry(R,.45,8,96),wM));wheel.add(new THREE.Mesh(new THREE.TorusGeometry(R-2,.25,6,96),wM));
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2;const sp=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,R,6),wM);sp.position.set(Math.cos(a)*R/2,Math.sin(a)*R/2,0);sp.rotation.z=a-Math.PI/2;wheel.add(sp);}
 const cab=[];const cc=['#e85d5d','#3fa7d6','#f2b33d','#59b36b'];
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2;const c=new THREE.Mesh(new THREE.BoxGeometry(2.2,2.4,2.2),new THREE.MeshStandardMaterial({color:LIN(cc[i%4]),roughness:.4}));c.position.set(Math.cos(a)*R,Math.sin(a)*R-1.3,0);wheel.add(c);cab.push(c);}
 const WX=e3.p[0]+e3.d[0]*70-e3.d[1]*40,WZ=e3.p[1]+e3.d[1]*70+e3.d[0]*40,WR=Math.atan2(e3.d[0],e3.d[1])+Math.PI/2;
 const wg=new THREE.Group();wg.position.set(WX,30,WZ);wg.rotation.y=WR;wg.add(wheel);scene.add(wg);
 [-1,1].forEach(sg=>{const leg=new THREE.Mesh(new THREE.CylinderGeometry(.5,.8,32,8),wM);leg.position.set(WX+sg*9*Math.cos(WR),15,WZ-sg*9*Math.sin(WR));leg.rotation.y=WR;leg.rotateZ(sg*0.3);scene.add(leg);});
 const wsp=sprite('Колесо обозрения · 55 м','#0e7490');wsp.position.set(WX,60,WZ);wsp.scale.set(18,4,1);scene.add(wsp);
 world.wheel=wheel;world.cabins=cab;

 const tm=new THREE.Mesh(new THREE.OctahedronGeometry(0.6),new THREE.MeshBasicMaterial({color:LIN('#0e7490')}));tm.visible=false;scene.add(tm);world.target=tm;
 const pm=new THREE.Group();const cone=new THREE.Mesh(new THREE.ConeGeometry(3,7,3),new THREE.MeshBasicMaterial({color:LIN('#e11d48')}));cone.rotation.x=-Math.PI/2;cone.position.z=-1;pm.add(cone);
 const dot=new THREE.Mesh(new THREE.CircleGeometry(4.5,32),new THREE.MeshBasicMaterial({color:LIN('#e11d48'),transparent:true,opacity:.25}));dot.rotation.x=-Math.PI/2;dot.position.y=-0.5;pm.add(dot);
 pm.visible=false;scene.add(pm);world.pmark=pm;
}
function sprite(text,bg){
 const t=canvasTex(512,112,(g,w,h)=>{rr(g,4,8,w-8,h-16,26);g.fillStyle=bg;g.fill();g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';fitFont(g,text,w-60,46,700);g.fillText(text,w/2,h/2+2);});
 const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,toneMapped:false}));sp.scale.set(5,1.1,1);return sp;
}
/* ---------- Состояние и управление ---------- */
const eS=D.ents.find(e=>e.n===2)||D.ents[0];
const player={x:eS.p[0]-eS.d[0]*6,z:eS.p[1]-eS.d[1]*6,yaw:Math.atan2(eS.d[0],eS.d[1]),pitch:0.02,vx:0,vz:0};
const topv={x:0,z:0,h:300};
let mode='walk',anim=null,filter=null,target=null,ride=null;
const keys={};let joyV={x:0,y:0,run:0};const EYE=1.65;
// режим без анимации: из настроек системы или по кнопке; выбор запоминается
let calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
try{const v=localStorage.getItem('maxi-calm');if(v!==null)calm=v==='1';}catch(e){}
function eyeY(){if(ride)return ride.y+EYE;return (mode==='store'?0:FY[curFloor])+EYE;}
function walkPose(){return{p:new V3(player.x,eyeY(),player.z),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(player.pitch,player.yaw,0,'YXZ'))};}
const dummy=new THREE.PerspectiveCamera();
function topPose(){const p=new V3(topv.x,topv.h,topv.z+0.001);dummy.position.copy(p);dummy.up.set(0,0,-1);dummy.lookAt(topv.x,0,topv.z);return{p,q:dummy.quaternion.clone()};}
function applyPose(o){cam.position.copy(o.p);cam.quaternion.copy(o.q);}
const bb=(()=>{let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;D.bld.forEach(p=>p.forEach(q=>{x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}));return{x0,x1,z0,z1};})();
function fitTop(){const t=Math.tan(THREE.MathUtils.degToRad(cam.fov/2));const hw=(bb.x1-bb.x0)/2/(t*cam.aspect),hz=(bb.z1-bb.z0)/2/t;topv.x=(bb.x0+bb.x1)/2;topv.z=(bb.z0+bb.z1)/2;topv.h=Math.min(1100,Math.max(hw,hz)*1.06);}
// вид сверху показывает один этаж: для первого снимаем перекрытие, для второго — крышу
function setVis(){const top=mode==='top',f=curFloor;
 G('shell').visible=!top;G('roof').visible=!top;G('spots').visible=!top;G('slab').visible=!top||f===2;G('f2').visible=!top||f===2;
 G('toplabels1').visible=top&&f===1;G('toplabels2').visible=top&&f===2;G('toponly1').visible=top&&f===1;G('toponly2').visible=top&&f===2;
 world.pmark.visible=top;
 scene.fog.near=top?3000:FOGW[0];scene.fog.far=top?5000:FOGW[1];}
function topY(){return curFloor===1?FLOOR_H:ROOF_Y;}
function setMode(m,opts){
 if(m===mode&&!opts)return;const from={p:cam.position.clone(),q:cam.quaternion.clone()};
 mode=m;$('bWalk').classList.toggle('on',m==='walk');$('bTop').classList.toggle('on',m==='top');
 if(m==='top'){if(!opts||!opts.keep)fitTop();topv.h=clampH(topv.h);setVis();}else hideGoHere();
 anim={t:calm?1:0,from,m};updateJoy();if(m==='top')releaseLock();updateCross();if(target)openCard(target);
}
function updateJoy(){$('joy').hidden=!(coarse&&(mode==='walk'||mode==='store')&&!ride);}
const PR=0.35;
function blockedF(f,x,z){return !(isWalkF(f,x+PR,z)&&isWalkF(f,x-PR,z)&&isWalkF(f,x,z+PR)&&isWalkF(f,x,z-PR));}
function blocked(x,z){if(mode==='store'&&SHOP)return shopBlocked(x,z);return blockedF(curFloor,x,z);}
function tryMove(dx,dz){const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/0.1));for(let i=0;i<n;i++){if(!blocked(player.x+dx/n,player.z))player.x+=dx/n;if(!blocked(player.x,player.z+dz/n))player.z+=dz/n;}}
// смена этажа: та же точка плана на другом этаже (или заданная)
function setFloor(f,at){if(f===curFloor&&!at)return;curFloor=f;
 if(at){player.x=at.x;player.z=at.z;if(at.yaw!=null)player.yaw=at.yaw;}
 if(blockedF(f,player.x,player.z)){const w=nearestFree(player.x,player.z,160,f)||nearestAny(f,player.x,player.z);if(w){player.x=w[0];player.z=w[1];}}
 if(target&&target.floor!==f)closeCard();
 updateFloorUI();setVis();drawMiniBase();}
function updateFloorUI(){$('bF1').classList.toggle('on',curFloor===1);$('bF2').classList.toggle('on',curFloor===2);$('brandFloor').textContent=curFloor+' этаж · Тула';}
function goFloor(f){if(f===curFloor||mode==='store'||ride)return;
 if(mode==='top'){setFloor(f);topv.h=clampH(topv.h);return;}
 const go=()=>{setFloor(f);anim=null;applyPose(walkPose());showHint(f===2?'Второй этаж: кино, фуд-корт, ДНС, Детский мир и другие магазины':'Первый этаж: входы, гипермаркеты и большинство магазинов');};
 if(calm)go();else fadeThen(go);}

const ptrs=new Map();let downInfo=null,pinch0=0;
// ---- управление мышью без курсора (захват указателя)
let locked=false,lockFailed=!('requestPointerLock' in HTMLCanvasElement.prototype),lockErrors=0,mouse={in:false,x:0,y:0};
function lockError(){lockErrors++;if(lockErrors>=3)lockFailed=true;updateCross();showHint(lockFailed?'Браузер не даёт скрыть курсор — обзор поворачивается, когда уводишь мышь от центра. Клик по сцене снова попробует скрыть курсор.':'Кликни по сцене ещё раз, чтобы продолжить прогулку');}
function requestLock(){try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(lockError);}catch(e){lockError();}}
function releaseLock(){if(document.pointerLockElement)document.exitPointerLock();}
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;if(locked){lockErrors=0;lockFailed=false;hideHint();}updateCross();});
document.addEventListener('pointerlockerror',lockError);
function isFP(){return mode==='walk'||mode==='store';}
function panelsClosed(){return $('card').hidden&&$('shop').hidden&&$('lift').hidden&&$('cartBox').hidden&&$('bigmap').hidden&&$('info').hidden&&!fitOpen();}
function updateCross(){$('cross').hidden=!(locked&&isFP());$('aim').hidden=!(locked&&isFP());$('lockTip').hidden=!(!coarse&&!locked&&isFP()&&panelsClosed()&&!ride);}
canvas.addEventListener('pointerdown',e=>{
 if(ride&&ride.kind!=='esc')return;
 if(ride){canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});return;}
 if(e.pointerType==='mouse'&&!coarse&&isFP()){
  if(locked){if(e.button===0)pick(innerWidth/2,innerHeight/2,true);return;}
  if(!$('card').hidden)closeCard();if(!$('shop').hidden)closeShopPanel(false);if(!$('lift').hidden)hideLiftPanel(true);
  requestLock();if(!lockFailed)return;}
 canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(ptrs.size===1)downInfo={t:performance.now(),moved:0};
 if(ptrs.size===2){const a=[...ptrs.values()];pinch0=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(downInfo)downInfo.moved=99;}});
canvas.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
 if(downInfo)downInfo.moved+=Math.abs(dx)+Math.abs(dy);
 if(ptrs.size===2&&mode==='top'){const a=[...ptrs.values()];const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinch0>0)topv.h=clampH(topv.h*pinch0/d);pinch0=d;return;}
 if(anim||(ride&&ride.kind!=='esc'))return;
 if(isFP()){const k=(coarse?0.0105:0.0045)*PREFS.sens;player.yaw-=dx*k;player.pitch=Math.max(-1.2,Math.min(1.2,player.pitch-dy*k));hideHint();}
 else{const sc=2*(topv.h-topY())*Math.tan(THREE.MathUtils.degToRad(cam.fov/2))/innerHeight;topv.x-=dx*sc;topv.z-=dy*sc;topv.x=Math.max(bb.x0-60,Math.min(bb.x1+60,topv.x));topv.z=Math.max(bb.z0-60,Math.min(bb.z1+80,topv.z));hideGoHere();}});
const SENS_BASE=0.0021;let lookDX=0,lookDY=0;
document.addEventListener('mousemove',e=>{
 if(e.target===canvas){mouse.in=true;mouse.x=e.clientX;mouse.y=e.clientY;}
 if(coarse||!isFP()||anim||(ride&&ride.kind!=='esc'))return;
 if(locked){lookDX+=(e.movementX||0);lookDY+=(e.movementY||0);}});
canvas.addEventListener('mouseleave',()=>{mouse.in=false;});
function endPtr(e){ptrs.delete(e.pointerId);if(ptrs.size<2)pinch0=0;
 if(ptrs.size===0&&downInfo){if(downInfo.moved<8&&performance.now()-downInfo.t<450)pick(e.clientX,e.clientY);downInfo=null;}}
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('wheel',e=>{e.preventDefault();if(ride)return;if(mode==='top'){topv.h=clampH(topv.h*Math.exp(e.deltaY*0.0012));hideGoHere();}else{const f=-Math.sign(e.deltaY)*2;tryMove(-Math.sin(player.yaw)*f,-Math.cos(player.yaw)*f);}},{passive:false});
function clampH(h){return Math.max(topY()+12,Math.min(1100,h));}

const joy=$('joy'),knob=$('knob');let joyId=null;
// джойстик: внутри круга — шаг, палец за краем круга — бег (плавно, до скорости Shift на компьютере)
function joyAt(e){const r=joy.getBoundingClientRect(),R=r.width/2;let x=(e.clientX-r.left-R)/R,y=(e.clientY-r.top-R)/R;const l=Math.hypot(x,y);
 const run=Math.max(0,Math.min(1,(l-1.02)/0.45));if(l>1){x/=l;y/=l;}joyV={x,y,run};const kr=R*0.58+run*R*0.3;knob.style.transform=`translate(${x*kr}px,${y*kr}px)`;joy.classList.toggle('run',run>0.05);
 if(run>0.05&&!joyAt.told){joyAt.told=true;try{localStorage.setItem('maxi-runtip','1');}catch(_){}}}
joy.addEventListener('pointerdown',e=>{joyId=e.pointerId;joy.setPointerCapture(e.pointerId);joyAt(e);hideHint();});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)joyAt(e);});
const joyEnd=e=>{if(e.pointerId!==joyId)return;joyId=null;joyV={x:0,y:0,run:0};knob.style.transform='';joy.classList.remove('run');};
joy.addEventListener('pointerup',joyEnd);joy.addEventListener('pointercancel',joyEnd);

addEventListener('keydown',e=>{
 if(ride&&e.target.tagName!=='INPUT'&&(e.code==='KeyW'||e.code==='ArrowUp'||e.code==='ShiftLeft'||e.code==='ShiftRight'))keys[e.code]=true;// на эскалаторе: зажал W — бежишь по ленте
 if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT'){if(e.key==='Escape'){closeSearch();closeCart();}if(e.key==='Enter'&&e.target.id==='q'){const f=$('results').querySelector('li[data-id]');if(f)f.click();}return;}
 if(e.key==='/'){e.preventDefault();openSearch();return;}
 if(e.key==='Escape'){if(!$('bigmap').hidden){closeBigMap();return;}if(!$('cartBox').hidden){closeCart();return;}if(!$('lift').hidden){hideLiftPanel(false);return;}if(!locked)closeCard();$('info').hidden=true;hideGoHere();if(!$('shop').hidden&&!locked)closeShopPanel(false);return;}
 if(ride||!$('bigmap').hidden||fitOpen())return;
 if(e.key==='Enter'&&mode==='store'){shopPick(innerWidth/2,innerHeight/2);return;}
 if(e.key==='Enter'&&target&&mode==='walk'){if(target.door)walkToDoor(target);else walkTo(target);return;}
 if(e.code==='KeyV'){if(mode!=='store')setMode(mode==='walk'?'top':'walk');return;}
 if(e.code==='Digit1'||e.code==='Digit2'){goFloor(e.code==='Digit1'?1:2);return;}
 keys[e.code]=true;if(e.code.startsWith('Arrow'))e.preventDefault();});
addEventListener('keyup',e=>{keys[e.code]=false;});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});

/* ---------- Выбор ---------- */
const ray=new THREE.Raycaster();
function visibleHits(x,y){ray.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-(y/innerHeight)*2+1),cam);
 return ray.intersectObjects(pickables,false).filter(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;});}
function hitId(h){if(h.object.userData.lift!=null)return{lift:world.lifts[h.object.userData.lift]};if(h.object.userData.esc!=null)return{esc:world.escs[h.object.userData.esc]};let id=-1;if(h.object.userData.kiosks&&h.instanceId!=null){id=h.object.userData.kiosks[h.instanceId];if(id>=0&&S[id].kind==='kiosk')return{s:S[id],stand:true,seller:!!h.object.userData.seller};}else if(h.object.userData.fs)id=h.object.userData.fs[h.faceIndex];return id>=0?{s:S[id]}:null;}
function pick(x,y,fromLock){if(ride)return;if(mode==='store'&&SHOP){shopPick(x,y);return;}
 const hits=visibleHits(x,y);
 for(const h of hits){const r=hitId(h);if(!r)continue;
  if(r.lift){if(fromLock)releaseLock();openLiftPanel(r.lift,true);return;}
  if(r.esc){if(mode==='walk')goEscalator(r.esc);return;}
  if(mode==='top'&&r.s.floor!==curFloor)continue;
  if((r.stand||r.s.island)&&mode==='walk'&&kioskHasGoods(r.s)){if(h.distance>7){showHint('Подойди к островку «'+r.s.name+'», чтобы посмотреть товары');return;}closeCard();openKioskPanel(r.s);if(fromLock)releaseLock();return;}
  openCard(r.s);hideGoHere();if(fromLock)releaseLock();return;}
 closeCard();
 if(mode==='top')topTap(x,y);}
function aimAt(){const hits=visibleHits(innerWidth/2,innerHeight/2);for(const h of hits){const r=hitId(h);if(h.distance>40)return null;if(r)return r;if(h.object.userData.fs&&!r)return null;}return null;}
function floorName(f){return f===1?'1 этаж':'2 этаж';}
function openCard(s){
 target=s;$('card').hidden=false;const c=CATS[s.cat];loadFeed(s);
 $('cCol').style.background=s.colHex;$('cCat').textContent=c.n;$('cName').textContent=s.name;$('cWhat').textContent=s.what||'';
 $('cMeta').textContent=s.kind==='kiosk'?floorName(s.floor)+' · островок в галерее':floorName(s.floor)+' · около '+Math.max(5,Math.round(s.area/5)*5)+' м²';
 const also=(s.names||[]).slice(1);
 if(s.cat==='wc'){$('cMeta').textContent=floorName(s.floor);$('cWhat').textContent='';}
 $('cInfo').textContent=(onlineText(s)?onlineText(s)+' ':'')+(s.cat==='wc'?(/МГН|инвалид/i.test(s.name)?'Здесь туалет для маломобильных посетителей.':'Здесь туалет.'):s.cat==='tbd'?(s.kind==='kiosk'?'Островок без подписи на картах.':s.floor===2?'На Яндекс Картах у этого помещения нет подписи.':'На Яндекс Картах у этого помещения нет подписи.'):(also.length?'Также здесь: '+also.join(', ')+'. ':'')+'Галерея работает с 10:00 до 21:00, точный режим магазина лучше проверить на картах.');
 const b=$('cBtns');b.innerHTML='';
 if(s.door){const en=document.createElement('button');en.className='btn pri';en.textContent=s.name==='Синема Парк'?'Войти в кинотеатр':'Войти в магазин';en.onclick=()=>{walkToDoor(s);requestLockIfNeeded();};b.appendChild(en);}
 if(onlineKind(s)==='act'){const a0=onlineActions(s)[0],ab=document.createElement('a');ab.className='btn pri';ab.target='_blank';ab.rel='noopener';ab.href=siteOf(s)||mapsOf(s);ab.textContent=ACTIONS[a0].btn;ab.title=siteOf(s)?'Сайт '+s.name:'Контакты на Яндекс Картах';b.appendChild(ab);}
 const go=document.createElement('button');go.className=s.door||onlineKind(s)==='act'?'btn':'btn pri';go.textContent=s.floor!==curFloor?'Подойти · '+floorName(s.floor):'Подойти';go.onclick=()=>{walkTo(s);requestLockIfNeeded();};b.appendChild(go);
 if(mode==='walk'){const t=document.createElement('button');t.className='btn';t.textContent='Показать сверху';t.onclick=()=>showTop(s);b.appendChild(t);}
 if(s.cat!=='tbd'&&s.cat!=='wc'){const a=document.createElement('a');a.className='btn';a.href='https://yandex.ru/maps/15/tula/search/'+encodeURIComponent(s.name+' ТРЦ Макси');a.target='_blank';a.rel='noopener';a.textContent='На Яндекс Картах ↗';b.appendChild(a);}
 const F=FLOORS[s.floor];const p=s.fp?s.fp.clone().addScaledVector(s.fn,1.5):new V3(s.c[0],0,s.c[1]);world.target.position.set(p.x,F.y0+(s.kind==='kiosk'?GLASS_H:F.GH)+1.4,p.z);world.target.userData.base=world.target.position.y;world.target.visible=true;
}
function closeCard(){$('card').hidden=true;target=null;if(world.target)world.target.visible=false;updateCross();}
$('cardX').onclick=()=>{closeCard();requestLockIfNeeded();};
function standPoint(s){
 if(s.kind==='kiosk'){for(let r=2.2;r<7;r+=0.8)for(let k=0;k<8;k++){const a=k/8*Math.PI*2,x=s.p[0]+Math.sin(a)*(r+s.w/2),z=s.p[1]+Math.cos(a)*(r+s.h/2);if(!blockedF(s.floor,x,z))return{x,z,yaw:Math.atan2(x-s.p[0],z-s.p[1])};}}
 if(s.fp){for(let d=3;d<14;d+=0.5){const p=s.fp.clone().addScaledVector(s.fn,d);if(!blockedF(s.floor,p.x,p.z))return{x:p.x,z:p.z,yaw:Math.atan2(s.fn.x,s.fn.z)};}}
 const c=nearestFree(s.fp?s.fp.x:s.c[0],s.fp?s.fp.z:s.c[1],200,s.floor);if(!c)return null;return{x:c[0],z:c[1],yaw:Math.atan2(c[0]-s.c[0],c[1]-s.c[1])};
}
// перенестись к точке (на любом этаже): плавный перелёт на своём этаже, затемнение — при смене этажа
function moveTo(f,x,z,yaw,pitch){const other=f!==curFloor;
 const put=()=>{if(other)setFloor(f,{x,z,yaw});player.x=x;player.z=z;player.yaw=yaw;player.pitch=pitch||0;player.vx=player.vz=0;
  if(mode!=='walk')setMode('walk');else if(other||calm){anim=null;applyPose(walkPose());}else anim={t:0,from:{p:cam.position.clone(),q:cam.quaternion.clone()},m:'walk'};};
 if(other&&!calm&&mode!=='top')fadeThen(put);else put();}
function walkTo(s){const sp=standPoint(s);if(!sp)return;
 moveTo(s.floor,sp.x,sp.z,sp.yaw,0.08);openCard(s);if(coarse)$('card').hidden=true;}
function walkToDoor(s){const d=s.door,r=2.2+(d.gap||0);closeCard();moveTo(d.floor,d.c.x+d.n.x*r,d.c.z+d.n.z*r,Math.atan2(d.n.x,d.n.z),0);showHint('Двери открыты — пройди вперёд, чтобы войти');}
function showTop(s){if(s.floor!==curFloor)setFloor(s.floor);topv.x=s.c[0];topv.z=s.c[1];topv.h=clampH(topY()+Math.max(45,Math.min(160,Math.sqrt(s.area||40)*4)));setMode('top',{keep:true});openCard(s);}

/* ---------- Вид сверху: нажми на коридор — «Перейти сюда» ---------- */
let goHereP=null;
function topTap(x,y){ray.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-(y/innerHeight)*2+1),cam);const o=ray.ray.origin,d=ray.ray.direction;if(Math.abs(d.y)<1e-6)return;
 const t=(FY[curFloor]-o.y)/d.y;if(t<=0)return;const px=o.x+d.x*t,pz=o.z+d.z*t;
 if(!isFloorF(curFloor,px,pz)){hideGoHere();return;}
 goHereP={x:px,z:pz};const el=$('goHere');el.hidden=false;el.style.left=Math.min(innerWidth-170,Math.max(10,x-80))+'px';el.style.top=Math.min(innerHeight-60,Math.max(70,y-64))+'px';}
function hideGoHere(){$('goHere').hidden=true;goHereP=null;}
$('goHere').onclick=()=>{if(!goHereP)return;const w=nearestFree(goHereP.x,goHereP.z,40,curFloor);hideGoHere();if(!w)return;const yaw=player.yaw;moveTo(curFloor,w[0],w[1],yaw,0);showHint('Ты здесь · '+floorName(curFloor)+'. Вернуться к виду сверху — кнопка «Сверху»');};

/* ---------- Фильтр ---------- */
function buildChips(){const box=$('chips');
 Object.entries(CATS).forEach(([k,c])=>{if(k==='tbd'||!S.some(s=>s.cat===k))return;const b=document.createElement('button');b.className='chip';const i=document.createElement('i');i.style.background=c.c;b.appendChild(i);b.appendChild(document.createTextNode(c.n));
  b.onclick=()=>{filter=filter===k?null:k;[...box.children].forEach(x=>x.classList.remove('on'));if(filter)b.classList.add('on');applyFilter();drawMiniBase();};box.appendChild(b);});}
function applyFilter(){const dim=LIN('#d9dcdf');
 [1,2].forEach(f=>{const m=world.tint[f];if(!m)return;const attr=m.geometry.attributes.color,arr=attr.array,base=world.tintColors[f],fs=m.userData.fs;
  for(let q=0;q<fs.length;q++){const s=S[fs[q]];const on=!filter||(s&&s.cat===filter);for(let v=0;v<3;v++){const i=(q*3+v)*3;
   if(on){arr[i]=base[i];arr[i+1]=base[i+1];arr[i+2]=base[i+2];}else{arr[i]=dim.r;arr[i+1]=dim.g;arr[i+2]=dim.b;}}}
  attr.needsUpdate=true;});
 const dimC=LIN('#c9cdd1');world.kSets.forEach(({body,rings,ids})=>{ids.forEach((id,i)=>{const s=S[id];const on=!filter||s.cat===filter;body.setColorAt(i,on?kioskBody(s):dimC);rings.forEach(r=>r.setColorAt(i,on?kioskGlow(s):dimC));});
  [body,...rings].forEach(m=>{if(m.instanceColor)m.instanceColor.needsUpdate=true;});});}

/* ---------- Поиск ---------- */
function openSearch(){$('search').hidden=false;$('q').value='';renderResults('');releaseLock();setTimeout(()=>$('q').focus(),30);}
function closeSearch(){$('search').hidden=true;canvas.focus();}
$('bSearch').onclick=openSearch;$('search').addEventListener('pointerdown',e=>{if(e.target.id==='search')closeSearch();});
$('q').addEventListener('input',e=>renderResults(e.target.value));
function renderResults(q){q=q.trim().toLowerCase();const ul=$('results');ul.innerHTML='';
 const named=S.filter(s=>s.cat!=='tbd');
 const list=named.filter(s=>!q||((s.names||[s.name]).join(' ')+' '+(s.what||'')+' '+CATS[s.cat].n+' '+CATS[s.cat].k+' '+s.floor+' этаж').toLowerCase().includes(q)).sort((a,b)=>{const ai=a.name.toLowerCase().startsWith(q)?0:1,bi=b.name.toLowerCase().startsWith(q)?0:1;return ai-bi||a.name.localeCompare(b.name,'ru');});
 if(!list.length){const li=document.createElement('li');li.style.cursor='default';li.style.color='var(--muted)';li.textContent='В ТРЦ такого не нашлось';ul.appendChild(li);return;}
 list.slice(0,100).forEach(s=>{const li=document.createElement('li');li.dataset.id=s.id;const i=document.createElement('i');i.style.background=s.colHex;const bt=document.createElement('b');bt.textContent=s.name;const sm=document.createElement('small');sm.textContent=(s.what||CATS[s.cat].n)+' · '+floorName(s.floor);li.append(i,bt,sm);
  li.onclick=()=>{closeSearch();if(mode==='top')showTop(s);else walkTo(s);};ul.appendChild(li);});}
$('bInfo').onclick=()=>{$('info').hidden=false;releaseLock();syncSettings();};$('infoOk').onclick=()=>{$('info').hidden=true;};$('infoX').onclick=()=>{$('info').hidden=true;};
/* ---------- Настройки: чувствительность, графика ---------- */
const GFX_NOTE={auto:coarse?'Качество подбирается само. На телефоне пол без живого отражения — так плавнее':'Качество подбирается само по скорости кадров',best:coarse?'Чётче картинка, свечение ламп. Отражение пола — облегчённое':'Полное отражение пола, сглаживание. Нужна хорошая видеокарта',fast:'Без тяжёлых эффектов — для слабых устройств и ноутбуков от батареи'};
function syncSettings(){const r=$('sensR');r.value=PREFS.sens;$('sensV').textContent=PREFS.sens<0.8?'ниже обычного':PREFS.sens>1.25?'выше обычного':'обычная';
 [...$('gfxSeg').children].forEach(b=>{const on=b.dataset.v===PREFS.gfx;b.classList.toggle('on',on);b.setAttribute('aria-checked',on);});$('gfxNote').textContent=GFX_NOTE[PREFS.gfx];}
$('sensR').addEventListener('input',e=>{setPref('sens',+e.target.value);syncSettings();});
$('gfxSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;setPref('gfx',b.dataset.v);FX.setMode(PREFS.gfx);syncSettings();});
$('info').addEventListener('pointerdown',e=>{if(e.target.id==='info')$('info').hidden=true;});
$('bWalk').onclick=()=>setMode('walk');$('bTop').onclick=()=>setMode('top');
$('bF1').onclick=()=>goFloor(1);$('bF2').onclick=()=>goFloor(2);

/* ---------- Режим без анимации ---------- */
function setCalm(v){calm=v;document.documentElement.classList.toggle('calm',v);$('calmT').checked=v;try{localStorage.setItem('maxi-calm',v?'1':'0');}catch(e){}
 if(v&&anim){anim.t=1;}}
$('calmT').addEventListener('change',e=>setCalm(e.target.checked));

/* ---------- Лифты ---------- */
let liftCur=null,liftAuto=null;
function liftFront(L,f){return{x:L.c.x+L.n.x*(L.HL+1.6),z:L.c.z+L.n.z*(L.HL+1.6)};}
function openLiftPanel(L,byClick){liftCur=L;const el=$('lift');el.hidden=false;
 const near=Math.hypot(player.x-L.c.x,player.z-L.c.z)<L.HL+4&&mode==='walk';
 $('liftNow').textContent=mode==='top'?'Лифт соединяет 1 и 2 этажи':'Ты на '+(curFloor===1?'первом':'втором')+' этаже'+(near?'':' · лифт в '+Math.round(Math.hypot(player.x-L.c.x,player.z-L.c.z))+' м');
 [1,2].forEach(f=>{const b=$('liftB'+f);b.disabled=f===curFloor&&mode!=='top';b.classList.toggle('on',f===curFloor);});
 if(byClick)releaseLock();updateCross();}
function hideLiftPanel(relock){$('lift').hidden=true;liftCur=null;if(relock)requestLockIfNeeded();else updateCross();}
[1,2].forEach(f=>{$('liftB'+f).onclick=()=>{const L=liftCur;if(!L)return;hideLiftPanel(false);
 if(mode==='top'||Math.hypot(player.x-L.c.x,player.z-L.c.z)>L.HL+4){// сначала подойти к лифту
  const from=mode==='top'?curFloor:curFloor;const p=liftFront(L,from);moveTo(from,p.x,p.z,Math.atan2(L.n.x,L.n.z),0);if(f===from){showHint('Ты у лифта');return;}
  setTimeout(()=>startRide(L,f),calm?0:950);return;}
 startRide(L,f);};});
$('liftX').onclick=()=>{hideLiftPanel(true);liftAuto=liftCur;};
function startRide(L,f){if(ride||mode==='store')return;if(f===curFloor){showHint('Ты уже на этом этаже');return;}
 closeCard();hideLiftPanel(false);const from=curFloor,p=liftFront(L,f),yawOut=Math.atan2(-L.n.x,-L.n.z);
 if(calm){L.at=f;L.cab.position.y=FY[f];setFloor(f,{x:p.x,z:p.z,yaw:yawOut});player.pitch=0;anim=null;applyPose(walkPose());showHint('Лифт приехал: '+floorName(f));return;}
 L.at=from;L.cab.position.y=FY[from];player.vx=player.vz=0;
 ride={L,from,to:f,t:0,phase:0,y:FY[from],x0:player.x,z0:player.z,yaw0:player.yaw,p0:player.pitch,yawOut};updateJoy();updateCross();showHint('Лифт едет на '+floorName(f)+'…');}
function updateRide(dt){const r=ride;if(!r)return;const L=r.L;r.t+=dt;
 const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
 const cx=L.c.x+L.n.x*0.1,cz=L.c.z+L.n.z*0.1;
 if(r.phase===0){const k=Math.min(1,r.t/0.3),e=ease(k);player.x=r.x0+(cx-r.x0)*e;player.z=r.z0+(cz-r.z0)*e;
  let da=((r.yawOut-r.yaw0+Math.PI*3)%(Math.PI*2))-Math.PI;player.yaw=r.yaw0+da*e;player.pitch=r.p0*(1-e);if(k>=1){r.phase=1;r.t=0;}}
 else if(r.phase===1){if(r.t>0.08){r.phase=2;r.t=0;}}
 else if(r.phase===2){const k=Math.min(1,r.t/0.35),e=ease(k);r.y=FY[r.from]+(FY[r.to]-FY[r.from])*e;L.cab.position.y=r.y;if(k>=1){r.phase=3;r.t=0;L.at=r.to;curFloor=r.to;updateFloorUI();setVis();drawMiniBase();}}
 else if(r.phase===3){if(r.t>0.08){r.phase=4;r.t=0;}}
 else if(r.phase===4){const p=liftFront(L,r.to),k=Math.min(1,r.t/0.3),e=ease(k);player.x=cx+(p.x-cx)*e;player.z=cz+(p.z-cz)*e;
  if(k>=1){ride=null;player.x=p.x;player.z=p.z;updateJoy();updateCross();showHint('Приехали: '+floorName(curFloor)+(curFloor===2?' · кино, фуд-корт, ДНС, Детский мир':''));}}}
function updateLifts(dt){if(!world.lifts)return;
 world.lifts.forEach(L=>{[1,2].forEach(f=>{let want=0;
  if(ride&&ride.L===L)want=((ride.phase===0&&f===ride.from)||(ride.phase>=3&&f===ride.to))?1:0;
  else if(mode==='walk'&&f===curFloor&&Math.hypot(player.x-L.c.x,player.z-L.c.z)<L.HL+3.2){want=1;if(L.at!==f){L.at=f;L.cab.position.y=FY[f];}}
  const o=L.open[f];const n=calm?want:o+(want-o)*Math.min(1,dt*5);L.open[f]=n;
  L.leaves[f].forEach((l,k)=>{const sg=k?1:-1,w=1-n*0.85;l.scale.x=w;l.position.x=sg*(L.HL-(L.HL-0.05)*w/2-0.02);});});});
 // панель лифта появляется сама, когда подходишь к дверям
 // лифт: шагнул в открытые двери — поехал на другой этаж (этажей два, выбирать нечего)
 if(mode==='walk'&&!ride&&!anim){const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),mv=Math.hypot(player.vx||0,player.vz||0)>0.3;
  for(const L of world.lifts){const dx=player.x-L.c.x,dz=player.z-L.c.z,a=dx*L.n.x+dz*L.n.z,lat=Math.abs(dx*L.R.x+dz*L.R.z);
   if(a>L.HL-0.2&&a<L.HL+1.1&&lat<L.HL-0.05&&-(fx*L.n.x+fz*L.n.z)>0.5&&mv&&L.open[curFloor]>0.6){hideLiftPanel(false);startRide(L,curFloor===1?2:1);return;}}}
 if(mode==='walk'&&!ride){let near=null;world.lifts.forEach(L=>{const dx=player.x-L.c.x,dz=player.z-L.c.z;const a=dx*L.n.x+dz*L.n.z;if(a>L.HL&&a<L.HL+2.8&&Math.abs(dx*L.R.x+dz*L.R.z)<L.HL+0.6)near=L;});
  if(near&&liftAuto!==near&&$('lift').hidden){liftAuto=near;openLiftPanel(near,false);}
  if(!near){if(liftAuto&&liftCur===liftAuto&&!$('lift').hidden)hideLiftPanel(false);liftAuto=null;}}}

/* ---------- Эскалаторы: встань на ленту — поедешь на другой этаж ---------- */
// вверх — правая лента (со стороны r), вниз — левая; точки входа — перед гребёнкой
function escEntry(E,up){return up?E.bot.clone().addScaledVector(E.d,-0.9).addScaledVector(E.r,0.72):E.top.clone().addScaledVector(E.d,0.9).addScaledVector(E.r,-0.72);}
function startEsc(E,up){if(ride||mode!=='walk')return;closeCard();hideLiftPanel(false);hideGoHere();
 const to=up?2:1,lane=up?0.72:-0.72,a=up?E.bot:E.top,b=up?E.top:E.bot,dir=up?E.d:E.d.clone().negate();
 const off=b.clone().addScaledVector(dir,1.7).addScaledVector(E.r,lane),yaw=Math.atan2(-dir.x,-dir.z);
 if(calm){setFloor(to,{x:off.x,z:off.z,yaw});player.pitch=0;anim=null;applyPose(walkPose());showHint('Ты на '+(to===2?'втором':'первом')+' этаже');return;}
 player.vx=player.vz=0;
 ride={kind:'esc',E,up,to,t:0,phase:0,x0:player.x,z0:player.z,yaw0:player.yaw,yaw,
  a:a.clone().addScaledVector(E.r,lane),b:b.clone().addScaledVector(E.r,lane),off,y:FY[up?1:2]};
 updateJoy();updateCross();showHint(up?'Эскалатор едет на второй этаж…':'Эскалатор едет на первый этаж…');}
function updateEscRide(dt){const r=ride,e=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;r.t+=dt;const yA=r.up?0:FY[2],yB=r.up?FY[2]:0;
 if(lookDX||lookDY){player.yaw-=lookDX*SENS;player.pitch=Math.max(-1.2,Math.min(1.2,player.pitch-lookDY*SENS));lookDX=lookDY=0;}
 if(r.phase===0){const k=Math.min(1,r.t/0.3),q=e(k);player.x=r.x0+(r.a.x-r.x0)*q;player.z=r.z0+(r.a.z-r.z0)*q;
  let da=((r.yaw-r.yaw0+Math.PI*3)%(Math.PI*2))-Math.PI;player.yaw=r.yaw0+da*q;r.y=yA+0.05;if(k>=1){r.phase=1;r.t=0;}}
 else if(r.phase===1){const fwd=keys.KeyW||keys.ArrowUp||joyV.y<-0.3,rate=fwd?((keys.ShiftLeft||keys.ShiftRight||joyV.run>0.5)?6:3.6):1;r.k=(r.k||0)+dt*rate/7.5;const k=Math.min(1,r.k);// лента едет сама; идёшь вперёд — бежишь по ней быстрее
  const q=k<0.08?k*k/0.16:k>0.92?1-(1-k)*(1-k)/0.16:k-0.04;player.x=r.a.x+(r.b.x-r.a.x)*q;player.z=r.a.z+(r.b.z-r.a.z)*q;r.y=yA+(yB-yA)*q+0.25;
  if(k>=1){r.phase=2;r.t=0;curFloor=r.to;updateFloorUI();setVis();drawMiniBase();}}
 else{const k=Math.min(1,r.t/0.3),q=e(k);player.x=r.b.x+(r.off.x-r.b.x)*q;player.z=r.b.z+(r.off.z-r.b.z)*q;r.y=yB+0.25*(1-q);
  if(k>=1){ride=null;player.x=r.off.x;player.z=r.off.z;if(blocked(player.x,player.z)){const w=nearestFree(player.x,player.z,20);if(w){player.x=w[0];player.z=w[1];}}updateJoy();updateCross();showHint('Приехали: '+floorName(curFloor));}}}
// подошёл к ленте лицом по ходу — поехал
function updateEscalators(dt){if(!world.escs)return;
 if(!calm)world.stepTex.forEach(({t,dir})=>{t.offset.x=(t.offset.x-dir*dt*0.5)%1;});
 if(mode!=='walk'||ride||anim)return;const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);
 const moving=Math.hypot(player.vx||0,player.vz||0)>0.4;
 for(const E of world.escs){const up=curFloor===1;const end=up?E.bot:E.top,dir=up?E.d:E.d.clone().negate();
  // просто подойди к эскалатору: в любую из двух лент, лицом к нему — и поедешь
  const px=player.x-end.x,pz=player.z-end.z,sOut=-(px*dir.x+pz*dir.z),lat=px*E.r.x+pz*E.r.z;
  if(sOut>-0.4&&sOut<1.5&&Math.abs(lat)<1.5&&fx*dir.x+fz*dir.z>0.25&&(moving||sOut<1.0)){startEsc(E,up);return;}}}
// нажатие на эскалатор: подойти к нужной ленте и поехать
function goEscalator(E){const up=curFloor===1,p=escEntry(E,up),dir=up?E.d:E.d.clone().negate();
 const back=p.clone().addScaledVector(dir,-1.2);moveTo(curFloor,back.x,back.z,Math.atan2(-dir.x,-dir.z),0);
 setTimeout(()=>{if(mode==='walk'&&!ride)startEsc(E,up);},calm?0:950);}

/* ---------- Мини-карта текущего этажа ---------- */
const mini=$('mini'),mg=mini.getContext('2d');let miniBase=null,miniT={s:1,ox:0,oz:0};
function sizeMini(){const r=mini.getBoundingClientRect();const d=Math.min(devicePixelRatio,2);mini.width=Math.max(1,Math.round(r.width*d));mini.height=Math.max(1,Math.round(r.height*d));drawMiniBase();}
function drawMiniBase(){const w=mini.width,h=mini.height,dp=Math.min(devicePixelRatio,2),pad=6*dp;const s=Math.min((w-2*pad)/(bb.x1-bb.x0),(h-2*pad)/(bb.z1-bb.z0));
 miniT={s,ox:(w-(bb.x1-bb.x0)*s)/2-bb.x0*s,oz:(h-(bb.z1-bb.z0)*s)/2-bb.z0*s};
 const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');const X=p=>[p[0]*s+miniT.ox,p[1]*s+miniT.oz];
 const poly=(pts,fill)=>{g.beginPath();pts.forEach((p,i)=>{const q=X(p);i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]);});g.closePath();g.fillStyle=fill;g.fill();};
 D.bld.forEach(b=>poly(b,'#e7e5e0'));
 if(curFloor===2){D.bld.forEach(b=>poly(b,'#cfccc6'));D2.bld.forEach(b=>poly(b,'#e7e5e0'));voidPolys.forEach(v=>poly(v,'#cfe6f1'));}
 S.forEach(st=>{if(st.kind!=='store'||st.floor!==curFloor)return;poly(st.poly,(filter&&st.cat!==filter)?'#dde1e5':st.colHex);});
 // лифты и эскалаторы
 (world.lifts||[]).forEach(L=>{const q=X([L.c.x,L.c.z]);g.fillStyle='#0e7490';g.fillRect(q[0]-3.5*dp,q[1]-3.5*dp,7*dp,7*dp);g.fillStyle='#fff';g.fillRect(q[0]-1*dp,q[1]-2.5*dp,2*dp,5*dp);});
 D2.esc.forEach(e=>{const q=X(e.p);g.save();g.translate(q[0],q[1]);g.rotate(e.a);g.fillStyle='#475569';g.fillRect(-5*dp,-1.5*dp,10*dp,3*dp);g.restore();});
 g.font=`800 ${11*dp}px Manrope, system-ui, sans-serif`;g.textBaseline='top';const lw=g.measureText(floorName(curFloor)).width;g.fillStyle='rgba(255,255,255,.9)';g.fillRect(w-lw-pad-8*dp,h-pad-17*dp,lw+8*dp,17*dp);g.fillStyle='#0e7490';g.fillText(floorName(curFloor),w-lw-pad-4*dp,h-pad-14*dp);
 miniBase=c;}
function drawMini(){if(!miniBase)return;const w=mini.width,h=mini.height;mg.clearRect(0,0,w,h);mg.drawImage(miniBase,0,0);const s=miniT.s,X=(x,z)=>[x*s+miniT.ox,z*s+miniT.oz],dp=Math.min(devicePixelRatio,2);
 if(target&&target.floor===curFloor){const p=X(target.c[0],target.c[1]);mg.strokeStyle='#0e7490';mg.lineWidth=2*dp;mg.beginPath();mg.arc(p[0],p[1],6*dp,0,7);mg.stroke();}
 const [px,pz]=X(player.x,player.z),fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),L=8*dp;
 mg.fillStyle='#e11d48';mg.beginPath();mg.moveTo(px+fx*L,pz+fz*L);mg.lineTo(px-fz*L*.55-fx*L*.4,pz+fx*L*.55-fz*L*.4);mg.lineTo(px+fz*L*.55-fx*L*.4,pz-fx*L*.55-fz*L*.4);mg.closePath();mg.fill();}
mini.addEventListener('click',()=>{if(ride)return;openBigMap();});

/* ---------- Большая карта: нажал на мини-карту — карта на весь экран; выбрать магазин или место и перейти ---------- */
const BM={f:1,s:1,ox:0,oz:0,sel:null,ptrs:new Map(),pinch:0,down:null};const bmC=$('bmC'),bg=bmC.getContext('2d');
function openBigMap(){if(locked)releaseLock();closeCard();BM.f=curFloor;BM.sel=null;$('bigmap').hidden=false;$('bmSel').hidden=true;$('bmHint').hidden=false;bmSize();bmFit();if(coarse&&mode!=='store')bmCenterOn(player.x,player.z,BM.s*2.4);bmDraw();updateBMFloors();}
function closeBigMap(){$('bigmap').hidden=true;BM.ptrs.clear();}
function bmSize(){const r=bmC.getBoundingClientRect(),d=Math.min(devicePixelRatio,2);bmC.width=Math.max(1,Math.round(r.width*d));bmC.height=Math.max(1,Math.round(r.height*d));}
// вписать здание и показать игрока ближе к центру
function bmFit(){const r=bmC.getBoundingClientRect(),pad=24,top=70,bot=40;const s=Math.min((r.width-2*pad)/(bb.x1-bb.x0),(r.height-top-bot)/(bb.z1-bb.z0));BM.s=s;BM.ox=(r.width-(bb.x1-bb.x0)*s)/2-bb.x0*s;BM.oz=top+(r.height-top-bot-(bb.z1-bb.z0)*s)/2-bb.z0*s;}
function bmCenterOn(x,z,minS){const r=bmC.getBoundingClientRect();if(minS)BM.s=Math.max(BM.s,minS);BM.ox=r.width/2-x*BM.s;BM.oz=r.height/2-z*BM.s;}
const bmW=(cx,cy)=>[(cx-BM.ox)/BM.s,(cy-BM.oz)/BM.s];
function updateBMFloors(){document.querySelectorAll('.bm-floors button').forEach(b=>b.classList.toggle('on',+b.dataset.f===BM.f));}
function bmDraw(){const d=Math.min(devicePixelRatio,2),w=bmC.width,h=bmC.height;const dark=matchMedia('(prefers-color-scheme: dark)').matches&&document.documentElement.dataset.theme!=='light';
 bg.setTransform(1,0,0,1,0,0);bg.fillStyle=dark?'#0e1419':'#e9eef2';bg.fillRect(0,0,w,h);bg.setTransform(d*BM.s,0,0,d*BM.s,d*BM.ox,d*BM.oz);
 const poly=(pts,fill,stroke)=>{bg.beginPath();pts.forEach((p,i)=>i?bg.lineTo(p[0],p[1]):bg.moveTo(p[0],p[1]));bg.closePath();if(fill){bg.fillStyle=fill;bg.fill();}if(stroke){bg.strokeStyle=stroke;bg.lineWidth=1.2/BM.s;bg.stroke();}};
 const f=BM.f;D.bld.forEach(b=>poly(b,f===2?(dark?'#2a3138':'#cfccc6'):(dark?'#3a434b':'#f4f2ee')));
 if(f===2){D2.bld.forEach(b=>poly(b,dark?'#3a434b':'#f4f2ee'));voidPolys.forEach(v=>poly(v,dark?'#1d3a4a':'#cfe6f1'));}
 const list=S.filter(st=>st.floor===f);
 list.forEach(st=>{if(st.kind==='store')poly(st.poly,(filter&&st.cat!==filter)?'#dde1e5':st.colHex,BM.sel&&BM.sel.s===st?'#0f172a':'rgba(255,255,255,.65)');});
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
 if(f===curFloor&&mode!=='store'){const px=player.x*BM.s+BM.ox,pz=player.z*BM.s+BM.oz,fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),L=13;
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
  btn(f===curFloor?'Перейти сюда':'Перейти сюда · '+floorName(f),true,()=>{closeBigMap();if(mode==='store')exitShop();const yaw=Math.atan2(player.x-w[0],player.z-w[1]);moveTo(f,w[0],w[1],f===curFloor&&Math.hypot(player.x-w[0],player.z-w[1])>1?yaw:player.yaw,0);requestLockIfNeeded();});}
 $('bmSel').hidden=false;bmDraw();}
bmC.addEventListener('pointerdown',e=>{bmC.setPointerCapture(e.pointerId);BM.ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});if(BM.ptrs.size===1)BM.down={x:e.clientX,y:e.clientY,moved:0};else{BM.down=null;const a=[...BM.ptrs.values()];BM.pinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}bmC.classList.add('drag');});
bmC.addEventListener('pointermove',e=>{const p=BM.ptrs.get(e.pointerId);if(!p)return;const r=bmC.getBoundingClientRect();
 if(BM.ptrs.size===2){p.x=e.clientX;p.y=e.clientY;const a=[...BM.ptrs.values()];const dd=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),mx=(a[0].x+a[1].x)/2-r.left,my=(a[0].y+a[1].y)/2-r.top;if(BM.pinch>0)bmZoom(dd/BM.pinch,mx,my);BM.pinch=dd;return;}
 const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;BM.ox+=dx;BM.oz+=dy;if(BM.down)BM.down.moved+=Math.abs(dx)+Math.abs(dy);bmDraw();});
const bmUp=e=>{if(!BM.ptrs.has(e.pointerId))return;BM.ptrs.delete(e.pointerId);if(!BM.ptrs.size)bmC.classList.remove('drag');
 if(BM.down&&BM.down.moved<8&&e.type==='pointerup'){const r=bmC.getBoundingClientRect();bmSelect(e.clientX-r.left,e.clientY-r.top);}if(!BM.ptrs.size)BM.down=null;};
bmC.addEventListener('pointerup',bmUp);bmC.addEventListener('pointercancel',bmUp);
function bmZoom(k,cx,cy){const s0=BM.s,s1=Math.max(1.2,Math.min(40,s0*k));const [x,z]=[(cx-BM.ox)/s0,(cy-BM.oz)/s0];BM.s=s1;BM.ox=cx-x*s1;BM.oz=cy-z*s1;bmDraw();}
bmC.addEventListener('wheel',e=>{e.preventDefault();const r=bmC.getBoundingClientRect();bmZoom(Math.exp(-e.deltaY*0.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
document.querySelectorAll('.bm-floors button').forEach(b=>b.onclick=()=>{BM.f=+b.dataset.f;BM.sel=null;$('bmSel').hidden=true;updateBMFloors();bmDraw();});
$('bmX').onclick=()=>{closeBigMap();requestLockIfNeeded();};
$('bmMe').onclick=()=>{BM.f=curFloor;updateBMFloors();if(mode!=='store')bmCenterOn(player.x,player.z,6);bmDraw();};
addEventListener('resize',()=>{if(!$('bigmap').hidden){bmSize();bmDraw();}});

function showHint(t){const h=$('hint');h.textContent=t;h.style.opacity=1;clearTimeout(showHint.t);showHint.t=setTimeout(hideHint,9000);}
function hideHint(){$('hint').style.opacity=0;}

/* ---------- Цикл ---------- */
let last=performance.now(),miniAt=0;
function frame(now){
 try{frameBody(now);}catch(err){console.error(err);if(!frame.err){frame.err=1;showHint('Ошибка отрисовки: '+err.message);}}
 requestAnimationFrame(frame);
}
function frameBody(now){
 const rawDt=Math.min(1,Math.max(0,(now-last)/1000)),dt=Math.min(0.05,rawDt);last=now;
 if((mode==='walk'||mode==='store')&&!anim&&!ride){
  let f=0,r=0,turn=0;
  // обзор мышью: захваченный курсор — плавно, по смещению мыши
  if(lookDX||lookDY){const kx=calm?1:Math.min(1,dt*30);const mx=lookDX*kx,my=lookDY*kx;lookDX-=mx;lookDY-=my;if(Math.abs(lookDX)<0.05)lookDX=0;if(Math.abs(lookDY)<0.05)lookDY=0;
   player.yaw-=mx*SENS_BASE*PREFS.sens;player.pitch=Math.max(-1.2,Math.min(1.2,player.pitch-my*SENS_BASE*PREFS.sens));}
  // запасной режим, если браузер не даёт скрыть курсор: поворот по положению мыши относительно центра
  if(lockFailed&&mouse.in&&!coarse&&!ptrs.size&&panelsClosed()){const ox=(mouse.x/innerWidth-0.5)*2,oy=(mouse.y/innerHeight-0.5)*2;const dz=0.18;
   const ax=Math.abs(ox)>dz?(Math.abs(ox)-dz)/(1-dz)*Math.sign(ox):0;turn-=ax*Math.abs(ax)*1.4;
   const tp=-oy*0.6;player.pitch+=(tp-player.pitch)*Math.min(1,dt*3);}
  if(keys.KeyW||keys.ArrowUp)f+=1;if(keys.KeyS||keys.ArrowDown)f-=1;if(keys.KeyD)r+=1;if(keys.KeyA)r-=1;
  if(keys.ArrowLeft||keys.KeyQ)turn+=1;if(keys.ArrowRight||keys.KeyE)turn-=1;
  f+=-joyV.y;r+=joyV.x;player.yaw+=turn*1.9*dt;
  // плавный разгон и торможение (без анимации — сразу)
  const runK=(keys.ShiftLeft||keys.ShiftRight)?1:(joyV.run||0);const maxV=(7+9*runK)*(coarse?1.1:1);const l=Math.hypot(f,r);let tx=0,tz=0;
  if(l>0.05){const k=Math.min(1,l)/l;f*=k;r*=k;const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),rx=Math.cos(player.yaw),rz=-Math.sin(player.yaw);tx=(fx*f+rx*r)*maxV;tz=(fz*f+rz*r)*maxV;hideHint();}
  const acc=calm?1:Math.min(1,dt*(l>0.05?7:10));player.vx+=(tx-player.vx)*acc;player.vz+=(tz-player.vz)*acc;
  if(Math.abs(player.vx)+Math.abs(player.vz)>0.01){const ox=player.x,oz=player.z;tryMove(player.vx*dt,player.vz*dt);if(Math.abs(player.x-ox)<1e-4)player.vx*=0.5;if(Math.abs(player.z-oz)<1e-4)player.vz*=0.5;}
 }
 if(ride)(ride.kind==='esc'?updateEscRide:updateRide)(rawDt);
 const goal=mode==='top'?topPose():walkPose();
 if(anim){anim.t=calm?1:Math.min(1,anim.t+Math.min(0.3,rawDt)/0.9);const e=anim.t<.5?4*anim.t**3:1-Math.pow(-2*anim.t+2,3)/2;
  cam.position.copy(anim.from.p).lerp(goal.p,e);cam.quaternion.copy(anim.from.q).slerp(goal.q,e);
  if(anim.t>=1){anim=null;if(mode==='walk')setVis();}}
 else applyPose(goal);
 world.pmark.position.set(player.x,topY()+1,player.z);world.pmark.rotation.y=player.yaw;world.pmark.scale.setScalar(mode==='top'?Math.max(0.4,(topv.h-topY())/160):1);
 {const pk=mode==='top'?'top'+curFloor:'walk';if(world.people&&mode!=='store'&&(!calm||world.people.placed!==pk))updatePeople(calm?0:dt,now);}
 if(PS&&(PS.s.kind==='kiosk'||PS.s.island)&&!$('shop').hidden&&(mode!=='walk'||curFloor!==PS.s.floor||Math.hypot(player.x-(PS.s.p||PS.s.c)[0],player.z-(PS.s.p||PS.s.c)[1])>8))closeShopPanel(false);
 updateMallDoors(dt);updateLifts(rawDt);updateEscalators(rawDt);if(mode==='store'){updateShopExit(dt);if(!calm)updateShopPeople(dt,now);}
 if(!calm){world.wheel.rotation.z+=dt*0.04;world.cabins.forEach(c=>{c.rotation.z=-world.wheel.rotation.z;});}
 if(world.target.visible){const b=mode==='top'?topY()+3:(world.target.userData.base||GLASS_H+1.4);world.target.position.y=b+(calm?0:Math.sin(now/300)*0.3);if(!calm)world.target.rotation.y+=dt*1.5;world.target.scale.setScalar(mode==='top'?Math.max(1,(topv.h-topY())/50):1);}
 if(locked&&isFP()&&now-(frame.aimAt||0)>120){frame.aimAt=now;const el=$('aim');let txt='';if(mode==='store'&&SHOP){txt=shopAimText();}else{const t=aimAt();txt=!t?'':t.esc?(curFloor===1?'Эскалатор на 2 этаж · нажми или встань на ленту':'Эскалатор на 1 этаж · нажми или встань на ленту'):t.lift?'Лифт · нажми, чтобы выбрать этаж':(t.s.cat==='tbd'?t.s.name:t.s.name+(t.s.door?' · нажми или зайди в дверь':kioskHasGoods(t.s)?' · нажми, чтобы посмотреть товары':' · нажми, чтобы открыть'));}if(el.textContent!==txt)el.textContent=txt;el.style.opacity=txt?1:0;}
 if(world.mirror)world.mirror.visible=!!world.mirrorOn&&curFloor===1&&mode==='walk';
 if(!fitOpen()){const sc_=mode==='store'&&SHOP?SHOP.scene:scene;if(FX.active)FX.render(sc_,cam,curFloor,FY[curFloor],mode==='walk'&&!ride);else renderer.render(sc_,cam);}
 if(now-miniAt>80){drawMini();miniAt=now;}
}
const _q=new THREE.Quaternion(),_s=new V3(),_p=new V3(),_Y=new V3(0,1,0);
function updatePeople(dt,now){const W_=world.people,r=W_.r;const top=mode==='top';
 W_.list.forEach((p,i)=>{
  if(dt>0){if(p.wait>0){p.wait-=dt;}else{
   let dx=p.tx-p.x,dz=p.tz-p.z,d=Math.hypot(dx,dz);
   if(d<0.4){p.wait=r()<0.3?1+r()*5:0;for(let t=0;t<12;t++){const a=r()*6.28,L=4+r()*22;const x=p.x+Math.cos(a)*L,z=p.z+Math.sin(a)*L;if(isWalkF(p.f,x,z)&&!blockedF(p.f,x,z)){p.tx=x;p.tz=z;break;}}}
   else{const st=Math.min(d,p.sp*dt),nx=p.x+dx/d*st,nz=p.z+dz/d*st;
    if(isWalkF(p.f,nx,nz)&&!blockedF(p.f,nx,nz)){p.x=nx;p.z=nz;const ta=Math.atan2(dx,dz);let da=((ta-p.a+Math.PI*3)%(Math.PI*2))-Math.PI;p.a+=da*Math.min(1,dt*6);}
    else{p.tx=p.x;p.tz=p.z;}}}}
  const bob=p.wait>0||dt===0?0:Math.abs(Math.sin(now/1000*p.sp*5+p.ph))*0.03;const hide=top&&p.f!==curFloor;const y0=FY[p.f];
  _q.setFromAxisAngle(_Y,p.a);const sc=hide?0.0001:p.sc;_s.set(sc,sc,sc);_p.set(p.x,y0+bob,p.z);mtx.compose(_p,_q,_s);W_.meshes.forEach(m=>m.setMatrixAt(i,mtx));
  _p.set(p.x,y0+0.02,p.z);_s.setScalar(hide?0.0001:1);_q.identity();mtx.compose(_p,_q,_s);W_.sh.setMatrixAt(i,mtx);});
 W_.meshes.forEach(m=>m.instanceMatrix.needsUpdate=true);W_.sh.instanceMatrix.needsUpdate=true;W_.placed=top?'top'+curFloor:'walk';}
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();sizeMini();});

/* =====================================================================
   Магазины изнутри: вход через дверь, зал с отделами, компактный каталог
   ===================================================================== */

/* ---------- 3D-модели товаров и оборудования ---------- */
function mergeG(gs){const m=new Merger();gs.forEach(g=>m.add(g));const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(m.p,3));bg.setAttribute('normal',new THREE.Float32BufferAttribute(m.n,3));bg.setAttribute('uv',new THREE.Float32BufferAttribute(m.u,2));return bg;}
const B=(w,h,d,x,y,z)=>new THREE.BoxGeometry(w,h,d).translate(x||0,y||0,z||0);
const Cy=(r1,r2,h,x,y,z,seg)=>new THREE.CylinderGeometry(r1,r2,h,seg||12).translate(x||0,y||0,z||0);
// горизонтальный цилиндр вдоль X: сначала поворот, потом сдвиг
const CyX=(r,h,x,y,z,seg)=>new THREE.CylinderGeometry(r,r,h,seg||12).rotateZ(Math.PI/2).translate(x||0,y||0,z||0);
let MOD=null;
function models(){if(!MOD)MOD=createModels(canvasTex);return MOD.M;}
// ширина места на полке под товар (м)
// фото настоящих вещей: текстура с прозрачным фоном, плоскость по размеру вещи
var photoTexCache={};
function photoTex(k){if(photoTexCache[k])return photoTexCache[k];const t=new THREE.TextureLoader().load(PHOTOS[k].url);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return photoTexCache[k]=t;}
function photoMat(k){return new THREE.MeshStandardMaterial({map:photoTex(k),alphaTest:0.45,side:THREE.DoubleSide,roughness:.85});}
function photoGeo(k){const P=PHOTOS[k];return new THREE.PlaneGeometry(P.h*P.aspect,P.h);}
// какие фото-вещи уместны в магазине: только если в его ассортименте есть такой отдел
function photoKeysFor(s){if(s._ph)return s._ph;const wk=winKeys(s.name);if(wk.length)return s._ph=wk;const d=deptsFor(s),o=[];if(d.includes('tshirts'))o.push('tee_black');if(d.includes('jackets'))o.push('puffer_red');if(d.includes('pants'))o.push('trousers_beige');return s._ph=o;}
const SLOT={shoe:.36,box:.3,jar:.13,tube:.075,bottle:.12,book:.055,toy:.3,small:.15,phone:.13,laptop:.44,tv:1.25,dumbbell:.42,cup:.13,ticket:.24,football:.26,basketball:.28,appliance:.8,sofa:2.2,bed:1.8,bike:1.2,jacket:.13,tshirt:.1,longsleeve:.11,pants:.1,dress:.12};
const GARM={jacket:1,pants:1,tshirt:1,longsleeve:1,dress:1};

/* ---------- Зал магазина ---------- */
let SHOP=null;// текущий магазин {s,scene,col,pick,zones,W,D,exit}
let shopStyle=new URLSearchParams(location.search).get('shop')||'auto';
function setShopStyle(n){shopStyle=INTERIORS[n]||n==='auto'?n:'auto';if(SHOP&&mode==='store'){const s=SHOP.s;disposeShop();SHOP=buildShop(s);PS=SHOP;SHOP.doorOpen=1;updateShopDoor();}return shopStyle;}
function buildShop(s){
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
  SHOP_PEOPLE={list:ppl,meshes:ms,r};}
 return{s,scene:sc,colliders,pick,zones,W,D,cat,dw:DWs,leaves:[lv1,lv2],doorOpen:0,fit};}
// Примерочная в зале: заметная кабина в левом переднем углу (видна сразу от входа), открытой стороной к залу.
// Светящаяся арка, световой короб «Примерочная» на две стороны, шторка, зеркало внутри, пятно света на полу.
// Зашёл внутрь или нажал на неё — открывается примерочная с фигурой (src/shop/fitting.js).
function buildFittingBooth(sc,s,W,D,brand,brandHex,colliders,pick){
 const cx=-W/2+1.55,cz=D/2-4.3,hw=1.35,hd=1.25,H=2.55,g=new THREE.Group();g.position.set(cx,0,cz);sc.add(g);
 const wall=new THREE.MeshStandardMaterial({color:brand.clone().lerp(LIN('#ffffff'),0.12),roughness:.7});
 const inner=new THREE.MeshStandardMaterial({color:LIN('#efe7dc'),roughness:.85});
 const led=new THREE.MeshBasicMaterial({color:new THREE.Color(2.4,2.1,1.7),toneMapped:false});
 const box=(w,h,d,x,y,z,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);g.add(o);return o;};
 // боковые стены (снаружи — цвет магазина, внутри — светлые) и крыша
 [-1,1].forEach(k=>{box(2*hw,H,0.08,0,H/2,k*hd,wall);box(2*hw-0.1,H-0.1,0.01,0,H/2,k*(hd-0.05),inner);});
 box(0.08,H,2*hd,-hw,H/2,0,inner);box(2*hw+0.1,0.1,2*hd+0.1,0,H+0.05,0,wall);
 // светящаяся арка по проёму
 [-1,1].forEach(k=>box(0.06,H,0.06,hw,H/2,k*(hd-0.02),led));box(0.06,0.06,2*hd,hw,H-0.02,0,led);
 // световой короб: на крыше лицом в зал и на стене лицом ко входу
 const signT=canvasTex(1024,200,(c,w,h)=>{c.fillStyle='#16181b';rr(c,0,0,w,h,36);c.fill();c.fillStyle=brandHex;c.fillRect(0,h-16,w,16);
  c.strokeStyle='#fff';c.lineWidth=12;c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(120,62);c.quadraticCurveTo(120,40,142,40);c.quadraticCurveTo(162,40,162,60);c.quadraticCurveTo(162,76,142,86);c.lineTo(62,140);c.lineTo(222,140);c.closePath();c.stroke();
  c.fillStyle='#fff';c.textAlign='left';c.textBaseline='middle';c.font='800 92px Manrope, sans-serif';c.fillText('Примерочная',270,96);});
 const signM=new THREE.MeshBasicMaterial({map:signT,toneMapped:false});
 const s1=new THREE.Mesh(new THREE.PlaneGeometry(2.5,0.49),signM);s1.position.set(hw+0.06,H+0.42,0);s1.rotation.y=Math.PI/2;g.add(s1);
 const s2=new THREE.Mesh(new THREE.PlaneGeometry(2.5,0.49),signM);s2.position.set(0,H+0.42,hd+0.06);g.add(s2);
 box(0.08,0.55,2.6,hw+0.01,H+0.42,0,MAT.darkMetal);box(2.6,0.55,0.08,0,H+0.42,hd+0.01,MAT.darkMetal);
 // шторка, собранная у одной стороны проёма
 {const cg=new THREE.PlaneGeometry(0.7,2.3,20,1);const P=cg.attributes.position;for(let i=0;i<P.count;i++)P.setZ(i,Math.sin(P.getX(i)*30)*0.05);cg.computeVertexNormals();
  const cu=new THREE.Mesh(cg,new THREE.MeshStandardMaterial({color:brand.clone().multiplyScalar(0.6),roughness:.95,side:THREE.DoubleSide}));cu.rotation.y=Math.PI/2;cu.position.set(hw-0.1,1.2,-hd+0.42);g.add(cu);
  box(0.03,0.03,2*hd,hw-0.1,2.38,0,MAT.darkMetal);}
 // зеркало с подсветкой, крючок, коврик
 const mir=new THREE.Mesh(new THREE.PlaneGeometry(0.85,1.9),new THREE.MeshStandardMaterial({color:LIN('#d5dde2'),roughness:.03,metalness:1}));mir.position.set(-hw+0.06,1.15,0);mir.rotation.y=Math.PI/2;g.add(mir);
 [-1,1].forEach(k=>box(0.02,1.95,0.025,-hw+0.06,1.15,k*0.45,led));
 const rug=new THREE.Mesh(new THREE.CircleGeometry(0.7,40),new THREE.MeshStandardMaterial({color:LIN('#d9cdbd'),roughness:.95}));rug.rotation.x=-Math.PI/2;rug.position.set(-0.1,0.012,0);g.add(rug);
 // пятно света на полу перед проёмом
 const glowT=canvasTex(256,256,(c,w,h)=>{const gr=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gr.addColorStop(0,'rgba(255,236,200,.55)');gr.addColorStop(1,'rgba(255,236,200,0)');c.fillStyle=gr;c.fillRect(0,0,w,h);});
 const glow=new THREE.Mesh(new THREE.PlaneGeometry(3.6,3.6),new THREE.MeshBasicMaterial({map:glowT,transparent:true,depthWrite:false,toneMapped:false}));glow.rotation.x=-Math.PI/2;glow.position.set(hw+0.9,0.014,0);g.add(glow);
 const lamp=new THREE.PointLight(LIN('#ffe3bd'),6,6,2);lamp.position.set(0,2.2,0);g.add(lamp);
 // невидимая коробка для нажатия
 const hit=new THREE.Mesh(new THREE.BoxGeometry(2*hw+0.3,H+1,2*hd+0.3),new THREE.MeshBasicMaterial({visible:false}));hit.position.set(0,(H+1)/2,0);hit.userData.fit=true;g.add(hit);pick.push(hit);
 colliders.push([cx-hw-0.1,cx+hw+0.05,cz+hd-0.06,cz+hd+0.06],[cx-hw-0.1,cx+hw+0.05,cz-hd-0.06,cz-hd+0.06],[cx-hw-0.1,cx-hw+0.06,cz-hd,cz+hd]);
 return{cx,cz,x0:cx-hw+0.15,x1:cx+hw-0.25,z0:cz-hd+0.15,z1:cz+hd-0.15,out:{x:cx+hw+1.6,z:cz}};}
// вход в кабину ногами: стоишь внутри — открывается примерочная; после выхода нужно выйти из кабины
let fitArmed=true;
function updateFittingBooth(){if(mode!=='store'||!SHOP||!SHOP.fit||fitOpen()||anim)return;const f=SHOP.fit,inside=player.x>f.x0&&player.x<f.x1&&player.z>f.z0&&player.z<f.z1;
 if(!inside){fitArmed=true;return;}if(fitArmed){fitArmed=false;openFitting();}}
const FIT=createFitting({fmtPrice,thumb:p=>thumbURL(p),siteOf,coarse,catalogOf,
 onOpen:()=>{releaseLock();updateCross();},
 onClose:()=>{if(mode==='store'&&SHOP&&SHOP.fit){const f=SHOP.fit,inside=player.x>f.x0-0.3&&player.x<f.x1+0.3&&player.z>f.z0-0.3&&player.z<f.z1+0.3;if(inside){player.x=f.out.x;player.z=f.out.z;player.yaw=-Math.PI/2;player.pitch=-0.05;player.vx=player.vz=0;applyPose(walkPose());}fitArmed=false;}requestLockIfNeeded();}});
function fitOpen(){return FIT.isOpen;}
function openFitting(){if(fitOpen())return;if(!$('shop').hidden)closeShopPanel(false);closeCard();releaseLock();FIT.open(mode==='store'&&SHOP?SHOP.s:(PS&&PS.s)||null);}
FIT.mountBodyControls($('bodyPrefs'));
let SHOP_PEOPLE=null;
// светильники зала по стилю; возвращает точки под светом (для световых пятен)
let poolTex=null;
function shopDecorLights(sc,ST,W,D,H){const pts=[],q=new THREE.Quaternion(),one=new V3(1,1,1),Y=new V3(0,1,0);
 const IM=(geo,mat,arr)=>{const m=new THREE.InstancedMesh(geo,mat,Math.max(1,arr.length));arr.forEach((p,i)=>{q.setFromAxisAngle(Y,p[3]||0);mtx.compose(new V3(p[0],p[1],p[2]),q,one);m.setMatrixAt(i,mtx);});m.count=arr.length;sc.add(m);return m;};
 const glow=(r,g,b)=>new THREE.MeshBasicMaterial({color:new THREE.Color(r,g,b),toneMapped:false});
 const dark=new THREE.MeshStandardMaterial({color:LIN('#17181a'),roughness:.4,metalness:.6});
 if(ST.lights==='track'){const rails=[],heads=[];for(let z=-D/2+3;z<D/2-2;z+=3.6){rails.push([0,H-0.03,z]);for(let x=-W/2+2;x<W/2-1.5;x+=1.7){heads.push([x,H-0.03,z]);pts.push([x,z+((x*7|0)%2?0.6:-0.6)]);}}
  IM(B(W-2,0.04,0.06,0,0,0),dark,rails);IM(mergeG([Cy(0.004,0.004,0.12,0,-0.06,0,4),Cy(0.055,0.05,0.18,0,-0.2,0,12)]),dark,heads);IM(new THREE.CircleGeometry(0.045,12).rotateX(Math.PI/2).translate(0,-0.291,0),glow(2.2,2.15,2.0),heads);}
 else if(ST.lights==='globe'){const a=[];for(let x=-W/2+2.5;x<W/2-1.5;x+=4)for(let z=-D/2+2.5;z<D/2-2;z+=3.8){a.push([x,H,z]);pts.push([x,z]);}
  IM(Cy(0.006,0.006,1.6,0,-0.8,0,4),dark,a);IM(new THREE.SphereGeometry(0.24,20,14).translate(0,-1.82,0),glow(1.55,1.38,1.12),a);}
 else if(ST.lights==='pendant'){const a=[];for(let x=-W/2+2.5;x<W/2-1.5;x+=3.6)for(let z=-D/2+2.5;z<D/2-2;z+=3.6){a.push([x,H,z]);pts.push([x,z]);}
  IM(Cy(0.007,0.007,2.0,0,-1.0,0,4),dark,a);IM(new THREE.ConeGeometry(0.34,0.32,20,1,true).translate(0,-2.16,0),new THREE.MeshStandardMaterial({color:LIN('#1c1d1f'),roughness:.35,metalness:.7,side:THREE.DoubleSide}),a);
  IM(new THREE.SphereGeometry(0.075,12,8).translate(0,-2.3,0),glow(2.6,1.9,1.1),a);IM(new THREE.CircleGeometry(0.32,20).rotateX(Math.PI/2).translate(0,-2.3,0),glow(0.9,0.62,0.35),a);}
 else if(ST.lights==='downlight'){const a=[];for(let x=-W/2+2;x<W/2-1;x+=3)for(let z=-D/2+2;z<D/2-1.5;z+=3){a.push([x,H-0.012,z]);pts.push([x,z]);}
  IM(new THREE.RingGeometry(0.12,0.16,20).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({color:LIN('#b8925a'),roughness:.25,metalness:1}),a);IM(new THREE.CircleGeometry(0.12,20).rotateX(Math.PI/2),glow(2.0,1.85,1.6),a);}
 if(ST.pools&&pts.length){if(!poolTex)poolTex=canvasTex(128,128,(g,w,h)=>{const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,240,215,1)');gr.addColorStop(.5,'rgba(255,240,215,.35)');gr.addColorStop(1,'rgba(255,240,215,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
  const pm=new THREE.MeshBasicMaterial({map:poolTex,transparent:true,opacity:ST.pools,blending:THREE.AdditiveBlending,depthWrite:false});
  IM(new THREE.PlaneGeometry(3.2,3.2).rotateX(-Math.PI/2),pm,pts.map(p=>[p[0],0.015,p[1]]));}}
// декор зала по стилю: растения, ковёр, пуф, скамья, вентиляция, подсветка по периметру
function shopDecor(sc,ST,W,D,H,colliders,DWs,s){const r=mulberry(s.id+9),ex=ST.extras||[];
 const freeR=(x,z,rad)=>{for(let a=0;a<8;a++){if(shopBlockedRaw(colliders,W,D,x+Math.cos(a*0.785)*rad,z+Math.sin(a*0.785)*rad,0))return false;}return!shopBlockedRaw(colliders,W,D,x,z,0);};
 const nearDoor=(x,z)=>Math.abs(x)<DWs/2+1.5&&z>D/2-3;
 // растения у стен
 if(ST.plants){const potC={gallery:'#e8e6e1',wood:'#b5754e',loft:'#2a2a2a',boutique:'#b8925a'}[ST.key]||'#ddd';const cand=[];
  for(let x=-W/2+0.9;x<=W/2-0.9;x+=1.1){cand.push([x,-D/2+0.9],[x,D/2-0.9]);}for(let z=-D/2+0.9;z<=D/2-0.9;z+=1.1){cand.push([-W/2+0.9,z],[W/2-0.9,z]);}
  for(let i=cand.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[cand[i],cand[j]]=[cand[j],cand[i]];}
  const pl=[];for(const [x,z] of cand){if(pl.length>=ST.plants)break;if(nearDoor(x,z)||!freeR(x,z,0.5)||pl.some(p=>Math.hypot(p[0]-x,p[1]-z)<5))continue;pl.push([x,z]);colliders.push([x-0.35,x+0.35,z-0.35,z+0.35]);}
  const pot=new THREE.MeshStandardMaterial({color:LIN(potC),roughness:ST.key==='boutique'?.3:.7,metalness:ST.key==='boutique'?.8:0}),leaf=new THREE.MeshStandardMaterial({color:LIN('#4c7a43'),roughness:.8,flatShading:true}),stem=new THREE.MeshStandardMaterial({color:LIN('#5a4632')});
  pl.forEach(([x,z],i)=>{const g=new THREE.Group();g.add(new THREE.Mesh(Cy(0.3,0.24,0.55,0,0.275,0,18),pot));g.add(new THREE.Mesh(Cy(0.03,0.04,1.3,0,1.1,0,6),stem));
   for(let k=0;k<7;k++){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(0.32+r()*0.18,0),leaf);m.position.set((r()-.5)*0.7,1.25+r()*0.9,(r()-.5)*0.7);m.rotation.set(r()*3,r()*3,0);g.add(m);}
   g.position.set(x,0,z);sc.add(g);});}
 // свободное место ближе к входу для ковра/пуфа/скамьи
 const spot=rad=>{let best=null;for(let z=D/2-3.2;z>-D/2+2;z-=0.5)for(let x=0;x<W/2-1;x+=0.5)for(const sx of [1,-1]){const X=x*sx;if(freeR(X,z,rad)){best=[X,z];return best;}}return best;};
 if(ex.includes('ottoman')){const p=spot(1.7);if(p){const rug=new THREE.Mesh(new THREE.CircleGeometry(1.6,40).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:LIN('#cdbb9d'),roughness:1}));rug.position.set(p[0],0.02,p[1]);sc.add(rug);
  const ot=new THREE.Mesh(Cy(0.75,0.75,0.42,0,0.21,0,32),new THREE.MeshStandardMaterial({color:LIN(ST.wallTone||'#2f4a3e'),roughness:.9}));ot.position.set(p[0],0,p[1]);sc.add(ot);
  const tp=new THREE.Mesh(Cy(0.73,0.7,0.05,0,0.44,0,32),new THREE.MeshStandardMaterial({color:LIN(shade(ST.wallTone||'#2f4a3e',.12)),roughness:.95}));tp.position.copy(ot.position);sc.add(tp);
  const bb=new THREE.Mesh(Cy(0.78,0.78,0.04,0,0.02,0,32),new THREE.MeshStandardMaterial({color:LIN('#b8925a'),roughness:.25,metalness:1}));bb.position.copy(ot.position);sc.add(bb);colliders.push([p[0]-0.8,p[0]+0.8,p[1]-0.8,p[1]+0.8]);}}
 else if(ex.includes('rug')){const p=spot(1.4);if(p){const rt=canvasTex(512,320,(g,w,h)=>{g.fillStyle='#e3d6c0';g.fillRect(0,0,w,h);g.strokeStyle='#b99c74';g.lineWidth=10;g.strokeRect(24,24,w-48,h-48);g.lineWidth=3;g.strokeRect(46,46,w-92,h-92);noise(g,w,h,mulberry(3),9000,.12);});
  const rug=new THREE.Mesh(new THREE.PlaneGeometry(3.2,2).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({map:rt,roughness:1}));rug.position.set(p[0],0.02,p[1]);sc.add(rug);}}
 if(ex.includes('bench')){const p=spot(1.3);if(p){const m=new THREE.MeshStandardMaterial({color:LIN('#c9a477'),roughness:.55});const g=new THREE.Group();g.add(new THREE.Mesh(B(1.8,0.08,0.5,0,0.44,0),m));[-0.75,0.75].forEach(x=>g.add(new THREE.Mesh(B(0.08,0.4,0.46,x,0.2,0),new THREE.MeshStandardMaterial({color:LIN('#1d1f22'),roughness:.4,metalness:.6}))));g.position.set(p[0],0,p[1]);sc.add(g);colliders.push([p[0]-0.95,p[0]+0.95,p[1]-0.3,p[1]+0.3]);}}
 if(ex.includes('ducts')){const m=new THREE.MeshStandardMaterial({color:LIN('#8d9196'),roughness:.45,metalness:.8});[-D/4,D/4].forEach(z=>{const d=new THREE.Mesh(CyX(0.32,W-0.1,0,H-0.7,z,20),m);sc.add(d);
   for(let x=-W/2+2;x<W/2;x+=3){const h=new THREE.Mesh(Cy(0.012,0.012,0.4,x,H-0.2,z,4),m);sc.add(h);const band=new THREE.Mesh(CyX(0.335,0.06,x,H-0.7,z,20),m);sc.add(band);}});
  const pipe=new THREE.MeshStandardMaterial({color:LIN('#3a3c3f'),roughness:.5,metalness:.6});[0.6,1.0].forEach(o=>sc.add(new THREE.Mesh(CyX(0.05,W-0.1,0,H-0.3,-D/2+o,8),pipe)));}
 if(ex.includes('cove')){const m=new THREE.MeshBasicMaterial({color:new THREE.Color(1.7,1.45,1.1),toneMapped:false,side:THREE.DoubleSide});
  [[0,-D/2+0.03,W,0],[-W/2+0.03,0,D,Math.PI/2],[W/2-0.03,0,D,-Math.PI/2]].forEach(([x,z,l,ry])=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(l,0.07),m);p.position.set(x,H-0.32,z);p.rotation.y=ry;sc.add(p);});}
 if(ST.strip==='brass'||ST.strip==='wood'){const m=ST.strip==='brass'?new THREE.MeshStandardMaterial({color:LIN('#b8925a'),roughness:.25,metalness:1}):new THREE.MeshStandardMaterial({color:LIN('#a87c50'),roughness:.6});
  [[0,-D/2+0.04,W,0],[-W/2+0.04,0,D,Math.PI/2],[W/2-0.04,0,D,-Math.PI/2]].forEach(([x,z,l,ry])=>{const p=new THREE.Mesh(B(l,ST.strip==='brass'?0.05:0.14,0.04,0,0,0),m);p.position.set(x,ST.strip==='brass'?H-0.5:0.07,z);p.rotation.y=ry;sc.add(p);});}}
// разметка пола: дорожки между отделами (от входа вглубь и поперёк) и светлые площадки отделов; одна текстура поверх пола
function shopFloorPlan(sc,P,W,D,zones,L,s){const px=Math.min(48,2048/W),cw=Math.round(W*px),ch=Math.round(D*px);const X=x=>(x+W/2)*px,Z=z=>(z+D/2)*px;
 const aisles=[],hw=P.aisleW/2;
 for(let c=1;c<L.cols;c++){const x=L.x0+c*L.zw;aisles.push([x-hw,L.z0+0.3,x+hw,L.z1]);}
 for(let r=1;r<L.rows;r++){const z=L.z0+r*L.zd;aisles.push([L.x0+0.3,z-hw,L.x1-0.3,z+hw]);}
 const zf=L.z1+0.9;aisles.push([L.x0+0.3,zf-hw,L.x1-0.3,zf+hw]);// поперёк перед отделами
 aisles.push([-Math.max(hw,L.dw/2-0.2),zf,Math.max(hw,L.dw/2-0.2),D/2-1.5]);// от входа
 if(L.cols%2)aisles.push([-hw,L.z0+0.3,hw,L.z1]);// по центру, если отделы не делятся пополам
 const tex=canvasTex(cw,ch,(g)=>{const r=mulberry(s.id+21);const e=Math.max(2,0.05*px);
  const rect=(a,grow)=>g.fillRect(X(a[0])-grow,Z(a[1])-grow,(a[2]-a[0])*px+grow*2,(a[3]-a[1])*px+grow*2);
  // площадки отделов
  zones.forEach(z=>{const a=[z.cx-z.w/2+0.15,z.cz-z.d/2+0.15,z.cx+z.w/2-0.15,z.cz+z.d/2-0.15];g.fillStyle=P.edge;rect(a,e);g.fillStyle=P.zone;rect(a,0);
   g.strokeStyle='rgba(120,100,70,.18)';g.lineWidth=1;g.strokeRect(X(a[0])+0.35*px,Z(a[1])+0.35*px,(a[2]-a[0]-0.7)*px,(a[3]-a[1]-0.7)*px);});
  for(let i=0;i<9000;i++){g.fillStyle=`rgba(90,70,40,${r()*.06})`;g.fillRect(r()*cw,r()*ch,2,2);}
  // дорожки: сначала кромка, потом камень — кромка остаётся только по внешнему контуру
  g.fillStyle=P.edge;aisles.forEach(a=>rect(a,e));g.fillStyle=P.aisle;aisles.forEach(a=>rect(a,0));
  g.save();g.beginPath();aisles.forEach(a=>g.rect(X(a[0]),Z(a[1]),(a[2]-a[0])*px,(a[3]-a[1])*px));g.clip();
  for(let i=0;i<60;i++){let x=r()*cw,y=r()*ch;g.strokeStyle=`rgba(${P.vein},${.08+r()*.12})`;g.lineWidth=0.6+r()*1.4;g.beginPath();g.moveTo(x,y);for(let k=0;k<8;k++){x+=(r()-.5)*90;y+=(r()-.5)*90;g.lineTo(x,y);}g.stroke();}
  for(let i=0;i<6000;i++){g.fillStyle=`rgba(255,255,255,${r()*.05})`;g.fillRect(r()*cw,r()*ch,1.5,1.5);}
  // швы плит на дорожках
  g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=1;for(let x=0;x<W;x+=1.2){g.beginPath();g.moveTo(X(x-W/2),0);g.lineTo(X(x-W/2),ch);g.stroke();}for(let z=0;z<D;z+=1.2){g.beginPath();g.moveTo(0,Z(z-D/2));g.lineTo(cw,Z(z-D/2));g.stroke();}
  g.restore();});
 const m=new THREE.Mesh(new THREE.PlaneGeometry(W,D).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({map:tex,transparent:true,roughness:.42,envMapIntensity:.18,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
 m.position.y=0.004;m.renderOrder=-1;sc.add(m);}
function noise(g,w,h,r,n,a){for(let i=0;i<n;i++){g.fillStyle=`rgba(80,60,40,${a*r()})`;g.fillRect(r()*w,r()*h,2,2);}}
function shopBlockedRaw(cols,W,D,x,z,dw){const r=0.35;const inDoor=dw&&Math.abs(x)<dw/2-0.3&&z>0&&z<D/2+0.9;if(Math.abs(x)>W/2-0.3-r||(!inDoor&&Math.abs(z)>D/2-0.3-r)||z>D/2+0.9)return true;for(const c of cols){if(x>c[0]-r&&x<c[1]+r&&z>c[2]-r&&z<c[3]+r)return true;}return false;}
function shopBlocked(x,z){return shopBlockedRaw(SHOP.colliders,SHOP.W,SHOP.D,x,z,SHOP.dw);}
function updateShopPeople(dt,now){const P=SHOP_PEOPLE;if(!P)return;const r=P.r;const q=new THREE.Quaternion(),sc_=new V3(),p_=new V3();
 P.list.forEach((p,i)=>{if(p.wait>0)p.wait-=dt;else{const dx=p.tx-p.x,dz=p.tz-p.z,d=Math.hypot(dx,dz);
   if(d<0.3){p.wait=1+r()*4;for(let t=0;t<10;t++){const x=p.x+(r()-.5)*10,z=p.z+(r()-.5)*10;if(!shopBlocked(x,z)){p.tx=x;p.tz=z;break;}}}
   else{const st=Math.min(d,p.sp*dt),nx=p.x+dx/d*st,nz=p.z+dz/d*st;if(!shopBlocked(nx,nz)){p.x=nx;p.z=nz;p.a=Math.atan2(dx,dz);}else{p.tx=p.x;p.tz=p.z;}}}
  q.setFromAxisAngle(new V3(0,1,0),p.a);sc_.set(1,1,1);p_.set(p.x,p.wait>0?0:Math.abs(Math.sin(now/1000*p.sp*5+p.ph))*0.03,p.z);mtx.compose(p_,q,sc_);P.meshes.forEach(m=>m.setMatrixAt(i,mtx));});
 P.meshes.forEach(m=>m.instanceMatrix.needsUpdate=true);}

/* ---------- Вход и выход ---------- */
let returnPos=null,doorCooldown=0,shopDept=0,shopProd=null;
function fadeThen(fn){if(calm){fn();return;}const f=$('fade');f.hidden=false;requestAnimationFrame(()=>{f.style.opacity=1;setTimeout(()=>{fn();requestAnimationFrame(()=>{f.style.opacity=0;setTimeout(()=>{f.hidden=true;},320);});},300);});}
// бесшовный переход: позиция и направление взгляда переносятся относительно двери
function enterShop(s,rel){if(mode==='store'||!s.door)return;closeCard();
 const d=s.door;if(SHOP&&(SHOP.s!==s||SHOP.feedV!==!!s._feed))disposeShop();if(!SHOP){SHOP=buildShop(s);SHOP.feedV=!!s._feed;}PS=SHOP;closeShopPanel(false);
 let along=-0.4,lat=0,fa=-1,fl=0;
 if(rel){along=rel.along;lat=rel.lat;const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);fa=fx*d.n.x+fz*d.n.z;fl=fx*d.R.x+fz*d.R.z;}
 returnDoor=s;mode='store';anim=null;
 player.x=Math.max(-SHOP.dw/2+0.4,Math.min(SHOP.dw/2-0.4,lat));player.z=SHOP.D/2+Math.min(-0.2,along);
 if(rel){player.yaw=Math.atan2(-fl,-fa);}else{player.yaw=0;player.pitch=0;}
 const vA=player.vx*d.n.x+player.vz*d.n.z,vL=player.vx*d.R.x+player.vz*d.R.z;player.vx=vL;player.vz=vA;
 SHOP.doorOpen=1;updateShopDoor();$('shopHud').hidden=false;$('shopHudName').textContent=s.name+' · '+floorName(s.floor);setMallUI(false);updateCross();applyPose(walkPose());
 if(!rel&&!calm){const f=$('fade');f.hidden=false;f.style.opacity=1;requestAnimationFrame(()=>{f.style.opacity=0;setTimeout(()=>{f.hidden=true;},320);});}
 hideLiftPanel(false);hideGoHere();
 showHint('Ты в «'+s.name+'». Походи по залу, нажми на понравившийся товар. Выход — через двери позади');}
let returnDoor=null;
function exitShop(rel){if(mode!=='store')return;const s=returnDoor||SHOP.s,d=s.door;closeShopPanel(false);
 let along=1.3,lat=0,fa=1,fl=0;
 if(rel){along=Math.max(0.35,rel.along);lat=rel.lat;const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);fa=fz;fl=fx;}
 mode='walk';$('shopHud').hidden=true;setMallUI(true);if(d.floor!==curFloor){curFloor=d.floor;updateFloorUI();setVis();drawMiniBase();}
 const vA=player.vz,vL=player.vx;
 player.x=d.c.x+d.n.x*along+d.R.x*lat;player.z=d.c.z+d.n.z*along+d.R.z*lat;
 const fx=d.n.x*fa+d.R.x*fl,fz=d.n.z*fa+d.R.z*fl;player.yaw=rel?Math.atan2(-fx,-fz):Math.atan2(-d.n.x,-d.n.z);if(!rel)player.pitch=0;
 player.vx=d.n.x*vA+d.R.x*vL;player.vz=d.n.z*vA+d.R.z*vL;
 if(blocked(player.x,player.z)){const w=nearestFree(player.x,player.z);if(w){player.x=w[0];player.z=w[1];}}
 d.open=1;updateDoors();doorCooldown=0.8;updateJoy();updateCross();applyPose(walkPose());}
function updateShopDoor(){if(!SHOP)return;const o=SHOP.doorOpen,h=SHOP.dw/2;SHOP.leaves[0].position.set(-(h/2+o*h*0.92),0,0.03);SHOP.leaves[1].position.set(h/2+o*h*0.92,0,0.03);}
function disposeShop(){if(!SHOP)return;SHOP.scene.traverse(o=>{if(o.geometry&&!(MOD&&MOD.geos.has(o.geometry)))o.geometry.dispose();if(o.material){const shared=Object.values(MAT);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(shared.includes(m))return;if(m.map&&![shelfAtlas,marble,blobTex].includes(m.map)&&!(MOD&&MOD.texs.has(m.map)))m.map.dispose();m.dispose();});}});SHOP=null;SHOP_PEOPLE=null;}
function setMallUI(on){document.body.classList.toggle('in-store',!on);['chips','mini','note'].forEach(id=>{$(id).style.display=on?'':'none';});document.querySelectorAll('#top .seg').forEach(e=>{e.style.display=on?'':'none';});}
// двери: открываются при приближении, проход в проём — вход
function updateMallDoors(dt){if(!world.doors)return;let changed=false;const px=player.x,pz=player.z;
 if(doorCooldown>0)doorCooldown-=dt;
 world.doors.forEach(s=>{const d=s.door;const dx=px-d.c.x,dz=pz-d.c.z;const along=dx*d.n.x+dz*d.n.z,lat=dx*d.R.x+dz*d.R.z;
  const near=mode==='walk'&&!ride&&d.floor===curFloor&&Math.hypot(dx,dz)<5.5&&along>-1;const target=near?1:0;
  if(Math.abs(d.open-target)>0.001){d.open=calm?target:d.open+(target-d.open)*Math.min(1,dt*4);changed=true;}
  // выгрузку товаров магазина подгружаем заранее, издалека
  if(d.floor===curFloor&&!s._feedTried&&!s._feedP&&Math.hypot(dx,dz)<14)loadFeed(s);
  // заранее собрать зал, пока подходим
  if(near&&mode==='walk'&&(!SHOP||SHOP.s!==s||SHOP.feedV!==!!s._feed)&&Math.hypot(dx,dz)<4.5&&!updateMallDoors.busy){updateMallDoors.busy=true;loadFeed(s).then(()=>{if(mode==='walk'){if(SHOP&&(SHOP.s!==s||SHOP.feedV!==!!s._feed))disposeShop();if(!SHOP){SHOP=buildShop(s);SHOP.feedV=!!s._feed;}}updateMallDoors.busy=false;});}
  if(mode==='walk'&&!anim&&!ride&&d.floor===curFloor&&doorCooldown<=0&&d.open>0.5&&along<-0.05&&along>-2&&Math.abs(lat)<d.w/2){enterShop(s,{along,lat});}});
 if(changed)updateDoors();}
function updateShopExit(dt){if(mode!=='store'||!SHOP)return;updateFittingBooth();const dz=SHOP.D/2-player.z;const near=dz<5&&Math.abs(player.x)<SHOP.dw/2+2;
 const t=near?1:0;if(Math.abs(SHOP.doorOpen-t)>0.001){SHOP.doorOpen=calm?t:SHOP.doorOpen+(t-SHOP.doorOpen)*Math.min(1,(dt||0.016)*4);updateShopDoor();}
 if(!anim&&player.z>SHOP.D/2+0.05&&Math.abs(player.x)<SHOP.dw/2)exitShop({along:player.z-SHOP.D/2,lat:player.x});}

/* ---------- Выбор в зале ---------- */
function shopHit(x,y){ray.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-(y/innerHeight)*2+1),cam);const hits=ray.intersectObjects(SHOP.pick,false);
 for(const h of hits){const o=h.object;if(o.userData.exit)return{exit:true,dist:h.distance};if(o.userData.fit)return{fit:true,dist:h.distance};if(o.userData.dept!=null)return{dept:o.userData.dept,dist:h.distance};
  if(o.userData.prods&&h.instanceId!=null)return{prod:o.userData.prods[h.instanceId],dist:h.distance};if(o.userData.prod)return{prod:o.userData.prod,dist:h.distance};}return null;}
// товар можно взять только вблизи, как в настоящем магазине; издалека — подсказка подойти
const REACH=3.2,REACH_TOUCH=4.2;const reach=()=>coarse?REACH_TOUCH:REACH;
function shopPick(x,y){const h=shopHit(x,y);if(!h)return;if(h.exit){if(h.dist<6)exitShop();else showHint('Подойди к двери, чтобы выйти');return;}
 if(h.fit){if(h.dist<reach()+1)openFitting();else showHint('Подойди к примерочной');return;}
 if(h.prod){if(h.dist<reach())openProduct(h.prod);else showHint('Подойди ближе, чтобы посмотреть товар');}}
function shopAimText(){const h=shopHit(innerWidth/2,innerHeight/2);if(!h||h.dist>12)return'';if(h.exit)return h.dist<6?'Выход в галерею · нажми':'Выход в галерею';if(h.fit)return h.dist<reach()+1?'Примерочная · нажми, чтобы войти':'Примерочная';if(h.dept!=null)return'Отдел «'+SHOP.cat[h.dept].title+'»';if(h.prod)return h.dist<reach()?h.prod.name+' · '+fmtPrice(h.prod.price):'Подойди ближе';return'';}
function goToDept(i){const z=SHOP.zones[i];if(!z)return;let tx=z.cx,tz=z.cz+z.d/2+0.8;for(let k=0;k<20&&shopBlocked(tx,tz);k++)tz+=0.4;
 player.x=tx;player.z=Math.min(tz,SHOP.D/2-1.2);player.yaw=0;player.pitch=-0.12;anim={t:0,from:{p:cam.position.clone(),q:cam.quaternion.clone()},m:'walk'};}

/* ---------- Панели магазина: курсор появляется сам ---------- */
function openShopPanel(){$('shop').hidden=false;$('shop').classList.remove('min');releaseLock();updateCross();}
function closeShopPanel(relock){stopViewer();$('shop').hidden=true;if(relock)requestLockIfNeeded();else updateCross();}
function requestLockIfNeeded(){if(!coarse&&isFP()&&!locked){requestLock();}updateCross();}
$('shopCat').onclick=()=>{PS=SHOP;shopProd=null;renderShopPanel();openShopPanel();};
$('shopOut').onclick=()=>exitShop();
/* ---------- Панель каталога ---------- */
// откуда берётся каталог: зал магазина (SHOP) или стенд-островок в галерее
let PS=null,shopShown=24;
function kioskHasGoods(s){return (s.kind==='kiosk'||s.island)&&s.cat!=='tbd'&&s.cat!=='wc';}
function openKioskPanel(s){if(!s._feedTried){loadFeed(s).then(()=>openKioskPanel(s));return;}PS={s,cat:catalogOf(s)};shopDept=0;shopProd=null;shopShown=24;renderShopPanel();openShopPanel();
 showHint('«'+s.name+'» — товары островка. Нажми на товар, чтобы посмотреть его');}
function renderShopPanel(){const s=PS.s,cat=PS.cat;const el=$('shop');
 el.querySelector('.sh-name').textContent=s.name;el.querySelector('.sh-what').textContent=(s.what||'')+' · '+floorName(s.floor);
 el.querySelector('.sh-dot').style.background=s.colHex;
 const tabs=el.querySelector('.sh-tabs');tabs.innerHTML='';
 cat.forEach((d,i)=>{const b=document.createElement('button');b.className='sh-tab'+(i===shopDept?' on':'');b.textContent=d.title;b.onclick=()=>{shopDept=i;shopProd=null;shopShown=24;renderShopPanel();};tabs.appendChild(b);});
 const body=el.querySelector('.sh-body');body.innerHTML='';
 if(shopProd){const p=shopProd;const w=document.createElement('div');w.className='sh-detail';
  const img=document.createElement('img');img.src=iconURL(p.icon,p.color);img.alt='';w.appendChild(img);
  const h=document.createElement('h3');h.textContent=p.name;w.appendChild(h);
  const pr=document.createElement('p');pr.className='sh-price';pr.textContent=fmtPrice(p.price);w.appendChild(pr);
  const note=document.createElement('p');note.className='sh-note';note.textContent='Товар и цена — пример для концепта. Настоящий ассортимент и наличие смотри на сайте магазина.';w.appendChild(note);
  const row=document.createElement('div');row.className='sh-row';
  const back=document.createElement('button');back.className='btn';back.textContent='← К отделу';back.onclick=()=>{shopProd=null;renderShopPanel();};row.appendChild(back);
  if(mode==='store'){const show=document.createElement('button');show.className='btn';show.textContent='Показать в зале';show.onclick=()=>{closeShopPanel(true);goToDept(shopDept);};row.appendChild(show);}
  const a=document.createElement('a');a.className='btn pri';a.target='_blank';a.rel='noopener';const site=siteOf(s);a.href=site||mapsOf(s);a.textContent=site?'Смотреть на сайте ↗':'Магазин на картах ↗';row.appendChild(a);
  w.appendChild(row);body.appendChild(w);}
 else{const grid=document.createElement('div');grid.className='sh-grid';
  const dep=cat[shopDept];const all=dep.items;const shown=Math.min(all.length,shopShown);
  const cnt=document.createElement('p');cnt.className='sh-note';const fi=feedInfo(s);cnt.textContent=fi?'Товары из выгрузки магазина'+(fi.demo?' — тестовой: товары, цены и ссылки ненастоящие':'')+' · обновлено '+fmtDate(fi.updated)+' · в отделе '+all.length:onlineKind(s)!=='shop'?'Примеры позиций. '+onlineText(s):'В отделе '+all.length+' товаров'+(s.kind==='kiosk'?'':' · у каждого своё место в зале');body.appendChild(cnt);
  all.slice(0,shown).forEach(p=>{const c=document.createElement('button');c.className='sh-card';const img=document.createElement('img');img.src=thumbURL(p);img.alt='';img.loading='lazy';
   const n=document.createElement('span');n.className='sh-cn';n.textContent=p.name;const pr=document.createElement('span');pr.className='sh-cp';pr.textContent=fmtPrice(p.price);
   c.append(img,n,pr);c.onclick=()=>{openProduct(p);};grid.appendChild(c);});body.appendChild(grid);
  if(shown<all.length){const more=document.createElement('button');more.className='btn sh-more';more.textContent='Показать ещё '+Math.min(24,all.length-shown);more.onclick=()=>{shopShown+=24;renderShopPanel();};body.appendChild(more);}}
 const site=siteOf(s);const f=el.querySelector('.sh-site');f.href=site||mapsOf(s);f.textContent=site?'Сайт магазина ↗':'Магазин на Яндекс Картах ↗';demoLine(s);}
// подпись внизу панели: откуда товары
function demoLine(s){const fi=feedInfo(s),k=onlineKind(s);$('shop').querySelector('.sh-demo').textContent=fi?(fi.demo?'Тестовая выгрузка: товары, цены и ссылки ненастоящие.':'Товары из выгрузки магазина, обновлено '+fmtDate(fi.updated)+'.'):k==='info'?'Меню — пример для концепта. Онлайн-заказа здесь нет.':k==='act'?'Позиции и цены — пример для концепта. Оформление — у самого заведения.':'Каталог — пример для концепта: товары и цены условные.';}
$('shExit').onclick=()=>closeShopPanel(true);
$('shMin').onclick=()=>{$('shop').classList.toggle('min');};

/* ---------- Страница товара: 3D со всех сторон, на манекене, размеры ---------- */
const SIZES={jacket:['XS','S','M','L','XL','XXL'],pants:['44','46','48','50','52','54'],tshirt:['XS','S','M','L','XL','XXL'],longsleeve:['XS','S','M','L','XL','XXL'],dress:['40','42','44','46','48','50'],shoe:['38','39','40','41','42','43','44','45'],bike:['S · 150–165 см','M · 165–178 см','L · 178–190 см']};
const WEARABLE={jacket:1,pants:1,tshirt:1,longsleeve:1,dress:1,shoe:1};
let PV=null;
function productModel(p){if(p.model)return p.model;const dep=DEPT[p.dept];return dep?dep.model:'box';}
// сцена просмотра: мягкий свет с трёх сторон, подиум
function viewerScene(){const sc=new THREE.Scene();sc.environment=scene.environment;sc.add(new THREE.HemisphereLight(LIN('#ffffff'),LIN('#c9c1b5'),0.75));
 const key=new THREE.DirectionalLight(LIN('#fff6ea'),0.85);key.position.set(2,4,3);sc.add(key);const rim=new THREE.DirectionalLight(LIN('#e8f0ff'),0.35);rim.position.set(-3,2,-2);sc.add(rim);
 const pod=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,0.04,48),new THREE.MeshStandardMaterial({color:LIN('#eceae6'),roughness:.45}));pod.position.y=-0.02;sc.add(pod);
 const sh=new THREE.Mesh(new THREE.CircleGeometry(0.6,32),new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false}));sh.rotation.x=-Math.PI/2;sh.position.y=0.002;sc.add(sh);
 const root=new THREE.Group();sc.add(root);return{sc,root,pod,sh};}
function ensureViewer(){if(PV)return PV;const cv=document.createElement('canvas');cv.className='pv';cv.width=640;cv.height=440;
 const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});r.outputEncoding=THREE.sRGBEncoding;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=0.95;r.setPixelRatio(1);r.setSize(640,440,false);
 const c=new THREE.PerspectiveCamera(30,640/440,0.02,50);const vs=viewerScene();PV=Object.assign({cv,r,c,rot:0.6,drag:null,raf:0,run:false},vs);
 cv.addEventListener('pointerdown',e=>{PV.drag=e.clientX;cv.setPointerCapture(e.pointerId);});cv.addEventListener('pointermove',e=>{if(PV.drag!=null){PV.rot+=(e.clientX-PV.drag)*0.012;PV.drag=e.clientX;}});
 cv.addEventListener('pointerup',()=>{PV.drag=null;});cv.addEventListener('pointercancel',()=>{PV.drag=null;});return PV;}
function stopViewer(){if(PV){PV.run=false;cancelAnimationFrame(PV.raf);}}
// товар целиком (или на манекене) в группе, поставленный на подиум; h — высота для камеры
function productGroup(p,onMannequin){models();const m=productModel(p);const g=new THREE.Group();let h=1;
 if(onMannequin&&WEARABLE[m]){const parts=humanParts(true);const skin=new THREE.MeshStandardMaterial({color:LIN('#efece6'),roughness:.35});const fab=MOD.partMat({m:m==='longsleeve'?'knit':'fabric'},p.color);
  const top=(m==='jacket'||m==='tshirt'||m==='longsleeve'||m==='dress'),bottom=(m==='pants'||m==='dress');const denim=MOD.partMat({m:'fabric'},'#2c3440');
  g.add(new THREE.Mesh(parts.torso,top?fab:skin),new THREE.Mesh(parts.legs,bottom?fab:denim),new THREE.Mesh(parts.arms,(m==='jacket'||m==='longsleeve')?fab:skin),new THREE.Mesh(parts.head,skin));
  if(m==='jacket'){const coat=new THREE.Mesh(mergeG([Cy(0.23,0.25,0.62,0,1.32,0,24)]),fab);coat.scale.set(1,1,0.72);g.add(coat);}
  if(m==='dress'){const sk=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.34,0.62,28,1,true).translate(0,0.72,0),fab);sk.material.side=THREE.DoubleSide;g.add(sk);}
  if(m==='shoe'){[-0.09,0.09].forEach(x=>{const s=MOD.group('shoe',p.color);s.rotation.y=-Math.PI/2;s.position.set(x,0,0.03);g.add(s);});}
  h=1.95;}
 else{const it=MOD.group(m,p.color);const bb=new THREE.Box3().setFromObject(it);const size=bb.getSize(new V3()),ctr=bb.getCenter(new V3());it.position.set(-ctr.x,-bb.min.y,-ctr.z);g.add(it);h=Math.max(size.y,size.x*0.75,size.z*0.75);}
 return{g,h};}
function viewerShow(p,onMannequin){const V=ensureViewer();while(V.root.children.length)V.root.remove(V.root.children[0]);
 const {g,h}=productGroup(p,onMannequin);V.root.add(g);V.pod.scale.setScalar(Math.max(0.35,h*0.7));V.sh.scale.setScalar(Math.max(0.3,h*0.6));
 V.target=h;V.c.position.set(0,h*0.62,h*2.6+0.3);V.c.lookAt(0,h*0.48,0);
 if(!V.run){V.run=true;const loop=()=>{if(!V.run)return;if(V.drag==null&&!calm)V.rot+=0.006;V.root.rotation.y=V.rot;V.r.render(V.sc,V.c);V.raf=requestAnimationFrame(loop);};loop();}
 return V.cv;}
// картинки для карточек каталога: тот же 3D-товар, снимок под углом (кешируются)
let TH=null;const thumbCache=new Map();
function thumbURL(p){if(p.photo&&PHOTOS[p.photo])return PHOTOS[p.photo].url;if(p.pic)return p.pic;if(thumbCache.has(p.id))return thumbCache.get(p.id);
 if(!TH){const cv=document.createElement('canvas');cv.width=240;cv.height=180;const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true,preserveDrawingBuffer:true});r.outputEncoding=THREE.sRGBEncoding;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=0.95;r.setSize(240,180,false);r.setClearColor(0xf1efeb,1);
  TH=Object.assign({cv,r,c:new THREE.PerspectiveCamera(28,240/180,0.02,50)},viewerScene());}
 while(TH.root.children.length)TH.root.remove(TH.root.children[0]);const {g,h}=productGroup(p,false);g.rotation.y=0.65;TH.root.add(g);TH.pod.scale.setScalar(Math.max(0.35,h*0.7));TH.sh.scale.setScalar(Math.max(0.3,h*0.6));
 TH.c.position.set(0,h*0.7,h*2.4+0.25);TH.c.lookAt(0,h*0.45,0);TH.r.render(TH.sc,TH.c);let url;try{url=TH.cv.toDataURL('image/jpeg',0.82);}catch(e){url=iconURL(p.icon,p.color);}
 thumbCache.set(p.id,url);return url;}
function openProduct(p){shopProd=p;shopDept=Math.max(0,PS.cat.findIndex(d=>d.key===p.dept));renderProduct(p,false);openShopPanel();}
const el_=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;};
const fmtDate=d=>{if(!d)return'';const m=/^(\d{4})-(\d\d)-(\d\d)/.exec(d);return m?(+m[3])+' '+['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][+m[2]-1]:d;};
function renderProduct(p,onMan,size){const s=PS.s,el=$('shop'),fi=p.feed?feedInfo(s):null,kind=onlineKind(s);
 el.querySelector('.sh-name').textContent=p.name;el.querySelector('.sh-what').textContent=s.name+' · '+(p.deptTitle||(DEPT[p.dept]?DEPT[p.dept].t:''));el.querySelector('.sh-dot').style.background=s.colHex;
 el.querySelector('.sh-tabs').innerHTML='';const body=el.querySelector('.sh-body');body.innerHTML='';body.scrollTop=0;
 const w=el_('div','sh-detail');
 const m=productModel(p);const photo=p.photo&&PHOTOS[p.photo]?PHOTOS[p.photo].url:p.pic;
 if(photo){stopViewer();const im=el_('img','pv pv-photo');im.src=photo;im.alt=p.name;w.appendChild(im);w.appendChild(el_('p','sh-note',p.feed?'Фото из выгрузки магазина.':'Фото вещи. Пока пример — позже у каждого магазина будут свои фото.'));}
 else{const cv=viewerShow(p,onMan);w.appendChild(cv);w.appendChild(el_('p','sh-note',p.feed?'Фото в выгрузке нет — показана похожая модель. Потяни, чтобы повернуть.':'Потяни картинку, чтобы повернуть товар.'));}
 if(WEARABLE[m]&&!photo){const tg=el_('div','sh-seg');['Товар','На манекене'].forEach((t,i)=>{const b=el_('button','sh-tab'+((!!onMan)===(i===1)?' on':''),t);b.onclick=()=>renderProduct(p,i===1,chosen);tg.appendChild(b);});w.appendChild(tg);}
 const info=describe(p,m);
 const pr=el_('div','sh-pricebox');pr.append(el_('span','sh-price',fmtPrice(p.price)));if(p.oldPrice&&p.oldPrice>p.price){const o=el_('s','sh-old',fmtPrice(p.oldPrice));pr.appendChild(o);}
 pr.appendChild(el_('span','sh-rate',fi?(fi.demo?'цена из тестовой выгрузки':'цена на '+fmtDate(fi.updated)):'цена условная'));w.appendChild(pr);
 w.appendChild(el_('p','sh-stock',fi?'Размеры — те, что есть в выгрузке магазина на '+fmtDate(fi.updated)+'. Есть ли вещь именно в «Макси», видно при заказе на сайте магазина.':'«'+s.name+'», '+floorName(s.floor)+'. Наличие и настоящую цену уточняй в магазине или на его сайте.'));
 let chosen=size||null;const sz=p.sizes&&p.sizes.length?p.sizes:SIZES[m];let lab=null;
 if(sz){lab=el_('p','sh-lab',p.feed?'Размеры в наличии':'Размер');w.appendChild(lab);const row=el_('div','sh-sizes');
  sz.forEach(x=>{const b=el_('button','sh-size'+(x===chosen?' on':''),x);b.onclick=()=>{row.querySelectorAll('.sh-size').forEach(q=>q.classList.remove('on'));b.classList.add('on');chosen=x;lab.textContent=p.feed?'Размеры в наличии':'Размер';lab.classList.remove('err');};row.appendChild(b);});w.appendChild(row);}
 const buy=el_('div','sh-row sh-buy');
 if(p.feed){
  // покупка и бронь — на сайте магазина: туда ведёт ссылка на товар из выгрузки
  const a=el_('a','btn pri','Купить на сайте магазина ↗');a.href=p.url||siteOf(s)||mapsOf(s);a.target='_blank';a.rel='noopener';buy.appendChild(a);
  if(p.pickup){const b=el_('a','btn','Забрать в «Макси» ↗');b.href=p.url||siteOf(s)||mapsOf(s);b.target='_blank';b.rel='noopener';buy.appendChild(b);}
  w.appendChild(buy);
  if(p.pickup)w.appendChild(el_('p','sh-note','«Забрать в «Макси»» — на сайте магазина выбери самовывоз из ТРЦ «Макси», Тула. Бронь и оплату ведёт сам магазин.'));}
 else if(kind==='act'){const a0=onlineActions(s)[0],a=el_('a','btn pri',ACTIONS[a0].btn);a.href=siteOf(s)||mapsOf(s);a.target='_blank';a.rel='noopener';buy.appendChild(a);w.appendChild(buy);
  w.appendChild(el_('p','sh-note',onlineText(s)+(siteOf(s)?' Оформление — на сайте «'+s.name+'».':' Сайта пока нет в нашем списке — ссылка ведёт на контакты на Яндекс Картах.')));}
 else if(kind!=='shop'){w.appendChild(el_('p','sh-stock',onlineText(s)));}
 else{
  const add=el_('button','btn pri','В корзину');const now=el_('button','btn','Купить сейчас');
  const put=()=>{if(sz&&!chosen){lab.textContent='Выбери размер';lab.classList.add('err');return false;}
   cart.add({key:s.id+'|'+p.id+'|'+(chosen||''),name:p.name,price:p.price,size:chosen,shop:s.name,shopId:s.id,floor:s.floor,icon:p.icon,color:p.color,model:productModel(p),pid:p.id,photo:p.photo});return true;};
  add.onclick=()=>{if(!put())return;add.textContent='В корзине ✓';add.classList.add('ok');showHint('«'+p.name+'» в корзине. Корзина — кнопка с сумкой вверху справа');setTimeout(()=>{add.textContent='Добавить ещё';add.classList.remove('ok');},1600);};
  now.onclick=()=>{if(!put())return;closeShopPanel(false);openCart(true);};
  buy.append(add,now);w.appendChild(buy);}
 // примерочная: вещь можно взять и примерить вместе с вещами из других магазинов
 if(FIT.isWearable(p)){const fr=el_('div','sh-row sh-fit');const fb=el_('button','btn');const sync=()=>{const on=FIT.has(p,s);fb.textContent=on?'В примерочной ✓ · открыть':'В примерочную';fb.classList.toggle('ok',on);};sync();
  fb.onclick=()=>{if(!FIT.has(p,s)){FIT.add(p,s,true);sync();showHint('«'+p.name+'» — в примерочной ('+FIT.count()+' вещ.). '+(mode==='store'&&SHOP&&SHOP.fit?'Кабина — в левом углу у входа':'Примерить можно в любом магазине одежды'));}else openFitting();};
  fr.appendChild(fb);w.appendChild(fr);}
 // плашка с описанием, как в интернет-магазине
 const plate=el_('div','sh-plate');
 if(p.feed){if(p.desc){plate.appendChild(el_('h4',null,'Описание'));plate.appendChild(el_('p',null,p.desc));}
  plate.appendChild(el_('h4',null,'Характеристики'));const dl=el_('dl');[['Цвет',p.colorName||'—'],['Размеры',(p.sizes||[]).join(', ')||'—'],['Магазин в «Макси»',s.name+', '+floorName(s.floor)],['Источник',fi&&fi.source||'выгрузка магазина']].forEach(([k,v])=>{dl.append(el_('dt',null,k),el_('dd',null,v));});plate.appendChild(dl);}
 else{plate.appendChild(el_('h4',null,'Описание'));plate.appendChild(el_('p',null,info.text));
  plate.appendChild(el_('h4',null,'Характеристики'));const dl=el_('dl');info.specs.forEach(([k,v])=>{dl.append(el_('dt',null,k),el_('dd',null,v));});plate.appendChild(dl);}
 w.appendChild(plate);
 w.appendChild(el_('p','sh-note',fi?(fi.demo?'Тестовая выгрузка: товары, цены и ссылки ненастоящие. Так будет выглядеть магазин, подключённый через выгрузку.':'Товары и цены — из выгрузки магазина, обновляются раз в сутки. Точные — на его сайте.'):kind!=='shop'?'Позиции — пример для концепта.':'Товар, цена и размеры — пример для концепта. Настоящие наличие и цены — на сайте магазина.'));
 const row=el_('div','sh-row');
 const site=siteOf(s);if(!p.feed){const a=el_('a','btn');a.target='_blank';a.rel='noopener';a.href=site||mapsOf(s);a.textContent=site?'Смотреть на сайте ↗':'Магазин на картах ↗';row.appendChild(a);}
 const back=el_('button','btn','Продолжить прогулку');back.onclick=()=>closeShopPanel(true);row.appendChild(back);
 w.appendChild(row);body.appendChild(w);
 const f=el.querySelector('.sh-site');f.href=site||mapsOf(s);f.textContent=site?'Сайт магазина ↗':'Магазин на Яндекс Картах ↗';demoLine(s);}

/* ---------- Корзина и заказ ---------- */
function updateCartBadge(){const n=cart.count();$('cartN').textContent=n>99?'99+':String(n);$('cartN').hidden=!n;}
cart.on(()=>{updateCartBadge();if(!$('cartBox').hidden&&$('orderForm').hidden&&$('orderDone').hidden)renderCart();});
function openCart(checkout){releaseLock();$('cartBox').hidden=false;$('orderDone').hidden=true;$('orderForm').hidden=true;$('cartMain').hidden=false;renderCart();if(checkout&&cart.count())showOrderForm();updateCross();}
function closeCart(){$('cartBox').hidden=true;updateCross();}
function renderCart(){const ul=$('cartList');ul.innerHTML='';const its=cart.items();
 $('cartEmpty').hidden=!!its.length;$('cartFoot').hidden=!its.length;
 its.forEach(it=>{const li=el_('li');const img=el_('img');img.src=it.model?thumbURL({id:it.pid||it.key,model:it.model,color:it.color,photo:it.photo}):iconURL(it.icon,it.color);img.alt='';
  const t=el_('div','ci-t');t.append(el_('b',null,it.name),el_('small',null,it.shop+' · '+floorName(it.floor)+(it.size?' · размер '+it.size:'')));
  const q=el_('div','ci-q');const mi=el_('button','icon-s','−'),n=el_('span',null,String(it.qty)),pl=el_('button','icon-s','+');mi.setAttribute('aria-label','Меньше');pl.setAttribute('aria-label','Больше');
  mi.onclick=()=>cart.setQty(it.key,it.qty-1);pl.onclick=()=>cart.setQty(it.key,it.qty+1);q.append(mi,n,pl);
  li.append(img,t,q,el_('span','ci-p',fmtPrice(it.price*it.qty)));ul.appendChild(li);});
 $('cartSum').textContent=fmtPrice(cart.total());}
function showOrderForm(){$('cartMain').hidden=true;$('orderForm').hidden=false;$('oSum').textContent=fmtPrice(cart.total())+' · '+cart.count()+' шт.';$('oErr').textContent='';setTimeout(()=>$('oName').focus(),30);}
$('bCart').onclick=()=>openCart(false);
$('cartX').onclick=closeCart;$('cartBox').addEventListener('pointerdown',e=>{if(e.target.id==='cartBox')closeCart();});
$('cartGo').onclick=showOrderForm;$('cartClear').onclick=()=>cart.clear();
$('oBack').onclick=()=>{$('orderForm').hidden=true;$('cartMain').hidden=false;renderCart();};
[...document.querySelectorAll('input[name=oWay]')].forEach(r=>r.addEventListener('change',()=>{$('oAddrRow').hidden=document.querySelector('input[name=oWay]:checked').value!=='courier';}));
$('orderForm').addEventListener('submit',e=>{e.preventDefault();const name=$('oName').value.trim(),phone=$('oPhone').value.replace(/\D/g,''),way=document.querySelector('input[name=oWay]:checked').value,addr=$('oAddr').value.trim();
 if(!name){$('oErr').textContent='Напиши, как к тебе обращаться';return;}
 if(phone.length<10){$('oErr').textContent='Проверь номер телефона: нужно 10–11 цифр';return;}
 if(way==='courier'&&addr.length<5){$('oErr').textContent='Укажи адрес доставки';return;}
 const shops=[...new Set(cart.items().map(x=>x.shop))];const num=String(Math.floor(100000+Math.random()*899999));
 $('orderNum').textContent='Заказ №'+num;
 $('orderTxt').textContent=(way==='courier'?'Доставим по адресу: '+addr+'. ':'Заберёшь в магазин'+(shops.length>1?'ах':'е')+': '+shops.join(', ')+'. ')+'Сумма '+fmtPrice(cart.total())+'.';
 cart.clear();$('orderForm').hidden=true;$('orderDone').hidden=false;});
$('orderOk').onclick=()=>{closeCart();requestLockIfNeeded();};
updateCartBadge();

/* ---------- Проверка карты: можно ли везде пройти, не протискиваясь ---------- */
function auditMap(){const res={};
 [1,2].forEach(f=>{const N=GW*GH,nav=new Uint8Array(N);
  for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const k=j*GW+i;if(!GRIDS[f][k])continue;const [x,z]=fromPx(i,j);if(!blockedF(f,x,z))nav[k]=1;}
  // старт: у входа 2 на первом этаже, у лифта на втором
  let sx,sz;if(f===1){const e=D.ents.find(e=>e.n===2)||D.ents[0];sx=e.p[0]-e.d[0]*6;sz=e.p[1]-e.d[1]*6;}else{const L=world.lifts[0];sx=L.c.x+L.n.x*(L.HL+1.6);sz=L.c.z+L.n.z*(L.HL+1.6);}
  const st=nearestFree(sx,sz,80,f)||nearestAny(f,sx,sz);const [si,sj]=toPx(st[0],st[1]);
  const seen=new Uint8Array(N),q=new Int32Array(N);let h=0,t=0;q[t++]=sj*GW+si;seen[sj*GW+si]=1;
  while(h<t){const k=q[h++],i=k%GW,j=(k/GW)|0;for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=GW||b>=GH)continue;const kk=b*GW+a;if(nav[kk]&&!seen[kk]){seen[kk]=1;q[t++]=kk;}}}
  let navN=0;for(let k=0;k<N;k++)navN+=nav[k];
  // двери: точка перед дверью должна быть достижима
  const bad=[];world.doors.filter(s=>s.door.floor===f).forEach(s=>{const d=s.door;let ok=false;
   for(let r=0.6;r<=2.4&&!ok;r+=0.3)for(let l=-0.6;l<=0.6&&!ok;l+=0.3){const x=d.c.x+d.n.x*r+d.R.x*l,z=d.c.z+d.n.z*r+d.R.z*l;const [i,j]=toPx(x,z);if(i>=0&&j>=0&&i<GW&&j<GH&&seen[j*GW+i])ok=true;}
   if(!ok)bad.push(s.name);});
  // узкие места: проход уже 1,8 м (расстояние до препятствия с учётом плеч < 0,55 м)
  const dist=new Float32Array(N).fill(1e9);for(let k=0;k<N;k++)if(!nav[k])dist[k]=0;
  for(let j=0;j<GH;j++)for(let i=0;i<GW;i++){const k=j*GW+i;if(!dist[k])continue;let v=dist[k];if(i>0)v=Math.min(v,dist[k-1]+1);if(j>0)v=Math.min(v,dist[k-GW]+1);if(i>0&&j>0)v=Math.min(v,dist[k-GW-1]+1.414);if(i<GW-1&&j>0)v=Math.min(v,dist[k-GW+1]+1.414);dist[k]=v;}
  for(let j=GH-1;j>=0;j--)for(let i=GW-1;i>=0;i--){const k=j*GW+i;if(!dist[k])continue;let v=dist[k];if(i<GW-1)v=Math.min(v,dist[k+1]+1);if(j<GH-1)v=Math.min(v,dist[k+GW]+1);if(i<GW-1&&j<GH-1)v=Math.min(v,dist[k+GW+1]+1.414);if(i>0&&j<GH-1)v=Math.min(v,dist[k+GW-1]+1.414);dist[k]=v;}
  const nearDoor=(x,z)=>world.doors.some(s=>s.door.floor===f&&Math.hypot(x-s.door.c.x,z-s.door.c.z)<3);
  const narrow=[];for(let j=1;j<GH-1;j+=2)for(let i=1;i<GW-1;i+=2){const k=j*GW+i;if(!seen[k])continue;const dm=dist[k]*CELL;
   // точка на средней линии прохода (локальный максимум), а проход узкий
   if(dm<0.55&&dist[k]>=dist[k-1]&&dist[k]>=dist[k+1]&&dist[k]>=dist[k-GW]&&dist[k]>=dist[k+GW]){const [x,z]=fromPx(i,j);if(!nearDoor(x,z))narrow.push([+x.toFixed(1),+z.toFixed(1)]);}}
  res[f]={reachable:+(t/navN).toFixed(3),doors:world.doors.filter(s=>s.door.floor===f).length,unreachableDoors:bad,narrow:narrow.length,narrowAt:narrow};});
 res.columns={kept:world.colsKept,dropped:world.colsDropped};return res;}

async function start(){
 try{await Promise.race([Promise.all(['800 40px Manrope',...FONT_LOADS].map(f=>document.fonts.load(f).catch(()=>{})).concat([feedIndexReady()])),new Promise(r=>setTimeout(r,3000))]);}catch(e){}
 try{build();}catch(err){$('loading').textContent='Не получилось построить сцену: '+err.message;console.error(err);return;}
 {const w=nearestFree(player.x,player.z);if(w){player.x=w[0];player.z=w[1];}}
 const qs=new URLSearchParams(location.search);if(qs.has('calm'))calm=qs.get('calm')!=='0';setCalm(calm);
 applyStyle(qs.get('style')||'coolG');
 FX.patchFloors(floorMatsF);buildFloorMirror();FX.init();
 if(qs.get('fx')==='0')FX.setTier(0);else if(qs.has('q'))FX.setTier(+qs.get('q'));else if(PREFS.gfx!=='auto')FX.setMode(PREFS.gfx);
 buildChips();updateFloorUI();sizeMini();updateJoy();setVis();updateCross();applyPose(walkPose());
 $('loading').hidden=true;
 showHint(coarse?'Джойстик — идти, палец за краем круга — бежать. Проведи по экрану — осмотреться.':'Ты у входа 2. Кликни по сцене — курсор скроется, и обзор пойдёт за мышью · WASD — идти · Esc — вернуть курсор');
 requestAnimationFrame(frame);
}
// Поддельное отражение пола 1 этажа: зеркальная копия витрин, перекрытия и светильников под полом (те же
// геометрия и материалы, без второго прохода рендера), пол становится чуть прозрачным. Под копией — подложка
// цвета пола, чтобы сквозь пол не было видно неба. Включает fx.js, когда живого отражения нет (телефон, «Быстрее»).
function buildFloorMirror(){const grp=new THREE.Group();grp.scale.y=-1;grp.visible=false;let n=0;
 ['stores','slab','roof'].forEach(name=>{const src=world.groups[name];if(!src)return;src.updateMatrixWorld(true);src.traverse(o=>{if(!o.isMesh||!o.visible||o.material.visible===false)return;let p=o.parent;while(p){if(!p.visible)return;p=p.parent;}
  let m;if(o.isInstancedMesh){m=new THREE.InstancedMesh(o.geometry,o.material,o.count);m.instanceMatrix=o.instanceMatrix;if(o.instanceColor)m.instanceColor=o.instanceColor;}else m=new THREE.Mesh(o.geometry,o.material);
  m.matrixAutoUpdate=false;m.matrix.copy(o.matrixWorld);m.renderOrder=-5;grp.add(m);n++;});});
 const base=new THREE.Mesh(new THREE.PlaneGeometry(bb.x1-bb.x0+200,bb.z1-bb.z0+200),new THREE.MeshBasicMaterial({color:LIN('#cdbfa8'),fog:true}));base.rotation.x=Math.PI/2;base.position.set((bb.x0+bb.x1)/2,12,(bb.z0+bb.z1)/2);base.renderOrder=-6;grp.add(base);
 scene.add(grp);world.mirror=grp;world.mirrorN=n;
 // в снимок окружения для блеска пола не попадают люди, сама зеркальная копия и подписи вида сверху — так дешевле
 FX.set({onMirror:on=>{world.mirrorOn=on;},mirrorGate:()=>curFloor===1&&mode==='walk',probeHide:[world.groups.people,grp,world.groups.spots,world.groups.toplabels1,world.groups.toplabels2]});}
// пробные стили оформления: ?style=warm|game|night
const walkPoints=(f,step)=>{const st=Math.round(step/CELL),o=[];for(let j=2;j<GH;j+=st)for(let i=2;i<GW;i+=st){if(!GRIDS[f][j*GW+i])continue;const [x,z]=fromPx(i,j);if(!blockedF(f,x,z))o.push([x,z]);}return o;};
const applyStyle=name=>makeStyler({scene,renderer,hemi,sun,sky:skyMesh,S,MAT,floors:floorMats,slabMat:world.slabMat,roofMat:world.roofMat,railMat:world.railMat,colMat:world.colMat,merged:MERGED,signAtlases,PER,walkPoints,FY,G,lockFog:(n,f)=>{FOGW=[n,f];}})(name);
// Отладочный доступ для тестов и Claude Code: открой страницу с ?debug
if(new URLSearchParams(location.search).has('debug'))window.__maxi={loadFeed,catalogOf,onlineKind,openCard,setPS:v=>{PS=v;},get PS(){return PS},renderProduct,get mode(){return mode},player,S,keys,world,get SHOP(){return SHOP},cam,renderer,scene,
 enterShop,exitShop,openProduct,walkToDoor,walkTo,setMode,blocked,isWalk,get locked(){return locked},get loaded(){return $('loading').hidden},
 get floor(){return curFloor},get anim(){return anim},startEsc,goEscalator,escEntry,get escs(){return world.escs},auditMap,setFloor,goFloor,startRide,get ride(){return ride},get lifts(){return world.lifts},cart,openCart,setCalm,get calm(){return calm},topTap,get topv(){return topv},openLiftPanel,showTop,setStyle:applyStyle,FX,setShopStyle,INTERIORS,decor:()=>[world.decor1,world.decor2],pickAt:(x,y)=>pick(x,y,false),FIT,openFitting,openBigMap,PREFS};
start();

}
