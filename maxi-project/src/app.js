// Основное приложение: галерея ТРЦ, управление, магазины изнутри.
// Пока один большой модуль — план разбиения описан в CLAUDE.md.
import * as THREE from 'three';
import {mulberry,shade} from './utils.js';
import {SITES,siteOf,mapsOf,DEPT,deptsFor,PALETTE,catalogOf,fmtPrice} from './shop/catalog.js';
import {iconURL} from './shop/icons.js';

export function startApp(D){

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
 tbd:{n:'Без подписи на картах',c:'#c3c9d0',h:0,k:''}
};

/* ---------- Данные ---------- */
const S=[];
D.stores.forEach(s=>S.push(Object.assign({kind:'store'},s)));
D.kiosks.forEach(k=>S.push(Object.assign({kind:'kiosk',c:k.p,area:Math.round(k.w*k.h)},k)));
S.forEach((s,i)=>{s.id=i;if(!s.name)s.name=s.kind==='kiosk'?'Островок':'Помещение без подписи';});
S.forEach(s=>{const v=(s.id*37)%21-10,w=(s.id*53)%7-3;
 const c=new THREE.Color();if(s.cat==='tbd')c.setHSL(210/360,0.08,0.80+w*0.012);else c.setHSL((((CATS[s.cat].h+v)%360)+360)%360/360,0.55,0.55+w*0.03);
 s.colHex='#'+c.getHexString();s.col=c.clone().convertSRGBToLinear();});

// проходимость
const GR=D.grid,CELL=GR.cell,GW=GR.W,GH=GR.H;
const raw=atob(GR.b64);const walk=new Uint8Array(GW*GH);
for(let i=0;i<raw.length;i++){const b=raw.charCodeAt(i);for(let k=0;k<8;k++){const j=i*8+k;if(j<walk.length)walk[j]=(b>>(7-k))&1;}}
const toPx=(x,z)=>[Math.floor((x-GR.x0)/CELL),Math.floor((z-GR.z0)/CELL)];
const fromPx=(i,j)=>[GR.x0+(i+.5)*CELL,GR.z0+(j+.5)*CELL];
function isWalkPx(i,j){return i>=0&&j>=0&&i<GW&&j<GH&&walk[j*GW+i]===1;}
function isWalk(x,z){const p=toPx(x,z);return isWalkPx(p[0],p[1]);}
const baseWalk=walk.slice();function isFloor(x,z){const [i,j]=toPx(x,z);return i>=0&&j>=0&&i<GW&&j<GH&&baseWalk[j*GW+i]===1;}
function setRect(cx,cz,a,hl,hw,val){const ca=Math.cos(a),sa=Math.sin(a),r=Math.hypot(hl,hw)/CELL+1;const [pi,pj]=toPx(cx,cz);
 for(let j=Math.floor(pj-r);j<=pj+r;j++)for(let i=Math.floor(pi-r);i<=pi+r;i++){if(i<0||j<0||i>=GW||j>=GH)continue;const [x,z]=fromPx(i,j);const dx=x-cx,dz=z-cz;const lx=dx*ca+dz*sa,lz=-dx*sa+dz*ca;if(Math.abs(lx)<=hl&&Math.abs(lz)<=hw)walk[j*GW+i]=val;}}
function blockRect(cx,cz,a,hl,hw){const ca=Math.cos(a),sa=Math.sin(a),r=Math.hypot(hl,hw)/CELL+1;const [pi,pj]=toPx(cx,cz);
 for(let j=Math.floor(pj-r);j<=pj+r;j++)for(let i=Math.floor(pi-r);i<=pi+r;i++){if(i<0||j<0||i>=GW||j>=GH)continue;const [x,z]=fromPx(i,j);const dx=x-cx,dz=z-cz;const lx=dx*ca+dz*sa,lz=-dx*sa+dz*ca;if(Math.abs(lx)<=hl&&Math.abs(lz)<=hw)walk[j*GW+i]=0;}}
function nearestFree(x,z,maxR){const [pi,pj]=toPx(x,z);
 for(let r=0;r<(maxR||80);r++){let best=null,bd=1e9;for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const [cx,cz]=fromPx(pi+dx,pj+dy);if(!blocked(cx,cz)){const d=dx*dx+dy*dy;if(d<bd){bd=d;best=[cx,cz];}}}if(best)return best;}return null;}

