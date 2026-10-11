// Отладочный доступ для тестов: window.__maxi (страница с ?debug).
import {catalogOf} from '../shop/catalog.js';
import {cart} from '../shop/cart.js';
import {INTERIORS} from '../shop/interiors.js';
import {loadFeed} from '../shop/feeds.js';
import {onlineKind} from '../shop/online.js';
import {PREFS} from './settings.js';
import {locked} from '../controls/input.js';
import {blocked, goFloor, setFloor} from '../controls/move.js';
import {keys, player, topv} from '../controls/player.js';
import {setMode} from '../controls/view.js';
import {$} from './helpers.js';
import {escEntry, goEscalator, startEsc} from '../mall/escalators.js';
import {openLiftPanel, startRide} from '../mall/lifts.js';
import {S} from '../mall/stores.js';
import {world} from '../mall/world.js';
import {auditMap} from '../nav/audit.js';
import {showTop, walkTo, walkToDoor} from '../nav/travel.js';
import {isWalk} from '../nav/walkgrid.js';
import {FX, cam, renderer, scene} from '../render/scene.js';
import {applyStyle} from '../render/style-apply.js';
import {openCart} from '../shop/cart-ui.js';
import {enterShop, exitShop} from '../shop/enter-exit.js';
import {FIT, openFitting} from '../shop/fitting-booth.js';
import {setShopStyle} from '../shop/hall.js';
import {openProduct, renderProduct} from '../shop/product.js';
import {openBigMap} from '../ui/bigmap.js';
import {setCalm} from '../ui/calm.js';
import {openCard} from '../ui/card.js';
import {topTap} from '../ui/go-here.js';
import {pick} from '../ui/pick.js';
import {app} from './state.js';

// по порядку, при запуске
export function init() {

// Отладочный доступ для тестов и Claude Code: открой страницу с ?debug
if(new URLSearchParams(location.search).has('debug'))window.__maxi={loadFeed,catalogOf,onlineKind,openCard,setPS:v=>{app.PS=v;},get PS(){return app.PS},renderProduct,get mode(){return app.mode},player,S,keys,world,get SHOP(){return app.SHOP},cam,renderer,scene,
 enterShop,exitShop,openProduct,walkToDoor,walkTo,setMode,blocked,isWalk,get locked(){return locked},get loaded(){return $('loading').hidden},
 get floor(){return app.curFloor},get anim(){return app.anim},startEsc,goEscalator,escEntry,get escs(){return world.escs},auditMap,setFloor,goFloor,startRide,get ride(){return app.ride},get lifts(){return world.lifts},cart,openCart,setCalm,get calm(){return app.calm},topTap,get topv(){return topv},openLiftPanel,showTop,setStyle:applyStyle,FX,setShopStyle,INTERIORS,decor:()=>[world.decor1,world.decor2],pickAt:(x,y)=>pick(x,y,false),FIT,openFitting,openBigMap,PREFS};
}
