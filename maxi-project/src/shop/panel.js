// Панель каталога магазина или островка.
import {siteOf, mapsOf, catalogOf, fmtPrice} from './catalog.js';
import {iconURL} from './icons.js';
import {loadFeed, feedInfo} from './feeds.js';
import {onlineKind, onlineText} from './online.js';
import {isFP, locked, releaseLock, requestLock, updateCross} from '../controls/input.js';
import {$} from '../core/helpers.js';
import {coarse} from '../render/scene.js';
import {exitShop} from './enter-exit.js';
import {goToDept} from './hall-pick.js';
import {fmtDate, openProduct, stopViewer, thumbURL} from './product.js';
import {showHint} from '../ui/hint.js';
import {floorName} from '../ui/pick.js';
import {app} from '../core/state.js';
let shopShown;

/* ---------- Панели магазина: курсор появляется сам ---------- */
export function openShopPanel(){$('shop').hidden=false;$('shop').classList.remove('min');releaseLock();updateCross();}
export function closeShopPanel(relock){stopViewer();$('shop').hidden=true;if(relock)requestLockIfNeeded();else updateCross();}
export function requestLockIfNeeded(){if(!coarse&&isFP()&&!locked){requestLock();}updateCross();}
export function kioskHasGoods(s){return (s.kind==='kiosk'||s.island)&&s.cat!=='tbd'&&s.cat!=='wc';}
export function openKioskPanel(s){if(!s._feedTried){loadFeed(s).then(()=>openKioskPanel(s));return;}app.PS={s,cat:catalogOf(s)};app.shopDept=0;app.shopProd=null;shopShown=24;renderShopPanel();openShopPanel();
 showHint('«'+s.name+'» — товары островка. Нажми на товар, чтобы посмотреть его');}
function renderShopPanel(){const s=app.PS.s,cat=app.PS.cat;const el=$('shop');
 el.querySelector('.sh-name').textContent=s.name;el.querySelector('.sh-what').textContent=(s.what||'')+' · '+floorName(s.floor);
 el.querySelector('.sh-dot').style.background=s.colHex;
 const tabs=el.querySelector('.sh-tabs');tabs.innerHTML='';
 cat.forEach((d,i)=>{const b=document.createElement('button');b.className='sh-tab'+(i===app.shopDept?' on':'');b.textContent=d.title;b.onclick=()=>{app.shopDept=i;app.shopProd=null;shopShown=24;renderShopPanel();};tabs.appendChild(b);});
 const body=el.querySelector('.sh-body');body.innerHTML='';
 if(app.shopProd){const p=app.shopProd;const w=document.createElement('div');w.className='sh-detail';
  const img=document.createElement('img');img.src=iconURL(p.icon,p.color);img.alt='';w.appendChild(img);
  const h=document.createElement('h3');h.textContent=p.name;w.appendChild(h);
  const pr=document.createElement('p');pr.className='sh-price';pr.textContent=fmtPrice(p.price);w.appendChild(pr);
  const note=document.createElement('p');note.className='sh-note';note.textContent='Товар и цена — пример для концепта. Настоящий ассортимент и наличие смотри на сайте магазина.';w.appendChild(note);
  const row=document.createElement('div');row.className='sh-row';
  const back=document.createElement('button');back.className='btn';back.textContent='← К отделу';back.onclick=()=>{app.shopProd=null;renderShopPanel();};row.appendChild(back);
  if(app.mode==='store'){const show=document.createElement('button');show.className='btn';show.textContent='Показать в зале';show.onclick=()=>{closeShopPanel(true);goToDept(app.shopDept);};row.appendChild(show);}
  const a=document.createElement('a');a.className='btn pri';a.target='_blank';a.rel='noopener';const site=siteOf(s);a.href=site||mapsOf(s);a.textContent=site?'Смотреть на сайте ↗':'Магазин на картах ↗';row.appendChild(a);
  w.appendChild(row);body.appendChild(w);}
 else{const grid=document.createElement('div');grid.className='sh-grid';
  const dep=cat[app.shopDept];const all=dep.items;const shown=Math.min(all.length,shopShown);
  const cnt=document.createElement('p');cnt.className='sh-note';const fi=feedInfo(s);cnt.textContent=fi?'Товары из выгрузки магазина'+(fi.demo?' — тестовой: товары, цены и ссылки ненастоящие':'')+' · обновлено '+fmtDate(fi.updated)+' · в отделе '+all.length:onlineKind(s)!=='shop'?'Примеры позиций. '+onlineText(s):'В отделе '+all.length+' товаров'+(s.kind==='kiosk'?'':' · у каждого своё место в зале');body.appendChild(cnt);
  all.slice(0,shown).forEach(p=>{const c=document.createElement('button');c.className='sh-card';const img=document.createElement('img');img.src=thumbURL(p);img.alt='';img.loading='lazy';
   const n=document.createElement('span');n.className='sh-cn';n.textContent=p.name;const pr=document.createElement('span');pr.className='sh-cp';pr.textContent=fmtPrice(p.price);
   c.append(img,n,pr);c.onclick=()=>{openProduct(p);};grid.appendChild(c);});body.appendChild(grid);
  if(shown<all.length){const more=document.createElement('button');more.className='btn sh-more';more.textContent='Показать ещё '+Math.min(24,all.length-shown);more.onclick=()=>{shopShown+=24;renderShopPanel();};body.appendChild(more);}}
 const site=siteOf(s);const f=el.querySelector('.sh-site');f.href=site||mapsOf(s);f.textContent=site?'Сайт магазина ↗':'Магазин на Яндекс Картах ↗';demoLine(s);}
// подпись внизу панели: откуда товары
export function demoLine(s){const fi=feedInfo(s),k=onlineKind(s);$('shop').querySelector('.sh-demo').textContent=fi?(fi.demo?'Тестовая выгрузка: товары, цены и ссылки ненастоящие.':'Товары из выгрузки магазина, обновлено '+fmtDate(fi.updated)+'.'):k==='info'?'Меню — пример для концепта. Онлайн-заказа здесь нет.':k==='act'?'Позиции и цены — пример для концепта. Оформление — у самого заведения.':'Каталог — пример для концепта: товары и цены условные.';}

// по порядку, при запуске
export function init() {

$('shopCat').onclick=()=>{app.PS=app.SHOP;app.shopProd=null;renderShopPanel();openShopPanel();};
$('shopOut').onclick=()=>exitShop();
/* ---------- Панель каталога ---------- */
// откуда берётся каталог: зал магазина (SHOP) или стенд-островок в галерее
app.PS = null; shopShown = 24;
$('shExit').onclick=()=>closeShopPanel(true);
$('shMin').onclick=()=>{$('shop').classList.toggle('min');};
}