/* ---------- Рендер ---------- */
const canvas=$('c');
const coarse=matchMedia('(pointer:coarse)').matches;
const renderer=new THREE.WebGLRenderer({canvas,antialias:!coarse,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,coarse?1.5:2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=0.98;
renderer.physicallyCorrectLights=false;
const scene=new THREE.Scene();
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
scene.add(new THREE.HemisphereLight(LIN('#ffffff'),LIN('#bfb4a4'),0.55));
const sun=new THREE.DirectionalLight(LIN('#fff4e6'),0.55);sun.position.set(-80,160,-60);scene.add(sun);
// небо
{const sky=new THREE.Mesh(new THREE.SphereGeometry(1800,32,16),new THREE.MeshBasicMaterial({side:THREE.BackSide,depthWrite:false,fog:false,map:canvasTex(16,256,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#6f9cc9');gr.addColorStop(.45,'#a9c7e2');gr.addColorStop(.5,'#dde6ec');gr.addColorStop(1,'#c9ccce');g.fillStyle=gr;g.fillRect(0,0,w,h);})}));scene.add(sky);}

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
const shelfAtlas=canvasTex(1024,256*shelfRows,(g)=>{
 catKeys.forEach((k,idx)=>{const ox=(idx%4)*256,oy=Math.floor(idx/4)*256,col=CATS[k].c,r=mulberry(idx*131+7);
  g.save();g.translate(ox,oy);g.beginPath();g.rect(0,0,256,256);g.clip();
  const gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,'#fbf8f2');gr.addColorStop(1,'#e2dccf');g.fillStyle=gr;g.fillRect(0,0,256,256);
  g.fillStyle=shade(col,.82);g.fillRect(0,0,256,26);
  if(k==='tbd'){g.fillStyle='#dcd8d0';g.fillRect(0,0,256,256);g.strokeStyle='rgba(0,0,0,.08)';for(let x=0;x<256;x+=32){g.beginPath();g.moveTo(x,0);g.lineTo(x,256);g.stroke();}}
  else if(k==='fashion'||k==='kids'||k==='sport'){for(let rack=0;rack<2;rack++){const y=62+rack*78;g.fillStyle='#8b8f94';g.fillRect(6,y,244,3);let x=12;while(x<240){const w=7+r()*9,h=40+r()*26;const c=shade(col,(r()-.5)*1.3);const gg=g.createLinearGradient(x,0,x+w,0);gg.addColorStop(0,shade(c,-.25));gg.addColorStop(.5,c);gg.addColorStop(1,shade(c,-.3));g.fillStyle=gg;rr(g,x,y+3,w,h,3);g.fill();x+=w+1.5;}}}
  else if(k==='food'){g.fillStyle='#3a332c';g.fillRect(14,40,228,56);g.fillStyle='rgba(255,240,210,.85)';for(let i=0;i<3;i++){g.fillRect(28+i*72,52,56,4);g.fillRect(28+i*72,62,40,3);g.fillRect(28+i*72,72,48,3);}
   g.fillStyle='#b98b5e';g.fillRect(0,160,256,96);g.fillStyle='#d8b690';g.fillRect(0,160,256,8);for(let i=0;i<6;i++){g.fillStyle=shade(col,(r()-.5));g.beginPath();g.arc(24+i*42,150,10,0,7);g.fill();}}
  else if(k==='tech'){g.fillStyle='#f4f4f2';g.fillRect(0,40,256,216);for(let row=0;row<3;row++){g.fillStyle='#d4d4d0';g.fillRect(8,96+row*56,240,4);for(let i=0;i<8;i++){const x=14+i*30,y=56+row*56;g.fillStyle='#16181b';rr(g,x,y,20,36,4);g.fill();g.fillStyle=shade(col,.2+r()*.5);rr(g,x+2,y+3,16,28,2);g.fill();}}}
  else if(k==='furn'){g.fillStyle='#d9cdbd';g.fillRect(0,196,256,60);for(let i=0;i<2;i++){const x=12+i*124,y=118;const c=shade(col,(r()-.5)*.6);g.fillStyle=shade(c,-.15);rr(g,x,y,110,70,12);g.fill();g.fillStyle=c;rr(g,x+6,y+34,98,32,10);g.fill();}}
  else if(k==='beauty'||k==='acc'||k==='gifts'){for(let row=0;row<4;row++){const y=50+row*48;g.fillStyle='rgba(255,255,255,.9)';g.fillRect(6,y+34,244,4);g.fillStyle='rgba(0,0,0,.08)';g.fillRect(6,y+38,244,3);for(let x=12;x<244;x+=10){const h=8+r()*22;g.fillStyle=shade(col,(r()-.5)*1.1);g.fillRect(x,y+34-h,7,h);g.fillStyle='rgba(255,255,255,.35)';g.fillRect(x+1,y+34-h,2,h);}}}
  else{for(let row=0;row<3;row++){const y=56+row*60;g.fillStyle='#cfc8bb';g.fillRect(0,y+44,256,6);let x=6;while(x<248){const w=12+r()*26,h=18+r()*28;g.fillStyle=shade(col,(r()-.5)*.9);g.fillRect(x,y+44-h,w,h);x+=w+3;}}}
  // мягкая виньетка
  const vg=g.createRadialGradient(128,110,40,128,128,200);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(40,30,20,.28)');g.fillStyle=vg;g.fillRect(0,0,256,256);
  g.restore();});
});
function shelfUV(cat){const idx=catKeys.indexOf(cat);const cx=idx%4,cy=Math.floor(idx/4);return[cx/4+.004,1-(cy+1)/shelfRows+.004,(cx+1)/4-.004,1-cy/shelfRows-.004];}
// мраморная плитка пола
const marble=canvasTex(1024,1024,(g,w,h)=>{const r=mulberry(11);
 const tiles=4,ts=w/tiles;
 for(let i=0;i<tiles;i++)for(let j=0;j<tiles;j++){const b=236+Math.floor(r()*8);g.fillStyle=`rgb(${b},${b-4},${b-11})`;g.fillRect(i*ts,j*ts,ts,ts);
  for(let v=0;v<5;v++){g.beginPath();let x=i*ts+r()*ts,y=j*ts;g.moveTo(x,y);for(let s=0;s<14;s++){x+=(r()-.5)*40;y+=ts/14;g.lineTo(x,y);}g.strokeStyle=`rgba(150,140,125,${0.05+r()*0.08})`;g.lineWidth=0.6+r()*1.6;g.stroke();}
  for(let s=0;s<260;s++){g.fillStyle=`rgba(120,110,95,${r()*0.05})`;g.fillRect(i*ts+r()*ts,j*ts+r()*ts,2+r()*5,2+r()*5);}}
 g.strokeStyle='rgba(120,112,100,.45)';g.lineWidth=2;for(let i=0;i<=tiles;i++){g.beginPath();g.moveTo(i*ts,0);g.lineTo(i*ts,h);g.moveTo(0,i*ts);g.lineTo(w,i*ts);g.stroke();}
});
marble.wrapS=marble.wrapT=THREE.RepeatWrapping;
// тень у основания витрин
const aoTex=canvasTex(8,64,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(0,0,0,.30)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
const blobTex=canvasTex(64,64,(g,w,h)=>{const gr=g.createRadialGradient(32,32,2,32,32,32);gr.addColorStop(0,'rgba(0,0,0,.35)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});

const CW_=512,CH_=64,PER=4*32;const signAtlases=[],labelAtlases=[];
function buildAtlases(){
 for(let a=0;a*PER<S.length;a++){
  const list=S.slice(a*PER,(a+1)*PER);
  // вывеска: светящиеся буквы на фризе
  signAtlases.push(canvasTex(2048,2048,(g)=>{list.forEach((s,i)=>{const x=(i%4)*CW_,y=Math.floor(i/4)*CH_;
   g.fillStyle=s.cat==='tbd'?'#d9d6d0':'#26292d';g.fillRect(x,y,CW_,CH_);
   if(s.cat!=='tbd'){g.fillStyle=CATS[s.cat].c;g.fillRect(x,y+CH_-5,CW_,5);}
   g.textAlign='center';g.textBaseline='middle';fitFont(g,s.name,CW_-40,40,800);
   if(s.cat!=='tbd'){g.shadowColor='rgba(255,250,235,.8)';g.shadowBlur=10;g.fillStyle='#fffaf0';}else{g.fillStyle='#8c96a0';}
   g.fillText(s.name,x+CW_/2,y+CH_/2);g.shadowBlur=0;
   s.atlas=a;s.uv=[x/2048+.001,1-(y+CH_)/2048+.002,(x+CW_)/2048-.001,1-y/2048-.002];});}));
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
let voidPolys=D.voids;
function inPoly(v,x,z){let ins=false;for(let i=0,j=v.length-1;i<v.length;j=i++){const a=v[i],b=v[j];if(((a[1]>z)!==(b[1]>z))&&(x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1]+1e-9)+a[0]))ins=!ins;}return ins;}
function inVoid(x,z){for(const v of voidPolys)if(inPoly(v,x,z))return true;return false;}
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
function updateDoors(){const L=world.leaves,H=world.handles;if(!L)return;
 world.doors.forEach((s,i)=>{const d=s.door,half=d.w/2,o=d.open;
  [-1,1].forEach((sg,k)=>{const off=sg*(half/2+o*half*0.92);_dp.copy(d.c).addScaledVector(d.R,off).addScaledVector(d.n,0.06);
   _dq.setFromAxisAngle(_dY,Math.atan2(d.n.x,d.n.z));_ds.set(half,1,1);mtx.compose(_dp,_dq,_ds);L.setMatrixAt(i*2+k,mtx);
   _dp.copy(d.c).addScaledVector(d.R,sg*(0.12+o*half*0.92)).addScaledVector(d.n,0.06);_ds.set(1,1,1);mtx.compose(_dp,_dq,_ds);H.setMatrixAt(i*2+k,mtx);});});
 L.instanceMatrix.needsUpdate=true;H.instanceMatrix.needsUpdate=true;}
function humanParts(){
 const torso=new THREE.CylinderGeometry(0.19,0.15,0.62,12);torso.translate(0,1.36,0);
 const hips=new THREE.CylinderGeometry(0.16,0.17,0.2,12);hips.translate(0,0.98,0);
 const l1=new THREE.CylinderGeometry(0.075,0.06,0.9,8);l1.translate(-0.09,0.47,0);const l2=l1.clone();l2.translate(0.18,0,0);
 const a1=new THREE.CylinderGeometry(0.05,0.045,0.62,8);a1.translate(-0.24,1.32,0);const a2=a1.clone();a2.translate(0.48,0,0);
 const head=new THREE.SphereGeometry(0.11,14,10);head.scale(1,1.15,1.05);head.translate(0,1.83,0);
 const neck=new THREE.CylinderGeometry(0.045,0.05,0.1,8);neck.translate(0,1.7,0);
 const merge=(gs)=>{const m=new Merger();gs.forEach(g=>m.add(g));const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(m.p,3));bg.setAttribute('normal',new THREE.Float32BufferAttribute(m.n,3));return bg;};
 return{torso:merge([torso,hips]),legs:merge([l1,l2]),arms:merge([a1,a2]),head:merge([head,neck])};
}
function build(){
 const bpoly=D.bld.reduce((a,b)=>b.length>a.length?b:a,D.bld[0]);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(3000,3000),new THREE.MeshStandardMaterial({color:LIN('#7d8388'),roughness:.95}));ground.rotation.x=-Math.PI/2;ground.position.y=-0.06;scene.add(ground);
 // пол: полированный мрамор
 const fg=flatShape(bpoly,0.01);
 {const P=fg.attributes.position.array,U=new Float32Array(P.length/3*2);for(let i=0;i<P.length/3;i++){U[i*2]=P[i*3]/4.8;U[i*2+1]=P[i*3+2]/4.8;}fg.setAttribute('uv',new THREE.BufferAttribute(U,2));}
 const floor=new THREE.Mesh(fg,new THREE.MeshStandardMaterial({map:marble,roughness:.16,metalness:0,envMapIntensity:.55}));scene.add(floor);
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

 // ---- магазины
 const tint=new Merger(),walls=new Merger(),up=new Merger(),interior=new Merger(),inWalls=new Merger(),inFloor=new Merger(),inCeil=new Merger(),lights=new Merger(),glass=new Merger(),mull=new Merger(),ao=new Merger();
 const signs=signAtlases.map(()=>new Merger()),labels=labelAtlases.map(()=>new Merger());
 const FASCIA=LIN('#e6e2db'),SIDEC=LIN('#efece6'),WOOD=LIN('#c9ad8a'),CEIL=LIN('#f4f3f0');
 const fixtures=[],mannequins=[],doors=[],mats=new Merger();world.doors=doors;
 S.forEach(s=>{
  if(s.kind!=='store')return;
  // крыша помещения (цвет для вида сверху)
  try{tint.add(flatShape(s.poly,FLOOR_H+0.02+Math.max(0,(3000-s.area))/3000*0.03),()=>s.col,s.id);}catch(e){}
  const upCol=s.col.clone().lerp(new THREE.Color(1,1,1),0.35),wallCol=s.col.clone().multiplyScalar(0.8),inCol=s.col.clone().lerp(new THREE.Color(1,1,1),0.45);
  up.add(extrude(shapeOf(s.poly),FLOOR_H+SLAB,UP_H),()=>upCol,s.id);
  const P=s.poly;let best=null;
  const depth0=Math.max(1.6,Math.min(5,Math.sqrt(s.area)*0.45));
  // главная витрина (самая длинная сторона в коридор) — в ней будет вход
  let doorEdge=-1,doorL=0;
  if(s.cat!=='tbd'){for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<2.6)continue;const tx=(b[0]-a[0])/L,tz=(b[1]-a[1])/L,mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
   const w1=isFloor(mx-tz*0.7,mz+tx*0.7),w2=isFloor(mx+tz*0.7,mz-tx*0.7);if(w1!==w2&&L>doorL){doorL=L;doorEdge=i;}}}
  const DW=Math.min(2.8,doorL*0.45);
  for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];const A=new V3(a[0],0,a[1]),B=new V3(b[0],0,b[1]);const L=A.distanceTo(B);if(L<0.05)continue;
   const t=new V3().subVectors(B,A).divideScalar(L);let n=new V3(-t.z,0,t.x);const mid=A.clone().lerp(B,.5);
   const isDoor=i===doorEdge,du0=L/2-DW/2,du1=L/2+DW/2;
   const w1=L>=0.9&&isFloor(mid.x+n.x*0.7,mid.z+n.z*0.7),w2=L>=0.9&&isFloor(mid.x-n.x*0.7,mid.z-n.z*0.7);
   if(w1===w2){ // глухая стена между помещениями / наружу
    if(!(L<0.05)){const nn=new V3(-t.z,0,t.x);walls.panel(mid,nn,L,0,FLOOR_H,[0,0,1,1],wallCol,s.id);walls.panel(mid,nn.clone().negate(),L,0,FLOOR_H,[0,0,1,1],wallCol,s.id);}
    continue;}
   if(w2)n.negate();
   const pieces=Math.max(1,Math.round(L/5));const pw=L/pieces;
   for(let k=0;k<pieces;k++){const c=A.clone().lerp(B,(k+.5)/pieces);
    // глубина интерьера не больше реальной глубины помещения
    let depth=depth0;{const Rt=new V3(n.z,0,-n.x);for(const f of [-0.45,0,0.45]){const o=c.clone().addScaledVector(Rt,f*pw).addScaledVector(n,-0.02);depth=Math.min(depth,rayDist(P,o.x,o.z,-n.x,-n.z)-0.15);}}
    depth=Math.max(0.5,depth);
    // фриз над витриной
    tint.panel(c.clone().addScaledVector(n,0.02),n,pw,GLASS_H,FLOOR_H,[0,0,1,1],s.col,s.id);
    // стекло и профили
    const u0=k*pw,u1=(k+1)*pw;const Rg=new V3(n.z,0,-n.x);
    // Rg указывает от B к A или от A к B — считаем координату вдоль ребра по t
    const segs=isDoor?[[u0,Math.min(u1,du0)],[Math.max(u0,du1),u1]].filter(q=>q[1]-q[0]>0.05):[[u0,u1]];
    segs.forEach(([q0,q1])=>{const cc=A.clone().addScaledVector(t,(q0+q1)/2).addScaledVector(n,0.02);glass.panel(cc,n,q1-q0,0.02,GLASS_H,[0,0,1,1],null,s.id);});
    if(isDoor&&u0<du1&&u1>du0){const q0=Math.max(u0,du0),q1=Math.min(u1,du1);const cc=A.clone().addScaledVector(t,(q0+q1)/2).addScaledVector(n,0.02);glass.panel(cc,n,q1-q0,2.75,GLASS_H,[0,0,1,1],null,s.id);}
    const e0=A.clone().addScaledVector(t,u0);
    if(!(isDoor&&u0>du0-0.1&&u0<du1+0.1)){mtx.makeTranslation(e0.x,GLASS_H/2,e0.z);mull.add(new THREE.BoxGeometry(0.07,GLASS_H,0.07),null,null,mtx);}
    mtx.makeRotationY(Math.atan2(n.x,n.z));mtx.setPosition(c.x+n.x*0.02,GLASS_H,c.z+n.z*0.02);mull.add(new THREE.BoxGeometry(pw,0.08,0.09),null,null,mtx);
    mtx.makeRotationY(Math.atan2(n.x,n.z));mtx.setPosition(c.x+n.x*0.03,0.06,c.z+n.z*0.03);mull.add(new THREE.BoxGeometry(pw,0.12,0.06),null,null,mtx);
    // интерьер за стеклом: задняя стена со стеллажами, боковые стены, пол, потолок со светом
    const back=c.clone().addScaledVector(n,-depth);
    interior.panel(back,n,pw,0,GLASS_H+0.3,shelfUV(s.cat),null,s.id);
    const R=new V3(n.z,0,-n.x);
    const sL=c.clone().addScaledVector(R,-pw/2).addScaledVector(n,-depth/2),sR=c.clone().addScaledVector(R,pw/2).addScaledVector(n,-depth/2);
    if(k===0)inWalls.panel(sL,R,depth,0,GLASS_H+0.3,[0,0,1,1],inCol,s.id);
    if(k===pieces-1)inWalls.panel(sR,R.clone().negate(),depth,0,GLASS_H+0.3,[0,0,1,1],inCol,s.id);
    const f0=c.clone().addScaledVector(R,-pw/2),f1=c.clone().addScaledVector(R,pw/2),b0=f0.clone().addScaledVector(n,-depth),b1=f1.clone().addScaledVector(n,-depth);
    inFloor.quad(new V3(f0.x,0.012,f0.z),new V3(f1.x,0.012,f1.z),new V3(b1.x,0.012,b1.z),new V3(b0.x,0.012,b0.z),[0,0,pw/1.2,depth/1.2],null,s.id);
    inCeil.quad(new V3(b0.x,GLASS_H+0.3,b0.z),new V3(b1.x,GLASS_H+0.3,b1.z),new V3(f1.x,GLASS_H+0.3,f1.z),new V3(f0.x,GLASS_H+0.3,f0.z),[0,0,1,1],CEIL,s.id);
    // линейные светильники
    for(let q=0;q<2;q++){const lc=c.clone().addScaledVector(n,-depth*(0.3+q*0.4));const l0=lc.clone().addScaledVector(R,-pw*0.35),l1=lc.clone().addScaledVector(R,pw*0.35);const h=0.09;
     lights.quad(new V3(l0.x-n.x*h,GLASS_H+0.28,l0.z-n.z*h),new V3(l1.x-n.x*h,GLASS_H+0.28,l1.z-n.z*h),new V3(l1.x+n.x*h,GLASS_H+0.28,l1.z+n.z*h),new V3(l0.x+n.x*h,GLASS_H+0.28,l0.z+n.z*h),[0,0,1,1]);}
    // стойки с товаром внутри
    const nearDoor=isDoor&&u0<du1+1.2&&u1>du0-1.2;
    if(!nearDoor&&(s.cat==='fashion'||s.cat==='sport'||s.cat==='kids')&&depth>1.6&&pw>2.2){const Rm=new V3(n.z,0,-n.x);[-0.25,0.25].forEach((f,mi)=>{if(pw<3.5&&mi)return;mannequins.push({x:c.x-n.x*0.9+Rm.x*f*pw,z:c.z-n.z*0.9+Rm.z*f*pw,a:Math.atan2(n.x,n.z),col:s.col});});}
    if(!nearDoor&&s.cat!=='tbd'&&depth>2.2&&pw>2.4)fixtures.push({x:c.x-n.x*depth*0.45,z:c.z-n.z*depth*0.45,a:Math.atan2(n.x,n.z),w:Math.min(1.6,pw*0.35),col:s.col,cat:s.cat});
    // мягкая тень на полу у витрины (снаружи)
    const o0=c.clone().addScaledVector(R,-pw/2),o1=c.clone().addScaledVector(R,pw/2);
    ao.quad(new V3(o1.x,0.02,o1.z),new V3(o0.x,0.02,o0.z),new V3(o0.x+n.x*0.9,0.02,o0.z+n.z*0.9),new V3(o1.x+n.x*0.9,0.02,o1.z+n.z*0.9),[0,1,1,0]);
   }
   if(isDoor){const dc=A.clone().addScaledVector(t,L/2);s.door={c:dc,n:n.clone(),R:new V3(n.z,0,-n.x),w:DW,open:0};doors.push(s);
    // рамка проёма, ригель над дверью, коврик
    [-1,1].forEach(sg=>{const pp=dc.clone().addScaledVector(s.door.R,sg*DW/2);mtx.makeTranslation(pp.x+n.x*0.03,GLASS_H/2,pp.z+n.z*0.03);mull.add(new THREE.BoxGeometry(0.12,GLASS_H,0.12),null,null,mtx);});
    mtx.makeRotationY(Math.atan2(n.x,n.z));mtx.setPosition(dc.x+n.x*0.03,2.7,dc.z+n.z*0.03);mull.add(new THREE.BoxGeometry(DW+0.1,0.1,0.14),null,null,mtx);
    const m0=dc.clone().addScaledVector(s.door.R,-DW/2),m1=dc.clone().addScaledVector(s.door.R,DW/2);
    mats.quad(new V3(m1.x+n.x*0.05,0.022,m1.z+n.z*0.05),new V3(m0.x+n.x*0.05,0.022,m0.z+n.z*0.05),new V3(m0.x+n.x*1.3,0.022,m0.z+n.z*1.3),new V3(m1.x+n.x*1.3,0.022,m1.z+n.z*1.3),[0,0,1,1]);}
   if(!best||L>best.L)best={L,mid,n,t};}
  if(best){s.fp=best.mid.clone().addScaledVector(best.n,0.02);s.fn=best.n.clone();
   const sw=Math.min(best.L-0.5,Math.max(2.6,Math.min(13,s.name.length*0.8+2))),sh=Math.min(1.5,sw/7);
   signs[s.atlas].panel(s.fp.clone().addScaledVector(best.n,0.05),best.n,sw,(GLASS_H+FLOOR_H)/2-sh/2,(GLASS_H+FLOOR_H)/2+sh/2,s.uv,null,s.id);}
  // подпись для вида сверху
  if(s.cat!=='tbd'&&s.lfs){const fs=s.lfs,ta=s.ltw/(fs*1.1);const ks=Object.keys(s.fit).map(Number).sort((a,b)=>a-b);
   let h=0,ang=0;for(const k of ks){if(k>=ta){[h,ang]=s.fit[k];break;}}
   if(!h){const k=ks[ks.length-1];h=s.fit[k][0]*k/ta;ang=s.fit[k][1];}
   h=Math.max(0.35,Math.min(3.4,h));
   const cellW=h*CW_/(fs*1.1),cellH=h*CH_/(fs*1.1);const U=new V3(Math.cos(ang),0,Math.sin(ang)),Vv=new V3(-Math.sin(ang),0,Math.cos(ang));
   const c=new V3(s.lp[0],FLOOR_H+0.08,s.lp[1]);const P0=(u,v)=>c.clone().addScaledVector(U,u).addScaledVector(Vv,v);
   labels[s.atlas].quad(P0(-cellW/2,cellH/2),P0(cellW/2,cellH/2),P0(cellW/2,-cellH/2),P0(-cellW/2,-cellH/2),s.uv,null,s.id);}
 });
 const tintMesh=tint.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6,side:THREE.DoubleSide}));G('stores').add(tintMesh);pickables.push(tintMesh);world.tintMesh=tintMesh;world.tintColors=tintMesh.geometry.attributes.color.array.slice();
 G('stores').add(walls.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7})));
 const inTex=interior.mesh(new THREE.MeshStandardMaterial({map:shelfAtlas,roughness:.8}));G('stores').add(inTex);pickables.push(inTex);
 G('stores').add(inWalls.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85})));
 const wood=canvasTex(256,256,(g,w,h)=>{const r=mulberry(9);g.fillStyle='#cdb190';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=32){g.fillStyle=`rgba(90,60,30,${.05+r()*.06})`;g.fillRect(0,y,w,32);g.fillStyle='rgba(80,50,20,.25)';g.fillRect(0,y,w,1);for(let i=0;i<14;i++){g.fillStyle=`rgba(120,80,40,${r()*.08})`;g.fillRect(0,y+r()*32,w,1);}}});
 wood.wrapS=wood.wrapT=THREE.RepeatWrapping;
 G('stores').add(inFloor.mesh(new THREE.MeshStandardMaterial({map:wood,roughness:.35})));
 G('stores').add(inCeil.mesh(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9})));
 G('stores').add(lights.mesh(MAT.light));
 const glassMesh=glass.mesh(MAT.glass);glassMesh.renderOrder=2;G('stores').add(glassMesh);pickables.push(glassMesh);
 G('stores').add(mull.mesh(MAT.darkMetal));
 const aoMesh=ao.mesh(new THREE.MeshBasicMaterial({map:aoTex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));G('stores').add(aoMesh);
 G('stores').add(mats.mesh(new THREE.MeshStandardMaterial({color:LIN('#2c2f33'),roughness:.95,polygonOffset:true,polygonOffsetFactor:-2})));
 {const lg=new THREE.BoxGeometry(1,2.62,0.04);lg.translate(0,1.33,0);const N=Math.max(1,doors.length*2);
  const leaves=new THREE.InstancedMesh(lg,MAT.glass,N);leaves.renderOrder=2;
  world.leaves=leaves;G('stores').add(leaves);
  doors.forEach(s=>{const d=s.door;const c=d.c.clone().addScaledVector(d.n,-0.2);setRect(c.x,c.z,Math.atan2(d.R.z,d.R.x),d.w/2-0.25,0.75,1);});
  const hG=new THREE.BoxGeometry(0.03,0.5,0.06);hG.translate(0,1.1,0.05);const handles=new THREE.InstancedMesh(hG,MAT.metal,N);world.handles=handles;G('stores').add(handles);
  const ids=[];doors.forEach(s=>{ids.push(s.id,s.id);});leaves.userData.kiosks=ids;pickables.push(leaves);updateDoors(0);}
 signs.forEach((m,i)=>{if(!m.p.length)return;const mesh=m.mesh(new THREE.MeshBasicMaterial({map:signAtlases[i],toneMapped:false}));G('stores').add(mesh);pickables.push(mesh);});
 labels.forEach((m,i)=>{if(!m.p.length)return;const mesh=m.mesh(new THREE.MeshBasicMaterial({map:labelAtlases[i],transparent:true,depthWrite:false,toneMapped:false}));mesh.renderOrder=3;G('toplabels').add(mesh);pickables.push(mesh);});
 G('toplabels').visible=false;
 // стойки с товаром внутри магазинов
 {const tg=new THREE.BoxGeometry(1,0.9,0.7);tg.translate(0,0.45,0);const top=new THREE.BoxGeometry(1,0.5,0.5);top.translate(0,1.15,0);
  const im1=new THREE.InstancedMesh(tg,new THREE.MeshStandardMaterial({color:LIN('#ece7df'),roughness:.5}),Math.max(1,fixtures.length));
  const im2=new THREE.InstancedMesh(top,new THREE.MeshStandardMaterial({roughness:.6}),Math.max(1,fixtures.length));
  const q=new THREE.Quaternion(),sc=new V3();
  fixtures.forEach((f,i)=>{q.setFromAxisAngle(new V3(0,1,0),f.a);sc.set(f.w,1,1);mtx.compose(new V3(f.x,0,f.z),q,sc);im1.setMatrixAt(i,mtx);
   sc.set(f.w*0.85,1,1);mtx.compose(new V3(f.x,0,f.z),q,sc);im2.setMatrixAt(i,mtx);im2.setColorAt(i,f.col);});
  if(im2.instanceColor)im2.instanceColor.needsUpdate=true;G('stores').add(im1);G('stores').add(im2);}
 {// манекены в витринах магазинов одежды
  const parts=humanParts();const N=Math.max(1,mannequins.length);const q=new THREE.Quaternion();
  const white=new THREE.MeshStandardMaterial({color:LIN('#f1efeb'),roughness:.25,metalness:.05});
  const torso=new THREE.InstancedMesh(parts.torso,new THREE.MeshStandardMaterial({roughness:.7}),N),legs=new THREE.InstancedMesh(parts.legs,white,N),head=new THREE.InstancedMesh(parts.head,white,N),arms=new THREE.InstancedMesh(parts.arms,white,N),stand=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22,0.22,0.03,16).translate(0,0.015,0),MAT.darkMetal,N);
  mannequins.forEach((m,i)=>{q.setFromAxisAngle(new V3(0,1,0),m.a);mtx.compose(new V3(m.x,0,m.z),q,new V3(1,1,1));[torso,legs,head,arms,stand].forEach(o=>o.setMatrixAt(i,mtx));torso.setColorAt(i,m.col.clone().multiplyScalar(0.85));});
  if(torso.instanceColor)torso.instanceColor.needsUpdate=true;[torso,legs,head,arms,stand].forEach(o=>G('stores').add(o));}
 // верхний этаж: фасады с витринами
 const facade=canvasTex(512,256,(g,w,h)=>{g.fillStyle='#f2f0ec';g.fillRect(0,0,w,h);const r=mulberry(4);
  for(let i=0;i<4;i++){const x=i*128;const gr=g.createLinearGradient(0,0,0,170);gr.addColorStop(0,'#f6ead3');gr.addColorStop(1,'#c9b9a0');g.fillStyle=gr;g.fillRect(x+6,6,116,164);
   for(let s=0;s<10;s++){g.fillStyle=`hsla(${r()*360},35%,${45+r()*25}%,.8)`;g.fillRect(x+12+r()*96,60+r()*90,6+r()*10,14+r()*30);}
   g.fillStyle='rgba(255,255,255,.18)';g.fillRect(x+20,6,18,164);g.fillStyle='#4a4f55';g.fillRect(x,0,6,176);}
  g.fillStyle='#2f3337';g.fillRect(0,176,w,34);g.fillStyle='#e4e0d8';g.fillRect(0,210,w,46);});
 facade.wrapS=facade.wrapT=THREE.RepeatWrapping;facade.repeat.set(1/8,1/UP_H);facade.offset.set(0,(UP_H-1)/UP_H);
 G('upper').add(up.mesh(new THREE.MeshStandardMaterial({map:facade,vertexColors:true,roughness:.5,envMapIntensity:.6})));

 // ---- галерея второго этажа
 const slabMat=new THREE.MeshStandardMaterial({color:LIN('#fbfbfa'),roughness:.6});
 G('upper').add(new THREE.Mesh(extrude(shapeOf(bpoly,voidPolys),FLOOR_H,SLAB),slabMat));
 const upFloor=flatShape(bpoly,FLOOR_H+SLAB+0.01);{const P=upFloor.attributes.position.array,U=new Float32Array(P.length/3*2);for(let i=0;i<P.length/3;i++){U[i*2]=P[i*3]/4.8;U[i*2+1]=P[i*3+2]/4.8;}upFloor.setAttribute('uv',new THREE.BufferAttribute(U,2));}
 // потолок первого этажа: белый с встроенными светильниками
 const ceilTex=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#f6f6f4';g.fillRect(0,0,w,h);g.strokeStyle='rgba(0,0,0,.05)';g.strokeRect(0,0,w,h);});
 const roofMat=new THREE.MeshStandardMaterial({color:LIN('#f3f3f1'),roughness:1});
 G('upper').add(new THREE.Mesh(extrude(shapeOf(bpoly,voidPolys),ROOF_Y,0.6),roofMat));
 // стеклянная крыша с фермами
 const skyG=new THREE.MeshStandardMaterial({color:LIN('#dbe8f2'),transparent:true,opacity:.35,roughness:.05,metalness:.5,side:THREE.DoubleSide,depthWrite:false});
 const truss=new Merger();
 voidPolys.forEach(v=>{const m=new THREE.Mesh(flatShape(v,ROOF_Y+0.55),skyG);G('upper').add(m);
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;v.forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[1]);z1=Math.max(z1,p[1]);});
  const along=(x1-x0)>(z1-z0);const step=3.2;
  if(along){for(let x=x0+step/2;x<x1;x+=step){let a=null,b=null;for(let z=z0;z<=z1;z+=0.5){if(inPoly(v,x,z)){if(a===null)a=z;b=z;}}if(a!==null&&b-a>1){mtx.makeTranslation(x,ROOF_Y+0.4,(a+b)/2);truss.add(new THREE.BoxGeometry(0.12,0.3,b-a),null,null,mtx);}}}
  else{for(let z=z0+step/2;z<z1;z+=step){let a=null,b=null;for(let x=x0;x<=x1;x+=0.5){if(inPoly(v,x,z)){if(a===null)a=x;b=x;}}if(a!==null&&b-a>1){mtx.makeTranslation((a+b)/2,ROOF_Y+0.4,z);truss.add(new THREE.BoxGeometry(b-a,0.3,0.12),null,null,mtx);}}}});
 G('upper').add(truss.mesh(MAT.white));
 // ограждение: стекло, стойки, поручень; светодиодная линия под кромкой
 const rail=new Merger(),hand=new Merger(),led=new Merger();const posts=[];
 voidPolys.forEach(v=>{let acc=0;for(let i=0;i<v.length;i++){const a=v[i],b=v[(i+1)%v.length];const A=new V3(a[0],0,a[1]),B=new V3(b[0],0,b[1]);const L=A.distanceTo(B);if(L<0.05)continue;
  const y0=FLOOR_H+SLAB,y1=y0+1.05;rail.quad(new V3(A.x,y0+0.05,A.z),new V3(B.x,y0+0.05,B.z),new V3(B.x,y1,B.z),new V3(A.x,y1,A.z),[0,0,1,1]);
  const ry=-Math.atan2(B.z-A.z,B.x-A.x);
  const m1=new THREE.Matrix4().makeRotationY(ry);m1.setPosition((A.x+B.x)/2,y1+0.03,(A.z+B.z)/2);hand.add(new THREE.CylinderGeometry(0.035,0.035,L,8).rotateZ(Math.PI/2),null,null,m1);
  const m2=new THREE.Matrix4().makeRotationY(ry);m2.setPosition((A.x+B.x)/2,FLOOR_H+0.25,(A.z+B.z)/2);hand.add(new THREE.BoxGeometry(L,0.52,0.06),null,null,m2);
  const n=new V3(-(B.z-A.z)/L,0,(B.x-A.x)/L);const m3=new THREE.Matrix4().makeRotationY(ry);m3.setPosition((A.x+B.x)/2,FLOOR_H-0.02,(A.z+B.z)/2);led.add(new THREE.BoxGeometry(L,0.04,0.1),null,null,m3);
  let d=(1.6-acc%1.6);while(d<L){posts.push(A.clone().lerp(B,d/L));d+=1.6;}acc+=L;}});
 const railMesh=rail.mesh(new THREE.MeshStandardMaterial({color:LIN('#cfe3ea'),transparent:true,opacity:.22,roughness:.04,metalness:.6,depthWrite:false,side:THREE.DoubleSide}));railMesh.renderOrder=2;G('upper').add(railMesh);
 G('upper').add(hand.mesh(MAT.metal));G('upper').add(led.mesh(MAT.light));
 {const pg=new THREE.CylinderGeometry(0.025,0.025,1.05,6);pg.translate(0,FLOOR_H+SLAB+0.52,0);const pi=new THREE.InstancedMesh(pg,MAT.metal,Math.max(1,posts.length));posts.forEach((p,i)=>{mtx.makeTranslation(p.x,0,p.z);pi.setMatrixAt(i,mtx);});G('upper').add(pi);}
 // колонны — только в атриумах, на перекрёстках и у эскалаторов
 {const colG=new THREE.CylinderGeometry(0.42,0.42,ROOF_Y,24);colG.translate(0,ROOF_Y/2,0);const baseG=new THREE.CylinderGeometry(0.55,0.55,0.12,24);baseG.translate(0,0.06,0);
  const cols=new THREE.InstancedMesh(colG,new THREE.MeshStandardMaterial({color:LIN('#fafaf8'),roughness:.25,envMapIntensity:.7}),Math.max(1,D.cols.length));
  const bases=new THREE.InstancedMesh(baseG,MAT.metal,Math.max(1,D.cols.length));
  D.cols.forEach((p,i)=>{mtx.makeTranslation(p[0],0,p[1]);cols.setMatrixAt(i,mtx);bases.setMatrixAt(i,mtx);blockRect(p[0],p[1],0,0.55,0.55);});G('upper').add(cols);G('upper').add(bases);}
 // светильники-кольца
 {const ringsLow=[],ringsHigh=[];const st=Math.round(6.5/CELL);
  for(let j=2;j<GH;j+=st)for(let i=2;i<GW;i+=st){if(!isWalkPx(i,j))continue;const [x,z]=fromPx(i,j);if(inVoid(x,z)){if(((i+j)/st)%2===0)ringsHigh.push([x,z]);}else ringsLow.push([x,z]);}
  const rg1=new THREE.TorusGeometry(0.9,0.05,6,40);rg1.rotateX(Math.PI/2);const r1=new THREE.InstancedMesh(rg1,MAT.light,Math.max(1,ringsLow.length));ringsLow.forEach((p,i)=>{mtx.makeTranslation(p[0],FLOOR_H-0.04,p[1]);r1.setMatrixAt(i,mtx);});G('upper').add(r1);
  const rg2=new THREE.TorusGeometry(2.2,0.1,6,56);rg2.rotateX(Math.PI/2);const r2=new THREE.InstancedMesh(rg2,MAT.light,Math.max(1,ringsHigh.length));ringsHigh.forEach((p,i)=>{mtx.makeTranslation(p[0],ROOF_Y-0.8,p[1]);r2.setMatrixAt(i,mtx);});G('upper').add(r2);
  // пятна света на полу под кольцами
  const spot=canvasTex(64,64,(g,w,h)=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,250,235,.22)');gr.addColorStop(1,'rgba(255,250,235,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);});
  const sg=new THREE.PlaneGeometry(4.5,4.5);sg.rotateX(-Math.PI/2);const sm=new THREE.InstancedMesh(sg,new THREE.MeshBasicMaterial({map:spot,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),Math.max(1,ringsLow.length));
  ringsLow.forEach((p,i)=>{mtx.makeTranslation(p[0],0.03,p[1]);sm.setMatrixAt(i,mtx);});G('upper').add(sm);}

 // ---- фасад и входы
 const wallM=new Merger();const entP=D.ents.map(e=>new V3(e.p[0],0,e.p[1]));
 const facadeOut=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#d4d0c8';g.fillRect(0,0,w,h);g.strokeStyle='rgba(0,0,0,.12)';g.lineWidth=2;for(let x=0;x<=w;x+=64){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}for(let y=0;y<=h;y+=128){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}});
 facadeOut.wrapS=facadeOut.wrapT=THREE.RepeatWrapping;
 D.bld.forEach(bp=>{for(let i=0;i<bp.length;i++){const a=bp[i],b=bp[(i+1)%bp.length];const A=new V3(a[0],0,a[1]),B=new V3(b[0],0,b[1]);const L=A.distanceTo(B);
  const steps=Math.max(1,Math.ceil(L/2));for(let k=0;k<steps;k++){const P0=A.clone().lerp(B,k/steps),P1=A.clone().lerp(B,(k+1)/steps),mid=P0.clone().lerp(P1,.5);
   const y0=entP.some(e=>e.distanceTo(mid)<5.5)?4.2:0;const u0=(P0.x+P0.z)/4,u1=(P1.x+P1.z)/4;wallM.quad(new V3(P0.x,y0,P0.z),new V3(P1.x,y0,P1.z),new V3(P1.x,ROOF_Y+0.6,P1.z),new V3(P0.x,ROOF_Y+0.6,P0.z),[u0,y0/4,u1,(ROOF_Y+0.6)/4]);}}});
 G('shell').add(wallM.mesh(new THREE.MeshStandardMaterial({map:facadeOut,roughness:.8,side:THREE.DoubleSide})));
 D.ents.forEach(e=>{const d=new V3(e.d[0],0,e.d[1]).normalize(),p=new V3(e.p[0],0,e.p[1]).addScaledVector(d,0.4);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(9,4.2),MAT.glass);m.position.set(p.x,2.1,p.z);m.rotation.y=Math.atan2(d.x,d.z);scene.add(m);
  const fr=new THREE.Mesh(new THREE.BoxGeometry(9.4,0.3,0.3),MAT.darkMetal);fr.position.set(p.x,4.2,p.z);fr.rotation.y=m.rotation.y;scene.add(fr);
  [-1,1].forEach(sg=>{const R=new V3(d.z,0,-d.x);const pp=p.clone().addScaledVector(R,sg*4.6);const f2=new THREE.Mesh(new THREE.BoxGeometry(0.2,4.2,0.2),MAT.darkMetal);f2.position.set(pp.x,2.1,pp.z);scene.add(f2);});
  const sp=sprite('Вход '+e.n,'#0e7490');sp.position.set(p.x-d.x*1.5,4.9,p.z-d.z*1.5);sp.scale.set(4.4,1.1,1);scene.add(sp);
  const sp2=sprite('Вход '+e.n,'#0e7490');sp2.position.set(p.x+d.x*4,FLOOR_H+3,p.z+d.z*4);sp2.scale.set(14,3.2,1);G('toponly').add(sp2);});
 G('toponly').visible=false;

 // ---- эскалаторы
 const stepTex=canvasTex(64,256,(g,w,h)=>{g.fillStyle='#50565c';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=16){g.fillStyle='#8d949a';g.fillRect(0,y,w,11);g.fillStyle='#d9b53c';g.fillRect(0,y,4,11);g.fillRect(w-4,y,4,11);}});stepTex.wrapS=stepTex.wrapT=THREE.RepeatWrapping;stepTex.repeat.set(1,4);
 const escM=new THREE.MeshStandardMaterial({color:LIN('#c3c9ce'),map:stepTex,roughness:.35,metalness:.7}),escSide=new THREE.MeshStandardMaterial({color:LIN('#dcebf1'),transparent:true,opacity:.28,roughness:.04,metalness:.5,depthWrite:false,side:THREE.DoubleSide}),railM=new THREE.MeshStandardMaterial({color:LIN('#15181b'),roughness:.5});
 const escBand=new THREE.MeshStandardMaterial({color:LIN('#7a2c5a'),roughness:.4});
 D.esc.forEach(e=>{const g=new THREE.Group();const run=9.8,rise=FLOOR_H+SLAB,ang=Math.atan2(rise,run),len=Math.hypot(run,rise);
  [-0.72,0.72].forEach(off=>{const b=new THREE.Mesh(new THREE.BoxGeometry(len,0.8,1.2),escM);b.position.set(0,rise/2,off);b.rotation.z=ang;g.add(b);
   const skirt=new THREE.Mesh(new THREE.BoxGeometry(len,0.35,1.3),escBand);skirt.position.set(0,rise/2-0.5,off);skirt.rotation.z=ang;g.add(skirt);
   [-0.62,0.62].forEach(s=>{const side=new THREE.Mesh(new THREE.PlaneGeometry(len,1.0),escSide);side.position.set(0,rise/2+0.85,off+s);side.rotation.z=ang;g.add(side);
    const hr=new THREE.Mesh(new THREE.BoxGeometry(len+0.6,0.09,0.11),railM);hr.position.set(0,rise/2+1.38,off+s);hr.rotation.z=ang;g.add(hr);});});
  g.position.set(e.p[0],0,e.p[1]);g.rotation.y=-e.a;scene.add(g);blockRect(e.p[0],e.p[1],e.a,run/2+0.4,1.55);
  const sp=sprite('Эскалатор','#6b7785');sp.position.set(e.p[0],FLOOR_H+3,e.p[1]);sp.scale.set(9,2,1);G('toponly').add(sp);});

 // ---- островки: тонкие инфо-колонны, сквозь которые можно пройти
 const kList=S.filter(s=>s.kind==='kiosk');
 {// колонна целиком в цвет магазина, светящиеся кольца, табличка с четырёх сторон наверху
  const KH=3.3;
  const bodyG=new THREE.CylinderGeometry(0.3,0.34,KH,28);bodyG.translate(0,KH/2,0);
  const ringG=new THREE.CylinderGeometry(0.315,0.315,0.1,28);
  const r1=ringG.clone().translate(0,0.9,0),r2=ringG.clone().translate(0,KH-0.25,0);
  const baseG=new THREE.CylinderGeometry(0.42,0.45,0.1,28);baseG.translate(0,0.05,0);
  const headG=new THREE.BoxGeometry(1,0.62,1);headG.translate(0,KH+0.36,0);
  const N=Math.max(1,kList.length);
  const body=new THREE.InstancedMesh(bodyG,new THREE.MeshStandardMaterial({roughness:.22,metalness:.15,envMapIntensity:1.1}),N);
  const glow=new THREE.MeshBasicMaterial({toneMapped:false});
  const ringA=new THREE.InstancedMesh(r1,glow,N),ringB=new THREE.InstancedMesh(r2,glow,N);
  const base=new THREE.InstancedMesh(baseG,MAT.darkMetal,N);
  const head=new THREE.InstancedMesh(headG,new THREE.MeshStandardMaterial({color:LIN('#1f2226'),roughness:.4,metalness:.4}),N);
  const shG=new THREE.PlaneGeometry(1.8,1.8);shG.rotateX(-Math.PI/2);const sh=new THREE.InstancedMesh(shG,new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false}),N);
  const q=new THREE.Quaternion(),sc=new V3();
  kList.forEach((s,i)=>{const c=s.cat==='tbd'?LIN('#9aa3ab'):s.col;
   mtx.makeTranslation(s.p[0],0,s.p[1]);body.setMatrixAt(i,mtx);ringA.setMatrixAt(i,mtx);ringB.setMatrixAt(i,mtx);base.setMatrixAt(i,mtx);
   body.setColorAt(i,c);const lc=c.clone().lerp(new THREE.Color(1,1,1),0.35).multiplyScalar(1.5);ringA.setColorAt(i,lc);ringB.setColorAt(i,lc);
   s.headW=Math.min(3.4,Math.max(1.5,s.name.length*0.2+0.6));sc.set(s.headW,1,s.headW);q.identity();mtx.compose(new V3(s.p[0],0,s.p[1]),q,sc);head.setMatrixAt(i,mtx);
   mtx.makeTranslation(s.p[0],0.025,s.p[1]);sh.setMatrixAt(i,mtx);});
  [body,ringA,ringB].forEach(m=>{if(m.instanceColor)m.instanceColor.needsUpdate=true;});
  const ids=kList.map(s=>s.id);[body,ringA,ringB,head].forEach(m=>{m.userData.kiosks=ids;scene.add(m);pickables.push(m);});scene.add(base);scene.add(sh);
  world.kBody=body;world.kRings=[ringA,ringB];
  // табличка с названием на четырёх гранях
  signAtlases.forEach((t,ai)=>{const m=new Merger();kList.forEach(s=>{if(s.atlas!==ai||s.cat==='tbd')return;const w=s.headW,h=Math.min(0.5,w/7),y=KH+0.36,c=new V3(s.p[0],0,s.p[1]);
    [[0,1],[0,-1],[1,0],[-1,0]].forEach(([nx,nz])=>{const n=new V3(nx,0,nz);m.panel(c.clone().addScaledVector(n,w/2+0.01),n,w*0.96,y-h/2,y+h/2,s.uv,null,s.id);});});
   if(m.p.length){const mesh=m.mesh(new THREE.MeshBasicMaterial({map:t,toneMapped:false}));scene.add(mesh);pickables.push(mesh);}});}
 kList.forEach(s=>{s.fp=new V3(s.p[0],0,s.p[1]);s.fn=new V3(0,0,1);});
 labelAtlases.forEach((t,ai)=>{const m=new Merger();kList.forEach(s=>{if(s.atlas!==ai||s.cat==='tbd'||!s.lfs)return;const h=1.0,cw=h*CW_/(s.lfs*1.1),chh=h*CH_/(s.lfs*1.1),x=s.p[0],z=s.p[1]-1.2,y=FLOOR_H+0.1;
  m.quad(new V3(x-cw/2,y,z+chh/2),new V3(x+cw/2,y,z+chh/2),new V3(x+cw/2,y,z-chh/2),new V3(x-cw/2,y,z-chh/2),s.uv,null,s.id);});
  if(m.p.length){const mesh=m.mesh(new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,toneMapped:false}));mesh.renderOrder=3;G('toplabels').add(mesh);pickables.push(mesh);}});
 {// точки островков в виде сверху
  const dg=new THREE.CircleGeometry(1.2,20);dg.rotateX(-Math.PI/2);const dm=new THREE.InstancedMesh(dg,new THREE.MeshBasicMaterial({toneMapped:false}),Math.max(1,kList.length));
  kList.forEach((s,i)=>{mtx.makeTranslation(s.p[0],FLOOR_H+0.06,s.p[1]);dm.setMatrixAt(i,mtx);dm.setColorAt(i,s.cat==='tbd'?LIN('#9aa3ab'):s.col);});if(dm.instanceColor)dm.instanceColor.needsUpdate=true;
  dm.userData.kiosks=kList.map(s=>s.id);G('toponly').add(dm);pickables.push(dm);}



 // ---- посетители: гуляют по галерее
 {const parts=humanParts();const NP=coarse?40:90;const r=mulberry(77);
  const cloth=['#2f3a4a','#6b7a8f','#8a3b3b','#3f5e4a','#c9b79c','#1f1f24','#a45a2a','#4d4f7c','#d9d4cc','#6e2f4f'].map(LIN),pants=['#23262c','#3b4252','#5a5148','#2c3440','#6b6e73'].map(LIN),skin=['#e6c3a5','#d9b08c','#c6946b','#f0d2bb'].map(LIN);
  const torso=new THREE.InstancedMesh(parts.torso,new THREE.MeshStandardMaterial({roughness:.85}),NP),legs=new THREE.InstancedMesh(parts.legs,new THREE.MeshStandardMaterial({roughness:.8}),NP),arms=new THREE.InstancedMesh(parts.arms,new THREE.MeshStandardMaterial({roughness:.85}),NP),head=new THREE.InstancedMesh(parts.head,new THREE.MeshStandardMaterial({roughness:.6}),NP);
  const shG=new THREE.PlaneGeometry(0.9,0.9);shG.rotateX(-Math.PI/2);const sh=new THREE.InstancedMesh(shG,new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false}),NP);
  const people=[];
  for(let i=0;i<NP;i++){let x=0,z=0,tries=0;do{const j=Math.floor(r()*GH),k=Math.floor(r()*GW);[x,z]=fromPx(k,j);tries++;}while((!isWalk(x,z)||blocked(x,z))&&tries<400);
   const c=cloth[Math.floor(r()*cloth.length)];torso.setColorAt(i,c);arms.setColorAt(i,c);legs.setColorAt(i,pants[Math.floor(r()*pants.length)]);head.setColorAt(i,skin[Math.floor(r()*skin.length)]);
   const sc=0.92+r()*0.16;people.push({x,z,tx:x,tz:z,sp:(1.0+r()*0.5),sc,a:r()*6.28,wait:r()*4,ph:r()*6.28});}
  [torso,legs,arms,head].forEach(m=>{if(m.instanceColor)m.instanceColor.needsUpdate=true;G('people').add(m);});G('people').add(sh);
  world.people={list:people,meshes:[torso,legs,arms,head],sh,r};}
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
let mode='walk',anim=null,filter=null,target=null;
const keys={};let joyV={x:0,y:0};const EYE=1.65;
function walkPose(){return{p:new V3(player.x,EYE,player.z),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(player.pitch,player.yaw,0,'YXZ'))};}
const dummy=new THREE.PerspectiveCamera();
function topPose(){const p=new V3(topv.x,topv.h,topv.z+0.001);dummy.position.copy(p);dummy.up.set(0,0,-1);dummy.lookAt(topv.x,0,topv.z);return{p,q:dummy.quaternion.clone()};}
function applyPose(o){cam.position.copy(o.p);cam.quaternion.copy(o.q);}
const bb=(()=>{let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;D.bld.forEach(p=>p.forEach(q=>{x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}));return{x0,x1,z0,z1};})();
function fitTop(){const t=Math.tan(THREE.MathUtils.degToRad(cam.fov/2));const hw=(bb.x1-bb.x0)/2/(t*cam.aspect),hz=(bb.z1-bb.z0)/2/t;topv.x=(bb.x0+bb.x1)/2;topv.z=(bb.z0+bb.z1)/2;topv.h=Math.min(1100,Math.max(hw,hz)*1.06);}
function setVis(){const top=mode==='top';['upper','shell'].forEach(k=>{if(world.groups[k])world.groups[k].visible=!top;});G('toplabels').visible=top;G('toponly').visible=top;world.pmark.visible=top;
 scene.fog.near=top?3000:120;scene.fog.far=top?5000:520;}
