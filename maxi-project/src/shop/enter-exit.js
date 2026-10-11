// Вход в магазин и выход: бесшовный переход через дверь, двери галереи, выход из зала.
import {loadFeed} from './feeds.js';
import {updateCross} from '../controls/input.js';
import {blocked, updateFloorUI, updateJoy} from '../controls/move.js';
import {applyPose, player, walkPose} from '../controls/player.js';
import {setVis} from '../controls/view.js';
import {$} from '../core/helpers.js';
import {hideLiftPanel} from '../mall/lifts.js';
import {MAT, updateDoors, world} from '../mall/world.js';
import {nearestFree} from '../nav/walkgrid.js';
import {blobTex, marble, shelfAtlas} from '../render/textures.js';
import {updateFittingBooth} from './fitting-booth.js';
import {MOD} from './goods.js';
import {buildShop} from './hall.js';
import {closeShopPanel} from './panel.js';
import {closeCard} from '../ui/card.js';
import {hideGoHere} from '../ui/go-here.js';
import {showHint} from '../ui/hint.js';
import {drawMiniBase} from '../ui/minimap.js';
import {floorName} from '../ui/pick.js';
import {app} from '../core/state.js';
let returnPos, doorCooldown, returnDoor;

export function fadeThen(fn){if(app.calm){fn();return;}const f=$('fade');f.hidden=false;requestAnimationFrame(()=>{f.style.opacity=1;setTimeout(()=>{fn();requestAnimationFrame(()=>{f.style.opacity=0;setTimeout(()=>{f.hidden=true;},320);});},300);});}
// бесшовный переход: позиция и направление взгляда переносятся относительно двери
export function enterShop(s,rel){if(app.mode==='store'||!s.door)return;closeCard();
 const d=s.door;if(app.SHOP&&(app.SHOP.s!==s||app.SHOP.feedV!==!!s._feed))disposeShop();if(!app.SHOP){app.SHOP=buildShop(s);app.SHOP.feedV=!!s._feed;}app.PS=app.SHOP;closeShopPanel(false);
 let along=-0.4,lat=0,fa=-1,fl=0;
 if(rel){along=rel.along;lat=rel.lat;const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);fa=fx*d.n.x+fz*d.n.z;fl=fx*d.R.x+fz*d.R.z;}
 returnDoor=s;app.mode='store';app.anim=null;
 player.x=Math.max(-app.SHOP.dw/2+0.4,Math.min(app.SHOP.dw/2-0.4,lat));player.z=app.SHOP.D/2+Math.min(-0.2,along);
 if(rel){player.yaw=Math.atan2(-fl,-fa);}else{player.yaw=0;player.pitch=0;}
 const vA=player.vx*d.n.x+player.vz*d.n.z,vL=player.vx*d.R.x+player.vz*d.R.z;player.vx=vL;player.vz=vA;
 app.SHOP.doorOpen=1;updateShopDoor();$('shopHud').hidden=false;$('shopHudName').textContent=s.name+' · '+floorName(s.floor);setMallUI(false);updateCross();applyPose(walkPose());
 if(!rel&&!app.calm){const f=$('fade');f.hidden=false;f.style.opacity=1;requestAnimationFrame(()=>{f.style.opacity=0;setTimeout(()=>{f.hidden=true;},320);});}
 hideLiftPanel(false);hideGoHere();
 showHint('Ты в «'+s.name+'». Походи по залу, нажми на понравившийся товар. Выход — через двери позади');}
export function exitShop(rel){if(app.mode!=='store')return;const s=returnDoor||app.SHOP.s,d=s.door;closeShopPanel(false);
 let along=1.3,lat=0,fa=1,fl=0;
 if(rel){along=Math.max(0.35,rel.along);lat=rel.lat;const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw);fa=fz;fl=fx;}
 app.mode='walk';$('shopHud').hidden=true;setMallUI(true);if(d.floor!==app.curFloor){app.curFloor=d.floor;updateFloorUI();setVis();drawMiniBase();}
 const vA=player.vz,vL=player.vx;
 player.x=d.c.x+d.n.x*along+d.R.x*lat;player.z=d.c.z+d.n.z*along+d.R.z*lat;
 const fx=d.n.x*fa+d.R.x*fl,fz=d.n.z*fa+d.R.z*fl;player.yaw=rel?Math.atan2(-fx,-fz):Math.atan2(-d.n.x,-d.n.z);if(!rel)player.pitch=0;
 player.vx=d.n.x*vA+d.R.x*vL;player.vz=d.n.z*vA+d.R.z*vL;
 if(blocked(player.x,player.z)){const w=nearestFree(player.x,player.z);if(w){player.x=w[0];player.z=w[1];}}
 d.open=1;updateDoors();doorCooldown=0.8;updateJoy();updateCross();applyPose(walkPose());}
