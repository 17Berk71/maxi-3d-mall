// Страница товара: 3D-просмотр, на манекене, размеры, миниатюры, описание.
import * as THREE from 'three';
import {siteOf, mapsOf, DEPT, fmtPrice, PHOTOS} from './catalog.js';
import {iconURL} from './icons.js';
import {describe} from './describe.js';
import {cart} from './cart.js';
import {feedInfo} from './feeds.js';
import {onlineKind, onlineActions, onlineText, ACTIONS} from './online.js';
import {$, LIN, V3} from '../core/helpers.js';
import {humanParts} from '../mall/people-parts.js';
import {scene} from '../render/scene.js';
import {blobTex} from '../render/textures.js';
import {openCart} from './cart-ui.js';
import {FIT, openFitting} from './fitting-booth.js';
import {Cy, MOD, mergeG, models} from './goods.js';
import {closeShopPanel, demoLine, openShopPanel} from './panel.js';
import {showHint} from '../ui/hint.js';
import {floorName} from '../ui/pick.js';
import {app} from '../core/state.js';
export let el_, fmtDate;
let SIZES, WEARABLE, PV, TH, thumbCache;

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
export function stopViewer(){if(PV){PV.run=false;cancelAnimationFrame(PV.raf);}}
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
 if(!V.run){V.run=true;const loop=()=>{if(!V.run)return;if(V.drag==null&&!app.calm)V.rot+=0.006;V.root.rotation.y=V.rot;V.r.render(V.sc,V.c);V.raf=requestAnimationFrame(loop);};loop();}
 return V.cv;}
export function thumbURL(p){if(p.photo&&PHOTOS[p.photo])return PHOTOS[p.photo].url;if(p.pic)return p.pic;if(thumbCache.has(p.id))return thumbCache.get(p.id);
 if(!TH){const cv=document.createElement('canvas');cv.width=240;cv.height=180;const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true,preserveDrawingBuffer:true});r.outputEncoding=THREE.sRGBEncoding;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=0.95;r.setSize(240,180,false);r.setClearColor(0xf1efeb,1);
  TH=Object.assign({cv,r,c:new THREE.PerspectiveCamera(28,240/180,0.02,50)},viewerScene());}
 while(TH.root.children.length)TH.root.remove(TH.root.children[0]);const {g,h}=productGroup(p,false);g.rotation.y=0.65;TH.root.add(g);TH.pod.scale.setScalar(Math.max(0.35,h*0.7));TH.sh.scale.setScalar(Math.max(0.3,h*0.6));
 TH.c.position.set(0,h*0.7,h*2.4+0.25);TH.c.lookAt(0,h*0.45,0);TH.r.render(TH.sc,TH.c);let url;try{url=TH.cv.toDataURL('image/jpeg',0.82);}catch(e){url=iconURL(p.icon,p.color);}
 thumbCache.set(p.id,url);return url;}
export function openProduct(p){app.shopProd=p;app.shopDept=Math.max(0,app.PS.cat.findIndex(d=>d.key===p.dept));renderProduct(p,false);openShopPanel();}
export function renderProduct(p,onMan,size){const s=app.PS.s,el=$('shop'),fi=p.feed?feedInfo(s):null,kind=onlineKind(s);
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
  fb.onclick=()=>{if(!FIT.has(p,s)){FIT.add(p,s,true);sync();showHint('«'+p.name+'» — в примерочной ('+FIT.count()+' вещ.). '+(app.mode==='store'&&app.SHOP&&app.SHOP.fit?'Кабина — в левом углу у входа':'Примерить можно в любом магазине одежды'));}else openFitting();};
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

// по порядку, при запуске
export function init() {

/* ---------- Страница товара: 3D со всех сторон, на манекене, размеры ---------- */
SIZES = {jacket:['XS','S','M','L','XL','XXL'],pants:['44','46','48','50','52','54'],tshirt:['XS','S','M','L','XL','XXL'],longsleeve:['XS','S','M','L','XL','XXL'],dress:['40','42','44','46','48','50'],shoe:['38','39','40','41','42','43','44','45'],bike:['S · 150–165 см','M · 165–178 см','L · 178–190 см']};
WEARABLE = {jacket:1,pants:1,tshirt:1,longsleeve:1,dress:1,shoe:1};
PV = null;
// картинки для карточек каталога: тот же 3D-товар, снимок под углом (кешируются)
TH = null;thumbCache = new Map();
el_ = (tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;};
fmtDate = d=>{if(!d)return'';const m=/^(\d{4})-(\d\d)-(\d\d)/.exec(d);return m?(+m[3])+' '+['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][+m[2]-1]:d;};
}