function setMode(m,opts){
 if(m===mode&&!opts)return;const from={p:cam.position.clone(),q:cam.quaternion.clone()};
 mode=m;$('bWalk').classList.toggle('on',m==='walk');$('bTop').classList.toggle('on',m==='top');
 if(m==='top'){if(!opts||!opts.keep)fitTop();setVis();}
 anim={t:0,from,m};updateJoy();if(m==='top')releaseLock();updateCross();if(target)openCard(target);
}
function updateJoy(){$('joy').hidden=!(coarse&&mode==='walk');}
const PR=0.35;
function blocked(x,z){if(mode==='store'&&SHOP)return shopBlocked(x,z);return !(isWalk(x+PR,z)&&isWalk(x-PR,z)&&isWalk(x,z+PR)&&isWalk(x,z-PR));}
function tryMove(dx,dz){const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/0.1));for(let i=0;i<n;i++){if(!blocked(player.x+dx/n,player.z))player.x+=dx/n;if(!blocked(player.x,player.z+dz/n))player.z+=dz/n;}}

const ptrs=new Map();let downInfo=null,pinch0=0;
// ---- управление мышью без курсора (захват указателя)
let locked=false,lockFailed=!('requestPointerLock' in HTMLCanvasElement.prototype),lockErrors=0,mouse={in:false,x:0,y:0};
function lockError(){lockErrors++;if(lockErrors>=3)lockFailed=true;updateCross();showHint(lockFailed?'Браузер не даёт скрыть курсор — обзор поворачивается, когда уводишь мышь от центра. Клик по сцене снова попробует скрыть курсор.':'Кликни по сцене ещё раз, чтобы продолжить прогулку');}
function requestLock(){try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(lockError);}catch(e){lockError();}}
function releaseLock(){if(document.pointerLockElement)document.exitPointerLock();}
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas;if(locked){lockErrors=0;lockFailed=false;hideHint();}updateCross();});
document.addEventListener('pointerlockerror',lockError);
function isFP(){return mode==='walk'||mode==='store';}
function updateCross(){$('cross').hidden=!(locked&&isFP());$('aim').hidden=!(locked&&isFP());$('lockTip').hidden=!(!coarse&&!locked&&isFP()&&$('card').hidden&&$('shop').hidden);}
canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&!coarse&&isFP()){
  if(locked){if(e.button===0)pick(innerWidth/2,innerHeight/2,true);return;}
  if(!$('card').hidden)closeCard();if(!$('shop').hidden)closeShopPanel(false);
  requestLock();if(!lockFailed)return;}
 canvas.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(ptrs.size===1)downInfo={t:performance.now(),moved:0};
 if(ptrs.size===2){const a=[...ptrs.values()];pinch0=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(downInfo)downInfo.moved=99;}});
