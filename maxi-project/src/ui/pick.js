// Выбор в галерее: луч, что под курсором, подсказка-прицел, название этажа.
import * as THREE from 'three';
import {releaseLock} from '../controls/input.js';
import {goEscalator} from '../mall/escalators.js';
import {openLiftPanel} from '../mall/lifts.js';
import {S} from '../mall/stores.js';
import {pickables, world} from '../mall/world.js';
import {cam} from '../render/scene.js';
import {shopPick} from '../shop/hall-pick.js';
import {kioskHasGoods, openKioskPanel} from '../shop/panel.js';
import {closeCard, openCard} from './card.js';
import {hideGoHere, topTap} from './go-here.js';
import {showHint} from './hint.js';
import {app} from '../core/state.js';
export let ray;

function visibleHits(x,y){ray.setFromCamera(new THREE.Vector2(x/innerWidth*2-1,-(y/innerHeight)*2+1),cam);
 return ray.intersectObjects(pickables,false).filter(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;});}
function hitId(h){if(h.object.userData.lift!=null)return{lift:world.lifts[h.object.userData.lift]};if(h.object.userData.esc!=null)return{esc:world.escs[h.object.userData.esc]};let id=-1;if(h.object.userData.kiosks&&h.instanceId!=null){id=h.object.userData.kiosks[h.instanceId];if(id>=0&&S[id].kind==='kiosk')return{s:S[id],stand:true,seller:!!h.object.userData.seller};}else if(h.object.userData.fs)id=h.object.userData.fs[h.faceIndex];return id>=0?{s:S[id]}:null;}
export function pick(x,y,fromLock){if(app.ride)return;if(app.mode==='store'&&app.SHOP){shopPick(x,y);return;}
 const hits=visibleHits(x,y);
 for(const h of hits){const r=hitId(h);if(!r)continue;
  if(r.lift){if(fromLock)releaseLock();openLiftPanel(r.lift,true);return;}
  if(r.esc){if(app.mode==='walk')goEscalator(r.esc);return;}
  if(app.mode==='top'&&r.s.floor!==app.curFloor)continue;
  if((r.stand||r.s.island)&&app.mode==='walk'&&kioskHasGoods(r.s)){if(h.distance>7){showHint('Подойди к островку «'+r.s.name+'», чтобы посмотреть товары');return;}closeCard();openKioskPanel(r.s);if(fromLock)releaseLock();return;}
  openCard(r.s);hideGoHere();if(fromLock)releaseLock();return;}
 closeCard();
 if(app.mode==='top')topTap(x,y);}
export function aimAt(){const hits=visibleHits(innerWidth/2,innerHeight/2);for(const h of hits){const r=hitId(h);if(h.distance>40)return null;if(r)return r;if(h.object.userData.fs&&!r)return null;}return null;}
export function floorName(f){return f===1?'1 этаж':'2 этаж';}

// по порядку, при запуске
export function init() {

/* ---------- Выбор ---------- */
ray = new THREE.Raycaster();
}