export function updateShopDoor(){if(!app.SHOP)return;const o=app.SHOP.doorOpen,h=app.SHOP.dw/2;app.SHOP.leaves[0].position.set(-(h/2+o*h*0.92),0,0.03);app.SHOP.leaves[1].position.set(h/2+o*h*0.92,0,0.03);}
export function disposeShop(){if(!app.SHOP)return;app.SHOP.scene.traverse(o=>{if(o.geometry&&!(MOD&&MOD.geos.has(o.geometry)))o.geometry.dispose();if(o.material){const shared=Object.values(MAT);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(shared.includes(m))return;if(m.map&&![shelfAtlas,marble,blobTex].includes(m.map)&&!(MOD&&MOD.texs.has(m.map)))m.map.dispose();m.dispose();});}});app.SHOP=null;app.SHOP_PEOPLE=null;}
function setMallUI(on){document.body.classList.toggle('in-store',!on);['chips','mini','note'].forEach(id=>{$(id).style.display=on?'':'none';});document.querySelectorAll('#top .seg').forEach(e=>{e.style.display=on?'':'none';});}
// двери: открываются при приближении, проход в проём — вход
export function updateMallDoors(dt){if(!world.doors)return;let changed=false;const px=player.x,pz=player.z;
 if(doorCooldown>0)doorCooldown-=dt;
 world.doors.forEach(s=>{const d=s.door;const dx=px-d.c.x,dz=pz-d.c.z;const along=dx*d.n.x+dz*d.n.z,lat=dx*d.R.x+dz*d.R.z;
  const near=app.mode==='walk'&&!app.ride&&d.floor===app.curFloor&&Math.hypot(dx,dz)<5.5&&along>-1;const target=near?1:0;
  if(Math.abs(d.open-target)>0.001){d.open=app.calm?target:d.open+(target-d.open)*Math.min(1,dt*4);changed=true;}
  // выгрузку товаров магазина подгружаем заранее, издалека
  if(d.floor===app.curFloor&&!s._feedTried&&!s._feedP&&Math.hypot(dx,dz)<14)loadFeed(s);
  // заранее собрать зал, пока подходим
  if(near&&app.mode==='walk'&&(!app.SHOP||app.SHOP.s!==s||app.SHOP.feedV!==!!s._feed)&&Math.hypot(dx,dz)<4.5&&!updateMallDoors.busy){updateMallDoors.busy=true;loadFeed(s).then(()=>{if(app.mode==='walk'){if(app.SHOP&&(app.SHOP.s!==s||app.SHOP.feedV!==!!s._feed))disposeShop();if(!app.SHOP){app.SHOP=buildShop(s);app.SHOP.feedV=!!s._feed;}}updateMallDoors.busy=false;});}
  if(app.mode==='walk'&&!app.anim&&!app.ride&&d.floor===app.curFloor&&doorCooldown<=0&&d.open>0.5&&along<-0.05&&along>-2&&Math.abs(lat)<d.w/2){enterShop(s,{along,lat});}});
 if(changed)updateDoors();}
export function updateShopExit(dt){if(app.mode!=='store'||!app.SHOP)return;updateFittingBooth();const dz=app.SHOP.D/2-player.z;const near=dz<5&&Math.abs(player.x)<app.SHOP.dw/2+2;
 const t=near?1:0;if(Math.abs(app.SHOP.doorOpen-t)>0.001){app.SHOP.doorOpen=app.calm?t:app.SHOP.doorOpen+(t-app.SHOP.doorOpen)*Math.min(1,(dt||0.016)*4);updateShopDoor();}
 if(!app.anim&&player.z>app.SHOP.D/2+0.05&&Math.abs(player.x)<app.SHOP.dw/2)exitShop({along:player.z-app.SHOP.D/2,lat:player.x});}

// по порядку, при запуске
export function init() {

/* ---------- Вход и выход ---------- */
returnPos = null; doorCooldown = 0; app.shopDept = 0; app.shopProd = null;
returnDoor = null;
}