canvas.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
 if(downInfo)downInfo.moved+=Math.abs(dx)+Math.abs(dy);
 if(ptrs.size===2&&mode==='top'){const a=[...ptrs.values()];const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinch0>0)topv.h=clampH(topv.h*pinch0/d);pinch0=d;return;}
 if(anim)return;
 if(isFP()){const k=coarse?0.006:0.0045;player.yaw-=dx*k;player.pitch=Math.max(-1.2,Math.min(1.2,player.pitch-dy*k));hideHint();}
 else{const sc=2*topv.h*Math.tan(THREE.MathUtils.degToRad(cam.fov/2))/innerHeight;topv.x-=dx*sc;topv.z-=dy*sc;topv.x=Math.max(bb.x0-60,Math.min(bb.x1+60,topv.x));topv.z=Math.max(bb.z0-60,Math.min(bb.z1+80,topv.z));}});
const SENS=0.0021;let lookDX=0,lookDY=0;
document.addEventListener('mousemove',e=>{
 if(e.target===canvas){mouse.in=true;mouse.x=e.clientX;mouse.y=e.clientY;}
 if(coarse||!isFP()||anim)return;
 if(locked){lookDX+=(e.movementX||0);lookDY+=(e.movementY||0);}});
canvas.addEventListener('mouseleave',()=>{mouse.in=false;});
function endPtr(e){ptrs.delete(e.pointerId);if(ptrs.size<2)pinch0=0;
 if(ptrs.size===0&&downInfo){if(downInfo.moved<8&&performance.now()-downInfo.t<450)pick(e.clientX,e.clientY);downInfo=null;}}
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
canvas.addEventListener('wheel',e=>{e.preventDefault();if(mode==='top')topv.h=clampH(topv.h*Math.exp(e.deltaY*0.0012));else{const f=-Math.sign(e.deltaY)*2;tryMove(-Math.sin(player.yaw)*f,-Math.cos(player.yaw)*f);}},{passive:false});
function clampH(h){return Math.max(18,Math.min(1100,h));}

const joy=$('joy'),knob=$('knob');let joyId=null;
function joyAt(e){const r=joy.getBoundingClientRect();let x=(e.clientX-r.left-r.width/2)/(r.width/2),y=(e.clientY-r.top-r.height/2)/(r.height/2);const l=Math.hypot(x,y);if(l>1){x/=l;y/=l;}joyV={x,y};knob.style.transform=`translate(${x*36}px,${y*36}px)`;}
joy.addEventListener('pointerdown',e=>{joyId=e.pointerId;joy.setPointerCapture(e.pointerId);joyAt(e);hideHint();});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)joyAt(e);});
const joyEnd=e=>{if(e.pointerId!==joyId)return;joyId=null;joyV={x:0,y:0};knob.style.transform='';};
joy.addEventListener('pointerup',joyEnd);joy.addEventListener('pointercancel',joyEnd);

addEventListener('keydown',e=>{
 if(e.target.tagName==='INPUT'){if(e.key==='Escape')closeSearch();if(e.key==='Enter'){const f=$('results').querySelector('li[data-id]');if(f)f.click();}return;}
 if(e.key==='/'){e.preventDefault();openSearch();return;}
 if(e.key==='Escape'){if(!locked)closeCard();$('info').hidden=true;return;}
 if(e.key==='Enter'&&mode==='store'){shopPick(innerWidth/2,innerHeight/2);return;}
 if(e.key==='Enter'&&target&&mode==='walk'){if(target.door)walkToDoor(target);else walkTo(target);return;}
 if(e.key==='Escape'&&!$('shop').hidden){closeShopPanel(false);return;}
 if(e.code==='KeyV'){if(mode!=='store')setMode(mode==='walk'?'top':'walk');return;}
 keys[e.code]=true;if(e.code.startsWith('Arrow'))e.preventDefault();});
addEventListener('keyup',e=>{keys[e.code]=false;});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});

/* ---------- Выбор ---------- */
const ray=new THREE.Raycaster();
function pick(x,y,fromLock){if(mode==='store'&&SHOP){shopPick(x,y);return;}ray.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-(y/innerHeight)*2+1),cam);
 const hits=ray.intersectObjects(pickables,false).filter(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;});
 for(const h of hits){let id=-1;if(h.object.userData.kiosks&&h.instanceId!=null)id=h.object.userData.kiosks[h.instanceId];else if(h.object.userData.fs)id=h.object.userData.fs[h.faceIndex];if(id>=0){openCard(S[id]);if(fromLock)releaseLock();return;}}
 closeCard();}
