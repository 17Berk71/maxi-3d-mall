// Выбор в зале: что под прицелом, дальность, подойти к отделу.
import * as THREE from 'three';
import {fmtPrice} from './catalog.js';
import {player} from '../controls/player.js';
import {cam, coarse} from '../render/scene.js';
import {exitShop} from './enter-exit.js';
import {openFitting} from './fitting-booth.js';
import {shopBlocked} from './hall-people.js';
import {openProduct} from './product.js';
import {showHint} from '../ui/hint.js';
import {ray} from '../ui/pick.js';
import {app} from '../core/state.js';
let REACH, REACH_TOUCH, reach;

/* ---------- Выбор в зале ---------- */
function shopHit(x,y){ray.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-(y/innerHeight)*2+1),cam);const hits=ray.intersectObjects(app.SHOP.pick,false);
 for(const h of hits){const o=h.object;if(o.userData.exit)return{exit:true,dist:h.distance};if(o.userData.fit)return{fit:true,dist:h.distance};if(o.userData.dept!=null)return{dept:o.userData.dept,dist:h.distance};
  if(o.userData.prods&&h.instanceId!=null)return{prod:o.userData.prods[h.instanceId],dist:h.distance};if(o.userData.prod)return{prod:o.userData.prod,dist:h.distance};}return null;}
export function shopPick(x,y){const h=shopHit(x,y);if(!h)return;if(h.exit){if(h.dist<6)exitShop();else showHint('Подойди к двери, чтобы выйти');return;}
 if(h.fit){if(h.dist<reach()+1)openFitting();else showHint('Подойди к примерочной');return;}
 if(h.prod){if(h.dist<reach())openProduct(h.prod);else showHint('Подойди ближе, чтобы посмотреть товар');}}
export function shopAimText(){const h=shopHit(innerWidth/2,innerHeight/2);if(!h||h.dist>12)return'';if(h.exit)return h.dist<6?'Выход в галерею · нажми':'Выход в галерею';if(h.fit)return h.dist<reach()+1?'Примерочная · нажми, чтобы войти':'Примерочная';if(h.dept!=null)return'Отдел «'+app.SHOP.cat[h.dept].title+'»';if(h.prod)return h.dist<reach()?h.prod.name+' · '+fmtPrice(h.prod.price):'Подойди ближе';return'';}
export function goToDept(i){const z=app.SHOP.zones[i];if(!z)return;let tx=z.cx,tz=z.cz+z.d/2+0.8;for(let k=0;k<20&&shopBlocked(tx,tz);k++)tz+=0.4;
 player.x=tx;player.z=Math.min(tz,app.SHOP.D/2-1.2);player.yaw=0;player.pitch=-0.12;app.anim={t:0,from:{p:cam.position.clone(),q:cam.quaternion.clone()},m:'walk'};}

// по порядку, при запуске
export function init() {

// товар можно взять только вблизи, как в настоящем магазине; издалека — подсказка подойти
REACH = 3.2; REACH_TOUCH = 4.2;reach = ()=>coarse?REACH_TOUCH:REACH;
}
