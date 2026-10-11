// Карточка магазина.
import {siteOf, mapsOf} from '../shop/catalog.js';
import {loadFeed} from '../shop/feeds.js';
import {onlineKind, onlineActions, onlineText, ACTIONS} from '../shop/online.js';
import {updateCross} from '../controls/input.js';
import {$, V3} from '../core/helpers.js';
import {CATS} from '../mall/categories.js';
import {FLOORS, GLASS_H, world} from '../mall/world.js';
import {showTop, walkTo, walkToDoor} from '../nav/travel.js';
import {requestLockIfNeeded} from '../shop/panel.js';
import {floorName} from './pick.js';
import {app} from '../core/state.js';

export function openCard(s){
 app.target=s;$('card').hidden=false;const c=CATS[s.cat];loadFeed(s);
 $('cCol').style.background=s.colHex;$('cCat').textContent=c.n;$('cName').textContent=s.name;$('cWhat').textContent=s.what||'';
 $('cMeta').textContent=s.kind==='kiosk'?floorName(s.floor)+' · островок в галерее':floorName(s.floor)+' · около '+Math.max(5,Math.round(s.area/5)*5)+' м²';
 const also=(s.names||[]).slice(1);
 if(s.cat==='wc'){$('cMeta').textContent=floorName(s.floor);$('cWhat').textContent='';}
 $('cInfo').textContent=(onlineText(s)?onlineText(s)+' ':'')+(s.cat==='wc'?(/МГН|инвалид/i.test(s.name)?'Здесь туалет для маломобильных посетителей.':'Здесь туалет.'):s.cat==='tbd'?(s.kind==='kiosk'?'Островок без подписи на картах.':s.floor===2?'На Яндекс Картах у этого помещения нет подписи.':'На Яндекс Картах у этого помещения нет подписи.'):(also.length?'Также здесь: '+also.join(', ')+'. ':'')+'Галерея работает с 10:00 до 21:00, точный режим магазина лучше проверить на картах.');
 const b=$('cBtns');b.innerHTML='';
 if(s.door){const en=document.createElement('button');en.className='btn pri';en.textContent=s.name==='Синема Парк'?'Войти в кинотеатр':'Войти в магазин';en.onclick=()=>{walkToDoor(s);requestLockIfNeeded();};b.appendChild(en);}
 if(onlineKind(s)==='act'){const a0=onlineActions(s)[0],ab=document.createElement('a');ab.className='btn pri';ab.target='_blank';ab.rel='noopener';ab.href=siteOf(s)||mapsOf(s);ab.textContent=ACTIONS[a0].btn;ab.title=siteOf(s)?'Сайт '+s.name:'Контакты на Яндекс Картах';b.appendChild(ab);}
 const go=document.createElement('button');go.className=s.door||onlineKind(s)==='act'?'btn':'btn pri';go.textContent=s.floor!==app.curFloor?'Подойти · '+floorName(s.floor):'Подойти';go.onclick=()=>{walkTo(s);requestLockIfNeeded();};b.appendChild(go);
 if(app.mode==='walk'){const t=document.createElement('button');t.className='btn';t.textContent='Показать сверху';t.onclick=()=>showTop(s);b.appendChild(t);}
 if(s.cat!=='tbd'&&s.cat!=='wc'){const a=document.createElement('a');a.className='btn';a.href='https://yandex.ru/maps/15/tula/search/'+encodeURIComponent(s.name+' ТРЦ Макси');a.target='_blank';a.rel='noopener';a.textContent='На Яндекс Картах ↗';b.appendChild(a);}
 const F=FLOORS[s.floor];const p=s.fp?s.fp.clone().addScaledVector(s.fn,1.5):new V3(s.c[0],0,s.c[1]);world.target.position.set(p.x,F.y0+(s.kind==='kiosk'?GLASS_H:F.GH)+1.4,p.z);world.target.userData.base=world.target.position.y;world.target.visible=true;
}
export function closeCard(){$('card').hidden=true;app.target=null;if(world.target)world.target.visible=false;updateCross();}

// по порядку, при запуске
export function init() {

$('cardX').onclick=()=>{closeCard();requestLockIfNeeded();};
}