function aimAt(){ray.setFromCamera(new THREE.Vector2(0,0),cam);const hits=ray.intersectObjects(pickables,false);for(const h of hits){let o=h.object,vis=true;while(o){if(!o.visible){vis=false;break;}o=o.parent;}if(!vis)continue;let id=-1;if(h.object.userData.kiosks&&h.instanceId!=null)id=h.object.userData.kiosks[h.instanceId];else if(h.object.userData.fs)id=h.object.userData.fs[h.faceIndex];if(id>=0&&h.distance<40)return S[id];if(id<0)return null;}return null;}
function openCard(s){
 target=s;$('card').hidden=false;const c=CATS[s.cat];
 $('cCol').style.background=s.colHex;$('cCat').textContent=c.n;$('cName').textContent=s.name;$('cWhat').textContent=s.what||'';
 $('cMeta').textContent=s.kind==='kiosk'?'1 этаж · островок в галерее':'1 этаж · около '+Math.max(5,Math.round(s.area/5)*5)+' м²';
 const also=(s.names||[]).slice(1);
 $('cInfo').textContent=s.cat==='tbd'?(s.kind==='kiosk'?'Островок без подписи на картах.':'На Яндекс Картах у этого помещения нет подписи.'):(also.length?'Также здесь: '+also.join(', ')+'. ':'')+'Галерея работает с 10:00 до 21:00, точный режим магазина лучше проверить на картах.';
 const b=$('cBtns');b.innerHTML='';
 if(s.door){const en=document.createElement('button');en.className='btn pri';en.textContent='Войти в магазин';en.onclick=()=>{walkToDoor(s);requestLockIfNeeded();};b.appendChild(en);}
 const go=document.createElement('button');go.className=s.door?'btn':'btn pri';go.textContent='Подойти';go.onclick=()=>{walkTo(s);requestLockIfNeeded();};b.appendChild(go);
 if(mode==='walk'){const t=document.createElement('button');t.className='btn';t.textContent='Показать сверху';t.onclick=()=>showTop(s);b.appendChild(t);}
 if(s.cat!=='tbd'){const a=document.createElement('a');a.className='btn';a.href='https://yandex.ru/maps/15/tula/search/'+encodeURIComponent(s.name+' ТРЦ Макси');a.target='_blank';a.rel='noopener';a.textContent='На Яндекс Картах ↗';b.appendChild(a);}
 const p=s.fp?s.fp.clone().addScaledVector(s.fn,1.5):new V3(s.c[0],0,s.c[1]);world.target.position.set(p.x,GLASS_H+1.4,p.z);world.target.visible=true;
}
function closeCard(){$('card').hidden=true;target=null;if(world.target)world.target.visible=false;}
$('cardX').onclick=()=>{closeCard();requestLockIfNeeded();};
function standPoint(s){
 if(s.kind==='kiosk'){for(let r=2.2;r<7;r+=0.8)for(let k=0;k<8;k++){const a=k/8*Math.PI*2,x=s.p[0]+Math.sin(a)*(r+s.w/2),z=s.p[1]+Math.cos(a)*(r+s.h/2);if(!blocked(x,z))return{x,z,yaw:Math.atan2(x-s.p[0],z-s.p[1])};}}
 if(s.fp){for(let d=3;d<14;d+=0.5){const p=s.fp.clone().addScaledVector(s.fn,d);if(!blocked(p.x,p.z))return{x:p.x,z:p.z,yaw:Math.atan2(s.fn.x,s.fn.z)};}}
 const c=nearestFree(s.fp?s.fp.x:s.c[0],s.fp?s.fp.z:s.c[1],200);if(!c)return null;return{x:c[0],z:c[1],yaw:Math.atan2(c[0]-s.c[0],c[1]-s.c[1])};
}
function walkTo(s){const sp=standPoint(s);if(!sp)return;
 player.x=sp.x;player.z=sp.z;player.yaw=sp.yaw;player.pitch=0.08;
 if(mode==='walk')anim={t:0,from:{p:cam.position.clone(),q:cam.quaternion.clone()},m:'walk'};else setMode('walk');
 openCard(s);if(coarse)$('card').hidden=true;}
function walkToDoor(s){const d=s.door;player.x=d.c.x+d.n.x*2.2;player.z=d.c.z+d.n.z*2.2;player.yaw=Math.atan2(d.n.x,d.n.z);player.pitch=0;closeCard();if(mode!=='walk')setMode('walk');else anim={t:0,from:{p:cam.position.clone(),q:cam.quaternion.clone()},m:'walk'};showHint('Двери открыты — пройди вперёд, чтобы войти');}
function showTop(s){topv.x=s.c[0];topv.z=s.c[1];topv.h=Math.max(45,Math.min(160,Math.sqrt(s.area||40)*4));setMode('top',{keep:true});openCard(s);}

/* ---------- Фильтр ---------- */
function buildChips(){const box=$('chips');
 Object.entries(CATS).forEach(([k,c])=>{if(k==='tbd'||!S.some(s=>s.cat===k))return;const b=document.createElement('button');b.className='chip';const i=document.createElement('i');i.style.background=c.c;b.appendChild(i);b.appendChild(document.createTextNode(c.n));
  b.onclick=()=>{filter=filter===k?null:k;[...box.children].forEach(x=>x.classList.remove('on'));if(filter)b.classList.add('on');applyFilter();drawMiniBase();};box.appendChild(b);});}
function applyFilter(){
 const attr=world.tintMesh.geometry.attributes.color,arr=attr.array,base=world.tintColors,fs=world.tintMesh.userData.fs;const dim=LIN('#d9dcdf');
 for(let f=0;f<fs.length;f++){const s=S[fs[f]];const on=!filter||(s&&s.cat===filter);for(let v=0;v<3;v++){const i=(f*3+v)*3;
  if(on){arr[i]=base[i];arr[i+1]=base[i+1];arr[i+2]=base[i+2];}else{arr[i]=dim.r;arr[i+1]=dim.g;arr[i+2]=dim.b;}}}
 attr.needsUpdate=true;
 const dimC=LIN('#c9cdd1');const ids=world.kBody.userData.kiosks;ids.forEach((id,i)=>{const s=S[id];const on=!filter||s.cat===filter;const c=s.cat==='tbd'?LIN('#9aa3ab'):s.col;world.kBody.setColorAt(i,on?c:dimC);const lc=on?c.clone().lerp(new THREE.Color(1,1,1),0.35).multiplyScalar(1.5):dimC;world.kRings.forEach(r=>r.setColorAt(i,lc));});
 [world.kBody,...world.kRings].forEach(m=>{if(m.instanceColor)m.instanceColor.needsUpdate=true;});}

/* ---------- Поиск ---------- */
function openSearch(){$('search').hidden=false;$('q').value='';renderResults('');setTimeout(()=>$('q').focus(),30);}
function closeSearch(){$('search').hidden=true;canvas.focus();}
$('bSearch').onclick=openSearch;$('search').addEventListener('pointerdown',e=>{if(e.target.id==='search')closeSearch();});
$('q').addEventListener('input',e=>renderResults(e.target.value));
function renderResults(q){q=q.trim().toLowerCase();const ul=$('results');ul.innerHTML='';
 const named=S.filter(s=>s.cat!=='tbd');
 const list=named.filter(s=>!q||((s.names||[s.name]).join(' ')+' '+(s.what||'')+' '+CATS[s.cat].n+' '+CATS[s.cat].k).toLowerCase().includes(q)).sort((a,b)=>{const ai=a.name.toLowerCase().startsWith(q)?0:1,bi=b.name.toLowerCase().startsWith(q)?0:1;return ai-bi||a.name.localeCompare(b.name,'ru');});
 if(!list.length){const li=document.createElement('li');li.style.cursor='default';li.style.color='var(--muted)';li.textContent='На первом этаже такого не нашлось';ul.appendChild(li);return;}
 list.slice(0,80).forEach(s=>{const li=document.createElement('li');li.dataset.id=s.id;const i=document.createElement('i');i.style.background=s.colHex;const bt=document.createElement('b');bt.textContent=s.name;const sm=document.createElement('small');sm.textContent=s.what||CATS[s.cat].n;li.append(i,bt,sm);
  li.onclick=()=>{closeSearch();if(mode==='top')showTop(s);else walkTo(s);};ul.appendChild(li);});}
$('bInfo').onclick=()=>{$('info').hidden=false;};$('infoOk').onclick=()=>{$('info').hidden=true;};
$('info').addEventListener('pointerdown',e=>{if(e.target.id==='info')$('info').hidden=true;});
$('bWalk').onclick=()=>setMode('walk');$('bTop').onclick=()=>setMode('top');

/* ---------- Мини-карта ---------- */
const mini=$('mini'),mg=mini.getContext('2d');let miniBase=null,miniT={s:1,ox:0,oz:0};
function sizeMini(){const r=mini.getBoundingClientRect();const d=Math.min(devicePixelRatio,2);mini.width=Math.max(1,Math.round(r.width*d));mini.height=Math.max(1,Math.round(r.height*d));drawMiniBase();}
function drawMiniBase(){const w=mini.width,h=mini.height,pad=6*Math.min(devicePixelRatio,2);const s=Math.min((w-2*pad)/(bb.x1-bb.x0),(h-2*pad)/(bb.z1-bb.z0));
 miniT={s,ox:(w-(bb.x1-bb.x0)*s)/2-bb.x0*s,oz:(h-(bb.z1-bb.z0)*s)/2-bb.z0*s};
 const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');const X=p=>[p[0]*s+miniT.ox,p[1]*s+miniT.oz];
 const poly=(pts,fill)=>{g.beginPath();pts.forEach((p,i)=>{const q=X(p);i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]);});g.closePath();g.fillStyle=fill;g.fill();};
 D.bld.forEach(b=>poly(b,'#e7e5e0'));
 S.forEach(st=>{if(st.kind!=='store')return;poly(st.poly,(filter&&st.cat!==filter)?'#dde1e5':st.colHex);});
 miniBase=c;}
function drawMini(){if(!miniBase)return;const w=mini.width,h=mini.height;mg.clearRect(0,0,w,h);mg.drawImage(miniBase,0,0);const s=miniT.s,X=(x,z)=>[x*s+miniT.ox,z*s+miniT.oz],dp=Math.min(devicePixelRatio,2);
 if(target){const p=X(target.c[0],target.c[1]);mg.strokeStyle='#0e7490';mg.lineWidth=2*dp;mg.beginPath();mg.arc(p[0],p[1],6*dp,0,7);mg.stroke();}
 const [px,pz]=X(player.x,player.z),fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),L=8*dp;
 mg.fillStyle='#e11d48';mg.beginPath();mg.moveTo(px+fx*L,pz+fz*L);mg.lineTo(px-fz*L*.55-fx*L*.4,pz+fx*L*.55-fz*L*.4);mg.lineTo(px+fz*L*.55-fx*L*.4,pz-fx*L*.55-fz*L*.4);mg.closePath();mg.fill();}
mini.addEventListener('click',e=>{const r=mini.getBoundingClientRect(),d=mini.width/r.width;const x=((e.clientX-r.left)*d-miniT.ox)/miniT.s,z=((e.clientY-r.top)*d-miniT.oz)/miniT.s;
 if(mode==='top'){topv.x=x;topv.z=z;topv.h=Math.min(topv.h,160);return;}
 const w=nearestFree(x,z,60);if(!w)return;player.x=w[0];player.z=w[1];anim={t:0,from:{p:cam.position.clone(),q:cam.quaternion.clone()},m:'walk'};});

function showHint(t){const h=$('hint');h.textContent=t;h.style.opacity=1;clearTimeout(showHint.t);showHint.t=setTimeout(hideHint,9000);}
function hideHint(){$('hint').style.opacity=0;}

/* ---------- Цикл ---------- */
let last=performance.now(),miniAt=0;
function frame(now){
 try{frameBody(now);}catch(err){console.error(err);if(!frame.err){frame.err=1;showHint('Ошибка отрисовки: '+err.message);}}
 requestAnimationFrame(frame);
}
function frameBody(now){
 const dt=Math.min(0.05,(now-last)/1000);last=now;
 if((mode==='walk'||mode==='store')&&!anim){
  let f=0,r=0,turn=0;
  // обзор мышью: захваченный курсор — плавно, по смещению мыши
  if(lookDX||lookDY){const kx=Math.min(1,dt*30);const mx=lookDX*kx,my=lookDY*kx;lookDX-=mx;lookDY-=my;if(Math.abs(lookDX)<0.05)lookDX=0;if(Math.abs(lookDY)<0.05)lookDY=0;
   player.yaw-=mx*SENS;player.pitch=Math.max(-1.2,Math.min(1.2,player.pitch-my*SENS));}
  // запасной режим, если браузер не даёт скрыть курсор: поворот по положению мыши относительно центра
  if(lockFailed&&mouse.in&&!coarse&&!ptrs.size){const ox=(mouse.x/innerWidth-0.5)*2,oy=(mouse.y/innerHeight-0.5)*2;const dz=0.18;
   const ax=Math.abs(ox)>dz?(Math.abs(ox)-dz)/(1-dz)*Math.sign(ox):0;turn-=ax*Math.abs(ax)*1.4;
   const tp=-oy*0.6;player.pitch+=(tp-player.pitch)*Math.min(1,dt*3);}
  if(keys.KeyW||keys.ArrowUp)f+=1;if(keys.KeyS||keys.ArrowDown)f-=1;if(keys.KeyD)r+=1;if(keys.KeyA)r-=1;
  if(keys.ArrowLeft||keys.KeyQ)turn+=1;if(keys.ArrowRight||keys.KeyE)turn-=1;
  f+=-joyV.y;r+=joyV.x;player.yaw+=turn*1.9*dt;
  // плавный разгон и торможение
  const maxV=(keys.ShiftLeft||keys.ShiftRight?16:7)*(coarse?1.25:1);const l=Math.hypot(f,r);let tx=0,tz=0;
  if(l>0.05){const k=Math.min(1,l)/l;f*=k;r*=k;const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),rx=Math.cos(player.yaw),rz=-Math.sin(player.yaw);tx=(fx*f+rx*r)*maxV;tz=(fz*f+rz*r)*maxV;hideHint();}
  const acc=Math.min(1,dt*(l>0.05?7:10));player.vx+=(tx-player.vx)*acc;player.vz+=(tz-player.vz)*acc;
  if(Math.abs(player.vx)+Math.abs(player.vz)>0.01){const ox=player.x,oz=player.z;tryMove(player.vx*dt,player.vz*dt);if(Math.abs(player.x-ox)<1e-4)player.vx*=0.5;if(Math.abs(player.z-oz)<1e-4)player.vz*=0.5;}
 }
 const goal=mode==='top'?topPose():walkPose();
 if(anim){anim.t=Math.min(1,anim.t+dt/0.9);const e=anim.t<.5?4*anim.t**3:1-Math.pow(-2*anim.t+2,3)/2;
  cam.position.copy(anim.from.p).lerp(goal.p,e);cam.quaternion.copy(anim.from.q).slerp(goal.q,e);
  if(anim.t>=1){anim=null;if(mode==='walk')setVis();}}
 else applyPose(goal);
 world.pmark.position.set(player.x,FLOOR_H+1,player.z);world.pmark.rotation.y=player.yaw;world.pmark.scale.setScalar(mode==='top'?Math.max(0.4,topv.h/160):1);
 if(world.people&&mode!=='store')updatePeople(dt,now);
 updateMallDoors(dt);if(mode==='store'){updateShopExit(dt);updateShopPeople(dt,now);}
 world.wheel.rotation.z+=dt*0.04;world.cabins.forEach(c=>{c.rotation.z=-world.wheel.rotation.z;});
 if(world.target.visible){const b=mode==='top'?FLOOR_H+3:GLASS_H+1.4;world.target.position.y=b+Math.sin(now/300)*0.3;world.target.rotation.y+=dt*1.5;world.target.scale.setScalar(mode==='top'?Math.max(1,topv.h/50):1);}
 if(locked&&isFP()&&now-(frame.aimAt||0)>120){frame.aimAt=now;const el=$('aim');let txt='';if(mode==='store'&&SHOP){txt=shopAimText();}else{const t=aimAt();txt=t?(t.cat==='tbd'?t.name:t.name+(t.door?' · нажми или зайди в дверь':' · нажми, чтобы открыть')):'';}const t=txt;if(el.textContent!==txt)el.textContent=txt;el.style.opacity=txt?1:0;}
 renderer.render(mode==='store'&&SHOP?SHOP.scene:scene,cam);
 if(now-miniAt>80){drawMini();miniAt=now;}
}
const _q=new THREE.Quaternion(),_s=new V3(),_p=new V3(),_Y=new V3(0,1,0);
function updatePeople(dt,now){const W_=world.people,r=W_.r;
 W_.list.forEach((p,i)=>{
  if(p.wait>0){p.wait-=dt;}else{
   let dx=p.tx-p.x,dz=p.tz-p.z,d=Math.hypot(dx,dz);
   if(d<0.4){p.wait=r()<0.3?1+r()*5:0;for(let t=0;t<12;t++){const a=r()*6.28,L=4+r()*22;const x=p.x+Math.cos(a)*L,z=p.z+Math.sin(a)*L;if(isWalk(x,z)&&!blocked(x,z)){p.tx=x;p.tz=z;break;}}}
   else{const st=Math.min(d,p.sp*dt),nx=p.x+dx/d*st,nz=p.z+dz/d*st;
    if(isWalk(nx,nz)&&!blocked(nx,nz)){p.x=nx;p.z=nz;const ta=Math.atan2(dx,dz);let da=((ta-p.a+Math.PI*3)%(Math.PI*2))-Math.PI;p.a+=da*Math.min(1,dt*6);}
    else{p.tx=p.x;p.tz=p.z;}}}
  const bob=p.wait>0?0:Math.abs(Math.sin(now/1000*p.sp*5+p.ph))*0.03;
  _q.setFromAxisAngle(_Y,p.a);_s.set(p.sc,p.sc,p.sc);_p.set(p.x,bob,p.z);mtx.compose(_p,_q,_s);W_.meshes.forEach(m=>m.setMatrixAt(i,mtx));
  _p.set(p.x,0.02,p.z);_s.set(1,1,1);_q.identity();mtx.compose(_p,_q,_s);W_.sh.setMatrixAt(i,mtx);});
 W_.meshes.forEach(m=>m.instanceMatrix.needsUpdate=true);W_.sh.instanceMatrix.needsUpdate=true;}
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
let MODELS=null;
function models(){if(MODELS)return MODELS;
 const bikeFrame=[];const bar=(ax,ay,bx,by)=>{const L=Math.hypot(bx-ax,by-ay);const g=new THREE.CylinderGeometry(0.018,0.018,L,6);g.rotateZ(-Math.atan2(bx-ax,by-ay));g.translate((ax+bx)/2,(ay+by)/2,0);bikeFrame.push(g);};
 bar(-0.5,0.35,-0.15,0.8);bar(-0.15,0.8,0.35,0.8);bar(0.35,0.8,0.5,0.35);bar(-0.15,0.8,0,0.35);bar(0,0.35,0.35,0.8);bar(-0.5,0.35,0,0.35);bar(-0.15,0.8,-0.18,0.9);bikeFrame.push(B(0.22,0.05,0.1,-0.19,0.92,0));bar(0.35,0.8,0.38,0.97);bikeFrame.push(B(0.04,0.04,0.5,0.38,0.98,0));
 const wheel=new THREE.TorusGeometry(0.33,0.028,6,28);
 MODELS={
  shoe:mergeG([B(0.3,0.035,0.11,0,0.018,0),B(0.2,0.08,0.1,-0.04,0.075,0),B(0.1,0.05,0.095,0.09,0.06,0)]),
  jacket:mergeG([B(0.52,0.72,0.1,0,-0.42,0),B(0.13,0.62,0.09,-0.33,-0.42,0),B(0.13,0.62,0.09,0.33,-0.42,0)]),
  pants:mergeG([B(0.4,0.1,0.06,0,-0.12,0),B(0.18,0.9,0.06,-0.1,-0.6,0),B(0.18,0.9,0.06,0.1,-0.6,0)]),
  tshirt:mergeG([B(0.46,0.6,0.05,0,-0.36,0),B(0.16,0.18,0.05,-0.29,-0.14,0),B(0.16,0.18,0.05,0.29,-0.14,0)]),
  dress:mergeG([B(0.34,0.35,0.06,0,-0.22,0),new THREE.CylinderGeometry(0.17,0.34,0.7,12,1,true).translate(0,-0.74,0)]),
  football:new THREE.SphereGeometry(0.11,16,12),basketball:new THREE.SphereGeometry(0.12,16,12),
  bike:mergeG(bikeFrame),bikeWheels:mergeG([wheel.clone().translate(-0.5,0.35,0),wheel.clone().translate(0.5,0.35,0)]),
  dumbbell:mergeG([CyX(0.02,0.36,0,0,0,8),CyX(0.06,0.07,-0.15,0,0,10),CyX(0.06,0.07,0.15,0,0,10)]),
  bottle:mergeG([B(0.07,0.12,0.04,0,0.06,0),Cy(0.015,0.015,0.03,0,0.135,0,8)]),
  jar:mergeG([Cy(0.05,0.05,0.1,0,0.05,0,12),Cy(0.055,0.055,0.03,0,0.115,0,12)]),
  small:mergeG([B(0.12,0.03,0.09,0,0.015,0),Cy(0.025,0.025,0.02,0,0.04,0,10)]),
  phone:B(0.075,0.15,0.008,0,0.085,0).rotateX(-0.35),
  box:B(0.28,0.22,0.2,0,0.11,0),
  toy:mergeG([new THREE.SphereGeometry(0.1,10,8).translate(0,0.1,0),new THREE.SphereGeometry(0.07,10,8).translate(0,0.24,0)]),
  cup:mergeG([Cy(0.04,0.032,0.1,0,0.05,0,10)]),
  appliance:B(0.62,1.7,0.6,0,0.85,0),
  sofa:mergeG([B(2.1,0.42,0.9,0,0.3,0),B(2.1,0.5,0.22,0,0.66,-0.34),B(0.2,0.3,0.9,-0.95,0.6,0),B(0.2,0.3,0.9,0.95,0.6,0)]),
  bed:mergeG([B(1.7,0.3,2.05,0,0.3,0),B(1.62,0.18,1.95,0,0.52,0.02),B(1.7,0.9,0.1,0,0.6,-1.02)])
 };return MODELS;}
const ballTex=(type)=>canvasTex(256,128,(g,w,h)=>{if(type==='football'){g.fillStyle='#fafafa';g.fillRect(0,0,w,h);g.fillStyle='#1c1c1c';const r=mulberry(4);for(let i=0;i<14;i++){const x=r()*w,y=16+r()*(h-32);g.beginPath();for(let k=0;k<5;k++){const a=k/5*6.283;g.lineTo(x+Math.cos(a)*12,y+Math.sin(a)*12);}g.fill();}}
 else{g.fillStyle='#d9702a';g.fillRect(0,0,w,h);g.strokeStyle='#2a160a';g.lineWidth=4;g.beginPath();g.moveTo(0,h/2);g.lineTo(w,h/2);for(let x=0;x<=w;x+=64){g.moveTo(x,0);g.lineTo(x,h);}g.stroke();}});

/* ---------- Зал магазина ---------- */
let SHOP=null;// текущий магазин {s,scene,col,pick,zones,W,D,exit}
function buildShop(s){
 const cat=catalogOf(s);const nd=cat.length;const big=nd>=6;
 const W=big?40:nd>=4?30:nd>=2?22:15,D=big?30:nd>=4?22:nd>=2?17:12,H=5.2;
 const sc=new THREE.Scene();sc.background=LIN('#efece6');sc.environment=scene.environment;sc.fog=new THREE.Fog(LIN('#efece6'),30,90);
 sc.add(new THREE.HemisphereLight(LIN('#fffaf2'),LIN('#b9ad9c'),0.55));const dl=new THREE.DirectionalLight(LIN('#fff2e0'),0.45);dl.position.set(10,20,8);sc.add(dl);
 const brand=s.col,brandHex=s.colHex;
 const colliders=[],pick=[],zones=[];
 const floorTex=canvasTex(512,512,(g,w,h)=>{const r=mulberry(s.id);const food=s.cat==='food'||s.cat==='furn';
  if(food||s.cat==='fashion'){g.fillStyle='#cfae88';g.fillRect(0,0,w,h);for(let y=0;y<h;y+=32){const off=(y/32%2)*96;for(let x=-off;x<w;x+=192){g.fillStyle=`rgba(${110+r()*30},${70+r()*20},${30+r()*15},${0.12+r()*0.1})`;g.fillRect(x,y,190,31);}g.fillStyle='rgba(60,35,15,.3)';g.fillRect(0,y,w,1);}}
  else{g.fillStyle='#c4c5c6';g.fillRect(0,0,w,h);for(let i=0;i<2;i++)for(let j=0;j<2;j++){g.fillStyle=`rgba(0,0,0,${0.02+r()*0.03})`;g.fillRect(i*256,j*256,256,256);}g.strokeStyle='rgba(0,0,0,.15)';g.lineWidth=2;g.strokeRect(0,0,256,256);g.strokeRect(256,256,256,256);g.strokeRect(256,0,256,256);g.strokeRect(0,256,256,256);}});
 floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping;floorTex.repeat.set(W/4,D/4);
 const fl=new THREE.Mesh(new THREE.PlaneGeometry(W,D),new THREE.MeshStandardMaterial({map:floorTex,roughness:.3}));fl.rotation.x=-Math.PI/2;sc.add(fl);
 const wallMat=new THREE.MeshStandardMaterial({color:LIN('#e9e6e0'),roughness:.85,side:THREE.BackSide});
 const room=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),[wallMat,wallMat,new THREE.MeshStandardMaterial({color:LIN('#f7f7f5'),roughness:.9,side:THREE.BackSide}),wallMat,wallMat,wallMat]);room.position.y=H/2;sc.add(room);
 // цветная полоса по стенам и светильники
 {const bm=new THREE.MeshStandardMaterial({color:brand,roughness:.5,side:THREE.DoubleSide});[[0,-D/2+0.02,W,0],[0,D/2-0.02,W,Math.PI],[-W/2+0.02,0,D,Math.PI/2],[W/2-0.02,0,D,-Math.PI/2]].forEach(([x,z,l,r])=>{const b=new THREE.Mesh(new THREE.PlaneGeometry(l,0.5),bm);b.position.set(x,H-0.45,z);b.rotation.y=r;sc.add(b);});}
 const lp=new THREE.PlaneGeometry(2.6,0.3);lp.rotateX(Math.PI/2);const nL=Math.floor(W/5)*Math.floor(D/4);const lights=new THREE.InstancedMesh(lp,new THREE.MeshBasicMaterial({color:new THREE.Color(1.5,1.48,1.42),toneMapped:false}),Math.max(1,nL));let li=0;
 for(let x=-W/2+3;x<W/2-1;x+=5)for(let z=-D/2+2;z<D/2-1;z+=4){if(li<nL){mtx.makeTranslation(x,H-0.02,z);lights.setMatrixAt(li++,mtx);}}lights.count=li;sc.add(lights);
 // логотип на задней стене
 const logoT=canvasTex(1024,160,(g,w,h)=>{g.fillStyle=brandHex;g.fillRect(0,0,w,h);g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';fitFont(g,s.name,w-80,110,800);g.fillText(s.name,w/2,h/2+4);});
 const logo=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(W*0.5,14),Math.min(W*0.5,14)*160/1024),new THREE.MeshBasicMaterial({map:logoT,toneMapped:false}));logo.position.set(0,3.6,-D/2+0.03);sc.add(logo);
 // вход/выход на передней стене: проём шириной как у двери в галерее, за стеклом — галерея
 const DWs=s.door?s.door.w:2.6;
 {const fw=new THREE.MeshStandardMaterial({color:LIN('#f4f2ee'),roughness:.8});const side=(W-DWs)/2;
  [[-(DWs/2+side/2)],[DWs/2+side/2]].forEach(([x])=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(side,H),fw);p.position.set(x,H/2,D/2-0.01);p.rotation.y=Math.PI;sc.add(p);});
  const top=new THREE.Mesh(new THREE.PlaneGeometry(DWs,H-2.75),fw);top.position.set(0,2.75+(H-2.75)/2,D/2-0.01);top.rotation.y=Math.PI;sc.add(top);
  room.material[4]=new THREE.MeshBasicMaterial({visible:false});}
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
 // корзины у входа
 {const bm=new THREE.MeshStandardMaterial({color:brand,roughness:.5});for(let k=0;k<5;k++){const b=new THREE.Mesh(B(0.45,0.22,0.32,0,0.11+k*0.09,0),bm);b.position.set(-DWs/2-1.2,0,D/2-1.2);sc.add(b);}colliders.push([-DWs/2-1.5,-DWs/2-0.9,D/2-1.4,D/2-1.0]);}
 // касса у входа
 if(s.cat!=='food'){const desk=new THREE.Mesh(B(3,1.05,0.8,0,0.525,0),new THREE.MeshStandardMaterial({color:brand,roughness:.4}));desk.position.set(W/2-4,0,D/2-3.2);sc.add(desk);colliders.push([W/2-5.6,W/2-2.4,D/2-3.7,D/2-2.7]);
  const top=new THREE.Mesh(B(3.1,0.05,0.9,0,1.07,0),MAT.white);top.position.copy(desk.position);sc.add(top);}
 // отделы по сетке
 const cols=nd<=1?1:nd<=4?2:4,rows=Math.ceil(nd/cols);
 const x0=-W/2+1.2,x1=W/2-1.2,z0=-D/2+1.2,z1=D/2-5.5;const zw=(x1-x0)/cols,zd=(z1-z0)/rows;
 const inst={};const addInst=(model,x,y,z,ry,color,prod,scale)=>{(inst[model]=inst[model]||[]).push({x,y,z,ry,color,prod,scale:scale||1});};
 cat.forEach((dep,di)=>{const c=di%cols,rI=Math.floor(di/cols);const zx0=x0+c*zw+0.6,zx1=x0+(c+1)*zw-0.6,zz0=z0+rI*zd+0.6,zz1=z0+(rI+1)*zd-0.6;const cx=(zx0+zx1)/2,cz=(zz0+zz1)/2,w=zx1-zx0,d=zz1-zz0;
  zones.push({dep,cx,cz,w,d});
  // коврик отдела и подвесная табличка
  const mat=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshStandardMaterial({color:LIN(shade(brandHex,.82)),roughness:.6,transparent:true,opacity:.55}));mat.rotation.x=-Math.PI/2;mat.position.set(cx,0.012,cz);sc.add(mat);
  const signT=canvasTex(512,112,(g,W_,H_)=>{g.fillStyle='#1f2226';rr(g,2,2,W_-4,H_-4,14);g.fill();g.fillStyle=brandHex;g.fillRect(2,H_-12,W_-4,10);g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';fitFont(g,dep.title,W_-40,48,800);g.fillText(dep.title,W_/2,H_/2-2);});
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(3.4,0.74),new THREE.MeshBasicMaterial({map:signT,toneMapped:false,side:THREE.DoubleSide}));sg.position.set(cx,3.7,cz+d/2-0.4);sg.userData.dept=di;sc.add(sg);pick.push(sg);
  [-1,1].forEach(k=>{const w_=new THREE.Mesh(Cy(0.008,0.008,H-4.07,cx+k*1.5,3.7+0.37+(H-4.07)/2,cz+d/2-0.4,4),MAT.darkMetal);sc.add(w_);});
  const items=dep.items;let pi=0;const next=()=>items[(pi++)%items.length];
  const lay=dep.lay;
  const wallUnit=(ux,uz,ry,len)=>{// стеллаж 4 полки
   const g=new THREE.Group();const body=new THREE.Mesh(B(len,2.2,0.5,0,1.1,-0.2),new THREE.MeshStandardMaterial({color:LIN('#f2f0ec'),roughness:.6}));g.add(body);
   for(let k=0;k<4;k++){const sh=new THREE.Mesh(B(len,0.03,0.45,0,0.35+k*0.5,0.05),MAT.white);g.add(sh);}
   const back=new THREE.Mesh(B(len,2.2,0.02,0,1.1,-0.19),new THREE.MeshStandardMaterial({color:LIN(shade(brandHex,.55)),roughness:.7}));g.add(back);
   g.position.set(ux,0,uz);g.rotation.y=ry;sc.add(g);
   const ca=Math.cos(ry),sa=Math.sin(ry);const hx=Math.abs(len/2*ca)+Math.abs(0.35*sa),hz=Math.abs(len/2*sa)+Math.abs(0.35*ca);colliders.push([ux-hx,ux+hx,uz-hz,uz+hz]);
   for(let k=0;k<4;k++){const nper=Math.max(3,Math.floor(len/0.42));for(let j=0;j<nper;j++){const p=next();const lx=-len/2+0.25+j*(len-0.5)/(nper-1);const y=0.37+k*0.5;
    addInst(dep.model,ux+lx*ca+0.05*sa,y,uz-lx*sa+0.05*ca,ry+(dep.model==='shoe'?Math.PI/2*0:0),p.color,p);}}};
  if(lay==='wall'){const len=Math.min(4,w-0.4);const n=Math.max(1,Math.floor((d-1)/2.2));for(let k=0;k<n;k++){wallUnit(cx,zz0+0.8+k*2.2,0,len);}}
  else if(lay==='racks'){const nR=Math.max(1,Math.floor((d-0.6)/1.9));for(let k=0;k<nR;k++){const rz=zz0+0.9+k*1.9,len=Math.min(4.4,w-0.6);
    // вешало: две стойки и перекладина
    const g=new THREE.Group();[-len/2,len/2].forEach(px=>g.add(new THREE.Mesh(Cy(0.025,0.025,1.6,px,0.8,0,8),MAT.metal)));const rail=new THREE.Mesh(CyX(0.015,len,0,1.58,0,8),MAT.metal);g.add(rail);
    g.add(new THREE.Mesh(B(len+0.1,0.04,0.5,0,0.02,0),MAT.darkMetal));g.position.set(cx,0,rz);sc.add(g);colliders.push([cx-len/2-0.2,cx+len/2+0.2,rz-0.3,rz+0.3]);
    const nG=Math.floor(len/0.62);for(let j=0;j<nG;j++){const p=next();addInst(dep.model,cx-len/2+0.35+j*((len-0.7)/Math.max(1,nG-1)),1.56,rz,0,p.color,p);}}
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
    const base=new THREE.Mesh(B(len,0.9,0.6,0,0.45,0),new THREE.MeshStandardMaterial({color:LIN('#f2f0ec'),roughness:.4}));base.position.set(cx,0,vz);sc.add(base);
    const gl=new THREE.Mesh(B(len,0.3,0.6,0,1.05,0),new THREE.MeshStandardMaterial({color:LIN('#dcecf2'),transparent:true,opacity:.25,roughness:.02,metalness:.6}));gl.position.set(cx,0,vz);sc.add(gl);colliders.push([cx-len/2-0.1,cx+len/2+0.1,vz-0.4,vz+0.4]);
    const nI=Math.floor(len/0.3);for(let j=0;j<nI;j++){const p=next();addInst(dep.model==='bottle'?'bottle':'small',cx-len/2+0.2+j*((len-0.4)/Math.max(1,nI-1)),0.91,vz,0,p.color,p);}}
   wallUnit(cx,zz1-0.3,Math.PI,Math.min(4,w-0.4));}
  else if(lay==='tables'){const n=Math.max(1,Math.floor((d-0.6)/1.8));for(let k=0;k<n;k++){const tz=zz0+0.9+k*1.8,len=Math.min(2.4,w-1);
    const tb=new THREE.Mesh(B(len,0.85,0.9,0,0.425,0),new THREE.MeshStandardMaterial({color:LIN('#e9e4dc'),roughness:.4}));tb.position.set(cx,0,tz);sc.add(tb);colliders.push([cx-len/2-0.15,cx+len/2+0.15,tz-0.55,tz+0.55]);
    const nI=Math.floor(len/0.3);for(let j=0;j<nI;j++){const p=next();addInst(dep.model,cx-len/2+0.2+j*((len-0.4)/Math.max(1,nI-1)),0.86,tz,0,p.color,p);}}}
  else if(lay==='floor'){const m=dep.model;const sx=m==='sofa'?2.6:m==='bed'?2.3:m==='appliance'?1.0:1.2,sz=m==='sofa'?1.6:m==='bed'?2.6:m==='appliance'?1.0:1.2;
   const nx=Math.max(1,Math.floor(w/sx)),nz=Math.max(1,Math.floor(d/sz));for(let a=0;a<nx;a++)for(let b=0;b<nz;b++){if(nx*nz>1&&(a+b)%2&&m!=='appliance'&&m!=='toy')continue;const p=next();const px=zx0+sx/2+a*sx,pz=zz0+sz/2+b*sz;addInst(m,px,0,pz,0,p.color,p,m==='toy'?2.2:1);
    const hw=(m==='sofa'?1.15:m==='bed'?0.9:m==='appliance'?0.35:0.3),hd=(m==='sofa'?0.5:m==='bed'?1.1:0.35);colliders.push([px-hw,px+hw,pz-hd,pz+hd]);}}
  else if(lay==='cafe'){// стойка, меню, столики
   const cxz=zz0+0.6;const ct=new THREE.Mesh(B(Math.min(5,w-1),1.1,0.8,0,0.55,0),new THREE.MeshStandardMaterial({color:LIN('#3b2f28'),roughness:.5}));ct.position.set(cx,0,cxz);sc.add(ct);colliders.push([cx-Math.min(5,w-1)/2-0.1,cx+Math.min(5,w-1)/2+0.1,cxz-0.5,cxz+0.5]);
   const menuT=canvasTex(512,256,(g,W_,H_)=>{g.fillStyle='#1f1b18';g.fillRect(0,0,W_,H_);g.fillStyle='#fff';g.font='800 30px Manrope, sans-serif';g.fillText('Меню',24,40);g.font='600 22px Manrope, sans-serif';items.forEach((it,i)=>{g.fillStyle='#eee';g.fillText(it.name,24,80+i*28);g.textAlign='right';g.fillText(fmtPrice(it.price),W_-24,80+i*28);g.textAlign='left';});});
   const mb=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.6),new THREE.MeshBasicMaterial({map:menuT,toneMapped:false}));mb.position.set(cx,2.6,-D/2+0.05);sc.add(mb);mb.userData.prod=items[0];pick.push(mb);
   for(let j=0;j<5;j++){const p=items[j];addInst('cup',cx-1.5+j*0.7,1.1,cxz,0,'#ffffff',p);}
   const nT=Math.max(1,Math.floor(w/2.2)),rowsT=Math.max(1,Math.floor((d-2)/2.2));for(let a=0;a<nT;a++)for(let b=0;b<rowsT;b++){const tx=zx0+1.1+a*2.2,tz=cxz+2+b*2.2;if(tz>zz1)continue;
    const t=new THREE.Group();t.add(new THREE.Mesh(Cy(0.4,0.4,0.04,0,0.74,0,20),MAT.white));t.add(new THREE.Mesh(Cy(0.04,0.04,0.72,0,0.36,0,8),MAT.darkMetal));
    [[0.6,0],[-0.6,0]].forEach(([ox])=>{t.add(new THREE.Mesh(B(0.42,0.05,0.42,ox,0.45,0),new THREE.MeshStandardMaterial({color:LIN('#8a6a4a')})));t.add(new THREE.Mesh(B(0.42,0.5,0.05,ox+Math.sign(ox)*0.2,0.7,0).rotateY(Math.PI/2),new THREE.MeshStandardMaterial({color:LIN('#8a6a4a')})));});
    t.position.set(tx,0,tz);sc.add(t);colliders.push([tx-0.9,tx+0.9,tz-0.45,tz+0.45]);addInst('cup',tx+0.12,0.76,tz,0,'#ffffff',items[a%items.length]);}}
 });
 // вешалки-плечики для одежды, ценники у товаров на полках и столах
 {const GARM={jacket:1,pants:1,tshirt:1,dress:1};const hangers=[],tags=[];
  Object.entries(inst).forEach(([model,arr])=>arr.forEach(o=>{if(GARM[model])hangers.push(o);else if(o.y>0.3&&!['bike','sofa','bed','appliance','cup','football','basketball'].includes(model))tags.push(o);}));
  const hg=mergeG([CyX(0.008,0.42,0,0,0,6),Cy(0.006,0.006,0.1,0,0.05,0,6)]);const him=new THREE.InstancedMesh(hg,MAT.metal,Math.max(1,hangers.length));
  const q=new THREE.Quaternion();hangers.forEach((o,i)=>{q.setFromAxisAngle(new V3(0,1,0),o.ry);mtx.compose(new V3(o.x,o.y,o.z),q,new V3(1,1,1));him.setMatrixAt(i,mtx);});sc.add(him);
  const tg=B(0.07,0.035,0.004,0,-0.01,0);const tim=new THREE.InstancedMesh(tg,new THREE.MeshBasicMaterial({color:LIN('#ffffff')}),Math.max(1,tags.length));
  tags.forEach((o,i)=>{q.setFromAxisAngle(new V3(0,1,0),o.ry);const fx=Math.sin(o.ry)*0.2,fz=Math.cos(o.ry)*0.2;mtx.compose(new V3(o.x+fx,o.y,o.z+fz),q,new V3(1,1,1));tim.setMatrixAt(i,mtx);});sc.add(tim);}
 // манекены у отделов одежды и примерочные
 {const parts=humanParts();const white=new THREE.MeshStandardMaterial({color:LIN('#f1efeb'),roughness:.3});const mq=[];
  zones.forEach(z=>{if(z.dep.lay==='racks'){const it=z.dep.items;[[z.cx-z.w/2+0.5,z.cz+z.d/2-0.5],[z.cx+z.w/2-0.5,z.cz+z.d/2-0.5]].forEach(([x,zz],k)=>{if(!shopBlockedRaw(colliders,W,D,x,zz,0)){mq.push({x,z:zz,c:LIN(it[k%it.length].color),p:it[k%it.length]});colliders.push([x-0.3,x+0.3,zz-0.3,zz+0.3]);}});}});
  if(mq.length){const tor=new THREE.InstancedMesh(parts.torso,new THREE.MeshStandardMaterial({roughness:.7}),mq.length),lg=new THREE.InstancedMesh(parts.legs,new THREE.MeshStandardMaterial({color:LIN('#2c3440'),roughness:.8}),mq.length),ar=new THREE.InstancedMesh(parts.arms,white,mq.length),hd=new THREE.InstancedMesh(parts.head,white,mq.length),st=new THREE.InstancedMesh(Cy(0.25,0.25,0.03,0,0.015,0,16),MAT.darkMetal,mq.length);
   mq.forEach((m,i)=>{mtx.makeTranslation(m.x,0,m.z);[tor,lg,ar,hd,st].forEach(o=>o.setMatrixAt(i,mtx));tor.setColorAt(i,m.c);});tor.instanceColor.needsUpdate=true;tor.userData.prods=mq.map(m=>m.p);[tor,lg,ar,hd,st].forEach(o=>sc.add(o));pick.push(tor);}
  if(zones.some(z=>z.dep.lay==='racks')){const cm=new THREE.MeshStandardMaterial({color:brand,roughness:.9,side:THREE.DoubleSide}),pm=new THREE.MeshStandardMaterial({color:LIN('#f2f0ec'),roughness:.6});
   const n=3,cw=1.3,x0f=-W/2+0.3,zf=-D/2+0.3;for(let k=0;k<n;k++){const cx=x0f+0.1,cz=zf+2.2+k*cw;
    const wall=new THREE.Mesh(B(1.4,2.3,0.05,0.7,1.15,-cw/2),pm);wall.position.set(cx,0,cz);sc.add(wall);
    const cur=new THREE.Mesh(new THREE.PlaneGeometry(cw-0.1,2.0),cm);cur.rotation.y=Math.PI/2;cur.position.set(cx+1.4,1.15,cz);sc.add(cur);
    colliders.push([cx,cx+1.45,cz-cw/2,cz+cw/2]);}
   const last=new THREE.Mesh(B(1.4,2.3,0.05,0.7,1.15,0),pm);last.position.set(x0f+0.1,0,zf+2.2+n*cw-cw/2);sc.add(last);
   const ft=canvasTex(512,112,(g,w,h)=>{g.fillStyle='#1f2226';rr(g,2,2,w-4,h-4,14);g.fill();g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';g.font='800 44px Manrope, sans-serif';g.fillText('Примерочные',w/2,h/2);});
   const fs=new THREE.Mesh(new THREE.PlaneGeometry(1.8,0.4),new THREE.MeshBasicMaterial({map:ft,toneMapped:false,side:THREE.DoubleSide}));fs.rotation.y=Math.PI/2;fs.position.set(x0f+1.5,2.6,zf+2.2+cw);sc.add(fs);}}
 // инстансы товаров
 const M=models();const byModel={};
 Object.entries(inst).forEach(([model,arr])=>{
  let geo=M[model]||M.box;let mat;
  if(model==='football'||model==='basketball')mat=new THREE.MeshStandardMaterial({map:ballTex(model),roughness:.5});
  else mat=new THREE.MeshStandardMaterial({roughness:model==='bottle'?.1:.6,metalness:model==='small'?.6:0,transparent:model==='bottle',opacity:model==='bottle'?.85:1});
  const im=new THREE.InstancedMesh(geo,mat,arr.length);const q=new THREE.Quaternion(),sc_=new V3();
  arr.forEach((o,i)=>{q.setFromAxisAngle(new V3(0,1,0),o.ry);sc_.set(o.scale,o.scale,o.scale);mtx.compose(new V3(o.x,o.y,o.z),q,sc_);im.setMatrixAt(i,mtx);im.setColorAt(i,LIN(o.color));});
  if(im.instanceColor)im.instanceColor.needsUpdate=true;im.userData.prods=arr.map(o=>o.prod);sc.add(im);pick.push(im);byModel[model]=arr;
  if(model==='bike'){const wh=new THREE.InstancedMesh(M.bikeWheels,new THREE.MeshStandardMaterial({color:LIN('#1c1d20'),roughness:.7}),arr.length);arr.forEach((o,i)=>{im.getMatrixAt(i,mtx);wh.setMatrixAt(i,mtx);});wh.userData.prods=im.userData.prods;sc.add(wh);pick.push(wh);}});
 // несколько покупателей
 {const parts=humanParts();const n=big?8:4;const r=mulberry(s.id+5);const mats=[new THREE.MeshStandardMaterial({roughness:.8}),new THREE.MeshStandardMaterial({roughness:.8}),new THREE.MeshStandardMaterial({roughness:.8}),new THREE.MeshStandardMaterial({roughness:.6})];
  const ms=[parts.torso,parts.legs,parts.arms,parts.head].map((g,i)=>new THREE.InstancedMesh(g,mats[i],n));const cl=['#2f3a4a','#8a3b3b','#3f5e4a','#c9b79c','#4d4f7c'],sk=['#e6c3a5','#c6946b','#f0d2bb'];
  const ppl=[];for(let i=0;i<n;i++){let x,z,t=0;do{x=(r()-.5)*(W-3);z=(r()-.5)*(D-3);t++;}while(shopBlockedRaw(colliders,W,D,x,z,0)&&t<100);ppl.push({x,z,tx:x,tz:z,a:r()*6,sp:0.7+r()*0.5,wait:r()*3,ph:r()*6});
   ms[0].setColorAt(i,LIN(cl[i%cl.length]));ms[2].setColorAt(i,LIN(cl[i%cl.length]));ms[1].setColorAt(i,LIN('#2c3440'));ms[3].setColorAt(i,LIN(sk[i%sk.length]));}
  ms.forEach(m=>{if(m.instanceColor)m.instanceColor.needsUpdate=true;sc.add(m);});
  SHOP_PEOPLE={list:ppl,meshes:ms,r};}
 return{s,scene:sc,colliders,pick,zones,W,D,cat,dw:DWs,leaves:[lv1,lv2],doorOpen:0};}
let SHOP_PEOPLE=null;
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
function fadeThen(fn){const f=$('fade');f.hidden=false;requestAnimationFrame(()=>{f.style.opacity=1;setTimeout(()=>{fn();requestAnimationFrame(()=>{f.style.opacity=0;setTimeout(()=>{f.hidden=true;},320);});},300);});}
// бесшовный переход: позиция и направление взгляда переносятся относительно двери
function enterShop(s,rel){if(mode==='store'||!s.door)return;closeCard();
 const d=s.door;if(SHOP&&SHOP.s!==s)disposeShop();if(!SHOP)SHOP=buildShop(s);
 let along=-0.4,lat=0,fa=-1,fl=0;
 if(rel){along=rel.along;lat=rel.lat;const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);fa=fx*d.n.x+fz*d.n.z;fl=fx*d.R.x+fz*d.R.z;}
 returnDoor=s;mode='store';anim=null;
 player.x=Math.max(-SHOP.dw/2+0.4,Math.min(SHOP.dw/2-0.4,lat));player.z=SHOP.D/2+Math.min(-0.2,along);
 if(rel){player.yaw=Math.atan2(-fl,-fa);}else{player.yaw=0;player.pitch=0;}
 const vA=player.vx*d.n.x+player.vz*d.n.z,vL=player.vx*d.R.x+player.vz*d.R.z;player.vx=vL;player.vz=vA;
 SHOP.doorOpen=1;updateShopDoor();$('shopHud').hidden=false;$('shopHudName').textContent=s.name;setMallUI(false);updateCross();applyPose(walkPose());
 if(!rel){const f=$('fade');f.hidden=false;f.style.opacity=1;requestAnimationFrame(()=>{f.style.opacity=0;setTimeout(()=>{f.hidden=true;},320);});}
 showHint('Ты в «'+s.name+'». Походи по залу, нажми на понравившийся товар. Выход — через двери позади');}
let returnDoor=null;
function exitShop(rel){if(mode!=='store')return;const s=returnDoor||SHOP.s,d=s.door;closeShopPanel(false);
 let along=0.5,lat=0,fa=1,fl=0;
 if(rel){along=Math.max(0.35,rel.along);lat=rel.lat;const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);fa=fz;fl=fx;}
 mode='walk';$('shopHud').hidden=true;setMallUI(true);
 const vA=player.vz,vL=player.vx;
 player.x=d.c.x+d.n.x*along+d.R.x*lat;player.z=d.c.z+d.n.z*along+d.R.z*lat;
 const fx=d.n.x*fa+d.R.x*fl,fz=d.n.z*fa+d.R.z*fl;player.yaw=rel?Math.atan2(-fx,-fz):Math.atan2(d.n.x,d.n.z);
 player.vx=d.n.x*vA+d.R.x*vL;player.vz=d.n.z*vA+d.R.z*vL;
 if(blocked(player.x,player.z)){const w=nearestFree(player.x,player.z);if(w){player.x=w[0];player.z=w[1];}}
 d.open=1;updateDoors();doorCooldown=0.8;updateCross();applyPose(walkPose());}
function updateShopDoor(){if(!SHOP)return;const o=SHOP.doorOpen,h=SHOP.dw/2;SHOP.leaves[0].position.set(-(h/2+o*h*0.92),0,0.03);SHOP.leaves[1].position.set(h/2+o*h*0.92,0,0.03);}
function disposeShop(){if(!SHOP)return;SHOP.scene.traverse(o=>{if(o.geometry&&!Object.values(MODELS||{}).includes(o.geometry))o.geometry.dispose();if(o.material){const shared=Object.values(MAT);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(shared.includes(m))return;if(m.map&&![shelfAtlas,marble,blobTex].includes(m.map))m.map.dispose();m.dispose();});}});SHOP=null;SHOP_PEOPLE=null;}
function setMallUI(on){['chips','mini','note'].forEach(id=>{$(id).style.display=on?'':'none';});document.querySelector('#top .seg').style.display=on?'':'none';}
// двери: открываются при приближении, проход в проём — вход
function updateMallDoors(dt){if(!world.doors)return;let changed=false;const px=player.x,pz=player.z;
 if(doorCooldown>0)doorCooldown-=dt;
 world.doors.forEach(s=>{const d=s.door;const dx=px-d.c.x,dz=pz-d.c.z;const along=dx*d.n.x+dz*d.n.z,lat=dx*d.R.x+dz*d.R.z;
  const near=mode==='walk'&&Math.hypot(dx,dz)<5.5&&along>-1;const target=near?1:0;
  if(Math.abs(d.open-target)>0.001){d.open+=(target-d.open)*Math.min(1,dt*4);changed=true;}
  // заранее собрать зал, пока подходим
  if(near&&mode==='walk'&&(!SHOP||SHOP.s!==s)&&Math.hypot(dx,dz)<4.5&&!updateMallDoors.busy){updateMallDoors.busy=true;setTimeout(()=>{if(mode==='walk'){if(SHOP&&SHOP.s!==s)disposeShop();if(!SHOP)SHOP=buildShop(s);}updateMallDoors.busy=false;},0);}
  if(mode==='walk'&&!anim&&doorCooldown<=0&&d.open>0.5&&along<-0.05&&Math.abs(lat)<d.w/2){enterShop(s,{along,lat});}});
 if(changed)updateDoors();}
function updateShopExit(dt){if(mode!=='store'||!SHOP)return;const dz=SHOP.D/2-player.z;const near=dz<5&&Math.abs(player.x)<SHOP.dw/2+2;
 const t=near?1:0;if(Math.abs(SHOP.doorOpen-t)>0.001){SHOP.doorOpen+=(t-SHOP.doorOpen)*Math.min(1,(dt||0.016)*4);updateShopDoor();}
 if(!anim&&player.z>SHOP.D/2+0.05&&Math.abs(player.x)<SHOP.dw/2)exitShop({along:player.z-SHOP.D/2,lat:player.x});}

/* ---------- Выбор в зале ---------- */
function shopHit(x,y){ray.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-(y/innerHeight)*2+1),cam);const hits=ray.intersectObjects(SHOP.pick,false);
 for(const h of hits){const o=h.object;if(o.userData.exit)return{exit:true,dist:h.distance};if(o.userData.dept!=null)return{dept:o.userData.dept,dist:h.distance};
  if(o.userData.prods&&h.instanceId!=null)return{prod:o.userData.prods[h.instanceId],dist:h.distance};if(o.userData.prod)return{prod:o.userData.prod,dist:h.distance};}return null;}
function shopPick(x,y){const h=shopHit(x,y);if(!h)return;if(h.exit){exitShop();return;}
 if(h.prod&&h.dist<14)openProduct(h.prod);}
function shopAimText(){const h=shopHit(innerWidth/2,innerHeight/2);if(!h||h.dist>12)return'';if(h.exit)return'Выход в галерею · нажми';if(h.dept!=null)return'Отдел «'+SHOP.cat[h.dept].title+'»';if(h.prod)return h.prod.name+' · '+fmtPrice(h.prod.price);return'';}
function goToDept(i){const z=SHOP.zones[i];if(!z)return;let tx=z.cx,tz=z.cz+z.d/2+0.8;for(let k=0;k<20&&shopBlocked(tx,tz);k++)tz+=0.4;
 player.x=tx;player.z=Math.min(tz,SHOP.D/2-1.2);player.yaw=0;player.pitch=-0.12;anim={t:0,from:{p:cam.position.clone(),q:cam.quaternion.clone()},m:'walk'};}

/* ---------- Панели магазина: курсор появляется сам ---------- */
function openShopPanel(){$('shop').hidden=false;$('shop').classList.remove('min');releaseLock();updateCross();}
function closeShopPanel(relock){stopViewer();$('shop').hidden=true;if(relock)requestLockIfNeeded();else updateCross();}
function requestLockIfNeeded(){if(!coarse&&isFP()&&!locked){requestLock();}updateCross();}
$('shopCat').onclick=()=>{shopProd=null;renderShopPanel();openShopPanel();};
$('shopOut').onclick=()=>exitShop();
/* ---------- Панель каталога ---------- */
function renderShopPanel(){const s=SHOP.s,cat=SHOP.cat;const el=$('shop');
 el.querySelector('.sh-name').textContent=s.name;el.querySelector('.sh-what').textContent=(s.what||'')+' · 1 этаж';
 el.querySelector('.sh-dot').style.background=s.colHex;
 const tabs=el.querySelector('.sh-tabs');tabs.innerHTML='';
 cat.forEach((d,i)=>{const b=document.createElement('button');b.className='sh-tab'+(i===shopDept?' on':'');b.textContent=d.title;b.onclick=()=>{shopDept=i;shopProd=null;renderShopPanel();};tabs.appendChild(b);});
 const body=el.querySelector('.sh-body');body.innerHTML='';
 if(shopProd){const p=shopProd;const w=document.createElement('div');w.className='sh-detail';
  const img=document.createElement('img');img.src=iconURL(p.icon,p.color);img.alt='';w.appendChild(img);
  const h=document.createElement('h3');h.textContent=p.name;w.appendChild(h);
  const pr=document.createElement('p');pr.className='sh-price';pr.textContent=fmtPrice(p.price);w.appendChild(pr);
  const note=document.createElement('p');note.className='sh-note';note.textContent='Товар и цена — пример для концепта. Настоящий ассортимент и наличие смотри на сайте магазина.';w.appendChild(note);
  const row=document.createElement('div');row.className='sh-row';
  const back=document.createElement('button');back.className='btn';back.textContent='← К отделу';back.onclick=()=>{shopProd=null;renderShopPanel();};row.appendChild(back);
  const show=document.createElement('button');show.className='btn';show.textContent='Показать в зале';show.onclick=()=>{closeShopPanel(true);goToDept(shopDept);};row.appendChild(show);
  const a=document.createElement('a');a.className='btn pri';a.target='_blank';a.rel='noopener';const site=siteOf(s);a.href=site||mapsOf(s);a.textContent=site?'Смотреть на сайте ↗':'Магазин на картах ↗';row.appendChild(a);
  w.appendChild(row);body.appendChild(w);}
 else{const grid=document.createElement('div');grid.className='sh-grid';
  cat[shopDept].items.forEach(p=>{const c=document.createElement('button');c.className='sh-card';const img=document.createElement('img');img.src=iconURL(p.icon,p.color);img.alt='';img.loading='lazy';
   const n=document.createElement('span');n.className='sh-cn';n.textContent=p.name;const pr=document.createElement('span');pr.className='sh-cp';pr.textContent=fmtPrice(p.price);
   c.append(img,n,pr);c.onclick=()=>{openProduct(p);};grid.appendChild(c);});body.appendChild(grid);}
 const site=siteOf(s);const f=el.querySelector('.sh-site');f.href=site||mapsOf(s);f.textContent=site?'Сайт магазина ↗':'Магазин на Яндекс Картах ↗';}
$('shExit').onclick=()=>closeShopPanel(true);
$('shMin').onclick=()=>{$('shop').classList.toggle('min');};

/* ---------- Страница товара: 3D со всех сторон, на манекене, размеры ---------- */
const SIZES={jacket:['XS','S','M','L','XL','XXL'],pants:['44','46','48','50','52','54'],tshirt:['XS','S','M','L','XL','XXL'],dress:['40','42','44','46','48','50'],shoe:['38','39','40','41','42','43','44','45'],bike:['S · 150–165 см','M · 165–178 см','L · 178–190 см']};
const WEARABLE={jacket:1,pants:1,tshirt:1,dress:1,shoe:1};
let PV=null;
function productModel(p){const dep=DEPT[p.dept];let m=dep?dep.model:'box';if(p.icon==='shoe')m='shoe';return m;}
function ensureViewer(){if(PV)return PV;const cv=document.createElement('canvas');cv.className='pv';cv.width=640;cv.height=440;
 const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});r.outputEncoding=THREE.sRGBEncoding;r.toneMapping=THREE.ACESFilmicToneMapping;r.setPixelRatio(1);r.setSize(640,440,false);
 const sc=new THREE.Scene();sc.environment=scene.environment;sc.add(new THREE.HemisphereLight(LIN('#ffffff'),LIN('#c9c1b5'),0.9));const dl=new THREE.DirectionalLight(LIN('#ffffff'),0.8);dl.position.set(2,4,3);sc.add(dl);
 const c=new THREE.PerspectiveCamera(30,640/440,0.05,50);const pod=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,0.04,40),new THREE.MeshStandardMaterial({color:LIN('#eceae6'),roughness:.4}));sc.add(pod);
 const root=new THREE.Group();sc.add(root);PV={cv,r,sc,c,root,pod,rot:0.6,drag:null,raf:0,run:false};
 cv.addEventListener('pointerdown',e=>{PV.drag=e.clientX;cv.setPointerCapture(e.pointerId);});cv.addEventListener('pointermove',e=>{if(PV.drag!=null){PV.rot+=(e.clientX-PV.drag)*0.012;PV.drag=e.clientX;}});
 cv.addEventListener('pointerup',()=>{PV.drag=null;});cv.addEventListener('pointercancel',()=>{PV.drag=null;});return PV;}
function stopViewer(){if(PV){PV.run=false;cancelAnimationFrame(PV.raf);}}
function viewerShow(p,onMannequin){const V=ensureViewer();while(V.root.children.length)V.root.remove(V.root.children[0]);
 const M=models(),m=productModel(p),col=LIN(p.color);const mat=new THREE.MeshStandardMaterial({color:col,roughness:.55});
 let h=1;
 if(onMannequin&&WEARABLE[m]){const parts=humanParts();const skin=new THREE.MeshStandardMaterial({color:LIN('#f1efeb'),roughness:.3});
  const top=(m==='jacket'||m==='tshirt'||m==='dress'),bottom=(m==='pants'||m==='dress');
  const body=new THREE.Mesh(parts.torso,top?mat:skin),legs=new THREE.Mesh(parts.legs,bottom?mat:new THREE.MeshStandardMaterial({color:LIN('#2c3440'),roughness:.8})),arms=new THREE.Mesh(parts.arms,m==='jacket'?mat:skin),head=new THREE.Mesh(parts.head,skin);
  V.root.add(body,legs,arms,head);
  if(m==='jacket'){const coat=new THREE.Mesh(B(0.44,0.8,0.3,0,1.3,0),mat);V.root.add(coat);}
  if(m==='shoe'){[-0.09,0.09].forEach(x=>{const sh=new THREE.Mesh(M.shoe,mat);sh.rotation.y=-Math.PI/2;sh.position.set(x,0,0.05);V.root.add(sh);});}
  h=1.95;}
 else{const geo=M[m]||M.box;let mesh;
  if(m==='football'||m==='basketball')mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:ballTex(m),roughness:.5}));else mesh=new THREE.Mesh(geo,mat);
  const g=new THREE.Group();g.add(mesh);if(m==='bike'){g.add(new THREE.Mesh(M.bikeWheels,new THREE.MeshStandardMaterial({color:LIN('#1c1d20'),roughness:.7})));}
  const bb=new THREE.Box3().setFromObject(g);const size=bb.getSize(new V3()),ctr=bb.getCenter(new V3());g.position.set(-ctr.x,-bb.min.y,-ctr.z);
  if(m==='jacket'||m==='pants'||m==='tshirt'||m==='dress'){g.position.y=-bb.min.y;}
  V.root.add(g);h=Math.max(size.y,size.x*0.75,size.z*0.75);}
 V.pod.position.y=-0.02;V.target=h;V.c.position.set(0,h*0.62,h*2.6+0.3);V.c.lookAt(0,h*0.48,0);
 if(!V.run){V.run=true;const loop=()=>{if(!V.run)return;if(V.drag==null)V.rot+=0.006;V.root.rotation.y=V.rot;V.r.render(V.sc,V.c);V.raf=requestAnimationFrame(loop);};loop();}
 return V.cv;}
function openProduct(p){shopProd=p;shopDept=Math.max(0,SHOP.cat.findIndex(d=>d.key===p.dept));renderProduct(p,false);openShopPanel();}
function renderProduct(p,onMan){const s=SHOP.s,el=$('shop');el.querySelector('.sh-name').textContent=p.name;el.querySelector('.sh-what').textContent=s.name+' · '+(DEPT[p.dept]?DEPT[p.dept].t:'');el.querySelector('.sh-dot').style.background=s.colHex;
 el.querySelector('.sh-tabs').innerHTML='';const body=el.querySelector('.sh-body');body.innerHTML='';
 const w=document.createElement('div');w.className='sh-detail';
 const m=productModel(p);const cv=viewerShow(p,onMan);w.appendChild(cv);
 const tip=document.createElement('p');tip.className='sh-note';tip.textContent='Потяни картинку, чтобы повернуть товар.';w.appendChild(tip);
 if(WEARABLE[m]){const tg=document.createElement('div');tg.className='sh-seg';['Товар','На манекене'].forEach((t,i)=>{const b=document.createElement('button');b.className='sh-tab'+((!!onMan)===(i===1)?' on':'');b.textContent=t;b.onclick=()=>renderProduct(p,i===1);tg.appendChild(b);});w.appendChild(tg);}
 const pr=document.createElement('p');pr.className='sh-price';pr.textContent=fmtPrice(p.price);w.appendChild(pr);
 const sz=SIZES[m];if(sz){const lab=document.createElement('p');lab.className='sh-lab';lab.textContent='Размер';w.appendChild(lab);const row=document.createElement('div');row.className='sh-sizes';
  sz.forEach(x=>{const b=document.createElement('button');b.className='sh-size';b.textContent=x;b.onclick=()=>{row.querySelectorAll('.sh-size').forEach(q=>q.classList.remove('on'));b.classList.add('on');};row.appendChild(b);});w.appendChild(row);}
 const note=document.createElement('p');note.className='sh-note';note.textContent='Товар, цена и размеры — пример для концепта. Настоящие наличие и размеры — на сайте магазина.';w.appendChild(note);
 const row=document.createElement('div');row.className='sh-row';
 const a=document.createElement('a');a.className='btn pri';a.target='_blank';a.rel='noopener';const site=siteOf(s);a.href=site||mapsOf(s);a.textContent=site?'Смотреть на сайте ↗':'Магазин на картах ↗';row.appendChild(a);
 const back=document.createElement('button');back.className='btn';back.textContent='Продолжить прогулку';back.onclick=()=>closeShopPanel(true);row.appendChild(back);
 w.appendChild(row);body.appendChild(w);
 const f=el.querySelector('.sh-site');f.href=site||mapsOf(s);f.textContent=site?'Сайт магазина ↗':'Магазин на Яндекс Картах ↗';}

async function start(){
 try{await Promise.race([document.fonts.load('800 40px Manrope'),new Promise(r=>setTimeout(r,2500))]);}catch(e){}
 try{build();}catch(err){$('loading').textContent='Не получилось построить сцену: '+err.message;console.error(err);return;}
 {const w=nearestFree(player.x,player.z);if(w){player.x=w[0];player.z=w[1];}}
 buildChips();sizeMini();updateJoy();setVis();updateCross();applyPose(walkPose());
 $('loading').hidden=true;
 showHint(coarse?'Джойстик — идти, проведи по экрану — осмотреться. Нажми на витрину.':'Ты у входа 2. Кликни по сцене — курсор скроется, и обзор пойдёт за мышью · WASD — идти · Esc — вернуть курсор');
 requestAnimationFrame(frame);
}
// Отладочный доступ для тестов и Claude Code: открой страницу с ?debug
if(new URLSearchParams(location.search).has('debug'))window.__maxi={get mode(){return mode},player,S,keys,world,get SHOP(){return SHOP},cam,renderer,
 enterShop,exitShop,openProduct,walkToDoor,setMode,blocked,isWalk,get locked(){return locked},get loaded(){return $('loading').hidden}};
start();

}
